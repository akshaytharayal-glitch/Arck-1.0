// Catalog item viewer: live 3D preview + parameters + material + instructions + export. Used in the modal and on item.html.
import * as THREE from 'three';
import { Viewport } from '../engine/viewport.js';
import { build, getItem, defaults } from '../catalog/index.js';
import { restyle } from '../engine/restyle.js';
import { exportModel, downloadDataURL } from '../engine/exporter.js';
import { renderParams, materialPicker, esc } from './params.js';
import { icon } from './icons.js';
import { toast } from './chrome.js';

const CAT_LABEL = { shapes: 'Shape', structures: 'Structure', components: 'Component' };
export function studioLink(id, params, mat) {
  const q = new URLSearchParams({ add: id, p: JSON.stringify(params) }); if (mat) q.set('m', mat); return 'studio.html?' + q.toString();
}

export class ItemDetail {
  constructor(root, id, { mode = 'modal', onClose, onNavigate } = {}) {
    this.root = root; this.item = getItem(id); this.mode = mode; this.values = defaults(this.item); this.mat = null; this.onNavigate = onNavigate;
    const it = this.item; const related = it.cat && [...getRelated(it)].slice(0, 6);
    root.innerHTML = `
      <div class="m-view" data-view>${mode === 'modal' ? `<button class="btn ghost icon m-close" data-close aria-label="Close">${icon('close')}</button>` : ''}
        <div class="view-tools"><button class="chip" data-t="wire">${icon('wire')} Wireframe</button><button class="chip" data-t="person">${icon('hand')} Scale figure</button><button class="chip" data-t="spin">${icon('rotate')} Spin</button><button class="chip" data-t="sec">${icon('section')} Section</button></div>
        <div class="hint">Drag to orbit · scroll / pinch to zoom · right-drag or two fingers to pan</div></div>
      <div class="m-side">
        <div><span class="pill">${CAT_LABEL[it.cat]} · ${esc(it.group)}</span><h2 style="margin-top:8px">${esc(it.name)}</h2><p style="margin-top:6px">${esc(it.desc)}</p></div>
        <div class="how"><h4>How to use</h4><p>${esc(it.use)}</p><ol class="small" style="margin-top:8px"><li>Adjust the sliders (or type exact values in metres).</li><li>Pick a material to restyle it.</li><li>Press <b>Add to Studio</b> to place it in a scene, or download it as GLB / OBJ / STL.</li></ol></div>
        <div><h3 style="margin-bottom:8px;font-size:1rem">Parameters</h3><div data-params class="grid" style="gap:6px"></div></div>
        <div data-secbox hidden class="row"><span class="small muted">Cut axis</span><div class="seg" data-secaxis><button data-a="y" class="on">Plan</button><button data-a="x">Section X</button><button data-a="z">Section Z</button></div><input type="range" data-secpos style="flex:1;min-width:120px" min="0" max="1" step="0.01" value="0.5"></div>
        <div><h3 style="margin-bottom:8px;font-size:1rem">Main material</h3><div data-mats></div></div>
        <div class="stat small muted" data-stats></div>
        <div class="row" style="margin-top:auto;padding-top:6px"><a class="btn" data-add href="#">${icon('cube')} Add to Studio</a>
          <div class="seg" data-dl><button data-f="glb">GLB</button><button data-f="obj">OBJ</button><button data-f="stl">STL</button></div>
          <button class="btn ghost icon" data-shot title="Save picture" aria-label="Save picture">${icon('camera')}</button><button class="btn ghost icon" data-copy title="Copy link" aria-label="Copy link">${icon('link')}</button></div>
        ${related?.length ? `<div><h3 style="margin:10px 0 8px;font-size:1rem">Related</h3><div class="chips">${related.map(r => `<button class="chip" data-rel="${r.id}">${esc(r.name)}</button>`).join('')}</div></div>` : ''}
      </div>`;
    this.q = s => root.querySelector(s);
    this.vp = new Viewport(this.q('[data-view]'), { grid: 24, preserve: true }); this.vp.canvas.style.position = 'absolute'; this.vp.canvas.style.inset = '0';
    this.vp.controls.autoRotate = false; this.vp.controls.autoRotateSpeed = 1.6;
    this.holder = new THREE.Group(); this.vp.world.add(this.holder); this.figure = null; this.spin = false;
    this._rebuild(true);
    renderParams(this.q('[data-params]'), it, this.values, { prefix: 'ip-' + it.id, onInput: () => this._rebuild(false), onChange: () => this._rebuild(false) });
    this.pick = materialPicker(this.q('[data-mats]'), null, k => { this.mat = k ? { key: k } : null; this._rebuild(false); });
    this._wire();
  }
  _rebuild(first) {
    const old = this.obj; if (old) { this.holder.remove(old); old.traverse(o => o.geometry?.dispose()); }
    let o; try { o = build(this.item.id, this.values); } catch (e) { console.error(e); return; }
    if (this.mat) restyle(o, this.mat, false); this.obj = o; this.holder.add(o);
    const b = new THREE.Box3().setFromObject(o); this._bounds = b; const s = b.getSize(new THREE.Vector3());
    if (first) { this.vp.frame(o, 'iso'); this.vp.refit(o, 1.1); } else { const r = s.length(); if (!this._lastR || Math.abs(r - this._lastR) / this._lastR > 0.25) this.vp.refit(o, 1.1); }
    this._lastR = s.length(); this._placeFigure(); this._applySection();
    this.q('[data-stats]').innerHTML = `Size <b>${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} m</b> (W × H × D)`;
    this.q('[data-add]').href = studioLink(this.item.id, this.values, this.mat?.key); this.vp.invalidate();
  }
  _placeFigure() { if (!this.figure) return; const b = this._bounds; this.figure.position.set(b.max.x + 0.9, 0, (b.min.z + b.max.z) / 2); this.vp.invalidate(); }
  _applySection() { if (!this.secOn) { this.vp.setSection(false); return; } const b = this._bounds, ax = this.secAxis || 'y'; const lo = b.min[ax], hi = b.max[ax]; this.vp.setSection(true, ax, lo + (hi - lo) * (this.secPos ?? 0.5), false); }
  _wire() {
    const q = this.q;
    this.root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.t; b.classList.toggle('on');
      if (t === 'wire') this.vp.setMode(b.classList.contains('on') ? 'wire' : 'solid');
      if (t === 'spin') this.vp.controls.autoRotate = b.classList.contains('on');
      if (t === 'person') { if (b.classList.contains('on')) { this.figure = build('person'); this.vp.world.add(this.figure); this._placeFigure(); } else { this.vp.world.remove(this.figure); this.figure = null; } this.vp.invalidate(); }
      if (t === 'sec') { this.secOn = b.classList.contains('on'); q('[data-secbox]').hidden = !this.secOn; this._applySection(); }
    }));
    q('[data-secaxis]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.secAxis = b.dataset.a; q('[data-secaxis]').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); this._applySection(); });
    q('[data-secpos]').addEventListener('input', e => { this.secPos = +e.target.value; this._applySection(); });
    q('[data-dl]').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; try { await exportModel(this.obj, b.dataset.f, this.item.id); toast('Downloaded ' + this.item.id + '.' + b.dataset.f); } catch (err) { toast('Export failed: ' + err.message); } });
    q('[data-shot]').addEventListener('click', () => { downloadDataURL(this.item.id + '.png', this.vp.screenshot('image/png', 2)); });
    q('[data-copy]').addEventListener('click', async () => { const u = new URL('item.html', location.href); u.searchParams.set('id', this.item.id); try { await navigator.clipboard.writeText(u.href); toast('Link copied'); } catch { toast(u.href, 5000); } });
    this.root.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => this.onNavigate ? this.onNavigate(b.dataset.rel) : (location.href = 'item.html?id=' + b.dataset.rel)));
  }
  dispose() { this.vp.dispose(); this.root.innerHTML = ''; }
}

function getRelated(it) { return listSame(it).filter(x => x.id !== it.id); }
import { REGISTRY } from '../catalog/index.js';
function listSame(it) { return REGISTRY.filter(x => x.cat === it.cat && x.group === it.group); }
