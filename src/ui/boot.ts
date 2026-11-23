// The loading screen: the title and a brass bar over the home while the ships, the card pictures and the type
// come in, so nothing pops in afterwards. It never holds the game back more than a few seconds.
import { loadPropModels, loadShipModels } from '../render/ships';

const CARDS = ['fire', 'sail', 'turn', 'broadside', 'chain', 'spy', 'spyglass', 'longglass', 'fireship', 'fog', 'shipwright', 'winds', 'current', 'pact', 'kraken',
  'squall', 'gale', 'sound', 'double', 'bindLater', 'bindSooner', 'escort', 'reckoning'];
const PICTURES = [...CARDS.map((n) => `/ui/cards/${n}.webp`), '/ui/card.webp', '/ui/card_kraken.webp', '/ui/ap_seal.webp'];

export function boot(): Promise<void> {
  const veil = document.body.appendChild(document.createElement('div'));
  veil.id = 'boot';
  veil.innerHTML = `<div class="bootIn"><h1>The Sunken Covenant</h1><div class="bar"><i></i></div><p>Weighing anchor…</p></div>`;
  const bar = veil.querySelector<HTMLElement>('.bar i')!;
  const picture = (src: string) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src; });
  const jobs: Promise<unknown>[] = [loadShipModels(), loadPropModels(), document.fonts?.ready ?? Promise.resolve(), ...PICTURES.map(picture)];
  let done = 0;
  for (const j of jobs) void j.finally(() => { done++; bar.style.width = `${Math.round((100 * done) / jobs.length)}%`; });
  const all = Promise.allSettled(jobs), late = new Promise((ok) => setTimeout(ok, 9000));
  return Promise.race([all, late]).then(() => {
    bar.style.width = '100%';
    veil.classList.add('gone');
    setTimeout(() => veil.remove(), 700);
  });
}
