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
          <path id="bannerLine" d="M200,428 C330,414 455,426 565,470 S760,514 832,478" />
          <filter id="inkRough" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="2.5" />
          </filter>
        </defs>
        <image href="/ui/crest.webp" width="1024" height="1024" />
        <text class="bannerText" filter="url(#inkRough)"><textPath href="#bannerLine" startOffset="50%" text-anchor="middle" textLength="600" lengthAdjust="spacingAndGlyphs">The Sunken Covenant</textPath></text>
        <g class="monogram" text-anchor="middle">
          <text x="511" y="828" fill="#3d0f07" opacity=".8">SC</text>
          <text x="517" y="834" fill="#e68a6c" opacity=".35">SC</text>
          <text x="514" y="831" fill="#8e2a17">SC</text>
        </g>
      </svg>
      <div class="card">
        <h1>Articles of Engagement</h1>
        <p class="tag">Two captains. One sea. No quarter.</p>
        <label for="capName">Captain's name</label>
        <input id="capName" maxlength="20" autocomplete="off" />
        <div class="modes" role="radiogroup" aria-label="Kind of battle">
          <button class="mode on" data-mode="classic" role="radio" aria-checked="true"><b>Classic</b><span>Sink the whole enemy fleet.</span></button>
          <button class="mode" data-mode="convoy" role="radio" aria-checked="false"><b>Convoy</b><span>One escorts the cargo home, the other plunders it. Roles are drawn by lot.</span></button>
        </div>
        <div class="row"><button class="plaque" id="vsBot">Play the machine</button></div>
        <div class="row"><button class="plaque dark" id="create">Create a room</button></div>
        <div class="row"><input id="code" maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" /><button class="plaque dark" id="join">Join</button></div>
        <div class="drums" hidden></div>
        <p class="status" role="status"></p>
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

  show(v: boolean) { this.root.hidden = !v; if (v) { this.q<HTMLElement>('.drums').hidden = true; this.busy(false); } }
  busy(b: boolean) { this.root.querySelectorAll<HTMLButtonElement>('button').forEach((x) => { if (!x.dataset.off) x.disabled = b; }); }
  status(text: string, err = false) { const s = this.q<HTMLElement>('.status'); s.textContent = text; s.classList.toggle('err', err); }
  showCode(code: string) {
    const d = this.q<HTMLElement>('.drums');
    d.innerHTML = [...code].map((c) => `<span>${c}</span>`).join('');
    d.hidden = false;
    this.status('Send this code to your rival. Waiting for the second captain…');
  }
}
