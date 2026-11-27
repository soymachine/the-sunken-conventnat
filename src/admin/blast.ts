// The explosion bench: the game's own table and scene, one ship on it, and the controls of how she goes down.
// Sink yours (hit by the enemy) or the enemy's (she rises out of nothing as the ball comes, then goes up), replay as
// often as you like while moving the sliders. The numbers are kept in this browser, so the game here plays them at
// once; "Descargar" makes the file that publishes them for everyone (public/fx/sinking.json).
import { SeaScene } from '../render/scene';
import { BLAST, SINK_KIND, clearLocal, loadSinkFx, saveLocal, snapshot } from '../render/sinkfx';
import { newPub } from '../game/engine';
import { FLEETS, Kind, Ship, shipCells } from '../game/rules';
import { Sfx } from '../ui/audio';

const KINDS: { kind: Kind; name: string; len: number }[] = [
  ...FLEETS.classic.map((f) => ({ kind: f.kind, name: f.cls, len: f.len })),
  ...FLEETS.admiral.filter((f) => f.kind === 'merchant').map((f) => ({ kind: f.kind, name: f.cls, len: f.len })),
];
const ES: Record<string, string> = { line: 'Navío de línea', frigate: 'Fragata', ironclad: 'Acorazado', schooner: 'Goleta', cutter: 'Cúter', merchant: 'Mercante' };

type Num = { obj: Record<string, number>; key: string; label: string; min: number; max: number; step: number; help: string };

export async function mountBlast(host: HTMLElement) {
  await loadSinkFx();
  host.innerHTML = `<div class="bench">
    <aside>
      <h2>Barco</h2>
      <div class="kinds">${KINDS.map((k, i) => `<button type="button" data-k="${k.kind}" class="${i === 0 ? 'on' : ''}">${ES[k.kind] ?? k.name}</button>`).join('')}</div>
      <div class="go">
        <button type="button" class="primary" id="sinkMine">Hundir mi barco</button>
        <button type="button" class="primary" id="sinkFoe">Hundir barco enemigo</button>
        <button type="button" id="reset">Barco nuevo</button>
      </div>
      <p class="sub">«Mi barco»: le llega la bala enemiga desde fuera del mapa. «Enemigo»: aparece de la nada mientras vuela tu bala y estalla al impacto, como en la partida.</p>
      <h2>Hundimiento de <span id="kname"></span></h2>
      <div id="kindCtl"></div>
      <h2>Explosión (todos los barcos)</h2>
      <div id="blastCtl"></div>
      <div class="go">
        <button type="button" id="dl" class="primary">Descargar sinking.json</button>
        <button type="button" id="defaults">Valores por defecto</button>
      </div>
      <p class="sub">Los cambios se guardan en este navegador y el juego, en este mismo navegador, los usa al momento. Para publicarlos para todos, descarga el archivo y súbelo a la rama: va a <code>public/fx/sinking.json</code>.</p>
    </aside>
    <div class="stage"><canvas></canvas><p class="hint">Rueda: zoom · botón central: mover</p></div>
  </div>`;

  const canvas = host.querySelector('canvas')!;
  const scene = new SeaScene(canvas);
  const sfx = new Sfx();
  scene.sound = (s) => sfx.play(s);
  let kind: Kind = KINDS[0].kind, id = 1;
  const def = () => KINDS.find((k) => k.kind === kind)!;
  const ship = (x: number, y: number): Ship => ({ id: id++, kind, cls: def().name, len: def().len, x, y, dir: 'h', hits: Array(def().len).fill(false), sunk: false } as unknown as Ship);

  // The view the scene draws: a battle under way, with my ship (or a frigate to fire from) and perhaps the enemy's.
  const pub = newPub(7);
  pub.phase = 'battle'; pub.sides[0].name = 'Tú'; pub.sides[1].name = 'Enemigo';
  let mine: Ship[] = [], hide = new Set<string>();
  const draw = () => scene.sync({ pub, me: 0, ships: mine, hide });

  const fresh = () => {
    scene.reset();
    pub.sides[1].sunk = []; hide = new Set();
    mine = [ship(5, 7)];
    draw();
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  host.querySelector<HTMLElement>('#reset')!.onclick = fresh;
  host.querySelector<HTMLElement>('#sinkMine')!.onclick = async () => {
    fresh(); await wait(500);
    const s = mine[0];
    s.hits = s.hits.map(() => true); s.sunk = true;
    hide = new Set(shipCells(s).map(([x, y]) => `own:${x},${y}`)); draw();
    await scene.shot({ side: 'own', x: s.x + Math.floor(s.len / 2), y: s.y }, 'sunk');
    hide = new Set(); draw();
  };
  host.querySelector<HTMLElement>('#sinkFoe')!.onclick = async () => {
    scene.reset();
    // A frigate of mine to fire from; the enemy's ship is unseen until the ball that sinks her is on its way.
    const k = kind; kind = 'frigate'; mine = [ship(2, 3)]; kind = k;
    const foe = ship(5, 7);
    pub.sides[1].sunk = [{ kind: foe.kind, cls: foe.cls, len: foe.len, x: foe.x, y: foe.y, dir: foe.dir }];
    hide = new Set(shipCells(foe).map(([x, y]) => `enemy:${x},${y}`)); draw();
    await wait(400);
    await scene.shot({ side: 'enemy', x: foe.x + Math.floor(foe.len / 2), y: foe.y }, 'sunk');
    hide = new Set(); draw();
  };

  // Sliders, saved as they move.
  const slider = (n: Num) => `<label title="${n.help}"><span>${n.label}</span><input type="range" min="${n.min}" max="${n.max}" step="${n.step}" value="${n.obj[n.key]}" data-key="${n.key}"><output>${n.obj[n.key]}</output></label>`;
  const wire = (box: HTMLElement, list: Num[]) => {
    box.innerHTML = list.map(slider).join('');
    box.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.oninput = () => {
      const n = list.find((x) => x.key === i.dataset.key)!;
      n.obj[n.key] = +i.value; i.nextElementSibling!.textContent = i.value; saveLocal();
    }));
  };
  const kindCtl = () => {
    const o = SINK_KIND[kind] as unknown as Record<string, number>;
    host.querySelector('#kname')!.textContent = ES[kind] ?? kind;
    wire(host.querySelector('#kindCtl')!, [
      { obj: o, key: 'dur', label: 'Duración (s)', min: 1, max: 10, step: 0.1, help: 'Segundos hasta desaparecer bajo el agua.' },
      { obj: o, key: 'roll', label: 'Escora', min: 0, max: 1.6, step: 0.01, help: 'Cuánto se tumba de costado (1,5 = zozobra).' },
      { obj: o, key: 'pitch', label: 'Cabeceo', min: -0.8, max: 0.8, step: 0.01, help: 'Positivo: levanta la proa. Negativo: levanta la popa.' },
      { obj: o, key: 'depth', label: 'Profundidad', min: 0.5, max: 2.5, step: 0.05, help: 'Cuánto baja antes de desaparecer.' },
    ]);
  };
  const blastCtl = () => wire(host.querySelector('#blastCtl')!, ([
    ['delay', 'Retraso explosión (s)', 0, 1.5, 0.05, 'Segundos entre el impacto de la bala y la explosión.'],
    ['sinkDelay', 'Retraso hundimiento (s)', 0, 2, 0.05, 'Segundos entre el impacto y el comienzo del hundimiento.'],
    ['scale', 'Tamaño', 0.4, 2, 0.05, 'Bola de fuego, humo y anillo sobre el agua.'],
    ['shake', 'Temblor de cámara', 0, 2, 0.05, '0 = sin temblor.'],
    ['hitStop', 'Congelación (s)', 0, 0.3, 0.01, 'El instante en que todo se detiene.'],
    ['flash', 'Destello', 0, 1.5, 0.05, 'El brillo cálido sobre toda la imagen.'],
    ['chunks', 'Restos', 0, 2, 0.05, 'Tablones y mástil que salen volando.'],
    ['smoke', 'Humo (s)', 1, 15, 0.5, 'Cuánto dura la columna de humo.'],
  ] as const).map(([key, label, min, max, step, help]) => ({ obj: BLAST as unknown as Record<string, number>, key, label, min, max, step, help })));
  blastCtl(); kindCtl();
  host.querySelectorAll<HTMLElement>('.kinds button').forEach((b) => (b.onclick = () => {
    kind = b.dataset.k as Kind; host.querySelectorAll('.kinds button').forEach((x) => x.classList.toggle('on', x === b)); kindCtl(); fresh();
  }));
  host.querySelector<HTMLElement>('#dl')!.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 1) + '\n'], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'sinking.json' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  host.querySelector<HTMLElement>('#defaults')!.onclick = () => {
    if (!confirm('¿Volver a los valores por defecto? Se pierden los ajustes guardados en este navegador.')) return;
    clearLocal(); kindCtl(); blastCtl();
  };
  fresh();
}
