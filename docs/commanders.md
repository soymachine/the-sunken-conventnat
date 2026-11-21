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

- **Power: Bind the Tide.** For 2 AP, the next ring of the maelstrom comes **two rounds later**, or **one round
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
  - Ships blocked by the edge or another ship stay put.
  - A ship is never pushed into drowned water.
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

- **Power: Soundings.** For no AP, the Spymaster learns how many enemy **ships** (not sections) have at least
  one section in a chosen **row or column**.
  - A fog bank hides it, as it hides a spyglass.
  - Once every five rounds.
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
- **Drawback:**
  - the Deepspeaker's Kraken strikes **once**, not twice;
  - the Deepspeaker **cannot swear a Blood Pact** (the deep is already owed).
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

### Reading the numbers

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

### Not built yet

- **The end-of-battle check:** `verify.ts` does not yet know Squall drift, Double-Shotted answers or Soundings. A
  game with commanders would be flagged when it is checked, so this must come before commanders are offered
  online.
- **The interface:** the pick in the lobby, the power cards, and the portraits.

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
