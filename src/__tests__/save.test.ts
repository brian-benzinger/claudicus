import { describe, it, expect, beforeEach, vi } from 'vitest';
import { save, load, hasSave, clearSave, createNewGameData } from '../save';
import {
  createDefaultPlayer,
  createDefaultQuest,
  createDefaultWorld,
  SAVE_VERSION,
} from '../types';

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
  it('round-trips player, quest and world data', () => {
    const player = createDefaultPlayer();
    const quest = createDefaultQuest();
    const world = createDefaultWorld();

    player.gold = 999;
    quest.started = true;
    world.openedChests.push('chest_1');

    save(player, quest, world);
    const data = load();

    expect(data).not.toBeNull();
    expect(data!.player.gold).toBe(999);
    expect(data!.quest.started).toBe(true);
    expect(data!.world.openedChests).toContain('chest_1');
  });

  it('stores the current SAVE_VERSION', () => {
    save(createDefaultPlayer(), createDefaultQuest(), createDefaultWorld());
    const data = load();
    expect(data!.version).toBe(SAVE_VERSION);
  });
});

describe('hasSave', () => {
  it('returns false when nothing is saved', () => {
    expect(hasSave()).toBe(false);
  });

  it('returns true after saving', () => {
    save(createDefaultPlayer(), createDefaultQuest(), createDefaultWorld());
    expect(hasSave()).toBe(true);
  });
});

describe('clearSave', () => {
  it('removes the save so hasSave returns false', () => {
    save(createDefaultPlayer(), createDefaultQuest(), createDefaultWorld());
    clearSave();
    expect(hasSave()).toBe(false);
    expect(load()).toBeNull();
  });
});

describe('load edge cases', () => {
  it('returns null when no save exists', () => {
    expect(load()).toBeNull();
  });

  it('returns null on version mismatch', () => {
    const data = createNewGameData();
    (data as any).version = -1;
    localStorage.setItem('claudicus_save', JSON.stringify(data));
    expect(load()).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    localStorage.setItem('claudicus_save', 'not-json{{{');
    expect(load()).toBeNull();
  });
});

describe('createNewGameData', () => {
  it('returns default values with correct version', () => {
    const data = createNewGameData();
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.player.level).toBe(1);
    expect(data.quest.started).toBe(false);
    expect(data.world.openedChests).toEqual([]);
  });
});
