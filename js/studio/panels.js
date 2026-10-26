// Side-panel panes for the Studio: Library, Edit, Scene, View, Plan.
import * as THREE from 'three';
import { icon } from '../ui/icons.js';
import { esc, renderParams, materialPicker } from '../ui/params.js';
import { toast } from '../ui/chrome.js';
import { REGISTRY, getItem, groupsOf, defaults } from '../catalog/index.js';
import { lazyThumbs } from '../engine/thumbs.js';
import { MATERIALS } from '../engine/materials.js';
import { RATES, fmtLen } from './scene.js';
import { sunPosition, dateFrom } from './sun.js';
import { download } from '../engine/exporter.js';
import { UNIT_NAMES as IMPU, UP_NAMES as IMPUP } from '../engine/importer.js';

const $ = (el, s) => el.querySelector(s);
const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;
const f2 = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString();
const KIND_ICON = { catalog: 'cube', import: 'upload', group: 'group', slab: 'polygon', light: 'sun', note: 'info', dim: 'measure' };

// ============================================================ LIBRARY
export function libraryPane(root, ctx) {
  const { sc, tools, vp } = ctx; let cat = 'shapes', q = '', stamp = false, offset = 0;
  root.innerHTML = `
    <div class="row" style="gap:8px"><label class="search" style="position:relative;flex:1"><span class="sr">Search library</span><input type="search" id="libq" placeholder="Search ${REGISTRY.length} items…" style="padding-left:12px;border-radius:999px"></label>
      <button class="btn ghost icon" data-act="import" title="Import 3D file" aria-label="Import 3D file">${icon('upload')}</button></div>
    <div class="seg" id="libcat" style="align-self:flex-start"><button data-c="shapes" class="on">Shapes</button><button data-c="structures">Structures</button><button data-c="components">Components</button></div>
    <label class="row small muted" style="gap:8px;cursor:pointer"><input type="checkbox" id="stamp"> Click-to-place mode <span class="faint">(tap the model to drop items; Esc to stop)</span></label>
    <div id="libbody"></div>
    <div class="card2 small muted">Tip: tap an item to add it at the centre of the view. On desktop you can also drag it onto the canvas. <a href="guide.html#library" target="_blank">Learn more</a></div>`;
  const body = $(root, '#libbody');
  function draw() {
    const ql = q.toLowerCase().trim(); let html = '';
    const list = ql ? REGISTRY.filter(i => (i.name + ' ' + i.group + ' ' + i.cat).toLowerCase().includes(ql)) : null;
    const tile = i => `<button class="tile" draggable="true" data-id="${i.id}" title="${esc(i.desc)}"><div class="thumb" data-thumb="${i.id}"><span class="ph"></span></div><div class="meta"><b>${esc(i.name)}</b></div></button>`;
    if (list) html = list.length ? `<div class="lib-tiles">${list.map(tile).join('')}</div>` : `<p class="muted small">No items match “${esc(q)}”.</p>`;
    else for (const [g, items] of groupsOf(cat)) html += `<div class="lib-group">${esc(g)}</div><div class="lib-tiles">${items.map(tile).join('')}</div>`;
    body.innerHTML = html; lazyThumbs(body);
  }
  draw();
  $(root, '#libq').addEventListener('input', e => { q = e.target.value; $(root, '#libcat').style.display = q ? 'none' : ''; draw(); });
  $(root, '#libcat').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; root.querySelectorAll('#libcat button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $(root, '#stamp').addEventListener('change', e => { stamp = e.target.checked; if (!stamp && tools.tool === 'place') tools.setTool('select'); });
  body.addEventListener('click', e => { const t = e.target.closest('.tile'); if (!t) return; ctx.addItem(t.dataset.id, { stamp }); });
  body.addEventListener('dragstart', e => { const t = e.target.closest('.tile'); if (!t) return; e.dataTransfer.setData('text/arck-item', t.dataset.id); e.dataTransfer.effectAllowed = 'copy'; });
  ctx.onPlaced = () => {};
}

// ============================================================ EDIT (properties)
export function editPane(root, ctx) {
  const { sc, tools, vp } = ctx; let lastKey = null, cur = null, values = null, raf = 0, uni = true;
  const sel = () => sc.sel;
  function render(force) {
    const s = sel(); const key = s.map(e => e.userData.id).join(',');
    if (!force && key === lastKey) { cur = s[0]; return; } lastKey = key;
    if (!s.length) { root.innerHTML = emptyHtml(); wireEmpty(); return; }
    if (s.length > 1) { renderMulti(s); return; }
    renderSingle(s[0]);
  }
  const emptyHtml = () => {
    const n = sc.list.filter(e => e.userData.kind !== 'dim').length; return `<div class="card2"><b>Nothing selected</b><p class="small" style="margin-top:6px">Tap an object in the 3D view to edit its position, size, material and parameters.</p></div>
      <h3>Project</h3><dl class="kv"><dt>Objects</dt><dd>${n}</dd><dt>Layers</dt><dd>${sc.layers.length}</dd></dl>
      <div class="btn-grid"><button class="btn ghost" data-a="all">${icon('select')} Select all</button><button class="btn ghost" data-a="tpl">${icon('home')} Templates</button><button class="btn ghost" data-a="import">${icon('upload')} Import</button></div>`;
  };
  function wireEmpty() { root.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'all') sc.selectAll(); else ctx.action(b.dataset.a); }; root.oninput = root.onchange = null; }

  function xyzRow(label, k, vals, step) { return `<div class="field"><label>${label}</label><div class="xyz" data-xf="${k}">${['x', 'y', 'z'].map((a, i) => `<label>${a.toUpperCase()}<input type="number" step="${step}" data-i="${i}" value="${f2(vals[i], 3)}"></label>`).join('')}</div></div>`; }
  function actionsHtml(e, multi) {
    const u = e?.userData; return `<div class="btn-grid">
      <button class="btn ghost" data-a="dup">${icon('copy')} Duplicate</button>
      <button class="btn ghost" data-a="mirx">${icon('mirror')} Mirror X</button><button class="btn ghost" data-a="mirz">${icon('mirror')} Mirror Z</button>
      <button class="btn ghost" data-a="drop">${icon('drop')} To ground</button>
      ${multi ? `<button class="btn ghost" data-a="group">${icon('group')} Group</button>` : ''}${u?.kind === 'group' ? `<button class="btn ghost" data-a="ungroup">${icon('ungroup')} Ungroup</button>` : ''}
      <button class="btn ghost" data-a="frame">${icon('fit')} Frame</button><button class="btn ghost" data-a="isolate">${icon('eye')} Isolate <kbd>I</kbd></button><button class="btn ghost" data-a="del" style="color:var(--bad)">${icon('trash')} Delete</button></div>`;
  }
  const arrayHtml = () => `<details class="fold"><summary>${icon('array')} Array / repeat</summary><div><div class="seg" id="arrmode" style="margin-bottom:10px"><button data-m="lin" class="on">Linear</button><button data-m="pol">Around a point</button></div>
      <div class="field"><label>Copies</label><input type="number" id="arrn" min="2" max="60" value="4"></div>
      <div id="arrlin" class="field" style="margin-top:6px"><label>Step (m)</label><div class="xyz"><label>X<input type="number" id="arrx" step="0.5" value="3"></label><label>Y<input type="number" id="arry" step="0.5" value="0"></label><label>Z<input type="number" id="arrz" step="0.5" value="0"></label></div></div>
      <div id="arrpol" class="field" style="margin-top:6px;display:none"><label>Angle °</label><input type="number" id="arra" value="360" min="10" max="360"></div>
      <p class="small faint" style="margin:6px 0">Around-a-point rotates copies about the world origin (0,0). Set angle 360 for a full ring.</p>
      <button class="btn sm" data-a="array" style="margin-top:4px">Create array</button></div></details>`;

  function renderMulti(s) {
    const box = new THREE.Box3(); s.forEach(e => box.expandByObject(e)); const sz = box.getSize(new THREE.Vector3());
    root.innerHTML = `<div class="card2"><b>${s.length} objects selected</b><p class="small muted" style="margin-top:4px">${f2(sz.x)} × ${f2(sz.y)} × ${f2(sz.z)} m overall</p></div>
      <h3>Arrange</h3><div class="btn-grid"><button class="btn ghost" data-a="al-left">${icon('align')} Left</button><button class="btn ghost" data-a="al-cx">Centre X</button><button class="btn ghost" data-a="al-right">Right</button><button class="btn ghost" data-a="al-back">Back</button><button class="btn ghost" data-a="al-cz">Centre Z</button><button class="btn ghost" data-a="al-front">Front</button><button class="btn ghost" data-a="dist-x">Spread X</button><button class="btn ghost" data-a="dist-z">Spread Z</button><button class="btn ghost" data-a="al-ground">${icon('drop')} Ground</button></div>
      <h3>Material</h3><div id="mm"></div><h3>Actions</h3>${actionsHtml(null, true)}${arrayHtml()}`;
    materialPicker($(root, '#mm'), null, k => { s.forEach(e => { if (['catalog', 'import', 'slab'].includes(e.userData.kind)) sc.update(e, { mat: k ? { key: k } : null }, { commit: false, silent: true }); }); sc.commit('Material'); tools.refreshSelection(); });
    wireCommon();
  }

  function renderSingle(e) {
    cur = e; const u = e.userData, info = sc.entityInfo(e), item = u.kind === 'catalog' ? getItem(u.catalogId) : null;
    const rot = [deg(e.rotation.x), deg(e.rotation.y), deg(e.rotation.z)];
    const locked = u.locked, dimOnly = u.kind === 'dim';
    root.innerHTML = `
      <div><div class="row" style="gap:8px"><span class="pill">${esc(item ? item.group : u.kind)}</span>${u.kind === 'import' ? `<span class="pill">${esc(sc.sources.get(u.srcId)?.userData.imported?.format || 'import')}</span>` : ''}</div>
        <input type="text" id="ename" value="${esc(u.name)}" style="margin-top:8px;font-weight:600;font-size:1rem" aria-label="Name"></div>
      ${item ? `<div class="small muted">${esc(item.desc)} <a href="item.html?id=${item.id}" target="_blank">Details</a></div>` : ''}
      ${dimOnly ? `<div class="card2"><b>${fmtLen(new THREE.Vector3(...u.a).distanceTo(new THREE.Vector3(...u.b)), sc.units)}</b><p class="small muted">Measured distance. Delete it with the button below.</p></div>` : ''}
      ${u.kind === 'note' ? `<div class="field"><label>Text</label><input type="text" id="ntext" value="${esc(u.text)}"></div>` : ''}
      ${!dimOnly ? `<h3>Transform</h3>${xyzRow('Position', 'pos', e.position.toArray(), 0.1)}${u.kind === 'light' ? '' : xyzRow('Rotation °', 'rot', rot, 5)}${u.kind === 'light' || u.kind === 'note' ? '' : xyzRow('Scale', 'scl', e.scale.toArray(), 0.1)}
        ${u.kind === 'light' || u.kind === 'note' ? '' : `<label class="row small muted" style="gap:8px"><input type="checkbox" id="uni" ${uni ? 'checked' : ''}> Keep proportions when scaling</label>
        <dl class="kv" id="sizekv"><dt>Size (W × H × D)</dt><dd>${f2(info.size.x)} × ${f2(info.size.y)} × ${f2(info.size.z)} m</dd>${info.vol != null ? `<dt>Volume</dt><dd>${f2(info.vol)} m³</dd><dt>Surface</dt><dd>${f2(info.area)} m²</dd>` : ''}${info.tris != null ? `<dt>Triangles</dt><dd>${Math.round(info.tris).toLocaleString()}</dd>` : ''}</dl>`}` : ''}
      ${u.kind === 'light' ? lightHtml(u.light) : ''}
      ${u.kind === 'import' ? importHtml(e) : ''}
      ${u.kind === 'slab' ? `<div class="field"><label>Thickness</label><input type="number" id="slabT" step="0.05" min="0.02" max="5" value="${u.T}"></div>` : ''}
      ${['catalog', 'import', 'slab'].includes(u.kind) ? `<h3>Material</h3><div id="mm"></div><div class="row" style="gap:8px"><span class="small muted">Tint</span><input type="color" id="tint" value="${u.mat?.color || '#ffffff'}"><button class="btn ghost sm" id="tintreset">Reset</button></div>` : ''}
      ${item && item.params.length ? `<h3>Parameters</h3><div id="prm" class="grid" style="gap:6px"></div>` : ''}
      ${!dimOnly ? `<h3>Organise</h3><div class="field"><label>Layer</label><select id="elayer">${sc.layers.map(l => `<option value="${l.id}" ${l.id === u.layer ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <div class="row" style="gap:16px"><label class="row small" style="gap:6px"><input type="checkbox" id="elock" ${u.locked ? 'checked' : ''}> Locked</label><label class="row small" style="gap:6px"><input type="checkbox" id="ehide" ${u.hidden ? 'checked' : ''}> Hidden</label></div>` : ''}
      <h3>Actions</h3>${dimOnly ? `<div class="btn-grid"><button class="btn ghost" data-a="del" style="color:var(--bad)">${icon('trash')} Delete</button></div>` : actionsHtml(e, false)}
      ${dimOnly ? '' : arrayHtml()}`;
    if ($(root, '#mm')) materialPicker($(root, '#mm'), u.mat?.key || null, k => { const m = k ? { key: k, color: u.mat?.color } : (u.mat?.color ? { color: u.mat.color } : null); cur = sc.update(cur, { mat: m }); lastKey = null; render(true); });
    if (item && item.params.length) { values = { ...u.params }; renderParams($(root, '#prm'), item, values, { prefix: 'ep', onInput: v => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { cur = sc.update(cur, { params: { ...v } }, { commit: false, silent: true }); tools.refreshSelection(); refreshInfo(); }); }, onChange: () => { cancelAnimationFrame(raf); cur = sc.update(cur, { params: { ...values } }, { commit: false, silent: true }); sc.commit('Edit ' + u.name); tools.refreshSelection(); refreshInfo(); } }); }
    wireSingle(); wireCommon();
  }
  const lightHtml = l => `<h3>Light</h3><div class="field"><label>Type</label><select id="ltype"><option value="point" ${l.type === 'point' ? 'selected' : ''}>Point</option><option value="spot" ${l.type === 'spot' ? 'selected' : ''}>Spot</option></select></div>
      <div class="field"><label>Colour</label><input type="color" id="lcol" value="${l.color}"></div><div class="field"><label>Intensity</label><input type="range" id="lint" min="0" max="300" step="1" value="${l.intensity}"></div><div class="field"><label>Reach (m)</label><input type="range" id="ldist" min="2" max="80" step="1" value="${l.distance}"></div>${l.type === 'spot' ? `<div class="field"><label>Cone °</label><input type="range" id="lang" min="10" max="80" step="1" value="${l.angle || 40}"></div>` : ''}`;
  function importHtml(e) {
    const st = sc.sources.get(e.userData.srcId)?.userData.imported; if (!st) return ''; const imp = e.userData.imp || { unit: 'm', up: 'y', yaw: 0, flip: false, ground: true };
    const opt = (o, cur) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
    return `<h3>Imported model</h3><dl class="kv"><dt>Format</dt><dd>${esc(st.format)}</dd><dt>Meshes · Materials</dt><dd>${st.meshes} · ${st.materials}</dd><dt>Textures</dt><dd>${st.textures}</dd><dt>Triangles</dt><dd>${st.tris.toLocaleString()}</dd></dl>
      ${st.clay ? '<div class="card2 small">No colours came with this file (plain geometry). Use the Material picker, or re-import with its .mtl / textures or as a .zip.</div>' : ''}
      <div class="field"><label>Real size in metres (W × H × D)</label><div class="xyz" id="impSize">${['x','y','z'].map(a => `<label>${a === 'y' ? 'H' : a === 'x' ? 'W' : 'D'}<input type="number" step="0.01" data-sz="${a}"></label>`).join('')}</div><p class="small faint">Type one value — the others follow, keeping proportions.</p></div>
      <details class="fold" open><summary>Fix size &amp; orientation</summary><div>
        <div class="field"><label>File units</label><select id="impUnit">${opt(IMPU, imp.unit)}</select></div>
        <div class="field"><label>Up axis</label><select id="impUp">${opt(IMPUP, imp.up)}</select></div>
        <div class="btn-grid"><button class="btn ghost sm" data-imp="yaw">↻ Turn 90°</button><button class="btn ghost sm" data-imp="flip">⇋ Mirror</button><button class="btn ghost sm" data-imp="ground">${imp.ground === false ? '⤓ Put on ground' : '⤓ On ground ✓'}</button><button class="btn ghost sm" data-imp="auto">✦ Auto-detect</button></div>
        <p class="small faint" style="margin-top:6px">Models exported from Blender, CAD or SketchUp often use Z-up or millimetres. Change these until it looks right — scale, position and rotation above stay yours.</p></div></details>`;
  }
  function refreshInfo() { const e = cur; if (!e || !$(root, '#sizekv')) return; const info = sc.entityInfo(e); $(root, '#sizekv').innerHTML = `<dt>Size (W × H × D)</dt><dd>${f2(info.size.x)} × ${f2(info.size.y)} × ${f2(info.size.z)} m</dd>${info.vol != null ? `<dt>Volume</dt><dd>${f2(info.vol)} m³</dd><dt>Surface</dt><dd>${f2(info.area)} m²</dd>` : ''}${info.tris != null ? `<dt>Triangles</dt><dd>${Math.round(info.tris).toLocaleString()}</dd>` : ''}`; }
  function refreshXform() {
    const e = cur; if (!e || sel().length !== 1) return; const set = (k, arr, conv = x => x) => { const g = $(root, `[data-xf="${k}"]`); if (!g) return; g.querySelectorAll('input').forEach((inp, i) => { if (document.activeElement !== inp) inp.value = f2(conv(arr[i]), 3); }); };
    set('pos', e.position.toArray()); set('rot', [e.rotation.x, e.rotation.y, e.rotation.z], deg); set('scl', e.scale.toArray()); refreshInfo();
  }
  function wireSingle() {
    const e0 = () => cur;
    const $i = id => $(root, id);
    $i('#ename')?.addEventListener('change', ev => { sc.meta_(cur, { name: ev.target.value || 'Object' }); });
    $i('#ntext')?.addEventListener('change', ev => { cur = sc.update(cur, { text: ev.target.value }); });
    $i('#uni')?.addEventListener('change', ev => { uni = ev.target.checked; });
    const applyX = () => { const rd = k => [...$(root, `[data-xf="${k}"]`).querySelectorAll('input')].map(i => parseFloat(i.value) || 0); const e = cur; e.position.set(...rd('pos')); if ($(root, '[data-xf="rot"]')) { const r = rd('rot'); e.rotation.set(rad(r[0]), rad(r[1]), rad(r[2])); } if ($(root, '[data-xf="scl"]')) { const s = rd('scl').map(v => v || 0.01); e.scale.set(...s); } tools.refreshBoxes(); vp.invalidate(); };
    root.querySelectorAll('[data-xf] input').forEach(inp => { inp.addEventListener('input', applyX); inp.addEventListener('change', ev => { const g = ev.target.closest('[data-xf]'); if (g.dataset.xf === 'scl' && uni) { const old = cur.scale.toArray(); const i = +ev.target.dataset.i; const nv = parseFloat(ev.target.value) || 0.01; const k = nv / (old[i] || 1); g.querySelectorAll('input').forEach((x, j) => { x.value = f2(old[j] * k, 3); }); } applyX(); sc.commit('Transform'); tools.refreshSelection(); refreshXform(); }); });
    $i('#tint')?.addEventListener('input', ev => { const u = cur.userData; cur = sc.update(cur, { mat: { key: u.mat?.key, color: ev.target.value } }, { commit: false, silent: true }); tools.refreshSelection(); });
    $i('#tint')?.addEventListener('change', () => { sc.commit('Tint'); });
    $i('#tintreset')?.addEventListener('click', () => { const u = cur.userData; cur = sc.update(cur, { mat: u.mat?.key ? { key: u.mat.key } : null }); lastKey = null; render(true); });
    $i('#slabT')?.addEventListener('change', ev => { cur = sc.update(cur, { T: Math.max(0.02, parseFloat(ev.target.value) || 0.2) }); });
    $i('#elayer')?.addEventListener('change', ev => sc.meta_(cur, { layer: ev.target.value }));
    $i('#elock')?.addEventListener('change', ev => { sc.meta_(cur, { locked: ev.target.checked }); if (ev.target.checked) { sc.clearSel(); toast('Locked — unlock from the Scene tab'); } });
    $i('#ehide')?.addEventListener('change', ev => { sc.meta_(cur, { hidden: ev.target.checked }); });
    const lightUpd = patch => { const u = cur.userData; cur = sc.update(cur, { light: { ...u.light, ...patch } }, { commit: false, silent: true }); tools.refreshSelection(); };
    $i('#ltype')?.addEventListener('change', ev => { const t = ev.target.value; const u = cur.userData; cur = sc.update(cur, { light: { ...u.light, type: t, intensity: t === 'spot' ? 80 : 30 }, name: t === 'spot' ? 'Spot light' : 'Point light' }); lastKey = null; render(true); });
    $i('#lcol')?.addEventListener('input', ev => lightUpd({ color: ev.target.value })); $i('#lint')?.addEventListener('input', ev => lightUpd({ intensity: +ev.target.value })); $i('#ldist')?.addEventListener('input', ev => lightUpd({ distance: +ev.target.value })); $i('#lang')?.addEventListener('input', ev => lightUpd({ angle: +ev.target.value }));
    ['#lcol', '#lint', '#ldist', '#lang'].forEach(s => $i(s)?.addEventListener('change', () => sc.commit('Light')));
    if ($i('#impSize')) { const info = sc.entityInfo(cur); $i('#impSize').querySelectorAll('input').forEach(inp => { inp.value = f2(info.size[inp.dataset.sz], 3); inp.onchange = () => { const nv = parseFloat(inp.value), old = info.size[inp.dataset.sz]; if (nv > 0 && old > 0) { cur.scale.multiplyScalar(nv / old); sc.commit('Resize'); tools.refreshSelection(); refreshXform(); lastKey = null; render(true); } }; }); }
    const impSet = patch => { const u = cur.userData; const imp = { ...(u.imp || {}), ...patch }; cur = sc.update(cur, { imp }, { commit: false, silent: true }); sc.commit('Fix import'); tools.refreshSelection(); lastKey = null; render(true); };
    $i('#impUnit')?.addEventListener('change', ev => impSet({ unit: ev.target.value })); $i('#impUp')?.addEventListener('change', ev => impSet({ up: ev.target.value }));
    root.querySelectorAll('[data-imp]').forEach(b => b.addEventListener('click', () => { const imp = cur.userData.imp || {}; const k = b.dataset.imp; if (k === 'yaw') impSet({ yaw: ((imp.yaw || 0) + 90) % 360 }); else if (k === 'flip') impSet({ flip: !imp.flip }); else if (k === 'ground') impSet({ ground: imp.ground === false }); else { const g = sc.sources.get(cur.userData.srcId).userData.imported.guess; impSet({ unit: g.unit, up: g.up, yaw: 0, flip: false }); } }));
    root.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { const k = parseFloat(b.dataset.u); cur.scale.multiplyScalar(k); sc.commit('Scale units'); tools.refreshSelection(); refreshXform(); toast('Scaled ×' + k); }));
  }
  function wireCommon() {
    $(root, '#arrmode')?.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('#arrmode button').forEach(x => x.classList.toggle('on', x === b)); $(root, '#arrlin').style.display = b.dataset.m === 'lin' ? '' : 'none'; $(root, '#arrpol').style.display = b.dataset.m === 'pol' ? '' : 'none'; });
    root.onclick = e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, s = sel();
      if (a === 'array') { const pol = $(root, '#arrmode .on')?.dataset.m === 'pol'; const n = Math.max(2, Math.min(60, +$(root, '#arrn').value || 4)); sc.array(s, { count: n, polar: pol, dx: +$(root, '#arrx').value, dy: +$(root, '#arry').value, dz: +$(root, '#arrz').value, angle: +$(root, '#arra').value || 360, around: new THREE.Vector3(0, 0, 0) }); toast(`Created ${n} copies`); return; }
      if (a === 'hint') { const st = sc.sources.get(cur.userData.srcId).userData.imported; cur.scale.multiplyScalar(st.hint.factor); sc.commit('Scale units'); tools.refreshSelection(); refreshXform(); return; }
      ctx.action(a);
    };
  }
  sc.on('selection', () => render()); sc.on('history', () => { if (!document.activeElement || !root.contains(document.activeElement)) { lastKey = null; render(true); } });
  render(true);
  return { render, refreshXform };
}

// ============================================================ SCENE (outliner + layers)
export function scenePane(root, ctx) {
  const { sc, vp, tools } = ctx; let selKey = '';
  function draw() {
    const list = sc.list; const sel = new Set(sc.sel);
    root.innerHTML = `<div class="row"><b>${list.filter(e => e.userData.kind !== 'dim').length} objects</b><span class="spacer"></span><button class="btn ghost sm" data-a="all">Select all</button><button class="btn ghost sm" data-a="clear">Clear</button></div>
      <div class="ent-list">${list.length ? list.slice().reverse().map(e => { const u = e.userData; const L = sc.layers.find(l => l.id === u.layer); return `<div class="ent ${sel.has(e) ? 'on' : ''}" data-id="${u.id}"><span class="faint">${icon(KIND_ICON[u.kind] || 'cube')}</span><span class="nm">${esc(u.name)}</span><span class="faint small">${esc(L?.name || '')}</span><button data-t="hide" title="Show / hide" aria-label="Show or hide">${icon(u.hidden ? 'eyeoff' : 'eye')}</button><button data-t="lock" title="Lock" aria-label="Lock or unlock">${icon(u.locked ? 'lock' : 'unlock')}</button></div>`; }).join('') : '<p class="muted small">Your scene is empty.</p>'}</div>
      <h3>Layers</h3><div class="ent-list">${sc.layers.map(l => `<div class="ent" data-l="${l.id}"><span class="nm" data-rename>${esc(l.name)}</span><span class="faint small">${list.filter(e => e.userData.layer === l.id).length}</span><button data-lt="vis" title="Show / hide layer" aria-label="Show or hide layer">${icon(l.visible ? 'eye' : 'eyeoff')}</button>${sc.layers.length > 1 ? `<button data-lt="del" title="Delete layer" aria-label="Delete layer">${icon('trash')}</button>` : ''}</div>`).join('')}</div>
      <button class="btn ghost sm" data-a="addlayer" style="align-self:flex-start">${icon('plus')} Add layer</button>
      <p class="small faint">Tip: assign objects to layers in the Edit tab (e.g. “Structure”, “Roof”, “Furniture”), then hide a layer to look inside.</p>`;
  }
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (a) { if (a.dataset.a === 'all') sc.selectAll(); else if (a.dataset.a === 'clear') sc.clearSel(); else if (a.dataset.a === 'addlayer') { const n = prompt('Layer name', 'Layer ' + (sc.layers.length + 1)); if (n) { sc.addLayer(n); draw(); } } return; }
    const lt = e.target.closest('[data-lt]'); if (lt) { const id = lt.closest('[data-l]').dataset.l; if (lt.dataset.lt === 'vis') sc.setLayerVisible(id, !sc.layers.find(l => l.id === id).visible); else sc.removeLayer(id); draw(); return; }
    const row = e.target.closest('.ent[data-id]'); if (!row) return; const ent = sc.ents.get(row.dataset.id); if (!ent) return; const t = e.target.closest('[data-t]');
    if (t?.dataset.t === 'hide') { sc.meta_(ent, { hidden: !ent.userData.hidden }); draw(); return; }
    if (t?.dataset.t === 'lock') { sc.meta_(ent, { locked: !ent.userData.locked }); draw(); return; }
    if (!ent.userData.locked) sc.select([ent], e.shiftKey || e.ctrlKey);
  });
  root.addEventListener('dblclick', e => { const r = e.target.closest('[data-rename]'); if (!r) return; const id = r.closest('[data-l]').dataset.l; const L = sc.layers.find(l => l.id === id); const n = prompt('Rename layer', L.name); if (n) { L.name = n; sc.commit('Rename layer'); draw(); } });
  const redraw = () => { if (root.closest('.pane')?.classList.contains('on') || !draw.once) { draw(); draw.once = true; } };
  sc.on('change', () => { clearTimeout(draw.t); draw.t = setTimeout(() => root.closest('.pane')?.classList.contains('on') && draw(), 60); }); sc.on('selection', () => root.closest('.pane')?.classList.contains('on') && draw());
  draw(); return { draw };
}

// ============================================================ VIEW
export function viewPane(root, ctx) {
  const { vp, sc, tools } = ctx; const tz = -new Date().getTimezoneOffset() / 60; const now = new Date();
  const st = { lat: 23, lon: Math.round(tz * 15), north: 0, date: now.toISOString().slice(0, 10), hour: 12, play: false };
  root.innerHTML = `
    <h3>Camera</h3>
    <div class="seg" id="vproj"><button data-o="0" class="on">Perspective</button><button data-o="1">Orthographic</button></div>
    <div class="btn-grid"><button class="btn ghost" data-v="iso">Iso</button><button class="btn ghost" data-v="top">Top / plan</button><button class="btn ghost" data-v="front">Front</button><button class="btn ghost" data-v="back">Back</button><button class="btn ghost" data-v="left">Left</button><button class="btn ghost" data-v="right">Right</button></div>
    <h3>Display</h3>
    <div class="seg" id="vmode"><button data-m="solid" class="on">Solid</button><button data-m="clay">Clay</button><button data-m="drawing">Drawing</button><button data-m="xray">X-ray</button><button data-m="wire">Wire</button></div>
    <div class="field"><label>Backdrop</label><div class="seg" id="vtheme"><button data-t="dark">Studio</button><button data-t="light">Paper</button><button data-t="sky" class="on">Sky</button></div></div>
    <div class="field"><label>Exposure</label><input type="range" id="vexp" min="0.4" max="2" step="0.05" value="1"></div>
    <div class="row" style="gap:18px"><label class="row small" style="gap:6px"><input type="checkbox" id="voutline" checked> Outlines</label><label class="row small" style="gap:6px"><input type="checkbox" id="vao" ${vp.ao.on ? 'checked' : ''}> Soft shading (AO)</label><label class="row small" style="gap:6px"><input type="checkbox" id="vgrid" checked> Grid</label><label class="row small" style="gap:6px"><input type="checkbox" id="vground" checked> Ground</label><label class="row small" style="gap:6px"><input type="checkbox" id="vshadow" checked> Shadows</label></div>
    <div class="field"><label>Grid size</label><select id="vgsize"><option value="20">20 m</option><option value="40">40 m</option><option value="60" selected>60 m</option><option value="100">100 m</option><option value="200">200 m</option></select></div>
    <h3>Walk, views &amp; drawings</h3>
    <div class="btn-grid"><button class="btn ghost" data-a="walk">${icon('hand')} Walk through <kbd>H</kbd></button><button class="btn ghost" data-a="sheet">${icon('sheet')} Drawing sheet (A3)</button></div>
    <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" id="saveView">${icon('camera')} Save this view</button><button class="btn ghost sm" id="playTour">${icon('play')} Play tour</button></div>
    <div id="viewList" class="ent-list" style="margin-top:8px"></div>
    <p class="small faint">Saved views are stored in the project. For a drawing sheet, switch to Orthographic and a Top/Front/Right view first — the sheet gets a title block, scale and scale bar.</p>
    <h3>Section cut</h3>
    <label class="row small" style="gap:8px"><input type="checkbox" id="secon"> Slice the model with a plane</label>
    <div class="seg" id="secax"><button data-a="y" class="on">Plan (height)</button><button data-a="x">Section X</button><button data-a="z">Section Z</button></div>
    <div class="field"><label>Position</label><input type="range" id="secpos" min="-20" max="40" step="0.05" value="1.5"></div>
    <div class="row" style="gap:12px"><label class="row small" style="gap:6px"><input type="checkbox" id="secflip"> Flip side</label><span class="small faint" id="secval">1.50 m</span></div>
    <h3>Sun & shadow study</h3>
    <div class="field"><label>Date</label><input type="date" id="sdate" value="${st.date}"></div>
    <div class="row" style="gap:6px"><button class="btn ghost sm" data-d="12-21">Winter</button><button class="btn ghost sm" data-d="03-21">Equinox</button><button class="btn ghost sm" data-d="06-21">Summer</button></div>
    <div class="field"><label>Time</label><input type="range" id="shour" min="0" max="24" step="0.05" value="12"></div>
    <div class="row"><b id="stime" style="font-family:var(--mono)">12:00</b><span class="small muted" id="sinfo"></span><span class="spacer"></span><button class="btn ghost sm" id="splay">${icon('play')} Play day</button></div>
    <div class="field"><label>Latitude °</label><input type="number" id="slat" value="${st.lat}" min="-66" max="66" step="1"></div>
    <div class="field"><label>North offset °</label><input type="number" id="snorth" value="0" min="-180" max="180" step="5"></div>
    <p class="small faint">Latitude 23° ≈ central India, 51° ≈ London, 40° ≈ New York. “North offset” rotates the project so you can match your real site (0 = north is “back” in plan view).</p>
    <h3>Capture</h3>
    <div class="btn-grid"><button class="btn ghost" data-a="shot1">${icon('camera')} Picture</button><button class="btn ghost" data-a="shot2">${icon('camera')} HD picture</button><button class="btn ghost" id="spin">${icon('rotate')} Present</button></div>
    <div class="seg" id="units"><button data-u="m" class="on">Metres</button><button data-u="ft">Feet</button></div>`;
  const q = s => root.querySelector(s);
  q('#vproj').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('#vproj button').forEach(x => x.classList.toggle('on', x === b)); vp.setOrtho(b.dataset.o === '1'); tools.tc.camera = vp.camera; ctx.syncViewBtns?.(); });
  root.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) ctx.view(b.dataset.v); });
  const drawViews = () => { q('#viewList').innerHTML = (sc.views || []).length ? sc.views.map((v, i) => `<div class="ent" data-vi="${i}"><span class="nm" data-go>${esc(v.name)}</span><button class="mini" data-del title="Delete">${icon('trash')}</button></div>`).join('') : '<p class="small faint">No saved views yet.</p>'; };
  q('#saveView').addEventListener('click', () => { const n = prompt('Name this view', 'View ' + ((sc.views || []).length + 1)); if (n) ctx.saveView(n); });
  q('#playTour').addEventListener('click', () => ctx.tour());
  q('#viewList').addEventListener('click', e => { const r = e.target.closest('[data-vi]'); if (!r) return; const i = +r.dataset.vi; if (e.target.closest('[data-del]')) ctx.delView(i); else ctx.goView(i); });
  sc.on('views', drawViews); sc.on('history', drawViews); drawViews();
  root.addEventListener('click', e => { const b = e.target.closest('[data-a="walk"],[data-a="sheet"]'); if (b) ctx.action(b.dataset.a); });
  q('#vmode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('#vmode button').forEach(x => x.classList.toggle('on', x === b)); vp.setMode(b.dataset.m); });
  q('#vtheme').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('#vtheme button').forEach(x => x.classList.toggle('on', x === b)); vp.setTheme(b.dataset.t); });
  q('#vao').addEventListener('change', e => vp.setAO(e.target.checked)); q('#voutline').addEventListener('change', e => vp.setEdges(e.target.checked)); q('#vexp').addEventListener('input', e => vp.setExposure(+e.target.value)); q('#vgrid').addEventListener('change', e => vp.showGrid(e.target.checked)); q('#vground').addEventListener('change', e => vp.showGround(e.target.checked)); q('#vshadow').addEventListener('change', e => vp.setShadows(e.target.checked));
  q('#vgsize').addEventListener('change', e => vp.setGrid(+e.target.value, vp.gridStep || 1));
  // section
  let sax = 'y'; const sec = () => { const pos = +q('#secpos').value; q('#secval').textContent = pos.toFixed(2) + ' m'; vp.setSection(q('#secon').checked, sax, pos, q('#secflip').checked); };
  q('#secon').addEventListener('change', sec); q('#secpos').addEventListener('input', sec); q('#secflip').addEventListener('change', sec);
  q('#secax').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sax = b.dataset.a; root.querySelectorAll('#secax button').forEach(x => x.classList.toggle('on', x === b)); sec(); });
  // sun
  function sun() {
    const [y, m, d] = q('#sdate').value.split('-').map(Number); const h = +q('#shour').value; const lat = +q('#slat').value || 0; const lon = Math.round(tz * 15); const p = sunPosition(dateFrom(y, m, d, h, tz), lat, lon);
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60); q('#stime').textContent = String(hh).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
    q('#sinfo').textContent = p.el > 0 ? `Sun ${Math.round(p.el)}° high, bearing ${Math.round(p.az)}°` : 'Sun below horizon';
    const north = +q('#snorth').value || 0; const up = p.el > 0; vp.setSun(180 - p.az + north, Math.max(p.el, 3), up ? 2.4 * Math.min(1, 0.35 + p.el / 25) : 0.12); vp.hemi.intensity = up ? 0.55 : 0.12; vp.invalidate();
  }
  ['#sdate', '#shour', '#slat', '#snorth'].forEach(s => q(s).addEventListener('input', sun)); sun();
  root.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { q('#sdate').value = new Date().getFullYear() + '-' + b.dataset.d; sun(); }));
  let timer = 0; q('#splay').addEventListener('click', () => { if (timer) { clearInterval(timer); timer = 0; q('#splay').innerHTML = icon('play') + ' Play day'; return; } q('#splay').innerHTML = icon('pause') + ' Pause'; timer = setInterval(() => { let h = +q('#shour').value + 0.1; if (h > 24) h = 0; q('#shour').value = h; sun(); }, 60); });
  q('#spin').addEventListener('click', () => { const on = !vp.controls.autoRotate; vp.controls.autoRotate = on; vp.controls.autoRotateSpeed = 1.2; q('#spin').classList.toggle('on', on); toast(on ? 'Presenting — drag to stop' : 'Presentation stopped'); });
  root.querySelectorAll('[data-a^="shot"]').forEach(b => b.addEventListener('click', () => ctx.action(b.dataset.a)));
  q('#units').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('#units button').forEach(x => x.classList.toggle('on', x === b)); sc.units = b.dataset.u; ctx.updateHud(); toast('Dimensions shown in ' + (sc.units === 'ft' ? 'feet & inches' : 'metres')); });
  return { setOrtho(on) { root.querySelectorAll('#vproj button').forEach(x => x.classList.toggle('on', (x.dataset.o === '1') === on)); } };
}

// ============================================================ PLAN (quantities + cost)
export function planPane(root, ctx) {
  const { sc } = ctx; const rates = { ...RATES };
  function draw() {
    const s = sc.schedule(rates);
    root.innerHTML = `<div class="card2 small muted">A learning-grade bill of quantities from your model: how many of each item, how much material, and a rough cost. Edit the rate (per m³) to match your region.</div>
      <h3>Items</h3>${s.items.length ? `<div class="scroll-x"><table class="t sched"><thead><tr><th>Item</th><th class="num">Qty</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${esc(i.name)} <span class="faint small">${esc(i.cat)}</span></td><td class="num">${i.n}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nothing in the scene yet.</p>'}
      <h3>Materials</h3>${s.mats.length ? `<div class="scroll-x"><table class="t sched"><thead><tr><th>Material</th><th class="num">m³</th><th class="num">m²</th><th class="num">Rate/m³</th><th class="num">Cost</th></tr></thead><tbody>${s.mats.map(m => `<tr><td>${esc(m.name)}</td><td class="num">${f2(m.vol)}</td><td class="num">${f2(m.area, 1)}</td><td class="num"><input type="number" data-rate="${m.key}" value="${m.rate}" min="0" step="10"></td><td class="num">${Math.round(m.cost).toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      <div class="total"><span>Estimated total</span><span>${Math.round(s.total).toLocaleString()}</span></div><p class="small faint">Currency-neutral units. ${s.tris.toLocaleString()} triangles in total. Volumes are geometric; real projects add waste, labour and finishes.</p>
      <div class="btn-grid"><button class="btn ghost" data-a="csv">${icon('download')} Download CSV</button><button class="btn ghost" data-a="refresh">${icon('redo')} Refresh</button></div>` : ''}`;
    root._sched = s;
  }
  root.addEventListener('change', e => { const r = e.target.dataset?.rate; if (r) { rates[r] = Math.max(0, +e.target.value || 0); draw(); } });
  root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'refresh') draw(); if (b.dataset.a === 'csv') { const s = root._sched || sc.schedule(rates); const rows = [['Section', 'Name', 'Qty / m3', 'm2', 'Rate per m3', 'Cost'], ...s.items.map(i => ['Item', i.name, i.n, '', '', '']), ...s.mats.map(m => ['Material', m.name, f2(m.vol, 3), f2(m.area, 2), m.rate, Math.round(m.cost)]), ['Total', '', '', '', '', Math.round(s.total)]]; download((sc.name || 'arck').replace(/\W+/g, '-') + '-quantities.csv', rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); } });
  return { draw };
}
