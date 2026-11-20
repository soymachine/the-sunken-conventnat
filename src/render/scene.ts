// three.js view of the two sea charts. Ships are persistent objects that glide,
// ride the swell and sink; everything else is rebuilt from the public state.
import * as THREE from 'three';
import { Pub, SidePub } from '../game/engine';
import { Kind, N, START_COLS, Ship, ShotOutcome, ZONE, headingOf, shipCells } from '../game/rules';
import { Fx } from './fx';
import { Kraken } from './kraken';
import { Weather } from './weather';
import { Post } from './post';
import { Sea, waveH } from './sea';
import { ShipModel, buildShip, loadPropModels, loadShipModels, propModel, setShipTime } from './ships';

export type Side = 'own' | 'enemy';
export interface Cell { side: Side; x: number; y: number }
export interface Highlight extends Cell { color: number; opacity?: number }
export interface View { pub: Pub; me: 0 | 1; ships: Ship[]; selectedId?: number | null; invalid?: boolean; lifted?: boolean;
  /** Convoy only: whose chart carries the route, and whether to mark the merchantman's starting waters. */
  convoy?: { side: Side; zone: boolean };
  /** Rebuilding after a reload: show the present state without replaying how it came about. */
  quiet?: boolean;
  /** Blows still on their way: keys `side:x,y` whose marks and damage must not show yet. */
  hide?: Set<string>;
  /** Translucent previews of where a ship would lie after a turn. */
  ghosts?: Ghost[] }
export interface Ghost { kind: Kind; len: number; x: number; y: number; dir: 'h' | 'v'; rev: boolean; from: [number, number]; pivot: [number, number]; state: 'hot' | 'idle' | 'bad';
  /** Draw the translucent ship itself (only for the turn being pointed at), not just its arrow. */
  ship: boolean }
export type Sound = 'cannon' | 'splash' | 'hit' | 'clang' | 'sink' | 'coin' | 'glass' | 'roar' | 'thunder' | 'gull' | 'treasure' | 'plunge';

const C = { ink: 0x0d0b08, amber: 0xd9a441, parch: 0xe8d5a3, brass: 0xb08d3c, wax: 0x8c2f1b };
const HALF = N / 2;
/** World position of each chart's (0,0) corner. Stacked on tall screens, side by side on wide ones. */
export type Quality = 'auto' | 'high' | 'low';
const STACKED: Record<Side, { x: number; z: number }> = { enemy: { x: -HALF, z: -(N + 0.5) }, own: { x: -HALF, z: 0.5 } };
const ABREAST: Record<Side, { x: number; z: number }> = { own: { x: -(N + 0.75), z: -HALF }, enemy: { x: 0.75, z: -HALF } };
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
const labels = new Map<string, THREE.MeshBasicMaterial>();
const labelGeo = new THREE.PlaneGeometry(0.92, 0.92);
labelGeo.rotateX(-Math.PI / 2);
/** A numbered disc lying flat on the chart, drawn beneath every other mark. */
function label(text: string, color: string): THREE.Mesh {
  let m = labels.get(text + color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: sprite((g) => {
      g.fillStyle = '#0d0b08'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
      g.strokeStyle = color; g.lineWidth = 6; g.stroke();
      g.fillStyle = color; g.font = '700 56px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 64, 68);
    }) });
    labels.set(text + color, m);
  }
  const s = new THREE.Mesh(labelGeo, m);
  s.renderOrder = -1;
  return s;
}
/** Text laid flat along a chart edge, reading upwards. */
function banner(text: string, color: string): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 1024;
  const g = cv.getContext('2d')!;
  g.translate(32, 512); g.rotate(-Math.PI / 2);
  g.fillStyle = color; g.font = '700 34px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.split('').join('\u2009'), 0, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const BANNERS = { colony: banner('THE COLONY', '#0d0b08'), home: banner('HOME PORT', '#0d0b08') };
const puffTex = sprite((g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(232,222,196,.95)'); r.addColorStop(0.55, 'rgba(214,204,178,.5)'); r.addColorStop(1, 'rgba(214,204,178,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});

const G = {
  glow: new THREE.PlaneGeometry(1.3, 1.3), disc: new THREE.CircleGeometry(0.3, 20), ring: new THREE.RingGeometry(0.22, 0.3, 24), ring2: new THREE.RingGeometry(0.08, 0.13, 16),
  flame: new THREE.ConeGeometry(0.13, 0.5, 8), cell: new THREE.PlaneGeometry(0.94, 0.94),
  plank: new THREE.BoxGeometry(0.34, 0.04, 0.08), ball: new THREE.SphereGeometry(0.16, 12, 8),
  chest: new THREE.BoxGeometry(0.5, 0.3, 0.36), lid: new THREE.BoxGeometry(0.54, 0.1, 0.4),
  torus: new THREE.TorusGeometry(0.4, 0.05, 6, 20), seal: new THREE.CylinderGeometry(0.3, 0.3, 0.09, 20), sealRim: new THREE.TorusGeometry(0.3, 0.035, 6, 24), eye: new THREE.RingGeometry(0.32, 0.42, 4),
  zone: new THREE.EdgesGeometry(new THREE.PlaneGeometry(2 * ZONE + 1, 2 * ZONE + 1)), beam: new THREE.PlaneGeometry(0.5, 2 * ZONE + 1),
};
for (const k of ['disc', 'ring', 'ring2', 'cell', 'zone', 'eye', 'torus', 'beam'] as const) G[k].rotateX(-Math.PI / 2);
const M = {
  flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.35) }), gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.72, 0.16) }),
  chest: new THREE.MeshLambertMaterial({ color: 0x7a5a1e }), debris: new THREE.MeshLambertMaterial({ color: 0x2a2116 }), ball: new THREE.MeshLambertMaterial({ color: 0x15110b }),
  chestDim: new THREE.MeshLambertMaterial({ color: 0x5a4a2a, transparent: true, opacity: 0.6 }), goldDim: new THREE.MeshBasicMaterial({ color: 0x8a6f2c, transparent: true, opacity: 0.6 }),
  sealDim: new THREE.MeshBasicMaterial({ color: 0x6b2a1c, transparent: true, opacity: 0.6 }),
  chain: new THREE.MeshLambertMaterial({ color: C.wax }), seal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.13, 0.06) }), line: new THREE.LineBasicMaterial({ color: C.ink }),
  lineAmber: new THREE.LineBasicMaterial({ color: C.amber }), lineWax: new THREE.LineBasicMaterial({ color: C.wax }),
};

interface ShipObj {
  root: THREE.Group; tilt: THREE.Group; model: ShipModel; decor: THREE.Group; decorKey: string;
  kind: Kind; len: number; side: Side; pos: THREE.Vector3; yaw: number; phase: number;
  state: 'afloat' | 'sinking' | 'wreck'; sink: number; lift: number; fires: THREE.Vector3[]; cells: [number, number][]; fresh: boolean;
  /** Smoothed speed over the water, for the wake. */
  way?: number;
  /** The deck gun is being laid on a target: leave it be. */
  laying?: boolean;
  /** Seen only through the Long Glass: drawn inside its patch and nowhere else. */
  peek?: boolean;
  /** Where the hull meets the water, in the ship's own frame: centre along her length, half length, half beam. */
  foot?: { cx: number; cz: number; half: number; beam: number };
}

/* ---------- message in a bottle ---------- */
function bottleModel(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x5f7a4a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.52, 16), glass);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  shoulder.position.y = 0.26;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 12), glass);
  neck.position.y = 0.44;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 }));
  cork.position.y = 0.56;
  const wax = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8e2412, roughness: 0.5 }));
  wax.position.y = 0.6;
  // The rolled letter inside, tied with a thread.
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 0.9 }));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 16), new THREE.MeshStandardMaterial({ color: 0x8c2f1b }));
  tie.rotation.x = Math.PI / 2;
  const inner = new THREE.Group();
  inner.add(body, shoulder, neck, cork, wax, scroll, tie);
  inner.rotation.z = Math.PI / 2; // lying on its side in the water
  for (const m of [body, cork, wax, scroll]) m.castShadow = true;
  g.add(inner);
  g.scale.setScalar(1.365);
  return g;
}

/* ---------- treasure ---------- */
const glowTex = sprite((g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
/** The face of a covenant seal: red wax pressed with the kraken's mark. */
const sealFace = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const wax = g.createRadialGradient(100, 90, 10, 128, 128, 128);
  wax.addColorStop(0, '#d0573c'); wax.addColorStop(0.6, '#9a2a17'); wax.addColorStop(1, '#5a140a');
  g.fillStyle = wax; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(40,6,2,.55)'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,170,140,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(126, 125, 92, 3.6, 5.6); g.stroke();
  // The mark: a kraken's head with curling arms, pressed in (dark) and catching light on its upper edge.
  const mark = (dx: number, dy: number, col: string) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.ellipse(128 + dx, 104 + dy, 26, 30, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) for (const k of [0, 1]) {
      g.beginPath(); g.moveTo(128 + dx + s * (8 + k * 12), 128 + dy);
      g.quadraticCurveTo(128 + dx + s * (18 + k * 26), 170 + dy, 128 + dx + s * (44 + k * 6), 160 + dy - k * 22);
      g.quadraticCurveTo(128 + dx + s * (52 + k * 4), 150 + dy - k * 22, 128 + dx + s * (42 + k * 4), 144 + dy - k * 22);
      g.stroke();
    }
  };
  mark(-2, -2, 'rgba(255,160,130,.45)'); mark(2, 2, 'rgba(45,6,2,.75)'); mark(0, 0, '#86200f');
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const TM = {
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.75, roughness: 0.35 }),
  coin: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.82, 0.22) }),
  wax: new THREE.MeshStandardMaterial({ color: 0x8e2412, roughness: 0.55 }),
  face: new THREE.MeshStandardMaterial({ map: sealFace, roughness: 0.5 }),
};
const TG = {
  body: new THREE.BoxGeometry(0.46, 0.24, 0.3),
  groove: new THREE.BoxGeometry(0.462, 0.012, 0.302),
  strap: new THREE.BoxGeometry(0.035, 0.25, 0.31),
  lid: new THREE.CylinderGeometry(0.15, 0.15, 0.46, 16, 1, false, 0, Math.PI),
  lidStrap: new THREE.CylinderGeometry(0.158, 0.158, 0.035, 16, 1, false, 0, Math.PI),
  lock: new THREE.BoxGeometry(0.06, 0.07, 0.02),
  hoard: new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  coin: new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12),
  seal: new THREE.CylinderGeometry(0.27, 0.29, 0.07, 32),
  sealRim: new THREE.TorusGeometry(0.29, 0.025, 6, 32),
  ribbon: new THREE.BoxGeometry(0.07, 0.2, 0.012),
};
const protos = new Map<string, THREE.Group>();
/** A treasure chest spilling gold, or a covenant seal; the enemy's are faded. Built once, then cloned. */
function treasureModel(kind: 'gold' | 'seal', faded: boolean): THREE.Group {
  // The Meshy models, once loaded: the chest a little over half a square across, the seal standing
  // on its ribbons and leaning back so its kraken looks up at the captain.
  const prop = propModel(kind, faded);
  if (prop) {
    const g = new THREE.Group();
    if (kind === 'gold') { prop.scale.setScalar(0.56); prop.position.y = -0.02; }
    else { prop.scale.setScalar(0.66); prop.rotation.x = -0.95; prop.position.set(0, 0.03, 0.16); }
    g.add(prop);
    return g;
  }
  const key = kind + (faded ? ':dim' : '');
  let proto = protos.get(key);
  if (!proto) {
    proto = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; proto!.add(m); return m;
    };
    if (kind === 'gold') {
      add(TG.body, TM.wood, 0, 0.12, 0);
      add(TG.groove, TM.dark, 0, 0.08, 0); add(TG.groove, TM.dark, 0, 0.16, 0);
      for (const x of [-0.15, 0.15]) add(TG.strap, TM.brass, x, 0.12, 0);
      // The lid stands open on its hinge at the back, showing the hoard.
      const lid = new THREE.Group(); lid.position.set(0, 0.24, -0.15); lid.rotation.x = -1.15; proto.add(lid);
      for (const [geo, mat, x] of [[TG.lid, TM.wood, 0], [TG.lidStrap, TM.brass, -0.15], [TG.lidStrap, TM.brass, 0.15]] as const) {
        const m = new THREE.Mesh(geo, mat); m.rotation.z = Math.PI / 2; m.rotation.y = Math.PI / 2; m.position.set(x, 0, 0.15); m.castShadow = true; lid.add(m);
      }
      add(TG.lock, TM.brass, 0, 0.2, 0.16);
      add(TG.hoard, TM.coin, 0, 0.22, 0.02).scale.set(1, 0.35, 0.68);
      for (const [x, z, r] of [[0.28, 0.12, 0.4], [-0.3, 0.06, -0.3], [0.2, 0.24, 1.1], [-0.12, 0.25, 0.2]]) {
        const c = add(TG.coin, TM.coin, x, 0.01, z); c.rotation.set(r * 0.4, r, r * 0.3);
      }
    } else {
      // The seal stands tilted to the light on a short ribbon, like one cut from a covenant.
      const disc = add(TG.seal, [TM.wax, TM.face, TM.wax], 0, 0.34, 0); disc.rotation.x = Math.PI / 2 - 0.55;
      const rim = add(TG.sealRim, TM.brass, 0, 0.34, 0); rim.rotation.x = -0.55;
      for (const s of [-1, 1]) { const r = add(TG.ribbon, TM.wax, s * 0.08, 0.1, 0.06); r.rotation.z = s * 0.35; }
    }
    if (faded) proto.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const c = x.clone(); c.transparent = true; c.opacity = 0.55; return c; }) as THREE.Material[];
    });
    protos.set(key, proto);
  }
  return proto.clone();
}

export class SeaScene {
  /** Set by the controller to play sounds in step with the effects. */
  sound: (s: Sound) => void = () => {};
  /** Set by the controller: heavy rain on or off while a storm is over the charts. */
  rain: (on: boolean) => void = () => {};
  /** Set by the controller: the sea and the ship's timbers under the whole battle. */
  ambience: (on: boolean) => void = () => {};
  private nextGull = 8;
  /** Messages in bottles crossing between the charts; `stay` ones bob where they land until read. */
  private bottles: { g: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; peak: number; yaw: number; spin: number; stay: boolean; landed?: number; fade?: number; done?: () => void }[] = [];
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  private marks = new THREE.Group();
  private shipsGroup = new THREE.Group();
  private misc = new THREE.Group();
  private hl = new THREE.Group();
  private ghosts = new THREE.Group();
  private ghostKey = '';
  private pan: THREE.Vector3 | null = null;
  private fx = new Fx();
  private kraken = new Kraken();
  private weather = new Weather();
  private stormy = false;
  private nextBolt = 3;
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
  /** What the player chose: 'auto' lowers the quality by itself on slow machines. */
  private qualityPref: Quality = 'auto';
  private paperShadows: THREE.Mesh[] = [];
  private frames = 0; private slow = 0; private laid = false;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const forced = new URLSearchParams(location.search).get('q') as Quality | null;
    let stored: string | null = null;
    try { stored = localStorage.getItem('tsc:quality'); } catch { /* storage unavailable */ }
    this.qualityPref = forced ?? (stored === 'high' || stored === 'low' ? stored : 'auto');
    this.quality = this.qualityPref === 'low' ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.scene.background = new THREE.Color(C.ink);
    this.scene.add(new THREE.HemisphereLight(0xfff1cf, 0x2a2116, 2.0));
    this.sun.position.set(-9, 16, 8);
    this.sun.castShadow = this.quality === 'high';
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -N - 3; sc.right = N + 3; sc.top = N + 3; sc.bottom = -N - 3; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun);
    this.scene.add(this.chartTable());
    this.seas = { enemy: new Sea(true), own: new Sea(false) };
    for (const side of ['enemy', 'own'] as Side[]) {
      this.scene.add(this.seas[side].mesh);
      // The chart is drawn by its own shader, so a separate plane catches the ships' shadows.
      const shGeo = new THREE.PlaneGeometry(N, N, 32, 32);
      shGeo.rotateX(-Math.PI / 2);
      const sh = new THREE.Mesh(shGeo, new THREE.ShadowMaterial({ opacity: 0.32 }));
      sh.receiveShadow = true; sh.userData.lift = 0.03;
      sh.visible = this.quality === 'high';
      this.shadowPlanes.push(sh);
      this.scene.add(sh);
    }
    this.scene.add(this.marks, this.shipsGroup, this.misc, this.hl, this.fx.group, this.kraken.group, this.weather.group);
    if (this.quality === 'high') this.post = new Post(this.renderer, this.scene, this.camera);
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel(e); }, { passive: false });
    // Hold the middle button and drag to slide the charts under the camera.
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.pan = this.ground(e);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.pan) return;
      const g = this.ground(e);
      if (!g) return;
      this.target.add(this.pan.clone().sub(g));
      this.target.x = Math.max(-this.extent.x, Math.min(this.extent.x, this.target.x));
      this.target.z = Math.max(-this.extent.z, Math.min(this.extent.z, this.target.z));
      this.place();
    });
    const drop = (e: PointerEvent) => { if (this.pan) { this.pan = null; canvas.style.cursor = ''; canvas.releasePointerCapture(e.pointerId); } };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);
    canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    this.scene.add(this.ghosts);
    this.resize();
    void loadPropModels().then((n) => { if (n && this.last) this.sync(this.last); });
    void loadShipModels().then((n) => { if (n) { for (const o of this.ships.values()) this.shipsGroup.remove(o.root); this.ships.clear(); if (this.last) this.sync(this.last); } });
    let prev = performance.now();
    const loop = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.time += dt;
      this.frame(dt, this.time);
      // Drop the expensive passes on machines that cannot keep up (unless a quality was forced).
      if (this.qualityPref === 'auto' && this.quality === 'high' && this.frames++ > 20 && this.frames < 140) {
        if (dt > 0.036) this.slow++;
        if (this.frames === 139 && this.slow > 70) this.lower();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /** Old sailcloth spread over the table: woven canvas in stitched panels, drawn once on a canvas and tiled. */
  private sailcloth(): THREE.CanvasTexture {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#a39680'; g.fillRect(0, 0, S, S);
    // Weave: fine warp and weft threads of slightly varying shade.
    for (let i = 0; i < S; i += 2) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '60,45,25'},${0.04 + Math.random() * 0.05})`; g.fillRect(i, 0, 1, S);
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '60,45,25'},${0.04 + Math.random() * 0.05})`; g.fillRect(0, i, S, 1);
    }
    // Weathering: soft blotches of grime and sun-bleaching.
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 70;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        const rg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        rg.addColorStop(0, Math.random() < 0.6 ? 'rgba(70,50,25,.13)' : 'rgba(255,245,220,.1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      }
    }
    // Two panels per tile, joined by a lapped seam with a double row of stitches.
    for (const x of [0, S / 2]) {
      const sh = g.createLinearGradient(x - 10, 0, x + 14, 0);
      sh.addColorStop(0, 'rgba(40,28,14,0)'); sh.addColorStop(0.42, 'rgba(40,28,14,.32)'); sh.addColorStop(0.5, 'rgba(255,240,210,.18)'); sh.addColorStop(1, 'rgba(40,28,14,0)');
      g.fillStyle = sh; g.fillRect(x - 10, 0, 24, S);
      g.fillStyle = 'rgba(50,36,20,.55)';
      for (let y = 0; y < S; y += 9) { g.fillRect(x - 5, y, 1.4, 4.5); g.fillRect(x + 7, y + 4, 1.4, 4.5); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  /** The charts lie on a sail spread over the captain's table, under a pool of lamplight; each sheet casts a soft shadow. */
  private chartTable(): THREE.Group {
    const g = new THREE.Group();
    const cloth = this.sailcloth();
    cloth.repeat.set(300 / 18, 300 / 18);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: cloth, color: 0x6c6c6c, roughness: 0.95 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -1.2;
    const canvasTex = (draw: (c: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      draw(cv.getContext('2d')!);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    // Lamplight falls off into darkness away from the charts.
    const dusk = canvasTex((c) => {
      const r = c.createRadialGradient(128, 128, 30, 128, 128, 128);
      r.addColorStop(0, 'rgba(13,11,8,0)'); r.addColorStop(0.32, 'rgba(13,11,8,.18)'); r.addColorStop(0.62, 'rgba(13,11,8,.7)'); r.addColorStop(1, 'rgba(13,11,8,1)');
      c.fillStyle = r; c.fillRect(0, 0, 256, 256);
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshBasicMaterial({ map: dusk, transparent: true, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = -1.18;
    const far = new THREE.Mesh(new THREE.RingGeometry(47, 200, 48), new THREE.MeshBasicMaterial({ color: C.ink }));
    far.rotation.x = -Math.PI / 2; far.position.y = -1.17;
    const soft = canvasTex((c) => {
      c.filter = 'blur(14px)'; c.fillStyle = 'rgba(0,0,0,.85)'; c.fillRect(36, 36, 184, 184);
    });
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(N + 4, N + 4), new THREE.MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false }));
      s.rotation.x = -Math.PI / 2;
      this.paperShadows.push(s);
      g.add(s);
    }
    g.add(table, pool, far);
    return g;
  }

  /** Choose the 3D quality: 'auto' starts high and steps down on a slow machine. Remembered between visits. */
  setQuality(q: Quality) {
    this.qualityPref = q;
    try { localStorage.setItem('tsc:quality', q); } catch { /* storage unavailable */ }
    if (q === 'low') this.lower();
    else { this.raise(); this.frames = 0; this.slow = 0; }
  }
  getQuality(): Quality { return this.qualityPref; }
  /** Choose how water is drawn around hulls (0 to 4); see Sea.wake. */
  setWake(n: number) { Sea.wake = n; }

  private refreshMaterials() {
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
    });
  }

  private raise() {
    if (this.quality === 'high') return;
    this.quality = 'high';
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.renderer.shadowMap.enabled = true;
    this.sun.castShadow = true;
    for (const p of this.shadowPlanes) p.visible = true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.refreshMaterials();
    this.resize();
  }

  private lower() {
    if (this.quality === 'low' && !this.post && !this.renderer.shadowMap.enabled) return;
    this.quality = 'low';
    this.post = null;
    this.renderer.shadowMap.enabled = false;
    this.sun.castShadow = false;
    for (const p of this.shadowPlanes) p.visible = false;
    this.renderer.setPixelRatio(1);
    this.refreshMaterials();
    this.resize();
  }

  /** Warm light on your turn, colder on the enemy's. */
  setTurn(mine: boolean) { this.post?.grade.set(mine ? 1.04 : 0.8, mine ? 1 : 0.86, mine ? 0.94 : 0.96); }

  /** A message in a bottle crosses from one chart to the other. Resolves when it lands. */
  bottle(to: Side, stay: boolean): Promise<void> {
    const from: Side = to === 'own' ? 'enemy' : 'own';
    // From a square near the middle of the thrower's chart to one near the middle of the other.
    const mid = () => 5 + Math.floor(Math.random() * 6);
    const a = cellCenter({ side: from, x: mid(), y: mid() }).setY(0.6), land = cellCenter({ side: to, x: mid(), y: mid() }).setY(0.1);
    const dist = a.distanceTo(land);
    const g = bottleModel();
    this.misc.add(g);
    this.sound('splash');
    return new Promise((res) => this.bottles.push({
      g, from: a, to: land, t0: this.time, dur: 1.2 + dist * 0.045, peak: 2.2 + dist * 0.22,
      yaw: Math.atan2(-(land.z - a.z), land.x - a.x), spin: 2 + Math.floor(Math.random() * 2), stay, done: res,
    }));
  }
  /** The bottle that washed up has been read: it sinks away. */
  clearBottles() { for (const b of this.bottles) b.stay = false; }

  /** The tide turns: a wave crosses both charts in its direction. */
  tide(dx: number, dy: number) {
    this.seas.own.tide(dx, dy, this.time); this.seas.enemy.tide(dx, dy, this.time);
    this.sound('splash'); setTimeout(() => this.sound('splash'), 900);
  }

  /** Forget every ship and mark: a new battle is starting. */
  reset() {
    for (const o of this.ships.values()) this.shipsGroup.remove(o.root);
    this.ships.clear(); this.marks.clear(); this.misc.clear(); this.hl.clear();
    this.seas.own.clear(); this.seas.enemy.clear();
    this.kraken.setZone(null);
    this.rain(false);
    this.ambience(false);
    this.ghosts.clear(); this.ghostKey = '';
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
    const safe = { left: wide ? 268 : 6, right: wide ? 232 : 6, top: 74, bottom: wide ? 196 : 150 };
    // Keep the charts' band in focus: the free space between the top bar and the helm.
    this.post?.setFocus(1 - (safe.top + (h - safe.bottom)) / 2 / h, (h - safe.top - safe.bottom) / h * 0.42);
    const layout = wide && w / h > 1.25 ? ABREAST : STACKED;
    const changed = layout !== origin || !this.laid;
    this.laid = true;
    origin = layout;
    (['enemy', 'own'] as Side[]).forEach((side, i) => {
      this.seas[side].mesh.position.set(origin[side].x + HALF, 0, origin[side].z + HALF);
      this.shadowPlanes[i].position.set(origin[side].x + HALF, 0, origin[side].z + HALF);
      this.paperShadows[i].position.set(origin[side].x + HALF + 0.5, -1.185, origin[side].z + HALF + 0.7);
    });
    this.dir.set(0, 1, layout === ABREAST ? 0.7 : 0.95).normalize();
    this.extent = layout === ABREAST ? { x: N + 0.75, z: HALF } : { x: HALF, z: N + 0.5 };
    this.camera.setViewOffset(w, h, (safe.right - safe.left) / 2, (safe.bottom - safe.top) / 2, w, h);
    this.camera.updateProjectionMatrix();
    const zoom = this.zoom, target = this.target.clone();
    this.zoom = 1; this.target.set(0, 0, 0);
    const ex = this.extent.x + 0.6, ez = this.extent.z + 0.6;
    for (this.baseDist = 14; this.baseDist < 260; this.baseDist += 0.5) {
      this.place();
      const ok = [[-ex, -ez], [ex, -ez], [-ex, ez], [ex, ez]].every(([x, z]) => {
        const v = new THREE.Vector3(x, 0, z).project(this.camera);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        return px >= safe.left && px <= w - safe.right && py >= safe.top && py <= h - safe.bottom;
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
    if (this.zoom >= 1 && e.deltaY > 0) this.target.set(0, 0, 0); // zooming all the way out re-centres
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
      const swing = Math.atan2(Math.sin(o.yaw - o.root.rotation.y), Math.cos(o.yaw - o.root.rotation.y));
      o.root.rotation.y += swing * k;
      const sea = this.seas[o.side], p = o.root.position;
      if (o.state === 'afloat') {
        // A moving hull leaves a wake and heels into its turn.
        const speed = before.distanceTo(p) / Math.max(dt, 1e-3), turning = Math.abs(swing);
        if (speed > 0.3 && !Sea.wake) sea.bump(Math.floor(before.x - origin[o.side].x), Math.floor(before.z - origin[o.side].z), 0.06);
        const bob = calm ? 0 : 1;
        // Ride the bending chart: rise with it and lean with its slope along and across the hull.
        const cy = Math.cos(o.root.rotation.y), sy = Math.sin(o.root.rotation.y), half = o.len * 0.35;
        const fore = waveH(p.x + cy * half, p.z - sy * half, t) - waveH(p.x - cy * half, p.z + sy * half, t);
        const beam = waveH(p.x + sy * 0.3, p.z + cy * 0.3, t) - waveH(p.x - sy * 0.3, p.z - cy * 0.3, t);
        o.tilt.position.y += (waveH(p.x, p.z, t) * bob + o.lift - o.tilt.position.y) * Math.min(1, k * 2);
        o.tilt.rotation.x = bob * (0.04 * Math.sin(t * 1.25 + o.phase) - Math.atan2(beam, 0.6)) + turning * 0.5;
        o.tilt.rotation.z = bob * (0.015 * Math.sin(t * 0.9 + o.phase * 2.3) + Math.atan2(fore, half * 2)) - Math.min(0.06, speed * 0.02);
        // The wake builds quickly under way and lingers a moment after she stops, as real wakes do.
        const want = Math.min(1, speed / 1.2), was = o.way ?? 0;
        o.way = was + (want - was) * Math.min(1, dt * (want > was ? 6 : 0.7));
        if (!Sea.wake) for (const [x, y] of o.cells) sea.hold(x, y, 0.55);
        // At rest, a deck gun keeps its muzzle trained on the enemy's chart, whichever way the hull lies.
        const gun = o.model.gun;
        if (gun && o.side === 'own' && !o.laying) {
          const to = cellCenter({ side: 'enemy', x: N / 2, y: N / 2 });
          o.tilt.updateMatrixWorld(true);
          const local = gun.pivot.parent!.worldToLocal(to);
          const want = Math.atan2(-(local.z - gun.pivot.position.z), local.x - gun.pivot.position.x);
          const d = Math.atan2(Math.sin(want - gun.pivot.rotation.y), Math.cos(want - gun.pivot.rotation.y));
          gun.pivot.rotation.y += d * Math.min(1, dt * 3);
        }
        if (o.model.funnel && !o.peek) this.fx.funnel(o.root.localToWorld(o.model.funnel.clone().setY(o.model.funnel.y + o.tilt.position.y)), dt);
      } else {
        if (o.state === 'sinking') {
          o.sink = Math.min(1, o.sink + dt / 2.6);
          this.fx.bubbles(p.clone().setY(0.1), dt);
          for (const [x, y] of o.cells) sea.hold(x, y, 0.9);
          if (o.sink > 0.45) o.model.sails.visible = false;
          // Down she goes, through the paper, and the water closes over her: nothing is left to block the way.
          if (o.sink >= 1) { o.state = 'wreck'; o.root.visible = false; }
        }
        const e = o.sink * o.sink * (3 - 2 * o.sink);
        o.tilt.position.y = waveH(p.x, p.z, t) * (calm ? 0 : 1) - 1.25 * e;
        o.tilt.rotation.x = 0.55 * e;
        o.tilt.rotation.z = -0.16 * e;
        for (const m of o.model.mats) { m.uniforms.uTint.value.setHex(0x17120b); m.uniforms.uTintAmt.value = 0.55 * e; }
      }
      if (o.state !== 'wreck') for (const f of o.fires) this.embers.push(o.tilt.localToWorld(f.clone()));
    }
    for (const e of this.embers0) this.embers.push(e);
    for (const e of this.embers) this.fx.ember(e, dt);
    this.flames.forEach((f, i) => { f.scale.y = 1 + 0.22 * Math.sin(t * 9 + i * 1.7); });
    for (const p of this.puffs) { p.s.position.set(p.base.x + 0.5 * Math.sin(t * 0.3 + p.ph), p.base.y + 0.12 * Math.sin(t * 0.5 + p.ph * 2), p.base.z + 0.4 * Math.cos(t * 0.24 + p.ph)); }
    this.glints.forEach((g, i) => {
      const inner = g.userData.inner as THREE.Object3D | undefined;
      if (!inner) return;
      inner.position.y = 0.035 * Math.sin(t * 1.6 + i * 1.3);
      // Chests turn slowly; a seal keeps its kraken facing the captain.
      inner.rotation.y = g.userData.spin ? g.userData.spin * t + i : 0;
      inner.rotation.z = g.userData.spin ? 0.06 * Math.sin(t * 1.1 + i) : 0;
      const glow = g.userData.glow as THREE.Mesh | undefined;
      if (glow) (glow.material as THREE.MeshBasicMaterial).opacity = 0.32 + 0.22 * Math.sin(t * 2.4 + i);
    });
    this.kraken.update(dt, t);
    // Everything lying on the chart follows its swell.
    const swell = calm ? () => 0 : (x: number, z: number) => waveH(x, z, t);
    for (const grp of [this.marks, this.hl]) for (const c of grp.children) {
      if (c.userData.drape) { this.drape(c as THREE.Mesh, swell); continue; }
      c.userData.y0 ??= c.position.y;
      c.position.y = c.userData.y0 + swell(c.position.x, c.position.z);
    }
    for (const sh of this.shadowPlanes) this.drape(sh, swell);
    for (const g of this.ghosts.children) g.position.y = (g.userData.y0 ?? 0) + swell(g.position.x, g.position.z);
    if (this.stormy && (this.nextBolt -= dt) < 0) {
      this.nextBolt = 2.5 + Math.random() * 5;
      this.seas.own.flash(); this.seas.enemy.flash();
      // The bolt comes down somewhere under the front, on either chart.
      const st = this.last?.pub.storm, side: Side = Math.random() < 0.5 ? 'own' : 'enemy';
      if (st) this.weather.strike(cellCenter({ side, x: Math.floor(Math.random() * N), y: st.row + Math.floor(Math.random() * 3) }));
      this.sound('thunder');
    }
    // The water around each hull follows her real outline, heading and way.
    for (const side of ['own', 'enemy'] as Side[]) {
      const list = [];
      for (const o of this.ships.values()) {
        if (o.side !== side || o.state === 'wreck' || o.peek || !o.root.visible || !o.root.parent) continue;
        const p = o.root.position, y = o.root.rotation.y, f = (o.foot ??= this.footprint(o));
        const cx = p.x + Math.cos(y) * f.cx + Math.sin(y) * f.cz, cz = p.z - Math.sin(y) * f.cx + Math.cos(y) * f.cz;
        list.push({ x: cx - origin[side].x, y: cz - origin[side].z, dir: -y, half: f.half, beam: f.beam, speed: o.state === 'afloat' ? o.way ?? 0 : 0 });
      }
      // Floating treasure sits in the water like a small hull.
      for (const tr of this.last?.pub.treasures ?? []) {
        if ((tr.side === this.last!.me) !== (side === 'own')) continue;
        list.push({ x: tr.x + 0.5, y: tr.y + 0.5, dir: 0, half: 0.38, beam: 0.38, speed: 0 });
      }
      this.seas[side].setHulls(list);
    }
    this.seas.own.update(dt, t); this.seas.enemy.update(dt, t);
    this.weather.update(dt, t, this.camera);
    for (const b of [...this.bottles]) {
      const k = Math.min(1, (t - b.t0) / b.dur);
      if (k < 1) {
        // Thrown: a ballistic arc (constant speed across, parabola up and down), tumbling end over end.
        const p = b.from.clone().lerp(b.to, k);
        p.y = b.from.y + (b.to.y - b.from.y) * k + 4 * b.peak * k * (1 - k);
        b.g.position.copy(p);
        b.g.rotation.set(0, b.yaw, -b.spin * k * Math.PI * 2);
      } else {
        if (!b.landed) { b.landed = t; this.fx.water(b.to.clone().setY(0.1)); this.sound('plunge'); if (b.done) { const d = b.done; b.done = undefined; d(); } }
        // Afloat where it fell: it rides the swell, lying on its side.
        const s = t - b.landed;
        b.g.position.set(b.to.x, (calm ? 0 : waveH(b.to.x, b.to.z, t)) + 0.1 + 0.04 * Math.sin(t * 2.4) - (b.stay ? 0 : s * 0.25), b.to.z);
        b.g.rotation.set(0.25 * Math.sin(t * 1.7), b.yaw, 0.18 * Math.sin(t * 2.1));
        if (!b.stay) {
          // The sender only sees it splash down and slip under.
          b.fade = Math.max(0, (b.fade ?? 1) - dt * 0.9);
          b.g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material & { opacity: number } | undefined; if (m) { m.transparent = true; m.opacity = Math.min(m.opacity, b.fade!); } });
          if (b.fade <= 0) { this.misc.remove(b.g); this.bottles.splice(this.bottles.indexOf(b), 1); }
        }
      }
    }
    // Now and then a gull cries overhead (they keep away from storms).
    if ((this.nextGull -= dt) < 0) { this.nextGull = 14 + Math.random() * 26; if (this.weather.gullsHere && this.last?.pub.phase === 'battle') this.sound('gull'); }
    this.fx.update(dt);
    this.shakeAmt *= Math.exp(-dt * 7);
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.002) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt, 0));
    if (this.post) this.post.render(t); else this.renderer.render(this.scene, this.camera);
  }

  /** Measure a ship's hull below her deck (no sails, no bowsprit above it) in her own frame. */
  private footprint(o: ShipObj) {
    o.root.updateMatrixWorld(true);
    const inv = o.root.matrixWorld.clone().invert(), v = new THREE.Vector3(), m = new THREE.Matrix4();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const top = o.model.deckY * 0.9;
    o.model.body.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      let sail = false;
      for (let a: THREE.Object3D | null = mesh; a; a = a.parent) if (a === o.model.sails) sail = true;
      if (sail) return;
      m.multiplyMatrices(inv, mesh.matrixWorld);
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (v.y > top) continue;
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
      }
    });
    if (!isFinite(x0)) return { cx: 0, cz: 0, half: o.len * 0.47, beam: 0.3 };
    const beam = (z1 - z0) / 2;
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, half: Math.max((x1 - x0) / 2, beam + 0.05), beam };
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

  /** Lay a flat, subdivided sheet over the swell. */
  private drape(m: THREE.Mesh, swell: (x: number, z: number) => number) {
    const pos = m.geometry.attributes.position, lift = m.userData.lift ?? 0.1;
    for (let i = 0; i < pos.count; i++) pos.setY(i, swell(m.position.x + pos.getX(i), m.position.z + pos.getZ(i)) + lift);
    pos.needsUpdate = true;
  }

  private aim(o: ShipObj, s: Pick<Ship, 'x' | 'y' | 'dir' | 'len' | 'rev'>) {
    const cs = shipCells(s), a = cellCenter({ side: o.side, x: cs[0][0], y: cs[0][1] }), b = cellCenter({ side: o.side, x: cs[cs.length - 1][0], y: cs[cs.length - 1][1] });
    o.pos.copy(a).add(b).multiplyScalar(0.5);
    o.yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][headingOf(s)];
    o.cells = cs;
  }

  /** `hits` are in chart order (lowest square first); a ship facing west or north has her stern at the other end. */
  private decorate(o: ShipObj, chartHits: boolean[], chained: boolean, rev = false) {
    const hits = rev ? [...chartHits].reverse() : chartHits;
    const key = hits.map((h) => (h ? 1 : 0)).join('') + (chained ? 'c' : '');
    if (key === o.decorKey) return;
    o.decorKey = key;
    for (const c of o.decor.children) { const i = this.flames.indexOf(c); if (i >= 0) this.flames.splice(i, 1); }
    o.decor.clear();
    o.fires = [];
    o.model.crates.forEach((c, i) => { c.visible = !hits[i]; });
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
    const boxes: { x0: number; y0: number; x1: number; y1: number; color: number; opacity: number }[] = [];
    for (const s of p.shots) {
      if (this.hidden.has(`${side}:${s.x},${s.y}`)) continue;
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
      // The patch's outline is drawn into the sea, so the swell cannot hide it.
      boxes.push({ x0: sc.x - ZONE, y0: sc.y - ZONE, x1: sc.x + ZONE + 1, y1: sc.y + ZONE + 1, color: side === 'enemy' ? C.amber : C.wax, opacity: 0.9 });
      // Only my own readings carry a number; where the enemy scanned me, the box alone says so.
      if (side === 'enemy') {
        const l = label(sc.count < 0 ? '?' : String(sc.count), '#d9a441');
        l.position.set(at.x, 0.085, at.z);
        this.marks.add(l);
      }
    }
    this.seas[side].setBoxes(boxes);
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
  private hidden = new Set<string>();

  /** A flat tinted band over a block of cells. */
  private strip(side: Side, x: number, y: number, w: number, h: number, color: number, opacity: number, map?: THREE.Texture) {
    const geo = new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w * 2)), Math.max(1, Math.round(h * 2)));
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false }));
    m.userData.drape = true; m.userData.lift = 0.095;
    m.frustumCulled = false;
    m.position.set(origin[side].x + x + w / 2, 0, origin[side].z + y + h / 2);
    this.marks.add(m);
  }

  /** Bring the scene in line with the current view. */
  sync(v: View) {
    this.last = v;
    this.hidden = v.hide || new Set();
    const veiled = (side: Side, s: Pick<Ship, 'x' | 'y' | 'dir' | 'len'>) => shipCells(s).some(([x, y]) => this.hidden.has(`${side}:${x},${y}`));
    const foe = (1 - v.me) as 0 | 1, seen = new Set<string>();
    const wreck = (o: ShipObj) => {
      if (o.state !== 'afloat') return;
      if (v.quiet) { o.state = 'wreck'; o.sink = 1; o.model.sails.visible = false; o.root.visible = false; }
      else { o.state = 'sinking'; this.sound('sink'); }
    };
    for (const s of v.ships) {
      const key = 'o' + s.id, o = this.ship(key, s.kind, s.len, 'own');
      seen.add(key);
      this.aim(o, s);
      // Damage from a blow still in the air waits for it to land.
      const cs = shipCells(s), hits = s.hits.map((h, i) => h && !this.hidden.has(`own:${cs[i][0]},${cs[i][1]}`));
      if (s.sunk && !veiled('own', s)) { wreck(o); this.decorate(o, [], false); continue; }
      this.decorate(o, hits, !!s.chained, !!s.rev);
      const sel = s.id === v.selectedId;
      o.lift = sel && v.lifted ? 0.45 : 0;
      for (const m of o.model.mats) { m.uniforms.uTint.value.setHex(v.invalid ? C.wax : C.amber); m.uniforms.uTintAmt.value = sel ? 0.5 : 0; }
    }
    for (const s of v.pub.sides[foe].sunk) {
      if (veiled('enemy', s)) continue;
      const key = `e${s.kind}:${s.x},${s.y}`, o = this.ship(key, s.kind, s.len, 'enemy');
      seen.add(key);
      this.aim(o, s);
      wreck(o);
    }
    for (const s of v.pub.sides[foe].revealed || []) {
      if (s.sunk) continue;
      const key = 'r' + s.id, o = this.ship(key, s.kind, s.len, 'enemy');
      seen.add(key);
      this.aim(o, s);
      this.decorate(o, s.hits, false, !!s.rev);
    }
    // The Long Glass: while it is still my turn, the patch I looked at shows the enemy ships in it.
    const peeks = v.pub.sides[v.me].peeks || [];
    const look = v.pub.phase === 'battle' && v.pub.current === v.me ? peeks.filter((q) => q.round === v.pub.round).slice(-1)[0] : undefined;
    this.seas.enemy.setPeek(look ? { x: look.x, y: look.y } : null, this.time);
    if (look) {
      const a = cellCenter({ side: 'enemy', x: look.x, y: look.y }), clip = new THREE.Vector4(a.x - 0.5, a.z - 0.5, a.x + 1.5, a.z + 1.5);
      for (const s of look.ships) {
        const key = `p${s.kind}:${s.x},${s.y}`, fresh = !this.ships.has(key), o = this.ship(key, s.kind, s.len, 'enemy');
        seen.add(key);
        // Its shadow and funnel smoke would give away the rest of the ship outside the glass.
        if (!o.peek) o.root.traverse((c) => { c.castShadow = false; });
        o.peek = true;
        this.aim(o, s);
        for (const m of o.model.mats) m.uniforms.uClip.value.copy(clip);
        // The ship rises into view a moment after the glass clears.
        if (fresh) { o.root.visible = false; setTimeout(() => { o.root.visible = true; }, 650); }
      }
    }
    for (const [key, o] of this.ships) if (!seen.has(key)) { this.shipsGroup.remove(o.root); this.ships.delete(key); }

    for (const c of this.marks.children) { const i = this.flames.indexOf(c); if (i >= 0) this.flames.splice(i, 1); }
    this.marks.clear(); this.puffs = []; this.glints = []; this.embers0 = [];
    this.drawSide(v.pub.sides[v.me], 'own', v.pub.round);
    this.drawSide(v.pub.sides[foe], 'enemy', v.pub.round);
    // The Kraken, the storm and the maelstrom.
    const k = v.pub.kraken, kSide: Side | null = k ? (k.side === v.me ? 'own' : 'enemy') : null;
    this.kraken.setZone(k && kSide ? cellCenter({ side: kSide, x: k.x, y: k.y }) : null);
    this.seas.own.night = kSide === 'own' ? 1 : 0; this.seas.enemy.night = kSide === 'enemy' ? 1 : 0;
    if (k && kSide) this.strip(kSide, k.x - 1, k.y - 1, 3, 3, C.wax, 0.3);
    const st = v.pub.storm;
    this.stormy = !!st && v.pub.phase === 'battle';
    this.weather.setCharts(origin.own, origin.enemy);
    this.weather.setStorm(this.stormy ? st!.row : null);
    this.rain(this.stormy);
    this.ambience(v.pub.phase !== 'over');
    for (const side of ['own', 'enemy'] as Side[]) {
      this.seas[side].setStorm(st ? st.row : null);
      this.seas[side].setRing(v.pub.ring);
      if (st) for (let i = 0; i < 9; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x241d14, transparent: true, opacity: 0.85, depthWrite: false }));
        s.scale.set(5, 3.2, 1);
        const base = new THREE.Vector3(origin[side].x + 0.8 + i * (N - 1.6) / 8, 1.5 + (i % 3) * 0.25, origin[side].z + st.row + 1.5 + ((i % 2) - 0.5) * 0.9);
        s.position.copy(base);
        this.marks.add(s);
        this.puffs.push({ s, base, ph: i * 2.3 + (side === 'own' ? 0 : 4) });
      }
    }
    if (v.convoy) {
      const side = v.convoy.side, adm = v.pub.sides[side === 'own' ? v.me : foe], mineToHide = side === 'own';
      this.strip(side, 0, 0, 1, N, 0xffffff, 0.5, BANNERS.colony);
      this.strip(side, N - 1, 0, 1, N, C.amber, 0.22);
      this.strip(side, N - 1, 0, 1, N, 0xffffff, 0.6, BANNERS.home);
      if (v.convoy.zone) this.strip(side, 0, 0, START_COLS, N, C.amber, 0.2);
      for (const w of adm.wakes) this.strip(side, 0, w.y, N, 1, mineToHide ? C.wax : 0xfff4d6, Math.max(0.12, 0.42 - (v.pub.round - w.round) * 0.15));
      const rk = v.pub.reckon;
      if (rk && v.pub.round - rk.round <= 1) this.strip(side, rk.col, 0, 1, N, mineToHide ? C.wax : C.amber, 0.4);
    }
    this.syncGhosts(v.ghosts || []);
    for (const t of v.pub.treasures) {
      // The enemy's flotsam is only a clue to where their ships will go: draw it smaller and duller.
      const theirs = t.side !== v.me;
      const at = cellCenter({ side: theirs ? 'enemy' : 'own', x: t.x, y: t.y });
      const g = new THREE.Group(), inner = treasureModel(t.kind, theirs);
      g.add(inner);
      g.userData.inner = inner; g.userData.spin = t.kind === 'seal' ? 0 : 0.12;
      if (t.kind === 'seal' && !theirs) {
        // A covenant seal calls attention to itself: a slow red-gold glow on the water beneath it.
        const glow = new THREE.Mesh(G.glow, new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff7a40, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01;
        g.add(glow); g.userData.glow = glow;
      }
      g.scale.setScalar(theirs ? 1.05 : 1.4);
      g.position.set(at.x, 0.06, at.z);
      this.marks.add(g);
      this.glints.push(g);
    }
  }

  /** Translucent ships showing where a turn would leave her, each with an arc from the present bow. */
  private syncGhosts(list: Ghost[]) {
    const key = JSON.stringify(list);
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghosts.clear();
    for (const gh of list) {
      const color = gh.state === 'bad' ? C.wax : C.amber, alpha = gh.state === 'hot' ? 0.8 : gh.state === 'idle' ? 0.5 : 0.35;
      const model = buildShip(gh.kind, gh.len), root = new THREE.Group();
      for (const m of model.mats) { m.uniforms.uTint.value.setHex(color); m.uniforms.uTintAmt.value = gh.state === 'bad' ? 0.75 : 0.3; m.uniforms.uAlpha.value = gh.state === 'bad' ? 0.45 : 0.78; m.transparent = true; m.depthWrite = false; }
      model.body.traverse((n) => {
        n.castShadow = false;
        const lm = (n as THREE.LineSegments).material as THREE.LineBasicMaterial;
        if ((n as THREE.LineSegments).isLineSegments) { (n as THREE.LineSegments).material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha }); void lm; }
      });
      for (const c of model.crates) c.visible = false;
      if (gh.ship) root.add(model.body);
      const cs = shipCells(gh), a = cellCenter({ side: 'own', x: cs[0][0], y: cs[0][1] }), b = cellCenter({ side: 'own', x: cs[cs.length - 1][0], y: cs[cs.length - 1][1] });
      root.position.copy(a).add(b).multiplyScalar(0.5);
      root.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][headingOf(gh)];
      root.userData.y0 = 0.12;
      this.ghosts.add(root);
      // The sweep of the bow, as an arc with an arrowhead.
      const bow = gh.rev ? cs[0] : cs[cs.length - 1];
      // The arrowhead stands at least a square and a half out from the pivot, so a small ship's choices are as easy to see and hit as a big one's.
      const pv = cellCenter({ side: 'own', x: gh.pivot[0], y: gh.pivot[1] }), bowAt = cellCenter({ side: 'own', x: bow[0], y: bow[1] });
      const way = bowAt.clone().sub(pv).setY(0).normalize(), far = Math.max(1.5, bowAt.distanceTo(pv));
      const p0 = cellCenter({ side: 'own', x: gh.from[0], y: gh.from[1] }), p2 = pv.clone().addScaledVector(way, far);
      const ahead = p0.clone().sub(pv).setY(0), span = Math.max(far, ahead.length(), 1.5);
      if (ahead.length() < 1.5) p0.copy(pv).addScaledVector(ahead.lengthSq() ? ahead.normalize() : way.clone().negate(), 1.5);
      // Bulge the arc outward, away from the pivot, like the sweep of the bow.
      const p1 = pv.clone().addScaledVector(p0.clone().sub(pv).setY(0).normalize().add(way), span * 0.95);
      const curve = new THREE.QuadraticBezierCurve3(p0.setY(1.0), p1.setY(1.0), p2.setY(1.0));
      // Bright enough to glow: these are the things to click.
      const glow = gh.state === 'bad' ? new THREE.Color(0.75, 0.16, 0.08) : gh.state === 'hot' ? new THREE.Color(2.6, 1.7, 0.4) : new THREE.Color(1.25, 0.85, 0.22);
      const mat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: gh.state === 'idle' ? 0.85 : 1, depthWrite: false });
      const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, gh.state === 'hot' ? 0.07 : 0.045, 6), mat);
      // A bold arrowhead on the square the bow would point from, aimed the way she would head.
      const head = new THREE.Mesh(new THREE.ConeGeometry(gh.state === 'hot' ? 0.5 : 0.4, gh.state === 'hot' ? 1.05 : 0.85, 12), mat);
      head.position.copy(p2).addScaledVector(way, 0.3);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), way);
      const arrow = new THREE.Group();
      arrow.add(arc, head);
      arrow.userData.y0 = 0;
      this.ghosts.add(arrow);
    }
  }

  /** Tint squares: drawn by the sea shader itself, so they ride the swell and are never hidden by it. */
  setHighlights(list: Highlight[]) {
    for (const side of ['own', 'enemy'] as Side[]) this.seas[side].setHighlights(list.filter((h) => h.side === side).map((h) => ({ x: h.x, y: h.y, color: h.color, opacity: h.opacity ?? 0.45 })));
  }

  /* ---------- effects ---------- */
  /** Fire a shot at a cell and play out how it lands. Resolves on impact. */
  shot(target: Cell, outcome: ShotOutcome): Promise<void> {
    const to = cellCenter(target);
    let from: THREE.Vector3;
    const guns = [...this.ships.values()].filter((o) => o.side === 'own' && o.state === 'afloat');
    const armed = guns.filter((o) => o.model.gun);
    if (target.side === 'enemy' && armed.length) {
      // One of the armed ships swings her deck gun onto the target and fires from its muzzle.
      const g = armed[Math.floor(Math.random() * armed.length)];
      return this.layGun(g, to).then(() => this.fly(g.model.gun!.muzzle.getWorldPosition(new THREE.Vector3()), to, target, outcome, g)).finally(() => { g.laying = false; });
    }
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
    return this.fly(from, to, target, outcome);
  }

  /** Turn a ship's deck gun towards a point; resolves once it is laid. */
  private layGun(o: ShipObj, to: THREE.Vector3): Promise<void> {
    const { pivot } = o.model.gun!;
    o.laying = true;
    o.tilt.updateMatrixWorld(true);
    const local = pivot.parent!.worldToLocal(to.clone());
    const want = Math.atan2(-(local.z - pivot.position.z), local.x - pivot.position.x);
    const start = pivot.rotation.y, delta = Math.atan2(Math.sin(want - start), Math.cos(want - start));
    const dur = calm ? 0 : 140 + Math.abs(delta) * 220, t0 = performance.now();
    return new Promise((res) => {
      const step = () => {
        const u = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, e = u * u * (3 - 2 * u);
        pivot.rotation.y = start + delta * e;
        if (u < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  /** The ball's flight and what it does where it lands. */
  private fly(from: THREE.Vector3, to: THREE.Vector3, target: Cell, outcome: ShotOutcome, gunner?: ShipObj): Promise<void> {
    if (gunner) {
      const { barrel } = gunner.model.gun!;
      this.fx.muzzle(from);
      this.seas.own.bump(Math.floor(from.x - origin.own.x), Math.floor(from.z - origin.own.z), 0.25);
      // Recoil: the barrel kicks back along its bore and eases forward again.
      if (!calm) {
        const t0 = performance.now();
        const kick = () => { const u = (performance.now() - t0) / 450; barrel.position.x = -0.012 * Math.max(0, u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85); if (u < 1) requestAnimationFrame(kick); else barrel.position.x = 0; };
        kick();
      }
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
        this.impact(target, outcome);
        res();
      };
      step();
    });
  }

  /** What a blow does where it lands: water, sparks or fire. */
  private impact(target: Cell, outcome: ShotOutcome) {
    const at = cellCenter(target).setY(0.25);
    this.seas[target.side].bump(target.x, target.y, 1);
    if (outcome === 'miss' || outcome === 'wreck') { this.fx.water(at); this.sound('plunge'); }
    else if (outcome === 'clang') { this.fx.clang(at.setY(0.5)); this.shake(0.12); this.sound('clang'); }
    else { this.fx.explosion(at.setY(0.45)); this.shake(outcome === 'sunk' ? 0.5 : 0.28); this.sound('hit'); }
  }

  /** The Kraken brings a tentacle down on a cell. Resolves on impact. */
  async lash(target: Cell, outcome: ShotOutcome): Promise<void> {
    if (this.kraken.active) await this.kraken.slam(cellCenter(target));
    this.shake(0.2);
    this.impact(target, outcome);
  }

  /** The maelstrom takes a section of a ship. */
  drown(target: Cell, outcome: ShotOutcome) { this.impact(target, outcome === 'hit' || outcome === 'sunk' ? outcome : 'miss'); }

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

  coins(c: Cell, mine = true) { this.fx.coins(cellCenter(c).setY(0.4)); this.sound(mine ? 'treasure' : 'coin'); }
}
