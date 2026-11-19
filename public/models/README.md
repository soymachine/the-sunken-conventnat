# Ship models

A `.glb` here named after a ship class replaces the procedural ship of that class:

`line.glb` · `frigate.glb` · `ironclad.glb` · `schooner.glb` · `cutter.glb` · `merchant.glb`

Present now: all six. They were generated with Meshy (sources in `models/`, with the exact commands in
`models/README.md`) and prepared with the script below. Two have a refit on top:

- `line.glb` — `tools/refit_line.py`: a plank deck over the generated one, framed stern and quarter
  windows, and a swivel deck gun;
- `merchant.glb` — `tools/refit_merchant.py`: the crates fused into the hull are replaced by three
  separate ones, `crate_0` to `crate_2` from stern to bow, which the game removes one per crate plundered.

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
