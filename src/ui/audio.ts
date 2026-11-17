// Every sound is synthesised with Web Audio: no audio files to load.
export type SfxName = 'cannon' | 'splash' | 'hit' | 'clang' | 'sink' | 'coin' | 'glass' | 'click' | 'bell' | 'creak';

export class Sfx {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem('tsc:mute') === '1'; } catch { /* ignore */ }
    // Browsers only allow sound after the player has interacted with the page.
    const wake = () => { this.init(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
  }

  private init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 0.5;
    this.out.connect(this.ctx.destination);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Returns true when sound is now off. */
  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem('tsc:mute', this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.out.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  private noise(t: number, dur: number, peak: number, type: BiquadFilterType, f0: number, f1: number, q = 1) {
    const c = this.ctx!, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, peak, 0.005, dur);
    src.connect(flt).connect(g).connect(this.out);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  private tone(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine') {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, peak, 0.004, dur);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    switch (name) {
      case 'cannon': this.tone(t, 150, 38, 0.5, 0.9); this.noise(t, 0.45, 0.6, 'lowpass', 2400, 180); break;
      case 'splash': this.noise(t, 0.6, 0.35, 'bandpass', 2600, 500, 0.8); break;
      case 'hit': this.noise(t, 0.55, 0.8, 'lowpass', 3800, 240); this.tone(t, 110, 42, 0.4, 0.6, 'triangle'); this.noise(t + 0.05, 0.25, 0.3, 'highpass', 2400, 5200); break;
      case 'clang': for (const f of [620, 933, 1410, 2190]) this.tone(t, f, f * 0.995, 0.9, 0.16, 'triangle'); this.noise(t, 0.08, 0.4, 'highpass', 3000, 6000); break;
      case 'sink': this.tone(t, 90, 30, 1.8, 0.4, 'sawtooth'); this.noise(t, 2, 0.25, 'lowpass', 900, 120); break;
      case 'coin': this.tone(t, 1760, 1760, 0.18, 0.2); this.tone(t + 0.07, 2637, 2637, 0.3, 0.18); break;
      case 'glass': this.tone(t, 520, 1040, 0.5, 0.12); break;
      case 'click': this.noise(t, 0.04, 0.3, 'bandpass', 1800, 900, 3); this.tone(t, 320, 180, 0.06, 0.2, 'square'); break;
      case 'bell': for (const [f, a] of [[660, 0.3], [1320, 0.14], [1985, 0.08]]) this.tone(t, f, f, 1.6, a); break;
      case 'creak': this.tone(t, 180, 240, 0.35, 0.07, 'sawtooth'); this.noise(t, 0.5, 0.12, 'bandpass', 700, 1500, 2); break;
    }
  }
}
