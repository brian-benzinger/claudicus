export interface QuestDef {
  id: string;
  name: string;
  description: string;
  goalCount: number;
  rewardGold: number;
  rewardWeaponId: string | null;
}

export const MAIN_QUEST: QuestDef = {
  id: 'forest_menace',
  name: 'The Forest Menace',
  description: 'Defeat 5 enemies in Thornwood Forest',
  goalCount: 5,
  rewardGold: 50,
  rewardWeaponId: 'iron_longsword'
};
