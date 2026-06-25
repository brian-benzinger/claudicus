import { describe, it, expect } from 'vitest';
import { QUESTS, MAIN_QUEST, createDefaultQuests } from '../data/quests';
import { EnemyType } from '../types';
import { getWeapon } from '../data/weapons';

// ---------------------------------------------------------------------------
// QUESTS data — pin exact behavioral contracts for all six quest definitions.
//
// These tests intentionally use hard-coded literal values (not dynamic reads
// from the same constant) so that a silent change to quests.ts is caught
// immediately.  The pattern mirrors enemies.test.ts and armors.test.ts.
// ---------------------------------------------------------------------------

describe('QUESTS — exact contract table for all six quests', () => {
  it('defines exactly six quests', () => {
    expect(Object.keys(QUESTS)).toHaveLength(6);
  });

  it('forest_menace: kill_any, goalCount=5, rewardGold=50, rewardWeaponId=iron_longsword', () => {
    const q = QUESTS.forest_menace;
    expect(q.id).toBe('forest_menace');
    expect(q.name).toBe('The Forest Menace');
    expect(q.npcId).toBe('elder_aldric');
    expect(q.npcName).toBe('Elder Aldric');
    expect(q.description).toBe('Defeat 5 enemies in Thornwood');
    expect(q.goalType).toBe('kill_any');
    expect(q.goalCount).toBe(5);
    expect(q.goalEnemyTypes).toBeUndefined();
    expect(q.rewardGold).toBe(50);
    expect(q.rewardWeaponId).toBe('iron_longsword');
    expect(q.rewardPotions).toBeUndefined();
  });

  it('bandit_steel: kill_type [BANDIT,BANDIT_ARCHER], goalCount=3, rewardGold=30, rewardWeaponId=hand_axe', () => {
    const q = QUESTS.bandit_steel;
    expect(q.id).toBe('bandit_steel');
    expect(q.name).toBe('Bandit Steel');
    expect(q.npcId).toBe('gretta_smith');
    expect(q.npcName).toBe('Gretta the Smith');
    expect(q.description).toBe('Clear 3 bandits from Thornwood');
    expect(q.goalType).toBe('kill_type');
    expect(q.goalCount).toBe(3);
    expect(q.goalEnemyTypes).toEqual([EnemyType.BANDIT, EnemyType.BANDIT_ARCHER]);
    expect(q.rewardGold).toBe(30);
    expect(q.rewardWeaponId).toBe('hand_axe');
    expect(q.rewardPotions).toBeUndefined();
  });

  it('boar_problem: kill_type [WILD_BOAR], goalCount=2, rewardGold=25, rewardPotions=3', () => {
    const q = QUESTS.boar_problem;
    expect(q.id).toBe('boar_problem');
    expect(q.name).toBe('The Boar Problem');
    expect(q.npcId).toBe('old_marta');
    expect(q.npcName).toBe('Old Marta');
    expect(q.description).toBe('Slay 2 wild boars in Thornwood');
    expect(q.goalType).toBe('kill_type');
    expect(q.goalCount).toBe(2);
    expect(q.goalEnemyTypes).toEqual([EnemyType.WILD_BOAR]);
    expect(q.rewardGold).toBe(25);
    expect(q.rewardPotions).toBe(3);
    expect(q.rewardWeaponId).toBeUndefined();
  });

  it('quiet_dead: kill_type [SKELETON], goalCount=2, rewardGold=40, no weapon/potion reward', () => {
    const q = QUESTS.quiet_dead;
    expect(q.id).toBe('quiet_dead');
    expect(q.name).toBe('Silence the Unquiet Dead');
    expect(q.npcId).toBe('brother_tomas');
    expect(q.npcName).toBe('Brother Tomas');
    expect(q.description).toBe('Put 2 skeletons to rest in the chapel ruins');
    expect(q.goalType).toBe('kill_type');
    expect(q.goalCount).toBe(2);
    expect(q.goalEnemyTypes).toEqual([EnemyType.SKELETON]);
    expect(q.rewardGold).toBe(40);
    expect(q.rewardWeaponId).toBeUndefined();
    expect(q.rewardPotions).toBeUndefined();
  });

  it('wolves_gate: kill_type [WOLF], goalCount=3, rewardGold=20, rewardWeaponId=dagger', () => {
    const q = QUESTS.wolves_gate;
    expect(q.id).toBe('wolves_gate');
    expect(q.name).toBe('Wolves at the Gate');
    expect(q.npcId).toBe('farmer_wulf');
    expect(q.npcName).toBe('Farmer Wulf');
    expect(q.description).toBe('Slay 3 wolves in Thornwood');
    expect(q.goalType).toBe('kill_type');
    expect(q.goalCount).toBe(3);
    expect(q.goalEnemyTypes).toEqual([EnemyType.WOLF]);
    expect(q.rewardGold).toBe(20);
    expect(q.rewardWeaponId).toBe('dagger');
    expect(q.rewardPotions).toBeUndefined();
  });

  it('revenant_threat: kill_type [REVENANT_KNIGHT], goalCount=1, rewardGold=30, rewardPotions=2', () => {
    const q = QUESTS.revenant_threat;
    expect(q.id).toBe('revenant_threat');
    expect(q.name).toBe('The Revenant Threat');
    expect(q.npcId).toBe('duvain_wanderer');
    expect(q.npcName).toBe('Duvain the Wanderer');
    expect(q.description).toBe('Defeat the Revenant Knight in Greymoor Crypt');
    expect(q.goalType).toBe('kill_type');
    expect(q.goalCount).toBe(1);
    expect(q.goalEnemyTypes).toEqual([EnemyType.REVENANT_KNIGHT]);
    expect(q.rewardGold).toBe(30);
    expect(q.rewardPotions).toBe(2);
    expect(q.rewardWeaponId).toBeUndefined();
  });
});

describe('QUESTS — NPC wiring', () => {
  // npcId, npcName, and description are pinned to exact literals in the per-quest
  // contract blocks above. These structural checks verify the wiring still holds
  // across all quests if new quests are ever added without matching contract tests.
  it('every quest has a non-empty npcId and npcName', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      expect(q.npcId, `${id}.npcId`).toBeTruthy();
      expect(q.npcName, `${id}.npcName`).toBeTruthy();
    }
  });

  it('each quest has a non-empty description', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      expect(q.description, `${id}.description`).toBeTruthy();
    }
  });
});

describe('QUESTS — reward cross-reference integrity', () => {
  it('every rewardWeaponId maps to a real weapon (not the rusty_shortsword fallback)', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.rewardWeaponId) {
        const w = getWeapon(q.rewardWeaponId);
        expect(
          w.id,
          `Quest "${id}" rewardWeaponId "${q.rewardWeaponId}" falls back to rusty_shortsword — weapon is missing`
        ).toBe(q.rewardWeaponId);
      }
    }
  });

  it('every kill_type quest lists the exact expected enemy types', () => {
    // Pin exact goalEnemyTypes counts: a silent addition or removal of a type is caught.
    const KILL_TYPE_ENEMY_COUNTS: Record<string, number> = {
      bandit_steel:    2,
      boar_problem:    1,
      quiet_dead:      1,
      wolves_gate:     1,
      revenant_threat: 1,
    };
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.goalType === 'kill_type') {
        expect(
          q.goalEnemyTypes?.length,
          `Quest "${id}" goalEnemyTypes count`
        ).toBe(KILL_TYPE_ENEMY_COUNTS[id]);
      }
    }
  });

  it('kill_any quests have no goalEnemyTypes', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.goalType === 'kill_any') {
        expect(q.goalEnemyTypes, `Quest "${id}" is kill_any but lists enemy types`).toBeUndefined();
      }
    }
  });
});

describe('MAIN_QUEST alias', () => {
  it('is an alias for forest_menace', () => {
    expect(MAIN_QUEST).toBe(QUESTS.forest_menace);
  });
});

describe('createDefaultQuests', () => {
  it('creates one entry per quest, all in the initial uncompleted state', () => {
    const state = createDefaultQuests();
    expect(Object.keys(state)).toHaveLength(Object.keys(QUESTS).length);
    for (const id of Object.keys(QUESTS)) {
      expect(state[id], `${id} missing from createDefaultQuests()`).toBeDefined();
      expect(state[id].started).toBe(false);
      expect(state[id].count).toBe(0);
      expect(state[id].completed).toBe(false);
      expect(state[id].rewardClaimed).toBe(false);
    }
  });

  it('returns independent objects each call', () => {
    const a = createDefaultQuests();
    const b = createDefaultQuests();
    a.forest_menace.count = 99;
    expect(b.forest_menace.count).toBe(0);
  });
});
