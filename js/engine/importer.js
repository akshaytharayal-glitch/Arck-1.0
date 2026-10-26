// Load user 3D files entirely in the browser.
// Handles: single files, multi-file drops (obj + mtl + textures, gltf + bin + images), folders and .zip archives.
// Imported objects are kept RAW (original axes/units); orient() applies unit + up-axis + yaw per placement,
// so the same source can be re-oriented any time without reloading.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { unzipSync } from 'three/addons/libs/fflate.module.js';

export const MODEL_EXT = ['glb', 'gltf', 'fbx', 'obj', 'dae', '3mf', '3ds', 'ply', 'stl', 'svg'];
export const SIDE_EXT = ['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tga', 'ktx2', 'tif', 'tiff', 'zip'];
export const ACCEPT = [...MODEL_EXT, ...SIDE_EXT].map(e => '.' + e).join(',');
export const extOf = n => (n.split('.').pop() || '').toLowerCase();
export const UNITS = { m: 1, mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048 };
export const UNIT_NAMES = { m: 'Metres', mm: 'Millimetres', cm: 'Centimetres', in: 'Inches', ft: 'Feet' };
export const UP_NAMES = { y: 'Y is up (standard)', z: 'Z is up (CAD / Blender export)', nz: '−Z is up', x: 'X is up', ny: 'Upside down' };
export const FORMAT_INFO = [
  ['ZIP archive', 'Drop a .zip containing the model, .mtl and texture folders — everything is unpacked and linked automatically.'],
  ['GLB / glTF', 'Best choice. Keeps colours, textures and hierarchy. Exported from Blender, SketchUp (via plugin), Revit/ArchiCAD (via Datasmith/exporters), Rhino.'],
  ['OBJ (+ MTL)', 'Universal. Drop the .obj with its .mtl and texture images (or one .zip) to keep colours and textures.'],
  ['STL', 'Geometry only (no colour). Common for 3D printing and CAD.'],
  ['PLY', 'Scan / point-mesh format; vertex colours supported.'],
  ['FBX', 'Autodesk exchange format — Maya, 3ds Max, Revit. Embedded textures are supported.'],
  ['DAE (Collada)', 'Older SketchUp / Google Earth exchange format.'],
  ['3MF / 3DS', '3D-printing and legacy 3ds Max formats.'],
  ['SVG', 'Extruded into a 3D shape from the 2D outline (handy for plans and logos).'],
];
const WHITE_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let draco;
function dracoLoader() { if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath('vendor/three/addons/libs/draco/gltf/'); } return draco; }
// LoadingManager defines itemStart/itemEnd per instance, so wrap them after construction to count in-flight files.
function Mgr() { const m = new THREE.LoadingManager(); m.n = 0; const st = m.itemStart, en = m.itemEnd; m.itemStart = u => { m.n++; st(u); }; m.itemEnd = u => { m.n--; en(u); }; return m; }

const norm = p => decodeURIComponent(String(p).split('?')[0].split('#')[0]).replace(/\\/g, '/').replace(/^(file:\/+|\.\/)/i, '').replace(/^[a-z]:\//i, '').toLowerCase();
const baseOf = p => norm(p).split('/').pop();

/** Unpack zips; every returned File carries .relPath. */
export async function expandFiles(files) {
  const out = [], notes = [];
  for (const f of files) {
    const e = extOf(f.name);
    if (e === 'zip') {
      let entries; try { entries = unzipSync(new Uint8Array(await f.arrayBuffer())); } catch (err) { notes.push(`Could not open ${f.name}: ${err.message || 'invalid zip'}`); continue; }
      let n = 0;
      for (const [path, data] of Object.entries(entries)) {
        if (!data.length || path.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(path)) continue;
        const nested = extOf(path); if (nested === 'zip') continue;
        const nf = new File([data], path.split('/').pop(), { type: '' }); nf.relPath = path; out.push(nf); n++;
      }
      if (!n) notes.push(`${f.name} is empty.`);
    } else if (['rar', '7z', 'tar', 'gz'].includes(e)) notes.push(`${f.name}: ${e.toUpperCase()} archives are not supported — please use .zip.`);
    else { f.relPath ||= f.webkitRelativePath || f.name; out.push(f); }
  }
  return { files: out, notes };
}

/** files: File[] (any mix, zips allowed). Returns { object, name, format, stats, warnings, hint, guess }. */
export async function importFiles(input, { onProgress } = {}) {
  const { files, notes } = await expandFiles([...input]); const warnings = [...notes];
  const models = files.filter(f => MODEL_EXT.includes(extOf(f.name))).sort((a, b) => MODEL_EXT.indexOf(extOf(a.name)) - MODEL_EXT.indexOf(extOf(b.name)) || a.name.localeCompare(b.name));
  if (!models.length) throw new Error(notes[0] || 'No supported 3D file found. Supported: ' + MODEL_EXT.join(', ').toUpperCase() + ' (or a .zip containing them).');
  const byPath = new Map(), byBase = new Map();
  files.forEach(f => { byPath.set(norm(f.relPath), f); const b = baseOf(f.relPath); if (!byBase.has(b)) byBase.set(b, f); });
  const urls = new Map(), missing = new Set(), broken = new Set();
  const lookup = u => { const p = norm(u); if (byPath.has(p)) return byPath.get(p); const segs = p.split('/'); for (let i = 1; i < segs.length; i++) { const t = segs.slice(i).join('/'); for (const [k, f] of byPath) if (k === t || k.endsWith('/' + t)) return f; } return byBase.get(segs.pop()); };
  const blobFor = f => { if (!urls.has(f)) urls.set(f, URL.createObjectURL(f)); return urls.get(f) + '#/' + encodeURIComponent(f.name); };
  const mgr = Mgr();
  mgr.setURLModifier(u => {
    if (globalThis.__ARCK_DEBUG) console.log('resolve', u);
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    const f = lookup(u); if (f) return blobFor(f);
    if (/\.(png|jpe?g|webp|gif|bmp|tga|tiff?|dds)$/i.test(norm(u))) { missing.add(baseOf(u)); return WHITE_PX; }
    if (!/^[a-z]+:/i.test(u)) missing.add(baseOf(u)); return u;
  });
  mgr.onError = u => { if (globalThis.__ARCK_DEBUG) console.log('load error', u); broken.add(baseOf(u)); }; mgr.addHandler(/\.tga(#.*)?$/i, new TGALoader(mgr));

  const root = new THREE.Group(); const loaded = [], skipped = [];
  for (const [i, model] of models.entries()) {
    if (i >= 12) { skipped.push(model.name); continue; }
    onProgress?.(`Reading ${model.name}…`);
    try { const o = await loadModel(model, files, byBase, lookup, mgr, warnings); o.name ||= model.name; root.add(o); loaded.push(model.name); }
    catch (err) { console.error(err); warnings.push(`${model.name}: ${err.message || err}`); }
  }
  if (!loaded.length) throw new Error(warnings.pop() || 'Could not read the file.');
  if (loaded.length > 1) warnings.push(`Combined ${loaded.length} model files: ${loaded.slice(0, 4).join(', ')}${loaded.length > 4 ? '…' : ''}`);
  if (skipped.length) warnings.push(`Skipped ${skipped.length} extra model files.`);
  for (let t = 0; mgr.n > 0 && t < 600; t++) await sleep(50);
  const obj = loaded.length === 1 ? root.children[0] : root; const ext = extOf(loaded[0]);
  fixMaterials(obj, ext, warnings, broken);
  if (missing.size) warnings.push(`${missing.size} texture file${missing.size > 1 ? 's' : ''} not found (${[...missing].slice(0, 3).join(', ')}${missing.size > 3 ? '…' : ''}) — surfaces use their base colour. Include the images or a .zip.`);
  setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 120000);
  return normalize(obj, loaded.length === 1 ? loaded[0] : loaded[0].replace(/\.[^.]+$/, '') + ' (+' + (loaded.length - 1) + ')', ext.toUpperCase(), warnings);
}

async function loadModel(model, files, byBase, lookup, mgr, warnings) {
  const ext = extOf(model.name), buf = () => model.arrayBuffer(), text = () => model.text();
  if (ext === 'glb' || ext === 'gltf') {
    const l = new GLTFLoader(mgr); l.setDRACOLoader(dracoLoader()); l.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => ext === 'glb' ? buf().then(b => l.parse(b, '', res, rej)) : text().then(t => l.parse(t, '', res, rej)));
    const o = gltf.scene; if (gltf.animations?.length) o.userData.animations = gltf.animations; return o;
  }
  if (ext === 'obj') {
    const src = await text(); const l = new OBJLoader(mgr);
    const refs = [...src.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm)].flatMap(m => m[1].split(/\s{2,}|\t/)); const mtls = new Set();
    for (const r of refs) { const f = lookup(r); if (f && extOf(f.name) === 'mtl') mtls.add(f); }
    if (!mtls.size) { const all = files.filter(f => extOf(f.name) === 'mtl'); const same = all.find(f => f.name.replace(/\.mtl$/i, '').toLowerCase() === model.name.replace(/\.obj$/i, '').toLowerCase()); const pick = same || (all.length === 1 ? all[0] : all[0]); if (pick) { mtls.add(pick); if (refs.length) warnings.push(`.obj asks for ${refs[0]} — used ${pick.name} instead.`); } }
    if (mtls.size) {
      const ml = new MTLLoader(mgr); ml.setMaterialOptions({ side: THREE.DoubleSide }); let t = ''; for (const f of mtls) t += (await f.text()) + '\n';
      const mats = ml.parse(t, ''); mats.preload(); l.setMaterials(mats);
    } else warnings.push('No .mtl file found with this .obj — showing it in plain clay. Add the .mtl (and texture images) or a .zip to get the original colours.');
    const o = l.parse(src); o.userData.hasMtl = mtls.size > 0; return o;
  }
  if (ext === 'stl') { const g = new STLLoader(mgr).parse(await buf()); const o = new THREE.Group(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: g.hasColors ? 0xffffff : 0xd8cdb4, vertexColors: !!g.hasColors, roughness: 0.82 })); o.add(m); o.userData.clay = !g.hasColors; return o; }
  if (ext === 'ply') {
    const g = new PLYLoader(mgr).parse(await buf()); const col = g.hasAttribute('color'); const o = new THREE.Group();
    if (g.index) o.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col ? 0xffffff : 0xd8cdb4, vertexColors: col, roughness: 0.82 })));
    else o.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.03, vertexColors: col, color: col ? 0xffffff : 0xd0a324, sizeAttenuation: true })));
    o.userData.clay = !col; return o;
  }
  if (ext === 'fbx') return new FBXLoader(mgr).parse(await buf(), '');
  if (ext === 'dae') return new ColladaLoader(mgr).parse(await text(), '').scene;
  if (ext === '3mf') return new ThreeMFLoader(mgr).parse(await buf());
  if (ext === '3ds') return new TDSLoader(mgr).parse(await buf(), '');
  if (ext === 'svg') {
    const data = new SVGLoader().parse(await text()); const o = new THREE.Group();
    for (const path of data.paths) for (const shape of SVGLoader.createShapes(path)) { const g = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false }); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: path.color?.getHex?.() ?? 0xd0a324, roughness: 0.6, side: THREE.DoubleSide })); m.scale.y = -1; o.add(m); }
    const wrap = new THREE.Group(); o.rotation.x = -Math.PI / 2; wrap.add(o); const bb = new THREE.Box3().setFromObject(wrap); const k = 10 / Math.max(...bb.getSize(new THREE.Vector3()).toArray().slice(0, 2), 1); wrap.scale.setScalar(k); return wrap;
  }
  throw new Error('Unsupported format .' + ext);
}

/** Convert every material to PBR, repair black/transparent/one-sided cases, make normals. */
function fixMaterials(obj, ext, warnings, broken) {
  const cache = new Map(); let transparentFixed = 0; const isGltf = ext === 'glb' || ext === 'gltf';
  const tex = (t, srgb) => { if (!t) return null; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS ||= THREE.RepeatWrapping; t.wrapT ||= THREE.RepeatWrapping; t.needsUpdate = true; return t; };
  const up = m => {
    if (!m) return m; if (cache.has(m)) return cache.get(m); let s = m;
    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) { s = m; }
    else if (m.isMeshPhongMaterial || m.isMeshLambertMaterial || m.isMeshBasicMaterial || m.isMeshToonMaterial) {
      const spec = m.specular ? (m.specular.r + m.specular.g + m.specular.b) / 3 : 0, sh = m.shininess ?? 30;
      s = new THREE.MeshStandardMaterial({ name: m.name, color: m.color?.clone() ?? new THREE.Color(0xcccccc), map: m.map, alphaMap: m.alphaMap, normalMap: m.normalMap, bumpMap: m.bumpMap, bumpScale: m.bumpScale ?? 1, emissive: m.emissive?.clone() ?? new THREE.Color(0), emissiveMap: m.emissiveMap, vertexColors: m.vertexColors, opacity: m.opacity, transparent: m.transparent, side: m.side, roughness: m.isMeshBasicMaterial ? 0.9 : spec < 0.05 ? 0.88 : THREE.MathUtils.clamp(1 - Math.sqrt(sh) / 36, 0.35, 0.9), metalness: 0 });
      if (m.isMeshBasicMaterial && m.map) { s.emissive.set(0x000000); }
    }
    if (s.map || s.emissiveMap || s.normalMap || s.bumpMap || s.alphaMap) { tex(s.map, true); tex(s.emissiveMap, true); tex(s.normalMap); tex(s.bumpMap); tex(s.alphaMap); }
    if (s.map && s.color && s.color.r + s.color.g + s.color.b < 0.06) s.color.set(0xffffff);
    if (s.opacity < 0.02) { s.opacity = 1; s.transparent = false; transparentFixed++; }
    if (s.opacity < 1) { s.transparent = true; s.depthWrite = s.opacity >= 0.5; }
    if (s.alphaMap) { s.alphaTest = 0.35; s.transparent = false; }
    if (!isGltf) s.side = THREE.DoubleSide;
    s.envMapIntensity = 1; s.needsUpdate = true; cache.set(m, s); return s;
  };
  const clay = new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.85, side: THREE.DoubleSide, name: 'clay' });
  obj.traverse(o => {
    if (o.isMesh || o.isPoints || o.isLine) { o.castShadow = o.receiveShadow = true; o.frustumCulled = true; }
    if (!o.isMesh) return; const g = o.geometry;
    if (g?.attributes?.position && !g.attributes.normal) { try { o.geometry = toCreasedNormals(g.index ? g.toNonIndexed() : g, THREE.MathUtils.degToRad(38)); } catch { g.computeVertexNormals(); } }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fixed = mats.map(m => (obj.userData.hasMtl === false || !m) ? clay : up(m));
    o.material = Array.isArray(o.material) ? fixed : fixed[0];
  });
  // textures that failed to decode (e.g. TIFF) would render black: drop them, keep the base colour
  obj.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m?.map && !(m.map.image && (m.map.image.width || m.map.image.data || m.map.image.videoWidth))) { m.map = null; m.needsUpdate = true; } }); });
  if (transparentFixed) warnings.push(`${transparentFixed} fully transparent material${transparentFixed > 1 ? 's were' : ' was'} made visible.`);
  if (broken.size) warnings.push(`Could not decode: ${[...broken].slice(0, 3).join(', ')} (use PNG or JPG textures).`);
}

/** Which axis points "up" in the raw file? Uses surface-normal area (floors/roofs face up) with per-format defaults. */
export function guessUp(obj, ext) {
  const s = [0, 0, 0]; obj.updateWorldMatrix(true, true); let total = 0;
  obj.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) total += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const stride = Math.max(1, Math.floor(total / 80000)); const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return; const g = o.geometry, pos = g.attributes.position, idx = g.index, cnt = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < cnt; t += stride) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      n.crossVectors(b.sub(a), c.sub(a)); const area = n.length() / 2; if (area < 1e-12) continue; n.divideScalar(area * 2);
      for (let k = 0; k < 3; k++) if (Math.abs(n.getComponent(k)) > 0.8) s[k] += area;
    }
  });
  const order = [0, 1, 2].sort((p, q) => s[q] - s[p]); const conf = s[order[1]] > 0 ? s[order[0]] / s[order[1]] : 99;
  const zDefault = ['stl', 'ply', '3mf', '3ds'].includes(ext);
  if (conf > 1.25 && s[order[0]] > 0) return ['x', 'y', 'z'][order[0]];
  return zDefault ? 'z' : 'y';
}
/** Guess file units: pick the unit that makes the model a plausible real-world size (height 2–12 m is typical for buildings). */
export function guessUnit(rawSize, up = 'y') {
  const r = Array.isArray(rawSize) ? rawSize : rawSize.toArray(); const mx = Math.max(...r), h = r[{ x: 0, y: 1, z: 2, nz: 2, ny: 1 }[up] ?? 1];
  const cands = [['m', 1], ['mm', 0.001], ['cm', 0.01], ['in', 0.0254]]; let best = 'm', bs = -1;
  for (const [u, f] of cands) { const M = mx * f, Hh = h * f; if (M > 600 || M < 0.05) continue; let sc = 0; if (Hh >= 2 && Hh <= 14) sc += 2; if (M >= 3 && M <= 120) sc += 1; else if (M >= 0.3 && M < 3) sc += 1; if (sc > bs) { bs = sc; best = u; } }
  return best;
}

/** Apply unit + up axis + yaw + mirror to a wrapper made by normalize() (or a clone of it), then centre it on the ground. */
export function orient(wrap, imp = {}) {
  const i = { unit: 'm', up: 'y', yaw: 0, flip: false, ground: true, ...(wrap.userData.imp || {}), ...imp }; const obj = wrap.children[0]; if (!obj) return i;
  const E = THREE.MathUtils; const q = new THREE.Quaternion();
  const upQ = { y: [0, 0, 0], z: [-Math.PI / 2, 0, 0], nz: [Math.PI / 2, 0, 0], x: [0, 0, Math.PI / 2], ny: [Math.PI, 0, 0] }[i.up] || [0, 0, 0];
  q.setFromEuler(new THREE.Euler(...upQ)); q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), E.degToRad(i.yaw || 0)));
  obj.position.set(0, 0, 0); obj.quaternion.copy(q); const k = UNITS[i.unit] ?? 1; obj.scale.set(k * (i.flip ? -1 : 1), k, k); wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true); if (box.isEmpty()) return i; const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, i.ground ? -box.min.y : -c.y, -c.z); wrap.updateMatrixWorld(true);
  if (wrap.userData.imported) wrap.userData.imported.size = box.getSize(new THREE.Vector3()).toArray();
  wrap.userData.imp = i; return i;
}

/** Wrap a freshly loaded object: stats, unit/up guess, initial orientation. */
export function normalize(obj, name, format, warnings = []) {
  const wrap = new THREE.Group(); wrap.name = name.replace(/\.[^.]+$/, ''); wrap.add(obj);
  let tris = 0, meshes = 0; const mats = new Set(), texs = new Set();
  obj.traverse(o => {
    if (o.isMesh || o.isPoints || o.isLine) {
      meshes++; o.castShadow = true; o.receiveShadow = true; const g = o.geometry; if (g?.attributes?.position) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m) return; mats.add(m); if (m.map) texs.add(m.map); });
    }
  });
  wrap.updateMatrixWorld(true); const raw = new THREE.Box3().setFromObject(obj);
  if (raw.isEmpty()) throw new Error('The file loaded but contains no visible geometry.');
  const ext = format.toLowerCase(); const rawSize = raw.getSize(new THREE.Vector3()); const mx = Math.max(rawSize.x, rawSize.y, rawSize.z);
  const up = guessUp(obj, ext); const guess = { up, unit: guessUnit(rawSize, up) };
  wrap.userData.imported = { name, format, tris: Math.round(tris), meshes, materials: mats.size, textures: texs.size, size: [0, 0, 0], rawSize: rawSize.toArray(), guess, clay: !!obj.userData.clay || obj.userData.hasMtl === false };
  orient(wrap, { unit: guess.unit, up: guess.up, yaw: 0, flip: false, ground: true }); wrap.userData.imp = { ...wrap.userData.imp };
  const sz = wrap.userData.imported.size;
  const hint = guess.unit !== 'm' ? { unit: guess.unit, text: `The file looks like ${UNIT_NAMES[guess.unit].toLowerCase()} (raw size ${mx.toFixed(0)} units) — scaled to ${sz.map(v => v.toFixed(1)).join(' × ')} m. Wrong? Change Units.` } : null;
  if (guess.up !== 'y') warnings.push(`Orientation: treated ${guess.up === 'z' ? 'Z' : guess.up.toUpperCase()} as up. If it looks lying down or upside-down, change "Up axis".`);
  return { object: wrap, name, format, stats: wrap.userData.imported, warnings, hint, guess };
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
