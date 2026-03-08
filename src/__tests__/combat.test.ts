import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEngine } from '../combat';
import { PlayerManager } from '../player';
import { createDefaultPlayer, EnemyType, CombatPhase } from '../types';
import { createEnemy, resetEnemyIdCounter } from '../data/enemies';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

// Dagger: FAST (player always goes first), missChance=0, critChance=0.3
function makeFastPlayer() {
  const p = makePlayer();
  p.equipWeapon('dagger');
  return p;
}

function makeEnemy(type = EnemyType.SKELETON) {
  return createEnemy(type, 5, 5);
}

// Each playerAttack() call consumes 3 random values: miss check, variance, crit
// Returns mocked values for [miss, variance, crit] across N attacks
function mockAttacks(...calls: [miss: number, variance: number, crit: number][]) {
  const values = calls.flatMap(([m, v, c]) => [m, v, c]);
  const spy = vi.spyOn(Math, 'random');
  values.forEach(v => spy.mockReturnValueOnce(v));
  return spy;
}

beforeEach(() => {
  resetEnemyIdCounter();
  vi.restoreAllMocks();
});

describe('CombatEngine constructor', () => {
  it('initializes with correct hp values', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.playerHp).toBe(player.state.hp);
    expect(engine.state.enemyHp).toBe(enemy.hp);
  });

  it('adds appearance message to log', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy());
    expect(engine.state.log[0]).toContain('appears');
  });

  it('starts in PLAYER_ACTION phase for fast weapon', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('starts in ENEMY_ACTION when slow weapon and enemy has higher agi', () => {
    const player = makePlayer(); // agi=3
    player.equipWeapon('mace'); // SLOW
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5, 5 > 3+3=6? no: slow needs playerAgi > enemyAgi+3
    // wolf agi=5, player agi=3: 3 > 5+3 = false → enemy goes first
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('ranged weapon fires a free opening shot', () => {
    // hunting_bow: ranged, miss=0 → random calls: miss, variance, crit
    mockAttacks([0, 0, 0]);
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.state.log.some(l => l.includes('opening shot'))).toBe(true);
    expect(engine.state.freeHitUsed).toBe(true);
  });
});

describe('CombatEngine.playerAttack', () => {
  it('transitions to PLAYER_ANIMATING immediately after attacking', () => {
    mockAttacks([0, 0, 0]);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
  });

  it('transitions to ENEMY_ACTION after animation completes (enemy survives)', () => {
    mockAttacks([0, 0, 0]);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    // Advance animation frames past the threshold
    for (let i = 0; i <= 21; i++) engine.update();
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('transitions to DONE after animation completes when enemy is killed', () => {
    mockAttacks([0, 0.9, 0]);
    const player = makeFastPlayer();
    player.state.str = 999;
    const enemy = makeEnemy(EnemyType.WOLF);
    const engine = new CombatEngine(player, enemy);
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(0);
    // Advance animation frames
    for (let i = 0; i <= 21; i++) engine.update();
    expect(engine.isDone()).toBe(true);
    expect(engine.getResult()).toBe('victory');
  });

  it('does nothing outside PLAYER_ACTION phase', () => {
    mockAttacks([0, 0, 0], [0, 0, 0]);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack(); // moves to PLAYER_ANIMATING
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack(); // should do nothing (wrong phase)
    expect(engine.state.enemyHp).toBe(hpBefore);
  });

  it('logs a miss when random is below missChance', () => {
    const player = makePlayer();
    player.equipWeapon('hand_axe'); // missChance=0.2, NORMAL speed
    player.state.agi = 10; // ensure player goes first
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below 0.2 miss threshold
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(true);
  });

  it('logs a critical hit when crit random is below critChance', () => {
    // dagger: FAST, missChance=0, critChance=0.3
    // random calls: [miss check(→no miss), variance, crit check(→crit)]
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)    // miss check: 0 < 0 = false (no miss)
      .mockReturnValueOnce(0)    // variance: floor(0*4)-1 = -1
      .mockReturnValueOnce(0.1); // crit check: 0.1 < 0.3 = true (CRIT)
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(true);
  });
});

describe('CombatEngine.playerDefend', () => {
  it('sets defending flag and nextAttackBonus', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerDefend();
    expect(engine.state.defendingThisTurn).toBe(true);
    expect(engine.state.nextAttackBonus).toBe(1);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('logs the defend message', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerDefend();
    expect(engine.state.log.some(l => l.includes('brace'))).toBe(true);
  });
});

describe('CombatEngine.playerPotion', () => {
  it('restores hp and advances turn', () => {
    const player = makeFastPlayer();
    player.takeDamage(20);
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerPotion();
    expect(engine.state.playerHp).toBeGreaterThan(20);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('returns false and logs when no potions', () => {
    const player = makeFastPlayer();
    player.state.potions = 0;
    const engine = new CombatEngine(player, makeEnemy());
    const result = engine.playerPotion();
    expect(result).toBe(false);
    expect(engine.state.log.some(l => l.includes('No potions'))).toBe(true);
  });
});

describe('CombatEngine.playerFlee', () => {
  it('succeeds when random is below flee chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    const result = engine.playerFlee();
    expect(result).toBe(true);
    expect(engine.isDone()).toBe(true);
    expect(engine.getResult()).toBe('fled');
  });

  it('fails when random is above flee chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    const result = engine.playerFlee();
    expect(result).toBe(false);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });
});

describe('CombatEngine.enemyTurn', () => {
  it('deals damage to player when enemy attacks', () => {
    // random=0.5: 0.5 > 0.25 (not desperate), 0.5 > 0.2 (not defending) → enemy attacks
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makeFastPlayer();
    player.state.def = 0;
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerDefend(); // advance to ENEMY_ACTION
    const hpBefore = engine.state.playerHp;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBeLessThan(hpBefore);
  });

  it('transitions to PLAYER_ACTION after enemy attacks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerDefend();
    engine.enemyTurn();
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('transitions to DONE when player is killed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makeFastPlayer();
    player.state.hp = 1;
    player.state.def = 0;
    const enemy = makeEnemy(EnemyType.SKELETON);
    enemy.atk = 999;
    const engine = new CombatEngine(player, enemy);
    engine.playerDefend();
    engine.enemyTurn();
    expect(engine.isDone()).toBe(true);
    expect(engine.getResult()).toBe('defeat');
  });
});

describe('CombatEngine.computeRewards', () => {
  it('always returns enemy xp', () => {
    const enemy = makeEnemy(EnemyType.WOLF); // xp=8
    const engine = new CombatEngine(makePlayer(), enemy);
    const rewards = engine.computeRewards();
    expect(rewards.xp).toBe(8);
  });

  it('returns gold when random < 0.5', () => {
    const enemy = makeEnemy(EnemyType.WOLF); // gold=3
    const engine = new CombatEngine(makePlayer(), enemy);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(engine.computeRewards().gold).toBe(3);
  });

  it('returns 0 gold when random >= 0.5', () => {
    const enemy = makeEnemy(EnemyType.WOLF);
    const engine = new CombatEngine(makePlayer(), enemy);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(engine.computeRewards().gold).toBe(0);
  });
});

describe('CombatEngine.getRecentLog', () => {
  it('returns the last N entries', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy());
    const log = engine.getRecentLog(1);
    expect(log.length).toBe(1);
    expect(log[0]).toBe(engine.state.log[engine.state.log.length - 1]);
  });

  it('defaults to 3 entries', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy());
    expect(engine.getRecentLog().length).toBeLessThanOrEqual(3);
  });
});

describe('CombatEngine.update (animation)', () => {
  it('advances animationFrame each call during PLAYER_ANIMATING', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ANIMATING;
    engine.state.animationFrame = 0;
    engine.update();
    expect(engine.state.animationFrame).toBe(1);
  });

  it('transitions out of PLAYER_ANIMATING after 20 frames', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ANIMATING;
    engine.state.animationFrame = 20;
    engine.update();
    expect(engine.state.phase).not.toBe(CombatPhase.PLAYER_ANIMATING);
  });
});
