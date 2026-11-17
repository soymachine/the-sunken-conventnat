// Pure, deterministic game rules. No rendering, no network.

export const N = 10;
export const AP_PER_TURN = 3;

export type Dir = 'h' | 'v';
export type Rnd = () => number;

export interface Ship {
  id: number;
  cls: string;
  len: number;
  x: number;
  y: number;
  dir: Dir;
  hits: boolean[];
  sunk: boolean;
}

/** A shot that landed on a player's waters. Stays where it fell even if the ship sails away. */
export interface Shot {
  x: number;
  y: number;
  result: 'miss' | 'hit';
  round: number;
  shipId?: number;
  sunk?: boolean;
}

export interface Debris {
  x: number;
  y: number;
  round: number;
}

export interface PlayerState {
  ships: Ship[];
  shots: Shot[];
  debris: Debris[];
}

export interface Game {
  players: [PlayerState, PlayerState];
  current: 0 | 1;
  ap: number;
  round: number;
  phase: 'placement' | 'battle' | 'over';
  winner: 0 | 1 | null;
}

export const FLEET = [
  { cls: 'Ship of the Line', len: 5 },
  { cls: 'Frigate', len: 4 },
  { cls: 'Ironclad', len: 3 },
  { cls: 'Schooner', len: 3 },
  { cls: 'Cutter', len: 2 },
];

type Placed = Pick<Ship, 'x' | 'y' | 'dir' | 'len'>;

export function shipCells(s: Placed): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < s.len; i++) out.push(s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
  return out;
}

/** True when `cand` is inside the grid and overlaps no other ship (wrecks included). */
export function fits(ships: Ship[], cand: Placed, ignoreId?: number): boolean {
  const cs = shipCells(cand);
  for (const [x, y] of cs) if (x < 0 || y < 0 || x >= N || y >= N) return false;
  for (const o of ships) {
    if (o.id === ignoreId) continue;
    for (const [ox, oy] of shipCells(o)) for (const [x, y] of cs) if (ox === x && oy === y) return false;
  }
  return true;
}

export function shipAt(p: PlayerState, x: number, y: number): { ship: Ship; idx: number } | null {
  for (const ship of p.ships) {
    const cs = shipCells(ship);
    for (let idx = 0; idx < cs.length; idx++) if (cs[idx][0] === x && cs[idx][1] === y) return { ship, idx };
  }
  return null;
}

export function randomFleet(rnd: Rnd): Ship[] {
  const ships: Ship[] = [];
  FLEET.forEach((f, id) => {
    for (;;) {
      const dir: Dir = rnd() < 0.5 ? 'h' : 'v';
      const cand = { x: Math.floor(rnd() * N), y: Math.floor(rnd() * N), dir, len: f.len };
      if (fits(ships, cand)) {
        ships.push({ id, cls: f.cls, ...cand, hits: new Array(f.len).fill(false), sunk: false });
        break;
      }
    }
  });
  return ships;
}

export function newGame(rnd: Rnd = Math.random): Game {
  const mk = (): PlayerState => ({ ships: randomFleet(rnd), shots: [], debris: [] });
  return { players: [mk(), mk()], current: 0, ap: AP_PER_TURN, round: 1, phase: 'placement', winner: null };
}

export function startBattle(g: Game): void {
  g.phase = 'battle';
  g.current = 0;
  g.ap = AP_PER_TURN;
  g.round = 1;
}

const canAct = (g: Game) => g.phase === 'battle' && g.ap > 0;

export type FireResult = 'miss' | 'hit' | 'sunk' | 'wreck';

/** Fire one shot at the opponent's waters. Returns null if the action is not allowed. */
export function fire(g: Game, x: number, y: number): { result: FireResult; ship?: Ship } | null {
  if (!canAct(g) || x < 0 || y < 0 || x >= N || y >= N) return null;
  const foe = g.players[1 - g.current];
  g.ap--;
  foe.shots = foe.shots.filter((s) => s.x !== x || s.y !== y);
  const at = shipAt(foe, x, y);
  if (!at) {
    foe.shots.push({ x, y, result: 'miss', round: g.round });
    return { result: 'miss' };
  }
  const { ship, idx } = at;
  const fresh = !ship.hits[idx] && !ship.sunk;
  ship.hits[idx] = true;
  foe.shots.push({ x, y, result: 'hit', round: g.round, shipId: ship.id, sunk: ship.sunk });
  if (!fresh) return { result: 'wreck', ship };
  if (ship.hits.every(Boolean)) {
    ship.sunk = true;
    for (const s of foe.shots) if (s.shipId === ship.id) s.sunk = true;
    if (foe.ships.every((s) => s.sunk)) {
      g.phase = 'over';
      g.winner = g.current;
    }
    return { result: 'sunk', ship };
  }
  return { result: 'hit', ship };
}

const damage = (s: Ship) => s.hits.filter(Boolean).length;

export function canSail(g: Game, shipId: number, delta: 1 | -1): boolean {
  const me = g.players[g.current];
  const s = me.ships.find((q) => q.id === shipId);
  if (!canAct(g) || !s || s.sunk) return false;
  const moved = s.dir === 'h' ? { ...s, x: s.x + delta } : { ...s, y: s.y + delta };
  return fits(me.ships, moved, s.id);
}

/** Sail a ship one cell along its axis. A damaged ship leaves debris on the cell it vacates. */
export function sail(g: Game, shipId: number, delta: 1 | -1): boolean {
  if (!canSail(g, shipId, delta)) return false;
  const me = g.players[g.current];
  const s = me.ships.find((q) => q.id === shipId)!;
  const cs = shipCells(s);
  const left = delta === 1 ? cs[0] : cs[cs.length - 1];
  if (damage(s) > 0) {
    me.debris = me.debris.filter((d) => d.x !== left[0] || d.y !== left[1]);
    me.debris.push({ x: left[0], y: left[1], round: g.round });
  }
  if (s.dir === 'h') s.x += delta;
  else s.y += delta;
  g.ap--;
  return true;
}

function turned(s: Ship): Placed {
  const k = Math.floor(s.len / 2);
  const [px, py] = shipCells(s)[k];
  return s.dir === 'h' ? { x: px, y: py - k, dir: 'v', len: s.len } : { x: px - k, y: py, dir: 'h', len: s.len };
}

export function canTurn(g: Game, shipId: number): boolean {
  const me = g.players[g.current];
  const s = me.ships.find((q) => q.id === shipId);
  if (!canAct(g) || !s || s.sunk || damage(s) >= 2) return false;
  return fits(me.ships, turned(s), s.id);
}

/** Rotate a ship 90° around its middle segment. Ships with two or more hits cannot turn. */
export function turn(g: Game, shipId: number): boolean {
  if (!canTurn(g, shipId)) return false;
  const s = g.players[g.current].ships.find((q) => q.id === shipId)!;
  const t = turned(s);
  s.x = t.x;
  s.y = t.y;
  s.dir = t.dir;
  g.ap--;
  return true;
}

export function endTurn(g: Game): void {
  if (g.phase !== 'battle') return;
  g.current = (1 - g.current) as 0 | 1;
  g.ap = AP_PER_TURN;
  if (g.current === 0) g.round++;
}

export const cellName = (x: number, y: number) => 'ABCDEFGHIJ'[x] + (y + 1);
