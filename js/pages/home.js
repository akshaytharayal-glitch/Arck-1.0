import * as THREE from 'three';
import { pageInit } from '../ui/chrome.js';
import { icon } from '../ui/icons.js';
import { Viewport } from '../engine/viewport.js';
import { build, REGISTRY } from '../catalog/index.js';
import { lazyThumbs } from '../engine/thumbs.js';
import { esc } from '../ui/params.js';
pageInit('home');
document.getElementById('nItems').textContent = Math.floor(REGISTRY.length / 10) * 10 + '+';
const F = [['studio.html', 'cube', 'Studio', 'The full editor: walls, rooms, slabs, gizmos, arrays, section, sun, quantities.'], ['shapes.html', 'shapes', 'Shapes', 'Solids, polyhedra, curved forms and plan shapes with live parameters.'], ['structures.html', 'arch', 'Structures', 'Arches, domes, vaults, trusses, bridges, towers, monuments and footings.'], ['components.html', 'door', 'Components', 'Walls, doors, windows, columns, roofs, stairs, furniture and landscape.'], ['viewer.html', 'upload', 'Viewer', 'Open your own GLB, OBJ, STL, PLY, FBX, DAE, 3MF, 3DS or SVG files.'], ['tools.html', 'tools', 'Tools', 'Stairs, roofs, ramps, beams, quantities, sun angle and unit converters.'], ['learn.html', 'graduate', 'Learn', 'Lessons, classical orders, glossary, quizzes and challenges.'], ['guide.html', 'book', 'Guide', 'Instructions for every tool, shortcuts, formats and mobile gestures.']];
document.getElementById('feat').innerHTML = F.map(([h, ic, t, d]) => `<a class="card" href="${h}" style="text-decoration:none;color:inherit"><div class="ico">${icon(ic)}</div><h3>${t}</h3><p class="small">${esc(d)}</p></a>`).join('');
const SHOW = ['dome', 'arch-gothic', 'truss-warren', 'torii-gate', 'column-ionic', 'stairs-spiral', 'bridge-suspension', 'tower-pagoda', 'roof-hip', 'helix', 'vault-groin', 'obelisk'];
document.getElementById('show').innerHTML = SHOW.map(id => `<a class="tile" href="item.html?id=${id}"><div class="thumb" data-thumb="${id}"></div></a>`).join('');
lazyThumbs(document.getElementById('show'));

// hero scene: slowly turning composition
const vp = new Viewport(document.getElementById('hero'), { grid: 40, shadows: true }); vp.setTheme('dark'); vp.showGrid(false);
const g = new THREE.Group(); const add = (id, x, z, ry = 0, s = 1, p) => { const o = build(id, p); o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };
add('torii-gate', 0, 0, 0, 0.9); add('dome', 0, -9, 0, 0.55); add('column-doric', -4.5, -3); add('column-doric', 4.5, -3); add('stairs-straight', 0, 3.5, Math.PI, 0.8, { H: 1.2, n: 8, run: 0.3, w: 3, rail: false }); add('tree-conifer', -8, 2); add('tree-conifer', 8.5, 3);
g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); vp.world.add(g); vp.frame(g, 'iso'); vp.refit(g, 0.72);
vp.controls.enableZoom = false; vp.controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; vp.controls.autoRotateSpeed = 0.9;
vp.onFrame(() => { if (vp.controls.autoRotate) { vp.controls.update(); vp.invalidate(); } });
