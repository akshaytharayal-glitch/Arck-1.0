// Builder toolkit shared by every catalog item. Convention: 1 unit = 1 metre, base sits on y = 0.
import * as THREE from 'three';
import { paint } from '../engine/materials.js';
import { signedVolume } from '../engine/geom.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE };

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rad = d => d * Math.PI / 180;

export function mesh(geo, mat = 'concrete', { surface = false, noShadow = false } = {}) {
  const m = new THREE.Mesh(geo);
  m.castShadow = !noShadow; m.receiveShadow = true;
  if (surface) m.userData.surface = true;
  paint(m, mat);
  return m;
}
export function grp(...kids) { const g = new THREE.Group(); for (const k of kids.flat()) if (k) g.add(k); return g; }
export function put(o, x = 0, y = 0, z = 0) { o.position.set(x, y, z); return o; }

/** Box whose bottom-centre is at (x, yb, z). */
export function bx(w, h, d, mat, x = 0, yb = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, yb + h / 2, z); return m;
}
/** Cylinder/frustum whose bottom-centre is at (x, yb, z). rt = top radius, rb = bottom radius. */
export function cy(rt, rb, h, mat, x = 0, yb = 0, z = 0, seg = 32) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, yb + h / 2, z); return m;
}
export function sph(r, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), mat); m.position.set(x, y, z); return m;
}
/** Round bar between two points. */
export function bar(a, b, r, mat, seg = 8) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
/** Square-section bar between two points. */
export function sbar(a, b, w, mat, h = w) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  return m;
}
/** Extrude a 2D THREE.Shape along z by depth, centred on z. */
export function extrude(shape, depth, mat, opts = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24, ...opts });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat);
}
/** Polygon outline (array of [x,y]) -> Shape. */
export function polyShape(pts) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s;
}
export function rectPath(w, h, x = 0, y = 0) {
  const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x + w / 2, y - h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x - w / 2, y + h / 2); p.closePath(); return p;
}
/** Lathe around Y from a closed or open profile of [r,y] points; auto-fixes face orientation. */
export function lathe(pts, mat, seg = 48, { closed = true, phi = Math.PI * 2 } = {}) {
  const make = list => new THREE.LatheGeometry(list.map(([r, y]) => new THREE.Vector2(r, y)), seg, 0, phi);
  if (closed) { const f = pts[0], l = pts[pts.length - 1]; if (f[0] !== l[0] || f[1] !== l[1]) pts = [...pts, f]; }
  let g = make(pts);
  if (closed && phi >= Math.PI * 2 - 1e-6 && signedVolume(g) < 0) g = make([...pts].reverse());
  return mesh(g, mat);
}
/** Round tube along 3D points (Catmull-Rom). */
export function tube(points, r, mat, seg = 64, radial = 8, closed = false) {
  const c = new THREE.CatmullRomCurve3(points, closed);
  return mesh(new THREE.TubeGeometry(c, seg, r, radial, closed), mat);
}
/** Solid from stacked rings (equal vertex counts), flat-shaded, with optional end caps. */
export function ringSolid(rings, mat, { caps = true } = {}) {
  const pos = []; const n = rings[0].length;
  const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n, a = rings[i][j], b = rings[i][j2], c = rings[i + 1][j2], d = rings[i + 1][j];
    tri(a, b, c); tri(a, c, d);
  }
  if (caps) {
    const ctr = r => r.reduce((s, v) => s.add(v), V()).multiplyScalar(1 / r.length);
    const bot = rings[0], top = rings[rings.length - 1], cb = ctr(bot), ct = ctr(top);
    for (let j = 0; j < n; j++) { const j2 = (j + 1) % n; tri(cb, bot[j2], bot[j]); tri(ct, top[j], top[j2]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  if (signedVolume(g) < 0) { const arr = g.attributes.position.array; for (let i = 0; i < arr.length; i += 9) for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } g.computeVertexNormals(); }
  return mesh(g, mat);
}
/** Regular polygon ring (n points, radius r, rotation a0) at height y. */
export function polyRing(n, r, y = 0, a0 = 0, rz = r) {
  return Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return V(Math.cos(a) * r, y, Math.sin(a) * rz); });
}
/** Merge a list of meshes into one group already centred on x/z. */
export function centerXZ(g) {
  const b = new THREE.Box3().setFromObject(g); const c = b.getCenter(V());
  g.children.forEach(k => { k.position.x -= c.x; k.position.z -= c.z; });
  return g;
}
/** Sit a group on y=0. */
export function grounded(g) {
  const b = new THREE.Box3().setFromObject(g);
  g.children.forEach(k => { k.position.y -= b.min.y; });
  return g;
}

// ---- catalog definition helpers ----
export const P = (k, label, min, max, step, v, extra = {}) => ({ k, label, min, max, step, v, ...extra });
export const SEL = (k, label, options, v) => ({ k, label, type: 'select', options, v });
export const CHK = (k, label, v = false) => ({ k, label, type: 'check', v });

export const REGISTRY = [];
/**
 * def(id, name, cat, group, params, build, desc, use, opts)
 *   cat: 'shapes' | 'structures' | 'components'
 */
export function def(id, name, cat, group, params, build, desc, use, opts = {}) {
  REGISTRY.push({ id, name, cat, group, params, build, desc, use, solid: true, ...opts });
}
export function defaults(item) { const o = {}; for (const p of item.params) o[p.k] = p.v; return o; }

/** BoxGeometry with bottom-centre at (x, yb, z) — for merging many boxes into one mesh. */
export function boxGeo(w, h, d, x = 0, yb = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, yb + h / 2, z); return g;
}
/** Merge geometries (all must share attributes) into one mesh. */
export function merged(geos, mat, opts) {
  if (!geos.length) return null;
  const list = geos.map(g => { const n = g.index ? g.toNonIndexed() : g; return n; });
  return mesh(mergeGeometries(list, false), mat, opts);
}
