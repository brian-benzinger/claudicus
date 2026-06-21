import { describe, it, expect, beforeEach } from 'vitest';
import { createEnemy, resetEnemyIdCounter, ENEMY_DEFS } from '../data/enemies';
import { EnemyType } from '../types';

beforeEach(() => {
  resetEnemyIdCounter();
});

describe('createEnemy', () => {
  it('creates an enemy with correct stats from ENEMY_DEFS', () => {
    const wolf = createEnemy(EnemyType.WOLF, 3, 4);
    const def = ENEMY_DEFS[EnemyType.WOLF];
    expect(wolf.type).toBe(EnemyType.WOLF);
    expect(wolf.name).toBe(def.name);
    expect(wolf.hp).toBe(def.hp);
    expect(wolf.maxHp).toBe(def.hp);
    expect(wolf.atk).toBe(def.atk);
    expect(wolf.def).toBe(def.def);
    expect(wolf.agi).toBe(def.agi);
    expect(wolf.xp).toBe(def.xp);
    expect(wolf.gold).toBe(def.gold);
  });

  it('sets tile position correctly', () => {
    const e = createEnemy(EnemyType.BANDIT, 7, 12);
    expect(e.tileX).toBe(7);
    expect(e.tileY).toBe(12);
  });

  it('starts alive', () => {
    const e = createEnemy(EnemyType.SKELETON, 0, 0);
    expect(e.alive).toBe(true);
  });

  it('generates unique ids across many enemies', () => {
    const types = [EnemyType.WOLF, EnemyType.BANDIT, EnemyType.BANDIT_ARCHER, EnemyType.SKELETON, EnemyType.WILD_BOAR, EnemyType.REVENANT_KNIGHT];
    const enemies = types.flatMap(t => [createEnemy(t, 0, 0), createEnemy(t, 1, 1), createEnemy(t, 2, 2)]);
    const ids = new Set(enemies.map(e => e.id));
    expect(ids.size).toBe(enemies.length);
  });

  it('resets id counter correctly', () => {
    createEnemy(EnemyType.WOLF, 0, 0);
    createEnemy(EnemyType.WOLF, 0, 0);
    resetEnemyIdCounter();
    const e = createEnemy(EnemyType.WOLF, 0, 0);
    expect(e.id).toBe(`enemy_${EnemyType.WOLF}_1`);
  });
});

describe('ENEMY_DEFS', () => {
  it('pins exact stat contracts for every enemy type', () => {
    const expected: Array<{ type: EnemyType; name: string; hp: number; atk: number; def: number; agi: number; xp: number; gold: number }> = [
      { type: EnemyType.WOLF,            name: 'Wolf',            hp: 12, atk: 5,  def: 1, agi: 5, xp: 8,  gold: 3  },
      { type: EnemyType.BANDIT,          name: 'Bandit',          hp: 18, atk: 6,  def: 3, agi: 3, xp: 12, gold: 10 },
      { type: EnemyType.BANDIT_ARCHER,   name: 'Bandit Archer',   hp: 14, atk: 7,  def: 2, agi: 4, xp: 14, gold: 8  },
      { type: EnemyType.SKELETON,        name: 'Skeleton',        hp: 20, atk: 5,  def: 4, agi: 2, xp: 15, gold: 5  },
      { type: EnemyType.WILD_BOAR,       name: 'Wild Boar',       hp: 15, atk: 7,  def: 2, agi: 2, xp: 10, gold: 0  },
      { type: EnemyType.REVENANT_KNIGHT, name: 'Revenant Knight', hp: 60, atk: 10, def: 6, agi: 4, xp: 80, gold: 50 },
    ];
    for (const row of expected) {
      const def = ENEMY_DEFS[row.type];
      expect(def, `ENEMY_DEFS[${row.type}] should be defined`).toBeDefined();
      expect(def.name, `${row.type} name`).toBe(row.name);
      expect(def.hp,   `${row.type} hp`).toBe(row.hp);
      expect(def.atk,  `${row.type} atk`).toBe(row.atk);
      expect(def.def,  `${row.type} def`).toBe(row.def);
      expect(def.agi,  `${row.type} agi`).toBe(row.agi);
      expect(def.xp,   `${row.type} xp`).toBe(row.xp);
      expect(def.gold, `${row.type} gold`).toBe(row.gold);
    }
  });

  it('every def has a type field matching its key', () => {
    for (const [key, def] of Object.entries(ENEMY_DEFS)) {
      expect(def.type).toBe(key);
    }
  });
});
