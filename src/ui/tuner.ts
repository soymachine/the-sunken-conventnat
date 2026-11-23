// Debug only (?debug=true): tune the desk's perspective and drag the bottle and the hourglass, then copy
// the values to hand over. Values are kept in this browser between visits.
const KEY = 'tsc:deskTuning';

interface Knob { v: string; label: string; min: number; max: number; step: number; unit: string; def: number }
const KNOBS: Knob[] = [
  { v: '--desk-persp', label: 'Perspective', min: 150, max: 2000, step: 10, unit: 'px', def: 260 },
  { v: '--desk-oy', label: 'Vanish height', min: -400, max: 100, step: 5, unit: '%', def: -55 },
  { v: '--desk-tilt', label: 'Tilt', min: 0, max: 70, step: 1, unit: 'deg', def: 38 },
  { v: '--desk-tex', label: 'Texture size', min: 200, max: 3000, step: 20, unit: 'px', def: 400 },
  { v: '--desk-shade', label: 'Back shade', min: 0, max: 1, step: 0.05, unit: '', def: 0.65 },
  { v: '--bottle-h', label: 'Bottle size', min: 60, max: 320, step: 2, unit: 'px', def: 132 },
  { v: '--glass-h', label: 'Glass size', min: 60, max: 320, step: 2, unit: 'px', def: 126 },
  { v: '--belt-y', label: 'Cards at rest (Y)', min: -120, max: 80, step: 2, unit: 'px', def: 26 },
  { v: '--card-lift', label: 'Card raised (Y)', min: 0, max: 200, step: 2, unit: 'px', def: 20 },
  { v: '--cursor-rot', label: 'Pointer rotation (about its tip)', min: -45, max: 45, step: 1, unit: 'deg', def: 0 },
  { v: '--wind', label: 'Wind strength', min: 0, max: 3, step: 0.1, unit: '', def: 1 },
  { v: '--mael-x', label: 'Gauge: X from centre', min: -700, max: 700, step: 2, unit: 'px', def: 288 },
  { v: '--windg-x', label: 'Wind gauge: X left of centre', min: -700, max: 700, step: 2, unit: 'px', def: 288 },
  { v: '--windg-y', label: 'Wind gauge: Y', min: 0, max: 600, step: 2, unit: 'px', def: 88 },
  { v: '--mael-y', label: 'Gauge: Y', min: 0, max: 600, step: 2, unit: 'px', def: 88 },
  { v: '--lamp-dir', label: 'Gauge lamps: top (-1) / bottom (1)', min: -1, max: 1, step: 2, unit: '', def: -1 },
  { v: '--lamp-x', label: 'Gauge lamps: X', min: -40, max: 40, step: 1, unit: 'px', def: 3 },
  { v: '--lamp-y', label: 'Gauge lamps: Y', min: -40, max: 40, step: 1, unit: 'px', def: 3 },
  { v: '--face-x', label: 'Gauge dial: X', min: -30, max: 30, step: 1, unit: 'px', def: 4 },
  { v: '--face-y', label: 'Gauge dial: Y', min: -30, max: 30, step: 1, unit: 'px', def: 3 },
  { v: '--mtext-x', label: 'Gauge number & text: X', min: -40, max: 40, step: 1, unit: 'px', def: 3 },
  { v: '--mtext-y', label: 'Gauge number & text: Y', min: -40, max: 40, step: 1, unit: 'px', def: 0 },
  { v: '--card-hue', label: 'Plain cards: hue', min: -180, max: 180, step: 2, unit: 'deg', def: 4 },
  { v: '--card-sat', label: 'Plain cards: saturation', min: 0, max: 3, step: 0.05, unit: '', def: 1 },
  { v: '--card-bri', label: 'Plain cards: brightness', min: 0.3, max: 1.8, step: 0.02, unit: '', def: 1 },
  { v: '--shot-hue', label: 'Shot cards: hue', min: -180, max: 180, step: 2, unit: 'deg', def: -38 },
  { v: '--shot-sat', label: 'Shot cards: saturation', min: 0, max: 3, step: 0.05, unit: '', def: 3 },
  { v: '--shot-bri', label: 'Shot cards: brightness', min: 0.3, max: 1.8, step: 0.02, unit: '', def: 0.58 },
  { v: '--move-hue', label: 'Move cards: hue', min: -180, max: 180, step: 2, unit: 'deg', def: 38 },
  { v: '--move-sat', label: 'Move cards: saturation', min: 0, max: 3, step: 0.05, unit: '', def: 3 },
  { v: '--move-bri', label: 'Move cards: brightness', min: 0.3, max: 1.8, step: 0.02, unit: '', def: 0.68 },
];
const MOVES: Record<string, { x: string; y: string; def: [number, number]; fromRight?: boolean }> = {
  bottle: { x: '--bottle-x', y: '--bottle-y', def: [29, 20] },
  glass: { x: '--glass-x', y: '--glass-y', def: [25, 1], fromRight: true },
};

/** Knobs that are not only CSS (the wind) are passed on to the game through this event. */
const tuned = (v: string, n: number) => dispatchEvent(new CustomEvent('tsc:tune', { detail: { v, n } }));

export function installTuner(hud: HTMLElement) {
  const root = document.documentElement.style;
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* storage unavailable */ }
  // Version 2 measures the gauge from the middle of the screen and the bottle and glass from its very edges:
  // older saved positions for those three would land in the wrong place, so they are dropped.
  if (saved['--tuning-v'] !== '2') { for (const k of ['--mael-x', '--glass-x', '--bottle-x']) delete saved[k]; saved['--tuning-v'] = '2'; }
  for (const [k, v] of Object.entries(saved)) { root.setProperty(k, v); queueMicrotask(() => tuned(k, parseFloat(v))); }
  const val = (k: string) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const save = () => {
    const all: Record<string, string> = {};
    for (const k of [...KNOBS.map((q) => q.v), ...Object.values(MOVES).flatMap((m) => [m.x, m.y])]) all[k] = val(k);
    all['--tuning-v'] = '2';
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
    out.value = JSON.stringify(all, null, 1);
  };

  const panel = document.body.appendChild(document.createElement('div'));
  panel.className = 'tuner';
  panel.innerHTML = `<h3>Desk tuning <button type="button" data-act="close">×</button></h3>${KNOBS.map((k) =>
    `<label>${k.label}<input type="range" data-v="${k.v}" min="${k.min}" max="${k.max}" step="${k.step}"><output></output></label>`).join('')}
    <div class="row"><button type="button" data-act="arrange">Move bottle &amp; glass</button><button type="button" data-act="copy">Copy values</button><button type="button" data-act="reset">Reset</button></div>
    <textarea readonly aria-label="Values"></textarea>`;
  const out = panel.querySelector('textarea')!;
  panel.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((inp) => {
    const k = KNOBS.find((q) => q.v === inp.dataset.v)!, o = inp.nextElementSibling as HTMLOutputElement;
    const cur = parseFloat(val(k.v)); inp.value = String(Number.isNaN(cur) ? k.def : cur); o.textContent = inp.value + k.unit;
    inp.oninput = () => { root.setProperty(k.v, inp.value + k.unit); o.textContent = inp.value + k.unit; save(); tuned(k.v, +inp.value); };
  });
  panel.querySelector<HTMLElement>('[data-act=close]')!.onclick = () => { panel.hidden = true; hud.classList.remove('arrange'); };
  panel.querySelector<HTMLElement>('[data-act=arrange]')!.onclick = (e) => {
    const on = hud.classList.toggle('arrange');
    (e.currentTarget as HTMLElement).textContent = on ? 'Done moving' : 'Move bottle & glass';
  };
  panel.querySelector<HTMLElement>('[data-act=copy]')!.onclick = () => {
    save(); out.select();
    navigator.clipboard?.writeText(out.value).catch(() => { /* the text stays selected for copying by hand */ });
  };
  panel.querySelector<HTMLElement>('[data-act=reset]')!.onclick = () => {
    for (const k of KNOBS) { root.removeProperty(k.v); tuned(k.v, k.def); }
    for (const m of Object.values(MOVES)) { root.removeProperty(m.x); root.removeProperty(m.y); }
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    panel.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((inp) => { const k = KNOBS.find((q) => q.v === inp.dataset.v)!; inp.value = String(k.def); (inp.nextElementSibling as HTMLOutputElement).textContent = k.def + k.unit; });
    save();
  };

  // Dragging the bottle and the glass while arranging.
  const drag = (el: HTMLElement, m: (typeof MOVES)[string]) => {
    el.addEventListener('pointerdown', (e) => {
      if (!hud.classList.contains('arrange')) return;
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, y0 = e.clientY, sx = parseFloat(val(m.x)) || m.def[0], sy = parseFloat(val(m.y)) || m.def[1];
      const move = (ev: PointerEvent) => {
        root.setProperty(m.x, Math.round(sx + (m.fromRight ? x0 - ev.clientX : ev.clientX - x0)) + 'px');
        root.setProperty(m.y, Math.round(sy + (y0 - ev.clientY)) + 'px');
      };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); save(); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    }, true);
    el.addEventListener('click', (e) => { if (hud.classList.contains('arrange')) { e.preventDefault(); e.stopPropagation(); } }, true);
  };
  drag(hud.querySelector<HTMLElement>('.battle .say')!, MOVES.bottle);
  drag(hud.querySelector<HTMLElement>('.battle .watch')!, MOVES.glass);
  save();
}
