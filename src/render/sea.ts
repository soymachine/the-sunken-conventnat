// The sea as a living engraving: a parchment chart whose ink moves.
import * as THREE from 'three';
import { N, cellName } from '../game/rules';

/** Swell height at a world position. The ships ride the same function the shader draws. */
export const waveH = (x: number, z: number, t: number) => 0.045 * Math.sin(x * 0.9 + t * 1.1) + 0.03 * Math.sin(z * 1.3 - t * 0.8 + x * 0.4);

function chartTexture(enemy: boolean): THREE.CanvasTexture {
  const u = 64, m = 32, S = N * u + 2 * m;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = enemy ? '#a88c54' : '#cdb277';
  g.fillRect(0, 0, S, S);
  // Rhumb lines radiating from a compass rose, as on a portolan chart.
  const rx = m + (enemy ? 0.28 : 0.7) * N * u, ry = m + (enemy ? 0.66 : 0.3) * N * u;
  g.strokeStyle = 'rgba(13,11,8,.13)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * S * 2, ry + Math.sin(a) * S * 2); g.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8, r = k % 4 === 0 ? 92 : k % 2 === 0 ? 62 : 38;
    g.fillStyle = k % 2 ? 'rgba(13,11,8,.2)' : 'rgba(13,11,8,.34)';
    g.beginPath(); g.moveTo(rx + Math.cos(a) * r, ry + Math.sin(a) * r);
    g.lineTo(rx + Math.cos(a + 0.2) * 14, ry + Math.sin(a + 0.2) * 14); g.lineTo(rx + Math.cos(a - 0.2) * 14, ry + Math.sin(a - 0.2) * 14); g.fill();
  }
  g.strokeStyle = 'rgba(13,11,8,.3)'; g.lineWidth = 2;
  g.beginPath(); g.arc(rx, ry, 104, 0, 7); g.stroke();
  g.fillStyle = '#17120b';
  g.fillRect(0, 0, S, m); g.fillRect(0, S - m, S, m); g.fillRect(0, 0, m, S); g.fillRect(S - m, 0, m, S);
  g.strokeStyle = 'rgba(13,11,8,.68)';
  for (let i = 0; i <= N; i++) {
    g.lineWidth = i % 4 === 0 ? 2.8 : 1.3;
    g.beginPath(); g.moveTo(m + i * u, m); g.lineTo(m + i * u, S - m); g.stroke();
    g.beginPath(); g.moveTo(m, m + i * u); g.lineTo(S - m, m + i * u); g.stroke();
  }
  g.lineWidth = 5; g.strokeStyle = '#0d0b08'; g.strokeRect(m, m, S - 2 * m, S - 2 * m);
  g.lineWidth = 1.5; g.strokeStyle = '#b08d3c'; g.strokeRect(m - 7, m - 7, S - 2 * m + 14, S - 2 * m + 14);
  g.fillStyle = '#a8946a'; g.font = '600 19px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    g.fillText(cellName(i, 0)[0], m + i * u + u / 2, enemy ? m / 2 - 2 : S - m / 2 + 3);
    g.fillText(String(i + 1), m / 2 - 2, m + i * u + u / 2);
    g.fillText(String(i + 1), S - m / 2 + 2, m + i * u + u / 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float a = w.x * 0.9 + uTime * 1.1, b = w.z * 1.3 - uTime * 0.8 + w.x * 0.4;
  w.y += 0.045 * sin(a) + 0.03 * sin(b);
  vShade = 0.045 * 0.9 * cos(a) + 0.03 * 0.4 * cos(b) - 0.03 * 1.3 * cos(b);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap, uEnergy;
uniform float uTime, uEnemy, uN, uNight, uRing, uFlash;
uniform vec2 uStorm;
varying vec2 vUv;
varying float vShade;
const vec3 INK = vec3(0.004, 0.003, 0.002);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
// Short engraved wave strokes that drift with the wind and fade in and out.
float strokes(vec2 p, float t, float scale) {
  vec2 q = vec2(p.x * 1.5 * scale + t * 0.14, p.y * 3.0 * scale);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 id = floor(q), f = fract(q);
  float r = hash(id);
  float life = 0.5 + 0.5 * sin(t * 0.55 + r * 40.0);
  float y = 0.5 + 0.17 * sin(f.x * 6.2832 + r * 6.0 + t * 1.3);
  float ends = smoothstep(0.06, 0.24, f.x) * smoothstep(0.94, 0.76, f.x);
  return step(0.45, r) * life * ends * smoothstep(0.1, 0.035, abs(f.y - y));
}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * (uN + 1.0) - 0.5;
  vec3 col = texture2D(uMap, vUv).rgb;
  col *= 0.9 + 0.2 * fbm(vUv * 5.0);
  col *= 0.97 + 0.06 * hash(floor(vUv * 1400.0));
  vec2 edge = min(p, uN - p);
  float inside = step(0.0, min(edge.x, edge.y));
  if (inside > 0.5) {
    float ink = strokes(p, uTime, 1.0) * 0.62 + strokes(p + 7.3, uTime * 0.7, 0.55) * 0.34;
    float hatch = 0.5 + 0.5 * sin((p.x + p.y) * 21.0 + fbm(p * 1.3 + uTime * 0.04) * 7.0);
    ink += uEnemy * smoothstep(0.6, 0.95, hatch) * 0.3;
    float e = texture2D(uEnergy, p / uN).r;
    float ring = smoothstep(0.84, 0.98, sin(e * 15.0 - uTime * 2.6)) * smoothstep(0.04, 0.3, e);
    col = mix(col, INK, clamp(ink, 0.0, 0.75));
    col = mix(col, vec3(1.0, 0.95, 0.8), ring * 0.6);
    col = mix(col, INK, smoothstep(0.86, 0.99, sin(e * 15.0 - uTime * 2.6 - 0.9)) * smoothstep(0.1, 0.4, e) * 0.5);
    col *= 1.0 - 0.3 * smoothstep(1.4, 0.0, min(edge.x, edge.y));
    col *= 0.97 + 2.2 * vShade;
    // Storm front: rows darken under slanting rain and flare with lightning.
    float st = uStorm.y * step(uStorm.x, p.y) * step(p.y, uStorm.x + 3.0);
    float rain = step(0.78, fract(p.x * 3.0 + p.y * 9.0 + uTime * 3.5));
    col = mix(col, INK, st * (0.5 + 0.22 * rain));
    col += st * uFlash * vec3(0.9, 0.8, 0.55);
    // Maelstrom: the drowned rim churns in ink.
    float rim = step(0.5, uRing) * step(min(edge.x, edge.y), uRing);
    vec2 c = p - uN * 0.5;
    float swirl = 0.5 + 0.5 * sin(atan(c.y, c.x) * 9.0 + length(c) * 2.4 - uTime * 2.2);
    col = mix(col, INK * 3.0, rim * (0.74 + 0.2 * swirl));
    col = mix(col, vec3(0.6, 0.42, 0.14), rim * smoothstep(0.9, 1.0, swirl) * 0.35);
    // The Kraken turns the chart to night: paper goes dark, ink glows amber.
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    vec3 night = mix(vec3(0.4, 0.24, 0.05), vec3(0.012, 0.01, 0.008), smoothstep(0.0, 0.07, lum));
    col = mix(col, night, uNight);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sea {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private energy = new Float32Array(N * N);
  private bytes = new Uint8Array(N * N);
  private tex: THREE.DataTexture;

  constructor(enemy: boolean) {
    this.tex = new THREE.DataTexture(this.bytes, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uMap: { value: chartTexture(enemy) }, uEnergy: { value: this.tex }, uTime: { value: 0 }, uEnemy: { value: enemy ? 1 : 0 }, uN: { value: N }, uNight: { value: 0 }, uRing: { value: 0 }, uFlash: { value: 0 }, uStorm: { value: new THREE.Vector2(0, 0) } },
    });
    const geo = new THREE.PlaneGeometry(N + 1, N + 1, 80, 80);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
  }

  /** Add a burst of disturbance at a cell (a splash, a wake). */
  bump(x: number, y: number, v: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const i = b * N + a;
      this.energy[i] = Math.min(1, this.energy[i] + (dx || dy ? v * 0.35 : v));
    }
  }
  /** Keep a cell at least this disturbed (a hull sitting in the water). */
  hold(x: number, y: number, v: number) {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = y * N + x;
    if (this.energy[i] < v) this.energy[i] = Math.min(v, this.energy[i] + 0.04);
  }
  clear() { this.energy.fill(0); this.night = 0; }

  /** Target darkness of this chart (1 while the Kraken holds it). */
  night = 0;
  setStorm(row: number | null) { (this.mat.uniforms.uStorm.value as THREE.Vector2).set(row ?? 0, row === null ? 0 : 1); }
  setRing(ring: number) { this.mat.uniforms.uRing.value = ring; }
  flash() { this.mat.uniforms.uFlash.value = 1; }

  update(dt: number, t: number) {
    const k = Math.exp(-dt * 0.8);
    for (let i = 0; i < this.energy.length; i++) { this.energy[i] *= k; this.bytes[i] = this.energy[i] * 255; }
    this.tex.needsUpdate = true;
    this.mat.uniforms.uTime.value = t;
    const u = this.mat.uniforms;
    u.uNight.value += (this.night - u.uNight.value) * Math.min(1, dt * 1.6);
    u.uFlash.value *= Math.exp(-dt * 9);
  }
}
