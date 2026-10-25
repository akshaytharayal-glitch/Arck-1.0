// Export the current model: GLB, OBJ, STL, PLY, PNG screenshot, JSON project.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';

export function download(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function downloadDataURL(name, url) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }

/** Clone `root` without helpers/hidden objects so exports are clean. */
function cleanClone(root) {
  const c = root.clone(true); const kill = [];
  c.traverse(o => { if (o.userData?.helper || o.visible === false) kill.push(o); }); kill.forEach(o => o.parent?.remove(o));
  c.updateMatrixWorld(true); return c;
}
export async function exportModel(root, fmt, baseName = 'arck-model') {
  const obj = cleanClone(root);
  if (fmt === 'glb') { const buf = await new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: true }); download(baseName + '.glb', buf, 'model/gltf-binary'); }
  else if (fmt === 'gltf') { const js = await new GLTFExporter().parseAsync(obj, { binary: false, onlyVisible: true }); download(baseName + '.gltf', JSON.stringify(js), 'model/gltf+json'); }
  else if (fmt === 'obj') download(baseName + '.obj', new OBJExporter().parse(obj), 'text/plain');
  else if (fmt === 'stl') download(baseName + '.stl', new STLExporter().parse(obj, { binary: true }), 'model/stl');
  else if (fmt === 'ply') download(baseName + '.ply', await new Promise(r => new PLYExporter().parse(obj, r, { binary: true })), 'application/octet-stream');
  else throw new Error('Unknown format ' + fmt);
}
