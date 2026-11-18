// Computer captain. It drives an ordinary Client, so it knows only what a human
// opponent would: its own fleet and the public state.
import { Client } from './engine';
import { ITEMS, Item } from './powerups';
import { SEASON, inStorm } from './engine';
import { MAELSTROM_ROUND, N, Rnd, Ship, ZONE, inBoard, inZone, safe, shipCells, turned } from './rules';

const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function scoreGrid(c: Client, rnd: Rnd): number[][] {
  const foe = c.foeSide, round = c.pub.round;
  const score: number[][] = [];
  for (let y = 0; y < N; y++) {
    score.push([]);
    for (let x = 0; x < N; x++) score[y].push(rnd() + ((x + y) % 2 === 0 ? 0.5 : 0));
  }
  const bump = (x: number, y: number, v: number) => { if (inBoard(x, y)) score[y][x] += v; };
  const live = (x: number, y: number) => foe.shots.some((s) => s.x === x && s.y === y && s.result !== 'miss' && !s.sunk && round - s.round <= 3);
  for (const s of foe.shots) {
    const age = round - s.round;
    if (s.sunk) { bump(s.x, s.y, -100); continue; }
    if (s.result === 'clang' && age <= 1) bump(s.x, s.y, 9); // armour is gone: strike the same plate again
    else if (age <= 4) bump(s.x, s.y, s.result === 'miss' ? -10 : -6);
    if (s.result !== 'miss' && age <= 3) for (const [dx, dy] of NEIGH) {
      bump(s.x + dx, s.y + dy, 5 - age);
      if (live(s.x - dx, s.y - dy)) bump(s.x + dx, s.y + dy, 3);
    }
  }
  for (const d of foe.debris) { const age = round - d.round; if (age <= 2) for (const [dx, dy] of NEIGH) bump(d.x + dx, d.y + dy, 2.5 - age); }
  for (const s of foe.spotted) { const age = round - s.round; if (age <= 2) { bump(s.x, s.y, 6 - 2 * age); for (const [dx, dy] of NEIGH) bump(s.x + dx, s.y + dy, 3 - age); } }
  for (const sc of foe.scans) {
    const age = round - sc.round;
    if (age > 4 || sc.count < 0) continue;
    const v = sc.count === 0 ? -8 : Math.min(3.5, sc.count * 0.9) - age * 0.5;
    for (let y = sc.y - ZONE; y <= sc.y + ZONE; y++) for (let x = sc.x - ZONE; x <= sc.x + ZONE; x++) bump(x, y, v);
  }
  if (c.role === 'corsair') {
    // The prize matters more than the escorts: weigh where the merchantman must be by now.
    const lo = Math.max(0, Math.floor(round * 0.7) - 1), hi = Math.min(N - 1, Math.ceil(round * 1.5) + 3);
    for (let y = 0; y < N; y++) for (let x = lo; x <= hi; x++) bump(x, y, 0.9);
    for (const w of foe.wakes) {
      const age = round - w.round;
      if (age <= 2) for (let x = lo; x <= hi; x++) bump(x, w.y, 3.2 - age);
    }
    const rk = c.pub.reckon;
    if (rk) { const age = round - rk.round; if (age <= 2) for (let y = 0; y < N; y++) for (let x = rk.col - 1; x <= rk.col + 1 + age * 2; x++) bump(x, y, 3 - age); }
  }
  for (const s of foe.sunk) for (const [x, y] of shipCells(s)) bump(x, y, -100);
  // No gun can be laid under the storm, and nothing floats in the drowned rim.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inStorm(c.pub, y) || !safe(c.pub.ring, x, y)) score[y][x] = -1000;
  return score;
}

/** Take one step for the bot. Returns true if it did something. */
export function botAct(c: Client, rnd: Rnd = Math.random): boolean {
  const p = c.pub;
  if (p.phase === 'placement') { if (!c.side.ready) { void c.ready(); return true; } return false; }
  if (!c.can()) return false;
  if (p.ap <= 0) return c.endTurn();
  const me = c.side, foe = c.foeSide;

  if (c.has('winds') && !p.windsUsed && c.winds()) return true;

  const mer = c.merchant;
  if (c.role === 'admiral' && mer && !mer.sunk) {
    // Bring the cargo home: creep unseen while safe, run when hunted or when the season is closing.
    const cells = shipCells(mer), bow = Math.max(...cells.map(([x]) => x)), left = N - 1 - bow, turns = Math.max(1, SEASON - p.round);
    const hunted = mer.hits.some(Boolean) || me.shots.some((s) => p.round - s.round <= 1 && cells.some(([x, y]) => Math.abs(x - s.x) <= 2 && Math.abs(y - s.y) <= 2));
    if (hunted && c.canPower() && rnd() < 0.7) return c.power();
    const want = hunted ? 3 : Math.max(1, Math.ceil(left / turns));
    if (mer.dir === 'v') {
      // Mid side-step: shift a row, then point east again.
      const d = c.reach(mer.id, 1) ? 1 : c.reach(mer.id, -1) ? -1 : 0;
      if (c.laden === 1 && d) return c.sail(mer.id, d, 1);
      if (c.canTurn(mer.id)) return c.turn(mer.id);
    } else if (c.reach(mer.id, 1) > 0) {
      if (c.laden < want) return c.sail(mer.id, 1, 1);
    } else if (left > 0 && c.laden === 0 && p.ap >= 3 && c.canTurn(mer.id)) return c.turn(mer.id); // the way east is blocked
  }
  if (c.role === 'corsair' && p.round >= 3 && c.canPower() && !foe.wakes.length && p.cargo === 3 && rnd() < 0.5) return c.power();
  const wounded = c.ships.filter((s) => !s.sunk && s.hits.some(Boolean));
  if (c.has('shipwright') && p.ap >= 2 && wounded.length) { const [x, y] = shipCells(wounded[0])[wounded[0].hits.indexOf(true)]; if (c.repair(x, y)) return true; }

  const score = scoreGrid(c, rnd);
  let best = { x: 0, y: 0, v: -Infinity };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (score[y][x] > best.v) best = { x, y, v: score[y][x] };
  const lead = best.v >= 3.5;
  const clamp = (v: number) => Math.min(N - 2, Math.max(1, v));
  if (lead && c.canKraken()) return c.kraken(clamp(best.x), clamp(best.y));

  // The maelstrom is coming: bring ships in from the rim before it takes them.
  if (p.mode === 'classic' && p.round >= MAELSTROM_ROUND - 3 && p.ap >= 2) {
    const risk = (s: Pick<Ship, 'x' | 'y' | 'dir' | 'len'>) => shipCells(s).filter(([x, y]) => !safe(p.ring + 1, x, y)).length;
    for (const s of c.ships) {
      if (s.sunk || !risk(s)) continue;
      for (const d of [1, -1] as const) {
        const n = c.reach(s.id, d);
        if (n && risk(s.dir === 'h' ? { ...s, x: s.x + d * n } : { ...s, y: s.y + d * n }) < risk(s)) return c.sail(s.id, d, n);
      }
      if (c.canTurn(s.id) && risk(turned(s)) < risk(s)) return c.turn(s.id);
    }
  }

  const want: Item = lead ? 'fireship' : wounded.length && me.doubloons >= ITEMS.shipwright.price ? 'shipwright' : 'spyglass';
  if (!c.has(want) && c.canBuy(want) && c.buy(want)) return true;

  // Open the turn with seamanship: slip a wounded ship away or pick up treasure.
  if (p.ap >= 3) {
    for (const s of c.ships) {
      if (s.sunk || s.hits.some(Boolean)) continue;
      for (const d of [1, -1] as const) {
        const n = c.reach(s.id, d);
        for (let k = 1; k <= n; k++) {
          const moved = s.dir === 'h' ? { ...s, x: s.x + d * k } : { ...s, y: s.y + d * k };
          if (p.treasures.some((t) => t.side === c.me && shipCells(moved).some(([a, b]) => a === t.x && b === t.y))) return c.sail(s.id, d, k);
        }
      }
    }
    if (wounded.length && rnd() < 0.45) {
      const s = wounded[Math.floor(rnd() * wounded.length)];
      for (const d of (rnd() < 0.5 ? [1, -1] : [-1, 1]) as (1 | -1)[]) if (c.reach(s.id, d) && c.sail(s.id, d)) return true;
      if (c.canTurn(s.id) && c.turn(s.id)) return true;
    }
  }

  if (lead && p.ap >= 2) {
    if (c.has('fireship')) return c.attack('fireship', best.x, best.y);
    const liveHit = foe.shots.some((s) => s.result === 'hit' && !s.sunk && p.round - s.round <= 1 && Math.abs(s.x - best.x) + Math.abs(s.y - best.y) === 1);
    if (liveHit && c.alive('frigate') && rnd() < 0.3) return c.attack('chain', best.x, best.y);
    if (c.alive('line')) {
      const sum = (cs: number[][]) => cs.reduce((a, [x, y]) => a + (inBoard(x, y) ? score[y][x] : -5), 0);
      const h = sum([[best.x - 1, best.y], [best.x + 1, best.y]]), v = sum([[best.x, best.y - 1], [best.x, best.y + 1]]);
      if (Math.max(h, v) > 2) return c.attack('broadside', best.x, best.y, h >= v ? 'h' : 'v');
    }
  }
  if (!lead && (c.has('spyglass') || c.alive('cutter')) && rnd() < 0.6) {
    // Sweep a patch that has not been looked at lately.
    for (let tries = 0; tries < 12; tries++) {
      // A corsair sweeps the band of sea the merchantman should have reached.
      const band = c.role === 'corsair' ? Math.min(N - 1 - ZONE, Math.max(ZONE, Math.round(p.round * 1.1 + rnd() * 4 - 1))) : -1;
      const x = band >= 0 ? band : ZONE + Math.floor(rnd() * (N - 2 * ZONE)), y = ZONE + Math.floor(rnd() * (N - 2 * ZONE));
      if (inStorm(p, y) || foe.scans.some((s) => p.round - s.round <= 5 && inZone(s.x, s.y, x, y))) continue;
      return c.scan(x, y, c.has('spyglass') ? 'spyglass' : 'cutter');
    }
  }
  return c.attack('shot', best.x, best.y) || c.endTurn();
}

/** Keep a bot playing. With `delay` null it acts synchronously (tests); otherwise it paces itself. */
export function driveBot(c: Client, delay: number | null, rnd: Rnd = Math.random) {
  let timer = false;
  const kick = () => {
    if (delay === null) { botAct(c, rnd); return; }
    if (timer) return;
    timer = true;
    setTimeout(() => { timer = false; if (botAct(c, rnd)) kick(); }, delay);
  };
  c.onChange = kick;
  kick();
}
