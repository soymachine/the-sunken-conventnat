// Oak-and-brass HUD drawn with DOM + SVG over the 3D canvas.
import { Client, SEASON, roleOf } from '../game/engine';
import { ITEMS, ITEM_HELP, ITEM_IDS, Item, MAX_ITEMS } from '../game/powerups';
import { FLEETS, KRAKEN_SEALS, N, Role, shipCells } from '../game/rules';

export type Tool = 'broadside' | 'chain' | 'spy' | Item;
export type Mode = 'fire' | 'sail' | 'turn' | 'power' | 'kraken' | Tool;

/** The two invented captains of the Convoy mode. */
export const CAPTAINS: Record<Exclude<Role, 'classic'>, { name: string; title: string; mission: string; power: string; powerText: string }> = {
  admiral: { name: 'Vice-Admiral Edmund Harrowgate', title: 'The Admiral', mission: 'Bring the merchantman from the Colony, on the western edge of your chart, to the Home Port on the eastern edge with at least one crate aboard — or sink every corsair.', power: 'Close Escort', powerText: 'Once: until your next turn, the first hit on the merchantman is turned aside.' },
  corsair: { name: 'Captain Mara Vane, “the Black Tide”', title: 'The Corsair', mission: 'Plunder all three crates from the merchantman before she reaches the Home Port, or keep her at sea until the season closes.', power: 'Dead Reckoning', powerText: 'Once: learn the column the merchantman is in.' },
};
const SECTORS = ['fire', 'sail', 'turn', 'ability'] as const;
const NS = 'http://www.w3.org/2000/svg';
/* Measured on public/ui/console.webp (729 x 521): dial centre and face radii, the four cups
   (the last is Trade Winds' extra point), and the needle picture with its pivot cap. */
const TG = {
  w: 729, h: 521, view: '0 0 729 521', cx: 361, cy: 462, rx: 280, ry: 296, ri: 52,
  cups: [[151, 94], [292, 39], [442, 39], [581, 95]] as [number, number][], ball: 26,
  needle: { w: 55, h: 300, capX: 27.3, capY: 272.3, scale: 0.7 },
};

export const TOOLS: Record<'broadside' | 'chain' | 'spy', { name: string; ap: number }> = {
  broadside: { name: 'Broadside', ap: 2 },
  chain: { name: 'Chain shot', ap: 2 },
  spy: { name: 'Cutter’s glass', ap: 1 },
};

/** What each special action above the helm does, told in full for its tooltip. */
const TOOL_HELP: Record<string, { ship?: string; text: string }> = {
  broadside: { ship: 'Ship of the Line', text: 'Fire three squares in a row at once. Press R to swing the line between across and down.' },
  chain: { ship: 'Frigate', text: 'A single shot of chained balls: a ship it hits is pinned and cannot sail or turn on her next turn.' },
  spy: { ship: 'Cutter', text: 'Train the cutter\'s glass on a 5×5 patch of enemy water: you learn how many ship sections lie inside it.' },
  kraken: { text: 'Break three covenant seals and wake the Kraken under a 3×3 patch of enemy water. It strikes now and again on their next turn, and the ships it finds cannot move meanwhile.' },
};

function svg<K extends keyof SVGElementTagNameMap>(p: Element, tag: K, a: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (text != null) e.textContent = text;
  p.appendChild(e);
  return e;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface HudHandlers {
  mode(m: Mode): void;
  mute(): boolean;
  quality(q: 'auto' | 'high' | 'low'): void;
  note(text: string): void;
  letterRead(): void;
  buy(item: Item): void;
  endTurn(): void;
  shuffle(): void;
  rotate(): void;
  ready(): void;
  leave(): void;
}

export class Hud {
  private root: HTMLElement;
  private lever!: SVGGElement;
  private sectors: [SVGPathElement, SVGTextElement][] = [];
  private balls: SVGGElement[] = [];
  private capTurns = 0;
  private muted = false;
  private qualityPref = 'auto';
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(private on: HudHandlers) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <header class="rail top">
        <div class="turn"><button id="menuBtn" class="mini" aria-expanded="false" aria-controls="menu">Settings</button></div>
        <h1 class="title"><span>The Sunken Covenant</span></h1>
        <div class="foe"><span id="foeNote"></span></div>
        <div class="status" role="status"><b id="turnTitle"></b><span id="turnSub"></span><p id="placeHint"></p></div>
      </header>
      <div class="menu card" id="menu" hidden>
        <h2>Settings</h2>
        <p class="opt">Sound</p>
        <div class="seg" data-pref="sound" role="radiogroup" aria-label="Sound"><button data-v="on" role="radio">On</button><button data-v="off" role="radio">Off</button></div>
        <p class="opt">3D quality</p>
        <div class="seg" data-pref="quality" role="radiogroup" aria-label="3D quality"><button data-v="auto" role="radio">Auto</button><button data-v="high" role="radio">High</button><button data-v="low" role="radio">Low</button></div>
        <p class="meta">Auto steps down by itself if the game runs slowly. Low drops shadows, glow and the print grade.</p>
      </div>
      <div class="shopTip" id="shopTip" role="tooltip" hidden></div>
      <form class="compose card" id="compose" hidden>
        <h2>A message in a bottle</h2>
        <label for="noteText" class="meta">One a turn, for the other captain's eyes. It costs nothing.</label>
        <textarea id="noteText" maxlength="80" rows="2" placeholder="Fair winds, and a fair fight…"></textarea>
        <div class="row"><span class="count" id="noteCount">0 / 80</span><button type="button" class="plaque dark" id="noteCancel">Keep it</button><button type="submit" class="plaque" id="noteSend">Seal &amp; cast</button></div>
      </form>
      <div class="letter" id="letter" hidden role="dialog" aria-labelledby="letterHead">
        <div class="card"><p class="meta" id="letterHead">A bottle washes up on your waters</p><p class="ink" id="letterText"></p><p class="sign" id="letterSign"></p><button class="plaque" id="letterOk">Fold it away</button></div>
      </div>
      <div class="herald" id="herald" aria-hidden="true"><div><b></b><span></span></div></div>
      <div class="objective" id="objective" hidden></div>
      <aside class="card left">
        <h2>The covenant</h2><div class="seals" id="seals"></div><p class="howto" id="sealHow"></p>
        <h2>Admiralty orders</h2><p id="orderText"></p><p id="orderMeta" class="meta"></p>
        <h2>Quartermaster <span id="gold" title="Doubloons"></span></h2><ul id="shop"></ul>
        <h2>Your fleet</h2><ul id="fleet"></ul>
      </aside>
      <aside class="card right"><h2>Enemy fleet</h2><p id="foeName"></p><p class="meta" id="foeSeals"></p><ul id="foeFleet"></ul></aside>
      <p class="toast" id="toast" role="status"></p>
      <div class="belt" id="belt"></div>
      <footer class="rail bottom">
        <div class="battle">
          <div class="say"><p id="hint"></p><button class="bottleBtn" id="noteBtn" aria-expanded="false" aria-controls="compose"><svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 5h20l6-3h7v12h-7l-6-3H2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="35" y="4" width="3" height="8" rx="1" fill="currentColor"/><path d="M6 8h12" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/></svg>Cast a bottle</button></div>
          <div class="helm">
            <svg class="telegraph" viewBox="${TG.view}" role="group" aria-label="Orders and action points"></svg>
          </div>
          <button class="capstan" id="endTurn" aria-label="End turn"><img src="/ui/wheel.webp" alt="" draggable="false"><span>End turn</span></button>
        </div>
        <div class="placing">
          <button class="capstan" id="ready" aria-label="Ready"><img src="/ui/wheel.webp" alt="" draggable="false"><span>Ready</span></button>
        </div>
      </footer>
      <div class="role" hidden><div class="card"><svg class="medal" viewBox="0 0 100 100"></svg><p class="meta" id="roleTitle"></p><h2 id="roleName"></h2><p id="roleMission"></p><p class="pw"><b id="rolePower"></b> <span id="rolePowerText"></span></p><button class="plaque" id="roleOk">To your station</button></div></div>
      <div class="over" hidden><div class="card"><h2 id="overTitle"></h2><p id="overText"></p><p id="overVerify" class="meta"></p><button class="plaque" id="leave">Back to port</button></div></div>`;
    this.telegraph(this.q('.telegraph'));
    this.q<HTMLElement>('#endTurn').onclick = () => { this.spin('#endTurn'); on.endTurn(); };
    this.q<HTMLElement>('#ready').onclick = () => { this.spin('#ready'); on.ready(); };
    this.q<HTMLElement>('#leave').onclick = () => on.leave();
    this.q<HTMLElement>('#roleOk').onclick = () => { this.q<HTMLElement>('.role').hidden = true; };
    // Settings: sound and 3D quality, in a small parchment menu at the top left.
    const menu = this.q<HTMLElement>('#menu'), menuBtn = this.q<HTMLElement>('#menuBtn');
    const show = (open: boolean) => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.onclick = (e) => { e.stopPropagation(); show(menu.hidden === true); };
    addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== menuBtn) show(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') show(false); });
    menu.onclick = (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.seg button');
      if (!b) return;
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v!;
      if (pref === 'sound' && (v === 'off') !== this.muted) this.muted = on.mute();
      if (pref === 'quality') { on.quality(v as 'auto' | 'high' | 'low'); this.qualityPref = v; }
      this.paintPrefs();
    };
    // The quartermaster explains each item on hover: what it does, its price, and why you cannot buy it yet.
    const shop = this.q<HTMLElement>('#shop'), tip = this.q<HTMLElement>('#shopTip');
    shop.addEventListener('pointerover', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-item]');
      if (!b) return;
      const id = b.dataset.item as Item, it = ITEMS[id];
      tip.innerHTML = `<b>${it.name}</b><span class="cost">${it.price} doubloons · ${it.ap} AP</span><p>${esc(ITEM_HELP[id])}</p>${b.dataset.why ? `<p class="why">${esc(b.dataset.why)}</p>` : ''}`;
      const r = b.getBoundingClientRect(), panel = shop.closest('.card')!.getBoundingClientRect();
      tip.style.left = panel.right + 10 + 'px';
      tip.style.top = Math.min(innerHeight - 220, r.top - 6) + 'px';
      tip.hidden = false;
    });
    shop.addEventListener('pointerleave', () => { tip.hidden = true; });
    this.q<HTMLElement>('#shop').onclick = (e) => { const b = (e.target as Element).closest('button'); if (b && !b.classList.contains('off')) on.buy(b.dataset.item as Item); };
    // The message in a bottle: a small sheet to write on, sealed and cast with one button.
    const compose = this.q<HTMLFormElement>('#compose'), noteBtn = this.q<HTMLElement>('#noteBtn'), noteText = this.q<HTMLTextAreaElement>('#noteText');
    const showCompose = (open: boolean) => {
      compose.hidden = !open; noteBtn.setAttribute('aria-expanded', String(open));
      if (open) { const r = noteBtn.getBoundingClientRect(); compose.style.left = Math.max(12, r.left) + 'px'; compose.style.bottom = innerHeight - r.top + 12 + 'px'; noteText.focus(); }
    };
    noteBtn.onclick = () => showCompose(compose.hidden === true);
    noteText.oninput = () => { this.q('#noteCount').textContent = `${noteText.value.length} / 80`; };
    noteText.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') showCompose(false); };
    this.q<HTMLElement>('#noteCancel').onclick = () => showCompose(false);
    compose.onsubmit = (e) => { e.preventDefault(); if (!noteText.value.trim()) return; on.note(noteText.value); noteText.value = ''; this.q('#noteCount').textContent = '0 / 80'; showCompose(false); };
    this.q<HTMLElement>('#letterOk').onclick = () => { this.q<HTMLElement>('#letter').hidden = true; on.letterRead(); };
    this.q<HTMLElement>('#belt').onclick = (e) => { const b = (e.target as Element).closest('button'); if (b && !b.classList.contains('off')) on.mode(b.dataset.tool as Mode); };
    // The same tooltip explains the special actions above the helm, shown above the button.
    const belt = this.q<HTMLElement>('#belt');
    belt.addEventListener('pointerover', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-tool]');
      if (!b) return;
      tip.innerHTML = `<b>${esc(b.dataset.name!)}</b><span class="cost">${b.dataset.ap} AP</span><p>${esc(b.dataset.help!)}</p>${b.dataset.why ? `<p class="why">${esc(b.dataset.why)}</p>` : ''}`;
      tip.hidden = false;
      const r = b.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tip.style.top = r.top - tip.offsetHeight - 10 + 'px';
    });
    belt.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  show(v: boolean) { this.root.hidden = !v; if (!v) this.q<HTMLElement>('.role').hidden = true; }

  /** The card that tells a captain which role the lot gave them. */
  showRole(role: Exclude<Role, 'classic'>) {
    const cap = CAPTAINS[role], s = this.q<SVGElement>('.medal');
    s.innerHTML = '';
    svg(s, 'circle', { cx: 50, cy: 50, r: 48, fill: 'url(#brass)', stroke: '#0d0b08' });
    svg(s, 'circle', { cx: 50, cy: 50, r: 41, fill: '#0d0b08' });
    svg(s, 'path', { d: 'M22 92 Q24 68 40 64 L60 64 Q76 68 78 92 Z', fill: role === 'admiral' ? '#e8d5a3' : '#8c2f1b' });
    svg(s, 'circle', { cx: 50, cy: 48, r: 13, fill: '#e8d5a3' });
    // A bicorne for the Admiral, a tricorne for the Corsair.
    svg(s, 'path', { d: role === 'admiral' ? 'M24 40 Q50 8 76 40 Q50 30 24 40 Z' : 'M26 38 L50 18 L74 38 Q62 30 50 36 Q38 30 26 38 Z', fill: '#d9a441', stroke: '#0d0b08' });
    if (role === 'admiral') for (const x of [36, 64]) svg(s, 'rect', { x: x - 6, y: 66, width: 12, height: 5, fill: '#d9a441' });
    else svg(s, 'path', { d: 'M38 50 L62 46 L62 50 L38 54 Z', fill: '#0d0b08' });
    this.q('#roleTitle').textContent = 'The lot has fallen: you sail as ' + cap.title;
    this.q('#roleName').textContent = cap.name;
    this.q('#roleMission').textContent = cap.mission;
    this.q('#rolePower').textContent = cap.power + '.';
    this.q('#rolePowerText').textContent = cap.powerText;
    this.q<HTMLElement>('.role').hidden = false;
  }
  private spin(sel: string) { this.q<HTMLElement>(sel + ' img').style.transform = `rotate(${++this.capTurns * 135}deg)`; }

  /* The helm console is public/ui/console.webp (dial with four shot cups on its crest) and
     public/ui/needle.webp. Everything here is in the source picture's pixels (see TG); the
     order sectors, their words and glow, the needle and the cannonballs are drawn on top. */
  private telegraph(s: SVGElement) {
    const { cx, cy, rx, ry, ri } = TG, span = 180 / SECTORS.length;
    const P = (r: number, deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - (r * ry / rx) * Math.sin((deg * Math.PI) / 180)];
    const d = svg(s, 'defs', {});
    const g = svg(d, 'radialGradient', { id: 'brass', cx: 0.35, cy: 0.3, r: 0.9 });
    svg(g, 'stop', { offset: 0, 'stop-color': '#f0d489' }); svg(g, 'stop', { offset: 0.45, 'stop-color': '#b08d3c' }); svg(g, 'stop', { offset: 1, 'stop-color': '#5e4717' });
    const glow = svg(d, 'radialGradient', { id: 'sectorGlow', cx: 0.5, cy: 1, r: 1 });
    svg(glow, 'stop', { offset: 0.25, 'stop-color': '#ffcf6a', 'stop-opacity': 0.92 }); svg(glow, 'stop', { offset: 1, 'stop-color': '#c98a22', 'stop-opacity': 0.7 });
    svg(s, 'image', { href: '/ui/console.webp', x: 0, y: 0, width: TG.w, height: TG.h });
    const labels: SVGTextElement[] = [];
    SECTORS.forEach((m, i) => {
      const t1 = 180 - span * i, t0 = t1 - span, k = ry / rx;
      const a = P(ri, t1), b = P(rx, t1), c = P(rx, t0), e = P(ri, t0);
      const path = svg(s, 'path', { d: `M${a} L${b} A${rx},${ry} 0 0 1 ${c} L${e} A${ri},${ri * k} 0 0 0 ${a}Z`, class: 'sector' });
      if (i < SECTORS.length - 1) { const [x1, y1] = P(ri + 12, t0), [x2, y2] = P(rx - 6, t0); svg(s, 'line', { x1, y1, x2, y2, class: 'sectorRule' }); }
      const tr = rx * 0.74, id = `arc${i}`, p0 = P(tr, t1 - 3), p1 = P(tr, t0 + 3);
      svg(d, 'path', { id, d: `M${p0} A${tr},${tr * k} 0 0 1 ${p1}` });
      const text = svg(document.createElementNS(NS, 'g'), 'text', { class: 'sectorLabel' });
      svg(text, 'textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, m.toUpperCase());
      labels.push(text);
      path.addEventListener('click', () => this.on.mode(m === 'ability' ? 'broadside' : m));
      this.sectors.push([path, text]);
    });
    TG.cups.forEach(([x, y]) => {
      const b = svg(s, 'g', { class: 'ball spent' });
      svg(b, 'image', { href: '/ui/ap_ball.webp', x: x - TG.ball, y: y - TG.ball, width: TG.ball * 2, height: TG.ball * 2 });
      this.balls.push(b);
    });
    this.lever = svg(s, 'g', { class: 'lever' });
    this.lever.style.transformOrigin = `${cx}px ${cy}px`;
    const n = TG.needle;
    svg(this.lever, 'image', { href: '/ui/needle.webp', x: cx - n.capX * n.scale, y: cy - n.capY * n.scale, width: n.w * n.scale, height: n.h * n.scale });
    labels.forEach((t) => s.appendChild(t));
  }

  /** Show the saved settings in the menu. */
  setPrefs(muted: boolean, quality: string) { this.muted = muted; this.qualityPref = quality; this.paintPrefs(); }
  private paintPrefs() {
    this.root.querySelectorAll<HTMLElement>('#menu .seg button').forEach((b) => {
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v;
      const on = pref === 'sound' ? (v === 'off') === this.muted : v === this.qualityPref;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    });
  }

  /** A ribbon sweeps across the screen to announce whose turn it is. */
  /** Each ribbon plays to the end before the next: a quick enemy turn no longer cuts its own ribbon short. */
  herald(title: string, sub: string, mine: boolean) {
    this.heralds.push({ title, sub, mine });
    if (this.heralds.length > 2) this.heralds.splice(0, this.heralds.length - 2);
    if (!this.heralding) this.nextHerald();
  }
  private heralds: { title: string; sub: string; mine: boolean }[] = [];
  private heralding = false;
  private held: [string, '' | 'head' | 'bad' | 'good'][] = [];
  private nextHerald() {
    const n = this.heralds.shift();
    if (!n) {
      // The ribbon has gone: now show the notices that waited behind it, one after another.
      this.heralding = false;
      const held = this.held; this.held = [];
      held.forEach(([text, kind], i) => setTimeout(() => this.log(text, kind), i * 1700));
      return;
    }
    this.heralding = true;
    const h = this.q<HTMLElement>('#herald');
    h.querySelector('b')!.textContent = n.title; h.querySelector('span')!.textContent = n.sub;
    h.classList.toggle('enemy', !n.mine);
    h.classList.remove('go'); void h.offsetWidth; h.classList.add('go');
    setTimeout(() => this.nextHerald(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2150);
  }

  /** A bottle has washed up: unroll its letter. */
  letter(text: string, from: string) {
    this.q('#letterText').textContent = `“${text}”`;
    this.q('#letterSign').textContent = `— ${from}`;
    const l = this.q<HTMLElement>('#letter');
    l.hidden = false; l.classList.remove('open'); void l.offsetWidth; l.classList.add('open');
  }

  setHint(text: string) { this.q('#hint').textContent = text; }

  update(c: Client, mode: Mode, note = '') {
    const p = c.pub, me = c.side, foe = c.foeSide, mine = c.myTurn;
    this.root.dataset.phase = p.phase;
    const i = mode === 'fire' ? 0 : mode === 'sail' ? 1 : mode === 'turn' ? 2 : 3, span = 180 / SECTORS.length;
    const mid = ((180 - span * i - span / 2) * Math.PI) / 180;
    this.lever.style.transform = `rotate(${90 - (Math.atan2(Math.sin(mid) * TG.ry, Math.cos(mid) * TG.rx) * 180) / Math.PI}deg)`;
    this.sectors.forEach(([path, t], k) => { path.classList.toggle('on', k === i); t.classList.toggle('on', k === i); });

    this.q('#turnTitle').textContent = p.phase === 'placement' ? 'Deploy your fleet' : p.phase === 'over' ? 'Battle over' : mine ? 'Your turn' : 'Enemy turn';
    this.q('#turnSub').textContent = p.phase === 'battle' ? `Round ${p.round}` : '';
    this.q('#seals').innerHTML = Array.from({ length: KRAKEN_SEALS }, (_, i) => `<i class="${i < me.seals ? 'lit' : ''}"></i>`).join('') + `<span>${me.seals >= KRAKEN_SEALS ? 'The Kraken will answer.' : `${Math.min(me.seals, KRAKEN_SEALS)} of ${KRAKEN_SEALS} seals`}</span>`;
    this.q('#sealHow').innerHTML = me.seals >= KRAKEN_SEALS
      ? '<b>The Kraken will answer.</b> Choose <em>Summon the Kraken</em> above the helm (3 AP), then a 3×3 patch of enemy water. It strikes now and again on their next turn, and holds the ships it finds.'
      : `Three seals summon the Kraken. A red wax seal surfaces in your waters every few rounds: <b>sail a ship onto it</b> to take it. Each ship you lose also pays one.${p.treasures.some((t) => t.side === c.me && t.kind === 'seal') ? ' <b>A seal is afloat in your waters now.</b>' : ''}`;
    this.q('#foeSeals').textContent = `${foe.seals} covenant seal${foe.seals === 1 ? '' : 's'} · ${foe.doubloons} doubloons`;
    this.balls.forEach((b, k) => b.classList.toggle('spent', !(mine && k < p.ap)));
    this.q<HTMLButtonElement>('#endTurn').disabled = !c.can();
    const noteBtn = this.q<HTMLButtonElement>('#noteBtn');
    noteBtn.disabled = !(p.phase === 'battle' && mine && !p.noteSent);
    noteBtn.title = p.noteSent && mine ? 'One bottle a turn: you have cast yours.' : mine ? 'Send the other captain a short note.' : 'You may cast a bottle on your own turn.';
    if (noteBtn.disabled) { this.q<HTMLElement>('#compose').hidden = true; noteBtn.setAttribute('aria-expanded', 'false'); }
    this.q<HTMLButtonElement>('#ready').disabled = me.ready;
    this.q('#placeHint').innerHTML = p.phase !== 'placement' ? '' : me.ready ? 'Fleet committed. Waiting for the other captain…' : 'Click a ship to lift it, move it over your waters and click again to set it down. <kbd>R</kbd> to rotate it.';

    this.q('#foeName').textContent = foe.name || 'The other captain';
    this.q('#foeNote').textContent = note;
    const role = c.role, foeRole = roleOf(p, c.foe);
    // One row per enemy ship; a sunk ship is struck through. Two ships of a kind are counted separately.
    const lost: Record<string, number> = {};
    for (const s of foe.sunk) lost[s.kind] = (lost[s.kind] || 0) + 1;
    this.q('#foeFleet').innerHTML = FLEETS[foeRole].map((f) => {
      const sunk = (lost[f.kind] || 0) > 0;
      if (sunk) lost[f.kind]--;
      return `<li class="${sunk ? 'sunk' : ''}"><span>${f.cls}</span><span class="pips">${`<i class="${sunk ? 'hit' : ''}"></i>`.repeat(f.len)}</span></li>`;
    }).join('');

    this.q('#orderText').textContent = c.order ? c.order.text : p.phase === 'placement' ? 'Sealed until the battle begins.' : '—';
    this.q('#orderMeta').textContent = c.order ? `Reward ${c.order.reward} doubloons · ${Math.max(0, c.order.deadline - p.round + 1)} rounds left` : '';
    this.q('#gold').textContent = String(me.doubloons);
    this.q('#shop').innerHTML = ITEM_IDS.map((id) => {
      const it = ITEMS[id];
      const why = c.canBuy(id) ? '' : p.phase !== 'battle' ? 'The quartermaster opens once the battle begins.' : !mine ? 'Wait for your turn.'
        : me.doubloons < it.price ? `You need ${it.price - me.doubloons} more doubloons.` : me.items.length >= MAX_ITEMS ? `Your hold is full: ${MAX_ITEMS} items at most. Use one first.` : 'Not now.';
      return `<li><button data-item="${id}" data-why="${esc(why)}" aria-disabled="${!!why}" ${why ? 'class="off"' : ''}><span>${it.name}</span><em>${it.ap} AP</em><b>${it.price}</b></button></li>`;
    }).join('');
    this.q('#fleet').innerHTML = c.ships.map((s) => {
      const f = FLEETS[role].find((q) => q.kind === s.kind)!;
      const pips = s.hits.map((h) => `<i class="${h ? 'hit' : ''}"></i>`).join('');
      return `<li class="${s.sunk ? 'sunk' : ''}"><span>${s.cls}<em>${s.chained ? 'pinned by chain' : f.trait}</em></span><span class="pips">${pips}</span></li>`;
    }).join('');

    const belt: string[] = [];
    if (p.phase === 'battle') {
      // Each action carries its own explanation and, when it cannot be used, the reason why.
      const tool = (id: Mode, name: string, ap: number, ok: boolean, help: string, why = '') => {
        if (!ok && !why) why = p.phase !== 'battle' || !mine ? 'Wait for your turn.' : p.ap < ap ? `Needs ${ap} action point${ap === 1 ? '' : 's'}; you have ${p.ap}.` : 'Not now.';
        belt.push(`<button data-tool="${id}" data-name="${esc(name)}" data-ap="${ap}" data-help="${esc(help)}" data-why="${ok ? '' : esc(why)}" class="${mode === id ? 'on' : ''}${ok ? '' : ' off'}" aria-disabled="${!ok}">${name}<em>${ap} AP</em></button>`);
      };
      const sunk = (kind: 'line' | 'frigate' | 'cutter', cls: string) => (c.alive(kind) ? '' : `Your ${cls} has been sunk.`);
      tool('broadside', TOOLS.broadside.name, 2, c.can(2) && c.alive('line'), `${TOOL_HELP.broadside.text} Needs your Ship of the Line afloat.`, sunk('line', 'Ship of the Line'));
      tool('chain', TOOLS.chain.name, 2, c.can(2) && c.alive('frigate'), `${TOOL_HELP.chain.text} Needs your Frigate afloat.`, sunk('frigate', 'Frigate'));
      tool('spy', TOOLS.spy.name, 1, c.can(1) && c.alive('cutter'), `${TOOL_HELP.spy.text} Needs your Cutter afloat.`, sunk('cutter', 'Cutter'));
      for (const id of [...new Set(me.items)]) {
        const n = me.items.filter((q) => q === id).length;
        tool(id, ITEMS[id].name + (n > 1 ? ` ×${n}` : ''), ITEMS[id].ap, c.can(ITEMS[id].ap) && !(id === 'winds' && p.windsUsed), `${ITEM_HELP[id]} Bought from the quartermaster; used up once played.`, id === 'winds' && p.windsUsed ? 'Trade Winds already blew this turn.' : '');
      }
      if (me.seals >= KRAKEN_SEALS || mode === 'kraken') tool('kraken', 'Summon the Kraken', 3, c.canKraken(), TOOL_HELP.kraken.text, p.kraken ? 'The Kraken is already abroad.' : '');
      if (role !== 'classic' && !p.power[c.me]) tool('power', CAPTAINS[role].power, 1, c.canPower(), `Your captain's power. ${CAPTAINS[role].powerText}`);
    }
    this.q('#belt').innerHTML = belt.join('');

    const obj = this.q<HTMLElement>('#objective'), parts: string[] = [];
    if (role !== 'classic') {
      const crates = '<i></i>'.repeat(p.cargo) + '<i class="gone"></i>'.repeat(3 - p.cargo);
      const left = Math.max(0, SEASON - p.round + 1), mer = c.merchant;
      const way = mer ? N - 1 - Math.max(...shipCells(mer).map(([x]) => x)) : 0;
      parts.push(`<span><b>Cargo</b><span class="crates">${crates}</span></span>`);
      if (role === 'admiral') parts.push(`<span><b>Home port</b>${way} column${way === 1 ? '' : 's'} east</span>`);
      parts.push(`<span><b>Season closes</b>${p.phase === 'battle' ? `in ${left} round${left === 1 ? '' : 's'}` : `after round ${SEASON}`}</span>`);
    }
    if (p.storm) parts.push(`<span><b>Storm</b>rows ${p.storm.row + 1}–${p.storm.row + 3}, no guns or glasses</span>`);
    if (p.kraken) parts.push(`<span><b>The Kraken</b>holds ${p.kraken.side === c.me ? 'your' : 'enemy'} ships</span>`);
    if (p.ring) parts.push(`<span><b>Maelstrom</b>${p.ring} ring${p.ring === 1 ? '' : 's'} drowned</span>`);
    obj.hidden = !parts.length || p.phase === 'over';
    obj.innerHTML = parts.join('');
    this.q<HTMLElement>('.over').hidden = p.phase !== 'over';
    if (p.phase === 'over') {
      const won = p.winner === c.me;
      this.q('#overTitle').textContent = won ? 'Victory' : 'Defeat';
      const text: Record<string, [string, string]> = {
        fleet: [`The enemy fleet lies on the seabed after ${p.round} rounds.`, `Your last ship went down in round ${p.round}.`],
        home: [`The merchantman made the Home Port with ${p.cargo} of 3 crates aboard.`, `The merchantman slipped past you with ${p.cargo} of 3 crates.`],
        plunder: ['The last crate is yours and the merchantman is going down.', 'The merchantman is plundered and sunk.'],
        season: ['The season closed with the cargo still at sea.', 'The season closed before the cargo reached home.'],
      };
      this.q('#overText').textContent = text[p.reason || 'fleet'][won ? 0 : 1];
    }
  }

  setVerdict(text: string) { this.q('#overVerify').textContent = text; }

  log(text: string, kind: '' | 'head' | 'bad' | 'good' = '') {
    // There is no log panel for now: the latest event shows briefly above the controls.
    if (kind === 'head') return;
    // Never over the turn ribbon: wait until it has passed.
    if (this.heralding) { this.held.push([text, kind]); return; }
    const t = this.q<HTMLElement>('#toast');
    t.textContent = text;
    t.className = 'toast show ' + kind;
    t.style.animation = 'none';
    void t.offsetWidth; // restart the fade
    t.style.animation = '';
  }
  clearLog() { this.q('#toast').className = 'toast'; this.setVerdict(''); }
}
