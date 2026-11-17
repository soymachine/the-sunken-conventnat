import { describe, expect, it } from 'vitest';
import { botAct, driveBot } from './bot';
import { Client, Msg } from './engine';
import { verify } from './verify';
import { FLEET, N, Ship, attackCells, countScan, fits, randomFleet, resolveAttack, sailReach, sailShip, shipCells, turnShip } from './rules';
import { Bus } from '../net/session';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const mk = (id: number, kind: Ship['kind'], len: number, x: number, y: number, dir: 'h' | 'v'): Ship => ({
  id, kind, cls: FLEET.find((f) => f.kind === kind)!.cls, len, x, y, dir, hits: new Array(len).fill(false), sunk: false, ...(kind === 'ironclad' ? { armour: true } : {}),
});
const tick = () => new Promise((r) => setTimeout(r, 0));

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
    a.pub.treasures.push({ side: 0, x: 5, y: 0, value: 40 });
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
    for (let guard = 0; guard < 400 && a.pub.phase === 'battle'; guard++) {
      if (a.myTurn) { if (a.pub.ap > 0) a.attack('shot', ...next()); else a.endTurn(); }
      else if (b.pub.ap === 3) b.sail(3, 1, 1); else b.endTurn();
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

describe('bot', () => {
  it('bots finish full games on the big chart in reasonable time', async () => {
    const rounds: number[] = [];
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
      expect(await verify(bus.log, 0)).toBeNull();
      expect(await verify(bus.log, 1)).toBeNull();
      rounds.push(a.pub.round);
    }
    console.log('bot v bot rounds:', rounds.join(', '));
    expect(Math.max(...rounds)).toBeLessThan(120);
  });
});
