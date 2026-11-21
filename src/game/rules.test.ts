import { describe, expect, it } from 'vitest';
import { botAct, driveBot } from './bot';
import { Client, Msg, maelstromIn } from './engine';
import { verify } from './verify';
import { FLEET, FLEETS, N, Ship, attackCells, becalmed, countScan, driftFleet, fits, flooded, randomFleet, repairShip, resolveAttack, sailMax, sailReach, sailShip, shipCells, turnShip } from './rules';
import { Bus } from '../net/session';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const mk = (id: number, kind: Ship['kind'], len: number, x: number, y: number, dir: 'h' | 'v'): Ship => ({
  id, kind, cls: [...FLEET, ...FLEETS.admiral].find((f) => f.kind === kind)!.cls, len, x, y, dir, hits: new Array(len).fill(false), sunk: false, ...(kind === 'ironclad' ? { armour: true } : {}),
});
const tick = () => new Promise((r) => setTimeout(r, 0));
/** `att` fires at every square of `def`'s fleet until the battle is over (with no maelstrom, games end only by sinking). */
function sinkAll(def: Client, att: Client) {
  const cells = def.ships.flatMap((s) => shipCells(s));
  let k = 0;
  for (let guard = 0; guard < 3000 && def.pub.phase === 'battle'; guard++) {
    if (!att.myTurn) { def.endTurn(); continue; }
    if (att.pub.ap <= 0) { att.endTurn(); continue; }
    const [x, y] = cells[k++ % cells.length];
    if (!att.attack('shot', x, y)) att.endTurn();
  }
}

/** Two clients on a bus, both ready, with fixed fleets. */
async function duel(seed = 7) {
  const bus = new Bus();
  const a = new Client(0, seed, bus.send, seeded(seed + 1), 'A'), b = new Client(1, seed, bus.send, seeded(seed + 2), 'B');
  bus.subscribe((m) => a.receive(m));
  bus.subscribe((m) => b.receive(m));
  a.ships = [mk(0, 'line', 5, 0, 0, 'h'), mk(1, 'frigate', 4, 0, 2, 'h'), mk(2, 'ironclad', 3, 0, 4, 'h'), mk(3, 'schooner', 3, 0, 6, 'h'), mk(4, 'cutter', 2, 0, 8, 'h')];
  b.ships = [mk(0, 'line', 5, 5, 5, 'h'), mk(1, 'frigate', 4, 5, 7, 'h'), mk(2, 'ironclad', 3, 5, 9, 'h'), mk(3, 'schooner', 3, 5, 11, 'h'), mk(4, 'cutter', 2, 5, 13, 'h')];
  await a.ready(); await b.ready();
  return { bus, a, b };
}

describe('fleet geometry', () => {
  it('random fleets are legal on the 16×16 chart', () => {
    expect(N).toBe(16);
    for (let seed = 1; seed < 30; seed++) {
      const ships = randomFleet(seeded(seed));
      expect(ships.length).toBe(FLEET.length);
      const seen = new Set<string>();
      for (const s of ships) for (const [x, y] of shipCells(s)) {
        expect(x >= 0 && y >= 0 && x < N && y < N).toBe(true);
        expect(seen.has(x + ',' + y)).toBe(false);
        seen.add(x + ',' + y);
      }
    }
  });
  it('fits rejects overlap and out of bounds', () => {
    const ships = [mk(0, 'cutter', 3, 0, 0, 'h')];
    expect(fits(ships, { x: 2, y: 0, dir: 'v', len: 2 })).toBe(false);
    expect(fits(ships, { x: 14, y: 3, dir: 'h', len: 3 })).toBe(false);
    expect(fits(ships, { x: 3, y: 0, dir: 'v', len: 2 })).toBe(true);
  });
  it('attack shapes are clipped to the board', () => {
    expect(attackCells('broadside', 0, 3, 'h')).toEqual([[0, 3], [1, 3]]);
    expect(attackCells('fireship', 5, 5).length).toBe(5);
    expect(attackCells('fireship', 0, 0).length).toBe(3);
  });
});

describe('resolution', () => {
  it('hits, repeats and sinks', () => {
    const ships = [mk(0, 'cutter', 2, 2, 2, 'h')];
    expect(resolveAttack(ships, [[0, 0]], false).results[0].r).toBe('miss');
    expect(resolveAttack(ships, [[2, 2]], false).results[0].r).toBe('hit');
    // A second ball in the same section holes her; a third finds only wreckage.
    expect(resolveAttack(ships, [[2, 2]], false).results[0].r).toBe('flood');
    expect(resolveAttack(ships, [[2, 2]], false).results[0].r).toBe('wreck');
    const r = resolveAttack(ships, [[3, 2]], false);
    expect(r.results[0]).toMatchObject({ r: 'sunk', ship: { len: 2, x: 2, y: 2 } });
    expect(r.lost).toBe(true);
  });
  it('ironclad armour absorbs the first hit', () => {
    const ships = [mk(0, 'ironclad', 3, 0, 0, 'h')];
    expect(resolveAttack(ships, [[0, 0]], false).results[0].r).toBe('clang');
    expect(ships[0].hits[0]).toBe(false);
    expect(resolveAttack(ships, [[0, 0]], false).results[0].r).toBe('hit');
  });
  it('chain shot pins a ship; the schooner sails two', () => {
    const ships = [mk(0, 'schooner', 3, 3, 3, 'h')];
    expect(sailReach(ships, 0, 1)).toBe(2);
    resolveAttack(ships, [[3, 3]], true);
    expect(ships[0].chained).toBe(true);
    expect(sailReach(ships, 0, 1)).toBe(0);
    expect(turnShip(ships, 0)).toBe(false);
  });
  it('a damaged ship leaves debris and cannot turn after two hits', () => {
    const ships = [mk(0, 'frigate', 4, 3, 3, 'h')];
    ships[0].hits[0] = true;
    expect(sailShip(ships, 0, 1, 1)).toEqual([[3, 3]]);
    expect(turnShip(ships, 0)).toBe(true);
    ships[0].hits[1] = true;
    expect(turnShip(ships, 0)).toBe(false);
  });
  it('the spyglass counts cells afloat in a 5×5 patch', () => {
    const ships = [mk(0, 'line', 5, 0, 0, 'h'), mk(1, 'cutter', 2, 10, 10, 'h')];
    expect(countScan(ships, 2, 2)).toBe(5);
    expect(countScan(ships, 6, 2)).toBe(1);
    expect(countScan(ships, 8, 8)).toBe(1);
  });
});

describe('headings', () => {
  it('ships sail only ahead, whichever way they face', () => {
    const east = [mk(0, 'frigate', 4, 3, 3, 'h')], west = [{ ...mk(0, 'frigate', 4, 3, 3, 'h'), rev: true }];
    expect(sailReach(east, 0, -1)).toBe(0);
    expect(sailShip(east, 0, -1, 1)).toBeNull();
    expect(sailShip(east, 0, 1, 1)).toEqual([]);
    expect(east[0].x).toBe(4);
    expect(sailShip(west, 0, 1, 1)).toEqual([]);
    expect(west[0].x).toBe(2);
    west[0].hits[3] = true; // her stern section, at the high end because she faces west
    expect(sailShip(west, 0, 1, 1)).toEqual([[5, 3]]);
  });
  it('turns to port and starboard about the middle, and four the same way come full circle', () => {
    const s = [mk(0, 'line', 5, 5, 8, 'h')];
    expect(turnShip(s, 0, 'right')).toBe(true); // east -> south
    expect(s[0]).toMatchObject({ x: 7, y: 6, dir: 'v', rev: false });
    expect(turnShip(s, 0, 'left')).toBe(true); // back to east
    expect(s[0]).toMatchObject({ x: 5, y: 8, dir: 'h', rev: false });
    expect(turnShip(s, 0, 'left')).toBe(true); // east -> north
    expect(s[0]).toMatchObject({ x: 7, y: 6, dir: 'v', rev: true });
    for (let i = 0; i < 4; i++) expect(turnShip(s, 0, 'right')).toBe(true);
    expect(s[0]).toMatchObject({ x: 7, y: 6, dir: 'v', rev: true });
  });
  it('a two-square cutter turns about her stern, so her bow always moves', () => {
    const s = [mk(0, 'cutter', 2, 5, 5, 'h')]; // stern (5,5), bow (6,5), heading east
    expect(turnShip(s, 0, 'right')).toBe(true); // bow swings south
    expect(shipCells(s[0])).toEqual([[5, 5], [5, 6]]);
    expect(s[0]).toMatchObject({ dir: 'v', rev: false });
    expect(turnShip(s, 0, 'left')).toBe(true); // and back east
    expect(shipCells(s[0])).toEqual([[5, 5], [6, 5]]);
    expect(turnShip(s, 0, 'left')).toBe(true); // bow swings north
    expect(shipCells(s[0])).toEqual([[5, 4], [5, 5]]);
    expect(s[0]).toMatchObject({ dir: 'v', rev: true });
    for (let i = 0; i < 4; i++) expect(turnShip(s, 0, 'left')).toBe(true);
    expect(shipCells(s[0])).toEqual([[5, 4], [5, 5]]);
  });
  it('a four-square frigate turns about her second section and comes full circle', () => {
    const s = [mk(0, 'frigate', 4, 5, 8, 'h')]; // sections at x 5..8, pivot (6,8)
    expect(turnShip(s, 0, 'right')).toBe(true);
    expect(shipCells(s[0])).toEqual([[6, 7], [6, 8], [6, 9], [6, 10]]);
    expect(s[0].rev).toBe(false);
    for (let i = 0; i < 3; i++) expect(turnShip(s, 0, 'right')).toBe(true);
    expect(s[0]).toMatchObject({ x: 5, y: 8, dir: 'h', rev: false });
  });
  it('damage stays on the same timbers through a turn', () => {
    const s = [mk(0, 'frigate', 4, 5, 8, 'h')];
    s[0].hits[3] = true; // the bow, at (8,8)
    turnShip(s, 0, 'right'); turnShip(s, 0, 'right'); // now heading west, bow at the low end
    expect(s[0]).toMatchObject({ dir: 'h', rev: true });
    expect(s[0].hits).toEqual([true, false, false, false]);
    expect(resolveAttack(s, [shipCells(s[0])[0]], false).results[0].r).toBe('flood');
    expect(s[0].floods).toEqual([true, false, false, false]);
  });
  it('a holed ship is slowed, two holes sink her, and the shipwright pumps her out first', () => {
    const s = [mk(0, 'schooner', 3, 2, 2, 'h')];
    expect(sailMax(s[0])).toBe(2);
    resolveAttack(s, [[2, 2]], false); resolveAttack(s, [[2, 2]], false);
    expect(flooded(s[0])).toBe(1);
    expect(sailMax(s[0])).toBe(1);
    expect(repairShip(s, 0, 0)).toBe(true);
    expect([s[0].floods![0], s[0].hits[0]]).toEqual([false, true]);
    expect(repairShip(s, 0, 0)).toBe(true);
    expect(s[0].hits[0]).toBe(false);
    resolveAttack(s, [[3, 2], [3, 2], [4, 2]], false);
    const r = resolveAttack(s, [[4, 2]], false);
    expect(r.results[0].r).toBe('sunk');
    expect(s[0].sunk).toBe(true);
    // The merchantman takes no water: her cargo is what is plundered.
    const m = [mk(1, 'merchant', 3, 0, 5, 'h')];
    resolveAttack(m, [[0, 5]], false);
    expect(resolveAttack(m, [[0, 5]], false).results[0].r).toBe('wreck');
  });
  it('the wind: a fair wind adds a square, square rigs cannot sail into it, gaff rigs and steam can', () => {
    const line = mk(0, 'line', 5, 0, 0, 'h'), schooner = mk(1, 'schooner', 3, 0, 4, 'h'), iron = mk(2, 'ironclad', 3, 0, 8, 'h');
    // All three head east (heading 0).
    expect([sailMax(line, 0), sailMax(schooner, 0), sailMax(iron, 0)]).toEqual([2, 3, 1]);
    expect([sailMax(line, 2), sailMax(schooner, 2), sailMax(iron, 2)]).toEqual([0, 1, 1]);
    expect([sailMax(line, 1), sailMax(schooner, 1), sailMax(iron, 1)]).toEqual([1, 2, 1]);
    expect(becalmed(line, 2)).toMatch(/into the wind/);
  });
  it('a sea current carries the fleet one square; the edge and other ships stop those in the way', () => {
    const a = mk(0, 'cutter', 2, 14, 0, 'h'), b = mk(1, 'cutter', 2, 12, 0, 'h'), c = mk(2, 'cutter', 2, 3, 3, 'h');
    expect(driftFleet([a, b, c], 0)).toBe(1);
    expect([a.x, b.x, c.x]).toEqual([14, 12, 4]);
    expect(driftFleet([a, b, c], 1)).toBe(3);
    expect([a.y, b.y, c.y]).toEqual([1, 1, 4]);
  });
});

describe('protocol', () => {
  it('starts with treasure, doubloons and orders once both are ready', async () => {
    const { a, b } = await duel();
    expect(a.pub.phase).toBe('battle');
    expect(a.pub.treasures.length).toBe(4);
    expect(a.pub).toEqual(b.pub);
    expect(a.order).not.toBeNull();
  });
  it('the defender resolves shots and both views agree', async () => {
    const { a, b } = await duel();
    expect(a.attack('shot', 5, 5)).toBe(true);
    expect(a.pub.sides[1].shots).toEqual([{ x: 5, y: 5, result: 'hit', round: 1 }]);
    expect(a.side.doubloons).toBe(35);
    expect(b.ships[0].hits[0]).toBe(true);
    expect(a.attack('broadside', 6, 7, 'h')).toBe(true);
    expect(a.pub.ap).toBe(0);
    expect(a.attack('shot', 0, 0)).toBe(false);
    expect(b.attack('shot', 0, 0)).toBe(false);
    expect(a.endTurn()).toBe(true);
    expect(b.myTurn).toBe(true);
    expect(a.pub).toEqual(b.pub);
  });
  it('scans, fog and purchases', async () => {
    const { a, b } = await duel();
    expect(a.scan(1, 7, 'cutter')).toBe(false); // part of the patch would fall off the chart
    expect(a.scan(7, 14, 'cutter')).toBe(false);
    expect(a.pub.ap).toBe(3);
    expect(a.scan(7, 7, 'cutter')).toBe(true);
    expect(a.foeSide.scans[0].count).toBe(12);
    a.endTurn();
    b.side.doubloons = 100; a.pub.sides[1].doubloons = 100;
    expect(b.buy('fog')).toBe(true);
    expect(b.fog(7, 7)).toBe(true);
    expect(b.buy('winds')).toBe(true);
    expect(b.winds()).toBe(true);
    expect(b.pub.ap).toBe(3);
    expect(b.winds()).toBe(false);
    b.endTurn();
    a.scan(7, 7, 'cutter');
    expect(a.foeSide.scans[1].count).toBe(-1);
  });
  it('collecting treasure pays and gives the ship away', async () => {
    const { a } = await duel();
    a.pub.treasures.push({ side: 0, x: 5, y: 0, value: 40, kind: 'gold' });
    expect(a.sail(0, 1)).toBe(true);
    expect(a.side.doubloons).toBe(70);
    expect(a.side.spotted).toEqual([{ x: 5, y: 0, round: 1 }]);
  });
  it('the shipwright repairs a section', async () => {
    const { a, b } = await duel();
    a.attack('shot', 5, 5); a.endTurn();
    b.side.doubloons = 100; a.pub.sides[1].doubloons = 100;
    b.buy('shipwright');
    expect(b.repair(5, 5)).toBe(true);
    expect(b.ships[0].hits[0]).toBe(false);
    expect(b.pub.ap).toBe(1);
  });
  it('sinking the fleet ends the battle, reveals both fleets and verifies', async () => {
    const { bus, a, b } = await duel();
    const next = () => { for (const s of b.ships) { const cs = shipCells(s); for (let i = 0; i < s.len; i++) if (!s.hits[i]) return cs[i]; } return [0, 0] as [number, number]; };
    for (let guard = 0; guard < 1200 && a.pub.phase === 'battle'; guard++) {
      // A storm over the target's row blocks the gun: then the turn simply ends.
      if (a.myTurn) { if (!(a.pub.ap > 0 && a.attack('shot', ...next()))) a.endTurn(); }
      else if (!(b.pub.ap === 3 && b.sail(3, 1, 1))) b.endTurn();
    }
    expect(a.pub.phase).toBe('over');
    expect(a.pub.winner).toBe(0);
    expect(b.pub.sides[0].revealed?.length).toBe(5);
    expect(await verify(bus.log, 0)).toBeNull();
    expect(await verify(bus.log, 1)).toBeNull();
    const forged: Msg[] = bus.log.map((m) => (m.t === 'result' && m.by === 1 && m.results[0].r === 'hit' ? { ...m, results: [{ ...m.results[0], r: 'miss' }] } : m));
    expect(await verify(forged, 1)).toMatch(/falsely/);
  });
  it('a reloaded client rebuilds its view from the log', async () => {
    const { bus, a, b } = await duel();
    a.attack('shot', 5, 5); a.sail(3, 1); a.endTurn(); b.attack('shot', 0, 0); b.endTurn();
    const snap = a.snapshot();
    const again = new Client(0, 7, bus.send, seeded(3), 'A');
    again.restore(snap);
    for (const m of bus.log) again.receive(m);
    bus.subscribe((m) => again.receive(m));
    expect(again.pub).toEqual(b.pub);
    expect(again.ships).toEqual(a.ships);
    expect(again.attack('shot', 6, 5)).toBe(true);
    expect(b.ships[0].hits[1]).toBe(true);
  });
});

/** A Convoy duel with fixed fleets; `adm` is whichever client drew the Admiral. */
async function convoy(seed = 8) {
  const bus = new Bus();
  const a = new Client(0, seed, bus.send, seeded(seed + 1), 'A', 'convoy'), b = new Client(1, seed, bus.send, seeded(seed + 2), 'B', 'convoy');
  bus.subscribe((m) => a.receive(m));
  bus.subscribe((m) => b.receive(m));
  const adm = a.role === 'admiral' ? a : b, cor = adm === a ? b : a;
  adm.ships = [mk(0, 'line', 5, 6, 0, 'h'), mk(1, 'frigate', 4, 6, 2, 'h'), mk(2, 'ironclad', 3, 6, 4, 'h'), mk(3, 'cutter', 2, 6, 6, 'h'), mk(4, 'merchant', 3, 0, 10, 'h')];
  cor.ships = [mk(0, 'frigate', 4, 5, 5, 'h'), mk(1, 'schooner', 3, 5, 7, 'h'), mk(2, 'schooner', 3, 5, 9, 'h'), mk(3, 'cutter', 2, 5, 11, 'h'), mk(4, 'cutter', 2, 5, 13, 'h')];
  await a.ready(); await b.ready();
  // Make it the given captain's turn.
  const turnOf = (c: Client) => { if (!c.myTurn) (c === adm ? cor : adm).endTurn(); };
  return { bus, a, b, adm, cor, turnOf };
}

describe('convoy', () => {
  it('draws opposite roles from the shared seed and gives each its fleet', async () => {
    const roles = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const a = new Client(0, seed, () => {}, seeded(seed), 'A', 'convoy'), b = new Client(1, seed, () => {}, seeded(seed), 'B', 'convoy');
      expect(a.pub.admiral).toBe(b.pub.admiral);
      expect(new Set([a.role, b.role])).toEqual(new Set(['admiral', 'corsair']));
      roles.add(a.role);
      const adm = a.role === 'admiral' ? a : b;
      expect(adm.merchant && shipCells(adm.merchant).every(([x]) => x < 3)).toBe(true);
      expect((adm === a ? b : a).ships.map((s) => s.kind)).toEqual(['frigate', 'schooner', 'schooner', 'cutter', 'cutter']);
    }
    expect(roles.size).toBe(2);
  });
  it('refuses a merchantman deployed away from the Colony', async () => {
    const a = new Client(0, 8, () => {}, seeded(1), 'A', 'convoy'), b = new Client(1, 8, () => {}, seeded(2), 'B', 'convoy');
    const adm = a.role === 'admiral' ? a : b;
    adm.ships = [mk(4, 'merchant', 3, 6, 10, 'h')];
    expect(await adm.ready()).toBe(false);
    adm.merchant!.x = 0;
    expect(await adm.ready()).toBe(true);
  });
  it('the first move of a turn is silent; full sail leaves a wake', async () => {
    const { adm, turnOf } = await convoy();
    turnOf(adm);
    adm.sail(4, 1);
    expect(adm.side.wakes).toEqual([]);
    adm.sail(4, 1);
    expect(adm.side.wakes).toEqual([{ y: 10, round: adm.pub.round }]);
    adm.endTurn();
    expect(adm.laden).toBe(0);
  });
  it('a hit on the merchantman plunders a crate; three sink her and the Corsair wins', async () => {
    const { bus, a, adm, cor, turnOf } = await convoy();
    turnOf(cor);
    const gold = cor.side.doubloons;
    cor.attack('shot', 0, 10);
    expect(cor.pub.cargo).toBe(2);
    expect(cor.side.doubloons).toBe(gold + 35);
    cor.attack('shot', 1, 10); cor.attack('shot', 2, 10);
    expect(a.pub).toMatchObject({ phase: 'over', winner: cor.me, reason: 'plunder', cargo: 0 });
    expect(await verify(bus.log, adm.me, 'admiral')).toBeNull();
    expect(await verify(bus.log, cor.me, 'corsair')).toBeNull();
  });
  it('the Admiral wins by reaching home with cargo aboard, and a false arrival is caught', async () => {
    const { bus, a, adm, cor, turnOf } = await convoy();
    turnOf(adm);
    for (let guard = 0; guard < 200 && a.pub.phase === 'battle'; guard++) {
      if (adm.myTurn) { if (!adm.sail(4, 1)) adm.endTurn(); } else cor.endTurn();
    }
    expect(a.pub).toMatchObject({ phase: 'over', winner: adm.me, reason: 'home' });
    expect(adm.merchant!.x).toBe(13);
    expect(await verify(bus.log, adm.me, 'admiral')).toBeNull();
    let n = 0;
    const forged: Msg[] = bus.log.map((m) => (m.t === 'move' && m.by === adm.me && ++n === 2 ? { ...m, home: true as const } : m));
    expect(await verify(forged, adm.me, 'admiral')).toMatch(/reach home/);
  });
  it('the Corsair wins when the season closes', async () => {
    const { a, adm, cor } = await convoy();
    for (let guard = 0; guard < 200 && a.pub.phase === 'battle'; guard++) (adm.myTurn ? adm : cor).endTurn();
    expect(a.pub).toMatchObject({ phase: 'over', winner: cor.me, reason: 'season', round: 13 });
  });
  it('the Admiral wins by sinking the whole corsair fleet', async () => {
    const { a, adm, cor, turnOf } = await convoy();
    turnOf(adm);
    const next = () => { for (const s of cor.ships) { const cs = shipCells(s); for (let i = 0; i < s.len; i++) if (!s.hits[i]) return cs[i]; } return [0, 0] as [number, number]; };
    for (let guard = 0; guard < 200 && a.pub.phase === 'battle'; guard++) {
      if (adm.myTurn) { if (adm.pub.ap > 0) adm.attack('shot', ...next()); else adm.endTurn(); } else cor.endTurn();
    }
    expect(a.pub).toMatchObject({ phase: 'over', winner: adm.me, reason: 'fleet' });
  });
  it('Close Escort turns one hit aside; Dead Reckoning names the column', async () => {
    const { bus, adm, cor, turnOf } = await convoy();
    turnOf(adm);
    expect(adm.power()).toBe(true);
    expect(adm.power()).toBe(false);
    adm.endTurn();
    cor.attack('shot', 0, 10);
    expect(cor.pub.cargo).toBe(3);
    expect(adm.side.shots[0].result).toBe('clang');
    cor.attack('shot', 0, 10);
    expect(cor.pub.cargo).toBe(2);
    expect(cor.power()).toBe(true);
    expect(cor.pub.reckon).toEqual({ col: 1, round: cor.pub.round });
    expect(cor.pub.ap).toBe(0);
    for (let i = 0; i < 80 && adm.pub.phase === 'battle'; i++) (adm.myTurn ? adm : cor).endTurn();
    expect(await verify(bus.log, adm.me, 'admiral')).toBeNull();
  });
  it('bots play Convoy to the end and neither role dominates', async () => {
    const wins = { admiral: 0, corsair: 0 }, why: Record<string, number> = {}, G = 60;
    let kr = 0;
    for (let seed = 1; seed <= G; seed++) {
      const bus = new Bus(), rnd = seeded(seed * 131);
      const a = new Client(0, seed, bus.send, rnd, 'A', 'convoy'), b = new Client(1, seed, bus.send, rnd, 'B', 'convoy');
      bus.subscribe((m) => a.receive(m));
      bus.subscribe((m) => b.receive(m));
      botAct(a, rnd); botAct(b, rnd);
      while (a.pub.phase === 'placement') await tick();
      driveBot(a, null, rnd); driveBot(b, null, rnd);
      expect(a.pub.phase).toBe('over');
      expect(a.pub).toEqual(b.pub);
      expect(await verify(bus.log, 0, a.role, seed, 'convoy')).toBeNull();
      expect(await verify(bus.log, 1, b.role, seed, 'convoy')).toBeNull();
      wins[a.pub.winner === a.pub.admiral ? 'admiral' : 'corsair']++;
      why[a.pub.reason!] = (why[a.pub.reason!] || 0) + 1;
      kr += bus.log.filter((m) => m.t === 'kraken').length;
    }
    console.log('convoy bot v bot:', wins, why, 'krakens:', kr);
    expect(wins.admiral / G).toBeGreaterThan(0.3);
    expect(wins.admiral / G).toBeLessThan(0.7);
  });
});

describe('the covenant', () => {
  /** Hand a captain seals on both clients' public state. */
  const seal = (cs: Client[], who: Client, n: number) => { for (const c of cs) c.pub.sides[who.me].seals = n; };

  it('losing a ship pays a seal; relics give one too', async () => {
    const { a, b } = await duel();
    a.attack('shot', 5, 13); a.attack('shot', 6, 13);
    expect(b.side.seals).toBe(1);
    expect(a.pub.sides[1].seals).toBe(1);
    for (const c of [a, b]) c.pub.treasures.push({ side: 0, x: 5, y: 0, value: 0, kind: 'seal' });
    a.sail(0, 1);
    expect(a.side.seals).toBe(1);
  });
  it('the Kraken needs three seals, strikes twice with the same cells for both, and holds ships', async () => {
    const { bus, a, b } = await duel();
    expect(a.kraken(6, 6)).toBe(false);
    seal([a, b], a, 3);
    expect(a.kraken(6, 6)).toBe(true);
    expect(a.pub.ap).toBe(0);
    expect(a.side.seals).toBe(0);
    const first = bus.log.filter((m) => m.t === 'result');
    expect(first.length).toBe(1);
    expect(first[0]).toMatchObject({ by: 1, kraken: true });
    if (first[0].t === 'result') { expect(first[0].results.length).toBe(3); for (const r of first[0].results) expect(Math.abs(r.x - 6) <= 1 && Math.abs(r.y - 6) <= 1).toBe(true); }
    expect(a.pub.kraken).toMatchObject({ side: 1, x: 6, y: 6, left: 1 });
    expect(a.pub).toEqual(b.pub);
    a.endTurn();
    // b's line (5..9,5) and frigate (5..8,7) lie in the patch: both are held; the cutter is free.
    expect(b.held(0)).toBe(true);
    expect(b.sail(0, 1)).toBe(false);
    expect(b.turn(1)).toBe(false);
    expect(b.sail(4, 1)).toBe(true);
    b.endTurn();
    expect(bus.log.filter((m) => m.t === 'result').length).toBe(2);
    expect(a.pub.kraken).toBeUndefined();
    expect(a.myTurn && a.can(1)).toBe(true);
    expect(b.sail(0, 1)).toBe(false); // not b's turn
    expect(a.pub).toEqual(b.pub);
  });
  it('a storm front blocks guns and spyglasses in its rows', async () => {
    const { a, b } = await duel();
    for (const c of [a, b]) c.pub.storm = { row: 4, until: 9 };
    expect(a.attack('shot', 5, 5)).toBe(false);
    expect(a.scan(7, 6, 'cutter')).toBe(false);
    expect(a.attack('shot', 5, 7)).toBe(true);
    expect(a.attack('broadside', 5, 7, 'v')).toBe(true); // the cell in the storm is left out
    expect(a.pub.sides[1].shots.some((s) => s.y === 6)).toBe(false);
    expect(a.pub).toEqual(b.pub);
  });
  it('storms, relics and tides arrive on schedule, identically for both', async () => {
    const { a, b } = await duel();
    const t0 = a.pub.treasures.map((t) => [t.x, t.y]);
    for (let i = 0; i < 12; i++) (a.myTurn ? a : b).endTurn();
    expect(a.pub.round).toBe(7);
    expect(a.pub.treasures.filter((t) => t.kind === 'seal').length).toBe(2);
    expect(a.pub.tide?.round).toBe(5);
    expect(a.pub.treasures.slice(0, 4).map((t) => [t.x, t.y])).not.toEqual(t0);
    expect(a.pub.storm).toBeUndefined();
    for (let i = 0; i < 2; i++) (a.myTurn ? a : b).endTurn();
    expect(a.pub.storm).toMatchObject({ until: 9 });
    expect(a.pub).toEqual(b.pub);
  });
  it('the maelstrom is announced, stops at the middle 6×6, and its toll is verified', async () => {
    const { bus, a, b } = await duel();
    expect(maelstromIn(a.pub)).toBe(19);
    for (let guard = 0; guard < 400 && a.pub.round < 19; guard++) (a.myTurn ? a : b).endTurn();
    expect(maelstromIn(a.pub)).toBe(1);
    for (let guard = 0; guard < 400 && a.pub.phase === 'battle' && a.pub.round < 23; guard++) (a.myTurn ? a : b).endTurn();
    expect(a.pub.ring).toBe(2);
    // a's line lies along the top rim and drowns whole at ring 1; the rest sit on column 0 and lose a section per ring.
    expect(a.ships[0].sunk).toBe(true);
    expect(a.ships.slice(1).map((s) => s.hits.slice(0, 2))).toEqual([[true, true], [true, true], [true, true], [true, true]]);
    expect(a.ships[4].sunk).toBe(true);
    expect(a.side.seals).toBe(2);
    expect(b.ships.every((s) => !s.hits.some(Boolean))).toBe(true);
    expect(a.pub).toEqual(b.pub);
    for (let guard = 0; guard < 400 && a.pub.phase === 'battle'; guard++) (a.myTurn ? a : b).endTurn();
    expect(a.pub).toMatchObject({ phase: 'over', winner: 1, reason: 'fleet' });
    expect(await verify(bus.log, 0, 'classic', 7)).toBeNull();
    const forged: Msg[] = bus.log.map((m) => (m.t === 'drowned' && m.by === 0 && m.results.length ? { ...m, results: m.results.slice(1) } : m));
    expect(await verify(forged, 0, 'classic', 7)).toMatch(/maelstrom/);
  });
  it('the Long Glass shows a 2×2 patch truthfully, honours fog, and a false picture is caught', async () => {
    const { bus, a, b } = await duel();
    for (const c of [a, b]) c.pub.sides[0].doubloons = 200;
    expect(a.buy('longglass')).toBe(true);
    // b's frigate lies along row 7 from column 5: the patch (6,6)-(7,7) catches it.
    expect(a.peek(6, 6)).toBe(true);
    const peeks = a.pub.sides[0].peeks!, seen = peeks[peeks.length - 1];
    expect(seen.fog).toBe(false);
    expect(seen.ships.map((s) => [s.kind, s.x, s.y, s.dir])).toEqual([['frigate', 5, 7, 'h']]);
    expect(a.pub.ap).toBe(1);
    expect(a.pub).toEqual(b.pub);
    sinkAll(b, a);
    expect(await verify(bus.log, 1, 'classic', 7)).toBeNull();
    const lied: Msg[] = bus.log.map((m) => (m.t === 'peekResult' ? { ...m, ships: [] } : m));
    expect(await verify(lied, 1, 'classic', 7)).toMatch(/Long Glass/);
    const fogged: Msg[] = bus.log.map((m) => (m.t === 'peekResult' ? { ...m, ships: [], fog: true } : m));
    expect(await verify(fogged, 1, 'classic', 7)).toMatch(/Long Glass/);
  });
  it('a message in a bottle: one a turn (or in the other\'s turn if you forgot), trimmed, and the log still verifies', async () => {
    const { bus, a, b } = await duel();
    expect(a.note('  Fair   winds, brother — ' + 'x'.repeat(100))).toBe(true);
    expect(a.note('And another')).toBe(false);
    expect(a.pub.notes![0].text.length).toBe(80);
    expect(a.pub.notes![0].text.startsWith('Fair winds, brother')).toBe(true);
    expect(b.note('Out of turn, but not yet cast')).toBe(true);
    expect(b.note('Again')).toBe(false);
    a.endTurn();
    expect(a.note('Forgot nothing: already cast this turn')).toBe(false);
    expect(b.note('Strike your colours!')).toBe(true);
    b.endTurn();
    expect(a.note('A new turn, a new bottle')).toBe(true);
    expect(a.pub).toEqual(b.pub);
    sinkAll(b, a);
    expect(await verify(bus.log, 1, 'classic', 7)).toBeNull();
  });
  it('the wind veers each round the same for both, and the ship of the line obeys it', async () => {
    const { a, b } = await duel();
    const winds = new Set<number>();
    for (let i = 0; i < 16; i++) { winds.add(a.pub.wind!); (a.myTurn ? a : b).endTurn(); }
    expect(winds.size).toBeGreaterThan(1);
    expect(a.pub).toEqual(b.pub);
  });
  it('a blood pact sinks a damaged ship for two seals, once a battle, and a false pact is caught', async () => {
    const { bus, a, b } = await duel();
    // b damages a's schooner, then a swears the pact on it.
    a.endTurn();
    b.attack('shot', 0, 6); b.endTurn();
    expect(a.canPact(3)).toBe(true);
    expect(a.canPact(0)).toBe(false);
    expect(a.pact(3)).toBe(true);
    expect(a.side.seals).toBe(2);
    expect(a.pub.sides[0].sunk.map((s) => s.kind)).toEqual(['schooner']);
    expect(a.canPact()).toBe(false);
    expect(a.pub).toEqual(b.pub);
    sinkAll(a, b);
    expect(await verify(bus.log, 0, 'classic', 7)).toBeNull();
    const forged: Msg[] = bus.log.map((m) => (m.t === 'pact' ? { ...m, ship: { ...m.ship, kind: 'line' as const, x: 0, y: 0 } } : m));
    expect(await verify(forged, 0, 'classic', 7)).toMatch(/blood pact/);
  });
  it('a sea current moves the hidden fleet and the end-of-battle check follows it', async () => {
    const { bus, a, b } = await duel();
    a.pub.sides[0].doubloons = b.pub.sides[0].doubloons = 200;
    expect(a.buy('current')).toBe(true);
    expect(a.current(1)).toBe(true);
    expect(a.ships.map((s) => s.y)).toEqual([1, 3, 5, 7, 9]);
    expect(a.pub).toEqual(b.pub);
    sinkAll(a, b);
    expect(await verify(bus.log, 0, 'classic', 7)).toBeNull();
    const forged: Msg[] = bus.log.map((m) => (m.t === 'current' ? { ...m, dir: 3 } : m));
    expect(await verify(forged, 0, 'classic', 7)).not.toBeNull();
  });
  it('the maelstrom stops after five rings, leaving the middle 6×6', async () => {
    const { a, b } = await duel();
    // Keep both fleets afloat in the middle so the game runs long enough.
    for (const c of [a, b]) for (const s of c.ships) { s.dir = 'h'; s.len = Math.min(s.len, 2); s.hits = s.hits.slice(0, s.len); }
    a.ships.forEach((s, i) => { s.x = 7; s.y = 5 + i; }); b.ships.forEach((s, i) => { s.x = 7; s.y = 5 + i; });
    for (let guard = 0; guard < 600 && a.pub.phase === 'battle' && a.pub.round < 34; guard++) (a.myTurn ? a : b).endTurn();
    expect(a.pub.ring).toBe(5);
    expect(maelstromIn(a.pub)).toBeNull();
  });
  it('treasure never surfaces under its owner\'s ships, and an unfair spot is caught', async () => {
    const { bus, a, b } = await duel();
    for (let guard = 0; guard < 60; guard++) {
      for (const c of [a, b]) for (const t of c.pub.treasures.filter((q) => q.side === c.me)) expect(c.ships.some((s) => !s.sunk && shipCells(s).some(([x, y]) => x === t.x && y === t.y))).toBe(false);
      (a.myTurn ? a : b).endTurn();
    }
    expect(a.pub.treasures.length).toBeGreaterThan(4);
    expect(a.pub).toEqual(b.pub);
    sinkAll(a, b);
    expect(await verify(bus.log, 0, 'classic', 7)).toBeNull();
    const forged: Msg[] = bus.log.map((m) => (m.t === 'drop' && m.by === 0 ? { ...m, x: (m.x + 1) % N } : m));
    expect(await verify(forged, 0, 'classic', 7)).toMatch(/treasure/);
  });
  it('a sunk ship leaves open water: others sail through her squares and shots there fall in the sea', () => {
    const line = mk(0, 'line', 5, 0, 0, 'h'), cutter = mk(1, 'cutter', 2, 5, 0, 'h');
    cutter.sunk = true; cutter.hits = [true, true];
    expect(fits([line, cutter], { x: 3, y: 0, dir: 'h', len: 5 }, 0)).toBe(true);
    expect(sailReach([line, cutter], 0)).toBe(1);
    expect(resolveAttack([line, cutter], [[6, 0]], false).results[0].r).toBe('miss');
    cutter.sunk = false;
    expect(fits([line, cutter], { x: 3, y: 0, dir: 'h', len: 5 }, 0)).toBe(false);
  });
  it('a ship that slips the Kraken\'s hold, or a false answer to its strike, is caught', async () => {
    const { bus, a, b } = await duel();
    // Earn the seals the hard way so the log can be replayed: b sinks three of a's ships.
    const shots: [number, number][] = [[0, 8], [1, 8], [0, 6], [1, 6], [2, 6], [0, 4], [0, 4], [1, 4], [2, 4]];
    a.endTurn();
    while (shots.length) { if (b.myTurn) { if (b.pub.ap > 0) b.attack('shot', ...shots.shift()!); else b.endTurn(); } else a.endTurn(); }
    if (b.myTurn) b.endTurn();
    expect(a.side.seals).toBe(3);
    expect(a.kraken(6, 6)).toBe(true);
    a.endTurn(); b.endTurn();
    sinkAll(b, a);
    expect(a.pub.phase).toBe('over');
    const honest = await verify(bus.log, 1, 'classic', 7);
    expect(honest).toBeNull();
    const lied: Msg[] = bus.log.map((m) => (m.t === 'result' && m.kraken ? { ...m, results: m.results.map((r) => ({ x: r.x, y: r.y, r: 'miss' as const })) } : m));
    const caught = await verify(lied, 1, 'classic', 7);
    expect(caught).toMatch(/Kraken/);
  });
});

describe('bot', () => {
  it('bots finish full games on the big chart in reasonable time', async () => {
    const rounds: number[] = [];
    let krakens = 0, drowned = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const bus = new Bus(), rnd = seeded(seed * 97);
      const a = new Client(0, seed, bus.send, rnd), b = new Client(1, seed, bus.send, rnd);
      bus.subscribe((m) => a.receive(m));
      bus.subscribe((m) => b.receive(m));
      botAct(a, rnd); botAct(b, rnd);
      while (a.pub.phase === 'placement') await tick();
      driveBot(a, null, rnd); driveBot(b, null, rnd);
      expect(a.pub.phase).toBe('over');
      expect(a.pub).toEqual(b.pub);
      expect(await verify(bus.log, 0, 'classic', seed)).toBeNull();
      expect(await verify(bus.log, 1, 'classic', seed)).toBeNull();
      rounds.push(a.pub.round);
      krakens += bus.log.filter((m) => m.t === 'kraken').length;
      drowned += bus.log.filter((m) => m.t === 'drowned' && m.results.length).length;
    }
    console.log('bot v bot rounds:', rounds.join(', '), '| krakens summoned:', krakens, '| maelstrom tolls:', drowned);
    expect(Math.max(...rounds)).toBeLessThan(120);
  });
});
