import * as THREE from 'three';
import { StudioScene } from '../js/studio/scene.js';
import { TEMPLATES } from '../js/studio/templates.js';
for (const t of TEMPLATES) {
  const vp = { world: new THREE.Group(), invalidate() {} }; const sc = new StudioScene(vp); sc.commit('init');
  try { t.run(sc); sc.commit('t'); const s = sc.schedule(); console.log(t.id.padEnd(8), sc.list.length + ' entities', Math.round(s.tris / 1000) + 'k tris'); } catch (e) { console.log('FAIL', t.id, e.stack.split('\n').slice(0, 3).join(' | ')); process.exitCode = 1; }
}
