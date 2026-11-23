// The game's sounds by name. Each name can carry a recording (a file in public/sfx, listed in public/sfx/bank.json)
// with its own trim, gain and fades. Names with nothing assigned stay silent, except a few that fall back to a
// synthesised sound. The admin page (admin.html) assigns files; until they are published they live in this
// browser (IndexedDB), and the game on the same browser plays them at once.

export type Channel = 'sfx' | 'ambience' | 'music' | 'ui';
export interface SoundDef { id: string; group: string; channel: Channel; label: string; help: string; loop?: boolean }

export const SOUNDS: SoundDef[] = [
  // Combat
  { id: 'cannon', group: 'Combate', channel: 'sfx', label: 'Cañonazo', help: 'Cada disparo propio o enemigo.' },
  { id: 'whistle', group: 'Combate', channel: 'sfx', label: 'Silbido de la bala', help: 'La bala en vuelo, antes de caer.' },
  { id: 'plunge', group: 'Combate', channel: 'sfx', label: 'Bala al agua', help: 'Un disparo fallido que cae al mar.' },
  { id: 'hit', group: 'Combate', channel: 'sfx', label: 'Impacto en un barco', help: 'Un disparo que acierta.' },
  { id: 'clang', group: 'Combate', channel: 'sfx', label: 'Rebote en el blindaje', help: 'El primer impacto en el acorazado.' },
  { id: 'explosion', group: 'Combate', channel: 'sfx', label: 'Gran explosión', help: 'Estalla la santabárbara al hundir un barco.' },
  { id: 'sink', group: 'Combate', channel: 'sfx', label: 'Barco que se hunde', help: 'Crujidos y agua mientras se va a pique.' },
  { id: 'mast', group: 'Combate', channel: 'sfx', label: 'Mástil que cae', help: 'Madera que se astilla al hundirse.' },
  { id: 'roar', group: 'Combate', channel: 'sfx', label: 'Rugido del Kraken', help: 'Al invocar al Kraken.' },
  { id: 'slam', group: 'Combate', channel: 'sfx', label: 'Golpe de tentáculo', help: 'Cada golpe del Kraken en el agua.' },
  { id: 'creak', group: 'Combate', channel: 'sfx', label: 'Barco que maniobra', help: 'Navegar o virar.' },
  { id: 'glass', group: 'Combate', channel: 'sfx', label: 'Catalejo / sondeo', help: 'El resultado de una exploración.' },
  // Weather and ambience
  { id: 'deck', group: 'Ambiente', channel: 'ambience', label: 'Cubierta en el mar (bucle)', help: 'Fondo de toda la batalla.', loop: true },
  { id: 'wind', group: 'Ambiente', channel: 'ambience', label: 'Viento (bucle)', help: 'Sube con la fuerza del viento; calla en calma.', loop: true },
  { id: 'rain', group: 'Ambiente', channel: 'ambience', label: 'Lluvia (bucle)', help: 'Mientras hay tormenta.', loop: true },
  { id: 'thunder', group: 'Ambiente', channel: 'ambience', label: 'Trueno', help: 'Cada relámpago.' },
  { id: 'gull', group: 'Ambiente', channel: 'ambience', label: 'Gaviota', help: 'De vez en cuando, con buen tiempo.' },
  // Interface
  { id: 'click', group: 'Interfaz', channel: 'ui', label: 'Clic', help: 'Botones y elegir una orden.' },
  { id: 'cardHover', group: 'Interfaz', channel: 'ui', label: 'Carta: pasar por encima', help: 'Al levantar una carta de la mano.' },
  { id: 'cardPlay', group: 'Interfaz', channel: 'ui', label: 'Carta: jugar', help: 'Al usar una carta (vuela al mapa).' },
  { id: 'cardDeal', group: 'Interfaz', channel: 'ui', label: 'Carta: nueva en la mano', help: 'Una carta comprada o ganada que entra en la mano.' },
  { id: 'denied', group: 'Interfaz', channel: 'ui', label: 'No se puede', help: 'Clic en una carta o casilla no válida.' },
  { id: 'seal', group: 'Interfaz', channel: 'ui', label: 'Sello del pacto', help: 'Al ganar un sello.' },
  { id: 'coin', group: 'Interfaz', channel: 'ui', label: 'Monedas', help: 'Comprar al intendente.' },
  { id: 'treasure', group: 'Interfaz', channel: 'ui', label: 'Tesoro', help: 'Al ganar doblones por un impacto.' },
  { id: 'bell', group: 'Interfaz', channel: 'ui', label: 'Campana de turno', help: 'Empieza tu turno.' },
  { id: 'hourglass', group: 'Interfaz', channel: 'ui', label: 'Reloj de arena', help: 'Terminar el turno.' },
  { id: 'paper', group: 'Interfaz', channel: 'ui', label: 'Pergamino', help: 'Abrir una ventana, la guía o la bitácora.' },
  // Music
  { id: 'musicHome', group: 'Música', channel: 'music', label: 'Portada', help: 'Suena en la pantalla de inicio.', loop: true },
  { id: 'musicBattle', group: 'Música', channel: 'music', label: 'Batalla', help: 'Durante la partida.', loop: true },
  { id: 'musicTense', group: 'Música', channel: 'music', label: 'Batalla tensa', help: 'Cuando a alguno le queda un solo barco.', loop: true },
  { id: 'stingWin', group: 'Música', channel: 'music', label: 'Victoria', help: 'Al ganar (una vez).' },
  { id: 'stingLose', group: 'Música', channel: 'music', label: 'Derrota', help: 'Al perder (una vez).' },
];
export const SOUND = Object.fromEntries(SOUNDS.map((s) => [s.id, s])) as Record<string, SoundDef>;

/** How a recording is played: the file, the part of it kept (seconds), its gain and its fades. */
export interface Entry { file: string | null; start: number; end: number | null; gain: number; fadeIn: number; fadeOut: number; loop?: boolean }
export type Bank = Record<string, Entry>;
export const blank = (id: string): Entry => ({ file: null, start: 0, end: null, gain: 1, fadeIn: 0, fadeOut: 0, loop: SOUND[id]?.loop });

/* ---------- local assignments (this browser only) ---------- */
/** A file chosen in the admin page and not yet published; `silent` mutes a published sound here. */
export interface Local extends Entry { blob?: Blob; name?: string; silent?: boolean }

const DB = 'tsc-sounds', STORE = 'local';
function open(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((ok, no) => { const r = f(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}
export async function localAll(): Promise<Record<string, Local>> {
  try {
    const db = await open();
    return await new Promise((ok) => {
      const out: Record<string, Local> = {}, s = db.transaction(STORE).objectStore(STORE), c = s.openCursor();
      c.onsuccess = () => { const k = c.result; if (!k) return ok(out); out[k.key as string] = k.value as Local; k.continue(); };
      c.onerror = () => ok(out);
    });
  } catch { return {}; }
}
export const localSet = (id: string, v: Local) => tx('readwrite', (s) => s.put(v, id));
export const localDel = (id: string) => tx('readwrite', (s) => s.delete(id));

/** The published bank (public/sfx/bank.json); missing names are blank. */
export async function publishedBank(base = '/sfx/'): Promise<Bank> {
  try { const r = await fetch(base + 'bank.json', { cache: 'no-cache' }); if (r.ok) return await r.json() as Bank; } catch { /* none yet */ }
  return {};
}
