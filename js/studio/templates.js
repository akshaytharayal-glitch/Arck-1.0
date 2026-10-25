// Starter scenes. Each builds with the same catalog items users can add themselves.
import * as THREE from 'three';

const D = d => d * Math.PI / 180;
export const TEMPLATES = [
  { id: 'house', name: 'Small house', desc: 'Brick walls, door, windows, gable roof and a garden.', run: house },
  { id: 'shrine', name: 'Torii shrine path', desc: 'Three torii gates, a pagoda, lanterns and pine trees — inspired by the ARCK logo.', run: shrine },
  { id: 'temple', name: 'Classical temple', desc: 'Doric peripteral temple with steps, entablature and pediments.', run: temple },
  { id: 'cloister', name: 'Courtyard cloister', desc: 'Four arcades around a fountain garden.', run: cloister },
  { id: 'rotunda', name: 'Rotunda', desc: 'A domed round hall ringed by Corinthian columns.', run: rotunda },
  { id: 'bridge', name: 'Arch bridge crossing', desc: 'Stone arch bridge over water with road, lamps and trees.', run: bridgeScene },
  { id: 'hall', name: 'Steel portal hall', desc: 'Portal-frame market hall with sawtooth skylights.', run: hall },
];

function mk(sc) {
  const add = (id, params, x = 0, z = 0, rotDeg = 0, mat = null, y = 0, name) => sc.addCatalog(id, params || {}, { pos: [x, y, z], rot: [0, D(rotDeg), 0], mat: mat ? { key: mat } : null, select: false, commit: false, name });
  const wall = (a, b, o = {}) => sc.addWall({ x: a[0], z: a[1] }, { x: b[0], z: b[1] }, o);
  return { add, wall };
}

function house(sc) {
  const { add, wall } = mk(sc); const H = 2.8, T = 0.25, hw = 4, hd = 3;
  sc.addSlab([{ x: -hw - 1.2, z: -hd - 1.2 }, { x: hw + 1.2, z: -hd - 1.2 }, { x: hw + 1.2, z: hd + 3 }, { x: -hw - 1.2, z: hd + 3 }], { T: 0.1, mat: 'grass', name: 'Lawn', y: -0.1 });
  sc.addSlab([{ x: -hw - 0.15, z: -hd - 0.15 }, { x: hw + 0.15, z: -hd - 0.15 }, { x: hw + 0.15, z: hd + 0.15 }, { x: -hw - 0.15, z: hd + 0.15 }], { T: 0.3, mat: 'concrete', name: 'Plinth', y: 0 });
  const y = 0.3, o = { H, T, mat: 'brick', y };
  wall([-hw, hd], [hw, hd], { ...o, params: { door: true, dx: 0.5, doorW: 1, windows: 4, winW: 1.3, winH: 1.3, sill: 0.9 } });
  wall([hw, hd], [hw, -hd], { ...o, params: { windows: 2, winW: 1.2, winH: 1.2 } });
  wall([hw, -hd], [-hw, -hd], { ...o, params: { windows: 3, winW: 1.2, winH: 1.2 } });
  wall([-hw, -hd], [-hw, hd], { ...o, params: { windows: 2, winW: 1.2, winH: 1.2 } });
  sc.addSlab([{ x: -hw, z: -hd }, { x: hw, z: -hd }, { x: hw, z: hd }, { x: -hw, z: hd }], { T: 0.12, mat: 'wood', name: 'Floor', y });
  add('door-single', { W: 1, H: 2.1, mat: 'darkwood' }, 0, hd, 0, null, y);
  const L = 8 + T; for (let i = 1; i <= 4; i++) { const cx = -L / 2 + L * i / 5; if (Math.abs(cx) < 1.3) continue; add('window-casement', { W: 1.3, H: 1.3, sill: 0.9 }, cx, hd, 0, null, y); }
  add('roof-gable', { W: 6, D: 8, rise: 2.4, ov: 0.5 }, 0, 0, 90, 'roof', y + H);
  add('stairs-straight', { H: 0.3, n: 2, run: 0.3, w: 1.6, rail: false }, 0, hd + 0.75, 90, 'stone', 0);
  add('tree-round', { H: 7, crown: 2.4 }, -6.5, 2); add('tree-round', { H: 5.5, crown: 2 }, 6.8, -3); add('bush', { R: 0.6 }, -3.2, hd + 0.7); add('bush', { R: 0.6 }, 3.2, hd + 0.7); add('bush', { R: 0.5 }, 3.9, hd + 0.8);
  add('fence', { L: 14, H: 1.1, pk: 0.1 }, 0, hd + 3.2); add('car', {}, 6.2, 5.5, 90, 'steel');
  add('person', {}, 1.6, hd + 2.5); add('bench', {}, -5.5, -1.5, 90);
}

function shrine(sc) {
  const { add } = mk(sc);
  sc.addSlab([{ x: -14, z: -28 }, { x: 14, z: -28 }, { x: 14, z: 10 }, { x: -14, z: 10 }], { T: 0.1, mat: 'sand', name: 'Gravel court', y: -0.1 });
  sc.addSlab([{ x: -1.6, z: -26 }, { x: 1.6, z: -26 }, { x: 1.6, z: 9 }, { x: -1.6, z: 9 }], { T: 0.12, mat: 'stone', name: 'Stone path', y: 0 });
  [[6, 5.4, 0.3], [-3, 5.0, 0.26], [-11, 4.6, 0.24]].forEach(([z, h, r], i) => add('torii-gate', { W: 3.4 - i * 0.3, H: h, r, style: 'vermilion' }, 0, z, 0));
  add('tower-pagoda', { n: 5, W: 7, sh: 2.4 }, 9, -20); add('gazebo', { R: 2.4 }, -8, -18, 0, 'darkwood');
  for (const z of [3, -6, -15, -22]) for (const s of [-1, 1]) add('street-lamp', { H: 2.2, arm: 0 }, s * 2.4, z, 0, 'stone');
  for (const [x, z] of [[-9, 3], [-10, -7], [10, 2], [11, -9], [-11, -22], [12, -26]]) add('tree-conifer', { H: 8 + (x * z) % 3, R: 2.2 });
  add('person', {}, 0.4, 7.5); add('person', {}, -0.6, -1);
}

function temple(sc) {
  const { add } = mk(sc); const nF = 6, sp = 3.4, W = (nF - 1) * sp, nS = 11, Dd = (nS - 1) * sp * 0.5, h = 7.2, D = 0.9;
  const Dp = 16; sc.addSlab([{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }], { T: 0.1, mat: 'grass', name: 'Ground', y: -0.1 });
  add('box', { w: W + 7, h: 0.35, d: Dp + 7 }, 0, 0, 0, 'marble', 0); add('box', { w: W + 5.6, h: 0.35, d: Dp + 5.6 }, 0, 0, 0, 'marble', 0.35); add('box', { w: W + 4.2, h: 0.35, d: Dp + 4.2 }, 0, 0, 0, 'marble', 0.7);
  const y0 = 1.05, zf = Dp / 2, cols = [];
  for (let i = 0; i < nF; i++) { const x = -W / 2 + i * sp; add('column-doric', { D, ratio: 8, fl: 1, en: 0 }, x, zf, 0, null, y0); add('column-doric', { D, ratio: 8, fl: 1, en: 0 }, x, -zf, 0, null, y0); }
  const nSide = 4; for (let i = 1; i <= nSide; i++) { const z = -zf + i * (2 * zf) / (nSide + 1); add('column-doric', { D, ratio: 8, fl: 1, en: 0 }, -W / 2, z, 0, null, y0); add('column-doric', { D, ratio: 8, fl: 1, en: 0 }, W / 2, z, 0, null, y0); }
  const top = y0 + D * 8; add('box', { w: W + 1.8, h: 0.9, d: Dp + 1.8 }, 0, 0, 0, 'marble', top); add('box', { w: W + 2.2, h: 0.35, d: Dp + 2.2 }, 0, 0, 0, 'marble', top + 0.9);
  add('wall-solid', { L: W - 2.4, H: D * 8, T: 0.5 }, 0, zf - 4, 0, 'marble', y0); add('wall-solid', { L: W - 2.4, H: D * 8, T: 0.5 }, 0, -zf + 4, 0, 'marble', y0); add('wall-solid', { L: 0.5, H: D * 8, T: Dp - 8 }, -(W - 2.4) / 2, 0, 0, 'marble', y0); add('wall-solid', { L: 0.5, H: D * 8, T: Dp - 8 }, (W - 2.4) / 2, 0, 0, 'marble', y0);
  add('roof-gable', { W: W + 2.4, D: Dp + 2.4, rise: 1.7, ov: 0.3, t: 0.3 }, 0, 0, 0, 'roof', top + 1.25);
  add('pediment', { W: W + 2.2, rise: 1.7, d: 0.7 }, 0, zf + 0.6, 0, null, top + 1.25); add('pediment', { W: W + 2.2, rise: 1.7, d: 0.7 }, 0, -zf - 0.6, 180, null, top + 1.25);
  add('person', {}, 3, zf + 5); add('person', {}, -2, zf + 6);
}

function cloister(sc) {
  const { add } = mk(sc); const n = 5, span = 3, pw = 1, bay = n * span + (n + 1) * pw, R = bay / 2 + 0.5;
  sc.addSlab([{ x: -R - 4, z: -R - 4 }, { x: R + 4, z: -R - 4 }, { x: R + 4, z: R + 4 }, { x: -R - 4, z: R + 4 }], { T: 0.1, mat: 'stone', name: 'Paving', y: -0.1 });
  sc.addSlab([{ x: -R + 1.8, z: -R + 1.8 }, { x: R - 1.8, z: -R + 1.8 }, { x: R - 1.8, z: R - 1.8 }, { x: -R + 1.8, z: R - 1.8 }], { T: 0.1, mat: 'grass', name: 'Garden', y: 0 });
  [[0, R, 0], [0, -R, 180], [R, 0, 270], [-R, 0, 90]].forEach(([x, z, r]) => { add('arcade', { n, span, pw, ph: 3.2, wall: 1.6, d: 1 }, x, z, r, 'stone'); add('slab', { W: bay + 0.6, D: 2.2, T: 0.2 }, x, z, r, 'roof', 7.2); });
  add('fountain', { R: 2.6, tiers: 2 }, 0, 0); for (const [x, z] of [[-5, -5], [5, 5], [-5, 5], [5, -5]]) add('tree-round', { H: 5, crown: 1.6 }, x, z); for (const [x, z] of [[0, 5.6], [0, -5.6]]) add('bench', { L: 1.8 }, x, z, 0); add('person', {}, 2.4, 3);
}

function rotunda(sc) {
  const { add } = mk(sc); const R = 8;
  sc.addSlab([{ x: -22, z: -22 }, { x: 22, z: -22 }, { x: 22, z: 22 }, { x: -22, z: 22 }], { T: 0.1, mat: 'grass', name: 'Ground', y: -0.1 });
  add('cylinder', { r: R + 3.2, h: 0.4, seg: 48 }, 0, 0, 0, 'marble', 0); add('cylinder', { r: R + 2.4, h: 0.4, seg: 48 }, 0, 0, 0, 'marble', 0.4); add('cylinder', { r: R + 1.6, h: 0.4, seg: 48 }, 0, 0, 0, 'marble', 0.8);
  add('dome', { R: R, rise: 1, t: 0.5, drum: 6, oc: 1.2 }, 0, 0, 0, 'plaster', 1.2);
  const n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; add('column-corinthian', { D: 0.8, ratio: 9, fl: 1, en: 0 }, Math.cos(a) * (R + 1.2), Math.sin(a) * (R + 1.2), 0, null, 1.2); }
  add('pipe', { ro: R + 1.8, ri: R + 0.6, h: 0.9 }, 0, 0, 0, 'marble', 1.2 + 7.2); add('door-arched', { W: 2.4, H: 4.4 }, 0, R, 0, 'darkwood', 1.2);
  add('person', {}, 3, R + 4); add('tree-round', { H: 6, crown: 2 }, -12, 10); add('tree-round', { H: 6, crown: 2 }, 12, 10);
}

function bridgeScene(sc) {
  const { add } = mk(sc); const top = 6.75;
  sc.addSlab([{ x: -40, z: -16 }, { x: 40, z: -16 }, { x: 40, z: 16 }, { x: -40, z: 16 }], { T: 0.4, mat: 'water', name: 'River', y: -0.55 });
  sc.addSlab([{ x: -40, z: -16 }, { x: -10.6, z: -16 }, { x: -10.6, z: 16 }, { x: -40, z: 16 }], { T: 10, mat: 'grass', name: 'West bank', y: top - 10 });
  sc.addSlab([{ x: 10.6, z: -16 }, { x: 40, z: -16 }, { x: 40, z: 16 }, { x: 10.6, z: 16 }], { T: 10, mat: 'grass', name: 'East bank', y: top - 10 });
  add('bridge-arch', { span: 22, rise: 5.2, W: 6, t: 0.9, cols: 7 }, 0, 0, 0, 'stone', 0);
  add('road', { L: 29, W: 5, pave: 0.9 }, -25.5, 0, 0, null, top); add('road', { L: 29, W: 5, pave: 0.9 }, 25.5, 0, 0, null, top);
  for (const x of [-9, -3, 3, 9]) for (const s of [-1, 1]) add('street-lamp', { H: 4.5, arm: 0 }, x, s * 3.3, 0, 'black', top + 0.5);
  for (const [x, z] of [[-20, 8], [-24, -9], [22, 9], [26, -8], [-30, 5]]) add('tree-round', { H: 7, crown: 2.4 }, x, z, 0, null, top);
  add('car', {}, -4, 1.2, 0, 'paint', top + 0.06); add('person', {}, 6, -2.6, 0, null, top + 0.5);
}

function hall(sc) {
  const { add } = mk(sc);
  sc.addSlab([{ x: -24, z: -26 }, { x: 24, z: -26 }, { x: 24, z: 26 }, { x: -24, z: 26 }], { T: 0.1, mat: 'asphalt', name: 'Apron', y: -0.1 });
  sc.addSlab([{ x: -10, z: -15 }, { x: 10, z: -15 }, { x: 10, z: 15 }, { x: -10, z: 15 }], { T: 0.2, mat: 'concrete', name: 'Hall floor', y: 0 });
  add('portal-frame', { span: 18, eave: 6, ridge: 0.5, bays: 6, sp: 6 }, 0, 0, 0, null, 0.2);
  add('wall-solid', { L: 30, H: 6, T: 0.25 }, -9, 0, 90, 'aluminium', 0.2); add('wall-solid', { L: 30, H: 6, T: 0.25 }, 9, 0, 90, 'aluminium', 0.2); add('curtain-wall', { L: 18, H: 6, mx: 2, my: 1.5 }, 0, 15, 0, null, 0.2);
  add('roof-sawtooth', { n: 6, w: 3, h: 1.6, D: 31 }, 0, 0, 0, 'slate', 6.2);
  for (const x of [-5, 0, 5]) add('table-dining', { L: 2.4, W: 1, round: 0 }, x, -3); for (const [x, z] of [[-4, 4], [3, 6], [-2, -10]]) add('person', {}, x, z); add('car', {}, 17, 8, 90, 'steel'); add('tree-round', { H: 6, crown: 2 }, -16, 18);
}
