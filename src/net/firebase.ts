// Network sessions over Firebase Realtime Database (free Spark plan, no server code).
// A room is an append-only log of messages; both captains replay it in key order.
import { FirebaseApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { Database, connectDatabaseEmulator, get, getDatabase, off, onChildAdded, onDisconnect, onValue, push, ref, remove, set } from 'firebase/database';
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
  uid = (await signInAnonymously(auth)).user.uid;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

class FirebaseSession implements Session {
  private unsub: (() => void)[] = [];
  constructor(public code: string, public me: 0 | 1, public seed: number, public mode: Mode) {}
  private at(path: string) { return ref(db, `rooms/${this.code}/${path}`); }

  send(m: Msg) { void push(this.at('log'), { ...JSON.parse(JSON.stringify(m)), uid }); }

  listen(cb: (m: Msg) => void, onPresence?: (online: boolean) => void) {
    const log = this.at('log');
    onChildAdded(log, (snap) => {
      const { uid: _u, ...m } = snap.val();
      // The database drops empty arrays; put them back.
      if (m.t === 'move') m.debris ||= [];
      if (m.t === 'result' || m.t === 'drowned') m.results ||= [];
      if (m.t === 'reveal') { m.acts ||= []; m.initial ||= []; m.final ||= []; }
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

  close() { for (const u of this.unsub) u(); this.unsub = []; }
}
export type { FirebaseSession };

export async function createRoom(mode: Mode): Promise<FirebaseSession> {
  await connect();
  for (let tries = 0; tries < 6; tries++) {
    const code = newCode(), seed = Math.floor(Math.random() * 2 ** 31);
    try {
      await set(ref(db, `rooms/${code}/meta`), { host: uid, seed, mode, created: Date.now() });
      return new FirebaseSession(code, 0, seed, mode);
    } catch { /* code taken: try another */ }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Join a room, or take your seat again after a reload. */
export async function joinRoom(code: string): Promise<FirebaseSession> {
  await connect();
  const meta = (await get(ref(db, `rooms/${code}/meta`))).val();
  if (!meta) throw new Error('No room with that code.');
  const mode: Mode = meta.mode === 'convoy' ? 'convoy' : 'classic';
  if (meta.host === uid) return new FirebaseSession(code, 0, meta.seed, mode);
  if (!meta.guest) await set(ref(db, `rooms/${code}/meta/guest`), uid).catch(() => { throw new Error('That room is already full.'); });
  else if (meta.guest !== uid) throw new Error('That room is already full.');
  return new FirebaseSession(code, 1, meta.seed, mode);
}
