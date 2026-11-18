// After the battle each captain reveals their placement and hidden moves.
// Replaying them against the public log shows whether every answer was honest.
import { Act, Mode, Msg, Placement, commitHash, newPub, reduce } from './engine';
import { CellResult, FLEETS, N, Role, Ship, XY, countScan, fits, inKraken, legalPlacement, repairShip, resolveAttack, rimCells, sailShip, shipCells, turnShip } from './rules';

// Compare by value: a database may hand objects back with their keys in another order.
const sig = (rs: CellResult[]) => rs.map((r) => [r.x, r.y, r.r, r.ship ? [r.ship.kind, r.ship.x, r.ship.y, r.ship.dir] : 0, r.cargo ? 1 : 0].join()).join('|');
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
    const s: Ship = { id, kind: f.kind, cls: f.cls, len: f.len, x: pl.x, y: pl.y, dir: pl.dir, hits: new Array(f.len).fill(false), sunk: false };
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
          const debris = sailShip(ships, a.id, a.delta, a.steps);
          if (!debris || cells(debris) !== cells(m.debris || [])) return 'a ship sailed where it could not, or hid its wreckage';
        } else if (a.k !== 'turn' || !turnShip(ships, a.id)) return 'an impossible turn';
        if (moving?.kind === 'merchant') {
          if (++laden >= 2 && m.wake === undefined) return 'the merchantman ran under full sail and hid its wake';
          if (!!m.home !== shipCells(moving).some(([x]) => x === N - 1)) return 'the merchantman did not truly reach home';
        } else if (m.home) return 'a ship that is not the merchantman claimed the cargo';
      }
    }
    if (m.by === who && m.t === 'power' && role === 'admiral') shield = true;
    if (m.by !== who && m.t === 'endTurn') shield = false;
    if (m.by !== who && m.t === 'power' && role === 'admiral') { const mer = ships.find((s) => s.kind === 'merchant'); expect = 'col:' + (mer ? shipCells(mer)[1][0] : -1); }
    if (m.by === who && m.t === 'powerResult' && expect !== null) { if ('col:' + m.col !== expect) return 'the merchantman was not where Dead Reckoning was told'; expect = null; }
    if (m.by === who && m.t === 'endTurn') { for (const s of ships) s.chained = false; laden = 0; }
    if (m.by !== who && m.t === 'attack') { const r = resolveAttack(ships, m.cells, m.src === 'chain', shield); if (r.shielded) shield = false; expect = sig(r.results); }
    if (m.by !== who && m.t === 'scan') expect = 'scan:' + countScan(ships, m.x, m.y);
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
    if (p.ring > ring && p.phase === 'battle') drown = sig(resolveAttack(ships, rimCells(ships, p.ring), false).results);
  }
  return null;
}
