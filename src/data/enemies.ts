import { EnemyDef, EnemyType, EnemyInstance } from '../types';

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  [EnemyType.WOLF]: {
    type: EnemyType.WOLF,
    name: 'Wolf',
    hp: 12,
    atk: 5,
    def: 1,
    agi: 5,
    xp: 8,
    gold: 3
  },
  [EnemyType.BANDIT]: {
    type: EnemyType.BANDIT,
    name: 'Bandit',
    hp: 18,
    atk: 6,
    def: 3,
    agi: 3,
    xp: 12,
    gold: 10
  },
  [EnemyType.BANDIT_ARCHER]: {
    type: EnemyType.BANDIT_ARCHER,
    name: 'Bandit Archer',
    hp: 14,
    atk: 7,
    def: 2,
    agi: 4,
    xp: 14,
    gold: 8
  },
  [EnemyType.SKELETON]: {
    type: EnemyType.SKELETON,
    name: 'Skeleton',
    hp: 20,
    atk: 5,
    def: 4,
    agi: 2,
    xp: 15,
    gold: 5
  },
  [EnemyType.WILD_BOAR]: {
    type: EnemyType.WILD_BOAR,
    name: 'Wild Boar',
    hp: 15,
    atk: 7,
    def: 2,
    agi: 2,
    xp: 10,
    gold: 0
  },
  [EnemyType.REVENANT_KNIGHT]: {
    type: EnemyType.REVENANT_KNIGHT,
    name: 'Revenant Knight',
    hp: 60,
    atk: 10,
    def: 6,
    agi: 4,
    xp: 80,
    gold: 50
  }
};

let enemyIdCounter = 0;

export function createEnemy(type: EnemyType, tileX: number, tileY: number): EnemyInstance {
  const def = ENEMY_DEFS[type];
  enemyIdCounter++;
  return {
    id: `enemy_${type}_${enemyIdCounter}`,
    type: def.type,
    name: def.name,
    hp: def.hp,
    maxHp: def.hp,
    atk: def.atk,
    def: def.def,
    agi: def.agi,
    xp: def.xp,
    gold: def.gold,
    tileX,
    tileY,
    alive: true
  };
}

export function resetEnemyIdCounter(): void {
  enemyIdCounter = 0;
}
