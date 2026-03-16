export interface CraftRecipe {
  id: string;
  name: string;
  cost: { wolf_pelt?: number; bandit_steel?: number };
  weaponId?: string;
  armorId?: string;
  description: string;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'studded_leather',
    name: 'Studded Leather',
    cost: { wolf_pelt: 3 },
    armorId: 'studded_leather',
    description: '3 Wolf Pelts → Studded Leather (DEF +2)'
  },
  {
    id: 'iron_longsword',
    name: 'Iron Longsword',
    cost: { bandit_steel: 2 },
    weaponId: 'iron_longsword',
    description: '2 Bandit Steel → Iron Longsword (ATK +4)'
  },
  {
    id: 'war_axe',
    name: 'War Axe',
    cost: { bandit_steel: 2, wolf_pelt: 1 },
    weaponId: 'war_axe',
    description: '2 Bandit Steel + 1 Wolf Pelt → War Axe (ATK +8)'
  }
];
