// Captains' accounts and their log of battles. Optional: guests play as before.
// The account lives in its own Firebase app with lasting (local) sign-in, apart from the per-tab anonymous identity
// that online rooms use, so a captain stays signed in across visits while each tab can still sit at its own table.
// Battles are kept under players/<uid>/matches, which only that captain may read or add to (database.rules.json).
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth, GoogleAuthProvider, User, browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator, createUserWithEmailAndPassword,
  indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth';
import { Database, connectDatabaseEmulator, get, getDatabase, limitToLast, orderByChild, push, query, ref, serverTimestamp, set } from 'firebase/database';
import { firebaseConfigured, firebaseOptions, useEmulator } from './firebase';

/** One battle as the captain saw it. */
export interface MatchRecord {
  at: number;
  /** 'machine' or 'online'. */
  vs: 'machine' | 'online';
  mode: 'classic' | 'convoy';
  /** The captain's role in Convoy (admiral / corsair), or classic. */
  role: string;
  opponent: string;
  cmd: string;
  foeCmd: string;
  result: 'win' | 'loss';
  /** How it ended: fleet, home, plunder, season. */
  reason: string;
  rounds: number;
  shots: number;
  hits: number;
  sank: number;
  lost: number;
  krakens: number;
  /** Online only: whether the other captain's log checked out. */
  fair?: boolean;
}

let app: FirebaseApp | null = null, auth: Auth, db: Database;
let user: User | null = null;
/** The name kept in the captain's profile (it follows them to any device). */
let profileName = '', profileFor = '';
const listeners = new Set<(u: User | null) => void>();

/** Accounts work whenever online play does (a Firebase project, or the emulator). */
export const accountsAvailable = firebaseConfigured;

function start() {
  if (app || !accountsAvailable) return;
  app = initializeApp(firebaseOptions(), 'account');
  // Lasting sign-in from the start (switching persistence later loses the stored captain on reload).
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  db = getDatabase(app);
  if (useEmulator) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectDatabaseEmulator(db, '127.0.0.1', 9000); }
  onAuthStateChanged(auth, (u) => {
    user = u && !u.isAnonymous ? u : null;
    if (profileFor !== user?.uid) { profileName = ''; profileFor = user?.uid ?? ''; }
    notify();
    if (user && !profileName) {
      const uid = user.uid;
      void get(ref(db, `players/${uid}/profile/name`)).then((s) => { if (s.exists() && user?.uid === uid && !profileName) { profileName = String(s.val()); notify(); } }).catch(() => undefined);
    }
  });
}

/** Called with the signed-in captain (or null) now and whenever it changes. */
export function onAccount(f: (u: User | null) => void) { start(); listeners.add(f); f(user); return () => listeners.delete(f); }
export const currentAccount = () => user;
const notify = () => { for (const f of listeners) f(user); };
export const captainName = (u: User | null = user) => (u && u === user && profileName) || u?.displayName || u?.email?.split('@')[0] || '';

/** Human messages for the usual sign-in errors (English; the page translator gives the Spanish). */
function why(e: unknown): Error {
  const code = (e as { code?: string }).code || '';
  const m: Record<string, string> = {
    'auth/invalid-email': 'That e-mail address does not look right.',
    'auth/missing-password': 'Write a password.',
    'auth/weak-password': 'The password needs at least 6 characters.',
    'auth/email-already-in-use': 'There is already a captain with that e-mail: sign in instead.',
    'auth/invalid-credential': 'Wrong e-mail or password.',
    'auth/wrong-password': 'Wrong e-mail or password.',
    'auth/user-not-found': 'No captain with that e-mail: create an account instead.',
    'auth/too-many-requests': 'Too many tries. Wait a moment and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed.',
    'auth/operation-not-allowed': 'That way of signing in is not switched on yet.',
    'auth/network-request-failed': 'No connection. Check your network and try again.',
  };
  return new Error(m[code] || 'Something went wrong signing in. Try again.');
}

export async function signUp(email: string, password: string, name: string) {
  start();
  try {
    const c = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const n = name.trim().slice(0, 20) || c.user.email?.split('@')[0]?.slice(0, 20) || 'Captain';
    // Show the chosen name at once; the profile and display name are saved behind it.
    user = c.user; profileName = n; profileFor = c.user.uid; notify();
    await updateProfile(c.user, { displayName: n }).catch(() => undefined);
    await set(ref(db, `players/${c.user.uid}/profile`), { name: n, created: serverTimestamp() });
    user = c.user; profileName = n; profileFor = c.user.uid; notify();
  } catch (e) { throw why(e); }
}
export async function signIn(email: string, password: string) {
  start();
  try { await signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw why(e); }
}
export async function signInGoogle() {
  start();
  try {
    const c = await signInWithPopup(auth, new GoogleAuthProvider());
    const p = ref(db, `players/${c.user.uid}/profile`);
    if (!(await get(p)).exists()) await set(p, { name: captainName(c.user).slice(0, 20), created: serverTimestamp() });
  } catch (e) { throw why(e); }
}
export async function resetPassword(email: string) {
  start();
  try { await sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw why(e); }
}
export async function signOutAccount() { start(); await signOut(auth); }
export async function renameCaptain(name: string) {
  if (!user) return;
  const n = name.trim().slice(0, 20);
  if (!n || n === user.displayName) return;
  await updateProfile(user, { displayName: n });
  await set(ref(db, `players/${user.uid}/profile/name`), n).catch(() => undefined);
  profileName = n; notify();
}

/** Add a battle to the signed-in captain's log (nothing happens for guests). */
export async function recordMatch(m: Omit<MatchRecord, 'at'>) {
  if (!user) return;
  await push(ref(db, `players/${user.uid}/matches`), { ...m, at: serverTimestamp() });
}

/** The captain's latest battles, newest first. */
export async function loadMatches(n = 200): Promise<MatchRecord[]> {
  if (!user) return [];
  const snap = await get(query(ref(db, `players/${user.uid}/matches`), orderByChild('at'), limitToLast(n)));
  const out: MatchRecord[] = [];
  snap.forEach((s) => { out.push(s.val() as MatchRecord); });
  return out.reverse();
}
