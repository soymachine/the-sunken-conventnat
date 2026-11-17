// After the battle each captain reveals their placement and hidden moves.
// Replaying them against the public log shows whether every answer was honest.
import { Act, Msg, Placement, commitHash } from './engine';
import { CellResult, FLEET, Ship, XY, countScan, fits, repairShip, resolveAttack, sailShip, turnShip } from './rules';

// Compare by value: a database may hand objects back with their keys in another order.
const sig = (rs: CellResult[]) => rs.map((r) => [r.x, r.y, r.r, r.ship ? [r.ship.kind, r.ship.x, r.ship.y, r.ship.dir] : 0].join()).join('|');
const cells = (cs: XY[]) => cs.map((c) => c[0] + ',' + c[1]).join('|');

/** Returns null when `who` played honestly, or a description of the first discrepancy. */
export async function verify(log: Msg[], who: 0 | 1): Promise<string | null> {
  const ready = log.find((m) => m.by === who && m.t === 'ready');
  const reveal = log.find((m) => m.by === who && m.t === 'reveal');
  if (!ready || ready.t !== 'ready' || !reveal || reveal.t !== 'reveal') return 'nothing was revealed';
  const initial: Placement[] = reveal.initial || [];
  if ((await commitHash(initial, reveal.salt)) !== ready.hash) return 'the fleet shown is not the fleet committed at the start';
  const ships: Ship[] = [];
  for (const [id, f] of FLEET.entries()) {
    const pl = initial.find((q) => q.id === id);
    if (!pl) return 'a ship is missing from the placement';
    const s: Ship = { id, kind: f.kind, cls: f.cls, len: f.len, x: pl.x, y: pl.y, dir: pl.dir, hits: new Array(f.len).fill(false), sunk: false };
    if (f.kind === 'ironclad') s.armour = true;
    if (!fits(ships, s)) return 'the placement was not legal';
    ships.push(s);
  }
  const acts: Act[] = [...(reveal.acts || [])];
  let expect: string | null = null;
  for (const m of log) {
    if (m.by === who && (m.t === 'move' || m.t === 'repair')) {
      const a = acts.shift();
      if (!a) return 'a hidden move was not disclosed';
      if (m.t === 'repair') { if (a.k !== 'repair' || !repairShip(ships, a.id, a.idx)) return 'an impossible repair'; continue; }
      if (a.k === 'sail') {
        const debris = sailShip(ships, a.id, a.delta, a.steps);
        if (!debris || cells(debris) !== cells(m.debris || [])) return 'a ship sailed where it could not, or hid its wreckage';
      } else if (a.k !== 'turn' || !turnShip(ships, a.id)) return 'an impossible turn';
    }
    if (m.by === who && m.t === 'endTurn') for (const s of ships) s.chained = false;
    if (m.by !== who && m.t === 'attack') expect = sig(resolveAttack(ships, m.cells, m.src === 'chain').results);
    if (m.by !== who && m.t === 'scan') expect = 'scan:' + countScan(ships, m.x, m.y);
    if (m.by === who && m.t === 'result' && expect !== null) {
      if (sig(m.results || []) !== expect) return 'a shot was answered falsely';
      expect = null;
    }
    if (m.by === who && m.t === 'scanResult' && expect !== null) {
      if (m.count >= 0 && 'scan:' + m.count !== expect) return 'a spyglass was answered falsely';
      expect = null;
    }
  }
  return null;
}
