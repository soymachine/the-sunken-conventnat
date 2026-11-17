import { describe, expect, it } from 'vitest';
import { chooseAction } from './bot';
import {
  AP_PER_TURN, FLEET, Game, N, Ship, canTurn, endTurn, fire, fits, newGame, randomFleet, sail, shipCells, startBattle, turn,
} from './rules';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const mk = (id: number, len: number, x: number, y: number, dir: 'h' | 'v'): Ship => ({
  id, cls: 'T', len, x, y, dir, hits: new Array(len).fill(false), sunk: false,
});

function fixed(): Game {
  const g = newGame(seeded(1));
  g.players[0].ships = [mk(0, 3, 0, 0, 'h'), mk(1, 2, 5, 5, 'v')];
  g.players[1].ships = [mk(0, 2, 2, 2, 'h'), mk(1, 3, 6, 6, 'h')];
  startBattle(g);
  return g;
}

describe('fleet', () => {
  it('random fleets are legal', () => {
    for (let seed = 1; seed < 40; seed++) {
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
    const ships = [mk(0, 3, 0, 0, 'h')];
    expect(fits(ships, { x: 2, y: 0, dir: 'v', len: 2 })).toBe(false);
    expect(fits(ships, { x: 8, y: 3, dir: 'h', len: 3 })).toBe(false);
    expect(fits(ships, { x: 3, y: 0, dir: 'v', len: 2 })).toBe(true);
  });
});

describe('firing', () => {
  it('reports miss, hit and sunk and spends action points', () => {
    const g = fixed();
    expect(fire(g, 0, 0)!.result).toBe('miss');
    expect(fire(g, 2, 2)!.result).toBe('hit');
    expect(fire(g, 3, 2)!.result).toBe('sunk');
    expect(g.ap).toBe(0);
    expect(fire(g, 9, 9)).toBeNull();
    expect(g.players[1].shots.filter((s) => s.sunk).length).toBe(2);
  });
  it('hitting a damaged segment again does no new damage', () => {
    const g = fixed();
    fire(g, 6, 6);
    expect(fire(g, 6, 6)!.result).toBe('wreck');
    expect(g.players[1].ships[1].hits.filter(Boolean).length).toBe(1);
  });
  it('sinking the last ship wins', () => {
    const g = fixed();
    for (const [x, y] of [[2, 2], [3, 2], [6, 6]]) fire(g, x, y);
    endTurn(g); endTurn(g);
    fire(g, 7, 6);
    expect(fire(g, 8, 6)!.result).toBe('sunk');
    expect(g.phase).toBe('over');
    expect(g.winner).toBe(0);
  });
});

describe('turn order', () => {
  it('alternates players and counts rounds', () => {
    const g = fixed();
    endTurn(g);
    expect(g.current).toBe(1);
    expect(g.ap).toBe(AP_PER_TURN);
    expect(g.round).toBe(1);
    endTurn(g);
    expect(g.current).toBe(0);
    expect(g.round).toBe(2);
  });
});

describe('sailing and turning', () => {
  it('moves along the axis and respects bounds and other ships', () => {
    const g = fixed();
    expect(sail(g, 0, -1)).toBe(false);
    expect(sail(g, 0, 1)).toBe(true);
    expect(g.players[0].ships[0].x).toBe(1);
    expect(g.ap).toBe(2);
  });
  it('damage travels with the ship and leaves debris', () => {
    const g = fixed();
    endTurn(g);
    fire(g, 0, 0); // bot hits the stern of player 0's first ship
    endTurn(g);
    expect(sail(g, 0, 1)).toBe(true);
    const p = g.players[0];
    expect(p.ships[0].hits[0]).toBe(true);
    expect(p.debris).toEqual([{ x: 0, y: 0, round: 2 }]);
    endTurn(g);
    expect(fire(g, 0, 0)!.result).toBe('miss'); // the old mark is stale
    expect(fire(g, 1, 0)!.result).toBe('wreck');
  });
  it('rotates around the middle and blocks badly damaged ships', () => {
    const g = fixed();
    g.players[0].ships[0] = mk(0, 3, 3, 3, 'h');
    expect(turn(g, 0)).toBe(true);
    expect(g.players[0].ships[0]).toMatchObject({ x: 4, y: 2, dir: 'v' });
    g.players[0].ships[0].hits = [true, true, false];
    expect(canTurn(g, 0)).toBe(false);
  });
});

describe('bot', () => {
  it('plays legal games to the end against itself', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const rnd = seeded(seed);
      const g = newGame(rnd);
      startBattle(g);
      let steps = 0;
      while (g.phase === 'battle' && steps++ < 5000) {
        const a = chooseAction(g, rnd);
        if (a.type === 'fire') expect(fire(g, a.x, a.y)).not.toBeNull();
        else if (a.type === 'sail') expect(sail(g, a.shipId, a.delta)).toBe(true);
        else if (a.type === 'turn') expect(turn(g, a.shipId)).toBe(true);
        if (g.phase === 'battle' && g.ap === 0) endTurn(g);
      }
      expect(g.phase).toBe('over');
      expect(g.round).toBeLessThan(120);
    }
  });
});
