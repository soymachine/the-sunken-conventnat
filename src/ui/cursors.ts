// The game's own pointers, drawn as small SVGs: a brass arrow (or a quill) everywhere, and over the charts a
// pointer that tells what a click will do — a gun sight to fire, a spyglass to look, a ship's wheel to steer.
const ink = '#1a1208';
const brass = `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc95"/><stop offset=".55" stop-color="#b08d3c"/><stop offset="1" stop-color="#6b4f1a"/></linearGradient></defs>`;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${brass}${body}</svg>`;

export const CURSOR_SVG = {
  /** A classic arrow in polished brass. */
  brass: svg(`<path d="M3 2 L3 24 L9 19 L13 28 L17 26 L13 17 L21 17 Z" fill="url(#b)" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`),
  /** The same arrow, glowing a little: over anything that can be clicked. */
  brassHot: svg(`<path d="M3 2 L3 24 L9 19 L13 28 L17 26 L13 17 L21 17 Z" fill="url(#b)" stroke="#8c2f1b" stroke-width="1.8" stroke-linejoin="round"/>`),
  /** A goose quill, its nib the point. */
  quill: svg(`<path d="M6 8 C10 3, 23 9, 29 27 C21 23, 10 17, 6 8 Z" fill="#efe3c4" stroke="${ink}" stroke-width="1.2"/><path d="M5 5 L27 27" stroke="${ink}" stroke-width="1.2"/><path d="M1.5 1.5 L7.5 4.5 L4.5 7.5 Z" fill="${ink}"/>`),
  /** A gun sight: where a shot will fall. */
  sight: svg(`<circle cx="16" cy="16" r="10.5" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="url(#b)" stroke-width="2.2"/>${[[16, 2, 16, 9], [16, 23, 16, 30], [2, 16, 9, 16], [23, 16, 30, 16]].map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${ink}" stroke-width="3.4"/><line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#f0d489" stroke-width="1.4"/>`).join('')}<circle cx="16" cy="16" r="2" fill="#c0392b" stroke="${ink}" stroke-width=".8"/>`),
  /** A spyglass lens: where a glass or a sounding will look. */
  glass: svg(`<path d="M20 20 L29 29" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M20 20 L29 29" stroke="url(#b)" stroke-width="3.4" stroke-linecap="round"/><circle cx="13" cy="13" r="9" fill="rgba(190,225,235,.28)" stroke="${ink}" stroke-width="4"/><circle cx="13" cy="13" r="9" fill="none" stroke="url(#b)" stroke-width="2.2"/><path d="M8.5 10 A5 5 0 0 1 12 7.5" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8"/>`),
  /** A ship's wheel: take the helm of one of your ships. */
  helm: svg(`${[0, 45, 90, 135].map((a) => `<line x1="3" y1="16" x2="29" y2="16" transform="rotate(${a} 16 16)" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/><line x1="3.5" y1="16" x2="28.5" y2="16" transform="rotate(${a} 16 16)" stroke="url(#b)" stroke-width="1.6" stroke-linecap="round"/>`).join('')}<circle cx="16" cy="16" r="8" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="16" cy="16" r="8" fill="none" stroke="url(#b)" stroke-width="2.2"/><circle cx="16" cy="16" r="2.4" fill="url(#b)" stroke="${ink}" stroke-width="1"/>`),
} as const;
export type CursorName = keyof typeof CURSOR_SVG;
const HOT: Record<CursorName, [number, number]> = { brass: [3, 2], brassHot: [3, 2], quill: [2, 2], sight: [16, 16], glass: [13, 13], helm: [16, 16] };

const url = (n: CursorName, fallback: string) => `url("data:image/svg+xml,${encodeURIComponent(CURSOR_SVG[n])}") ${HOT[n][0]} ${HOT[n][1]}, ${fallback}`;

const hiDpi = typeof CSS !== 'undefined' && CSS.supports('cursor', 'image-set(url("x.png") 1x) 1 1, auto');

/** Pointer styles: 'brass' (default), 'quill', or 'system' for the browser's own. */
export type CursorStyle = 'brass' | 'quill' | 'system';
/** How far the arrow is turned about its tip, in degrees (tuned in debug; 0 is the picture as drawn). */
export const CURSOR_ROT = 15;
let rotation = CURSOR_ROT, lastStyle: CursorStyle = 'brass', job = 0;

/** Debug: turn the arrow about its tip (the click point), then put it back on screen. */
export function setCursorRotation(deg: number) { rotation = deg; applyCursors(lastStyle); }

/**
 * The arrow turned about its tip. Drawn on a canvas with room around the tip so no part is cut, at 1× and 2×.
 * Resolves with the two pictures and where the tip now sits (the click point).
 */
async function turned(f: string, deg: number) {
  const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [a, b] = await Promise.all([load(`/ui/${f}.png`), load(`/ui/${f}@2x.png`)]);
  const PAD = 12, TIP = 2; // the tip sits 2 px in from the corner of the 32-px picture
  const draw = (img: HTMLImageElement, k: number) => {
    const c = document.createElement('canvas'); c.width = c.height = (32 + 2 * PAD) * k;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
    g.translate((PAD + TIP) * k, (PAD + TIP) * k); g.rotate((deg * Math.PI) / 180); g.translate(-TIP * k, -TIP * k);
    g.drawImage(img, 0, 0, 32 * k, 32 * k);
    return c.toDataURL('image/png');
  };
  return { x1: draw(a, 1), x2: draw(b, 2), hot: PAD + TIP };
}

export function applyCursors(style: CursorStyle) {
  lastStyle = style;
  const r = document.documentElement.style;
  if (style === 'system') { for (const k of ['--cur', '--cur-hot', '--cur-sight', '--cur-glass', '--cur-helm']) r.removeProperty(k); return; }
  // The brass-and-ivory arrow (and its red twin over anything clickable) is a picture, sharp on high-density screens.
  const pic = (f: string, fallback: string) => (hiDpi
    ? `image-set(url("/ui/${f}.png") 1x, url("/ui/${f}@2x.png") 2x) 2 2, url("/ui/${f}.png") 2 2, ${fallback}`
    : `url("/ui/${f}.png") 2 2, ${fallback}`);
  r.setProperty('--cur', style === 'quill' ? url('quill', 'auto') : pic('cursor', 'auto'));
  r.setProperty('--cur-hot', style === 'quill' ? url('quill', 'pointer') : pic('cursor_hot', 'pointer'));
  // Turned arrows are drawn on the fly (only the newest request wins if the slider moves quickly).
  if (style === 'brass' && rotation) {
    const mine = ++job, deg = rotation;
    void Promise.all([turned('cursor', deg), turned('cursor_hot', deg)]).then(([n, h]) => {
      if (mine !== job) return;
      const set = (p: typeof n, fallback: string) => (hiDpi
        ? `image-set(url("${p.x1}") 1x, url("${p.x2}") 2x) ${p.hot} ${p.hot}, url("${p.x1}") ${p.hot} ${p.hot}, ${fallback}`
        : `url("${p.x1}") ${p.hot} ${p.hot}, ${fallback}`);
      r.setProperty('--cur', set(n, 'auto')); r.setProperty('--cur-hot', set(h, 'pointer'));
    }).catch(() => { /* keep the upright arrow */ });
  } else job++;
  r.setProperty('--cur-sight', url('sight', 'crosshair'));
  r.setProperty('--cur-glass', url('glass', 'zoom-in'));
  r.setProperty('--cur-helm', url('helm', 'pointer'));
}
