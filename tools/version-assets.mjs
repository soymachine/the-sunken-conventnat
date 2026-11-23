// After `vite build`: give the art, models and sounds a versioned path so browsers may keep them for a year.
// Every file under dist/{ui,models,sfx} moves to dist/a/<rev>/..., where <rev> is a hash of all of them, and every
// reference in the built code, styles and page is rewritten to match. Change any picture and the whole set gets a
// new path; change nothing and returning players download nothing. Firebase Hosting serves /a/** as immutable.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, renameSync, mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const DIRS = ['ui', 'models', 'sfx'];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

const h = createHash('sha1');
for (const dir of DIRS) for (const f of walk(join(dist, dir)).sort()) { h.update(relative(dist, f)); h.update(readFileSync(f)); }
const rev = h.digest('hex').slice(0, 10);

mkdirSync(join(dist, 'a', rev), { recursive: true });
for (const dir of DIRS) renameSync(join(dist, dir), join(dist, 'a', rev, dir));

// A path that starts a URL: not preceded by a letter, digit, dot, dash or slash (so "https://x.com/ui/" is left alone).
const re = new RegExp(`(?<![\\w.\\/-])/(${DIRS.join('|')})/`, 'g');
let files = 0, refs = 0;
for (const f of walk(dist).filter((p) => /\.(js|css|html)$/.test(p) && !p.includes(`${join('a', rev)}`))) {
  const s = readFileSync(f, 'utf8');
  const out = s.replace(re, (_, d) => { refs++; return `/a/${rev}/${d}/`; });
  if (out !== s) { writeFileSync(f, out); files++; }
}
// Nothing may still point at the old, unversioned folders.
for (const f of walk(dist).filter((p) => /\.(js|css|html)$/.test(p))) {
  const left = readFileSync(f, 'utf8').match(re);
  if (left) { console.error(`version-assets: ${relative(dist, f)} still refers to ${left[0]}`); process.exit(1); }
}
if (!existsSync(join(dist, 'a', rev, 'ui'))) process.exit(1);
console.log(`version-assets: art at /a/${rev}/ (${refs} references in ${files} files)`);
