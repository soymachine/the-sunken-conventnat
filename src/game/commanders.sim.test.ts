// Balance runs for the commanders (docs/commanders.md): the machine plays itself with every pairing.
// Skipped in the normal test run; run with:  SIM=1 GAMES=200 npx vitest run src/game/commanders.sim.test.ts
import { describe, it } from 'vitest';
import { driveBot, botAct } from './bot';
import { CMDS, Client, Cmd } from './engine';
import { Bus } from '../net/session';

// Node's globals, without pulling Node's types into the browser build.
declare const process: { env: Record<string, string | undefined> };

const seeded = (seed: number) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const tick = () => new Promise((r) => setTimeout(r, 0));
type Pick = Cmd | null;

async function game(seed: number, c0: Pick, c1: Pick) {
  const bus = new Bus(), rnd = seeded(seed * 7919 + 13);
  const a = new Client(0, seed, bus.send, rnd), b = new Client(1, seed, bus.send, rnd);
  a.cmd = c0 ?? undefined; b.cmd = c1 ?? undefined;
  bus.subscribe((m) => a.receive(m)); bus.subscribe((m) => b.receive(m));
  botAct(a, rnd); botAct(b, rnd);
  while (a.pub.phase === 'placement') await tick();
  driveBot(a, null, rnd); driveBot(b, null, rnd);
  const used = (t: string, by: 0 | 1) => bus.log.filter((m) => m.by === by && (m.t === t || (t === 'double' && m.t === 'attack' && m.src === 'double'))).length;
  const powers = (by: 0 | 1, c: Pick) => c === 'tidewarden' ? used('bind', by) : c === 'stormcaller' ? used('squall', by) + used('gale', by) : c === 'spymaster' ? used('sound', by) : c === 'gunmaster' ? used('double', by) : c === 'deepspeaker' ? used('kraken', by) : 0;
  return { winner: a.pub.phase === 'over' ? a.pub.winner : null, rounds: a.pub.round, reason: a.pub.reason, p0: powers(0, c0), p1: powers(1, c1), krakens: [used('kraken', 0), used('kraken', 1)] };
}

describe.skipIf(!process.env.SIM)('commander balance', () => {
  it('every pairing, both seats', async () => {
    const G = Number(process.env.GAMES || 100), picks: Pick[] = [null, ...CMDS];
    const rows: string[] = [], table: Record<string, { w: number; g: number; rounds: number; uses: number; stalls: number }> = {};
    const add = (k: string, won: boolean, rounds: number, uses: number, stall: boolean) => {
      const t = (table[k] ??= { w: 0, g: 0, rounds: 0, uses: 0, stalls: 0 });
      t.g++; t.w += won ? 1 : 0; t.rounds += rounds; t.uses += uses; t.stalls += stall ? 1 : 0;
    };
    let seed = 1;
    const t0 = Date.now();
    const only = (process.env.ONLY || '').split(',').filter(Boolean);
    for (let i = 0; i < picks.length; i++) for (let j = i; j < picks.length; j++) {
      const A = picks[i], B = picks[j];
      if (only.length && !only.includes(A ?? 'none') && !only.includes(B ?? 'none')) continue;
      let aw = 0, bw = 0, stalls = 0, rounds = 0;
      for (let g = 0; g < G; g++) {
        // Half the games each way round, so neither commander always moves first.
        const swap = g % 2 === 1, r = await game(seed++, swap ? B : A, swap ? A : B);
        const aSeat = swap ? 1 : 0;
        if (r.winner === null) stalls++;
        else if (r.winner === aSeat) aw++; else bw++;
        rounds += r.rounds;
        const nameA = A ?? 'none', nameB = B ?? 'none';
        if (A !== B) {
          add(`${nameA} vs ${nameB}`, r.winner === aSeat, r.rounds, aSeat === 0 ? r.p0 : r.p1, r.winner === null);
          add(`${nameB} vs ${nameA}`, r.winner === 1 - aSeat, r.rounds, aSeat === 0 ? r.p1 : r.p0, r.winner === null);
        }
      }
      rows.push(`${(A ?? 'none').padEnd(12)} vs ${(B ?? 'none').padEnd(12)} ${String(aw).padStart(4)} – ${String(bw).padEnd(4)} (${((100 * aw) / Math.max(1, aw + bw)).toFixed(0)}%)  stalls ${stalls}  avg rounds ${(rounds / G).toFixed(1)}`);
      console.log(rows[rows.length - 1]);
    }
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const fs = 'node:fs', { writeFileSync } = (await import(/* @vite-ignore */ fs)) as { writeFileSync: (f: string, d: string) => void };
    writeFileSync(process.env.OUT || 'sim-commanders.json', JSON.stringify({ games: G, rows, table }, null, 1));
  }, 3_600_000);
});
