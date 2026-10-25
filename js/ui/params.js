// Parameter sliders + material picker used by the catalog pages and the Studio.
import { MATERIALS } from '../engine/materials.js';

const dec = step => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Render controls for item.params into `el`. values is mutated. onInput = live, onChange = on release. */
export function renderParams(el, item, values, { onInput, onChange, prefix = 'p' } = {}) {
  const rows = item.params.map(p => {
    const id = `${prefix}-${p.k}`;
    if (p.type === 'select') return `<div class="prm sel"><label for="${id}">${esc(p.label)}</label><select id="${id}" data-k="${p.k}">${p.options.map(([v, l]) => `<option value="${esc(v)}" ${String(values[p.k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    if (p.type === 'check') return `<div class="prm chk"><label for="${id}">${esc(p.label)}</label><input type="checkbox" id="${id}" data-k="${p.k}" ${values[p.k] ? 'checked' : ''}></div>`;
    const d = dec(p.step); const v = values[p.k];
    return `<div class="prm"><label for="${id}">${esc(p.label)}</label><input type="range" id="${id}" data-k="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}"><input type="number" class="num" data-n="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${(+v).toFixed(d)}" aria-label="${esc(p.label)} value"></div>`;
  });
  el.innerHTML = rows.join('');
  const byK = k => item.params.find(p => p.k === k);
  const read = (t, k) => { const p = byK(k); if (p.type === 'select') return t.value; if (p.type === 'check') return t.checked ? 1 : 0; return parseFloat(t.value); };
  el.oninput = e => {
    const t = e.target, k = t.dataset.k || t.dataset.n; if (!k) return; const p = byK(k); let v = read(t, k);
    if (t.dataset.n && !Number.isFinite(v)) return; if (!p.type) { v = Math.min(p.max, Math.max(p.min, v)); if (t.dataset.k) { const n = el.querySelector(`[data-n="${k}"]`); if (n) n.value = v.toFixed(dec(p.step)); } else if (e.type === 'input') { /* typing: wait for change */ return; } }
    values[k] = v; onInput?.(values, k);
  };
  el.onchange = e => {
    const t = e.target, k = t.dataset.k || t.dataset.n; if (!k) return; const p = byK(k); let v = read(t, k);
    if (!p.type) { if (!Number.isFinite(v)) v = p.v; v = Math.min(p.max, Math.max(p.min, v)); const r = el.querySelector(`[data-k="${k}"]`), n = el.querySelector(`[data-n="${k}"]`); if (r) r.value = v; if (n) n.value = v.toFixed(dec(p.step)); }
    values[k] = v; onInput?.(values, k); onChange?.(values, k);
  };
}

export const SWATCH = { gold: '#d0a324', brass: '#b5893a', concrete: '#b9b7b1', plaster: '#efe9dc', brick: '#a8472f', stone: '#aaa59a', marble: '#eceae4', wood: '#b98a55', darkwood: '#6b4a30', bamboo: '#cdb869', tile: '#e6e2d8', roof: '#b4533a', slate: '#4a505a', terracotta: '#c06a45', glass: '#9fd6ee', steel: '#8e949c', aluminium: '#c7ccd2', copper: '#b8663a', vermilion: '#c0392b', black: '#1c1c1e', grass: '#4c8a3c', foliage: '#3f7d3a', sand: '#d8c38f', asphalt: '#3a3a3d', water: '#3d8fc4', fabric: '#7a8aa8', skin: '#d9c3a0', paint: '#a62b2b', warm: '#fff1b8' };

/** Swatch grid. onPick(key|null). `allowNone` adds a “Default” chip. */
export function materialPicker(el, current, onPick, { allowNone = true, only } = {}) {
  const keys = (only || Object.keys(MATERIALS)).filter(k => k !== 'skin' && k !== 'paint' && k !== 'warm');
  el.classList.add('swatches');
  el.innerHTML = (allowNone ? `<button type="button" class="sw none ${!current ? 'on' : ''}" data-k="" title="Original material"><span>Auto</span></button>` : '') + keys.map(k => `<button type="button" class="sw ${current === k ? 'on' : ''}" data-k="${k}" title="${esc(MATERIALS[k].name)}" aria-label="${esc(MATERIALS[k].name)}" style="--c:${SWATCH[k] || MATERIALS[k].color}"></button>`).join('');
  el.onclick = e => { const b = e.target.closest('.sw'); if (!b) return; el.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.k || null); };
  return { set(k) { el.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', (x.dataset.k || null) === k)); } };
}
export { esc };
