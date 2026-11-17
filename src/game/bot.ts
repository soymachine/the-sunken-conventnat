// Computer opponent. Uses only what a real opponent could know:
// its own shots on the foe's waters, visible debris and revealed wrecks.
import { Game, N, Rnd, canSail, canTurn, AP_PER_TURN } from './rules';

export type Action =
  | { type: 'fire'; x: number; y: number }
  | { type: 'sail'; shipId: number; delta: 1 | -1 }
  | { type: 'turn'; shipId: number }
  | { type: 'end' };

const NEIGH = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function chooseAction(g: Game, rnd: Rnd = Math.random): Action {
  if (g.phase !== 'battle' || g.ap <= 0) return { type: 'end' };
  const me = g.players[g.current];
  const foe = g.players[1 - g.current];

  // Open the turn by slipping a wounded ship away, some of the time.
  if (g.ap === AP_PER_TURN) {
    const wounded = me.ships.filter((s) => !s.sunk && s.hits.some(Boolean));
    const pool = wounded.length && rnd() < 0.45 ? wounded : rnd() < 0.08 ? me.ships.filter((s) => !s.sunk) : [];
    if (pool.length) {
      const s = pool[Math.floor(rnd() * pool.length)];
      const deltas: (1 | -1)[] = rnd() < 0.5 ? [1, -1] : [-1, 1];
      for (const d of deltas) if (canSail(g, s.id, d)) return { type: 'sail', shipId: s.id, delta: d };
      if (canTurn(g, s.id)) return { type: 'turn', shipId: s.id };
    }
  }

  const score: number[][] = [];
  for (let y = 0; y < N; y++) {
    score.push([]);
    for (let x = 0; x < N; x++) score[y].push(rnd() + ((x + y) % 2 === 0 ? 0.5 : 0));
  }
  const bump = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < N && y < N) score[y][x] += v;
  };
  const liveHit = (x: number, y: number) =>
    foe.shots.some((s) => s.x === x && s.y === y && s.result === 'hit' && !s.sunk && g.round - s.round <= 3);

  for (const s of foe.shots) {
    const age = g.round - s.round;
    if (s.sunk) bump(s.x, s.y, -100);
    else if (age <= 4) bump(s.x, s.y, s.result === 'miss' ? -10 : -6);
    if (s.result === 'hit' && !s.sunk && age <= 3) {
      for (const [dx, dy] of NEIGH) {
        bump(s.x + dx, s.y + dy, 5 - age);
        // Two hits in a row: favour the cell that extends the line.
        if (liveHit(s.x - dx, s.y - dy)) bump(s.x + dx, s.y + dy, 3);
      }
    }
  }
  for (const d of foe.debris) {
    const age = g.round - d.round;
    if (age <= 2) for (const [dx, dy] of NEIGH) bump(d.x + dx, d.y + dy, 2.5 - age);
  }
  for (const s of foe.ships) {
    if (!s.sunk) continue;
    for (let i = 0; i < s.len; i++) bump(s.dir === 'h' ? s.x + i : s.x, s.dir === 'h' ? s.y : s.y + i, -100);
  }

  let best = { x: 0, y: 0, v: -Infinity };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (score[y][x] > best.v) best = { x, y, v: score[y][x] };
  return { type: 'fire', x: best.x, y: best.y };
}
