// Oak-and-brass HUD drawn with DOM + SVG over the 3D canvas.
import { Client, SEASON, roleOf } from '../game/engine';
import { ITEMS, ITEM_IDS, Item } from '../game/powerups';
import { FLEETS, N, Role, shipCells } from '../game/rules';

export type Tool = 'broadside' | 'chain' | 'spy' | Item;
export type Mode = 'fire' | 'sail' | 'turn' | 'power' | Tool;

/** The two invented captains of the Convoy mode. */
export const CAPTAINS: Record<Exclude<Role, 'classic'>, { name: string; title: string; mission: string; power: string; powerText: string }> = {
  admiral: { name: 'Vice-Admiral Edmund Harrowgate', title: 'The Admiral', mission: 'Bring the merchantman from the Colony, on the western edge of your chart, to the Home Port on the eastern edge with at least one crate aboard — or sink every corsair.', power: 'Close Escort', powerText: 'Once: until your next turn, the first hit on the merchantman is turned aside.' },
  corsair: { name: 'Captain Mara Vane, “the Black Tide”', title: 'The Corsair', mission: 'Plunder all three crates from the merchantman before she reaches the Home Port, or keep her at sea until the season closes.', power: 'Dead Reckoning', powerText: 'Once: learn the column the merchantman is in.' },
};
const SECTORS = ['fire', 'sail', 'turn', 'ability'] as const;
const NS = 'http://www.w3.org/2000/svg';

export const TOOLS: Record<'broadside' | 'chain' | 'spy', { name: string; ap: number }> = {
  broadside: { name: 'Broadside', ap: 2 },
  chain: { name: 'Chain shot', ap: 2 },
  spy: { name: 'Cutter’s glass', ap: 1 },
};

function svg<K extends keyof SVGElementTagNameMap>(p: Element, tag: K, a: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (text != null) e.textContent = text;
  p.appendChild(e);
  return e;
}
const polar = (x: number, y: number, r: number, deg: number) => [x + r * Math.cos((deg * Math.PI) / 180), y - r * Math.sin((deg * Math.PI) / 180)];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface HudHandlers {
  mode(m: Mode): void;
  mute(): boolean;
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
  private capTurns = 0;
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(private on: HudHandlers) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <header class="rail top">
        <div class="turn"><svg class="compass" viewBox="0 0 100 100"></svg><div><b id="turnTitle"></b><i id="turnSub"></i></div><button id="mute" class="mini" aria-pressed="false">Sound on</button></div>
        <h1>The Sunken Covenant</h1>
        <div class="foe"><span id="foeName"></span><div id="foeFleet"></div></div>
      </header>
      <div class="objective" id="objective" hidden></div>
      <aside class="card left">
        <h2>Admiralty orders</h2><p id="orderText"></p><p id="orderMeta" class="meta"></p>
        <h2>Quartermaster <span id="gold" title="Doubloons"></span></h2><ul id="shop"></ul>
        <h2>Your fleet</h2><ul id="fleet"></ul>
      </aside>
      <aside class="card right"><h2>Captain's log</h2><ol id="log"></ol></aside>
      <div class="belt" id="belt"></div>
      <footer class="rail bottom">
        <div class="battle">
          <svg class="telegraph" viewBox="0 0 260 150"></svg>
          <div class="ap"><span class="lbl">Action points</span><div class="tray" id="tray"></div></div>
          <p id="hint"></p>
          <button class="capstan" id="endTurn" aria-label="End turn"><svg viewBox="0 0 100 100"></svg><span>End turn</span></button>
        </div>
        <div class="placing">
          <button class="plaque" id="shuffle">Shuffle</button>
          <button class="plaque" id="rotate">Rotate (R)</button>
          <p id="placeHint"></p>
          <button class="capstan" id="ready" aria-label="Ready"><svg viewBox="0 0 100 100"></svg><span>Ready</span></button>
        </div>
      </footer>
      <div class="role" hidden><div class="card"><svg class="medal" viewBox="0 0 100 100"></svg><p class="meta" id="roleTitle"></p><h2 id="roleName"></h2><p id="roleMission"></p><p class="pw"><b id="rolePower"></b> <span id="rolePowerText"></span></p><button class="plaque" id="roleOk">To your station</button></div></div>
      <div class="over" hidden><div class="card"><h2 id="overTitle"></h2><p id="overText"></p><p id="overVerify" class="meta"></p><button class="plaque" id="leave">Back to port</button></div></div>`;
    this.compass(this.q('.compass'));
    this.telegraph(this.q('.telegraph'));
    this.root.querySelectorAll('.capstan svg').forEach((s) => this.capstan(s));
    this.q<HTMLElement>('#endTurn').onclick = () => { this.spin('#endTurn'); on.endTurn(); };
    this.q<HTMLElement>('#ready').onclick = () => { this.spin('#ready'); on.ready(); };
    this.q<HTMLElement>('#shuffle').onclick = () => on.shuffle();
    this.q<HTMLElement>('#rotate').onclick = () => on.rotate();
    this.q<HTMLElement>('#leave').onclick = () => on.leave();
    this.q<HTMLElement>('#roleOk').onclick = () => { this.q<HTMLElement>('.role').hidden = true; };
    this.q<HTMLElement>('#mute').onclick = (e) => { const off = on.mute(), b = e.currentTarget as HTMLElement; b.textContent = off ? 'Sound off' : 'Sound on'; b.setAttribute('aria-pressed', String(off)); };
    this.q<HTMLElement>('#shop').onclick = (e) => { const b = (e.target as Element).closest('button'); if (b) on.buy(b.dataset.item as Item); };
    this.q<HTMLElement>('#belt').onclick = (e) => { const b = (e.target as Element).closest('button'); if (b) on.mode(b.dataset.tool as Mode); };
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
  private spin(sel: string) { this.q<SVGElement>(sel + ' svg').style.transform = `rotate(${++this.capTurns * 120}deg)`; }

  private compass(s: SVGElement) {
    svg(s, 'circle', { cx: 50, cy: 50, r: 48, fill: 'url(#brass)', stroke: '#0d0b08' });
    svg(s, 'circle', { cx: 50, cy: 50, r: 41, fill: '#0d0b08' });
    for (let i = 0; i < 32; i++) {
      const a = polar(50, 50, i % 4 ? 37 : 34, i * 11.25), b = polar(50, 50, 40, i * 11.25);
      svg(s, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#d9a441', 'stroke-width': i % 4 ? 0.5 : 1 });
    }
    for (let k = 0; k < 4; k++) {
      const t = polar(50, 50, 33, k * 90), a = polar(50, 50, 6, k * 90 + 45), b = polar(50, 50, 6, k * 90 - 45);
      svg(s, 'polygon', { points: `${t} ${a} 50,50`, fill: '#e8d5a3' });
      svg(s, 'polygon', { points: `${t} ${b} 50,50`, fill: '#8a6f2c' });
    }
    svg(s, 'polygon', { id: 'needle', points: '50,18 53,50 47,50', fill: '#8c2f1b' });
    svg(s, 'circle', { cx: 50, cy: 50, r: 3.5, fill: '#b08d3c' });
  }

  private telegraph(s: SVGElement) {
    const x = 130, y = 132, r = 112, span = 180 / SECTORS.length;
    const d = svg(s, 'defs', {});
    const g = svg(d, 'radialGradient', { id: 'brass', cx: 0.35, cy: 0.3, r: 0.9 });
    svg(g, 'stop', { offset: 0, 'stop-color': '#f0d489' }); svg(g, 'stop', { offset: 0.45, 'stop-color': '#b08d3c' }); svg(g, 'stop', { offset: 1, 'stop-color': '#5e4717' });
    const o = polar(x, y, r * 1.06, 180), o2 = polar(x, y, r * 1.06, 0);
    svg(s, 'path', { d: `M${o} A${r * 1.06},${r * 1.06} 0 0 1 ${o2}Z`, fill: 'url(#brass)', stroke: '#0d0b08' });
    SECTORS.forEach((m, i) => {
      const t1 = 180 - span * i, t0 = t1 - span, ri = r * 0.3;
      const a = polar(x, y, ri, t1), b = polar(x, y, r, t1), c = polar(x, y, r, t0), e = polar(x, y, ri, t0);
      const path = svg(s, 'path', { d: `M${a} L${b} A${r},${r} 0 0 1 ${c} L${e} A${ri},${ri} 0 0 0 ${a}Z`, stroke: '#5e4717', 'stroke-width': 1.5, class: 'sector' });
      const mid = t1 - span / 2, p = polar(x, y, r * 0.7, mid);
      const text = svg(s, 'text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle', transform: `rotate(${90 - mid} ${p[0]} ${p[1]})`, class: 'sectorLabel' }, m.toUpperCase());
      path.addEventListener('click', () => this.on.mode(m === 'ability' ? 'broadside' : m));
      this.sectors.push([path, text]);
    });
    this.lever = svg(s, 'g', { class: 'lever' });
    this.lever.style.transformOrigin = `${x}px ${y}px`;
    svg(this.lever, 'line', { x1: x, y1: y, x2: x, y2: y - r * 1.1, stroke: '#5e4717', 'stroke-width': 9, 'stroke-linecap': 'round' });
    svg(this.lever, 'line', { x1: x, y1: y, x2: x, y2: y - r * 1.1, stroke: '#b08d3c', 'stroke-width': 5, 'stroke-linecap': 'round' });
    svg(this.lever, 'circle', { cx: x, cy: y - r * 1.12, r: 9, fill: '#3b2a18', stroke: '#d9a441', 'stroke-width': 1.5 });
    svg(s, 'circle', { cx: x, cy: y, r: 20, fill: 'url(#brass)', stroke: '#0d0b08' });
    svg(s, 'circle', { cx: x, cy: y, r: 6, fill: '#0d0b08' });
  }

  private capstan(s: Element) {
    for (let k = 0; k < 6; k++) svg(s, 'rect', { x: 46.5, y: 4, width: 7, height: 34, rx: 3, fill: '#5a4026', stroke: '#0d0b08', transform: `rotate(${k * 60} 50 50)` });
    svg(s, 'circle', { cx: 50, cy: 50, r: 25, fill: '#3b2a18', stroke: '#0d0b08', 'stroke-width': 1.5 });
    svg(s, 'circle', { cx: 50, cy: 50, r: 14, fill: 'url(#brass)', stroke: '#0d0b08' });
    svg(s, 'line', { x1: 41, y1: 50, x2: 59, y2: 50, stroke: '#0d0b08', 'stroke-width': 2 });
  }

  setHint(text: string) { this.q('#hint').textContent = text; }

  update(c: Client, mode: Mode, note = '') {
    const p = c.pub, me = c.side, foe = c.foeSide, mine = c.myTurn;
    this.root.dataset.phase = p.phase;
    const i = mode === 'fire' ? 0 : mode === 'sail' ? 1 : mode === 'turn' ? 2 : 3, span = 180 / SECTORS.length;
    this.lever.style.transform = `rotate(${90 - (180 - span * i - span / 2)}deg)`;
    this.sectors.forEach(([path, t], k) => { path.classList.toggle('on', k === i); t.classList.toggle('on', k === i); });

    this.q('#turnTitle').textContent = p.phase === 'placement' ? 'Deploy your fleet' : p.phase === 'over' ? 'Battle over' : mine ? 'Your turn' : 'Enemy turn';
    this.q('#turnSub').textContent = p.phase === 'battle' ? `Round ${p.round}` : '';
    this.q<SVGElement>('#needle').style.transform = `rotate(${mine ? 20 : 200}deg)`;
    const shown = Math.max(3, mine ? p.ap : 0);
    const tray = this.q('#tray');
    while (tray.children.length < shown) tray.appendChild(document.createElement('i')).className = 'spent';
    while (tray.children.length > shown) tray.lastChild!.remove();
    [...tray.children].forEach((b, k) => b.classList.toggle('spent', !(mine && k < p.ap)));
    this.q<HTMLButtonElement>('#endTurn').disabled = !c.can();
    this.q<HTMLButtonElement>('#ready').disabled = me.ready;
    this.q<HTMLButtonElement>('#shuffle').disabled = this.q<HTMLButtonElement>('#rotate').disabled = me.ready;
    this.q('#placeHint').textContent = me.ready ? 'Fleet committed. Waiting for the other captain…' : 'Click a ship to lift it, move it over your waters and click again to set it down.';

    this.q('#foeName').textContent = (foe.name || 'The other captain') + (note ? ` · ${note}` : '');
    const down = foe.sunk.map((s) => s.kind);
    const role = c.role, foeRole = roleOf(p, c.foe);
    this.q('#foeFleet').innerHTML = FLEETS[foeRole].map((f) => `<span class="pips ${down.includes(f.kind) ? 'sunk' : ''}" title="${f.cls}">${'<i></i>'.repeat(f.len)}</span>`).join('');

    this.q('#orderText').textContent = c.order ? c.order.text : p.phase === 'placement' ? 'Sealed until the battle begins.' : '—';
    this.q('#orderMeta').textContent = c.order ? `Reward ${c.order.reward} doubloons · ${Math.max(0, c.order.deadline - p.round + 1)} rounds left` : '';
    this.q('#gold').textContent = String(me.doubloons);
    this.q('#shop').innerHTML = ITEM_IDS.map((id) => {
      const it = ITEMS[id];
      return `<li><button data-item="${id}" title="${esc(it.blurb)}" ${c.canBuy(id) ? '' : 'disabled'}><span>${it.name}</span><em>${it.ap} AP</em><b>${it.price}</b></button></li>`;
    }).join('');
    this.q('#fleet').innerHTML = c.ships.map((s) => {
      const f = FLEETS[role].find((q) => q.kind === s.kind)!;
      const pips = s.hits.map((h) => `<i class="${h ? 'hit' : ''}"></i>`).join('');
      return `<li class="${s.sunk ? 'sunk' : ''}"><span>${s.cls}<em>${s.chained ? 'pinned by chain' : f.trait}</em></span><span class="pips">${pips}</span></li>`;
    }).join('');

    const belt: string[] = [];
    if (p.phase === 'battle') {
      const tool = (id: Mode, name: string, ap: number, ok: boolean) =>
        belt.push(`<button data-tool="${id}" class="${mode === id ? 'on' : ''}" ${ok ? '' : 'disabled'}>${name}<em>${ap} AP</em></button>`);
      tool('broadside', TOOLS.broadside.name, 2, c.can(2) && c.alive('line'));
      tool('chain', TOOLS.chain.name, 2, c.can(2) && c.alive('frigate'));
      tool('spy', TOOLS.spy.name, 1, c.can(1) && c.alive('cutter'));
      for (const id of [...new Set(me.items)]) {
        const n = me.items.filter((q) => q === id).length;
        tool(id, ITEMS[id].name + (n > 1 ? ` ×${n}` : ''), ITEMS[id].ap, c.can(ITEMS[id].ap) && !(id === 'winds' && p.windsUsed));
      }
      if (role !== 'classic' && !p.power[c.me]) tool('power', CAPTAINS[role].power, 1, c.canPower());
    }
    this.q('#belt').innerHTML = belt.join('');

    const obj = this.q<HTMLElement>('#objective');
    obj.hidden = role === 'classic' || p.phase === 'over';
    if (!obj.hidden) {
      const crates = '<i></i>'.repeat(p.cargo) + '<i class="gone"></i>'.repeat(3 - p.cargo);
      const left = Math.max(0, SEASON - p.round + 1), mer = c.merchant;
      const way = mer ? N - 1 - Math.max(...shipCells(mer).map(([x]) => x)) : 0;
      obj.innerHTML = `<span><b>Cargo</b><span class="crates">${crates}</span></span>` +
        (role === 'admiral' ? `<span><b>Home port</b>${way} column${way === 1 ? '' : 's'} east</span>` : '') +
        `<span><b>Season closes</b>${p.phase === 'battle' ? `in ${left} round${left === 1 ? '' : 's'}` : `after round ${SEASON}`}</span>`;
    }
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
    const li = document.createElement('li');
    li.textContent = text;
    if (kind) li.className = kind;
    const ol = this.q('#log');
    ol.prepend(li);
    while (ol.children.length > 60) ol.lastChild!.remove();
  }
  clearLog() { this.q('#log').innerHTML = ''; this.setVerdict(''); }
}
