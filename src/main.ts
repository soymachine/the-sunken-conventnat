// Controller: lobby → session → one Client driving the scene and the HUD.
import './ui/fonts';
import './ui/hud.css';
import { CMDS, Client, TURN_SECONDS, Msg, Snapshot, afloat, krakenSeals, roleOf } from './game/engine';
import { recordMatch } from './net/account';
import { ITEMS, Item } from './game/powerups';
import { Dir, Ship, Way, ZONE, ahead, attackCells, bowCell, cellName, clampZone, fits, headingOf, inBoard, legalPlacement, pivotCell, randomFleet, shipAt, shipCells, turned, MAELSTROM_ROUND, N, becalmed } from './game/rules';
import { verify } from './game/verify';
import { createRoom, firebaseConfigured, joinRoom } from './net/firebase';
import { LocalSession, Session } from './net/session';
import { Cell, Ghost, Highlight, SeaScene } from './render/scene';
import { Sfx } from './ui/audio';
import { startI18n } from './ui/i18n';
import { boot } from './ui/boot';
import { installErrorReporting } from './net/errors';
import { PAL, setColourBlind } from './ui/palette';
import { Tutorial } from './ui/tutorial';
import { setCursorRotation } from './ui/cursors';
import { Hud, Mode } from './ui/hud';
import { Lobby } from './ui/lobby';

const INK = 0x0d0b08, FOG = 0xcfc4a8;
// Spanish or English, chosen in Settings (or from the browser's language at first).
startI18n();
void boot();
const canvas = document.getElementById('sea') as HTMLCanvasElement;
installErrorReporting(canvas);
const scene = new SeaScene(canvas);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sfx = new Sfx();
scene.sound = (s) => sfx.play(s);
scene.rain = (on) => sfx.setRain(on);
scene.ambience = (on) => sfx.setAmbience(on);
let quiet = false; // rebuilding the view from history: no animations

let session: Session | null = null;
let c: Client;
let mode: Mode = 'fire';
let aimDir: Dir = 'h';
/** Which way a double-shotted ball flies on (0 east, 1 south, 2 west, 3 north). */
let dblDir = 0;
let busy = false; // animations playing
let selected: Ship | null = null; // ship chosen for sailing, or lifted during placement
let lifted: { x: number; y: number; dir: Dir; rev: boolean } | null = null;
let grab = 0; // which section of the lifted ship is under the pointer
const flying = new Set<string>(); // blows on their way: `side:x,y`
let hover: Cell | null = null;
let foeOnline = true;
const queue: Msg[] = [];

const HINTS: Record<string, string> = {
  squall: 'Squall — click the side of the enemy chart the wind should drive their fleet towards.',
  gale: 'Call the Wind — click the side of your chart the wind should blow towards this round.',
  sound: 'Soundings — click a square of enemy water to sound its row. Press R to sound its column instead.',
  double: 'Double-Shotted — pick a square of enemy water. If it hits, the ball flies on one square further. Press R to turn which way.',
  fire: 'Fire — pick a square in enemy waters. One point a shot.',
  sail: 'Sail — pick one of your ships, then a square ahead of her bow. Ships cannot back up.',
  turn: 'Turn — pick one of your ships, then click on the side her bow should swing to: an arrow marks each choice (or press Q for port, E for starboard).',
  broadside: 'Broadside — three squares in a line. Press R to swing the line.',
  chain: 'Chain shot — a hit pins that ship for its next turn.',
  spy: 'Cutter’s glass — count hull sections in a 5×5 patch of enemy water.',
  spyglass: 'Spyglass — count hull sections in a 5×5 patch of enemy water.',
  longglass: 'Long Glass — pick a 2×2 patch of enemy water to see it plainly until your turn ends.',
  fireship: 'Fire ship — five squares in a cross.',
  fog: 'Fog bank — pick the centre of a 5×5 patch of your own water.',
  kraken: 'Summon the Kraken — pick the centre of a 3×3 patch of enemy water. It strikes now and again next turn, and holds the ships it finds.',
  shipwright: 'Shipwright — pick a damaged section of one of your ships.',
  pact: 'Blood Pact — pick one of your damaged ships to give to the deep for two seals.',
  current: 'Sea Current — click towards the side of your chart the fleet should drift to.',
};

const hud = new Hud({
  mode: (m) => { sfx.play('click'); setMode(m); },
  mute: () => sfx.toggle(),
  quality: (q) => scene.setQuality(q),
  style: (st) => scene.setStyle(st),
  // Debug only: changes this browser's view of the game, for trying cards; never use it in a real match.
  cheat: (what) => {
    // Both copies of the game must agree, so this only works against the machine (whose copy lives here too).
    const bot = (session as { bot?: Client } | null)?.bot;
    if (!bot) { hud.log('Debug tools work only against the machine.', 'bad'); return; }
    for (const pub of [c.pub, bot.pub]) {
      if (what === 'gold') pub.sides[c.me].doubloons += 100;
      if (what === 'seals') pub.sides[c.me].seals += 3;
      if (what === 'ap' && pub.current === c.me) pub.ap += 3;
    }
    hud.log(`Debug: ${what === 'gold' ? '+100 doubloons' : what === 'seals' ? '+3 seals' : '+3 action points'}.`);
    refresh();
  },
  sky: (what) => scene.sky(what),
  sound: (s) => sfx.play(s),
  volume: (k, v) => sfx.setVolume(k, v),
  colourBlind: (on) => { setColourBlind(on); refresh(); },
  tutorial: () => { Tutorial.reset(); if (session instanceof LocalSession) { tutorial.start(c); refresh(); } else hud.log('The tutorial will guide your next battle against the machine.'); },
  note: (text) => { if (!c.note(text)) hud.log('One bottle a turn: yours is already cast.', 'bad'); },
  letterRead: () => scene.clearBottles(),
  buy: (item) => { if (c.buy(item)) setMode(item === 'winds' ? mode : item); },
  endTurn: () => { if (!busy) c.endTurn(); },
  shuffle: () => { if (canPlace()) { c.ships = randomFleet(Math.random, c.role); selected = lifted = null; refresh(); } },
  rotate: rotateLifted,
  ready: () => { if (!canPlace() || lifted) return; if (!legalPlacement(c.ships)) hud.log('The merchantman must start in the Colony: columns A to C.', 'bad'); else void c.ready(); },
  leave,
  rematch: () => {
    if (session?.code) { void session.askRematch?.(); return; }
    if (!lastBot) return; const b = lastBot; leave(); void start(new LocalSession(b.mode, 700, Math.random, true), b.name);
  },
});
let lastBot: { name: string; mode: Session['mode'] } | null = null;
let captainName = '';

/* ---------- the rematch, online ---------- */
// Both captains ask from the battle report; the one who moved second opens a new room (moving first there) and
// points the old room at it; the other follows. Each then leaves the old room, which goes once both have.
let rematchStop: (() => void) | null = null, rematchBusy = false, rematch = { mine: false, theirs: false };
const foeName = () => c.foeSide.name || 'The other captain';
/** The rematch button as things stand: offered, asked, invited, or gone with the other captain. */
function paintRematch() {
  if (!rematchStop || rematchBusy) return;
  hud.setRematch(!foeOnline ? 'gone' : rematch.mine && rematch.theirs ? 'starting' : rematch.mine ? 'asked' : rematch.theirs ? 'invited' : 'offer', foeName());
}
function watchRematch(s: Session) {
  if (rematchStop || !s.watchRematch) return;
  rematchStop = s.watchRematch(async ({ mine, theirs, next }) => {
    if (session !== s || rematchBusy) return;
    rematch = { mine, theirs };
    if (next && s.me === 0) return void follow(s, next);
    if (mine && theirs && s.me === 1) {
      rematchBusy = true; hud.setRematch('starting', foeName());
      try { const ns = await s.openRematch!(); switchTo(s, ns); }
      catch { rematchBusy = false; hud.setRematch('error', foeName()); }
      return;
    }
    paintRematch();
  });
}
async function follow(s: Session, code: string) {
  rematchBusy = true; hud.setRematch('starting', c.foeSide.name || '');
  try { switchTo(s, await joinRoom(code)); }
  catch { rematchBusy = false; hud.setRematch('error', c.foeSide.name || ''); }
}
function switchTo(old: Session, ns: Session) {
  rematchStop?.(); rematchStop = null; rematchBusy = false;
  try { localStorage.removeItem(storeKey()); } catch { /* ignore */ }
  old.finished?.(); old.close();
  if (ns.code) location.hash = ns.code;
  void start(ns, captainName);
}
hud.setPrefs(sfx.muted, scene.getQuality(), sfx.vol, scene.getStyle());
// ?debug exposes the scene and HUD to the console, to trigger weather and notices by hand.
// Debug tuning that reaches into the 3D scene.
addEventListener('tsc:tune', (e) => { const { v, n } = (e as CustomEvent<{ v: string; n: number }>).detail; if (v === '--wind') scene.setWindStrength(n); if (v === '--cursor-rot') setCursorRotation(n); });
if (new URLSearchParams(location.search).has('debug')) { Object.assign(window, { scene, hud }); Object.defineProperty(window, 'game', { get: () => ({ c, session }) }); Object.assign(window, { refresh: () => refresh() }); }
// The guided first battle: the note points at a chart by its corners as they stand on screen.
const tutorial = new Tutorial((side) => {
  const pts = [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]].map(([x, y]) => scene.screen({ side, x, y }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x = Math.min(...xs) - 20, y = Math.min(...ys) - 20;
  return { x, y, w: Math.max(...xs) + 20 - x, h: Math.max(...ys) + 20 - y };
}, () => hud.heralding || !!document.querySelector('.cmdModal') || !session);
// The note also follows what changes between redraws (the turn ribbon passing, a card rising).
setInterval(() => { if (session && tutorial.active) tutorial.update(c); }, 400);
const lobby = new Lobby({
  bot: (name, mode) => { lastBot = { name, mode }; void start(new LocalSession(mode, 700, Math.random, true), name); },
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

/**
 * True when this page's art is no longer on the site: a tab left open across several deploys. Checked as a game
 * starts, so the page can reload with fresh art then rather than show blank cards later.
 */
async function artGone() {
  try { return (await fetch('/ui/card.webp', { method: 'HEAD', cache: 'no-store' })).status === 404; } catch { return false; }
}

async function start(s: Session, name: string) {
  if (await artGone()) { location.reload(); return; }
  session = s; captainName = name; rematchStop?.(); rematchStop = null; rematch = { mine: false, theirs: false };
  c = new Client(s.me, s.seed, (m) => s.send(m), Math.random, name, s.mode);
  let snap: Snapshot | null = null;
  try { snap = JSON.parse(localStorage.getItem(storeKey()) || 'null'); } catch { /* ignore */ }
  if (snap) c.restore(snap);
  mode = 'fire'; selected = lifted = null; busy = false; queue.length = 0; foeOnline = true; flying.clear();
  scene.reset();
  seen.storm = seen.tide = seen.ring = 0; seen.seals = -1;
  hud.clearLog();
  hud.log(s.code ? `Room ${s.code}. Arrange your fleet, then turn the capstan.` : 'Arrange your fleet, then turn the capstan.');
  c.onNote = (t) => hud.log(t, 'good');
  c.onChange = (m, ok, replay) => {
    save();
    if (!ok) return;
    if (replay) { quiet = true; refresh(); quiet = false; return; }
    if (m.t === 'result') for (const r of m.results) flying.add(`${m.by === c.me ? 'own' : 'enemy'}:${r.x},${r.y}`);
    // A shot fired at me is settled by my own copy of the game the moment it arrives (my ship may already be
    // marked sunk); its squares wait, unchanged on the chart, until the ball has landed.
    if (m.t === 'attack' && m.by !== c.me) for (const [x, y] of m.cells) flying.add(`own:${x},${y}`);
    queue.push(m);
    if (!busy) void drain();
  };
  lobby.show(false);
  hud.show(true);
  hud.setHint(HINTS.fire);
  if (c.role !== 'classic' && !snap) hud.showRole(c.role);
  // Classic: choose a commander (or none) before the fleet is committed. Against the machine, if you lead one
  // it leads one too, drawn at random; it waits for your choice before it readies its own fleet.
  const local = s instanceof LocalSession ? s : null;
  if (c.role === 'classic' && !c.side.ready && !snap?.initial?.length) {
    void hud.chooseCommander(c.cmd ?? null).then((k) => {
      c.cmd = k ?? undefined;
      save();
      local?.begin(k ? CMDS[Math.floor(Math.random() * CMDS.length)] : undefined);
      refresh();
    });
  } else local?.begin();
  refresh();
  s.listen((m) => c.receive(m), (on) => { if (!on && foeOnline) foeGoneAt = performance.now(); foeOnline = on; refresh(); paintRematch(); });
  // The first battle against the machine is guided, once.
  if (s instanceof LocalSession && !Tutorial.seen()) tutorial.start(c); else if (tutorial.active) tutorial.stop(false);
  Object.assign(window, { __client: c, __screen: (cell: Cell) => scene.screen(cell), __bot: (s as LocalSession).bot });
}

/** The figures of a finished battle, for the report and the captain's log. */
const CARD_MSGS = new Set(['bind', 'squall', 'gale', 'sound', 'kraken', 'power', 'scan', 'peek', 'pact', 'current', 'fog', 'repair', 'winds']);
function battleStats() {
  const mine = (m: Msg) => m.by === c.me;
  // My shots, as the other captain answered them (not the Kraken's strikes, nor the maelstrom).
  const answers = c.log.filter((m) => m.t === 'result' && !mine(m) && !m.kraken).flatMap((m) => (m.t === 'result' ? m.results : []));
  return {
    rounds: c.pub.round, shots: answers.length, hits: answers.filter((r) => r.r === 'hit' || r.r === 'sunk' || r.r === 'flood').length,
    sank: c.foeSide.sunk.length, lost: c.side.sunk.length, gold: c.side.doubloons,
    cards: c.log.filter((m) => mine(m) && (CARD_MSGS.has(m.t) || (m.t === 'attack' && m.src !== 'shot'))).length,
    krakens: c.log.filter((m) => m.t === 'kraken' && mine(m)).length,
  };
}

/** When a battle ends, a signed-in captain's log gains it (online: once the other's log is checked, or after 20 s). */
let recorded = '';
function recordBattle(fair?: boolean) {
  if (!session || c.pub.phase !== 'over') return;
  const key = `${session.code ?? 'machine'}:${session.seed}`;
  if (recorded === key) return;
  recorded = key;
  const st = battleStats();
  void recordMatch({
    vs: session.code ? 'online' : 'machine', mode: session.mode, role: c.role,
    opponent: c.foeSide.name || (session.code ? '' : 'The machine'),
    cmd: c.side.cmd ?? 'none', foeCmd: c.foeSide.cmd ?? 'none',
    result: c.pub.winner === c.me ? 'win' : 'loss', reason: c.pub.reason ?? 'fleet', rounds: c.pub.round,
    shots: st.shots, hits: st.hits, sank: st.sank, lost: st.lost, krakens: st.krakens,
    ...(fair === undefined ? {} : { fair }),
  }).catch(() => { /* the log could not be written: the battle simply is not kept */ });
}

function leave() {
  stopCountdown();
  if (tutorial.active) tutorial.stop(false);
  try { localStorage.removeItem(storeKey()); } catch { /* ignore */ }
  rematchStop?.(); rematchStop = null;
  // Online, this captain is done with the room; once both are, it is deleted.
  session?.finished?.();
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
    if (m.t === 'kraken') { sfx.play('roar'); refresh(); await wait(1300); }
    // A bottle drifts across; one that reaches my waters unrolls its letter when it lands.
    if (m.t === 'note') {
      const text = c.pub.notes?.slice(-1)[0]?.text ?? m.text, from = c.pub.sides[m.by].name || 'The other captain';
      if (mine) void scene.bottle('enemy', false);
      else void scene.bottle('own', true).then(() => hud.letter(text, from));
    }
    if (m.t === 'result') {
      refreshHud();
      const side = mine ? 'own' : 'enemy';
      if (m.kraken) await Promise.all(m.results.map((r, i) => wait(i * 420).then(() => scene.lash({ side, x: r.x, y: r.y }, r.r))));
      else await Promise.all(m.results.map((r, i) => wait(i * 130).then(() => scene.shot({ side, x: r.x, y: r.y }, r.r))));
    }
    if (m.t === 'result') { for (const r of m.results) flying.delete(`${mine ? 'own' : 'enemy'}:${r.x},${r.y}`); if (mine) for (const k of [...flying]) if (k.startsWith('own:')) flying.delete(k); }
    if (m.t === 'drowned') for (const r of m.results) scene.drown({ side: mine ? 'own' : 'enemy', x: r.x, y: r.y }, r.r);
    if (m.t === 'powerResult') sfx.play('glass');
    if (m.t === 'scanResult') await scene.sweep({ side: mine ? 'own' : 'enemy', x: m.x, y: m.y });
    if (m.t === 'move' && m.treasure) scene.coins({ side: mine ? 'own' : 'enemy', x: m.treasure[0], y: m.treasure[1] }, mine);
    if (m.t === 'move' && mine) sfx.play('creak');
    if (m.t === 'buy' && mine) sfx.play('coin');
    if (m.t === 'endTurn' && c.myTurn) sfx.play('bell');
    if (m.t === 'endTurn' && !c.myTurn && mine) sfx.play('hourglass');
    describe(m, mine);
    refresh();
  }
  busy = false;
  refresh();
  autoEnd();
}

/** Out of action points: the turn ends by itself after a short count, leaving time to buy or to use Trade Winds. */
const AUTO_END_SECONDS = 4;
let countdown: ReturnType<typeof setInterval> | undefined;
function stopCountdown() { if (countdown) { clearInterval(countdown); countdown = undefined; if (session) hud.setHint(HINTS[mode] || ''); } }
function autoEnd() {
  stopCountdown();
  const spent = () => !!session && c.pub.phase === 'battle' && c.can() && c.pub.ap === 0 && !busy;
  if (!spent()) return;
  let left = AUTO_END_SECONDS;
  const tick = () => {
    if (!spent()) { stopCountdown(); return; }
    if (left <= 0) { stopCountdown(); c.endTurn(); return; }
    hud.setHint(`No action points left — your turn ends in ${left}…`);
    left--;
  };
  tick();
  countdown = setInterval(tick, 1000);
}

function describe(m: Msg, mine: boolean) {
  const foe = c.foeSide.name || 'The enemy';
  switch (m.t) {
    case 'ready': if (!mine) hud.log(`${m.name} has committed a fleet.`); if (c.pub.phase === 'battle') hud.log('Round 1', 'head'); break;
    case 'kraken': hud.log(mine ? `You break ${krakenSeals(c.side) === 2 ? 'two' : 'three'} seals. The Kraken rises at ${cellName(m.x, m.y)}!` : `${foe} breaks ${krakenSeals(c.foeSide) === 2 ? 'two' : 'three'} seals — the Kraken rises under your ships at ${cellName(m.x, m.y)}!`, mine ? 'good' : 'bad'); break;
    case 'drowned':
      for (const r of m.results) {
        if (r.r === 'sunk') hud.log(mine ? `The maelstrom takes your ${r.ship!.cls}.` : `The maelstrom takes the enemy ${r.ship!.cls}.`, mine ? 'bad' : 'good');
        else if (r.r === 'hit') hud.log(mine ? `The maelstrom tears at your fleet at ${cellName(r.x, r.y)}.` : `The maelstrom tears at an enemy ship at ${cellName(r.x, r.y)}.`, mine ? 'bad' : 'good');
      }
      break;
    case 'result':
      if (m.kraken) hud.log(mine ? 'The Kraken strikes your waters.' : 'The Kraken strikes.', 'head');
      for (const r of m.results) {
        const at = cellName(r.x, r.y);
        if (!mine) { // my shot, answered by the enemy
          if (r.r === 'miss') hud.log(`Your shot at ${at} — only water.`);
          else if (r.r === 'wreck') hud.log(`Your shot at ${at} — wreckage, no new damage.`);
          else if (r.r === 'flood') hud.log(`Your shot at ${at} holes her below the waterline — she is taking water!`, 'good');
          else if (r.r === 'clang') hud.log(c.role === 'corsair' ? `Your shot at ${at} is turned aside — iron plate, or an escort.` : `Your shot at ${at} rings off iron plate — an Ironclad!`, 'good');
          else if (r.cargo && r.r !== 'sunk') hud.log(`Your shot at ${at} strikes the merchantman — a crate is yours!`, 'good');
          else if (r.r === 'hit') hud.log(`Your shot at ${at} — a hit!`, 'good');
          else hud.log(`Your shot at ${at} — the enemy ${r.ship!.cls} goes down!`, 'good');
        } else {
          if (r.r === 'miss') hud.log(`Enemy shot at ${at} — only water.`);
          else if (r.r === 'wreck') hud.log(`Enemy shot at ${at} — wreckage.`);
          else if (r.r === 'flood') hud.log(`Enemy shot at ${at} holes a ship below the waterline — she is taking water and slows.`, 'bad');
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
    case 'pact': if (!mine) hud.log(`${foe} gives the ${m.ship.cls} to the deep in a blood pact, and two seals rise.`, 'bad'); break;
    case 'current': hud.log(mine ? `A current carries your fleet ${['east', 'south', 'west', 'north'][m.dir]}.` : `${foe} rides a sea current — their whole fleet drifts ${['east', 'south', 'west', 'north'][m.dir]}.`, mine ? '' : 'good'); break;
    case 'note': if (mine) hud.log('Your bottle is cast. It drifts towards the other captain.'); break;
    case 'peek': if (!mine) hud.log(`${foe} levels a long glass at ${cellName(m.x, m.y)}: they see that water plainly this turn.`, 'bad'); break;
    case 'peekResult': if (!mine) hud.log(m.fog ? `The long glass meets only fog at ${cellName(m.x, m.y)}.` : m.ships?.length ? `Through the long glass: ${m.ships.map((s) => s.cls).join(' and ')} at ${cellName(m.x, m.y)}!` : `Through the long glass: open water at ${cellName(m.x, m.y)}.`, m.ships?.length ? 'good' : ''); break;
    case 'scan': if (!mine) hud.log(`${foe} trains a spyglass on ${cellName(m.x, m.y)}.`, 'bad'); break;
    case 'scanResult': if (!mine) hud.log(m.count < 0 ? `Spyglass on ${cellName(m.x, m.y)}: nothing but fog.` : `Spyglass on ${cellName(m.x, m.y)}: ${m.count} hull section${m.count === 1 ? '' : 's'}.`, m.count > 0 ? 'good' : ''); break;
    case 'buy': hud.log(mine ? `You buy ${ITEMS[m.item].name}.` : `${foe} buys ${ITEMS[m.item].name}.`); break;
    case 'fog': hud.log(mine ? 'Fog rolls over your waters.' : `Fog rolls over enemy waters near ${cellName(m.x, m.y)}.`); break;
    case 'repair': hud.log(mine ? 'Your shipwrights patch a section.' : 'Enemy shipwrights are at work.'); break;
    case 'bind': hud.log(mine ? `You bind the tide: the next ring comes ${m.delay ? 'two rounds later' : 'a round sooner'}.` : `${foe} binds the tide: the maelstrom's next ring comes ${m.delay ? 'two rounds later' : 'a round sooner'}.`, mine ? 'good' : 'bad'); break;
    case 'squall': scene.blow(); hud.log(mine ? `A squall drives the enemy fleet ${['east', 'south', 'west', 'north'][m.dir]}.` : `${foe} calls down a squall — your fleet is driven ${['east', 'south', 'west', 'north'][m.dir]}!`, mine ? 'good' : 'bad'); break;
    case 'gale': scene.blow(); hud.log(mine ? `You call the wind: it blows ${['east', 'south', 'west', 'north'][m.wind]} this round.` : `${foe} calls the wind: it blows ${['east', 'south', 'west', 'north'][m.wind]} this round.`); break;
    case 'sound': if (!mine) hud.log(`${foe} takes soundings along ${m.axis === 'row' ? `row ${m.i + 1}` : `column ${cellName(m.i, 0)[0]}`}.`, 'bad'); break;
    case 'soundResult': if (!mine) hud.log(`Soundings along ${m.axis === 'row' ? `row ${m.i + 1}` : `column ${cellName(m.i, 0)[0]}`}: ${m.count > 0 ? 'there are ships on that line!' : 'no ship lies on that line.'}`, m.count > 0 ? 'good' : ''); break;
    case 'winds': hud.log(mine ? 'The trade winds fill your sails: one more point.' : `${foe} catches the trade winds.`); break;
    case 'power':
      if (roleOf(c.pub, m.by) === 'admiral') hud.log(mine ? 'Close Escort: your frigates close around the merchantman.' : 'The Admiral orders a close escort: the next hit on the merchantman will be turned aside.', mine ? 'good' : 'bad');
      else if (!mine) hud.log('The Corsair works her dead reckoning…', 'bad');
      break;
    case 'powerResult': hud.log(mine ? `The Corsair has your merchantman's column: ${cellName(m.col, 0)[0]}.` : `Dead Reckoning: the merchantman is in column ${cellName(m.col, 0)[0]}.`, mine ? 'bad' : 'good'); break;
    case 'order': if (!mine) hud.log(`${foe} fulfils secret orders: ${m.reward} doubloons.`); break;
    case 'endTurn':
      if (c.pub.current === 0 && c.pub.phase === 'battle') hud.log(`Round ${c.pub.round}`, 'head');
      weather();
      break;
    case 'reveal':
      if (!mine && session?.code) {
        const s = session;
        void verify(c.log, c.foe, roleOf(c.pub, c.foe), s.seed, s.mode).then((bad) => {
          hud.setVerdict(bad ? `The enemy's log does not add up: ${bad}.` : "The enemy's log checks out: every shot was answered truthfully.");
          recordBattle(!bad);
        });
      }
      break;
  }
}

/** Announce storms, tides and the maelstrom once each as they arrive. */
const seen = { storm: 0, tide: 0, ring: 0, seals: -1, warned: 0 };
function weather() {
  const p = c.pub;
  // The storm front is shown under the round in the status line, not as a passing notice.
  if (p.storm && p.storm.until !== seen.storm) seen.storm = p.storm.until;
  if (p.tide && p.tide.round !== seen.tide) { seen.tide = p.tide.round; const way = p.tide.dx > 0 ? 'east' : p.tide.dx < 0 ? 'west' : p.tide.dy > 0 ? 'south' : 'north';
    hud.log(`High tide! Every five rounds the sea carries all the treasure and seals a square ${way}.`);
    if (p.tide.round === p.round) { scene.tide(p.tide.dx, p.tide.dy); hud.herald('High tide', `The flotsam drifts a square ${way}`, true); } }
  // Say plainly when a covenant seal comes in, and when three of them can wake the Kraken.
  const n = c.side.seals;
  if (seen.seals >= 0 && n > seen.seals && p.phase === 'battle') {
    sfx.play('seal');
    hud.log(n >= 3 ? 'Three covenant seals! The Kraken will answer: choose Summon the Kraken above the helm.' : `A covenant seal is yours: ${n} of 3. Three summon the Kraken.`, 'good');
  }
  seen.seals = n;
  // Warn two rounds ahead that the sea will start to close in.
  if (p.mode !== 'convoy' && p.phase === 'battle' && p.round === MAELSTROM_ROUND - 2 && seen.warned !== p.round) { seen.warned = p.round; hud.log(`The sea darkens at the edges: from round ${MAELSTROM_ROUND} the maelstrom swallows the outer ring every other round. Bring your ships in!`, 'bad'); }
  if (p.ring !== seen.ring) { seen.ring = p.ring; if (p.ring) hud.log('The maelstrom swallows another ring of the chart!', 'bad'); }
}

/* ---------- view ---------- */
const canPlace = () => !!session && c.pub.phase === 'placement' && !c.side.ready;
const myTurn = () => !!session && c.can() && !busy;

function setMode(m: Mode) {
  if (m === 'power') { c.power(); return; }
  if (m === 'winds') { c.winds(); return; }
  if (m === 'bindLater' || m === 'bindSooner') { c.bind(m === 'bindLater'); return; }
  mode = m;
  selected = null;
  hud.setHint(HINTS[m] || '');
  refresh();
}

function sailTargets(s: Ship): { cell: Cell; delta: 1 | -1; steps: number }[] {
  const out: { cell: Cell; delta: 1 | -1; steps: number }[] = [];
  // Only ahead: the square the bow would reach after each step.
  for (let k = 1; k <= c.reach(s.id); k++) { const [x, y] = bowCell(ahead(s, k)); out.push({ cell: { side: 'own', x, y }, delta: 1, steps: k }); }
  return out;
}

const WAYS: Way[] = ['left', 'right'];
const whyNot = (s: Ship) => (c.held(s.id) ? 'the Kraken holds her' : s.chained ? 'she is pinned by chain shot' : s.hits.filter(Boolean).length >= 2 ? 'she is too badly damaged' : 'there is no sea room');
/** Which way the current would carry the fleet: from the chart's centre towards the pointer. */
const currentDir = (x: number, y: number) => { const dx = x - (N - 1) / 2, dy = y - (N - 1) / 2; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3); };
const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/**
 * Which turn the pointer is asking for. Port and starboard put her on the same line of squares and differ
 * only in which end the bow takes, so the choice is the side of her present line the pointer is on: anywhere
 * within a few squares on the side the bow should swing to. Squares on her own line choose nothing.
 */
function hoverWay(): Way | null {
  if (!selected || !hover || hover.side !== 'own') return null;
  const s = selected, [px, py] = pivotCell(s), dx = hover.x - px, dy = hover.y - py, reach = Math.max(3, s.len);
  if (Math.max(Math.abs(dx), Math.abs(dy)) > reach) return null;
  for (const w of WAYS) {
    const [bx, by] = bowCell(turned(s, w));
    if (dx * Math.sign(bx - px) + dy * Math.sign(by - py) > 0) return w;
  }
  return null;
}
/** Arrows for both turns, and a translucent ship for the one being pointed at. */
function turnGhosts(): Ghost[] {
  if (!session || mode !== 'turn' || !selected || !myTurn()) return [];
  const s = selected, hot = hoverWay(), from = bowCell(s);
  return WAYS.map((w) => ({ kind: s.kind, ...turned(s, w), from, pivot: pivotCell(s), ship: hot === w, state: !c.canTurn(s.id, w) ? 'bad' as const : hot === w ? 'hot' as const : 'idle' as const }));
}
function turnSelected(way: Way) {
  if (!selected || !myTurn()) return;
  const s = selected;
  if (c.turn(s.id, way)) selected = null;
  else hud.log(`The ${s.cls} cannot turn to ${way === 'left' ? 'port' : 'starboard'} — ${whyNot(s)}.`, 'bad');
  refresh();
}

function zone(side: Cell['side'], x: number, y: number, color: number, opacity: number): Highlight[] {
  const out: Highlight[] = [];
  for (let b = y - ZONE; b <= y + ZONE; b++) for (let a = x - ZONE; a <= x + ZONE; a++) if (inBoard(a, b)) out.push({ side, x: a, y: b, color, opacity });
  return out;
}

function refreshHud() {
  if (!session) return;
  // Fall back to plain fire when the chosen tool is spent or its ship is lost.
  const cost: Record<string, number> = { broadside: 2, chain: 2, spy: 1, kraken: 3, pact: 1, ...Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.ap])) };
  const gone = (mode in cost && c.pub.ap < cost[mode]) || (mode === 'pact' && !c.canPact()) || (mode === 'kraken' && c.side.seals < 3) || (mode === 'broadside' && !c.alive('line')) || (mode === 'chain' && !c.alive('frigate')) || (mode === 'spy' && !c.alive('cutter')) || (mode in ITEMS && !c.has(mode as Item));
  if (gone && c.pub.phase === 'battle') { mode = 'fire'; hud.setHint(HINTS.fire); }
  hud.update(c, mode, foeOnline ? '' : 'lost at sea (disconnected)');
}

/** Music and the wind for where the game stands: the home, the battle (tense when a fleet is down to its
 * last ship), and a sting once it is over. Nothing assigned in the sound bank: silence. */
let stung = '';
function soundtrack() {
  if (!session) { sfx.setMusic('musicHome'); sfx.setWind(0); return; }
  const p = c.pub;
  if (p.phase === 'over') {
    sfx.setWind(0);
    const k = `${session.code ?? 'machine'}:${session.seed}`;
    if (stung !== k) { stung = k; sfx.sting(p.winner === c.me ? 'stingWin' : 'stingLose'); hud.setResults(battleStats(), true); if (session.code) watchRematch(session); }
    return;
  }
  const mineLeft = c.ships.filter((s) => !s.sunk).length, foeLeft = c.ships.length - c.foeSide.sunk.length;
  sfx.setMusic(p.phase === 'battle' && (mineLeft <= 1 || foeLeft <= 1) ? 'musicTense' : 'musicBattle');
  sfx.setWind(p.phase !== 'battle' ? 0.3 : (p.wind ?? 0) < 0 ? 0 : p.storm ? 1 : 0.55);
}

/* ---------- the turn's clock, and (online) the link to the other captain ---------- */
// A turn lasts TURN_SECONDS of its mode; in the last seconds the clock ticks, and at 0 your turn ends by itself.
// Against the machine it runs too, but not in the guided first battle, and it stops while the tab is hidden.
let turnStart = performance.now(), lastTick = -1, foeGoneAt = 0;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
setInterval(() => {
  const online = !!session?.code;
  if (!session || !c || c.pub.phase !== 'battle' || (!online && tutorial.active)) hud.setClock(null);
  else {
    if (!online && document.hidden) turnStart += 250;
    const total = TURN_SECONDS[session.mode], warn = Math.min(15, Math.round(total / 3));
    const left = Math.max(0, total - (performance.now() - turnStart) / 1000);
    hud.setClock(left, total, c.myTurn, warn);
    if (c.myTurn && left > 0 && left <= warn && Math.ceil(left) !== lastTick) { lastTick = Math.ceil(left); sfx.play('tick'); }
    if (c.myTurn && left <= 0 && c.can() && !busy) { hud.log('The glass ran out: your turn is over.', 'bad'); c.endTurn(); }
  }
  // The link: the other captain gone quiet, or this browser off the net.
  const foe = c?.foeSide?.name || 'The enemy';
  if (online && c.pub.phase !== 'over' && !foeOnline) {
    const gone = (performance.now() - (foeGoneAt || performance.now())) / 1000;
    hud.setLink(gone < 60 ? `${foe} has lost contact. Waiting for them to return… ${mmss(gone)}` : `${foe} has been gone for ${mmss(gone)}. They may not come back: wait, or go back to port.`, gone >= 60);
  } else if (online && !navigator.onLine) hud.setLink('You are offline. The battle carries on when your connection returns.');
  else hud.setLink(null);
}, 250);

let lastTurnKey = '';
function refresh() {
  // The battle is over: against the machine it goes in the log at once; online, once the logs are checked.
  if (c?.pub.phase === 'over' && session && recorded !== `${session.code ?? 'machine'}:${session.seed}`) {
    if (!session.code) recordBattle(); else setTimeout(() => recordBattle(), 20000);
  }
  pointerFor();
  soundtrack();
  if (!session) return;
  refreshHud();
  tutorial.update(c);
  const invalid = !!lifted && (!fits(c.ships, selected!, selected!.id) || !legalPlacement(c.ships));
  const convoy = c.role === 'classic' ? undefined : { side: c.role === 'admiral' ? 'own' as const : 'enemy' as const, zone: c.role === 'admiral' && c.pub.phase === 'placement' };
  scene.sync({ pub: c.pub, me: c.me, ships: c.ships, selectedId: selected?.id ?? null, invalid, lifted: !!lifted, quiet, convoy, hide: flying, ghosts: turnGhosts() });
  scene.setTurn(c.pub.phase !== 'battle' || c.myTurn);
  // Announce each new turn once, with a ribbon across the screen.
  const turnKey = c.pub.phase === 'battle' ? `${c.pub.round}:${c.pub.current}` : '';
  if (turnKey !== lastTurnKey) { turnStart = performance.now(); lastTick = -1; }
  if (turnKey && turnKey !== lastTurnKey && !quiet) hud.herald(c.myTurn ? 'Your turn' : 'The enemy moves', `Round ${c.pub.round} · ${(c.pub.wind ?? 0) < 0 ? 'flat calm' : `wind ${['east', 'south', 'west', 'north'][c.pub.wind ?? 0]}`}`, c.myTurn);
  if (turnKey && turnKey !== lastTurnKey) hud.setHint(c.myTurn ? HINTS[mode] || '' : 'The enemy is at the helm. Watch your waters…');
  lastTurnKey = turnKey;
  const hl: Highlight[] = [];
  // Soundings stay marked on the enemy chart for a round, drawn first so any aim (a Kraken's patch, a shot) shows over them: amber where a ship lies on the line, dark where none.
  for (const sd of c.foeSide.soundings ?? []) {
    if (c.pub.round - sd.round > 1) continue;
    for (let k = 0; k < N; k++) hl.push({ side: 'enemy', x: sd.axis === 'row' ? k : sd.i, y: sd.axis === 'row' ? sd.i : k, color: sd.count > 0 ? PAL.amber : INK, opacity: 0.16 });
  }
  // A lifted ship casts a pale shadow on the squares where she would be set down.
  if (lifted && selected) for (const [x, y] of shipCells(selected)) if (inBoard(x, y)) hl.push({ side: 'own', x, y, color: invalid ? PAL.wax : 0xfff4d6, opacity: invalid ? 0.5 : 0.6 });
  if (myTurn() && hover) {
    const { side, x, y } = hover;
    if (side === 'enemy') {
      // Drowned water cannot be fired on: the square shows dark instead of red.
      if (mode === 'fire' || mode === 'chain') hl.push({ ...hover, color: afloat(c.pub, x, y) ? PAL.wax : INK, opacity: 0.55 });
      if (mode === 'broadside' || mode === 'fireship') for (const [a, b] of attackCells(mode, x, y, aimDir)) hl.push({ side, x: a, y: b, color: afloat(c.pub, x, y) && afloat(c.pub, a, b) ? PAL.wax : INK, opacity: 0.55 });
      if (mode === 'spy' || mode === 'spyglass') hl.push(...zone(side, clampZone(x), clampZone(y), PAL.amber, 0.3)); // the patch slides to stay on the chart
      if (mode === 'longglass') { const a0 = Math.min(x, N - 2), b0 = Math.min(y, N - 2); for (const [a, b] of [[a0, b0], [a0 + 1, b0], [a0, b0 + 1], [a0 + 1, b0 + 1]]) hl.push({ side, x: a, y: b, color: PAL.amber, opacity: 0.45 }); }
      if (mode === 'double') { const [dx, dy] = STEP[dblDir]; hl.push({ ...hover, color: afloat(c.pub, x, y) ? PAL.wax : INK, opacity: 0.6 }); if (afloat(c.pub, x + dx, y + dy)) hl.push({ side, x: x + dx, y: y + dy, color: PAL.wax, opacity: 0.3 }); }
      if (mode === 'sound') for (let k = 0; k < N; k++) hl.push({ side, x: aimDir === 'h' ? k : x, y: aimDir === 'h' ? y : k, color: PAL.amber, opacity: 0.28 });
      if (mode === 'squall') { const d = currentDir(x, y), [fx, fy] = STEP[d]; for (let k = 0; k < N; k++) hl.push({ side, x: fx ? (fx > 0 ? N - 1 - c.pub.ring : c.pub.ring) : k, y: fy ? (fy > 0 ? N - 1 - c.pub.ring : c.pub.ring) : k, color: PAL.wax, opacity: 0.4 }); }
      if (mode === 'kraken') for (let b = y - 1; b <= y + 1; b++) for (let a = x - 1; a <= x + 1; a++) if (inBoard(a, b)) hl.push({ side, x: a, y: b, color: PAL.wax, opacity: 0.5 });
    } else {
      if (mode === 'fog') hl.push(...zone(side, x, y, FOG, 0.45));
      if (mode === 'gale') { const [fx, fy] = STEP[currentDir(x, y)]; for (let k = 0; k < N; k++) hl.push({ side, x: fx ? (fx > 0 ? N - 1 : 0) : k, y: fy ? (fy > 0 ? N - 1 : 0) : k, color: PAL.amber, opacity: 0.35 }); }
      if (mode === 'current') { const [fx, fy] = STEP[currentDir(x, y)]; for (const s of c.ships) if (!s.sunk) for (const [a, b] of shipCells(s)) if (inBoard(a + fx, b + fy)) hl.push({ side, x: a + fx, y: b + fy, color: PAL.amber, opacity: 0.4 }); }
      if (mode === 'pact') { const at = shipAt(c.ships, x, y); if (at) for (const [a, b] of shipCells(at.ship)) hl.push({ side, x: a, y: b, color: c.canPact(at.ship.id) ? PAL.wax : INK, opacity: 0.5 }); }
      if ((mode === 'sail' && !selected) || (mode === 'turn' && !selected) || mode === 'shipwright') {
        const at = shipAt(c.ships, x, y);
        if (at && !at.ship.sunk) {
          const ok = mode === 'sail' ? c.reach(at.ship.id) > 0 : mode === 'turn' ? c.canTurn(at.ship.id, 'left') || c.canTurn(at.ship.id, 'right') : at.ship.hits.some(Boolean);
          for (const [a, b] of shipCells(at.ship)) hl.push({ side, x: a, y: b, color: ok ? PAL.amber : INK, opacity: 0.4 });
        }
      }
    }
  }
  if (myTurn() && mode === 'sail' && selected) for (const t of sailTargets(selected)) hl.push({ ...t.cell, color: PAL.amber, opacity: 0.7 });
  // Caught in irons: the squares ahead of her bow show red, the way the wind will not let her go.
  if (myTurn() && mode === 'sail' && selected && headwind(selected)) {
    const [bx, by] = bowCell(selected), [hx, hy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][headingOf(selected)];
    for (let k = 1; k <= 2; k++) if (inBoard(bx + hx * k, by + hy * k)) hl.push({ side: 'own', x: bx + hx * k, y: by + hy * k, color: PAL.wax, opacity: k === 1 ? 0.55 : 0.3 });
  }
  if (myTurn() && mode === 'turn' && selected) for (const w of WAYS) {
    // The line she would lie on, with the square the bow would take marked more strongly.
    const ok = c.canTurn(selected.id, w), hot = hoverWay() === w, t = turned(selected, w), [bx, by] = bowCell(t);
    for (const [x, y] of shipCells(t)) if (inBoard(x, y)) hl.push({ side: 'own', x, y, color: ok ? PAL.amber : PAL.wax, opacity: x === bx && y === by ? (hot ? 0.75 : 0.42) : hot ? 0.3 : 0.12 });
  }
  scene.setHighlights(hl);
}

/* ---------- placement ---------- */
function moveLifted(cell: Cell) {
  if (!selected || cell.side !== 'own') return;
  // Keep hold of the section that was picked up, so the ship does not jump under the pointer.
  selected.x = selected.dir === 'h' ? cell.x - grab : cell.x;
  selected.y = selected.dir === 'h' ? cell.y : cell.y - grab;
}
function rotateLifted() {
  if (!lifted || !selected) return;
  // Step round the compass: east, south, west, north.
  const h = (headingOf(selected) + 1) % 4;
  selected.dir = h % 2 === 0 ? 'h' : 'v';
  selected.rev = h >= 2;
  if (hover) moveLifted(hover);
  refresh();
}
function placementClick(cell: Cell) {
  if (cell.side !== 'own' || !canPlace()) return;
  if (lifted && selected) {
    if (fits(c.ships, selected, selected.id) && legalPlacement(c.ships)) selected = lifted = null;
  } else {
    const at = shipAt(c.ships, cell.x, cell.y);
    if (at) { selected = at.ship; lifted = { x: at.ship.x, y: at.ship.y, dir: at.ship.dir, rev: !!at.ship.rev }; grab = at.idx; }
  }
  refresh();
}

/* ---------- battle ---------- */
function battleClick(cell: Cell) {
  if (!myTurn()) return;
  const { side, x, y } = cell;
  if (side === 'enemy') {
    let played = false;
    if (['fire', 'broadside', 'chain', 'fireship', 'kraken', 'double'].includes(mode) && !afloat(c.pub, x, y)) {
      hud.log('That water has gone into the maelstrom: aim inside the chart that remains.', 'bad');
      return;
    }
    if (mode === 'fire') c.attack('shot', x, y);
    else if (mode === 'broadside' || mode === 'chain' || mode === 'fireship') played = c.attack(mode, x, y, aimDir);
    else if (mode === 'spy') played = c.scan(clampZone(x), clampZone(y), 'cutter');
    else if (mode === 'spyglass') played = c.scan(clampZone(x), clampZone(y), 'spyglass');
    else if (mode === 'longglass') played = c.peek(Math.min(x, N - 2), Math.min(y, N - 2));
    else if (mode === 'kraken') played = c.kraken(x, y);
    else if (mode === 'squall') played = c.squall(currentDir(x, y));
    else if (mode === 'sound') played = c.sound(aimDir === 'h' ? 'row' : 'col', aimDir === 'h' ? y : x);
    else if (mode === 'double') { const [dx, dy] = STEP[dblDir]; played = c.double(x, y, dx, dy); }
    // A card goes back into the hand once played: the order returns to Fire.
    if (played) setMode('fire');
    return;
  }
  if (mode === 'fog') { if (c.fog(x, y)) setMode('fire'); return; }
  if (mode === 'current') { if (c.current(currentDir(x, y))) setMode('fire'); return; }
  if (mode === 'gale') { if (c.gale(currentDir(x, y))) setMode('fire'); return; }
  if (mode === 'pact') {
    const at = shipAt(c.ships, x, y);
    if (at && c.pact(at.ship.id)) { hud.log(`You give the ${at.ship.cls} to the deep. Two seals rise in her place.`, 'good'); setMode('fire'); return; }
    hud.log('Pick one of your damaged ships (not the merchantman, nor your last).', 'bad');
    return;
  }
  if (mode === 'shipwright') { if (!c.repair(x, y)) hud.log('Nothing to repair there.'); else setMode('fire'); return; }
  const at = shipAt(c.ships, x, y);
  if (mode === 'turn') {
    // First click picks the ship; then click one of the two previews.
    const way = hoverWay();
    if (selected && way) { turnSelected(way); return; }
    selected = at && !at.ship.sunk && at.ship !== selected ? at.ship : null;
    if (selected && WAYS.every((w) => !c.canTurn(selected!.id, w))) hud.log(`The ${selected.cls} cannot turn — ${whyNot(selected)}.`, 'bad');
    refresh();
    return;
  }
  // Clicking one of your ships takes her helm: the order becomes Sail with her selected.
  if (mode === 'fire' && at && !at.ship.sunk) { mode = 'sail'; hud.setHint(HINTS.sail); }
  if (mode !== 'sail') return;
  if (selected) {
    const t = sailTargets(selected).find((q) => q.cell.x === x && q.cell.y === y);
    if (t) { c.sail(selected.id, t.delta, t.steps); if (c.pub.ap === 0) selected = null; return; }
  }
  selected = at && !at.ship.sunk ? at.ship : null;
  if (selected?.chained) hud.log(`The ${selected.cls} is pinned by chain shot this turn.`);
  else if (selected && !c.held(selected.id)) { const why = becalmed(selected, c.pub.wind); if (why) { hud.log(`The ${selected.cls} cannot make way — ${why}.`, 'bad'); if (headwind(selected)) scene.blow(); } }
  refresh();
}

/** The pointer over the charts says what a click will do: a gun sight to fire, a spyglass to look, a wheel to steer. */
const AIM = new Set(['fire', 'broadside', 'chain', 'fireship', 'double', 'kraken', 'squall']), LOOK = new Set(['spy', 'spyglass', 'longglass', 'sound']);
function pointerFor() {
  let cur = '';
  if (session && hover && c.pub.phase !== 'over') {
    const at = hover.side === 'own' ? shipAt(c.ships, hover.x, hover.y) : null;
    if (hover.side === 'enemy' && myTurn()) cur = AIM.has(mode) ? 'sight' : LOOK.has(mode) ? 'glass' : '';
    else if (at && !at.ship.sunk && (c.pub.phase === 'placement' || myTurn())) cur = 'helm';
  }
  if (canvas.dataset.cur !== cur) canvas.dataset.cur = cur;
}

/** A square-rigged ship whose bow faces into the wind cannot sail at all this round. */
function headwind(s: Ship) { return !s.sunk && (becalmed(s, c.pub.wind) ?? '').includes('into the wind'); }

/* ---------- input ---------- */
canvas.addEventListener('pointermove', (e) => {
  if (!session) return;
  const cell = scene.pick(e);
  if (cell?.side === hover?.side && cell?.x === hover?.x && cell?.y === hover?.y) return;
  hover = cell;
  if (canPlace() && lifted && cell) moveLifted(cell);
  refresh();
});
/** A small note beside the pointer explaining the flotsam on a square. */
const tip = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tip', hidden: true }));
canvas.addEventListener('pointermove', (e) => {
  const t = session && hover && c.pub.phase !== 'over' ? c.pub.treasures.find((q) => (q.side === c.me) === (hover!.side === 'own') && q.x === hover!.x && q.y === hover!.y) : undefined;
  tip.hidden = !t;
  // Over one of your own ships (and no flotsam there): her name, state and speciality.
  const own = !t && session && hover?.side === 'own' && !lifted ? shipAt(c.ships, hover.x, hover.y) : null;
  hud.shipTip(own ? c.ships.indexOf(own.ship) : null, e.clientX, e.clientY);
  if (!t) return;
  const mine = t.side === c.me, seal = t.kind === 'seal';
  tip.textContent = mine
    ? (seal ? 'A covenant seal. Sail a ship onto it to take it — the enemy will see where you were.' : `Treasure worth ${t.value} doubloons. Sail a ship onto it to collect — the enemy will see where you were.`)
    : (seal ? 'An enemy seal. You cannot take it, but one of their ships may come for it.' : 'Enemy treasure. You cannot take it, but one of their ships may come for it.');
  tip.style.left = Math.min(innerWidth - 260, e.clientX + 16) + 'px';
  tip.style.top = e.clientY + 18 + 'px';
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; hud.shipTip(null, 0, 0); });
// Right-click on one of your ships offers the other manoeuvre beside her: Turn while sailing, Sail while turning.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!session || c.pub.phase !== 'battle' || !myTurn()) return;
  const cell = scene.pick(e);
  const at = cell && cell.side === 'own' ? shipAt(c.ships, cell.x, cell.y) : null;
  if (!at || at.ship.sunk) { hud.shipMenu(null); return; }
  const other: Mode = mode === 'turn' ? 'sail' : 'turn', ship = at.ship;
  hud.shipMenu({ x: e.clientX, y: e.clientY, order: other, ok: other === 'turn' ? WAYS.some((w) => c.canTurn(ship.id, w)) : c.reach(ship.id) > 0 }, () => {
    setMode(other); selected = ship; refresh();
  });
});
canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) hud.shipMenu(null); });
canvas.addEventListener('click', (e) => {
  if (!session || e.button !== 0) return;
  const cell = scene.pick(e);
  if (!cell) return;
  hover = cell;
  if (c.pub.phase === 'placement') placementClick(cell);
  else if (c.pub.phase === 'battle') {
    // A special card that did something flies from the hand to where it was played.
    const m = mode, sent = c.sent, card = ['fire', 'sail', 'turn'].includes(m) ? null : hud.snapCard(m);
    battleClick(cell);
    if (card && c.sent > sent) hud.flyCard(card, e.clientX, e.clientY);
  }
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
  if (mode === 'turn' && selected && (k === 'q' || k === 'e')) turnSelected(k === 'q' ? 'left' : 'right');
  if (k === 'escape' && selected) { selected = null; refresh(); }
  if (k === 'a' || k === '4') setMode('broadside');
  if (k === 'r') { if (mode === 'double') dblDir = (dblDir + 1) % 4; else aimDir = aimDir === 'h' ? 'v' : 'h'; refresh(); }
  if (k === ' ' && myTurn()) { e.preventDefault(); c.endTurn(); }
  if (k === 'l') hud.toggleLog();
  if (k >= '5' && k <= '9') hud.cardForKey(k)?.click();
});

hud.show(false);
lobby.show(true);
// A room code in the address takes you straight back to your seat.
const wanted = location.hash.slice(1).toUpperCase();
const invited = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
if (firebaseConfigured && /^[A-Z0-9]{4}$/.test(invited) && !/^[A-Z0-9]{4}$/.test(wanted)) {
  // An invite link: fill in the code and let the guest sign before joining.
  lobby.invited(invited);
  history.replaceState(null, '', location.pathname);
} else if (firebaseConfigured && /^[A-Z0-9]{4}$/.test(wanted)) {
  lobby.busy(true);
  lobby.status(`Returning to room ${wanted}…`);
  joinRoom(wanted).then((s) => start(s, localStorage.getItem('tsc:name') || 'Captain')).catch((e) => { lobby.busy(false); lobby.status(e.message, true); });
}
