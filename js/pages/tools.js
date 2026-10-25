// Architect's calculators with optional live 3D previews.
import * as THREE from 'three';
import { pageInit } from '../ui/chrome.js';
import { icon } from '../ui/icons.js';
import { Viewport } from '../engine/viewport.js';
import { build } from '../catalog/index.js';
import { sunPosition, dateFrom } from '../studio/sun.js';
import { esc } from '../ui/params.js';
pageInit('tools');
const $ = s => document.querySelector(s);
const f = (v, d = 2) => Number.isFinite(v) ? (+v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';
const R = (label, v) => `<div class="row2"><span>${label}</span><span>${v}</span></div>`;
const badge = (ok, t) => `<span class="${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✖'} ${t}</span>`;

// Each tool: fields [key,label,default,step,unit?] or select; calc(v) -> {big, rows, note, preview:{id,params}}
const TOOLS = [
  { id: 'stairs', name: 'Stairs', ic: 'tools', intro: 'Comfortable stairs follow Blondel\'s rule: 2 × riser + tread ≈ 600–650 mm. Most codes cap risers at ~190 mm and need treads ≥ 250 mm.',
    fields: [['H', 'Floor-to-floor height (m)', 3, 0.05], ['n', 'Number of steps', 17, 1], ['run', 'Tread depth (m)', 0.28, 0.01], ['w', 'Width (m)', 1.2, 0.05]],
    calc: v => { const r = v.H / v.n, b = 2 * r + v.run, ideal = Math.round(v.H / 0.17); return { big: `${f(r * 1000, 0)} mm riser`, rows: [R('Tread', f(v.run * 1000, 0) + ' mm'), R('Blondel 2R+T', f(b * 1000, 0) + ' mm ' + badge(b >= 0.59 && b <= 0.65, '600–650')), R('Riser ≤ 190 mm', badge(r <= 0.19, f(r * 1000, 0) + ' mm')), R('Tread ≥ 250 mm', badge(v.run >= 0.25, f(v.run * 1000, 0) + ' mm')), R('Total going', f(v.run * (v.n - 1)) + ' m'), R('Incline', f(Math.atan(r / v.run) * 57.2958, 1) + '°'), R('Suggested steps', ideal)], preview: { id: 'stairs-straight', params: { H: v.H, n: v.n, run: v.run, w: v.w } } }; } },
  { id: 'roof', name: 'Roof pitch', ic: 'house', intro: 'Pitch is rise over run. Tiles need ~22–45°, metal sheet can go as low as 5°. Rafter length is measured along the slope.',
    fields: [['span', 'Building width (m)', 8, 0.1], ['rise', 'Roof rise (m)', 2.6, 0.05], ['ov', 'Overhang (m)', 0.5, 0.05], ['D', 'Building length (m)', 10, 0.5]],
    calc: v => { const half = v.span / 2, ang = Math.atan2(v.rise, half), rf = Math.hypot(half + v.ov, (half + v.ov) * v.rise / half); return { big: `${f(ang * 57.2958, 1)}° pitch`, rows: [R('Ratio (rise : run)', `${f(v.rise / half, 2)} : 1`), R('Slope', f(v.rise / half * 100, 0) + ' %'), R('Rafter length', f(rf) + ' m'), R('Roof surface', f(rf * 2 * (v.D + 2 * v.ov)) + ' m²'), R('Attic volume', f(v.span * v.rise / 2 * v.D) + ' m³')], preview: { id: 'roof-gable', params: { W: v.span, D: v.D, rise: v.rise, ov: v.ov } } }; } },
  { id: 'ramp', name: 'Ramp', ic: 'select', intro: 'Accessible ramps are usually 1:12 (8.3 %) or gentler, with landings every 760 mm of rise. Steeper ramps are only for vehicles and service.',
    fields: [['H', 'Rise (m)', 0.9, 0.05], ['L', 'Ramp length (m)', 10.8, 0.1], ['w', 'Width (m)', 1.5, 0.1]],
    calc: v => { const s = v.H / v.L; return { big: `1 : ${f(1 / s, 1)}  (${f(s * 100, 1)} %)`, rows: [R('Angle', f(Math.atan(s) * 57.2958, 1) + '°'), R('Accessible (≤ 1:12)', badge(s <= 1 / 12 + 1e-6, s <= 1 / 12 + 1e-6 ? 'compliant' : 'too steep')), R('Min. length for 1:12', f(v.H * 12) + ' m'), R('Landings needed', Math.max(0, Math.ceil(v.H / 0.76) - 1))], preview: { id: 'ramp', params: { H: v.H, L: v.L, w: v.w } } }; } },
  { id: 'arch', name: 'Segmental arch', ic: 'arch', intro: 'A segmental arch is a slice of a circle. The radius follows from the span and rise: R = (s²/4 + r²) / 2r. Lower rise ⇒ bigger sideways thrust.',
    fields: [['span', 'Span (m)', 6, 0.1], ['rise', 'Rise (m)', 1.5, 0.05]],
    calc: v => { const R_ = (v.span * v.span / 4 + v.rise * v.rise) / (2 * v.rise), th = 2 * Math.asin(Math.min(1, v.span / 2 / R_)); return { big: `Radius ${f(R_)} m`, rows: [R('Centre below springing', f(R_ - v.rise) + ' m'), R('Included angle', f(th * 57.2958, 1) + '°'), R('Arc length', f(R_ * th) + ' m'), R('Rise / span', f(v.rise / v.span, 3)), R('Thrust per load', f(v.span / (8 * v.rise), 2) + ' × w·span')], note: 'Horizontal thrust H = w·span² / 8·rise for a uniform load — double the rise, halve the thrust.', preview: { id: 'arch-segmental', params: { span: v.span, rise: v.rise } } }; } },
  { id: 'volume', name: 'Area & volume', ic: 'shapes', intro: 'Surface area and volume of basic solids — handy for material and heating estimates.',
    fields: [['k', 'Shape', 'box', null, [['box', 'Box'], ['cylinder', 'Cylinder'], ['sphere', 'Sphere'], ['cone', 'Cone']]], ['a', 'Width / diameter (m)', 4, 0.1], ['b', 'Depth (m, box only)', 3, 0.1], ['h', 'Height (m)', 3, 0.1]],
    calc: v => { let V, A, id, p; const a = v.a, h = v.h, r = a / 2; if (v.k === 'box') { V = a * v.b * h; A = 2 * (a * v.b + a * h + v.b * h); id = 'box'; p = { w: a, h, d: v.b }; } else if (v.k === 'cylinder') { V = Math.PI * r * r * h; A = 2 * Math.PI * r * (r + h); id = 'cylinder'; p = {}; } else if (v.k === 'sphere') { V = 4 / 3 * Math.PI * r ** 3; A = 4 * Math.PI * r * r; id = 'sphere'; p = {}; } else { const sl = Math.hypot(r, h); V = Math.PI * r * r * h / 3; A = Math.PI * r * (r + sl); id = 'cone'; p = {}; } return { big: `${f(V)} m³`, rows: [R('Surface area', f(A) + ' m²'), R('Volume', f(V) + ' m³'), R('Litres', f(V * 1000, 0)), R('Concrete mass (2400 kg/m³)', f(V * 2.4) + ' t')], preview: { id, params: p, scaleTo: v } }; } },
  { id: 'concrete', name: 'Concrete', ic: 'cube', intro: 'Slab or footing quantities with waste. A 1:2:4 mix by volume needs roughly 7 bags of 50 kg cement per m³.',
    fields: [['L', 'Length (m)', 6, 0.1], ['W', 'Width (m)', 5, 0.1], ['T', 'Thickness (m)', 0.15, 0.01], ['waste', 'Waste (%)', 8, 1]],
    calc: v => { const V = v.L * v.W * v.T, Vw = V * (1 + v.waste / 100); return { big: `${f(Vw)} m³ to order`, rows: [R('Net volume', f(V) + ' m³'), R('Cement (50 kg bags)', f(Vw * 7, 0)), R('Sand', f(Vw * 0.45) + ' m³'), R('Aggregate', f(Vw * 0.9) + ' m³'), R('Weight', f(Vw * 2.4) + ' t'), R('Area', f(v.L * v.W) + ' m²')], preview: { id: 'slab', params: { W: v.L, D: v.W, T: v.T } } }; } },
  { id: 'brick', name: 'Bricks & blocks', ic: 'door', intro: 'A single-skin standard brick wall (215×65 mm face, 10 mm joints) needs about 59 bricks per m². Deduct openings and add 5 % waste.',
    fields: [['L', 'Wall length (m)', 10, 0.1], ['H', 'Wall height (m)', 2.8, 0.1], ['open', 'Openings area (m²)', 3.6, 0.1], ['skins', 'Skins', 1, 1]],
    calc: v => { const A = Math.max(0, v.L * v.H - v.open), n = A * 59 * v.skins * 1.05; return { big: `${f(n, 0)} bricks`, rows: [R('Net wall area', f(A) + ' m²'), R('Mortar (≈ 0.03 m³/m²)', f(A * 0.03 * v.skins) + ' m³'), R('Pallets (≈ 500 each)', f(Math.ceil(n / 500), 0))], preview: { id: 'wall', params: { L: v.L, H: v.H, T: 0.23, door: false, windows: 0 } } }; } },
  { id: 'paint', name: 'Paint', ic: 'sheet', intro: 'One litre usually covers 10–12 m² per coat on smooth plaster. Rough surfaces drink more.',
    fields: [['L', 'Room length (m)', 5, 0.1], ['W', 'Room width (m)', 4, 0.1], ['H', 'Ceiling height (m)', 2.7, 0.1], ['open', 'Doors & windows (m²)', 4, 0.5], ['coats', 'Coats', 2, 1], ['cov', 'Coverage (m²/L)', 11, 0.5]],
    calc: v => { const walls = 2 * (v.L + v.W) * v.H - v.open, ceil = v.L * v.W; return { big: `${f((walls) * v.coats / v.cov, 1)} L for walls`, rows: [R('Wall area', f(walls) + ' m²'), R('Ceiling area', f(ceil) + ' m²'), R('Ceiling paint', f(ceil * v.coats / v.cov, 1) + ' L'), R('Total', f((walls + ceil) * v.coats / v.cov, 1) + ' L')], preview: { id: 'box', params: { w: v.L, h: v.H, d: v.W } } }; } },
  { id: 'beam', name: 'Beam check', ic: 'chart', intro: 'Simply supported rectangular beam under a uniform load. A learning estimate: deflection limit is span/360; real design needs a structural engineer.',
    fields: [['L', 'Span (m)', 4, 0.1], ['b', 'Width (mm)', 100, 5], ['d', 'Depth (mm)', 200, 5], ['w', 'Load (kN/m)', 5, 0.5], ['mat', 'Material', 'timber', null, [['timber', 'Timber (E 10 GPa, 24 MPa)'], ['steel', 'Steel (E 200 GPa, 250 MPa)'], ['concrete', 'Concrete (E 30 GPa, 30 MPa)']]]],
    calc: v => { const E = { timber: 10e9, steel: 200e9, concrete: 30e9 }[v.mat], fy = { timber: 24e6, steel: 250e6, concrete: 3e6 }[v.mat], b = v.b / 1000, d = v.d / 1000, I = b * d ** 3 / 12, w = v.w * 1000, M = w * v.L ** 2 / 8, sig = M * (d / 2) / I, dl = 5 * w * v.L ** 4 / (384 * E * I); return { big: `Deflection ${f(dl * 1000, 1)} mm`, rows: [R('Limit L/360', f(v.L / 360 * 1000, 1) + ' mm ' + badge(dl <= v.L / 360, dl <= v.L / 360 ? 'OK' : 'too flexible')), R('Max moment', f(M / 1000, 2) + ' kN·m'), R('Bending stress', f(sig / 1e6, 1) + ' MPa ' + badge(sig <= fy, `limit ${f(fy / 1e6, 0)}`)), R('Shear force', f(w * v.L / 2000, 2) + ' kN'), R('Tip', 'Deeper beams win: stiffness grows with depth³')], preview: { id: 'beam', params: { L: v.L } } }; } },
  { id: 'sun', name: 'Sun angle', ic: 'sun', intro: 'Sun altitude and compass bearing for any place, date and time. Use it to size overhangs and read shadows. Open the Studio\'s Sun tab to see it live on your model.',
    fields: [['lat', 'Latitude (°N)', 28.6, 0.1], ['lon', 'Longitude (°E)', 77.2, 0.1], ['m', 'Month', 6, 1], ['d', 'Day', 21, 1], ['t', 'Clock time (0–24 h)', 12, 0.25], ['tz', 'UTC offset (h)', 5.5, 0.5]],
    calc: v => { const p = sunPosition(dateFrom(2026, v.m, v.d, v.t, v.tz), v.lat, v.lon), dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], dir = dirs[Math.round(p.az / 45) % 8]; const sh = p.el > 0 ? 1 / Math.tan(p.el * Math.PI / 180) : Infinity; return { big: p.el > 0 ? `${f(p.el, 1)}° high, ${f(p.az, 0)}° ${dir}` : 'Sun below horizon', rows: [R('Altitude', f(p.el, 1) + '°'), R('Azimuth (from N)', f(p.az, 1) + '° ' + dir), R('Shadow of a 1 m post', p.el > 0 ? f(sh) + ' m' : '—'), R('Overhang to shade 2 m window at noon', p.el > 0 ? f(2 / Math.tan(p.el * Math.PI / 180) * 0.3) + ' m' : '—')], note: 'Times are clock time for the UTC offset you give; solar noon differs by longitude.', sun: p }; } },
  { id: 'units', name: 'Unit converter', ic: 'flip', intro: 'Convert lengths, areas and volumes used in drawings.',
    fields: [['val', 'Value', 1, 'any'], ['u', 'From', 'm', null, [['m', 'metres'], ['mm', 'millimetres'], ['cm', 'centimetres'], ['in', 'inches'], ['ft', 'feet'], ['yd', 'yards']]]],
    calc: v => { const m = v.val * { m: 1, mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, yd: 0.9144 }[v.u]; const ftIn = m / 0.0254, ft = Math.floor(ftIn / 12); return { big: `${f(m, 4)} m`, rows: [R('Millimetres', f(m * 1000, 1)), R('Centimetres', f(m * 100, 2)), R('Inches', f(ftIn, 2)), R('Feet + inches', `${ft}′ ${f(ftIn - ft * 12, 1)}″`), R('Yards', f(m / 0.9144, 3)), R('As square (m→m²)', f(m * m, 3) + ' m²  = ' + f(m * m * 10.7639, 2) + ' ft²'), R('As cube (m³)', f(m ** 3, 3) + ' m³  = ' + f(m ** 3 * 35.3147, 2) + ' ft³')] }; } },
  { id: 'cost', name: 'Cost estimate', ic: 'sheet', intro: 'A rough budget from floor area. Rates are broad placeholders — set your local rate per m². The Studio\'s Plan tab gives a per-material estimate from your actual model.',
    fields: [['A', 'Floor area (m²)', 120, 1], ['floors', 'Storeys', 2, 1], ['rate', 'Rate per m² (your currency)', 900, 10], ['type', 'Finish level', 1, null, [['0.8', 'Basic (×0.8)'], ['1', 'Standard (×1)'], ['1.35', 'High (×1.35)'], ['1.8', 'Luxury (×1.8)']]], ['cont', 'Contingency (%)', 10, 1]],
    calc: v => { const base = v.A * v.floors * v.rate * parseFloat(v.type), tot = base * (1 + v.cont / 100); return { big: f(tot, 0), rows: [R('Built area', f(v.A * v.floors, 0) + ' m²'), R('Construction', f(base, 0)), R('Contingency', f(base * v.cont / 100, 0)), R('Structure (≈ 25 %)', f(tot * 0.25, 0)), R('Services (≈ 25 %)', f(tot * 0.25, 0)), R('Finishes (≈ 30 %)', f(tot * 0.30, 0))] }; } },
];

const nav = $('#cnav'); nav.innerHTML = TOOLS.map(t => `<button data-id="${t.id}">${icon(t.ic)}${t.name}</button>`).join('');
const root = $('#calc'); let vp = null, cur = null, pv = null;
function ensureVp(host) { if (vp) { vp.dispose(); vp.canvas.remove(); } vp = new Viewport(host, { grid: 40, shadows: true }); }
function show(id) {
  const t = TOOLS.find(x => x.id === id) || TOOLS[0]; cur = t; history.replaceState(null, '', '#' + t.id);
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === t.id));
  root.innerHTML = `<h2>${t.name}</h2><p class="lead" style="margin:6px 0 14px">${esc(t.intro)}</p>
  <div class="calc"><div class="card"><div id="flds">${t.fields.map(([k, l, d, st, opts]) => `<div class="field"><label for="f-${k}">${l}</label>${opts ? `<select id="f-${k}" data-k="${k}">${opts.map(([o, n]) => `<option value="${o}" ${String(o) === String(d) ? 'selected' : ''}>${n}</option>`).join('')}</select>` : `<input id="f-${k}" data-k="${k}" type="number" step="${st}" value="${d}" inputmode="decimal">`}</div>`).join('')}</div><div class="out" id="out"></div><div id="note"></div></div>
  <div class="card"><div class="calc-view" id="cv"></div><div class="row" style="margin-top:10px" id="pvbar"></div></div></div>`;
  const vals = () => { const v = {}; root.querySelectorAll('[data-k]').forEach(el => { const k = el.dataset.k; v[k] = el.tagName === 'SELECT' ? (isNaN(+el.value) ? el.value : (t.fields.find(f => f[0] === k)[4].some(o => typeof o[0] === 'string' && o[0] === el.value && isNaN(+o[0])) ? el.value : el.value)) : parseFloat(el.value); }); return v; };
  const update = () => {
    const v = vals(); if (Object.values(v).some(x => typeof x === 'number' && !Number.isFinite(x))) return; const r = t.calc(v);
    $('#out').innerHTML = `<div class="big">${r.big}</div>${r.rows.join('')}`; $('#note').innerHTML = r.note ? `<div class="note-box">${esc(r.note)}</div>` : '';
    pv = r.preview || null; draw(r, v);
  };
  const host = $('#cv'); const hasView = t.id !== 'units' && t.id !== 'cost'; if (!hasView) host.parentElement.style.display = 'none'; else ensureVp(host);
  function draw(r, v) {
    if (!hasView || !vp) return; while (vp.world.children.length) vp.world.remove(vp.world.children[0]);
    if (r.sun) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 12), new THREE.MeshStandardMaterial({ color: 0xd0a324 })); post.position.y = 1; post.castShadow = true; g.add(post); const bx = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0xcfc6b0 })); bx.position.set(1.5, 0.3, 0); bx.castShadow = true; g.add(bx); vp.world.add(g); vp.setSun(r.sun.az + 180 > 360 ? r.sun.az - 180 : r.sun.az + 180, Math.max(2, r.sun.el), r.sun.el > 0 ? 2.2 : 0.1); vp.frame(g, 'iso'); vp.refit(g, 1.6); return; }
    if (!r.preview) return; try { const o = build(r.preview.id, r.preview.params); if (r.preview.scaleTo) { const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()); const k = r.preview.scaleTo; if (r.preview.id === 'cylinder' || r.preview.id === 'cone') o.scale.set(k.a / s.x, k.h / s.y, k.a / s.z); else if (r.preview.id === 'sphere') o.scale.setScalar(k.a / s.x); } vp.world.add(o); o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); if (!draw.fit || draw.id !== t.id) { vp.frame(o, 'iso'); draw.fit = true; draw.id = t.id; } else vp.refit(o, 1.25); vp.refit(o, 1.25); } catch (e) { console.warn(e); }
  }
  root.addEventListener('input', update); update();
  if (pv) $('#pvbar').innerHTML = `<a class="btn sm" id="toStudio" href="studio.html?add=${pv.id}&p=${encodeURIComponent(JSON.stringify(pv.params))}">${icon('cube')} Open in Studio</a><a class="btn sm ghost" href="item.html?id=${pv.id}">About this item</a>`;
  root.addEventListener('input', () => { const a = $('#toStudio'); if (a && pv) a.href = `studio.html?add=${pv.id}&p=${encodeURIComponent(JSON.stringify(pv.params))}`; });
}
nav.onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.id); };
show(location.hash.slice(1) || 'stairs');
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
