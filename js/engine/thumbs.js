// Thumbnail renderer: one small shared WebGL context renders catalog items to cached PNG data URLs.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { build } from '../catalog/index.js';

let R, scene, cam, ready;
const cache = new Map(); const queue = []; let busy = false;
const SIZE = 256;

function init() {
  if (ready) return; ready = true;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setSize(SIZE, SIZE, false); R.setPixelRatio(1); R.setClearColor(0x000000, 0);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = false;
  scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.9; pm.dispose();
  scene.add(new THREE.HemisphereLight(0xfff2d0, 0x3a2e14, 0.7)); const d = new THREE.DirectionalLight(0xfff0d0, 2.2); d.position.set(5, 8, 6); scene.add(d);
  cam = new THREE.PerspectiveCamera(32, 1, 0.01, 2000);
}
export function renderObject(obj, size = SIZE) {
  init(); scene.add(obj); obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj); const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const rad = Math.max(0.01, s.length() / 2); const dist = rad / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.12;
  cam.position.copy(c).add(new THREE.Vector3(1, 0.75, 1.25).normalize().multiplyScalar(dist)); cam.lookAt(c); cam.near = dist / 100; cam.far = dist * 10; cam.updateProjectionMatrix();
  if (size !== SIZE) R.setSize(size, size, false); R.render(scene, cam); const url = R.domElement.toDataURL('image/png'); if (size !== SIZE) R.setSize(SIZE, SIZE, false); scene.remove(obj); return url;
}
function dispose(o) { o.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
export function thumb(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  return new Promise(res => { queue.push({ id, res }); pump(); });
}
function pump() {
  if (busy) return; const job = queue.shift(); if (!job) return; busy = true;
  const run = () => { try { const o = build(job.id); const url = renderObject(o); dispose(o); cache.set(job.id, url); job.res(url); } catch (e) { console.warn('thumb failed', job.id, e); job.res(''); } busy = false; setTimeout(pump, 0); };
  (window.requestIdleCallback || (f => setTimeout(f, 4)))(run, { timeout: 120 });
}
/** Fill <img>/.thumb placeholders lazily as they scroll into view. */
export function lazyThumbs(root = document) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const el = e.target; thumb(el.dataset.thumb).then(url => { if (url) el.innerHTML = `<img alt="" src="${url}">`; else el.textContent = '▢'; }); }), { rootMargin: '300px' });
  root.querySelectorAll('[data-thumb]').forEach(el => io.observe(el)); return io;
}
