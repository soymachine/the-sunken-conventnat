// Oak-and-brass HUD drawn with DOM + SVG over the 3D canvas.
import { Game } from '../game/rules';

export type Mode = 'fire' | 'sail' | 'turn';
const MODES: Mode[] = ['fire', 'sail', 'turn'];
const NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(p: Element, tag: K, a: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (text != null) e.textContent = text;
  p.appendChild(e);
  return e;
}
const polar = (x: number, y: number, r: number, deg: number) => [x + r * Math.cos((deg * Math.PI) / 180), y - r * Math.sin((deg * Math.PI) / 180)];

export interface HudHandlers {
  mode(m: Mode): void;
  endTurn(): void;
  shuffle(): void;
  rotate(): void;
  ready(): void;
  restart(): void;
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
        <div class="turn"><svg class="compass" viewBox="0 0 100 100"></svg><div><b id="turnTitle"></b><i id="turnSub"></i></div></div>
        <h1>The Sunken Covenant</h1>
        <div class="vs">You against the Admiralty's machine</div>
      </header>
      <aside class="card left"><h2>Your fleet</h2><ul id="fleet0"></ul><h2>Enemy fleet</h2><ul id="fleet1"></ul></aside>
      <aside class="card right"><h2>Captain's log</h2><ol id="log"></ol></aside>
      <footer class="rail bottom">
        <div class="battle">
          <svg class="telegraph" viewBox="0 0 260 150"></svg>
          <div class="ap"><span class="lbl">Action points</span><div class="tray"><i></i><i></i><i></i></div></div>
          <p id="hint"></p>
          <button class="capstan" id="endTurn" aria-label="End turn"><svg viewBox="0 0 100 100"></svg><span>End turn</span></button>
        </div>
        <div class="placing">
          <button class="plaque" id="shuffle">Shuffle</button>
          <button class="plaque" id="rotate">Rotate (R)</button>
          <p>Click a ship to lift it, move it over your waters and click again to set it down.</p>
          <button class="capstan" id="ready" aria-label="Ready"><svg viewBox="0 0 100 100"></svg><span>Ready</span></button>
        </div>
      </footer>
      <div class="over" hidden><div class="card"><h2 id="overTitle"></h2><p id="overText"></p><button class="plaque" id="restart">Sail again</button></div></div>`;
    this.compass(this.q('.compass'));
    this.telegraph(this.q('.telegraph'));
    this.root.querySelectorAll('.capstan svg').forEach((s) => this.capstan(s));
    this.q<HTMLElement>('#endTurn').onclick = () => { this.spin('#endTurn'); on.endTurn(); };
    this.q<HTMLElement>('#ready').onclick = () => { this.spin('#ready'); on.ready(); };
    this.q<HTMLElement>('#shuffle').onclick = () => on.shuffle();
    this.q<HTMLElement>('#rotate').onclick = () => on.rotate();
    this.q<HTMLElement>('#restart').onclick = () => on.restart();
  }

  private spin(sel: string) {
    this.q<SVGElement>(sel + ' svg').style.transform = `rotate(${++this.capTurns * 120}deg)`;
  }

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
    const x = 130, y = 132, r = 112, span = 180 / MODES.length;
    const d = svg(s, 'defs', {});
    const g = svg(d, 'radialGradient', { id: 'brass', cx: 0.35, cy: 0.3, r: 0.9 });
    svg(g, 'stop', { offset: 0, 'stop-color': '#f0d489' }); svg(g, 'stop', { offset: 0.45, 'stop-color': '#b08d3c' }); svg(g, 'stop', { offset: 1, 'stop-color': '#5e4717' });
    const o = polar(x, y, r * 1.06, 180), o2 = polar(x, y, r * 1.06, 0);
    svg(s, 'path', { d: `M${o} A${r * 1.06},${r * 1.06} 0 0 1 ${o2}Z`, fill: 'url(#brass)', stroke: '#0d0b08' });
    MODES.forEach((m, i) => {
      const t1 = 180 - span * i, t0 = t1 - span, ri = r * 0.3;
      const a = polar(x, y, ri, t1), b = polar(x, y, r, t1), c = polar(x, y, r, t0), e = polar(x, y, ri, t0);
      const path = svg(s, 'path', { d: `M${a} L${b} A${r},${r} 0 0 1 ${c} L${e} A${ri},${ri} 0 0 0 ${a}Z`, stroke: '#5e4717', 'stroke-width': 1.5, class: 'sector' });
      const mid = t1 - span / 2, p = polar(x, y, r * 0.68, mid);
      const text = svg(s, 'text', { x: p[0], y: p[1] + 5, 'text-anchor': 'middle', transform: `rotate(${90 - mid} ${p[0]} ${p[1]})`, class: 'sectorLabel' }, m.toUpperCase());
      path.addEventListener('click', () => this.on.mode(m));
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

  setMode(m: Mode) {
    const i = MODES.indexOf(m), span = 180 / MODES.length;
    this.lever.style.transform = `rotate(${90 - (180 - span * i - span / 2)}deg)`;
    this.sectors.forEach(([p, t], k) => { p.classList.toggle('on', k === i); t.classList.toggle('on', k === i); });
  }

  setHint(text: string) { this.q('#hint').textContent = text; }

  update(g: Game) {
    this.root.dataset.phase = g.phase;
    const mine = g.current === 0;
    this.q('#turnTitle').textContent = g.phase === 'placement' ? 'Deploy your fleet' : g.phase === 'over' ? 'Battle over' : mine ? 'Your turn' : 'Enemy turn';
    this.q('#turnSub').textContent = g.phase === 'battle' ? `Round ${g.round}` : '';
    this.q<SVGElement>('#needle').style.transform = `rotate(${mine ? 20 : 200}deg)`;
    this.root.querySelectorAll('.tray i').forEach((b, i) => b.classList.toggle('spent', !(g.phase === 'battle' && mine && i < g.ap)));
    this.q<HTMLButtonElement>('#endTurn').disabled = !(g.phase === 'battle' && mine);
    g.players.forEach((p, pi) => {
      this.q(`#fleet${pi}`).innerHTML = p.ships
        .map((s) => {
          const pips = s.hits.map((h) => `<i class="${pi === 0 ? (h ? 'hit' : '') : s.sunk ? 'hit' : ''}"></i>`).join('');
          return `<li class="${s.sunk ? 'sunk' : ''}"><span>${s.cls}</span><span class="pips">${pips}</span></li>`;
        })
        .join('');
    });
    this.q<HTMLElement>('.over').hidden = g.phase !== 'over';
    if (g.phase === 'over') {
      this.q('#overTitle').textContent = g.winner === 0 ? 'Victory' : 'Defeat';
      this.q('#overText').textContent = g.winner === 0 ? `The enemy fleet lies on the seabed after ${g.round} rounds.` : `Your last ship went down in round ${g.round}.`;
    }
  }

  log(text: string, kind: '' | 'head' | 'bad' | 'good' = '') {
    const li = document.createElement('li');
    li.textContent = text;
    if (kind) li.className = kind;
    const ol = this.q('#log');
    ol.prepend(li);
    while (ol.children.length > 40) ol.lastChild!.remove();
  }

  clearLog() { this.q('#log').innerHTML = ''; }
}
