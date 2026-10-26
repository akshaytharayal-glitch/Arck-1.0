// Material library with procedural textures (no image files needed).
import * as THREE from 'three';

export const MATERIALS = {
  gold:      { name: 'Gold',          color: '#d0a324', rough: 0.26, metal: 1 },
  brass:     { name: 'Brass',         color: '#b5893a', rough: 0.35, metal: 0.9 },
  concrete:  { name: 'Concrete',      color: '#b8b6b0', rough: 0.92, metal: 0, tex: 'concrete', size: 2 },
  plaster:   { name: 'White plaster', color: '#ffffff', rough: 0.9, metal: 0, tex: 'plaster', size: 2 },
  brick:     { name: 'Red brick',     color: '#ffffff', rough: 0.9, metal: 0, tex: 'brick', size: 1 },
  stone:     { name: 'Stone blocks',  color: '#ffffff', rough: 0.88, metal: 0, tex: 'stone', size: 2 },
  marble:    { name: 'White marble',  color: '#ffffff', rough: 0.18, metal: 0, tex: 'marble', size: 2 },
  wood:      { name: 'Oak wood',      color: '#ffffff', rough: 0.62, metal: 0, tex: 'wood', size: 1 },
  darkwood:  { name: 'Dark wood',     color: '#6b4a30', rough: 0.55, metal: 0, tex: 'wood', size: 1 },
  bamboo:    { name: 'Bamboo',        color: '#cdb869', rough: 0.55, metal: 0 },
  tile:      { name: 'Ceramic tile',  color: '#ffffff', rough: 0.3, metal: 0, tex: 'tile', size: 1 },
  roof:      { name: 'Clay roof',     color: '#ffffff', rough: 0.78, metal: 0, tex: 'roof', size: 1.2 },
  slate:     { name: 'Slate roof',    color: '#ffffff', rough: 0.7, metal: 0.05, tex: 'slate', size: 1.2 },
  terracotta:{ name: 'Terracotta',    color: '#c06a45', rough: 0.85, metal: 0 },
  glass:     { name: 'Glass',         color: '#9fd6ee', rough: 0.04, metal: 0.1, opacity: 0.38 },
  steel:     { name: 'Steel',         color: '#8e949c', rough: 0.38, metal: 0.95 },
  aluminium: { name: 'Aluminium',     color: '#c7ccd2', rough: 0.3, metal: 0.95 },
  copper:    { name: 'Copper',        color: '#b8663a', rough: 0.38, metal: 0.95 },
  vermilion: { name: 'Red lacquer',   color: '#c0392b', rough: 0.4, metal: 0.05 },
  black:     { name: 'Black',         color: '#1c1c1e', rough: 0.5, metal: 0.3 },
  grass:     { name: 'Grass',         color: '#ffffff', rough: 1, metal: 0, tex: 'grass', size: 2 },
  foliage:   { name: 'Foliage',       color: '#3f7d3a', rough: 0.9, metal: 0 },
  sand:      { name: 'Sand',          color: '#ffffff', rough: 1, metal: 0, tex: 'sand', size: 2 },
  asphalt:   { name: 'Asphalt',       color: '#ffffff', rough: 0.95, metal: 0, tex: 'asphalt', size: 2 },
  water:     { name: 'Water',         color: '#3d8fc4', rough: 0.05, metal: 0.2, opacity: 0.7 },
  fabric:    { name: 'Fabric',        color: '#7a8aa8', rough: 1, metal: 0 },
  skin:      { name: 'Figure',        color: '#d9c3a0', rough: 0.8, metal: 0 },
  paint:     { name: 'Car paint',     color: '#a62b2b', rough: 0.25, metal: 0.6 },
  warm:      { name: 'Warm light',    color: '#fff1b8', rough: 0.4, metal: 0, emissive: '#ffd878' },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS);

const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function canvas(n = 256) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
function speckle(g, n, base, amt, count) {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rnd() * amt * 2 - amt);
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}
const painters = {
  plaster(g, n) { speckle(g, n, '#eee8da', 14, 9000); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,110,90,${0.02 + rnd() * 0.04})`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 8 + rnd() * 30, 0, 7); g.fill(); } },
  sand(g, n) { speckle(g, n, '#d8c38f', 30, 9000); },
  roof(g, n) {
    g.fillStyle = '#6a2c1c'; g.fillRect(0, 0, n, n); const rows = 8, cols = 6, h = n / rows, w = n / cols;
    for (let r = -1; r < rows; r++) for (let c = -1; c <= cols; c++) {
      const x = c * w + (r % 2) * w / 2, y = r * h + h * 0.15; const hue = 10 + rnd() * 9, l = 36 + rnd() * 10;
      const gr = g.createLinearGradient(0, y, 0, y + h * 1.35); gr.addColorStop(0, `hsl(${hue},55%,${l - 8}%)`); gr.addColorStop(0.75, `hsl(${hue},58%,${l + 4}%)`); gr.addColorStop(1, `hsl(${hue},50%,${l - 14}%)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + w - 1, y); g.lineTo(x + w - 1, y + h * 0.95); g.arc(x + w / 2, y + h * 0.95, w / 2 - 1, 0, Math.PI); g.closePath(); g.fill();
    }
  },
  slate(g, n) {
    g.fillStyle = '#20252b'; g.fillRect(0, 0, n, n); const rows = 10, h = n / rows;
    for (let r = 0; r < rows; r++) { let x = -rnd() * 30; while (x < n) { const w = 24 + rnd() * 20, l = 22 + rnd() * 12; g.fillStyle = `hsl(215,${8 + rnd() * 8}%,${l}%)`; g.fillRect(x + 1, r * h + 1, w - 2, h - 2); x += w; } }
  },
  concrete(g, n) { speckle(g, n, '#b9b7b1', 40, 5000); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.strokeRect(0, 0, n, n); },
  asphalt(g, n) { speckle(g, n, '#3a3a3d', 50, 7000); },
  grass(g, n) {
    g.fillStyle = '#4c8a3c'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const l = 35 + rnd() * 25; g.fillStyle = `hsl(${88 + rnd() * 30},${45 + rnd() * 20}%,${l}%)`; g.fillRect(rnd() * n, rnd() * n, 1.5, 3 + rnd() * 4); }
  },
  brick(g, n) {
    g.fillStyle = '#c8bfae'; g.fillRect(0, 0, n, n);
    const rows = 8, cols = 4, h = n / rows, w = n / cols;
    for (let r = 0; r < rows; r++) for (let c = -1; c < cols; c++) {
      const off = (r % 2) * w / 2;
      g.fillStyle = `hsl(${8 + rnd() * 10},${48 + rnd() * 12}%,${34 + rnd() * 10}%)`;
      g.fillRect(c * w + off + 2, r * h + 2, w - 4, h - 4);
    }
  },
  stone(g, n) {
    g.fillStyle = '#7d7a72'; g.fillRect(0, 0, n, n);
    const rows = 4, h = n / rows;
    for (let r = 0; r < rows; r++) { let x = -rnd() * 40; while (x < n) { const w = 60 + rnd() * 70; const l = 62 + rnd() * 14; g.fillStyle = `hsl(${38 + rnd() * 8},${8 + rnd() * 8}%,${l}%)`; g.fillRect(x + 2, r * h + 2, w - 4, h - 4); x += w; } }
    speckle(g, n, 'rgba(0,0,0,0)', 25, 2200);
  },
  wood(g, n) {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 90; i++) { const x = rnd() * n; g.strokeStyle = `rgba(${70 + rnd() * 40},${40 + rnd() * 30},20,${0.12 + rnd() * 0.18})`; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= n; y += 32) g.lineTo(x + Math.sin(y * 0.03 + i) * 3, y); g.stroke(); }
    g.fillStyle = 'rgba(40,20,5,.25)'; for (let i = 0; i < 4; i++) g.fillRect(i * n / 4, 0, 1.5, n);
  },
  tile(g, n) {
    g.fillStyle = '#9a9a96'; g.fillRect(0, 0, n, n);
    const k = 4, s = n / k;
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const l = 88 + rnd() * 6; g.fillStyle = `hsl(40,12%,${l}%)`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  },
  marble(g, n) {
    g.fillStyle = '#f1efe9'; g.fillRect(0, 0, n, n);
    for (let v = 0; v < 12; v++) { g.strokeStyle = `rgba(110,110,120,${0.08 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 1.6; g.beginPath(); let x = rnd() * n, y = 0; g.moveTo(x, y); while (y < n) { x += (rnd() - 0.5) * 22; y += 8 + rnd() * 12; g.lineTo(x, y); } g.stroke(); }
  },
};

const NORMAL_STRENGTH = { brick: 3.2, stone: 4, tile: 2.2, wood: 1.3, concrete: 1.6, roof: 4.2, slate: 3.2, grass: 2.2, asphalt: 3.2, plaster: 1.1, sand: 1.4, marble: 0.3 };
/** Height-from-luminance → tangent-space normal map: gives mortar lines, tile ridges and grain real relief under sunlight. */
function normalFrom(c, k) {
  const n = c.width, d = c.getContext('2d').getImageData(0, 0, n, n).data, h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  const [o, g] = canvas(n), img = g.createImageData(n, n), at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(o); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const normCache = new Map();
function getNormal(kind) { if (normCache.has(kind)) return normCache.get(kind); const c = texCache.get(kind + ':canvas'); const t = c && NORMAL_STRENGTH[kind] ? normalFrom(c, NORMAL_STRENGTH[kind]) : null; normCache.set(kind, t); return t; }
const texCache = new Map();
function getTex(kind) {
  if (texCache.has(kind)) return texCache.get(kind);
  if (typeof document === 'undefined') return null; // node (tests)
  const [c, g] = canvas(256); painters[kind](g, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(kind, t); texCache.set(kind + ':canvas', c); return t;
}

const matCache = new Map();
/** spec: { key, color?, rough?, metal?, opacity? } */
export function getMaterial(spec) {
  if (typeof spec === 'string') spec = { key: spec };
  const base = MATERIALS[spec.key] || MATERIALS.concrete;
  const id = JSON.stringify([spec.key, spec.color, spec.rough, spec.metal, spec.opacity, !!spec.noTex]);
  let m = matCache.get(id);
  if (m) return m;
  const opacity = spec.opacity ?? base.opacity ?? 1;
  m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color || base.color),
    roughness: spec.rough ?? base.rough, metalness: spec.metal ?? base.metal,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 1 || base.opacity === undefined,
    side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (base.emissive) { m.emissive = new THREE.Color(base.emissive); m.emissiveIntensity = 0.6; }
  if (base.tex && !spec.noTex) { const tx = getTex(base.tex); if (tx) { m.map = tx; m.userData.texSize = base.size || 1; const nm = getNormal(base.tex); if (nm) { m.normalMap = nm; m.normalScale = new THREE.Vector2(1, 1); } } }
  m.userData.matKey = spec.key;
  matCache.set(id, m);
  return m;
}

/** Box-projected UVs in metres so textures keep a real-world scale. */
export function boxUV(geo, size = 1) {
  if (!geo.attributes.position || !geo.attributes.normal) return;
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = p.getX(i); v = p.getZ(i); }
    else if (nx >= nz) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Give a mesh a material from spec, fixing UVs when textured. */
export function paint(mesh, spec) {
  const m = getMaterial(spec);
  mesh.material = m;
  mesh.userData.matKey = m.userData.matKey;
  if (m.map && !mesh.geometry.userData.boxUV) { boxUV(mesh.geometry, m.userData.texSize); mesh.geometry.userData.boxUV = true; }
  return mesh;
}
