// Studio shell: tool rail, tool-options bar, tabs / bottom sheet, menus, dialogs, shortcuts, HUD.
import * as THREE from 'three';
import { icon } from '../ui/icons.js';
import { esc } from '../ui/params.js';
import { toast, PAGES } from '../ui/chrome.js';
import { getItem, defaults } from '../catalog/index.js';
import { MATERIALS } from '../engine/materials.js';
import { exportModel, downloadDataURL, download } from '../engine/exporter.js';
import { importFiles, ACCEPT, FORMAT_INFO, bindDropZone } from '../engine/importer.js';
import { fmtLen } from './scene.js';
import { TEMPLATES } from './templates.js';
import { libraryPane, editPane, scenePane, viewPane, planPane } from './panels.js';

const $ = s => document.querySelector(s);
const TABS = [['lib', 'Library', 'cube'], ['edit', 'Edit', 'move'], ['scene', 'Scene', 'layers'], ['view', 'View', 'eye'], ['plan', 'Plan', 'chart']];
const RAIL = [['select', 'select', 'Select', 'V'], ['move', 'move', 'Move', 'T'], ['rotate', 'rotate', 'Rotate', 'R'], ['scale', 'scale', 'Scale', 'S'], '-', ['wall', 'wall', 'Wall', 'W'], ['room', 'house', 'Room', 'Q'], ['slab', 'polygon', 'Slab', 'F'], '-', ['measure', 'measure', 'Measure', 'M'], ['note', 'info', 'Note', 'N'], ['light', 'sun', 'Light', 'L']];
const HINTS = {
  select: 'Tap an object to select it · drag the arrows to move · Shift/Ctrl+click for several',
  move: 'Drag the coloured arrows or squares to move. Snap to grid is on by default.',
  rotate: 'Drag the rings to rotate in steps (see Angle snap).',
  scale: 'Drag the cube handles to resize. The centre handle scales evenly.',
  wall: 'Click to place wall points · type a length and press Enter · double-click or Finish to end',
  room: 'Click two opposite corners — four walls and a floor are created',
  slab: 'Click the corners of the floor/roof outline · click the first point or Finish to close',
  measure: 'Click two points (they snap to corners) to measure a distance',
  note: 'Click a surface to drop a text note',
  place: 'Click to place · R rotates · Esc stops',
};
const MATS_WALL = ['brick', 'concrete', 'plaster', 'stone', 'wood', 'glass', 'marble', 'steel'];
const MATS_SLAB = ['concrete', 'tile', 'wood', 'stone', 'grass', 'sand', 'asphalt', 'water', 'marble', 'roof'];

export function initUI(ctx) {
  const { vp, sc, tools } = ctx; const panel = $('#panel'); let activeTab = 'lib'; const mobile = () => matchMedia('(max-width: 899px)').matches;
  $('#btnUndo').innerHTML = icon('undo'); $('#btnRedo').innerHTML = icon('redo'); $('#btnHelp').innerHTML = icon('info'); $('#btnPages').innerHTML = icon('menu'); $('#btnPanel').innerHTML = icon('layers');

  // ---------------------------------------------------------- rail
  $('#rail').innerHTML = RAIL.map(r => r === '-' ? '<div class="rail-sep"></div>' : `<button class="tbtn" data-tool="${r[0]}" title="${r[2]} (${r[3]})" aria-label="${r[2]}">${icon(r[1])}<span>${r[2]}</span><kbd>${r[3]}</kbd></button>`).join('');
  $('#rail').addEventListener('click', e => { const b = e.target.closest('.tbtn'); if (!b) return; const t = b.dataset.tool; if (t === 'light') { const c = vp.controls.target; sc.addLight('point', [c.x, 3, c.z]); toast('Light added — drag it where you need it'); setTool('move'); return; } setTool(t); });
  function setTool(t, o) { tools.setTool(t, o); }

  // ---------------------------------------------------------- tabs + bottom nav
  $('#tabs').innerHTML = TABS.map(t => `<button role="tab" data-tab="${t[0]}">${icon(t[2])}${t[1]}</button>`).join('');
  $('#bottom').innerHTML = TABS.map(t => `<button data-tab="${t[0]}">${icon(t[2])}<span>${t[1]}</span></button>`).join('');
  $('#tabbody').innerHTML = TABS.map(t => `<div class="pane" id="pane-${t[0]}" data-pane="${t[0]}"></div>`).join('');
  const panes = {}; TABS.forEach(t => panes[t[0]] = $('#pane-' + t[0]));
  function showTab(id, open = true) {
    activeTab = id; document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id && (!mobile() || panel.classList.contains('open') || open)));
    TABS.forEach(t => panes[t[0]].classList.toggle('on', t[0] === id)); if (open && mobile()) panel.classList.add('open');
    if (id === 'plan') ctx.plan?.draw(); if (id === 'scene') ctx.scene?.draw(); if (id === 'edit') ctx.edit?.render(true);
    document.querySelectorAll('#bottom button').forEach(b => b.classList.toggle('on', panel.classList.contains('open') && b.dataset.tab === id));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return; const id = b.dataset.tab;
    if (mobile() && b.closest('#bottom') && panel.classList.contains('open') && activeTab === id) { panel.classList.remove('open'); document.querySelectorAll('#bottom button').forEach(x => x.classList.remove('on')); return; }
    showTab(id);
  });
  $('#sheetHandle').addEventListener('click', () => { if (panel.classList.contains('tall')) { panel.classList.remove('tall'); } else if (panel.classList.contains('half2')) { panel.classList.remove('open', 'half2'); } else panel.classList.add('tall'); if (!panel.classList.contains('tall') && !panel.classList.contains('open')) document.querySelectorAll('#bottom button').forEach(x => x.classList.remove('on')); });
  let hy = null; $('#sheetHandle').addEventListener('pointerdown', e => { hy = e.clientY; }); addEventListener('pointerup', e => { if (hy == null) return; const dy = e.clientY - hy; hy = null; if (dy > 60) { if (panel.classList.contains('tall')) panel.classList.remove('tall'); else { panel.classList.remove('open'); document.querySelectorAll('#bottom button').forEach(x => x.classList.remove('on')); } } else if (dy < -60) panel.classList.add('tall'); });
  $('#btnPanel').addEventListener('click', () => { document.body.classList.toggle('panel-hidden'); setTimeout(() => vp.resize(), 30); });

  // ---------------------------------------------------------- panes
  libraryPane(panes.lib, ctx); ctx.edit = editPane(panes.edit, ctx); ctx.scene = scenePane(panes.scene, ctx); ctx.view_ = viewPane(panes.view, ctx); ctx.plan = planPane(panes.plan, ctx);
  showTab('lib', false); if (mobile()) panel.classList.remove('open');

  // ---------------------------------------------------------- options bar
  const opts = $('#opts');
  const sel = (bind, list, cur, names) => `<select data-bind="${bind}" aria-label="${bind}">${list.map(k => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(names?.[k] || MATERIALS[k]?.name || k)}</option>`).join('')}</select>`;
  const num = (bind, v, step = 0.05, min = 0) => `<input type="number" data-bind="${bind}" value="${v}" step="${step}" min="${min}">`;
  const chk = (bind, v) => `<input type="checkbox" data-bind="${bind}" ${v ? 'checked' : ''}>`;
  const snapBlock = () => `<span class="o"><label>${chk('snap.on', tools.snap.on)} Snap</label></span><span class="o">Grid ${sel('snap.step', ['0.05', '0.1', '0.25', '0.5', '1', '2'], String(tools.snap.step), { 0.05: '5 cm', 0.1: '10 cm', 0.25: '25 cm', 0.5: '50 cm', 1: '1 m', 2: '2 m' })}</span>`;
  function renderOpts() {
    const t = tools.tool, d = tools.draw; let h = '';
    if (['select', 'move', 'rotate', 'scale'].includes(t)) h = `${snapBlock()}<span class="o">Angle ${sel('snap.angle', ['5', '15', '45', '90'], String(tools.snap.angle), { 5: '5°', 15: '15°', 45: '45°', 90: '90°' })}</span><span class="vsep"></span><span class="o"><label>${chk('multi', ctx.multi)} Multi-select</label></span><span class="hint">${HINTS[t]}</span>`;
    else if (t === 'wall') h = `<span class="o">Height ${num('draw.H', d.H, 0.1, 0.3)}</span><span class="o">Thick ${num('draw.T', d.T, 0.05, 0.05)}</span><span class="o">${sel('draw.mat', MATS_WALL, d.mat)}</span><span class="o">Level ${num('draw.y', d.y, 0.1, -5)}</span><span class="vsep"></span>${snapBlock()}<span class="o"><label>${chk('snap.ortho', tools.snap.ortho)} Ortho</label></span><span class="vsep"></span><span class="o">Length <input type="number" id="wlen" step="0.1" min="0.1" placeholder="m" style="width:76px"> <button class="btn sm" data-oa="len">Add</button></span><button class="btn ghost sm" data-oa="undopt">Undo point</button><button class="btn ghost sm" data-oa="close">Close</button><button class="btn sm" data-oa="finish">Finish</button>`;
    else if (t === 'room') h = `<span class="o">Height ${num('draw.H', d.H, 0.1, 0.3)}</span><span class="o">Thick ${num('draw.T', d.T, 0.05, 0.05)}</span><span class="o">${sel('draw.mat', MATS_WALL, d.mat)}</span><span class="o"><label>${chk('draw.floor', d.floor !== false)} Floor</label></span><span class="o"><label>${chk('draw.door', d.door)} Door</label></span><span class="o">Level ${num('draw.y', d.y, 0.1, -5)}</span>${snapBlock()}<span class="hint">${HINTS.room}</span>`;
    else if (t === 'slab') h = `<span class="o">Thick ${num('draw.slabT', d.slabT, 0.05, 0.02)}</span><span class="o">${sel('draw.slabMat', MATS_SLAB, d.slabMat)}</span><span class="o">Level ${num('draw.y', d.y, 0.1, -5)}</span>${snapBlock()}<span class="o"><label>${chk('snap.ortho', tools.snap.ortho)} Ortho</label></span><button class="btn ghost sm" data-oa="undopt">Undo point</button><button class="btn sm" data-oa="finish">Finish</button><span class="hint">${HINTS.slab}</span>`;
    else if (t === 'measure') h = `<span class="o" id="mres">${HINTS.measure}</span><span class="spacer"></span><button class="btn ghost sm" data-oa="cleardims">Clear all dimensions</button>`;
    else if (t === 'place') h = `<span class="o"><b>${esc(tools.place ? getItem(tools.place.id).name : '')}</b></span><button class="btn ghost sm" data-oa="rot">${icon('rotate')} Rotate 90°</button>${snapBlock()}<button class="btn sm" data-oa="done">Done</button><span class="hint">${HINTS.place}</span>`;
    else h = `<span class="hint">${HINTS[t] || ''}</span>`;
    opts.innerHTML = h; document.body.dataset.hasopts = h ? '1' : '0';
  }
  const setPath = (path, val) => { const [a, b] = path.split('.'); if (a === 'multi') { ctx.multi = val; return; } if (a === 'snap') tools.setSnap({ [b]: val }); else if (a === 'draw') tools.draw[b] = val; };
  opts.addEventListener('change', e => { const t = e.target; const p = t.dataset.bind; if (!p) return; let v = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' && !isNaN(+t.value) && t.value !== '' ? +t.value : t.type === 'number' ? parseFloat(t.value) : t.value; if (t.type === 'number' && !Number.isFinite(v)) return; setPath(p, v); updateHud(); });
  opts.addEventListener('click', e => { const b = e.target.closest('[data-oa]'); if (!b) return; const a = b.dataset.oa;
    if (a === 'len') { const v = $('#wlen').value; if (tools.commitTyped(v)) $('#wlen').value = ''; else toast('Click a first point, then type a length'); }
    if (a === 'finish') tools.finishDraw(); if (a === 'close') tools.closeShape(); if (a === 'undopt') tools.undoPoint(); if (a === 'rot') tools.rotatePlace(90); if (a === 'done') setTool('select');
    if (a === 'cleardims') { const d = sc.list.filter(x => x.userData.kind === 'dim'); if (d.length) sc.remove(d); } });
  opts.addEventListener('keydown', e => { if (e.target.id === 'wlen' && e.key === 'Enter') { e.preventDefault(); if (tools.commitTyped(e.target.value)) e.target.value = ''; } });

  // ---------------------------------------------------------- HUD, selection bar, view buttons, empty state
  const hud = $('#hud'), selbar = $('#selbar'), empty = $('#empty');
  function updateHud() {
    const s = sc.sel.filter(e => e.userData.kind !== 'dim'); let txt = HINTS[tools.tool] || '';
    if (s.length) { const b = new THREE.Box3(); s.forEach(e => b.expandByObject(e)); const z = b.getSize(new THREE.Vector3()); txt = `${s.length > 1 ? s.length + ' selected' : s[0].userData.name} · ${fmtLen(z.x, sc.units)} × ${fmtLen(z.y, sc.units)} × ${fmtLen(z.z, sc.units)}`; }
    hud.textContent = txt; renderSelbar(); empty.hidden = !(sc.list.length === 0 && tools.tool === 'select');
  }
  function renderSelbar() {
    const s = sc.sel; if (!s.length || ['wall', 'room', 'slab', 'measure', 'note', 'place'].includes(tools.tool)) { selbar.hidden = true; return; } selbar.hidden = false; const one = s.length === 1, t = tools.tool;
    const b = (a, ic, l, cls = '') => `<button data-sa="${a}" class="${cls} ${t === a ? 'on' : ''}" aria-label="${l}">${icon(ic)}<span>${l}</span></button>`;
    selbar.innerHTML = `<span class="nm">${one ? esc(s[0].userData.name) : s.length + ' objects'}</span>${b('move', 'move', 'Move')}${b('rotate', 'rotate', 'Rotate')}${b('scale', 'scale', 'Scale')}${b('dup', 'copy', 'Copy')}${b('edit', 'cog', 'Edit')}${b('del', 'trash', 'Delete', 'bad')}`;
  }
  selbar.addEventListener('click', e => { const b = e.target.closest('[data-sa]'); if (!b) return; const a = b.dataset.sa; if (['move', 'rotate', 'scale'].includes(a)) setTool(a); else if (a === 'edit') showTab('edit'); else ctx.action(a === 'dup' ? 'dup' : a); });
  $('#views').innerHTML = [['iso', 'Iso'], ['top', 'Top'], ['front', 'Front'], ['right', 'Right'], ['fit', 'Fit']].map(v => `<button class="chip" data-v="${v[0]}">${v[1]}</button>`).join('') + `<button class="chip" id="vOrtho">3D</button>`;
  $('#views').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) return ctx.view(b.dataset.v); if (e.target.id === 'vOrtho') { vp.setOrtho(!vp.orthoOn); tools.tc.camera = vp.camera; syncViewBtns(); ctx.view_.setOrtho(vp.orthoOn); } });
  function syncViewBtns() { $('#vOrtho').textContent = vp.orthoOn ? 'Ortho' : '3D'; $('#vOrtho').classList.toggle('on', vp.orthoOn); } ctx.syncViewBtns = syncViewBtns;
  empty.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) ctx.action(b.dataset.act === 'tpl' ? 'tpl' : b.dataset.act === 'room' ? 'drawroom' : 'import'); });
  ctx.updateHud = updateHud; ctx.renderOpts = renderOpts;
  sc.on('selection', updateHud); sc.on('change', () => { updateHud(); syncUndo(); });
  function syncUndo() { $('#btnUndo').disabled = !sc.canUndo(); $('#btnRedo').disabled = !sc.canRedo(); } sc.on('history', syncUndo);
  $('#btnUndo').addEventListener('click', () => ctx.action('undo')); $('#btnRedo').addEventListener('click', () => ctx.action('redo'));
  $('#projName').addEventListener('input', e => { sc.name = e.target.value; document.title = (sc.name || 'Studio') + ' — ARCK'; });
  ctx.hooks.tool = t => { document.querySelectorAll('.tbtn').forEach(b => b.classList.toggle('on', b.dataset.tool === t || (t === 'place' && false))); renderOpts(); updateHud(); };
  ctx.hooks.transform = () => { ctx.edit?.refreshXform(); updateHud(); };
  ctx.hooks.drawing = () => {};
  ctx.hooks.measure = r => { const el = $('#mres'); if (!el) return; el.innerHTML = r ? `<b>${fmtLen(r.d, sc.units)}</b> &nbsp; ΔX ${fmtLen(r.dx, sc.units)} · ΔY ${fmtLen(r.dy, sc.units)} · ΔZ ${fmtLen(r.dz, sc.units)}` : 'Now click the second point'; };
  ctx.hooks.multi = () => ctx.multi; ctx.hooks.placed = () => { updateHud(); };

  // ---------------------------------------------------------- menus
  const menu = $('#menu'); let menuFor = null;
  function showMenu(anchor, items) {
    if (menuFor === anchor && !menu.hidden) { menu.hidden = true; return; } menuFor = anchor;
    menu.innerHTML = items.map(i => i === '-' ? '<hr>' : i.href ? `<a href="${i.href}" ${i.blank ? 'target="_blank"' : ''}>${icon(i.ic || 'link')} ${i.label}</a>` : `<button data-m="${i.id}" ${i.off ? 'disabled style="opacity:.4"' : ''}>${icon(i.ic || 'cube')} ${i.label}${i.k ? `<small>${i.k}</small>` : ''}</button>`).join('');
    menu.hidden = false; const r = anchor.getBoundingClientRect(); const w = menu.offsetWidth; menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px'; menu.style.top = (r.bottom + 6) + 'px';
    menu.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; menu.hidden = true; ctx.action(b.dataset.m); };
  }
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('#menu') && !e.target.closest('#btnFile,#btnExport,#btnPages')) menu.hidden = true; });
  $('#btnFile').addEventListener('click', e => showMenu(e.currentTarget, [{ id: 'new', label: 'New project', ic: 'plus' }, { id: 'tpl', label: 'Start from a template…', ic: 'home' }, '-', { id: 'open', label: 'Open project file…', ic: 'folder' }, { id: 'save', label: 'Save project file', ic: 'save', k: 'Ctrl+S' }, '-', { id: 'import', label: 'Import 3D model…', ic: 'upload', k: 'Ctrl+I' }, { id: 'clearauto', label: 'Clear auto-saved copy', ic: 'trash' }]));
  $('#btnExport').addEventListener('click', e => showMenu(e.currentTarget, [{ id: 'x-glb', label: 'GLB (best for web/AR)', ic: 'download' }, { id: 'x-gltf', label: 'glTF', ic: 'download' }, { id: 'x-obj', label: 'OBJ', ic: 'download' }, { id: 'x-stl', label: 'STL (3D printing)', ic: 'download' }, { id: 'x-ply', label: 'PLY', ic: 'download' }, '-', { id: 'shot1', label: 'Picture (PNG)', ic: 'camera' }, { id: 'shot2', label: 'HD picture (2×)', ic: 'camera' }, { id: 'csv', label: 'Quantities (CSV)', ic: 'sheet' }]));
  $('#btnPages').addEventListener('click', e => showMenu(e.currentTarget, PAGES.filter(p => p.id !== 'studio').map(p => ({ href: p.href, label: p.label, ic: p.ic }))));
  $('#btnHelp').addEventListener('click', () => ctx.action('help'));

  // ---------------------------------------------------------- dialogs
  const dlg = $('#dlg'), dlgBody = $('#dlgBody');
  function openDlg(html) { dlgBody.innerHTML = html + `<div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Close</button></div>`; dlg.classList.add('open'); }
  function closeDlg() { dlg.classList.remove('open'); }
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) closeDlg(); });
  ctx.dialog = { open: openDlg, close: closeDlg };
  ctx.openTemplates = () => { openDlg(`<h2>Start from a template</h2><p>Loads a complete example built from the same shapes and components in the Library — then edit anything. This replaces the current scene.</p><div class="tpl-grid">${TEMPLATES.map(t => `<button class="tpl" data-tpl="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>`); dlgBody.onclick = e => { const b = e.target.closest('[data-tpl]'); if (!b) return; closeDlg(); ctx.loadTemplate(b.dataset.tpl); }; };
  ctx.openHelp = () => { openDlg(`<h2>Quick guide</h2><div class="kbd-grid">${[['V', 'Select'], ['T / R / S', 'Move / Rotate / Scale'], ['W', 'Wall'], ['Q', 'Room'], ['F', 'Slab / floor'], ['M', 'Measure'], ['N', 'Note'], ['L', 'Add light'], ['Ctrl+Z / Y', 'Undo / Redo'], ['Ctrl+D', 'Duplicate'], ['Del', 'Delete'], ['Ctrl+A', 'Select all'], ['Arrows', 'Nudge (PgUp/PgDn = up/down)'], ['1–6', 'Iso, Top, Front, Right, Back, Left'], ['Home / .', 'Fit all / selection'], ['O', 'Perspective ⇄ orthographic'], ['G', 'Grid snap on/off'], ['Esc', 'Cancel / deselect']].map(k => `<div><kbd>${k[0]}</kbd><span>${k[1]}</span></div>`).join('')}</div>
    <h3 style="font-size:1rem">On a phone or tablet</h3><p class="small">One finger orbits · two fingers pan and zoom · tap to select · use the bottom bar for Library, Edit, Scene, View and Plan · the floating bar under a selected object has Move / Rotate / Scale / Copy / Delete.</p>
    <h3 style="font-size:1rem">Importing your own models</h3><p class="small">Drop files onto the canvas or use File ▸ Import. ${FORMAT_INFO.slice(0, 4).map(f => '<b>' + f[0] + '</b>').join(', ')} and more are supported. For OBJ select the .obj, .mtl and textures together.</p><p class="small"><a href="guide.html" target="_blank">Open the full guide ↗</a></p>`); dlgBody.onclick = null; };

  // ---------------------------------------------------------- shortcuts
  addEventListener('keydown', e => {
    const tag = e.target.tagName; const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'; const k = e.key; const mod = e.ctrlKey || e.metaKey;
    if (k === 'Escape') { if (dlg.classList.contains('open')) return closeDlg(); if (!menu.hidden) { menu.hidden = true; return; } if (['wall', 'slab', 'room'].includes(tools.tool) && tools.pts.length) { tools.cancelDraw(); return; } if (tools.tool !== 'select') setTool('select'); else sc.clearSel(); return; }
    if (typing) { return; }
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); ctx.action(e.shiftKey ? 'redo' : 'undo'); return; } if (mod && k.toLowerCase() === 'y') { e.preventDefault(); ctx.action('redo'); return; }
    if (mod && k.toLowerCase() === 'd') { e.preventDefault(); ctx.action('dup'); return; } if (mod && k.toLowerCase() === 'a') { e.preventDefault(); sc.selectAll(); return; } if (mod && k.toLowerCase() === 's') { e.preventDefault(); ctx.action('save'); return; } if (mod && k.toLowerCase() === 'i') { e.preventDefault(); ctx.action('import'); return; }
    if (mod) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); ctx.action('del'); return; } if (k === 'Enter' && ['wall', 'slab'].includes(tools.tool)) { tools.finishDraw(); return; }
    if (tools.tool === 'wall' && /^[0-9.]$/.test(k) && tools.pts.length) { const i = $('#wlen'); if (i) { i.focus(); } return; }
    const map = { v: 'select', t: 'move', r: 'rotate', s: 'scale', w: 'wall', q: 'room', f: 'slab', m: 'measure', n: 'note' }; const lk = k.toLowerCase();
    if (lk === 'r' && tools.tool === 'place') { tools.rotatePlace(90); return; }
    if (map[lk]) { setTool(map[lk]); return; } if (lk === 'l') { const c = vp.controls.target; sc.addLight('point', [c.x, 3, c.z]); return; } if (lk === 'g') { tools.setSnap({ on: !tools.snap.on }); renderOpts(); toast('Grid snap ' + (tools.snap.on ? 'on' : 'off')); return; } if (lk === 'o') { vp.setOrtho(!vp.orthoOn); tools.tc.camera = vp.camera; syncViewBtns(); return; }
    if (k === '?') { ctx.action('help'); return; } const views = { 1: 'iso', 2: 'top', 3: 'front', 4: 'right', 5: 'back', 6: 'left' }; if (views[k]) { ctx.view(views[k]); return; } if (k === 'Home') { ctx.view('fit'); return; } if (k === '.') { ctx.action('frame'); return; }
    const nudge = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1], PageUp: [0, 1, 0], PageDown: [0, -1, 0] }[k];
    if (nudge && sc.sel.length) { e.preventDefault(); const st = e.shiftKey ? tools.snap.step * 4 : tools.snap.step; sc.sel.forEach(x => { if (!x.userData.locked && x.userData.kind !== 'dim') x.position.add(new THREE.Vector3(...nudge).multiplyScalar(st)); }); clearTimeout(nudge.t); ctx._nt = setTimeout(() => { sc.commit('Nudge'); }, 400); tools.refreshSelection(); ctx.edit?.refreshXform(); }
  });

  // ---------------------------------------------------------- drag & drop (files + library tiles)
  const vpEl = $('#vp');
  bindDropZone(vpEl, files => ctx.importFiles(files), $('#fileModel'));
  vpEl.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('text/arck-item')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  vpEl.addEventListener('drop', e => { const id = e.dataTransfer?.getData('text/arck-item'); if (!id) return; e.preventDefault(); const p = vp.groundPoint(e.clientX, e.clientY, 0); ctx.addItem(id, { at: p }); });
  $('#fileModel').setAttribute('accept', ACCEPT);
  renderOpts(); updateHud(); syncUndo(); syncViewBtns();
  return { showTab, setTool, renderOpts, updateHud };
}
