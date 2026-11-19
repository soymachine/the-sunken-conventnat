# Ship models

A `.glb` here named after a ship class replaces the procedural ship of that class:

`line.glb` · `frigate.glb` · `ironclad.glb` · `schooner.glb` · `cutter.glb` · `merchant.glb`

Present now: `line.glb` (Ship of the Line, generated with Meshy and prepared with the script below).

## Preparing a model

Run models from an image-to-3D service through `tools/prepare_ship.py` (needs Blender's Python module:
`pip install bpy`, Python 3.13):

```bash
python tools/prepare_ship.py -- downloaded.glb public/models/frigate.glb --squares 4 --bow -x
```

It merges duplicate vertices, turns the bow to +X, scales the hull to exactly 1.0 long with the
waterline at height 0, narrows the beam and lowers the masts to the game's proportions, shrinks the
texture to 1024 px JPEG, and writes the deck height into the file. Options:

| Option | Default | Meaning |
|---|---|---|
| `--bow` | `-x` | Which way the bow points in the downloaded model (`+x` or `-x`) |
| `--squares` | `5` | Length of this ship on the chart |
| `--beam` | `0.74` | Hull beam wanted, in squares (a row is one square) |
| `--height` | `2.6` | Mast-top height above water wanted, in squares |
| `--waterline` | `0.45` | Waterline as a fraction of keel-to-deck height |
| `--deck` | measured | Deck height in source units, if the measurement is off |

The game keeps the model's texture and applies its own engraving shading over it. A model that is not
prepared still loads: it is laid along its longest side, scaled to the hull length and set on the water,
but its bow may face the wrong way and it may be too wide for its row.
