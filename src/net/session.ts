// A session carries messages between the two captains in a single agreed order.
import { driveBot } from '../game/bot';
import { Client, Mode, Msg } from '../game/engine';
import { Rnd } from '../game/rules';

export interface Session {
  me: 0 | 1;
  seed: number;
  mode: Mode;
  /** Room code for network games; undefined against the computer. */
  code?: string;
  send(m: Msg): void;
  /** Start delivering messages (including any history) to `cb`. */
  listen(cb: (m: Msg) => void, onPresence?: (online: boolean) => void): void;
  close(): void;
}

/** In-memory ordered log. Each `send` reaches every listener in the same order. */
export class Bus {
  private queue: Msg[] = [];
  private draining = false;
  private subs: ((m: Msg) => void)[] = [];
  log: Msg[] = [];
  subscribe(cb: (m: Msg) => void) { this.subs.push(cb); }
  send = (m: Msg) => {
    this.queue.push(JSON.parse(JSON.stringify(m)));
    if (this.draining) return;
    this.draining = true;
    while (this.queue.length) { const q = this.queue.shift()!; this.log.push(q); for (const s of this.subs) s(JSON.parse(JSON.stringify(q))); }
    this.draining = false;
  };
}

/** Play against the computer: the bot is simply the other client on a local bus. */
export class LocalSession implements Session {
  me = 0 as const;
  seed = Math.floor(Math.random() * 2 ** 31);
  bus = new Bus();
  bot: Client;
  private closed = false;
  constructor(public mode: Mode = 'classic', private botDelay: number | null = 700, rnd: Rnd = Math.random) {
    this.bot = new Client(1, this.seed, (m) => !this.closed && this.bus.send(m), rnd, 'The machine', mode);
    this.bus.subscribe((m) => !this.closed && this.bot.receive(m));
    driveBot(this.bot, this.botDelay, rnd);
  }
  send(m: Msg) { if (!this.closed) this.bus.send(m); }
  listen(cb: (m: Msg) => void) { this.bus.subscribe((m) => !this.closed && cb(m)); }
  close() { this.closed = true; }
}
