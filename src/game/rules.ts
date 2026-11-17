// Pure geometry and resolution rules on a single fleet. No rendering, no network.

export const N = 16;
export const AP_PER_TURN = 3;
/** Scans and fog banks cover a square of this radius around their centre (2 → 5×5). */
export const ZONE = 2;

export type Dir = 'h' | 'v';
export type Rnd = () => number;
export type Kind = 'line' | 'frigate' | 'ironclad' | 'schooner' | 'cutter';
export type XY = [number, number];

export const FLEET: { kind: Kind; cls: string; len: number; trait: string }[] = [
  { kind: 'line', cls: 'Ship of the Line', len: 5, trait: 'Broadside' },
  { kind: 'frigate', cls: 'Frigate', len: 4, trait: 'Chain shot' },
  { kind: 'ironclad', cls: 'Ironclad', len: 3, trait: 'Armour' },
  { kind: 'schooner', cls: 'Schooner', len: 3, trait: 'Swift' },
  { kind: 'cutter', cls: 'Cutter', len: 2, trait: 'Spyglass' },
];

export interface Ship {
  id: number;
  kind: Kind;
  cls: string;
  len: number;
  x: number;
  y: number;
  dir: Dir;
  hits: boolean[];
  sunk: boolean;
  /** Ironclad only: true until the first hit is absorbed. */
  armour?: boolean;
  /** Pinned by chain shot: cannot sail or turn until its owner's next turn ends. */
  chained?: boolean;
}

/** What the opponent learns about a ship once it is sunk. */
export type Revealed = Pick<Ship, 'kind' | 'cls' | 'len' | 'x' | 'y' | 'dir'>;
type Placed = Pick<Ship, 'x' | 'y' | 'dir' | 'len'>;

export type ShotOutcome = 'miss' | 'hit' | 'sunk' | 'wreck' | 'clang';
export interface CellResult { x: number; y: number; r: ShotOutcome; ship?: Revealed }

export const inBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;
export const inZone = (cx: number, cy: number, x: number, y: number) => Math.abs(x - cx) <= ZONE && Math.abs(y - cy) <= ZONE;
export const cellName = (x: number, y: number) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x] + (y + 1);

export function shipCells(s: Placed): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < s.len; i++) out.push(s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
  return out;
}

/** True when `cand` is inside the grid and overlaps no other ship (wrecks included). */
export function fits(ships: Placed[] & { id?: number }[], cand: Placed, ignoreId?: number): boolean {
  const cs = shipCells(cand);
  for (const [x, y] of cs) if (!inBoard(x, y)) return false;
  for (const o of ships as (Placed & { id?: number })[]) {
    if (o.id === ignoreId) continue;
    for (const [ox, oy] of shipCells(o)) for (const [x, y] of cs) if (ox === x && oy === y) return false;
  }
  return true;
}

export function shipAt(ships: Ship[], x: number, y: number): { ship: Ship; idx: number } | null {
  for (const ship of ships) {
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
        const s: Ship = { id, kind: f.kind, cls: f.cls, ...cand, hits: new Array(f.len).fill(false), sunk: false };
        if (f.kind === 'ironclad') s.armour = true;
        ships.push(s);
        break;
      }
    }
  });
  return ships;
}

const damage = (s: Ship) => s.hits.filter(Boolean).length;

/** Resolve shots landing on a fleet. Mutates the ships. */
export function resolveAttack(ships: Ship[], cells: XY[], chain: boolean): { results: CellResult[]; chained: boolean; lost: boolean } {
  const results: CellResult[] = [];
  let chained = false;
  for (const [x, y] of cells) {
    const at = shipAt(ships, x, y);
    if (!at) { results.push({ x, y, r: 'miss' }); continue; }
    const { ship, idx } = at;
    if (ship.sunk || ship.hits[idx]) { results.push({ x, y, r: 'wreck' }); continue; }
    if (chain) { ship.chained = true; chained = true; }
    if (ship.armour) { ship.armour = false; results.push({ x, y, r: 'clang' }); continue; }
    ship.hits[idx] = true;
    if (ship.hits.every(Boolean)) {
      ship.sunk = true;
      ship.chained = false;
      const { kind, cls, len, dir } = ship;
      results.push({ x, y, r: 'sunk', ship: { kind, cls, len, x: ship.x, y: ship.y, dir } });
    } else results.push({ x, y, r: 'hit' });
  }
  return { results, chained, lost: ships.every((s) => s.sunk) };
}

/** Number of cells holding a ship still afloat inside the zone centred on (x, y). */
export function countScan(ships: Ship[], x: number, y: number): number {
  let n = 0;
  for (const s of ships) if (!s.sunk) for (const [cx, cy] of shipCells(s)) if (inZone(x, y, cx, cy)) n++;
  return n;
}

/** How many cells a ship may sail in one action in that direction (0 when blocked). */
export function sailReach(ships: Ship[], id: number, delta: 1 | -1): number {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || s.chained) return 0;
  const max = s.kind === 'schooner' ? 2 : 1;
  let n = 0;
  for (let k = 1; k <= max; k++) {
    const moved = s.dir === 'h' ? { ...s, x: s.x + delta * k } : { ...s, y: s.y + delta * k };
    if (!fits(ships, moved, s.id)) break;
    n = k;
  }
  return n;
}

/** Sail a ship along its axis. Returns the debris a damaged ship leaves behind, or null if illegal. */
export function sailShip(ships: Ship[], id: number, delta: 1 | -1, steps: number): XY[] | null {
  if (steps < 1 || steps > sailReach(ships, id, delta)) return null;
  const s = ships.find((q) => q.id === id)!;
  const debris: XY[] = [];
  for (let k = 0; k < steps; k++) {
    const cs = shipCells(s);
    if (damage(s) > 0) debris.push(delta === 1 ? cs[0] : cs[cs.length - 1]);
    if (s.dir === 'h') s.x += delta;
    else s.y += delta;
  }
  return debris;
}

function turned(s: Ship): Placed {
  const k = Math.floor(s.len / 2);
  const [px, py] = shipCells(s)[k];
  return s.dir === 'h' ? { x: px, y: py - k, dir: 'v', len: s.len } : { x: px - k, y: py, dir: 'h', len: s.len };
}

export function canTurnShip(ships: Ship[], id: number): boolean {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || s.chained || damage(s) >= 2) return false;
  return fits(ships, turned(s), s.id);
}

/** Rotate a ship 90° around its middle segment. Ships with two or more hits cannot turn. */
export function turnShip(ships: Ship[], id: number): boolean {
  if (!canTurnShip(ships, id)) return false;
  const s = ships.find((q) => q.id === id)!;
  Object.assign(s, turned(s));
  return true;
}

export function repairShip(ships: Ship[], id: number, idx: number): boolean {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || !s.hits[idx]) return false;
  s.hits[idx] = false;
  return true;
}

/** Cells struck by each kind of attack, clipped to the board. */
export function attackCells(src: 'shot' | 'chain' | 'broadside' | 'fireship', x: number, y: number, dir: Dir = 'h'): XY[] {
  let cs: XY[];
  if (src === 'broadside') cs = dir === 'h' ? [[x - 1, y], [x, y], [x + 1, y]] : [[x, y - 1], [x, y], [x, y + 1]];
  else if (src === 'fireship') cs = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  else cs = [[x, y]];
  return cs.filter(([a, b]) => inBoard(a, b));
}
