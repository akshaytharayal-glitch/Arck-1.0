// Realistic-looking vegetation: tapered trunk + branches + hundreds of alpha-cut leaf cards, merged into a few draw calls.
import { THREE, V, mesh, grp } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterial } from '../engine/materials.js';

const rngOf = seed => { let s = (Math.floor(seed * 1000) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const cache = {};
function leafTexture(kind) {
  if (cache[kind]) return cache[kind]; if (typeof document === 'undefined') return null;
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const r = rngOf(kind === 'needle' ? 7 : 3);
  g.clearRect(0, 0, n, n);
  if (kind === 'needle') {
    for (let i = 0; i < 220; i++) { const x = n * 0.1 + r() * n * 0.8, y = n * 0.1 + r() * n * 0.8, a = -Math.PI / 2 + (r() - 0.5) * 2.4, l = 26 + r() * 30; g.strokeStyle = `hsl(${135 + r() * 20},${40 + r() * 20}%,${16 + r() * 16}%)`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  } else {
    for (let i = 0; i < 46; i++) {
      const x = 24 + r() * (n - 48), y = 24 + r() * (n - 48), a = r() * 6.28, w = 14 + r() * 12, l = 28 + r() * 18; g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `hsl(${kind === 'autumn' ? 22 + r() * 25 : 85 + r() * 40},${48 + r() * 22}%,${22 + r() * 22}%)`; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(w, l * 0.25, w * 0.8, l * 0.8, 0, l); g.bezierCurveTo(-w * 0.8, l * 0.8, -w, l * 0.25, 0, 0); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 1); g.lineTo(0, l * 0.9); g.stroke(); g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return cache[kind] = t;
}
const leafMats = {};
function leafMaterial(kind) {
  return leafMats[kind] ||= new THREE.MeshStandardMaterial({ map: leafTexture(kind), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.8 });
}
function card(size, pos, rnd, shade) {
  const g = new THREE.PlaneGeometry(size, size); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 2.6, rnd() * 6.28, (rnd() - 0.5) * 2.6));
  g.applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
  const col = g.attributes.position.count, c = new Float32Array(col * 3); const k = 0.55 + shade * 0.55 + (rnd() - 0.5) * 0.12; for (let i = 0; i < col; i++) { c[i * 3] = k; c[i * 3 + 1] = k; c[i * 3 + 2] = k * 0.96; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('normal'); g.computeVertexNormals(); return g;
}
/** Branch as a tapered cylinder from a to b. */
function branch(a, b, r0, r1) {
  const d = b.clone().sub(a), len = d.length(); const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1, true); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); return g;
}

/** opts: H height, crown radius, trunk radius, kind 'broad'|'autumn'|'conifer'|'bush'. */
export function makeTree({ H = 8, crown = 2.6, tr = 0.2, kind = 'broad', seed = 1 } = {}) {
  const g = grp(), r = rngOf(seed + H + crown);
  if (kind !== 'bush') {
    const wood = [], top = V(0, H * (kind === 'conifer' ? 0.92 : 0.62), 0);
    const trunk = new THREE.CylinderGeometry(tr * (kind === 'conifer' ? 0.2 : 0.55), tr, top.y, 10, 4, true); trunk.translate(0, top.y / 2, 0); wood.push(trunk);
    if (kind !== 'conifer') for (let i = 0; i < 5; i++) { const a = r() * 6.28, s = V(0, top.y * (0.55 + r() * 0.3), 0), e = V(Math.cos(a) * crown * (0.5 + r() * 0.4), top.y + crown * (0.25 + r() * 0.7), Math.sin(a) * crown * (0.5 + r() * 0.4)); wood.push(branch(s, e, tr * 0.35, tr * 0.08)); }
    const wg = mergeGeometries(wood.map(x => x.index ? x.toNonIndexed() : x)); const m = mesh(wg, 'darkwood'); m.userData.matKey = 'darkwood'; g.add(m);
  }
  const cards = []; const mat = leafMaterial(kind === 'conifer' ? 'needle' : kind === 'autumn' ? 'autumn' : 'broad');
  if (kind === 'conifer') {
    const n = Math.round(150 + H * 12), base = H * 0.14;
    for (let i = 0; i < n; i++) { const t = Math.pow(r(), 0.8), y = base + t * (H - base), rr = crown * (1 - t) * (0.55 + r() * 0.5) + 0.05, a = r() * 6.28; cards.push(card(0.5 + crown * 0.28 * (1 - t * 0.6), V(Math.cos(a) * rr, y, Math.sin(a) * rr), r, 0.25 + t * 0.55)); }
  } else if (kind === 'bush') {
    const n = 70; for (let i = 0; i < n; i++) { const a = r() * 6.28, b = Math.acos(1 - r() * 0.95), rr = crown * (0.45 + r() * 0.55); cards.push(card(Math.max(0.28, crown * 0.55), V(Math.sin(b) * Math.cos(a) * rr, crown * 0.18 + Math.cos(b) * rr * 0.75, Math.sin(b) * Math.sin(a) * rr), r, 0.2 + (Math.cos(b) + 1) * 0.35)); }
  } else {
    const cy0 = H * 0.62 + crown * 0.55, n = Math.round(180 + crown * 70);
    for (let i = 0; i < n; i++) { const a = r() * 6.28, b = Math.acos(1 - 2 * r()), rr = crown * Math.cbrt(r()) * 1.05, pos = V(Math.sin(b) * Math.cos(a) * rr, cy0 + Math.cos(b) * rr * 0.82, Math.sin(b) * Math.sin(a) * rr); cards.push(card(0.7 + crown * 0.16, pos, r, 0.15 + (rr / crown) * 0.45 + Math.max(0, Math.cos(b)) * 0.4)); }
  }
  const lm = new THREE.Mesh(mergeGeometries(cards), mat); lm.castShadow = lm.receiveShadow = true; lm.userData.matKey = 'foliage'; g.add(lm);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
