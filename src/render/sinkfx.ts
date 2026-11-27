// How a lost ship goes: the great blast and the sinking, tuned per class. The game reads these numbers; the
// explosion bench in the admin page changes them live, keeps them in this browser, and can download them as
// public/fx/sinking.json to publish them for everyone.
import type { Kind } from '../game/rules';

export interface SinkKind { dur: number; roll: number; pitch: number; depth: number; steam?: boolean }
/** Seconds to go under; list (roll) and bow up (+) or stern up (−), in radians; how deep before she is gone. */
export const SINK_KIND: Record<Kind, SinkKind> = {
  line: { dur: 4.4, roll: 0.62, pitch: -0.32, depth: 1.4 },
  frigate: { dur: 3.8, roll: 0.55, pitch: 0.28, depth: 1.3 },
  ironclad: { dur: 2.6, roll: 0.14, pitch: 0.55, depth: 1.2, steam: true },
  schooner: { dur: 3.2, roll: 1.45, pitch: 0.1, depth: 1.1 },
  cutter: { dur: 2.8, roll: 1.55, pitch: -0.06, depth: 1 },
  merchant: { dur: 4, roll: 0.5, pitch: -0.24, depth: 1.3 },
};

/** The blast, the same for every class (its size also grows with the ship's length). */
export const BLAST = {
  /** Seconds after the ball lands before the magazine goes up. */
  delay: 0,
  /** Seconds after the ball lands before she starts going down. */
  sinkDelay: 0.15,
  /** Size of the fireball, smoke and the ring on the water. */
  scale: 1,
  /** Camera shake. */
  shake: 1,
  /** The moment everything holds its breath, in seconds. */
  hitStop: 0.11,
  /** The warm flash over the picture (0 to 1.5). */
  flash: 1,
  /** How much wreckage is thrown (0 to 2). */
  chunks: 1,
  /** How long the smoke hangs over the place, in seconds. */
  smoke: 7,
};

const KEY = 'tsc:sinkfx';
type Saved = { kinds?: Partial<Record<Kind, Partial<SinkKind>>>; blast?: Partial<typeof BLAST> };

function apply(s: Saved | null | undefined) {
  if (!s) return;
  for (const [k, v] of Object.entries(s.kinds ?? {})) if (SINK_KIND[k as Kind]) Object.assign(SINK_KIND[k as Kind], v);
  if (s.blast) Object.assign(BLAST, s.blast);
}
/** The defaults as shipped, to reset to. */
export const DEFAULTS: Saved = JSON.parse(JSON.stringify({ kinds: SINK_KIND, blast: BLAST }));

/** The numbers now, as the file the game publishes (public/fx/sinking.json). */
export const snapshot = (): Saved => JSON.parse(JSON.stringify({ kinds: SINK_KIND, blast: BLAST }));

/** Keep this browser's tuning (the game on this browser plays it at once). */
export function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch { /* storage unavailable */ } }
export function clearLocal() { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } apply(DEFAULTS); }

/** Published numbers first, then this browser's own tuning over them. */
export async function loadSinkFx() {
  try { const r = await fetch('/fx/sinking.json', { cache: 'no-cache' }); if (r.ok && (r.headers.get('content-type') || '').includes('json')) apply(await r.json()); } catch { /* none published */ }
  try { apply(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { /* none kept */ }
}
