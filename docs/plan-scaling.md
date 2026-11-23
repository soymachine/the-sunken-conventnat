# Scaling plan: thousands of players, accounts, payments and match history

The figures below come from the game as it is, measured on 22–23 Nov 2026. Firebase prices change: they were
checked on the pricing pages listed at the end, and should be checked again before committing to anything.

## 1. What the game costs to run today

### How it works now

- **Hosting:** Firebase Hosting serves the game, a set of static files.
- **Online battles:** each battle is a room in Firebase Realtime Database (RTDB):
  - a short `meta` record and a log of messages that both browsers read live;
  - a `presence` flag for each player.
- **Accounts:** none. Players are anonymous (Firebase Auth anonymous sign-in, one per browser tab).
- **Games against the machine:** they run entirely in the browser and cost nothing on the server.

### Measured

| What | Size | How it was measured |
|---|---|---|
| A player's first visit (everything the game downloads) | **≈ 9.5 MB** | `dist/`: models 4.1 MB, images 3.2 MB, sound 1.1 MB, code 1.2 MB (330 KB compressed) |
| One online battle stored in RTDB | **≈ 43 KB** (max 53 KB) | 40 machine-v-machine battles: 335 messages, 25 rounds on average |
| One online battle downloaded, per player | **≈ 45–90 KB** | the whole log once, plus RTDB's connection overhead |

### Prices that matter (Blaze, pay as you go)

| Service | Free each month | Beyond that |
|---|---|---|
| Hosting transfer | 10 GB (360 MB a day) | $0.15 / GB |
| RTDB download | 10 GB | about $1 / GB |
| RTDB storage | 1 GB | $5 / GB-month |
| Auth (with Identity Platform) | 50,000 monthly active users | about $0.0055 / user, falling with volume |
| Firestore (Standard) | 50,000 reads, 20,000 writes **a day** | about $0.03–0.06 / 100,000 reads |
| Cloud Functions | 2 million calls | cents per million |

### What a player costs

Assumption: an active player opens the game a few times a month and plays **15 online battles** (machine games are
free).

| Item | Per active player per month | Becomes noticeable at |
|---|---|---|
| Hosting (downloads: one full load + updates) | ≈ 12 MB → **≈ $0.0018** | ~900 new players a month (the free 10 GB) |
| RTDB download (battles) | ≈ 1 MB → **≈ $0.001** | ~10,000 players |
| RTDB storage | 15 × 43 KB = 0.65 MB **that is never deleted** | grows for ever, see below |

**Monthly bill, with today's set-up:**

| Monthly active players | Hosting | RTDB | Total |
|---|---|---|---|
| 1,000 | ~$0 | $0 | **≈ $0–2** |
| 10,000 | ~$16 | ~$0–5 | **≈ $20** |
| 100,000 | ~$180 | ~$90 + storage | **≈ $300**, plus storage growing by ~$300 a month |

The cost per player is tiny, **about $0.003 a month**. Two things in today's set-up would nonetheless make it
expensive at scale:

1. **Rooms are never deleted.**
   - Every online battle leaves its log in RTDB for ever.
   - At 100,000 players that is ~65 GB more each month, so storage alone rises by ~$300 every month, month after
     month.
   - **Fix (needed before launch):** when a battle ends and both sides have checked it, copy a summary to the match
     history (section 2) and delete the room. A daily scheduled function removes abandoned rooms older than a day.
2. **Images and models are fetched again too often.**
   - Firebase Hosting sends static files with a short cache (one hour by default).
   - The code files already have hashed names; the images and models in `public/` do not.
   - **Fix:** long cache headers in `firebase.json` and versioned file names, so a returning player downloads
     almost nothing.
   - Further option: serve the 9 MB of art from a CDN with free egress (Cloudflare R2/Pages, Bunny…). That takes
     hosting close to $0 at any size.

### Should the infrastructure change?

**Not the base: Firebase scales well past thousands of players.** But to *sell* the game, add or change:

| Change | Why | When | Running cost |
|---|---|---|---|
| Delete finished rooms; a daily clean-up of abandoned ones | stops storage growing for ever | **before launch** | ~$0 |
| Long cache for art, or a CDN | hosting becomes the first real cost | before launch | saves ~$0.15/GB |
| Tighter database rules, **App Check**, rate limits | stop abuse and scripted clients (see `docs/multiplayer-plan.md`) | before launch | ~$0 |
| **Turn clock and forfeit** | paying players will not tolerate stalled games | before launch | ~$0 |
| **Check every battle on the server** (Cloud Function runs `verify.ts`) | honest results for history, stats and rankings | with accounts | cents |
| **Matchmaking** (a queue to meet strangers) | a store audience does not bring a friend | with launch | ~$0–10 |
| Authoritative server (Cloud Run), Option B in `multiplayer-plan.md` | ranked play without cheating | only for ranked play | ~$10–40/month base |
| Several RTDB instances (sharding) | RTDB allows ~200,000 simultaneous connections per database | far off (> 200k players online at once) | — |

## 2. Accounts, payments, personalisation, history and stats

### Accounts

- **Keep playing as a guest** (anonymous) and offer **"Save your captain"**:
  - link the anonymous account to Google, Apple or e-mail with Firebase's account linking;
  - the same `uid` is kept, so nothing is lost;
  - Steam sign-in can be added later through a custom token.
- **A profile in Firestore:** `players/{uid}` holds the name, the chosen card frames and desk, and what the player
  owns.
- **Cost:**
  - Firebase Auth without the Identity Platform upgrade: free for e-mail and social sign-in;
  - with the upgrade (needed for some extras): free up to 50,000 active users a month, then ≈ $0.0055 each.

### Micro-payments and personalisation

- **Flow:**
  1. The player chooses an item.
  2. Checkout opens at the payment provider.
  3. The provider's webhook calls a Cloud Function.
  4. The function writes `players/{uid}/owned/{item}`.
  5. The game reads that record.

  The database rules let a player **read** what they own and **never write** it, so a modified browser cannot
  unlock anything.
- **Payment provider:** the fees are the real cost of payments, far above the infrastructure.
  - **Merchant of record** (Paddle, Lemon Squeezy): about 5 % + $0.50 a sale. They handle EU VAT, invoices and
    refunds. Recommended to start.
  - **Stripe:** about 1.5 % + €0.25 for EU cards, but VAT and invoices are yours to handle.
  - **App stores and Steam:** 30 %.
- **What is personalised:** card frames and colours (already tunable in debug), the desk, the hull liveries, the
  ink of the charts, pointers and seals.
  - Each player's choice travels to the opponent in the `ready` message, so both see it.
  - This is the "Captain's Locker" in `docs/plan-monetization.md`.

### Match history and statistics

- **When a battle ends:**
  1. A Cloud Function checks it with the same `verify.ts` the browsers use, so nobody can invent a win.
  2. It writes one record per battle in `matches/{id}`: date, players, commanders, mode, winner, rounds, and per
     player shots, hits, ships lost and Kraken summoned.
  3. It updates a running summary in `players/{uid}/stats`: wins, losses, win rate by commander, accuracy, average
     length.
  4. It optionally updates a rating (Elo or Glicko) for a ranked ladder.
  5. Finally it deletes the room (point 1 above).
- **New in the game:** a **"Captain's log"** tab with:
  - the latest battles: opponent, result, commanders, rounds;
  - stats charts: win rate by commander, accuracy, games per week;
  - later, a **replay**. The full message log can be kept compressed (~5 KB) for the player's last games and
    played back with the existing renderer.
- **Running cost:** about 3 writes per battle and ~20 reads each time the tab is opened.
  - At 100,000 players (1.5 million battles a month): ≈ 4.5 M writes and ≈ 20 M reads a month, **≈ $10–15 a
    month**.
  - Verifying every battle on the server: 1.5 M short Cloud Function calls, **a few dollars**.

## 3. Summary of running costs

| Monthly active players | Infrastructure (after the two fixes) | With accounts, history and stats | Payment fees |
|---|---|---|---|
| 1,000 | ≈ $0 | ≈ $0 | ~5–8 % of sales (MoR) |
| 10,000 | ≈ $5–15 | ≈ $10–25 | ~5–8 % of sales |
| 100,000 | ≈ $100–250 | ≈ $150–350 (+ Auth ≈ $275 if upgraded to Identity Platform) | ~5–8 % of sales |

- **When it becomes noticeable:** at about **10,000 monthly players** the bill moves from free to tens of dollars a
  month.
- **Per player:** at any size it stays around **$0.002–0.005 a month**.
- **Compared with sales:** if 2 % of players spend €8, 100,000 players bring in ~€16,000 against a few hundred
  dollars of infrastructure. Payment fees will cost more than the servers.

## 4. Building it, in order, with rough effort

| Step | Effort (one developer) |
|---|---|
| Delete finished and abandoned rooms; long cache or CDN for the art | 1–2 days |
| Turn clock and forfeit; tighter rules; App Check | 3–5 days |
| Accounts: "Save your captain" (Google, Apple, e-mail), profile | 3–5 days |
| Server-side check of each battle + `matches` + `stats` | 4–6 days |
| "Captain's log" tab: history and stats | 4–6 days |
| Payments with a merchant of record + owned items + the Locker | 5–8 days |
| Matchmaking queue | 3–5 days |
| Replays | 4–6 days |
| (Ranked) authoritative server on Cloud Run | 2–3 weeks |

## Sources (prices checked 23 Nov 2026)

- [Firebase Pricing](https://firebase.google.com/pricing)
- [Understand Realtime Database billing](https://firebase.google.com/docs/database/usage/billing)
- [Hosting usage, quotas and pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
- [Identity Platform pricing](https://cloud.google.com/identity-platform/pricing)
- [Understand Cloud Firestore billing](https://firebase.google.com/docs/firestore/pricing)
