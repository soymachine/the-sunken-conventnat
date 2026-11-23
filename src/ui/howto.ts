// How to play: a sheet of short sections with pictures from real games and a few drawn diagrams. Opened from the
// home and from Settings in a battle. Written in both languages here (the page translator leaves it alone).
import { getLang } from './i18n';

type T = { en: string; es: string };
interface Section { id: string; title: T; img?: string; svg?: () => string; body: T[]; caption?: T }

const INK = '#2a1a0c', WAX = '#b8312a', AMBER = '#c98a2a', SEA = '#cdbb8e';

/** A ship drawn as a row of squares on a scrap of chart, bow to the right. */
const hull = (x: number, y: number, n: number, marks: ('' | 'hit' | 'hole')[] = []) =>
  Array.from({ length: n }, (_, i) => {
    const m = marks[i] ?? '', X = x + i * 22;
    return `<rect x="${X}" y="${y}" width="20" height="20" rx="${i === n - 1 ? 7 : 2}" fill="${m === 'hole' ? '#2d4f63' : m === 'hit' ? WAX : INK}" stroke="${m === 'hole' ? WAX : 'none'}" stroke-width="2"/>`;
  }).join('');
const label = (x: number, y: number, t: string, color = INK, size = 12, anchor = 'start') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}" font-family="var(--body), Georgia, serif" font-style="italic">${t}</text>`;
const L = (t: T) => (getLang() === 'es' ? t.es : t.en);

const flooding = () => `<svg viewBox="0 0 420 150" class="diagram">
  <rect width="420" height="150" fill="${SEA}" rx="6"/>
  ${hull(20, 24, 3, ['hit'])}${label(100, 39, L({ en: 'A hit marks a section.', es: 'Un impacto marca una sección.' }))}
  ${hull(20, 64, 3, ['hole'])}${label(100, 79, L({ en: 'Hit it again: she is holed and slows.', es: 'Otro impacto ahí: vía de agua, va más lenta.' }))}
  ${hull(20, 104, 3, ['hole', '', 'hole'])}${label(100, 119, L({ en: 'Two holes, or every section hit: she sinks.', es: 'Dos vías de agua, o todo tocado: se hunde.' }), WAX)}
</svg>`;

const wind = () => {
  const arrow = (x: number, y: number, dir: number, color: string) => `<g transform="translate(${x} ${y}) rotate(${dir})"><path d="M-22 0 L18 0" stroke="${color}" stroke-width="4"/><path d="M20 0 L8 -8 L8 8 Z" fill="${color}"/></g>`;
  // Each ship is drawn along her course, the arrow ahead of her bow.
  const ship = (dir: number, color: string) => `<g transform="rotate(${dir})">${[0, 1, 2].map((i) => `<rect x="${-30 + i * 15}" y="-6.5" width="13" height="13" rx="${i === 2 ? 5 : 1.5}" fill="${INK}"/>`).join('')}${arrow(34, 0, 0, color).replace('translate(34 0) rotate(0)', 'translate(36 0)')}</g>`;
  const row = (y: number, dir: number, txt: T, color: string) => `<g transform="translate(205 ${y})">${ship(dir, color)}</g>${label(275, y + 4, L(txt), color)}`;
  return `<svg viewBox="0 0 540 230" class="diagram">
  <rect width="540" height="230" fill="${SEA}" rx="6"/>
  <g transform="translate(62 110)">${[0, 1, 2].map((k) => `<path d="M${-40 + k * 8} ${-30 + k * 26} q 20 -8 40 0 t 40 0" stroke="#5f8a8f" stroke-width="3" fill="none"/>`).join('')}
  <path d="M30 -2 L52 -2 L52 -10 L66 2 L52 14 L52 6 L30 6 Z" fill="#5f8a8f"/></g>
  ${label(62, 178, L({ en: 'the wind →', es: 'el viento →' }), '#2e5f63', 13, 'middle')}
  ${row(42, 0, { en: 'With it: one square more.', es: 'A favor: una casilla más.' }, '#2e7d4f')}
  ${row(112, 90, { en: 'Across it: no change.', es: 'De través: sin cambios.' }, INK)}
  ${row(186, 180, { en: 'Into it: square rigs cannot sail.', es: 'En contra: las velas cuadradas no avanzan.' }, WAX)}
</svg>`;
};

const glass = () => {
  const cells: string[] = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) cells.push(`<rect x="${20 + x * 20}" y="${15 + y * 20}" width="19" height="19" fill="#e3d4ad"/>`);
  return `<svg viewBox="0 0 470 210" class="diagram">
  <rect width="470" height="210" fill="${SEA}" rx="6"/>${cells.join('')}
  <rect x="60" y="55" width="100" height="100" fill="rgba(201,138,42,.28)" stroke="${AMBER}" stroke-width="3"/>
  <rect x="80" y="95" width="19" height="19" fill="${INK}" opacity=".35"/><rect x="100" y="95" width="19" height="19" fill="${INK}" opacity=".35"/><rect x="120" y="95" width="19" height="19" fill="${INK}" opacity=".35"/>
  <rect x="140" y="135" width="19" height="19" fill="${INK}" opacity=".35"/>
  <circle cx="110" cy="105" r="15" fill="${AMBER}" stroke="${INK}" stroke-width="2"/><text x="110" y="111" text-anchor="middle" font-size="17" font-weight="bold" fill="${INK}">4</text>
  ${label(215, 70, L({ en: 'A spyglass counts the ship', es: 'El catalejo cuenta las secciones' }))}${label(215, 88, L({ en: 'sections inside a 5×5 patch,', es: 'de barco dentro de una zona de 5×5,' }))}
  ${label(215, 106, L({ en: 'never where they are.', es: 'nunca dónde están.' }))}${label(215, 136, L({ en: 'A fog bank answers only “?”.', es: 'Un banco de niebla solo responde «?».' }), WAX)}
</svg>`;
};

const SECTIONS: Section[] = [
  { id: 'goal', title: { en: 'The aim', es: 'El objetivo' }, img: 'table',
    body: [
      { en: 'Two captains, two charts. Your fleet sails on the left chart; the enemy\'s lies hidden on the right. You never see their ships — you find them by firing, looking and reasoning.', es: 'Dos capitanes, dos cartas. Tu flota navega en la carta de la izquierda; la enemiga está oculta en la de la derecha. Nunca ves sus barcos: los encuentras disparando, observando y razonando.' },
      { en: 'Classic: sink the whole enemy fleet before they sink yours. Convoy: one captain escorts a merchantman to port, the other hunts its cargo.', es: 'Clásica: hunde toda la flota enemiga antes de que hundan la tuya. Convoy: un capitán escolta un mercante hasta puerto y el otro va a por su carga.' },
    ] },
  { id: 'deploy', title: { en: 'Deploy your fleet', es: 'Despliega tu flota' }, img: 'deploy',
    body: [
      { en: 'Before the battle, place your five ships: click one to lift it, move it and click to set it down. R turns it. Then turn the capstan (Ready).', es: 'Antes de la batalla coloca tus cinco barcos: haz clic en uno para levantarlo, muévelo y vuelve a hacer clic para dejarlo. R lo gira. Después gira el cabrestante (Listo).' },
      { en: 'Your placement is sealed with a cryptographic hash, so neither captain can move ships in secret; at the end both fleets are revealed and every answer is checked.', es: 'Tu despliegue queda sellado con un hash criptográfico, así que ningún capitán puede mover barcos a escondidas; al final se revelan las dos flotas y se comprueba cada respuesta.' },
    ] },
  { id: 'turn', title: { en: 'Your turn: action points', es: 'Tu turno: puntos de acción' }, img: 'hand',
    body: [
      { en: 'Each turn you have 3 action points (the red seals under "Your turn"). Every card in your hand costs the points in its corner seal: Fire, Sail and Turn cost 1; bigger orders cost more.', es: 'Cada turno tienes 3 puntos de acción (los sellos rojos bajo «Tu turno»). Cada carta de tu mano cuesta los puntos de su sello: Fuego, Navegar y Virar cuestan 1; las órdenes más grandes, más.' },
      { en: 'Click a card, then the chart. Grey cards cannot be played now — hover one to see why. Set the hourglass down to end your turn early.', es: 'Haz clic en una carta y luego en la carta náutica. Las cartas grises no se pueden jugar ahora: pasa el ratón para ver por qué. Deja el reloj de arena para acabar el turno antes.' },
    ] },
  { id: 'fire', title: { en: 'Firing and damage', es: 'Disparar y daños' }, img: 'fire', svg: flooding,
    body: [
      { en: 'Fire at a square of enemy water. A ring means water; flames mean a hit. Hits pay doubloons, and sinking a ship pays more.', es: 'Dispara a una casilla de agua enemiga. Un anillo es agua; las llamas, un impacto. Los impactos dan doblones, y hundir un barco da más.' },
      { en: 'Ships do not sit still: a hit ship may sail away. A section hit twice is holed below the waterline and the ship slows; two holes sink her.', es: 'Los barcos no se quedan quietos: uno tocado puede huir. Una sección tocada dos veces abre una vía de agua y el barco va más lento; dos vías lo hunden.' },
    ] },
  { id: 'move', title: { en: 'Sailing and the wind', es: 'Navegar y el viento' }, svg: wind,
    body: [
      { en: 'Sail moves a ship ahead along her bow; Turn swings her a quarter to port or starboard. Ships never back up, and a ship with two hits can no longer turn.', es: 'Navegar mueve un barco hacia delante según su proa; Virar lo gira un cuarto a babor o estribor. Los barcos nunca retroceden, y uno con dos impactos ya no puede virar.' },
      { en: 'The wind veers every round (the brass compass at the top left). Sailing with it gains a square; square-rigged ships cannot sail into it. The Ironclad has steam and ignores it. One round in five is a flat calm.', es: 'El viento cambia cada ronda (la brújula de latón arriba a la izquierda). A favor se gana una casilla; los barcos de velas cuadradas no pueden navegar contra él. El Acorazado va a vapor y lo ignora. Una ronda de cada cinco hay calma chicha.' },
    ] },
  { id: 'look', title: { en: 'Looking for the enemy', es: 'Buscar al enemigo' }, svg: glass,
    body: [
      { en: 'The Cutter\'s glass (and the Spyglass from the quartermaster) count ship sections in a 5×5 patch. The Long Glass shows a 2×2 patch exactly. Wreckage drifting behind a damaged ship and treasure lifted by the enemy also give them away.', es: 'El catalejo del cúter (y el catalejo del intendente) cuentan secciones de barco en una zona de 5×5. El anteojo muestra una zona de 2×2 con exactitud. Los restos que deja un barco dañado y los tesoros que recoge el enemigo también lo delatan.' },
      { en: 'Spend doubloons with the quartermaster (Money): spyglasses, fire ships, fog banks, repairs, sea currents and more.', es: 'Gasta doblones con el intendente (Dinero): catalejos, brulotes, bancos de niebla, reparaciones, corrientes marinas y más.' },
    ] },
  { id: 'kraken', title: { en: 'Treasure, seals and the Kraken', es: 'Tesoros, sellos y el Kraken' }, img: 'treasure',
    body: [
      { en: 'Chests and red wax seals surface in your waters. Sail a ship onto one to take it — but the enemy learns where you were.', es: 'En tus aguas afloran cofres y sellos de lacre rojo. Lleva un barco hasta uno para cogerlo, pero el enemigo sabrá dónde estabas.' },
      { en: 'Three covenant seals (each lost ship also pays one) summon the Kraken: it strikes three squares of a 3×3 enemy patch now and three more next turn, and holds the ships it finds.', es: 'Tres sellos del pacto (cada barco perdido también da uno) invocan al Kraken: golpea tres casillas de una zona enemiga de 3×3 ahora y otras tres en el próximo turno, y retiene los barcos que encuentra.' },
    ] },
  { id: 'sea', title: { en: 'Storms, tides and the maelstrom', es: 'Tormentas, mareas y el Maelstrom' }, img: 'maelstrom',
    body: [
      { en: 'Storm fronts cross the charts: no gun or glass works under them. Every five rounds the tide carries all treasure a square.', es: 'Los frentes de tormenta cruzan las cartas: bajo ellos no funcionan ni cañones ni catalejos. Cada cinco rondas la marea arrastra todos los tesoros una casilla.' },
      { en: 'From round 20 the maelstrom swallows the outer ring of both charts every other round, sinking whatever lies there, until the middle 6×6 remains. The gauge at the top right counts down. Bring your ships in!', es: 'Desde la ronda 20 el Maelstrom se traga el anillo exterior de ambas cartas cada dos rondas, hundiendo lo que haya allí, hasta que queda el 6×6 central. El indicador de arriba a la derecha lleva la cuenta. ¡Trae tus barcos hacia dentro!' },
    ] },
  { id: 'cmd', title: { en: 'Commanders', es: 'Comandantes' },
    body: [
      { en: 'In Classic you may lead a commander, chosen as the battle is set up. Each brings one power and one drawback; both captains see each other\'s. Hover a commander for the details.', es: 'En la Clásica puedes llevar un comandante, que eliges al preparar la batalla. Cada uno trae un poder y una desventaja; los dos capitanes ven el del otro. Pasa el ratón por un comandante para ver los detalles.' },
      { en: 'Tidewarden: moves the maelstrom. Stormcaller: squalls that drive the enemy fleet. Spymaster: soundings along a row or column. Gunmaster: shots that fly on after a hit. Deepspeaker: a Kraken for two seals.', es: 'Guardamareas: mueve el Maelstrom. Llamatormentas: turbonadas que empujan la flota enemiga. Maestro Espía: sondeos en una fila o columna. Artillero: disparos que siguen tras un impacto. Voz del Abismo: el Kraken con dos sellos.' },
    ] },
];

const UI = {
  title: { en: 'How to play', es: 'Cómo se juega' }, prev: { en: '‹ Back', es: '‹ Anterior' }, next: { en: 'Next ›', es: 'Siguiente ›' }, close: { en: 'Close', es: 'Cerrar' },
};
const FACES = ['tidewarden', 'stormcaller', 'spymaster', 'gunmaster', 'deepspeaker'];

/** Open the guide (on the first section, or the one named). */
export function openHowTo(at = 0) {
  document.querySelector('.guide')?.remove();
  const box = document.body.appendChild(document.createElement('div'));
  box.className = 'guide';
  box.setAttribute('translate', 'no');
  let i = at;
  const draw = () => {
    const s = SECTIONS[i];
    box.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="howHead">
      <button type="button" class="x" data-act="close" aria-label="${L(UI.close)}">×</button>
      <h2 id="howHead">${L(UI.title)}</h2>
      <div class="cols">
        <nav>${SECTIONS.map((q, k) => `<button type="button" data-go="${k}" class="${k === i ? 'on' : ''}"><i>${k + 1}</i>${L(q.title)}</button>`).join('')}</nav>
        <section>
          <h3>${L(s.title)}</h3>
          ${s.img ? `<img src="/ui/howto/${s.img}.webp" alt="" class="shot${s.img === 'hand' ? ' wide' : ''}">` : ''}
          ${s.id === 'cmd' ? `<div class="faces">${FACES.map((f) => `<img src="/ui/cmd/${f}_face.webp" alt="">`).join('')}</div>` : ''}
          ${s.body.map((p) => `<p>${L(p)}</p>`).join('')}
          ${s.svg ? s.svg() : ''}
          ${s.id === 'kraken' ? `<img src="/ui/howto/kraken.webp" alt="" class="shot">` : ''}
          ${s.id === 'fire' ? '' : ''}
        </section>
      </div>
      <div class="foot"><button type="button" class="plaque dark" data-act="prev" ${i === 0 ? 'disabled' : ''}>${L(UI.prev)}</button><span>${i + 1} / ${SECTIONS.length}</span>${i < SECTIONS.length - 1 ? `<button type="button" class="plaque" data-act="next">${L(UI.next)}</button>` : `<button type="button" class="plaque" data-act="close">${L(UI.close)}</button>`}</div>
    </div>`;
    box.querySelector('section')!.scrollTop = 0;
  };
  const close = () => { box.remove(); removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' && i < SECTIONS.length - 1) { i++; draw(); }
    if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
  };
  box.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === box) return close();
    const b = t.closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.go) { i = +b.dataset.go; draw(); }
    if (b.dataset.act === 'prev' && i > 0) { i--; draw(); }
    if (b.dataset.act === 'next' && i < SECTIONS.length - 1) { i++; draw(); }
    if (b.dataset.act === 'close') close();
  });
  addEventListener('keydown', key);
  draw();
}
