// SHAPES — primitives, polyhedra, and architectural curved forms.
import { THREE, V, rad, mesh, grp, put, bx, cy, sph, bar, extrude, polyShape, lathe, tube, ringSolid, polyRing, P, SEL, def } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

const S = 'shapes';
const flat = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
const ground = g => { g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); return g; };
const faceDown = g => {
  const p = g.attributes.position; const a = V().fromBufferAttribute(p, 0), b = V().fromBufferAttribute(p, 1), c = V().fromBufferAttribute(p, 2);
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(n, V(0, -1, 0))); return g;
};
export function twoSided(g) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position.array, n = g.attributes.normal.array, N = p.length;
  const P2 = new Float32Array(N * 2), N2 = new Float32Array(N * 2); P2.set(p); N2.set(n);
  for (let i = 0; i < N; i += 9) {
    const o = N + i;
    for (let k = 0; k < 3; k++) { P2[o + k] = p[i + k]; P2[o + 3 + k] = p[i + 6 + k]; P2[o + 6 + k] = p[i + 3 + k]; }
    for (let k = 0; k < 3; k++) { N2[o + k] = -n[i + k]; N2[o + 3 + k] = -n[i + 6 + k]; N2[o + 6 + k] = -n[i + 3 + k]; }
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P2, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N2, 3)); return out;
}
/** Extrude a shape drawn in the XZ plane (shape-y becomes -z) upward by h. */
export function prismY(shape, h, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 32 }); g.rotateX(-Math.PI / 2);
  return mesh(g, mat);
}

// ------------------------------------------------------------------ Basic solids
def('box', 'Box', S, 'Basic solids', [P('w', 'Width', 0.1, 60, 0.1, 2), P('h', 'Height', 0.1, 60, 0.1, 2), P('d', 'Depth', 0.1, 60, 0.1, 2)],
  p => bx(p.w, p.h, p.d, 'plaster'), 'The cuboid — the most common building block of architectural massing.', 'Set width, height and depth in metres. Use it for rooms, floors, blocks of a building or a quick site model.');
def('rounded-box', 'Rounded box', S, 'Basic solids', [P('w', 'Width', 0.2, 60, 0.1, 2), P('h', 'Height', 0.2, 60, 0.1, 2), P('d', 'Depth', 0.2, 60, 0.1, 2), P('r', 'Corner radius', 0.02, 2, 0.02, 0.25)],
  p => { const r = Math.min(p.r, Math.min(p.w, p.h, p.d) / 2 - 0.01); const m = mesh(new RoundedBoxGeometry(p.w, p.h, p.d, 5, r), 'plaster'); m.position.y = p.h / 2; return m; },
  'A box with softened edges, like a pillow or a modern pavilion block.', 'Increase the corner radius for a softer, more organic look. Great for furniture and futuristic massing.');
def('sphere', 'Sphere', S, 'Basic solids', [P('r', 'Radius', 0.1, 30, 0.1, 1.2), P('seg', 'Smoothness', 6, 64, 1, 40, { int: 1 })],
  p => { const m = mesh(new THREE.SphereGeometry(p.r, p.seg, Math.max(4, p.seg >> 1)), 'plaster'); m.position.y = p.r; return m; }, 'A perfect ball. Every point on the surface is the same distance from the centre.', 'Lower “Smoothness” to see how a curved surface is approximated by flat facets. Use for domes (cut with section), globes and sculpture.');
def('hemisphere', 'Hemisphere', S, 'Basic solids', [P('r', 'Radius', 0.2, 40, 0.1, 2), P('seg', 'Smoothness', 8, 64, 1, 40, { int: 1 })],
  p => { const pts = [[0, 0], [p.r, 0]]; for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push([Math.cos(a) * p.r, Math.sin(a) * p.r]); } return lathe(pts, 'plaster', p.seg); },
  'Half a sphere sitting on its flat face — the simplest solid dome.', 'Place it on top of a cylinder to make a rotunda, or use as a solid dome mass.');
def('ellipsoid', 'Ellipsoid', S, 'Basic solids', [P('rx', 'Radius X', 0.1, 30, 0.1, 2), P('ry', 'Radius Y', 0.1, 30, 0.1, 1), P('rz', 'Radius Z', 0.1, 30, 0.1, 1.4)],
  p => { const g = new THREE.SphereGeometry(1, 40, 20); g.scale(p.rx, p.ry, p.rz); const m = mesh(g, 'plaster'); m.position.y = p.ry; return m; }, 'A stretched sphere with three independent radii.', 'Use for blob-like pavilions, egg-shaped halls, or stylised trees. Make X, Y and Z different to see the shape change.');
def('cylinder', 'Cylinder', S, 'Basic solids', [P('r', 'Radius', 0.1, 30, 0.1, 1), P('h', 'Height', 0.1, 60, 0.1, 2.4), P('seg', 'Smoothness', 3, 64, 1, 40, { int: 1 })],
  p => cy(p.r, p.r, p.h, 'plaster', 0, 0, 0, p.seg), 'A round column of constant width.', 'Perfect for columns, silos, tanks and towers. Set smoothness to 6 for a hexagonal column.');
def('cone', 'Cone', S, 'Basic solids', [P('r', 'Radius', 0.1, 30, 0.1, 1.2), P('h', 'Height', 0.1, 60, 0.1, 2.4), P('seg', 'Smoothness', 3, 64, 1, 40, { int: 1 })],
  p => { const m = mesh(new THREE.ConeGeometry(p.r, p.h, p.seg), 'plaster'); m.position.y = p.h / 2; return m; }, 'A circular base tapering to a point.', 'Use for conical roofs, spires and tree shapes.');
def('capsule', 'Capsule', S, 'Basic solids', [P('r', 'Radius', 0.1, 10, 0.05, 0.5), P('len', 'Body length', 0, 30, 0.1, 1.6)],
  p => { const m = mesh(new THREE.CapsuleGeometry(p.r, p.len, 10, 28), 'plaster'); m.position.y = p.r + p.len / 2; return m; }, 'A cylinder with hemispherical ends — smooth, pill-like form.', 'Good for bollards, rounded towers and contemporary seating.');
def('torus', 'Torus', S, 'Basic solids', [P('R', 'Ring radius', 0.3, 30, 0.1, 1.5), P('t', 'Tube radius', 0.05, 10, 0.05, 0.4), P('seg', 'Smoothness', 6, 64, 1, 40, { int: 1 })],
  p => { const m = mesh(new THREE.TorusGeometry(p.R, Math.min(p.t, p.R - 0.01), 20, p.seg), 'plaster'); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); m.position.y = p.t; return g; },
  'A doughnut shape: a circle swept around an axis.', 'Use for rings, round tables, ring-roads or a circular beam.');
def('pipe', 'Pipe / ring', S, 'Basic solids', [P('ro', 'Outer radius', 0.2, 30, 0.1, 1.2), P('ri', 'Inner radius', 0.05, 29, 0.05, 0.8), P('h', 'Height', 0.05, 60, 0.05, 2)],
  p => { const ri = Math.min(p.ri, p.ro - 0.02); return lathe([[ri, 0], [p.ro, 0], [p.ro, p.h], [ri, p.h]], 'concrete', 48); },
  'A hollow cylinder (tube). Wall thickness = outer − inner radius.', 'Make it tall for a chimney or well; make it short and wide for a ring beam or planter.');
def('plane', 'Plane / ground patch', S, 'Basic solids', [P('w', 'Width', 0.2, 200, 0.5, 8), P('d', 'Depth', 0.2, 200, 0.5, 8)],
  p => { const g = new THREE.PlaneGeometry(p.w, p.d); g.rotateX(-Math.PI / 2); const gg = twoSided(g); const m = mesh(gg, 'grass', { surface: true }); m.position.y = 0.01; return m; }, 'A flat, zero-thickness surface (visible from both sides).', 'Use as a lawn, plaza, water surface or backdrop. Change its material to Grass, Sand, Water or Asphalt.', { solid: false });
def('icosphere', 'Geodesic sphere', S, 'Basic solids', [P('r', 'Radius', 0.2, 30, 0.1, 1.5), P('d', 'Detail', 0, 4, 1, 1, { int: 1 })],
  p => { const g = flat(new THREE.IcosahedronGeometry(p.r, p.d)); const m = mesh(g, 'plaster'); m.position.y = p.r; return m; }, 'A sphere approximated by triangles, the base of Buckminster Fuller’s geodesic domes.', 'Detail 0 is the 20-sided icosahedron. Each step subdivides the triangles — watch the shape approach a true sphere.');

// ------------------------------------------------------------------ Polyhedra
const poly = (id, name, Geo, d1, d2) => def(id, name, S, 'Polyhedra', [P('r', 'Size', 0.2, 30, 0.1, 1.5)],
  p => mesh(ground(faceDown(flat(new Geo(p.r)))), 'plaster'), d1, d2);
poly('tetrahedron', 'Tetrahedron', THREE.TetrahedronGeometry, 'Four triangular faces — the simplest 3D solid.', 'The strongest basic structural unit; used in space frames. Placed face-down so it rests flat.');
poly('octahedron', 'Octahedron', THREE.OctahedronGeometry, 'Eight triangular faces, two pyramids joined base to base.', 'Useful for crystal-like pavilions and as the basic cell of octet-truss space frames.');
poly('dodecahedron', 'Dodecahedron', THREE.DodecahedronGeometry, 'Twelve pentagonal faces.', 'A rare, striking form for sculptural pavilions and lanterns.');
poly('icosahedron', 'Icosahedron', THREE.IcosahedronGeometry, 'Twenty triangular faces.', 'The starting point of geodesic domes. Compare with the “Geodesic sphere” shape.');
def('pyramid', 'Pyramid', S, 'Polyhedra', [P('sides', 'Base sides', 3, 12, 1, 4, { int: 1 }), P('r', 'Base radius', 0.2, 60, 0.1, 2), P('h', 'Height', 0.2, 80, 0.1, 3)],
  p => { const g = flat(new THREE.ConeGeometry(p.r, p.h, p.sides, 1)); g.rotateY(p.sides === 4 ? Math.PI / 4 : 0); const m = mesh(g, 'stone'); m.position.y = p.h / 2; return m; },
  'A polygon base rising to a single apex.', 'With 4 sides and height ≈ 0.63 × base width you get the proportions of the Great Pyramid of Giza.');
def('prism', 'Prism', S, 'Polyhedra', [P('sides', 'Sides', 3, 16, 1, 6, { int: 1 }), P('r', 'Radius', 0.2, 30, 0.1, 1.2), P('h', 'Height', 0.1, 60, 0.1, 2.4)],
  p => { const g = flat(new THREE.CylinderGeometry(p.r, p.r, p.h, p.sides, 1)); const m = mesh(g, 'plaster'); m.position.y = p.h / 2; return m; }, 'A polygon extruded straight up. 3 = triangular, 6 = hexagonal, 8 = octagonal.', 'Octagonal prisms make good gazebo or baptistery bodies; hexagons suit towers.');
def('frustum', 'Frustum', S, 'Polyhedra', [P('rb', 'Bottom radius', 0.2, 40, 0.1, 2), P('rt', 'Top radius', 0, 40, 0.1, 1), P('h', 'Height', 0.1, 60, 0.1, 2), P('sides', 'Sides', 3, 48, 1, 4, { int: 1 })],
  p => { const g = p.sides < 14 ? flat(new THREE.CylinderGeometry(p.rt, p.rb, p.h, p.sides)) : new THREE.CylinderGeometry(p.rt, p.rb, p.h, p.sides); if (p.sides === 4) g.rotateY(Math.PI / 4); const m = mesh(g, 'plaster'); m.position.y = p.h / 2; return m; },
  'A pyramid or cone with its top sliced off.', 'Use for tapering towers, ziggurat levels, bases of monuments or hoppers. Sides ≥ 14 looks round.');
def('wedge', 'Wedge / ramp', S, 'Polyhedra', [P('w', 'Width', 0.2, 40, 0.1, 2), P('h', 'Height', 0.1, 30, 0.1, 1), P('d', 'Length', 0.2, 60, 0.1, 3)],
  p => { const s = polyShape([[-p.d / 2, 0], [p.d / 2, 0], [p.d / 2, p.h]]); const m = extrude(s, p.w, 'concrete'); m.rotation.y = Math.PI / 2; return grp(put(m, 0, 0, 0)); }, 'A triangular prism: one sloped face, one vertical end.', 'Use as a ramp, a sloped roof section, or a sloping site. Slope = height ÷ length.');
def('star-prism', 'Star prism', S, 'Polyhedra', [P('pts', 'Points', 3, 12, 1, 5, { int: 1 }), P('ro', 'Outer radius', 0.3, 30, 0.1, 2), P('ri', 'Inner radius', 0.1, 29, 0.1, 0.9), P('h', 'Height', 0.1, 40, 0.1, 1)],
  p => { const pts = []; for (let i = 0; i < p.pts * 2; i++) { const a = i / (p.pts * 2) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? Math.min(p.ri, p.ro - 0.05) : p.ro; pts.push([Math.cos(a) * r, -Math.sin(a) * r]); } return prismY(polyShape(pts), p.h, 'gold'); },
  'A star-shaped plan extruded upward.', 'A decorative form for plazas, fountains and lantern bases.');

// ------------------------------------------------------------------ Architectural curved forms
def('hyperboloid', 'Hyperboloid tower', S, 'Curved forms', [P('R', 'End radius', 1, 40, 0.5, 6), P('w', 'Waist ratio', 0.2, 1, 0.02, 0.6), P('h', 'Height', 2, 120, 1, 30), P('t', 'Wall thickness', 0.05, 2, 0.05, 0.3)],
  p => { const out = [], inn = []; const N = 24; for (let i = 0; i <= N; i++) { const y = p.h * i / N, k = 2 * i / N - 1, r = p.R * Math.sqrt(p.w * p.w + (1 - p.w * p.w) * k * k); out.push([r, y]); inn.push([Math.max(0.05, r - p.t), y]); } return lathe([...out, ...inn.reverse()], 'concrete', 48); },
  'A surface with a narrow “waist”, built from straight lines — used for cooling towers and the Kobe Port Tower.', 'Lower the waist ratio for a more dramatic hourglass. Real towers use this shape because it is very strong while using little concrete.');
def('paraboloid', 'Paraboloid bowl', S, 'Curved forms', [P('R', 'Rim radius', 1, 60, 0.5, 8), P('h', 'Depth', 0.5, 40, 0.5, 4), P('t', 'Thickness', 0.05, 2, 0.05, 0.3)],
  p => { const pts = []; const N = 20; for (let i = 0; i <= N; i++) { const r = p.R * i / N; pts.push([r, p.h * (r / p.R) ** 2]); } for (let i = N; i >= 0; i--) { const r = p.R * i / N; pts.push([r, p.h * (r / p.R) ** 2 + p.t]); } return lathe(pts, 'plaster', 56); },
  'A bowl formed by revolving a parabola. All rays parallel to the axis meet at one focus.', 'Use for amphitheatres, satellite dishes, stadium bowls and reflecting pools.');
def('saddle', 'Saddle shell (hypar)', S, 'Curved forms', [P('s', 'Size', 2, 60, 0.5, 10), P('k', 'Curvature', 0.5, 12, 0.5, 3)],
  p => { const g = new ParametricGeometry((u, v, t) => { const x = (u - 0.5) * p.s, z = (v - 0.5) * p.s; t.set(x, p.k * (x * x - z * z) / (p.s * p.s / 2) + p.k + 0.05, z); }, 32, 32); g.computeVertexNormals(); return mesh(twoSided(g), 'concrete', { surface: true }); },
  'A hyperbolic paraboloid — a doubly curved surface made entirely of straight lines.', 'Thin shells like this roof large spans with very little material (see Félix Candela’s work). Rotate it 45° and raise the corners for a tent-like canopy.', { solid: false });
def('twisted-tower', 'Twisted tower', S, 'Curved forms', [P('n', 'Sides', 3, 12, 1, 4, { int: 1 }), P('r', 'Radius', 1, 30, 0.5, 4), P('h', 'Height', 2, 150, 1, 30), P('tw', 'Total twist (°)', -360, 360, 5, 90)],
  p => { const rings = []; const N = 40; for (let i = 0; i <= N; i++) rings.push(polyRing(p.n, p.r, p.h * i / N, rad(p.tw) * i / N)); return ringSolid(rings, 'glass'); },
  'A tower whose floor plates rotate gradually as it rises, like the Turning Torso.', 'Increase twist for a more dramatic shape. Twisting spreads wind forces around the building.');
def('helix', 'Spring / helix', S, 'Curved forms', [P('R', 'Coil radius', 0.3, 20, 0.1, 1.5), P('tube', 'Wire radius', 0.03, 1, 0.01, 0.12), P('turns', 'Turns', 1, 20, 0.5, 5), P('pitch', 'Pitch', 0.2, 6, 0.1, 0.8)],
  p => { const pts = []; const N = Math.round(p.turns * 24); for (let i = 0; i <= N; i++) { const a = i / 24 * Math.PI * 2; pts.push(V(Math.cos(a) * p.R, p.tube + i / 24 * p.pitch, Math.sin(a) * p.R)); } return tube(pts, p.tube, 'steel', N * 2, 8); },
  'A curve that winds around an axis while rising.', 'Use for spiral ramps, sculptural railings or a spiral staircase stringer.');
def('torus-knot', 'Torus knot', S, 'Curved forms', [P('R', 'Radius', 0.5, 12, 0.1, 1.6), P('t', 'Tube', 0.05, 2, 0.05, 0.35), P('p', 'p (loops)', 1, 8, 1, 2, { int: 1 }), P('q', 'q (turns)', 1, 8, 1, 3, { int: 1 })],
  p => { const g = new THREE.TorusKnotGeometry(p.R, p.t, 160, 16, p.p, p.q); const m = mesh(ground(g), 'gold'); return m; },
  'A knotted tube that winds p times one way and q times the other.', 'A sculptural centrepiece. Try (2,3) for the trefoil knot or (3,5) for something more intricate.');
const polyPrism = (id, name, pts, desc, use, dp = {}) => def(id, name, S, 'Plan shapes', [P('a', 'Arm length', 1, 40, 0.5, dp.a ?? 6), P('b', 'Arm width', 0.3, 20, 0.1, dp.b ?? 2), P('h', 'Height', 0.2, 60, 0.1, dp.h ?? 3)],
  p => prismY(polyShape(pts(Math.max(p.a, p.b + 0.2), Math.min(p.b, p.a - 0.2))), p.h, 'plaster'), desc, use);
polyPrism('l-shape', 'L-shape block', (a, b) => [[0, 0], [a, 0], [a, -b], [b, -b], [b, -a], [0, -a]].map(([x, y]) => [x - a / 2, y + a / 2]), 'An L-shaped plan extruded upward.', 'The classic corner building, courtyard wing or retaining wall plan.');
polyPrism('t-shape', 'T-shape block', (a, b) => [[-a / 2, 0], [a / 2, 0], [a / 2, -b], [b / 2, -b], [b / 2, -a], [-b / 2, -a], [-b / 2, -b], [-a / 2, -b]].map(([x, y]) => [x, y + a / 2]), 'A T-shaped plan extruded upward.', 'Common for school or hospital wings and for junction pavilions.');
polyPrism('u-shape', 'U-shape block', (a, b) => [[-a / 2, 0], [-a / 2 + b, 0], [-a / 2 + b, -a + b], [a / 2 - b, -a + b], [a / 2 - b, 0], [a / 2, 0], [a / 2, -a], [-a / 2, -a]].map(([x, y]) => [x, y + a / 2]), 'A U-shaped plan that wraps three sides of a courtyard.', 'Use to create courtyards, amphitheatre-like seating or palace-style buildings.');
polyPrism('cross-shape', 'Cross / plus block', (a, b) => [[-b / 2, -a / 2], [b / 2, -a / 2], [b / 2, -b / 2], [a / 2, -b / 2], [a / 2, b / 2], [b / 2, b / 2], [b / 2, a / 2], [-b / 2, a / 2], [-b / 2, b / 2], [-a / 2, b / 2], [-a / 2, -b / 2], [-b / 2, -b / 2]], 'A cross-shaped plan, as in churches with a transept.', 'Make the arm width small for a slim cross and large for a chunky one. Put a dome in the centre for a cruciform church.', { a: 8, b: 3, h: 4 });
def('tunnel', 'Tunnel / half-pipe', S, 'Plan shapes', [P('R', 'Outer radius', 0.5, 30, 0.1, 3), P('t', 'Wall thickness', 0.05, 3, 0.05, 0.4), P('L', 'Length', 0.5, 80, 0.5, 8)],
  p => { const s = new THREE.Shape(); const ri = Math.max(0.05, p.R - p.t); s.moveTo(-p.R, 0); s.absarc(0, 0, p.R, Math.PI, 0, true); s.lineTo(ri, 0); s.absarc(0, 0, ri, 0, Math.PI, false); s.closePath(); return extrude(s, p.L, 'concrete', { curveSegments: 40 }); },
  'A semicircular arch extruded along its length — a barrel-vaulted passage.', 'Use for underpasses, culverts, covered walkways and the “barrel” of a vault.');
