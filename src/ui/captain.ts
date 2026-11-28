// The captain's account on screen: a corner bar on the home, the sign-in sheet, and the Captain's Log (battles and
// statistics). Written in both languages here, like the guide.
import { MatchRecord, accountsAvailable, captainName, currentAccount, deleteAccount, loadMatches, onAccount, resetPassword, signIn, signInGoogle, signOutAccount, signUp } from '../net/account';
import { getLang } from './i18n';
import { CMD_INFO } from './commanders';

type T = { en: string; es: string };
const L = (t: T) => (getLang() === 'es' ? t.es : t.en);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const CMDS = ['tidewarden', 'stormcaller', 'spymaster', 'gunmaster', 'deepspeaker'] as const;
const cmdName = (k: string) => (k && k !== 'none' ? (getLang() === 'es' ? { tidewarden: 'Guardamareas', stormcaller: 'Llamatormentas', spymaster: 'Maestro Espía', gunmaster: 'Artillero', deepspeaker: 'Voz del Abismo' }[k] : CMD_INFO[k as keyof typeof CMD_INFO]?.name.replace('The ', '')) ?? k : L({ en: 'No commander', es: 'Sin comandante' }));
const face = (k: string, left = false) => (k && k !== 'none' ? `<img class="cface" src="/ui/cmd/${k}_face${left ? '_left' : ''}.webp" alt="" title="${esc(cmdName(k))}">` : '<i class="cface none">—</i>');

function sheet(cls: string, html: string, onClose?: () => void) {
  document.querySelector(`.${cls}`)?.remove();
  const box = document.body.appendChild(document.createElement('div'));
  box.className = `capSheet ${cls}`;
  box.setAttribute('translate', 'no');
  box.innerHTML = html;
  const close = () => { box.remove(); removeEventListener('keydown', key); onClose?.(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  box.addEventListener('click', (e) => { if (e.target === box || (e.target as HTMLElement).closest('[data-act=close]')) close(); });
  return { box, close };
}

/* ---------- signing in ---------- */
export function openSignIn(then?: () => void) {
  let creating = false;
  const { box, close } = sheet('signIn', '');
  const draw = (msg = '', bad = false) => {
    box.innerHTML = `<div class="card" role="dialog" aria-labelledby="siHead">
      <button type="button" class="x" data-act="close" aria-label="${L({ en: 'Close', es: 'Cerrar' })}">×</button>
      <h2 id="siHead">${creating ? L({ en: 'Enlist as a captain', es: 'Alístate como capitán' }) : L({ en: 'Sign in', es: 'Entrar' })}</h2>
      <p class="meta">${L({ en: 'An account keeps your name and your Captain\'s Log — every battle and your statistics — on any device. You can always play as a guest.', es: 'Una cuenta guarda tu nombre y tu Cuaderno de bitácora (cada batalla y tus estadísticas) en cualquier dispositivo. Siempre puedes jugar como invitado.' })}</p>
      <button type="button" class="plaque dark google" data-act="google"><b>G</b> ${L({ en: 'Continue with Google', es: 'Continuar con Google' })}</button>
      <p class="or"><span>${L({ en: 'or with e-mail', es: 'o con email' })}</span></p>
      <form>
        ${creating ? `<label>${L({ en: 'Captain\'s name', es: 'Nombre del capitán' })}<input name="name" maxlength="20" autocomplete="nickname" value="${esc(localStorage.getItem('tsc:name') || '')}"></label>` : ''}
        <label>${L({ en: 'E-mail', es: 'Email' })}<input name="email" type="email" autocomplete="email" required></label>
        <label>${L({ en: 'Password', es: 'Contraseña' })}<input name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" minlength="6" required></label>
        <p class="msg${bad ? ' bad' : ''}" role="status">${esc(msg)}</p>
        <button type="submit" class="plaque">${creating ? L({ en: 'Create account', es: 'Crear cuenta' }) : L({ en: 'Sign in', es: 'Entrar' })}</button>
      </form>
      <div class="alt">${creating ? `<button type="button" data-act="swap">${L({ en: 'I already have an account', es: 'Ya tengo cuenta' })}</button>`
        : `<button type="button" data-act="swap">${L({ en: 'Create an account', es: 'Crear una cuenta' })}</button><button type="button" data-act="reset">${L({ en: 'Forgot your password?', es: '¿Olvidaste la contraseña?' })}</button>`}</div>
    </div>`;
    const f = box.querySelector('form')!, val = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
    const busy = (b: boolean) => box.querySelectorAll('button').forEach((x) => (x.disabled = b));
    const done = () => { close(); then?.(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); busy(true);
      try { if (creating) await signUp(val('email'), val('password'), val('name')); else await signIn(val('email'), val('password')); done(); }
      catch (err) { draw(L(es((err as Error).message)), true); }
    };
    box.querySelector<HTMLElement>('[data-act=google]')!.onclick = async () => { busy(true); try { await signInGoogle(); done(); } catch (err) { draw(L(es((err as Error).message)), true); } };
    box.querySelector<HTMLElement>('[data-act=swap]')!.onclick = () => { creating = !creating; draw(); };
    const r = box.querySelector<HTMLElement>('[data-act=reset]');
    if (r) r.onclick = async () => {
      const email = val('email');
      if (!email) { draw(L({ en: 'Write your e-mail first, then press "Forgot your password?".', es: 'Escribe primero tu email y luego pulsa «¿Olvidaste la contraseña?».' }), true); return; }
      try { await resetPassword(email); draw(L({ en: 'We have sent you an e-mail to choose a new password.', es: 'Te hemos enviado un email para elegir una contraseña nueva.' })); } catch (err) { draw(L(es((err as Error).message)), true); }
    };
    (box.querySelector('input') as HTMLInputElement | null)?.focus();
  };
  draw();
}
/** The account module speaks English; these are its messages in Spanish. */
const ES: Record<string, string> = {
  'That e-mail address does not look right.': 'Ese email no parece correcto.', 'Write a password.': 'Escribe una contraseña.',
  'The password needs at least 6 characters.': 'La contraseña necesita al menos 6 caracteres.',
  'There is already a captain with that e-mail: sign in instead.': 'Ya hay un capitán con ese email: entra con él.',
  'Wrong e-mail or password.': 'Email o contraseña incorrectos.', 'No captain with that e-mail: create an account instead.': 'No hay ningún capitán con ese email: crea una cuenta.',
  'Too many tries. Wait a moment and try again.': 'Demasiados intentos. Espera un momento y vuelve a probar.', 'The sign-in window was closed.': 'Se cerró la ventana de acceso.',
  'That way of signing in is not switched on yet.': 'Esa forma de entrar aún no está activada.', 'No connection. Check your network and try again.': 'Sin conexión. Revisa tu red y vuelve a probar.',
  'Something went wrong signing in. Try again.': 'Algo falló al entrar. Vuelve a probar.',
};
const es = (en: string): T => ({ en, es: ES[en] ?? en });

/* ---------- the corner bar on the home ---------- */
export function mountAccountBar(host: HTMLElement, onName: (name: string) => void) {
  if (!accountsAvailable) return;
  const bar = host.appendChild(document.createElement('div'));
  bar.className = 'accountBar'; bar.setAttribute('translate', 'no');
  const draw = () => {
    const u = currentAccount();
    bar.innerHTML = u
      ? `<img class="ins" src="/ui/acct/insignia.webp" alt=""><span class="who">${esc(captainName(u))}</span><button type="button" class="plate" data-act="log">${L({ en: 'Captain\'s Log', es: 'Bitácora' })}</button><button type="button" class="plate" data-act="out">${L({ en: 'Sign out', es: 'Salir' })}</button>`
      : `<img class="ins" src="/ui/acct/insignia.webp" alt=""><button type="button" class="plate" data-act="in">${L({ en: 'Sign in', es: 'Entrar' })}</button>`;
    bar.querySelector<HTMLElement>('[data-act=in]')?.addEventListener('click', () => openSignIn());
    bar.querySelector<HTMLElement>('[data-act=log]')?.addEventListener('click', () => openLog());
    bar.querySelector<HTMLElement>('[data-act=out]')?.addEventListener('click', () => void signOutAccount());
  };
  onAccount((u) => { draw(); if (u) onName(captainName(u)); });
  addEventListener('tsc:lang', draw);
}

/* ---------- the Captain's Log ---------- */
export async function openLog() {
  if (!currentAccount()) { openSignIn(() => void openLog()); return; }
  let tab: 'history' | 'stats' = 'history', rows: MatchRecord[] | null = null, failed = false;
  const { box } = sheet('capLog', '');
  const draw = () => {
    const u = currentAccount();
    box.innerHTML = `<div class="card" role="dialog" aria-labelledby="logHead">
      <button type="button" class="x" data-act="close" aria-label="${L({ en: 'Close', es: 'Cerrar' })}">×</button>
      <h2 id="logHead">${L({ en: 'Captain\'s Log', es: 'Cuaderno de bitácora' })}</h2>
      <p class="meta">${esc(captainName(u))}</p>
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="history" class="${tab === 'history' ? 'on' : ''}">${L({ en: 'Battles', es: 'Batallas' })}</button>
        <button type="button" role="tab" data-tab="stats" class="${tab === 'stats' ? 'on' : ''}">${L({ en: 'Statistics', es: 'Estadísticas' })}</button>
      </div>
      <div class="body">${failed ? `<p class="empty">${L({ en: 'The log could not be loaded. Check your connection.', es: 'No se pudo cargar la bitácora. Revisa tu conexión.' })}</p>`
        : rows === null ? `<p class="empty">${L({ en: 'Opening the log…', es: 'Abriendo la bitácora…' })}</p>`
        : !rows.length ? `<p class="empty">${L({ en: 'No battles yet. Every battle you finish while signed in is written here.', es: 'Aún no hay batallas. Cada batalla que termines con la sesión iniciada se anota aquí.' })}</p>`
        : tab === 'history' ? history(rows) : stats(rows)}</div>
      <p class="danger"><button type="button" data-act="erase">${L({ en: 'Delete my account', es: 'Borrar mi cuenta' })}</button> · <a href="/privacy.html" target="_blank" rel="noopener">${L({ en: 'Privacy', es: 'Privacidad' })}</a></p>
    </div>`;
    box.querySelector<HTMLElement>('[data-act=erase]')!.onclick = async () => {
      if (!confirm(L({ en: 'Delete your account, your profile and every battle in your log? This cannot be undone.', es: '¿Borrar tu cuenta, tu perfil y todas las batallas de tu bitácora? No se puede deshacer.' }))) return;
      try { await deleteAccount(); box.remove(); alert(L({ en: 'Your account and your log have been deleted.', es: 'Tu cuenta y tu bitácora se han borrado.' })); }
      catch (e) {
        alert((e as Error).message === 'recent-login'
          ? L({ en: 'Your log has been deleted. To delete the account itself, sign in again and repeat this.', es: 'Tu bitácora se ha borrado. Para borrar la cuenta en sí, vuelve a entrar y repite esto.' })
          : L({ en: 'The account could not be deleted. Check your connection and try again.', es: 'No se pudo borrar la cuenta. Revisa tu conexión e inténtalo de nuevo.' }));
      }
    };
    box.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab as typeof tab; draw(); }));
  };
  draw();
  try { rows = await loadMatches(); } catch { failed = true; }
  draw();
}

const when = (t: number) => new Intl.DateTimeFormat(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t));
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const REASON: Record<string, T> = {
  fleet: { en: 'fleet sunk', es: 'flota hundida' }, home: { en: 'cargo home', es: 'carga a puerto' }, plunder: { en: 'cargo plundered', es: 'carga saqueada' }, season: { en: 'season over', es: 'fin de temporada' },
};

function history(rows: MatchRecord[]) {
  return `<table class="hist"><thead><tr>
      <th>${L({ en: 'When', es: 'Cuándo' })}</th><th>${L({ en: 'Against', es: 'Contra' })}</th><th>${L({ en: 'Commanders', es: 'Comandantes' })}</th>
      <th>${L({ en: 'Result', es: 'Resultado' })}</th><th>${L({ en: 'Rounds', es: 'Rondas' })}</th><th>${L({ en: 'Accuracy', es: 'Puntería' })}</th><th>${L({ en: 'Ships', es: 'Barcos' })}</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.result}">
      <td>${when(r.at)}</td>
      <td>${r.vs === 'machine' ? L({ en: 'The machine', es: 'La máquina' }) : esc(r.opponent || '?')}${r.mode === 'convoy' ? ` <em>${L({ en: 'Convoy', es: 'Convoy' })}</em>` : ''}${r.mode === 'blitz' ? ` <em>${L({ en: 'Blitz', es: 'Rápida' })}</em>` : ''}${r.vs === 'online' && r.fair === false ? ` <em class="bad" title="${L({ en: 'Their log did not add up', es: 'Su cuaderno no cuadraba' })}">⚠</em>` : ''}</td>
      <td class="faces">${face(r.cmd)}<span>v</span>${face(r.foeCmd, true)}</td>
      <td><b>${r.result === 'win' ? L({ en: 'Victory', es: 'Victoria' }) : L({ en: 'Defeat', es: 'Derrota' })}</b><small>${L(REASON[r.reason] ?? { en: r.reason, es: r.reason })}</small></td>
      <td>${r.rounds}</td><td>${r.shots ? pct(r.hits, r.shots) + ' %' : '—'}</td><td>${r.sank} / ${r.lost}</td></tr>`).join('')}
  </tbody></table><p class="foot">${L({ en: 'Ships: enemy ships sunk / your ships lost.', es: 'Barcos: barcos enemigos hundidos / barcos tuyos perdidos.' })}</p>`;
}

function stats(rows: MatchRecord[]) {
  const n = rows.length, wins = rows.filter((r) => r.result === 'win').length;
  const shots = rows.reduce((a, r) => a + r.shots, 0), hits = rows.reduce((a, r) => a + r.hits, 0);
  let best = 0, run = 0;
  for (const r of [...rows].reverse()) { run = r.result === 'win' ? run + 1 : 0; best = Math.max(best, run); }
  let now = 0; for (const r of rows) { if (r.result !== 'win') break; now++; }
  const tile = (v: string, l: T) => `<div class="tile"><b>${v}</b><span>${L(l)}</span></div>`;
  const group = (key: (r: MatchRecord) => string, label: (k: string) => string, order: string[]) => order.map((k) => {
    const g = rows.filter((r) => key(r) === k);
    if (!g.length) return '';
    const w = g.filter((r) => r.result === 'win').length, p = pct(w, g.length);
    return `<div class="barRow"><span class="lbl">${label(k)}</span><span class="bar"><i style="width:${p}%"></i></span><span class="val">${p} %</span><span class="n">${w}–${g.length - w}</span></div>`;
  }).join('');
  const last = rows.slice(0, 20).reverse();
  return `<div class="tiles">
      ${tile(String(n), { en: 'Battles', es: 'Batallas' })}${tile(`${pct(wins, n)} %`, { en: `Won (${wins})`, es: `Ganadas (${wins})` })}
      ${tile(shots ? `${pct(hits, shots)} %` : '—', { en: 'Accuracy', es: 'Puntería' })}${tile(String(rows.reduce((a, r) => a + r.sank, 0)), { en: 'Enemy ships sunk', es: 'Barcos enemigos hundidos' })}
      ${tile((rows.reduce((a, r) => a + r.rounds, 0) / n).toFixed(1), { en: 'Rounds a battle', es: 'Rondas por batalla' })}${tile(`${best}${now ? ` · ${now}` : ''}`, { en: now ? 'Best streak · now' : 'Best winning streak', es: now ? 'Mejor racha · actual' : 'Mejor racha de victorias' })}
    </div>
    <h3>${L({ en: 'Last battles', es: 'Últimas batallas' })}</h3>
    <div class="form">${last.map((r) => `<i class="${r.result}" title="${when(r.at)}"></i>`).join('')}<span>${L({ en: 'oldest → newest', es: 'antigua → reciente' })}</span></div>
    <h3>${L({ en: 'Win rate by your commander', es: 'Victorias según tu comandante' })}</h3>
    <div class="bars">${group((r) => r.cmd || 'none', (k) => `${face(k)} ${esc(cmdName(k))}`, ['none', ...CMDS])}</div>
    <h3>${L({ en: 'Win rate by opponent', es: 'Victorias según el rival' })}</h3>
    <div class="bars">${group((r) => r.vs, (k) => (k === 'machine' ? L({ en: 'The machine', es: 'La máquina' }) : L({ en: 'Other captains', es: 'Otros capitanes' })), ['machine', 'online'])}
      ${group((r) => (r.mode === 'convoy' ? r.role : ''), (k) => (k === 'admiral' ? L({ en: 'Convoy · Admiral', es: 'Convoy · Almirante' }) : L({ en: 'Convoy · Corsair', es: 'Convoy · Corsaria' })), ['admiral', 'corsair'])}</div>`;
}
