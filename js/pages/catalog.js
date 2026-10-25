// Catalog page (Shapes / Structures / Components): searchable tile grid + detail modal.
import { pageInit } from '../ui/chrome.js';
import { icon } from '../ui/icons.js';
import { REGISTRY, getItem, groupsOf, listByCat } from '../catalog/index.js';
import { lazyThumbs } from '../engine/thumbs.js';
import { ItemDetail } from '../ui/itemdetail.js';
import { esc } from '../ui/params.js';

const cat = document.body.dataset.cat;
const INTRO = {
  shapes: { eyebrow: 'Geometry library', title: 'Shapes', lead: 'Pure geometric forms — the vocabulary of every building. Start with basic solids, explore polyhedra and the curved surfaces that architects use for domes, shells and towers.', steps: ['Tap any shape to open it in 3D.', 'Drag the sliders — size, sides and curvature update live.', 'Add it to the Studio or download it as GLB / OBJ / STL.'] },
  structures: { eyebrow: 'How buildings stand up', title: 'Structures', lead: 'Arches, domes, vaults, trusses, bridges, towers and foundations. Each one explains the load path — how weight travels safely down to the ground.', steps: ['Open a structure and read “How to use”.', 'Change span, rise or height and watch the form respond.', 'Turn on Section or Wireframe to see inside.'] },
  components: { eyebrow: 'Building parts', title: 'Components', lead: 'Walls, doors, windows, classical columns, roofs, stairs, furniture and landscape — everything you need to assemble and furnish a design.', steps: ['Browse by group: Doors, Windows, Roofs, Stairs…', 'Set exact sizes in metres, then pick a material.', 'Add several to the Studio and combine them into a building.'] },
};
const I = INTRO[cat];
const active = cat;
pageInit(active);

const app = document.getElementById('app');
const groups = groupsOf(cat);
app.innerHTML = `
  <section class="page-hero wrap"><div class="eyebrow">${I.eyebrow}</div><h1 class="gold-text">${I.title}</h1><p class="lead">${I.lead}</p>
    <ol class="steps">${I.steps.map((s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`).join('')}</ol>
    <div class="toolbar"><label class="search"><span class="sr">Search ${I.title}</span>${icon('search')}<input type="search" id="q" placeholder="Search ${listByCat(cat).length} ${I.title.toLowerCase()}…" autocomplete="off"></label>
      <div class="chips" id="chips"><button class="chip on" data-g="">All</button>${groups.map(([g, l]) => `<button class="chip" data-g="${esc(g)}">${esc(g)} <span class="faint">${l.length}</span></button>`).join('')}</div></div></section>
  <section class="wrap" id="list"></section>
  <div class="modal-back" id="modal" role="dialog" aria-modal="true" aria-label="Item details"><div class="modal" id="modalBody"></div></div>`;

let detail = null, g = '', q = '';
function renderList() {
  const el = document.getElementById('list'); const ql = q.toLowerCase().trim(); let n = 0; let html = '';
  for (const [grp, items] of groups) {
    if (g && grp !== g) continue; const list = items.filter(i => !ql || (i.name + ' ' + i.desc + ' ' + i.group).toLowerCase().includes(ql)); if (!list.length) continue; n += list.length;
    html += `<h2 class="grp">${esc(grp)}</h2><div class="tile-grid">${list.map(i => `<button class="tile" data-id="${i.id}" aria-label="${esc(i.name)}"><div class="thumb" data-thumb="${i.id}"><span class="ph"></span></div><div class="meta"><b>${esc(i.name)}</b><span>${i.params.filter(p => !p.type).length} parameters</span></div></button>`).join('')}</div>`;
  }
  el.innerHTML = html || `<p class="muted" style="padding:40px 0">No match for “${esc(q)}”. Try another word.</p>`; lazyThumbs(el);
}
renderList();
document.getElementById('q').addEventListener('input', e => { q = e.target.value; renderList(); });
document.getElementById('chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; g = b.dataset.g; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('on', c === b)); renderList(); });
document.getElementById('list').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) open(t.dataset.id); });

const modal = document.getElementById('modal'), body = document.getElementById('modalBody');
function open(id, push = true) {
  if (!getItem(id)) return; close(false); modal.classList.add('open'); document.body.style.overflow = 'hidden';
  detail = new ItemDetail(body, id, { mode: 'modal', onNavigate: nid => open(nid) }); body.querySelector('[data-close]').addEventListener('click', () => close());
  if (push && location.hash !== '#' + id) history.pushState(null, '', '#' + id); document.title = getItem(id).name + ' — ARCK';
}
function close(pop = true) {
  if (!detail) return; detail.dispose(); detail = null; modal.classList.remove('open'); document.body.style.overflow = ''; document.title = I.title + ' — ARCK';
  if (pop && location.hash) history.pushState(null, '', location.pathname + location.search);
}
modal.addEventListener('click', e => { if (e.target === modal) close(); });
addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && getItem(id)) open(id, false); else close(false); });
if (location.hash.length > 1) open(location.hash.slice(1), false);
