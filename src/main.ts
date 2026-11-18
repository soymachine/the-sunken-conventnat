// Controller: lobby → session → one Client driving the scene and the HUD.
import './ui/hud.css';
import { Client, Msg, Snapshot, roleOf } from './game/engine';
import { ITEMS, ITEM_IDS, Item } from './game/powerups';
import { Dir, Ship, ZONE, attackCells, cellName, fits, inBoard, legalPlacement, randomFleet, shipAt, shipCells } from './game/rules';
import { verify } from './game/verify';
import { createRoom, firebaseConfigured, joinRoom } from './net/firebase';
import { LocalSession, Session } from './net/session';
import { Cell, Highlight, SeaScene } from './render/scene';
import { Sfx } from './ui/audio';
import { Hud, Mode } from './ui/hud';
import { Lobby } from './ui/lobby';

const AMBER = 0xd9a441, WAX = 0x8c2f1b, INK = 0x0d0b08, FOG = 0xcfc4a8;
const canvas = document.getElementById('sea') as HTMLCanvasElement;
const scene = new SeaScene(canvas);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sfx = new Sfx();
scene.sound = (s) => sfx.play(s);
let quiet = false; // rebuilding the view from history: no animations

let session: Session | null = null;
let c: Client;
let mode: Mode = 'fire';
let aimDir: Dir = 'h';
let busy = false; // animations playing
let selected: Ship | null = null; // ship chosen for sailing, or lifted during placement
let lifted: { x: number; y: number; dir: Dir } | null = null;
let hover: Cell | null = null;
let foeOnline = true;
const queue: Msg[] = [];

const HINTS: Record<string, string> = {
  fire: 'Fire — pick a square in enemy waters. One point a shot.',
  sail: 'Sail — pick one of your ships, then a square ahead or astern.',
  turn: 'Turn — pick one of your ships to swing it a quarter turn.',
  broadside: 'Broadside — three squares in a line. Press R to swing the line.',
  chain: 'Chain shot — a hit pins that ship for its next turn.',
  spy: 'Cutter’s glass — count hull sections in a 5×5 patch of enemy water.',
  spyglass: 'Spyglass — count hull sections in a 5×5 patch of enemy water.',
  fireship: 'Fire ship — five squares in a cross.',
  fog: 'Fog bank — pick the centre of a 5×5 patch of your own water.',
  shipwright: 'Shipwright — pick a damaged section of one of your ships.',
};

const hud = new Hud({
  mode: (m) => { sfx.play('click'); setMode(m); },
  mute: () => sfx.toggle(),
  buy: (item) => { if (c.buy(item)) setMode(item === 'winds' ? mode : item); },
  endTurn: () => { if (!busy) c.endTurn(); },
  shuffle: () => { if (canPlace()) { c.ships = randomFleet(Math.random, c.role); selected = lifted = null; refresh(); } },
  rotate: rotateLifted,
  ready: () => { if (!canPlace() || lifted) return; if (!legalPlacement(c.ships)) hud.log('The merchantman must start in the Colony: columns A to C.', 'bad'); else void c.ready(); },
  leave,
});
const lobby = new Lobby({
  bot: (name, mode) => start(new LocalSession(mode), name),
  create: async (name, mode) => {
    lobby.busy(true);
    try {
      const s = await createRoom(mode);
      lobby.showCode(s.code);
      location.hash = s.code;
      await s.guest();
      start(s, name);
    } catch (e) { lobby.busy(false); lobby.status((e as Error).message, true); }
  },
  join: async (name, code) => {
    lobby.busy(true);
    lobby.status('Hailing the room…');
    try { const s = await joinRoom(code); location.hash = code; start(s, name); }
    catch (e) { lobby.busy(false); lobby.status((e as Error).message, true); }
  },
}, firebaseConfigured);

const storeKey = () => (session?.code ? `tsc:room:${session.code}:${session.me}` : '');
function save() { const k = storeKey(); if (k) try { localStorage.setItem(k, JSON.stringify(c.snapshot())); } catch { /* ignore */ } }

function start(s: Session, name: string) {
  session = s;
  c = new Client(s.me, s.seed, (m) => s.send(m), Math.random, name, s.mode);
  let snap: Snapshot | null = null;
  try { snap = JSON.parse(localStorage.getItem(storeKey()) || 'null'); } catch { /* ignore */ }
  if (snap) c.restore(snap);
  mode = 'fire'; selected = lifted = null; busy = false; queue.length = 0; foeOnline = true;
  scene.reset();
  hud.clearLog();
  hud.log(s.code ? `Room ${s.code}. Arrange your fleet, then turn the capstan.` : 'Arrange your fleet, then turn the capstan.');
  c.onNote = (t) => hud.log(t, 'good');
  c.onChange = (m, ok, replay) => {
    save();
    if (!ok) return;
    if (replay) { quiet = true; refresh(); quiet = false; return; }
    queue.push(m);
    if (!busy) void drain();
  };
  lobby.show(false);
  hud.show(true);
  hud.setHint(HINTS.fire);
  if (c.role !== 'classic' && !snap) hud.showRole(c.role);
  refresh();
  s.listen((m) => c.receive(m), (on) => { foeOnline = on; refresh(); });
  Object.assign(window, { __client: c, __screen: (cell: Cell) => scene.screen(cell), __bot: (s as LocalSession).bot });
}

function leave() {
  try { localStorage.removeItem(storeKey()); } catch { /* ignore */ }
  session?.close();
  session = null;
  history.replaceState(null, '', location.pathname + location.search);
  hud.show(false);
  lobby.status('');
  lobby.show(true);
}

/* ---------- message → animation + log ---------- */
async function drain() {
  busy = true;
  while (queue.length) {
    const m = queue.shift()!;
    const mine = m.by === c.me;
    if (m.t === 'result') {
      refreshHud();
      const side = mine ? 'own' : 'enemy';
      await Promise.all(m.results.map((r, i) => wait(i * 130).then(() => scene.shot({ side, x: r.x, y: r.y }, r.r))));
    }
    if (m.t === 'powerResult') sfx.play('glass');
    if (m.t === 'scanResult') await scene.sweep({ side: mine ? 'own' : 'enemy', x: m.x, y: m.y });
    if (m.t === 'move' && m.treasure) scene.coins({ side: mine ? 'own' : 'enemy', x: m.treasure[0], y: m.treasure[1] });
    if (m.t === 'move' && mine) sfx.play('creak');
    if (m.t === 'buy' && mine) sfx.play('coin');
    if (m.t === 'endTurn' && c.myTurn) sfx.play('bell');
    describe(m, mine);
    refresh();
  }
  busy = false;
  refresh();
  if (c.pub.phase === 'battle' && c.can() && c.pub.ap === 0) {
    const options = (c.has('winds') && !c.pub.windsUsed) || ITEM_IDS.some((i) => c.canBuy(i));
    if (options) hud.setHint('No points left — visit the Quartermaster or turn the capstan to end your turn.');
    else { await wait(400); if (c.can() && c.pub.ap === 0 && !busy) c.endTurn(); }
  }
}

function describe(m: Msg, mine: boolean) {
  const foe = c.foeSide.name || 'The enemy';
  switch (m.t) {
    case 'ready': if (!mine) hud.log(`${m.name} has committed a fleet.`); if (c.pub.phase === 'battle') hud.log('Round 1', 'head'); break;
    case 'result':
      for (const r of m.results) {
        const at = cellName(r.x, r.y);
        if (!mine) { // my shot, answered by the enemy
          if (r.r === 'miss') hud.log(`Your shot at ${at} — only water.`);
          else if (r.r === 'wreck') hud.log(`Your shot at ${at} — wreckage, no new damage.`);
          else if (r.r === 'clang') hud.log(c.role === 'corsair' ? `Your shot at ${at} is turned aside — iron plate, or an escort.` : `Your shot at ${at} rings off iron plate — an Ironclad!`, 'good');
          else if (r.cargo && r.r !== 'sunk') hud.log(`Your shot at ${at} strikes the merchantman — a crate is yours!`, 'good');
          else if (r.r === 'hit') hud.log(`Your shot at ${at} — a hit!`, 'good');
          else hud.log(`Your shot at ${at} — the enemy ${r.ship!.cls} goes down!`, 'good');
        } else {
          if (r.r === 'miss') hud.log(`Enemy shot at ${at} — only water.`);
          else if (r.r === 'wreck') hud.log(`Enemy shot at ${at} — wreckage.`);
          else if (r.r === 'clang') hud.log(`Enemy shot at ${at} glances off your Ironclad.`, 'bad');
          else if (r.cargo && r.r !== 'sunk') hud.log(`Enemy shot at ${at} — the merchantman is hit and a crate is lost.`, 'bad');
          else if (r.r === 'hit') hud.log(`Enemy shot at ${at} — a hit on your fleet.`, 'bad');
          else hud.log(`Enemy shot at ${at} — your ${r.ship!.cls} is lost.`, 'bad');
        }
      }
      if (m.chained) hud.log(mine ? 'Chain shot fouls your rigging — that ship is pinned.' : 'Your chain shot pins the ship.', mine ? 'bad' : 'good');
      break;
    case 'move':
      hud.log(mine ? (m.kind === 'turn' ? 'You bring a ship about.' : 'You shift a ship.') : `${foe} shifts a ship, unseen.`);
      for (const [x, y] of m.debris) if (!mine) hud.log(`Wreckage drifts at ${cellName(x, y)}.`, 'good');
      if (m.wake !== undefined) hud.log(mine ? `Under full sail your merchantman is sighted in row ${m.wake + 1}.` : `A laden ship is sighted under full sail in row ${m.wake + 1}.`, mine ? 'bad' : 'good');
      if (m.treasure) hud.log(mine ? 'Treasure hauled aboard — but your ship was sighted.' : `${foe} lifts a treasure at ${cellName(...m.treasure)} — a ship is there.`, 'good');
      break;
    case 'scan': if (!mine) hud.log(`${foe} trains a spyglass on ${cellName(m.x, m.y)}.`, 'bad'); break;
    case 'scanResult': if (!mine) hud.log(m.count < 0 ? `Spyglass on ${cellName(m.x, m.y)}: nothing but fog.` : `Spyglass on ${cellName(m.x, m.y)}: ${m.count} hull section${m.count === 1 ? '' : 's'}.`, m.count > 0 ? 'good' : ''); break;
    case 'buy': hud.log(mine ? `You buy ${ITEMS[m.item].name}.` : `${foe} buys ${ITEMS[m.item].name}.`); break;
    case 'fog': hud.log(mine ? 'Fog rolls over your waters.' : `Fog rolls over enemy waters near ${cellName(m.x, m.y)}.`); break;
    case 'repair': hud.log(mine ? 'Your shipwrights patch a section.' : 'Enemy shipwrights are at work.'); break;
    case 'winds': hud.log(mine ? 'The trade winds fill your sails: one more point.' : `${foe} catches the trade winds.`); break;
    case 'power':
      if (roleOf(c.pub, m.by) === 'admiral') hud.log(mine ? 'Close Escort: your frigates close around the merchantman.' : 'The Admiral orders a close escort: the next hit on the merchantman will be turned aside.', mine ? 'good' : 'bad');
      else if (!mine) hud.log('The Corsair works her dead reckoning…', 'bad');
      break;
    case 'powerResult': hud.log(mine ? `The Corsair has your merchantman's column: ${cellName(m.col, 0)[0]}.` : `Dead Reckoning: the merchantman is in column ${cellName(m.col, 0)[0]}.`, mine ? 'bad' : 'good'); break;
    case 'order': if (!mine) hud.log(`${foe} fulfils secret orders: ${m.reward} doubloons.`); break;
    case 'endTurn': if (c.pub.current === 0 && c.pub.phase === 'battle') hud.log(`Round ${c.pub.round}`, 'head'); break;
    case 'reveal':
      if (!mine && session?.code) void verify(c.log, c.foe, roleOf(c.pub, c.foe)).then((bad) => hud.setVerdict(bad ? `The enemy's log does not add up: ${bad}.` : "The enemy's log checks out: every shot was answered truthfully."));
      break;
  }
}

/* ---------- view ---------- */
const canPlace = () => !!session && c.pub.phase === 'placement' && !c.side.ready;
const myTurn = () => !!session && c.can() && !busy;

function setMode(m: Mode) {
  if (m === 'power') { c.power(); return; }
  if (m === 'winds') { c.winds(); return; }
  mode = m;
  selected = null;
  hud.setHint(HINTS[m] || '');
  refresh();
}

function sailTargets(s: Ship): { cell: Cell; delta: 1 | -1; steps: number }[] {
  const cs = shipCells(s), out: { cell: Cell; delta: 1 | -1; steps: number }[] = [];
  const [dx, dy] = s.dir === 'h' ? [1, 0] : [0, 1];
  const bow = cs[cs.length - 1], stern = cs[0];
  for (let k = 1; k <= c.reach(s.id, 1); k++) out.push({ cell: { side: 'own', x: bow[0] + dx * k, y: bow[1] + dy * k }, delta: 1, steps: k });
  for (let k = 1; k <= c.reach(s.id, -1); k++) out.push({ cell: { side: 'own', x: stern[0] - dx * k, y: stern[1] - dy * k }, delta: -1, steps: k });
  return out;
}

function zone(side: Cell['side'], x: number, y: number, color: number, opacity: number): Highlight[] {
  const out: Highlight[] = [];
  for (let b = y - ZONE; b <= y + ZONE; b++) for (let a = x - ZONE; a <= x + ZONE; a++) if (inBoard(a, b)) out.push({ side, x: a, y: b, color, opacity });
  return out;
}

function refreshHud() {
  if (!session) return;
  // Fall back to plain fire when the chosen tool is spent or its ship is lost.
  const gone = (mode === 'broadside' && !c.alive('line')) || (mode === 'chain' && !c.alive('frigate')) || (mode === 'spy' && !c.alive('cutter')) || (mode in ITEMS && !c.has(mode as Item));
  if (gone && c.pub.phase === 'battle') { mode = 'fire'; hud.setHint(HINTS.fire); }
  hud.update(c, mode, foeOnline ? '' : 'lost at sea (disconnected)');
}

function refresh() {
  if (!session) return;
  refreshHud();
  const invalid = !!lifted && (!fits(c.ships, selected!, selected!.id) || !legalPlacement(c.ships));
  const convoy = c.role === 'classic' ? undefined : { side: c.role === 'admiral' ? 'own' as const : 'enemy' as const, zone: c.role === 'admiral' && c.pub.phase === 'placement' };
  scene.sync({ pub: c.pub, me: c.me, ships: c.ships, selectedId: selected?.id ?? null, invalid, lifted: !!lifted, quiet, convoy });
  scene.setTurn(c.pub.phase !== 'battle' || c.myTurn);
  const hl: Highlight[] = [];
  if (myTurn() && hover) {
    const { side, x, y } = hover;
    if (side === 'enemy') {
      if (mode === 'fire' || mode === 'chain') hl.push({ ...hover, color: WAX, opacity: 0.55 });
      if (mode === 'broadside' || mode === 'fireship') for (const [a, b] of attackCells(mode, x, y, aimDir)) hl.push({ side, x: a, y: b, color: WAX, opacity: 0.55 });
      if (mode === 'spy' || mode === 'spyglass') hl.push(...zone(side, x, y, AMBER, 0.3));
    } else {
      if (mode === 'fog') hl.push(...zone(side, x, y, FOG, 0.45));
      if ((mode === 'sail' && !selected) || mode === 'turn' || mode === 'shipwright') {
        const at = shipAt(c.ships, x, y);
        if (at && !at.ship.sunk) {
          const ok = mode === 'sail' ? c.reach(at.ship.id, 1) + c.reach(at.ship.id, -1) > 0 : mode === 'turn' ? c.canTurn(at.ship.id) : at.ship.hits.some(Boolean);
          for (const [a, b] of shipCells(at.ship)) hl.push({ side, x: a, y: b, color: ok ? AMBER : INK, opacity: 0.4 });
        }
      }
    }
  }
  if (myTurn() && mode === 'sail' && selected) for (const t of sailTargets(selected)) hl.push({ ...t.cell, color: AMBER, opacity: 0.7 });
  scene.setHighlights(hl);
}

/* ---------- placement ---------- */
function moveLifted(cell: Cell) {
  if (!selected || cell.side !== 'own') return;
  const k = Math.floor(selected.len / 2);
  selected.x = selected.dir === 'h' ? cell.x - k : cell.x;
  selected.y = selected.dir === 'h' ? cell.y : cell.y - k;
}
function rotateLifted() {
  if (!lifted || !selected) return;
  selected.dir = selected.dir === 'h' ? 'v' : 'h';
  if (hover) moveLifted(hover);
  refresh();
}
function placementClick(cell: Cell) {
  if (cell.side !== 'own' || !canPlace()) return;
  if (lifted && selected) {
    if (fits(c.ships, selected, selected.id) && legalPlacement(c.ships)) selected = lifted = null;
  } else {
    const at = shipAt(c.ships, cell.x, cell.y);
    if (at) { selected = at.ship; lifted = { x: at.ship.x, y: at.ship.y, dir: at.ship.dir }; moveLifted(cell); }
  }
  refresh();
}

/* ---------- battle ---------- */
function battleClick(cell: Cell) {
  if (!myTurn()) return;
  const { side, x, y } = cell;
  if (side === 'enemy') {
    if (mode === 'fire') c.attack('shot', x, y);
    else if (mode === 'broadside' || mode === 'chain' || mode === 'fireship') c.attack(mode, x, y, aimDir);
    else if (mode === 'spy') c.scan(x, y, 'cutter');
    else if (mode === 'spyglass') c.scan(x, y, 'spyglass');
    return;
  }
  if (mode === 'fog') { c.fog(x, y); return; }
  if (mode === 'shipwright') { if (!c.repair(x, y)) hud.log('Nothing to repair there.'); return; }
  const at = shipAt(c.ships, x, y);
  if (mode === 'turn') {
    if (!at || at.ship.sunk) return;
    if (!c.turn(at.ship.id)) hud.log(`The ${at.ship.cls} cannot turn — ${at.ship.chained ? 'she is pinned by chain shot' : at.ship.hits.filter(Boolean).length >= 2 ? 'too badly damaged' : 'no sea room'}.`);
    return;
  }
  if (mode !== 'sail') return;
  if (selected) {
    const t = sailTargets(selected).find((q) => q.cell.x === x && q.cell.y === y);
    if (t) { c.sail(selected.id, t.delta, t.steps); if (c.pub.ap === 0) selected = null; return; }
  }
  selected = at && !at.ship.sunk ? at.ship : null;
  if (selected?.chained) hud.log(`The ${selected.cls} is pinned by chain shot this turn.`);
  refresh();
}

/* ---------- input ---------- */
canvas.addEventListener('pointermove', (e) => {
  if (!session) return;
  const cell = scene.pick(e);
  if (cell?.side === hover?.side && cell?.x === hover?.x && cell?.y === hover?.y) return;
  hover = cell;
  if (canPlace() && lifted && cell) moveLifted(cell);
  refresh();
});
canvas.addEventListener('click', (e) => {
  if (!session) return;
  const cell = scene.pick(e);
  if (!cell) return;
  hover = cell;
  if (c.pub.phase === 'placement') placementClick(cell);
  else if (c.pub.phase === 'battle') battleClick(cell);
});
addEventListener('keydown', (e) => {
  if (!session || (e.target as Element).tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (c.pub.phase === 'placement') {
    if (k === 'r') rotateLifted();
    if (k === 'escape' && lifted && selected) { Object.assign(selected, lifted); selected = lifted = null; refresh(); }
    return;
  }
  if (k === 'f' || k === '1') setMode('fire');
  if (k === 's' || k === '2') setMode('sail');
  if (k === 't' || k === '3') setMode('turn');
  if (k === 'a' || k === '4') setMode('broadside');
  if (k === 'r') { aimDir = aimDir === 'h' ? 'v' : 'h'; refresh(); }
  if (k === ' ' && myTurn()) { e.preventDefault(); c.endTurn(); }
});

hud.show(false);
lobby.show(true);
// A room code in the address takes you straight back to your seat.
const wanted = location.hash.slice(1).toUpperCase();
if (firebaseConfigured && /^[A-Z0-9]{4}$/.test(wanted)) {
  lobby.busy(true);
  lobby.status(`Returning to room ${wanted}…`);
  joinRoom(wanted).then((s) => start(s, localStorage.getItem('tsc:name') || 'Captain')).catch((e) => { lobby.busy(false); lobby.status(e.message, true); });
}
