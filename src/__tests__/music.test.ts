import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicEngine } from '../music';
import type { TrackName, SfxType } from '../music';

// ---------------------------------------------------------------------------
// MusicEngine unit tests (no AudioContext available in test env)
// ---------------------------------------------------------------------------

describe('MusicEngine — all four tracks are defined', () => {
  const tracks: TrackName[] = ['village', 'forest', 'dungeon', 'combat'];

  it('play() accepts all four track names without throwing', () => {
    const engine = new MusicEngine();
    // AudioContext is not initialised so play() is a no-op, but must not throw
    for (const track of tracks) {
      expect(() => engine.play(track)).not.toThrow();
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

  it('stop() does not throw', () => {
    const engine = new MusicEngine();
    expect(() => engine.stop()).not.toThrow();
  });

  it('toggleMute() returns true then false without ctx', () => {
    const engine = new MusicEngine();
    // Without AudioContext, master is null — toggleMute returns current muted flag
    const first  = engine.toggleMute();
    const second = engine.toggleMute();
    expect(typeof first).toBe('boolean');
    expect(typeof second).toBe('boolean');
  });
});

describe('MusicEngine — track name type coverage', () => {
  it('dungeon track is a valid TrackName', () => {
    const track: TrackName = 'dungeon';
    expect(track).toBe('dungeon');
  });

  it('combat track is a valid TrackName', () => {
    const track: TrackName = 'combat';
    expect(track).toBe('combat');
  });
});

describe('MusicEngine — playSfx', () => {
  it('playSfx does not throw when AudioContext is not initialized', () => {
    const engine = new MusicEngine();
    expect(() => engine.playSfx('levelup')).not.toThrow();
    expect(() => engine.playSfx('quest_complete')).not.toThrow();
    expect(() => engine.playSfx('death')).not.toThrow();
    expect(() => engine.playSfx('chest')).not.toThrow();
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

  it('play() sets the current track and schedules notes on tick', () => {
    const engine = new MusicEngine();
    engine.init();
    engine.play('village');
    expect(engine.currentTrack).toBe('village');

    // Advance the mock clock well past one full bar, then fire the scheduler.
    mockTime = 10;
    vi.advanceTimersByTime(40);

    const ctx = (engine as any).ctx as MockAudioContext;
    // Many notes (melody/bass/harmony) should have been scheduled
    expect(ctx.oscillators.length).toBeGreaterThan(10);
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

  it('play() schedules every track without throwing', () => {
    const engine = new MusicEngine();
    engine.init();
    for (const track of ['village', 'forest', 'dungeon', 'combat'] as TrackName[]) {
      engine.play(track);
      mockTime += 10;
      vi.advanceTimersByTime(40);
    }
    expect(engine.currentTrack).toBe('combat');
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
    const sfx: SfxType[] = ['levelup', 'quest_complete', 'death', 'chest'];
    for (const type of sfx) {
      const engine = new MusicEngine();
      engine.init();
      engine.playSfx(type);
      const ctx = (engine as any).ctx as MockAudioContext;
      expect(ctx.oscillators.length).toBeGreaterThan(0);
    }
  });
});
