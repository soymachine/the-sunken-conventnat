// The port: choose a name and how to play.
import { Mode } from '../game/engine';

export interface LobbyHandlers {
  bot(name: string, mode: Mode): void;
  create(name: string, mode: Mode): void;
  join(name: string, code: string): void;
}

export class Lobby {
  private root = document.getElementById('lobby')!;
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(on: LobbyHandlers, online: boolean) {
    // The crest (public/ui/crest.webp) carries the title on its banner and a monogram in the wax.
    this.root.innerHTML = `
      <div class="port">
      <svg class="crest" viewBox="0 0 1024 1024" role="img" aria-label="The Sunken Covenant">
        <defs>
          <path id="bannerLine" d="M232,443 C243,442 279,436 300,434 C321,432 340,428 360,429 C380,430 402,434 420,439 C438,444 452,450 470,456 C488,462 510,470 530,477 C550,484 570,491 590,497 C610,503 630,509 650,513 C670,517 690,521 710,520 C730,519 753,513 770,508 C787,503 803,493 810,490" />
          <filter id="inkRough" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="1.6" result="rough" />
            <feGaussianBlur in="rough" stdDeviation=".55" result="ink" />
            <feGaussianBlur in="ink" stdDeviation="2.4" result="soft" />
            <feOffset in="soft" dx="2" dy="4" result="drop" />
            <feFlood flood-color="#3a2410" flood-opacity=".42" />
            <feComposite in2="drop" operator="in" result="shadow" />
            <feMerge><feMergeNode in="shadow" /><feMergeNode in="ink" /></feMerge>
          </filter>
        </defs>
        <image href="/ui/crest.webp" width="1024" height="1024" />
        <text class="bannerText" filter="url(#inkRough)"><textPath href="#bannerLine" startOffset="50%" text-anchor="middle" textLength="586" lengthAdjust="spacingAndGlyphs">The Sunken Covenant</textPath></text>
        <g class="monogram" text-anchor="middle">
          <text x="511" y="828" fill="#3d0f07" opacity=".8">SC</text>
          <text x="517" y="834" fill="#e68a6c" opacity=".35">SC</text>
          <text x="514" y="831" fill="#8e2a17">SC</text>
        </g>
      </svg>
      <div class="card">
        <h1>Articles of Engagement</h1>
        <p class="tag">Two captains. One sea. No quarter.</p>
        <div class="flourish" aria-hidden="true">&#10086;</div>
        <label for="capName">Captain's name</label>
        <input id="capName" maxlength="20" autocomplete="off" placeholder="Sign your name" />
        <p class="field" id="modeLbl">Kind of battle</p>
        <div class="modes" role="radiogroup" aria-labelledby="modeLbl">
          <button class="mode on" data-mode="classic" role="radio" aria-checked="true"><b>Classic</b><span>Sink the whole enemy fleet.</span></button>
          <button class="mode" data-mode="convoy" role="radio" aria-checked="false"><b>Convoy</b><span>One escorts the cargo home, the other plunders it. Roles are drawn by lot.</span></button>
        </div>
        <div class="row"><button class="plaque" id="vsBot">Play the machine</button></div>
        <p class="or"><span>or sail against a friend</span></p>
        <div class="row"><button class="plaque dark" id="create">Create a room</button></div>
        <div class="row joinRow"><input id="code" maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" /><button class="plaque dark" id="join">Join</button></div>
        <div class="invite" hidden>
          <p class="field">Your room</p>
          <div class="drums" aria-label="Room code"></div>
          <div class="row"><button class="plaque dark" id="copyCode" data-keep="1">Copy code</button><button class="plaque dark" id="copyLink" data-keep="1">Copy invite link</button></div>
          <p class="link" id="inviteLink"></p>
        </div>
        <p class="status" role="status"></p>
        <p class="version">Version ${__APP_VERSION__}</p>
      </div>
      </div>`;
    const name = this.q<HTMLInputElement>('#capName');
    try { name.value = localStorage.getItem('tsc:name') || ''; } catch { /* storage unavailable */ }
    const who = () => { const n = name.value.trim() || 'Captain'; try { localStorage.setItem('tsc:name', n); } catch { /* ignore */ } return n; };
    let mode: Mode = 'classic';
    this.root.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => (b.onclick = () => {
      mode = b.dataset.mode as Mode;
      this.root.querySelectorAll('.mode').forEach((o) => { o.classList.toggle('on', o === b); o.setAttribute('aria-checked', String(o === b)); });
    }));
    this.q<HTMLElement>('#vsBot').onclick = () => on.bot(who(), mode);
    this.q<HTMLElement>('#create').onclick = () => on.create(who(), mode);
    const join = () => { const c = this.q<HTMLInputElement>('#code').value.trim().toUpperCase(); if (c.length === 4) on.join(who(), c); else this.status('A room code has four characters.', true); };
    this.q<HTMLElement>('#join').onclick = join;
    this.q<HTMLInputElement>('#code').onkeydown = (e) => { if (e.key === 'Enter') join(); };
    if (!online) {
      for (const id of ['#create', '#join', '#code']) { const b = this.q<HTMLButtonElement>(id); b.disabled = true; b.dataset.off = '1'; }
      this.status('Online rooms need a Firebase project — see docs/FIREBASE_SETUP.md.');
    }
  }

  show(v: boolean) { this.root.hidden = !v; if (v) { this.invite(false); this.busy(false); } }
  private invite(on: boolean) { this.q<HTMLElement>('.invite').hidden = !on; this.q<HTMLElement>('.joinRow').hidden = on; }
  busy(b: boolean) { this.root.querySelectorAll<HTMLButtonElement>('button').forEach((x) => { if (!x.dataset.off && !x.dataset.keep) x.disabled = b; }); }
  status(text: string, err = false) { const s = this.q<HTMLElement>('.status'); s.textContent = text; s.classList.toggle('err', err); }
  /** The room is open: show its code in place of the join row, with ways to pass it on. */
  showCode(code: string) {
    this.q<HTMLElement>('.drums').innerHTML = [...code].map((c) => `<span>${c}</span>`).join('');
    const link = `${location.origin}/?join=${code}`;
    this.q<HTMLElement>('#inviteLink').textContent = link;
    const copy = (id: string, text: string, done: string) => {
      const b = this.q<HTMLButtonElement>(id), label = b.textContent;
      b.onclick = () => navigator.clipboard.writeText(text).then(
        () => { b.textContent = done; setTimeout(() => (b.textContent = label), 1600); },
        () => { const r = document.createRange(); r.selectNodeContents(this.q('#inviteLink')); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); },
      );
    };
    copy('#copyCode', code, 'Copied');
    copy('#copyLink', link, 'Link copied');
    this.invite(true);
    this.status('Send the code or the link to your rival. The battle begins as soon as they join…');
  }

  /** Opened from an invite link: the code is filled in, the guest only signs and joins. */
  invited(code: string) {
    this.q<HTMLInputElement>('#code').value = code;
    this.status(`You are invited to room ${code}. Sign your name and press Join.`);
    this.q<HTMLInputElement>('#capName').focus();
  }
}
