// The port: choose a name and how to play.
export interface LobbyHandlers {
  bot(name: string): void;
  create(name: string): void;
  join(name: string, code: string): void;
}

export class Lobby {
  private root = document.getElementById('lobby')!;
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T;

  constructor(on: LobbyHandlers, online: boolean) {
    this.root.innerHTML = `
      <div class="card">
        <h1>Articles of Engagement</h1>
        <p class="tag">Two captains. One sea. No quarter.</p>
        <label for="capName">Captain's name</label>
        <input id="capName" maxlength="20" autocomplete="off" />
        <div class="row"><button class="plaque" id="vsBot">Play the machine</button></div>
        <div class="row"><button class="plaque dark" id="create">Create a room</button></div>
        <div class="row"><input id="code" maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" /><button class="plaque dark" id="join">Join</button></div>
        <div class="drums" hidden></div>
        <p class="status" role="status"></p>
      </div>`;
    const name = this.q<HTMLInputElement>('#capName');
    try { name.value = localStorage.getItem('tsc:name') || ''; } catch { /* storage unavailable */ }
    const who = () => { const n = name.value.trim() || 'Captain'; try { localStorage.setItem('tsc:name', n); } catch { /* ignore */ } return n; };
    this.q<HTMLElement>('#vsBot').onclick = () => on.bot(who());
    this.q<HTMLElement>('#create').onclick = () => on.create(who());
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
