# Cosmetics that could be sold — "The Captain's Locker"

A catalogue of looks for The Sunken Covenant: what each one changes, who sees it, how it would be made with what the
game already has, and a starting price. It follows the monetization plan (`docs/plan-monetization.md`): **looks,
never power**, no random boxes, prices in plain euros.

## First, who sees what

What makes a cosmetic worth buying is that **the other captain sees it**. That is not true of everything:

| Surface | You see it | The opponent sees it |
|---|---|---|
| Your hand: card frames, card backs, AP seals | Always | **Never** (the hand is private) |
| Your fleet: hull, sails, flags, deck | Always | Only when they sink a ship, through the Long Glass, and in the reveal at the end of the battle |
| Your commander's portrait | Always | **Always** (in the enemy fleet panel) |
| Your captain's name, title, emblem | Always | **Always** (enemy fleet panel, battle report) |
| Your shots arriving on their chart: ball, trail, splash, impact | Briefly | **Always** (every shot you fire lands on their water) |
| Your Kraken | When you summon it | **Always** (it rises in their waters) |
| Your bottles and the notes inside | When you cast one | **Always** (it lands in their sea; they read the note) |
| Your desk, charts, hourglass, wind and maelstrom gauges, pointer, music | Always | Never (their table is their own) |

So the **social items** (commander, name and title, shots, Kraken, bottles, the sinking flourish) sell best online;
the **personal items** (desk, cards, charts, gauges) sell to players who simply like their table, and suit sets.

The monetization plan says the fleet livery and the card frame "show on their screen"; for the card frame that is
not the case, and for the fleet only in the moments above. Selling points should say so honestly.

## Ground rules

- **No advantage.** Nothing may make a ship harder to see when it is revealed or peeked at (no sea-coloured hulls,
  no transparent sails), nor change what a mark on the chart means. Hits stay hits, misses stay rings, and the
  colour-blind colours keep working whatever is equipped.
- **No randomness.** Every item is bought or earned by name, previewed on the real table first.
- **Earned items too.** Some pieces are earned by playing, so free players have goals and see the system.

---

## 1. Seen by the opponent (best sellers)

| # | Item | What it changes | How it is made | Effort | Price |
|---|---|---|---|---|---|
| 1.1 | **Commander outfits** | Each of the five commanders in a second portrait: e.g. the Gunmaster in a ghost uniform, the Spymaster in winter furs | New half-length portraits and faces (Meshy, as the current ones) | S per outfit | €2.99 each |
| 1.2 | **Captain's titles** | A title under your name in the enemy panel and the battle report: "Terror of the Shoals", "Keeper of the Deep" | Text + a small plate; many are earned | S | Earned, or €0.99 |
| 1.3 | **Captain's emblem** | A crest beside your name (anchor, kraken, crossed cutlasses, compass rose) | Small images (Meshy) | S | €1.99 |
| 1.4 | **Shot trails** | The ball's trail as the enemy sees it arrive: white smoke, green ghost-fire, sparks, ink | Particle colours and emission in `fx.ts` | S | €1.99 |
| 1.5 | **Splash and impact** | The miss's water column (spray, ice shards, ghost mist) and the hit's flash (blue powder, green fire) | Particle parameters; marks on the chart do not change | S | €1.99 |
| 1.6 | **Magazine blast** | How your ships go up when sunk: green ghost-fire, a burst of gold coins, black ink | `Fx.blast` palette and extra particles | S | €2.99 |
| 1.7 | **Kraken skins** | The tentacles that rise in their waters: abyss black, coral red, glowing deep-sea, ghostly | Colour and pattern of the Kraken's material; a new tentacle model for premium | S / M | €2.99 / €4.99 |
| 1.8 | **Bottles** | The bottle you cast: green glass, amber rum bottle, a sealed tin, a skull flask | Bottle model or texture (Meshy) | S | €1.99 |
| 1.9 | **Stationery** | The note they open: paper, ink colour, wax seal and its mark | Letter background image + seal image | S | €1.99 |
| 1.10 | **Fleet liveries** | Hull colours, the strake and wale, deck, sails and pennants of every ship: Royal Navy, pirate black, Venetian red and gold, whaler grey | Every ship is flat-coloured from a short palette (`tools/flatten_colors.py`), so a livery is a palette swap done in the ship shader, plus the existing deck, strake and sail colours | M (system) then S each | €3.99 |
| 1.11 | **Sail emblems** | A mark on the main sails: cross, skull, kraken, sun | Sails have no texture coordinates today; needs a projected decal in the sail shader | M | €2.99 |
| 1.12 | **Flags** | A proper flag at the masthead instead of the red pennant | A flag mesh with a texture, waving like the pennants | M | €1.99 |

## 2. Seen by you (your table)

| # | Item | What it changes | How it is made | Effort | Price |
|---|---|---|---|---|---|
| 2.1 | **Card frames** | The paper and border of every card: black-and-gold Admiralty, sea-worn driftwood, Kraken ink, frozen | A frame image per style (`card.webp`), as today | S | €1.99 |
| 2.2 | **Card kind tints** | The blue, red and parchment kinds in other colour schemes | CSS colours (already tunable in debug) | S | Part of sets |
| 2.3 | **AP seals** | The three wax seals: brass coins, gold doubloons, black wax, ice | One seal image each | S | €0.99 |
| 2.4 | **Desks** | The table under the charts: mahogany, chart room, smuggler's cove, ice-bound whaler, captain's cabin at night | Desk texture and lighting (Meshy images) | S / M | €2.99 |
| 2.5 | **Charts** | The paper the battle is fought on: parchment, blueprint, night chart with glowing ink, sealskin | The chart is drawn by code (`sea.ts`), so styles are colour and pattern settings; a texture for premium | M | €2.99 |
| 2.6 | **Desk props** | Hourglass, bottle stand, the "Money" pouch: silver, bone, brass and glass | Images (Meshy) | S | €1.99 |
| 2.7 | **Gauges** | The brass wind compass and maelstrom gauge in silver, ebony, coral | Their image layers (Meshy), as built | S | €1.99 |
| 2.8 | **Pointers** | The arrow and the aim, glass and helm pointers in other materials | Pointer images (as the current Meshy ones) | S | €0.99 |
| 2.9 | **Music themes** | Your home and battle music: sea shanties, ominous deep, Baroque | The sound bank already plays music by name | S (once composed) | €2.99 |
| 2.10 | **Captain's Log covers** | The cover and paper of your log | Images + CSS | S | €0.99 |

## 3. Earned by playing (free)

| Item | How it is earned |
|---|---|
| Title "Kraken-Caller" + Kraken-ink card frame | Summon the Kraken 10 times |
| Title "Wolf of the Shoals" + grey shot trail | Win 25 battles online |
| Title "Unsinkable" | Win a battle without losing a ship |
| Title "Admiral of the Fleet" + brass emblem | Complete 50 Admiralty orders |
| Gold AP seals | Win with every commander |
| Commander's second outfit (one of the five) | Win 20 battles with that commander |
| Ghost-fire blast | Sink 3 ships in a single turn |

Each earned item is also an achievement on Steam, if the game goes there.

## 4. Themed sets (the best value per sale)

A set dresses the whole table in one theme and costs less than its pieces bought one by one. One new set every
6 to 8 weeks, as the plan suggests.

| Set | What is in it | Price |
|---|---|---|
| **Ghost Fleet** | Pale torn sails and grey hulls, green lanterns; green ghost-fire trail and blast; ghostly Kraken; black desk with candles; night chart; Gunmaster in ghost uniform | €7.99 |
| **Royal Navy** | Black-and-ochre livery with white sails; Union-style flags; brass gauges; Admiralty card frame; chart-room desk; title "Post-Captain" | €5.99 |
| **Pirate Brethren** | Black hulls, red sails, skull flags and sail emblem; rum-bottle bottles; driftwood frames; smuggler's cove desk | €5.99 |
| **Serenissima** | Venetian red and gold livery, lion flag; gold doubloon seals; marbled stationery; Baroque music | €6.99 |
| **Arctic Whaler** | Whaler grey hulls, patched sails; ice-shard splashes; frozen card frames; ice-bound desk; Spymaster in furs | €5.99 |
| **The Deep Ones** | Coral-red Kraken with a new tentacle model; ink trails and blast; Kraken-ink frames; abyss chart; title "Keeper of the Deep" | €7.99 |

## 5. What the Locker needs before anything is sold

1. **Equipped items travel with the battle.** Each captain's choices (commander outfit, title, emblem, trail,
   blast, Kraken, bottle, stationery, livery) go into the `ready` message, so the opponent's game draws them. Only
   looks: the engine ignores them.
2. **Ownership kept on the server.** What a player owns lives under their account (`players/<uid>/locker`),
   written only by the payment system, never by the game itself.
3. **Payments.** On the web: Stripe Checkout with a small server function that records the purchase (Firebase
   Functions needs the paid Blaze plan; a few euros a month at this scale). On Steam: Steam's own microtransactions.
   Web portals (Poki, CrazyGames) usually forbid outside payments.
4. **The Locker screen.** A wardrobe of the items, each previewed on the real table before buying, with "Equip",
   "Buy" and "Restore purchases".
5. **The systems behind the looks**, in order of what they unlock:
   - effect palettes for trails, splashes, blasts and the Kraken (fastest, and seen by the opponent);
   - portrait variants and titles in the panels;
   - livery palette swaps in the ship shader;
   - chart styles and desks;
   - sail decals and flags (the most work).

## Suggested first release

**Earned titles and three effect items** (a trail, a blast, a Kraken colour). They are cheap to make, the opponent
sees every one of them, and they test the whole chain (equip, show to the opponent, own, buy) before the art for a
full set is commissioned. Then **Ghost Fleet** as the first set.
