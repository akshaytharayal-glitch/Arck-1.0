// Procedural sky: gradient environment (for realistic reflections / ambient light) + matching background gradient.
import * as THREE from 'three';

const lin = h => new THREE.Color(h);
export const SKIES = {
  dark:  { top: 0x1a1710, mid: 0x4a3b1c, bot: 0x16120a, bgTop: '#0d0a05', bgMid: '#1e1709', bgBot: '#2b2210', env: 0.55, exposure: 0.95, sun: 1.7, hemi: 0.25 },
  light: { top: 0xcfe0ee, mid: 0xf4ecd8, bot: 0xb9ad8a, bgTop: '#c9dbe8', bgMid: '#efe9d9', bgBot: '#d9d1bb', env: 0.8, exposure: 0.9, sun: 2.4, hemi: 0.25 },
  sky:   { top: 0x4f8fd0, mid: 0xcfe3f2, bot: 0x6d7b59, bgTop: '#5a97d3', bgMid: '#bfd9ee', bgBot: '#a8bf97', env: 0.9, exposure: 0.92, sun: 2.8, hemi: 0.2 },
};

export function makeSkyTexture(renderer, name) {
  const s = SKIES[name] || SKIES.dark; const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: lin(s.top) }, mid: { value: lin(s.mid) }, bot: { value: lin(s.bot) } },
    vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 d; void main(){ float h = normalize(d).y; vec3 c = h > 0. ? mix(mid, top, pow(h, .5)) : mix(mid, bot, pow(-h, .35)); gl_FragColor = vec4(c, 1.); }',
  });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  // soft bright "sun" patch so glossy surfaces pick up a highlight
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.92, 0.75).multiplyScalar(name === 'dark' ? 4 : 14) })); sun.position.set(30, 32, 20); sc.add(sun);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.025); pm.dispose(); mat.dispose(); return rt.texture;
}

/** Vertical gradient used as the visible background. */
export function makeBackground(name) {
  const s = SKIES[name] || SKIES.dark; const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, s.bgTop); gr.addColorStop(0.62, s.bgMid); gr.addColorStop(1, s.bgBot); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
