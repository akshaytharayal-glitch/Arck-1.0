// Screen-space ambient occlusion + tone-mapped composite (no external post-processing addons needed).
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const VIEWPOS = `
uniform sampler2D tDepth; uniform mat4 projInv;
vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 v = projInv * vec4(uv * 2. - 1., d * 2. - 1., 1.); return v.xyz / v.w; }`;

const AO_FRAG = `${VIEWPOS}
uniform mat4 proj; uniform vec2 res; uniform float radius, bias, intensity; varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.); return; }
  vec3 P = viewPos(vUv); vec2 px = 1. / res;
  vec3 Pr = viewPos(vUv + vec2(px.x, 0.)), Pl = viewPos(vUv - vec2(px.x, 0.)), Pu = viewPos(vUv + vec2(0., px.y)), Pd = viewPos(vUv - vec2(0., px.y));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl; vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy)); if (dot(N, -P) < 0.) N = -N;
  vec3 T = normalize(abs(N.y) < .99 ? cross(N, vec3(0., 1., 0.)) : cross(N, vec3(1., 0., 0.))); vec3 B = cross(N, T);
  float rot = ign(gl_FragCoord.xy) * 6.2831853, occ = 0.; const int NS = 16;
  for (int i = 0; i < NS; i++) {
    float h = (float(i) + .5) / float(NS); float ang = rot + float(i) * 2.399963; float rr = sqrt(1. - h * h);
    vec3 dir = T * cos(ang) * rr + B * sin(ang) * rr + N * h; float dist = radius * mix(.12, 1., h * h);
    vec3 S = P + dir * dist; vec4 c = proj * vec4(S, 1.); vec2 suv = c.xy / c.w * .5 + .5;
    if (suv.x < 0. || suv.x > 1. || suv.y < 0. || suv.y > 1.) continue;
    vec3 Q = viewPos(suv); float diff = Q.z - S.z;
    float range = smoothstep(0., 1., radius / max(abs(P.z - Q.z), 1e-4));
    occ += (diff > bias * (1. + length(P) * .002) ? 1. : 0.) * range;
  }
  float ao = 1. - clamp(occ / float(NS) * intensity, 0., 1.); gl_FragColor = vec4(vec3(ao), 1.);
}`;

const BLUR_FRAG = `${VIEWPOS}
uniform sampler2D tAO; uniform vec2 dir; varying vec2 vUv;
void main(){
  float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.); return; }
  float z0 = viewPos(vUv).z, sum = 0., wsum = 0.;
  for (int i = -4; i <= 4; i++) { vec2 uv = vUv + dir * float(i); float z = viewPos(uv).z; float w = exp(-abs(z - z0) / (abs(z0) * .02 + .02)) * exp(-float(i * i) / 12.); sum += texture2D(tAO, uv).r * w; wsum += w; }
  gl_FragColor = vec4(vec3(sum / max(wsum, 1e-4)), 1.);
}`;

const COMP_FRAG = `uniform sampler2D tColor, tAO; uniform float strength; varying vec2 vUv;
void main(){ vec4 c = texture2D(tColor, vUv); float ao = texture2D(tAO, vUv).r; c.rgb *= mix(1., pow(ao, 1.25), strength); gl_FragColor = vec4(c.rgb, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class AO {
  constructor(renderer) {
    this.r = renderer; this.on = false; this.strength = 0.9; this.radius = 1; this.w = 0; this.h = 0;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.sc = new THREE.Scene(); this.sc.add(this.quad);
    const mk = (frag, uniforms, tone = false) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: tone });
    this.mAO = mk(AO_FRAG, { tDepth: {}, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2() }, radius: { value: 1 }, bias: { value: 0.02 }, intensity: { value: 1.6 } });
    this.mBlur = mk(BLUR_FRAG, { tDepth: {}, projInv: { value: new THREE.Matrix4() }, tAO: {}, dir: { value: new THREE.Vector2() } });
    this.mComp = mk(COMP_FRAG, { tColor: {}, tAO: {}, strength: { value: 1 } }, true);
  }
  _size() {
    const v = this.r.getDrawingBufferSize(new THREE.Vector2()); const w = Math.max(2, v.x | 0), h = Math.max(2, v.y | 0); if (w === this.w && h === this.h && this.rt) return; this.w = w; this.h = h;
    this.rt?.dispose(); this.ao1?.dispose(); this.ao2?.dispose();
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType; dt.format = THREE.DepthFormat; dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: dt, colorSpace: THREE.LinearSRGBColorSpace });
    const o = { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }; this.ao1 = new THREE.WebGLRenderTarget(w, h, o); this.ao2 = new THREE.WebGLRenderTarget(w, h, o);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.sc, this.cam); }
  render(scene, camera, worldRadius = 10) {
    this._size(); const r = this.r;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    camera.updateMatrixWorld(); const pI = camera.projectionMatrixInverse, P = camera.projectionMatrix;
    const u = this.mAO.uniforms; u.tDepth.value = this.rt.depthTexture; u.projInv.value.copy(pI); u.proj.value.copy(P); u.res.value.set(this.w, this.h);
    const dist = camera.isPerspectiveCamera ? Math.max(1, Math.min(worldRadius * 0.15, 3)) : Math.max(0.5, Math.min(worldRadius * 0.1, 3)); u.radius.value = dist * this.radius;
    this.pass(this.mAO, this.ao1);
    const b = this.mBlur.uniforms; b.tDepth.value = this.rt.depthTexture; b.projInv.value.copy(pI);
    b.tAO.value = this.ao1.texture; b.dir.value.set(1 / this.w, 0); this.pass(this.mBlur, this.ao2);
    b.tAO.value = this.ao2.texture; b.dir.value.set(0, 1 / this.h); this.pass(this.mBlur, this.ao1);
    const c = this.mComp.uniforms; c.tColor.value = this.rt.texture; c.tAO.value = this.ao1.texture; c.strength.value = this.strength;
    this.pass(this.mComp, null);
  }
  dispose() { this.rt?.dispose(); this.ao1?.dispose(); this.ao2?.dispose(); }
}
