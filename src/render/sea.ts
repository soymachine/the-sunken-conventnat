// The sea as a living engraving: a parchment chart whose ink moves.
import * as THREE from 'three';
import { N, cellName } from '../game/rules';

/** Swell height at a world position. The ships ride the same function the shader draws. */
export const waveH = (x: number, z: number, t: number) =>
  0.17 * Math.sin(x * 0.42 + t * 0.75) + 0.1 * Math.sin(z * 0.55 - t * 0.6 + x * 0.22) + 0.03 * Math.sin((x + z) * 1.3 + t * 1.4);

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

// A tide is a single wave crossing the chart: uTide = (dx, dy, start time, on).
const TIDE = /* glsl */ `
uniform vec4 uTide;
uniform float uN;
float tideAlong(vec2 p) { return uTide.x * p.x + uTide.y * p.y + (uTide.x + uTide.y < 0.0 ? uN : 0.0); }
float tideFront() { return (uTime - uTide.z) * 3.2 - 2.5; }`;

const VERT = /* glsl */ `
uniform float uTime;
${TIDE}
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 tp = vec2(uv.x, 1.0 - uv.y) * (uN + 1.0) - 0.5;
  float td = tideAlong(tp) - tideFront();
  w.y += uTide.w * (0.3 * exp(-td * td * 1.4) - 0.08 * exp(-(td - 1.1) * (td - 1.1) * 1.5));
  // The whole sheet bends in long swells, like parchment lifted by the sea beneath it.
  float a = w.x * 0.42 + uTime * 0.75, b = w.z * 0.55 - uTime * 0.6 + w.x * 0.22, c = (w.x + w.z) * 1.3 + uTime * 1.4;
  w.y += 0.17 * sin(a) + 0.1 * sin(b) + 0.03 * sin(c);
  vShade = 0.17 * 0.42 * cos(a) + 0.1 * (0.22 - 0.55) * cos(b) + 0.03 * 1.3 * cos(c) * 0.5;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap, uEnergy;
uniform float uTime, uEnemy, uNight, uRing, uFlash;
// Hulls on this chart: uHull = (x, y, heading, half length), uHull2 = (half beam, speed 0..1, afloat, 0).
#define MAXH 14
uniform vec4 uHull[MAXH];
uniform vec4 uHull2[MAXH];
uniform int uHullN;
uniform float uWake;

${TIDE}
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
    col *= 0.97 + 2.6 * vShade;

    // ---- water around the hulls (style chosen by uWake) ----
    if (uWake > 0.5 && uHullN > 0) {
      float dMin = 9.0, aN = 0.0, lN = 1.0, bN = 0.3, sN = 0.0, wake = 0.0, churn = 0.0;
      for (int i = 0; i < MAXH; i++) {
        if (i >= uHullN) break;
        vec4 h = uHull[i], h2 = uHull2[i];
        vec2 dir = vec2(cos(h.z), sin(h.z)), v = p - h.xy;
        float a = dot(v, dir), c = dot(v, vec2(-dir.y, dir.x)), L = h.w, B = h2.x;
        float d = length(vec2(max(abs(a) - (L - B), 0.0), c)) - B;
        if (d < dMin) { dMin = d; aN = a; lN = L; bN = B; sN = h2.y; }
        // A moving hull draws a V of waves behind her stern and churns the water in her track.
        float t = -a - (L - B);
        if (h2.y > 0.02 && t > 0.0) {
          float arm = abs(abs(c) - t * 0.36);
          wake += h2.y * exp(-t * 0.32) * smoothstep(0.09, 0.0, arm) * (0.6 + 0.4 * sin(t * 9.0 - uTime * 6.0));
          churn += h2.y * exp(-t * 0.55) * smoothstep(B * 1.1, 0.0, abs(c));
        }
      }
      float d = dMin, near = step(0.0, d);
      float bow = smoothstep(lN * 0.35, lN, aN);
      if (uWake < 1.5) {
        // 1 · Engraved contours: ink lines that follow the hull and drift slowly outwards.
        float f = fract(d * 4.2 - uTime * 0.28);
        float line = smoothstep(0.1, 0.0, abs(f - 0.5) - 0.37) * exp(-d * 1.5) * near;
        line *= 0.55 + 0.45 * smoothstep(0.25, 0.65, noise(p * 3.0 + uTime * 0.1));
        col = mix(col, INK, clamp(line * 0.7, 0.0, 0.7));
        col = mix(col, vec3(0.99, 0.95, 0.85), smoothstep(0.05, 0.0, abs(d - 0.03)) * 0.55);
      } else if (uWake < 2.5) {
        // 2 · Foam and shadow: lace of foam hugging the hull, heavier at the bow, over a darker trough.
        col *= 1.0 - 0.28 * exp(-max(d, 0.0) * 5.0) * near;
        float lace = smoothstep(0.38, 0.62, noise(p * 13.0 + vec2(uTime * 0.7, -uTime * 0.4)));
        float foam = smoothstep(0.13 + 0.16 * bow, 0.0, d) * near * (0.45 + 0.55 * lace);
        col = mix(col, vec3(0.99, 0.96, 0.88), clamp(foam, 0.0, 0.9));
      } else if (uWake < 3.5) {
        // 3 · Hatched water: the sea shaded in fine diagonal strokes close to the hull, like an engraving.
        float band = exp(-d * 2.4) * near;
        float hatch = smoothstep(0.55, 0.85, sin((p.x - p.y) * 46.0 + noise(p * 4.0) * 2.0));
        float cross = smoothstep(0.7, 0.95, sin((p.x + p.y) * 46.0)) * smoothstep(0.25, 0.0, d);
        col = mix(col, INK, clamp((hatch * band + cross * near) * 0.85, 0.0, 0.8));
        col = mix(col, vec3(0.99, 0.95, 0.85), smoothstep(0.035, 0.0, abs(d - 0.025)) * 0.7);
      } else {
        // 4 · Ripples: crisp rings that leave the hull and fade, light crest and dark trough.
        float r1 = fract(uTime * 0.45), r2 = fract(uTime * 0.45 + 0.5);
        float ring = 0.0, trough = 0.0;
        for (int k = 0; k < 2; k++) {
          float r = k == 0 ? r1 : r2, at = r * 0.85, fade = (1.0 - r) * (1.0 - r);
          ring += smoothstep(0.045, 0.0, abs(d - at)) * fade;
          trough += smoothstep(0.05, 0.0, abs(d - at + 0.07)) * fade;
        }
        col = mix(col, INK, clamp(trough * 0.45 * near, 0.0, 0.5));
        col = mix(col, vec3(1.0, 0.97, 0.88), clamp(ring * 0.8 * near, 0.0, 0.8));
        col = mix(col, vec3(0.99, 0.95, 0.85), smoothstep(0.06, 0.0, d) * near * 0.5);
      }
      col = mix(col, vec3(1.0, 0.97, 0.88), clamp(wake * 1.1 + churn * 0.5 * smoothstep(0.4, 0.75, noise(p * 9.0 - uTime)), 0.0, 0.8));
      col = mix(col, INK, clamp(wake * 0.25, 0.0, 0.3));
    }
    // Storm front: rows darken under slanting rain and flare with lightning.
    float st = uStorm.y * step(uStorm.x, p.y) * step(p.y, uStorm.x + 3.0);
    // Raindrops ring the wet paper where they land.
    vec2 rp = p * 3.2, ri = floor(rp), rf = fract(rp) - 0.5;
    float rh = hash(ri), rt = fract(uTime * 1.4 + rh);
    vec2 off = (vec2(hash(ri + 3.1), hash(ri + 7.7)) - 0.5) * 0.45;
    float drop = smoothstep(0.045, 0.0, abs(length(rf - off) - rt * 0.42)) * (1.0 - rt);
    col = mix(col, INK, st * 0.55);
    col = mix(col, vec3(0.93, 0.9, 0.8), st * drop * 0.55);
    col += st * uFlash * vec3(0.9, 0.8, 0.55);
    // High tide: a crest of foam sweeps across, leaving the paper soaked behind it to dry.
    if (uTide.w > 0.0) {
      float along = tideAlong(p), perp = abs(uTide.x) > 0.5 ? p.y : p.x;
      float d = along - tideFront() + 0.22 * sin(perp * 2.3 + uTime * 1.7) + 0.1 * sin(perp * 5.1 - uTime * 2.3);
      float since = (tideFront() - along) / 3.2;
      float wet = smoothstep(0.0, 1.5, -d) * clamp(1.0 - since * 0.1, 0.0, 1.0);
      col = mix(col, col * 0.5, wet * 0.7);
      col += wet * 0.1 * smoothstep(0.75, 1.0, sin(along * 6.0 + noise(p * 2.0) * 4.0)) * vec3(1.0, 0.95, 0.8);
      // Foam just behind the crest, broken into lace.
      float body = smoothstep(-1.1, -0.2, d) * smoothstep(0.35, 0.05, d);
      float lace = smoothstep(0.35, 0.62, noise(p * 14.0 + vec2(uTime * 2.0, 0.0)));
      col = mix(col, vec3(0.98, 0.95, 0.86), body * (0.5 + 0.42 * lace));
      // Engraved breaker lines: the leading edge and two echoes behind it.
      float lines = smoothstep(0.07, 0.0, abs(d - 0.32))
        + 0.7 * smoothstep(0.05, 0.0, abs(d + 0.45 + 0.08 * sin(perp * 7.0)))
        + 0.5 * smoothstep(0.045, 0.0, abs(d + 1.2 + 0.1 * sin(perp * 5.0 + 1.0)));
      col = mix(col, INK, clamp(lines, 0.0, 1.0) * 0.75);
      // Spray stippled ahead of it, and the trough it draws in front.
      col = mix(col, INK, step(0.982, hash(floor(p * 40.0))) * smoothstep(1.3, 0.4, d) * step(0.35, d) * 0.65);
      col *= 1.0 - 0.22 * exp(-(d - 1.0) * (d - 1.0) * 1.5);
    }
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
      uniforms: { uMap: { value: chartTexture(enemy) }, uEnergy: { value: this.tex }, uTime: { value: 0 }, uEnemy: { value: enemy ? 1 : 0 }, uN: { value: N }, uNight: { value: 0 }, uRing: { value: 0 }, uFlash: { value: 0 }, uStorm: { value: new THREE.Vector2(0, 0) }, uTide: { value: new THREE.Vector4(1, 0, -99, 0) },
        uHull: { value: Array.from({ length: 14 }, () => new THREE.Vector4()) }, uHull2: { value: Array.from({ length: 14 }, () => new THREE.Vector4()) }, uHullN: { value: 0 }, uWake: { value: Sea.wake } },
    });
    const geo = new THREE.PlaneGeometry(N + 1, N + 1, 96, 96);
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
  clear() { this.energy.fill(0); this.night = 0; (this.mat.uniforms.uTide.value as THREE.Vector4).w = 0; }

  /** How the water is drawn around hulls: 0 the old stirred rings, 1 contours, 2 foam, 3 hatching, 4 ripples. */
  static wake = 3;
  /** The hulls on this chart, in chart squares: centre, heading (radians, x towards y), half length, half beam, speed 0..1. */
  setHulls(list: { x: number; y: number; dir: number; half: number; beam: number; speed: number }[]) {
    const u = this.mat.uniforms, a = u.uHull.value as THREE.Vector4[], b = u.uHull2.value as THREE.Vector4[];
    const n = Math.min(14, list.length);
    for (let i = 0; i < n; i++) { const h = list[i]; a[i].set(h.x, h.y, h.dir, h.half); b[i].set(h.beam, h.speed, 1, 0); }
    u.uHullN.value = n;
    u.uWake.value = Sea.wake;
  }

  /** Target darkness of this chart (1 while the Kraken holds it). */
  night = 0;
  setStorm(row: number | null) { (this.mat.uniforms.uStorm.value as THREE.Vector2).set(row ?? 0, row === null ? 0 : 1); }
  setRing(ring: number) { this.mat.uniforms.uRing.value = ring; }
  flash() { this.mat.uniforms.uFlash.value = 1; }
  /** Send a tide wave across the chart in direction (dx, dy), starting at time t. */
  tide(dx: number, dy: number, t: number) { (this.mat.uniforms.uTide.value as THREE.Vector4).set(dx, dy, t, 1); }

  update(dt: number, t: number) {
    const k = Math.exp(-dt * 0.8);
    for (let i = 0; i < this.energy.length; i++) { this.energy[i] *= k; this.bytes[i] = this.energy[i] * 255; }
    this.tex.needsUpdate = true;
    this.mat.uniforms.uTime.value = t;
    const u = this.mat.uniforms;
    u.uNight.value += (this.night - u.uNight.value) * Math.min(1, dt * 1.6);
    u.uFlash.value *= Math.exp(-dt * 9);
    const td = u.uTide.value as THREE.Vector4;
    if (td.w && t - td.z > 18) td.w = 0;
  }
}
