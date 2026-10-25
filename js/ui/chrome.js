// Shared site chrome: header, footer, toast, service-worker registration.
import { icon } from './icons.js';

export const PAGES = [
  { id: 'home', href: 'index.html', label: 'Home', ic: 'home' },
  { id: 'studio', href: 'studio.html', label: 'Studio', ic: 'cube', cta: true },
  { id: 'shapes', href: 'shapes.html', label: 'Shapes', ic: 'shapes' },
  { id: 'structures', href: 'structures.html', label: 'Structures', ic: 'arch' },
  { id: 'components', href: 'components.html', label: 'Components', ic: 'door' },
  { id: 'viewer', href: 'viewer.html', label: 'Viewer', ic: 'upload' },
  { id: 'tools', href: 'tools.html', label: 'Tools', ic: 'tools' },
  { id: 'learn', href: 'learn.html', label: 'Learn', ic: 'graduate' },
  { id: 'guide', href: 'guide.html', label: 'Guide', ic: 'book' },
];

export function mountHeader(active) {
  const el = document.createElement('header');
  el.className = 'site-head';
  el.innerHTML = `
    <a class="brand" href="index.html" aria-label="ARCK home">
      <img src="assets/img/logo-small.png" alt="" width="46" height="34">
      <span>ARCK<small>3D architecture studio</small></span>
    </a>
    <nav class="nav" id="nav">
      ${PAGES.map(p => `<a href="${p.href}" class="${p.id === active ? 'on' : ''} ${p.cta && p.id !== active ? 'cta' : ''}">${icon(p.ic)}<span>${p.label}</span></a>`).join('')}
    </nav>
    <button class="btn ghost icon menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${icon('menu')}</button>`;
  document.body.prepend(el);
  const nav = el.querySelector('#nav'), btn = el.querySelector('#menuBtn');
  btn.addEventListener('click', () => {
    const o = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', o);
    btn.innerHTML = icon(o ? 'close' : 'menu');
  });
  return el;
}

export function mountFooter() {
  const el = document.createElement('footer');
  el.className = 'site-foot';
  el.innerHTML = `<div class="wrap foot-grid">
    <div><a class="brand" href="index.html"><img src="assets/img/logo-small.png" alt="" width="46" height="34"><span>ARCK</span></a>
      <p style="margin-top:10px;max-width:38ch;font-size:.9rem">A free 3D architecture studio for students and designers. Everything runs in your browser — your files never leave your device.</p></div>
    <nav>${PAGES.map(p => `<a href="${p.href}">${p.label}</a>`).join('')}</nav>
  </div>
  <div class="wrap foot-note">ARCK 1.0 · Built with Three.js · Units are metres unless you change them · Quantities and costs are learning estimates, not engineering advice.</div>`;
  document.body.append(el);
}

let toastEl, toastT;
export function toast(msg, ms = 2400) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

export function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

export function pageInit(active, { footer = true } = {}) {
  mountHeader(active);
  if (footer) mountFooter();
  registerSW();
}

export const isMobile = () => matchMedia('(max-width: 899px), (pointer: coarse) and (max-width: 1100px)').matches;
