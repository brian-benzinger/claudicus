import { EnemyType } from '../types';
import type { QuestState } from '../types';

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  npcId: string;
  npcName: string;
  goalType: 'kill_any' | 'kill_type';
  goalEnemyTypes?: EnemyType[];   // required when goalType === 'kill_type'
  goalCount: number;
  rewardGold: number;
  rewardWeaponId?: string;
  rewardPotions?: number;
}

export const QUESTS: Record<string, QuestDef> = {
  forest_menace: {
    id: 'forest_menace',
    name: 'The Forest Menace',
    description: 'Defeat 5 enemies in Thornwood',
    npcId: 'elder_aldric',
    npcName: 'Elder Aldric',
    goalType: 'kill_any',
    goalCount: 5,
    rewardGold: 50,
    rewardWeaponId: 'iron_longsword'
  },
  bandit_steel: {
    id: 'bandit_steel',
    name: 'Bandit Steel',
    description: 'Clear 3 bandits from Thornwood',
    npcId: 'gretta_smith',
    npcName: 'Gretta the Smith',
    goalType: 'kill_type',
    goalEnemyTypes: [EnemyType.BANDIT, EnemyType.BANDIT_ARCHER],
    goalCount: 3,
    rewardGold: 30,
    rewardWeaponId: 'hand_axe'
  },
  boar_problem: {
    id: 'boar_problem',
    name: 'The Boar Problem',
    description: 'Slay 2 wild boars in Thornwood',
    npcId: 'old_marta',
    npcName: 'Old Marta',
    goalType: 'kill_type',
    goalEnemyTypes: [EnemyType.WILD_BOAR],
    goalCount: 2,
    rewardGold: 25,
    rewardPotions: 3
  },
  quiet_dead: {
    id: 'quiet_dead',
    name: 'Silence the Unquiet Dead',
    description: 'Put 2 skeletons to rest in the chapel ruins',
    npcId: 'brother_tomas',
    npcName: 'Brother Tomas',
    goalType: 'kill_type',
    goalEnemyTypes: [EnemyType.SKELETON],
    goalCount: 2,
    rewardGold: 40
  },
  wolves_gate: {
    id: 'wolves_gate',
    name: 'Wolves at the Gate',
    description: 'Slay 3 wolves in Thornwood',
    npcId: 'farmer_wulf',
    npcName: 'Farmer Wulf',
    goalType: 'kill_type',
    goalEnemyTypes: [EnemyType.WOLF],
    goalCount: 3,
    rewardGold: 20,
    rewardWeaponId: 'dagger'
  },
  revenant_threat: {
    id: 'revenant_threat',
    name: 'The Revenant Threat',
    description: 'Defeat the Revenant Knight in Greymoor Crypt',
    npcId: 'duvain_wanderer',
    npcName: 'Duvain the Wanderer',
    goalType: 'kill_type',
    goalEnemyTypes: [EnemyType.REVENANT_KNIGHT],
    goalCount: 1,
    rewardGold: 30,
    rewardPotions: 2
  }
};

// MAIN_QUEST kept as alias so any leftover references don't break
export const MAIN_QUEST = QUESTS.forest_menace;

export function createDefaultQuests(): Record<string, QuestState> {
  return Object.fromEntries(
    Object.keys(QUESTS).map(id => [
      id,
      { started: false, count: 0, completed: false, rewardClaimed: false }
    ])
  );
}
