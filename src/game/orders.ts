// Admiralty Orders: one secret side-mission per captain.
import { Rnd } from './rules';

export type OrderId = 'sink' | 'streak' | 'cutter' | 'unscathed';
export interface Order { id: OrderId; text: string; reward: number; deadline: number; n: number }

const BOOK: Record<OrderId, { text: string; reward: number; rounds: number }> = {
  sink: { text: 'Sink an enemy ship.', reward: 60, rounds: 5 },
  streak: { text: 'Land three hits in a row.', reward: 40, rounds: 6 },
  cutter: { text: 'Collect a treasure with your Cutter.', reward: 40, rounds: 6 },
  unscathed: { text: 'Take no damage for two enemy turns running.', reward: 30, rounds: 6 },
};

export function pickOrder(round: number, rnd: Rnd, hasCutter: boolean, prev?: OrderId): Order {
  const ids = (Object.keys(BOOK) as OrderId[]).filter((id) => id !== prev && (id !== 'cutter' || hasCutter));
  const id = ids[Math.floor(rnd() * ids.length)];
  const b = BOOK[id];
  return { id, text: b.text, reward: b.reward, deadline: round + b.rounds, n: 0 };
}
