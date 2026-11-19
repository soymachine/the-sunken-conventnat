# Meshy prompts for the fleet

One prompt per ship, written for Meshy's agent or text box. They share the same rules so the fleet
looks like one set, and they ask for what made the Ship of the Line easy to prepare:

- low-poly, chunky, no ropes or thin parts (thin parts fall apart when polygons are reduced);
- a plain flat plank deck and simple flat windows (the generated ones came out blotchy);
- **no cannons on deck** — the game adds its own swivel gun where it needs one;
- flat colours that match the game's palette, low texture resolution, GLB.

Settings in Meshy: try **Topology Mesh** (low-poly mode) first. Otherwise turn on **Remesh**, **Fixed**,
**Triangle** topology, with the face count given in each prompt, and the lowest texture resolution (2K).

After download, each model goes through `tools/prepare_ship.py` with its length on the chart
(`--squares`); see `public/models/README.md`.

---

## Frigate (4 squares)

```
Create a game-ready, low-poly 3D model of an early-1800s naval frigate (a fast 38-gun warship).

Style: stylised low-poly, clean faceted surfaces, chunky simplified shapes, like a strategy board-game
piece. Not realistic, not high detail. It must look lighter and sleeker than a ship of the line.

Shape:
- Long, slender wooden hull, about 6 times longer than it is wide, with a gentle upward sweep at bow and
  stern. A modest squared-off stern, lower than a ship of the line's, with one row of three flat windows.
  Pointed bow.
- One single row of square gun ports along each side, modelled as shallow dark recesses. No cannons
  sticking out, no cannons on deck.
- A flat, plain plank deck with no clutter: no hatches, crates, coils, barrels or boats.
- Three vertical masts. The middle mast is the tallest; total mast height about 0.45 times the hull length.
- On each mast, two square sails set across the ship, each a single gently curved thick panel.
- One bowsprit pointing forward and slightly upward from the bow.
- A small red pennant at the top of each mast.

Keep it simple:
- NO ropes, rigging lines, ladders, nets or thin cables of any kind.
- No crew, no detailed flags, no water, no base or stand, no ground plane.
- Every part solid and at least as thick as a mast; no paper-thin surfaces.

Colours (flat, solid colours per part, no painted detail):
- Hull below the gun ports: very dark brown, almost black.
- Band along the gun deck: dark ochre.
- Deck: medium brown wood.
- Masts and bowsprit: dark brown.
- Sails: off-white parchment.
- Pennants: deep red.
- Stern windows: warm amber glass in dark wooden frames.

Technical:
- Target 10,000 to 14,000 triangles in total.
- Lowest texture resolution available; base colour only is enough.
- Hull lying along its length, waterline flat and level, model centred.
- Export as GLB.
```

## Ironclad (3 squares)

```
Create a game-ready, low-poly 3D model of an 1860s casemate ironclad warship.

Style: stylised low-poly, clean faceted surfaces, chunky simplified shapes, like a strategy board-game
piece. Not realistic, not high detail.

Shape:
- A very low, flat iron hull, about 4 times longer than it is wide, sitting almost flush with the water,
  with a slightly pointed ram bow and a rounded stern.
- In the middle, a long armoured casemate shaped like a sloped box (a truncated pyramid with a flat top),
  covering about half the hull length and most of its width.
- Three square gun ports on each sloped side of the casemate, modelled as shallow dark recesses. No
  cannons sticking out.
- One tall, round black smokestack rising from the top of the casemate, with two thin brass bands.
- A small square pilot house at the front end of the casemate roof.
- One short, plain signal mast near the stern with a small red pennant. No sails at all.
- A few large rivet bumps along the casemate edges are enough to suggest iron plates.

Keep it simple:
- NO ropes, railings, ladders, chains or thin cables of any kind.
- No crew, no smoke, no water, no base or stand, no ground plane.
- Every part solid; no paper-thin surfaces.

Colours (flat, solid colours per part):
- Hull: dark iron grey, almost black.
- Casemate: slightly lighter iron grey.
- Deck: dull grey.
- Smokestack: black with brass bands.
- Pennant: deep red.

Technical:
- Target 6,000 to 9,000 triangles in total.
- Lowest texture resolution available; base colour only is enough.
- Hull lying along its length, waterline flat and level, model centred.
- Export as GLB.
```

## Schooner (3 squares)

```
Create a game-ready, low-poly 3D model of an 1800s two-masted schooner.

Style: stylised low-poly, clean faceted surfaces, chunky simplified shapes, like a strategy board-game
piece. Not realistic, not high detail. It must look fast and nimble.

Shape:
- A slender, low wooden hull, about 5.5 times longer than it is wide, with a sharp pointed bow and a
  small flat transom stern. Gentle sheer line.
- Two gun ports on each side, modelled as shallow dark recesses. No cannons sticking out, no cannons on
  deck.
- A flat, plain plank deck with no clutter: no hatches, crates, coils or boats.
- Two masts, slightly raked back; the rear mast is a little taller. Total mast height about 0.6 times the
  hull length.
- Fore-and-aft gaff sails on both masts (four-cornered sails behind each mast, with a boom at the bottom
  and a gaff at the top), plus one triangular jib between the front mast and the bowsprit. Each sail a
  single gently curved thick panel.
- A long bowsprit pointing forward and slightly upward.
- A small red pennant at the top of each mast.

Keep it simple:
- NO ropes, rigging lines, ladders, nets or thin cables of any kind.
- No crew, no water, no base or stand, no ground plane.
- Every part solid and at least as thick as a mast; no paper-thin surfaces.

Colours (flat, solid colours per part):
- Hull: dark brown.
- Upper band along the hull: warm medium brown.
- Deck: light brown wood.
- Masts, booms and bowsprit: dark brown.
- Sails: off-white parchment.
- Pennants: deep red.

Technical:
- Target 7,000 to 10,000 triangles in total.
- Lowest texture resolution available; base colour only is enough.
- Hull lying along its length, waterline flat and level, model centred.
- Export as GLB.
```

## Cutter (2 squares)

```
Create a game-ready, low-poly 3D model of a small 1800s single-masted naval cutter.

Style: stylised low-poly, clean faceted surfaces, chunky simplified shapes, like a strategy board-game
piece. Not realistic, not high detail. It is the smallest ship of the fleet: compact and sturdy.

Shape:
- A short, deep wooden hull, about 4 times longer than it is wide, with a rounded bow and a small flat
  transom stern.
- One small gun port on each side, modelled as a shallow dark recess. No cannons sticking out, no cannons
  on deck.
- A flat, plain plank deck with no clutter.
- One single mast, a little forward of the middle, about 0.7 times the hull length tall.
- One large fore-and-aft gaff mainsail behind the mast (boom at the bottom, gaff at the top) and one
  triangular jib in front of it running to the bowsprit. Each sail a single gently curved thick panel.
- A long bowsprit pointing forward, almost as long as half the hull.
- A small red pennant at the top of the mast.

Keep it simple:
- NO ropes, rigging lines, ladders or thin cables of any kind.
- No crew, no water, no base or stand, no ground plane.
- Every part solid and at least as thick as the mast; no paper-thin surfaces.

Colours (flat, solid colours per part):
- Hull: dark brown.
- Upper band along the hull: warm medium brown.
- Deck: light brown wood.
- Mast, boom and bowsprit: dark brown.
- Sails: off-white parchment.
- Pennant: deep red.

Technical:
- Target 4,000 to 7,000 triangles in total.
- Lowest texture resolution available; base colour only is enough.
- Hull lying along its length, waterline flat and level, model centred.
- Export as GLB.
```

## Merchantman (3 squares, Convoy mode)

```
Create a game-ready, low-poly 3D model of an early-1800s merchant brig carrying cargo.

Style: stylised low-poly, clean faceted surfaces, chunky simplified shapes, like a strategy board-game
piece. Not realistic, not high detail. It must read clearly as a trader, not a warship.

Shape:
- A broad, round-bellied wooden hull, about 3.5 times longer than it is wide, with a bluff, rounded bow
  and a square stern with one row of three flat windows.
- No gun ports and no cannons.
- A flat, plain plank deck.
- Exactly three large wooden cargo crates lashed on the deck, spread along its length: one forward, one
  amidships, one aft. Simple boxes with a darker cross-band.
- Two masts of similar height, about 0.5 times the hull length tall.
- On each mast, two square sails set across the ship, each a single gently curved thick panel.
- A short bowsprit pointing forward and slightly upward.
- A small red pennant at the top of each mast.

Keep it simple:
- NO ropes, rigging lines, nets, ladders or thin cables of any kind.
- No crew, no water, no base or stand, no ground plane.
- Every part solid and at least as thick as a mast; no paper-thin surfaces.

Colours (flat, solid colours per part):
- Hull: warm dark brown.
- Upper band along the hull: pale straw / light ochre.
- Deck: light brown wood.
- Crates: golden ochre wood with dark brown bands.
- Masts and bowsprit: dark brown.
- Sails: off-white parchment.
- Pennants: deep red.
- Stern windows: warm amber glass in dark wooden frames.

Technical:
- Target 8,000 to 12,000 triangles in total.
- Lowest texture resolution available; base colour only is enough.
- Hull lying along its length, waterline flat and level, model centred.
- Export as GLB.
```
