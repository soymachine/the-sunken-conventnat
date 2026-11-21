// Oak-and-brass HUD drawn with DOM + SVG over the 3D canvas.
import { Client, SEASON, maelstromIn, roleOf } from '../game/engine';
import { installTuner } from './tuner';
import { ITEMS, ITEM_HELP, ITEM_IDS, Item, MAX_ITEMS } from '../game/powerups';
import { FLEETS, KRAKEN_SEALS, N, Role, shipCells } from '../game/rules';

export type Tool = 'broadside' | 'chain' | 'spy' | Item;
export type Mode = 'fire' | 'sail' | 'turn' | 'power' | 'kraken' | 'pact' | Tool;

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
/** Cards that have their own picture in public/ui/cards/. */
/** Card families, each with its own frame. */
const CARD_KIND: Record<string, string> = { fire: 'shot', broadside: 'shot', chain: 'shot', fireship: 'shot', sail: 'move', turn: 'move', current: 'move', winds: 'move', kraken: 'kraken' };
const CARD_ART = new Set(['fire', 'sail', 'turn', 'broadside', 'chain', 'spy', 'spyglass', 'longglass', 'fireship', 'fog', 'shipwright', 'winds', 'current', 'pact', 'kraken']);
/** What each ship's trait means, for the fleet's tooltips. */
const TRAIT_HELP: Record<string, string> = {
  Broadside: 'fires three squares in a row.', 'Chain shot': 'a hit pins the enemy ship for a turn.',
  Armour: 'the first hit glances off her iron plate; under steam, the wind never stops her.', Swift: 'sails two squares instead of one.',
  Spyglass: "the Cutter's Glass counts hulls in a 5×5 patch of enemy water.", Cargo: 'she carries the cargo the Corsair plunders.',
};
const TOOL_HELP: Record<string, { ship?: string; text: string }> = {
  broadside: { ship: 'Ship of the Line', text: 'Fire three squares in a row at once. Press R to swing the line between across and down.' },
  chain: { ship: 'Frigate', text: 'A single shot of chained balls: a ship it hits is pinned and cannot sail or turn on her next turn.' },
  spy: { ship: 'Cutter', text: 'Train the cutter\'s glass on a 5×5 patch of enemy water: you learn how many ship sections lie inside it.' },
  pact: { text: 'Once a battle: give one of your damaged ships to the deep. She sinks at once and the deep pays two covenant seals (her toll and the pact). Not the merchantman, nor your last ship.' },
  kraken: { text: 'Break three covenant seals and wake the Kraken under a 3×3 patch of enemy water. It strikes now and again on their next turn, and the ships it finds cannot move meanwhile.' },
};

function svg<K extends keyof SVGElementTagNameMap>(p: Element, tag: K, a: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (text != null) e.textContent = text;
  p.appendChild(e);
  return e;
}
type KrakenIntro = 'embrace' | 'depths';
type ApMode = 'desk' | 'head' | 'glass';
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A tapered tentacle along a Catmull-Rom curve through `pts`: its outline, its centre line and its suckers. */
function tentacle(pts: [number, number][], w0: number) {
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const line: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    line.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  line.push(pts[pts.length - 1]);
  const n = line.length, L: string[] = [], R: string[] = [], dots: string[] = [];
  line.forEach(([x, y], i) => {
    const [ax, ay] = line[Math.max(0, i - 1)], [bx, by] = line[Math.min(n - 1, i + 1)];
    let nx = -(by - ay), ny = bx - ax; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const w = w0 * Math.pow(1 - i / n, 0.85) + 0.6;
    L.push(`${(x + nx * w).toFixed(1)},${(y + ny * w).toFixed(1)}`); R.unshift(`${(x - nx * w).toFixed(1)},${(y - ny * w).toFixed(1)}`);
    if (i % 3 === 1 && i < n - 4) dots.push(`<circle cx="${(x + nx * w * 0.45).toFixed(1)}" cy="${(y + ny * w * 0.45).toFixed(1)}" r="${(w * 0.32).toFixed(1)}"/>`);
  });
  return { body: `M${L.join(' L')} L${R.join(' L')} Z`, spine: `M${line.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`, dots: dots.join('') };
}
// Tentacles in the card's frame: the card is 100 × 157 at (60, 30) inside a 220 × 270 box; they rise from below.
const ARMS: { pts: [number, number][]; w: number; at: number }[] = [
  { pts: [[22, 300], [30, 220], [44, 140], [52, 80], [60, 40], [82, 24], [97, 40], [88, 56], [76, 49]], w: 9, at: 0 },
  { pts: [[198, 300], [190, 220], [176, 140], [168, 80], [160, 40], [138, 24], [123, 40], [132, 56], [144, 49]], w: 9, at: 90 },
  { pts: [[70, 300], [76, 240], [102, 206], [142, 186], [166, 160], [160, 140], [146, 146]], w: 7.5, at: 180 },
  { pts: [[160, 300], [150, 250], [126, 228], [96, 214], [70, 200], [62, 182], [74, 176]], w: 6.5, at: 260 },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface HudHandlers {
  mode(m: Mode): void;
  mute(): boolean;
  quality(q: 'auto' | 'high' | 'low'): void;
  note(text: string): void;
  /** Debug only (?debug=true): grant doubloons, seals or action points to try the cards. */
  cheat?(what: 'gold' | 'seals' | 'ap'): void;
  /** Debug only: call up a sky (shafts of sun, an aurora) or clear it. */
  sky?(what: 'sun' | 'aurora' | 'clear'): void;
  /** A sound for the HUD's own flourishes. */
  sound?(name: 'roar' | 'splash'): void;
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
  private krakenReady = false;
  private krakenSeen: boolean | null = null;
  private krakenIntro: { t0: number; style: KrakenIntro } | null = null;
  private sealHelp = '';
  private maelHelp = '';
  private muted = false;
  private qualityPref = 'auto';
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(private on: HudHandlers) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <header class="rail top">
        <div class="turn"><button id="menuBtn" class="mini" aria-expanded="false" aria-controls="menu">Settings</button></div>
        <h1 class="title"><span>The Sunken Covenant</span></h1>
        <div class="foe"><span id="foeNote"></span>
          <div class="mael" id="mael" hidden tabindex="0" aria-label="Maelstrom">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs><radialGradient id="maelBrass" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f6dc95"/><stop offset=".45" stop-color="#b08d3c"/><stop offset="1" stop-color="#4a3710"/></radialGradient></defs>
              <circle cx="50" cy="50" r="48" fill="url(#maelBrass)" stroke="#2a1e08" stroke-width="1.5"/>
              <circle cx="50" cy="50" r="39" fill="#0e1517" stroke="#2a1e08" stroke-width="2"/>
              <g class="swirl">${[0, 72, 144, 216, 288].map((a) => `<path d="M50 50 C 50 34, 66 26, 80 34" transform="rotate(${a} 50 50)" fill="none" stroke="#5f8a8f" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`).join('')}</g>
              ${[0, 1, 2, 3, 4].map((k) => { const a = (-90 - 48 + k * 24) * Math.PI / 180; return `<circle class="notch" cx="${(50 + 43.5 * Math.cos(a)).toFixed(1)}" cy="${(50 + 43.5 * Math.sin(a)).toFixed(1)}" r="3.2"/>`; }).join('')}
            </svg>
            <b></b><small></small>
          </div>
        </div>
        <div class="status" role="status"><b id="turnTitle"></b><span id="turnSub"></span><em id="turnWx"></em><div class="objective" id="objective" hidden></div><p id="placeHint"></p></div>
      </header>
      <div class="menu card" id="menu" hidden>
        <h2>Settings</h2>
        <p class="opt">Sound</p>
        <div class="seg" data-pref="sound" role="radiogroup" aria-label="Sound"><button data-v="on" role="radio">On</button><button data-v="off" role="radio">Off</button></div>
        <p class="opt">3D quality</p>
        <div class="seg" data-pref="quality" role="radiogroup" aria-label="3D quality"><button data-v="auto" role="radio">Auto</button><button data-v="high" role="radio">High</button><button data-v="low" role="radio">Low</button></div>
        <div class="debug" hidden><p class="opt">Debug</p><div class="seg three"><button type="button" data-cheat="gold">+100 gold</button><button type="button" data-cheat="seals">+3 seals</button><button type="button" data-cheat="ap">+3 AP</button></div>
          <p class="opt">Kraken card entrance</p><div class="seg three" data-pref="kintro"><button type="button" data-v="embrace">Embrace</button><button type="button" data-v="depths">Depths</button><button type="button" data-v="play">Play</button></div>
          <p class="opt">Action points</p><div class="seg three" data-pref="ap"><button type="button" data-v="desk">Desk</button><button type="button" data-v="head">Header</button><button type="button" data-v="glass">Glass</button></div>
          <p class="opt">Sky</p><div class="seg three" data-pref="sky"><button type="button" data-v="sun">Sun rays</button><button type="button" data-v="aurora">Aurora</button><button type="button" data-v="clear">Clear</button></div></div>
        <p class="meta">Auto steps down by itself if the game runs slowly. Low drops shadows, glow and the print grade.</p>
      </div>
      <div class="shopTip" id="shopTip" role="tooltip" hidden></div>
      <div class="shipMenu" id="shipMenu" hidden><button type="button"></button></div>
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
      <aside class="card left">
        <h2>The covenant</h2><div class="seals" id="seals" tabindex="0" aria-describedby="shopTip"></div><p class="howto" id="sealHow"></p>
        <h2>Admiralty orders</h2><p id="orderText"></p><p id="orderMeta" class="meta"></p>
        <h2>Quartermaster <span id="gold" title="Doubloons"></span></h2><ul id="shop"></ul>
        <h2>Your fleet</h2><ul id="fleet"></ul>
      </aside>
      <aside class="card right"><h2>Enemy fleet</h2><p id="foeName"></p><p class="meta" id="foeSeals"></p><ul id="foeFleet"></ul></aside>
      <p class="toast" id="toast" role="status"></p>
      <div class="belt" id="belt"></div>
      <footer class="rail bottom">
        <div class="battle">
          <div class="say"><p id="hint"></p>
            <button class="bottleBtn" id="noteBtn" aria-expanded="false" aria-controls="compose"><img src="/ui/bottle_up.webp" alt="" draggable="false"><span>Cast a bottle</span></button></div>
          <div class="helm">
            <svg class="telegraph" viewBox="${TG.view}" role="group" aria-label="Orders and action points"></svg>
          </div>
          <div class="watch">
            <button class="glass" id="endTurn" aria-label="End turn"><img src="/ui/hourglass.webp" alt="" draggable="false"><span>End turn</span></button>
            <div class="apSeals" id="apSeals" aria-label="Action points"></div>
          </div>
        </div>
        <div class="placing">
          <button class="capstan" id="ready" aria-label="Ready"><img src="/ui/wheel.webp" alt="" draggable="false"><span>Ready</span></button>
        </div>
      </footer>
      <div class="role" hidden><div class="card"><svg class="medal" viewBox="0 0 100 100"></svg><p class="meta" id="roleTitle"></p><h2 id="roleName"></h2><p id="roleMission"></p><p class="pw"><b id="rolePower"></b> <span id="rolePowerText"></span></p><button class="plaque" id="roleOk">To your station</button></div></div>
      <div class="over" hidden><div class="card"><h2 id="overTitle"></h2><p id="overText"></p><p id="overVerify" class="meta"></p><button class="plaque" id="leave">Back to port</button></div></div>`;
    this.telegraph(this.q('.telegraph'));
    this.placeAp();
    // Setting the glass down ends the turn: it is tapped onto the desk and goes dull until your turn comes back.
    this.q<HTMLElement>('#endTurn').onclick = () => {
      this.q<HTMLElement>('#endTurn img').animate([{ transform: 'none' }, { transform: 'translateY(5px) scale(.97)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      on.endTurn();
    };
    // Clicking the covenant's seals, once three are lit, takes up the Kraken's card.
    this.q<HTMLElement>('#seals').onclick = () => { if (this.krakenReady) on.mode('kraken'); };
    this.root.querySelectorAll<HTMLElement>('.order').forEach((b) => (b.onclick = () => on.mode(b.dataset.order as Mode)));
    this.q<HTMLElement>('#ready').onclick = () => { this.spin('#ready'); on.ready(); };
    this.q<HTMLElement>('#leave').onclick = () => on.leave();
    this.q<HTMLElement>('#roleOk').onclick = () => { this.q<HTMLElement>('.role').hidden = true; };
    // Settings: sound and 3D quality, in a small parchment menu at the top left.
    const menu = this.q<HTMLElement>('#menu'), menuBtn = this.q<HTMLElement>('#menuBtn');
    const show = (open: boolean) => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.onclick = (e) => { e.stopPropagation(); show(menu.hidden === true); };
    addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== menuBtn) show(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { show(false); this.shipMenu(null); } });
    // Debug tools, only when the address carries ?debug=true.
    if (new URLSearchParams(location.search).get('debug') === 'true' && on.cheat) {
      this.q<HTMLElement>('#menu .debug').hidden = false;
      installTuner(this.root);
      this.root.querySelectorAll<HTMLElement>('[data-cheat]').forEach((b) => (b.onclick = () => on.cheat!(b.dataset.cheat as 'gold' | 'seals' | 'ap')));
    }
    menu.onclick = (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.seg button');
      if (!b) return;
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v!;
      if (pref === 'sound' && (v === 'off') !== this.muted) this.muted = on.mute();
      if (pref === 'quality') { on.quality(v as 'auto' | 'high' | 'low'); this.qualityPref = v; }
      if (pref === 'kintro') { if (v === 'play') this.playKraken(); else { this.kStyle = v as KrakenIntro; store('tsc:krakenIntro', v); } }
      if (pref === 'ap') { this.apMode = v as ApMode; store('tsc:apSpot', v); this.placeAp(); }
      if (pref === 'sky') on.sky?.(v as 'sun' | 'aurora' | 'clear');
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
    // The covenant's seals explain themselves on hover (or focus).
    const seals = this.q<HTMLElement>('#seals');
    const showSeals = () => {
      tip.innerHTML = `<b>The covenant</b><span class="cost">Seals summon the Kraken</span><p>${esc(this.sealHelp)}</p>`;
      const r = seals.getBoundingClientRect(), panel = seals.closest('.card')!.getBoundingClientRect();
      tip.style.left = panel.right + 10 + 'px'; tip.style.top = r.top - 6 + 'px'; tip.hidden = false;
    };
    seals.addEventListener('pointerenter', showSeals); seals.addEventListener('focus', showSeals);
    const mael = this.q<HTMLElement>('#mael');
    const showMael = () => {
      tip.innerHTML = `<b>The maelstrom</b><span class="cost">The sea closes in</span><p>${esc(this.maelHelp)}</p>`;
      const r = mael.getBoundingClientRect(); tip.hidden = false;
      tip.style.left = Math.max(8, r.right - tip.offsetWidth) + 'px'; tip.style.top = r.bottom + 8 + 'px';
    };
    mael.addEventListener('pointerenter', showMael); mael.addEventListener('focus', showMael);
    mael.addEventListener('pointerleave', () => { tip.hidden = true; }); mael.addEventListener('blur', () => { tip.hidden = true; });
    seals.addEventListener('pointerleave', () => { tip.hidden = true; }); seals.addEventListener('blur', () => { tip.hidden = true; });
    // Each ship's sections in Your fleet name her and her speciality.
    const fleet = this.q<HTMLElement>('#fleet');
    fleet.addEventListener('pointerover', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('li[data-cls]');
      if (!li) return;
      tip.innerHTML = `<b>${esc(li.dataset.cls!)}</b><span class="cost">${esc(li.dataset.state!)}</span><p>${esc(li.dataset.trait!)}</p>`;
      const r = li.getBoundingClientRect(), panel = li.closest('.card')!.getBoundingClientRect();
      tip.style.left = panel.right + 10 + 'px'; tip.style.top = r.top - 30 + 'px'; tip.hidden = false;
    });
    fleet.addEventListener('pointerleave', () => { tip.hidden = true; });
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
      // Above the card once it has risen out of the hand.
      const r = b.getBoundingClientRect(), w = tip.offsetWidth, risen = innerHeight + 46 - 151 - 62 - 24;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tip.style.top = risen - tip.offsetHeight - 14 + 'px';
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

  private kStyle: KrakenIntro = load('tsc:krakenIntro') === 'depths' ? 'depths' : 'embrace';
  private apMode: ApMode = (['desk', 'head', 'glass'] as const).find((m) => m === load('tsc:apSpot')) ?? 'desk';
  /** The action points sit where the player chose (debug): on the desk by the hand, under the turn header, or by the glass. */
  private placeAp() {
    const ap = this.q<HTMLElement>('#apSeals');
    const home = this.apMode === 'head' ? this.q<HTMLElement>('#hud .status') : this.apMode === 'glass' ? this.q<HTMLElement>('.battle .watch') : this.q<HTMLElement>('.battle');
    if (this.apMode === 'head') this.q('#turnSub').after(ap); else if (ap.parentElement !== home) home.appendChild(ap);
    this.root.classList.remove('ap-desk', 'ap-head', 'ap-glass'); this.root.classList.add('ap-' + this.apMode);
    this.paintPrefs();
  }

  /** The Kraken's card arrives: dragged up from the deep by its arms (Embrace) or surfacing from a pool of ink (Depths). */
  private playKraken() {
    const card = this.root.querySelector<HTMLElement>('#belt .ocard[data-tool="kraken"]');
    if (!card) { this.log('The Kraken\'s card is not in your hand (debug: +3 seals).'); return; }
    this.krakenIntro = { t0: performance.now(), style: this.kStyle };
    const r = card.getBoundingClientRect(), k = r.width / 100;
    const fx = this.root.appendChild(document.createElement('div'));
    fx.className = 'kfx ' + this.kStyle;
    Object.assign(fx.style, { left: `${r.left - 60 * k}px`, top: `${r.top - 30 * k}px`, width: `${220 * k}px`, height: `${270 * k}px` });
    const ink = (n: number, html: (i: number) => string) => Array.from({ length: n }, (_, i) => html(i)).join('');
    if (this.kStyle === 'embrace') {
      const arms = ARMS.map((a) => ({ ...a, ...tentacle(a.pts, a.w) }));
      fx.innerHTML = `<svg viewBox="0 0 220 270" preserveAspectRatio="none"><defs>
          <linearGradient id="kSkin" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1b0b12"/><stop offset=".6" stop-color="#5a1c24"/><stop offset="1" stop-color="#8a2f2a"/></linearGradient>
          ${arms.map((a, i) => `<mask id="kArm${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="320"><path d="${a.spine}" pathLength="1" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-dasharray="1 1"/></mask>`).join('')}
        </defs>${arms.map((a, i) => `<g class="arm" mask="url(#kArm${i})"><path d="${a.body}" fill="url(#kSkin)" stroke="#0b0508" stroke-width=".8"/><g fill="#d9a08c" stroke="#5a1c24" stroke-width=".5">${a.dots}</g></g>`).join('')}</svg>
        ${ink(18, () => `<i class="drop" style="--a:${rnd(0, 360)}deg;--d:${rnd(60, 150) * k}px;--s:${rnd(3, 8)}px"></i>`)}
        ${ink(12, () => `<i class="bub" style="--x:${rnd(20, 80)}%;--d:${rnd(80, 190) * k}px;--s:${rnd(3, 7)}px"></i>`)}`;
      fx.querySelectorAll<SVGPathElement>('mask path').forEach((m, i) => {
        const at = ARMS[i].at;
        m.animate([{ strokeDashoffset: 1, offset: 0 }, { strokeDashoffset: 1, offset: at / 2300 }, { strokeDashoffset: 0, offset: (at + 650) / 2300, easing: 'ease-in' },
          { strokeDashoffset: 0, offset: (1450 + at / 3) / 2300, easing: 'cubic-bezier(.5,0,.8,.4)' }, { strokeDashoffset: 1, offset: 1 }], { duration: 2300, fill: 'both' });
      });
      fx.querySelectorAll<SVGGElement>('.arm').forEach((g, i) => g.animate([{ transform: 'none' }, { transform: `rotate(${i % 2 ? -1.5 : 1.5}deg)`, offset: .55 }, { transform: 'none', offset: .65 }, { transform: 'translateY(30px)' }], { duration: 2300, fill: 'both' }));
      this.particles(fx, 950);
    } else {
      fx.innerHTML = `<b class="pool"></b>${ink(16, () => `<i class="bub" style="--x:${rnd(25, 75)}%;--d:${rnd(110, 230) * k}px;--s:${rnd(5, 12)}px"></i>`)}
        ${ink(10, () => `<i class="drip" style="--x:${rnd(32, 68)}%;--d:${rnd(30, 70) * k}px;--s:${rnd(3, 6)}px"></i>`)}`;
      fx.querySelector('.pool')!.animate([{ transform: 'translateX(-50%) scale(0, 0)', opacity: 0 }, { transform: 'translateX(-50%) scale(1, 1)', opacity: 1, offset: .25 }, { transform: 'translateX(-50%) scale(1.15, 1.1)', opacity: 1, offset: .7 }, { transform: 'translateX(-50%) scale(1.3, 1.2)', opacity: 0 }], { duration: 2200, fill: 'both', easing: 'ease-out' });
      this.particles(fx, 0);
    }
    this.on.sound?.('roar');
    this.animateKraken(card);
    void Promise.all(fx.getAnimations({ subtree: true }).map((a) => a.finished)).catch(() => undefined).then(() => fx.remove());
  }
  /** Bubbles rise, ink flies and drips; each particle's path comes from its CSS variables. */
  private particles(fx: HTMLElement, at: number) {
    fx.querySelectorAll<HTMLElement>('.drop').forEach((d) => d.animate([{ transform: 'rotate(var(--a)) translateX(0) scale(1)', opacity: 0 }, { opacity: 1, offset: .05 }, { transform: 'rotate(var(--a)) translateX(var(--d)) scale(.4)', opacity: 0 }], { duration: rnd(600, 950), delay: at + rnd(0, 120), easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' }));
    fx.querySelectorAll<HTMLElement>('.bub').forEach((d) => d.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { opacity: .9, offset: .15 }, { transform: 'translate(6px, calc(var(--d) * -1)) scale(1)', opacity: 0 }], { duration: rnd(900, 1500), delay: at + rnd(0, 700), easing: 'ease-out', fill: 'both' }));
    fx.querySelectorAll<HTMLElement>('.drip').forEach((d) => d.animate([{ transform: 'translateY(0) scaleY(.6)', opacity: 0 }, { opacity: 1, offset: .1 }, { transform: 'translateY(var(--d)) scaleY(1.4)', opacity: 0 }], { duration: rnd(600, 900), delay: 1100 + rnd(0, 600), easing: 'ease-in', fill: 'both' }));
  }
  /** The card's own part, picked up again where it was if the hand is redrawn mid-way. */
  private animateKraken(card: HTMLElement) {
    const it = this.krakenIntro!, dur = it.style === 'embrace' ? 2300 : 2200, t = performance.now() - it.t0;
    if (t >= dur) { this.krakenIntro = null; return; }
    const keys: Keyframe[] = it.style === 'embrace'
      ? [{ translate: '0 230px', rotate: '-8deg', opacity: 0, filter: 'brightness(.4)' }, { translate: '0 200px', opacity: 1, offset: .12 },
        { translate: '0 -34px', rotate: '3deg', filter: 'brightness(.8) drop-shadow(0 0 0 #b8312a)', offset: .4, easing: 'cubic-bezier(.3,1.5,.5,1)' },
        { translate: '0 0', rotate: '-1.5deg', filter: 'brightness(1.15) drop-shadow(0 0 16px #b8312a)', offset: .5 },
        { translate: '0 -3px', rotate: '1deg', offset: .56 }, { translate: '0 0', rotate: '0deg', offset: .62 },
        { translate: '0 0', rotate: '0deg', opacity: 1, filter: 'brightness(1) drop-shadow(0 0 0 #b8312a)' }]
      : [{ translate: '0 150px', scale: '1 .7', opacity: 0, filter: 'brightness(0)' }, { translate: '0 120px', opacity: 1, offset: .22 },
        { translate: '0 -22px', scale: '1 1.04', filter: 'brightness(.3)', offset: .5, easing: 'cubic-bezier(.3,1.4,.5,1)' },
        { translate: '0 4px', scale: '1 .98', filter: 'brightness(.75) drop-shadow(0 0 12px #b8312a)', offset: .62 },
        { translate: '0 0', scale: '1 1', opacity: 1, filter: 'brightness(1) drop-shadow(0 0 0 #b8312a)' }];
    card.animate(keys, { duration: dur, fill: 'backwards' }).currentTime = t;
  }

  /** Show the saved settings in the menu. */
  setPrefs(muted: boolean, quality: string) { this.muted = muted; this.qualityPref = quality; this.paintPrefs(); }
  private paintPrefs() {
    this.root.querySelectorAll<HTMLElement>('#menu .seg button').forEach((b) => {
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v;
      const on = pref === 'sound' ? (v === 'off') === this.muted : pref === 'quality' ? v === this.qualityPref
        : pref === 'kintro' ? v === this.kStyle : pref === 'ap' ? v === this.apMode : false;
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

  /** A small floating order beside a ship (right-click); null hides it. */
  shipMenu(at: { x: number; y: number; order: Mode; ok: boolean } | null, pick?: () => void) {
    const m = this.q<HTMLElement>('#shipMenu'), b = m.querySelector('button')!;
    if (!at) { m.hidden = true; return; }
    b.innerHTML = `<img src="/ui/tool_${at.order}.webp" alt=""><span>${at.order === 'turn' ? 'Turn her' : 'Sail her'}</span><i class="cost">1</i>`;
    b.disabled = !at.ok;
    b.title = at.ok ? '' : at.order === 'turn' ? 'She cannot turn now.' : 'She cannot make way now.';
    b.onclick = () => { m.hidden = true; pick?.(); };
    m.style.left = at.x + 14 + 'px'; m.style.top = at.y - 24 + 'px';
    m.hidden = false;
  }

  setHint(text: string) { this.q('#hint').textContent = text; }

  update(c: Client, mode: Mode, note = '') {
    const p = c.pub, me = c.side, foe = c.foeSide, mine = c.myTurn;
    // When the battle opens the desk is laid out piece by piece instead of appearing all at once.
    if (p.phase === 'battle' && this.root.dataset.phase !== 'battle') {
      this.root.classList.remove('deal'); void this.root.offsetWidth; this.root.classList.add('deal');
      setTimeout(() => this.root.classList.remove('deal'), 2600);
    }
    this.root.dataset.phase = p.phase;
    const i = mode === 'fire' ? 0 : mode === 'sail' ? 1 : mode === 'turn' ? 2 : 3, span = 180 / SECTORS.length;
    const mid = ((180 - span * i - span / 2) * Math.PI) / 180;
    this.lever.style.transform = `rotate(${90 - (Math.atan2(Math.sin(mid) * TG.ry, Math.cos(mid) * TG.rx) * 180) / Math.PI}deg)`;
    this.sectors.forEach(([path, t], k) => { path.classList.toggle('on', k === i); t.classList.toggle('on', k === i); });

    this.q('#turnTitle').textContent = p.phase === 'placement' ? 'Deploy your fleet' : p.phase === 'over' ? 'Battle over' : mine ? 'Your turn' : 'Enemy turn';
    this.q('#turnWx').textContent = p.phase === 'battle' && p.storm ? `Storm over rows ${p.storm.row + 1}–${p.storm.row + 3} · no guns or glasses there` : '';
    this.q('#turnSub').textContent = p.phase === 'battle' ? `Round ${p.round} · Wind ${['→ east', '↓ south', '← west', '↑ north'][p.wind ?? 0]}` : '';
    this.q('#seals').innerHTML = Array.from({ length: KRAKEN_SEALS }, (_, i) => `<i class="${i < me.seals ? 'lit' : ''}"></i>`).join('') + `<span>${me.seals >= KRAKEN_SEALS ? 'The Kraken will answer.' : `${Math.min(me.seals, KRAKEN_SEALS)} of ${KRAKEN_SEALS} seals`}</span>`;
    // The full explanation lives in the seals' tooltip; the panel keeps only what needs doing now.
    this.sealHelp = me.seals >= KRAKEN_SEALS
      ? 'Choose Summon the Kraken above the helm (3 AP), then a 3×3 patch of enemy water. It strikes now and again on their next turn, and holds the ships it finds.'
      : 'Three seals summon the Kraken. A red wax seal surfaces in your waters every few rounds: sail a ship onto it to take it. Each ship you lose also pays one.';
    this.q('#sealHow').innerHTML = me.seals >= KRAKEN_SEALS ? '' : p.treasures.some((t) => t.side === c.me && t.kind === 'seal') ? '<b>A seal is afloat in your waters now.</b>' : '';
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
      const pips = s.hits.map((h, i) => `<i class="${s.floods?.[i] ? 'flood' : h ? 'hit' : ''}"></i>`).join('');
      const hurt = s.hits.filter(Boolean).length, holed = (s.floods || []).filter(Boolean).length;
      const state = s.sunk ? 'Sunk' : s.chained ? 'Pinned by chain shot' : holed ? `${hurt} hit · ${holed} holed` : hurt ? `${hurt} of ${s.len} sections hit` : 'Sound';
      const trait = TRAIT_HELP[f.trait] ?? f.trait;
      return `<li class="${s.sunk ? 'sunk' : ''}${s.chained ? ' pinned' : ''}" data-cls="${esc(s.cls)}" data-state="${esc(state)}" data-trait="${esc(f.trait + ': ' + trait)}"><span class="pips">${pips}</span></li>`;
    }).join('');

    const belt: string[] = [];
    let orderCards: string[] = [];
    if (p.phase === 'battle') {
      // Each action carries its own explanation and, when it cannot be used, the reason why.
      const tool = (id: Mode, name: string, ap: number, ok: boolean, help: string, why = '') => {
        if (!ok && !why) why = p.phase !== 'battle' || !mine ? 'Wait for your turn.' : p.ap < ap ? `Needs ${ap} action point${ap === 1 ? '' : 's'}; you have ${p.ap}.` : 'Not now.';
        // An order card: the frame and its picture, the name and the cost in a wax seal.
        const pic = id === 'power' ? (role === 'admiral' ? 'escort' : 'reckoning') : id;
        const art = CARD_ART.has(id) || id === 'power' ? `background-image:url(/ui/cards/${pic}.webp)` : '';
        belt.push(`<button data-tool="${id}" data-name="${esc(name)}" data-ap="${ap}" data-help="${esc(help)}" data-why="${ok ? '' : esc(why)}" class="ocard${CARD_KIND[id] ? ' k-' + CARD_KIND[id] : ''}${mode === id ? ' on' : ''}${ok ? '' : ' off'}${art ? '' : ' noart'}" aria-disabled="${!ok}" aria-label="${esc(name)}, ${ap} AP"><span class="art" style="${art}"></span><span class="nm">${name.replace(/ ×\d+$/, '')}</span>${/×\d+$/.test(name) ? `<span class="many">${name.match(/×\d+$/)![0]}</span>` : ''}<span class="cost">${ap}</span></button>`);
      };
      // Fire, Sail and Turn are cards too; they always sit in the middle of the hand (placed below).
      orderCards = [];
      const order = (id: 'fire' | 'sail' | 'turn', name: string, help: string) => { const at = belt.length; tool(id, name, 1, mine && c.can(1), help); orderCards.push(belt.splice(at, 1)[0]); };
      order('sail', 'Sail', 'Pick one of your ships, then a square ahead of her bow. With the wind she makes a square more; square-rigged ships cannot sail into it.');
      order('fire', 'Fire', 'One shot at a square of enemy water.');
      order('turn', 'Turn', 'Pick one of your ships and swing her bow a quarter to port or starboard about her middle. Ships with two hits cannot turn.');
      const sunk = (kind: 'line' | 'frigate' | 'cutter', cls: string) => (c.alive(kind) ? '' : `Your ${cls} has been sunk.`);
      tool('broadside', TOOLS.broadside.name, 2, c.can(2) && c.alive('line'), `${TOOL_HELP.broadside.text} Needs your Ship of the Line afloat.`, sunk('line', 'Ship of the Line'));
      tool('chain', TOOLS.chain.name, 2, c.can(2) && c.alive('frigate'), `${TOOL_HELP.chain.text} Needs your Frigate afloat.`, sunk('frigate', 'Frigate'));
      tool('spy', TOOLS.spy.name, 1, c.can(1) && c.alive('cutter'), `${TOOL_HELP.spy.text} Needs your Cutter afloat.`, sunk('cutter', 'Cutter'));
      for (const id of [...new Set(me.items)]) {
        const n = me.items.filter((q) => q === id).length;
        tool(id, ITEMS[id].name + (n > 1 ? ` ×${n}` : ''), ITEMS[id].ap, c.can(ITEMS[id].ap) && !(id === 'winds' && p.windsUsed), `${ITEM_HELP[id]} Bought from the quartermaster; used up once played.`, id === 'winds' && p.windsUsed ? 'Trade Winds already blew this turn.' : '');
      }
      if (me.seals >= KRAKEN_SEALS || mode === 'kraken') tool('kraken', 'Summon the Kraken', 3, c.canKraken(), TOOL_HELP.kraken.text, p.kraken ? 'The Kraken is already abroad.' : '');
      if (!p.pacts?.[c.me] && c.ships.some((s) => !s.sunk && s.hits.some(Boolean) && s.kind !== 'merchant')) tool('pact', 'Blood Pact', 1, c.canPact(), TOOL_HELP.pact.text, c.ships.filter((s) => !s.sunk).length <= 1 ? 'Your last ship cannot be given up.' : '');
      if (role !== 'classic' && !p.power[c.me]) tool('power', CAPTAINS[role].power, 1, c.canPower(), `Your captain's power. ${CAPTAINS[role].powerText}`);
    }
    // Fire in the very middle with Sail and Turn either side, the rest of the hand split around them.
    // The card that was chosen before this redraw sinks back into the hand instead of vanishing from the raised spot.
    const wasOn = this.root.querySelector<HTMLElement>('#belt .ocard.on')?.dataset.tool;
    const half = Math.floor(belt.length / 2);
    if (p.phase === 'battle') belt.splice(half, 0, ...orderCards);
    this.q('#belt').innerHTML = belt.join('');
    // Fan the hand: each card turns a little about a point below the table.
    const cards = [...this.root.querySelectorAll<HTMLElement>('#belt .ocard')], n = cards.length;
    cards.forEach((el, i) => { const k = i - (n - 1) / 2; el.style.setProperty('--r', `${k * 4}deg`); el.style.setProperty('--y', `${Math.abs(k) * 4}px`); el.style.zIndex = String(10 + i); });
    const was = wasOn && wasOn !== mode ? cards.find((el) => el.dataset.tool === wasOn) : undefined;
    if (was) {
      was.style.transition = 'none'; was.classList.add('on'); void was.offsetWidth;
      was.style.transition = ''; requestAnimationFrame(() => was.classList.remove('on'));
    }
    this.root.querySelectorAll<HTMLElement>('.order').forEach((b) => b.classList.toggle('on', b.dataset.order === mode));
    // The Kraken's card makes an entrance the first time it comes into the hand.
    const kcard = cards.find((el) => el.dataset.tool === 'kraken');
    if (this.krakenSeen === false && kcard && !this.krakenIntro) this.playKraken();
    this.krakenSeen = !!kcard;
    if (kcard && this.krakenIntro) this.animateKraken(kcard);
    this.krakenReady = !!kcard && c.canKraken();
    this.q('#seals').classList.toggle('ready', this.krakenReady);
    const shownAp = Math.max(3, mine ? p.ap : 0);
    this.q('#apSeals').innerHTML = Array.from({ length: shownAp }, (_, k) => `<i class="${mine && k < p.ap ? '' : 'spent'}"></i>`).join('');

    const obj = this.q<HTMLElement>('#objective'), parts: string[] = [];
    if (role !== 'classic') {
      const crates = '<i></i>'.repeat(p.cargo) + '<i class="gone"></i>'.repeat(3 - p.cargo);
      const left = Math.max(0, SEASON - p.round + 1), mer = c.merchant;
      const way = mer ? N - 1 - Math.max(...shipCells(mer).map(([x]) => x)) : 0;
      parts.push(`<span><b>Cargo</b><span class="crates">${crates}</span></span>`);
      if (role === 'admiral') parts.push(`<span><b>Home port</b>${way} column${way === 1 ? '' : 's'} east</span>`);
      parts.push(`<span><b>Season closes</b>${p.phase === 'battle' ? `in ${left} round${left === 1 ? '' : 's'}` : `after round ${SEASON}`}</span>`);
    }
    if (p.kraken) parts.push(`<span><b>The Kraken</b>holds ${p.kraken.side === c.me ? 'your' : 'enemy'} ships</span>`);
    // The maelstrom gauge: a brass instrument whose whirlpool turns faster as the next ring nears.
    const g = this.q<HTMLElement>('#mael'), left = maelstromIn(p);
    g.hidden = p.mode !== 'classic' || p.phase !== 'battle';
    if (!g.hidden) {
      g.classList.toggle('soon', left === 1); g.classList.toggle('spent', left === null);
      g.querySelector('b')!.textContent = left === null ? '—' : String(left);
      g.querySelector('small')!.textContent = left === null ? 'spent' : left === 1 ? 'next round' : 'rounds';
      g.querySelectorAll('.notch').forEach((n, k) => n.classList.toggle('lit', k < p.ring));
      g.style.setProperty('--spin', `${left === null ? 0 : Math.max(1.2, Math.min(14, left * 0.9))}s`);
      this.maelHelp = left === null ? 'The maelstrom is spent: five rings have gone under and the middle 6×6 of each chart remains.'
        : `From round 20 the maelstrom swallows the outer ring of both charts every other round, sinking whatever lies there, until the middle 6×6 remains. ${p.ring} of 5 rings drowned. ${left === 1 ? 'The next ring goes under at the start of the next round — the marked squares.' : `The next ring goes under in ${left} rounds.`}`;
    }
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
