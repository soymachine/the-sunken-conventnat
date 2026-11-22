// After the battle each captain reveals their placement and hidden moves.
// Replaying them against the public log shows whether every answer was honest.
import { Act, Mode, Msg, Placement, commitHash, dropSquare, newPub, reduce } from './engine';
import { CellResult, FLEETS, N, Revealed, driftFleet, headingOf, safe, Role, Ship, XY, countScan, inZone, peekShips, fits, inKraken, legalPlacement, repairShip, resolveAttack, rimCells, sailShip, shipCells, turnShip } from './rules';

// Compare by value: a database may hand objects back with their keys in another order.
const sig = (rs: CellResult[]) => rs.map((r) => [r.x, r.y, r.r, r.ship ? [r.ship.kind, r.ship.x, r.ship.y, r.ship.dir] : 0, r.cargo ? 1 : 0].join()).join('|');
const peekSig = (rs: Revealed[]) => [...rs].sort((a, b) => a.kind.localeCompare(b.kind)).map((r) => [r.kind, r.len, r.x, r.y, r.dir, r.rev ? 1 : 0].join()).join('|');
const cells = (cs: XY[]) => cs.map((c) => c[0] + ',' + c[1]).join('|');

/**
 * Returns null when `who` played honestly, or a description of the first discrepancy.
 * `seed` and `mode` are the room's, so the public state (Kraken strikes, maelstrom) can be replayed.
 */
export async function verify(log: Msg[], who: 0 | 1, role: Role = 'classic', seed = 1, mode: Mode = 'classic'): Promise<string | null> {
  const ready = log.find((m) => m.by === who && m.t === 'ready');
  const reveal = log.find((m) => m.by === who && m.t === 'reveal');
  if (!ready || ready.t !== 'ready' || !reveal || reveal.t !== 'reveal') return 'nothing was revealed';
  const initial: Placement[] = reveal.initial || [];
  if ((await commitHash(initial, reveal.salt)) !== ready.hash) return 'the fleet shown is not the fleet committed at the start';
  const ships: Ship[] = [];
  for (const [id, f] of FLEETS[role].entries()) {
    const pl = initial.find((q) => q.id === id);
    if (!pl) return 'a ship is missing from the placement';
    const s: Ship = { id, kind: f.kind, cls: f.cls, len: f.len, x: pl.x, y: pl.y, dir: pl.dir, rev: !!pl.rev, hits: new Array(f.len).fill(false), sunk: false };
    if (f.kind === 'ironclad') s.armour = true;
    if (!fits(ships, s)) return 'the placement was not legal';
    ships.push(s);
  }
  if (!legalPlacement(ships)) return 'the merchantman did not start at the Colony';
  const acts: Act[] = [...(reveal.acts || [])];
  const p = newPub(seed, mode);
  let expect: string | null = null, drown: string | null = null, laden = 0, shield = false;
  for (const m of log) {
    if (m.by === who && (m.t === 'move' || m.t === 'repair')) {
      const a = acts.shift();
      if (!a) return 'a hidden move was not disclosed';
      if (m.t === 'repair') { if (a.k !== 'repair' || !repairShip(ships, a.id, a.idx)) return 'an impossible repair'; }
      else {
        const moving = ships.find((s) => s.id === a.id), k = p.kraken;
        if (k && k.side === who && moving && shipCells(moving).some(([x, y]) => inKraken(k.x, k.y, x, y))) return 'a ship held by the Kraken moved';
        if (a.k === 'sail') {
          // The Stormcaller's ships are never caught in irons: a head wind counts as a calm for them.
          const w = p.wind, head = moving && w !== undefined && w >= 0 && (headingOf(moving) + 2) % 4 === w;
          const debris = sailShip(ships, a.id, a.delta, a.steps, p.sides[who].cmd === 'stormcaller' && head ? -1 : w);
          if (!debris || cells(debris) !== cells(m.debris || [])) return 'a ship sailed where it could not, or hid its wreckage';
        } else if (a.k !== 'turn' || !turnShip(ships, a.id, a.way)) return 'an impossible turn';
        if (moving?.kind === 'merchant') {
          if (++laden >= 2 && m.wake === undefined) return 'the merchantman ran under full sail and hid its wake';
          if (!!m.home !== shipCells(moving).some(([x]) => x === N - 1)) return 'the merchantman did not truly reach home';
        } else if (m.home) return 'a ship that is not the merchantman claimed the cargo';
      }
    }
    if (m.by === who && m.t === 'drop') {
      const at = dropSquare(p, who, m.id, reveal.salt, ships);
      if (!at || at[0] !== m.x || at[1] !== m.y) return 'treasure was set down on a square chosen unfairly';
    }
    if (m.by === who && m.t === 'pact') {
      const s = ships.find((q) => !q.sunk && q.kind === m.ship.kind && q.x === m.ship.x && q.y === m.ship.y && q.dir === m.ship.dir);
      if (!s || !s.hits.some(Boolean) || s.kind === 'merchant') return 'a blood pact was sworn on a ship that was not there, or not damaged';
      s.sunk = true; s.chained = false;
    }
    if (m.by === who && m.t === 'current') {
      const k = p.kraken;
      driftFleet(ships, m.dir, (s) => !!k && k.side === who && shipCells(s).some(([x, y]) => inKraken(k.x, k.y, x, y)));
    }
    if (m.by === who && m.t === 'power' && role === 'admiral') shield = true;
    if (m.by !== who && m.t === 'endTurn') shield = false;
    if (m.by !== who && m.t === 'power' && role === 'admiral') { const mer = ships.find((s) => s.kind === 'merchant'); expect = 'col:' + (mer ? shipCells(mer)[1][0] : -1); }
    if (m.by === who && m.t === 'powerResult' && expect !== null) { if ('col:' + m.col !== expect) return 'the merchantman was not where Dead Reckoning was told'; expect = null; }
    if (m.by === who && m.t === 'endTurn') { for (const s of ships) s.chained = false; laden = 0; }
    if (m.by !== who && m.t === 'attack' && m.src === 'double') {
      const first = resolveAttack(ships, m.cells.slice(0, 1), false);
      const hit = first.results.some((c) => c.r === 'hit' || c.r === 'sunk' || c.r === 'flood');
      expect = sig([...first.results, ...(hit && m.cells[1] ? resolveAttack(ships, m.cells.slice(1, 2), false).results : [])]);
    } else if (m.by !== who && m.t === 'attack') { const r = resolveAttack(ships, m.cells, m.src === 'chain', shield); if (r.shielded) shield = false; expect = sig(r.results); }
    if (m.by !== who && m.t === 'sound') expect = 'sound:' + (ships.some((s) => !s.sunk && shipCells(s).some(([x, y]) => (m.axis === 'row' ? y : x) === m.i)) ? 1 : 0);
    if (m.by === who && m.t === 'soundResult' && expect !== null) { if ('sound:' + m.count !== expect) return 'a sounding was answered falsely'; expect = null; }
    if (m.by !== who && m.t === 'scan') expect = 'scan:' + countScan(ships, m.x, m.y);
    if (m.by !== who && m.t === 'peek') expect = 'peek:' + peekSig(peekShips(ships, m.x, m.y));
    if (m.by === who && m.t === 'peekResult' && expect !== null) {
      // Fog may hide the patch only if a fog bank really covered it.
      const sq: XY[] = [[m.x, m.y], [m.x + 1, m.y], [m.x, m.y + 1], [m.x + 1, m.y + 1]];
      const fogged = p.sides[who].fogs.some((f) => sq.some(([a, b]) => inZone(f.x, f.y, a, b))) || !!p.sides[who].veil;
      if (m.fog ? !fogged : 'peek:' + peekSig(m.ships || []) !== expect) return 'the Long Glass was shown a false picture';
      expect = null;
    }
    if (m.by === who && m.t === 'result' && expect !== null) {
      if (sig(m.results || []) !== expect) return m.kraken ? 'the Kraken\'s strike was answered falsely' : 'a shot was answered falsely';
      expect = null;
    }
    if (m.by === who && m.t === 'scanResult' && expect !== null) {
      if (m.count >= 0 && 'scan:' + m.count !== expect) return 'a spyglass was answered falsely';
      expect = null;
    }
    if (m.by === who && m.t === 'drowned') {
      if (drown === null || sig(m.results || []) !== drown) return 'the maelstrom\'s toll was reported falsely';
      drown = null;
    }
    // Follow the public state to know where the Kraken strikes and when the maelstrom grows.
    const ring = p.ring;
    reduce(p, m);
    if (p.strike && p.kraken?.side === who && ((m.t === 'kraken' && m.by !== who) || (m.t === 'endTurn' && m.by === who))) {
      const r = resolveAttack(ships, p.strike, false, shield);
      if (r.shielded) shield = false;
      expect = sig(r.results);
    }
    // A squall drives this captain's fleet: the same drift, and the same crashes, as their client made.
    if (m.by !== who && m.t === 'squall' && p.pending) {
      const [fx, fy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][m.dir], k = p.kraken;
      const held = (s: Ship) => !!k && k.side === who && !s.sunk && shipCells(s).some(([x, y]) => inKraken(k.x, k.y, x, y));
      const before = new Map(ships.map((s) => [s.id, `${s.x},${s.y}`]));
      driftFleet(ships, m.dir, (s) => held(s) || shipCells({ ...s, x: s.x + fx, y: s.y + fy }).some(([x, y]) => !safe(p.ring, x, y)));
      const crashed: XY[] = [];
      for (const s of ships) if (!s.sunk && !held(s) && before.get(s.id) === `${s.x},${s.y}`) crashed.push(shipCells(s).reduce((a, c) => (c[0] * fx + c[1] * fy > a[0] * fx + a[1] * fy ? c : a)));
      expect = sig(resolveAttack(ships, crashed, false).results);
    }
    if (p.phase === 'battle' && (p.ring > ring || (m.t === 'endTurn' && m.by === who && p.ring > 0))) {
      const rim = rimCells(ships, p.ring);
      if (p.ring > ring || rim.length) drown = sig(resolveAttack(ships, rim, false, false, true).results);
    }
  }
  return null;
}
