// After `vite build`, before version-assets: compress every model in dist/models with meshopt (EXT_meshopt_compression,
// with quantised vertices). The sources in public/models stay as they are, so the other tools can keep editing them.
// The game decodes them with three.js's MeshoptDecoder. Names, extras and node transforms are kept.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist/models/', import.meta.url).pathname;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
let before = 0, after = 0;
// The gull is left alone: its wings are bent vertex by vertex, which needs plain float positions.
const SKIP = new Set(['gull.glb']);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb') && !SKIP.has(f))) {
  const p = join(dir, f), b = statSync(p).size;
  const doc = await io.read(p);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(p, doc);
  before += b; after += statSync(p).size;
}
console.log(`compress-models: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB`);
