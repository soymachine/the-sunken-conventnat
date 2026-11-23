// Oak-and-brass HUD drawn with DOM + SVG over the 3D canvas.
import { CMDS, CMD_USES, Client, Cmd, TIDE, GALE_EVERY, SEASON, SPY, krakenSeals, maelstromIn, mayBuy, price, roleOf } from '../game/engine';
import { CMD_INFO } from './commanders';
import { colourBlind } from './palette';
import { CursorStyle, applyCursors } from './cursors';
import { Lang, getLang, setLang } from './i18n';
import { openHowTo } from './howto';
import { openLog } from './captain';
import { openShipViewer } from './shipViewer';
import { accountsAvailable } from '../net/account';
import { installTuner } from './tuner';
import { ITEMS, ITEM_HELP, ITEM_IDS, Item, MAX_ITEMS } from '../game/powerups';
import { FLEETS, KRAKEN_SEALS, N, Role, shipCells } from '../game/rules';

export type Tool = 'broadside' | 'chain' | 'spy' | Item | 'bindLater' | 'bindSooner' | 'squall' | 'gale' | 'sound' | 'double';
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
const CARD_KIND: Record<string, string> = { fire: 'shot', broadside: 'shot', chain: 'shot', fireship: 'shot', double: 'shot', sail: 'move', turn: 'move', current: 'move', winds: 'move', squall: 'move', gale: 'move', bindLater: 'move', bindSooner: 'move', kraken: 'kraken' };
/** The order of the hand: moving, then firing, then looking, then the rest (left to right). */
const HAND_ORDER = ['sail', 'turn', 'current', 'winds', 'squall', 'gale', 'bindLater', 'bindSooner',
  'fire', 'broadside', 'chain', 'fireship', 'double',
  'spy', 'spyglass', 'longglass', 'sound', 'fog',
  'shipwright', 'pact', 'power', 'kraken'];
/** A card may borrow another's picture (none do now that the commanders' cards have their own). */
const ART_STAND_IN: Record<string, string> = {};
const CARD_ART = new Set(['squall', 'gale', 'sound', 'double', 'bindLater', 'bindSooner', 'fire', 'sail', 'turn', 'broadside', 'chain', 'spy', 'spyglass', 'longglass', 'fireship', 'fog', 'shipwright', 'winds', 'current', 'pact', 'kraken']);
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
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

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
  sound?(name: 'roar' | 'splash' | 'cardHover' | 'cardPlay' | 'cardDeal' | 'denied' | 'paper' | 'click'): void;
  /** Colour-blind colours on the charts (vermilion and sky blue for red and amber). */
  colourBlind?(on: boolean): void;
  /** A channel's volume, 0..1 (music, effects, ambience, interface). */
  volume?(k: 'music' | 'sfx' | 'ambience' | 'ui', v: number): void;
  letterRead(): void;
  buy(item: Item): void;
  endTurn(): void;
  shuffle(): void;
  rotate(): void;
  ready(): void;
  leave(): void;
  /** Against the machine: the same battle again, with a fresh lot. */
  rematch?(): void;
}

export class Hud {
  private root: HTMLElement;
  private lever!: SVGGElement;
  private sectors: [SVGPathElement, SVGTextElement][] = [];
  private balls: SVGGElement[] = [];
  private capTurns = 0;
  private krakenReady = false;
  private cursor: CursorStyle = (() => { try { const v = localStorage.getItem('tsc:cursor'); return v === 'quill' || v === 'system' ? v : 'brass'; } catch { return 'brass' as const; } })();
  private krakenSeen: boolean | null = null;
  /** What the hand, the action points and the purse were at the last redraw, to animate what changed. */
  private prevHand: Set<string> | null = null;
  private prevAp = -1; private prevGold = -1; private prevSeals = -1; private goldTween = 0;
  private hoverCard = '';
  private logEntries: { text: string; kind: string; round: number }[] = [];
  private round = 0;
  /** Open or close the battle's log (set up in the constructor). */
  toggleLog: (open?: boolean) => void = () => {};
  private sealHelp = '';
  private maelHelp = '';
  private muted = false;
  private qualityPref = 'auto';
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(private on: HudHandlers) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <header class="rail top">
        <div class="turn"><button id="menuBtn" class="mini" aria-expanded="false" aria-controls="menu">Settings</button><button id="howBtn" class="mini" aria-label="How to play" title="How to play">?</button><button id="logBtn" class="mini" aria-expanded="false" aria-controls="logPanel" title="Everything that has happened in this battle (L)">Log</button></div>
        <h1 class="title"><span>The Sunken Covenant</span></h1>
        <div class="windg" id="windg" hidden tabindex="0" aria-label="Wind">
            <img class="hanger" src="/ui/mael_hanger.webp" alt="" draggable="false">
            <img class="face" src="/ui/mael_face.webp" alt="" draggable="false">
            <svg class="rose" viewBox="0 0 100 100" aria-hidden="true">
              ${Array.from({ length: 32 }, (_, i) => { const a = i * 11.25 * Math.PI / 180, r1 = i % 8 === 0 ? 30 : i % 2 ? 36 : 33.5; return `<line x1="${(50 + r1 * Math.sin(a)).toFixed(1)}" y1="${(50 - r1 * Math.cos(a)).toFixed(1)}" x2="${(50 + 39 * Math.sin(a)).toFixed(1)}" y2="${(50 - 39 * Math.cos(a)).toFixed(1)}" stroke="#a9c3bf" stroke-width="${i % 8 === 0 ? 1.4 : 0.6}" opacity=".8"/>`; }).join('')}
              <path d="M50 22 L53.5 46.5 L78 50 L53.5 53.5 L50 78 L46.5 53.5 L22 50 L46.5 46.5 Z" fill="#7d9c98" opacity=".32"/>
              ${['N', 'E', 'S', 'W'].map((t, i) => `<text x="${(50 + 23.5 * Math.sin(i * Math.PI / 2)).toFixed(1)}" y="${(50 - 23.5 * Math.cos(i * Math.PI / 2) + 3.6).toFixed(1)}" text-anchor="middle" class="pt">${t}</text>`).join('')}
              <g class="needle"><path d="M50 17 L54.2 50 L50 57 L45.8 50 Z" fill="#c0392b" stroke="#2a1e08" stroke-width=".7"/><path d="M50 83 L53.6 50 L50 57 L46.4 50 Z" fill="#eadfc4" stroke="#2a1e08" stroke-width=".7"/></g>
              <circle cx="50" cy="50" r="4.2" fill="#c9a24d" stroke="#2a1e08" stroke-width=".8"/><circle cx="48.8" cy="48.8" r="1.4" fill="#f6dc95"/>
            </svg>
            <img class="bezel" src="/ui/mael_bezel.webp" alt="" draggable="false">
            <small></small>
        </div>
        <div class="foe"><span id="foeNote"></span>
          <div class="mael" id="mael" hidden tabindex="0" aria-label="Maelstrom">
            <img class="hanger" src="/ui/mael_hanger.webp" alt="" draggable="false">
            <img class="face" src="/ui/mael_face.webp" alt="" draggable="false">
            <img class="swirl" src="/ui/mael_swirl.webp" alt="" draggable="false">
            <img class="bezel" src="/ui/mael_bezel.webp" alt="" draggable="false">
            ${[0, 1, 2, 3, 4].map((k) => { const a = (90 + 48 - k * 24) * Math.PI / 180; return `<i class="notch" style="left:${(50 + 43 * Math.cos(a)).toFixed(1)}%;top:calc(50% + var(--lamp-dir, 1) * ${(43 * Math.sin(a)).toFixed(1)}%)"></i>`; }).join('')}
            <b></b><small></small>
          </div>
        </div>
        <div class="status" role="status"><b id="turnTitle"></b><span id="turnSub"></span><em id="turnWx"></em><div class="objective" id="objective" hidden></div><p id="placeHint"></p></div>
      </header>
      <div class="menu card" id="menu" hidden>
        <h2>Settings</h2>
        <button type="button" class="plaque dark howRow" id="howMenu">How to play</button>
        <button type="button" class="plaque dark howRow" id="logMenu">Captain's Log</button>
        <button type="button" class="plaque dark howRow" id="shipsMenu">3D Ships</button>
        <button type="button" class="plaque dark howRow" id="fullMenu">Full screen</button>
        <p class="opt">Language</p>
        <div class="seg" data-pref="lang" role="radiogroup" aria-label="Language" translate="no"><button data-v="en" role="radio">English</button><button data-v="es" role="radio">Español</button></div>
        <p class="opt">Sound</p>
        <div class="seg" data-pref="sound" role="radiogroup" aria-label="Sound"><button data-v="on" role="radio">On</button><button data-v="off" role="radio">Off</button></div>
        <div class="vols">${[['music', 'Music'], ['sfx', 'Effects'], ['ambience', 'Ambience'], ['ui', 'Interface']].map(([k, n]) => `<label><span>${n}</span><input type="range" min="0" max="1" step="0.05" data-vol="${k}" aria-label="${n}"></label>`).join('')}</div>
        <p class="opt">Colour-blind colours</p>
        <div class="seg" data-pref="cvd" role="radiogroup" aria-label="Colour-blind colours"><button data-v="off" role="radio">Off</button><button data-v="on" role="radio">On</button></div>
        <p class="opt">3D quality</p>
        <div class="seg" data-pref="quality" role="radiogroup" aria-label="3D quality"><button data-v="auto" role="radio">Auto</button><button data-v="high" role="radio">High</button><button data-v="low" role="radio">Low</button></div>
        <div class="debug" hidden><p class="opt">Debug</p><div class="seg three"><button type="button" data-cheat="gold">+100 gold</button><button type="button" data-cheat="seals">+3 seals</button><button type="button" data-cheat="ap">+3 AP</button></div>
          <p class="opt">Sky</p><div class="seg three" data-pref="sky"><button type="button" data-v="sun">Sun rays</button><button type="button" data-v="aurora">Aurora</button><button type="button" data-v="clear">Clear</button></div>
          <p class="opt">Pointer</p><div class="seg three" data-pref="cursor"><button type="button" data-v="brass">Brass</button><button type="button" data-v="quill">Quill</button><button type="button" data-v="system">System</button></div>
          <p class="opt">Sounds</p><a class="plaque dark howRow" href="/admin.html" target="_blank" rel="noopener">Sound desk</a></div>
        <p class="meta">Auto steps down by itself if the game runs slowly. Low drops shadows, glow and the print grade.</p>
      </div>
      <div class="logPanel card" id="logPanel" hidden><h2>Captain's log</h2><ol></ol><p class="meta">Newest first. Press L to open or close.</p></div>
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
      <img class="portrait mine" alt="" hidden draggable="false"><img class="portrait foe" alt="" hidden draggable="false">
      <aside class="card left">
        <div class="myCmd" id="myCmd" hidden tabindex="0"></div>
        <h2>The covenant</h2><div class="seals" id="seals" tabindex="0" aria-describedby="shopTip"></div><p class="howto" id="sealHow"></p>
        <h2>Admiralty orders</h2><p id="orderText"></p><p id="orderMeta" class="meta"></p>
        <h2 class="money" id="money" tabindex="0" aria-haspopup="true" aria-controls="shopPop">Money <span><span id="gold" title="Doubloons"></span><em>Buy ›</em></span></h2>
        <h2>Your fleet</h2><ul id="fleet"></ul>
      </aside>
      <div class="shopPop card" id="shopPop" hidden><h2>Quartermaster</h2><ul id="shop"></ul></div>
      <aside class="card right"><h2>Enemy fleet</h2><p id="foeName"></p><div class="myCmd foe" id="foeCmd" hidden tabindex="0"></div><p class="meta" id="foeSeals"></p><ul id="foeFleet"></ul></aside>
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
      <div class="over" hidden><div class="card"><p class="eyebrow">Battle report</p><h2 id="overTitle"></h2><p id="overText"></p><dl class="stats" id="overStats"></dl><p id="overVerify" class="meta"></p><div class="overBtns"><button class="plaque" id="rematch" hidden>Rematch</button><button class="plaque" id="leave">Back to port</button></div></div></div>`;
    this.telegraph(this.q('.telegraph'));
    applyCursors(this.cursor);
    // How to play, from the beam or the settings.
    this.q<HTMLElement>('#howBtn').onclick = () => openHowTo();
    this.q<HTMLElement>('#howMenu').onclick = () => { this.q<HTMLElement>('#menu').hidden = true; openHowTo(); };
    this.q<HTMLElement>('#logMenu').onclick = () => { this.q<HTMLElement>('#menu').hidden = true; void openLog(); };
    this.q<HTMLElement>('#logMenu').hidden = !accountsAvailable;
    this.q<HTMLElement>('#shipsMenu').onclick = () => { this.q<HTMLElement>('#menu').hidden = true; void openShipViewer(); };
    // The action points sit under the turn header, where the eye goes as a turn begins.
    this.q('#turnSub').after(this.q('#apSeals'));
    // The latest event reads right under them: lower down, a raised card would cover it.
    const toast = this.q<HTMLElement>('#toast');
    this.q('#apSeals').after(toast);
    toast.addEventListener('animationend', () => toast.classList.remove('show'));
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
    this.q<HTMLElement>('#rematch').onclick = () => on.rematch?.();
    this.q<HTMLElement>('#roleOk').onclick = () => { this.q<HTMLElement>('.role').hidden = true; };
    // Settings: sound and 3D quality, in a small parchment menu at the top left.
    const menu = this.q<HTMLElement>('#menu'), menuBtn = this.q<HTMLElement>('#menuBtn');
    const show = (open: boolean) => { if (open && menu.hidden) on.sound?.('paper'); menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.onclick = (e) => { e.stopPropagation(); show(menu.hidden === true); };
    addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== menuBtn) show(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { show(false); this.shipMenu(null); } });
    // Debug tools, only when the address carries ?debug=true.
    if (new URLSearchParams(location.search).get('debug') === 'true' && on.cheat) {
      this.q<HTMLElement>('#menu .debug').hidden = false;
      installTuner(this.root);
      this.root.querySelectorAll<HTMLElement>('[data-cheat]').forEach((b) => (b.onclick = () => on.cheat!(b.dataset.cheat as 'gold' | 'seals' | 'ap')));
    }
    menu.addEventListener('input', (e) => {
      const i = e.target as HTMLInputElement;
      if (i.dataset.vol) on.volume?.(i.dataset.vol as 'music', +i.value);
    });
    // Full screen, and the button says which way it goes.
    const full = this.q<HTMLElement>('#fullMenu');
    full.onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
    addEventListener('fullscreenchange', () => { full.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; });
    menu.onclick = (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.seg button');
      if (!b) return;
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v!;
      if (pref === 'sound' && (v === 'off') !== this.muted) this.muted = on.mute();
      if (pref === 'quality') { on.quality(v as 'auto' | 'high' | 'low'); this.qualityPref = v; }
      if (pref === 'cvd') on.colourBlind?.(v === 'on');
      if (pref === 'sky') on.sky?.(v as 'sun' | 'aurora' | 'clear');
      if (pref === 'lang') { setLang(v as Lang); this.paintPrefs(); }
      if (pref === 'cursor') { this.cursor = v as CursorStyle; applyCursors(this.cursor); try { localStorage.setItem('tsc:cursor', v); } catch { /* ignore */ } }
      this.paintPrefs();
    };
    // The quartermaster explains each item on hover: what it does, its price, and why you cannot buy it yet.
    const shop = this.q<HTMLElement>('#shop'), tip = this.q<HTMLElement>('#shopTip');
    shop.addEventListener('pointerover', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-item]');
      if (!b) return;
      const id = b.dataset.item as Item, it = ITEMS[id];
      tip.innerHTML = `<b>${it.name}</b><span class="cost">${b.dataset.price ?? it.price} doubloons · ${it.ap} AP</span><p>${esc(ITEM_HELP[id])}</p>${b.dataset.why ? `<p class="why">${esc(b.dataset.why)}</p>` : ''}`;
      const r = b.getBoundingClientRect(), panel = shop.closest('.card')!.getBoundingClientRect();
      tip.style.left = panel.right + 10 + 'px';
      tip.style.top = Math.min(innerHeight - 220, r.top - 6) + 'px';
      tip.hidden = false;
    });
    shop.addEventListener('pointerleave', () => { tip.hidden = true; });
    // The quartermaster opens beside the panel while the pointer is over Money (or the list itself).
    const money = this.q<HTMLElement>('#money'), pop = this.q<HTMLElement>('#shopPop');
    let closing = 0;
    const open = () => {
      clearTimeout(closing);
      const r = money.getBoundingClientRect(), panel = money.closest('.card')!.getBoundingClientRect();
      pop.hidden = false;
      pop.style.left = panel.right + 6 + 'px';
      pop.style.top = Math.max(70, Math.min(innerHeight - pop.offsetHeight - 170, r.top - 14)) + 'px';
    };
    const close = () => { clearTimeout(closing); closing = window.setTimeout(() => { pop.hidden = true; tip.hidden = true; }, 220); };
    for (const el of [money, pop]) { el.addEventListener('pointerenter', open); el.addEventListener('pointerleave', close); }
    money.addEventListener('focus', open); money.addEventListener('blur', close);
    // Enemy ships: each group of squares names her and her speciality.
    const foeFleet = this.q<HTMLElement>('#foeFleet');
    foeFleet.addEventListener('pointerover', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('li[data-cls]');
      if (!li) return;
      tip.innerHTML = `<b>${esc(li.dataset.cls!)}</b><span class="cost">${esc(li.dataset.state!)}</span><p>${esc(li.dataset.trait!)}</p>`;
      const r = li.getBoundingClientRect(), panel = li.closest('.card')!.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = panel.left - tip.offsetWidth - 10 + 'px'; tip.style.top = r.top - 30 + 'px';
    });
    foeFleet.addEventListener('pointerleave', () => { tip.hidden = true; });
    // The covenant's seals explain themselves on hover (or focus).
    const seals = this.q<HTMLElement>('#seals');
    const showSeals = () => {
      tip.innerHTML = `<b>The covenant</b><span class="cost">Seals summon the Kraken</span><p>${esc(this.sealHelp)}</p>`;
      const r = seals.getBoundingClientRect(), panel = seals.closest('.card')!.getBoundingClientRect();
      tip.style.left = panel.right + 10 + 'px'; tip.style.top = r.top - 6 + 'px'; tip.hidden = false;
    };
    seals.addEventListener('pointerenter', showSeals); seals.addEventListener('focus', showSeals);
    // The wind gauge explains itself on hover, below it.
    const windg = this.q<HTMLElement>('#windg');
    const showWind = () => {
      tip.innerHTML = `<b>The wind</b><span class="cost">${esc(windg.querySelector('small')!.textContent ?? '')}</span><p>${esc(this.windHelp)}</p>`;
      const r = windg.getBoundingClientRect(); tip.hidden = false;
      tip.style.left = Math.max(8, r.left) + 'px'; tip.style.top = r.bottom + 8 + 'px';
    };
    windg.addEventListener('pointerenter', showWind); windg.addEventListener('focus', showWind);
    windg.addEventListener('pointerleave', () => { tip.hidden = true; }); windg.addEventListener('blur', () => { tip.hidden = true; });
    this.animateWind(windg.querySelector<SVGGElement>('.needle')!);
    const mael = this.q<HTMLElement>('#mael');
    const showMael = () => {
      tip.innerHTML = `<b>The maelstrom</b><span class="cost">The sea closes in</span><p>${esc(this.maelHelp)}</p>`;
      const r = mael.getBoundingClientRect(); tip.hidden = false;
      tip.style.left = Math.max(8, r.right - tip.offsetWidth) + 'px'; tip.style.top = r.bottom + 8 + 'px';
    };
    mael.addEventListener('pointerenter', showMael); mael.addEventListener('focus', showMael);
    mael.addEventListener('pointerleave', () => { tip.hidden = true; }); mael.addEventListener('blur', () => { tip.hidden = true; });
    seals.addEventListener('pointerleave', () => { tip.hidden = true; }); seals.addEventListener('blur', () => { tip.hidden = true; });
    // A commander's card: power, passive and drawback, beside the panel.
    for (const id of ['#myCmd', '#foeCmd']) {
      const el = this.q<HTMLElement>(id);
      const show = () => {
        const k = el.dataset.cmd as keyof typeof CMD_INFO | undefined, i = k ? CMD_INFO[k] : null;
        if (!i) return;
        tip.innerHTML = `<b>${i.name}</b><span class="cost">“${esc(i.motto)}”</span><p>${esc(i.power)}</p>${i.passive ? `<p>${esc(i.passive)}</p>` : ''}<p class="why">${esc(i.drawback)}</p>`;
        const r = el.getBoundingClientRect(), panel = el.closest('.card')!.getBoundingClientRect();
        tip.hidden = false;
        tip.style.left = (id === '#myCmd' ? panel.right + 10 : panel.left - tip.offsetWidth - 10) + 'px'; tip.style.top = r.top - 6 + 'px';
      };
      el.addEventListener('pointerenter', show); el.addEventListener('focus', show);
      el.addEventListener('pointerleave', () => { tip.hidden = true; }); el.addEventListener('blur', () => { tip.hidden = true; });
    }
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
    this.q<HTMLElement>('#belt').onclick = (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button'); if (!b) return;
      if (!b.classList.contains('off')) { on.mode(b.dataset.tool as Mode); return; }
      // A card that cannot be played shakes its head.
      on.sound?.('denied');
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
    };
    // The log of the battle, folded away under its button (L).
    const logBtn = this.q<HTMLElement>('#logBtn'), logPanel = this.q<HTMLElement>('#logPanel');
    this.toggleLog = (open: boolean = logPanel.hidden === true) => {
      if (open && logPanel.hidden) { this.paintLog(); on.sound?.('paper'); }
      logPanel.hidden = !open; logBtn.setAttribute('aria-expanded', String(open));
    };
    logBtn.onclick = (e) => { e.stopPropagation(); this.toggleLog(); };
    addEventListener('pointerdown', (e) => { if (!logPanel.hidden && !logPanel.contains(e.target as Node) && e.target !== logBtn) this.toggleLog(false); });
    // The same tooltip explains the special actions above the helm, shown above the button.
    const belt = this.q<HTMLElement>('#belt');
    belt.addEventListener('pointerover', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-tool]');
      if (!b) return;
      if (b.dataset.tool !== this.hoverCard) { this.hoverCard = b.dataset.tool!; on.sound?.('cardHover'); }
      tip.innerHTML = `<b>${esc(b.dataset.name!)}</b><span class="cost">${b.dataset.ap} AP</span><p>${esc(b.dataset.help!)}</p>${b.dataset.why ? `<p class="why">${esc(b.dataset.why)}</p>` : ''}`;
      tip.hidden = false;
      // Above the card once it has risen out of the hand.
      const r = b.getBoundingClientRect(), w = tip.offsetWidth, risen = innerHeight + 46 - 151 - 62 - 24;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tip.style.top = risen - tip.offsetHeight - 14 + 'px';
    });
    belt.addEventListener('pointerleave', () => { tip.hidden = true; this.hoverCard = ''; });
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

  /** The Kraken's card comes into the hand like any other, with a little ink and a few bubbles about it. */
  private playKraken(card: HTMLElement) {
    const r = card.getBoundingClientRect();
    const fx = this.root.appendChild(document.createElement('div'));
    fx.className = 'kfx';
    Object.assign(fx.style, { left: `${r.left - r.width * 0.5}px`, top: `${r.top - r.height * 0.4}px`, width: `${r.width * 2}px`, height: `${r.height * 1.4}px` });
    const many = (n: number, html: () => string) => Array.from({ length: n }, html).join('');
    fx.innerHTML = many(14, () => `<i class="drop" style="--a:${rnd(180, 360)}deg;--d:${rnd(40, 95)}px;--s:${rnd(3, 7)}px"></i>`)
      + many(12, () => `<i class="bub" style="--x:${rnd(30, 70)}%;--d:${rnd(70, 150)}px;--s:${rnd(4, 9)}px"></i>`);
    fx.querySelectorAll<HTMLElement>('.drop').forEach((d) => d.animate([{ transform: 'rotate(var(--a)) translateX(0) scale(1)', opacity: 0 }, { opacity: 1, offset: .08 }, { transform: 'rotate(var(--a)) translateX(var(--d)) scale(.3)', opacity: 0 }], { duration: rnd(650, 1000), delay: rnd(0, 250), easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' }));
    fx.querySelectorAll<HTMLElement>('.bub').forEach((d) => d.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { opacity: .9, offset: .15 }, { transform: `translate(${rnd(-10, 10)}px, calc(var(--d) * -1)) scale(1)`, opacity: 0 }], { duration: rnd(900, 1500), delay: rnd(0, 600), easing: 'ease-out', fill: 'both' }));
    card.animate([{ filter: 'drop-shadow(0 0 0 #b8312a)' }, { filter: 'drop-shadow(0 0 14px #b8312a)', offset: .3 }, { filter: 'drop-shadow(0 0 0 #b8312a)' }], { duration: 1400 });
    void Promise.all(fx.getAnimations({ subtree: true }).map((an) => an.finished)).catch(() => undefined).then(() => fx.remove());
  }

  /** The paper tooltip beside the pointer for one of your ships on the chart (by her place in Your fleet). */
  private tipShip: number | null = null;
  shipTip(i: number | null, x: number, y: number) {
    const tip = this.q<HTMLElement>('#shopTip'), li = i === null ? null : this.root.querySelectorAll<HTMLElement>('#fleet li[data-cls]')[i];
    if (!li) { if (this.tipShip !== null) tip.hidden = true; this.tipShip = null; return; }
    if (this.tipShip !== i) tip.innerHTML = `<b>${esc(li.dataset.cls!)}</b><span class="cost">${esc(li.dataset.state!)}</span><p>${esc(li.dataset.trait!)}</p>`;
    this.tipShip = i; tip.hidden = false;
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, x + 18) + 'px';
    tip.style.top = Math.min(innerHeight - tip.offsetHeight - 8, y + 18) + 'px';
  }

  private windTo: number | null = 0;
  private windHelp = '';
  /**
   * The needle swings to the wind with a little overshoot, then trembles: small quick shivers and, now and then, a
   * gust that pushes it wider. In a calm it wanders slowly with no heading.
   */
  private animateWind(needle: SVGGElement) {
    let ang = 0, vel = 0, gust = 0, nextGust = 3, drift = 0, last = performance.now(), first = true;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
      if ((nextGust -= dt) < 0) { gust = 1; nextGust = 4 + Math.random() * 7; }
      gust = Math.max(0, gust - dt * 0.7);
      let target: number;
      if (this.windTo === null) { drift += (Math.random() - 0.5) * dt * 40; drift *= 0.995; target = ang + drift * dt * 6; }
      else {
        // Take the short way round to the new heading.
        let to = this.windTo; while (to - ang > 180) to -= 360; while (to - ang < -180) to += 360;
        if (first) { ang = to; first = false; }
        const shiver = 1.6 * Math.sin(t * 13.1) + 1.1 * Math.sin(t * 7.3 + 1.7) + gust * (9 * Math.sin(t * 4.1) + 4 * Math.sin(t * 11.7));
        target = to + shiver;
      }
      // A damped spring: it overshoots a little when the wind veers.
      vel += ((target - ang) * 26 - vel * 7.5) * dt; ang += vel * dt;
      needle.setAttribute('transform', `rotate(${ang.toFixed(2)} 50 50)`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** The commander's choice, in a sheet of its own as the battle is set up: resolves with the pick (null for none). */
  chooseCommander(current: Cmd | null): Promise<Cmd | null> {
    let pick: Cmd | null = current;
    try { if (!pick) { const v = localStorage.getItem('tsc:cmd'); pick = CMDS.includes(v as Cmd) ? (v as Cmd) : null; } } catch { /* ignore */ }
    const box = this.root.appendChild(document.createElement('div'));
    box.className = 'cmdModal';
    box.innerHTML = `<div class="card" role="dialog" aria-labelledby="cmdHead">
      <h2 id="cmdHead">Choose your commander</h2>
      <p class="meta">Optional. Each brings a power and a drawback; the other captain sees your choice when the battle begins.</p>
      <div class="cmds" role="radiogroup" aria-labelledby="cmdHead">
        <button class="cmd" data-cmd="" role="radio"><i>—</i><b>None</b></button>
        ${CMDS.map((k) => `<button class="cmd" data-cmd="${k}" role="radio"><i class="face" style="background-image:url(/ui/cmd/${k}_face.webp)"></i><b>${CMD_INFO[k].name.replace('The ', '')}</b></button>`).join('')}
      </div>
      <p class="cmdHelp"></p>
      <button class="plaque" type="button" data-act="ok">Take command</button>
    </div>`;
    const help = (k: Cmd | null) => {
      const i = k ? CMD_INFO[k] : null;
      box.querySelector('.cmdHelp')!.innerHTML = i ? `<b>${i.name}</b> <span class="motto">“${esc(i.motto)}”</span><br>${esc(i.power)}${i.passive ? `<br>${esc(i.passive)}` : ''}<br><span class="minus">${esc(i.drawback)}</span>`
        : 'No commander: plain Classic, as it has always been played.';
    };
    const paint = () => box.querySelectorAll<HTMLElement>('.cmd').forEach((b) => { const on = (b.dataset.cmd || null) === pick; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    box.querySelectorAll<HTMLButtonElement>('.cmd').forEach((b) => {
      const k = (b.dataset.cmd || null) as Cmd | null;
      b.onclick = () => { pick = k; paint(); help(pick); };
      b.onpointerenter = () => help(k); b.onpointerleave = () => help(pick);
    });
    // Keep the sheet one height whichever commander is described: as tall as the longest description.
    const helpEl = box.querySelector<HTMLElement>('.cmdHelp')!;
    helpEl.style.minHeight = Math.max(...[null, ...CMDS].map((k) => { help(k); return helpEl.offsetHeight; })) + 'px';
    paint(); help(pick);
    return new Promise((done) => {
      box.querySelector<HTMLElement>('[data-act=ok]')!.onclick = () => {
        try { localStorage.setItem('tsc:cmd', pick ?? ''); } catch { /* ignore */ }
        box.remove(); done(pick);
      };
    });
  }

  /** Show the saved settings in the menu. */
  setPrefs(muted: boolean, quality: string, vol?: Record<string, number>) {
    this.muted = muted; this.qualityPref = quality; this.paintPrefs();
    if (vol) this.root.querySelectorAll<HTMLInputElement>('[data-vol]').forEach((i) => { i.value = String(vol[i.dataset.vol!] ?? 1); });
  }
  private paintPrefs() {
    this.root.querySelectorAll<HTMLElement>('#menu .seg button').forEach((b) => {
      const pref = b.parentElement!.dataset.pref, v = b.dataset.v;
      const on = pref === 'sound' ? (v === 'off') === this.muted : pref === 'quality' ? v === this.qualityPref : pref === 'cursor' ? v === this.cursor : pref === 'lang' ? v === getLang() : pref === 'cvd' ? (v === 'on') === colourBlind : false;
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
    this.round = p.phase === 'battle' ? p.round : 0;
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
    this.q('#turnWx').textContent = p.phase === 'battle' && p.storm ? `Storm over ${(p.storm.rows ?? 3) === 1 ? `row ${p.storm.row + 1}` : `rows ${p.storm.row + 1}–${p.storm.row + (p.storm.rows ?? 3)}`} · no guns or glasses there` : '';
    this.q('#turnSub').textContent = p.phase === 'battle' ? `Round ${p.round}` : '';
    // The wind gauge: its needle points where the wind blows, and trembles with it.
    const wg = this.q<HTMLElement>('#windg'), w = p.wind ?? 0;
    wg.hidden = p.phase !== 'battle';
    this.windTo = w < 0 ? null : w * 90 + 90; // the needle is drawn pointing north; heading 0 is east
    wg.classList.toggle('calm', w < 0);
    wg.querySelector('small')!.textContent = w < 0 ? 'Flat calm' : ['east', 'south', 'west', 'north'][w];
    this.windHelp = w < 0 ? 'A flat calm this round: the wind helps and hinders no ship.'
      : `The wind blows ${['east', 'south', 'west', 'north'][w]} this round. A ship sailing with it makes a square more; square-rigged ships (Ship of the Line, Frigate) cannot sail into it, and fore-and-aft rigs lose a square against it. Across the wind it changes nothing, and the Ironclad's steam ignores it. It veers each round, and one round in five is a flat calm.`;
    const need = krakenSeals(me);
    // A seal just won is pressed into place.
    const stamp = this.prevSeals >= 0 && me.seals > this.prevSeals;
    this.q('#seals').innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < me.seals ? 'lit' : ''}${stamp && i >= this.prevSeals && i < me.seals ? ' stamp' : ''}"></i>`).join('') + `<span>${me.seals >= need ? 'The Kraken will answer.' : `${Math.min(me.seals, need)} of ${need} seals`}</span>`;
    // Each captain's commander, named in their panel; the full card shows on hover.
    // Mine shows as soon as it is chosen (before Ready makes it public); theirs once they are ready.
    for (const [id, side] of [['#myCmd', { ...me, cmd: me.cmd ?? c.cmd }], ['#foeCmd', foe]] as const) {
      const el = this.q<HTMLElement>(id), info = side.cmd ? CMD_INFO[side.cmd] : null;
      el.hidden = !info;
      // Their portrait stands behind the panel, half-length, looking across the table (the enemy's is mirrored).
      const img = this.q<HTMLImageElement>(id === '#myCmd' ? '.portrait.mine' : '.portrait.foe'), src = side.cmd ? `/ui/cmd/${side.cmd}${id === '#foeCmd' ? '_left' : ''}.webp` : '';
      this.root.classList.toggle(id === '#myCmd' ? 'with-mine' : 'with-foe', !!src);
      if (!src) img.hidden = true;
      else if (img.dataset.src !== src) { img.dataset.src = src; img.hidden = true; img.onload = () => { img.hidden = false; }; img.onerror = () => { img.hidden = true; }; img.src = src; }
      if (info) { el.innerHTML = `<i class="face" style="background-image:url(/ui/cmd/${side.cmd}_face${id === '#foeCmd' ? '_left' : ''}.webp)"></i><span>${id === '#myCmd' ? 'Your commander' : 'Their commander'}<b>${info.name}</b></span>`; el.dataset.cmd = side.cmd!; }
    }
    // The full explanation lives in the seals' tooltip; the panel keeps only what needs doing now.
    this.sealHelp = me.seals >= KRAKEN_SEALS
      ? 'Choose Summon the Kraken above the helm (3 AP), then a 3×3 patch of enemy water. It strikes now and again on their next turn, and holds the ships it finds.'
      : 'Three seals summon the Kraken. A red wax seal surfaces in your waters every few rounds: sail a ship onto it to take it. Each ship you lose also pays one.';
    this.q('#sealHow').innerHTML = me.seals >= KRAKEN_SEALS ? '' : p.treasures.some((t) => t.side === c.me && t.kind === 'seal') ? '<b>A seal is afloat in your waters now.</b>' : '';
    this.q('#foeSeals').textContent = `${foe.seals} covenant seal${foe.seals === 1 ? '' : 's'} · ${foe.doubloons} doubloons`;
    this.balls.forEach((b, k) => b.classList.toggle('spent', !(mine && k < p.ap)));
    this.q<HTMLButtonElement>('#endTurn').disabled = !c.can();
    const noteBtn = this.q<HTMLButtonElement>('#noteBtn');
    const cast = !!p.bottle?.[c.me];
    noteBtn.disabled = !(p.phase === 'battle' && !cast);
    noteBtn.title = cast ? 'One bottle a turn: yours is cast. You may cast another once your next turn begins.' : mine ? 'Send the other captain a short note.' : 'You did not cast a bottle on your turn: you may still send one now.';
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
      const trait = TRAIT_HELP[f.trait] ?? f.trait;
      return `<li class="${sunk ? 'sunk' : ''}" data-cls="${esc(f.cls)}" data-state="${sunk ? 'Sunk' : 'Afloat'}" data-trait="${esc(f.trait + ': ' + trait)}"><span class="pips">${`<i class="${sunk ? 'hit' : ''}"></i>`.repeat(f.len)}</span></li>`;
    }).join('');

    this.q('#orderText').textContent = c.order ? c.order.text : p.phase === 'placement' ? 'Sealed until the battle begins.' : '—';
    this.q('#orderMeta').textContent = c.order ? `Reward ${c.order.reward} doubloons · ${Math.max(0, c.order.deadline - p.round + 1)} rounds left` : '';
    this.purse(me.doubloons);
    this.q('#shop').innerHTML = ITEM_IDS.map((id) => {
      const it = ITEMS[id];
      const cost = price(me, id);
      const why = c.canBuy(id) ? '' : !mayBuy(me, id) ? 'Your commander forswears it.' : p.phase !== 'battle' ? 'The quartermaster opens once the battle begins.' : !mine ? 'Wait for your turn.'
        : me.doubloons < cost ? `You need ${cost - me.doubloons} more doubloons.` : me.items.length >= MAX_ITEMS ? `Your hold is full: ${MAX_ITEMS} items at most. Use one first.` : 'Not now.';
      return `<li><button data-item="${id}" data-price="${cost}" data-why="${esc(why)}" aria-disabled="${!!why}" ${why ? 'class="off"' : ''}><span>${it.name}</span><em>${it.ap} AP</em><b>${cost}</b></button></li>`;
    }).join('');
    this.q('#fleet').innerHTML = c.ships.map((s) => {
      const f = FLEETS[role].find((q) => q.kind === s.kind)!;
      const pips = s.hits.map((h, i) => `<i class="${s.floods?.[i] ? 'flood' : h ? 'hit' : ''}"></i>`).join('');
      const hurt = s.hits.filter(Boolean).length, holed = (s.floods || []).filter(Boolean).length;
      const state = s.sunk ? 'Sunk' : s.chained ? 'Pinned by chain shot' : holed ? `${hurt} hit · ${holed} holed` : hurt ? `${hurt} of ${s.len} sections hit` : 'Undamaged';
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
        const pic = id === 'power' ? (role === 'admiral' ? 'escort' : 'reckoning') : ART_STAND_IN[id] ?? id;
        const art = CARD_ART.has(pic) || id === 'power' ? `background-image:url(/ui/cards/${pic}.webp)` : '';
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
      if (me.seals >= krakenSeals(me) || mode === 'kraken') tool('kraken', 'Summon the Kraken', 3, c.canKraken(), TOOL_HELP.kraken.text, p.kraken ? 'The Kraken is already abroad.' : '');
      // The commander's own cards.
      const usesLeft = (k: keyof typeof CMD_USES) => CMD_USES[k] - (me.cmdUses ?? 0);
      const again = (at: number | undefined, every: number) => `Again in ${every - (p.round - (at ?? -99))} round${every - (p.round - (at ?? -99)) === 1 ? '' : 's'}.`;
      if (me.cmd === 'tidewarden') {
        const left = maelstromIn(p), why = left === null ? 'The maelstrom is spent.' : usesLeft('tidewarden') <= 0 ? 'You have bound the tide twice already.' : p.round < 14 ? 'The tide can be bound from round 14.' : '';
        const n = `${usesLeft('tidewarden')} of ${CMD_USES.tidewarden} left.`;
        tool('bindLater', 'Hold the Tide', TIDE.ap, c.canBind(), `The maelstrom's next ring comes two rounds later. ${n}`, why);
        tool('bindSooner', 'Hasten the Tide', TIDE.ap, c.canBind(), `The maelstrom's next ring comes a round sooner. ${n}`, why);
      }
      if (me.cmd === 'stormcaller') {
        tool('squall', 'Squall', 1, c.canSquall(), `Click the side of the enemy chart the wind should drive their fleet towards: every ship moves a square, and a ship that cannot is dashed and takes a hit. Their next glass on your waters sees only spray. ${usesLeft('stormcaller')} of ${CMD_USES.stormcaller} left.`, usesLeft('stormcaller') <= 0 ? 'All three squalls are spent.' : '');
        tool('gale', 'Call the Wind', 1, c.canGale(), 'Click the side of your chart the wind should blow towards this round.', p.round - (me.galeAt ?? -99) < GALE_EVERY ? again(me.galeAt, GALE_EVERY) : '');
      }
      if (me.cmd === 'spymaster') tool('sound', 'Soundings', 0, c.canSound(), 'Click a square of enemy water: you learn whether any ship lies on its row (press R for its column).', p.round < SPY.from ? `From round ${SPY.from}.` : p.round - (me.soundAt ?? -99) < SPY.every ? again(me.soundAt, SPY.every) : '');
      if (me.cmd === 'gunmaster') tool('double', 'Double-Shotted', 2, c.canDouble(), `Fire at a square; if it hits, the ball flies on and strikes the next square too (press R to turn which way). ${usesLeft('gunmaster')} of ${CMD_USES.gunmaster} left.`, usesLeft('gunmaster') <= 0 ? 'All three charges are spent.' : '');
      if (!p.pacts?.[c.me] && me.cmd !== 'deepspeaker' && c.ships.some((s) => !s.sunk && s.hits.some(Boolean) && s.kind !== 'merchant')) tool('pact', 'Blood Pact', 1, c.canPact(), TOOL_HELP.pact.text, c.ships.filter((s) => !s.sunk).length <= 1 ? 'Your last ship cannot be given up.' : '');
      if (role !== 'classic' && !p.power[c.me]) tool('power', CAPTAINS[role].power, 1, c.canPower(), `Your captain's power. ${CAPTAINS[role].powerText}`);
    }
    // The hand is grouped by kind of action — moving, firing, looking, then the rest — each group with the
    // plain orders first and the commander's and bought cards after them.
    // The card that was chosen before this redraw sinks back into the hand instead of vanishing from the raised spot.
    const wasOn = this.root.querySelector<HTMLElement>('#belt .ocard.on')?.dataset.tool;
    if (p.phase === 'battle') {
      belt.push(...orderCards);
      const rank = (h: string) => { const id = h.match(/data-tool="(\w+)"/)?.[1] ?? ''; const i = HAND_ORDER.indexOf(id); return i < 0 ? HAND_ORDER.length : i; };
      belt.sort((a, b) => rank(a) - rank(b));
    }
    this.q('#belt').innerHTML = belt.join('');
    // Fan the hand: each card turns a little about a point below the table.
    const cards = [...this.root.querySelectorAll<HTMLElement>('#belt .ocard')], n = cards.length;
    // A big hand overlaps more, so it never runs under the bottle or the hourglass.
    this.q<HTMLElement>('#belt').style.setProperty('--overlap', `${-16 - Math.max(0, n - 6) * 8}px`);
    cards.forEach((el, i) => { const k = i - (n - 1) / 2; el.style.setProperty('--r', `${k * 4}deg`); el.style.setProperty('--y', `${Math.abs(k) * 4}px`); el.style.zIndex = String(10 + n - i); });
    // Shortcut keys, shown on the cards: the orders keep their letters, the other cards take 5 to 9 in hand order.
    const LETTER: Record<string, string> = { fire: 'F', sail: 'S', turn: 'T', broadside: 'A' };
    let num = 5;
    for (const el of cards) {
      const key = LETTER[el.dataset.tool!] ?? (num <= 9 ? String(num++) : '');
      if (key) { el.dataset.key = key; el.insertAdjacentHTML('beforeend', `<kbd class="key" aria-hidden="true">${key}</kbd>`); }
    }
    // Cards new to the hand are dealt in from the deck, one after another.
    if (p.phase === 'battle') {
      const now = new Set(cards.map((el) => el.dataset.tool!));
      const fresh = cards.filter((el) => !this.prevHand?.has(el.dataset.tool!));
      fresh.forEach((el, i) => { el.style.setProperty('--d', `${i * 70}ms`); el.classList.add('dealt'); el.addEventListener('animationend', () => el.classList.remove('dealt'), { once: true }); });
      if (fresh.length && this.prevHand) this.on.sound?.('cardDeal');
      this.prevHand = now;
    }
    const was = wasOn && wasOn !== mode ? cards.find((el) => el.dataset.tool === wasOn) : undefined;
    if (was) {
      was.style.transition = 'none'; was.classList.add('on'); void was.offsetWidth;
      was.style.transition = ''; requestAnimationFrame(() => was.classList.remove('on'));
    }
    this.root.querySelectorAll<HTMLElement>('.order').forEach((b) => b.classList.toggle('on', b.dataset.order === mode));
    // The Kraken's card makes an entrance the first time it comes into the hand.
    const kcard = cards.find((el) => el.dataset.tool === 'kraken');
    if (this.krakenSeen === false && kcard) requestAnimationFrame(() => this.playKraken(kcard));
    this.krakenSeen = !!kcard;
    this.krakenReady = !!kcard && c.canKraken();
    this.q('#seals').classList.toggle('ready', this.krakenReady);
    const shownAp = Math.max(3, mine ? p.ap : 0);
    // A seal spent cracks in two and falls away.
    const crack = (k: number) => mine && this.prevAp > p.ap && k >= p.ap && k < this.prevAp;
    this.q('#apSeals').innerHTML = Array.from({ length: shownAp }, (_, k) => `<i class="${mine && k < p.ap ? '' : 'spent'}${crack(k) ? ' crack' : ''}"></i>`).join('');
    this.prevAp = mine ? p.ap : -1;
    this.prevSeals = me.seals;

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
      g.querySelector('small')!.innerHTML = left === null ? 'spent' : left === 1 ? 'next<br>round' : 'rounds';
      g.classList.toggle('two', left === 1);
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
      this.q<HTMLElement>('.over').classList.toggle('won', won);
      const text: Record<string, [string, string]> = {
        fleet: [`The enemy fleet lies on the seabed after ${p.round} round${p.round === 1 ? '' : 's'}.`, `Your last ship went down in round ${p.round}.`],
        home: [`The merchantman made the Home Port with ${p.cargo} of 3 crates aboard.`, `The merchantman slipped past you with ${p.cargo} of 3 crates.`],
        plunder: ['The last crate is yours and the merchantman is going down.', 'The merchantman is plundered and sunk.'],
        season: ['The season closed with the cargo still at sea.', 'The season closed before the cargo reached home.'],
      };
      this.q('#overText').textContent = text[p.reason || 'fleet'][won ? 0 : 1];
    }
  }

  /** The figures of the battle on the report, and whether a rematch can be offered. */
  setResults(r: { rounds: number; shots: number; hits: number; sank: number; lost: number; gold: number; cards: number; krakens: number }, rematch: boolean) {
    const acc = r.shots ? Math.round((100 * r.hits) / r.shots) : 0;
    const rows: [string, string | number][] = [['Rounds', r.rounds], ['Shots fired', r.shots], ['Hits', r.hits], ['Accuracy', `${acc} %`], ['Ships sunk', r.sank], ['Ships lost', r.lost], ['Doubloons', r.gold], ['Cards played', r.cards]];
    if (r.krakens) rows.push(['Kraken summoned', r.krakens]);
    this.q('#overStats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    this.q<HTMLElement>('#rematch').hidden = !rematch;
  }
  setVerdict(text: string) { this.q('#overVerify').textContent = text; }

  log(text: string, kind: '' | 'head' | 'bad' | 'good' = '') {
    // There is no log panel for now: the latest event shows briefly under the action points.
    if (kind === 'head') return;
    // Never over the turn ribbon: wait until it has passed.
    if (this.heralding) { this.held.push([text, kind]); return; }
    this.logEntries.push({ text, kind, round: this.round });
    if (this.logEntries.length > 200) this.logEntries.shift();
    if (!this.q<HTMLElement>('#logPanel').hidden) this.paintLog();
    const t = this.q<HTMLElement>('#toast');
    t.textContent = text;
    t.className = 'toast show ' + kind;
    t.style.animation = 'none';
    void t.offsetWidth; // restart the fade
    t.style.animation = '';
  }
  clearLog() { this.q('#toast').className = 'toast'; this.setVerdict(''); this.logEntries = []; this.prevHand = null; this.prevAp = this.prevGold = this.prevSeals = -1; this.toggleLog(false); }
  private paintLog() {
    const ol = this.q('#logPanel ol');
    ol.innerHTML = this.logEntries.length
      ? [...this.logEntries].reverse().map((e) => `<li class="${e.kind}">${e.round ? `<b>${e.round}</b>` : '<b>·</b>'}<span>${esc(e.text)}</span></li>`).join('')
      : '<li class="none"><span>Nothing has happened yet.</span></li>';
  }

  /** A copy of a card as it stands in the hand, to fly it to where it was played (taken before the hand redraws). */
  snapCard(tool: string): HTMLElement | null {
    const b = this.root.querySelector<HTMLElement>(`#belt .ocard[data-tool="${tool}"]`);
    if (!b) return null;
    const r = b.getBoundingClientRect(), g = b.cloneNode(true) as HTMLElement;
    g.classList.remove('on', 'off', 'dealt', 'nope'); g.classList.add('flying');
    // Out of the hand, the card keeps the look it had there.
    const cs = getComputedStyle(b);
    Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: b.offsetWidth + 'px', height: b.offsetHeight + 'px', margin: '0', transform: 'none', transition: 'none', zIndex: '60',
      backgroundImage: cs.backgroundImage, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', borderRadius: cs.borderRadius, border: '0', padding: '0' });
    return g;
  }
  /** The played card flies to the square it was played on and burns away there. */
  flyCard(g: HTMLElement, x: number, y: number) {
    this.on.sound?.('cardPlay');
    this.root.appendChild(g);
    const r = g.getBoundingClientRect(), dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), spin = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 14);
    const a = g.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1, filter: 'none' },
      { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 60}px) rotate(${spin / 2}deg) scale(.7)`, opacity: 1, filter: 'none', offset: 0.45 },
      { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(.32)`, opacity: 1, filter: 'brightness(1.6) sepia(.6)', offset: 0.75 },
      { transform: `translate(${dx}px,${dy - 14}px) rotate(${spin}deg) scale(.26)`, opacity: 0, filter: 'brightness(3) sepia(1) saturate(4) blur(3px)' },
    ], { duration: 620, easing: 'cubic-bezier(.3,.6,.4,1)' });
    a.onfinish = () => g.remove();
  }
  /** The card for a shortcut key (5 to 9: the cards with no letter of their own, in the order of the hand). */
  /** The purse counts up (or down) to its new sum; money coming in shows as a rising "+N". */
  private purse(n: number) {
    const el = this.q<HTMLElement>('#gold'), from = this.prevGold;
    this.prevGold = n;
    cancelAnimationFrame(this.goldTween);
    if (from < 0 || from === n) { el.textContent = String(n); return; }
    const t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(n - from) * 12);
    const step = () => { const u = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - u) ** 3; el.textContent = String(Math.round(from + (n - from) * e)); if (u < 1) this.goldTween = requestAnimationFrame(step); };
    step();
    if (n > from) {
      const money = this.q<HTMLElement>('#money');
      money.classList.remove('gain'); void money.offsetWidth; money.classList.add('gain');
      const f = Object.assign(document.createElement('b'), { className: 'plus', textContent: `+${n - from}` });
      el.parentElement!.appendChild(f); f.addEventListener('animationend', () => f.remove());
    }
  }
  cardForKey(k: string) { return this.root.querySelector<HTMLElement>(`#belt .ocard[data-key="${k.toUpperCase()}"]`); }
}
