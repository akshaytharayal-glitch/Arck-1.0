// Builds every catalog item with defaults, then with min/max of each numeric param, and checks geometry sanity.
import * as THREE from 'three';
import { REGISTRY, build, defaults } from '../js/catalog/index.js';
import { measureObject } from '../js/engine/geom.js';
let fail = 0, n = 0; const t0 = Date.now();
function check(id, params, label) {
  n++;
  try {
    const o = build(id, params); const m = measureObject(o);
    if (!m.tris) throw new Error('no triangles');
    const s = m.box.getSize(new THREE.Vector3());
    if (![s.x, s.y, s.z].every(Number.isFinite)) throw new Error('NaN size');
    if (Math.max(s.x, s.y, s.z) < 0.01) throw new Error('degenerate size ' + s.toArray());
    let bad = false; o.traverse(c => { if (c.isMesh) { const a = c.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 97) if (!Number.isFinite(a[i])) bad = true; } }); if (bad) throw new Error('NaN vertices');
    const item = REGISTRY.find(i => i.id === id);
    if (item.solid && m.vol < 0) throw new Error('negative volume');
  } catch (e) { fail++; console.log('FAIL', id, label, e.message.split('\n')[0]); }
}
for (const it of REGISTRY) {
  check(it.id, {}, 'defaults');
  for (const p of it.params) if (!p.type) for (const [lab, v] of [['min', p.min], ['max', p.max]]) check(it.id, { ...defaults(it), [p.k]: v }, `${p.k}=${lab}(${v})`);
}
const ids = new Set(); for (const it of REGISTRY) { if (ids.has(it.id)) { fail++; console.log('DUP', it.id); } ids.add(it.id); if (!it.desc || !it.use) { fail++; console.log('NO TEXT', it.id); } }
const by = {}; REGISTRY.forEach(i => by[i.cat] = (by[i.cat] || 0) + 1);
console.log(`${REGISTRY.length} items`, by, `${n} builds in ${Date.now() - t0}ms; failures: ${fail}`);
process.exit(fail ? 1 : 0);
