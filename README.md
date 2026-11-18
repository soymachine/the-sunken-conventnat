# The Sunken Covenant

A naval strategy game for the browser, built with three.js: nineteenth-century ships, action points,
ships that sail, treasure, power-ups and secret orders. See `docs/PLAN.md` for the design and roadmap.

```bash
npm install
npm run dev     # play at the printed local address
npm test        # rules, protocol and bot tests
npm run build
```

Playing the computer works out of the box. Online rooms need a free Firebase project:
see `docs/FIREBASE_SETUP.md`.

## How to play

Sink the whole enemy fleet. Each turn you have 3 action points.

| Action | Cost | Key |
|---|---|---|
| Fire one shot | 1 | `F` |
| Sail a ship one square (the Schooner sails two) | 1 | `S` |
| Turn a ship a quarter turn | 1 | `T` |
| Broadside (Ship of the Line): three squares in a line, `R` swings it | 2 | `A` |
| Chain shot (Frigate): a hit pins that ship for its next turn | 2 | |
| Cutter's glass: count hull sections in a 5×5 patch | 1 | |

`Space` or the capstan ends your turn. The mouse wheel zooms the chart.

- Damage travels with a ship; marks on the chart stay where the shot fell and fade as they age.
- A damaged ship leaves wreckage where it sailed from, and cannot turn after two hits.
- The Ironclad shrugs off the first hit.
- Treasure chests are visible to both captains. Sailing onto one pays doubloons and gives that square away.
- Spend doubloons at the Quartermaster: Spyglass, Fire Ship, Fog Bank, Shipwright, Trade Winds.
- Admiralty Orders are a secret side-mission that pays doubloons.

## Convoy mode

Choose **Convoy** in the lobby for an asymmetric battle. The roles are drawn by lot.

- **The Admiral** (Vice-Admiral Edmund Harrowgate) must sail the merchantman from the Colony (columns
  A–C of their own chart) to the Home Port (column P) with at least one of its three crates aboard,
  or sink every corsair. Fleet: Ship of the Line, Frigate, Ironclad, Cutter and the Merchantman.
- **The Corsair** (Captain Mara Vane, "the Black Tide") must plunder all three crates, or keep the
  cargo at sea until the season closes after round 12. Fleet: Frigate, two Schooners, two Cutters.
- Each hit on the merchantman plunders a crate. The merchantman's first move in a turn is silent;
  every further move that turn gives away the **row** she is in.
- Each captain has one power per battle (1 action point): **Close Escort** turns aside the next hit
  on the merchantman until the Admiral's next turn; **Dead Reckoning** tells the Corsair her column.

## Look

The sea is a parchment chart drawn by a shader: ink strokes drift with the wind, hulls raise foam and
shots leave ripples. Ships are procedural and shaded like an engraving; to use hand-made models see
`public/models/README.md`. Bloom, shadows and film grain switch off automatically on slow machines;
add `?q=low` or `?q=high` to the address to force either.

## Layout

- `src/game` — pure rules, message protocol (`engine.ts`), bot, orders, end-of-game verification
- `src/net` — sessions: local (against the bot) and Firebase
- `src/render` — scene, sea shader, ships, particle effects, post-processing
- `src/ui` — HUD, lobby and synthesised sound
