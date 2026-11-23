// A temporary workbench: each ship alone on a turntable, to look at from every side and judge fixes one by one.
// Drag to turn, wheel to zoom, right-drag (or shift-drag) to pan. Opened from the home and from Settings.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildShip, loadShipModels, setShipTime, setDeckMode } from '../render/ships';
import { FLEETS, Kind } from '../game/rules';

const KINDS: { kind: Kind; name: string; len: number }[] = [
  ...FLEETS.classic.map((f) => ({ kind: f.kind, name: f.cls, len: f.len })),
  ...FLEETS.admiral.filter((f) => f.kind === 'merchant').map((f) => ({ kind: f.kind, name: f.cls, len: f.len })),
];

export async function openShipViewer() {
  document.querySelector('.shipViewer')?.remove();
  const box = document.body.appendChild(document.createElement('div'));
  box.className = 'shipViewer';
  box.innerHTML = `<div class="sv">
    <div class="side">
      <h2>3D Ships</h2>
      <div class="list">${KINDS.map((k, i) => `<button type="button" data-i="${i}">${k.name}</button>`).join('')}</div>
      <label><input type="checkbox" data-opt="sails" checked> Sails and rigging</label>
      <label><input type="checkbox" data-opt="deck" checked> Clean flat decks</label>
      <label><input type="checkbox" data-opt="wire"> Wireframe</label>
      <label><input type="checkbox" data-opt="spin"> Turn slowly</label>
      <label><input type="checkbox" data-opt="grid" checked> Squares grid</label>
      <div class="views"><button type="button" data-view="side">Side</button><button type="button" data-view="top">Top</button><button type="button" data-view="bow">Bow</button><button type="button" data-view="three">¾</button></div>
      <p class="help">Drag: turn · Wheel: zoom · Right-drag: move</p>
      <p class="info"></p>
      <button type="button" class="close">Close</button>
    </div>
    <canvas></canvas>
  </div>`;
  const canvas = box.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8cba8);
  scene.add(new THREE.HemisphereLight(0xfff1cf, 0x2a2116, 2));
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  const grid = new THREE.GridHelper(8, 8, 0x6b5233, 0x9c8659); grid.position.y = 0.001; scene.add(grid);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x5f8a8f, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  water.rotation.x = -Math.PI / 2; scene.add(water);

  await loadShipModels();
  let current: THREE.Group | null = null, idx = 0;
  const opts = { sails: true, deck: true, wire: false, spin: false, grid: true };
  const show = (i: number) => {
    idx = i;
    if (current) scene.remove(current);
    setDeckMode(opts.deck);
    const k = KINDS[i], m = buildShip(k.kind, k.len);
    m.sails.visible = opts.sails;
    for (const mat of m.mats) mat.wireframe = opts.wire;
    current = new THREE.Group(); current.add(m.body); scene.add(current);
    box.querySelectorAll<HTMLElement>('.list button').forEach((b) => b.classList.toggle('on', +b.dataset.i! === i));
    let tris = 0, meshes = 0;
    m.body.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { meshes++; const g = me.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    box.querySelector('.info')!.textContent = `${k.name}: ${k.len} squares long · ${meshes} meshes · ${Math.round(tris).toLocaleString()} triangles`;
  };
  const view = (v: string) => {
    const L = KINDS[idx].len, d = L * 1.6 + 1.5;
    const pos: Record<string, [number, number, number]> = { side: [0, 0.5, d], top: [0, d, 0.001], bow: [d, 0.5, 0], three: [d * 0.7, d * 0.5, d * 0.7] };
    camera.position.set(...pos[v]); controls.target.set(0, 0.45, 0); controls.update();
  };
  box.querySelectorAll<HTMLElement>('.list button').forEach((b) => (b.onclick = () => { show(+b.dataset.i!); view('three'); }));
  box.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => (b.onclick = () => view(b.dataset.view!)));
  box.querySelectorAll<HTMLInputElement>('[data-opt]').forEach((c) => (c.onchange = () => {
    (opts as Record<string, boolean>)[c.dataset.opt!] = c.checked;
    grid.visible = opts.grid;
    show(idx);
  }));
  show(0); view('three');

  let alive = true;
  const resize = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  const clock = new THREE.Clock();
  const loop = () => {
    if (!alive) return;
    resize();
    const t = clock.getElapsedTime();
    setShipTime(t);
    if (opts.spin && current) current.rotation.y += 0.004;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
  const close = () => { alive = false; controls.dispose(); renderer.dispose(); setDeckMode(true); box.remove(); removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  box.querySelector<HTMLElement>('.close')!.onclick = close;
}
