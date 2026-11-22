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
    // The sheet of articles, with the title on a ribbon across its head and two arms of the deep at its sides.
    this.root.innerHTML = `
      <div class="port">
      <div class="sheet">
        <div class="banner" aria-label="The Sunken Covenant">
          <img class="art" src="/ui/home_ribbon.webp" alt="" draggable="false" onerror="this.remove()">
          <svg class="fallback" viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true">
            <path d="M8 30 L70 30 L70 92 L8 92 L30 61 Z" fill="#8a6a3a"/><path d="M592 30 L530 30 L530 92 L592 92 L570 61 Z" fill="#8a6a3a"/>
            <path d="M70 30 L95 18 L95 80 L70 92 Z M530 30 L505 18 L505 80 L530 92 Z" fill="#5e4524"/>
            <path d="M95 18 C200 8, 400 8, 505 18 L505 80 C400 70, 200 70, 95 80 Z" fill="#e9dcbc" stroke="#6b5233" stroke-width="2"/>
          </svg>
          <h1 class="title">The Sunken Covenant</h1>
        </div>
        <img class="tentacle left" src="/ui/home_tentacle.webp" alt="" draggable="false" onerror="this.classList.add('missing')">
        <img class="tentacle right" src="/ui/home_tentacle.webp" alt="" draggable="false" onerror="this.classList.add('missing')">
      <div class="card">
        <p class="claim">A competitive multiplayer naval strategy game inspired by the golden age of sailing warfare.</p>
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
