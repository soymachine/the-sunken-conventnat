// Renders docs/blueprints/index.html and saves every draught and view as a PNG in docs/blueprints/png.
// Run from the repository root:  node docs/blueprints/export.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const out = join(here, 'png');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2600, height: 1700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

// Lay each drawing out at its natural pixel size so the PNG is exactly that size.
await page.addStyleTag({ content: 'body{padding:0!important} .wrap{max-width:none!important;gap:0!important} header,h2,figcaption{display:none!important} .frame,.views svg{border:0!important} .frame{overflow:visible!important} .views{display:block!important}' });
const names = await page.evaluate(() => [...document.querySelectorAll('svg[data-out]')].map((s) => {
  s.style.width = s.dataset.w + 'px'; s.style.height = s.dataset.h + 'px'; s.style.minWidth = '0'; s.style.maxWidth = 'none';
  return s.dataset.out;
}));
for (const name of names) await page.locator(`svg[data-out="${name}"]`).screenshot({ path: join(out, name + '.png') });

// The views of a ship must agree: hull length in profile = in plan, beam in plan = at the bow.
const checks = await page.evaluate(() => [...document.querySelectorAll('svg[data-out$="-sheet"]')].map((svg) => {
  const box = (v) => svg.querySelector(`.hull[data-view="${v}"]`).getBBox(), s = +svg.dataset.scale;
  const side = box('side'), top = box('top'), bow = box('bow');
  return { ship: svg.dataset.out.replace('-sheet', ''), lengthProfile: +(side.width / s).toFixed(3), lengthPlan: +(top.width / s).toFixed(3), beamPlan: +(top.height / s).toFixed(3), beamBow: +(bow.width / s).toFixed(3) };
}));
console.table(checks);
console.log(`${names.length} images written to ${out}`);
if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
await browser.close();
