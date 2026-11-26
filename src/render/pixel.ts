// The pixel-art look (an alternative to the engraved print): the 3D table is drawn small, at a few hundred pixels
// high, then shown with every pixel a crisp block, its colours snapped to a short palette with ordered dithering,
// and a one-pixel ink outline where something stands in front of what lies behind it. The HTML interface on top
// is untouched.
import * as THREE from 'three';

/** The palette, in display (sRGB) colours: ink and woods, brass and parchment, sea, iron, sails, wax and fire. */
const PALETTE = [
  0x0d0b08, 0x1a1208, 0x2a1d12, 0x3e2a17, 0x5c3d1f, 0x7a5228, 0x9a6a34, 0xb08d3c, 0xd9a441, 0xf0d489,
  0xe8d5a3, 0xe0c994, 0xd4bb83, 0xc6ab72, 0xb59a63, 0xa48a57, 0x8d774a, 0x75633e, 0x5c4e32, 0xf3ead6, 0xd8cdb4,
  0x251a10, 0x33261a, 0x4a3826, 0x604a33,
  0x1c2a3a, 0x2f5d63, 0x4f8a8f, 0x8fb8b4,
  0x3b3b39, 0x5e5e5a, 0x8a8a84,
  0x5e1a10, 0x8c2f1b, 0xc0392b, 0xf08a3c, 0xffd27a, 0x7a4f9a,
];
const N = PALETTE.length;

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform vec3 uPal[${N}];
uniform vec3 uGrade;
uniform float uNear, uFar, uDither;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec2 cell = floor(vUv * uRes), px = 1.0 / uRes, uv = (cell + 0.5) * px;
  vec3 c = texture2D(tColor, uv).rgb * uGrade;
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); // into display colours, where the palette lives
  // Ordered dithering: a fixed 4×4 pattern nudges each pixel before it snaps to the nearest palette colour.
  c += (bayer4(cell) - 0.5) * uDither;
  vec3 best = uPal[0]; float bd = 1e9;
  for (int i = 0; i < ${N}; i++) { vec3 d = (c - uPal[i]) * vec3(0.9, 1.2, 0.7); float e = dot(d, d); if (e < bd) { bd = e; best = uPal[i]; } }
  // Ink outline: this pixel is nearer than a neighbour by a clear step (a silhouette edge).
  float d = lin(texture2D(tDepth, uv).r), step = 0.0;
  step = max(step, lin(texture2D(tDepth, uv + vec2(px.x, 0.0)).r) - d);
  step = max(step, lin(texture2D(tDepth, uv - vec2(px.x, 0.0)).r) - d);
  step = max(step, lin(texture2D(tDepth, uv + vec2(0.0, px.y)).r) - d);
  step = max(step, lin(texture2D(tDepth, uv - vec2(0.0, px.y)).r) - d);
  if (step > 0.06 * d) best = mix(best, uPal[1], 0.85);
  gl_FragColor = vec4(best, 1.0);
}`;

export class Pixel {
  private rt: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private flat = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  /** Colour multiplier, as for the print look: warm on your turn, colder on the enemy's. */
  grade = new THREE.Vector3(1, 1, 1);
  /** How many pixels high the table is drawn. */
  static height = 480;
  /** The height actually used now (it follows `height` on the next resize). */
  rows = 480;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(2, 2) },
        uPal: { value: PALETTE.map((h) => new THREE.Color().setHex(h, THREE.LinearSRGBColorSpace)) }, uGrade: { value: new THREE.Vector3(1, 1, 1) },
        uNear: { value: camera.near }, uFar: { value: camera.far }, uDither: { value: 0.035 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.flat.add(this.quad);
  }
  setSize(w: number, h: number) {
    this.rows = Pixel.height;
    const rw = Math.max(2, Math.round(this.rows * w / h));
    this.rt.setSize(rw, this.rows);
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(rw, this.rows);
  }
  render() {
    (this.mat.uniforms.uGrade.value as THREE.Vector3).lerp(this.grade, 0.04);
    this.mat.uniforms.uNear.value = this.camera.near; this.mat.uniforms.uFar.value = this.camera.far;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.flat, this.cam);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); }
}
