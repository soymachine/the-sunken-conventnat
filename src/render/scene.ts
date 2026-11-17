// three.js view of the sea chart: enemy waters far, own waters near.
import * as THREE from 'three';
import { Game, N, PlayerState, Ship } from '../game/rules';

export type Side = 'own' | 'enemy';
export interface Cell { side: Side; x: number; y: number }
export interface Highlight extends Cell { color: number; opacity?: number }
export interface SyncOpts { revealEnemy?: boolean; selectedId?: number | null; invalid?: boolean }

const C = { ink: 0x0d0b08, sepia: 0x2a2116, amber: 0xd9a441, parch: 0xe8d5a3, brass: 0xb08d3c, wax: 0x8c2f1b, deck: 0x6b4e2c, sail: 0xf3e6c2 };
const Z0: Record<Side, number> = { enemy: -10.5, own: 0.5 };

export function cellCenter(c: Cell): THREE.Vector3 {
  return new THREE.Vector3(c.x - N / 2 + 0.5, 0, Z0[c.side] + c.y + 0.5);
}

function chartTexture(enemy: boolean): THREE.CanvasTexture {
  const S = 1100, u = 100, m = 50;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#17120b';
  g.fillRect(0, 0, S, S);
  g.fillStyle = enemy ? '#b39a62' : '#d6c08a';
  g.fillRect(m, m, S - 2 * m, S - 2 * m);
  let seed = enemy ? 23 : 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (enemy) {
    g.strokeStyle = 'rgba(13,11,8,.13)';
    g.lineWidth = 3;
    for (let i = -S; i < S; i += 14) { g.beginPath(); g.moveTo(m + i, m); g.lineTo(m + i + S, m + S); g.stroke(); }
    g.fillStyle = '#17120b';
    g.fillRect(0, 0, S, m); g.fillRect(0, S - m, S, m); g.fillRect(0, 0, m, S); g.fillRect(S - m, 0, m, S);
  }
  g.strokeStyle = 'rgba(13,11,8,.5)';
  g.lineWidth = 2;
  for (let n = 0; n < 60; n++) {
    const x = m + 20 + rnd() * (S - 2 * m - 60), y = m + 20 + rnd() * (S - 2 * m - 40), w = 14;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 7, x + w, y); g.quadraticCurveTo(x + w * 1.5, y + 7, x + 2 * w, y); g.stroke();
  }
  g.strokeStyle = 'rgba(13,11,8,.55)';
  g.lineWidth = 2;
  for (let i = 0; i <= N; i++) {
    g.beginPath(); g.moveTo(m + i * u, m); g.lineTo(m + i * u, S - m); g.stroke();
    g.beginPath(); g.moveTo(m, m + i * u); g.lineTo(S - m, m + i * u); g.stroke();
  }
  g.lineWidth = 6; g.strokeStyle = '#0d0b08'; g.strokeRect(m, m, S - 2 * m, S - 2 * m);
  g.fillStyle = '#a8946a'; g.font = '600 26px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    if (enemy) g.fillText('ABCDEFGHIJ'[i], m + i * u + u / 2, m / 2);
    g.fillText(String(i + 1), m / 2, m + i * u + u / 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const mat = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {
  hull: mat(0x1a140c), deck: mat(C.deck), sail: mat(C.sail, { side: THREE.DoubleSide }), mast: mat(0x2a2116), flag: mat(C.wax),
  wreck: mat(0x241c12), wax: mat(C.wax), flame: new THREE.MeshBasicMaterial({ color: C.amber }), smoke: mat(0x1a140c, { transparent: true, opacity: 0.55 }),
  select: mat(C.amber), bad: mat(C.wax), debris: mat(0x2a2116), ball: mat(0x15110b),
  line: new THREE.LineBasicMaterial({ color: C.ink }), lineAmber: new THREE.LineBasicMaterial({ color: C.amber }),
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
};
G.disc.rotateX(-Math.PI / 2); G.ring.rotateX(-Math.PI / 2); G.ring2.rotateX(-Math.PI / 2); G.cell.rotateX(-Math.PI / 2);

export class SeaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private dynamic = new THREE.Group();
  private marks = new THREE.Group();
  private fx = new THREE.Group();
  private flames: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(C.ink);
    this.scene.fog = new THREE.Fog(C.ink, 34, 70);
    this.scene.add(new THREE.HemisphereLight(0xfff1cf, 0x2a2116, 2.1));
    const sun = new THREE.DirectionalLight(0xffe2a8, 1.6);
    sun.position.set(-6, 12, 8);
    this.scene.add(sun);

    const table = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x120e09));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.05;
    this.scene.add(table);
    for (const side of ['enemy', 'own'] as Side[]) {
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshLambertMaterial({ map: chartTexture(side === 'enemy') }));
      chart.rotation.x = -Math.PI / 2;
      chart.position.set(0, 0, Z0[side] + N / 2);
      this.scene.add(chart);
    }
    this.scene.add(this.marks, this.dynamic, this.fx);
    addEventListener('resize', () => this.resize());
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

  private resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Back the camera off until both charts fit between the rails and side panels.
    const wide = w > 1000;
    const safe = { side: wide ? 262 : 6, top: 74, bottom: wide ? 160 : 122 };
    const dir = new THREE.Vector3(0, 1, 1.05).normalize();
    this.camera.setViewOffset(w, h, 0, (safe.bottom - safe.top) / 2, w, h);
    for (let d = 12; d < 120; d += 0.5) {
      this.camera.position.copy(dir).multiplyScalar(d);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      const fits = [[-5.6, -11.1], [5.6, -11.1], [-5.6, 11.1], [5.6, 11.1]].every(([x, z]) => {
        const v = new THREE.Vector3(x, 0, z).project(this.camera);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        return px >= safe.side && px <= w - safe.side && py >= safe.top && py <= h - safe.bottom;
      });
      if (fits) break;
    }
    this.camera.updateProjectionMatrix();
  }

  /** Screen position of a cell centre, in CSS pixels. */
  screen(c: Cell): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect(), v = cellCenter(c).project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Grid cell under a pointer event, or null when it is off both charts. */
  pick(ev: { clientX: number; clientY: number }): Cell | null {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(p, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    const x = Math.floor(hit.x + N / 2);
    if (x < 0 || x >= N) return null;
    for (const side of ['enemy', 'own'] as Side[]) {
      const y = Math.floor(hit.z - Z0[side]);
      if (y >= 0 && y < N) return { side, x, y };
    }
    return null;
  }

  private shipMesh(s: Ship, side: Side, tint?: THREE.Material): THREE.Group {
    const grp = new THREE.Group();
    const geo = hullGeo(s.len);
    if (s.sunk) {
      const hull = new THREE.Mesh(geo.hull, M.wreck);
      hull.position.y = -0.2; hull.rotation.x = 0.35;
      grp.add(hull);
      const edge = new THREE.LineSegments(geo.edges, M.lineAmber);
      edge.position.copy(hull.position); edge.rotation.copy(hull.rotation);
      grp.add(edge);
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
      s.hits.forEach((h, i) => { if (h) grp.add(this.fire(i + 0.5, 0.32, 0)); });
    }
    const z = Z0[side];
    if (s.dir === 'h') grp.position.set(s.x - N / 2, 0, z + s.y + 0.5);
    else { grp.position.set(s.x - N / 2 + 0.5, 0, z + s.y); grp.rotation.y = -Math.PI / 2; }
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

  private drawMarks(p: PlayerState, side: Side, round: number) {
    for (const s of p.shots) {
      const age = round - s.round, fade = Math.max(0.3, 1 - age * 0.14);
      const at = cellCenter({ side, x: s.x, y: s.y });
      if (s.result === 'miss') {
        const m = new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: fade });
        const a = new THREE.Mesh(G.ring, m), b = new THREE.Mesh(G.ring2, m);
        a.position.set(at.x, 0.02, at.z); b.position.copy(a.position);
        this.marks.add(a, b);
      } else if (side === 'enemy') {
        const d = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: C.wax, transparent: true, opacity: fade }));
        d.position.set(at.x, 0.03, at.z);
        this.marks.add(d);
        if (!s.sunk && age <= 1) this.marks.add(this.fire(at.x, 0.03, at.z));
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
  }

  /** Rebuild ships and markers from the game state. */
  sync(g: Game, o: SyncOpts = {}) {
    this.dynamic.clear(); this.marks.clear(); this.flames = [];
    for (const s of g.players[0].ships) {
      const tint = s.id === o.selectedId ? (o.invalid ? M.bad : M.select) : undefined;
      this.dynamic.add(this.shipMesh(s, 'own', tint));
    }
    for (const s of g.players[1].ships) if (s.sunk || o.revealEnemy) this.dynamic.add(this.shipMesh(s, 'enemy'));
    this.drawMarks(g.players[0], 'own', g.round);
    this.drawMarks(g.players[1], 'enemy', g.round);
  }

  private hl = new THREE.Group();
  setHighlights(list: Highlight[]) {
    if (!this.hl.parent) this.scene.add(this.hl);
    this.hl.clear();
    for (const h of list) {
      const m = new THREE.Mesh(G.cell, new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: h.opacity ?? 0.45, depthWrite: false }));
      const at = cellCenter(h);
      m.position.set(at.x, 0.04, at.z);
      this.hl.add(m);
    }
  }

  /** Lob a cannonball onto a cell; resolves when it lands. */
  shot(target: Cell): Promise<void> {
    const to = cellCenter(target);
    const from = new THREE.Vector3((Math.random() - 0.5) * 6, 0.6, target.side === 'enemy' ? 6 : -6);
    const ball = new THREE.Mesh(G.ball, M.ball);
    this.fx.add(ball);
    const t0 = performance.now(), dur = 620;
    return new Promise((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / dur);
        ball.position.lerpVectors(from, to, u);
        ball.position.y += Math.sin(u * Math.PI) * 4.5;
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
