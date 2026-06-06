import { describe, it, expect, beforeEach, vi } from 'vitest';
import { save, load, hasSave, clearSave, createNewGameData } from '../save';
import {
  createDefaultPlayer,
  createDefaultWorld,
  SAVE_VERSION,
} from '../types';
import { createDefaultQuests } from '../data/quests';

// Mock localStorage since jsdom's implementation may vary
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
});

describe('save and load', () => {
  it('round-trips player, quests and world data', () => {
    const player = createDefaultPlayer();
    const quests = createDefaultQuests();
    const world = createDefaultWorld();

    player.gold = 999;
    quests['forest_menace'].started = true;
    world.openedChests.push('chest_1');

    save(player, quests, world);
    const data = load();

    expect(data).not.toBeNull();
    expect(data!.player.gold).toBe(999);
    expect(data!.quests['forest_menace'].started).toBe(true);
    expect(data!.world.openedChests).toContain('chest_1');
  });

  it('stores the current SAVE_VERSION', () => {
    save(createDefaultPlayer(), createDefaultQuests(), createDefaultWorld());
    const data = load();
    expect(data!.version).toBe(SAVE_VERSION);
  });
});

describe('hasSave', () => {
  it('returns false when nothing is saved', () => {
    expect(hasSave()).toBe(false);
  });

  it('returns true after saving', () => {
    save(createDefaultPlayer(), createDefaultQuests(), createDefaultWorld());
    expect(hasSave()).toBe(true);
  });
});

describe('clearSave', () => {
  it('removes the save so hasSave returns false', () => {
    save(createDefaultPlayer(), createDefaultQuests(), createDefaultWorld());
    clearSave();
    expect(hasSave()).toBe(false);
    expect(load()).toBeNull();
  });
});

describe('load edge cases', () => {
  it('returns null when no save exists', () => {
    expect(load()).toBeNull();
  });

  it('returns null on version mismatch for unknown old version', () => {
    const data = createNewGameData();
    (data as any).version = -1;
    localStorage.setItem('claudicus_save', JSON.stringify(data));
    expect(load()).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    localStorage.setItem('claudicus_save', 'not-json{{{');
    expect(load()).toBeNull();
  });

  it('migrates v4 save to current version by backfilling classPath', () => {
    const data = createNewGameData();
    // Simulate a v4 save: no classPath field
    const v4player = { ...data.player };
    delete (v4player as any).classPath;
    const v4save = { ...data, player: v4player, version: 4 };
    localStorage.setItem('claudicus_save', JSON.stringify(v4save));

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.classPath).toBeNull();
  });

  it('migrates a true v4 save through both migration steps (v4 → v5 → v6)', () => {
    // A real v4 save lacks ALL post-v4 fields (classPath, materials, earnedTitles,
    // activeTitle, world kill tracking).  The chained if-blocks in load() must apply
    // both the v4→v5 and v5→v6 migrations sequentially on the same data object.
    const data = createNewGameData();
    const v4player = { ...data.player };
    delete (v4player as any).classPath;
    delete (v4player as any).materials;
    delete (v4player as any).earnedTitles;
    delete (v4player as any).activeTitle;
    const v4world = { ...data.world };
    delete (v4world as any).killCounts;
    delete (v4world as any).survivedLowHp;
    localStorage.setItem('claudicus_save', JSON.stringify({ ...data, player: v4player, world: v4world, version: 4 }));

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    // v4 → v5: classPath backfilled
    expect(loaded!.player.classPath).toBeNull();
    // v5 → v6: all new fields backfilled in the same migration pass
    expect(loaded!.player.materials).toEqual({ wolf_pelt: 0, bandit_steel: 0 });
    expect(loaded!.player.earnedTitles).toEqual([]);
    expect(loaded!.player.activeTitle).toBeNull();
    expect(loaded!.world.killCounts).toEqual({ wolf: 0, bandit: 0 });
    expect(loaded!.world.survivedLowHp).toBe(0);
  });

  it('migrates v5 save to current version by backfilling materials and title fields', () => {
    const data = createNewGameData();
    // Simulate v5 save: no materials/earnedTitles/activeTitle, no world kill tracking
    const v5player = { ...data.player };
    delete (v5player as any).materials;
    delete (v5player as any).earnedTitles;
    delete (v5player as any).activeTitle;
    const v5world = { ...data.world };
    delete (v5world as any).killCounts;
    delete (v5world as any).survivedLowHp;
    const v5save = { ...data, player: v5player, world: v5world, version: 5 };
    localStorage.setItem('claudicus_save', JSON.stringify(v5save));

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.materials).toEqual({ wolf_pelt: 0, bandit_steel: 0 });
    expect(loaded!.player.earnedTitles).toEqual([]);
    expect(loaded!.player.activeTitle).toBeNull();
    expect(loaded!.world.killCounts).toEqual({ wolf: 0, bandit: 0 });
    expect(loaded!.world.survivedLowHp).toBe(0);
  });
});

describe('createNewGameData', () => {
  it('returns default values with correct version', () => {
    const data = createNewGameData();
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.player.level).toBe(1);
    expect(data.quests['forest_menace'].started).toBe(false);
    expect(data.world.openedChests).toEqual([]);
  });

  it('initialises all six quests', () => {
    const data = createNewGameData();
    expect(Object.keys(data.quests)).toHaveLength(6);
    for (const q of Object.values(data.quests)) {
      expect(q.started).toBe(false);
      expect(q.count).toBe(0);
    }
  });
});

describe('save error handling', () => {
  it('swallows and logs errors thrown by localStorage.setItem', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      save(createDefaultPlayer(), createDefaultQuests(), createDefaultWorld())
    ).not.toThrow();
    expect(errSpy).toHaveBeenCalledWith('Failed to save game:', expect.any(Error));
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
