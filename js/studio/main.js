// ARCK Studio entry point.
import * as THREE from 'three';
import { Viewport } from '../engine/viewport.js';
import { StudioScene } from './scene.js';
import { Tools } from './tools.js';
import { initUI } from './ui.js';
import { TEMPLATES } from './templates.js';
import { getItem, defaults } from '../catalog/index.js';
import { importFiles, normalize } from '../engine/importer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { exportModel, downloadDataURL, download } from '../engine/exporter.js';
import { toast, registerSW } from '../ui/chrome.js';
import { kvGet, kvSet, kvDel } from './store.js';
import { initExtras } from './extras.js';

const $ = s => document.querySelector(s);
const vp = new Viewport($('#vp'), { grid: 60, preserve: false, edges: true, ao: !matchMedia('(pointer: coarse)').matches }); vp.setTheme('sky');
vp.canvas.style.position = 'absolute'; vp.canvas.style.inset = '0';
const sc = new StudioScene(vp);
const ctx = { vp, sc, hooks: {}, multi: false };
ctx.hooks.toast = toast; const tools = new Tools(vp, sc, ctx.hooks); ctx.tools = tools;
sc.commit('start');
vp.setView('iso', new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 4, 8))); vp.fitShadow(30);

const snapPt = p => { const st = tools.snap.step; return tools.snap.on ? [Math.round(p.x / st) * st, 0, Math.round(p.z / st) * st] : [p.x, 0, p.z]; };
const viewCentre = () => { const t = vp.controls.target; return { x: t.x, z: t.z }; };
const sheetClose = () => { if (matchMedia('(max-width: 899px)').matches) { $('#panel').classList.remove('open', 'tall'); document.querySelectorAll('#bottom button').forEach(b => b.classList.remove('on')); } };

ctx.addItem = (id, { stamp = false, at = null } = {}) => {
  const it = getItem(id); if (!it) return;
  if (stamp) { tools.setTool('place', { id, params: defaults(it), mat: null }); sheetClose(); toast('Click in the scene to place ' + it.name); return; }
  const c = at || viewCentre(); const n = sc.list.length; const jitter = at ? 0 : (n % 5) * 0.0; const e = sc.addCatalog(id, {}, { pos: snapPt({ x: c.x + jitter, z: c.z + jitter }) });
  if (tools.tool === 'wall' || tools.tool === 'room' || tools.tool === 'slab' || tools.tool === 'measure') tools.setTool('select'); else tools.refreshSelection();
  toast(it.name + ' added'); if (!at) sheetClose();
  return e;
};
ctx.view = name => { if (name === 'fit') { vp.setView('iso'); vp.frame(null, 'iso'); } else if (name === 'iso') { vp.setView('iso'); vp.refit(vp.world); } else { vp.setView(name); vp.refit(vp.world, 1.05); } };
ctx.importFiles = async files => {
  try {
    toast('Reading ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…', 8000);
    const r = await importFiles(files, { onProgress: m => toast(m, 8000) }); const c = viewCentre(); const e = sc.addImport(r.object, r.name, { pos: sc.list.length ? [c.x, 0, c.z] : [0, 0, 0] });
    tools.refreshSelection(); vp.refit(e, 1.4);
    toast(`${r.name}: ${r.stats.tris.toLocaleString()} triangles · ${r.stats.size.map(v => v.toFixed(1)).join(' × ')} m${r.stats.clay ? ' · no colours in file' : ''}`, 5200);
    const note = [r.hint?.text, ...r.warnings].filter(Boolean); if (note.length) setTimeout(() => toast(note[0], 7000), 2600);
    ctx.showTab?.('edit');
  } catch (err) { console.error(err); toast('Import failed: ' + err.message, 7000); }
};
ctx.loadTemplate = id => {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return; sc.newProject(); t.run(sc); sc.name = t.name; $('#projName').value = t.name; sc.commit('Template: ' + t.name); tools.setTool('select'); sc.clearSel(); vp.frame(null, 'iso'); vp.refit(vp.world, 1.1); ctx.updateHud(); sheetClose(); toast(t.name + ' loaded');
};
function frameSelection() {
  if (!sc.sel.length) return ctx.view('fit');
  const b = new THREE.Box3(); sc.sel.forEach(e => b.expandByObject(e));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(...b.getSize(new THREE.Vector3()).toArray().map(v => Math.max(v, 0.2)))); proxy.position.copy(b.getCenter(new THREE.Vector3()));
  vp.scene.add(proxy); proxy.updateMatrixWorld(true); vp.refit(proxy, 1.5); vp.scene.remove(proxy); proxy.geometry.dispose();
}
const selection = () => sc.sel.filter(e => !e.userData.locked);
const shot = scale => { const h = vp.helpers.visible, g = tools.tcHelper.visible; vp.helpers.visible = false; tools.tcHelper.visible = false; vp.grid.visible && 0; const url = vp.screenshot('image/png', scale); vp.helpers.visible = h; tools.tcHelper.visible = g; vp.invalidate(); downloadDataURL((sc.name || 'arck').replace(/\W+/g, '-') + '.png', url); toast('Picture saved'); };
ctx.action = async a => {
  const s = selection();
  switch (a) {
    case 'undo': sc.undo(); tools.refreshSelection(); ctx.edit?.render(true); return;
    case 'redo': sc.redo(); tools.refreshSelection(); ctx.edit?.render(true); return;
    case 'dup': if (s.length) { sc.duplicate(s); tools.refreshSelection(); toast('Duplicated'); } return;
    case 'del': if (s.length) { sc.remove(s); } return;
    case 'mirx': if (s.length) sc.mirror(s, 'x'); return; case 'mirz': if (s.length) sc.mirror(s, 'z'); return;
    case 'drop': if (s.length) sc.dropToGround(s); return;
    case 'group': if (s.length > 1) sc.group(s); else toast('Select two or more objects to group'); return;
    case 'ungroup': sc.ungroup(s[0]); return;
    case 'frame': return frameSelection();
    case 'isolate': return ctx.isolate();
    case 'walk': return ctx.walk();
    case 'sheet': return ctx.exportSheet();
    case 'all': sc.selectAll(); return;
    case 'tpl': ctx.openTemplates(); return;
    case 'import': $('#fileModel').click(); return;
    case 'drawroom': tools.setTool('room'); return;
    case 'help': ctx.openHelp(); return;
    case 'new': if (!sc.list.length || confirm('Start a new project? Unsaved changes in this scene will be lost (you can still Undo).')) { sc.newProject(); $('#projName').value = sc.name; kvDel('autosave'); } return;
    case 'open': $('#fileProject').click(); return;
    case 'save': { const p = await sc.toProject(); download((sc.name || 'arck-project').replace(/\W+/g, '-') + '.arck.json', JSON.stringify(p), 'application/json'); toast('Project saved'); return; }
    case 'clearauto': await kvDel('autosave'); toast('Auto-saved copy cleared'); return;
    case 'shot1': shot(1); return; case 'shot2': shot(2); return;
    case 'csv': ctx.plan.draw(); ctx.showTab?.('plan'); document.querySelector('#pane-plan [data-a="csv"]')?.click(); return;
  }
  if (a.startsWith('x-')) { const root = sc.exportRoot(); if (!root.children.length) return toast('Nothing to export yet'); try { await exportModel(root, a.slice(2), (sc.name || 'arck-model').replace(/\W+/g, '-')); toast('Exported ' + a.slice(2).toUpperCase()); } catch (e) { toast('Export failed: ' + e.message); } return; }
  if (a.startsWith('al-')) { sc.align(s, a.slice(3)); return; }
  if (a.startsWith('dist-')) { sc.distribute(s, a.slice(5)); return; }
};
initExtras(ctx);
const ui = initUI(ctx); ctx.showTab = ui.showTab;

$('#fileProject').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const p = JSON.parse(await f.text()); await sc.fromProject(p); $('#projName').value = sc.name; tools.refreshSelection(); vp.frame(null, 'iso'); vp.refit(vp.world, 1.1); toast('Opened ' + sc.name); } catch (err) { toast('Could not open: ' + err.message, 5000); } });

// ---- autosave / restore
sc.on('autosave', async () => { if (!sc.list.length) return kvDel('autosave'); try { await kvSet('autosave', await sc.toProject()); } catch (e) { console.warn(e); } });
(async () => {
  const q = new URLSearchParams(location.search); const addId = q.get('add'), tpl = q.get('template'), from = q.get('from');
  if (from === 'handoff') { const p = await kvGet('handoff'); if (p) { try { if (p.glb) { const g = await new GLTFLoader().parseAsync(p.glb, ''); const r = normalize(g.scene, p.name || 'model.glb', 'GLB'); sc.newProject(); sc.addImport(r.object, r.name, { pos: [0, 0, 0] }); sc.commit('Import'); } else await sc.fromProject(p); $('#projName').value = sc.name; vp.frame(null, 'iso'); vp.refit(vp.world, 1.2); await kvDel('handoff'); toast('Model opened in Studio'); } catch (e) { toast('Could not open handoff: ' + e.message); } } }
  else if (tpl) ctx.loadTemplate(tpl);
  else {
    const saved = await kvGet('autosave');
    if (saved?.entities?.length && !addId) { try { await sc.fromProject(saved); $('#projName').value = sc.name; vp.frame(null, 'iso'); vp.refit(vp.world, 1.1); toast('Restored your last session — File ▸ New to start fresh', 4200); } catch (e) { console.warn('restore failed', e); } }
  }
  if (addId && getItem(addId)) { let params = {}; try { params = JSON.parse(q.get('p') || '{}'); } catch { } const m = q.get('m'); const e = sc.addCatalog(addId, params, { pos: [0, 0, 0], mat: m ? { key: m } : null }); tools.refreshSelection(); vp.frame(e, 'iso'); vp.refit(e, 1.5); history.replaceState(null, '', location.pathname); toast(getItem(addId).name + ' added to the scene'); }
  ctx.updateHud();
})();
registerSW();
window.__arck = ctx;
