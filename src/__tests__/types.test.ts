import { describe, it, expect } from 'vitest';
import {
  createDefaultPlayer,
  createDefaultQuest,
  createDefaultWorld,
  xpForLevel,
  MAX_LEVEL,
  MAX_POTIONS,
  POTION_HEAL,
  POTION_COST,
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

  it('defaults to male gender when no argument is provided', () => {
    // The gender field drives sprite selection in the renderer.  If the default
    // were accidentally changed to 'female', new games would use the wrong sprite.
    expect(createDefaultPlayer().gender).toBe('male');
  });

  it('sets gender to "female" when called with the "female" argument', () => {
    // createDefaultPlayer accepts an optional gender parameter that flows into
    // PlayerState.gender.  If the argument were silently ignored, every female
    // character-select would produce a male PlayerState and the renderer would
    // always draw the male sprite regardless of the player's choice.
    expect(createDefaultPlayer('female').gender).toBe('female');
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
  it('SAVE_VERSION is 6', () => expect(SAVE_VERSION).toBe(6));

  it('POTION_HEAL is 20', () => {
    // All player.test.ts potion assertions reference POTION_HEAL as a variable,
    // so a silent change from 20 to any value ≥ 6 would pass those tests while
    // silently rebalancing combat (more or less healing per potion).  This pin
    // ensures any intentional balance change is noticed and reviewed.
    expect(POTION_HEAL).toBe(20);
  });

  it('POTION_COST is 5', () => {
    // The potion shop in npc.ts uses the literal 5, not this constant.
    // Pinning the constant here creates an early-warning if a balance change is
    // made to POTION_COST without updating the shop, or vice versa — the
    // discrepancy would be visible in review even though neither test alone
    // would fail.  It also documents the authoritative price for future callers.
    expect(POTION_COST).toBe(5);
  });

  it('MAX_LEVEL is 10', () => {
    // All progression-cap tests reference MAX_LEVEL as a variable, so changing
    // this from 10 to 8 would silently make levels 9-10 unreachable and the
    // War Halberd reward unearnable — with every existing test still passing.
    // This pin catches that regression at the constant definition.
    expect(MAX_LEVEL).toBe(10);
  });
});
