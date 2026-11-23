# Polish plan — before going to commercial platforms

What the game has now, what it lacks, and what each item needs. Effort: **S** a session or less, **M** two or three,
**L** a week or more of sessions. "Needs from you" lists what I cannot produce here (sounds, music, accounts, art).

## Starting point

- 3D effects today: muzzle flash, shot trail, water splash, hit explosion, iron clang, embers, funnel smoke, bubbles,
  coins, sinking ships, debris planks, Kraken tentacles, storm and maelstrom.
- Sound: 8 effects (cannon, underwater explosion, fire crackle, rain, gull, thunder, treasure, deck loop), **no music**,
  a single on/off switch.
- End of game: a plain card ("Victory" / "Defeat", one sentence, "Back to port").
- No in-game log panel: events show as a brief note under the action points.
- One JS bundle of 1.24 MB and 12 MB of art loaded up front.

---

## 1. Game feel: combat effects

| # | Item | What it does | Effort | Needs from you |
|---|---|---|---|---|
| 1.1 | **Powder-magazine explosion on a sinking** | The last hit sets off the magazine: a white flash, a fireball in stages (orange core, black smoke), a shock ring racing over the water, burning splinters and a mast tossed up, a smoke column that lingers for the round. Camera shake plus a 120 ms "hit-stop" (everything freezes a beat). A warm point light lights the ships nearby for a second. | M | A big explosion sound with a long tail (wood and powder, not a modern bomb); optionally a "mast falls/wood splinters" sound. |
| 1.2 | **Staged sinking** | Listing to one side, the bow rising, masts tipping over, a whirl of foam and bubbles where she goes down, flotsam (barrels, a spar) that drifts and stays a few rounds. Different by class: the ironclad goes down fast and hisses steam; the merchantman spills crates. | M | A creaking/groaning hull sound; steam hiss. |
| 1.3 | **Damage that shows** | A hit leaves a scorched hole on the hull at that section; one hit smokes thinly, two smoke heavily and burn; sails get torn (holes in the sail shader). | M | — |
| 1.4 | **Better shots** | Gun recoil, a thick smoke ring at the muzzle that drifts with the wind, a taller white water column on a miss, a short whistle as the ball flies. | S | A cannonball whistle; a water-plunge "thump". |
| 1.5 | **Kraken drags a ship down** | When the Kraken's strike sinks a ship, a tentacle wraps her and pulls her under, ink spreading on the water. | M | A wet roar or slither sound. |
| 1.6 | **Maelstrom swallows** | Ships lost to the maelstrom spin in the whirl as they go down. | S | — |
| 1.7 | **Turn and round beats** | A brief bell for your turn, the hourglass flipping with sand, a drum roll before the enemy's reply. | S | Ship's bell, sand, drum. |

## 2. End of a battle

| # | Item | What it does | Effort | Needs from you |
|---|---|---|---|---|
| 2.1 | **Victory / defeat sequence** | The camera eases over the battlefield; the last enemy ship's explosion in slow motion; then a ribbon "Victory" with fanfare (or a tolling bell and a lowered flag for defeat). | M | Victory and defeat musical stings (5–10 s). |
| 2.2 | **Results screen** | Accuracy, shots, hits, ships sunk/lost, doubloons, cards used, Kraken summoned, rounds; "Rematch" and "Back to port"; it feeds the Captain's Log already built. | M | A Meshy illustration for each outcome (optional). |
| 2.3 | **Replay of the battle** | The log is complete and verifiable already: play it back turn by turn, both fleets shown. Good for sharing and for streamers. | L | — |

## 3. UI and UX

| # | Item | What it does | Effort | Needs from you |
|---|---|---|---|---|
| 3.1 | **Cards with life** | Played card flies to the chart and burns away at the edges; new cards slide in from a deck; a soft flip on hover; seals crack when spent. | M | Paper and wax sounds (see §4). |
| 3.2 | **Animated counters** | Doubloons roll up, coins fly to the counter, a seal stamps into place when earned. | S | — |
| 3.3 | **Captain's log panel** | A small fold-out log of the battle (who fired where, what came of it), since notes vanish after a few seconds. | S | — |
| 3.4 | **First-battle tutorial** | A guided first game against the bot: three or four prompts (place, fire, sail, play a card), skippable. Stores and portals judge the first two minutes. | M | — |
| 3.5 | **Online turn clarity** | Turn timer for online games (with a grace period), "the enemy is thinking…" indicator, clear reconnect/abandon messages. | M | — |
| 3.6 | **Loading screen** | A real progress bar while models and art load (now the home appears and art pops in). | S | A background illustration (optional). |
| 3.7 | **Screen transitions** | Home → battle with a fade through the chart; modals open with a paper unfold. | S | — |
| 3.8 | **Shortcut hints** | Keys exist (F/S/T/A, 1–4, R, Q/E, Space) but are hidden: show them on the cards and in the guide; add 5–9 for the other cards. | S | — |
| 3.9 | **Settings that stores expect** | Separate volumes (music, effects, ambience), fullscreen button, graphics quality with an FPS cap, "reduce motion", text size, colour-blind mode. | M | — |
| 3.10 | **Colour-blind safety** | Hits are red, aims amber, misses ink: add shapes (cross, ring, dot) so nothing depends on colour alone. | S | — |
| 3.11 | **Large and wide screens** | Check 1440p, 4K and 21:9; keep the HUD anchored and sharp. Steam Deck (1280×800) also needs readable text. | S | — |

## 4. Audio

| # | Item | Effort | Needs from you |
|---|---|---|---|
| 4.1 | **Music** — a theme for the home, a calm battle layer, a tense layer that fades in when few ships remain, victory and defeat stings. Layers cross-fade with the state of the battle. | M (integration) | The music: licensed tracks (Epidemic Sound, Artlist), a composer, or an AI music service whose plan allows commercial use. 4 pieces + 2 stings. |
| 4.2 | **UI sounds** — card hover and click, shuffle, wax seal, parchment, coins into the purse, hourglass. | S | ~10 short sounds (freesound.org CC0, or a paid pack). |
| 4.3 | **Ambience by weather** — wind rising with its strength, rain, creaking timbers, distant gulls; calm becomes almost silent. | S | Wind loop, timber creak. |
| 4.4 | **Mixer** — ducking (music dips under explosions), volume per channel, no clipping when many effects stack. | S | — |

## 5. Ready for a store

| # | Item | Effort | Needs from you |
|---|---|---|---|
| 5.1 | **Performance** — split the 1.24 MB bundle, load ships and art in the background, compress models (Draco/meshopt), cap FPS, test low-end GPUs. | M | — |
| 5.2 | **Error reporting and analytics** — crashes and WebGL failures reported (Sentry or Firebase Crashlytics-like), basic funnel analytics with a consent banner. | S | A Sentry account (free tier). |
| 5.3 | **Legal** — privacy policy, terms, cookie/consent banner (GDPR), credits screen with every licence. **Check Meshy's licence**: commercial use of its output depends on the plan. | S (pages) | Decide the company/name behind the game; the Meshy plan in use. |
| 5.4 | **More languages** — the i18n system takes a new dictionary; FR, DE, PT-BR, ZH-CN, RU cover most of Steam. | S each (machine-drafted) | A native reviewer per language. |
| 5.5 | **Desktop build for Steam** — wrap in Tauri or Electron, Steamworks (achievements, cloud saves, overlay), controller support for Steam Deck. | L | Steamworks partner account ($100 per game), the target platforms. |
| 5.6 | **Web portals (CrazyGames, Poki)** — their SDK (ad breaks, gameplay start/stop), first load under their limits, no forced login. Poki strongly prefers mobile support. | M | Portal accounts; the mobile decision. |
| 5.7 | **Store page assets** — capsules in every Steam size, 5+ screenshots, a 30–60 s trailer, a short and long description. | M | The key art (Meshy or an illustrator); I can stage the scenes and capture screenshots and video. |
| 5.8 | **Age rating** — the IARC questionnaire (free, on Steam/Google/portals). | S | Filling it in on the store's side. |

## 6. Retention (after launch, ties to the monetization plan)

- Bot difficulty levels (easy / normal / hard).
- Captain ranks and unlockable cosmetics (sails, flags, hull paint, card backs).
- Achievements (also Steam achievements).
- Quick match without a room code (matchmaking), later ranked.
- A daily challenge (fixed seed, compare results).

---

## Suggested order

1. **The big sinking explosion and staged sinking** (1.1, 1.2) — the moment players remember and share.
2. **Music and UI sounds** (4.1, 4.2, 4.4) — the largest gap today; needs your sourcing first.
3. **Results screen and victory/defeat sequence** (2.1, 2.2).
4. **Card life and animated counters** (3.1, 3.2), **log panel** (3.3).
5. **Settings, colour-blind shapes, shortcut hints** (3.8–3.10).
6. **First-battle tutorial** (3.4).
7. **Performance, error reporting, legal** (5.1–5.3) — before any public store page.
8. Then the platform work (5.5–5.7) once the platform is chosen.

## What I need from you, in one list

- **Sounds**: big ship explosion, mast falling/wood splintering, hull groan, steam hiss, cannonball whistle, water
  plunge, Kraken roar/slither, ship's bell, drum roll, wind loop, timber creak, ~10 UI sounds (card, shuffle, wax,
  parchment, coins, hourglass). Freesound CC0 or a paid pack; tell me the licence of each.
- **Music**: home theme, calm battle, tense battle, victory sting, defeat sting.
- **Decisions**: first platform (Steam, web portals, or both); mobile or not; the name/company for legal pages.
- **Accounts** (when we get there): Steamworks, Sentry, portal developer accounts.
- **Check**: the Meshy plan allows commercial use of the generated art.
