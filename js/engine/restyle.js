// Re-skin an object's "main" material (catalog items) or every mesh (imported models).
import { getMaterial, boxUV } from './materials.js';
import { measureObject } from './geom.js';

/** mat = { key?, color? }. For catalog content only the dominant (largest-area, non-glass) material is replaced. */
export function restyle(content, mat, isImport = false) {
  if (!mat || (!mat.key && !mat.color)) return;
  let target = null;
  if (!isImport) { let best = -1; const m = measureObject(content); for (const [k, v] of Object.entries(m.byMat)) if (v.area > best && k !== 'glass') { best = v.area; target = k; } }
  content.traverse(o => {
    if (!o.isMesh || o.userData.helper) return;
    if (!isImport && o.userData.matKey !== target) return;
    const key = mat.key || o.userData.matKey || 'concrete'; const mm = getMaterial({ key, color: mat.color, noTex: isImport });
    if (isImport) o.userData.origMat ??= o.material;
    o.material = mm; o.userData.matKey = key;
    if (!isImport && mm.map && !o.geometry.userData.boxUV) { boxUV(o.geometry, mm.userData.texSize); o.geometry.userData.boxUV = true; }
  });
}
