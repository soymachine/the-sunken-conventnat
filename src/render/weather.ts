// Weather over the charts: rain under the storm front, lightning, drifting sea mist and gulls.
// Everything that moves in numbers (rain, mist) is animated on the GPU from a time uniform.
import * as THREE from 'three';
import { N } from '../game/rules';

/* ---------- rain ---------- */
const RAIN_VERT = /* glsl */ `
attribute vec3 aSeed;
attribute float aEnd;
uniform float uTime, uTop, uOn;
uniform vec4 uBox;
uniform vec2 uWind;
varying float vA;
void main() {
  float h = uTop + 0.4, fall = 13.0;
  float y = uTop - mod(uTime * fall * (0.85 + 0.3 * aSeed.z) + aSeed.z * 97.0, h);
  vec3 p = vec3(uBox.x + aSeed.x * uBox.z, y, uBox.y + aSeed.y * uBox.w);
  // Drops are blown sideways as they fall, and each streak trails up-wind.
  p.xz += uWind * (uTop - y) / fall;
  p += aEnd * vec3(-uWind.x / fall, 1.0, -uWind.y / fall) * 0.6;
  vA = (1.0 - 0.85 * aEnd) * smoothstep(-0.2, 0.5, y) * smoothstep(uTop, uTop * 0.35, y) * uOn;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = /* glsl */ `
varying float vA;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(0.86, 0.84, 0.76, vA * 0.55);
  #include <colorspace_fragment>
}`;

class Rain {
  mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  private on = 0; private want = 0;
  constructor(count: number) {
    const seed = new Float32Array(count * 6), end = new Float32Array(count * 2), pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const s = [Math.random(), Math.random(), Math.random()];
      seed.set(s, i * 6); seed.set(s, i * 6 + 3);
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uTop: { value: 4.5 }, uOn: { value: 0 }, uBox: { value: new THREE.Vector4() }, uWind: { value: new THREE.Vector2(2.2, 0.9) } },
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
  /** Rain over a box of the world (x, z, width, depth), or none. */
  set(box: [number, number, number, number] | null) {
    this.want = box ? 1 : 0;
    if (box) (this.mat.uniforms.uBox.value as THREE.Vector4).set(...box);
  }
  update(dt: number, t: number) {
    this.on += (this.want - this.on) * Math.min(1, dt * 1.5);
    this.mat.uniforms.uOn.value = this.on;
    this.mat.uniforms.uTime.value = t;
    this.mesh.visible = this.on > 0.01;
  }
}

/* ---------- lightning ---------- */
class Bolt {
  group = new THREE.Group();
  light = new THREE.PointLight(0xfff0c8, 0, 16, 1.4);
  private core = new THREE.MeshBasicMaterial({ color: 0xfff8e6, transparent: true, depthWrite: false });
  private glow = new THREE.MeshBasicMaterial({ color: 0xffc966, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  private life = 0;
  constructor() { this.group.add(this.light); }

  strike(at: THREE.Vector3) {
    for (const c of [...this.group.children]) if (c !== this.light) { this.group.remove(c); (c as THREE.Mesh).geometry.dispose(); }
    const path = (from: THREE.Vector3, to: THREE.Vector3, steps: number, jag: number) => {
      const pts = [from.clone()];
      for (let i = 1; i < steps; i++) {
        const k = i / steps, p = from.clone().lerp(to, k);
        p.x += (Math.random() - 0.5) * jag * (1 - k * 0.7); p.z += (Math.random() - 0.5) * jag * (1 - k * 0.7);
        pts.push(p);
      }
      pts.push(to.clone());
      return pts;
    };
    const tube = (pts: THREE.Vector3[], r: number) => {
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < pts.length; i++) curve.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
      return new THREE.TubeGeometry(curve as unknown as THREE.Curve<THREE.Vector3>, pts.length * 4, r, 5, false);
    };
    // The camera looks almost straight down, so the bolt leans in from the far sky to read as a long stroke.
    const top = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 9, -8 - Math.random() * 3));
    const main = path(top, at, 16, 1.6);
    const fork = main[5 + Math.floor(Math.random() * 3)];
    const twig = path(fork, fork.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, -3.5, (Math.random() - 0.5) * 3)), 6, 0.9);
    for (const pts of [main, twig]) {
      const thin = pts === twig ? 0.6 : 1;
      this.group.add(new THREE.Mesh(tube(pts, 0.05 * thin), this.core), new THREE.Mesh(tube(pts, 0.2 * thin), this.glow));
    }
    this.light.position.copy(at).setY(1.6);
    this.life = 0.42;
  }
  update(dt: number) {
    this.life = Math.max(0, this.life - dt);
    // A stroke flickers two or three times before it dies.
    const k = this.life / 0.42, flick = this.life > 0 ? (Math.sin(this.life * 70) > -0.3 ? 1 : 0.25) * k : 0;
    this.core.opacity = flick; this.glow.opacity = flick * 0.6;
    this.light.intensity = flick * 140;
    for (const c of this.group.children) if (c !== this.light) c.visible = this.life > 0;
  }
}

/* ---------- sea mist ---------- */
const MIST_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const MIST_FRAG = /* glsl */ `
uniform float uTime, uThick;
uniform vec4 uRect;
varying vec3 vW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
void main() {
  vec2 p = vW.xz * 0.085;
  vec2 drift = vec2(uTime * 0.018, uTime * 0.006);
  float n = fbm(p + drift + 0.6 * fbm(p * 1.7 - drift * 1.6));
  float bank = smoothstep(0.48, 0.78, n);
  vec2 q = (vW.xz - uRect.xy) / uRect.zw;
  float edge = smoothstep(0.0, 0.12, q.x) * smoothstep(1.0, 0.88, q.x) * smoothstep(0.0, 0.12, q.y) * smoothstep(1.0, 0.88, q.y);
  float a = bank * edge * uThick;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.9, 0.85, 0.72), a);
  #include <colorspace_fragment>
}`;

class Mist {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor() {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uThick: { value: 0.2 }, uRect: { value: new THREE.Vector4() } },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 4;
  }
  /** Cover a rectangle of the world (x, z, width, depth). */
  cover(x: number, z: number, w: number, d: number) {
    this.mesh.position.set(x + w / 2, 0.9, z + d / 2);
    this.mesh.scale.set(w, 1, d);
    (this.mat.uniforms.uRect.value as THREE.Vector4).set(x, z, w, d);
  }
  update(t: number, thick: number) { this.mat.uniforms.uTime.value = t; this.mat.uniforms.uThick.value += (thick - this.mat.uniforms.uThick.value) * 0.02; }
}

/* ---------- gulls ---------- */
interface Gull { body: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; c: THREE.Vector2; rad: number; h: number; sp: number; ph: number; up: number }
function wing(side: 1 | -1) {
  const g = new THREE.BufferGeometry();
  // A crooked gull's wing: up from the body to the wrist, then down to a swept tip.
  const v = [0, 0, 0.07, 0, 0, -0.07, side * 0.22, 0.05, -0.02, 0, 0, -0.07, side * 0.22, 0.05, -0.02, side * 0.24, 0.05, 0.05, side * 0.22, 0.05, -0.02, side * 0.46, -0.03, -0.12, side * 0.24, 0.05, 0.05];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

class Gulls {
  group = new THREE.Group();
  private birds: Gull[] = [];
  /** 0 = over the charts, 1 = gone. The flock comes and goes on its own, and keeps away from storms. */
  private away = 1;
  private present = false;
  private timer = 6 + Math.random() * 10;
  private exit = new THREE.Vector2(1, 0);
  constructor(count: number) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1b150d, side: THREE.DoubleSide });
    const bodyGeo = new THREE.ConeGeometry(0.045, 0.32, 5); bodyGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const body = new THREE.Group(), l = new THREE.Mesh(wing(-1), mat), r = new THREE.Mesh(wing(1), mat), b = new THREE.Mesh(bodyGeo, mat);
      for (const m of [l, r, b]) m.castShadow = true;
      body.add(l, r, b);
      body.scale.setScalar(1.6);
      body.visible = false;
      this.group.add(body);
      this.birds.push({ body, l, r, c: new THREE.Vector2(), rad: 0, h: 0, sp: 0, ph: Math.random() * 6.28, up: 0 });
    }
  }
  /** The flock flies together in a loose V, wheeling slowly over the charts. */
  update(dt: number, t: number, flee: boolean) {
    if ((this.timer -= dt) < 0) {
      this.present = !this.present;
      this.timer = this.present ? 30 + Math.random() * 40 : 40 + Math.random() * 80;
      const a = Math.random() * Math.PI * 2; this.exit.set(Math.cos(a), Math.sin(a));
    }
    const want = this.present && !flee ? 0 : 1;
    this.away += (want - this.away) * Math.min(1, dt * 0.35);
    // The leader circles a wide loop over both charts; the others hold station behind it.
    const w = 0.11, a = t * w;
    const lead = new THREE.Vector3(13 * Math.cos(a), 6 + 0.6 * Math.sin(t * 0.4), 6 * Math.sin(a));
    const vel = new THREE.Vector3(-13 * Math.sin(a), 0, 6 * Math.cos(a)).normalize();
    // Arriving and leaving, the whole flock swings in from (or off towards) the horizon.
    const e = this.away * this.away;
    lead.x += this.exit.x * e * 45; lead.z += this.exit.y * e * 30; lead.y += e * 8;
    const yaw = Math.atan2(vel.x, vel.z), side = new THREE.Vector3(vel.z, 0, -vel.x);
    this.birds.forEach((g, i) => {
      const rank = Math.ceil(i / 2), s = i === 0 ? 0 : i % 2 ? 1 : -1;
      const p = lead.clone().addScaledVector(vel, -rank * 0.9).addScaledVector(side, s * rank * 0.75);
      p.x += 0.25 * Math.sin(t * 0.9 + g.ph); p.y += 0.2 * Math.sin(t * 1.1 + g.ph * 2); p.z += 0.25 * Math.cos(t * 0.8 + g.ph);
      g.body.position.copy(p);
      // The model's head points +z: face along the flight and bank gently into the turn.
      g.body.rotation.set(0, yaw, -0.22);
      const flap = Math.sin(t * 1.3 + g.ph) > 0.1 ? Math.sin(t * 11 + g.ph) : 0.15;
      g.l.rotation.z = -0.5 * flap; g.r.rotation.z = 0.5 * flap;
      g.body.visible = this.away < 0.97;
    });
  }
  /** True while the flock is overhead (for their cries). */
  get here() { return this.away < 0.4; }
}

/* ---------- shafts of sunlight ---------- */
const RAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RAY_FRAG = /* glsl */ `
uniform float uTime, uOn, uSeed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // Soft across the shaft, brightest a little below the top, dying away towards the chart.
  float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
  // They reach right down onto the paper, fading only at the very ends.
  float along = smoothstep(1.0, 0.8, vUv.y) * (0.55 + 0.45 * vUv.y) * smoothstep(0.0, 0.06, vUv.y);
  float motes = 0.75 + 0.25 * noise(vec2(vUv.x * 6.0 + uSeed, vUv.y * 3.0 - uTime * 0.12));
  float flicker = 0.85 + 0.15 * sin(uTime * 0.6 + uSeed * 4.0);
  float a = across * across * along * motes * flicker * uOn;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.58) * a * 0.4, 1.0);
}`;

/** A few shafts of sunlight slanting in from the upper left onto your chart, now and then, swaying a little. */
class SunRays {
  group = new THREE.Group();
  private rays: { m: THREE.Mesh; mat: THREE.ShaderMaterial; to: THREE.Vector3; w: number; ph: number }[] = [];
  private on = 0; private want = 0; private timer = 25 + Math.random() * 30;
  private from = new THREE.Vector3(); private target = new THREE.Vector3();
  constructor() {
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.ShaderMaterial({ vertexShader: RAY_VERT, fragmentShader: RAY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uSeed: { value: Math.random() * 10 } } });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 6;
      this.group.add(m);
      this.rays.push({ m, mat, to: new THREE.Vector3(), w: 1.4 + Math.random() * 1.6, ph: Math.random() * 6.28 });
    }
  }
  /** Aim at a chart: its top-left corner in the world. */
  aim(chart: { x: number; z: number }) {
    this.target.set(chart.x + N * 0.55, 0, chart.z + N * 0.55);
    this.from.set(chart.x - 9, 16, chart.z - 12);
    this.rays.forEach((r, i) => r.to.set(this.target.x + (i - 2) * 2.6, 0, this.target.z + (i % 2 ? 1.5 : -1.5)));
  }
  update(dt: number, t: number, cam: THREE.Camera, allowed: boolean) {
    if ((this.timer -= dt) < 0) { this.want = this.want ? 0 : 1; this.timer = this.want ? 20 + Math.random() * 20 : 45 + Math.random() * 60; }
    this.on += ((allowed ? this.want : 0) - this.on) * Math.min(1, dt * 0.3);
    this.group.visible = this.on > 0.01;
    if (!this.group.visible) return;
    for (const r of this.rays) {
      // Each shaft sways slowly across the chart, and turns its face to the camera about its own length.
      const to = r.to.clone().add(new THREE.Vector3(0.9 * Math.sin(t * 0.07 + r.ph), 0, 0.6 * Math.cos(t * 0.05 + r.ph)));
      const top = this.from.clone().add(new THREE.Vector3((to.x - this.target.x) * 0.15, 0, 0));
      const axis = top.clone().sub(to), len = axis.length(); axis.normalize();
      const mid = top.clone().add(to).multiplyScalar(0.5), toCam = cam.position.clone().sub(mid);
      const n = toCam.sub(axis.clone().multiplyScalar(toCam.dot(axis))).normalize(), x = new THREE.Vector3().crossVectors(axis, n);
      r.m.matrix.makeBasis(x.multiplyScalar(r.w * (0.9 + 0.1 * Math.sin(t * 0.3 + r.ph))), axis.multiplyScalar(len), n).setPosition(mid);
      r.mat.uniforms.uTime.value = t; r.mat.uniforms.uOn.value = this.on;
    }
  }
}

/* ---------- the lot ---------- */
export class Weather {
  group = new THREE.Group();
  private rain: Rain[] = [new Rain(1300), new Rain(1300)];
  private bolt = new Bolt();
  private mist = new Mist();
  private gulls = new Gulls(7);
  private sun = new SunRays();
  private stormy = false;
  constructor() {
    this.group.add(this.rain[0].mesh, this.rain[1].mesh, this.bolt.group, this.mist.mesh, this.gulls.group, this.sun.group);
  }
  /** Where the two charts lie (their top-left corners in the world). */
  private charts: { x: number; z: number }[] = [];
  setCharts(a: { x: number; z: number }, b: { x: number; z: number }) {
    this.charts = [a, b];
    this.sun.aim(a);
    const x0 = Math.min(a.x, b.x) - 2, z0 = Math.min(a.z, b.z) - 2, x1 = Math.max(a.x, b.x) + N + 2, z1 = Math.max(a.z, b.z) + N + 2;
    this.mist.cover(x0, z0, x1 - x0, z1 - z0);
  }
  /** A storm front over three rows from `row`, on both charts; null when the sky clears. */
  setStorm(row: number | null) {
    this.stormy = row !== null;
    this.charts.forEach((c, i) => this.rain[i].set(row === null ? null : [c.x - 0.6, c.z + row - 0.4, N + 1.2, 3.8]));
  }
  strike(at: THREE.Vector3) { this.bolt.strike(at); }
  update(dt: number, t: number, cam: THREE.Camera) {
    for (const r of this.rain) r.update(dt, t);
    this.bolt.update(dt);
    this.mist.update(t, this.stormy ? 0.32 : 0.2);
    this.gulls.update(dt, t, this.stormy);
    if (this.charts.length) this.sun.update(dt, t, cam, !this.stormy);
  }
  /** The gulls are overhead (so they may cry). */
  get gullsHere() { return this.gulls.here; }
}
