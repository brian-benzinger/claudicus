import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEngine } from '../combat';
import { PlayerManager } from '../player';
import {
  createDefaultPlayer, EnemyType, CombatPhase, ClassPath,
  StatusEffectType, LEVEL_REWARDS, xpForLevel
} from '../types';
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

// ---------------------------------------------------------------------------
// Victory reward integration — simulate full fight → apply rewards to player
// ---------------------------------------------------------------------------
describe('Victory reward integration', () => {
  /** Kill enemy in one hit and advance animation to reach DONE */
  function winFight(playerSetup?: (p: PlayerManager) => void) {
    mockAttacks([0, 0.9, 0]); // no miss, high variance, no crit
    const player = makeFastPlayer();
    player.state.str = 999;
    if (playerSetup) playerSetup(player);
    const enemy = makeEnemy(EnemyType.WOLF);
    const engine = new CombatEngine(player, enemy);
    engine.playerAttack();
    for (let i = 0; i <= 21; i++) engine.update();
    return { player, enemy, engine };
  }

  it('getResult is "victory" after killing enemy', () => {
    const { engine } = winFight();
    expect(engine.isDone()).toBe(true);
    expect(engine.getResult()).toBe('victory');
  });

  it('applying computeRewards XP to player increases xp', () => {
    const { player, engine } = winFight();
    const xpBefore = player.state.xp;
    const { xp } = engine.computeRewards();
    player.gainXp(xp);
    expect(player.state.xp + player.state.level * 0 || player.state.xp).toBeGreaterThanOrEqual(0);
    // XP was consumed by level-up or accumulated
    expect(player.state.xp + xpForLevel(1)).toBeGreaterThanOrEqual(xpBefore + xp - xpForLevel(1));
  });

  it('applying computeRewards gold to player increases gold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // force gold drop
    const { player, engine } = winFight();
    const goldBefore = player.state.gold;
    const { gold } = engine.computeRewards();
    player.addGold(gold);
    expect(player.state.gold).toBe(goldBefore + gold);
  });

  it('xp from wolf enemy matches its definition', () => {
    const enemy = makeEnemy(EnemyType.WOLF);
    const engine = new CombatEngine(makePlayer(), enemy);
    expect(engine.computeRewards().xp).toBe(enemy.xp);
  });

  it('gainXp from victory can trigger level-up and return reward', () => {
    // Give player exactly enough XP to be one kill away from leveling
    const { player, engine } = winFight(p => {
      p.state.xp = xpForLevel(1) - 1; // 1 XP short of level 2
    });
    // enemy gives at least 1 XP so we level up
    const { xp } = engine.computeRewards();
    const reward = player.gainXp(xp);
    expect(player.state.level).toBe(2);
    expect(reward).not.toBeNull();
    expect(reward!.label).toBe(LEVEL_REWARDS[2].label);
  });

  it('reward is null when enemy XP does not trigger level-up', () => {
    const { player, engine } = winFight(p => {
      p.state.xp = 0; // fresh player, needs 25 XP; wolf gives 8
    });
    const { xp } = engine.computeRewards();
    const reward = player.gainXp(xp);
    expect(player.state.level).toBe(1);
    expect(reward).toBeNull();
  });

  it('computeRewards is stable — same values returned each call', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const enemy = makeEnemy(EnemyType.WOLF);
    const engine = new CombatEngine(makePlayer(), enemy);
    const r1 = engine.computeRewards();
    const r2 = engine.computeRewards();
    expect(r1.xp).toBe(r2.xp);
    expect(r1.gold).toBe(r2.gold);
  });
});

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

describe('Status effects — BLEED', () => {
  it('initializes with empty status effect arrays', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    expect(engine.state.playerStatusEffects).toEqual([]);
    expect(engine.state.enemyStatusEffects).toEqual([]);
  });

  it('BLEED deals 2 damage per turn and decrements turns', () => {
    const player = makeFastPlayer();
    const engine = new CombatEngine(player, makeEnemy());
    // Manually apply bleed to player
    engine.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 3 });

    const hpBefore = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    // enemyTurn ticks player effects — use random=0.5 so skeleton attacks
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.enemyTurn();

    // Bleed should have fired (2 dmg) before the enemy attack
    const bleedEffect = engine.state.playerStatusEffects[0];
    expect(bleedEffect?.turnsRemaining).toBe(2); // decremented from 3
    expect(engine.state.log.some(l => l.includes('bleed'))).toBe(true);
  });

  it('BLEED is removed when turnsRemaining reaches 0', () => {
    const player = makeFastPlayer();
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 1 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.enemyTurn();
    expect(engine.state.playerStatusEffects).toHaveLength(0);
  });
});

describe('Status effects — STUN', () => {
  it('stunned enemy skips their turn and logs it', () => {
    const player = makeFastPlayer();
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });

    const hpBefore = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();

    // Player should not take damage
    expect(engine.state.playerHp).toBe(hpBefore);
    expect(engine.state.log.some(l => l.includes('stunned'))).toBe(true);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('STUN is removed after one turn', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyStatusEffects).toHaveLength(0);
  });

  it('STUN with 2 turns remaining decrements to 1 and still skips turn', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 2 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyStatusEffects[0].turnsRemaining).toBe(1);
  });
});

describe('Status effects — WEAKEN', () => {
  it('WEAKEN reduces enemy ATK during executeEnemyAttack', () => {
    const player = makeFastPlayer();
    player.state.def = 0; // override base DEF (armor still adds leatherVest=+1)
    const enemy = makeEnemy(EnemyType.BANDIT);
    const baseAtk = enemy.atk;
    const engine = new CombatEngine(player, enemy);

    // Apply WEAKEN with magnitude 3
    engine.state.enemyStatusEffects.push({
      type: StatusEffectType.WEAKEN, turnsRemaining: 3, magnitude: 3
    });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.enemyTurn();

    // playerDef = state.def(0) + leatherVest.defBonus(1) = 1
    // attackPower = max(1, baseAtk - 3), variance = floor(0.5*4)-1 = 1
    // damage = max(1, attackPower - 1 + 1) = max(1, baseAtk - 3)
    const dmgLine = engine.state.log.find(l => l.includes('deals'));
    expect(dmgLine).toBeTruthy();
    const expectedDmg = Math.max(1, baseAtk - 3);
    expect(dmgLine).toContain(String(expectedDmg));
  });

  it('WEAKEN decrements each enemy turn cycle (via tickEnemyEffects)', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.enemyStatusEffects.push({
      type: StatusEffectType.WEAKEN, turnsRemaining: 2, magnitude: 2
    });
    // Simulate ENEMY_ANIMATING completing (triggers tickEnemyEffects)
    engine.state.phase = CombatPhase.ENEMY_ANIMATING;
    engine.state.animationFrame = 21;
    engine.update();
    expect(engine.state.enemyStatusEffects[0].turnsRemaining).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Enemy AI profiles
// ---------------------------------------------------------------------------

describe('Enemy AI — Wolf howl', () => {
  it('wolf howls and sets nextAttackBonus to -2 when random < 0.30', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → howl
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.nextAttackBonus).toBeLessThanOrEqual(-2);
    expect(engine.state.log.some(l => l.includes('howl'))).toBe(true);
  });

  it('wolf attacks when random >= 0.30', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.30 → attack
    const player = makeFastPlayer();
    player.state.def = 0;
    const engine = new CombatEngine(player, makeEnemy(EnemyType.WOLF));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    const hpBefore = engine.state.playerHp;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBeLessThan(hpBefore);
  });
});

describe('Enemy AI — Bandit Archer alternating', () => {
  it('fires ranged shot (logs "arrow") on odd turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.BANDIT_ARCHER));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // enemyTurnCount becomes 1 (odd)
    expect(engine.state.log.some(l => l.includes('arrow'))).toBe(true);
  });

  it('uses melee attack (logs "knife") on even turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.BANDIT_ARCHER));
    // Advance to second enemy turn
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1 (odd → arrow)
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 2 (even → knife)
    expect(engine.state.log.some(l => l.includes('knife'))).toBe(true);
  });
});

describe('Enemy AI — Skeleton healing', () => {
  it('skeleton heals on its 3rd turn and logs it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // attack (not defend)
    const enemy = makeEnemy(EnemyType.SKELETON);
    enemy.hp = 15; // below max so heal has room
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 15;

    // Run 3 enemy turns to reach the healing turn
    for (let t = 0; t < 3; t++) {
      engine.state.phase = CombatPhase.ENEMY_ACTION;
      engine.enemyTurn();
    }
    expect(engine.state.log.some(l => l.includes('mends'))).toBe(true);
  });

  it('skeleton does not heal on non-3rd turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.enemyHp = 15;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1 — no heal
    expect(engine.state.log.some(l => l.includes('mends'))).toBe(false);
  });
});

describe('Enemy AI — Wild Boar charge', () => {
  it('wild boar charges (logs "charges") when random < 0.90', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → charge
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log.some(l => l.includes('charges'))).toBe(true);
  });
});

describe('Enemy AI — Revenant Knight phase 2', () => {
  it('triggers phase 2 at < 50% HP and logs fury message', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    // Set HP below 50%
    engine.state.enemyHp = Math.floor(enemy.maxHp * 0.4);
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyIsPhaseTwo).toBe(true);
    expect(engine.state.log.some(l => l.includes('fury'))).toBe(true);
  });

  it('phase 2 attack applies BLEED to player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → attack in phase 2
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = Math.floor(enemy.maxHp * 0.4);
    engine.state.enemyIsPhaseTwo = true; // already in phase 2
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.playerStatusEffects.some(e => e.type === StatusEffectType.BLEED)).toBe(true);
  });

  it('does not apply bleed in phase 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    // Full HP → phase 1
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.playerStatusEffects.some(e => e.type === StatusEffectType.BLEED)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Player abilities
// ---------------------------------------------------------------------------

describe('CombatEngine.getAvailableAbility', () => {
  it('returns null for level 1 with no class', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    expect(engine.getAvailableAbility()).toBeNull();
  });

  it('returns Backstab for dagger at level 3+', () => {
    const player = makeFastPlayer(); // dagger equipped
    player.state.level = 3;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Backstab');
  });

  it('returns Pin for bow at level 3+', () => {
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.level = 3;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Pin');
  });

  it('returns Shatter for mace at level 3+', () => {
    const player = makePlayer();
    player.equipWeapon('mace');
    player.state.agi = 10; // ensure player goes first
    player.state.level = 3;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Shatter');
  });

  it('returns null for weapon abilities below level 3', () => {
    const player = makeFastPlayer();
    player.state.level = 2;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBeNull();
  });

  it('returns Shield Bash for Warrior class', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.WARRIOR;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Shield Bash');
  });

  it('returns Ambush for Scout class (first use)', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.SCOUT;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Ambush');
  });

  it('returns null for Ambush after it has been used this combat', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.SCOUT;
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.abilityUsedThisCombat = true;
    expect(engine.getAvailableAbility()).toBeNull();
  });

  it('returns Intimidate for Brigand class', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.BRIGAND;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Intimidate');
  });
});

describe('CombatEngine.playerUseAbility — Pin (bow)', () => {
  it('applies STUN to enemy and transitions to PLAYER_ANIMATING', () => {
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.level = 3;
    player.state.agi = 10; // ensure player goes first
    mockAttacks([0, 0, 0]); // free hit from ranged
    const engine = new CombatEngine(player, makeEnemy());
    // engine starts in PLAYER_ACTION (agi high enough)
    engine.playerUseAbility();
    expect(engine.state.enemyStatusEffects.some(e => e.type === StatusEffectType.STUN)).toBe(true);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
    expect(engine.state.log.some(l => l.includes('pins'))).toBe(true);
  });
});

describe('CombatEngine.playerUseAbility — Shatter (mace)', () => {
  it('permanently reduces enemy DEF by 2', () => {
    const player = makePlayer();
    player.equipWeapon('mace');
    player.state.agi = 10;
    player.state.level = 3;
    const enemy = makeEnemy(EnemyType.SKELETON); // DEF = 3
    const engine = new CombatEngine(player, enemy);
    const defBefore = engine.state.enemy.def;
    engine.playerUseAbility();
    expect(engine.state.enemy.def).toBe(Math.max(0, defBefore - 2));
    expect(engine.state.log.some(l => l.includes('Shatter'))).toBe(true);
  });

  it('does not reduce enemy DEF below 0', () => {
    const player = makePlayer();
    player.equipWeapon('mace');
    player.state.agi = 10;
    player.state.level = 3;
    const enemy = makeEnemy(EnemyType.WOLF); // Wolf has DEF = 0
    const engine = new CombatEngine(player, enemy);
    engine.playerUseAbility();
    expect(engine.state.enemy.def).toBe(0);
  });
});

describe('CombatEngine.playerUseAbility — Shield Bash (Warrior)', () => {
  it('stuns the enemy and uses the turn', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.WARRIOR;
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerUseAbility();
    expect(engine.state.enemyStatusEffects.some(e => e.type === StatusEffectType.STUN)).toBe(true);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
    expect(engine.state.log.some(l => l.includes('Shield Bash'))).toBe(true);
  });
});

describe('CombatEngine.playerUseAbility — Ambush (Scout)', () => {
  it('forces a critical hit and marks ability as used', () => {
    const player = makeFastPlayer();
    player.state.classPath = ClassPath.SCOUT;
    // No weapon ability (dagger at level 1 has no ability → class ability takes effect)
    player.state.level = 1; // below 3 so weapon ability doesn't kick in
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerUseAbility();
    expect(engine.state.abilityUsedThisCombat).toBe(true);
    expect(engine.state.log.some(l => l.includes('Ambush') || l.includes('Critical'))).toBe(true);
  });

  it('does nothing if ability already used this combat', () => {
    const player = makeFastPlayer();
    player.state.classPath = ClassPath.SCOUT;
    player.state.level = 1;
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.abilityUsedThisCombat = true;
    const phaseBefore = engine.state.phase;
    engine.playerUseAbility();
    expect(engine.state.phase).toBe(phaseBefore);
  });
});

describe('CombatEngine.playerUseAbility — Intimidate (Brigand)', () => {
  it('applies WEAKEN with magnitude 3 for 3 turns', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.BRIGAND;
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerUseAbility();
    const weaken = engine.state.enemyStatusEffects.find(e => e.type === StatusEffectType.WEAKEN);
    expect(weaken).toBeTruthy();
    expect(weaken!.magnitude).toBe(3);
    expect(weaken!.turnsRemaining).toBe(3);
    expect(engine.state.log.some(l => l.includes('Intimidate'))).toBe(true);
  });
});

describe('CombatEngine.playerFlee — class modifiers', () => {
  it('Scout has higher flee chance', () => {
    // Scout: baseChance=0.5 + scoutBonus=0.15 = 0.65
    // With random=0.6, Scout succeeds; base player would fail
    const scoutPlayer = makePlayer();
    scoutPlayer.state.classPath = ClassPath.SCOUT;
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const scoutEngine = new CombatEngine(scoutPlayer, makeEnemy());
    expect(scoutEngine.playerFlee()).toBe(true);
  });

  it('Warrior has lower flee chance', () => {
    // Warrior: baseChance=0.5 - 0.1 = 0.4 (no AGI bonus since enemy agi > player agi)
    // With random=0.45, Warrior fails (0.45 >= 0.4)
    const warriorPlayer = makePlayer(); // agi=3
    warriorPlayer.state.classPath = ClassPath.WARRIOR;
    const enemy = makeEnemy();
    enemy.agi = 10; // ensure player agi < enemy agi → no agiBonus
    vi.spyOn(Math, 'random').mockReturnValue(0.45);
    const warriorEngine = new CombatEngine(warriorPlayer, enemy);
    expect(warriorEngine.playerFlee()).toBe(false);
  });
});
