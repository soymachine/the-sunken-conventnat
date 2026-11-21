// Message protocol, the public state both captains agree on, and the Client that
// holds one captain's private fleet. Every message is applied by both clients in
// the same order; whoever owns the waters resolves what lands on them.
import { Order, pickOrder } from './orders';
import { ITEMS, Item, MAX_ITEMS, START_DOUBLOONS } from './powerups';
import {
  AP_PER_TURN, CellResult, Dir, KRAKEN_SEALS, Kind, MAELSTROM_MAX_RING, MAELSTROM_ROUND, N, Revealed, Rnd, Role, Ship, XY, attackCells, countScan, inBoard, inKraken, inZone, legalPlacement, peekFits, safe, peekShips, randomFleet, zoneFits,
  repairShip, rimCells, resolveAttack, driftFleet, sailReach, sailShip, shipAt, shipCells, turnShip, canTurnShip, Way,
} from './rules';

export type Mode = 'classic' | 'convoy';
/** Longest message in a bottle, in characters. */
export const NOTE_MAX = 80;
/** Rounds the Admiral has to bring the cargo home. */
export const SEASON = 12;
export const CRATES = 3;
export type AttackSrc = 'shot' | 'broadside' | 'chain' | 'fireship';
export type Placement = Pick<Ship, 'id' | 'x' | 'y' | 'dir' | 'rev'>;
/** Private record of a captain's hidden moves, revealed after the battle for verification. */
export type Act = { k: 'sail'; id: number; delta: 1 | -1; steps: number } | { k: 'turn'; id: number; way: Way } | { k: 'repair'; id: number; idx: number };

export type Body =
  | { t: 'ready'; hash: string; name: string }
  | { t: 'attack'; src: AttackSrc; cells: XY[] }
  | { t: 'result'; results: CellResult[]; chained: boolean; lost: boolean; kraken?: true }
  | { t: 'kraken'; x: number; y: number }
  | { t: 'drowned'; results: CellResult[]; lost: boolean }
  | { t: 'move'; kind: 'sail' | 'turn'; debris: XY[]; treasure?: XY; wake?: number; home?: true }
  | { t: 'power' }
  | { t: 'powerResult'; col: number }
  | { t: 'scan'; x: number; y: number; src: 'cutter' | 'spyglass' }
  | { t: 'scanResult'; x: number; y: number; count: number }
  | { t: 'peek'; x: number; y: number }
  | { t: 'note'; text: string }
  | { t: 'drop'; id: number; x: number; y: number }
  | { t: 'pact'; ship: Revealed }
  | { t: 'current'; dir: number }
  | { t: 'peekResult'; x: number; y: number; ships: Revealed[]; fog: boolean }
  | { t: 'buy'; item: Item }
  | { t: 'fog'; x: number; y: number }
  | { t: 'repair' }
  | { t: 'winds' }
  | { t: 'order'; text: string; reward: number }
  | { t: 'endTurn' }
  | { t: 'reveal'; initial: Placement[]; salt: string; acts: Act[]; final: Ship[] };
export type Msg = Body & { by: 0 | 1 };

export interface Shot { x: number; y: number; result: 'miss' | 'hit' | 'clang'; round: number; sunk?: boolean }
export interface SidePub {
  name: string;
  ready: boolean;
  hash: string;
  shots: Shot[];
  debris: { x: number; y: number; round: number }[];
  sunk: Revealed[];
  spotted: { x: number; y: number; round: number }[];
  scans: { x: number; y: number; count: number; round: number }[];
  /** What this captain's Long Glass showed: a 2×2 patch of the enemy chart, seen for the rest of the turn. */
  peeks?: { x: number; y: number; ships: Revealed[]; fog: boolean; round: number }[];
  fogs: { x: number; y: number; until: number }[];
  /** Rows in which the laden merchantman was seen running under full sail. */
  wakes: { y: number; round: number }[];
  doubloons: number;
  /** Covenant seals held; three summon the Kraken. */
  seals: number;
  items: Item[];
  revealed?: Ship[];
}
export interface Treasure { side: 0 | 1; x: number; y: number; value: number; kind: 'gold' | 'seal' }
export interface Pub {
  phase: 'placement' | 'battle' | 'over';
  current: 0 | 1;
  ap: number;
  round: number;
  winner: 0 | 1 | null;
  /** An attack or scan is waiting for the defender's answer. */
  pending: boolean;
  windsUsed: boolean;
  /** Where the wind blows this round (a heading: 0 east, 1 south, 2 west, 3 north). */
  wind?: number;
  /** Each captain may seal one blood pact a battle. */
  pacts?: [boolean, boolean];
  /** Treasure owed to a side's waters, waiting for its owner to place it clear of their hidden ships. */
  due?: { id: number; side: 0 | 1; kind: 'gold' | 'seal'; value: number }[];
  dueSeq?: number;
  /** A message in a bottle was already cast this turn. */
  noteSent?: boolean;
  /** Every note cast so far, oldest first. */
  notes?: { by: 0 | 1; text: string; round: number }[];
  rng: number;
  sides: [SidePub, SidePub];
  treasures: Treasure[];
  mode: Mode;
  /** Convoy only: which captain drew the Admiral; the other is the Corsair. */
  admiral: 0 | 1 | null;
  /** Crates still aboard the merchantman. */
  cargo: number;
  /** Each captain's once-a-battle power has been spent. */
  power: [boolean, boolean];
  /** Column of the merchantman as revealed by Dead Reckoning. */
  reckon?: { col: number; round: number };
  /** The Kraken, while it holds a patch of `side`'s waters. `left` strikes remain. */
  kraken?: { side: 0 | 1; x: number; y: number; left: number };
  /** Cells the Kraken is striking right now, awaiting the defender's answer. */
  strike?: XY[];
  /** A storm front over rows `row`..`row+2` of both charts: no shots or spyglasses there. */
  storm?: { row: number; until: number };
  /** Outer rings of the chart swallowed by the maelstrom. */
  ring: number;
  /** The last tide, for the log. */
  tide?: { dx: number; dy: number; round: number };
  /** How the battle ended. */
  reason?: 'fleet' | 'plunder' | 'home' | 'season';
}
/** Rounds until the maelstrom swallows its next ring (1 = at the start of the next round), or null once spent or
 *  outside the classic battle. */
export function maelstromIn(p: Pub): number | null {
  if (p.mode !== 'classic' || p.ring >= MAELSTROM_MAX_RING || p.phase === 'over') return null;
  let next = Math.max(MAELSTROM_ROUND, p.round + 1);
  if (next % 2) next++;
  return next - p.round;
}
export const inStorm = (p: Pub, y: number) => !!p.storm && y >= p.storm.row && y <= p.storm.row + 2;
export const roleOf = (p: Pub, who: 0 | 1): Role => (p.admiral === null ? 'classic' : p.admiral === who ? 'admiral' : 'corsair');

const COST: Record<AttackSrc, number> = { shot: 1, broadside: 2, chain: 2, fireship: 2 };
export const attackCost = (src: AttackSrc) => COST[src];

export function newPub(seed: number, mode: Mode = 'classic'): Pub {
  const side = (): SidePub => ({ name: '', ready: false, hash: '', shots: [], debris: [], sunk: [], spotted: [], scans: [], fogs: [], wakes: [], doubloons: START_DOUBLOONS, seals: 0, items: [] });
  return { phase: 'placement', current: 0, ap: AP_PER_TURN, round: 1, winner: null, pending: false, windsUsed: false, rng: seed >>> 0 || 1, sides: [side(), side()], treasures: [],
    mode, admiral: mode === 'convoy' ? ((((seed >>> 0) >> 3) & 1) as 0 | 1) : null, cargo: CRATES, power: [false, false], ring: 0, wind: ((seed >>> 0) >> 5) & 3, pacts: [false, false] };
}

function rand(p: Pub): number {
  let t = (p.rng = (p.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Treasure surfaces in a side's waters. Only its owner knows where their ships lie, so the owner places it
 *  (on the first free square of a sequence drawn from their secret salt) and the place is checked at the end. */
function spawnTreasure(p: Pub, side: 0 | 1, kind: 'gold' | 'seal' = 'gold') {
  const owed = (p.due || []).filter((d) => d.side === side && d.kind === kind).length;
  if (p.treasures.filter((t) => t.side === side && t.kind === kind).length + owed >= (kind === 'gold' ? 3 : 1)) return;
  const id = (p.dueSeq = (p.dueSeq || 0) + 1);
  (p.due ??= []).push({ id, side, kind, value: kind === 'seal' ? 0 : [20, 30, 40][Math.floor(rand(p) * 3)] });
}

/** Where `side` must place owed treasure `id`: the first square of their salted sequence that is on the chart,
 *  inside the maelstrom, and clear of their ships, their treasure and their wrecks. */
export function dropSquare(p: Pub, side: 0 | 1, id: number, salt: string, ships: Ship[]): XY | null {
  const taken = (x: number, y: number) => ships.some((s) => !s.sunk && shipCells(s).some(([a, b]) => a === x && b === y))
    || p.treasures.some((t) => t.side === side && t.x === x && t.y === y)
    || p.sides[side].sunk.some((s) => shipCells(s).some(([a, b]) => a === x && b === y));
  for (let k = 0; k < 400; k++) {
    let h = 2166136261;
    for (const ch of `${salt}:${id}:${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    h >>>= 0;
    const x = h % N, y = Math.floor(h / N) % N;
    if (safe(p.ring, x, y) && !taken(x, y)) return [x, y];
  }
  return null;
}

/** The Kraken lashes three cells of its patch; the defender must answer. */
function strike(p: Pub) {
  const k = p.kraken!, cells: XY[] = [];
  for (let y = k.y - 1; y <= k.y + 1; y++) for (let x = k.x - 1; x <= k.x + 1; x++) if (inBoard(x, y)) cells.push([x, y]);
  while (cells.length > 3) cells.splice(Math.floor(rand(p) * cells.length), 1);
  p.strike = cells;
  p.pending = true;
  k.left--;
}

/** The tide carries treasure and seals one cell, all the same way. */
function tide(p: Pub) {
  const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand(p) * 4)];
  p.tide = { dx, dy, round: p.round };
  for (const t of p.treasures) {
    const x = t.x + dx, y = t.y + dy;
    if (!inBoard(x, y) || p.treasures.some((o) => o !== t && o.side === t.side && o.x === x && o.y === y)) continue;
    if (p.sides[t.side].sunk.some((s) => shipCells(s).some(([a, b]) => a === x && b === y))) continue;
    t.x = x; t.y = y;
  }
}

/** Record what shots (or the sea) did to `who`'s fleet. `award` pays the attacker. */
function applyResults(p: Pub, who: 0 | 1, results: CellResult[], award: boolean) {
  const mine = p.sides[who], foe = (1 - who) as 0 | 1, attacker = p.sides[foe];
  for (const r of results) {
    mine.shots = mine.shots.filter((s) => s.x !== r.x || s.y !== r.y);
    mine.shots.push({ x: r.x, y: r.y, result: r.r === 'miss' ? 'miss' : r.r === 'clang' ? 'clang' : 'hit', round: p.round });
    if (award && (r.r === 'hit' || r.r === 'sunk')) attacker.doubloons += 5;
    if (r.cargo && p.cargo > 0) { p.cargo--; if (award) attacker.doubloons += 30; }
    if (r.r === 'sunk' && r.ship) {
      if (award) attacker.doubloons += 20;
      mine.seals++; // the drowned pay their toll
      mine.sunk.push(r.ship);
      const cs = shipCells(r.ship);
      for (const s of mine.shots) if (cs.some(([a, b]) => a === s.x && b === s.y)) s.sunk = true;
      if (r.ship.kind === 'merchant' && p.phase !== 'over') { p.phase = 'over'; p.winner = foe; p.reason = 'plunder'; }
    }
  }
}

const take = (items: Item[], it: Item) => { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); return i >= 0; };

/** Apply one message to the public state. Returns false when the message is not legal right now. */
export function reduce(p: Pub, m: Msg): boolean {
  const mine = p.sides[m.by], foe = (1 - m.by) as 0 | 1;
  if (m.t === 'drop') {
    const i = (p.due || []).findIndex((d) => d.id === m.id && d.side === m.by);
    if (i < 0 || !inBoard(m.x, m.y) || p.treasures.some((t) => t.side === m.by && t.x === m.x && t.y === m.y)) return false;
    const d = p.due!.splice(i, 1)[0];
    p.treasures.push({ side: d.side, x: m.x, y: m.y, kind: d.kind, value: d.value });
    return true;
  }
  if (m.t === 'ready') {
    if (p.phase !== 'placement' || mine.ready) return false;
    mine.ready = true; mine.hash = m.hash; mine.name = m.name;
    if (p.sides[0].ready && p.sides[1].ready) {
      p.phase = 'battle';
      for (const s of [0, 1, 0, 1] as const) spawnTreasure(p, s);
    }
    return true;
  }
  if (m.t === 'order') { mine.doubloons += m.reward; return true; }
  if (m.t === 'reveal') { if (p.phase !== 'over') return false; mine.revealed = m.final; return true; }
  if (p.phase !== 'battle') return false;
  if (m.t === 'drowned') {
    applyResults(p, m.by, m.results || [], false);
    if (m.lost && (p.phase as Pub['phase']) !== 'over') { p.phase = 'over'; p.winner = foe; p.reason = 'fleet'; }
    return true;
  }

  if (m.t === 'result' || m.t === 'scanResult' || m.t === 'powerResult' || m.t === 'peekResult') {
    if (!p.pending || m.by === p.current) return false;
    p.pending = false;
    if (m.t === 'powerResult') { p.reckon = { col: m.col, round: p.round }; return true; }
    if (m.t === 'scanResult') { mine.scans.push({ x: m.x, y: m.y, count: m.count, round: p.round }); return true; }
    // The answer belongs to the captain who looked (the one whose turn it is).
    if (m.t === 'peekResult') { (p.sides[p.current].peeks ??= []).push({ x: m.x, y: m.y, ships: m.ships || [], fog: !!m.fog, round: p.round }); return true; }
    applyResults(p, m.by, m.results || [], true);
    if (p.strike) { p.strike = undefined; if (p.kraken && p.kraken.left <= 0) p.kraken = undefined; }
    if (m.lost && (p.phase as Pub['phase']) !== 'over') { p.phase = 'over'; p.winner = foe; p.reason = 'fleet'; }
    return true;
  }

  // A message in a bottle: one a turn, on your own turn, at no cost. It changes nothing else.
  if (m.t === 'note') {
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
    if (p.phase !== 'battle' || m.by !== p.current || p.noteSent || !text) return false;
    p.noteSent = true;
    (p.notes ??= []).push({ by: m.by, text, round: p.round });
    return true;
  }

  if (m.by !== p.current || p.pending) return false;
  const spend = (ap: number, item?: Item) => {
    if (p.ap < ap || (item && !mine.items.includes(item))) return false;
    if (item) take(mine.items, item);
    p.ap -= ap;
    return true;
  };
  switch (m.t) {
    case 'attack':
      if (!m.cells?.length || m.cells.some(([, y]) => inStorm(p, y)) || !spend(COST[m.src], m.src === 'fireship' ? 'fireship' : undefined)) return false;
      p.pending = true;
      return true;
    case 'peek':
      if (!peekFits(m.x, m.y) || inStorm(p, m.y) || inStorm(p, m.y + 1) || !spend(ITEMS.longglass.ap, 'longglass')) return false;
      p.pending = true;
      return true;
    case 'scan':
      if (!zoneFits(m.x, m.y) || inStorm(p, m.y) || !spend(1, m.src === 'spyglass' ? 'spyglass' : undefined)) return false;
      p.pending = true;
      return true;
    case 'pact': {
      // A blood pact: a damaged ship is given to the deep, and the deep pays two seals (its toll and the pact).
      if ((p.pacts ??= [false, false])[m.by] || !m.ship || !spend(1)) return false;
      p.pacts[m.by] = true;
      mine.seals += 2;
      mine.sunk.push(m.ship);
      return true;
    }
    case 'current':
      if (!(m.dir >= 0 && m.dir <= 3) || !spend(ITEMS.current.ap, 'current')) return false;
      return true;
    case 'move': {
      if (!spend(1)) return false;
      for (const [x, y] of m.debris || []) {
        mine.debris = mine.debris.filter((d) => d.x !== x || d.y !== y);
        mine.debris.push({ x, y, round: p.round });
      }
      if (m.treasure) {
        const [x, y] = m.treasure, i = p.treasures.findIndex((t) => t.side === m.by && t.x === x && t.y === y);
        if (i >= 0) {
          if (p.treasures[i].kind === 'seal') mine.seals++; else mine.doubloons += p.treasures[i].value;
          p.treasures.splice(i, 1);
          mine.spotted.push({ x, y, round: p.round });
        }
      }
      if (m.wake !== undefined) mine.wakes.push({ y: m.wake, round: p.round });
      if (m.home && p.admiral === m.by && p.cargo > 0) { p.phase = 'over'; p.winner = m.by; p.reason = 'home'; }
      return true;
    }
    case 'buy': {
      const it = ITEMS[m.item];
      if (!it || mine.doubloons < it.price || mine.items.length >= MAX_ITEMS) return false;
      mine.doubloons -= it.price;
      mine.items.push(m.item);
      return true;
    }
    case 'fog':
      if (!spend(ITEMS.fog.ap, 'fog')) return false;
      mine.fogs.push({ x: m.x, y: m.y, until: p.round + 2 });
      return true;
    case 'repair':
      return spend(ITEMS.shipwright.ap, 'shipwright');
    case 'kraken':
      if (!inBoard(m.x, m.y) || mine.seals < KRAKEN_SEALS || p.kraken || !spend(3)) return false;
      mine.seals -= KRAKEN_SEALS;
      p.kraken = { side: foe, x: m.x, y: m.y, left: 2 };
      strike(p);
      return true;
    case 'power':
      if (p.mode !== 'convoy' || p.power[m.by] || !spend(1)) return false;
      p.power[m.by] = true;
      if (m.by !== p.admiral) p.pending = true; // Dead Reckoning waits for the Admiral's answer
      return true;
    case 'winds':
      if (p.windsUsed || !spend(0, 'winds')) return false;
      p.windsUsed = true;
      p.ap += 1;
      return true;
    case 'endTurn':
      p.current = foe;
      p.ap = AP_PER_TURN;
      p.windsUsed = false;
      p.noteSent = false;
      if (p.current === 0) {
        p.round++;
        // The wind veers each round.
        p.wind = Math.floor(rand(p) * 4);
        for (const s of p.sides) { s.fogs = s.fogs.filter((f) => f.until >= p.round); s.wakes = s.wakes.filter((w) => p.round - w.round <= 2); }
        if (p.mode === 'convoy' && p.round > SEASON) { p.phase = 'over'; p.winner = (1 - p.admiral!) as 0 | 1; p.reason = 'season'; return true; }
        if (p.round % 3 === 1) { spawnTreasure(p, 0); spawnTreasure(p, 1); }
        if (p.round % 4 === 2) { spawnTreasure(p, 0, 'seal'); spawnTreasure(p, 1, 'seal'); }
        if (p.storm && p.round > p.storm.until) p.storm = undefined;
        if (p.round % 4 === 0) p.storm = { row: Math.floor(rand(p) * (N - 2)), until: p.round + 1 };
        if (p.round % 5 === 0) tide(p);
        // From round 20 the maelstrom swallows the outer ring of both charts every other round.
        if (p.mode === 'classic' && p.round >= MAELSTROM_ROUND && p.round % 2 === 0 && p.ring < MAELSTROM_MAX_RING) p.ring++;
      }
      // As its victim's turn ends the Kraken strikes a second time, then lets go.
      if (p.kraken && p.kraken.side === m.by) { if (p.kraken.left > 0) strike(p); else p.kraken = undefined; }
      return true;
  }
  return false;
}

export async function commitHash(initial: Placement[], salt: string): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(initial.map((s) => [s.id, s.x, s.y, s.dir, s.rev ? 1 : 0])) + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Everything a client must keep to survive a page reload. */
export interface Snapshot { ring?: number; ships: Ship[]; initial: Placement[]; salt: string; acts: Act[]; order: Order | null; streak: number; hurt: boolean; count: number; escort: boolean; laden: number }

export class Client {
  pub: Pub;
  ships: Ship[];
  order: Order | null = null;
  log: Msg[] = [];
  /** Called after every applied message. */
  onChange: (m: Msg, ok: boolean, replay: boolean) => void = () => {};
  /** Private notices (orders lapsing or fulfilled). */
  onNote: (text: string) => void = () => {};
  private initial: Placement[] = [];
  private salt = '';
  private acts: Act[] = [];
  private inFlight = 0;
  private skip = 0;
  private streak = 0;
  private hurt = false;
  private revealed = false;
  /** Close Escort is up: the next hit on the merchantman is turned aside. */
  private escort = false;
  /** How many times the merchantman has moved this turn. */
  laden = 0;
  /** Rings of the maelstrom this client has already answered for. */
  private ringSeen = 0;

  constructor(public me: 0 | 1, seed: number, private out: (m: Msg) => void, private rnd: Rnd = Math.random, public name = 'Captain', mode: Mode = 'classic') {
    this.pub = newPub(seed, mode);
    this.ships = randomFleet(rnd, this.role);
  }

  get role(): Role { return roleOf(this.pub, this.me); }
  get merchant(): Ship | undefined { return this.ships.find((s) => s.kind === 'merchant'); }

  get foe(): 0 | 1 { return (1 - this.me) as 0 | 1; }
  get side() { return this.pub.sides[this.me]; }
  get foeSide() { return this.pub.sides[this.foe]; }
  get myTurn() { return this.pub.phase === 'battle' && this.pub.current === this.me; }
  /** True when this captain may act right now with at least `ap` points. */
  can(ap = 0) { return this.myTurn && !this.pub.pending && this.inFlight === 0 && this.pub.ap >= ap; }
  alive(kind: Kind) { return this.ships.some((s) => s.kind === kind && !s.sunk); }
  has(item: Item) { return this.side.items.includes(item); }

  snapshot(): Snapshot {
    return JSON.parse(JSON.stringify({ ships: this.ships, initial: this.initial, salt: this.salt, acts: this.acts, order: this.order, streak: this.streak, hurt: this.hurt, count: this.log.length, escort: this.escort, laden: this.laden, ring: this.ringSeen }));
  }
  /** Restore private state; the next `count` messages only rebuild the public view. */
  restore(s: Snapshot) {
    this.ships = s.ships; this.initial = s.initial; this.salt = s.salt; this.acts = s.acts; this.order = s.order;
    this.streak = s.streak; this.hurt = s.hurt; this.skip = s.count; this.escort = !!s.escort; this.laden = s.laden || 0; this.ringSeen = s.ring || 0;
  }

  private send(b: Body) { this.inFlight++; this.out({ ...b, by: this.me } as Msg); }

  receive(m: Msg) {
    const ok = reduce(this.pub, m);
    this.log.push(m);
    if (m.by === this.me && this.inFlight > 0) this.inFlight--;
    const replay = this.skip > 0;
    if (replay) this.skip--;
    else if (ok) this.react(m);
    this.onChange(m, ok, replay);
  }

  private newOrder(prev?: Order) {
    this.order = pickOrder(this.pub.round, this.rnd, this.alive('cutter'), prev?.id);
  }
  private fulfil() {
    const o = this.order!;
    this.onNote(`Orders fulfilled: ${o.text} +${o.reward} doubloons.`);
    this.send({ t: 'order', text: o.text, reward: o.reward });
    this.newOrder(o);
  }

  private dropsSent = new Set<number>();
  private react(m: Msg) {
    const p = this.pub, theirs = m.by !== this.me;
    // Place any treasure owed to my waters, clear of my ships.
    for (const d of p.due || []) {
      if (d.side !== this.me || this.dropsSent.has(d.id)) continue;
      const at = dropSquare(p, this.me, d.id, this.salt, this.ships);
      if (!at) continue;
      this.dropsSent.add(d.id);
      this.send({ t: 'drop', id: d.id, x: at[0], y: at[1] });
    }
    if (m.t === 'ready' && p.phase === 'battle') this.newOrder();
    if (m.t === 'attack' && theirs) {
      const { shielded, ...r } = resolveAttack(this.ships, m.cells, m.src === 'chain', this.escort);
      if (shielded) this.escort = false;
      if (r.results.some((c) => c.r === 'hit' || c.r === 'sunk')) { this.hurt = true; if (this.order?.id === 'unscathed') this.order.n = 0; }
      this.send({ t: 'result', ...r });
    }
    if (m.t === 'peek' && theirs) {
      const cells: XY[] = [[m.x, m.y], [m.x + 1, m.y], [m.x, m.y + 1], [m.x + 1, m.y + 1]];
      const fog = this.side.fogs.some((f) => cells.some(([a, b]) => inZone(f.x, f.y, a, b)));
      this.send({ t: 'peekResult', x: m.x, y: m.y, ships: fog ? [] : peekShips(this.ships, m.x, m.y), fog });
    }
    if (m.t === 'scan' && theirs) {
      const fogged = this.side.fogs.some((f) => inZone(f.x, f.y, m.x, m.y));
      this.send({ t: 'scanResult', x: m.x, y: m.y, count: fogged ? -1 : countScan(this.ships, m.x, m.y) });
    }
    if (m.t === 'result' && theirs && this.order) {
      for (const c of m.results || []) this.streak = c.r === 'hit' || c.r === 'sunk' ? this.streak + 1 : 0;
      const sank = (m.results || []).some((c) => c.r === 'sunk');
      if ((this.order.id === 'sink' && sank) || (this.order.id === 'streak' && this.streak >= 3)) { this.streak = 0; this.fulfil(); }
    }
    if (m.t === 'power' && theirs && this.merchant) this.send({ t: 'powerResult', col: shipCells(this.merchant)[1][0] });
    if (m.t === 'endTurn' && !theirs) { for (const s of this.ships) s.chained = false; this.laden = 0; }
    if (m.t === 'endTurn' && theirs) this.escort = false;
    // The Kraken strikes my waters: when it is summoned, and again as my turn ends.
    if (p.strike && p.kraken?.side === this.me && ((m.t === 'kraken' && theirs) || (m.t === 'endTurn' && !theirs))) {
      const { shielded, ...r } = resolveAttack(this.ships, p.strike, false, this.escort);
      if (shielded) this.escort = false;
      if (r.results.some((c) => c.r === 'hit' || c.r === 'sunk')) { this.hurt = true; if (this.order?.id === 'unscathed') this.order.n = 0; }
      this.send({ t: 'result', ...r, kraken: true });
    }
    // The maelstrom swallows another ring: report what it took from my fleet.
    if (p.ring > this.ringSeen && p.phase === 'battle') {
      this.ringSeen = p.ring;
      const r = resolveAttack(this.ships, rimCells(this.ships, p.ring), false);
      this.send({ t: 'drowned', results: r.results, lost: r.lost });
    }
    if (m.t === 'endTurn' && theirs && this.order && p.phase === 'battle') {
      if (this.order.id === 'unscathed' && !this.hurt && ++this.order.n >= 2) this.fulfil();
      else if (p.round > this.order.deadline) { this.onNote(`Orders lapsed: ${this.order.text}`); this.newOrder(this.order); }
      this.hurt = false;
    }
    if (p.phase === 'over' && !this.revealed) {
      this.revealed = true;
      this.send({ t: 'reveal', initial: this.initial, salt: this.salt, acts: this.acts, final: this.ships });
    }
  }

  /* ---------- actions ---------- */
  async ready(): Promise<boolean> {
    if (this.pub.phase !== 'placement' || this.side.ready || this.inFlight || !legalPlacement(this.ships)) return false;
    this.initial = this.ships.map(({ id, x, y, dir, rev }) => ({ id, x, y, dir, rev: !!rev }));
    this.salt = Array.from({ length: 16 }, () => Math.floor(this.rnd() * 36).toString(36)).join('');
    this.inFlight++;
    const hash = await commitHash(this.initial, this.salt);
    this.inFlight--;
    this.send({ t: 'ready', hash, name: this.name });
    return true;
  }

  attack(src: AttackSrc, x: number, y: number, dir: Dir = 'h'): boolean {
    if (!inBoard(x, y) || !this.can(COST[src]) || inStorm(this.pub, y)) return false;
    if (src === 'broadside' && !this.alive('line')) return false;
    if (src === 'chain' && !this.alive('frigate')) return false;
    if (src === 'fireship' && !this.has('fireship')) return false;
    this.send({ t: 'attack', src, cells: attackCells(src, x, y, dir).filter(([, b]) => !inStorm(this.pub, b)) });
    return true;
  }

  /** Cast a message in a bottle to the other captain (one a turn). */
  note(text: string): boolean {
    if (!this.myTurn || this.pub.phase !== 'battle' || this.pub.noteSent || !text.trim()) return false;
    this.send({ t: 'note', text: text.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) });
    return true;
  }

  /** Look through the Long Glass at the 2×2 patch of enemy water whose top-left square is (x, y). */
  peek(x: number, y: number): boolean {
    if (!peekFits(x, y) || !this.can(ITEMS.longglass.ap) || !this.has('longglass') || inStorm(this.pub, y) || inStorm(this.pub, y + 1)) return false;
    this.send({ t: 'peek', x, y });
    return true;
  }

  scan(x: number, y: number, src: 'cutter' | 'spyglass'): boolean {
    if (!zoneFits(x, y) || !this.can(1) || inStorm(this.pub, y) || (src === 'cutter' ? !this.alive('cutter') : !this.has('spyglass'))) return false;
    this.send({ t: 'scan', x, y, src });
    return true;
  }

  private treasureUnder(id: number): XY | undefined {
    const s = this.ships.find((q) => q.id === id)!;
    const t = this.pub.treasures.find((q) => q.side === this.me && shipCells(s).some(([a, b]) => a === q.x && b === q.y));
    return t ? [t.x, t.y] : undefined;
  }
  /** `from` is where the ship's middle lay before it moved. */
  private moved(id: number, kind: 'sail' | 'turn', debris: XY[], from: XY) {
    const treasure = this.treasureUnder(id), s = this.ships.find((q) => q.id === id)!;
    const extra: { treasure?: XY; wake?: number; home?: true } = {};
    if (treasure) extra.treasure = treasure;
    if (s.kind === 'merchant') {
      // Under full sail the laden merchantman cannot hide: every move after the first gives away her row.
      if (++this.laden >= 2) extra.wake = from[1];
      if (shipCells(s).some(([x]) => x === N - 1)) extra.home = true;
    }
    this.send({ t: 'move', kind, debris, ...extra });
    if (treasure && this.order?.id === 'cutter' && s.kind === 'cutter') this.fulfil();
  }
  private middle(id: number): XY { const s = this.ships.find((q) => q.id === id); return s ? shipCells(s)[Math.floor(s.len / 2)] : [0, 0]; }

  /** True while the Kraken has hold of this ship: it can neither sail nor turn. */
  held(id: number): boolean {
    const k = this.pub.kraken, s = this.ships.find((q) => q.id === id);
    return !!k && k.side === this.me && !!s && !s.sunk && shipCells(s).some(([x, y]) => inKraken(k.x, k.y, x, y));
  }
  reach(id: number, delta: 1 | -1 = 1) { return this.can(1) && !this.held(id) ? sailReach(this.ships, id, delta, this.pub.wind) : 0; }
  sail(id: number, delta: 1 | -1, steps = this.reach(id, delta)): boolean {
    if (!this.can(1) || this.held(id)) return false;
    const from = this.middle(id), debris = sailShip(this.ships, id, delta, steps, this.pub.wind);
    if (!debris) return false;
    this.acts.push({ k: 'sail', id, delta, steps });
    this.moved(id, 'sail', debris, from);
    return true;
  }

  canTurn(id: number, way: Way = 'right') { return this.can(1) && !this.held(id) && canTurnShip(this.ships, id, way); }
  turn(id: number, way: Way = 'right'): boolean {
    const from = this.middle(id);
    if (!this.can(1) || this.held(id) || !turnShip(this.ships, id, way)) return false;
    this.acts.push({ k: 'turn', id, way });
    this.moved(id, 'turn', [], from);
    return true;
  }

  /** A blood pact needs a damaged ship that is not the merchantman nor the last afloat, once a battle. */
  canPact(id?: number): boolean {
    if (!this.can(1) || this.pub.pacts?.[this.me]) return false;
    const afloat = this.ships.filter((s) => !s.sunk);
    const ok = (s: Ship) => !s.sunk && s.kind !== 'merchant' && s.hits.some(Boolean) && afloat.length > 1;
    return id === undefined ? afloat.some(ok) : afloat.some((s) => s.id === id && ok(s));
  }
  pact(id: number): boolean {
    if (!this.canPact(id)) return false;
    const s = this.ships.find((q) => q.id === id)!;
    s.sunk = true; s.chained = false;
    this.send({ t: 'pact', ship: { kind: s.kind, cls: s.cls, len: s.len, x: s.x, y: s.y, dir: s.dir, rev: !!s.rev } });
    return true;
  }

  /** Ride a sea current: the whole fleet drifts one square towards `dir`. */
  current(dir: number): boolean {
    if (!this.can(ITEMS.current.ap) || !this.has('current') || !(dir >= 0 && dir <= 3)) return false;
    driftFleet(this.ships, dir, (s) => this.held(s.id));
    this.send({ t: 'current', dir });
    return true;
  }

  canBuy(item: Item) { return this.can() && this.side.doubloons >= ITEMS[item].price && this.side.items.length < MAX_ITEMS; }
  buy(item: Item): boolean { if (!this.canBuy(item)) return false; this.send({ t: 'buy', item }); return true; }

  fog(x: number, y: number): boolean {
    if (!inBoard(x, y) || !this.can(ITEMS.fog.ap) || !this.has('fog')) return false;
    this.send({ t: 'fog', x, y });
    return true;
  }

  repair(x: number, y: number): boolean {
    if (!this.can(ITEMS.shipwright.ap) || !this.has('shipwright')) return false;
    const at = shipAt(this.ships, x, y);
    if (!at || at.ship.sunk) return false;
    const idx = at.ship.hits[at.idx] ? at.idx : at.ship.hits.indexOf(true);
    if (idx < 0 || !repairShip(this.ships, at.ship.id, idx)) return false;
    this.acts.push({ k: 'repair', id: at.ship.id, idx });
    this.send({ t: 'repair' });
    return true;
  }

  winds(): boolean {
    if (!this.can() || this.pub.windsUsed || !this.has('winds')) return false;
    this.send({ t: 'winds' });
    return true;
  }

  /** Three seals and three action points wake the Kraken under a 3×3 patch of enemy water. */
  canKraken() { return this.can(3) && this.side.seals >= KRAKEN_SEALS && !this.pub.kraken; }
  kraken(x: number, y: number): boolean {
    if (!inBoard(x, y) || !this.canKraken()) return false;
    this.send({ t: 'kraken', x, y });
    return true;
  }

  /** The captain's once-a-battle power: Close Escort for the Admiral, Dead Reckoning for the Corsair. */
  canPower() { return this.pub.mode === 'convoy' && !this.pub.power[this.me] && this.can(1); }
  power(): boolean {
    if (!this.canPower()) return false;
    if (this.role === 'admiral') this.escort = true;
    this.send({ t: 'power' });
    return true;
  }

  endTurn(): boolean { if (!this.can()) return false; this.send({ t: 'endTurn' }); return true; }
}
