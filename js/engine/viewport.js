// Reusable 3D viewport: renderer, cameras, orbit controls, lighting/sun, ground, render modes, section plane, screenshots.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeSkyTexture, makeBackground, SKIES } from './sky.js';
import { addEdges, removeEdges, edgeStyle } from './edges.js';
import { AO } from './post.js';
import { Walk } from './walk.js';

export const THEMES = {
  dark:  { bg: 0x120f08, ground: 0x2a2314, grid1: 0xd0a324, grid2: 0x4b3d16 },
  light: { bg: 0xeee8d8, ground: 0xd9d1bb, grid1: 0x8a6a10, grid2: 0xb9ad8a },
  sky:   { bg: 0xaed4ea, ground: 0xc9cdc6, grid1: 0x6f7568, grid2: 0xaab0a4 },
};

export class Viewport {
  constructor(container, opts = {}) {
    this.el = container; this.opts = opts;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: opts.antialias ?? true, alpha: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.coarse ? 1.75 : 2));
    this.renderer.shadowMap.enabled = opts.shadows !== false; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.localClippingEnabled = true;
    this.canvas = this.renderer.domElement; this.canvas.style.touchAction = 'none'; this.canvas.style.display = 'block';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.world = new THREE.Group(); this.world.name = 'world'; this.scene.add(this.world);   // user content
    this.helpers = new THREE.Group(); this.helpers.name = 'helpers'; this.scene.add(this.helpers); // gizmos etc.
    this.walk = null; this.ao = new AO(this.renderer); this.ao.on = opts.ao ?? false; this.envCache = {}; this.edgesOn = opts.edges ?? false; this._R = 10; this._lastR = 0;

    this.persp = new THREE.PerspectiveCamera(45, 1, 0.05, 4000); this.persp.position.set(14, 11, 16);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -2000, 4000);
    this.camera = this.persp; this.orthoOn = false;
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, maxPolarAngle: Math.PI * 0.499, screenSpacePanning: true, zoomSpeed: 1.0, zoomToCursor: true, minDistance: 0.02, maxDistance: 5e5, rotateSpeed: this.coarse ? 0.7 : 0.9 });
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.hemi = new THREE.HemisphereLight(0xfff4d8, 0x3a2e14, 0.55); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.0); this.sun.castShadow = this.renderer.shadowMap.enabled;
    const ss = this.coarse ? 1024 : 2048; this.sun.shadow.mapSize.set(ss, ss); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.sunAz = 40; this.sunEl = 48; this.shadowR = 30; this.setSun(this.sunAz, this.sunEl);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), new THREE.MeshStandardMaterial({ color: 0x2a2314, roughness: 1, metalness: 0 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.002; this.ground.receiveShadow = true; this.ground.userData.helper = true; this.scene.add(this.ground);
    this.grid = null; this.gridSize = 0; this.theme = 'dark'; this.setGrid(opts.grid ?? 60, 1);
    this.setTheme(opts.theme || 'dark');

    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100); this.clipOn = false;
    this.mode = 'solid'; this._modeMats = {};
    this.listeners = new Set(); this.dirty = true; this.running = true; this._raf = 0;
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.resize(); this._loop = this._loop.bind(this); this._raf = requestAnimationFrame(this._loop);
    this._onVis = () => { if (!document.hidden) this.invalidate(); }; document.addEventListener('visibilitychange', this._onVis);
  }
  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  invalidate() { this.dirty = true; }
  resize() {
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.persp.aspect = w / h; this.persp.updateProjectionMatrix(); this._fitOrtho(); this.invalidate();
  }
  _fitOrtho() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1, a = w / h;
    const dist = this.camera.position.distanceTo(this.controls.target) || 20; const half = this.orthoOn ? dist * Math.tan(THREE.MathUtils.degToRad(22.5)) : 10;
    this.ortho.left = -half * a; this.ortho.right = half * a; this.ortho.top = half; this.ortho.bottom = -half; this.ortho.updateProjectionMatrix();
  }
  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);
    const moved = this.controls.update();
    if (this.orthoOn && moved) this._fitOrtho();
    for (const fn of this.listeners) fn();
    if (this.dirty || moved) { this.dirty = false; this.render(); }
  }
  /** Keep near/far and fog sensible for any model size so zooming never clips or stalls. */
  _updateClip() {
    const now = performance.now(); if (now - this._lastR > 350) { this._lastR = now; const b = this.contentBounds(); this._R = Math.max(5, b.getSize(new THREE.Vector3()).length() / 2); }
    const dist = this.camera.position.distanceTo(this.controls.target), R = this._R;
    if (this.camera.isPerspectiveCamera) { const near = THREE.MathUtils.clamp(dist / 400, 0.004, 40), far = Math.max(dist + R * 6, near * 20000, 500); if (Math.abs(near - this.persp.near) > near * 0.05 || Math.abs(far - this.persp.far) > far * 0.05) { this.persp.near = near; this.persp.far = far; this.persp.updateProjectionMatrix(); } }
    else { const e = (dist + R * 6) * 2; if (this.ortho.far !== e) { this.ortho.near = -e; this.ortho.far = e; this.ortho.updateProjectionMatrix(); } }
    if (this.scene.fog) { this.scene.fog.near = Math.max(R * 6, 150); this.scene.fog.far = Math.max(R * 40, 900); }
    const sd = Math.max(120, R * 3.2); if (Math.abs(sd - (this._sd || 0)) > 5) { this._sd = sd; this.fitShadow(this.shadowR); this.setSun(this.sunAz, this.sunEl); }
  }
  render() {
    this._updateClip(); this.renderer.clippingPlanes = this.clipOn ? [this.clip] : [];
    if (this.ao.on && (this.mode === 'solid' || this.mode === 'clay')) { try { this.ao.render(this.scene, this.camera, this._R); } catch (e) { console.warn('AO disabled:', e); this.ao.on = false; this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera); } }
    else this.renderer.render(this.scene, this.camera);
  }
  /** Smoothly move the camera to a saved view {pos,target,ortho}. */
  flyTo(v, ms = 900) {
    if (this.walk?.on) this.walk.stop(); if (!!v.ortho !== this.orthoOn) this.setOrtho(!!v.ortho);
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone(), p1 = new THREE.Vector3(...v.pos), t1 = new THREE.Vector3(...v.target), st = performance.now(); cancelAnimationFrame(this._fly);
    const step = () => { const k = Math.min(1, (performance.now() - st) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; this.camera.position.lerpVectors(p0, p1, e); this.controls.target.lerpVectors(t0, t1, e); if (this.orthoOn) this._fitOrtho(); this.controls.update(); this.invalidate(); if (k < 1) this._fly = requestAnimationFrame(step); else this._fly = 0; };
    step(); return new Promise(r => setTimeout(r, ms));
  }
  cameraState() { return { pos: this.camera.position.toArray().map(x => +x.toFixed(3)), target: this.controls.target.toArray().map(x => +x.toFixed(3)), ortho: this.orthoOn }; }
  startWalk(from) { this.walk ||= new Walk(this); this.walk.start(from); }
  setAO(on) { this.ao.on = on; this.invalidate(); }
  dispose() { this.ao.dispose(); this.running = false; cancelAnimationFrame(this._raf); this._ro.disconnect(); document.removeEventListener('visibilitychange', this._onVis); this.controls.dispose(); this.renderer.dispose(); this.canvas.remove(); }

  // ----- environment
  setTheme(name) {
    const t = THEMES[name] || THEMES.dark; this.theme = name; const sk = SKIES[name] || SKIES.dark; this.bgCache ||= {};
    this.envCache[name] ||= makeSkyTexture(this.renderer, name); this.scene.environment = this.envCache[name]; this.scene.environmentIntensity = sk.env;
    this.scene.background = this.bgCache[name] ||= makeBackground(name); this.ground.material.color.setHex(t.ground);
    this.renderer.toneMappingExposure = sk.exposure * (this.expMul || 1); this.hemi.intensity = sk.hemi; this.sun.intensity = sk.sun;
    this.scene.fog = new THREE.Fog(new THREE.Color(sk.bgMid), 220, 900);
    if (this.grid) { this.grid.material.color?.setHex?.(t.grid1); this._recolorGrid(); }
    this.invalidate();
  }
  /** Outline overlay on/off (applies to everything in the world group + future decorate() calls). */
  setEdges(on) { this.edgesOn = on; if (on) addEdges(this.world); else removeEdges(this.world); this.invalidate(); }
  decorate(obj) { if (this.edgesOn) addEdges(obj); if (this._swapMat) obj.traverse(o => { if (o.isMesh && !o.userData.isEdges && !o.userData.helper) { o.userData._m ??= o.material; o.material = this._swapMat; } }); if (this.mode === 'wire' || this.mode === 'xray') this._edgeVis(false); }
  _recolorGrid() { const t = THEMES[this.theme]; if (!this.grid) return; this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.grid.material.color.setHex(t.grid2); if (this.grid.userData.main) this.grid.userData.main.material.color.setHex(t.grid1); }
  setGrid(size = 60, step = 1) {
    if (this.grid) { this.scene.remove(this.grid); this.grid.geometry.dispose(); }
    const gs = Math.max(2, Math.round(size / step) * step);
    this.grid = new THREE.GridHelper(gs, Math.round(gs / step), 0xd0a324, 0x4b3d16); this.grid.userData.helper = true; this.grid.position.y = 0.002; this.gridSize = gs; this.gridStep = step;
    const main = new THREE.GridHelper(gs, Math.max(1, Math.round(gs / (step * 5))), 0xd0a324, 0xd0a324); main.material.opacity = 0.28; main.material.transparent = true; main.position.y = 0.001; main.userData.helper = true; this.grid.add(main); this.grid.userData.main = main;
    this.scene.add(this.grid); this._recolorGrid(); this.invalidate();
  }
  showGrid(v) { if (this.grid) this.grid.visible = v; this.invalidate(); }
  showGround(v) { this.ground.visible = v; this.invalidate(); }
  setSun(az, el, intensity) {
    this.sunAz = az; this.sunEl = el; const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(Math.max(2, el)), d = 120;
    this.sun.position.set(Math.cos(e) * Math.sin(a) * d, Math.sin(e) * d, Math.cos(e) * Math.cos(a) * d).add(this.sun.target.position);
    if (intensity !== undefined) this.sun.intensity = intensity; const warm = THREE.MathUtils.clamp(el / 60, 0, 1); this.sun.color.setRGB(1, 0.72 + warm * 0.26, 0.5 + warm * 0.4); this.invalidate();
  }
  fitShadow(r) {
    r = Math.max(6, r); this.shadowR = r; const c = this.sun.shadow.camera; c.left = c.bottom = -r; c.right = c.top = r; c.near = 1; c.far = (this._sd || 120) * 2.4; c.updateProjectionMatrix(); this.invalidate();
  }
  setExposure(v) { this.expMul = v; this.renderer.toneMappingExposure = (SKIES[this.theme] || SKIES.dark).exposure * v; this.invalidate(); }
  setShadows(v) { this.sun.castShadow = v; this.renderer.shadowMap.enabled = v; this.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } }); this.invalidate(); }

  // ----- render modes
  setMode(mode) {
    this.mode = mode; const M = this._modeMats; this._restoreMats();
    const hideEdges = mode === 'wire' || mode === 'xray'; this._edgeVis(!hideEdges);
    if (mode === 'solid') this.scene.overrideMaterial = null;
    else if (mode === 'wire') this.scene.overrideMaterial = M.wire ??= new THREE.MeshBasicMaterial({ color: 0xd0a324, wireframe: true });
    else if (mode === 'xray') this.scene.overrideMaterial = M.xray ??= new THREE.MeshStandardMaterial({ color: 0xf3d36b, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 });
    else if (mode === 'clay') this.scene.overrideMaterial = null, this._swapMats(M.clay ??= new THREE.MeshStandardMaterial({ color: 0xd8d0bd, roughness: 0.95, metalness: 0 }));
    else if (mode === 'drawing') { this.scene.overrideMaterial = null; this._swapMats(M.draw ??= new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })); this._edgeStrength(1); if (!this.edgesOn) this.setEdges(true); }
    if (mode !== 'drawing') this._edgeStrength(0);
    this.invalidate();
  }
  /** Swap every mesh material (keeps edge lines untouched, unlike scene.overrideMaterial). */
  _swapMats(m) { this._swapped = true; this.world.traverse(o => { if (o.isMesh && !o.userData.isEdges && !o.userData.helper) { o.userData._m ??= o.material; o.material = m; } }); this._swapMat = m; }
  _restoreMats() { if (!this._swapped) return; this._swapped = false; this._swapMat = null; this.world.traverse(o => { if (o.userData._m) { o.material = o.userData._m; delete o.userData._m; } }); }
  _edgeVis(v) { this.world.traverse(o => { if (o.userData.isEdges) o.visible = v; }); }
  _edgeStrength(on) { edgeStyle(on); }

  // ----- section plane  (axis 'x'|'y'|'z', position in metres, flip)
  setSection(on, axis = 'y', pos = 1.5, flip = false) {
    this.clipOn = on; const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis]; const s = flip ? 1 : -1;
    this.clip.normal.set(n[0] * s, n[1] * s, n[2] * s); this.clip.constant = s === -1 ? pos : -pos; this.invalidate();
  }

  // ----- cameras
  setOrtho(on) {
    if (on === this.orthoOn) return; const old = this.camera, tgt = this.controls.target.clone();
    this.orthoOn = on; this.camera = on ? this.ortho : this.persp; this.camera.position.copy(old.position); this.camera.quaternion.copy(old.quaternion);
    this.controls.object = this.camera; this._fitOrtho(); this.controls.update(); this.invalidate();
  }
  setView(name, bounds) {
    const b = bounds || this.contentBounds(); const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z, 2) * 1.0;
    const dirs = { top: [0, 1, 0.0001], front: [0, 0.0001, 1], back: [0, 0.0001, -1], left: [-1, 0.0001, 0], right: [1, 0.0001, 0], iso: [1, 0.8, 1.15] }; const d = new THREE.Vector3(...(dirs[name] || dirs.iso)).normalize();
    const fov = THREE.MathUtils.degToRad(this.persp.fov), dist = (r / 2) / Math.tan(fov / 2) * 1.35 + r * 0.4;
    this.controls.target.copy(c); this.camera.position.copy(c).addScaledVector(d, dist);
    if (this.orthoOn) this._fitOrtho(); this.controls.update(); this.invalidate();
  }
  contentBounds(obj = this.world) {
    const b = new THREE.Box3(); obj.updateWorldMatrix(true, true);
    obj.traverse(o => { if (o.isMesh && !o.userData.helper && o.visible) b.expandByObject(o); });
    if (b.isEmpty()) b.set(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 3, 3)); return b;
  }
  frame(obj, view = 'iso') { const b = obj ? new THREE.Box3().setFromObject(obj) : this.contentBounds(); if (b.isEmpty()) return; this.setView(view, b); this.fitShadow(b.getSize(new THREE.Vector3()).length() * 0.8); this.sun.target.position.copy(b.getCenter(new THREE.Vector3())).setY(0); this.setSun(this.sunAz, this.sunEl); }
  /** Re-fit the camera distance to `obj` while keeping the current viewing direction. */
  refit(obj, pad = 1.0) {
    const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() * 0.5 * pad;
    const dir = this.camera.position.clone().sub(this.controls.target); if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1.15); dir.normalize();
    const dist = Math.max(r, 0.5) / Math.sin(THREE.MathUtils.degToRad(this.persp.fov / 2)) * 0.9; this.controls.target.copy(c); this.camera.position.copy(c).addScaledVector(dir, dist); this._lastR = 0;
 this.fitShadow(r * 1.4); this.sun.target.position.set(c.x, 0, c.z); this.setSun(this.sunAz, this.sunEl); if (this.orthoOn) this._fitOrtho(); this.controls.update(); this.invalidate();
  }
  screenshot(type = 'image/png', scale = 1) {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (scale !== 1) { this.renderer.setPixelRatio(scale); this.renderer.setSize(w, h, false); }
    this.render(); const url = this.canvas.toDataURL(type, 0.92);
    if (scale !== 1) { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.coarse ? 1.75 : 2)); this.renderer.setSize(w, h, false); this.invalidate(); }
    return url;
  }
  /** Ray-pick against world meshes. ndc from client coords. */
  pick(clientX, clientY, objs = this.world.children, recursive = true) {
    const r = this.canvas.getBoundingClientRect(); const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera); rc.params.Line = { threshold: 0.1 };
    const hits = rc.intersectObjects(objs, recursive).filter(h => !h.object.userData.helper && h.object.visible && (!this.clipOn || this.clip.distanceToPoint(h.point) >= 0));
    return { hits, ray: rc.ray };
  }
  /** Intersect ray with ground plane y = h */
  groundPoint(clientX, clientY, h = 0) {
    const { ray } = this.pick(clientX, clientY, []); const p = new THREE.Vector3(); return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p) ? p : null;
  }
}
