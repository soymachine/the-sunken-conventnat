// The colours that carry meaning on the charts: red for attack and "cannot", amber for moving and looking.
// Colour-blind mode swaps them for a vermilion and a sky blue (Okabe–Ito), which differ in hue and in lightness
// for every common kind of colour blindness.
const NORMAL = { wax: 0x8c2f1b, amber: 0xd9a441, ink: 0x0d0b08 };
const SAFE = { wax: 0xd55e00, amber: 0x56b4e9, ink: 0x0d0b08 };
export const PAL = { ...NORMAL };

export let colourBlind = false;
export function setColourBlind(on: boolean) {
  colourBlind = on;
  Object.assign(PAL, on ? SAFE : NORMAL);
  document.documentElement.classList.toggle('cvd', on);
  try { localStorage.setItem('tsc:cvd', on ? '1' : '0'); } catch { /* ignore */ }
}
try { if (localStorage.getItem('tsc:cvd') === '1') setColourBlind(true); } catch { /* ignore */ }
