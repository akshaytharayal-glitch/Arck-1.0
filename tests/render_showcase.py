"""Render the home-page gallery from the Studio templates in headless Chromium.
Run with a static server up:  python3 tests/render_showcase.py [base_url]"""
import sys, base64, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8731'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img', 'showcase')
os.makedirs(OUT, exist_ok=True)
# template id -> (camera azimuth deg, elevation deg, distance factor, sun az, sun el)
SHOTS = {'house': (38, 20, 1.0, 55, 24), 'shrine': (28, 16, 1.0, 70, 22), 'temple': (35, 15, 1.05, 60, 22), 'cloister': (40, 28, 1.0, 50, 30), 'rotunda': (30, 17, 1.0, 65, 24), 'bridge': (24, 13, 1.0, 62, 20), 'hall': (36, 22, 1.0, 55, 28)}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for tid, (az, el, k, saz, sel) in [(t, SHOTS[t]) for t in (sys.argv[2:] or SHOTS)]:
        pg = b.new_page(viewport={'width': 1600, 'height': 1000}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/studio.html?template={tid}'); pg.wait_for_function('window.__arck && window.__arck.sc.list.length > 0', timeout=30000); pg.wait_for_timeout(2500)
        pg.add_style_tag(content='.s-rail,.s-top,#panel,.s-bottom,#bottom,#opts,.vp-views,.toast,.s-tabs{display:none!important} #vp{position:fixed!important;inset:0!important}')
        pg.evaluate("""([az, el, k, saz, sel]) => { const c = window.__arck, vp = c.vp; vp.setTheme('sky'); vp.showGrid(false); vp.setAO(true); vp.setEdges(true);
          c.tools.setTool('select'); c.sc.clearSel(); vp.helpers.visible = false; c.tools.tcHelper.visible = false;
          vp.resize(); vp.persp.fov = 32; vp.persp.updateProjectionMatrix();
          const b = new vp.camera.position.constructor(); const box = new (vp.world.constructor === Object ? Object : vp.camera.position.constructor)();
          vp.frame(null, 'iso'); vp.refit(vp.world, 0.92 * k);
          const t = vp.controls.target.clone(), d = vp.camera.position.distanceTo(t) * 0.8, a = az * Math.PI / 180, e = el * Math.PI / 180;
          vp.camera.position.set(t.x + Math.sin(a) * Math.cos(e) * d, t.y + Math.sin(e) * d, t.z + Math.cos(a) * Math.cos(e) * d); vp.controls.update();
          vp.setSun(saz, sel, 3.0); vp.invalidate(); }""", [az, el, k, saz, sel])
        pg.wait_for_timeout(1200)
        url = pg.evaluate("window.__arck.vp.screenshot('image/jpeg', 1)")
        open(os.path.join(OUT, tid + '.jpg'), 'wb').write(base64.b64decode(url.split(',')[1]))
        print(tid, len(url) // 1024, 'KB', errs); pg.close()
    b.close()
