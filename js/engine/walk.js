// First-person walkthrough: WASD / arrows to move, drag to look (desktop); left-half drag = move, right-half drag = look (touch).
import * as THREE from 'three';

export class Walk {
  constructor(vp) { this.vp = vp; this.on = false; this.yaw = 0; this.pitch = 0; this.keys = new Set(); this.eye = 1.65; this.speed = 2.6; this.touch = new Map(); this.mv = new THREE.Vector2(); this._bind(); }
  _bind() {
    const cv = this.vp.canvas;
    addEventListener('keydown', e => { if (!this.on) return; const t = e.target.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return; const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' ', 'c'].includes(k)) { this.keys.add(k); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()), true);
    cv.addEventListener('pointerdown', e => { if (!this.on) return; e.stopImmediatePropagation(); cv.setPointerCapture?.(e.pointerId); const r = cv.getBoundingClientRect(); const mode = e.pointerType === 'touch' && (e.clientX - r.left) < r.width / 2 ? 'move' : 'look'; this.touch.set(e.pointerId, { mode, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); }, true);
    cv.addEventListener('pointermove', e => { const t = this.touch.get(e.pointerId); if (!this.on || !t) return; e.stopImmediatePropagation(); const dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY; if (t.mode === 'look') { this.yaw -= dx * 0.0042; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0042, -1.4, 1.4); } else { this.mv.set(THREE.MathUtils.clamp((t.x - t.sx) / 60, -1, 1), THREE.MathUtils.clamp((t.y - t.sy) / 60, -1, 1)); } this.vp.invalidate(); }, true);
    const up = e => { if (this.on) e.stopImmediatePropagation(); const t = this.touch.get(e.pointerId); if (t?.mode === 'move') this.mv.set(0, 0); this.touch.delete(e.pointerId); }; cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
    cv.addEventListener('wheel', e => { if (!this.on) return; e.preventDefault(); e.stopImmediatePropagation(); this.vp.persp.fov = THREE.MathUtils.clamp(this.vp.persp.fov + e.deltaY * 0.03, 25, 85); this.vp.persp.updateProjectionMatrix(); this.vp.invalidate(); }, { capture: true, passive: false });
    this.vp.onFrame(() => this._tick());
  }
  start(from) {
    const vp = this.vp; if (vp.orthoOn) vp.setOrtho(false); this.on = true; vp.controls.enabled = false; this.saved = { fov: vp.persp.fov, pos: vp.camera.position.clone(), tgt: vp.controls.target.clone() };
    const c = from || vp.controls.target; const fwd = vp.controls.target.clone().sub(vp.camera.position); this.yaw = Math.atan2(-fwd.x, -fwd.z); this.pitch = 0;
    vp.camera.position.set(c.x, this.eye, c.z); vp.persp.fov = 62; vp.persp.updateProjectionMatrix(); vp.camera.rotation.order = 'YXZ'; vp.canvas.style.cursor = 'grab'; this._apply(); vp.invalidate();
  }
  stop() {
    if (!this.on) return; const vp = this.vp; this.on = false; this.keys.clear(); this.mv.set(0, 0); vp.persp.fov = this.saved.fov; vp.persp.updateProjectionMatrix(); vp.controls.enabled = true;
    const f = new THREE.Vector3(); vp.camera.getWorldDirection(f); vp.controls.target.copy(vp.camera.position).addScaledVector(f, Math.max(4, vp._R * 0.25)); vp.camera.position.y = Math.max(vp.camera.position.y, 3); vp.controls.update(); vp.canvas.style.cursor = ''; vp.invalidate();
  }
  _apply() { this.vp.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ'); }
  _tick() {
    if (!this.on) return; const now = performance.now(), dt = Math.min(0.05, (now - (this._t || now)) / 1000); this._t = now;
    const k = this.keys; let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) - this.mv.y, s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + this.mv.x;
    if (f || s || k.has(' ') || k.has('c')) {
      const v = this.speed * (k.has('shift') ? 2.4 : 1) * dt * Math.max(1, this.vp._R / 40), sin = Math.sin(this.yaw), cos = Math.cos(this.yaw); const cam = this.vp.camera;
      cam.position.x += (-sin * f + cos * s) * v; cam.position.z += (-cos * f - sin * s) * v; if (k.has(' ')) this.eye += v * 0.8; if (k.has('c')) this.eye = Math.max(0.4, this.eye - v * 0.8); cam.position.y = this.eye;
    } this._apply(); this.vp.invalidate();
  }
}
