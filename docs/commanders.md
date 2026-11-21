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

- **Power: Squall.** For 3 AP, the enemy's whole fleet is driven **one square** in a direction the Stormcaller
  chooses, as a Sea Current would push it.
  - Ships blocked by the edge or another ship stay put.
  - A ship is never pushed into drowned water.
  - Twice per battle.
  - The enemy moves their own hidden ships, and the move is checked at the end.
- **Second use of the same card:** for 1 AP, the Stormcaller may instead **choose the wind** for the current round.
  - Once every four rounds.
  - Never a flat calm.
- **Drawback:** the Stormcaller's own square-rigged ships also lose a square when sailing **across** the wind,
  not only into it.
- **Why it is fair:** a squall pushes ships but does not show where they are. It is strong only after scans or
  hits have given the Stormcaller a picture of the enemy's waters.

### 3. The Spymaster: eyes everywhere

> "Count the masts before you count the guns."

- **Power: Soundings.** For 1 AP, the Spymaster learns how many enemy **ships** (not sections) have at least one
  section in a chosen **row or column**.
  - A fog bank hides it, as it hides a spyglass.
  - Once every three rounds.
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
- **Drawback:** the Gunmaster can never use the **Long Glass** or the **Cutter's Glass**. Their gunners fire by
  instinct, not by spyglass.
- **Why it is fair:**
  - the second shot only comes after a hit, so the power rewards good aim rather than replacing it;
  - giving up scouting is a real cost on a 16 × 16 chart.

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
