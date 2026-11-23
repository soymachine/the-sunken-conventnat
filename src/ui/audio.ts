// The game's sound. Every sound has a name (src/audio/bank.ts); a recording assigned to that name in
// public/sfx/bank.json — or, on this browser only, in the admin page — is played with its trim, gain and fades.
// A few names fall back to a synthesised sound when nothing is assigned; the others, and all music, stay silent.
import { Bank, Channel, Entry, Local, SOUND, SYNTH, localAll, publishedBank } from '../audio/bank';

export type SfxName = 'roar' | 'thunder' | 'cannon' | 'splash' | 'hit' | 'clang' | 'sink' | 'coin' | 'glass' | 'click' | 'bell' | 'creak' | 'gull' | 'treasure' | 'plunge'
  | 'whistle' | 'explosion' | 'mast' | 'slam' | 'cardHover' | 'cardPlay' | 'cardDeal' | 'denied' | 'seal' | 'hourglass' | 'paper';
export type MusicName = 'musicHome' | 'musicBattle' | 'musicTense';
export type Volumes = Record<'master' | Channel, number>;
const VOL0: Volumes = { master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.8, ui: 0.8 };

type Voice = { src: AudioBufferSourceNode; g: GainNode };

export class Sfx {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private ch = {} as Record<Channel, GainNode>;
  private duck!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  vol: Volumes = { ...VOL0 };
  private bank: Bank = {};
  private silent = new Set<string>();
  private buf: Record<string, AudioBuffer> = {};
  private loops: Record<string, { v: Voice | null; want: number }> = {};
  private thunderVoice: GainNode | null = null;
  private music: { id: string; v: Voice } | null = null;
  private musicWanted: string | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem('tsc:mute') === '1';
      Object.assign(this.vol, JSON.parse(localStorage.getItem('tsc:vol') || '{}'));
    } catch { /* ignore */ }
    // Browsers only allow sound after the player has interacted with the page.
    const wake = () => { this.init(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
    // The admin page, open in another tab, says when it changes a sound: take it up at once.
    try { new BroadcastChannel('tsc-sounds').onmessage = () => { if (this.ctx) void this.load(); }; } catch { /* old browser */ }
  }

  private init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain();
    this.out.connect(c.destination);
    this.duck = c.createGain(); this.duck.connect(this.out);
    for (const k of ['sfx', 'ambience', 'music', 'ui'] as Channel[]) { this.ch[k] = c.createGain(); this.ch[k].connect(k === 'music' ? this.duck : this.out); }
    this.applyVolumes();
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    void this.load();
  }

  /** Read the published bank and this browser's own assignments, and decode every recording. */
  private async load() {
    const c = this.ctx!;
    const [pub, local] = await Promise.all([publishedBank(), localAll()]);
    const bank: Bank = { ...pub }, blobs: Record<string, Local> = {};
    this.silent.clear();
    for (const [id, l] of Object.entries(local)) {
      if (l.silent) { this.silent.add(id); delete bank[id]; continue; }
      bank[id] = { ...l, file: l.blob ? `local:${id}` : l.file };
      if (l.blob) blobs[id] = l;
    }
    this.bank = bank;
    const next: Record<string, AudioBuffer> = {};
    await Promise.all(Object.entries(bank).map(async ([id, e]) => {
      if (!e.file) return;
      try {
        const data = blobs[id]?.blob ? await blobs[id].blob!.arrayBuffer() : await (await fetch(`/sfx/${e.file}`)).arrayBuffer();
        next[id] = await c.decodeAudioData(data);
      } catch { /* keep the stand-in */ }
    }));
    this.buf = next;
    // Loops and music already running restart with their new recordings.
    for (const [id, l] of Object.entries(this.loops)) { if (l.v) { this.stopVoice(l.v, 0.3); l.v = null; } this.setLoop(id, l.want); }
    if (this.music) { this.stopVoice(this.music.v, 0.5); this.music = null; }
    this.setMusic(this.musicWanted as MusicName | null);
  }

  /* ---------- volumes ---------- */
  setVolume(k: keyof Volumes, v: number) {
    this.vol[k] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('tsc:vol', JSON.stringify(this.vol)); } catch { /* ignore */ }
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.muted ? 0 : this.vol.master * 0.6, t, 0.03);
    for (const k of Object.keys(this.ch) as Channel[]) this.ch[k].gain.setTargetAtTime(this.vol[k], t, 0.03);
  }
  /** Returns true when sound is now off. */
  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem('tsc:mute', this.muted ? '1' : '0'); } catch { /* ignore */ }
    this.applyVolumes();
    return this.muted;
  }

  /* ---------- recordings ---------- */
  private has(id: string) { return !!this.buf[id] && !this.silent.has(id); }
  /** Start a recording through its channel with its trim, gain and fades. */
  private voice(id: string, opts: { gain?: number; rate?: number; loop?: boolean; fadeIn?: number } = {}): Voice | null {
    const c = this.ctx!, b = this.buf[id], e: Entry | undefined = this.bank[id];
    if (!b || !e || this.silent.has(id)) return null;
    const src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    const start = Math.min(e.start || 0, b.duration - 0.01), end = Math.min(e.end ?? b.duration, b.duration), len = Math.max(0.01, end - start);
    const rate = opts.rate ?? 1, peak = (e.gain ?? 1) * (opts.gain ?? 1), fi = opts.fadeIn ?? e.fadeIn ?? 0, fo = e.fadeOut ?? 0;
    src.buffer = b; src.playbackRate.value = rate;
    g.gain.setValueAtTime(fi > 0 ? 0 : peak, t);
    if (fi > 0) g.gain.linearRampToValueAtTime(peak, t + fi);
    src.connect(g).connect(this.ch[SOUND[id]?.channel ?? 'sfx']);
    if (opts.loop ?? e.loop) {
      src.loop = true; src.loopStart = start; src.loopEnd = end;
      src.start(t, start);
    } else {
      src.start(t, start, len);
      const dur = len / rate;
      if (fo > 0) { g.gain.setValueAtTime(peak, t + Math.max(fi, dur - fo)); g.gain.linearRampToValueAtTime(0, t + dur); }
    }
    return { src, g };
  }
  private stopVoice(v: Voice, fade: number) {
    const t = this.ctx!.currentTime;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + fade);
    try { v.src.stop(t + fade + 0.05); } catch { /* already stopped */ }
  }

  /** A looping sound at a level (0 stops it, fading out); used for the deck, the rain and the wind. */
  setLoop(id: string, level: number) {
    const l = this.loops[id] ??= { v: null, want: 0 };
    l.want = level;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (level > 0 && !l.v) {
      l.v = this.voice(id, { loop: true, gain: level, fadeIn: 3 });
    } else if (level > 0 && l.v) {
      const peak = (this.bank[id]?.gain ?? 1) * level;
      l.v.g.gain.cancelScheduledValues(t); l.v.g.gain.setValueAtTime(l.v.g.gain.value, t); l.v.g.gain.linearRampToValueAtTime(peak, t + 1.5);
    } else if (level <= 0 && l.v) { this.stopVoice(l.v, 2.5); l.v = null; }
  }
  setAmbience(on: boolean) { this.setLoop('deck', on ? 0.5 : 0); }
  setRain(on: boolean) { this.setLoop('rain', on ? 0.5 : 0); }
  /** Wind strength 0..1 (0 in a flat calm). */
  setWind(s: number) { this.setLoop('wind', s > 0 ? 0.25 + 0.75 * s : 0); }

  /** The piece of music for this moment, cross-faded; null for none. Nothing assigned: silence. */
  setMusic(id: MusicName | null) {
    this.musicWanted = id;
    if (!this.ctx) return;
    if (this.music?.id === id) return;
    if (this.music) { this.stopVoice(this.music.v, 2.5); this.music = null; }
    if (!id || !this.has(id)) return;
    const v = this.voice(id, { loop: true, fadeIn: 2.5 });
    if (v) this.music = { id, v };
  }
  /** A short piece played once over everything (victory, defeat); the music stops under it. */
  sting(id: 'stingWin' | 'stingLose') {
    this.setMusic(null);
    if (this.ctx && !this.muted) this.voice(id);
  }
  /** Music steps back for a moment under something loud. */
  private ducking(amount: number, hold: number) {
    const t = this.ctx!.currentTime, g = this.duck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(amount, t + 0.1);
    g.setValueAtTime(amount, t + hold); g.linearRampToValueAtTime(1, t + hold + 1.2);
  }

  /* ---------- synthesised stand-ins ---------- */
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  private noise(dest: AudioNode, t: number, dur: number, peak: number, type: BiquadFilterType, f0: number, f1: number, q = 1) {
    const c = this.ctx!, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, peak, 0.005, dur);
    src.connect(flt).connect(g).connect(dest);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  private tone(dest: AudioNode, t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine') {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, peak, 0.004, dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted || this.silent.has(name)) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime, jitter = (a: number) => 1 - a + Math.random() * 2 * a;
    if (name === 'explosion' || name === 'roar') this.ducking(0.35, 1.5);
    // Recorded sounds first.
    if (name === 'thunder' && this.has('thunder')) {
      // A new clap cuts the long rumble of the last one short, so storms never pile up into a roar.
      const prev = this.thunderVoice;
      if (prev) { prev.gain.cancelScheduledValues(t); prev.gain.setValueAtTime(prev.gain.value, t); prev.gain.linearRampToValueAtTime(0, t + 0.8); }
      this.thunderVoice = this.voice('thunder')?.g ?? null;
      return;
    }
    const rate = { cannon: jitter(0.06), gull: jitter(0.1), plunge: jitter(0.08), hit: jitter(0.05), cardHover: jitter(0.05), click: jitter(0.03), slam: jitter(0.06) } as Record<string, number>;
    if (name === 'splash' && this.has('plunge')) name = 'plunge';
    if (this.has(name)) {
      this.voice(name, { rate: rate[name] });
      // A hit booms under its crackle when the boom itself is not recorded.
      if (name === 'hit') this.tone(this.ch.sfx, t, 110, 42, 0.4, 0.45, 'triangle');
      return;
    }
    if (!SYNTH.has(name)) return;
    const sfx = this.ch.sfx, ui = this.ch.ui;
    if (name === 'treasure') name = 'coin';
    switch (name) {
      case 'cannon': this.tone(sfx, t, 150, 38, 0.5, 0.9); this.noise(sfx, t, 0.45, 0.6, 'lowpass', 2400, 180); break;
      case 'splash': case 'plunge': this.noise(sfx, t, 0.6, 0.35, 'bandpass', 2600, 500, 0.8); break;
      case 'hit': this.noise(sfx, t, 0.55, 0.8, 'lowpass', 3800, 240); this.tone(sfx, t, 110, 42, 0.4, 0.6, 'triangle'); this.noise(sfx, t + 0.05, 0.25, 0.3, 'highpass', 2400, 5200); break;
      case 'clang': for (const f of [620, 933, 1410, 2190]) this.tone(sfx, t, f, f * 0.995, 0.9, 0.16, 'triangle'); this.noise(sfx, t, 0.08, 0.4, 'highpass', 3000, 6000); break;
      case 'sink': this.tone(sfx, t, 90, 30, 1.8, 0.4, 'sawtooth'); this.noise(sfx, t, 2, 0.25, 'lowpass', 900, 120); break;
      case 'coin': this.tone(ui, t, 1760, 1760, 0.18, 0.2); this.tone(ui, t + 0.07, 2637, 2637, 0.3, 0.18); break;
      case 'glass': this.tone(sfx, t, 520, 1040, 0.5, 0.12); break;
      case 'click': this.noise(ui, t, 0.04, 0.3, 'bandpass', 1800, 900, 3); this.tone(ui, t, 320, 180, 0.06, 0.2, 'square'); break;
      case 'bell': for (const [f, a] of [[660, 0.3], [1320, 0.14], [1985, 0.08]]) this.tone(ui, t, f, f, 1.6, a); break;
      case 'roar': this.tone(sfx, t, 70, 38, 2.2, 0.55, 'sawtooth'); this.tone(sfx, t, 104, 55, 2.0, 0.3, 'square'); this.noise(sfx, t, 2.4, 0.4, 'lowpass', 500, 90); break;
      case 'thunder': this.noise(this.ch.ambience, t, 1.8, 0.5, 'lowpass', 900, 70); this.tone(this.ch.ambience, t, 60, 32, 1.2, 0.35); break;
      // The magazine: a deep thump with a long rolling tail, and the crackle of timber thrown into the air.
      case 'explosion':
        this.tone(sfx, t, 58, 24, 2.6, 0.95); this.tone(sfx, t, 90, 35, 0.9, 0.6, 'triangle');
        this.noise(sfx, t, 3.2, 0.9, 'lowpass', 2600, 70); this.noise(sfx, t + 0.02, 0.5, 0.5, 'highpass', 1800, 4200);
        for (let i = 0; i < 7; i++) this.noise(sfx, t + 0.25 + Math.random() * 1.4, 0.05, 0.25, 'bandpass', 2400, 1400, 4);
        break;
      case 'mast': this.noise(sfx, t, 0.35, 0.4, 'bandpass', 2600, 500, 2); this.tone(sfx, t, 160, 60, 0.5, 0.3, 'triangle'); this.noise(sfx, t + 0.05, 0.7, 0.3, 'bandpass', 2600, 500, 0.8); break;
      case 'creak': this.tone(sfx, t, 180, 240, 0.35, 0.07, 'sawtooth'); this.noise(sfx, t, 0.5, 0.12, 'bandpass', 700, 1500, 2); break;
    }
  }
}
