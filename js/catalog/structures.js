// STRUCTURES (part 1) — arches, arcades, domes, vaults, trusses.
import { THREE, V, rad, mesh, grp, put, bx, cy, sph, bar, sbar, extrude, polyShape, lathe, tube, boxGeo, merged, P, SEL, CHK, def } from './kit.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { twoSided } from './shapes.js';

const S = 'structures';

// ---------------------------------------------------------------- arch centre-lines
export function archCenter(type, span, H, o = {}, n = 56) {
  const pts = [];
  const lin = f => { for (let i = 0; i <= n; i++) { const x = -span / 2 + span * i / n; pts.push(new THREE.Vector2(x, f(x))); } };
  switch (type) {
    case 'roman': { const R = span / 2; for (let i = 0; i <= n; i++) { const a = Math.PI - i / n * Math.PI; pts.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a))); } break; }
    case 'segmental': { const h = Math.min(H, span / 2 - 0.01); const R = (span * span / 4 + h * h) / (2 * h), c = h - R; lin(x => c + Math.sqrt(Math.max(0, R * R - x * x))); break; }
    case 'elliptical': for (let i = 0; i <= n; i++) { const a = Math.PI - i / n * Math.PI; pts.push(new THREE.Vector2(span / 2 * Math.cos(a), H * Math.sin(a))); } break;
    case 'parabolic': lin(x => H * (1 - (2 * x / span) ** 2)); break;
    case 'catenary': { const k = (o.k || 2) / (span / 2); lin(x => H * (Math.cosh(k * span / 2) - Math.cosh(k * x)) / (Math.cosh(k * span / 2) - 1)); break; }
    case 'gothic': {
      const rho = span * (o.k || 1), cx = span / 2 - rho, phi = Math.acos((rho - span / 2) / rho), half = n >> 1, right = [];
      for (let i = 0; i <= half; i++) { const th = phi * i / half; right.push(new THREE.Vector2(cx + rho * Math.cos(th), rho * Math.sin(th))); } // right springing -> apex
      const left = right.map(v => new THREE.Vector2(-v.x, v.y)); // left springing -> apex
      return [...left, ...right.slice().reverse().slice(1)];
    }
    case 'horseshoe': { const d = rad(o.d ?? 18), R = span / (2 * Math.cos(d)), c = R * Math.sin(d); for (let i = 0; i <= n; i++) { const a = Math.PI + d - i / n * (Math.PI + 2 * d); pts.push(new THREE.Vector2(R * Math.cos(a), c + R * Math.sin(a))); } break; }
  }
  return pts;
}
function offsetCurve(pts, t) {
  const out = [], inn = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1; const nx = -ty / l, ny = tx / l;
    out.push(new THREE.Vector2(pts[i].x + nx * t / 2, pts[i].y + ny * t / 2)); inn.push(new THREE.Vector2(pts[i].x - nx * t / 2, pts[i].y - ny * t / 2));
  }
  return [out, inn];
}
function archRing(type, p, mat = 'stone', extra = {}) {
  const c = archCenter(type, p.span, p.rise, extra), [out, inn] = offsetCurve(c, p.t);
  const sh = new THREE.Shape(); out.forEach((v, i) => i ? sh.lineTo(v.x, v.y) : sh.moveTo(v.x, v.y)); inn.reverse().forEach(v => sh.lineTo(v.x, v.y)); sh.closePath();
  const ring = extrude(sh, p.d, mat, { curveSegments: 4 }); ring.position.y = p.pier;
  const g = grp(ring);
  if (p.pier > 0) { g.add(bx(p.t, p.pier, p.d, mat, -p.span / 2, 0, 0), bx(p.t, p.pier, p.d, mat, p.span / 2, 0, 0)); }
  if (p.key) { let ap = c[0]; c.forEach(v => { if (v.y > ap.y) ap = v; }); g.add(put(mesh(new THREE.BoxGeometry(p.t * 0.7, p.t * 1.35, p.d * 1.06), 'gold'), ap.x, ap.y + p.pier + p.t * 0.12, 0)); }
  return g;
}
const archParams = (span, rise, extra = []) => [P('span', 'Span (opening)', 1, 40, 0.1, span), ...(rise === null ? [] : [P('rise', 'Rise (height of curve)', 0.3, 40, 0.1, rise)]), P('t', 'Ring thickness', 0.1, 3, 0.05, 0.6), P('d', 'Depth (wall thickness)', 0.2, 12, 0.1, 1.2), P('pier', 'Pier height', 0, 20, 0.1, 2), CHK('key', 'Gold keystone', true), ...extra];
def('arch-roman', 'Roman arch', S, 'Arches', archParams(5, null), p => archRing('roman', { ...p, rise: p.span / 2 }), 'A semicircular arch. Loads travel along the curve as pure compression, so stone blocks can span an opening without any glue.', 'Change the span and pier height; the rise is always half the span. The golden keystone locks the two halves together.');
def('arch-segmental', 'Segmental arch', S, 'Arches', archParams(6, 1.5), p => archRing('segmental', p), 'A flatter arch made from a small slice of a circle.', 'Use a low rise for bridges and window heads. The flatter the arch, the stronger the sideways thrust at the supports.');
def('arch-gothic', 'Gothic (pointed) arch', S, 'Arches', archParams(4, null, [P('k', 'Point sharpness', 0.6, 1.6, 0.05, 1)]), p => archRing('gothic', { ...p, rise: 1 }, 'stone', { k: p.k }), 'Two arcs meeting at a point. Cathedral builders used it because it pushes less sideways than a round arch.', 'Sharpness 1.0 = equilateral arch. Raise it for a tall, narrow lancet arch; lower it toward a rounded arch.');
def('arch-horseshoe', 'Horseshoe arch', S, 'Arches', archParams(4, null, [P('d2', 'Overhang (°)', 0, 35, 1, 18)]), p => archRing('horseshoe', { ...p, rise: 1 }, 'brick', { d: p.d2 }), 'A round arch that curves inward below its widest point. Seen in Moorish architecture such as the Mosque of Córdoba.', 'Increase the overhang to make the “horseshoe” more closed. Try alternating brick and stone for the striped Moorish look.');
def('arch-parabolic', 'Parabolic arch', S, 'Arches', archParams(8, 5), p => archRing('parabolic', p, 'concrete'), 'An arch following y = 1 − x². It is the ideal shape for a uniformly loaded arch.', 'Common in concrete bridges and hangars. Adjust the rise to see tall, slender or flat versions.');
def('arch-catenary', 'Catenary arch', S, 'Arches', archParams(8, 6, [P('k', 'Curve strength', 0.5, 4, 0.1, 2)]), p => archRing('catenary', p, 'concrete', { k: p.k }), 'An upside-down hanging chain. A chain hangs in pure tension; flipped, it becomes an arch in pure compression. The Gateway Arch in St. Louis uses this shape.', 'Use it for monuments and elegant bridges. Higher curve strength gives a more pointed, tent-like arch.');
def('arch-elliptical', 'Elliptical arch', S, 'Arches', archParams(6, 2), p => archRing('elliptical', p), 'A half-ellipse: wider than it is tall (or the reverse).', 'Used where headroom is limited but a smooth curve is wanted, e.g. bridges over wide, shallow waterways.');
def('arcade', 'Arcade (row of arches)', S, 'Arches', [P('n', 'Number of bays', 1, 12, 1, 5, { int: 1 }), P('span', 'Bay opening', 1.5, 10, 0.1, 3), P('pw', 'Pier width', 0.3, 3, 0.1, 1), P('ph', 'Pier height', 0.5, 12, 0.1, 3), P('wall', 'Wall above', 0, 12, 0.1, 1.6), P('d', 'Depth', 0.3, 5, 0.1, 1)],
  p => { const g = grp(); const total = p.n * p.span + (p.n + 1) * p.pw, x0 = -total / 2 + p.pw / 2; const R = p.span / 2;
    for (let i = 0; i <= p.n; i++) g.add(bx(p.pw, p.ph, p.d, 'stone', x0 + i * (p.span + p.pw), 0, 0));
    const shp = new THREE.Shape(); shp.moveTo(-R - p.pw / 2, 0); shp.lineTo(R + p.pw / 2, 0); shp.lineTo(R + p.pw / 2, R + p.pw * 0.9); shp.lineTo(-R - p.pw / 2, R + p.pw * 0.9); shp.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, R, 0, Math.PI, false); hole.closePath(); shp.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shp, { depth: p.d, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -p.d / 2);
    for (let i = 0; i < p.n; i++) { const m = mesh(geo.clone(), 'stone'); m.position.set(x0 + p.pw / 2 + R + i * (p.span + p.pw), p.ph, 0); g.add(m); }
    if (p.wall > 0) g.add(bx(total, p.wall, p.d, 'stone', 0, p.ph + R + p.pw * 0.9, 0));
    return g; }, 'A series of arches carried on piers — a covered walkway or aqueduct.', 'Pick the number of bays and pier size. Increase “wall above” for an aqueduct; reduce it to 0 for an open colonnade.');

// ---------------------------------------------------------------- domes
function shell(half, t, drumH, mat, seg = 56, oculus = 0) {
  // half: array of [r,y] from the springing (outer face) up to the crown
  const n = half.length, outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const a = half[Math.max(0, i - 1)], b = half[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l; // outward
    outer.push([half[i][0], half[i][1] + drumH]); inner.push([Math.max(0, half[i][0] - nx * t), half[i][1] + drumH - ny * t]);
  }
  let o = outer, ii = inner;
  if (oculus > 0) { const keep = o.map((v, i) => i).filter(i => o[i][0] >= oculus); o = keep.map(i => o[i]); ii = keep.map(i => ii[i]); }
  const pts = [];
  if (drumH > 0) { pts.push([half[0][0] - t, 0], [half[0][0], 0]); } else pts.push([o[0][0] - t, o[0][1]]);
  pts.push(...o, ...ii.reverse());
  if (drumH > 0) pts.push([half[0][0] - t, drumH]);
  return lathe(pts, mat, seg);
}
const domeCommon = [P('t', 'Shell thickness', 0.05, 3, 0.05, 0.35), P('drum', 'Drum height', 0, 20, 0.1, 0), P('oc', 'Oculus radius', 0, 10, 0.1, 0)];
def('dome', 'Dome', S, 'Domes', [P('R', 'Radius', 1, 40, 0.5, 7), P('rise', 'Rise ratio', 0.25, 1.5, 0.05, 1), ...domeCommon],
  p => { const h = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI / 2; h.push([p.R * Math.cos(a), p.R * p.rise * Math.sin(a)]); } return shell(h, p.t, p.drum, 'plaster', 56, Math.min(p.oc, p.R * 0.9)); },
  'A hollow shell made by rotating an arch. The Pantheon in Rome has a 43 m dome with an open oculus.', 'Rise ratio 1 = hemisphere, below 1 = shallow saucer dome, above 1 = stilted dome. Add a drum to lift it, and an oculus for a skylight.');
def('dome-pointed', 'Pointed dome', S, 'Domes', [P('R', 'Radius', 1, 40, 0.5, 6), P('k', 'Point sharpness', 0.6, 1.6, 0.05, 1), ...domeCommon],
  p => { const c = archCenter('gothic', p.R * 2, 1, { k: p.k }, 56).filter(v => v.x >= -1e-6).reverse().map(v => [v.x, v.y]); return shell(c, p.t, p.drum, 'plaster', 56, Math.min(p.oc, p.R * 0.5)); },
  'A dome with a pointed crown, like the Gol Gumbaz tomb or an upturned Gothic arch.', 'Increase sharpness for a taller, more pointed crown. Used in Persian, Indian and Islamic architecture.');
def('dome-onion', 'Onion dome', S, 'Domes', [P('R', 'Max radius', 1, 20, 0.25, 4), P('H', 'Height', 2, 50, 0.5, 9), P('spire', 'Gold finial', 0, 6, 0.1, 1.8)],
  p => { const ctl = [[0.55, 0], [0.92, 0.1], [1, 0.3], [0.8, 0.5], [0.36, 0.72], [0.1, 0.88], [0, 1]].map(([r, y]) => new THREE.Vector2(r * p.R, y * p.H)); const c = new THREE.SplineCurve(ctl).getPoints(40).map(v => [Math.max(0, v.x), v.y]); const g = grp(lathe([[0, 0], ...c], 'copper', 48));
    if (p.spire > 0) { g.add(cy(0.05, 0.12, p.spire, 'gold', 0, p.H - 0.1, 0, 12), sph(0.22, 'gold', 0, p.H + p.spire * 0.3, 0, 12)); } return g; },
  'A bulbous dome tapering to a point, typical of Russian Orthodox churches (e.g. St Basil’s).', 'Make it taller for a more dramatic bulb. The gold finial and cross sit on top.');
def('dome-geodesic', 'Geodesic dome', S, 'Domes', [P('R', 'Radius', 1, 30, 0.5, 6), P('f', 'Frequency', 0, 3, 1, 1, { int: 1 }), P('s', 'Strut size', 0.02, 0.4, 0.01, 0.07), CHK('glass', 'Glass panels', true)],
  p => { const g0 = new THREE.IcosahedronGeometry(p.R, p.f); const pos = g0.attributes.position; const g = grp(); const edges = new Map(); const faces = []; const key = v => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    for (let i = 0; i < pos.count; i += 3) { const v = [0, 1, 2].map(k => V().fromBufferAttribute(pos, i + k)); if ((v[0].y + v[1].y + v[2].y) / 3 < -1e-3 * p.R) continue; faces.push(v);
      for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; const ka = key(a), kb = key(b); const id = ka < kb ? ka + '|' + kb : kb + '|' + ka; if (!edges.has(id)) edges.set(id, [a, b]); } }
    if (p.glass) { const arr = []; faces.forEach(f => f.forEach(v => arr.push(v.x * 0.995, v.y * 0.995, v.z * 0.995))); const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); gg.computeVertexNormals(); g.add(mesh(twoSided(gg), 'glass', { surface: true, noShadow: true })); }
    const geos = []; edges.forEach(([a, b]) => { const len = a.distanceTo(b); const c = new THREE.CylinderGeometry(p.s, p.s, len, 6); const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); c.applyQuaternion(q); const mid = a.clone().add(b).multiplyScalar(0.5); c.translate(mid.x, mid.y, mid.z); geos.push(c); });
    g.add(merged(geos, 'gold')); return g; },
  'A dome of triangles, invented by Buckminster Fuller. It is one of the strongest, lightest structures for its size.', 'Frequency 0 = 20-face icosahedron; higher = smoother. Remove the glass to see the pure gold frame — the struts are the structure.');
def('dome-ribbed', 'Ribbed dome', S, 'Domes', [P('R', 'Radius', 2, 30, 0.5, 7), P('ribs', 'Ribs', 4, 32, 1, 12, { int: 1 }), P('rr', 'Rib size', 0.05, 0.6, 0.01, 0.2), P('t', 'Shell thickness', 0.05, 2, 0.05, 0.2)],
  p => { const h = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI / 2; h.push([p.R * Math.cos(a), p.R * Math.sin(a)]); } const g = grp(shell(h, p.t, 0, 'plaster', 56));
    for (let k = 0; k < p.ribs; k++) { const a = k / p.ribs * Math.PI * 2; const pts = h.map(([r, y]) => V(Math.cos(a) * (r + p.rr * 0.5), y, Math.sin(a) * (r + p.rr * 0.5))); g.add(tube(pts, p.rr, 'gold', 40, 6)); }
    return g; }, 'A dome whose shell is reinforced by ribs — like Brunelleschi’s dome in Florence.', 'More ribs = stiffer dome. The gold ribs are the load-carrying skeleton; the thin shell just fills between them.');

// ---------------------------------------------------------------- vaults
def('vault-barrel', 'Barrel vault', S, 'Vaults', [P('span', 'Span', 2, 20, 0.1, 5), P('L', 'Length', 2, 60, 0.5, 12), P('t', 'Thickness', 0.1, 2, 0.05, 0.5), P('wall', 'Wall height', 0, 12, 0.1, 2)],
  p => { const R = p.span / 2; const sh = new THREE.Shape(); sh.moveTo(-R - p.t, 0); sh.lineTo(-R, 0); sh.lineTo(-R, p.wall); sh.absarc(0, p.wall, R, Math.PI, 0, true); sh.lineTo(R, 0); sh.lineTo(R + p.t, 0); sh.lineTo(R + p.t, p.wall); sh.absarc(0, p.wall, R + p.t, 0, Math.PI, false); sh.closePath(); return extrude(sh, p.L, 'stone', { curveSegments: 40 }); },
  'A continuous semicircular arch extended in length, like a tunnel.', 'Roman builders roofed halls and corridors this way. The side walls must resist outward thrust — try thicker walls.');
def('vault-groin', 'Groin (cross) vault', S, 'Vaults', [P('R', 'Half span', 1, 12, 0.1, 3), P('ph', 'Pier height', 0, 12, 0.1, 2.5), P('pw', 'Pier size', 0.2, 2, 0.05, 0.5), CHK('ribs', 'Gold ribs', true), P('t', 'Rib size', 0.05, 0.5, 0.01, 0.14)],
  p => { const R = p.R, g = grp(); const sf = new ParametricGeometry((u, v, t) => { const x = (u - 0.5) * 2 * R, z = (v - 0.5) * 2 * R; t.set(x, Math.min(Math.sqrt(Math.max(0, R * R - x * x)), Math.sqrt(Math.max(0, R * R - z * z))) + p.ph, z); }, 36, 36); sf.computeVertexNormals();
    g.add(mesh(twoSided(sf), 'plaster', { surface: true }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(p.pw, p.ph, p.pw, 'stone', sx * R, 0, sz * R));
    if (p.ribs) for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const u = -R + 2 * R * i / 24; pts.push(V(u, Math.sqrt(Math.max(0, R * R - u * u)) + p.ph, s * u)); } g.add(tube(pts, p.t, 'gold', 40, 6)); }
    return g; }, 'Two barrel vaults crossing at right angles. The sharp lines where they meet are called groins.', 'The four corner piers carry all the load. Turn on ribs to see the diagonal groin lines — Gothic builders turned these into decorative ribs.', { solid: false });

// ---------------------------------------------------------------- trusses
export function truss(type, Sp, H, n, w, mat = 'steel') {
  const g = grp(); const x = i => -Sp / 2 + Sp * i / n; const chord = w * 1.5, web = w;
  const link = (a, b, ww = web) => g.add(sbar(V(a[0], a[1], 0), V(b[0], b[1], 0), ww, mat, w));
  if (type === 'kingpost') {
    link([-Sp / 2, 0], [Sp / 2, 0], chord); link([-Sp / 2, 0], [0, H], chord); link([0, H], [Sp / 2, 0], chord); link([0, H], [0, 0]);
    return g;
  }
  if (type === 'warren') {
    for (let i = 0; i < n; i++) { link([x(i), 0], [x(i + 1), 0], chord); const m = (x(i) + x(i + 1)) / 2; link([x(i), 0], [m, H]); link([m, H], [x(i + 1), 0]); if (i < n - 1) link([m, H], [(x(i + 1) + x(i + 2)) / 2, H], chord); }
    return g;
  }
  for (let i = 0; i < n; i++) { link([x(i), H], [x(i + 1), H], chord); link([x(i), 0], [x(i + 1), 0], chord); }
  for (let i = 0; i <= n; i++) link([x(i), 0], [x(i), H]);
  for (let i = 0; i < n; i++) { const left = i < n / 2; if (type === 'pratt') left ? link([x(i), H], [x(i + 1), 0]) : link([x(i + 1), H], [x(i), 0]); else left ? link([x(i), 0], [x(i + 1), H]) : link([x(i + 1), 0], [x(i), H]); }
  return g;
}
const tp = (Sp, H, n) => [P('span', 'Span', 3, 60, 0.5, Sp), P('H', 'Height', 0.5, 20, 0.1, H), P('n', 'Panels', 2, 20, 2, n, { int: 1 }), P('w', 'Member size', 0.04, 0.5, 0.01, 0.12), P('planes', 'Parallel trusses', 1, 2, 1, 1, { int: 1 }), P('gap', 'Spacing', 0.5, 12, 0.1, 3)];
const trussBuild = type => p => { const g = grp(); for (let k = 0; k < p.planes; k++) { const t = truss(type, p.span, p.H, p.n, p.w); t.position.z = p.planes === 1 ? 0 : (k - 0.5) * p.gap; g.add(t); }
  if (p.planes === 2) { const x = i => -p.span / 2 + p.span * i / p.n; for (let i = 0; i <= p.n; i++) { g.add(sbar(V(x(i), p.H, -p.gap / 2), V(x(i), p.H, p.gap / 2), p.w, 'steel')); g.add(sbar(V(x(i), 0, -p.gap / 2), V(x(i), 0, p.gap / 2), p.w, 'steel')); } }
  g.position.y = p.w; return g; };
def('truss-pratt', 'Pratt truss', S, 'Trusses', tp(24, 4, 8), trussBuild('pratt'), 'Diagonals slope down toward the centre. Long diagonals are in tension, short verticals in compression.', 'Invented in 1844 for railway bridges. Use an even number of panels and set “Parallel trusses” to 2 to get a 3D bridge frame.');
def('truss-howe', 'Howe truss', S, 'Trusses', tp(24, 4, 8), trussBuild('howe'), 'Diagonals slope up toward the centre — the mirror of the Pratt. Diagonals are in compression.', 'Popular in timber roofs and bridges because wood is strong in compression. Compare it side by side with the Pratt truss.');
def('truss-warren', 'Warren truss', S, 'Trusses', tp(24, 4, 8), trussBuild('warren'), 'A chain of triangles with no vertical members. Diagonals alternate between tension and compression.', 'Efficient and economical; used in many modern bridges and roof structures. Equilateral triangles appear when height ≈ 0.87 × panel length.');
def('truss-kingpost', 'King-post roof truss', S, 'Trusses', [P('span', 'Span', 2, 20, 0.5, 8), P('H', 'Rise', 0.5, 10, 0.1, 2.6), P('w', 'Member size', 0.05, 0.6, 0.01, 0.18)],
  p => { const g = truss('kingpost', p.span, p.H, 2, p.w, 'wood'); g.position.y = p.w; return g; }, 'The simplest roof truss: two rafters, a tie beam and a central vertical “king post”.', 'For spans up to about 8 m. The tie beam stops the walls spreading; the king post hangs the beam’s middle from the apex.');
def('truss-queenpost', 'Queen-post roof truss', S, 'Trusses', [P('span', 'Span', 4, 24, 0.5, 11), P('H', 'Rise', 0.8, 10, 0.1, 3), P('w', 'Member size', 0.05, 0.6, 0.01, 0.2)],
  p => { const g = grp(); const q = p.span / 6, h2 = p.H * (1 - q / (p.span / 2)); const L = (a, b, w = p.w) => g.add(sbar(V(a[0], a[1], 0), V(b[0], b[1], 0), w, 'wood'));
    L([-p.span / 2, 0], [p.span / 2, 0], p.w * 1.3); L([-p.span / 2, 0], [0, p.H], p.w * 1.3); L([0, p.H], [p.span / 2, 0], p.w * 1.3);
    L([-q, h2], [q, h2]); L([-q, 0], [-q, h2]); L([q, 0], [q, h2]); L([-p.span / 2, 0], [-q, h2], p.w * 0.8); L([p.span / 2, 0], [q, h2], p.w * 0.8);
    g.position.y = p.w; return g; }, 'A roof truss with two vertical “queen posts”, allowing a wider span and an open space between them.', 'Used for spans of 8–14 m. The space between the posts can become an attic room.');
