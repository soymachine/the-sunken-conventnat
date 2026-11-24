// The portals desk: the web portals that could carry the game, what each one asks, and where every lead stands.
// Only signed-in administrators (admins/<uid> = true in the database) can read or change it; see database.rules.json.
import '../ui/fonts';
import './clients.css';
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator, initializeAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, User } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, onValue, push, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { firebaseConfigured, firebaseOptions, useEmulator } from '../net/firebase';

interface Lead {
  name: string; url: string; devUrl: string; docsUrl: string; kind: string; fit: number; priority: string; stage: string;
  audience: string; revenue: string; exclusivity: string; requirements: string; process: string; fitNotes: string;
  contact: string; contactEmail: string; nextAction: string; nextDate: string; sources: string; notes?: string; updatedAt?: number;
}
interface Template { name: string; subject: string; body: string }
interface LogEntry { t: number; text: string }

const STAGES: [string, string][] = [
  ['Not started', 'Sin empezar'], ['Researching', 'Investigando'], ['Preparing', 'Preparando build'], ['Contacted', 'Contactado'],
  ['Talking', 'En conversación'], ['Submitted', 'Enviado / en revisión'], ['Live', 'Publicado'], ['Paused', 'En pausa'], ['Declined', 'Descartado'],
];
const stageEs = (s: string) => STAGES.find(([k]) => k === s)?.[1] ?? s;
const PRIORITIES: [string, string][] = [['High', 'Alta'], ['Medium', 'Media'], ['Low', 'Baja']];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const day = (t?: number) => (t ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(t)) : '—');
const today = () => new Date().toISOString().slice(0, 10);

document.body.innerHTML = '<div id="app"><p class="loading">Cargando…</p></div>';
const app = document.getElementById('app')!;
if (!firebaseConfigured) { app.innerHTML = '<p class="loading">Firebase no está configurado en esta compilación.</p>'; throw new Error('no firebase'); }

const fb = initializeApp(firebaseOptions(), 'crm');
const auth = initializeAuth(fb, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
const db = getDatabase(fb);
if (useEmulator) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectDatabaseEmulator(db, '127.0.0.1', 9000); }

let leads: Record<string, Lead> = {}, templates: Record<string, Template> = {}, logs: Record<string, Record<string, LogEntry>> = {};
let open = '', tab: 'leads' | 'email' = 'leads', filter = { stage: '', kind: '', q: '' }, sort: 'fit' | 'name' | 'stage' | 'next' = 'fit', tplId = 'approach', tplLead = '';
let unsub: (() => void)[] = [];

onAuthStateChanged(auth, (u) => { unsub.forEach((f) => f()); unsub = []; if (u) watch(u); else login(); });

/* ---------- sign in ---------- */
function login(err = '') {
  app.innerHTML = `<form class="login card" autocomplete="on">
    <h1>Portales</h1><p class="sub">The Sunken Covenant · acceso restringido</p>
    <label>Correo<input name="email" type="email" autocomplete="username"></label>
    <label>Contraseña<input name="password" type="password" autocomplete="current-password"></label>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <button class="primary" type="submit">Entrar</button>
    <p class="or">o</p>
    <button class="google" type="button" id="google">Entrar con Google</button>
  </form>`;
  app.querySelector<HTMLElement>('#google')!.onclick = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if ((e as { code?: string }).code !== 'auth/popup-closed-by-user') login('No se pudo entrar con Google.'); }
  };
  const f = app.querySelector('form')!;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    try { await signInWithEmailAndPassword(auth, String(d.get('email')), String(d.get('password'))); }
    catch { login('Correo o contraseña incorrectos.'); }
  };
}

/* ---------- data ---------- */
function watch(u: User) {
  app.innerHTML = '<p class="loading">Abriendo el panel…</p>';
  const denied = () => { app.innerHTML = `<div class="login card"><h1>Sin acceso</h1><p>La cuenta <b>${esc(u.email)}</b> no es administradora de este panel.</p><p class="sub">Añade su UID en la base de datos: <code>admins/${esc(u.uid)} = true</code></p><button type="button" class="primary" id="out">Salir</button></div>`; app.querySelector<HTMLElement>('#out')!.onclick = () => void signOut(auth); };
  // Draw once all three parts have arrived, then again on every change.
  const got = new Set<string>();
  const on = (k: string, set: (v: never) => void) => onValue(ref(db, `crm/${k}`), (snap) => { set((snap.val() ?? {}) as never); got.add(k); if (got.size === 3) draw(u); }, denied);
  unsub.push(on('leads', (v) => (leads = v)), on('templates', (v) => (templates = v)), on('log', (v) => (logs = v)));
}
const save = (id: string, patch: Partial<Lead>) => update(ref(db, `crm/leads/${id}`), { ...patch, updatedAt: serverTimestamp() });
const note = (id: string, text: string) => push(ref(db, `crm/log/${id}`), { t: serverTimestamp(), text });

/* ---------- the page ---------- */
function draw(u: User) {
  // Keep the caret where it was if the redraw comes while typing.
  const active = document.activeElement as HTMLInputElement | null, keep = active?.dataset?.k ? { k: active.dataset.k, id: active.closest<HTMLElement>('[data-lead]')?.dataset.lead, pos: active.selectionStart } : null;
  const rows = Object.entries(leads);
  const counts = STAGES.map(([k, es]) => ({ k, es, n: rows.filter(([, l]) => l.stage === k).length }));
  const due = rows.filter(([, l]) => l.nextDate && l.nextDate <= today() && !['Live', 'Declined'].includes(l.stage));
  app.innerHTML = `
    <header><div><h1>Portales</h1><p class="sub">The Sunken Covenant · ${rows.length} portales</p></div>
      <nav><button class="${tab === 'leads' ? 'on' : ''}" data-tab="leads">Portales</button><button class="${tab === 'email' ? 'on' : ''}" data-tab="email">Correos</button></nav>
      <div class="who">${esc(u.email)} <button type="button" id="out">Salir</button></div></header>
    ${tab === 'leads' ? leadsView(rows, counts, due) : emailView()}`;
  app.querySelector<HTMLElement>('#out')!.onclick = () => void signOut(auth);
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab as typeof tab; draw(u); }));
  if (tab === 'leads') wireLeads(u); else wireEmail(u);
  if (keep) { const el = app.querySelector<HTMLInputElement>(`[data-lead="${keep.id}"] [data-k="${keep.k}"]`) ?? app.querySelector<HTMLInputElement>(`[data-k="${keep.k}"]`); if (el) { el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch { /* not text */ } } }
}

function leadsView(rows: [string, Lead][], counts: { k: string; es: string; n: number }[], due: [string, Lead][]) {
  const kinds = [...new Set(rows.map(([, l]) => l.kind))].sort();
  const q = filter.q.toLowerCase();
  const shown = rows.filter(([, l]) => (!filter.stage || l.stage === filter.stage) && (!filter.kind || l.kind === filter.kind)
    && (!q || `${l.name} ${l.kind} ${l.fitNotes} ${l.notes ?? ''}`.toLowerCase().includes(q)));
  const order = STAGES.map(([k]) => k);
  shown.sort(([, a], [, b]) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'stage' ? order.indexOf(a.stage) - order.indexOf(b.stage)
    : sort === 'next' ? (a.nextDate || '9999').localeCompare(b.nextDate || '9999') : (b.fit - a.fit) || a.name.localeCompare(b.name));
  const total = Math.max(1, rows.length);
  return `
    <section class="summary">
      <div class="pipe">${counts.filter((c) => c.n).map((c) => `<span class="st-${c.k.replace(/\W/g, '')}" style="flex:${c.n}" title="${c.es}: ${c.n}">${c.n}</span>`).join('')}</div>
      <div class="tiles">${counts.map((c) => `<button type="button" class="tile ${filter.stage === c.k ? 'on' : ''}" data-stage="${c.k}"><b>${c.n}</b><span>${c.es}</span></button>`).join('')}</div>
      ${due.length ? `<p class="due">⚑ Acciones pendientes hoy o atrasadas: ${due.map(([id, l]) => `<a href="#" data-open="${id}">${esc(l.name)}</a> (${esc(l.nextAction || 'sin acción')})`).join(' · ')}</p>` : ''}
    </section>
    <section class="filters">
      <input type="search" id="q" placeholder="Buscar…" value="${esc(filter.q)}">
      <select id="fKind"><option value="">Todos los tipos</option>${kinds.map((k) => `<option ${filter.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <select id="fSort">${[['fit', 'Ordenar por encaje'], ['name', 'Por nombre'], ['stage', 'Por etapa'], ['next', 'Por próxima fecha']].map(([v, t]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${filter.stage || filter.kind || filter.q ? '<button type="button" id="clear">Quitar filtros</button>' : ''}
      <span class="grow"></span><span class="sub">${shown.length} de ${total}</span>
      <button type="button" id="add" class="primary">+ Añadir portal</button>
    </section>
    <div class="tw"><table class="leads"><thead><tr><th>Portal</th><th>Tipo</th><th>Encaje</th><th>Ingresos</th><th>Exclusividad</th><th>Etapa</th><th>Prioridad</th><th>Próxima acción</th><th>Actualizado</th></tr></thead>
    <tbody>${shown.map(([id, l]) => `<tr data-lead="${id}" class="${open === id ? 'open' : ''}">
      <td><a href="#" data-open="${id}" class="nm">${esc(l.name)}</a><a class="ext" href="${esc(l.url)}" target="_blank" rel="noopener">↗</a></td>
      <td>${esc(l.kind)}</td><td class="fit">${'★'.repeat(l.fit)}<span>${'★'.repeat(5 - l.fit)}</span></td>
      <td class="clip">${esc(l.revenue)}</td><td class="clip">${esc(l.exclusivity)}</td>
      <td><select data-k="stage" class="st st-${l.stage.replace(/\W/g, '')}">${STAGES.map(([k, es]) => `<option value="${k}" ${l.stage === k ? 'selected' : ''}>${es}</option>`).join('')}</select></td>
      <td><select data-k="priority">${PRIORITIES.map(([k, es]) => `<option value="${k}" ${l.priority === k ? 'selected' : ''}>${es}</option>`).join('')}</select></td>
      <td class="clip">${esc(l.nextAction)}${l.nextDate ? ` <em class="${l.nextDate <= today() ? 'late' : ''}">${esc(l.nextDate)}</em>` : ''}</td>
      <td class="sub">${day(l.updatedAt)}</td></tr>
      ${open === id ? `<tr class="detail" data-lead="${id}"><td colspan="9">${detail(id, l)}</td></tr>` : ''}`).join('')}</tbody></table></div>`;
}

function detail(id: string, l: Lead) {
  const field = (k: keyof Lead, label: string, area = false) => `<label class="${area ? 'wide' : ''}">${label}${area ? `<textarea data-k="${k}" rows="3">${esc(l[k])}</textarea>` : `<input data-k="${k}" value="${esc(l[k])}">`}</label>`;
  const log = Object.values(logs[id] ?? {}).sort((a, b) => b.t - a.t);
  return `<div class="card det">
    <div class="cols">
      <div>
        <h3>Investigación</h3>
        ${field('name', 'Nombre')}${field('kind', 'Tipo')}
        <label>Encaje (1–5)<input data-k="fit" type="number" min="1" max="5" value="${l.fit}"></label>
        ${field('url', 'Web')}${field('devUrl', 'Portal de desarrolladores')}${field('docsUrl', 'Documentación / requisitos')}
        ${field('audience', 'Público', true)}${field('revenue', 'Ingresos', true)}${field('exclusivity', 'Exclusividad', true)}
        ${field('requirements', 'Requisitos', true)}${field('process', 'Proceso de envío', true)}${field('fitNotes', 'Por qué encaja / riesgos', true)}${field('sources', 'Fuentes', true)}
      </div>
      <div>
        <h3>Seguimiento</h3>
        ${field('contact', 'Persona de contacto')}${field('contactEmail', 'Correo de contacto')}
        ${field('nextAction', 'Próxima acción')}<label>Fecha<input data-k="nextDate" type="date" value="${esc(l.nextDate)}"></label>
        ${field('notes', 'Notas', true)}
        <div class="acts">
          <button type="button" data-act="contacted">Marcar contactado hoy</button>
          <button type="button" data-act="email">Preparar correo</button>
          <a class="btn" href="${esc(l.devUrl || l.url)}" target="_blank" rel="noopener">Abrir portal ↗</a>
        </div>
        <h3>Historial</h3>
        <form class="logf"><input name="t" placeholder="Añadir una entrada (llamada, respuesta, envío…)" autocomplete="off"><button type="submit">Añadir</button></form>
        <ol class="log">${log.length ? log.map((e) => `<li><b>${day(e.t)}</b>${esc(e.text)}</li>`).join('') : '<li class="sub">Sin entradas todavía.</li>'}</ol>
        <p class="danger"><button type="button" data-act="delete">Borrar este portal</button></p>
      </div>
    </div></div>`;
}

function wireLeads(u: User) {
  const q = app.querySelector<HTMLInputElement>('#q')!;
  q.oninput = () => { filter.q = q.value; draw(u); };
  app.querySelector<HTMLSelectElement>('#fKind')!.onchange = (e) => { filter.kind = (e.target as HTMLSelectElement).value; draw(u); };
  app.querySelector<HTMLSelectElement>('#fSort')!.onchange = (e) => { sort = (e.target as HTMLSelectElement).value as typeof sort; draw(u); };
  app.querySelector<HTMLElement>('#clear')?.addEventListener('click', () => { filter = { stage: '', kind: '', q: '' }; draw(u); });
  app.querySelectorAll<HTMLElement>('[data-stage]').forEach((b) => (b.onclick = () => { filter.stage = filter.stage === b.dataset.stage ? '' : b.dataset.stage!; draw(u); }));
  app.querySelectorAll<HTMLElement>('[data-open]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); open = open === a.dataset.open ? '' : a.dataset.open!; tab = 'leads'; draw(u); }));
  app.querySelector<HTMLElement>('#add')!.onclick = () => {
    const name = prompt('Nombre del portal'); if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `p${Date.now()}`;
    void set(ref(db, `crm/leads/${id}`), { name, url: '', devUrl: '', docsUrl: '', kind: 'Portal', fit: 3, priority: 'Medium', stage: 'Researching', audience: '', revenue: '', exclusivity: '', requirements: '', process: '', fitNotes: '', contact: '', contactEmail: '', nextAction: '', nextDate: '', sources: '', updatedAt: serverTimestamp() });
    open = id;
  };
  // Every field saves as it changes; a change of stage also goes into the lead's history.
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-k]').forEach((el) => {
    const id = el.closest<HTMLElement>('[data-lead]')!.dataset.lead!, k = el.dataset.k as keyof Lead;
    const commit = () => {
      const v = k === 'fit' ? Math.max(1, Math.min(5, Number(el.value) || 3)) : el.value;
      if (leads[id]?.[k] === v) return;
      if (k === 'stage') void note(id, `Etapa: ${stageEs(leads[id].stage)} → ${stageEs(String(v))}`);
      void save(id, { [k]: v } as Partial<Lead>);
    };
    el.addEventListener(el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'date' ? 'change' : 'blur', commit);
  });
  const det = app.querySelector<HTMLElement>('tr.detail');
  if (det) {
    const id = det.dataset.lead!;
    det.querySelector<HTMLFormElement>('.logf')!.onsubmit = (e) => { e.preventDefault(); const i = (e.target as HTMLFormElement).t as HTMLInputElement; if (i.value.trim()) void note(id, i.value.trim()); i.value = ''; };
    det.querySelector<HTMLElement>('[data-act=contacted]')!.onclick = () => { void note(id, 'Contactado'); void save(id, { stage: 'Contacted', nextAction: 'Seguimiento si no responden', nextDate: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) }); };
    det.querySelector<HTMLElement>('[data-act=email]')!.onclick = () => { tplLead = id; tab = 'email'; draw(u); };
    det.querySelector<HTMLElement>('[data-act=delete]')!.onclick = () => { if (confirm(`¿Borrar ${leads[id].name} y su historial?`)) { void remove(ref(db, `crm/leads/${id}`)); void remove(ref(db, `crm/log/${id}`)); open = ''; } };
  }
}

/* ---------- e-mail templates ---------- */
const fill = (s: string, l?: Lead) => s.replace(/\{\{portal\}\}/g, l?.name ?? '{{portal}}').replace(/\{\{contact\}\}/g, l?.contact || 'there').replace(/\{\{news\}\}/g, '{{news}}');
function emailView() {
  const t = templates[tplId] ?? Object.values(templates)[0], l = leads[tplLead];
  const opts = Object.entries(leads).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  return `<section class="email">
    <div class="filters">
      <select id="tpl">${Object.entries(templates).map(([id, x]) => `<option value="${id}" ${id === tplId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <select id="tplLead"><option value="">— Para qué portal —</option>${opts.map(([id, x]) => `<option value="${id}" ${id === tplLead ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <span class="grow"></span>
      ${l?.contactEmail ? `<a class="btn primary" href="mailto:${esc(l.contactEmail)}?subject=${encodeURIComponent(fill(t?.subject ?? '', l))}&body=${encodeURIComponent(fill(t?.body ?? '', l))}">Abrir en el correo</a>` : '<span class="sub">Pon el correo de contacto del portal para abrirlo en tu programa de correo.</span>'}
    </div>
    ${t ? `<div class="cols">
      <div class="card"><h3>Plantilla (editable)</h3>
        <label>Asunto<input id="tSubject" value="${esc(t.subject)}"></label>
        <label class="wide">Texto<textarea id="tBody" rows="22">${esc(t.body)}</textarea></label>
        <p class="sub">Variables: {{portal}}, {{contact}}, {{news}} (escríbela a mano en el seguimiento).</p></div>
      <div class="card"><h3>Vista previa${l ? ` · ${esc(l.name)}` : ''}</h3>
        <p class="subj">${esc(fill(t.subject, l))}</p><pre class="body">${esc(fill(t.body, l))}</pre>
        <div class="acts"><button type="button" id="copyS">Copiar asunto</button><button type="button" id="copyB" class="primary">Copiar texto</button>${l ? '<button type="button" id="sent">Marcar enviado</button>' : ''}</div></div>
    </div>` : '<p class="sub">No hay plantillas.</p>'}
  </section>`;
}
function wireEmail(u: User) {
  app.querySelector<HTMLSelectElement>('#tpl')!.onchange = (e) => { tplId = (e.target as HTMLSelectElement).value; draw(u); };
  app.querySelector<HTMLSelectElement>('#tplLead')!.onchange = (e) => { tplLead = (e.target as HTMLSelectElement).value; draw(u); };
  const t = templates[tplId], l = leads[tplLead];
  const s = app.querySelector<HTMLInputElement>('#tSubject'), b = app.querySelector<HTMLTextAreaElement>('#tBody');
  s?.addEventListener('blur', () => { if (s.value !== t.subject) void update(ref(db, `crm/templates/${tplId}`), { subject: s.value }); });
  b?.addEventListener('blur', () => { if (b.value !== t.body) void update(ref(db, `crm/templates/${tplId}`), { body: b.value }); });
  const copy = (txt: string, btn: HTMLElement) => void navigator.clipboard.writeText(txt).then(() => { const o = btn.textContent; btn.textContent = 'Copiado ✓'; setTimeout(() => (btn.textContent = o), 1500); });
  app.querySelector<HTMLElement>('#copyS')?.addEventListener('click', (e) => copy(fill(t.subject, l), e.target as HTMLElement));
  app.querySelector<HTMLElement>('#copyB')?.addEventListener('click', (e) => copy(fill(t.body, l), e.target as HTMLElement));
  app.querySelector<HTMLElement>('#sent')?.addEventListener('click', () => { void note(tplLead, `Correo enviado: «${t.name}»`); void save(tplLead, { stage: 'Contacted', nextAction: 'Seguimiento si no responden', nextDate: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) }); tab = 'leads'; open = tplLead; draw(u); });
}
