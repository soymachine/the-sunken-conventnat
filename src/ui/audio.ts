// Most sounds are synthesised with Web Audio; a few recorded ones (public/sfx/*.mp3) are loaded once sound wakes up.
export type SfxName = 'roar' | 'thunder' | 'cannon' | 'splash' | 'hit' | 'clang' | 'sink' | 'coin' | 'glass' | 'click' | 'bell' | 'creak' | 'gull' | 'treasure' | 'plunge';
const SAMPLES = { deck: 'boat-deck-at-sea-loop', plunge: 'explosion-underwater', fire: 'fire-crackle-after-blast', rain: 'rain-heavy', thunder: 'thunder', cannon: 'cannon-fire-distant', gull: 'seagull-cry', treasure: 'treasure-reveal' } as const;
type Sample = keyof typeof SAMPLES;

export class Sfx {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  private buf: Partial<Record<Sample, AudioBuffer>> = {};
  private rainVoice: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private rainWanted = false;
  private deckVoice: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private deckWanted = false;
  private thunderVoice: GainNode | null = null;

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
    for (const [k, f] of Object.entries(SAMPLES) as [Sample, string][]) {
      void fetch(`/sfx/${f}.mp3`).then((r) => r.arrayBuffer()).then((a) => this.ctx!.decodeAudioData(a)).then((b) => {
        this.buf[k] = b;
        if (k === 'rain' && this.rainWanted) this.setRain(true);
        if (k === 'deck' && this.deckWanted) this.setAmbience(true);
      }).catch(() => { /* fall back to the synthesised sound */ });
    }
  }

  /** Play a recorded sound; false when it has not loaded (yet). */
  private sample(k: Sample, gain: number, opts: { fadeOutAt?: number; rate?: number } = {}): GainNode | null {
    const c = this.ctx!, b = this.buf[k];
    if (!b) return null;
    const src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    src.buffer = b; src.playbackRate.value = opts.rate ?? 1;
    g.gain.value = gain;
    if (opts.fadeOutAt) { g.gain.setValueAtTime(gain, t + opts.fadeOutAt); g.gain.linearRampToValueAtTime(0, t + opts.fadeOutAt + 2.5); src.stop(t + opts.fadeOutAt + 2.6); }
    src.connect(g).connect(this.out);
    src.start(t);
    return g;
  }

  /** A loop that fades in and out: the deck at sea under the whole battle. */
  setAmbience(on: boolean) {
    this.deckWanted = on;
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this.deckVoice && this.buf.deck) {
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = this.buf.deck; src.loop = true;
      // Skip the MP3's padding at both ends so the loop has no gap.
      src.loopStart = 0.06; src.loopEnd = this.buf.deck.duration - 0.06;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 3);
      src.connect(g).connect(this.out); src.start(t, 0.06);
      this.deckVoice = { src, g };
    } else if (!on && this.deckVoice) {
      const v = this.deckVoice; this.deckVoice = null;
      v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + 2);
      v.src.stop(t + 2.1);
    }
  }

  /** Heavy rain: fades in and loops while a storm is over the charts, fades out when it clears. */
  setRain(on: boolean) {
    this.rainWanted = on;
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this.rainVoice && this.buf.rain) {
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = this.buf.rain; src.loop = true;
      // The recording fades away in its last half second: loop inside it so the seam is not heard.
      src.loopStart = 0.2; src.loopEnd = this.buf.rain.duration - 0.6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75, t + 4);
      src.connect(g).connect(this.out); src.start(t, 0.2);
      this.rainVoice = { src, g };
    } else if (!on && this.rainVoice) {
      const v = this.rainVoice; this.rainVoice = null;
      v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + 3);
      v.src.stop(t + 3.1);
    }
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
    // Recorded sounds first, with the synthesised ones as a fallback until they load.
    if (name === 'thunder' && this.buf.thunder) {
      // A new clap cuts the long rumble of the last one short, so storms never pile up into a roar.
      const prev = this.thunderVoice;
      if (prev) { prev.gain.cancelScheduledValues(t); prev.gain.setValueAtTime(prev.gain.value, t); prev.gain.linearRampToValueAtTime(0, t + 0.8); }
      this.thunderVoice = this.sample('thunder', 0.9, { fadeOutAt: 6 });
      return;
    }
    if (name === 'cannon' && this.sample('cannon', 0.85, { rate: 0.94 + Math.random() * 0.12 })) return;
    if (name === 'gull') { this.sample('gull', 0.35, { rate: 0.9 + Math.random() * 0.2 }); return; }
    if (name === 'treasure' && this.sample('treasure', 0.8)) return;
    // A ball that falls in the sea bursts under the water; one that strikes a ship booms and leaves her burning.
    if (name === 'plunge') { if (this.sample('plunge', 0.9, { rate: 0.92 + Math.random() * 0.16 })) return; name = 'splash'; }
    if (name === 'hit' && this.sample('fire', 0.55, { rate: 0.95 + Math.random() * 0.1 })) { this.tone(t, 110, 42, 0.4, 0.45, 'triangle'); return; }
    if (name === 'treasure') name = 'coin';
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
      case 'roar': this.tone(t, 70, 38, 2.2, 0.55, 'sawtooth'); this.tone(t, 104, 55, 2.0, 0.3, 'square'); this.noise(t, 2.4, 0.4, 'lowpass', 500, 90); break;
      case 'thunder': this.noise(t, 1.8, 0.5, 'lowpass', 900, 70); this.tone(t, 60, 32, 1.2, 0.35); break;
      case 'creak': this.tone(t, 180, 240, 0.35, 0.07, 'sawtooth'); this.noise(t, 0.5, 0.12, 'bandpass', 700, 1500, 2); break;
    }
  }
}
