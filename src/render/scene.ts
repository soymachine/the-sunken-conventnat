// three.js view of the two sea charts. Ships are persistent objects that glide,
// ride the swell and sink; everything else is rebuilt from the public state.
import * as THREE from 'three';
import { Pub, SidePub } from '../game/engine';
import { Kind, N, Ship, ShotOutcome, ZONE, shipCells } from '../game/rules';
import { Fx } from './fx';
import { Post } from './post';
import { Sea, waveH } from './sea';
import { ShipModel, buildShip, loadShipModels, setShipTime } from './ships';

export type Side = 'own' | 'enemy';
export interface Cell { side: Side; x: number; y: number }
export interface Highlight extends Cell { color: number; opacity?: number }
export interface View { pub: Pub; me: 0 | 1; ships: Ship[]; selectedId?: number | null; invalid?: boolean; lifted?: boolean;
  /** Rebuilding after a reload: show the present state without replaying how it came about. */
  quiet?: boolean }
export type Sound = 'cannon' | 'splash' | 'hit' | 'clang' | 'sink' | 'coin' | 'glass';

const C = { ink: 0x0d0b08, amber: 0xd9a441, parch: 0xe8d5a3, brass: 0xb08d3c, wax: 0x8c2f1b };
const HALF = N / 2;
/** World position of each chart's (0,0) corner. Stacked on tall screens, side by side on wide ones. */
const STACKED: Record<Side, { x: number; z: number }> = { enemy: { x: -HALF, z: -(N + 0.5) }, own: { x: -HALF, z: 0.5 } };
const ABREAST: Record<Side, { x: number; z: number }> = { enemy: { x: -(N + 0.75), z: -HALF }, own: { x: 0.75, z: -HALF } };
let origin = STACKED;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function cellCenter(c: Cell): THREE.Vector3 {
  return new THREE.Vector3(origin[c.side].x + c.x + 0.5, 0, origin[c.side].z + c.y + 0.5);
}

function sprite(draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const labels = new Map<string, THREE.SpriteMaterial>();
function label(text: string, color: string): THREE.Sprite {
  let m = labels.get(text + color);
  if (!m) {
    m = new THREE.SpriteMaterial({ depthTest: false, map: sprite((g) => {
      g.fillStyle = '#0d0b08'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
      g.strokeStyle = color; g.lineWidth = 6; g.stroke();
      g.fillStyle = color; g.font = '700 56px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 64, 68);
    }) });
    labels.set(text + color, m);
  }
  const s = new THREE.Sprite(m);
  s.scale.setScalar(1.5);
  return s;
}
const puffTex = sprite((g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(232,222,196,.95)'); r.addColorStop(0.55, 'rgba(214,204,178,.5)'); r.addColorStop(1, 'rgba(214,204,178,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});

const G = {
  disc: new THREE.CircleGeometry(0.3, 20), ring: new THREE.RingGeometry(0.22, 0.3, 24), ring2: new THREE.RingGeometry(0.08, 0.13, 16),
  flame: new THREE.ConeGeometry(0.13, 0.5, 8), cell: new THREE.PlaneGeometry(0.94, 0.94),
  plank: new THREE.BoxGeometry(0.34, 0.04, 0.08), ball: new THREE.SphereGeometry(0.16, 12, 8),
  chest: new THREE.BoxGeometry(0.5, 0.3, 0.36), lid: new THREE.BoxGeometry(0.54, 0.1, 0.4),
  torus: new THREE.TorusGeometry(0.4, 0.05, 6, 20), eye: new THREE.RingGeometry(0.32, 0.42, 4),
  zone: new THREE.EdgesGeometry(new THREE.PlaneGeometry(2 * ZONE + 1, 2 * ZONE + 1)), beam: new THREE.PlaneGeometry(0.5, 2 * ZONE + 1),
};
for (const k of ['disc', 'ring', 'ring2', 'cell', 'zone', 'eye', 'torus', 'beam'] as const) G[k].rotateX(-Math.PI / 2);
const M = {
  flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.35) }), gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.72, 0.16) }),
  chest: new THREE.MeshLambertMaterial({ color: 0x7a5a1e }), debris: new THREE.MeshLambertMaterial({ color: 0x2a2116 }), ball: new THREE.MeshLambertMaterial({ color: 0x15110b }),
  chain: new THREE.MeshLambertMaterial({ color: C.wax }), line: new THREE.LineBasicMaterial({ color: C.ink }),
  lineAmber: new THREE.LineBasicMaterial({ color: C.amber }), lineWax: new THREE.LineBasicMaterial({ color: C.wax }),
};

interface ShipObj {
  root: THREE.Group; tilt: THREE.Group; model: ShipModel; decor: THREE.Group; decorKey: string;
  kind: Kind; len: number; side: Side; pos: THREE.Vector3; yaw: number; phase: number;
  state: 'afloat' | 'sinking' | 'wreck'; sink: number; lift: number; fires: THREE.Vector3[]; cells: [number, number][]; fresh: boolean;
}

export class SeaScene {
  /** Set by the controller to play sounds in step with the effects. */
  sound: (s: Sound) => void = () => {};
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  private marks = new THREE.Group();
  private shipsGroup = new THREE.Group();
  private misc = new THREE.Group();
  private hl = new THREE.Group();
  private fx = new Fx();
  private post: Post | null = null;
  private seas: Record<Side, Sea>;
  private shadowPlanes = [] as THREE.Mesh[];
  private sun = new THREE.DirectionalLight(0xffe2a8, 1.7);
  private ships = new Map<string, ShipObj>();
  private flames: THREE.Object3D[] = [];
  private embers: THREE.Vector3[] = [];
  private puffs: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  private glints: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private baseDist = 40;
  private zoom = 1;
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 1, 0.95).normalize();
  private camPos = new THREE.Vector3();
  private shakeAmt = 0;
  private extent = { x: HALF, z: N };
  private last: View | null = null;
  private quality: 'high' | 'low';
  private frames = 0; private slow = 0; private laid = false;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const forced = new URLSearchParams(location.search).get('q');
    this.quality = forced === 'low' ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(C.ink);
    this.scene.add(new THREE.HemisphereLight(0xfff1cf, 0x2a2116, 2.0));
    this.sun.position.set(-9, 16, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -N - 3; sc.right = N + 3; sc.top = N + 3; sc.bottom = -N - 3; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x120e09 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.08;
    this.scene.add(table);
    this.seas = { enemy: new Sea(true), own: new Sea(false) };
    for (const side of ['enemy', 'own'] as Side[]) {
      this.scene.add(this.seas[side].mesh);
      // The chart is drawn by its own shader, so a separate plane catches the ships' shadows.
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.ShadowMaterial({ opacity: 0.32 }));
      sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true;
      this.shadowPlanes.push(sh);
      this.scene.add(sh);
    }
    this.scene.add(this.marks, this.shipsGroup, this.misc, this.hl, this.fx.group);
    if (this.quality === 'high') this.post = new Post(this.renderer, this.scene, this.camera);
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel(e); }, { passive: false });
    this.resize();
    void loadShipModels().then((n) => { if (n) { for (const o of this.ships.values()) this.shipsGroup.remove(o.root); this.ships.clear(); if (this.last) this.sync(this.last); } });
    let prev = performance.now();
    const loop = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.time += dt;
      this.frame(dt, this.time);
      // Drop the expensive passes on machines that cannot keep up (unless a quality was forced).
      if (!forced && this.quality === 'high' && this.frames++ > 20 && this.frames < 140) {
        if (dt > 0.036) this.slow++;
        if (this.frames === 139 && this.slow > 70) this.lower();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  private lower() {
    this.quality = 'low';
    this.post = null;
    this.renderer.shadowMap.enabled = false;
    this.sun.castShadow = false;
    for (const p of this.shadowPlanes) p.visible = false;
    this.renderer.setPixelRatio(1);
    this.resize();
  }

  /** Warm light on your turn, colder on the enemy's. */
  setTurn(mine: boolean) { this.post?.grade.set(mine ? 1.04 : 0.8, mine ? 1 : 0.86, mine ? 0.94 : 0.96); }

  /** Forget every ship and mark: a new battle is starting. */
  reset() {
    for (const o of this.ships.values()) this.shipsGroup.remove(o.root);
    this.ships.clear(); this.marks.clear(); this.misc.clear(); this.hl.clear();
    this.seas.own.clear(); this.seas.enemy.clear();
    this.last = null;
  }

  /* ---------- camera ---------- */
  private place() {
    this.camPos.copy(this.dir).multiplyScalar(this.baseDist * this.zoom).add(this.target);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
    this.fx.setScale(h * this.renderer.getPixelRatio() * 1.4);
    this.camera.aspect = w / h;
    const wide = w > 1000;
    const safe = { side: wide ? 266 : 6, top: 74, bottom: wide ? 196 : 150 };
    const layout = wide && w / h > 1.25 ? ABREAST : STACKED;
    const changed = layout !== origin || !this.laid;
    this.laid = true;
    origin = layout;
    (['enemy', 'own'] as Side[]).forEach((side, i) => {
      this.seas[side].mesh.position.set(origin[side].x + HALF, 0, origin[side].z + HALF);
      this.shadowPlanes[i].position.set(origin[side].x + HALF, 0.085, origin[side].z + HALF);
    });
    this.dir.set(0, 1, layout === ABREAST ? 0.7 : 0.95).normalize();
    this.extent = layout === ABREAST ? { x: N + 0.75, z: HALF } : { x: HALF, z: N + 0.5 };
    this.camera.setViewOffset(w, h, 0, (safe.bottom - safe.top) / 2, w, h);
    this.camera.updateProjectionMatrix();
    const zoom = this.zoom, target = this.target.clone();
    this.zoom = 1; this.target.set(0, 0, 0);
    const ex = this.extent.x + 0.6, ez = this.extent.z + 0.6;
    for (this.baseDist = 14; this.baseDist < 260; this.baseDist += 0.5) {
      this.place();
      const ok = [[-ex, -ez], [ex, -ez], [-ex, ez], [ex, ez]].every(([x, z]) => {
        const v = new THREE.Vector3(x, 0, z).project(this.camera);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        return px >= safe.side && px <= w - safe.side && py >= safe.top && py <= h - safe.bottom;
      });
      if (ok) break;
    }
    if (!changed) { this.zoom = zoom; this.target.copy(target); }
    this.place();
    if (changed && this.last) { for (const o of this.ships.values()) o.fresh = true; this.sync(this.last); }
  }

  private ground(ev: { clientX: number; clientY: number }): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.camera.position.copy(this.camPos);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(p, this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  /** Zoom towards the square under the pointer. */
  private wheel(e: WheelEvent) {
    const before = this.ground(e);
    this.zoom = Math.min(1, Math.max(0.35, this.zoom * Math.exp(e.deltaY * 0.0012)));
    this.place();
    const after = this.ground(e);
    if (this.zoom >= 1) this.target.set(0, 0, 0);
    else if (before && after) {
      this.target.add(before.sub(after));
      this.target.x = Math.max(-this.extent.x, Math.min(this.extent.x, this.target.x));
      this.target.z = Math.max(-this.extent.z, Math.min(this.extent.z, this.target.z));
    }
    this.place();
  }

  /** Screen position of a cell centre, in CSS pixels. */
  screen(c: Cell): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    this.camera.position.copy(this.camPos);
    this.camera.updateMatrixWorld();
    const v = cellCenter(c).project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Grid cell under a pointer event, or null when it is off both charts. */
  pick(ev: { clientX: number; clientY: number }): Cell | null {
    const hit = this.ground(ev);
    if (!hit) return null;
    for (const side of ['enemy', 'own'] as Side[]) {
      const x = Math.floor(hit.x - origin[side].x), y = Math.floor(hit.z - origin[side].z);
      if (x >= 0 && x < N && y >= 0 && y < N) return { side, x, y };
    }
    return null;
  }

  private shake(a: number) { if (!calm) this.shakeAmt = Math.max(this.shakeAmt, a); }

  /* ---------- per-frame ---------- */
  private frame(dt: number, t: number) {
    setShipTime(t);
    this.embers.length = 0;
    const k = 1 - Math.exp(-dt * 7);
    for (const o of this.ships.values()) {
      if (o.fresh) { o.root.position.copy(o.pos); o.root.rotation.y = o.yaw; o.fresh = false; }
      const before = o.root.position.clone();
      o.root.position.lerp(o.pos, k);
      o.root.rotation.y += (o.yaw - o.root.rotation.y) * k;
      const sea = this.seas[o.side], p = o.root.position;
      if (o.state === 'afloat') {
        // A moving hull leaves a wake and heels into its turn.
        const speed = before.distanceTo(p) / Math.max(dt, 1e-3), turning = Math.abs(o.yaw - o.root.rotation.y);
        if (speed > 0.3) sea.bump(Math.floor(before.x - origin[o.side].x), Math.floor(before.z - origin[o.side].z), 0.06);
        const bob = calm ? 0 : 1;
        o.tilt.position.y += (waveH(p.x, p.z, t) * 1.2 * bob + o.lift - o.tilt.position.y) * Math.min(1, k * 2);
        o.tilt.rotation.x = bob * 0.055 * Math.sin(t * 1.25 + o.phase) + turning * 0.5;
        o.tilt.rotation.z = bob * 0.022 * Math.sin(t * 0.9 + o.phase * 2.3) - Math.min(0.06, speed * 0.02);
        for (const [x, y] of o.cells) sea.hold(x, y, 0.55);
        if (o.model.funnel) this.fx.funnel(o.root.localToWorld(o.model.funnel.clone().setY(o.model.funnel.y + o.tilt.position.y)), dt);
      } else {
        if (o.state === 'sinking') {
          o.sink = Math.min(1, o.sink + dt / 2.6);
          this.fx.bubbles(p.clone().setY(0.1), dt);
          for (const [x, y] of o.cells) sea.hold(x, y, 0.9);
          if (o.sink > 0.45) o.model.sails.visible = false;
          if (o.sink >= 1) o.state = 'wreck';
        } else for (const [x, y] of o.cells) sea.hold(x, y, 0.28);
        const e = o.sink * o.sink * (3 - 2 * o.sink);
        o.tilt.position.y = -0.34 * e;
        o.tilt.rotation.x = 0.55 * e;
        o.tilt.rotation.z = -0.16 * e;
        for (const m of o.model.mats) { m.uniforms.uTint.value.setHex(0x17120b); m.uniforms.uTintAmt.value = 0.55 * e; }
      }
      for (const f of o.fires) this.embers.push(o.tilt.localToWorld(f.clone()));
    }
    for (const e of this.embers0) this.embers.push(e);
    for (const e of this.embers) this.fx.ember(e, dt);
    this.flames.forEach((f, i) => { f.scale.y = 1 + 0.22 * Math.sin(t * 9 + i * 1.7); });
    for (const p of this.puffs) { p.s.position.set(p.base.x + 0.5 * Math.sin(t * 0.3 + p.ph), p.base.y + 0.12 * Math.sin(t * 0.5 + p.ph * 2), p.base.z + 0.4 * Math.cos(t * 0.24 + p.ph)); }
    this.glints.forEach((g, i) => { g.scale.setScalar(1 + 0.12 * Math.sin(t * 3 + i)); g.rotation.y = t * 0.6 + i; });
    this.seas.own.update(dt, t); this.seas.enemy.update(dt, t);
    this.fx.update(dt);
    this.shakeAmt *= Math.exp(-dt * 7);
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.002) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt, 0));
    if (this.post) this.post.render(t); else this.renderer.render(this.scene, this.camera);
  }

  /* ---------- ships ---------- */
  private ship(key: string, kind: Kind, len: number, side: Side): ShipObj {
    let o = this.ships.get(key);
    if (o) return o;
    const model = buildShip(kind, len), root = new THREE.Group(), tilt = new THREE.Group(), decor = new THREE.Group();
    tilt.add(model.body, decor);
    root.add(tilt);
    this.shipsGroup.add(root);
    o = { root, tilt, model, decor, decorKey: '', kind, len, side, pos: new THREE.Vector3(), yaw: 0, phase: Math.random() * 6.28, state: 'afloat', sink: 0, lift: 0, fires: [], cells: [], fresh: true };
    this.ships.set(key, o);
    return o;
  }

  private aim(o: ShipObj, s: Pick<Ship, 'x' | 'y' | 'dir' | 'len'>) {
    const cs = shipCells(s), a = cellCenter({ side: o.side, x: cs[0][0], y: cs[0][1] }), b = cellCenter({ side: o.side, x: cs[cs.length - 1][0], y: cs[cs.length - 1][1] });
    o.pos.copy(a).add(b).multiplyScalar(0.5);
    o.yaw = s.dir === 'h' ? 0 : -Math.PI / 2;
    o.cells = cs;
  }

  private decorate(o: ShipObj, hits: boolean[], chained: boolean) {
    const key = hits.map((h) => (h ? 1 : 0)).join('') + (chained ? 'c' : '');
    if (key === o.decorKey) return;
    o.decorKey = key;
    for (const c of o.decor.children) { const i = this.flames.indexOf(c); if (i >= 0) this.flames.splice(i, 1); }
    o.decor.clear();
    o.fires = [];
    hits.forEach((h, i) => {
      if (!h) return;
      const at = new THREE.Vector3(i + 0.5 - o.len / 2, o.model.deckY + 0.05, 0);
      const flame = new THREE.Mesh(G.flame, M.flame);
      flame.position.copy(at).setY(at.y + 0.22);
      o.decor.add(flame);
      this.flames.push(flame);
      o.fires.push(at.clone().setY(at.y + 0.3));
    });
    if (chained) for (const x of [-o.len / 2 + 0.5, o.len / 2 - 0.5]) { const r = new THREE.Mesh(G.torus, M.chain); r.position.set(x, o.model.deckY + 0.08, 0); o.decor.add(r); }
  }

  /* ---------- marks ---------- */
  private flat(geo: THREE.BufferGeometry, color: number, opacity: number, at: THREE.Vector3, y = 0.1) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.position.set(at.x, y, at.z);
    this.marks.add(m);
    return m;
  }

  private drawSide(p: SidePub, side: Side, round: number) {
    for (const s of p.shots) {
      const age = round - s.round, fade = Math.max(0.3, 1 - age * 0.14), at = cellCenter({ side, x: s.x, y: s.y });
      if (s.result === 'miss') { this.flat(G.ring, C.ink, fade, at); this.flat(G.ring2, C.ink, fade, at); }
      else if (side === 'enemy') {
        this.flat(G.disc, s.result === 'clang' ? C.brass : C.wax, fade, at, 0.1);
        if (s.result === 'clang') this.flat(G.ring2, C.ink, fade, at, 0.11);
        else if (!s.sunk && age <= 1) {
          const flame = new THREE.Mesh(G.flame, M.flame);
          flame.position.set(at.x, 0.33, at.z);
          this.marks.add(flame);
          this.flames.push(flame);
          this.embers0.push(new THREE.Vector3(at.x, 0.4, at.z));
        }
      }
    }
    for (const d of p.debris) {
      if (round - d.round > 3) continue;
      const at = cellCenter({ side, x: d.x, y: d.y });
      [[-0.15, -0.1, 0.4], [0.12, 0.08, -0.7], [0.02, 0.2, 1.3]].forEach(([dx, dz, r]) => {
        const pl = new THREE.Mesh(G.plank, M.debris);
        pl.position.set(at.x + dx, 0.1, at.z + dz); pl.rotation.y = r;
        this.marks.add(pl);
      });
    }
    for (const s of p.spotted) {
      const age = round - s.round;
      if (age <= 3) this.flat(G.eye, side === 'enemy' ? C.amber : C.wax, Math.max(0.35, 1 - age * 0.25), cellCenter({ side, x: s.x, y: s.y }), 0.12);
    }
    for (const sc of p.scans) {
      if (round - sc.round > 4) continue;
      const at = cellCenter({ side, x: sc.x, y: sc.y });
      const box = new THREE.LineSegments(G.zone, side === 'enemy' ? M.lineAmber : M.lineWax);
      box.position.set(at.x, 0.12, at.z);
      const l = label(sc.count < 0 ? '?' : String(sc.count), side === 'enemy' ? '#d9a441' : '#c0563c');
      l.position.set(at.x, 0.9, at.z);
      this.marks.add(box, l);
    }
    p.fogs.forEach((f, fi) => {
      const at = cellCenter({ side, x: f.x, y: f.y });
      for (let i = 0; i < 14; i++) {
        const a = (i * 2.4 + fi) % 6.28, r = (ZONE + 0.3) * Math.sqrt(((i * 7 + 3) % 14) / 14);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.6, depthWrite: false }));
        s.scale.setScalar(3 + (i % 3) * 0.6);
        const base = new THREE.Vector3(at.x + Math.cos(a) * r, 0.7 + (i % 4) * 0.12, at.z + Math.sin(a) * r);
        s.position.copy(base);
        this.marks.add(s);
        this.puffs.push({ s, base, ph: i * 1.7 });
      }
    });
  }
  private embers0: THREE.Vector3[] = [];

  /** Bring the scene in line with the current view. */
  sync(v: View) {
    this.last = v;
    const foe = (1 - v.me) as 0 | 1, seen = new Set<string>();
    const wreck = (o: ShipObj) => {
      if (o.state !== 'afloat') return;
      if (v.quiet) { o.state = 'wreck'; o.sink = 1; o.model.sails.visible = false; }
      else { o.state = 'sinking'; this.sound('sink'); }
    };
    for (const s of v.ships) {
      const key = 'o' + s.id, o = this.ship(key, s.kind, s.len, 'own');
      seen.add(key);
      this.aim(o, s);
      if (s.sunk) { wreck(o); this.decorate(o, [], false); continue; }
      this.decorate(o, s.hits, !!s.chained);
      const sel = s.id === v.selectedId;
      o.lift = sel && v.lifted ? 0.45 : 0;
      for (const m of o.model.mats) { m.uniforms.uTint.value.setHex(v.invalid ? C.wax : C.amber); m.uniforms.uTintAmt.value = sel ? 0.5 : 0; }
    }
    for (const s of v.pub.sides[foe].sunk) {
      const key = 'e' + s.kind, o = this.ship(key, s.kind, s.len, 'enemy');
      seen.add(key);
      this.aim(o, s);
      wreck(o);
    }
    for (const s of v.pub.sides[foe].revealed || []) {
      if (s.sunk) continue;
      const key = 'r' + s.id, o = this.ship(key, s.kind, s.len, 'enemy');
      seen.add(key);
      this.aim(o, s);
      this.decorate(o, s.hits, false);
    }
    for (const [key, o] of this.ships) if (!seen.has(key)) { this.shipsGroup.remove(o.root); this.ships.delete(key); }

    for (const c of this.marks.children) { const i = this.flames.indexOf(c); if (i >= 0) this.flames.splice(i, 1); }
    this.marks.clear(); this.puffs = []; this.glints = []; this.embers0 = [];
    this.drawSide(v.pub.sides[v.me], 'own', v.pub.round);
    this.drawSide(v.pub.sides[foe], 'enemy', v.pub.round);
    for (const t of v.pub.treasures) {
      const at = cellCenter({ side: t.side === v.me ? 'own' : 'enemy', x: t.x, y: t.y });
      const g = new THREE.Group(), chest = new THREE.Mesh(G.chest, M.chest), lid = new THREE.Mesh(G.lid, M.gold);
      chest.position.y = 0.15; lid.position.y = 0.35; chest.castShadow = true;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(G.chest), M.line);
      edge.position.y = 0.15;
      g.add(chest, lid, edge);
      g.position.set(at.x, 0.08, at.z);
      this.marks.add(g);
      this.glints.push(g);
    }
  }

  setHighlights(list: Highlight[]) {
    this.hl.clear();
    for (const h of list) {
      const m = new THREE.Mesh(G.cell, new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: h.opacity ?? 0.45, depthWrite: false }));
      const at = cellCenter(h);
      m.position.set(at.x, 0.13, at.z);
      this.hl.add(m);
    }
  }

  /* ---------- effects ---------- */
  /** Fire a shot at a cell and play out how it lands. Resolves on impact. */
  shot(target: Cell, outcome: ShotOutcome): Promise<void> {
    const to = cellCenter(target);
    let from: THREE.Vector3;
    const guns = [...this.ships.values()].filter((o) => o.side === 'own' && o.state === 'afloat');
    if (target.side === 'enemy' && guns.length) {
      const g = guns[Math.floor(Math.random() * guns.length)];
      from = g.root.position.clone().setY(0.6);
      this.fx.muzzle(from);
      this.seas.own.bump(Math.floor(from.x - origin.own.x), Math.floor(from.z - origin.own.z), 0.25);
    } else {
      // The enemy's guns stay hidden: shots arrive from beyond their chart.
      const c = cellCenter({ side: 'enemy', x: 2 + Math.random() * (N - 4), y: 2 + Math.random() * (N - 4) });
      from = c.setY(0.6);
    }
    this.sound('cannon');
    const ball = new THREE.Mesh(G.ball, M.ball);
    this.misc.add(ball);
    const t0 = performance.now(), dur = 560 + from.distanceTo(to) * 9, arc = 3 + from.distanceTo(to) * 0.18;
    return new Promise((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / dur);
        ball.position.lerpVectors(from, to, u);
        ball.position.y += Math.sin(u * Math.PI) * arc;
        this.fx.trail(ball.position);
        if (u < 1) { requestAnimationFrame(step); return; }
        this.misc.remove(ball);
        const sea = this.seas[target.side], at = to.clone().setY(0.25);
        sea.bump(target.x, target.y, 1);
        if (outcome === 'miss' || outcome === 'wreck') { this.fx.water(at); this.sound('splash'); }
        else if (outcome === 'clang') { this.fx.clang(at.setY(0.5)); this.shake(0.12); this.sound('clang'); }
        else { this.fx.explosion(at.setY(0.45)); this.shake(outcome === 'sunk' ? 0.5 : 0.28); this.sound('hit'); }
        res();
      };
      step();
    });
  }

  /** A spyglass sweeping its 5×5 patch. */
  sweep(c: Cell): Promise<void> {
    const at = cellCenter(c);
    const m = new THREE.Mesh(G.beam, new THREE.MeshBasicMaterial({ color: c.side === 'enemy' ? C.amber : C.wax, transparent: true, opacity: 0.55, depthWrite: false }));
    this.misc.add(m);
    this.sound('glass');
    const t0 = performance.now();
    return new Promise((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / 650);
        m.position.set(at.x - ZONE - 0.25 + u * (2 * ZONE + 0.5), 0.14, at.z);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.sin(u * Math.PI);
        if (u < 1) requestAnimationFrame(step); else { this.misc.remove(m); res(); }
      };
      step();
    });
  }

  coins(c: Cell) { this.fx.coins(cellCenter(c).setY(0.4)); this.sound('coin'); }
}
