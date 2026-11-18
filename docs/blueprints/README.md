# Ship draughts for modelling

Technical sheets of the six ships, drawn by code from the same proportions the game uses
(`src/render/ships.ts`). The unit is one square of the chart.

## Files (`png/`)

| File | What it is |
|---|---|
| `fleet.png` | The six profiles at one scale, to compare sizes |
| `<ship>-sheet.png` | Full draught, 2400×1500: profile, deck plan, bow and stern at one scale, with dimensions |
| `<ship>-side.png`, `-top.png`, `-bow.png`, `-stern.png` | Each view alone, 1024×1024, flat colours on a plain ground, no lettering |

`<ship>` is one of `line`, `frigate`, `ironclad`, `schooner`, `cutter`, `merchant`.

All four views of a ship come from one set of measurements, so hull length matches between profile and
plan, and beam matches between plan, bow and stern. `export.mjs` prints those figures when it runs.

To regenerate after editing `index.html`:

```bash
node docs/blueprints/export.mjs
```

## Using them with an image-to-3D service

- These are line drawings with flat colour. Image-to-3D services generally do better with a shaded
  picture of the object than with a plan, so treat the sheets mainly as a reference for shape and
  proportion. The single views are there to try as multi-view input (front = `bow`, back = `stern`,
  side = `side`, top = `top`) where a service accepts it.
- In the profile the square sails are drawn turned fore-and-aft, as on a sail plan, so their shape can
  be read. On the real ship (and in the plan, bow and stern views) they hang across the hull.
- The hatched area below the dashed line is the hull under water. The game floats ships at that line.

## What the game expects

Export each model as `.glb` and put it in `public/models/` under the ship's name: `line.glb`,
`frigate.glb`, `ironclad.glb`, `schooner.glb`, `cutter.glb`, `merchant.glb`. The game then uses it in
place of the procedural ship (see `public/models/README.md`).

- Longest side along the hull; the game scales it to the hull length and sits it on the waterline.
- Under about 15,000 triangles per ship.
- Textures are ignored: the game keeps each part's base colour and applies its own engraving shader.

## Text prompts

If the service also takes a description, these match the sheets.

- **Ship of the Line** — A British 74-gun ship of the line of the early 1800s, three masts with square
  sails set, two gun decks with ochre strakes and black gun ports, high stern with gallery windows,
  bowsprit, low-poly stylised model, clean silhouette, no base.
- **Frigate** — A fast naval frigate of the early 1800s, three masts with square sails set, a single
  gun deck with one dark ochre strake and gun ports, sleek hull, bowsprit, low-poly stylised model,
  clean silhouette, no base.
- **Ironclad** — An 1860s casemate ironclad warship, very low iron hull, sloped armoured casemate
  amidships with gun ports, one tall funnel, a ram bow, a short signal mast, riveted plates, no sails,
  low-poly stylised model, clean silhouette, no base.
- **Schooner** — A two-masted schooner of the 1800s, slender hull, fore-and-aft gaff sails and a jib,
  long bowsprit, low-poly stylised model, clean silhouette, no base.
- **Cutter** — A small single-masted naval cutter of the 1800s, gaff mainsail and jib, short deep hull,
  long bowsprit, low-poly stylised model, clean silhouette, no base.
- **Merchantman** — A broad-beamed merchant brig of the 1800s, two masts with square sails set, bluff
  bow, pale upper strake, three wooden cargo crates lashed on deck, no guns, low-poly stylised model,
  clean silhouette, no base.
