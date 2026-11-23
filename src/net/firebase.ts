// Network sessions over Firebase Realtime Database (free Spark plan, no server code).
// A room is an append-only log of messages; both captains replay it in key order.
import { FirebaseApp, initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence, signInAnonymously } from 'firebase/auth';
import { Database, connectDatabaseEmulator, endAt, get, getDatabase, limitToFirst, off, onChildAdded, onDisconnect, onValue, orderByChild, orderByValue, push, query, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { Mode, Msg } from '../game/engine';
import { Session } from './session';

const env = import.meta.env;
export const firebaseConfigured = !!env.VITE_FIREBASE_DATABASE_URL || !!env.VITE_FIREBASE_EMULATOR;

let app: FirebaseApp | undefined, db: Database, uid = '';
async function connect(): Promise<void> {
  if (app) return;
  const emu = !!env.VITE_FIREBASE_EMULATOR;
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-sunken-covenant',
    appId: env.VITE_FIREBASE_APP_ID,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'http://127.0.0.1:9000/?ns=demo-sunken-covenant',
  });
  const auth = getAuth(app);
  db = getDatabase(app);
  if (emu) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  // Each tab is its own captain: with the default (shared) persistence, two tabs of one browser were
  // the same player, and a second tab joining a room took the host's own seat. A tab keeps its identity
  // across reloads, so a captain can still return to a battle in progress.
  await setPersistence(auth, browserSessionPersistence);
  uid = (await signInAnonymously(auth)).user.uid;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

class FirebaseSession implements Session {
  private unsub: (() => void)[] = [];
  constructor(public code: string, public me: 0 | 1, public seed: number, public mode: Mode) {}
  private at(path: string) { return ref(db, `rooms/${this.code}/${path}`); }

  // Each message is stamped by the server. Push keys follow each sender's own clock, so two
  // computers with different clocks would otherwise replay the log in the wrong order.
  send(m: Msg) { void push(this.at('log'), { ...JSON.parse(JSON.stringify(m)), uid, ts: serverTimestamp() }); }

  listen(cb: (m: Msg) => void, onPresence?: (online: boolean) => void) {
    const log = query(this.at('log'), orderByChild('ts'));
    onChildAdded(log, (snap) => {
      const { uid: _u, ts: _t, ...m } = snap.val();
      // The database drops empty arrays; put them back.
      if (m.t === 'move') m.debris ||= [];
      if (m.t === 'result' || m.t === 'drowned') m.results ||= [];
      if (m.t === 'reveal') { m.acts ||= []; m.initial ||= []; m.final ||= []; }
      if (m.t === 'peekResult') m.ships ||= [];
      cb(m as Msg);
    });
    this.unsub.push(() => off(log));
    const mine = this.at(`presence/${this.me}`);
    void set(mine, true);
    void onDisconnect(mine).remove();
    this.unsub.push(() => void remove(mine));
    if (onPresence) this.unsub.push(onValue(this.at(`presence/${1 - this.me}`), (s) => onPresence(s.exists())));
  }

  /** Resolves once a second captain has joined the room. */
  guest(): Promise<void> {
    return new Promise((res) => {
      const stop = onValue(this.at('meta/guest'), (s) => { if (s.exists()) { stop(); res(); } });
      this.unsub.push(stop);
    });
  }

  /**
   * Each captain marks the room done once the battle is over and the other's log has been checked; the second to
   * do so deletes the room, so finished battles do not pile up in the database.
   */
  finished() {
    void set(this.at(`done/${this.me}`), true).then(async () => {
      const done = (await get(this.at('done'))).val() || {};
      if (done[0] && done[1]) await update(ref(db), { [`rooms/${this.code}`]: null, [`roomsByAge/${this.code}`]: null });
    }).catch(() => { /* the other captain got there first */ });
  }

  close() { for (const u of this.unsub) u(); this.unsub = []; }
}

/** A room older than a day is abandoned: anyone signed in may clear it (the rules check its age). */
const DAY = 24 * 60 * 60 * 1000;
let swept = false;
/** Clear a few abandoned rooms, once per visit. Each visitor sweeps a little, so no server is needed. */
async function sweep() {
  if (swept) return;
  swept = true;
  try {
    const old = await get(query(ref(db, 'roomsByAge'), orderByValue(), endAt(Date.now() - DAY - 60_000), limitToFirst(25)));
    const gone: Record<string, null> = {};
    old.forEach((s) => { gone[`rooms/${s.key}`] = null; gone[`roomsByAge/${s.key}`] = null; });
    if (Object.keys(gone).length) await update(ref(db), gone);
  } catch { /* nothing to sweep, or someone else swept first */ }
}
export type { FirebaseSession };

export async function createRoom(mode: Mode): Promise<FirebaseSession> {
  await connect();
  for (let tries = 0; tries < 6; tries++) {
    const code = newCode(), seed = Math.floor(Math.random() * 2 ** 31);
    try {
      await set(ref(db, `rooms/${code}/meta`), { host: uid, seed, mode, created: serverTimestamp() });
      // The room's age, kept apart so abandoned rooms can be found without reading any battle.
      await set(ref(db, `roomsByAge/${code}`), serverTimestamp());
      void sweep();
      return new FirebaseSession(code, 0, seed, mode);
    } catch { /* code taken: try another */ }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Join a room, or take your seat again after a reload. */
export async function joinRoom(code: string): Promise<FirebaseSession> {
  await connect();
  void sweep();
  const meta = (await get(ref(db, `rooms/${code}/meta`))).val();
  if (!meta) throw new Error('No room with that code, or its battle is over.');
  const mode: Mode = meta.mode === 'convoy' ? 'convoy' : 'classic';
  if (meta.host === uid) return new FirebaseSession(code, 0, meta.seed, mode);
  if (!meta.guest) await set(ref(db, `rooms/${code}/meta/guest`), uid).catch(() => { throw new Error('That room is already full.'); });
  else if (meta.guest !== uid) throw new Error('That room is already full.');
  return new FirebaseSession(code, 1, meta.seed, mode);
}
