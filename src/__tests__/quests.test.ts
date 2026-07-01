import { describe, it, expect } from 'vitest';
import { QUESTS, MAIN_QUEST, createDefaultQuests, questCountsKill } from '../data/quests';
import { EnemyType } from '../types';
import type { QuestState } from '../types';
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
  // Pin exact npcId/npcName/description for every quest so a silent rename,
  // copy-paste error, or new quest without a contract test is caught immediately.
  const EXPECTED_NPC: Record<string, { npcId: string; npcName: string }> = {
    forest_menace:   { npcId: 'elder_aldric',   npcName: 'Elder Aldric' },
    bandit_steel:    { npcId: 'gretta_smith',    npcName: 'Gretta the Smith' },
    boar_problem:    { npcId: 'old_marta',       npcName: 'Old Marta' },
    quiet_dead:      { npcId: 'brother_tomas',   npcName: 'Brother Tomas' },
    wolves_gate:     { npcId: 'farmer_wulf',     npcName: 'Farmer Wulf' },
    revenant_threat: { npcId: 'duvain_wanderer', npcName: 'Duvain the Wanderer' },
  };

  const EXPECTED_DESC: Record<string, string> = {
    forest_menace:   'Defeat 5 enemies in Thornwood',
    bandit_steel:    'Clear 3 bandits from Thornwood',
    boar_problem:    'Slay 2 wild boars in Thornwood',
    quiet_dead:      'Put 2 skeletons to rest in the chapel ruins',
    wolves_gate:     'Slay 3 wolves in Thornwood',
    revenant_threat: 'Defeat the Revenant Knight in Greymoor Crypt',
  };

  it('quest key set matches the expected table exactly', () => {
    expect(Object.keys(QUESTS).sort()).toEqual(Object.keys(EXPECTED_NPC).sort());
  });

  it('every quest has the exact npcId and npcName', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      expect(q.npcId,   `${id}.npcId`  ).toBe(EXPECTED_NPC[id].npcId);
      expect(q.npcName, `${id}.npcName`).toBe(EXPECTED_NPC[id].npcName);
    }
  });

  it('every quest has the exact description shown to the player', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      expect(q.description, `${id}.description`).toBe(EXPECTED_DESC[id]);
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

// ---------------------------------------------------------------------------
// questCountsKill — kill-type filtering contract
//
// The `checkQuestProgress` path in main.ts calls questCountsKill to decide
// whether a given enemy type should advance a quest's count.  These tests pin
// that filtering contract explicitly: a WOLF kill must never count toward
// bandit_steel, a BANDIT kill must never count toward wolves_gate, etc.
// ---------------------------------------------------------------------------

describe('questCountsKill — kill_any quests count every enemy type', () => {
  const q = QUESTS.forest_menace; // goalType: 'kill_any'

  it('counts every EnemyType for a kill_any quest', () => {
    for (const type of Object.values(EnemyType)) {
      expect(questCountsKill(q, type), `forest_menace must count ${type}`).toBe(true);
    }
  });
});

describe('questCountsKill — defensive: kill_type with missing goalEnemyTypes returns false', () => {
  it('returns false rather than throwing when goalEnemyTypes is absent', () => {
    // Defensive branch: a malformed/migrated quest def with kill_type but no
    // goalEnemyTypes should never match any enemy rather than crash.
    const malformed = { ...QUESTS.bandit_steel, goalEnemyTypes: undefined };
    expect(questCountsKill(malformed, EnemyType.BANDIT)).toBe(false);
  });
});

describe('questCountsKill — kill_type quests count only matching types', () => {
  it('bandit_steel: counts BANDIT and BANDIT_ARCHER; ignores WOLF, SKELETON, WILD_BOAR, REVENANT_KNIGHT', () => {
    const q = QUESTS.bandit_steel;
    expect(questCountsKill(q, EnemyType.BANDIT)).toBe(true);
    expect(questCountsKill(q, EnemyType.BANDIT_ARCHER)).toBe(true);
    expect(questCountsKill(q, EnemyType.WOLF)).toBe(false);
    expect(questCountsKill(q, EnemyType.SKELETON)).toBe(false);
    expect(questCountsKill(q, EnemyType.WILD_BOAR)).toBe(false);
    expect(questCountsKill(q, EnemyType.REVENANT_KNIGHT)).toBe(false);
  });

  it('wolves_gate: counts only WOLF', () => {
    const q = QUESTS.wolves_gate;
    expect(questCountsKill(q, EnemyType.WOLF)).toBe(true);
    expect(questCountsKill(q, EnemyType.BANDIT)).toBe(false);
    expect(questCountsKill(q, EnemyType.SKELETON)).toBe(false);
  });

  it('boar_problem: counts only WILD_BOAR', () => {
    const q = QUESTS.boar_problem;
    expect(questCountsKill(q, EnemyType.WILD_BOAR)).toBe(true);
    expect(questCountsKill(q, EnemyType.WOLF)).toBe(false);
    expect(questCountsKill(q, EnemyType.BANDIT)).toBe(false);
  });

  it('quiet_dead: counts only SKELETON', () => {
    const q = QUESTS.quiet_dead;
    expect(questCountsKill(q, EnemyType.SKELETON)).toBe(true);
    expect(questCountsKill(q, EnemyType.WOLF)).toBe(false);
    expect(questCountsKill(q, EnemyType.BANDIT)).toBe(false);
  });

  it('revenant_threat: counts only REVENANT_KNIGHT', () => {
    const q = QUESTS.revenant_threat;
    expect(questCountsKill(q, EnemyType.REVENANT_KNIGHT)).toBe(true);
    expect(questCountsKill(q, EnemyType.BANDIT)).toBe(false);
    expect(questCountsKill(q, EnemyType.WOLF)).toBe(false);
  });
});

describe('questCountsKill — kill-counting simulation for bandit_steel', () => {
  // Replay a mixed-enemy kill sequence and verify the quest state machine
  // reaches completion at exactly the right moment using questCountsKill to
  // gate each increment — the same logic as checkQuestProgress in main.ts.

  function simulate(kills: EnemyType[]): QuestState {
    const questDef = QUESTS.bandit_steel;
    const state: QuestState = { started: true, count: 0, completed: false, rewardClaimed: false };
    for (const enemyType of kills) {
      if (!state.completed && questCountsKill(questDef, enemyType)) {
        state.count++;
        if (state.count >= questDef.goalCount) state.completed = true;
      }
    }
    return state;
  }

  it('completes after exactly 3 bandit kills in a mixed sequence, ignoring non-bandits', () => {
    // WOLF (ignored), BANDIT (1), SKELETON (ignored), BANDIT (2), BANDIT_ARCHER (3 → done)
    const result = simulate([
      EnemyType.WOLF,
      EnemyType.BANDIT,
      EnemyType.SKELETON,
      EnemyType.BANDIT,
      EnemyType.BANDIT_ARCHER,
    ]);
    expect(result.count).toBe(3);
    expect(result.completed).toBe(true);
  });

  it('does not complete on 3 non-bandit kills alone', () => {
    const result = simulate([EnemyType.WOLF, EnemyType.SKELETON, EnemyType.WILD_BOAR]);
    expect(result.count).toBe(0);
    expect(result.completed).toBe(false);
  });

  it('stops incrementing count once completed — extra bandit kills are ignored', () => {
    // 5 bandit kills: count must stay at 3, not reach 5
    const result = simulate([
      EnemyType.BANDIT,
      EnemyType.BANDIT,
      EnemyType.BANDIT,
      EnemyType.BANDIT,
      EnemyType.BANDIT,
    ]);
    expect(result.count).toBe(3);
    expect(result.completed).toBe(true);
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
