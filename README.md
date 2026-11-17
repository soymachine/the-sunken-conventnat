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

## Layout

- `src/game` — pure rules, message protocol (`engine.ts`), bot, orders, end-of-game verification
- `src/net` — sessions: local (against the bot) and Firebase
- `src/render` — three.js sea chart
- `src/ui` — HUD and lobby
