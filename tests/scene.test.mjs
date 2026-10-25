import * as THREE from 'three';
import assert from 'node:assert/strict';
import { StudioScene } from '../js/studio/scene.js';
const vp = { world: new THREE.Group(), invalidate() {} };
const sc = new StudioScene(vp); sc.commit('init');
const a = sc.addCatalog('box', { w: 2, h: 3, d: 4 }, { pos: [1, 0, 1] });
assert.equal(sc.list.length, 1);
sc.addWall({ x: 0, z: 0 }, { x: 5, z: 0 }, { H: 3, T: 0.2, mat: 'brick' }); sc.commit('wall');
const w = sc.list[1]; assert.ok(Math.abs(w.userData.params.L - 5.2) < 1e-6);
w.updateMatrixWorld(true); const wb = new THREE.Box3().setFromObject(w); assert.ok(wb.max.x > 2.5 && wb.min.x < -0.05, 'wall spans x: ' + [wb.min.x, wb.max.x]); // along +x
// wall along +z direction
sc.addWall({ x: 0, z: 0 }, { x: 0, z: 4 }, { H: 3, T: 0.2 }); sc.commit('w2'); const w2 = sc.list[2]; w2.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(w2); assert.ok(b2.max.z > 3.9, 'z-wall extends +z ' + b2.max.z);
// undo / redo
sc.undo(); assert.equal(sc.list.length, 2); sc.undo(); assert.equal(sc.list.length, 1); sc.redo(); sc.redo(); assert.equal(sc.list.length, 3);
// param edit keeps transform
let b = sc.list[0]; b = sc.update(b, { params: { w: 6 } }); assert.deepEqual(b.position.toArray(), [1, 0, 1]); assert.equal(b.userData.params.w, 6);
const info = sc.entityInfo(b); assert.ok(Math.abs(info.vol - 6 * 3 * 4) < 1e-3, 'box volume ' + info.vol); assert.ok(Math.abs(info.size.x - 6) < 1e-6);
// material override
b = sc.update(b, { mat: { key: 'gold' } }); let k = null; b.traverse(o => o.isMesh && (k = o.userData.matKey)); assert.equal(k, 'gold');
// duplicate / group / ungroup / mirror / array
const d = sc.duplicate([b]); assert.equal(sc.list.length, 4);
const g = sc.group([b, d[0]]); assert.equal(g.userData.kind, 'group'); assert.equal(sc.list.length, 3);
sc.ungroup(g); assert.equal(sc.list.length, 4);
const before = sc.list.length; sc.mirror([sc.list[3]], 'x'); assert.equal(sc.list.length, before + 1);
const m = sc.list[sc.list.length - 1]; m.updateMatrixWorld(true); assert.ok(m.matrixWorld.determinant() < 0, 'mirror flips handedness');
sc.array([sc.list[0]], { count: 4, dx: 5 }); assert.equal(sc.list.length, before + 1 + 3);
sc.array([sc.list[0]], { count: 6, polar: true, around: new THREE.Vector3(0, 0, 0) });
// schedule
const s = sc.schedule(); assert.ok(s.tris > 0 && s.mats.length > 0 && s.total > 0); console.log('schedule', s.items.slice(0, 3).map(i => i.name + '×' + i.n), s.mats.slice(0, 3).map(m => m.name + ' ' + m.vol.toFixed(1) + 'm³'), 'cost', Math.round(s.total));
// undo restores through reuse
const n = sc.list.length; sc.undo(); sc.undo(); sc.redo(); sc.redo(); assert.equal(sc.list.length, n);
// layers
const id = sc.addLayer('Roof'); sc.meta_(sc.list[0], { layer: id }); sc.setLayerVisible(id, false); assert.equal(sc.list[0].visible, false); sc.undo(); sc.undo();
console.log('scene tests passed; entities', sc.list.length);
