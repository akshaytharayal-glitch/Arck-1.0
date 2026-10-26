// Architectural outline overlay (thin crease edges) — gives models a drafted, less "toy" look.
import * as THREE from 'three';

const MAT = new THREE.LineBasicMaterial({ color: 0x1a1408, transparent: true, opacity: 0.5 });
const MAT_LIGHT = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
export const EDGE_LIMIT = 220000;

export function triTotal(root) { let t = 0; root.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return t; }

export function removeEdges(root) { const kill = []; root.traverse(o => { if (o.userData.isEdges) kill.push(o); }); kill.forEach(o => { o.parent?.remove(o); o.geometry.dispose(); }); }
export function addEdges(root, { angle = 28, dark = true } = {}) {
  removeEdges(root); if (triTotal(root) > EDGE_LIMIT) return false; const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.helper && !o.userData.isEdges && o.geometry?.attributes?.position && !o.material?.alphaTest && !(o.material?.transparent && o.material.opacity < 0.5)) meshes.push(o); });
  for (const m of meshes) {
    const g = new THREE.EdgesGeometry(m.geometry, angle); if (!g.attributes.position?.count) { g.dispose(); continue; }
    const l = new THREE.LineSegments(g, dark ? MAT : MAT_LIGHT); l.userData.helper = true; l.userData.isEdges = true; l.raycast = () => { }; l.castShadow = l.receiveShadow = false; l.renderOrder = 1; m.add(l);
  }
  return true;
}

/** Drawing mode darkens outlines to full black ink. */
export function edgeStyle(strong) { MAT.opacity = strong ? 1 : 0.5; MAT.color.setHex(strong ? 0x000000 : 0x1a1408); MAT_LIGHT.opacity = strong ? 1 : 0.35; }
