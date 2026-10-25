// Viewer page: open any supported 3D file, inspect it, export it, or hand it to the Studio.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { pageInit, toast } from '../ui/chrome.js';
import { icon } from '../ui/icons.js';
import { Viewport } from '../engine/viewport.js';
import { importFiles, bindDropZone, ACCEPT, FORMAT_INFO } from '../engine/importer.js';
import { exportModel, downloadDataURL } from '../engine/exporter.js';
import { measureObject } from '../engine/geom.js';
import { build } from '../catalog/index.js';
import { kvSet } from '../studio/store.js';
import { esc } from '../ui/params.js';

pageInit('viewer');
const $ = s => document.querySelector(s);
const vp = new Viewport($('#vp'), { grid: 80, preserve: false });
const file = $('#file'); file.accept = ACCEPT;
$('#formats').innerHTML = FORMAT_INFO.map(([a, b]) => `<div><b>${esc(a)}</b> — ${esc(b)}</div>`).join('');
let model = null, name = 'model', measuring = false, pts = [], markers = [];
const meas = new THREE.Group(); vp.helpers.add(meas);

const BAR = [
  ['mode:solid', 'cube', 'Solid'], ['mode:clay', 'shapes', 'Clay'], ['mode:wire', 'wire', 'Wire'], ['mode:xray', 'xray', 'X-ray'],
  ['ortho', 'ortho', 'Ortho'], ['grid', 'grid', 'Grid'], ['theme', 'eye', 'Theme'], ['measure', 'measure', 'Measure'], ['fit', 'fit', 'Fit'], ['shot', 'camera', 'Picture'],
];
$('#bar').innerHTML = BAR.map(([k, ic, l]) => `<button class="btn sm ${k === 'mode:solid' || k === 'grid' ? 'on' : ''}" data-k="${k}" title="${l}">${icon(ic)}<span>${l}</span></button>`).join('');
$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
  if (k.startsWith('mode:')) { vp.setMode(k.slice(5)); $('#bar').querySelectorAll('[data-k^="mode:"]').forEach(x => x.classList.toggle('on', x === b)); }
  else if (k === 'ortho') { vp.setOrtho(!vp.orthoOn); b.classList.toggle('on', vp.orthoOn); vp.refit(vp.world, 1.1); }
  else if (k === 'grid') { vp.showGrid(!vp.grid.visible); b.classList.toggle('on', vp.grid.visible); }
  else if (k === 'theme') { const o = ['dark', 'light', 'sky']; vp.setTheme(o[(o.indexOf(vp.theme) + 1) % 3]); }
  else if (k === 'measure') { measuring = !measuring; b.classList.toggle('on', measuring); clearMeasure(); toast(measuring ? 'Click two points on the model' : 'Measure off'); vp.canvas.style.cursor = measuring ? 'crosshair' : ''; }
  else if (k === 'fit') model && vp.refit(model, 1.15);
  else if (k === 'shot') { downloadDataURL(name + '.png', vp.screenshot('image/png', 2)); }
});
vp.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

// measuring
function clearMeasure() { pts = []; while (meas.children.length) { const c = meas.children.pop(); c.geometry?.dispose(); } hud(); }
function dot(p) { const s = Math.max(0.02, vp.camera.position.distanceTo(p) * 0.012); const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf3d36b, depthTest: false })); m.position.copy(p); m.renderOrder = 20; meas.add(m); }
let down = null;
vp.canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
vp.canvas.addEventListener('pointerup', e => {
  if (!measuring || !model || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const { hits } = vp.pick(e.clientX, e.clientY, [model]); if (!hits.length) return; const p = hits[0].point.clone();
  if (pts.length >= 2) clearMeasure(); pts.push(p); dot(p);
  if (pts.length === 2) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf3d36b, depthTest: false })); l.renderOrder = 19; meas.add(l);
    const d = pts[0].distanceTo(pts[1]), dx = Math.abs(pts[0].x - pts[1].x), dy = Math.abs(pts[0].y - pts[1].y), dz = Math.abs(pts[0].z - pts[1].z); hud(`Distance ${d.toFixed(3)} m  (Δx ${dx.toFixed(2)} · Δy ${dy.toFixed(2)} · Δz ${dz.toFixed(2)})`); }
  vp.invalidate();
});
function hud(t) { const h = $('#hud'); h.hidden = !t; h.textContent = t || ''; }

// loading
async function load(files) {
  try {
    toast('Reading ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…', 5000);
    const r = await importFiles(files); setModel(r.object, r.name, r);
    toast(r.warnings[0] || `${r.name} loaded`, r.warnings.length ? 5200 : 2400);
  } catch (e) { console.error(e); toast('Could not open: ' + e.message, 6000); }
}
function setModel(obj, nm, r) {
  clearMeasure(); if (model) vp.world.remove(model); model = obj; name = (nm || 'model').replace(/\.[^.]+$/, '').replace(/\W+/g, '-'); vp.world.add(model);
  vp.setMode('solid'); $('#bar').querySelectorAll('[data-k^="mode:"]').forEach(x => x.classList.toggle('on', x.dataset.k === 'mode:solid'));
  vp.setSection(false); vp.frame(model, 'iso'); vp.refit(model, 1.2); $('#drop').classList.add('hide'); sidebar(r);
}
const SECS = { y: 'Horizontal (plan)', x: 'Vertical (side)', z: 'Vertical (front)' };
function sidebar(r) {
  const st = model.userData.imported, m = measureObject(model), sz = m.box.getSize(new THREE.Vector3());
  const parts = []; model.traverse(o => { if (o.isMesh) parts.push(o); });
  $('#side').innerHTML = `
  <div class="card"><h3>${esc(st.name)}</h3><dl class="kv"><dt>Format</dt><dd>${esc(st.format)}</dd><dt>Size (W×H×D)</dt><dd id="szv">${sz.x.toFixed(2)} × ${sz.y.toFixed(2)} × ${sz.z.toFixed(2)} m</dd><dt>Triangles</dt><dd>${st.tris.toLocaleString()}</dd><dt>Meshes · Materials</dt><dd>${st.meshes} · ${st.materials}</dd><dt>Textures</dt><dd>${st.textures}</dd><dt>Surface area</dt><dd id="area">${m.area.toFixed(1)} m²</dd><dt>Volume (closed meshes)</dt><dd id="vol">${m.vol.toFixed(2)} m³</dd></dl>
  ${r?.hint ? `<div class="note-box">${esc(r.hint.text)} <button class="btn sm" id="applyHint" style="margin-top:6px">Apply ×${r.hint.factor}</button></div>` : ''}
  ${(r?.warnings || []).map(w => `<div class="note-box">${esc(w)}</div>`).join('')}</div>
  <div class="card"><h3>Scale</h3><div class="row"><input type="number" id="scl" value="1" step="any" min="0.0001" style="width:110px"><button class="btn sm ghost" data-s="0.001">mm→m</button><button class="btn sm ghost" data-s="0.01">cm→m</button><button class="btn sm ghost" data-s="0.0254">in→m</button><button class="btn sm ghost" data-s="0.3048">ft→m</button></div><p class="small faint" style="margin-top:6px">Multiplies the model size. Units differ between programs, so check the size above.</p></div>
  <div class="card"><h3>Section cut</h3><div class="row"><label class="chip"><input type="checkbox" id="secOn"> On</label><div class="seg" id="secAx">${Object.keys(SECS).map(a => `<button data-a="${a}" class="${a === 'y' ? 'on' : ''}">${a.toUpperCase()}</button>`).join('')}</div><label class="chip"><input type="checkbox" id="secFlip"> Flip</label></div><input type="range" id="secPos" min="0" max="1" step="0.005" value="0.5" style="width:100%;margin-top:10px"><p class="small faint" id="secLbl"></p></div>
  <div class="card"><h3>Parts</h3><div class="tree" id="tree">${parts.slice(0, 200).map((o, i) => `<label><input type="checkbox" data-i="${i}" checked> ${esc(o.name || 'Mesh ' + (i + 1))}</label>`).join('')}${parts.length > 200 ? `<p class="small faint">+${parts.length - 200} more</p>` : ''}</div></div>
  <div class="card"><h3>Export &amp; share</h3><div class="row" style="gap:6px">${['glb', 'obj', 'stl', 'ply', 'gltf'].map(f => `<button class="btn sm ghost" data-x="${f}">${f.toUpperCase()}</button>`).join('')}</div><button class="btn" id="toStudio" style="width:100%;margin-top:10px">${icon('cube')} Open in Studio</button></div>`;
  const side = $('#side'); wireSection();
  $('#applyHint')?.addEventListener('click', () => { setScale(r.hint.factor); });
  side.querySelectorAll('[data-s]').forEach(b => b.onclick = () => setScale(parseFloat(b.dataset.s)));
  $('#scl').onchange = e => { const v = parseFloat(e.target.value); if (v > 0) setScale(v / model.scale.x * model.scale.x, true); };
  $('#tree').onchange = e => { const i = +e.target.dataset.i; parts[i].visible = e.target.checked; vp.invalidate(); };
  side.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { try { await exportModel(model, b.dataset.x, name); toast('Exported ' + b.dataset.x.toUpperCase()); } catch (er) { toast('Export failed: ' + er.message); } });
  $('#toStudio').onclick = async () => { try { const buf = await new GLTFExporter().parseAsync(model, { binary: true }); await kvSet('handoff', { app: 'ARCK', glb: buf, name: st.name }); location.href = 'studio.html?from=handoff'; } catch (er) { toast('Could not hand over: ' + er.message); } };
}
function setScale(k, absolute) { if (!model) return; model.scale.setScalar(absolute ? k : model.scale.x * k); model.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(model); model.position.y -= b.min.y; model.position.x -= (b.min.x + b.max.x) / 2; model.position.z -= (b.min.z + b.max.z) / 2; clearMeasure(); sidebar(); vp.refit(model, 1.2); $('#scl').value = model.scale.x.toPrecision(4).replace(/\.?0+$/, ''); }
function wireSection() {
  const on = $('#secOn'), pos = $('#secPos'), flip = $('#secFlip'); let ax = 'y';
  const upd = () => { const b = new THREE.Box3().setFromObject(model), lo = b.min[ax], hi = b.max[ax], v = lo + (hi - lo) * pos.value; vp.setSection(on.checked, ax, v, flip.checked); $('#secLbl').textContent = `${SECS[ax]} · ${v.toFixed(2)} m`; };
  on.onchange = pos.oninput = flip.onchange = upd; $('#secAx').onclick = e => { const b = e.target.closest('button'); if (!b) return; ax = b.dataset.a; $('#secAx').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); upd(); }; upd(); vp.setSection(false);
}

bindDropZone($('#drop'), load, file);
bindDropZone($('#stage'), load);
$('#pick').onclick = () => file.click();
$('#sample').onclick = () => {
  const g = new THREE.Group(); g.name = 'Sample pavilion';
  const add = (id, p, x, z, s = 1) => { const o = build(id, p); o.position.set(x, 0, z); o.scale.setScalar(s); g.add(o); };
  add('dome', {}, 0, 0); add('arcade', {}, 0, 6); add('column-round', {}, -4, -4); add('column-round', {}, 4, -4); add('stairs-straight', {}, 0, 11);
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  import('../engine/importer.js').then(m => { const r = m.normalize(g, 'sample-pavilion.glb', 'GLB'); setModel(r.object, r.name, r); });
};
window.__viewer = { vp, load, get model() { return model; } };
