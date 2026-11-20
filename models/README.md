# Source ship models

The models as they came out of Meshy, kept so the game's versions can be rebuilt. The game loads the
prepared copies in `public/models/`, made with:

```bash
python tools/prepare_ship.py -- models/ship-of-the-line.glb public/models/line.glb --squares 5 --bow=-x
python tools/refit_line.py -- public/models/line.glb public/models/line.glb
python tools/prepare_ship.py -- models/frigate.glb public/models/frigate.glb --squares 4 --bow=-x --beam 0.64 --height 2.3
python tools/prepare_ship.py -- models/ironclad.glb public/models/ironclad.glb --squares 3 --bow=+x --beam 0.72 --height 1.25 --deck=-0.068 --waterline 0.55
python tools/prepare_ship.py -- models/schooner.glb public/models/schooner.glb --squares 3 --bow=-x --beam 0.52 --height 2.0
python tools/prepare_ship.py -- models/cutter.glb public/models/cutter.glb --squares 2 --bow=-x --beam 0.5 --height 1.7
python tools/prepare_ship.py -- models/merchantman.glb public/models/merchant.glb --squares 3 --bow=-x --beam 0.8 --height 1.9
python tools/refit_merchant.py -- public/models/merchant.glb public/models/merchant.glb
python tools/refit_guns.py -- public/models/frigate.glb public/models/frigate.glb --x 0.22 --deck 0.049 --scale 1.14
python tools/refit_guns.py -- public/models/schooner.glb public/models/schooner.glb --x 0.3 --deck 0.058 --scale 1.36
python tools/refit_guns.py -- public/models/cutter.glb public/models/cutter.glb --x -0.2 --deck 0.114 --scale 1.73
python tools/refit_guns.py -- public/models/merchant.glb public/models/merchant.glb --x -0.4 --deck 0.138 --scale 1.36
python tools/refit_guns.py -- public/models/ironclad.glb public/models/ironclad.glb --x 0.17 --deck 0.115 --scale 1.36 --turret
python tools/grade_fleet.py -- public/models/line.glb public/models/frigate.glb public/models/ironclad.glb public/models/schooner.glb public/models/cutter.glb public/models/merchant.glb
```

The last step brings every texture to one palette (brightness, saturation, wood hue and a light sepia),
so ships generated one by one look like a set. Run it last, and again whenever a ship is replaced; it
skips files it has already graded.

These need Blender's Python module (`pip install bpy`, Python 3.13).

## Treasure props

`treasure.glb` (the open chest of gold) and `seal.glb` (the covenant seal with the kraken) come from
Meshy too. The game loads light copies, centred, standing on their base, scaled to 1 and with a 512 px
texture:

```bash
python tools/prepare_prop.py -- models/treasure.glb public/models/treasure.glb
python tools/prepare_prop.py -- models/seal.glb public/models/seal.glb
python tools/prepare_prop.py -- models/gull.glb public/models/gull.glb
```

The gull comes rigged from Meshy; the script drops the rig (and a stray helper sphere) and the game
bends the wings itself.
