// A small particle system and the effects built on it: gun smoke, splashes, fire.
import * as THREE from 'three';

type V = THREE.Vector3;
interface Opt { g?: number; drag?: number; grow?: number }

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`;

class Pool {
  points: THREE.Points;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array;
  private vel: Float32Array; private life: Float32Array; private max: Float32Array;
  private g: Float32Array; private drag: Float32Array; private grow: Float32Array; private base: Float32Array; private alpha: Float32Array;
  private next = 0;
  private mat: THREE.ShaderMaterial;

  constructor(additive: boolean, private cap = 2400) {
    const f = (n: number) => new Float32Array(cap * n);
    this.pos = f(3); this.col = f(4); this.size = f(1); this.vel = f(3); this.life = f(1); this.max = f(1);
    this.g = f(1); this.drag = f(1); this.grow = f(1); this.base = f(1); this.alpha = f(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 } },
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  setScale(s: number) { this.mat.uniforms.uScale.value = s; }

  emit(p: V, v: V, life: number, size: number, c: [number, number, number], alpha = 1, o: Opt = {}) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([c[0], c[1], c[2], alpha], i * 4);
    this.life[i] = this.max[i] = life; this.base[i] = size; this.alpha[i] = alpha;
    this.g[i] = o.g ?? 0; this.drag[i] = o.drag ?? 0; this.grow[i] = o.grow ?? 0;
  }

  update(dt: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      const l = (this.life[i] -= dt), j = i * 3;
      if (l <= 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= k; this.vel[j + 2] *= k; this.vel[j + 1] = this.vel[j + 1] * k + this.g[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const u = l / this.max[i];
      this.size[i] = this.base[i] * (1 + this.grow[i] * (1 - u));
      this.col[i * 4 + 3] = this.alpha[i] * Math.min(1, u * 2.2);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = true;
  }
}

const R = (a: number, b: number) => a + Math.random() * (b - a);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SMOKE: [number, number, number] = [0.05, 0.04, 0.03], PALE: [number, number, number] = [0.75, 0.68, 0.5];
const FOAM: [number, number, number] = [1, 0.95, 0.8], FIRE: [number, number, number] = [3.2, 1.5, 0.3], SPARK: [number, number, number] = [4, 3, 1.4];

export class Fx {
  group = new THREE.Group();
  private soft = new Pool(false);
  private glow = new Pool(true, 1400);
  /** Wind drift applied to smoke, in world units per second. */
  wind = v3(0.35, 0, 0.12);

  constructor() { this.group.add(this.soft.points, this.glow.points); }
  setScale(s: number) { this.soft.setScale(s); this.glow.setScale(s); }
  update(dt: number) { this.soft.update(dt); this.glow.update(dt); }

  private smoke(p: V, n: number, spread: number, rise: number, size: number, life: number, c = SMOKE, alpha = 0.55) {
    for (let i = 0; i < n; i++) this.soft.emit(p.clone().add(v3(R(-spread, spread), R(0, spread), R(-spread, spread))),
      v3(R(-0.3, 0.3) + this.wind.x, R(rise * 0.5, rise), R(-0.3, 0.3) + this.wind.z), R(life * 0.6, life), R(size * 0.6, size), c, alpha, { drag: 0.9, grow: 1.6 });
  }

  /** A gun going off. */
  muzzle(p: V) {
    for (let i = 0; i < 8; i++) this.glow.emit(p, v3(R(-1.5, 1.5), R(0, 1.5), R(-1.5, 1.5)), R(0.08, 0.2), R(0.5, 0.9), FIRE, 1, { drag: 4 });
    this.smoke(p, 9, 0.12, 0.9, 0.55, 1.5, PALE, 0.5);
  }
  trail(p: V) { this.soft.emit(p, v3(R(-0.1, 0.1), R(0, 0.2), R(-0.1, 0.1)), 0.5, 0.22, SMOKE, 0.35, { grow: 1.2 }); }

  /** A shot falling into the sea: a column of water. */
  water(p: V) {
    for (let i = 0; i < 34; i++) this.soft.emit(p.clone().add(v3(R(-0.12, 0.12), 0, R(-0.12, 0.12))), v3(R(-0.7, 0.7), R(2.5, 6), R(-0.7, 0.7)), R(0.5, 0.95), R(0.14, 0.3), FOAM, 0.9, { g: -11, drag: 0.6 });
    for (let i = 0; i < 12; i++) this.soft.emit(p, v3(R(-1.6, 1.6), R(0.2, 0.8), R(-1.6, 1.6)), R(0.4, 0.7), R(0.12, 0.2), FOAM, 0.7, { g: -3, drag: 2 });
  }
  /** A shot striking home: fire, splinters and smoke. */
  explosion(p: V) {
    for (let i = 0; i < 26; i++) this.glow.emit(p, v3(R(-2.4, 2.4), R(0.5, 3.4), R(-2.4, 2.4)), R(0.25, 0.55), R(0.3, 0.75), FIRE, 1, { drag: 3, g: -2 });
    for (let i = 0; i < 16; i++) this.soft.emit(p, v3(R(-2.6, 2.6), R(2, 5), R(-2.6, 2.6)), R(0.5, 1), R(0.07, 0.13), [0.12, 0.08, 0.04], 1, { g: -11 });
    this.smoke(p, 16, 0.2, 1.5, 0.8, 2.2);
  }
  /** A shot glancing off iron: a shower of sparks. */
  clang(p: V) {
    for (let i = 0; i < 26; i++) this.glow.emit(p, v3(R(-3.5, 3.5), R(1, 4.5), R(-3.5, 3.5)), R(0.2, 0.5), R(0.08, 0.16), SPARK, 1, { g: -12 });
    this.smoke(p, 4, 0.1, 0.6, 0.4, 0.8, PALE, 0.35);
  }
  /** One frame of a burning section. */
  ember(p: V, dt: number) {
    if (Math.random() < dt * 14) this.glow.emit(p.clone().add(v3(R(-0.1, 0.1), 0, R(-0.1, 0.1))), v3(R(-0.15, 0.15), R(0.5, 1.2), R(-0.15, 0.15)), R(0.25, 0.5), R(0.16, 0.34), FIRE, 0.9, { drag: 1 });
    if (Math.random() < dt * 5) this.smoke(p.clone().setY(p.y + 0.3), 1, 0.05, 0.9, 0.5, 1.8);
    if (Math.random() < dt * 2) this.glow.emit(p, v3(R(-0.4, 0.4), R(1, 2), R(-0.4, 0.4)), R(0.5, 1), 0.06, SPARK, 1, { g: -1 });
  }
  /** One frame of a steam funnel. */
  funnel(p: V, dt: number) { if (Math.random() < dt * 7) this.smoke(p, 1, 0.03, 0.7, 0.36, 2.4, SMOKE, 0.45); }
  bubbles(p: V, dt: number) { if (Math.random() < dt * 16) this.soft.emit(p.clone().add(v3(R(-0.8, 0.8), 0, R(-0.3, 0.3))), v3(0, R(0.2, 0.7), 0), R(0.4, 0.9), R(0.08, 0.16), FOAM, 0.8); }
  coins(p: V) { for (let i = 0; i < 22; i++) this.glow.emit(p, v3(R(-1, 1), R(2, 4.5), R(-1, 1)), R(0.5, 0.9), R(0.1, 0.18), [2.6, 1.8, 0.4], 1, { g: -9 }); }
}
