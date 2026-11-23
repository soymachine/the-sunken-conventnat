// The first battle against the machine, guided: a parchment note points at one thing at a time — the fleet, the
// capstan, the enemy chart, the Sail card, the hourglass — and moves on when the captain has done it. Skippable at
// any step; shown once (Settings can bring it back).
import type { Client, Msg } from '../game/engine';

type Rect = { x: number; y: number; w: number; h: number };
interface Step {
  title: string;
  text: string;
  /** What the note points at, or null for a note in the middle of the table. */
  at: () => Rect | null;
  /** When the step is done; steps without one wait for "Next". */
  done?: (c: Client, since: Msg[]) => boolean;
  /** Only shown when this holds (else the note waits, hidden). */
  when?: (c: Client) => boolean;
}

const KEY = 'tsc:tutorial';
const el = (sel: string): Rect | null => {
  const e = document.querySelector<HTMLElement>(sel);
  if (!e || !e.offsetParent) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

export class Tutorial {
  private box: HTMLElement;
  private ring: HTMLElement;
  private steps: Step[];
  private i = -1;
  private mark = 0;
  private c: Client | null = null;

  constructor(private chart: (side: 'own' | 'enemy') => Rect | null, private quiet: () => boolean) {
    this.ring = document.body.appendChild(document.createElement('div'));
    this.ring.className = 'tutRing'; this.ring.hidden = true;
    this.box = document.body.appendChild(document.createElement('div'));
    this.box.className = 'tutBox card'; this.box.hidden = true;
    this.box.setAttribute('role', 'dialog');
    const mine = (c: Client, since: Msg[], t: Msg['t']) => since.some((m) => m.by === c.me && m.t === t);
    const battle = (c: Client) => c.pub.phase === 'battle' && c.myTurn;
    this.steps = [
      { title: 'Your fleet', text: 'These are your ships, hidden from the enemy. Click a ship to lift it, move it, press R to turn it, and click again to set it down. They start in a random formation: change it as you like.', at: () => this.chart('own'), when: (c) => c.pub.phase === 'placement' },
      { title: 'Ready to sail', text: 'When your fleet is placed, turn the capstan: the battle begins once both captains are ready.', at: () => el('#ready'), when: (c) => c.pub.phase === 'placement', done: (c) => c.side.ready },
      { title: 'Action points', text: 'Each turn you have three action points, the wax seals here. Every order costs some: its cost is on the seal of its card.', at: () => el('#apSeals'), when: battle },
      { title: 'Fire!', text: 'Click any square of the enemy chart to fire at it. A ring means only water; flames mean you hit a ship.', at: () => this.chart('enemy'), when: (c) => battle(c) && c.pub.ap > 0, done: (c, s) => mine(c, s, 'attack') },
      { title: 'Make sail', text: 'Ships move too. Pick the Sail card (or press S), click one of your ships, then a square ahead of her bow. Mind the wind: the compass shows where it blows.', at: () => el('#belt .ocard[data-tool="sail"]'), when: (c) => battle(c) && c.pub.ap > 0, done: (c, s) => s.some((m) => m.by === c.me && m.t === 'move') },
      { title: 'Your hand', text: 'Every card is an order: special shots, spyglasses, your commander\'s powers and what you buy. Hover over one to read it; grey ones cannot be played now.', at: () => el('#belt'), when: battle },
      { title: 'Money and the Kraken', text: 'Hits and treasure pay doubloons: spend them with the quartermaster under Money. Sinking ships brings covenant seals; three of them summon the Kraken.', at: () => el('#money'), when: battle },
      { title: 'End your turn', text: 'Turn the hourglass (or press Space) when you are done. Action points you do not use are lost.', at: () => el('#endTurn'), when: battle, done: (c, s) => mine(c, s, 'endTurn') },
      { title: 'The enemy moves', text: 'Now watch your waters. Everything that happens goes into the Log (press L). Sink the whole enemy fleet to win. Fair winds, captain!', at: () => el('#logBtn'), when: (c) => c.pub.phase === 'battle' },
    ];
    addEventListener('resize', () => this.place());
  }

  /** Whether this browser has seen the tutorial through (or skipped it). */
  static seen() { try { return localStorage.getItem(KEY) === 'done'; } catch { return true; } }
  static reset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  get active() { return this.i >= 0; }
  start(c: Client) { this.c = c; this.go(0); }
  stop(finished = true) {
    this.i = -1; this.box.hidden = this.ring.hidden = true;
    if (finished) try { localStorage.setItem(KEY, 'done'); } catch { /* ignore */ }
  }

  private go(i: number) {
    if (!this.c) return;
    if (i >= this.steps.length) { this.stop(); return; }
    this.i = i; this.mark = this.c.log.length;
    const s = this.steps[i];
    this.box.innerHTML = `<p class="tutStep">${i + 1} / ${this.steps.length}</p><h2>${s.title}</h2><p>${s.text}</p>
      <div class="tutBtns"><button type="button" class="tutSkip">Skip tutorial</button>${s.done ? '' : `<button type="button" class="plaque tutNext">${i === this.steps.length - 1 ? 'Done' : 'Next'}</button>`}</div>`;
    this.box.querySelector<HTMLElement>('.tutSkip')!.onclick = () => this.stop();
    const next = this.box.querySelector<HTMLElement>('.tutNext');
    if (next) next.onclick = () => this.go(this.i + 1);
    this.box.classList.remove('in'); void this.box.offsetWidth; this.box.classList.add('in');
    this.update(this.c);
  }

  /** Called on every redraw of the game: move on when a step is done, show or hide the note as the game allows. */
  update(c: Client) {
    this.c = c;
    if (this.i < 0) return;
    const s = this.steps[this.i];
    if (s.done?.(c, c.log.slice(this.mark))) { this.go(this.i + 1); return; }
    const show = (s.when?.(c) ?? true) && !this.quiet();
    this.box.hidden = !show;
    this.place();
  }

  /** Put the ring round the target and the note beside it, on the side with more room. */
  private place() {
    if (this.i < 0 || this.box.hidden) { this.ring.hidden = true; return; }
    const r = this.steps[this.i].at(), bw = this.box.offsetWidth, bh = this.box.offsetHeight, pad = 8;
    if (!r) { this.ring.hidden = true; Object.assign(this.box.style, { left: `${(innerWidth - bw) / 2}px`, top: `${innerHeight * 0.3}px` }); return; }
    this.ring.hidden = false;
    Object.assign(this.ring.style, { left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + 2 * pad}px`, height: `${r.h + 2 * pad}px` });
    const cx = r.x + r.w / 2, below = r.y + r.h + 18, above = r.y - bh - 18;
    let top = r.y + r.h / 2 > innerHeight / 2 ? above : below, left = cx - bw / 2;
    // A big target (a chart): the note goes beside it instead, over the middle.
    if (r.h > innerHeight * 0.4) { top = r.y + r.h / 2 - bh / 2; left = r.x + r.w / 2 > innerWidth / 2 ? r.x - bw - 24 : r.x + r.w + 24; }
    left = Math.max(12, Math.min(innerWidth - bw - 12, left)); top = Math.max(12, Math.min(innerHeight - bh - 12, top));
    Object.assign(this.box.style, { left: `${left}px`, top: `${top}px` });
  }
}
