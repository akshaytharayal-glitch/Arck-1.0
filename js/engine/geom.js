// Geometry measurement helpers (volume / area / orientation).
import * as THREE from 'three';

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();

function eachTri(geo, matrix, fn) {
  const pos = geo.attributes.position; if (!pos) return;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    if (matrix) { a.applyMatrix4(matrix); b.applyMatrix4(matrix); c.applyMatrix4(matrix); }
    fn(a, b, c);
  }
}
/** Signed volume (positive when faces point outward). */
export function signedVolume(geo, matrix) {
  let v = 0;
  eachTri(geo, matrix, (p, q, r) => { v += p.dot(t.copy(q).cross(r)) / 6; });
  return v;
}
export function surfaceArea(geo, matrix) {
  let s = 0;
  eachTri(geo, matrix, (p, q, r) => { s += t.copy(q).sub(p).cross(c.copy(r).sub(p)).length() / 2; });
  return s;
}
export function triCount(geo) { return (geo.index ? geo.index.count : (geo.attributes.position?.count || 0)) / 3; }

/** Walk an Object3D and total up volume / area / triangles / bbox in world space. */
export function measureObject(obj) {
  obj.updateWorldMatrix(true, true);
  let vol = 0, area = 0, tris = 0; const box = new THREE.Box3(); const byMat = {};
  obj.traverse(o => {
    if (!o.isMesh || o.userData.helper || !o.visible) return;
    const g = o.geometry; if (!g?.attributes?.position) return;
    const vv = Math.abs(signedVolume(g, o.matrixWorld)), aa = surfaceArea(g, o.matrixWorld);
    const key = o.userData.matKey || (Array.isArray(o.material) ? o.material[0]?.name : o.material?.name) || 'other';
    const solid = !o.userData.surface;
    vol += solid ? vv : 0; area += aa; tris += triCount(g);
    byMat[key] = byMat[key] || { vol: 0, area: 0 };
    byMat[key].vol += solid ? vv : 0; byMat[key].area += aa;
    box.expandByObject(o);
  });
  return { vol, area, tris, box, byMat };
}
