// Before a deploy: bring the art of recent versions into dist/, beside the new art. A tab opened before a deploy
// still asks for /a/<old hash>/…, often only later (a card seen for the first time); without this, those files
// vanish when the new version goes up and that tab shows blank pictures until it is reloaded.
// The site keeps a list of the art sets it serves (/a-kept.json, newest first); the last KEEP of them stay up.
// Usage: node tools/keep-previous-assets.mjs [site]
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const KEEP = 6;
const site = process.argv[2] || 'https://the-sunken-covenant.web.app';
const dist = new URL('../dist/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sets = () => readdirSync(join(dist, 'a')).filter((f) => /^[0-9a-f]{10}$/.test(f) && statSync(join(dist, 'a', f)).isDirectory());
// The new build's own set is the one its code points at (others may already sit beside it).
const built = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('');
const mine = built.match(/\/a\/([0-9a-f]{10})\//)?.[1] ?? sets()[0];

const get = async (url) => { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? r : null; };
const html = await (await get(`${site}/?t=${Date.now()}`))?.text() ?? '';
const js = html.match(/\/assets\/[^"']+\.js/)?.[0];
const code = js ? await (await get(site + js))?.text() ?? '' : '';
const live = (html + code).match(/\/a\/([0-9a-f]{10})\//)?.[1];
let listed = [];
try { listed = await (await get(`${site}/a-kept.json?t=${Date.now()}`))?.json() ?? []; } catch { /* first time */ }
const old = [...new Set([live, ...listed].filter((h) => h && h !== mine))].slice(0, KEEP - 1);

// Each old set is assumed to hold the same files as the new one (a file added since simply is not there).
let kept = 0, missing = 0;
for (const h of old) {
  for (const f of walk(join(dist, 'a', mine))) {
    const rel = relative(join(dist, 'a', mine), f), out = join(dist, 'a', h, rel);
    if (existsSync(out)) continue;
    const r = await get(`${site}/a/${h}/${rel}`);
    if (!r) { missing++; continue; }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await r.arrayBuffer())); kept++;
  }
}
// Sets already put in dist/a by hand (say, one rebuilt from an older commit) are listed too.
const now = [...new Set([mine, ...old, ...sets()])].filter((h) => existsSync(join(dist, 'a', h))).slice(0, KEEP);
writeFileSync(join(dist, 'a-kept.json'), JSON.stringify(now));
console.log(`keep-previous-assets: new art ${mine}; kept ${old.length ? old.join(', ') : 'none'} (${kept} files, ${missing} not found)`);
