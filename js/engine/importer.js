// Load user 3D files entirely in the browser. Supports multi-file drops (e.g. .obj + .mtl + textures, .gltf + .bin + images).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { paint } from './materials.js';

export const MODEL_EXT = ['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx', 'dae', '3mf', '3ds', 'svg'];
export const SIDE_EXT = ['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tga', 'ktx2'];
export const ACCEPT = [...MODEL_EXT, ...SIDE_EXT].map(e => '.' + e).join(',');
export const extOf = n => (n.split('.').pop() || '').toLowerCase();
export const FORMAT_INFO = [
  ['GLB / glTF', 'Best choice. Keeps colours, textures and hierarchy. Exported from Blender, SketchUp (via plugin), Revit/ArchiCAD (via Datasmith/exporters), Rhino.'],
  ['OBJ (+ MTL)', 'Universal. Select the .obj together with its .mtl and texture images to keep colours.'],
  ['STL', 'Geometry only (no colour). Common for 3D printing and CAD.'],
  ['PLY', 'Scan / point-mesh format; vertex colours supported.'],
  ['FBX', 'Autodesk exchange format — Maya, 3ds Max, Revit.'],
  ['DAE (Collada)', 'Older SketchUp / Google Earth exchange format.'],
  ['3MF / 3DS', '3D-printing and legacy 3ds Max formats.'],
  ['SVG', 'Extruded into a 3D shape from the 2D outline (handy for plans and logos).'],
];

let draco;
function dracoLoader() { if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath('vendor/three/addons/libs/draco/gltf/'); } return draco; }

/** files: File[] (any mix). Returns { object, name, format, stats, warnings }. */
export async function importFiles(files, { onProgress } = {}) {
  files = [...files]; const warnings = [];
  const model = files.find(f => MODEL_EXT.includes(extOf(f.name)));
  if (!model) throw new Error('No supported 3D file found. Supported: ' + MODEL_EXT.join(', ').toUpperCase());
  const urls = new Map(); const url = f => { const k = f.name.toLowerCase(); if (!urls.has(k)) urls.set(k, URL.createObjectURL(f)); return urls.get(k); };
  const byName = new Map(files.map(f => [f.name.toLowerCase(), f]));
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier(u => {
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    const base = decodeURIComponent(u.split('?')[0].split('#')[0]).split(/[\\/]/).pop().toLowerCase(); const f = byName.get(base);
    if (f) return url(f); if (!/^[a-z]+:/.test(u) && /\.(png|jpe?g|webp|gif|bmp|tga|bin|mtl)$/i.test(base)) warnings.push('Missing file: ' + base); return u;
  });
  const ext = extOf(model.name); let obj;
  const buf = () => model.arrayBuffer(); const text = () => model.text();
  try {
    if (ext === 'glb' || ext === 'gltf') {
      const l = new GLTFLoader(mgr); l.setDRACOLoader(dracoLoader());
      const gltf = await new Promise((res, rej) => ext === 'glb' ? buf().then(b => l.parse(b, '', res, rej)) : text().then(t => l.parse(t, '', res, rej)));
      obj = gltf.scene; if (gltf.animations?.length) obj.userData.animations = gltf.animations;
    } else if (ext === 'obj') {
      const mtl = files.find(f => extOf(f.name) === 'mtl'); const l = new OBJLoader(mgr);
      if (mtl) { const ml = new MTLLoader(mgr); const mats = ml.parse(await mtl.text(), ''); mats.preload(); l.setMaterials(mats); } else warnings.push('No .mtl selected — using a neutral material. Select the .obj and .mtl together to keep colours.');
      obj = l.parse(await text());
      if (!mtl) obj.traverse(o => { if (o.isMesh) paint(o, 'plaster'); });
    } else if (ext === 'stl') { const g = new STLLoader(mgr).parse(await buf()); g.computeVertexNormals(); obj = new THREE.Group(); const m = new THREE.Mesh(g); paint(m, 'plaster'); obj.add(m); }
    else if (ext === 'ply') { const g = new PLYLoader(mgr).parse(await buf()); const col = g.hasAttribute('color'); obj = new THREE.Group(); if (g.index) { g.computeVertexNormals(); obj.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col ? 0xffffff : 0xd9d2bf, vertexColors: col, roughness: 0.8, side: THREE.DoubleSide }))); } else { obj.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.03, vertexColors: col, color: col ? 0xffffff : 0xd0a324 }))); warnings.push('This PLY has no faces — shown as a point cloud.'); } }
    else if (ext === 'fbx') obj = new FBXLoader(mgr).parse(await buf(), '');
    else if (ext === 'dae') { obj = new ColladaLoader(mgr).parse(await text(), '').scene; }
    else if (ext === '3mf') obj = new ThreeMFLoader(mgr).parse(await buf());
    else if (ext === '3ds') obj = new TDSLoader(mgr).parse(await buf(), '');
    else if (ext === 'svg') {
      const data = new SVGLoader().parse(await text()); obj = new THREE.Group();
      for (const path of data.paths) for (const shape of SVGLoader.createShapes(path)) { const g = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false }); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: path.color || 0xd0a324, side: THREE.DoubleSide })); m.scale.y = -1; obj.add(m); }
      obj.rotation.x = -Math.PI / 2; const wrap = new THREE.Group(); wrap.add(obj); const bb = new THREE.Box3().setFromObject(wrap); const k = 10 / Math.max(...bb.getSize(new THREE.Vector3()).toArray().slice(0, 2), 1); wrap.scale.setScalar(k); obj = wrap; warnings.push('SVG outlines were extruded into 3D and scaled to ~10 m.');
    }
  } finally { setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 60000); }
  if (!obj) throw new Error('Could not read ' + model.name);
  return normalize(obj, model.name, ext.toUpperCase(), warnings);
}

/** Centre on origin, sit on the ground, fix materials, count stats. */
export function normalize(obj, name, format, warnings = []) {
  const wrap = new THREE.Group(); wrap.name = name.replace(/\.[^.]+$/, ''); wrap.add(obj);
  let tris = 0, meshes = 0; const mats = new Set(), texs = new Set();
  obj.traverse(o => {
    if (o.isMesh || o.isPoints || o.isLine) {
      meshes++; o.castShadow = true; o.receiveShadow = true; const g = o.geometry; if (g) { tris += (g.index ? g.index.count : g.attributes.position.count) / 3; if (!g.attributes.normal && o.isMesh) g.computeVertexNormals(); }
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m) return; mats.add(m); if (m.map) texs.add(m.map); if (m.map) m.map.anisotropy = 4; if (m.isMeshPhongMaterial || m.isMeshLambertMaterial) m.flatShading = false; });
    }
  });
  wrap.updateMatrixWorld(true); let box = new THREE.Box3().setFromObject(wrap);
  if (box.isEmpty()) throw new Error('The file loaded but contains no visible geometry.');
  const size = box.getSize(new THREE.Vector3());
  // Unit guess: huge models are probably millimetres, tiny ones probably metres-in-km — suggest only, never silently rescale.
  let hint = null; const mx = Math.max(size.x, size.y, size.z);
  if (mx > 2000) hint = { factor: 0.001, text: `Model is ${mx.toFixed(0)} units wide — probably millimetres. Scale ×0.001 to get metres.` };
  else if (mx > 200) hint = { factor: 0.01, text: `Model is ${mx.toFixed(0)} units wide — probably centimetres. Scale ×0.01 to get metres.` };
  else if (mx < 0.05) hint = { factor: 100, text: `Model is only ${mx.toFixed(3)} units wide — try scaling ×100.` };
  const c = box.getCenter(new THREE.Vector3()); obj.position.set(-c.x, -box.min.y, -c.z);
  wrap.userData.imported = { name, format, tris: Math.round(tris), meshes, materials: mats.size, textures: texs.size, size: size.toArray(), hint };
  return { object: wrap, name, format, stats: wrap.userData.imported, warnings, hint };
}

/** Wire up drag-drop + file input + paste. */
export function bindDropZone(el, onFiles, input) {
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(t => el.addEventListener(t, e => { stop(e); el.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => el.addEventListener(t, e => { stop(e); el.classList.remove('drag'); }));
  el.addEventListener('drop', async e => { const f = await filesFromDrop(e.dataTransfer); if (f.length) onFiles(f); });
  if (input) input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
}
async function filesFromDrop(dt) {
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!items.length) return [...dt.files];
  const out = []; const walk = async en => {
    if (en.isFile) out.push(await new Promise((res, rej) => en.file(res, rej)));
    else if (en.isDirectory) { const rd = en.createReader(); let batch; do { batch = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const c of batch) await walk(c); } while (batch.length); }
  };
  for (const en of items) await walk(en); return out;
}
