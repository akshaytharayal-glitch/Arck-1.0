import { pageInit } from '../ui/chrome.js';
import { getItem } from '../catalog/index.js';
import { ItemDetail } from '../ui/itemdetail.js';
import { esc } from '../ui/params.js';
pageInit('');
const id = new URLSearchParams(location.search).get('id'); const it = getItem(id);
const root = document.getElementById('detail');
if (!it) { root.outerHTML = `<div style="padding:60px 0"><h1>Item not found</h1><p>Browse the <a href="shapes.html">shapes</a>, <a href="structures.html">structures</a> or <a href="components.html">components</a>.</p></div>`; }
else {
  document.title = it.name + ' — ARCK'; document.getElementById('crumbs').innerHTML = `<a href="index.html">Home</a> › <a href="${it.cat}.html">${it.cat[0].toUpperCase() + it.cat.slice(1)}</a> › <a href="${it.cat}.html#${it.id}">${esc(it.group)}</a> › <b>${esc(it.name)}</b>`;
  new ItemDetail(root, id, { mode: 'page' });
}
