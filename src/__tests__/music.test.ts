import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicEngine } from '../music';
import type { TrackName, SfxType } from '../music';

// ---------------------------------------------------------------------------
// MusicEngine unit tests (no AudioContext available in test env)
// ---------------------------------------------------------------------------

describe('MusicEngine — all four tracks are defined', () => {
  const tracks: TrackName[] = ['village', 'forest', 'dungeon', 'combat'];

  it('play() does not change currentTrack when AudioContext is absent', () => {
    const engine = new MusicEngine();
    // Without AudioContext the guard `if (!this.ctx || !this.master) return` fires,
    // so currentTrackName must never be updated.
    for (const track of tracks) {
      engine.play(track);
      expect(engine.currentTrack).toBe('');
    }
  });

  it('currentTrack is empty before init()', () => {
    const engine = new MusicEngine();
    expect(engine.currentTrack).toBe('');
  });

  it('isMuted is false by default', () => {
    const engine = new MusicEngine();
    expect(engine.isMuted).toBe(false);
  });

  it('stop() resets currentTrack to empty string', () => {
    const engine = new MusicEngine();
    // Simulate a state where a track name was set without a real AudioContext
    (engine as any).currentTrackName = 'village';
    engine.stop();
    expect(engine.currentTrack).toBe('');
  });

  it('toggleMute() returns the current muted state unchanged when master is absent', () => {
    const engine = new MusicEngine();
    // Without AudioContext master is null — toggleMute returns this.muted without toggling it
    const first  = engine.toggleMute();
    const second = engine.toggleMute();
    expect(first).toBe(false);   // default muted = false, no toggle without master
    expect(second).toBe(false);  // still false — early return skips the toggle
    expect(engine.isMuted).toBe(false);
  });
});

describe('MusicEngine — track name type coverage', () => {
  it('play("dungeon") does not change currentTrack when AudioContext is absent', () => {
    const engine = new MusicEngine();
    engine.play('dungeon');
    expect(engine.currentTrack).toBe('');
  });

  it('play("combat") does not change currentTrack when AudioContext is absent', () => {
    const engine = new MusicEngine();
    engine.play('combat');
    expect(engine.currentTrack).toBe('');
  });
});

describe('MusicEngine — playSfx', () => {
  it('playSfx is a no-op when AudioContext is not initialized: engine state unchanged', () => {
    const sfx: SfxType[] = ['levelup', 'quest_complete', 'death', 'chest'];
    const engine = new MusicEngine();
    for (const type of sfx) {
      engine.playSfx(type);
    }
    // Guard `if (!this.ctx || !this.master) return` must fire for every SFX type;
    // no oscillators are created and the engine's observable state is untouched.
    expect(engine.currentTrack).toBe('');
    expect(engine.isMuted).toBe(false);
  });
});

describe('MusicEngine — private guard branches without AudioContext', () => {
  it('tick() does not advance stepIndex when ctx is null', () => {
    const engine = new MusicEngine();
    // ctx is null; tick() must hit its `if (!this.ctx) return` guard and
    // leave stepIndex at 0 — no notes scheduled, no state mutation.
    (engine as any).tick();
    expect((engine as any).stepIndex).toBe(0);
  });

  it('playNote() returns early without throwing when ctx is null', () => {
    const engine = new MusicEngine();
    expect(() => (engine as any).playNote(440, 0, 0.1, 'square', 0.5)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Deep tests with a mocked Web Audio API (jsdom has no AudioContext).
// These exercise init/play/tick/scheduleStep/playNote/playSfx/toggleMute.
// ---------------------------------------------------------------------------

// A controllable clock shared between the mock context and the tests.
let mockTime = 0;

class MockAudioParam {
  value = 0;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
}

class MockGainNode {
  gain = new MockAudioParam();
  connections: unknown[] = [];
  connect(target: unknown) { this.connections.push(target); }
}

class MockOscillator {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  started = false;
  stopped = false;
  connect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockAudioContext {
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  resumed = 0;
  gainNodes: MockGainNode[] = [];
  oscillators: MockOscillator[] = [];

  get currentTime() { return mockTime; }

  createGain() {
    const g = new MockGainNode();
    this.gainNodes.push(g);
    return g as unknown as GainNode;
  }

  createOscillator() {
    const o = new MockOscillator();
    this.oscillators.push(o);
    return o as unknown as OscillatorNode;
  }

  resume() { this.resumed++; this.state = 'running'; }
}

describe('MusicEngine — with mocked AudioContext', () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    mockTime = 0;
    originalAudioContext = (globalThis as any).AudioContext;
    (globalThis as any).AudioContext = MockAudioContext;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as any).AudioContext = originalAudioContext;
  });

  it('init() creates a context and master gain', () => {
    const engine = new MusicEngine();
    engine.init();
    // Calling play now actually schedules
    expect(() => engine.play('village')).not.toThrow();
  });

  it('init() called twice does not recreate the context, and resumes if suspended', () => {
    const engine = new MusicEngine();
    engine.init();
    // Reach into the private ctx to flip it to suspended
    const ctx = (engine as any).ctx as MockAudioContext;
    ctx.state = 'suspended';
    engine.init();
    expect(ctx.resumed).toBe(1);
  });

  it('init() called twice on a running context does not call resume', () => {
    const engine = new MusicEngine();
    engine.init();
    const ctx = (engine as any).ctx as MockAudioContext;
    expect(ctx.state).toBe('running');
    // Second init() with running context: enters the if(this.ctx) branch but
    // skips the if(state==='suspended') inner branch and just returns.
    engine.init();
    expect(ctx.resumed).toBe(0);
  });

  it('play() sets the current track and schedules notes on tick', () => {
    const engine = new MusicEngine();
    engine.init();
    engine.play('village');
    expect(engine.currentTrack).toBe('village');

    // Advance the mock clock well past one full bar, then fire the scheduler.
    mockTime = 10;
    vi.advanceTimersByTime(40);

    const ctx = (engine as any).ctx as MockAudioContext;
    // Exact count: stepDur=60/108/2≈0.2778s, lookahead window [0.05, 10.15) yields 37 steps
    // (2 full 16-step cycles = 58 osc, + 5 partial steps i=0–4 = 10 osc → 68 total).
    // `toBeGreaterThan(10)` would pass even if a voice layer (bass/harmony) were silently dropped.
    expect(ctx.oscillators.length).toBe(68);
    expect(ctx.oscillators.every(o => o.started && o.stopped)).toBe(true);
  });

  it('play() with the same track twice is a no-op the second time', () => {
    const engine = new MusicEngine();
    engine.init();
    engine.play('forest');
    const spy = vi.spyOn(window, 'setInterval');
    engine.play('forest'); // same track -> early return, no new interval
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('play() switches currentTrack to each track in sequence', () => {
    // The original test only asserted the *last* track after the loop. If play()
    // silently failed for 'village', 'forest', or 'dungeon' (e.g., due to an
    // early-return guard), currentTrack would be wrong mid-loop while the final
    // 'combat' assertion still passed.  Pin each transition individually.
    const engine = new MusicEngine();
    engine.init();
    for (const track of ['village', 'forest', 'dungeon', 'combat'] as TrackName[]) {
      engine.play(track);
      expect(engine.currentTrack).toBe(track);
      mockTime += 10;
      vi.advanceTimersByTime(40);
    }
  });

  it('stop() clears the scheduler and resets the track name', () => {
    const engine = new MusicEngine();
    engine.init();
    engine.play('village');
    engine.stop();
    expect(engine.currentTrack).toBe('');
  });

  it('toggleMute() flips muted state and ramps gain when master exists', () => {
    const engine = new MusicEngine();
    engine.init();
    expect(engine.isMuted).toBe(false);
    expect(engine.toggleMute()).toBe(true);
    expect(engine.isMuted).toBe(true);
    expect(engine.toggleMute()).toBe(false);
    expect(engine.isMuted).toBe(false);
  });

  it('playSfx schedules oscillators for every SFX type', () => {
    // Exact playNote call counts from music.ts — one oscillator per note.
    const EXPECTED: Record<SfxType, number> = {
      levelup:        5,  // C4 E4 G4 C5 G3
      quest_complete: 6,  // G4 G4 G4 D5 G3 B3
      death:          5,  // A4 G4 F4 D4 A2
      chest:          3,  // E5 G4 C5
    };
    for (const [type, count] of Object.entries(EXPECTED) as [SfxType, number][]) {
      const engine = new MusicEngine();
      engine.init();
      engine.playSfx(type);
      const ctx = (engine as any).ctx as MockAudioContext;
      expect(ctx.oscillators.length, `'${type}' SFX should schedule ${count} oscillators`).toBe(count);
    }
  });

  it('toggleMute() uses 0 for currentTime when ctx is null but master exists', () => {
    const engine = new MusicEngine();
    engine.init();
    // Force ctx to null while keeping master intact — exercises the `?? 0` branch
    // in `(this.ctx?.currentTime ?? 0) + 0.05`.
    (engine as any).ctx = null;
    // Should still toggle and not throw
    expect(engine.toggleMute()).toBe(true);
    expect(engine.isMuted).toBe(true);
    expect(engine.toggleMute()).toBe(false);
    expect(engine.isMuted).toBe(false);
  });

  it('tick() returns early without throwing when currentTrackName is not a valid song', () => {
    const engine = new MusicEngine();
    engine.init();
    // Bypass play() to put engine in a state where ctx exists but track is unknown
    (engine as any).currentTrackName = 'not_a_real_track';
    (engine as any).nextStepTime = 0;
    expect(() => (engine as any).tick()).not.toThrow();
    // No oscillators should have been scheduled
    const ctx = (engine as any).ctx as MockAudioContext;
    expect(ctx.oscillators.length).toBe(0);
  });
});
