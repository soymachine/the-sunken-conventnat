// Pure geometry and resolution rules on a single fleet. No rendering, no network.

/** Squares along each side of a chart: 16 in the Classic battle, 10 in Blitz. Set by `useBoard` as a battle begins. */
export let N = 16;
export const AP_PER_TURN = 3;
/** Scans and fog banks cover a square of this radius around their centre (2 → 5×5). */
export const ZONE = 2;

export type Dir = 'h' | 'v';
export type Rnd = () => number;
export type Kind = 'line' | 'frigate' | 'ironclad' | 'schooner' | 'cutter' | 'merchant';
/** Which fleet a captain commands. Classic battles are symmetric; Convoy has two roles. */
export type Role = 'classic' | 'admiral' | 'corsair';
export type XY = [number, number];

export const FLEET: { kind: Kind; cls: string; len: number; trait: string }[] = [
  { kind: 'line', cls: 'Ship of the Line', len: 5, trait: 'Broadside' },
  { kind: 'frigate', cls: 'Frigate', len: 4, trait: 'Chain shot' },
  { kind: 'ironclad', cls: 'Ironclad', len: 3, trait: 'Armour' },
  { kind: 'schooner', cls: 'Schooner', len: 3, trait: 'Swift' },
  { kind: 'cutter', cls: 'Cutter', len: 2, trait: 'Spyglass' },
];
const pick = (k: Kind) => FLEET.find((f) => f.kind === k)!;
export const FLEETS: Record<Role, typeof FLEET> = {
  classic: FLEET,
  admiral: [pick('line'), pick('frigate'), pick('ironclad'), pick('cutter'), { kind: 'merchant', cls: 'Merchantman', len: 3, trait: 'Cargo' }],
  corsair: [pick('frigate'), pick('schooner'), pick('schooner'), pick('cutter'), pick('cutter')],
};
/** Blitz: a 10×10 chart and four ships (no Schooner). */
export const BLITZ_FLEET = [pick('line'), pick('frigate'), pick('ironclad'), pick('cutter')];
/** Set the chart's size and the fleet for a battle: Blitz plays on 10×10 with four ships, the rest on 16×16. */
export function useBoard(blitz: boolean) {
  N = blitz ? 10 : 16;
  MAELSTROM_ROUND = blitz ? 12 : 20;
  MAELSTROM_MAX_RING = (N - 6) / 2;
  FLEETS.classic = blitz ? BLITZ_FLEET : FLEET;
}
/** The merchantman must start within this many columns of the western edge (the Colony). */
export const START_COLS = 3;

export interface Ship {
  id: number;
  kind: Kind;
  cls: string;
  len: number;
  x: number;
  y: number;
  dir: Dir;
  /** The bow is at the low end: the ship heads west (h) or north (v) instead of east or south. */
  rev?: boolean;
  hits: boolean[];
  sunk: boolean;
  /** Ironclad only: true until the first hit is absorbed. */
  armour?: boolean;
  /** Pinned by chain shot: cannot sail or turn until its owner's next turn ends. */
  chained?: boolean;
  /** Sections holed below the waterline by a second hit: each slows her, two sink her. */
  floods?: boolean[];
}

/** What the opponent learns about a ship once it is sunk. */
export type Revealed = Pick<Ship, 'kind' | 'cls' | 'len' | 'x' | 'y' | 'dir' | 'rev'>;
type Placed = Pick<Ship, 'x' | 'y' | 'dir' | 'len'>;

export type ShotOutcome = 'miss' | 'hit' | 'sunk' | 'wreck' | 'clang' | 'flood';
export interface CellResult { x: number; y: number; r: ShotOutcome; ship?: Revealed;
  /** The shot struck the merchantman: a crate of cargo is plundered. */
  cargo?: true }

/** Seals needed to summon the Kraken, and the round the maelstrom begins (classic battles). */
export const KRAKEN_SEALS = 3;
export let MAELSTROM_ROUND = 20;
/** The maelstrom stops once the middle 6×6 of the chart is left (five rings on the 16×16 chart, two on Blitz's 10×10). */
export let MAELSTROM_MAX_RING = 5;
/** The Kraken holds a 3×3 patch around its centre. */
export const inKraken = (cx: number, cy: number, x: number, y: number) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
/** True while a cell is still inside the chart after `ring` outer rings have gone under. */
export const safe = (ring: number, x: number, y: number) => Math.min(x, y, N - 1 - x, N - 1 - y) >= ring;
/** Cells of ships afloat that lie in the drowned rim and are not yet hit. */
export function rimCells(ships: Ship[], ring: number): XY[] {
  const out: XY[] = [];
  for (const s of ships) if (!s.sunk) shipCells(s).forEach(([x, y], i) => { if (!s.hits[i] && !safe(ring, x, y)) out.push([x, y]); });
  return out;
}
export const inBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;
export const inZone = (cx: number, cy: number, x: number, y: number) => Math.abs(x - cx) <= ZONE && Math.abs(y - cy) <= ZONE;
/** Nearest legal centre for a spyglass, so that its whole 5×5 patch lies on the chart. */
export const clampZone = (v: number) => Math.min(N - 1 - ZONE, Math.max(ZONE, v));
export const zoneFits = (x: number, y: number) => clampZone(x) === x && clampZone(y) === y;
export const cellName = (x: number, y: number) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x] + (y + 1);

export function shipCells(s: Placed): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < s.len; i++) out.push(s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
  return out;
}

/** True when `cand` is inside the grid and overlaps no other ship afloat (a sunk ship leaves open water). */
export function fits(ships: Placed[] & { id?: number }[], cand: Placed, ignoreId?: number): boolean {
  const cs = shipCells(cand);
  for (const [x, y] of cs) if (!inBoard(x, y)) return false;
  for (const o of ships as (Placed & { id?: number })[]) {
    if (o.id === ignoreId || (o as { sunk?: boolean }).sunk) continue;
    for (const [ox, oy] of shipCells(o)) for (const [x, y] of cs) if (ox === x && oy === y) return false;
  }
  return true;
}

/** The ships afloat with a section in the 2×2 patch whose top-left square is (x, y), as the Long Glass shows them. */
export function peekShips(ships: Ship[], x: number, y: number): Revealed[] {
  return ships.filter((s) => !s.sunk && shipCells(s).some(([a, b]) => a >= x && a <= x + 1 && b >= y && b <= y + 1))
    .map((s) => ({ kind: s.kind, cls: s.cls, len: s.len, x: s.x, y: s.y, dir: s.dir, rev: !!s.rev }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
/** A 2×2 patch fits on the chart when its top-left square is at most N − 2 across and down. */
export const peekFits = (x: number, y: number) => x >= 0 && y >= 0 && x <= N - 2 && y <= N - 2;

export function shipAt(ships: Ship[], x: number, y: number): { ship: Ship; idx: number } | null {
  // A sunk ship is gone from the chart: only ships afloat can be found, or struck, at a square.
  for (const ship of ships) {
    if (ship.sunk) continue;
    const cs = shipCells(ship);
    for (let idx = 0; idx < cs.length; idx++) if (cs[idx][0] === x && cs[idx][1] === y) return { ship, idx };
  }
  return null;
}

/** True when the merchantman (if the fleet has one) lies wholly inside the Colony's waters. */
export function legalPlacement(ships: Ship[]): boolean {
  return ships.every((s) => s.kind !== 'merchant' || shipCells(s).every(([x]) => x < START_COLS));
}

export function randomFleet(rnd: Rnd, role: Role = 'classic'): Ship[] {
  const ships: Ship[] = [];
  FLEETS[role].forEach((f, id) => {
    for (;;) {
      const dir: Dir = f.kind === 'merchant' ? 'h' : rnd() < 0.5 ? 'h' : 'v';
      const cand = { x: f.kind === 'merchant' ? 0 : Math.floor(rnd() * N), y: Math.floor(rnd() * N), dir, len: f.len };
      if (fits(ships, cand)) {
        const s: Ship = { id, kind: f.kind, cls: f.cls, ...cand, rev: f.kind !== 'merchant' && rnd() < 0.5, hits: new Array(f.len).fill(false), sunk: false };
        if (f.kind === 'ironclad') s.armour = true;
        ships.push(s);
        break;
      }
    }
  });
  return ships;
}

const damage = (s: Ship) => s.hits.filter(Boolean).length;
/** Sections taking water. */
export const flooded = (s: Ship) => (s.floods || []).filter(Boolean).length;

/** Where the wind blows towards, as a heading (0 east, 1 south, 2 west, 3 north). */
export const WIND_NAMES = ['east', 'south', 'west', 'north'] as const;
/** Square-rigged ships cannot sail into the wind; fore-and-aft rigs (the merchant brig among them) can, and the
 *  ironclad has steam. The merchant's cargo is what is plundered, so she takes no water. */
const RIG: Record<Kind, 'square' | 'gaff' | 'steam'> = { line: 'square', frigate: 'square', merchant: 'gaff', schooner: 'gaff', cutter: 'gaff', ironclad: 'steam' };

/** How far a ship may sail ahead this turn, before anything blocks her: wind and flooding count. */
export function sailMax(s: Ship, wind?: number, fair = true): number {
  let n = s.kind === 'schooner' ? 2 : 1;
  if (wind !== undefined && wind >= 0 && RIG[s.kind] !== 'steam') {
    const h = headingOf(s);
    if (h === wind) n += fair ? 1 : 0;
    else if ((h + 2) % 4 === wind) n = RIG[s.kind] === 'gaff' ? Math.max(1, n - 1) : 0;
  }
  if (flooded(s) > 0) n -= 1;
  return Math.max(0, n);
}

/** Why a ship cannot sail ahead at all, if wind or water is the reason. */
export function becalmed(s: Ship, wind?: number): string | null {
  if (wind !== undefined && wind >= 0 && RIG[s.kind] === 'square' && (headingOf(s) + 2) % 4 === wind) return 'she cannot sail into the wind — turn her across it';
  if (flooded(s) > 0 && sailMax(s, wind) === 0) return 'she is holed and taking water';
  return null;
}

/** A sea current carries the whole fleet one square in a heading. Ships that would hit the edge, another
 *  ship, or that are held (by the Kraken or chain shot) stay put. The front ships move first. */
export function driftFleet(ships: Ship[], dir: number, held: (s: Ship) => boolean = () => false): number {
  const [fx, fy] = HEAD[dir];
  const order = ships.filter((s) => !s.sunk).sort((a, b) => (b.x * fx + b.y * fy) - (a.x * fx + a.y * fy));
  let n = 0;
  for (const s of order) {
    if (s.chained || held(s)) continue;
    const cand = { ...s, x: s.x + fx, y: s.y + fy };
    if (fits(ships, cand, s.id)) { s.x += fx; s.y += fy; n++; }
  }
  return n;
}

/**
 * Resolve shots landing on a fleet. Mutates the ships. `shield` blocks the first hit on the merchantman.
 * `sea`: the maelstrom takes the sections, whatever armour or escort they have.
 */
export function resolveAttack(ships: Ship[], cells: XY[], chain: boolean, shield = false, sea = false): { results: CellResult[]; chained: boolean; lost: boolean; shielded: boolean } {
  const results: CellResult[] = [];
  let chained = false, shielded = false;
  for (const [x, y] of cells) {
    const at = shipAt(ships, x, y);
    if (!at) { results.push({ x, y, r: 'miss' }); continue; }
    const { ship, idx } = at;
    if (ship.sunk || ship.floods?.[idx]) { results.push({ x, y, r: 'wreck' }); continue; }
    if (ship.hits[idx] && ship.kind === 'merchant') { results.push({ x, y, r: 'wreck' }); continue; }
    if (ship.hits[idx]) {
      // A second ball into a damaged section holes her below the waterline. Two such holes and she goes down.
      if (chain) { ship.chained = true; chained = true; }
      (ship.floods ??= new Array(ship.len).fill(false))[idx] = true;
      if (flooded(ship) >= 2) {
        ship.sunk = true; ship.chained = false;
        const { kind, cls, len, dir } = ship;
        results.push({ x, y, r: 'sunk', ship: { kind, cls, len, x: ship.x, y: ship.y, dir, rev: !!ship.rev } });
      } else results.push({ x, y, r: 'flood' });
      continue;
    }
    if (ship.kind === 'merchant' && shield && !shielded && !sea) { shielded = true; results.push({ x, y, r: 'clang' }); continue; }
    if (chain) { ship.chained = true; chained = true; }
    if (ship.armour && !sea) { ship.armour = false; results.push({ x, y, r: 'clang' }); continue; }
    ship.hits[idx] = true;
    const cargo = ship.kind === 'merchant' ? { cargo: true as const } : {};
    if (ship.hits.every(Boolean)) {
      ship.sunk = true;
      ship.chained = false;
      const { kind, cls, len, dir } = ship;
      results.push({ x, y, r: 'sunk', ship: { kind, cls, len, x: ship.x, y: ship.y, dir, rev: !!ship.rev }, ...cargo });
    } else results.push({ x, y, r: 'hit', ...cargo });
  }
  return { results, chained, lost: ships.every((s) => s.sunk), shielded };
}

/** Number of cells holding a ship still afloat inside the zone centred on (x, y). */
export function countScan(ships: Ship[], x: number, y: number): number {
  let n = 0;
  for (const s of ships) if (!s.sunk) for (const [cx, cy] of shipCells(s)) if (inZone(x, y, cx, cy)) n++;
  return n;
}

/** How many cells a ship may sail in one action in that direction (0 when blocked). */
/** Unit steps for the four headings, clockwise on the chart: east, south, west, north. */
const HEAD: XY[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export type Way = 'left' | 'right';
/** 0 east, 1 south, 2 west, 3 north. */
export const headingOf = (s: Pick<Ship, 'dir' | 'rev'>) => (s.dir === 'h' ? (s.rev ? 2 : 0) : s.rev ? 3 : 1);
/** The cell under the ship's bow. */
export const bowCell = (s: Placed & Pick<Ship, 'rev'>): XY => { const cs = shipCells(s); return s.rev ? cs[0] : cs[cs.length - 1]; };

/** Where a ship would lie after sailing `k` cells ahead. */
export const ahead = <T extends Placed & Pick<Ship, 'rev'>>(s: T, k: number): T => { const [fx, fy] = HEAD[headingOf(s)]; return { ...s, x: s.x + fx * k, y: s.y + fy * k }; };

/** How many cells a ship may sail ahead in one action (0 when blocked). Ships cannot back up. */
export function sailReach(ships: Ship[], id: number, delta: 1 | -1 = 1, wind?: number, fair = true): number {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || s.chained || delta !== 1) return 0;
  const max = sailMax(s, wind, fair), [fx, fy] = HEAD[headingOf(s)];
  let n = 0;
  for (let k = 1; k <= max; k++) {
    if (!fits(ships, { ...s, x: s.x + fx * k, y: s.y + fy * k }, s.id)) break;
    n = k;
  }
  return n;
}

/** Sail a ship ahead. Returns the debris a damaged ship leaves behind, or null if illegal. */
export function sailShip(ships: Ship[], id: number, delta: 1 | -1, steps: number, wind?: number, fair = true): XY[] | null {
  if (steps < 1 || steps > sailReach(ships, id, delta, wind, fair)) return null;
  const s = ships.find((q) => q.id === id)!, [fx, fy] = HEAD[headingOf(s)];
  const debris: XY[] = [];
  for (let k = 0; k < steps; k++) {
    const cs = shipCells(s);
    if (damage(s) > 0) debris.push(s.rev ? cs[cs.length - 1] : cs[0]); // the cell the stern leaves
    s.x += fx; s.y += fy;
  }
  return debris;
}

/**
 * The section a ship turns about, counted from the stern. It sits at or just aft of the middle, so the bow
 * always swings to a new square — even on a two-square cutter, which turns about her stern.
 */
const pivotOf = (len: number) => Math.floor((len - 1) / 2);
/** The square that stays put when the ship turns. */
export const pivotCell = (s: Placed & Pick<Ship, 'rev'>): XY => { const mid = pivotOf(s.len); return shipCells(s)[s.rev ? s.len - 1 - mid : mid]; };

/** Where a ship would lie after a quarter turn to port (left) or starboard (right) about its pivot. */
export function turned(s: Ship, way: Way = 'right'): Placed & { rev: boolean } {
  const h = (headingOf(s) + (way === 'right' ? 1 : 3)) % 4, mid = pivotOf(s.len);
  const [px, py] = pivotCell(s), [fx, fy] = HEAD[h];
  // Sections are counted from the stern; the middle one stays where it is.
  const stern: XY = [px - mid * fx, py - mid * fy], bow: XY = [px + (s.len - 1 - mid) * fx, py + (s.len - 1 - mid) * fy];
  return { x: Math.min(stern[0], bow[0]), y: Math.min(stern[1], bow[1]), dir: h % 2 === 0 ? 'h' : 'v', len: s.len, rev: h >= 2 };
}

export function canTurnShip(ships: Ship[], id: number, way: Way = 'right'): boolean {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || s.chained || damage(s) >= 2) return false;
  return fits(ships, turned(s, way), s.id);
}

/** Rotate a ship 90° around its middle section. Ships with two or more hits cannot turn. */
export function turnShip(ships: Ship[], id: number, way: Way = 'right'): boolean {
  if (!canTurnShip(ships, id, way)) return false;
  const s = ships.find((q) => q.id === id)!, t = turned(s, way);
  // Damage stays on the same timbers: flip the record when bow and stern swap ends.
  if (!!s.rev !== t.rev) { s.hits.reverse(); s.floods?.reverse(); }
  Object.assign(s, t);
  return true;
}

export function repairShip(ships: Ship[], id: number, idx: number): boolean {
  const s = ships.find((q) => q.id === id);
  if (!s || s.sunk || !s.hits[idx] || s.kind === 'merchant') return false; // plundered cargo is gone for good
  // A holed section is first pumped out and patched below the waterline; a second repair mends the rest.
  if (s.floods?.[idx]) s.floods[idx] = false; else s.hits[idx] = false;
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
