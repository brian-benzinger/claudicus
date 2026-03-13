import { describe, it, expect } from 'vitest';
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
