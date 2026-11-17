// three.js view of the sea chart: enemy waters far, own waters near.
import * as THREE from 'three';
import { Pub, SidePub } from '../game/engine';
import { N, Ship, ZONE, cellName } from '../game/rules';

export type Side = 'own' | 'enemy';
export interface Cell { side: Side; x: number; y: number }
export interface Highlight extends Cell { color: number; opacity?: number }
export interface View { pub: Pub; me: 0 | 1; ships: Ship[]; selectedId?: number | null; invalid?: boolean }

const C = { ink: 0x0d0b08, sepia: 0x2a2116, amber: 0xd9a441, parch: 0xe8d5a3, brass: 0xb08d3c, wax: 0x8c2f1b, deck: 0x6b4e2c, sail: 0xf3e6c2 };
const HALF = N / 2;
/** World position of each chart's (0,0) corner. Stacked on tall screens, side by side on wide ones. */
const STACKED: Record<Side, { x: number; z: number }> = { enemy: { x: -HALF, z: -(N + 0.5) }, own: { x: -HALF, z: 0.5 } };
const ABREAST: Record<Side, { x: number; z: number }> = { enemy: { x: -(N + 0.75), z: -HALF }, own: { x: 0.75, z: -HALF } };
let origin = STACKED;

export function cellCenter(c: Cell): THREE.Vector3 {
  return new THREE.Vector3(origin[c.side].x + c.x + 0.5, 0, origin[c.side].z + c.y + 0.5);
}

function chartTexture(enemy: boolean): THREE.CanvasTexture {
  const u = 64, m = 32, S = N * u + 2 * m;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = enemy ? '#b39a62' : '#d6c08a';
  g.fillRect(0, 0, S, S);
  let seed = enemy ? 23 : 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (enemy) {
    g.strokeStyle = 'rgba(13,11,8,.13)';
    g.lineWidth = 2.5;
    for (let i = -S; i < S; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
  }
  g.fillStyle = '#17120b';
  g.fillRect(0, 0, S, m); g.fillRect(0, S - m, S, m); g.fillRect(0, 0, m, S); g.fillRect(S - m, 0, m, S);
  g.strokeStyle = 'rgba(13,11,8,.45)';
  g.lineWidth = 1.6;
  for (let n = 0; n < 110; n++) {
    const x = m + 12 + rnd() * (S - 2 * m - 44), y = m + 12 + rnd() * (S - 2 * m - 24), w = 9;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.quadraticCurveTo(x + w * 1.5, y + 5, x + 2 * w, y); g.stroke();
  }
  g.strokeStyle = 'rgba(13,11,8,.5)';
  for (let i = 0; i <= N; i++) {
    g.lineWidth = i % 4 === 0 ? 2.4 : 1.2;
    g.beginPath(); g.moveTo(m + i * u, m); g.lineTo(m + i * u, S - m); g.stroke();
    g.beginPath(); g.moveTo(m, m + i * u); g.lineTo(S - m, m + i * u); g.stroke();
  }
  g.lineWidth = 5; g.strokeStyle = '#0d0b08'; g.strokeRect(m, m, S - 2 * m, S - 2 * m);
  g.fillStyle = '#a8946a'; g.font = '600 19px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    g.fillText(cellName(i, 0)[0], m + i * u + u / 2, enemy ? m / 2 : S - m / 2);
    g.fillText(String(i + 1), m / 2, m + i * u + u / 2);
    g.fillText(String(i + 1), S - m / 2, m + i * u + u / 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const labels = new Map<string, THREE.SpriteMaterial>();
function label(text: string, color: string): THREE.Sprite {
  const key = text + color;
  let m = labels.get(key);
  if (!m) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#0d0b08'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
    g.strokeStyle = color; g.lineWidth = 6; g.stroke();
    g.fillStyle = color; g.font = '700 56px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, depthTest: false });
    labels.set(key, m);
  }
  const s = new THREE.Sprite(m);
  s.scale.setScalar(1.5);
  return s;
}

const mat = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {
  hull: mat(0x1a140c), deck: mat(C.deck), sail: mat(C.sail, { side: THREE.DoubleSide }), mast: mat(0x2a2116), flag: mat(C.wax),
  wreck: mat(0x241c12), flame: new THREE.MeshBasicMaterial({ color: C.amber }), smoke: mat(0x1a140c, { transparent: true, opacity: 0.55 }),
  select: mat(C.amber), bad: mat(C.wax), debris: mat(0x2a2116), ball: mat(0x15110b), chest: mat(0x7a5a1e), gold: mat(C.amber),
  fog: mat(0xcfc4a8, { transparent: true, opacity: 0.5, depthWrite: false }), chain: mat(C.wax),
  line: new THREE.LineBasicMaterial({ color: C.ink }), lineAmber: new THREE.LineBasicMaterial({ color: C.amber }), lineWax: new THREE.LineBasicMaterial({ color: C.wax }),
};

const hullGeos = new Map<number, { hull: THREE.BufferGeometry; edges: THREE.BufferGeometry }>();
function hullGeo(L: number) {
  let e = hullGeos.get(L);
  if (!e) {
    const s = new THREE.Shape();
    const pts = [[0.12, -0.26], [L - 0.75, -0.32], [L - 0.08, 0], [L - 0.75, 0.32], [0.12, 0.26], [0.04, 0]];
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const hull = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
    hull.rotateX(-Math.PI / 2);
    e = { hull, edges: new THREE.EdgesGeometry(hull) };
    hullGeos.set(L, e);
  }
  return e;
}
const G = {
  mast: new THREE.CylinderGeometry(0.025, 0.035, 1.3, 6), sail: new THREE.BoxGeometry(0.03, 0.72, 0.7), flag: new THREE.BoxGeometry(0.22, 0.1, 0.01),
  disc: new THREE.CircleGeometry(0.3, 20), ring: new THREE.RingGeometry(0.22, 0.3, 24), ring2: new THREE.RingGeometry(0.08, 0.13, 16),
  flame: new THREE.ConeGeometry(0.16, 0.55, 8), smoke: new THREE.SphereGeometry(0.14, 8, 6), cell: new THREE.PlaneGeometry(0.94, 0.94),
  plank: new THREE.BoxGeometry(0.34, 0.04, 0.08), ball: new THREE.SphereGeometry(0.13, 12, 8),
  chest: new THREE.BoxGeometry(0.5, 0.3, 0.36), lid: new THREE.BoxGeometry(0.54, 0.1, 0.4),
  fog: new THREE.BoxGeometry(2 * ZONE + 1, 0.7, 2 * ZONE + 1), torus: new THREE.TorusGeometry(0.42, 0.05, 6, 20),
  zone: new THREE.EdgesGeometry(new THREE.PlaneGeometry(2 * ZONE + 1, 2 * ZONE + 1)), eye: new THREE.RingGeometry(0.32, 0.42, 4),
};
for (const k of ['disc', 'ring', 'ring2', 'cell', 'zone', 'eye', 'torus'] as const) G[k].rotateX(-Math.PI / 2);

export class SeaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  private dynamic = new THREE.Group();
  private marks = new THREE.Group();
  private fx = new THREE.Group();
  private hl = new THREE.Group();
  private flames: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private baseDist = 40;
  private zoom = 1;
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 1, 0.95).normalize();
  private charts = {} as Record<Side, THREE.Mesh>;
  private extent = { x: HALF, z: N };
  private last: View | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(C.ink);
    this.scene.add(new THREE.HemisphereLight(0xfff1cf, 0x2a2116, 2.1));
    const sun = new THREE.DirectionalLight(0xffe2a8, 1.6);
    sun.position.set(-6, 12, 8);
    this.scene.add(sun);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x120e09));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.05;
    this.scene.add(table);
    for (const side of ['enemy', 'own'] as Side[]) {
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(N + 1, N + 1), new THREE.MeshLambertMaterial({ map: chartTexture(side === 'enemy') }));
      chart.rotation.x = -Math.PI / 2;
      this.charts[side] = chart;
      this.scene.add(chart);
    }
    this.scene.add(this.marks, this.dynamic, this.fx, this.hl);
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel(e); }, { passive: false });
    this.resize();
    const clock = new THREE.Clock();
    const loop = () => {
      const t = clock.getElapsedTime();
      this.flames.forEach((f, i) => { const k = 1 + 0.18 * Math.sin(t * 9 + i * 1.7); f.scale.set(1, k, 1); });
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  private place() {
    this.camera.position.copy(this.dir).multiplyScalar(this.baseDist * this.zoom).add(this.target);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Back the camera off until both charts fit between the rails and side panels.
    const wide = w > 1000;
    const safe = { side: wide ? 266 : 6, top: 74, bottom: wide ? 196 : 150 };
    const layout = wide && w / h > 1.25 ? ABREAST : STACKED;
    const changed = layout !== origin || !this.charts.own.position.z;
    origin = layout;
    for (const side of ['enemy', 'own'] as Side[]) this.charts[side].position.set(origin[side].x + HALF, 0, origin[side].z + HALF);
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
    this.zoom = zoom; this.target.copy(target);
    if (changed) { this.zoom = 1; this.target.set(0, 0, 0); }
    this.place();
    if (changed && this.last) this.sync(this.last);
  }

  private ground(ev: { clientX: number; clientY: number }): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
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
    const r = this.canvas.getBoundingClientRect(), v = cellCenter(c).project(this.camera);
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

  private shipMesh(s: Pick<Ship, 'len' | 'x' | 'y' | 'dir'> & Partial<Ship>, side: Side, tint?: THREE.Material): THREE.Group {
    const grp = new THREE.Group();
    const geo = hullGeo(s.len);
    if (s.sunk) {
      const hull = new THREE.Mesh(geo.hull, M.wreck);
      hull.position.y = -0.2; hull.rotation.x = 0.35;
      const edge = new THREE.LineSegments(geo.edges, M.lineAmber);
      edge.position.copy(hull.position); edge.rotation.copy(hull.rotation);
      grp.add(hull, edge);
    } else {
      grp.add(new THREE.Mesh(geo.hull, tint || M.hull), new THREE.LineSegments(geo.edges, tint ? M.line : M.lineAmber));
      const deck = new THREE.Mesh(geo.hull, tint || M.deck);
      deck.scale.set(0.96, 0.12, 0.9); deck.position.set(0.02 * s.len, 0.275, 0);
      grp.add(deck);
      const masts = s.len >= 4 ? [0.26, 0.5, 0.74] : s.len === 3 ? [0.34, 0.68] : [0.5];
      masts.forEach((f, i) => {
        const t = f * s.len, tall = masts.length === 3 && i === 1 ? 1.12 : 1;
        const mast = new THREE.Mesh(G.mast, M.mast);
        mast.scale.y = tall; mast.position.set(t, 0.3 + 0.65 * tall, 0);
        const sail = new THREE.Mesh(G.sail, M.sail);
        sail.scale.y = tall; sail.position.set(t + 0.04, 0.45 + 0.4 * tall, 0); sail.rotation.y = 0.55;
        const flag = new THREE.Mesh(G.flag, M.flag);
        flag.position.set(t + 0.12, 0.3 + 1.26 * tall, 0);
        grp.add(mast, sail, flag);
      });
      (s.hits || []).forEach((h, i) => { if (h) grp.add(this.fire(i + 0.5, 0.32, 0)); });
      if (s.chained) for (const t of [0.5, s.len - 0.5]) { const r = new THREE.Mesh(G.torus, M.chain); r.position.set(t, 0.36, 0); grp.add(r); }
    }
    const o = origin[side];
    if (s.dir === 'h') grp.position.set(o.x + s.x, 0, o.z + s.y + 0.5);
    else { grp.position.set(o.x + s.x + 0.5, 0, o.z + s.y); grp.rotation.y = -Math.PI / 2; }
    return grp;
  }

  private fire(x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const flame = new THREE.Mesh(G.flame, M.flame);
    flame.position.y = 0.27;
    this.flames.push(flame);
    g.add(flame);
    [[0.05, 0.7, 0.8], [-0.06, 0.95, 1.1], [0.08, 1.25, 1.4]].forEach(([dx, dy, k]) => {
      const p = new THREE.Mesh(G.smoke, M.smoke);
      p.position.set(dx, dy, 0); p.scale.setScalar(k);
      g.add(p);
    });
    g.position.set(x, y, z);
    return g;
  }

  private flat(geo: THREE.BufferGeometry, color: number, opacity: number, at: THREE.Vector3, y = 0.02) {
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
        this.flat(G.disc, s.result === 'clang' ? C.brass : C.wax, fade, at, 0.03);
        if (s.result === 'clang') this.flat(G.ring2, C.ink, fade, at, 0.04);
        else if (!s.sunk && age <= 1) this.marks.add(this.fire(at.x, 0.03, at.z));
      }
    }
    for (const d of p.debris) {
      if (round - d.round > 3) continue;
      const at = cellCenter({ side, x: d.x, y: d.y });
      [[-0.15, -0.1, 0.4], [0.12, 0.08, -0.7], [0.02, 0.2, 1.3]].forEach(([dx, dz, r]) => {
        const pl = new THREE.Mesh(G.plank, M.debris);
        pl.position.set(at.x + dx, 0.03, at.z + dz); pl.rotation.y = r;
        this.marks.add(pl);
      });
    }
    for (const s of p.spotted) {
      const age = round - s.round;
      if (age > 3) continue;
      this.flat(G.eye, side === 'enemy' ? C.amber : C.wax, Math.max(0.35, 1 - age * 0.25), cellCenter({ side, x: s.x, y: s.y }), 0.05);
    }
    for (const sc of p.scans) {
      const age = round - sc.round;
      if (age > 4) continue;
      const at = cellCenter({ side, x: sc.x, y: sc.y });
      const box = new THREE.LineSegments(G.zone, side === 'enemy' ? M.lineAmber : M.lineWax);
      box.position.set(at.x, 0.05, at.z);
      this.marks.add(box);
      const l = label(sc.count < 0 ? '?' : String(sc.count), side === 'enemy' ? '#d9a441' : '#c0563c');
      l.position.set(at.x, 0.9, at.z);
      (l.material as THREE.SpriteMaterial).opacity = 1;
      this.marks.add(l);
    }
    for (const f of p.fogs) {
      const at = cellCenter({ side, x: f.x, y: f.y });
      const m = new THREE.Mesh(G.fog, M.fog);
      m.position.set(at.x, 0.4, at.z);
      this.marks.add(m);
    }
    for (const s of p.sunk) this.dynamic.add(this.shipMesh({ ...s, sunk: true }, side));
  }

  /** Rebuild ships and markers from the current view. */
  sync(v: View) {
    this.last = v;
    this.dynamic.clear(); this.marks.clear(); this.flames = [];
    const foe = (1 - v.me) as 0 | 1;
    for (const s of v.ships) {
      if (s.sunk) continue; // drawn from the public list of wrecks
      const tint = s.id === v.selectedId ? (v.invalid ? M.bad : M.select) : undefined;
      this.dynamic.add(this.shipMesh(s, 'own', tint));
    }
    for (const s of v.pub.sides[foe].revealed || []) if (!s.sunk) this.dynamic.add(this.shipMesh(s, 'enemy'));
    this.drawSide(v.pub.sides[v.me], 'own', v.pub.round);
    this.drawSide(v.pub.sides[foe], 'enemy', v.pub.round);
    for (const t of v.pub.treasures) {
      const at = cellCenter({ side: t.side === v.me ? 'own' : 'enemy', x: t.x, y: t.y });
      const chest = new THREE.Mesh(G.chest, M.chest), lid = new THREE.Mesh(G.lid, M.gold);
      chest.position.set(at.x, 0.15, at.z); lid.position.set(at.x, 0.35, at.z);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(G.chest), M.line);
      edge.position.copy(chest.position);
      this.marks.add(chest, lid, edge);
    }
  }

  setHighlights(list: Highlight[]) {
    this.hl.clear();
    for (const h of list) {
      const m = new THREE.Mesh(G.cell, new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: h.opacity ?? 0.45, depthWrite: false }));
      const at = cellCenter(h);
      m.position.set(at.x, 0.045, at.z);
      this.hl.add(m);
    }
  }

  /** Lob a cannonball onto a cell; resolves when it lands. */
  shot(target: Cell): Promise<void> {
    const to = cellCenter(target);
    const from = cellCenter({ side: target.side === 'enemy' ? 'own' : 'enemy', x: 3 + Math.random() * (N - 6), y: 3 + Math.random() * (N - 6) }).setY(0.6);
    const ball = new THREE.Mesh(G.ball, M.ball);
    ball.scale.setScalar(1.6);
    this.fx.add(ball);
    const t0 = performance.now(), dur = 620;
    return new Promise((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / dur);
        ball.position.lerpVectors(from, to, u);
        ball.position.y += Math.sin(u * Math.PI) * 7;
        if (u < 1) requestAnimationFrame(step);
        else { this.fx.remove(ball); this.splash(to); res(); }
      };
      step();
    });
  }

  private splash(at: THREE.Vector3) {
    const m = new THREE.MeshBasicMaterial({ color: C.parch, transparent: true });
    const ring = new THREE.Mesh(G.ring, m);
    ring.position.set(at.x, 0.06, at.z);
    this.fx.add(ring);
    const t0 = performance.now();
    const step = () => {
      const u = (performance.now() - t0) / 450;
      ring.scale.setScalar(0.6 + u * 2.2); m.opacity = 1 - u;
      if (u < 1) requestAnimationFrame(step); else this.fx.remove(ring);
    };
    step();
  }
}
