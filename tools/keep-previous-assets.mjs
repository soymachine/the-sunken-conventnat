// Before a deploy: bring the art of the version now live into dist/, beside the new art. A tab opened before the
// deploy still asks for /a/<old hash>/…; without this, those files vanish when the new version goes up and
// that tab loses its card backs, seals and so on until it is reloaded. Usage: node tools/keep-previous-assets.mjs [site]
import { mkdirSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const site = process.argv[2] || 'https://the-sunken-covenant.web.app';
const dist = new URL('../dist/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const mine = readdirSync(join(dist, 'a'))[0];

const html = await (await fetch(site + '/')).text();
const js = html.match(/\/assets\/[^"']+\.js/)?.[0];
const code = js ? await (await fetch(site + js)).text() : '';
const live = (html + code).match(/\/a\/([0-9a-f]{10})\//)?.[1];
if (!live || live === mine) { console.log(`keep-previous-assets: live art is ${live ?? 'unknown'}; nothing to keep`); process.exit(0); }

// The old set is assumed to hold the same files as the new one (a file added since simply is not there).
let kept = 0, missing = 0;
for (const f of walk(join(dist, 'a', mine))) {
  const rel = relative(join(dist, 'a', mine), f), out = join(dist, 'a', live, rel);
  if (existsSync(out)) continue;
  const r = await fetch(`${site}/a/${live}/${rel}`);
  if (!r.ok) { missing++; continue; }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await r.arrayBuffer())); kept++;
}
console.log(`keep-previous-assets: kept ${kept} files of /a/${live}/ for tabs still open (${missing} not found)`);
