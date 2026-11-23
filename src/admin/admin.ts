// The sound desk: drop a recording onto a sound's name, trim it, set its level and fades, listen, and keep it.
// What is kept lives in this browser (IndexedDB) and the game on this browser plays it at once. "Descargar
// paquete" makes a .zip with the new files and bank.json, to be published with the game (unzip into public/sfx).
import './admin.css';
import { Bank, Entry, Local, SOUNDS, SoundDef, blank, localAll, localDel, localSet, publishedBank } from '../audio/bank';
import { zip } from './zip';

const SYNTH = new Set(['cannon', 'splash', 'hit', 'clang', 'sink', 'coin', 'glass', 'click', 'bell', 'roar', 'thunder', 'creak', 'plunge', 'treasure']);
const tell = (() => { try { const ch = new BroadcastChannel('tsc-sounds'); return () => ch.postMessage('changed'); } catch { return () => {}; } })();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const sec = (s: number) => s.toFixed(2);

let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());
let published: Bank = {}, local: Record<string, Local> = {};
const buffers = new Map<string, { key: string; buf: AudioBuffer }>();
let playing: { id: string; src: AudioBufferSourceNode; t0: number; from: number; rate: number; loop: boolean; a: number; b: number } | null = null;

/** What the game will play for this name: this browser's assignment, else the published one. */
function current(id: string): { e: Entry; where: 'local' | 'published' | 'none'; silent: boolean; name: string } {
  const l = local[id];
  if (l?.silent) return { e: published[id] ?? blank(id), where: 'local', silent: true, name: '' };
  if (l) return { e: l, where: 'local', silent: false, name: l.blob ? l.name ?? 'archivo local' : l.file ?? '' };
  if (published[id]?.file) return { e: published[id], where: 'published', silent: false, name: published[id].file! };
  return { e: blank(id), where: 'none', silent: false, name: '' };
}

async function bufferFor(id: string): Promise<AudioBuffer | null> {
  const { e, silent } = current(id), l = local[id];
  if (silent || (!e.file && !l?.blob)) return null;
  const key = l?.blob ? `blob:${l.name}:${l.blob.size}` : `file:${e.file}`;
  const have = buffers.get(id);
  if (have?.key === key) return have.buf;
  try {
    const data = l?.blob ? await l.blob.arrayBuffer() : await (await fetch(`/sfx/${e.file}`)).arrayBuffer();
    const buf = await ac().decodeAudioData(data);
    buffers.set(id, { key, buf });
    return buf;
  } catch { return null; }
}

/* ---------- page ---------- */
document.body.innerHTML = `
  <header>
    <div><h1>Sonidos</h1><p>Arrastra un MP3, WAV u OGG sobre un sonido. Recórtalo moviendo las marcas, ajusta el volumen y los fundidos, y escúchalo. Los cambios se guardan en este navegador y el juego, abierto en este mismo navegador, los usa al momento. Para publicarlos para todos, descarga el paquete y súbelo a la rama.</p></div>
    <div class="actions"><button id="pack" class="primary">Descargar paquete (.zip)</button><a href="/" class="btn">Ir al juego</a></div>
  </header>
  <main>${[...new Set(SOUNDS.map((s) => s.group))].map((g) => `<section><h2>${g}</h2>${SOUNDS.filter((s) => s.group === g).map(row).join('')}</section>`).join('')}</main>
  <input type="file" id="pick" accept="audio/*,.mp3,.wav,.ogg" hidden>`;

function row(s: SoundDef) {
  return `<article class="snd" data-id="${s.id}">
    <div class="head"><b>${esc(s.label)}</b><code>${s.id}</code><span class="state"></span><p>${esc(s.help)}</p></div>
    <div class="wave"><canvas></canvas><div class="drop">Suelta aquí un archivo de audio<br><small>o pulsa «Elegir archivo»</small></div></div>
    <div class="ctl">
      <button data-act="play" class="play" title="Escuchar el recorte">▶</button><button data-act="stop" title="Parar">■</button>
      <label>Inicio <input data-k="start" type="number" step="0.01" min="0"></label>
      <label>Fin <input data-k="end" type="number" step="0.01" min="0"></label>
      <label>Volumen <input data-k="gain" type="range" min="0" max="2" step="0.01"><output></output></label>
      <label>Entrada <input data-k="fadeIn" type="number" step="0.05" min="0"></label>
      <label>Salida <input data-k="fadeOut" type="number" step="0.05" min="0"></label>
      ${s.loop ? '<label class="chk"><input data-k="loop" type="checkbox"> En bucle</label>' : ''}
      <span class="grow"></span>
      <button data-act="pick">Elegir archivo</button>
      <button data-act="silence" title="No suena nada con este nombre">Silenciar</button>
      <button data-act="reset" title="Vuelve a lo publicado">Deshacer local</button>
    </div>
  </article>`;
}

const el = (id: string) => document.querySelector<HTMLElement>(`.snd[data-id="${id}"]`)!;

async function paint(id: string) {
  const box = el(id), { e, where, silent, name } = current(id);
  const st = box.querySelector('.state')!;
  st.className = 'state ' + (silent ? 'silent' : where);
  st.textContent = silent ? 'Silenciado aquí' : where === 'local' ? `Local: ${name}` : where === 'published' ? `Publicado: ${name}` : SYNTH.has(id) ? 'Sin grabación (suena el sintético)' : 'Sin sonido';
  box.classList.toggle('empty', !name || silent);
  const buf = await bufferFor(id);
  const dur = buf?.duration ?? 0;
  const set = (k: string, v: string | number | boolean) => { const i = box.querySelector<HTMLInputElement>(`[data-k="${k}"]`); if (!i) return; if (i.type === 'checkbox') i.checked = !!v; else i.value = String(v); };
  set('start', sec(e.start || 0)); set('end', sec(e.end ?? dur)); set('gain', e.gain ?? 1); set('fadeIn', e.fadeIn ?? 0); set('fadeOut', e.fadeOut ?? 0); set('loop', e.loop ?? false);
  box.querySelector('output')!.textContent = `${Math.round((e.gain ?? 1) * 100)} %`;
  box.querySelectorAll<HTMLInputElement>('.ctl input').forEach((i) => { i.disabled = !buf; if (i.dataset.k === 'end' || i.dataset.k === 'start') i.max = sec(dur); });
  box.querySelector<HTMLButtonElement>('[data-act=play]')!.disabled = !buf;
  box.querySelector<HTMLButtonElement>('[data-act=reset]')!.disabled = where !== 'local';
  box.querySelector<HTMLButtonElement>('[data-act=silence]')!.textContent = silent ? 'Quitar silencio' : 'Silenciar';
  draw(id, buf);
}

/** The waveform, the parts trimmed away shaded, the two marks and (while it plays) the playhead. */
function draw(id: string, buf: AudioBuffer | null) {
  const cv = el(id).querySelector('canvas')!, dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d')!; g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  if (!buf) return;
  const { e } = current(id), dur = buf.duration, a = (e.start || 0) / dur, b = (e.end ?? dur) / dur;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, k) => buf.getChannelData(k)), n = chans[0].length, step = Math.max(1, Math.floor(n / w));
  g.fillStyle = '#d9a441';
  for (let x = 0; x < w; x++) {
    let hi = 0; const i0 = Math.floor((x / w) * n);
    for (let i = i0; i < Math.min(n, i0 + step); i += 4) for (const c of chans) hi = Math.max(hi, Math.abs(c[i]));
    const y = hi * (h / 2 - 2);
    g.globalAlpha = x / w >= a && x / w <= b ? 1 : 0.3;
    g.fillRect(x, h / 2 - y, 1, Math.max(1, 2 * y));
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(10,8,5,.55)'; g.fillRect(0, 0, a * w, h); g.fillRect(b * w, 0, w - b * w, h);
  for (const [p, label] of [[a, 'I'], [b, 'F']] as const) {
    g.fillStyle = '#f3e6c4'; g.fillRect(p * w - 1, 0, 2, h);
    g.fillRect(p * w - (label === 'I' ? 0 : 14), 0, 14, 14);
    g.fillStyle = '#1a1208'; g.font = '700 10px Cinzel, serif'; g.fillText(label, p * w - (label === 'I' ? -4 : 10), 11);
  }
  // Fades as slopes over the kept part.
  const fi = (e.fadeIn || 0) / dur, fo = (e.fadeOut || 0) / dur;
  g.strokeStyle = 'rgba(243,230,196,.7)'; g.beginPath();
  g.moveTo(a * w, h); g.lineTo((a + fi) * w, 2); g.lineTo((b - fo) * w, 2); g.lineTo(b * w, h); g.stroke();
  if (playing?.id === id) {
    const t = (ac().currentTime - playing.t0) * playing.rate, len = playing.b - playing.a;
    let pos = playing.from + t;
    if (playing.loop) pos = playing.a + ((pos - playing.a) % len);
    g.fillStyle = '#c0392b'; g.fillRect((pos / dur) * w - 1, 0, 2, h);
  }
}

/** Save this name's assignment (debounced a little while a slider moves) and tell the game. */
const timers: Record<string, number> = {};
function save(id: string, patch: Partial<Local>) {
  const { e, where } = current(id);
  local[id] = { ...(where === 'local' ? local[id] : { ...e }), ...patch, silent: patch.silent ?? false } as Local;
  clearTimeout(timers[id]);
  timers[id] = window.setTimeout(() => { void localSet(id, local[id]).then(tell); }, 250);
}

async function play(id: string) {
  stop();
  const buf = await bufferFor(id); if (!buf) return;
  const c = ac(), { e } = current(id), src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
  const a = Math.min(e.start || 0, buf.duration), b = Math.min(e.end ?? buf.duration, buf.duration), len = Math.max(0.01, b - a), peak = e.gain ?? 1;
  src.buffer = buf; src.connect(g).connect(c.destination);
  g.gain.setValueAtTime(e.fadeIn ? 0 : peak, t); if (e.fadeIn) g.gain.linearRampToValueAtTime(peak, t + e.fadeIn);
  if (e.loop) { src.loop = true; src.loopStart = a; src.loopEnd = b; src.start(t, a); }
  else { src.start(t, a, len); if (e.fadeOut) { g.gain.setValueAtTime(peak, t + Math.max(e.fadeIn || 0, len - e.fadeOut)); g.gain.linearRampToValueAtTime(0, t + len); } }
  playing = { id, src, t0: t, from: a, rate: 1, loop: !!e.loop, a, b };
  el(id).classList.add('playing');
  src.onended = () => { if (playing?.src === src) stop(); };
  const tick = () => { if (playing?.src !== src) return; draw(id, buf); requestAnimationFrame(tick); };
  tick();
}
function stop() {
  if (!playing) return;
  const p = playing; playing = null;
  try { p.src.stop(); } catch { /* done */ }
  el(p.id).classList.remove('playing');
  void bufferFor(p.id).then((b) => draw(p.id, b));
}

async function take(id: string, f: File) {
  if (!/^audio\//.test(f.type) && !/\.(mp3|wav|ogg|m4a)$/i.test(f.name)) { alert('Eso no parece un archivo de audio.'); return; }
  stop();
  let dur: number | null = null;
  try { dur = (await ac().decodeAudioData(await f.arrayBuffer())).duration; } catch { alert('No se puede leer ese archivo de audio.'); return; }
  const def = blank(id);
  local[id] = { ...def, end: dur, blob: f, name: f.name, file: null };
  await localSet(id, local[id]); tell();
  await paint(id);
}

/* ---------- events ---------- */
const main = document.querySelector('main')!;
let pickFor = '';
main.addEventListener('click', (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>('[data-act]'); if (!b) return;
  const id = b.closest<HTMLElement>('.snd')!.dataset.id!;
  const act = b.dataset.act;
  if (act === 'play') void play(id);
  if (act === 'stop') stop();
  if (act === 'pick') { pickFor = id; document.querySelector<HTMLInputElement>('#pick')!.click(); }
  if (act === 'silence') { const s = current(id).silent; save(id, { silent: !s }); if (s && !local[id].file && !local[id].blob) { delete local[id]; void localDel(id).then(tell); } void paint(id); }
  if (act === 'reset') { stop(); delete local[id]; void localDel(id).then(tell); void paint(id); }
});
document.querySelector<HTMLInputElement>('#pick')!.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f && pickFor) void take(pickFor, f); (ev.target as HTMLInputElement).value = ''; };
main.addEventListener('input', (ev) => {
  const i = ev.target as HTMLInputElement, k = i.dataset.k; if (!k) return;
  const id = i.closest<HTMLElement>('.snd')!.dataset.id!;
  const v = i.type === 'checkbox' ? i.checked : Math.max(0, parseFloat(i.value) || 0);
  save(id, { [k]: v } as Partial<Local>);
  if (k === 'gain') i.parentElement!.querySelector('output')!.textContent = `${Math.round((v as number) * 100)} %`;
  void bufferFor(id).then((b) => draw(id, b));
});
// Drag a file onto any sound.
main.addEventListener('dragover', (ev) => { const s = (ev.target as Element).closest('.snd'); if (!s) return; ev.preventDefault(); document.querySelectorAll('.snd.over').forEach((x) => x !== s && x.classList.remove('over')); s.classList.add('over'); });
main.addEventListener('dragleave', (ev) => { const s = (ev.target as Element).closest('.snd'); if (s && !s.contains(ev.relatedTarget as Node)) s.classList.remove('over'); });
main.addEventListener('drop', (ev) => {
  const s = (ev.target as Element).closest<HTMLElement>('.snd'); if (!s) return;
  ev.preventDefault(); s.classList.remove('over');
  const f = ev.dataTransfer?.files?.[0]; if (f) void take(s.dataset.id!, f);
});
addEventListener('dragover', (ev) => ev.preventDefault());
addEventListener('drop', (ev) => ev.preventDefault());
// Drag the marks on the waveform: the nearer one follows the pointer.
main.addEventListener('pointerdown', (ev) => {
  const cv = (ev.target as Element).closest('canvas'); if (!cv) return;
  const id = cv.closest<HTMLElement>('.snd')!.dataset.id!;
  void bufferFor(id).then((buf) => {
    if (!buf) return;
    const r = cv.getBoundingClientRect(), dur = buf.duration;
    const at = (x: number) => Math.max(0, Math.min(dur, ((x - r.left) / r.width) * dur));
    const { e } = current(id), t = at(ev.clientX), which = Math.abs(t - (e.start || 0)) <= Math.abs(t - (e.end ?? dur)) ? 'start' : 'end';
    const move = (x: number) => {
      const cur = current(id).e; let v = at(x);
      if (which === 'start') v = Math.min(v, (cur.end ?? dur) - 0.02); else v = Math.max(v, (cur.start || 0) + 0.02);
      save(id, { [which]: +v.toFixed(3) } as Partial<Local>);
      const inp = el(id).querySelector<HTMLInputElement>(`[data-k="${which}"]`)!; inp.value = sec(v);
      draw(id, buf);
    };
    move(ev.clientX);
    cv.setPointerCapture(ev.pointerId);
    cv.onpointermove = (m) => move(m.clientX);
    cv.onpointerup = () => { cv.onpointermove = null; cv.onpointerup = null; };
  });
});
addEventListener('keydown', (ev) => { if (ev.key === ' ' && (ev.target as Element).tagName !== 'INPUT') { ev.preventDefault(); stop(); } });
addEventListener('resize', () => { for (const s of SOUNDS) void bufferFor(s.id).then((b) => draw(s.id, b)); });

/* ---------- the pack ---------- */
document.querySelector<HTMLElement>('#pack')!.onclick = async () => {
  const bank: Bank = JSON.parse(JSON.stringify(published));
  const files: { name: string; data: Uint8Array }[] = [];
  for (const s of SOUNDS) {
    const l = local[s.id]; if (!l) continue;
    if (l.silent) { delete bank[s.id]; continue; }
    let file = l.file;
    if (l.blob) { const ext = (l.name?.match(/\.(\w+)$/)?.[1] ?? 'mp3').toLowerCase(); file = `${s.id}.${ext}`; files.push({ name: file, data: new Uint8Array(await l.blob.arrayBuffer()) }); }
    bank[s.id] = { file, start: +(l.start || 0).toFixed(3), end: l.end == null ? null : +l.end.toFixed(3), gain: +(l.gain ?? 1).toFixed(3), fadeIn: +(l.fadeIn || 0).toFixed(3), fadeOut: +(l.fadeOut || 0).toFixed(3), ...(l.loop !== undefined ? { loop: l.loop } : {}) };
  }
  const sorted = Object.fromEntries(Object.entries(bank).sort(([a], [b]) => a.localeCompare(b)));
  files.push({ name: 'bank.json', data: new TextEncoder().encode(JSON.stringify(sorted, null, 1) + '\n') });
  const url = URL.createObjectURL(new Blob([zip(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `sonidos-${new Date().toISOString().slice(0, 10)}.zip` });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/* ---------- start ---------- */
void (async () => {
  [published, local] = await Promise.all([publishedBank(), localAll()]);
  for (const s of SOUNDS) void paint(s.id);
})();
