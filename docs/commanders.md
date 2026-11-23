# Commanders: a proposal

Each captain picks **one commander** before the battle. Each commander has **one power** with its own cost and
limits, and **one drawback**, so that none is better than the others. Nothing here is built yet; this is for
choosing what to make.

## How it fits the game

- **Where:** as an option on Classic ("Commanders: on / off") rather than a new mode. Convoy already gives each side
  a role with its own power, so Classic is where a choice adds the most. A separate mode can come later if the
  option proves popular.
- **The pick:** both captains choose at the same time, before placing their fleets. The choice is shown to the other
  captain when the battle starts (it is in the `ready` message), so there is no hidden advantage. Both may pick the
  same commander.
- **The power is a card:** it goes in the hand like Broadside or the Kraken, with its cost in a wax seal and its
  limits in its tooltip. It fits the card UI and needs no new controls.
- **Fair play stays intact:**
  - powers that touch hidden fleets are answered by their owner, like a shot or a scan;
  - those answers are checked at the end by `verify.ts`, as everything else is.

## Balancing rules

1. **Same budget:** each power is worth about one quartermaster item (40–60 doubloons) every four or five rounds.
2. **Hard limits:** a cooldown (once every N rounds) or a number of uses per battle, never "every turn".
3. **A real drawback:** each commander gives something up, so picking one is a trade, not a gift.
4. **Counterplay:** the other captain can always see the power coming or answer it.
5. **Checked by numbers:**
   - teach the bot each power;
   - run every pairing of commanders bot against bot (a few hundred games each, as the current tests already do);
   - adjust costs until every pairing wins between 45 % and 55 %.

## The five commanders

### 1. The Tidewarden: keeper of the maelstrom

> "The sea keeps my time, not yours."

- **Power: Bind the Tide.** For no AP (it was 2 AP; see the Tidewarden pass below), the next ring of the maelstrom comes **two rounds later**, or **one round
  sooner**.
  - The captain chooses which.
  - Twice per battle.
  - Only from round 14 on, so it cannot be spent before it matters.
- **Drawback:** the Tidewarden's ships cannot use the **Sea Current**. Their captain is bound to the sea's rhythm
  and cannot buy a current.
- **Why it is fair:**
  - the maelstrom hurts both sides equally;
  - the power only helps a captain whose fleet sits better than the enemy's when the ring closes;
  - the enemy sees the gauge change at once and can react.

### 2. The Stormcaller: master of winds

> "Every sail on this sea answers to me."

- **Power: Squall.** For 1 AP, the enemy's whole fleet is driven **one square** in a direction the Stormcaller
  chooses, as a Sea Current would push it.
  - A ship that cannot run (blocked by the edge, drowned water or another ship) is **driven onto what stopped
    her**: her leading section takes a hit, answered by her captain like a shot.
  - A ship is never pushed into drowned water.
  - The squall's spray **veils the Stormcaller's own waters**: the enemy's next spyglass or Long Glass shows
    nothing.
  - Three times per battle.
  - The enemy moves their own hidden ships, and the move is checked at the end.
- **Second use of the same card:** for 1 AP, the Stormcaller may instead **choose the wind** for the current round.
  - Once every two rounds.
  - Never a flat calm.
- **Passive:** the Stormcaller's ships are never caught in irons. A head wind counts as a calm for them.
- **Drawback:** the Stormcaller may not buy **Trade Winds**. (The first idea, losing a square across the wind, was
  too heavy in the simulations.)
- **Why it is fair:** a squall pushes ships but does not show where they are. It is strong only after scans or
  hits have given the Stormcaller a picture of the enemy's waters.

### 3. The Spymaster: eyes everywhere

> "Count the masts before you count the guns."

- **Power: Soundings.** For no AP, the Spymaster learns whether **any** enemy ship has a section in a chosen
  **row or column**. The answer is only "some" or "none", not how many.
  - Once every six rounds, from round 4 (see the last pass below).
- **Passive:** the Spymaster sees the round number each enemy treasure was set down, which helps guess where
  enemy ships sailed.
- **Drawback:**
  - the Spymaster starts with **no doubloons** (others start with 30);
  - the Spymaster pays **10 more** for every spyglass and Long Glass.
- **Why it is fair:** information only. It still takes shots to sink anything, and the economy is slower.

### 4. The Gunmaster: iron and powder

> "One broadside is worth ten prayers."

- **Power: Double-Shotted.** For 2 AP, the next **Fire** this turn strikes its square, and if it **hits**,
  strikes again **one square further** in the same row or column.
  - The captain picks the direction when aiming.
  - Three times per battle.
- **Passive:** a hit pays **10 doubloons** instead of 5.
- **Drawback:** the Gunmaster can never use the **Long Glass**. (With no glass at all he won only 37 % in the
  simulations.)
- **Why it is fair:**
  - the second shot only comes after a hit, so the power rewards good aim rather than replacing it;
  - giving up the Long Glass costs the surest way to find a ship's exact squares.

### 5. The Deepspeaker: priest of the covenant

> "The deep remembers every name we give it."

- **Power: The Kraken answers sooner.** The Kraken needs only **two** covenant seals, not three.
- **Passive:** when the Deepspeaker's Kraken strikes, it **drags the hit ship's neighbour**: the struck section's
  ship cannot sail on the enemy's next turn either. The Kraken's hold lasts one more turn.
- **Drawback:** the Deepspeaker **cannot swear a Blood Pact** (the deep is already owed). (Striking only once was
  dropped in the last pass: it made him the weakest.)
- **Why it is fair:** earlier and more often, but each summoning does less. The seals still have to be won by sailing
  onto them or by losing ships.

### Spare idea: the Salvager

- **Power:** every wreck of a sunk ship (theirs or yours) yields treasure once a ship sails onto it.
- **Drawback:** the Salvager's own sunk ships give the enemy that treasure too.
- **Use:** an alternative if one of the five proves hard to balance.

## Simulation results (the machine against itself)

The five powers are now in the rules engine (`src/game/engine.ts`) and the machine knows how to use them
(`src/game/bot.ts`). They are not offered in the game yet.

- **The run:** `src/game/commanders.sim.test.ts` plays every pairing, including "no commander", 1,000 games
  each, half from each seat: 21,000 games, about 3½ minutes.
  ```bash
  SIM=1 GAMES=1000 npx vitest run src/game/commanders.sim.test.ts
  ```
- **Noise:** with 1,000 games a result is good to about ±3 points.
- **Result:** no game stalled; battles average 24–28 rounds.

### What changed over seven passes

1. **First pass:** the Gunmaster won only 37 % against a captain with no commander. With no glass at all he
   could not find anything to double-shot. He keeps the spyglass and the Cutter's glass now, and gives up only
   the Long Glass.
2. **Stormcaller, still weak:**
   - Squall went from 3 AP to 2, then to 1, and from two uses to three.
   - Gale went from every four rounds to every two.
   - The drawback "no square from a fair wind" became "may not buy Trade Winds".
   - He gained a passive: his ships are never caught in irons (a head wind counts as a calm for them).
   - The machine now looks for the ships a square downwind after a squall, as a person would.
3. **Spymaster's soundings:**
   - at 1 AP they cost a shot and lost games (44 %);
   - free every two rounds they were too strong (63 % against the Tidewarden);
   - they settle at **free, once every five rounds**.

### Win rate of the row's commander against the column's (pass 7)

|             | none | Tidewarden | Stormcaller | Spymaster | Gunmaster | Deepspeaker | average |
|-------------|------|------------|-------------|-----------|-----------|-------------|---------|
| none        | —    | 52 %       | 53 %        | 49 %      | 49 %      | 52 %        | 50.9 %  |
| Tidewarden  | 48 % | —          | 53 %        | 42 %      | 48 %      | 50 %        | 48.2 %  |
| Stormcaller | 47 % | 47 %       | —           | 40 %      | 42 %      | 48 %        | 44.9 %  |
| Spymaster   | 51 % | 58 %       | 60 %        | —         | 56 %      | 56 %        | 56.3 %  |
| Gunmaster   | 51 % | 52 %       | 58 %        | 44 %      | —         | 53 %        | 51.4 %  |
| Deepspeaker | 48 % | 50 %       | 52 %        | 44 %      | 47 %      | —           | 48.2 %  |

Powers used per battle, on average: Tidewarden 1.8, Stormcaller 6.7 (squalls and gales), Spymaster 4.7,
Gunmaster 3.0, Deepspeaker 1.5 (Krakens).

### Passes 8 to 10: the Stormcaller and the Spymaster

- **Spymaster:**
  - soundings now say only "some" or "none";
  - a control run with the soundings switched off put him at 48–53 % against everyone, so his edge came from
    the soundings and not from his economy;
  - once every three rounds he still won 56 % on average; every five rounds is kept;
  - every six rounds changed nothing.
- **Stormcaller:**
  - the veil alone barely helped (46 %);
  - crashing ships driven onto the edge, the rim or each other brought him to 50.5 %;
  - the machine now also squalls now and then, not only before a ring.

**Final table (pass 9, the values above):**

|             | none | Tidewarden | Stormcaller | Spymaster | Gunmaster | Deepspeaker | average |
|-------------|------|------------|-------------|-----------|-----------|-------------|---------|
| none        | —    | 52 %       | 49 %        | 49 %      | 49 %      | 52 %        | 50.2 %  |
| Tidewarden  | 48 % | —          | 49 %        | 42 %      | 48 %      | 50 %        | 47.5 %  |
| Stormcaller | 51 % | 51 %       | —           | 49 %      | 47 %      | 54 %        | 50.5 %  |
| Spymaster   | 51 % | 58 %       | 51 %        | —         | 56 %      | 54 %        | 53.8 %  |
| Gunmaster   | 51 % | 52 %       | 53 %        | 44 %      | —         | 53 %        | 50.6 %  |
| Deepspeaker | 48 % | 50 %       | 46 %        | 46 %      | 47 %      | —           | 47.3 %  |

- **Within 45–55 % on average:** all five commanders.
- **The one matchup still outside:** Spymaster against Tidewarden, at 58 %. The Tidewarden delays the rings, the
  longer battle gives the Spymaster more soundings, and the Tidewarden has the lowest average (47.5 %).
- **Next:** a small boost for the Tidewarden is the obvious next step, for example a third Bind, or Bind from round
  12.

### Reading the numbers (pass 7)

- **Within the target (45–55 %):** the Tidewarden, Gunmaster and Deepspeaker, against everyone.
- **Still off:**
  - the **Stormcaller** is the weakest, at 45 % on average and 40 % against the Spymaster;
  - the **Spymaster** is the strongest against other commanders, at about 56 %.
- **Next steps:**
  - for the Spymaster, a sounding that reports only "none" or "some";
  - for the Stormcaller, a squall that also hides his own fleet from the next spyglass.
- **No commander at all:** about even with every commander. The powers trade value; they do not add it.
- **Caveat:** these are the machine's numbers. The machine is a decent hunter but a poor sailor. It moves little,
  so the powers that move ships (Squall, Gale) are surely worth more to a person than they are here.
  Playtests should confirm before the numbers are trusted.

### In the game (0.21.0)

- **The pick:** on the home, under "Kind of battle", only for Classic. It is remembered. Against the machine, if you
  lead a commander, the machine leads one drawn at random.
- **The panels:** your commander shows at the top of your panel and theirs under their name. Hover either for the
  full card.
- **The power cards:** they join the hand: Hold / Hasten the Tide, Squall, Call the Wind, Soundings,
  Double-Shotted. The Deepspeaker's Kraken card appears with two seals.
- **The end-of-battle check:** `verify.ts` checks Squall drift and crashes, Double-Shotted answers, Soundings,
  the veil and the Stormcaller's sailing. 630 machine battles with every pairing all verify, and a regular test
  plays one battle per commander.
- **Still to do:** portraits and card pictures (Meshy prompts in `docs/meshy-cards.md`, section 12), and the
  Tidewarden balance pass.

### The Tidewarden pass (1,000 games per pairing each)

At 2 AP the Tidewarden averaged 47 %, lowest against the Spymaster (45 %) and a shade behind a captain with no
commander. Variants, his win rate against each other side:

| Variant | none | Stormcaller | Spymaster | Gunmaster | Deepspeaker | average | binds a battle |
|---|---|---|---|---|---|---|---|
| 2 AP, twice, from round 14 (before) | 47 % | 46 % | 45 % | 48 % | 50 % | 47.2 % | 1.7 |
| 2 AP, twice, from round 12 | 46 % | 47 % | 46 % | 48 % | 50 % | 47.4 % | 1.7 |
| 2 AP, three times, from round 14 | 48 % | 43 % | 44 % | 47 % | 47 % | 45.7 % | 2.4 |
| 2 AP, three times, from round 10 | 48 % | 44 % | 44 % | 46 % | 47 % | 45.9 % | 2.5 |
| 1 AP, twice, from round 14 | 45 % | 45 % | 47 % | 47 % | 49 % | 46.6 % | 1.7 |
| **free, twice, from round 14** | **51 %** | **50 %** | **51 %** | **52 %** | **53 %** | **51.2 %** | 1.7 |

- **More binds, or binding earlier, makes him weaker:** each bind spent most of a turn's action points that would
  otherwise have fired.
- **What fixes it is the price:** a free bind keeps the turn's three shots. Kept: **free, twice, from round 14**.

**Full table after the pass:**

|             | none | Tidewarden | Stormcaller | Spymaster | Gunmaster | Deepspeaker | average |
|-------------|------|------------|-------------|-----------|-----------|-------------|---------|
| none        | —    | 49 %       | 49 %        | 49 %      | 49 %      | 52 %        | 49.5 %  |
| Tidewarden  | 51 % | —          | 53 %        | 46 %      | 53 %      | 55 %        | 51.4 %  |
| Stormcaller | 51 % | 47 %       | —           | 49 %      | 47 %      | 54 %        | 49.6 %  |
| Spymaster   | 51 % | 54 %       | 51 %        | —         | 56 %      | 54 %        | 53.2 %  |
| Gunmaster   | 51 % | 47 %       | 53 %        | 44 %      | —         | 53 %        | 49.8 %  |
| Deepspeaker | 48 % | 45 %       | 46 %        | 46 %      | 47 %        | —         | 46.4 %  |

- **Averages:** every commander now sits between 46 % and 53 %.
- **Spymaster vs Tidewarden:** this run puts it at 54 %. In the focused run it was 49 % (the two runs play different
  seeds, so a pairing moves by about ±3 points).
- **Pairings at the edge:** Spymaster v Gunmaster 56 %, Deepspeaker the lowest at 46 %.
- **Simulation options:** `TIDE_FROM`, `TIDE_USES` and `TIDE_AP` try other values without editing the rules.

### The Deepspeaker and Spymaster pass (1,000 games per pairing each)

**The Deepspeaker** (his win rate against each other side):

| Variant | none | Tidewarden | Stormcaller | Spymaster | Gunmaster | average |
|---|---|---|---|---|---|---|
| 2 seals, strikes once, holds 2 turns (before) | 46 % | 49 % | 46 % | 42 % | 46 % | 45.8 % |
| 2 seals, strikes once, holds 3 turns | 48 % | 47 % | 46 % | 42 % | 47 % | 46.1 % |
| 2 seals, strikes twice, no extra hold | 48 % | 49 % | 53 % | 46 % | 51 % | 49.5 % |
| **2 seals, strikes twice, holds 2 turns** | **52 %** | **48 %** | **52 %** | **46 %** | **52 %** | **49.9 %** |

- **The fix:** striking only once was the real cost. His Kraken now strikes twice like anyone's.
- **What stays:** it still needs only two seals and holds its patch a turn longer.
- **His drawback is now only:** no Blood Pact.

**The Spymaster** (with the new Deepspeaker):

| Variant | none | Tidewarden | Stormcaller | Gunmaster | Deepspeaker | average |
|---|---|---|---|---|---|---|
| every 5 rounds, from round 1 (before) | 52 % | 50 % | 52 % | 51 % | 52 % | 51.5 % |
| every 5 rounds, from round 6 | 52 % | 52 % | 52 % | 52 % | 53 % | 52.3 % |
| **every 6 rounds, from round 4** | **51 %** | **51 %** | **53 %** | **50 %** | **49 %** | **50.8 %** |
| every 7 rounds | 51 % | 51 % | 53 % | 54 % | 51 % | 52.1 % |

- **Already in range:** once the Deepspeaker was fixed, the Spymaster was within 45–55 %.
- **Kept anyway:** every six rounds from round 4, because it gives the most even spread.

**Full table after the pass:**

|             | none | Tidewarden | Stormcaller | Spymaster | Gunmaster | Deepspeaker | average |
|-------------|------|------------|-------------|-----------|-----------|-------------|---------|
| none        | —    | 49 %       | 49 %        | 49 %      | 49 %      | 50 %        | 49.3 %  |
| Tidewarden  | 51 % | —          | 53 %        | 47 %      | 53 %      | 50 %        | 50.7 %  |
| Stormcaller | 51 % | 47 %       | —           | 47 %      | 47 %      | 52 %        | 48.9 %  |
| Spymaster   | 51 % | 53 %       | 53 %        | —         | 52 %      | 53 %        | 52.2 %  |
| Gunmaster   | 51 % | 47 %       | 53 %        | 48 %      | —         | 51 %        | 50.2 %  |
| Deepspeaker | 50 % | 50 %       | 48 %        | 47 %      | 49 %        | —         | 48.7 %  |

- **Every pairing now falls between 47 % and 53 %, and no battle stalled.**
- **Simulation options:** `SPY_EVERY`, `SPY_FROM`, `DEEP_SEALS`, `DEEP_STRIKES` and `DEEP_LINGER` try other values.

## Suggested building order

1. **Commander pick in the lobby** (and in a vs-machine game): a row of five portraits under "Kind of battle", with
   a tooltip each. The machine picks at random.
2. **The Gunmaster and the Spymaster first:** they reuse attacks and scans, so they are the least new code.
3. **The Tidewarden:** a new public message that moves the maelstrom's schedule, which is the simplest of the
   rest, as nothing hidden moves.
4. **The Stormcaller and the Deepspeaker:** they touch hidden fleets and the Kraken, so they need verify checks.
5. **Bot play and the balance runs** after each one.
6. **Art:** one portrait and one card per commander, from Meshy prompts written once the list is settled.

## Questions for you

1. An option on Classic (recommended), a new mode, or also in Convoy?
2. Are these five the right characters? Any to swap for the Salvager?
3. Should the choice be **open** (both see each other's commander from the start, recommended) or **secret** until
   the power is first used?
