# Multiplayer plan: making online play secure

## Where we are today

- **Hosting:** Firebase Hosting serves the game (static files).
- **Transport:** Firebase Realtime Database. Each room is an append-only log of messages
  (`rooms/<CODE>/log`), ordered by server timestamp. Both browsers replay the same log.
- **Identity:** Firebase anonymous sign-in, one identity per browser tab.
- **Rules:** only the host and the guest can read a room's log; each can append only messages signed with
  their own uid and seat. Nothing can be edited or deleted.
- **Hidden information:** each captain's fleet lives only in their own browser. At the start each commits a
  SHA-256 hash of their placement plus a secret salt. Each defender answers the shots against them. At the
  end both reveal their placement, salt and hidden moves, and the other browser replays the whole log
  (`src/game/verify.ts`) to check every answer: shots, scans, the Long Glass, the Kraken, the maelstrom's toll,
  blood pacts, sea currents and where treasure was set down.

### What this already protects against

- Changing your fleet after the battle starts (the hash would not match).
- Lying about a hit, a scan or a Long Glass picture (caught at the end).
- Moving or turning a ship illegally, or hiding wreckage or the merchant's wake (caught at the end).
- Writing messages as the other player, or into a room you are not in (database rules).

### What it does **not** protect against

1. **Cheating is only detected at the end, not prevented.** A liar can enjoy a false "miss" for the whole game
   and then be flagged; the flag is shown, nothing more.
2. **Refusing to reveal.** A loser can close the tab before revealing; there is then nothing to check.
3. **Reading the other side's secrets during play** is impossible today (fleets never leave the browser), but a
   modified client can *see* things the UI hides: e.g. the rival's drop sequence is safe, yet any future
   feature that sends hidden data to both clients would leak.
4. **Stalling.** A player can simply stop answering; the game has no clock.
5. **Bots and modified clients.** Anyone can run a script that plays perfectly from the rules we publish.
6. **Spam and abuse.** Anonymous rooms can be created without limit; notes in bottles are free text.
7. **Debug tools.** `?debug=true` only works against the machine, but it shows the code path exists.

## Two ways forward

### Option A — keep peer-to-peer, harden it (cheap, stays on the free plan)

The current design is a sound commit-and-reveal protocol. Harden the edges:

- **Forfeit on refusal.** If a player does not reveal within N minutes after the end (or disconnects for good),
  the other wins by forfeit. Store the deadline in the room; a tiny scheduled Cloud Function (or the winner's
  client, checked by rules) records it.
- **Turn clock.** Each turn has a time limit (e.g. 90 s, the hourglass can show it). Missing it ends the turn;
  missing three in a row forfeits.
- **Rate limits and quotas in rules.** At most one room per uid at a time, a cap on log length, a minimum gap
  between messages, note length enforced by the rules (not only the client).
- **Results recorded honestly.** Each client writes its own verdict; a game counts as won only when both agree or
  the forfeit rule applies.
- **Leak review.** Keep the rule "a browser never receives the other side's secrets". Every new feature must
  pass that check.

**Limits:** cheating is still caught *after* the game. Good enough between friends, not for ranked play.

### Option B — an authoritative server (the secure way)

The server holds the truth. Clients send intentions ("fire at G7"); the server applies the rules and sends each
player only what they may know.

- **Where:** Cloud Run (container, scales to zero) or Cloud Functions for Firebase, or a small Node server on any
  host with WebSockets. Cloud Run + Firestore/Realtime Database fits the current stack and has a free tier that
  covers casual play.
- **What moves to the server:** `src/game/rules.ts` and the reducer in `src/game/engine.ts` already run without
  the browser. The server keeps both fleets, resolves every shot, scan, Kraken strike, maelstrom toll, treasure
  drop and move itself. `verify.ts` is no longer needed in play (useful for tests).
- **What the client becomes:** a view. It renders the public state plus *its own* fleet, sends actions, and
  animates the server's answers. The hashes and the reveal step go away.
- **Messages:** keep the same shapes. Two streams per room: a public log (both players) and a private log per
  player (their fleet, their scan answers). Database rules give each player read access only to their own
  private log; only the server writes.
- **Fairness extras that become possible:** a real turn clock enforced by the server, reconnect at any time,
  spectators who see only public information, replays after the game, rankings.

**Costs:** server code to write and host; requests count against quotas (still very small for a 1-v-1 turn
game).

## Accounts: needed or not?

- **Not needed to play.** Anonymous sign-in (as today) is enough for "create a room, send a link, play".
- **Useful for:** keeping a name, a win record and ranking; returning to a game from another device; reporting
  and blocking abusive players.
- **Recommended path:** keep **guest play** as the default (anonymous), and offer **"save your captain"**:
  upgrade the anonymous account to Google or email sign-in with Firebase's account linking, keeping the same uid
  and history. No separate registration screen.

## Guest play

- Guests keep working exactly as now: open the link, choose a name, play.
- A guest's identity lives in the browser tab (session persistence). Closing the tab loses the seat;
  reloading keeps it. With an authoritative server we can add a short "rejoin code" so a guest can come back
  from another tab.
- Guests can be limited (e.g. no ranked games, one open room at a time) without blocking casual play.

## Code changes, step by step

1. **Turn clock and forfeit (both options).** Add `deadline` to the room, show it on the hourglass, end turns
   that run out, and a forfeit path when someone leaves or refuses to reveal.
2. **Tighter database rules.** Message size and type whitelists, one active room per uid, log length cap,
   note length.
3. **Server (Option B).** A `server/` package that imports `src/game/*`, exposes `createRoom / join / act`
   over HTTPS or WebSocket, and writes `public` and `private/<seat>` logs. Unit tests reuse the current
   `rules.test.ts` scenarios.
4. **Client (Option B).** `src/net/session.ts` gets a `ServerSession` that sends actions and listens to the two
   logs. `Client` stops holding the enemy's hidden data and stops answering shots itself.
5. **Accounts (optional).** Account linking UI in Settings ("Save your captain"), a `players/<uid>` record
   with name and results.
6. **Moderation.** Report button on bottle notes, a word filter, and a block list per player.

## Recommendation

- **Now, between friends:** Option A steps 1–2 (turn clock, forfeit, tighter rules). A few days of work, no new
  infrastructure, no cost.
- **Before any public or ranked play:** Option B with guest play plus optional account linking. The rules engine is
  already separate from the browser, so moving it to a server is mostly plumbing.
