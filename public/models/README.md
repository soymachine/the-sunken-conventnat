# Ship models

Drop a `.glb` file here named after a ship class and the game uses it instead of the procedural ship:

`line.glb` · `frigate.glb` · `ironclad.glb` · `schooner.glb` · `cutter.glb`

- The model is scaled so its longest horizontal side matches the hull length, and sits on the waterline.
- Its colours are kept, but the game's engraving shader replaces the materials, so textures are ignored.
- Aim for under ~15,000 triangles per ship.
