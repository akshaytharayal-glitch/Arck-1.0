// Studio extras: drawing-sheet export, camera bookmarks / tour, isolate, walkthrough HUD.
import * as THREE from 'three';
import { downloadDataURL } from '../engine/exporter.js';
import { toast } from '../ui/chrome.js';

const NICE = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000, 2000, 5000, 10000];

/** A3 landscape drawing sheet: border, title block, scale bar and north arrow around the current view. */
export function exportSheet(ctx, { title } = {}) {
  const { vp, sc } = ctx; const W = 3508, H = 2480, M = 110, TB = 330; // A3 @ 300 dpi
  const hud = vp.helpers.visible; vp.helpers.visible = false; ctx.tools.tcHelper.visible = false; vp.invalidate();
  const url = vp.screenshot('image/png', Math.min(3, Math.max(1.5, (W - 2 * M) / (vp.el.clientWidth || 1000))));
  vp.helpers.visible = hud; ctx.tools.tcHelper.visible = true; vp.invalidate();
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(M / 2, M / 2, W - M, H - M); g.lineWidth = 2; g.strokeRect(M, M, W - 2 * M, H - 2 * M - TB);
    const aw = W - 2 * M - 4, ah = H - 2 * M - TB - 4, k = Math.min(aw / img.width, ah / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, M + 2 + (aw - iw) / 2, M + 2 + (ah - ih) / 2, iw, ih);
    // scale: only meaningful for orthographic views
    let scaleTxt = 'NTS (perspective)', barM = 0, pxPerM = 0;
    if (vp.orthoOn) { const viewH = vp.ortho.top - vp.ortho.bottom; const mPerPaperMm = (viewH / ih) * (300 / 25.4); const raw = mPerPaperMm * 1000; const n = NICE.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a); scaleTxt = '1 : ' + n; pxPerM = ih / viewH; const target = (W * 0.12) / pxPerM; const pow = Math.pow(10, Math.floor(Math.log10(target))); barM = [1, 2, 5].map(m => m * pow).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a); }
    const y0 = H - M - TB; g.fillStyle = '#000'; g.font = '600 54px system-ui, sans-serif'; g.textBaseline = 'top';
    g.beginPath(); g.moveTo(M, y0); g.lineTo(W - M, y0); g.stroke();
    const col = [M, M + 1500, M + 2400]; col.slice(1).forEach(x => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, H - M); g.stroke(); });
    g.font = '700 86px Georgia, serif'; g.fillText((title || sc.name || 'Untitled project').slice(0, 34), col[0] + 40, y0 + 36);
    g.font = '400 44px system-ui, sans-serif'; g.fillStyle = '#333'; g.fillText('Drawn with ARCK Studio · units: metres', col[0] + 40, y0 + 160);
    g.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), col[0] + 40, y0 + 225);
    g.fillStyle = '#000'; g.font = '600 40px system-ui'; g.fillText('SCALE', col[1] + 40, y0 + 36); g.font = '700 100px system-ui'; g.fillText(scaleTxt, col[1] + 40, y0 + 90);
    g.font = '600 40px system-ui'; g.fillText('VIEW', col[2] + 40, y0 + 36); g.font = '700 70px system-ui'; g.fillText(ctx.viewName?.() || (vp.orthoOn ? 'Orthographic' : 'Perspective'), col[2] + 40, y0 + 100); g.font = '400 36px system-ui'; g.fillStyle = '#444'; g.fillText('Sheet A3 · 420 × 297 mm', col[2] + 40, y0 + 210);
    if (barM) { const bx = M + 60, by = y0 - 90, bl = barM * pxPerM; g.fillStyle = '#000'; for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(bx + i * bl / 4, by, bl / 4, 22); } g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(bx, by, bl, 22); g.fillStyle = '#000'; g.font = '36px system-ui'; g.fillText('0', bx - 6, by + 30); g.fillText(barM + ' m', bx + bl - 30, by + 30); }
    if (vp.orthoOn && Math.abs(vp.camera.position.x - vp.controls.target.x) < 0.01 && vp.camera.position.y > vp.controls.target.y + 1) { const nx = W - M - 120, ny = M + 150; g.fillStyle = '#000'; g.beginPath(); g.moveTo(nx, ny - 90); g.lineTo(nx + 36, ny + 40); g.lineTo(nx, ny + 15); g.lineTo(nx - 36, ny + 40); g.closePath(); g.fill(); g.font = '700 64px system-ui'; g.textAlign = 'center'; g.fillText('N', nx, ny + 55); g.textAlign = 'left'; }
    downloadDataURL((sc.name || 'arck-sheet').replace(/\W+/g, '-') + '-sheet.png', c.toDataURL('image/png')); toast('Drawing sheet saved (A3, 300 dpi)');
  }; img.src = url;
}

export function initExtras(ctx) {
  const { vp, sc, tools } = ctx;
  sc.views ||= [];
  ctx.saveView = (name) => { const v = { name: name || 'View ' + (sc.views.length + 1), ...vp.cameraState() }; sc.views.push(v); sc.emit('views'); sc._autosave(); return v; };
  ctx.goView = i => { const v = sc.views[i]; if (v) return vp.flyTo(v); };
  ctx.delView = i => { sc.views.splice(i, 1); sc.emit('views'); sc._autosave(); };
  ctx.tour = async () => { if (!sc.views.length) return toast('Save a few views first'); ctx.touring = true; document.body.classList.add('touring'); for (let i = 0; i < sc.views.length && ctx.touring; i++) { await vp.flyTo(sc.views[i], 1800); await new Promise(r => setTimeout(r, 1200)); } ctx.touring = false; document.body.classList.remove('touring'); };
  ctx.stopTour = () => { ctx.touring = false; };
  // isolate: temporarily hide everything except the selection
  ctx.isolate = () => {
    if (ctx._iso) { ctx._iso.forEach(e => { e.visible = true; }); ctx._iso = null; sc.list.forEach(e => sc._applyVis(e)); vp.invalidate(); toast('Showing everything'); return; }
    const s = sc.sel; if (!s.length) return toast('Select something to isolate'); ctx._iso = sc.list.filter(e => !s.includes(e) && e.visible); ctx._iso.forEach(e => { e.visible = false; }); vp.invalidate(); toast('Isolated — press I again to show all');
  };
  // walkthrough
  const hud = document.createElement('div'); hud.className = 'walk-hud'; hud.hidden = true; hud.innerHTML = '<b>Walk mode</b><span>W A S D move · drag to look · Shift run · Space/C eye height · wheel zoom</span><button class="btn sm" id="walkExit">Exit (Esc)</button>'; vp.el.appendChild(hud);
  const exit = () => { vp.walk?.stop(); hud.hidden = true; document.body.classList.remove('walking'); };
  hud.querySelector('#walkExit').onclick = exit;
  ctx.walk = () => { if (vp.walk?.on) return exit(); tools.setTool('select'); sc.clearSel(); const c = sc.list.length ? new THREE.Box3().setFromObject(sc.world).getCenter(new THREE.Vector3()) : null; const b = sc.list.length ? new THREE.Box3().setFromObject(sc.world) : null; vp.startWalk(b ? new THREE.Vector3(b.max.x + 3, 0, b.max.z + 3) : null); hud.hidden = false; document.body.classList.add('walking'); toast('Walk mode — Esc to exit', 3000); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && vp.walk?.on) { exit(); e.stopImmediatePropagation(); } if (e.key === 'Escape' && ctx.touring) ctx.stopTour(); }, true);
  ctx.exportSheet = () => exportSheet(ctx);
  ctx.viewName = () => { const d = vp.camera.position.clone().sub(vp.controls.target); if (!vp.orthoOn) return 'Perspective'; const a = d.clone().normalize(); if (a.y > 0.99) return 'Plan (top)'; if (Math.abs(a.z) > 0.99) return a.z > 0 ? 'Front elevation' : 'Back elevation'; if (Math.abs(a.x) > 0.99) return a.x > 0 ? 'Right elevation' : 'Left elevation'; return 'Axonometric'; };
}
