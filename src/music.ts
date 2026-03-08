// Web Audio API synthesizer — chiptune-style RPG music

// Note frequencies in Hz
const _ = null; // rest
const HZ = {
  A2: 110.00,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

type Pitch = number | null;

interface Song {
  bpm: number;
  steps: number;
  melody:  Pitch[];
  bass:    Pitch[];
  harmony: Pitch[];
}

// Village — G Major, BPM 108, peaceful folk feel
const VILLAGE: Song = {
  bpm: 108,
  steps: 16,
  //        1          2          3         4          5          6          7          8
  melody:  [HZ.G4,    HZ.B4,    HZ.D5,    _,         HZ.B4,    HZ.A4,    HZ.G4,    _,
  //        9          10         11         12         13         14         15         16
            HZ.A4,    HZ.B4,    HZ.D5,    HZ.E5,    HZ.D5,    _,         HZ.B4,    HZ.G4],
  bass:    [HZ.G3,    _,         HZ.G3,    _,         HZ.D3,    _,         HZ.D3,    _,
            HZ.C3,    _,         HZ.C3,    _,         HZ.D3,    _,         HZ.D3,    _],
  harmony: [HZ.D4,    _,         HZ.D4,    _,         HZ.A3,    _,         HZ.A3,    _,
            HZ.G3,    _,         HZ.G3,    _,         HZ.A3,    _,         HZ.A3,    _],
};

// Forest — A Minor, BPM 80, tense and mysterious
const FOREST: Song = {
  bpm: 80,
  steps: 16,
  //        1          2          3          4          5          6          7          8
  melody:  [HZ.A4,    _,         HZ.C5,    HZ.B4,    HZ.A4,    _,         HZ.G4,    HZ.F4,
  //        9          10         11         12         13         14         15         16
            HZ.E4,    _,         HZ.F4,    _,         HZ.G4,    HZ.A4,    HZ.Bb4,   _],
  bass:    [HZ.A2,    _,         _,         _,         HZ.E3,    _,         _,         _,
            HZ.F3,    _,         _,         _,         HZ.E3,    _,         _,         _],
  harmony: [HZ.E4,    _,         _,         _,         HZ.B3,    _,         _,         _,
            HZ.C4,    _,         _,         _,         HZ.B3,    _,         _,         _],
};

const SONGS: Record<string, Song> = { village: VILLAGE, forest: FOREST };

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private currentTrackName = '';

  private stepIndex = 0;
  private nextStepTime = 0;
  private timerId = 0;

  private readonly LOOKAHEAD = 0.15; // seconds to schedule ahead
  private readonly TICK_MS   = 40;   // scheduler poll interval

  // Must be called after a user gesture (browser policy)
  init(): void {
    if (this.ctx) {
      // Resume if suspended (e.g. browser auto-suspended it)
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.ctx    = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  play(trackName: 'village' | 'forest'): void {
    if (!this.ctx || !this.master) return;
    if (trackName === this.currentTrackName) return; // already playing

    this.stopScheduler();
    this.currentTrackName = trackName;
    this.stepIndex        = 0;
    this.nextStepTime     = this.ctx.currentTime + 0.05;
    this.timerId          = window.setInterval(() => this.tick(), this.TICK_MS);
  }

  stop(): void {
    this.stopScheduler();
    this.currentTrackName = '';
  }

  toggleMute(): boolean {
    if (!this.master) return this.muted;
    this.muted = !this.muted;
    // Smooth gain change to avoid clicks
    this.master.gain.linearRampToValueAtTime(
      this.muted ? 0 : 0.18,
      (this.ctx?.currentTime ?? 0) + 0.05
    );
    return this.muted;
  }

  get isMuted(): boolean { return this.muted; }

  private stopScheduler(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = 0;
    }
  }

  private tick(): void {
    if (!this.ctx) return;
    const song = SONGS[this.currentTrackName];
    if (!song) return;

    const stepDur = 60 / song.bpm / 2; // eighth-note duration in seconds

    while (this.nextStepTime < this.ctx.currentTime + this.LOOKAHEAD) {
      const i = this.stepIndex % song.steps;
      this.scheduleStep(song, i, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.stepIndex++;
    }
  }

  private scheduleStep(song: Song, i: number, t: number, dur: number): void {
    if (song.melody[i]  !== null) this.playNote(song.melody[i]!,  t, dur * 0.80, 'square',   0.15);
    if (song.bass[i]    !== null) this.playNote(song.bass[i]!,    t, dur * 1.90, 'triangle', 0.22);
    if (song.harmony[i] !== null) this.playNote(song.harmony[i]!, t, dur * 1.90, 'triangle', 0.07);
  }

  private playNote(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.ctx || !this.master) return;

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    const attack  = 0.008;
    const release = Math.min(0.06, duration * 0.15);
    const endTime = startTime + duration;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.setValueAtTime(volume, endTime - release);
    gain.gain.linearRampToValueAtTime(0, endTime);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(startTime);
    osc.stop(endTime);
  }
}
