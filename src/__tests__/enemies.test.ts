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

  it('generates unique ids', () => {
    const a = createEnemy(EnemyType.WOLF, 0, 0);
    const b = createEnemy(EnemyType.WOLF, 1, 1);
    expect(a.id).not.toBe(b.id);
  });

  it('resets id counter correctly', () => {
    createEnemy(EnemyType.WOLF, 0, 0);
    createEnemy(EnemyType.WOLF, 0, 0);
    resetEnemyIdCounter();
    const e = createEnemy(EnemyType.WOLF, 0, 0);
    expect(e.id).toContain('1');
  });
});

describe('ENEMY_DEFS', () => {
  it('defines all enemy types', () => {
    const types = [EnemyType.WOLF, EnemyType.BANDIT, EnemyType.BANDIT_ARCHER, EnemyType.SKELETON, EnemyType.WILD_BOAR, EnemyType.REVENANT_KNIGHT];
    for (const type of types) {
      expect(ENEMY_DEFS[type]).toBeDefined();
    }
  });

  it('all enemies have positive stats', () => {
    for (const def of Object.values(ENEMY_DEFS)) {
      expect(def.hp).toBeGreaterThan(0);
      expect(def.atk).toBeGreaterThan(0);
      expect(def.xp).toBeGreaterThan(0);
    }
  });
});
