// Studio scene model: entities, serialisation, undo/redo, project save/load, quantities.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { build, getItem, defaults } from '../catalog/index.js';
import { MATERIALS } from '../engine/materials.js';
import { restyle } from '../engine/restyle.js';
import { measureObject, triCount } from '../engine/geom.js';
import { orient } from '../engine/importer.js';
import { extrude, polyShape } from '../catalog/kit.js';
import { prismY } from '../catalog/shapes.js';

const r3 = n => Math.round(n * 1e4) / 1e4;
export const RATES = { // learning-level unit costs (per m³ unless noted) — editable in the UI
  concrete: 150, brick: 220, stone: 320, marble: 600, wood: 700, darkwood: 750, steel: 7800, glass: 2500, roof: 120, slate: 200, plaster: 90, gold: 60000, tile: 180, aluminium: 6500, copper: 9000, asphalt: 110, fabric: 400, foliage: 30, other: 200,
};

export class StudioScene {
  constructor(vp) {
    this.vp = vp; this.world = vp.world; this.ents = new Map(); this.sources = new Map(); this.layers = [{ id: 'L1', name: 'Layer 1', visible: true }];
    this.sel = []; this.nid = 1; this.hist = []; this.hi = -1; this.h = {}; this.units = 'm'; this.name = 'Untitled project';
    this.meta = { level: 0 };
  }
  on(ev, fn) { (this.h[ev] ||= new Set()).add(fn); return () => this.h[ev].delete(fn); }
  emit(ev, a) { this.h[ev]?.forEach(fn => fn(a)); }
  get list() { return [...this.ents.values()]; }

  // ------------------------------------------------------------ content builders
  _applyOverride(content, mat, isImport) { restyle(content, mat, isImport); }
  _content(d) {
    let c;
    if (d.kind === 'catalog') { c = build(d.catalogId, d.params); this._applyOverride(c, d.mat, false); }
    else if (d.kind === 'import') { const src = this.sources.get(d.srcId); if (!src) throw new Error('Missing imported source ' + d.srcId); c = src.clone(true); orient(c, d.imp || src.userData.imp || {}); if (d.mat) this._applyOverride(c, d.mat, true); else c.traverse(o => { if (o.isMesh && o.userData.origMat) o.material = o.userData.origMat; }); }
    else if (d.kind === 'slab') { const sh = polyShape(d.pts.map(([x, z]) => [x, -z])); c = new THREE.Group(); const m = prismY(sh, d.T, d.mat?.key || 'concrete'); c.add(m); if (d.mat) this._applyOverride(c, d.mat, false); }
    else if (d.kind === 'group') { c = new THREE.Group(); for (const ch of d.children) { const cc = this._content(ch); this._xf(cc, ch); c.add(cc); } }
    else if (d.kind === 'light') c = makeLight(d.light);
    else if (d.kind === 'note') c = makeNote(d.text);
    else if (d.kind === 'dim') c = makeDim(d.a, d.b);
    c.userData.isContent = true; return c;
  }
  _xf(o, d) { o.position.fromArray(d.pos || [0, 0, 0]); o.rotation.set(...(d.rot || [0, 0, 0])); o.scale.fromArray(d.scl || [1, 1, 1]); }
  _sig(d) { return JSON.stringify([d.kind, d.catalogId, d.params, d.mat, d.srcId, d.text, d.light, d.a, d.b, d.pts, d.T, d.imp, d.children?.map(c => [this._sig(c), c.pos, c.rot, c.scl])]); }

  _make(d) {
    const e = new THREE.Group(); e.userData = { entity: true, id: d.id, kind: d.kind, name: d.name, catalogId: d.catalogId, params: d.params, mat: d.mat || null, srcId: d.srcId, imp: d.imp, layer: d.layer || 'L1', locked: !!d.locked, hidden: !!d.hidden, light: d.light, text: d.text, a: d.a, b: d.b, pts: d.pts, T: d.T, children: d.children, sig: this._sig(d) };
    e.add(this._content(d)); this._xf(e, d); e.name = d.name; this._applyVis(e); return e;
  }
  _applyVis(e) { const L = this.layers.find(l => l.id === e.userData.layer); e.visible = !e.userData.hidden && (L ? L.visible : true); }
  describe(e) {
    const u = e.userData; return { id: u.id, name: u.name, kind: u.kind, catalogId: u.catalogId, params: u.params && { ...u.params }, mat: u.mat, srcId: u.srcId, imp: u.imp && { ...u.imp }, pos: e.position.toArray().map(r3), rot: [r3(e.rotation.x), r3(e.rotation.y), r3(e.rotation.z)], scl: e.scale.toArray().map(r3), layer: u.layer, locked: u.locked, hidden: u.hidden, light: u.light, text: u.text, a: u.a, b: u.b, pts: u.pts, T: u.T, children: u.children };
  }
  snapshot() { return this.list.map(e => this.describe(e)); }

  _register(e) { this.ents.set(e.userData.id, e); this.world.add(e); if (e.userData.kind !== 'light' && e.userData.kind !== 'note' && e.userData.kind !== 'dim') this.vp.decorate?.(e); return e; }
  _uid() { return 'e' + (this.nid++); }

  // ------------------------------------------------------------ history
  commit(label = 'change') {
    const s = JSON.stringify({ s: this.snapshot(), layers: this.layers });
    if (this.hi >= 0 && this.hist[this.hi].s === s) return;
    this.hist = this.hist.slice(0, this.hi + 1); this.hist.push({ s, label }); if (this.hist.length > 120) this.hist.shift(); this.hi = this.hist.length - 1;
    this.emit('change'); this.emit('history'); this._autosave();
  }
  canUndo() { return this.hi > 0; } canRedo() { return this.hi < this.hist.length - 1; }
  undo() { if (this.canUndo()) { this.hi--; this._restore(this.hist[this.hi].s); } }
  redo() { if (this.canRedo()) { this.hi++; this._restore(this.hist[this.hi].s); } }
  _restore(json) {
    const { s, layers } = JSON.parse(json); this.layers = layers; const keep = new Set(s.map(d => d.id)); const selIds = new Set(this.sel.map(e => e.userData.id));
    for (const e of this.list) if (!keep.has(e.userData.id)) { this.world.remove(e); this.ents.delete(e.userData.id); }
    for (const d of s) {
      const ex = this.ents.get(d.id);
      if (ex && ex.userData.sig === this._sig(d)) { this._xf(ex, d); Object.assign(ex.userData, { name: d.name, layer: d.layer, locked: !!d.locked, hidden: !!d.hidden }); ex.name = d.name; this._applyVis(ex); continue; }
      if (ex) { this.world.remove(ex); this.ents.delete(d.id); }
      this._register(this._make(d));
    }
    this.sel = [...selIds].map(id => this.ents.get(id)).filter(Boolean); this.emit('selection'); this.emit('change'); this.emit('history'); this.vp.invalidate();
  }
  _autosave() { clearTimeout(this._as); this._as = setTimeout(() => this.emit('autosave'), 1200); }

  // ------------------------------------------------------------ selection
  select(list, add = false) {
    list = [].concat(list).filter(Boolean); if (add) { const s = new Set(this.sel); list.forEach(e => s.has(e) ? s.delete(e) : s.add(e)); list = [...s]; }
    this.sel = list; this.emit('selection');
  }
  clearSel() { if (this.sel.length) { this.sel = []; this.emit('selection'); } }
  selectAll() { this.select(this.list.filter(e => e.visible && !e.userData.locked && e.userData.kind !== 'dim')); }

  // ------------------------------------------------------------ add / edit / remove
  _add(d, { select = true, commit = true, label } = {}) {
    d.id ||= this._uid(); d.layer ||= this.layers[0].id; d.name ||= d.kind; const e = this._make(d); this._register(e);
    if (select) this.select([e]); if (commit) this.commit(label || 'Add ' + d.name); this.vp.invalidate(); return e;
  }
  addCatalog(id, params = {}, o = {}) {
    const it = getItem(id); const p = { ...defaults(it), ...params };
    return this._add({ kind: 'catalog', catalogId: id, params: p, name: o.name || it.name, pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0], scl: o.scl, mat: o.mat || null, layer: o.layer }, o);
  }
  addImport(object, name, o = {}) {
    const srcId = 's' + (this.nid++); this.sources.set(srcId, object); return this._add({ kind: 'import', srcId, imp: o.imp || object.userData.imp && { ...object.userData.imp }, name: name || object.name || 'Imported model', pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0], scl: o.scl || [1, 1, 1] }, o);
  }
  addWall(a, b, { H = 2.8, T = 0.25, mat = 'brick', y = 0, extend = true, params = {} } = {}) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < 0.05) return null;
    return this.addCatalog('wall', { L: L + (extend ? T : 0), H, T, door: false, windows: 0, ...params }, { name: 'Wall', pos: [(a.x + b.x) / 2, y, (a.z + b.z) / 2], rot: [0, Math.atan2(-dz, dx), 0], mat: { key: mat }, select: false, commit: false });
  }
  addSlab(pts, { T = 0.2, mat = 'concrete', y = 0, name = 'Slab' } = {}) {
    const c = pts.reduce((s, p) => [s[0] + p.x / pts.length, s[1] + p.z / pts.length], [0, 0]);
    return this._add({ kind: 'slab', pts: pts.map(p => [r3(p.x - c[0]), r3(p.z - c[1])]), T, mat: { key: mat }, name, pos: [r3(c[0]), y, r3(c[1])], rot: [0, 0, 0] }, { select: false, commit: false });
  }
  addLight(type = 'point', pos = [0, 3, 0]) { return this._add({ kind: 'light', light: { type, color: '#ffe2a0', intensity: type === 'spot' ? 80 : 30, distance: 25, angle: 40 }, name: type === 'spot' ? 'Spot light' : 'Point light', pos }, { label: 'Add light' }); }
  addNote(text, pos) { return this._add({ kind: 'note', text, name: 'Note', pos }, { label: 'Add note' }); }
  addDim(a, b) { return this._add({ kind: 'dim', a: a.toArray().map(r3), b: b.toArray().map(r3), name: 'Dimension', pos: [0, 0, 0] }, { label: 'Add dimension', select: false }); }

  remove(list = this.sel, commit = true) { list = [].concat(list); list.forEach(e => { this.world.remove(e); this.ents.delete(e.userData.id); }); this.sel = this.sel.filter(e => !list.includes(e)); this.emit('selection'); if (commit) this.commit('Delete'); this.vp.invalidate(); }
  /** Rebuild an entity's content after params/material changes while keeping transform + id. */
  update(e, patch, { commit = true, label = 'Edit', silent = false } = {}) {
    const d = this.describe(e); const merged = patch.params ? { ...d.params, ...patch.params } : d.params; Object.assign(d, patch); d.params = merged;
    const was = this.sel.includes(e); this.world.remove(e); this.ents.delete(d.id); const ne = this._register(this._make(d));
    if (was) this.sel = this.sel.map(s => s === e ? ne : s); if (!silent) this.emit('selection'); if (commit) this.commit(label); this.vp.invalidate(); return ne;
  }
  meta_(e, patch, commit = true) { Object.assign(e.userData, patch); if (patch.name) e.name = patch.name; this._applyVis(e); this.emit('change'); if (commit) this.commit('Edit'); this.vp.invalidate(); }
  duplicate(list = this.sel, off = [0.8, 0, 0.8]) {
    const out = list.map(e => { const d = this.describe(e); d.id = this._uid(); d.pos = [d.pos[0] + off[0], d.pos[1] + off[1], d.pos[2] + off[2]]; if (d.kind === 'dim') { d.a = d.a.map((v, i) => v + off[i]); d.b = d.b.map((v, i) => v + off[i]); d.pos = [0, 0, 0]; } return this._register(this._make(d)); });
    this.select(out); this.commit('Duplicate'); this.vp.invalidate(); return out;
  }
  group(list = this.sel) {
    list = list.filter(e => e.userData.kind !== 'dim'); if (list.length < 2) return null; const box = new THREE.Box3(); list.forEach(e => box.expandByObject(e)); const c = box.getCenter(new THREE.Vector3()); const base = [r3(c.x), r3(box.min.y), r3(c.z)];
    const children = list.map(e => { const d = this.describe(e); d.pos = [d.pos[0] - base[0], d.pos[1] - base[1], d.pos[2] - base[2]]; return d; });
    list.forEach(e => { this.world.remove(e); this.ents.delete(e.userData.id); }); const g = this._add({ kind: 'group', children, name: 'Group', pos: base }, { commit: false }); this.commit('Group'); return g;
  }
  ungroup(e = this.sel[0]) {
    if (!e || e.userData.kind !== 'group') return; const out = []; e.updateMatrixWorld(true);
    for (const ch of e.userData.children) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...ch.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...ch.rot)), new THREE.Vector3(...(ch.scl || [1, 1, 1]))); m.premultiply(e.matrix); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); const eu = new THREE.Euler().setFromQuaternion(q); const d = { ...ch, id: this._uid(), pos: p.toArray(), rot: [eu.x, eu.y, eu.z], scl: s.toArray(), layer: e.userData.layer }; out.push(this._register(this._make(d))); }
    this.world.remove(e); this.ents.delete(e.userData.id); this.select(out); this.commit('Ungroup');
  }
  mirror(list = this.sel, axis = 'x') {
    const i = axis === 'x' ? 0 : 2, out = [];
    for (const e of list) { const d = this.describe(e); if (d.kind === 'dim') continue; d.id = this._uid(); d.pos[i] = -d.pos[i]; d.rot[1] = -d.rot[1]; d.scl[i] = -d.scl[i]; out.push(this._register(this._make(d))); }
    this.select(out); this.commit('Mirror'); this.vp.invalidate();
  }
  array(list = this.sel, { count = 3, dx = 3, dy = 0, dz = 0, polar = false, angle = 360, around } = {}) {
    const out = []; const ctr = around || new THREE.Box3().setFromObject(list[0]).getCenter(new THREE.Vector3());
    for (let k = 1; k < count; k++) for (const e of list) {
      const d = this.describe(e); d.id = this._uid();
      if (polar) { const a = THREE.MathUtils.degToRad(angle) / (angle >= 360 ? count : count - 1) * k, c = Math.cos(a), s = Math.sin(a); const px = d.pos[0] - ctr.x, pz = d.pos[2] - ctr.z; d.pos[0] = ctr.x + px * c + pz * s; d.pos[2] = ctr.z - px * s + pz * c; d.rot[1] += a; }
      else { d.pos[0] += dx * k; d.pos[1] += dy * k; d.pos[2] += dz * k; }
      if (d.kind === 'dim') continue; out.push(this._register(this._make(d)));
    }
    this.select([...list, ...out]); this.commit('Array ×' + count); this.vp.invalidate(); return out;
  }
  dropToGround(list = this.sel) { list.forEach(e => { e.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(e); e.position.y -= b.min.y; }); this.commit('Drop to ground'); this.vp.invalidate(); }
  align(list, mode) {
    if (list.length < 1) return; const bs = list.map(e => new THREE.Box3().setFromObject(e)); const all = new THREE.Box3(); bs.forEach(b => all.union(b));
    list.forEach((e, i) => { const b = bs[i]; const c = b.getCenter(new THREE.Vector3());
      if (mode === 'left') e.position.x += all.min.x - b.min.x; else if (mode === 'right') e.position.x += all.max.x - b.max.x; else if (mode === 'cx') e.position.x += all.getCenter(new THREE.Vector3()).x - c.x;
      else if (mode === 'back') e.position.z += all.min.z - b.min.z; else if (mode === 'front') e.position.z += all.max.z - b.max.z; else if (mode === 'cz') e.position.z += all.getCenter(new THREE.Vector3()).z - c.z; else if (mode === 'ground') e.position.y -= b.min.y; });
    this.commit('Align'); this.vp.invalidate();
  }
  distribute(list, axis = 'x') {
    if (list.length < 3) return; const k = axis; const items = list.map(e => ({ e, c: new THREE.Box3().setFromObject(e).getCenter(new THREE.Vector3())[k] })).sort((a, b) => a.c - b.c); const a = items[0].c, b = items[items.length - 1].c;
    items.forEach((it, i) => { it.e.position[k] += a + (b - a) * i / (items.length - 1) - it.c; }); this.commit('Distribute'); this.vp.invalidate();
  }
  clear() { this.list.forEach(e => this.world.remove(e)); this.ents.clear(); this.sel = []; this.emit('selection'); }
  newProject() { this.clear(); this.sources.clear(); this.layers = [{ id: 'L1', name: 'Layer 1', visible: true }]; this.views = []; this.name = 'Untitled project'; this.hist = []; this.hi = -1; this.commit('New'); }

  // ------------------------------------------------------------ layers
  addLayer(name) { const id = 'L' + (this.layers.length + 1 + Math.floor(Math.random() * 999)); this.layers.push({ id, name: name || 'Layer ' + (this.layers.length + 1), visible: true }); this.commit('Add layer'); return id; }
  setLayerVisible(id, v) { const L = this.layers.find(l => l.id === id); if (L) L.visible = v; this.list.forEach(e => this._applyVis(e)); this.commit('Layer visibility'); this.vp.invalidate(); }
  removeLayer(id) { if (this.layers.length < 2) return; this.layers = this.layers.filter(l => l.id !== id); this.list.forEach(e => { if (e.userData.layer === id) e.userData.layer = this.layers[0].id; this._applyVis(e); }); this.commit('Remove layer'); }

  // ------------------------------------------------------------ analysis
  entityInfo(e) {
    e.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(e); const size = box.getSize(new THREE.Vector3()); const u = e.userData;
    let tris = null, vol = null, area = null; if (u.kind !== 'light' && u.kind !== 'note' && u.kind !== 'dim') { const big = u.kind === 'import' && (this.sources.get(u.srcId)?.userData.imported?.tris || 0) > 300000; if (!big) { const m = measureObject(e); tris = m.tris; vol = m.vol; area = m.area; } else tris = this.sources.get(u.srcId).userData.imported.tris; }
    return { size, box, tris, vol, area };
  }
  /** Bill of quantities: counts per catalog item + volume/area per material + estimated cost. */
  schedule(rates = RATES) {
    const items = new Map(), mats = new Map(); let tris = 0, total = 0;
    for (const e of this.list) {
      const u = e.userData; if (!e.visible || ['dim', 'note', 'light'].includes(u.kind)) continue;
      const key = u.kind === 'catalog' ? u.catalogId : u.kind + ':' + (u.name); const row = items.get(key) || { name: u.kind === 'catalog' ? getItem(u.catalogId).name : u.name, cat: u.kind === 'catalog' ? getItem(u.catalogId).cat : u.kind, n: 0 }; row.n++; items.set(key, row);
      if (u.kind === 'import' && (this.sources.get(u.srcId)?.userData.imported?.tris || 0) > 300000) continue;
      const m = measureObject(e); tris += m.tris;
      for (const [k, v] of Object.entries(m.byMat)) { const r = mats.get(k) || { vol: 0, area: 0 }; r.vol += v.vol; r.area += v.area; mats.set(k, r); }
    }
    const matRows = [...mats.entries()].map(([k, v]) => { const rate = rates[k] ?? rates.other; const cost = v.vol * rate; total += cost; return { key: k, name: MATERIALS[k]?.name || k, vol: v.vol, area: v.area, rate, cost }; }).sort((a, b) => b.cost - a.cost);
    return { items: [...items.values()].sort((a, b) => b.n - a.n), mats: matRows, total, tris };
  }
  /** Clean root for export (no lights/dims/notes). */
  exportRoot() {
    const g = new THREE.Group(); g.name = this.name;
    for (const e of this.list) { const u = e.userData; if (!e.visible || ['dim', 'note', 'light'].includes(u.kind)) continue; const c = e.clone(true); c.traverse(o => { if (o.userData?.helper) o.visible = false; }); g.add(c); }
    return g;
  }

  // ------------------------------------------------------------ project IO (imports embedded as GLB)
  async toProject() {
    const used = new Set(this.list.filter(e => e.userData.kind === 'import').map(e => e.userData.srcId)); const flatten = d => d.kind === 'group' ? d.children.forEach(flatten) : d.srcId && used.add(d.srcId); this.list.forEach(e => e.userData.kind === 'group' && e.userData.children.forEach(flatten));
    const imports = {}; for (const id of used) { const src = this.sources.get(id); if (!src) continue; const buf = await new GLTFExporter().parseAsync(src, { binary: true }); imports[id] = { name: src.name, b64: b64(buf) }; }
    return { app: 'ARCK', v: 1, name: this.name, nid: this.nid, layers: this.layers, entities: this.snapshot(), imports, views: this.views || [] };
  }
  async fromProject(p) {
    if (p.app !== 'ARCK') throw new Error('This is not an ARCK project file.'); this.clear(); this.sources.clear(); this.layers = p.layers || this.layers; this.views = p.views || []; this.name = p.name || 'Project'; this.nid = p.nid || 1;
    for (const [id, v] of Object.entries(p.imports || {})) { const gltf = await new Promise((res, rej) => new GLTFLoader().parse(unb64(v.b64), '', res, rej)); const sr = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene; sr.name = v.name; sr.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); this.sources.set(id, sr); }
    for (const d of p.entities) { try { this._register(this._make(d)); } catch (e) { console.warn('skipped', d.name, e.message); } }
    this.hist = []; this.hi = -1; this.commit('Open project'); this.vp.invalidate();
  }
}

function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; }

// ------------------------------------------------------------ special entity content
export function makeLight(l) {
  const g = new THREE.Group(); let L;
  if (l.type === 'spot') { L = new THREE.SpotLight(l.color, l.intensity, l.distance, THREE.MathUtils.degToRad(l.angle || 40), 0.4, 1.6); L.target.position.set(0, -1, 0); g.add(L.target); }
  else L = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);
  g.add(L);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: l.color })); bulb.userData.helper = false; bulb.userData.lightMarker = true; bulb.userData.surface = true; g.add(bulb);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.27, 28), new THREE.MeshBasicMaterial({ color: 0xd0a324, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); ring.userData.surface = true; ring.userData.lightMarker = true; g.add(ring); ring.onBeforeRender = (r, s, cam) => ring.quaternion.copy(cam.quaternion);
  return g;
}
function textSprite(text, { size = 0.5, bg = 'rgba(18,15,8,.85)', fg = '#f3d36b', border = '#d0a324' } = {}) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const f = 44; ctx.font = `600 ${f}px system-ui, sans-serif`; const w = Math.ceil(ctx.measureText(text).width + 36); c.width = w; c.height = f + 30;
  ctx.font = `600 ${f}px system-ui, sans-serif`; ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 3; const r = 14; ctx.beginPath(); ctx.roundRect(2, 2, w - 4, c.height - 4, r); ctx.fill(); ctx.stroke(); ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.fillText(text, 18, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(size * w / c.height * 1.0, size, 1); s.renderOrder = 10; s.userData.surface = true; s.userData.label = true; s.raycast = THREE.Sprite.prototype.raycast; return s;
}
export function makeNote(text) { const g = new THREE.Group(); const s = textSprite(text || 'Note', { size: 0.55 }); s.position.y = 0.5; g.add(s, new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xd0a324 }))); g.children[1].position.y = 0.25; g.children[1].userData.surface = true; return g; }
export function makeDim(a, b) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), g = new THREE.Group(); const L = A.distanceTo(B);
  const mat = new THREE.LineBasicMaterial({ color: 0xf3d36b, depthTest: false, transparent: true }); const geo = new THREE.BufferGeometry().setFromPoints([A, B]); const line = new THREE.Line(geo, mat); line.renderOrder = 9; line.userData.surface = true; g.add(line);
  for (const P of [A, B]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd0a324, depthTest: false })); d.position.copy(P); d.renderOrder = 9; d.userData.surface = true; g.add(d); }
  const s = textSprite(fmtLen(L), { size: 0.4 }); s.position.copy(A).add(B).multiplyScalar(0.5); s.position.y += 0.25; g.add(s); g.userData.length = L; return g;
}
export const fmtLen = (m, units = 'm') => units === 'ft' ? (() => { const ft = m / 0.3048, f = Math.floor(ft), i = Math.round((ft - f) * 12); return `${f}'${i === 12 ? 0 : i}"`; })() : m >= 100 ? m.toFixed(1) + ' m' : m >= 1 ? m.toFixed(2) + ' m' : (m * 100).toFixed(0) + ' cm';
