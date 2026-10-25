// Node resolver so catalog code can import 'three' and 'three/addons/*' from ./vendor
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../vendor/three');
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(path.join(root, 'build/three.module.js')).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: pathToFileURL(path.join(root, 'addons', spec.slice(13))).href, shortCircuit: true };
  return next(spec, ctx);
}
