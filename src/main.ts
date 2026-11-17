// Phase 1 controller: one human captain against the computer.
import './ui/hud.css';
import { chooseAction } from './game/bot';
import { Game, Ship, canSail, canTurn, cellName, endTurn, fire, fits, newGame, randomFleet, sail, shipAt, shipCells, startBattle, turn } from './game/rules';
import { Cell, Highlight, SeaScene } from './render/scene';
import { Hud, Mode } from './ui/hud';

const AMBER = 0xd9a441, WAX = 0x8c2f1b, INK = 0x0d0b08;
const canvas = document.getElementById('sea') as HTMLCanvasElement;
const scene = new SeaScene(canvas);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let g: Game;
let mode: Mode = 'fire';
let busy = false;
let selected: Ship | null = null; // ship chosen for sailing, or lifted during placement
let lifted: { x: number; y: number; dir: Ship['dir'] } | null = null;
let hover: Cell | null = null;

const HINTS: Record<Mode, string> = {
  fire: 'Fire — pick a square in enemy waters. One point a shot.',
  sail: 'Sail — pick one of your ships, then the square ahead or astern.',
  turn: 'Turn — pick one of your ships to swing it a quarter turn.',
};

const hud = new Hud({
  mode: setMode,
  endTurn: () => { if (myTurn()) finishTurn(); },
  shuffle: () => { if (g.phase === 'placement') { g.players[0].ships = randomFleet(Math.random); selected = lifted = null; refresh(); } },
  rotate: rotateLifted,
  ready: () => {
    if (g.phase !== 'placement' || lifted) return;
    startBattle(g);
    hud.log('Round 1', 'head');
    setMode('fire');
  },
  restart: reset,
});

function reset() {
  g = newGame();
  selected = lifted = null;
  busy = false;
  hud.clearLog();
  hud.log('Arrange your fleet, then turn the capstan.');
  refresh();
  (window as any).__game = g;
  (window as any).__screen = (c: Cell) => scene.screen(c);
}

const myTurn = () => g.phase === 'battle' && g.current === 0 && !busy;

function setMode(m: Mode) {
  mode = m;
  selected = null;
  hud.setMode(m);
  hud.setHint(HINTS[m]);
  refresh();
}

function sailTargets(s: Ship): { cell: Cell; delta: 1 | -1 }[] {
  const cs = shipCells(s), out: { cell: Cell; delta: 1 | -1 }[] = [];
  const [dx, dy] = s.dir === 'h' ? [1, 0] : [0, 1];
  const bow = cs[cs.length - 1], stern = cs[0];
  if (canSail(g, s.id, 1)) out.push({ cell: { side: 'own', x: bow[0] + dx, y: bow[1] + dy }, delta: 1 });
  if (canSail(g, s.id, -1)) out.push({ cell: { side: 'own', x: stern[0] - dx, y: stern[1] - dy }, delta: -1 });
  return out;
}

function refresh() {
  const invalid = !!lifted && !fits(g.players[0].ships, selected!, selected!.id);
  scene.sync(g, { revealEnemy: g.phase === 'over', selectedId: selected?.id ?? null, invalid });
  const hl: Highlight[] = [];
  if (myTurn()) {
    if (mode === 'fire' && hover?.side === 'enemy') hl.push({ ...hover, color: WAX, opacity: 0.55 });
    if (mode === 'sail' && selected) for (const t of sailTargets(selected)) hl.push({ ...t.cell, color: AMBER, opacity: 0.7 });
    if (mode !== 'fire' && hover?.side === 'own' && !selected) {
      const at = shipAt(g.players[0], hover.x, hover.y);
      if (at && !at.ship.sunk) {
        const ok = mode === 'sail' || canTurn(g, at.ship.id);
        for (const [x, y] of shipCells(at.ship)) hl.push({ side: 'own', x, y, color: ok ? AMBER : INK, opacity: 0.4 });
      }
    }
  }
  scene.setHighlights(hl);
  hud.update(g);
}

/* ---------- placement ---------- */
function moveLifted(c: Cell) {
  if (!selected || c.side !== 'own') return;
  const k = Math.floor(selected.len / 2);
  selected.x = selected.dir === 'h' ? c.x - k : c.x;
  selected.y = selected.dir === 'h' ? c.y : c.y - k;
}
function rotateLifted() {
  if (!lifted || !selected) return;
  selected.dir = selected.dir === 'h' ? 'v' : 'h';
  if (hover) moveLifted(hover);
  refresh();
}
function placementClick(c: Cell) {
  if (c.side !== 'own') return;
  if (lifted && selected) {
    if (fits(g.players[0].ships, selected, selected.id)) selected = lifted = null;
  } else {
    const at = shipAt(g.players[0], c.x, c.y);
    if (at) { selected = at.ship; lifted = { x: at.ship.x, y: at.ship.y, dir: at.ship.dir }; moveLifted(c); }
  }
  refresh();
}

/* ---------- battle ---------- */
async function shoot(c: Cell, who: 0 | 1) {
  busy = true;
  refresh();
  await scene.shot(c);
  const r = fire(g, c.x, c.y)!;
  const at = cellName(c.x, c.y), subj = who === 0 ? 'You fire' : 'Enemy fires';
  if (r.result === 'miss') hud.log(`${subj} at ${at} — only water.`);
  else if (r.result === 'wreck') hud.log(`${subj} at ${at} — wreckage, no new damage.`);
  else if (r.result === 'hit') hud.log(who === 0 ? `${subj} at ${at} — a hit!` : `${subj} at ${at} — your ${r.ship!.cls} is hit.`, who === 0 ? 'good' : 'bad');
  else hud.log(who === 0 ? `${subj} at ${at} — the enemy ${r.ship!.cls} goes down!` : `${subj} at ${at} — your ${r.ship!.cls} is lost.`, who === 0 ? 'good' : 'bad');
  busy = false;
  refresh();
}

async function afterMyAction() {
  refresh();
  if (g.phase === 'battle' && g.ap === 0) { await wait(350); finishTurn(); }
}

async function battleClick(c: Cell) {
  if (!myTurn()) return;
  if (mode === 'fire') {
    if (c.side !== 'enemy') return;
    await shoot(c, 0);
    return afterMyAction();
  }
  if (c.side !== 'own') return;
  const at = shipAt(g.players[0], c.x, c.y);
  if (mode === 'turn') {
    if (!at || at.ship.sunk) return;
    if (turn(g, at.ship.id)) hud.log(`Your ${at.ship.cls} comes about.`);
    else hud.log(`The ${at.ship.cls} cannot turn — ${at.ship.hits.filter(Boolean).length >= 2 ? 'too badly damaged' : 'no sea room'}.`);
    return afterMyAction();
  }
  if (selected) {
    const t = sailTargets(selected).find((q) => q.cell.x === c.x && q.cell.y === c.y);
    if (t) {
      const wounded = selected.hits.some(Boolean);
      sail(g, selected.id, t.delta);
      hud.log(`Your ${selected.cls} sails one square${wounded ? ', trailing wreckage' : ''}.`);
      if (!sailTargets(selected).length || g.ap === 0) selected = null;
      return afterMyAction();
    }
  }
  selected = at && !at.ship.sunk ? at.ship : null;
  refresh();
}

async function finishTurn() {
  selected = null;
  endTurn(g);
  busy = true;
  refresh();
  while (g.phase === 'battle' && g.current === 1) {
    await wait(650);
    const a = chooseAction(g);
    if (a.type === 'fire') await shoot({ side: 'own', x: a.x, y: a.y }, 1);
    else if (a.type === 'sail') { sail(g, a.shipId, a.delta); hud.log('The enemy shifts a ship, unseen.'); }
    else if (a.type === 'turn') { turn(g, a.shipId); hud.log('The enemy shifts a ship, unseen.'); }
    busy = true;
    refresh();
    if (g.phase === 'battle' && (g.ap === 0 || a.type === 'end')) { await wait(400); endTurn(g); }
  }
  busy = false;
  if (g.phase === 'battle') hud.log(`Round ${g.round}`, 'head');
  refresh();
}

/* ---------- input ---------- */
canvas.addEventListener('pointermove', (e) => {
  const c = scene.pick(e);
  if (c?.side === hover?.side && c?.x === hover?.x && c?.y === hover?.y) return;
  hover = c;
  if (g.phase === 'placement' && lifted && c) moveLifted(c);
  refresh();
});
canvas.addEventListener('click', (e) => {
  const c = scene.pick(e);
  if (!c) return;
  hover = c;
  if (g.phase === 'placement') placementClick(c);
  else battleClick(c);
});
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (g.phase === 'placement') {
    if (k === 'r') rotateLifted();
    if (k === 'escape' && lifted && selected) { Object.assign(selected, lifted); selected = lifted = null; refresh(); }
    return;
  }
  if (k === 'f' || k === '1') setMode('fire');
  if (k === 's' || k === '2') setMode('sail');
  if (k === 't' || k === '3') setMode('turn');
  if (k === ' ' && myTurn()) { e.preventDefault(); finishTurn(); }
});

reset();
hud.setMode('fire');
hud.setHint(HINTS.fire);
