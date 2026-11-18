// The Kraken: procedural tentacles that rise from a patch of sea, sway, and slam down.
import * as THREE from 'three';
import { inkMaterial } from './ships';

const SEG = 13, COUNT = 5, HEIGHT = 3.4;
const UP = new THREE.Vector3(0, 1, 0);

interface Tentacle { segs: THREE.Mesh[]; base: THREE.Vector3; ph: number; aim: THREE.Vector3 | null; aimK: number; t0: number; done?: () => void }

export class Kraken {
  group = new THREE.Group();
  private arms: Tentacle[] = [];
  private rise = 0;
  private want = 0;
  private center = new THREE.Vector3();

  constructor() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 7, 1), skin = inkMaterial(0x2c2117), sucker = inkMaterial(0xb08d3c);
    for (let i = 0; i < COUNT; i++) {
      const segs: THREE.Mesh[] = [];
      for (let k = 0; k < SEG; k++) {
        const m = new THREE.Mesh(geo, k % 3 === 1 ? sucker : skin);
        m.castShadow = true;
        this.group.add(m);
        segs.push(m);
      }
      this.arms.push({ segs, base: new THREE.Vector3(), ph: i * 1.9, aim: null, aimK: 0, t0: 0 });
    }
    this.group.visible = false;
  }

  /** Where the Kraken holds the sea, or null to let it sink away. */
  setZone(center: THREE.Vector3 | null) {
    this.want = center ? 1 : 0;
    if (!center) return;
    this.center.copy(center);
    this.arms.forEach((a, i) => {
      const ang = (i / COUNT) * Math.PI * 2 + 0.4;
      a.base.set(center.x + Math.cos(ang) * 1.15, 0, center.z + Math.sin(ang) * 1.15);
    });
  }
  get active() { return this.want > 0; }

  /** One tentacle arcs over and comes down on `target`. Resolves at the moment of impact. */
  slam(target: THREE.Vector3): Promise<void> {
    let best = this.arms[0], d = Infinity;
    for (const a of this.arms) { if (a.aim) continue; const q = a.base.distanceToSquared(target); if (q < d) { d = q; best = a; } }
    return new Promise((res) => { best.aim = target.clone(); best.t0 = performance.now(); best.done = res; });
  }

  private point(a: Tentacle, u: number, t: number, out: THREE.Vector3): THREE.Vector3 {
    const h = HEIGHT * this.rise, curl = u > 0.65 ? (u - 0.65) / 0.35 : 0;
    const dx = a.base.x - this.center.x, dz = a.base.z - this.center.z, len = Math.hypot(dx, dz) || 1;
    // Lean outward, sway, and curl the tip back in.
    const lean = 0.5 * u - 1.1 * curl * curl, sway = 0.3 * u * Math.sin(t * 1.4 + a.ph + u * 2.6);
    out.set(a.base.x + (dx / len) * lean - (dz / len) * sway, u * h - curl * curl * h * 0.3, a.base.z + (dz / len) * lean + (dx / len) * sway);
    if (a.aim && a.aimK > 0) {
      const tx = a.base.x + (a.aim.x - a.base.x) * u, tz = a.base.z + (a.aim.z - a.base.z) * u, ty = Math.sin(u * Math.PI) * 1.6 * (1 - a.aimK * 0.85) + 0.15;
      out.x += (tx - out.x) * a.aimK; out.y += (ty - out.y) * a.aimK; out.z += (tz - out.z) * a.aimK;
    }
    return out;
  }

  update(dt: number, t: number) {
    this.rise += (this.want - this.rise) * Math.min(1, dt * 2.2);
    this.group.visible = this.rise > 0.02;
    if (!this.group.visible) return;
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), dir = new THREE.Vector3();
    for (const a of this.arms) {
      if (a.aim) {
        // Rear back, whip down, hold, then recover.
        const e = (performance.now() - a.t0) / 1000;
        a.aimK = e < 0.5 ? (e / 0.5) ** 2 : e < 0.8 ? 1 : Math.max(0, 1 - (e - 0.8) / 0.5);
        if (e >= 0.5 && a.done) { a.done(); a.done = undefined; }
        if (e >= 1.3) { a.aim = null; a.aimK = 0; }
      }
      for (let k = 0; k < SEG; k++) {
        const u0 = k / SEG, u1 = (k + 1) / SEG;
        this.point(a, u0, t, p0); this.point(a, u1, t, p1);
        const m = a.segs[k], r = 0.24 * (1 - 0.82 * u0) * Math.min(1, this.rise * 1.5);
        dir.subVectors(p1, p0);
        const L = dir.length() || 0.001;
        m.position.addVectors(p0, p1).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UP, dir.divideScalar(L));
        m.scale.set(r, L * 1.12, r);
      }
    }
  }
}
