// Procedural nineteenth-century ships, shaded like an engraving.
// Drop a file at public/models/<kind>.glb and it replaces the procedural hull.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Kind } from '../game/rules';

const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const time = { value: 0 };
export const setShipTime = (t: number) => { time.value = t; };

const VERT = /* glsl */ `
uniform float uTime, uFlutter;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  if (uFlutter > 0.0) {
    float w = sin(uv.x * 3.1416) * (0.35 + 0.65 * sin(uv.y * 3.1416));
    p += normal * w * uFlutter * (0.6 * sin(uTime * 2.1 + position.y * 5.0) + 0.4 * sin(uTime * 3.7 + position.z * 9.0 + position.x * 7.0));
  }
  vN = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor, uTint, uLight;
uniform float uTintAmt, uAlpha, uUseMap;
uniform sampler2D uMap;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = dot(n, uLight) * 0.5 + 0.5;
  float band = d > 0.6 ? 1.0 : d > 0.38 ? 0.72 : 0.48;
  vec2 f = gl_FragCoord.xy;
  float hatch = 1.0;
  if (d <= 0.6) hatch -= 0.24 * step(0.55, fract((f.x + f.y) / 5.0));
  if (d <= 0.38) hatch -= 0.22 * step(0.55, fract((f.x - f.y) / 5.0));
  // A model made elsewhere brings its colours as a texture; the procedural ships use one flat colour per part.
  vec3 base = uUseMap > 0.5 ? texture2D(uMap, vUv).rgb * uColor : uColor;
  vec3 c = mix(base * band * hatch, uTint, uTintAmt);
  gl_FragColor = vec4(c, uAlpha);
  #include <colorspace_fragment>
}`;

/** Banded light with cross-hatching in the shadows. With `map`, the colour comes from that texture. */
export function inkMaterial(color: number, flutter = 0, map: THREE.Texture | null = null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTint: { value: new THREE.Color(0xd9a441) }, uTintAmt: { value: 0 }, uAlpha: { value: 1 }, uLight: { value: LIGHT }, uTime: time, uFlutter: { value: flutter }, uMap: { value: map }, uUseMap: { value: map ? 1 : 0 } },
  });
}

interface Spec {
  beam: number; depth: number; stern: number; bow: number; hull: number; strake: number; deck: number;
  rig: 'square' | 'gaff' | 'none'; masts: number[]; mastH: number;
}
const SPECS: Record<Kind, Spec> = {
  line: { beam: 0.37, depth: 0.4, stern: 0.55, bow: 0.25, hull: 0x1c150d, strake: 0xb08d3c, deck: 0x5f4526, rig: 'square', masts: [0.2, 0.47, 0.72], mastH: 1.75 },
  frigate: { beam: 0.32, depth: 0.34, stern: 0.4, bow: 0.22, hull: 0x1c150d, strake: 0x8a6f2c, deck: 0x5f4526, rig: 'square', masts: [0.2, 0.47, 0.73], mastH: 1.5 },
  ironclad: { beam: 0.36, depth: 0.2, stern: 0.05, bow: 0.1, hull: 0x24221f, strake: 0x4a4640, deck: 0x55504a, rig: 'none', masts: [0.82], mastH: 0.8 },
  schooner: { beam: 0.26, depth: 0.27, stern: 0.2, bow: 0.3, hull: 0x2a1e12, strake: 0x5a4026, deck: 0x6a4e2c, rig: 'gaff', masts: [0.36, 0.66], mastH: 1.45 },
  merchant: { beam: 0.4, depth: 0.34, stern: 0.4, bow: 0.15, hull: 0x3a2a18, strake: 0xcbb27a, deck: 0x7a5a34, rig: 'square', masts: [0.3, 0.68], mastH: 1.3 },
  cutter: { beam: 0.25, depth: 0.25, stern: 0.2, bow: 0.3, hull: 0x2a1e12, strake: 0x6b4e2c, deck: 0x6a4e2c, rig: 'gaff', masts: [0.52], mastH: 1.25 },
};

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Loft a hull from cross-sections. Returns [lower hull, upper strake, deck] plus the deck height function. */
function loft(len: number, s: Spec) {
  const S = 16, lower: number[] = [], strake: number[] = [], deck: number[] = [];
  const L = len * 0.94, x0 = len * 0.03;
  const width = (t: number) => s.beam * Math.max(0.02, t < 0.1 ? 0.72 + 0.28 * (t / 0.1) : t < 0.6 ? 1 : Math.pow(Math.cos(((t - 0.6) / 0.4) * Math.PI * 0.5), 0.75));
  const height = (t: number) => s.depth * (1 + s.stern * smooth(1 - t / 0.28) + s.bow * smooth((t - 0.72) / 0.28));
  const section = (t: number): [number, number, number][] => {
    const w = width(t), h = height(t), x = x0 + t * L;
    return [[x, h, -w], [x, h * 0.7, -w * 0.97], [x, 0.0, -w * 0.5], [x, 0.0, w * 0.5], [x, h * 0.7, w * 0.97], [x, h, w]];
  };
  const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < S - 1; i++) {
    const A = section(i / (S - 1)), B = section((i + 1) / (S - 1));
    for (let k = 0; k < 5; k++) quad(k === 0 || k === 4 ? strake : lower, A[k], B[k], B[k + 1], A[k + 1]);
    const dA = [A[0][0], A[0][1] - 0.04, A[0][2]], dA2 = [A[5][0], A[5][1] - 0.04, A[5][2]], dB = [B[0][0], B[0][1] - 0.04, B[0][2]], dB2 = [B[5][0], B[5][1] - 0.04, B[5][2]];
    quad(deck, dA, dB, dB2, dA2);
  }
  const T = section(0);
  quad(lower, T[1], T[2], T[3], T[4]);
  quad(strake, T[0], T[1], T[4], T[5]);
  const geo = (v: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g; };
  return { lower: geo(lower), strake: geo(strake), deck: geo(deck), height, width, x: (t: number) => x0 + t * L };
}

function squareSail(w: number, h: number, bulge: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 6, 4);
  g.rotateY(Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) p.setX(i, bulge * Math.sin(uv.getX(i) * Math.PI) * (0.35 + 0.65 * Math.sin(uv.getY(i) * Math.PI)));
  g.computeVertexNormals();
  return g;
}
/** A four-cornered fore-and-aft sail (two corners may coincide to make a jib). */
function foreAft(c: [number, number][], bulge: number): THREE.BufferGeometry {
  const n = 5, pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / n;
    const x = (1 - v) * ((1 - u) * c[0][0] + u * c[1][0]) + v * ((1 - u) * c[3][0] + u * c[2][0]);
    const y = (1 - v) * ((1 - u) * c[0][1] + u * c[1][1]) + v * ((1 - u) * c[3][1] + u * c[2][1]);
    pos.push(x, y, bulge * Math.sin(u * Math.PI) * Math.sin(v * Math.PI));
    uvs.push(u, v);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const models = new Map<Kind, THREE.Object3D>();
/** Look for hand-made models; resolves once every kind has been tried. */
export async function loadShipModels(): Promise<number> {
  const loader = new GLTFLoader();
  await Promise.all((Object.keys(SPECS) as Kind[]).map(async (kind) => {
    const url = `${import.meta.env.BASE_URL}models/${kind}.glb`;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok || (head.headers.get('content-type') || '').includes('html')) return;
      models.set(kind, (await loader.loadAsync(url)).scene);
    } catch { /* no model for this kind: keep the procedural ship */ }
  }));
  return models.size;
}

export interface ShipModel {
  /** Centred on the ship: x runs stern (−len/2) to bow (+len/2). */
  body: THREE.Group;
  sails: THREE.Group;
  mats: THREE.ShaderMaterial[];
  /** Local position of the funnel mouth, for ships that smoke. */
  funnel?: THREE.Vector3;
  /** Cargo on deck, one crate per hull section (merchantman only). */
  crates: THREE.Object3D[];
  deckY: number;
}

export function buildShip(kind: Kind, len: number): ShipModel {
  const s = SPECS[kind], body = new THREE.Group(), sails = new THREE.Group(), mats: THREE.ShaderMaterial[] = [];
  const mat = (c: number, flutter = 0, map: THREE.Texture | null = null) => { const m = inkMaterial(c, flutter, map); mats.push(m); return m; };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  const inner = new THREE.Group();
  inner.position.x = -len / 2;
  body.add(inner);

  const external = models.get(kind);
  if (external) {
    const o = external.clone(true);
    // Models prepared with tools/prepare_ship.py carry their measurements: hull exactly 1.0 long and
    // centred, bow towards +X, waterline at height 0, and the deck height in `extras`.
    let prepared: { hull?: number; deck?: number } | null = null;
    o.traverse((n) => { if (n.userData?.hull) prepared = n.userData as { hull: number; deck: number }; });
    let deckY = s.depth;
    if (prepared) {
      const k = len * 0.94;
      o.scale.multiplyScalar(k);
      o.position.set(len / 2, 0, 0);
      deckY = ((prepared as { deck?: number }).deck ?? s.depth / k) * k;
    } else {
      const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
      // Lay the model's longest horizontal axis along the ship and scale it to the hull length.
      if (size.z > size.x) { o.rotation.y = Math.PI / 2; box.setFromObject(o); box.getSize(size); }
      const k = (len * 0.94) / size.x;
      o.scale.multiplyScalar(k);
      box.setFromObject(o);
      const c = box.getCenter(new THREE.Vector3());
      o.position.sub(new THREE.Vector3(c.x - len / 2, box.min.y, c.z));
    }
    o.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      m.material = src.map ? mat(0xffffff, 0, src.map) : mat(src.color ? src.color.getHex() : s.hull);
      m.castShadow = true;
    });
    inner.add(o);
    return { body, sails, mats, crates: [], deckY };
  }

  const h = loft(len, s);
  add(inner, h.lower, mat(s.hull));
  add(inner, h.strake, mat(s.strake));
  add(inner, h.deck, mat(s.deck));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(h.strake, 40), new THREE.LineBasicMaterial({ color: 0xd9a441 }));
  inner.add(edges);
  const wood = mat(0x2a2116), cloth = mat(0xf3e6c2, 0.035), flagM = mat(0x8c2f1b, 0.05);
  const rig: number[] = [];
  const stay = (a: number[], b: number[]) => rig.push(...a, ...b);
  inner.add(sails);

  // Bowsprit.
  if (s.rig !== 'none') {
    const bs = add(inner, new THREE.CylinderGeometry(0.018, 0.028, len * 0.26, 5), wood);
    bs.rotation.z = -Math.PI / 2 + 0.28;
    bs.position.set(h.x(1) + len * 0.06, h.height(1) + 0.07, 0);
  }
  const tip = [h.x(1) + len * 0.17, h.height(1) + 0.13, 0];

  s.masts.forEach((f, i) => {
    const x = h.x(f), base = h.height(f) - 0.04, H = s.mastH * (s.masts.length === 3 && i === 1 ? 1.12 : i === 2 ? 0.9 : 1), top = base + H;
    const mast = add(inner, new THREE.CylinderGeometry(0.02, 0.04, H, 6), wood);
    mast.position.set(x, base + H / 2, 0);
    const w = h.width(f);
    stay([x, top * 0.94, 0], [x - 0.12, base, -w]); stay([x, top * 0.94, 0], [x - 0.12, base, w]);
    stay([x, top * 0.7, 0], [x - 0.2, base, -w]); stay([x, top * 0.7, 0], [x - 0.2, base, w]);
    if (i === s.masts.length - 1) stay([x, top * 0.96, 0], tip);
    if (i > 0) stay([x, top * 0.96, 0], [h.x(s.masts[i - 1]), base + s.mastH * 0.9, 0]);
    const flag = add(sails, foreAft([[0, 0], [0.3, 0.03], [0.3, 0.1], [0, 0.13]], 0.02), flagM);
    flag.position.set(x - 0.3, top - 0.12, 0);

    if (s.rig === 'square') {
      const sw = Math.min(1.0, w * 2.5), tiers = [[0.16, 0.5, 1], [0.69, 0.25, 0.74]];
      for (const [at, hh, ww] of tiers) {
        const sh = H * hh, sy = base + H * at + sh / 2;
        const sail = add(sails, squareSail(sw * ww, sh, 0.16 * ww), cloth);
        sail.position.set(x + 0.03, sy, 0); sail.rotation.y = 0.42;
        const yard = add(inner, new THREE.CylinderGeometry(0.014, 0.014, sw * ww * 1.06, 5), wood);
        yard.rotation.x = Math.PI / 2; yard.rotation.z = 0; yard.position.set(x + 0.03, sy + sh / 2, 0);
        yard.rotation.y = 0.42;
      }
    } else if (s.rig === 'gaff') {
      const boom = Math.min(len * 0.36, i === 0 && s.masts.length > 1 ? len * 0.27 : len * 0.42), y0 = base + 0.16, y1 = base + H * 0.86;
      add(sails, foreAft([[x - 0.02, y0], [x - boom, y0 + 0.03], [x - boom * 0.82, y1 - 0.08], [x - 0.02, y1]], 0.1), cloth);
      stay([x, y0, 0], [x - boom, y0 + 0.03, 0]); stay([x, y1, 0], [x - boom * 0.82, y1 - 0.08, 0]);
      if (i === s.masts.length - 1) add(sails, foreAft([[x + 0.05, base + 0.12], [tip[0] - 0.05, tip[1] + 0.02], [tip[0] - 0.05, tip[1] + 0.02], [x + 0.03, y1]], 0.09), cloth);
    }
  });

  const crates: THREE.Object3D[] = [];
  if (kind === 'merchant') {
    const box = new THREE.BoxGeometry(0.34, 0.26, 0.34), cm = mat(0xb08d3c), ce = new THREE.LineBasicMaterial({ color: 0x0d0b08 });
    for (let i = 0; i < len; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(box, cm), new THREE.LineSegments(new THREE.EdgesGeometry(box), ce));
      (g.children[0] as THREE.Mesh).castShadow = true;
      g.position.set(i + 0.5 + (i === 1 ? 0.12 : 0), s.depth + 0.1, i % 2 ? 0.1 : -0.1);
      g.rotation.y = i * 0.5;
      inner.add(g);
      crates.push(g);
    }
  }
  let funnel: THREE.Vector3 | undefined;
  if (kind === 'ironclad') {
    const cm = add(inner, new THREE.CylinderGeometry(0.42, 0.62, 0.24, 4, 1), mat(0x3a3733));
    cm.rotation.y = Math.PI / 4; cm.scale.set(len * 0.42, 1, s.beam * 1.25); cm.position.set(len * 0.47, s.depth + 0.1, 0);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(cm.geometry), new THREE.LineBasicMaterial({ color: 0xb08d3c }));
    edge.rotation.copy(cm.rotation); edge.scale.copy(cm.scale); edge.position.copy(cm.position);
    inner.add(edge);
    const fn = add(inner, new THREE.CylinderGeometry(0.075, 0.085, 0.5, 8), mat(0x15120f));
    fn.position.set(len * 0.47, s.depth + 0.46, 0);
    funnel = new THREE.Vector3(len * 0.47 - len / 2, s.depth + 0.74, 0);
    for (const z of [-1, 1]) for (const fx of [0.3, 0.47, 0.64]) {
      const gun = add(inner, new THREE.CylinderGeometry(0.022, 0.022, 0.16, 5), wood);
      gun.rotation.x = Math.PI / 2; gun.position.set(len * fx, s.depth + 0.08, z * s.beam * 0.78);
    }
  } else {
    // Gun ports along the strake.
    const ports = kind === 'line' ? 7 : kind === 'frigate' ? 5 : kind === 'schooner' ? 2 : 1, port = new THREE.BoxGeometry(0.07, 0.05, 0.02), dark = mat(0x0d0b08);
    for (const z of [-1, 1]) for (let k = 0; k < ports; k++) {
      const t = 0.16 + (0.5 * (k + 0.5)) / ports + 0.04;
      const pm = add(inner, port, dark);
      pm.position.set(h.x(t), h.height(t) * 0.86, z * h.width(t) * 0.99);
      if (kind === 'line') { const p2 = add(inner, port, dark); p2.position.set(h.x(t) + 0.06, h.height(t) * 0.55, z * h.width(t) * 0.9); }
    }
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(rig, 3));
  inner.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0x0d0b08, transparent: true, opacity: 0.75 })));
  return { body, sails, mats, funnel, crates, deckY: s.depth };
}
