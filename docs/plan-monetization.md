# Monetization plan

## Starting point

- **What the game is:** a 1-v-1 naval strategy game in the browser with hidden fleets, cards, a Kraken, weather and a
  maelstrom. You play a friend through an invite link, or the machine. It is published on Firebase Hosting.
- **Who plays:** desktop players, often two friends sending each other a link. We are not aiming at mobile.
- **What it has today:**
  - no accounts (anonymous guests);
  - no server of its own; online play is peer-to-peer over Realtime Database;
  - a gameplay currency, the doubloons, which exists only inside a match.
- **What protects the game:** it is about fair play with hidden information. If players come to feel that the other
  captain *bought* the win, the game is dead.

### Ground rules for anything we sell

1. **Never pay-to-win.** Nothing bought changes the odds:
   - no doubloons, seals, AP, cards, ships or Kraken for money;
   - no "extra lives".
2. **No loot boxes.** Every paid item is bought directly and the buyer knows exactly what they get. Randomised
   paid rewards are also a legal risk in several European countries, including Spain.
3. **No energy, timers or nagging.** A match is a short duel between friends; nothing must get between the
   invite link and the first shot.
4. **Respect the mood.** No banner ads on our own site. If ads exist at all, they are only where the platform
   expects them (web game portals).
5. **One free player can always play a paying player.** Since invites drive growth, money must never block the
   friend you invited.

## Options

### A. Free to play, with cosmetics ("The Captain's Locker")

Sell looks, not power. The game already has many surfaces that can be dressed:

| Surface | Examples |
|---|---|
| Card frames and backs | Black-and-gold Admiralty frame, sea-worn driftwood, Kraken-ink frame |
| The desk | Mahogany (default), ship's chart room, smuggler's cove, ice-bound whaler |
| Fleet liveries | Royal Navy colours, pirate black, Venetian red and gold, ghost fleet |
| Charts | Parchment (default), blueprint, night chart with phosphorescent ink |
| Desk props | Bottle, hourglass, wax seals in other materials |
| Effects | Cannon smoke colour, splash style, a different Kraken arm skin, sunk-ship flourish |
| Bottle notes | Stationery and wax colour for the notes you cast |

- **Pros:**
  - the largest possible player base;
  - invites stay free;
  - fair.
- **Cons:**
  - it needs a steady flow of new art (Meshy helps here);
  - it needs accounts and a server to store what each player owns;
  - only a small share of players ever pay.

### B. One-time premium unlock ("Captain's Commission"), with the host paying

- **Free:** classic duels against a friend and against the machine.
- **The commission (one purchase):**
  - the Convoy modes (Admiral and Corsair);
  - custom rules for private rooms (fleet size, maelstrom on/off, turn clock);
  - match history and replays;
  - a starter set of cosmetics.
- **Host pays:** a commissioned captain can open a room with *any* mode, and the friend they invite plays it for
  free. One purchase covers both players of a match.
- **Pros:**
  - simple, honest, and fits a "game between friends";
  - no constant content treadmill.
- **Cons:**
  - a single payment caps the revenue per player;
  - modes behind a paywall split the free audience a little (host-pays limits this).

### C. Premium on Steam

- **What:** a desktop build (the same web game wrapped in Electron or Tauri) sold at a fixed price, with cross-play
  against the web version.
- **Pros:**
  - Steam's discovery, reviews and wishlists;
  - players there expect to pay for indie strategy games;
  - Steam handles VAT and payments.
- **Cons:**
  - Steam takes about 30 %, plus a one-time fee per game (Steam Direct);
  - a store page, trailer and capsule art to make;
  - reviews are unforgiving if online play is thin or cheatable.

### D. Web game portals (CrazyGames, Poki and similar)

- **What:** publish a version on a portal that pays a share of its ad revenue.
- **Pros:**
  - instant audience;
  - no payments to handle;
  - good for testing whether people come back.
- **Cons:**
  - low revenue per player;
  - ads between matches;
  - portal SDKs and terms (exclusivity on some).

  Check each portal's current terms before choosing.

### E. Support ("Patron of the Covenant")

- **What:** a tip or supporter pack (Ko-fi or Patreon, or a one-time pack on our own site). Patrons get:
  - a gilded name plate;
  - their name in the credits;
  - an exclusive card frame.
- **Pros:** works from day one, with little technical work.
- **Cons:** small amounts; it depends on a loyal community.

### Not recommended

- **Rewarded ads**, such as "watch an ad for doubloons": they are pay-to-win in disguise and break the mood.
- **A premium currency with odd-sized packs** (gems): this is a dark pattern. If we ever need a currency, its
  prices should map plainly to euros.
- **A season pass, for now:** it only works with a large, active player base and a steady content plan. Reconsider
  it after launch.

## Recommendation

Run the options together, in phases. Each phase must prove itself before the next.

### Phase 0: foundations (before charging anything)

1. **Measure:** add privacy-friendly analytics, with no personal data and consent where the law asks for it:
   - matches started and finished;
   - day-1 and day-7 return;
   - invites sent and invites accepted;
   - average match length.
2. **Accounts:** add "Save your captain", an optional Google or e-mail sign-in that upgrades the anonymous
   identity. You need an account to buy anything, so purchases survive a new browser.
3. **Server for what players own:** a Cloud Function records purchases. Database rules let the client *read* what
   it owns and *never write* it. This is a small part of Option B in `docs/multiplayer-plan.md`. It is needed even
   if the matches stay peer-to-peer, because a modified client could otherwise "own" everything.
4. **Turn clock and forfeit:** from Option A in `docs/multiplayer-plan.md`. Paying players will not accept matches
   that stall.
5. **Legal:**
   - a privacy policy and terms of sale;
   - a refund policy;
   - EU VAT on digital sales, which is simplest with a merchant-of-record payment provider (see Payments below).

### Phase 1: supporters and the Commission (first income)

- **Supporter pack:** a one-time "Patron of the Covenant" pack, from launch day.
- **Captain's Commission:** a one-time purchase with host-pays, as described in Option B.
- **Starting prices** (tune them with the data):

  | Item | Price |
  |---|---|
  | Patron pack | €4.99 |
  | Captain's Commission | €7.99 |
  | Commission + Patron bundle | €10.99 |

### Phase 2: the Captain's Locker (recurring income)

- **Cosmetics, sold directly:**
  - single pieces: €1.99 to €3.99;
  - themed sets: €5.99 to €7.99 (desk, frames, livery and charts that match, e.g. "Ghost Fleet");
  - no randomness.
- **One themed set every 6 to 8 weeks**, made with the existing Meshy and Blender pipeline.
- **Cosmetics are visible to the opponent:** your fleet's livery and your card frame show on their screen. This
  is what makes them worth buying, and it advertises them to free players.
- **Earned cosmetics:** some are earned by playing, through Admiralty orders achieved or a number of Kraken
  summons. This keeps free players motivated and shows the system off.

### Phase 3: Steam (reach)

- **The build:** a Steam version at €9.99 to €14.99, including the Commission and a cosmetic set.
- **Cross-play:** Steam and web players share rooms, so the web stays the free gateway.
- **When:** only once the turn clock, forfeit and ideally the authoritative server (Option B of the multiplayer plan)
  are in place. That is also when ranked play becomes possible.

### Portals (optional, in parallel with phase 1)

A lighter build on one portal can serve as a cheap audience test. It runs the classic mode against the machine
and against friends, with the portal's ads. If the return numbers are good there, they will be good elsewhere.

## Payments

- **Merchant-of-record providers** (Paddle, Lemon Squeezy and similar):
  - they sell on your behalf and handle EU VAT, invoices and refunds;
  - their fees are higher than Stripe's (around 5 % plus a fixed amount; check current rates);
  - recommended to start, since VAT across EU countries is a real burden for one person.
- **Stripe:** lower fees, but you handle VAT registration (OSS) and invoices yourself, or pay for Stripe Tax.
- **How it connects:**
  1. Checkout opens in a hosted page.
  2. The provider's webhook calls a Cloud Function.
  3. The function writes `players/<uid>/owned/<item>`.
  4. The client listens to that record and unlocks the item.
- **Restore:** signing in on another browser shows the same purchases.
- **Refunds** remove the item.

## Technical work, step by step

1. Analytics events. Small.
2. Account linking UI in Settings ("Save your captain") and a `players/<uid>` record. Small to medium.
3. The Firebase Blaze plan: Cloud Functions need it. Costs stay tiny at low volume, but set a budget alert.
4. Cloud Function: payment webhook → owned items. Database rules: owned items are server-written only.
5. **Cosmetics system:**
   - a `Look` (frame, desk, livery, charts, props) chosen in a new "Locker" screen;
   - sent to the opponent in the room's opening message;
   - the renderer reads it: `ships.ts` gets tint and material variants, `hud.css` gets frame and desk classes,
     and `sea.ts` gets chart palettes.
6. Commission gating: modes and custom rules check owned items when *creating* a room. A guest joining a room
   never needs to own anything.
7. Shop screen: the Locker, with prices, previews on the actual table, and buy and restore buttons.
8. Later: a Steam build (Electron or Tauri wrapper, Steamworks for sign-in and ownership mapped to the same
   `players/<uid>`).

## What to measure, and when to change course

| Signal | Healthy sign | If not |
|---|---|---|
| Day-7 return | A meaningful share of new players still play a week later | Fix the game (onboarding, match length) before selling anything |
| Invites accepted | Most links sent lead to a finished match | Make joining quicker; check the turn clock |
| Paying share | A few percent of active players (typical for fair free-to-play) | Better previews, earned cosmetics as a taste, reprice |
| Refunds and complaints | Rare | Check that nothing reads as pay-to-win |

### An illustration, not a forecast

With 10,000 players a month, if 2 % buy the Commission at €7.99, that is about €1,600 before fees and taxes. If a
quarter of those buyers also take a €5.99 set, that adds about €300. Steam and a community grow this; without a
steady audience, no model does. **The first goal is players who come back, not prices.**

## Decisions needed from you

1. Free to play with host-pays Commission plus cosmetics (recommended), or a premium-only game?
2. Steam: yes later, or web only?
3. Ads on portals: acceptable as an audience test, or never?
4. Payment provider: merchant of record (simpler) or Stripe (cheaper, more paperwork)?
5. The first cosmetic theme to commission from Meshy (suggestion: "Ghost Fleet": pale sails, green lanterns, black
   desk, glowing charts. It fits the Kraken and the aurora).
