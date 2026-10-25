import { pageInit } from '../ui/chrome.js';
pageInit('guide');
const links = [...document.querySelectorAll('#gnav a')]; const secs = links.map(a => document.querySelector(a.getAttribute('href')));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(l => { const on = l.getAttribute('href') === '#' + e.target.id; l.style.color = on ? 'var(--gold-hi)' : ''; l.style.borderColor = on ? 'var(--gold)' : ''; }); }), { rootMargin: '-20% 0px -70% 0px' });
secs.forEach(s => s && io.observe(s));
