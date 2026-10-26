// Studio interaction tools: select, transform gizmo, wall/room/slab drawing, measure, click-to-place, notes.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { build } from '../catalog/index.js';
import { fmtLen } from './scene.js';

export const TOOLS = ['select', 'move', 'rotate', 'scale', 'wall', 'room', 'slab', 'measure', 'area', 'note', 'place'];
const GIZMO = { select: 'translate', move: 'translate', rotate: 'rotate', scale: 'scale' };

export class Tools {
  constructor(vp, sc, hooks = {}) {
    this.vp = vp; this.sc = sc; this.hooks = hooks; this.tool = 'select';
    this.snap = { on: true, step: 0.5, angle: 15, scale: 0.1, vertex: true, ortho: false };
    this.draw = { H: 2.8, T: 0.25, mat: 'brick', y: 0, slabT: 0.2, slabMat: 'concrete', door: true };
    this.place = null; this.placeRot = 0; this.pts = []; this.typed = ''; this.hover = null; this.measureA = null;
    this.pivot = new THREE.Object3D(); vp.helpers.add(this.pivot); this.boxes = new THREE.Group(); vp.helpers.add(this.boxes);
    this.preview = new THREE.Group(); vp.helpers.add(this.preview); this.preview.renderOrder = 8;

    this.tc = new TransformControls(vp.camera, vp.canvas); this.tc.setSize(vp.coarse ? 0.95 : 0.7); this.tc.enabled = true;
    this.tcHelper = this.tc.getHelper(); this.tcHelper.userData.helper = true; vp.scene.add(this.tcHelper);
    this.tc.addEventListener('dragging-changed', e => { vp.controls.enabled = !e.value; if (e.value) this._dragStart(); else this._dragEnd(); });
    this.tc.addEventListener('objectChange', () => this._dragMove());
    this.tc.addEventListener('change', () => vp.invalidate());

    // two-finger pinch / pan must never grab a gizmo handle
    const ptr = new Set(); vp.canvas.addEventListener('pointerdown', e => { ptr.add(e.pointerId); this.tc.enabled = ptr.size < 2; }, true); const rel = e => { ptr.delete(e.pointerId); this.tc.enabled = ptr.size < 2; }; vp.canvas.addEventListener('pointerup', rel, true); vp.canvas.addEventListener('pointercancel', rel, true);
    sc.on('selection', () => this.refreshSelection()); sc.on('change', () => this.refreshBoxes());
    this._bind(); this.setTool('select'); vp.onFrame(() => this._frame());
  }

  // ------------------------------------------------------------ tool state
  setTool(t, opts) {
    if (t !== 'place') this._clearGhost();
    if (this.tool === 'wall' || this.tool === 'room' || this.tool === 'slab' || this.tool === 'area') this.cancelDraw();
    this.tool = t; this.measureA = null; this.clearPreview(); this.typed = '';
    if (t === 'place' && opts) { this.place = opts; this._makeGhost(); } else if (t !== 'place') this.place = null;
    this.vp.canvas.style.cursor = ['wall', 'room', 'slab', 'measure', 'area', 'note', 'place'].includes(t) ? 'crosshair' : 'default';
    this.refreshSelection(); this.hooks.tool?.(t);
  }
  _gizmoOK(e) { return e && !['dim'].includes(e.userData.kind) && !e.userData.locked; }
  refreshSelection() {
    const sel = this.sc.sel.filter(e => this._gizmoOK(e)); const mode = GIZMO[this.tool];
    this.tc.detach(); this.tc.camera = this.vp.camera;
    if (mode && sel.length) {
      this.tc.setMode(mode); this.tc.setSpace(mode === 'translate' ? 'world' : 'local');
      this.tc.setTranslationSnap(this.snap.on ? this.snap.step : null); this.tc.setRotationSnap(this.snap.on ? THREE.MathUtils.degToRad(this.snap.angle) : null); this.tc.setScaleSnap(this.snap.on ? this.snap.scale : null);
      if (sel.length === 1) this.tc.attach(sel[0]); else { const b = new THREE.Box3(); sel.forEach(e => b.expandByObject(e)); b.getCenter(this.pivot.position); this.pivot.position.y = b.min.y; this.pivot.rotation.set(0, 0, 0); this.pivot.scale.set(1, 1, 1); this.pivot.updateMatrix(); this.tc.attach(this.pivot); }
    }
    this.refreshBoxes(); this.vp.invalidate();
  }
  refreshBoxes() {
    this.boxes.clear();
    for (const e of this.sc.sel) { if (!e.visible) continue; e.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(e); if (b.isEmpty()) continue; const h = new THREE.Box3Helper(b, e.userData.locked ? 0x888888 : 0xf3d36b); h.userData.helper = true; h.material.depthTest = false; h.material.transparent = true; h.renderOrder = 7; this.boxes.add(h); }
    this.vp.invalidate();
  }
  setSnap(patch) { Object.assign(this.snap, patch); this.refreshSelection(); }

  // ------------------------------------------------------------ gizmo dragging (single + multi via pivot)
  _dragStart() {
    this._moved = false; const sel = this.sc.sel; if (this.tc.object === this.pivot) { this.pivot.updateMatrix(); this._p0 = this.pivot.matrix.clone(); this._starts = sel.map(e => e.matrix.clone()); }
  }
  _dragMove() {
    this._moved = true;
    if (this.tc.object === this.pivot) { this.pivot.updateMatrix(); const delta = this.pivot.matrix.clone().multiply(this._p0.clone().invert()); this.sc.sel.forEach((e, i) => { const m = delta.clone().multiply(this._starts[i]); m.decompose(e.position, e.quaternion, e.scale); e.rotation.setFromQuaternion(e.quaternion); }); }
    this.refreshBoxes(); this.hooks.transform?.();
  }
  _dragEnd() { if (this._moved) { this.sc.commit('Transform'); this.hooks.transform?.(); } this._moved = false; this.refreshSelection(); }

  // ------------------------------------------------------------ pointer handling
  _bind() {
    const cv = this.vp.canvas; let down = null;
    cv.addEventListener('pointerdown', e => { if (e.button !== 0 && e.pointerType === 'mouse') return; down = { x: e.clientX, y: e.clientY, t: performance.now(), gizmo: this.tc.axis !== null, id: e.pointerId }; });
    cv.addEventListener('pointerup', e => {
      if (!down) return; const d = down; down = null; if (d.gizmo || this.tc.dragging) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return; this._click(e);
    });
    cv.addEventListener('pointermove', e => this._hover(e));
    cv.addEventListener('dblclick', e => { if (this.tool === 'wall' || this.tool === 'slab' || this.tool === 'area') this.finishDraw(); });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.clearPreview(); });
  }
  _snapPt(p, anchor) {
    if (!p) return null; const q = p.clone(); const st = this.snap.step;
    if (this.snap.on) { q.x = Math.round(q.x / st) * st; q.z = Math.round(q.z / st) * st; }
    if (this.snap.ortho && anchor) { if (Math.abs(q.x - anchor.x) > Math.abs(q.z - anchor.z)) q.z = anchor.z; else q.x = anchor.x; }
    // endpoint snapping to existing wall ends
    if (this.snap.vertex) { let best = null, bd = Math.max(0.18, this._pxToM() * 14); for (const e of this.sc.list) if (e.userData.catalogId === 'wall' && e.visible) { const L = e.userData.params.L - e.userData.params.T, c = Math.cos(e.rotation.y), s = -Math.sin(e.rotation.y); for (const sgn of [-1, 1]) { const ep = new THREE.Vector3(e.position.x + sgn * c * L / 2, 0, e.position.z + sgn * s * L / 2); const dd = ep.distanceTo(new THREE.Vector3(q.x, 0, q.z)); if (dd < bd) { bd = dd; best = ep; } } } if (best) { q.x = best.x; q.z = best.z; q.snapped = true; } }
    q.y = this.draw.y; return q;
  }
  _pxToM() { const d = this.vp.camera.position.distanceTo(this.vp.controls.target); return this.vp.orthoOn ? (this.vp.ortho.top - this.vp.ortho.bottom) / (this.vp.el.clientHeight || 1) : 2 * d * Math.tan(THREE.MathUtils.degToRad(this.vp.persp.fov / 2)) / (this.vp.el.clientHeight || 1); }
  _surfacePoint(ev, snapVertex = false) {
    const { hits } = this.vp.pick(ev.clientX, ev.clientY); let pt = null, face = null, obj = null;
    const h = hits.find(h => !h.object.userData.label);
    if (h) { pt = h.point.clone(); obj = h.object; if (snapVertex && this.snap.vertex && h.face) { const pos = h.object.geometry.attributes.position; let bd = Math.max(0.12, this._pxToM() * 16); for (const i of [h.face.a, h.face.b, h.face.c]) { const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(h.object.matrixWorld); const dd = v.distanceTo(pt); if (dd < bd) { bd = dd; pt = v; pt.snapped = true; } } } face = h.face; }
    else pt = this.vp.groundPoint(ev.clientX, ev.clientY, 0);
    return { pt, face, obj, hit: h };
  }
  _entityOf(o) { while (o && !o.userData?.entity) o = o.parent; return o; }

  _click(ev) {
    const t = this.tool;
    if (t === 'select' || GIZMO[t]) {
      const { hits } = this.vp.pick(ev.clientX, ev.clientY); const h = hits.find(h => { const e = this._entityOf(h.object); return e && !e.userData.locked && e.visible; });
      const e = h && this._entityOf(h.object); const add = ev.shiftKey || ev.ctrlKey || ev.metaKey || this.hooks.multi?.();
      if (e) this.sc.select([e], add); else if (!add) this.sc.clearSel(); return;
    }
    if (t === 'wall') return this._wallClick(ev);
    if (t === 'room') return this._roomClick(ev);
    if (t === 'slab') return this._slabClick(ev);
    if (t === 'area') return this._slabClick(ev);
    if (t === 'measure') return this._measureClick(ev);
    if (t === 'note') { const { pt } = this._surfacePoint(ev); if (pt) { const txt = prompt('Note text', 'Entrance'); if (txt) this.sc.addNote(txt, pt.toArray()); } return; }
    if (t === 'place') return this._placeClick(ev);
  }
  _hover(ev) {
    const t = this.tool; if (!['wall', 'room', 'slab', 'area', 'measure', 'place'].includes(t)) return; if (ev.pointerType === 'touch' && !this.pts.length && t !== 'place') return;
    if (t === 'place') { const { pt } = this._surfacePoint(ev); if (pt) this._moveGhost(pt); return; }
    const sp = t === 'measure' ? this._surfacePoint(ev, true) : { pt: this.vp.groundPoint(ev.clientX, ev.clientY, this.draw.y) };
    if (!sp.pt) return; this.hover = t === 'measure' ? sp.pt : this._snapPt(sp.pt, this.pts[this.pts.length - 1]); this._drawPreview();
  }

  // ------------------------------------------------------------ preview helpers
  clearPreview() { this.preview.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.preview.clear(); this.vp.invalidate(); }
  _marker(p, color = 0xf3d36b, r = 0.09) { const m = new THREE.Mesh(new THREE.SphereGeometry(r * Math.max(1, this._pxToM() * 40), 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false })); m.position.copy(p); m.renderOrder = 11; return m; }
  _line(pts, color = 0xf3d36b, closed = false) { const g = new THREE.BufferGeometry().setFromPoints(closed ? [...pts, pts[0]] : pts); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })); l.renderOrder = 10; return l; }
  _label(text, pos) { const c = document.createElement('canvas'); c.width = 256; c.height = 72; const g = c.getContext('2d'); g.fillStyle = 'rgba(18,15,8,.88)'; g.strokeStyle = '#d0a324'; g.lineWidth = 3; g.beginPath(); g.roundRect(3, 3, 250, 66, 14); g.fill(); g.stroke(); g.fillStyle = '#f3d36b'; g.font = '600 36px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 38); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); const k = Math.max(0.5, this._pxToM() * 26); s.scale.set(k * 3.5, k * 1.0, 1); s.position.copy(pos).add(new THREE.Vector3(0, k * 0.9, 0)); s.renderOrder = 12; return s; }
  _drawPreview() {
    this.clearPreview(); const t = this.tool, h = this.hover; if (!h) return;
    const mk = h.snapped ? 0x7ccf8f : 0xf3d36b; this.preview.add(this._marker(h, mk));
    if (t === 'wall' && this.pts.length) { const a = this.pts[this.pts.length - 1]; this.preview.add(this._line([a, h])); this.preview.add(this._label(fmtLen(a.distanceTo(h)), a.clone().add(h).multiplyScalar(0.5))); }
    if ((t === 'slab' || t === 'area') && this.pts.length) { this.preview.add(this._line([...this.pts, h], 0xf3d36b)); this.preview.add(this._label(`${this.pts.length} pts`, h)); }
    if (t === 'room' && this.pts.length) { const a = this.pts[0], c = [a, new THREE.Vector3(h.x, a.y, a.z), h, new THREE.Vector3(a.x, a.y, h.z)]; this.preview.add(this._line(c, 0xf3d36b, true)); this.preview.add(this._label(`${fmtLen(Math.abs(h.x - a.x))} × ${fmtLen(Math.abs(h.z - a.z))}`, h)); }
    if (t === 'measure') { if (this.measureA) { this.preview.add(this._marker(this.measureA, 0xd0a324)); this.preview.add(this._line([this.measureA, h])); this.preview.add(this._label(fmtLen(this.measureA.distanceTo(h)), this.measureA.clone().add(h).multiplyScalar(0.5))); } }
  }

  // ------------------------------------------------------------ wall tool
  _wallClick(ev) {
    const g = this.vp.groundPoint(ev.clientX, ev.clientY, this.draw.y); if (!g) return; const p = this._snapPt(g, this.pts[this.pts.length - 1]); this.addDrawPoint(p);
  }
  addDrawPoint(p) {
    const last = this.pts[this.pts.length - 1];
    if (last && last.distanceTo(p) < 0.05) return;
    if (last) { const w = this.sc.addWall(last, p, { H: this.draw.H, T: this.draw.T, mat: this.draw.mat, y: this.draw.y }); if (w) this._drawn = (this._drawn || []).concat(w); }
    this.pts.push(p.clone()); if (this.tool === 'wall' && this.pts.length > 2 && p.distanceTo(this.pts[0]) < 0.05) return this.finishDraw();
    this.hooks.drawing?.(this.pts.length); this._drawPreview();
  }
  /** Type a length (metres) along the current cursor direction and place the next point. */
  commitTyped(value) {
    const last = this.pts[this.pts.length - 1], h = this.hover; if (!last || !h) return false; const L = parseFloat(value); if (!(L > 0)) return false;
    const dir = h.clone().sub(last); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize(); this.addDrawPoint(last.clone().addScaledVector(dir, L)); return true;
  }
  closeShape() { if (this.pts.length > 2) { const f = this.pts[0]; if (this.tool === 'wall') this.addDrawPoint(f.clone()); else this.finishDraw(); } }
  finishDraw() {
    if (this.tool === 'area' && this.pts.length >= 3) { this._finishArea(); this.pts = []; this._drawn = null; this.clearPreview(); this.hooks.drawing?.(0); return; }
    if (this.tool === 'slab' && this.pts.length >= 3) { const s = this.sc.addSlab(this.pts, { T: this.draw.slabT, mat: this.draw.slabMat, y: this.draw.y }); this.sc.commit('Add slab'); this.sc.select([s]); }
    else if (this._drawn?.length) { this.sc.commit('Draw walls'); this.sc.select(this._drawn); }
    this.pts = []; this._drawn = null; this.clearPreview(); this.hooks.drawing?.(0);
  }
  /** Area tool: dimension every edge and drop a note with area + perimeter at the centroid. */
  _finishArea() {
    const p = this.pts; let A = 0, cx = 0, cz = 0, per = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const cr = a.x * b.z - b.x * a.z; A += cr; cx += (a.x + b.x) * cr; cz += (a.z + b.z) * cr; per += a.distanceTo(b); }
    A /= 2; const area = Math.abs(A); if (area < 1e-6) return; cx /= (6 * A); cz /= (6 * A);
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (a.distanceTo(b) > 0.05) this.sc.addDim(a, b); }
    this.sc.addNote(`${area.toFixed(2)} m² · perimeter ${per.toFixed(2)} m`, [cx, p[0].y + 0.05, cz]); this.hooks.toast?.(`Area ${area.toFixed(2)} m² (${(area * 10.7639).toFixed(1)} ft²)`);
  }
  cancelDraw() { if (this._drawn?.length) this.sc.remove(this._drawn, false); this._drawn = null; this.pts = []; this.clearPreview(); this.hooks.drawing?.(0); }
  undoPoint() { if (this.tool === 'wall' && this._drawn?.length) { this.sc.remove(this._drawn.pop(), false); this.pts.pop(); this._drawPreview(); } else if (this.pts.length) { this.pts.pop(); this._drawPreview(); } }

  // ------------------------------------------------------------ room tool (rectangle of 4 walls + optional slab)
  _roomClick(ev) {
    const g = this.vp.groundPoint(ev.clientX, ev.clientY, this.draw.y); if (!g) return; const p = this._snapPt(g);
    if (!this.pts.length) { this.pts = [p]; this.hooks.drawing?.(1); return; }
    this.makeRoom(this.pts[0], p); this.pts = []; this.clearPreview(); this.hooks.drawing?.(0);
  }
  makeRoom(a, b, { floor = this.draw.floor !== false, door = this.draw.door } = {}) {
    if (Math.abs(a.x - b.x) < 0.3 || Math.abs(a.z - b.z) < 0.3) return; const y = this.draw.y, c = [new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(b.x, y, a.z), new THREE.Vector3(b.x, y, b.z), new THREE.Vector3(a.x, y, b.z)];
    const made = []; if (floor) made.push(this.sc.addSlab(c, { T: 0.15, mat: 'tile', y: y - 0.0, name: 'Floor' }));
    for (let i = 0; i < 4; i++) { const w = this.sc.addWall(c[i], c[(i + 1) % 4], { H: this.draw.H, T: this.draw.T, mat: this.draw.mat, y: y + (floor ? 0.15 : 0), params: i === 0 && door ? { door: true, dx: 0.5, doorW: 0.95, windows: 0 } : i === 2 ? { windows: Math.max(1, Math.round(Math.abs(b.x - a.x) / 3)), winW: 1.2, winH: 1.2, sill: 0.9 } : {} }); if (w) made.push(w); }
    this.sc.commit('Add room'); this.sc.select(made);
  }

  // ------------------------------------------------------------ slab tool
  _slabClick(ev) { const g = this.vp.groundPoint(ev.clientX, ev.clientY, this.draw.y); if (!g) return; const p = this._snapPt(g, this.pts[this.pts.length - 1]); if (this.pts.length > 2 && p.distanceTo(this.pts[0]) < Math.max(0.3, this._pxToM() * 14)) return this.finishDraw(); this.pts.push(p.clone()); this.hooks.drawing?.(this.pts.length); this._drawPreview(); }

  // ------------------------------------------------------------ measure tool
  _measureClick(ev) {
    const { pt } = this._surfacePoint(ev, true); if (!pt) return;
    if (!this.measureA) { this.measureA = pt.clone(); this._drawPreview(); this.hooks.measure?.(null); return; }
    const A = this.measureA, B = pt.clone(); this.measureA = null; this.sc.addDim(A, B); this.hooks.measure?.({ A, B, d: A.distanceTo(B), dx: Math.abs(B.x - A.x), dy: Math.abs(B.y - A.y), dz: Math.abs(B.z - A.z) }); this.clearPreview();
  }

  // ------------------------------------------------------------ click-to-place
  _makeGhost() {
    this._clearGhost(); const o = build(this.place.id, this.place.params); o.traverse(m => { if (m.isMesh) { const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => { const c = x.clone(); c.transparent = true; c.opacity = Math.min(0.6, x.opacity ?? 1); c.depthWrite = false; return c; }); m.material = Array.isArray(m.material) ? mats : mats[0]; m.castShadow = false; m.userData.helper = true; } });
    this.ghost = o; o.visible = false; this.vp.helpers.add(o); this.placeRot = 0;
  }
  _clearGhost() { if (this.ghost) { this.vp.helpers.remove(this.ghost); this.ghost = null; } }
  _moveGhost(pt) { if (!this.ghost) return; const q = pt.clone(); if (this.snap.on) { q.x = Math.round(q.x / this.snap.step) * this.snap.step; q.z = Math.round(q.z / this.snap.step) * this.snap.step; } this.ghost.position.copy(q); this.ghost.rotation.y = this.placeRot; this.ghost.visible = true; this.vp.invalidate(); }
  rotatePlace(deg = 90) { this.placeRot += THREE.MathUtils.degToRad(deg); if (this.ghost) { this.ghost.rotation.y = this.placeRot; this.vp.invalidate(); } }
  _placeClick(ev) {
    const { pt } = this._surfacePoint(ev); if (!pt) return; const q = pt.clone(); if (this.snap.on) { q.x = Math.round(q.x / this.snap.step) * this.snap.step; q.z = Math.round(q.z / this.snap.step) * this.snap.step; }
    const e = this.sc.addCatalog(this.place.id, this.place.params, { pos: [q.x, q.y > 0.05 ? q.y : 0, q.z], rot: [0, this.placeRot, 0], mat: this.place.mat, select: false }); this.sc.select([e]); this.hooks.placed?.(e);
  }

  _frame() { if (this.tc.object && this.tc.dragging) this.vp.invalidate(); }
  dispose() { this.tc.dispose(); }
}
