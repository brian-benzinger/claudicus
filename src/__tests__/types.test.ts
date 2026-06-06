import { describe, it, expect } from 'vitest';
import {
  createDefaultPlayer,
  createDefaultQuest,
  createDefaultWorld,
  xpForLevel,
  MAX_LEVEL,
  MAX_POTIONS,
  TILE_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SAVE_VERSION,
} from '../types';

describe('createDefaultPlayer', () => {
  it('returns valid starting stats', () => {
    const p = createDefaultPlayer();
    expect(p.hp).toBe(40);
    expect(p.maxHp).toBe(40);
    expect(p.str).toBe(5);
    expect(p.def).toBe(3);
    expect(p.agi).toBe(3);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.gold).toBe(10);
    expect(p.potions).toBe(3);
    expect(p.weaponId).toBe('rusty_shortsword');
    expect(p.armorId).toBe('leather_vest');
    expect(p.currentMap).toBe('village');
    expect(p.facing).toBe('down');
    expect(p.classPath).toBeNull();
    expect(p.materials).toEqual({ wolf_pelt: 0, bandit_steel: 0 });
    expect(p.earnedTitles).toEqual([]);
    expect(p.activeTitle).toBeNull();
  });

  it('produces independent objects each call', () => {
    const a = createDefaultPlayer();
    const b = createDefaultPlayer();
    a.gold = 999;
    expect(b.gold).toBe(10);
  });
});

describe('createDefaultQuest', () => {
  it('returns all false/zero state', () => {
    const q = createDefaultQuest();
    expect(q.started).toBe(false);
    expect(q.count).toBe(0);
    expect(q.completed).toBe(false);
    expect(q.rewardClaimed).toBe(false);
  });
});

describe('createDefaultWorld', () => {
  it('returns a fully initialized world state', () => {
    const w = createDefaultWorld();
    expect(w.openedChests).toEqual([]);
    expect(w.defeatedEnemies).toEqual([]);
    expect(w.killCounts).toEqual({ wolf: 0, bandit: 0 });
    expect(w.survivedLowHp).toBe(0);
  });
});

describe('xpForLevel', () => {
  it('scales with level', () => {
    expect(xpForLevel(1)).toBe(25);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(5)).toBe(125);
    expect(xpForLevel(10)).toBe(250);
  });

  it('always increases', () => {
    for (let i = 1; i < MAX_LEVEL; i++) {
      expect(xpForLevel(i + 1)).toBeGreaterThan(xpForLevel(i));
    }
  });
});

describe('constants', () => {
  it('TILE_SIZE is 32', () => expect(TILE_SIZE).toBe(32));
  it('CANVAS_WIDTH is 960', () => expect(CANVAS_WIDTH).toBe(960));
  it('CANVAS_HEIGHT is 640', () => expect(CANVAS_HEIGHT).toBe(640));
  it('MAX_POTIONS is 10', () => expect(MAX_POTIONS).toBe(10));
  it('SAVE_VERSION is defined', () => expect(SAVE_VERSION).toBeGreaterThan(0));
});
