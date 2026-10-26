"""End-to-end Studio test in headless Chromium. Run: python3 tests/e2e_studio.py [base_url]"""
import sys, json, base64, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8731'
SH = os.environ.get('SHOTS', '/tmp')
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(extra) if extra != '' else ''))
    if not cond: fails.append(name)

W2S = """([x,y,z]) => { const c = window.__arck; const v = new c.vp.camera.position.constructor(x,y,z).project(c.vp.camera); const r = c.vp.canvas.getBoundingClientRect(); return [r.left + (v.x+1)/2*r.width, r.top + (1-v.y)/2*r.height]; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':1360,'height':860}, accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' ' + str(e.stack)[:400]))
    pg.goto(BASE + '/studio.html'); pg.wait_for_function('window.__arck && window.__arck.sc'); pg.wait_for_timeout(800)
    n = lambda: pg.evaluate("window.__arck.sc.list.length")
    def click_world(x, y=0, z=0, **kw):
        sx, sy = pg.evaluate(W2S, [x, y, z]); pg.mouse.click(sx, sy, **kw); pg.wait_for_timeout(60)
    # top view for precise clicking
    pg.evaluate("window.__arck.view('top')"); pg.wait_for_timeout(400)
    # ---- wall tool
    pg.keyboard.press('w'); pg.wait_for_timeout(100)
    check('wall tool active', pg.evaluate("window.__arck.tools.tool") == 'wall')
    for pt in [(-4,-3),(4,-3),(4,3)]: click_world(pt[0],0,pt[1]); pg.mouse.move(*pg.evaluate(W2S,[pt[0]+0.1,0,pt[1]+0.1]))
    pg.wait_for_timeout(100); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    walls = pg.evaluate("window.__arck.sc.list.filter(e=>e.userData.catalogId==='wall').map(e=>[+e.userData.params.L.toFixed(2), +e.position.x.toFixed(2), +e.position.z.toFixed(2)])")
    check('two walls drawn with snapped lengths', len(walls)==2 and abs(walls[0][0]-8.25)<0.01 and abs(walls[1][0]-6.25)<0.01, walls)
    # typed length
    pg.keyboard.press('Escape'); pg.keyboard.press('w'); click_world(-6,0,-1); pg.mouse.move(*pg.evaluate(W2S,[-3,0,-1]))
    pg.fill('#wlen','5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100); pg.click('[data-oa=finish]'); pg.wait_for_timeout(100)
    w3 = pg.evaluate("window.__arck.sc.list.filter(e=>e.userData.catalogId==='wall').pop().userData.params.L")
    check('typed length 5 m makes 5.25 m wall', abs(w3-5.25)<0.01, w3)
    # ---- room tool
    before = n(); pg.keyboard.press('Escape'); pg.keyboard.press('q'); click_world(-6,0,2); click_world(-2,0,5); pg.wait_for_timeout(200)
    check('room creates 4 walls + floor', n()-before==5, n()-before)
    # ---- measure
    pg.keyboard.press('m'); click_world(-4,0,-3); click_world(4,0,-3); pg.wait_for_timeout(200)
    dim = pg.evaluate("(()=>{const d=window.__arck.sc.list.filter(e=>e.userData.kind==='dim').pop(); return d&&Math.hypot(d.userData.a[0]-d.userData.b[0],d.userData.a[2]-d.userData.b[2])})()")
    check('measure tool: 8 m', dim and abs(dim-8)<0.8, dim)
    # ---- add from library, select, edit params
    pg.keyboard.press('v'); pg.evaluate("window.__arck.addItem('arch-roman')"); pg.wait_for_timeout(300)
    check('library add selects item', pg.evaluate("window.__arck.sc.sel.length")==1)
    pg.click('.s-tabs [data-tab=edit]'); pg.wait_for_timeout(300)
    check('edit pane shows parameters', pg.locator('#prm input[type=range]').count()>=3)
    pg.evaluate("(()=>{const r=document.querySelector('#prm [data-k=span]'); r.value=9; r.dispatchEvent(new Event('input',{bubbles:true})); r.dispatchEvent(new Event('change',{bubbles:true}));})()"); pg.wait_for_timeout(500)
    span = pg.evaluate("window.__arck.sc.sel[0].userData.params.span"); check('param edit applied', span==9, span)
    sx = pg.evaluate("(()=>{const e=window.__arck.sc.sel[0]; const b=new e.position.constructor(); const bb=new (e.position.constructor.prototype.constructor)(); return 0})()")
    # position typing
    pg.fill('[data-xf=pos] input[data-i="0"]','12'); pg.keyboard.press('Tab'); pg.wait_for_timeout(200)
    check('typed position moves object', pg.evaluate("window.__arck.sc.sel[0].position.x")==12)
    # ---- undo/redo
    c0 = n(); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+y'); pg.wait_for_timeout(200)
    check('undo/redo cycle runs', pg.evaluate("window.__arck.sc.hi")>0)
    # ---- duplicate / array / delete
    pg.evaluate("window.__arck.sc.select([window.__arck.sc.list.find(e=>e.userData.catalogId==='arch-roman')])"); pg.wait_for_timeout(200)
    k = n(); pg.keyboard.press('Control+d'); pg.wait_for_timeout(200); check('duplicate', n()==k+1)
    pg.keyboard.press('Delete'); pg.wait_for_timeout(200); check('delete', n()==k)
    # ---- click-to-place
    pg.evaluate("window.__arck.addItem('tree-conifer',{stamp:true})"); pg.wait_for_timeout(200)
    k = n(); click_world(1,0,-5.5); click_world(3,0,-5.5); pg.wait_for_timeout(200); check('click-to-place stamps twice', n()==k+2, n()-k)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    # ---- view / sun / section tabs don't throw
    pg.click('.s-tabs [data-tab=view]'); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const s=document.querySelector('#shour'); s.value=16; s.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#secon').click();})()"); pg.wait_for_timeout(300)
    pg.click('.s-tabs [data-tab=plan]'); pg.wait_for_timeout(500)
    check('plan pane has quantities', pg.locator('#pane-plan table').count()>=2 and 'Estimated total' in pg.inner_text('#pane-plan'))
    pg.click('.s-tabs [data-tab=scene]'); pg.wait_for_timeout(300); check('scene outliner lists objects', pg.locator('.ent[data-id]').count()>5)
    pg.screenshot(path=SH+'/e2e_studio.png')
    pg.evaluate("document.querySelector('#secon').click()")
    # ---- export GLB then re-import through the file input
    pg.click('#btnExport'); 
    with pg.expect_download() as d: pg.click('#menu [data-m=x-glb]')
    import shutil; path = SH+'/e2e_out.glb'; shutil.copy(d.value.path(), path); size = os.path.getsize(path); check('GLB export downloads', size>5000 and open(path,'rb').read(4)==b'glTF', size)
    pg.click('#btnExport')
    with pg.expect_download() as d2: pg.click('#menu [data-m=x-stl]')
    check('STL export downloads', os.path.getsize(d2.value.path())>1000)
    pg.click('#btnExport')
    with pg.expect_download() as d3: pg.click('#menu [data-m=x-obj]')
    objpath = SH+'/e2e_out.obj'; shutil.copy(d3.value.path(), objpath); check('OBJ export has vertices', b'\nv ' in open(objpath,'rb').read())
    pg.evaluate("window.__arck.action('new')") if False else None
    pg.evaluate("window.__arck.sc.newProject()"); pg.wait_for_timeout(200)
    pg.set_input_files('#fileModel', path); pg.wait_for_timeout(2500)
    imp = pg.evaluate("window.__arck.sc.list.filter(e=>e.userData.kind==='import').map(e=>e.userData.name)")
    check('GLB re-import works', len(imp)==1, imp)
    pg.set_input_files('#fileModel', objpath); pg.wait_for_timeout(2000)
    check('OBJ import works', pg.evaluate("window.__arck.sc.list.filter(e=>e.userData.kind==='import').length")==2)
    # ---- project save/open roundtrip incl. imported model
    pg.click('#btnFile')
    with pg.expect_download() as d4: pg.click('#menu [data-m=save]')
    ppath = d4.value.path(); proj = json.load(open(ppath)); check('project json valid', proj['app']=='ARCK' and len(proj['entities'])==2 and len(proj['imports'])>=1, [len(proj['entities']), list(proj['imports'])])
    pg.evaluate("window.__arck.sc.newProject()"); pg.wait_for_timeout(200)
    pg.set_input_files('#fileProject', ppath); pg.wait_for_timeout(2500)
    check('project reopens with imports', pg.evaluate("window.__arck.sc.list.length")==2)
    # ---- autosave restore after reload
    pg.wait_for_timeout(2500); pg.reload(); pg.wait_for_function('window.__arck && window.__arck.sc'); pg.wait_for_timeout(5000)
    check('autosave restores after reload', pg.evaluate("window.__arck.sc.list.length")>=2, pg.evaluate("window.__arck.sc.list.length"))

    # ---- real-file import: zip (obj+mtl+texture, mm, Z-up) and Z-up STL
    FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
    pg.evaluate("window.__arck.sc.newProject()"); pg.wait_for_timeout(200)
    pg.set_input_files('#fileModel', os.path.join(FX, 'house-mm-zup.zip')); pg.wait_for_timeout(3500)
    info = pg.evaluate("(()=>{const e=window.__arck.sc.list[0]; if(!e) return null; const i=window.__arck.sc.entityInfo(e); return {size:[i.size.x,i.size.y,i.size.z], imp:e.userData.imp}})()")
    check('zip import: mm + Z-up auto-fixed (10.8 x 5.1 x 8.8 m)', info and abs(info['size'][0]-10.8)<0.1 and abs(info['size'][1]-5.1)<0.1 and abs(info['size'][2]-8.8)<0.1, info)
    check('zip import keeps texture', pg.evaluate("(()=>{let t=0; window.__arck.sc.list[0].traverse(o=>{if(o.isMesh&&!o.userData.isEdges&&o.material.map)t++}); return t})()")>=1)
    pg.select_option('#impUp','y'); pg.wait_for_timeout(600)
    check('fix-orientation control changes the model', abs(pg.evaluate("window.__arck.sc.entityInfo(window.__arck.sc.list[0]).size.y")-5.1)>0.5)
    pg.select_option('#impUp','z'); pg.wait_for_timeout(400)
    pg.evaluate("window.__arck.sc.newProject()"); pg.set_input_files('#fileModel', os.path.join(FX, 'room-mm-zup.stl')); pg.wait_for_timeout(1800)
    check('STL mm Z-up -> 4 x 2.5 x 3 m', abs(pg.evaluate("window.__arck.sc.entityInfo(window.__arck.sc.list[0]).size.y")-2.5)<0.1)
    # ---- studio extras
    pg.evaluate("window.__arck.sc.newProject()"); pg.evaluate("window.__arck.sc.addCatalog('box')"); pg.wait_for_timeout(200)
    pg.evaluate('document.activeElement.blur()'); pg.keyboard.press('a'); pg.evaluate("window.__arck.view('top')"); pg.wait_for_timeout(400)
    for pt in [(-0.8,-0.8),(0.8,-0.8),(0.8,0.6),(-0.8,0.6)]: click_world(pt[0],0,pt[1])
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    note = pg.evaluate("window.__arck.sc.list.filter(e=>e.userData.kind==='note').map(e=>e.userData.text)")
    check('area tool makes area note', len(note)==1 and '3.00' in note[0], note)
    pg.evaluate("window.__arck.saveView('A')"); pg.evaluate("window.__arck.view('front')"); pg.evaluate("window.__arck.saveView('B')")
    check('bookmarks saved', pg.evaluate("window.__arck.sc.views.length")==2)
    pg.evaluate("window.__arck.goView(0)")
    try: pg.wait_for_function("(()=>{const a=window.__arck,v=a.sc.views[0];return a.vp.camera.position.distanceTo(new a.vp.camera.position.constructor(...v.pos))<0.5})()", timeout=8000)
    except Exception: pass
    check('fly to bookmark', pg.evaluate("(()=>{const a=window.__arck,v=a.sc.views[0];return a.vp.camera.position.distanceTo(new a.vp.camera.position.constructor(...v.pos))})()")<0.5)
    pg.evaluate("window.__arck.vp.setMode('drawing')"); pg.wait_for_timeout(300); pg.evaluate("window.__arck.vp.setMode('solid')")
    pg.evaluate("window.__arck.sc.select([window.__arck.sc.list[0]])"); pg.keyboard.press('i'); pg.wait_for_timeout(200)
    check('isolate hides others', pg.evaluate("window.__arck.sc.list.filter(e=>!e.visible).length")>=1); pg.keyboard.press('i')
    pg.evaluate("window.__arck.vp.setOrtho(true)"); pg.evaluate("window.__arck.view('top')"); pg.wait_for_timeout(400)
    with pg.expect_download() as ds: pg.evaluate("window.__arck.exportSheet()")
    check('drawing sheet PNG downloads', os.path.getsize(ds.value.path())>50000)
    pg.evaluate("window.__arck.vp.setOrtho(false)"); pg.keyboard.press('h'); pg.wait_for_timeout(300)
    check('walk mode on', pg.evaluate("window.__arck.vp.walk.on")); pg.keyboard.down('w'); pg.wait_for_timeout(500); pg.keyboard.up('w'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('walk mode off with Esc', not pg.evaluate("window.__arck.vp.walk.on"))
    check('no console errors', not errs, errs[:4])
    b.close()
print('\nFAILED:' , fails) if fails else print('\nALL E2E CHECKS PASSED')
sys.exit(1 if fails else 0)
