# Ship models

A `.glb` here named after a ship class replaces the procedural ship of that class:

`line.glb` · `frigate.glb` · `ironclad.glb` · `schooner.glb` · `cutter.glb` · `merchant.glb`

Present now: all six. They were generated with Meshy (sources in `models/`, with the exact commands in
`models/README.md`) and prepared with the script below. Two have a refit on top:

- `line.glb` — `tools/refit_line.py`: a plank deck over the generated one, framed stern and quarter
  windows, and a swivel deck gun;
- `merchant.glb` — `tools/refit_merchant.py`: the crates fused into the hull are replaced by three
  separate ones, `crate_0` to `crate_2` from stern to bow, which the game removes one per crate plundered.

All six are colour-graded to one palette by `tools/grade_fleet.py`. A new model should go through it
too, or it will stand out from the rest.

## A deck gun

A model may carry a gun that turns to its target. The game looks for three nodes by name:

- `cannon` — the pivot: it turns about its vertical axis; the barrel must point along +X at rest;
- `barrel` — a child of `cannon`, pushed back along X for the recoil;
- `muzzle` — a child of `barrel` at the mouth: where shots, flash and smoke start.

When the player's ship with a gun is afloat, every shot is fired from it.

## Preparing a model

Run models from an image-to-3D service through `tools/prepare_ship.py` (needs Blender's Python module:
`pip install bpy`, Python 3.13):

```bash
python tools/prepare_ship.py -- downloaded.glb public/models/frigate.glb --squares 4 --bow=-x
```

It merges duplicate vertices, turns the bow to +X, scales the hull to exactly 1.0 long with the
waterline at height 0, narrows the beam and lowers the masts to the game's proportions, shrinks the
texture to 1024 px JPEG, and writes the deck height into the file. Options:

| Option | Default | Meaning |
|---|---|---|
| `--bow` | `-x` | Which way the bow points in the downloaded model (`+x` or `-x`) |
| `--squares` | `5` | Length of this ship on the chart |
| `--beam` | `0.74` | Widest hull beam allowed, in squares (a row is one square); a narrower model is left as it is |
| `--height` | `2.6` | Highest mast top allowed above water, in squares; a lower model is left as it is |
| `--waterline` | `0.45` | Waterline as a fraction of keel-to-deck height |
| `--deck` | measured | Deck height in source units, if the measurement is off |

The game keeps the model's texture and applies its own engraving shading over it. A model that is not
prepared still loads: it is laid along its longest side, scaled to the hull length and set on the water,
but its bow may face the wrong way and it may be too wide for its row.

## Flat colours (0.33.1)

The six ships no longer carry a texture. `tools/flatten_colors.py` gave every triangle one colour: the texture's
dominant colour under it, snapped to a ten-colour palette per ship, with stray triangles taking their
neighbours' colour. The colours are stored per vertex (COLOR_0). This removes the blur that came from the texture's
many small UV islands. The originals are in git history (before 0.33.1); to redo one:

    python3 tools/flatten_colors.py <original.glb> public/models/<kind>.glb --colors 10

In the game, `src/render/ships.ts` paints the deck band, the inside of the bulwarks and the rail tops one plank
colour, and draws pale canvas as clean cloth.
