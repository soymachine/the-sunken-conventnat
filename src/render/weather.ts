// Weather over the charts: rain under the storm front, lightning, drifting sea mist and gulls.
// Everything that moves in numbers (rain, mist) is animated on the GPU from a time uniform.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { N } from '../game/rules';
import { inkMaterial } from './ships';

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

/** One gull with a mind of its own: it flies in from the horizon, wanders over the charts from one point
 *  to the next, turning no faster than a bird can and banking into each turn, flaps to climb and glides
 *  to sink, then heads off and is gone. */
class Gull {
  obj = new THREE.Group();
  private pos = new THREE.Vector3(); private vel = new THREE.Vector3(); private goal = new THREE.Vector3();
  private bank = 0; private flapAmp = 0; private flapPh = Math.random() * 6.28; private life = 0; private leaving = false;
  active = false;
  private base: Float32Array | null = null;
  private geos: THREE.BufferGeometry[] = [];
  constructor(model: THREE.Object3D) {
    const m = model.clone(true);
    // Each bird bends its own wings, so it needs its own copy of the geometry.
    m.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.geometry = me.geometry.clone(); this.geos.push(me.geometry); me.castShadow = true; } });
    this.base = this.geos.length ? (this.geos[0].attributes.position.array as Float32Array).slice() : null;
    m.scale.setScalar(1.7);
    this.obj.add(m);
    this.obj.visible = false;
  }
  /** Fly in from a point beyond the charts, over `area` (centre, half-width, half-depth). */
  launch(area: THREE.Vector3, w: number, d: number, delay: number) {
    const a = Math.random() * Math.PI * 2;
    this.pos.set(area.x + Math.cos(a) * (w + 14), 8 + Math.random() * 2, area.z + Math.sin(a) * (d + 10));
    this.vel.set(area.x - this.pos.x, -1, area.z - this.pos.z).normalize().multiplyScalar(3.2);
    this.life = -delay; this.leaving = false; this.active = true; this.bank = 0;
    this.area = area; this.w = w; this.d = d;
    this.pickGoal();
  }
  private area = new THREE.Vector3(); private w = 10; private d = 8;
  private pickGoal() {
    if (this.leaving) {
      const a = Math.atan2(this.vel.z, this.vel.x) + (Math.random() - 0.5) * 1.2;
      this.goal.set(this.pos.x + Math.cos(a) * 60, 12, this.pos.z + Math.sin(a) * 45);
    } else this.goal.set(this.area.x + (Math.random() * 2 - 1) * this.w, 4.2 + Math.random() * 2.6, this.area.z + (Math.random() * 2 - 1) * this.d);
  }
  leave() { if (!this.leaving) { this.leaving = true; this.pickGoal(); } }
  update(dt: number, t: number) {
    if (!this.active) return;
    this.life += dt;
    if (this.life < 0) return;
    this.obj.visible = true;
    // Steer: turn towards the goal at a bird's rate, keep a gull's cruising speed.
    const to = this.goal.clone().sub(this.pos), flat = new THREE.Vector3(to.x, 0, to.z);
    if (flat.length() < 2.5 && !this.leaving) this.pickGoal();
    const head = Math.atan2(this.vel.x, this.vel.z), want = Math.atan2(flat.x, flat.z);
    const turn = Math.max(-0.75, Math.min(0.75, Math.atan2(Math.sin(want - head), Math.cos(want - head)) * 1.2));
    const h = head + turn * dt, speed = this.leaving ? 4.2 : 3.2;
    const climb = Math.max(-1, Math.min(1, to.y * 0.6));
    this.vel.set(Math.sin(h) * speed, climb, Math.cos(h) * speed);
    this.pos.addScaledVector(this.vel, dt);
    // Bank into the turn; flap when climbing or turning hard, glide otherwise.
    this.bank += (-turn * 0.9 - this.bank) * Math.min(1, dt * 2.5);
    const wantFlap = climb > 0.15 || Math.abs(turn) > 0.5 || this.life < 1.5 ? 1 : 0.08;
    this.flapAmp += (wantFlap - this.flapAmp) * Math.min(1, dt * 1.5);
    this.flapPh += dt * 9.5;
    this.obj.position.copy(this.pos);
    this.obj.rotation.set(-climb * 0.25, h, this.bank, 'YXZ');
    this.bend(Math.sin(this.flapPh) * 0.55 * this.flapAmp + 0.04);
    // Gone once it is far beyond the charts.
    if (this.leaving && this.pos.distanceTo(this.area) > 55) { this.active = false; this.obj.visible = false; }
  }
  /** Raise or lower both wings about the shoulders, the outer wing a little more than the inner. */
  private bend(a: number) {
    if (!this.base) return;
    const g = this.geos[0], pos = g.attributes.position.array as Float32Array, b = this.base;
    const sh = 0.08;
    for (let i = 0; i < pos.length; i += 3) {
      const x = b[i], ax = Math.abs(x);
      if (ax <= sh) { pos[i] = x; pos[i + 1] = b[i + 1]; pos[i + 2] = b[i + 2]; continue; }
      const r = ax - sh, ang = a * (1 + 0.6 * Math.min(1, r / 0.35)), s = Math.sign(x);
      // Model: wings along x, up is y (glTF), the shoulder near x = ±sh.
      pos[i] = s * (sh + r * Math.cos(ang)); pos[i + 1] = b[i + 1] + r * Math.sin(ang); pos[i + 2] = b[i + 2];
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
  }
}

class Gulls {
  group = new THREE.Group();
  private birds: Gull[] = [];
  private timer = 8 + Math.random() * 12;
  private present = false;
  private area = new THREE.Vector3(); private w = 16; private d = 8;
  constructor() {
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/gull.glb`).then((gltf) => {
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const map = (m.material as THREE.MeshStandardMaterial).map ?? null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        m.material = inkMaterial(0xffffff, 0, map);
      });
      for (let i = 0; i < 3; i++) { const g = new Gull(gltf.scene); this.birds.push(g); this.group.add(g.obj); }
    }).catch(() => { /* no gulls without the model */ });
  }
  setArea(c: THREE.Vector3, w: number, d: number) { this.area.copy(c); this.w = w; this.d = d; }
  update(dt: number, t: number, flee: boolean) {
    if ((this.timer -= dt) < 0 || (flee && this.present)) {
      if (!this.present && !flee && this.birds.length) {
        // One, two or three birds, each arriving on its own a few seconds apart.
        const n = 1 + Math.floor(Math.random() * 3);
        this.birds.forEach((b, i) => { if (i < n) b.launch(this.area, this.w, this.d, i * (2 + Math.random() * 4)); });
        this.present = true; this.timer = 35 + Math.random() * 35;
      } else if (this.present) {
        // They leave one by one.
        this.birds.forEach((b, i) => setTimeout(() => b.leave(), i * (1500 + Math.random() * 3000)));
        this.present = false; this.timer = 50 + Math.random() * 70;
      } else this.timer = 10;
    }
    for (const b of this.birds) b.update(dt, t);
  }
  /** True while any gull is over the charts (for their cries). */
  get here() { return this.present && this.birds.some((b) => b.active); }
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
  private gulls = new Gulls();
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
    this.gulls.setArea(new THREE.Vector3((Math.min(a.x, b.x) + Math.max(a.x, b.x) + N) / 2, 0, (Math.min(a.z, b.z) + Math.max(a.z, b.z) + N) / 2), (Math.abs(a.x - b.x) + N) / 2, (Math.abs(a.z - b.z) + N) / 2);
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
