// Catalog entry: importing this registers every item. Use getItem / build / listByCat.
import './shapes.js';
import './structures.js';
import './structures2.js';
import './components.js';
import './components2.js';
import { REGISTRY, defaults } from './kit.js';
import { THREE } from './kit.js';

export { REGISTRY, defaults };
export const getItem = id => REGISTRY.find(i => i.id === id);
export const listByCat = cat => REGISTRY.filter(i => i.cat === cat);
export function groupsOf(cat) {
  const m = new Map(); for (const i of listByCat(cat)) { if (!m.has(i.group)) m.set(i.group, []); m.get(i.group).push(i); } return [...m.entries()];
}
/** Build an Object3D for an item with params (missing keys fall back to defaults). */
export function build(id, params = {}) {
  const item = getItem(id); if (!item) throw new Error('Unknown item ' + id);
  const p = { ...defaults(item), ...params };
  for (const d of item.params) if (!d.type && typeof p[d.k] === 'string') p[d.k] = parseFloat(p[d.k]);
  let obj = item.build(p);
  if (!obj.isGroup) { const g = new THREE.Group(); g.add(obj); obj = g; }
  obj.userData.catalogId = id; obj.userData.params = p;
  return obj;
}
