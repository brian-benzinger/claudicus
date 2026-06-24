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

  it('starts in ENEMY_ACTION for normal weapon when enemy agi exceeds player agi', () => {
    // rusty_shortsword (NORMAL): playerTurn = playerAgi >= enemyAgi = 3 >= 5 = false → ENEMY_ACTION
    const player = makePlayer(); // agi=3, rusty_shortsword (NORMAL speed)
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('equal agi with a normal weapon gives the first turn to the player', () => {
    // NORMAL: playerTurn = playerAgi >= enemyAgi — >= means ties resolve in player's favour
    const player = makePlayer(); // agi=3
    const enemy = makeEnemy(EnemyType.BANDIT); // agi=3 (equal to player)
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('starts in PLAYER_ACTION for slow weapon when player agi exceeds enemy agi by more than 3', () => {
    // SLOW: playerTurn = playerAgi > enemyAgi + 3: 10 > 5+3=8 = true → PLAYER_ACTION
    const player = makePlayer();
    player.equipWeapon('mace'); // SLOW
    player.state.agi = 10;      // 10 > wolf(5)+3=8 → player still goes first
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
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
    const initialHp = engine.state.enemyHp;
    engine.playerAttack(); // moves to PLAYER_ANIMATING
    // dagger: miss=0(no miss), variance=floor(0*4)-1=-1, crit=0(<0.3→crit) → damage=max(1,6-4-1)=1×2=2
    expect(engine.state.enemyHp).toBe(18); // initialHp(20) - 2 = 18
    const hpAfterFirstAttack = engine.state.enemyHp;
    engine.playerAttack(); // should do nothing (wrong phase)
    expect(engine.state.enemyHp).toBe(hpAfterFirstAttack);
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

  it('a miss deals no damage to the enemy', () => {
    // Contract: when executePlayerAttack early-returns on a miss, enemyHp is unchanged.
    const player = makePlayer();
    player.equipWeapon('hand_axe'); // missChance=0.2, NORMAL speed
    player.state.agi = 10;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.2 → always miss
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(hpBefore);
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

  it('critical hit deals exactly twice the damage of an equivalent non-crit', () => {
    // Dagger: missChance=0, critChance=0.3. Random call order per attack:
    //   1. miss check (always false for dagger), 2. variance, 3. crit check.
    // Non-crit: variance=0 (random=0.25 → floor(1)-1=0), crit=0.5 (≥0.3 → no crit)
    // player.computeWeaponDamage()=str(5)+damageBonus(1)=6; skeleton.def=4; ignores=0
    // damage = max(1, 6-4+0) = 2; non-crit actualDamage = 2
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)    // miss: no miss
      .mockReturnValueOnce(0.25) // variance: 0
      .mockReturnValueOnce(0.5); // crit: 0.5 >= 0.3 → no crit
    const e1 = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    const hp1Before = e1.state.enemyHp;
    e1.playerAttack();
    const nonCritDamage = hp1Before - e1.state.enemyHp;

    vi.restoreAllMocks();

    // Crit: same variance=0, crit=0.1 (<0.3 → crit) → damage * 2 = 4
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)    // miss: no miss
      .mockReturnValueOnce(0.25) // variance: 0
      .mockReturnValueOnce(0.1); // crit: 0.1 < 0.3 → crit
    const e2 = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    const hp2Before = e2.state.enemyHp;
    e2.playerAttack();
    const critDamage = hp2Before - e2.state.enemyHp;

    expect(critDamage).toBe(nonCritDamage * 2);
    expect(nonCritDamage).toBe(2); // pin exact non-crit value so the test is meaningful
    expect(critDamage).toBe(4);    // pin exact crit value
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

  it('halves the actual damage received from the next enemy attack (min 1)', () => {
    // Contract: when defendingThisTurn=true, executeEnemyAttack applies
    // actualDamage = max(1, floor(damage * 0.5)) instead of raw damage.
    //
    // Setup: player.def=0, skeleton atk=5, random=0.5 throughout.
    // skeletonAI: 0.5 >= 0.4 → attacks. calcDamage: variance=floor(0.5*4)-1=1, no enemy crit.
    // playerDef = def(0) + leatherVest.defBonus(1) = 1
    // attackPower = max(1, 5) = 5
    // raw damage = max(1, 5-1+1) = 5
    // undefended actualDamage = 5; defended actualDamage = max(1, floor(5*0.5)) = 2

    // Undefended baseline
    const p1 = makeFastPlayer();
    p1.state.def = 0;
    const e1 = new CombatEngine(p1, makeEnemy(EnemyType.SKELETON));
    e1.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hp1Before = e1.state.playerHp;
    e1.enemyTurn();
    const undefendedDamage = hp1Before - e1.state.playerHp;

    vi.restoreAllMocks();

    // Defended: playerDefend() sets defendingThisTurn=true and advances to ENEMY_ACTION
    const p2 = makeFastPlayer();
    p2.state.def = 0;
    const e2 = new CombatEngine(p2, makeEnemy(EnemyType.SKELETON));
    e2.playerDefend();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hp2Before = e2.state.playerHp;
    e2.enemyTurn();
    const defendedDamage = hp2Before - e2.state.playerHp;

    expect(undefendedDamage).toBe(5); // pin undefended so the assertion is meaningful
    expect(defendedDamage).toBe(Math.max(1, Math.floor(undefendedDamage * 0.5)));
    expect(defendedDamage).toBeLessThan(undefendedDamage);
  });
});

describe('CombatEngine.playerPotion', () => {
  it('restores hp and advances turn', () => {
    const player = makeFastPlayer();
    player.takeDamage(20); // player goes from 40 → 20 HP
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerPotion();
    // POTION_HEAL=20: 20 + 20 = 40 = maxHp → fully restored
    expect(engine.state.playerHp).toBe(40);
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

  it('decrements the player potion count by one', () => {
    const player = makeFastPlayer();
    player.takeDamage(10);
    const potionsBefore = player.state.potions;
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerPotion();
    expect(player.state.potions).toBe(potionsBefore - 1);
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
    // skeleton: atk(5)-effectiveDef(1)+var(1)=5, halved by defend → floor(5*0.5)=2 dmg → 40-2=38
    expect(engine.state.playerHp).toBe(38);
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
    engine.state.log.push('middle entry');
    engine.state.log.push('final entry');
    const log = engine.getRecentLog(1);
    expect(log.length).toBe(1);
    expect(log[0]).toBe('final entry');
  });

  it('defaults to 3 entries', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy());
    // Seed more than 3 entries so the slice is actually exercised
    for (let i = 0; i < 5; i++) engine.state.log.push(`entry ${i}`);
    expect(engine.getRecentLog().length).toBe(3);
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

  it('PLAYER_ANIMATING → ENEMY_ACTION when enemy is alive after 20 frames', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ANIMATING;
    engine.state.animationFrame = 20;
    // Enemy is alive (default HP > 0) → must hand off to enemy turn, not DONE or any other phase
    engine.update();
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('PLAYER_ANIMATING → DONE when enemy is dead after 20 frames', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ANIMATING;
    engine.state.enemyHp = 0;
    engine.state.animationFrame = 20;
    engine.update();
    expect(engine.state.phase).toBe(CombatPhase.DONE);
  });

  it('ENEMY_ANIMATING → PLAYER_ACTION when player is alive after 20 frames', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.ENEMY_ANIMATING;
    engine.state.animationFrame = 20;
    // Player is alive (default HP > 0) → must return to player turn, not DONE or any other phase
    engine.update();
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('ENEMY_ANIMATING → DONE when player is dead after 20 frames', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.phase = CombatPhase.ENEMY_ANIMATING;
    engine.state.playerHp = 0;
    engine.state.animationFrame = 20;
    engine.update();
    expect(engine.state.phase).toBe(CombatPhase.DONE);
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
    // Fresh player: xp=0, level=1 (needs 25 XP). Wolf gives 8 XP — no level-up occurs.
    const { player, engine, enemy } = winFight();
    const xpBefore = player.state.xp;
    const { xp } = engine.computeRewards();
    expect(xp).toBe(enemy.xp); // Wolf gives exactly 8 XP — not just "some" XP
    player.gainXp(xp);
    expect(player.state.xp).toBe(xpBefore + xp);
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
    // Verify actual values, not just mutual consistency: {xp:0,gold:0} would pass the above
    expect(r1.xp).toBe(8);   // wolf.xp = 8
    expect(r1.gold).toBe(3); // Math.random()=0.1 < 0.5 → wolf.gold = 3
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
    // bleed(2) + skeleton attack(2, random=0.5 → variance=1, atk5 - def4 + 1 = 2) = 4 total
    expect(hpBefore - engine.state.playerHp).toBe(4);
  });

  it('BLEED deals exactly 2 damage — no more, no less', () => {
    // Contract: tickPlayerEffects() applies exactly 2 HP of bleed damage.
    // Stun the enemy so it cannot also attack, isolating bleed as the sole damage source.
    const player = makeFastPlayer();
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 2 });
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });

    const hpBefore = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();

    expect(engine.state.playerHp).toBe(hpBefore - 2);
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
    expect(engine.state.nextAttackBonus).toBe(-2); // Math.min(0, -2) = exactly -2
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
    // wolf: atk(5)-effectiveDef(1)+var(1)=5 dmg → 40-5=35
    expect(engine.state.playerHp).toBe(35);
  });
});

describe('Enemy AI — Bandit Archer alternating', () => {
  it('fires ranged shot (logs "arrow") on odd turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makeFastPlayer();
    player.state.def = 0; // ensure archer damage isn't absorbed
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT_ARCHER));
    const hpBefore = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // enemyTurnCount becomes 1 (odd)
    expect(engine.state.log.some(l => l.includes('arrow'))).toBe(true);
    // archer arrow: atk(7)-effectiveDef(1*0.7)+var(1)=floor(7.3)=7 dmg → 40-7=33
    expect(engine.state.playerHp).toBe(33);
  });

  it('uses melee attack (logs "knife") on even turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makeFastPlayer();
    player.state.def = 0; // ensure melee damage isn't absorbed
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT_ARCHER));
    // Advance to second enemy turn
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1 (odd → arrow)
    const hpBeforeKnife = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 2 (even → knife)
    expect(engine.state.log.some(l => l.includes('knife'))).toBe(true);
    // archer knife: atk(7)-effectiveDef(1)+var(1)=7 dmg → 33-7=26
    expect(engine.state.playerHp).toBe(26);
  });
});

describe('Enemy AI — Skeleton healing', () => {
  it('skeleton heals on its 3rd turn and logs it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // attack (not defend)
    const enemy = makeEnemy(EnemyType.SKELETON);
    enemy.hp = 15; // below max (20) so heal has room
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 15;

    // Run 3 enemy turns to reach the healing turn
    for (let t = 0; t < 3; t++) {
      engine.state.phase = CombatPhase.ENEMY_ACTION;
      engine.enemyTurn();
    }
    expect(engine.state.log.some(l => l.includes('mends'))).toBe(true);
    // Skeleton heals +5 HP on turn 3: min(maxHp=20, 15+5) = 20
    expect(engine.state.enemyHp).toBe(20);
  });

  it('skeleton does not heal on non-3rd turns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.enemyHp = 15;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1 — no heal
    expect(engine.state.log.some(l => l.includes('mends'))).toBe(false);
  });

  it('skeleton heal is capped at maxHp — 17 HP + 5 must not overflow to 22', () => {
    // The companion test above uses hp=15 so 15+5=20=maxHp exactly, meaning
    // Math.min has no observable effect there.  At 17 HP, 17+5=22 > maxHp=20,
    // so this test requires the Math.min(enemy.maxHp, ...) cap to actually fire.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // > 0.40 → skeleton attacks (not defends)
    const enemy = makeEnemy(EnemyType.SKELETON);
    enemy.hp = 17; // 17 + 5 = 22 > maxHp=20; cap must clamp to 20
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 17;

    for (let t = 0; t < 3; t++) {
      engine.state.phase = CombatPhase.ENEMY_ACTION;
      engine.enemyTurn();
    }
    expect(engine.state.enemyHp).toBe(20); // min(maxHp=20, 17+5=22) = 20, not 22
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

  it('Scout branch: skips ability body when abilityUsedThisCombat is already true (guard bypassed)', () => {
    // The getAvailableAbility() guard at the top of playerUseAbility normally prevents
    // reaching this branch when abilityUsedThisCombat is true.  Mock it to document
    // that the inner if(!abilityUsedThisCombat) guard also handles this case defensively.
    const player = makeFastPlayer();
    player.state.classPath = ClassPath.SCOUT;
    player.state.level = 1;
    const engine = new CombatEngine(player, makeEnemy());
    engine.state.abilityUsedThisCombat = true;
    vi.spyOn(engine, 'getAvailableAbility').mockReturnValue('Ambush');
    const phaseBefore = engine.state.phase;
    engine.playerUseAbility();
    // inner guard at line 510 fires: ability is NOT executed a second time
    expect(engine.state.phase).toBe(phaseBefore);
    expect(engine.state.log.some(l => l.includes('Ambush'))).toBe(false);
  });
});

describe('CombatEngine.playerUseAbility — no class path fallthrough', () => {
  it('exits cleanly when no weapon ability and no class path (guard bypassed)', () => {
    // With level < 3 and no classPath, getAvailableAbility() returns null and the method
    // exits early.  Mocking getAvailableAbility lets us reach and exercise the
    // `if (player.classPath)` false branch at line 498 directly.
    const player = makePlayer(); // level 1, rusty_shortsword, no classPath
    const engine = new CombatEngine(player, makeEnemy());
    vi.spyOn(engine, 'getAvailableAbility').mockReturnValue('FakeAbility');
    const phaseBefore = engine.state.phase;
    engine.playerUseAbility();
    // neither weapon nor class branch matches — phase is unchanged
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

// ===========================================================================
// Coverage completion: AI variants, abilities, status effects, phase guards
// ===========================================================================
describe('CombatEngine — action phase guards', () => {
  function engineInEnemyPhase() {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.ENEMY_ACTION;
    return e;
  }

  it('playerDefend is a no-op outside PLAYER_ACTION', () => {
    const e = engineInEnemyPhase();
    e.playerDefend();
    expect(e.state.defendingThisTurn).toBe(false);
  });

  it('playerPotion is a no-op outside PLAYER_ACTION', () => {
    const e = engineInEnemyPhase();
    expect(e.playerPotion()).toBe(false);
  });

  it('playerFlee is a no-op outside PLAYER_ACTION', () => {
    const e = engineInEnemyPhase();
    expect(e.playerFlee()).toBe(false);
  });

  it('playerUseAbility is a no-op outside PLAYER_ACTION', () => {
    const p = makePlayer();
    p.state.level = 3;
    p.equipWeapon('dagger');
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.ENEMY_ACTION;
    e.playerUseAbility();
    // Should not have changed to an animating phase
    expect(e.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('playerUseAbility does nothing when no ability is available', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy()); // level 1, basic weapon
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility();
    expect(e.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });
});

describe('CombatEngine — flee class modifier reaches the calc', () => {
  it('Warrior classBonus (-0.1) applies when it is the player turn', () => {
    const p = makePlayer();
    p.state.classPath = ClassPath.WARRIOR;
    const enemy = makeEnemy();
    enemy.agi = 10; // remove the AGI flee bonus
    const e = new CombatEngine(p, enemy);
    e.state.phase = CombatPhase.PLAYER_ACTION; // force player turn
    vi.spyOn(Math, 'random').mockReturnValue(0.45); // >= 0.4 → fail
    expect(e.playerFlee()).toBe(false);
  });
});

describe('CombatEngine — enemy AI branches', () => {
  function runEnemyTurn(type: EnemyType, randomValue: number, mutate?: (e: CombatEngine) => void) {
    const e = new CombatEngine(makePlayer(), makeEnemy(type));
    e.state.phase = CombatPhase.ENEMY_ACTION;
    if (mutate) mutate(e);
    vi.spyOn(Math, 'random').mockReturnValue(randomValue);
    e.enemyTurn();
    return e;
  }

  it('Skeleton raises a shield of bones', () => {
    const e = runEnemyTurn(EnemyType.SKELETON, 0.1); // < 0.4 → shield
    expect(e.state.enemyDefending).toBe(true);
    expect(e.state.log.some(l => l.includes('shield of bones'))).toBe(true);
  });

  it('Skeleton mends its bones every third turn', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    e.state.phase = CombatPhase.ENEMY_ACTION;
    e.state.enemyTurnCount = 2;       // next turn → 3 → heals
    e.state.enemyHp = 5;
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    e.enemyTurn();
    expect(e.state.log.some(l => l.includes('mends its bones'))).toBe(true);
  });

  it('Wild Boar stamps its hooves', () => {
    const e = runEnemyTurn(EnemyType.WILD_BOAR, 0.95); // >= 0.9 → stamp
    expect(e.state.enemyDefending).toBe(true);
    expect(e.state.log.some(l => l.includes('stamps its hooves'))).toBe(true);
  });

  it('Revenant Knight enters phase two and inflicts bleed', () => {
    const e = runEnemyTurn(EnemyType.REVENANT_KNIGHT, 0.1, (eng) => {
      eng.state.enemyHp = 10; // < 50% of 60 → phase two
    });
    expect(e.state.enemyIsPhaseTwo).toBe(true);
    expect(e.state.playerStatusEffects.some(s => s.type === StatusEffectType.BLEED)).toBe(true);
  });

  it('Revenant Knight phase two can raise its cursed blade', () => {
    const e = runEnemyTurn(EnemyType.REVENANT_KNIGHT, 0.95, (eng) => {
      eng.state.enemyHp = 10;
      eng.state.enemyIsPhaseTwo = true;
    });
    expect(e.state.enemyDefending).toBe(true);
    expect(e.state.log.some(l => l.includes('cursed blade'))).toBe(true);
  });

  it('Revenant Knight phase one braces for the attack', () => {
    const e = runEnemyTurn(EnemyType.REVENANT_KNIGHT, 0.1); // full HP, < 0.25 → brace
    expect(e.state.enemyDefending).toBe(true);
  });

  it('Revenant Knight phase one attacks otherwise', () => {
    const e = runEnemyTurn(EnemyType.REVENANT_KNIGHT, 0.5); // full HP, >= 0.25 → attack
    expect(e.state.log.some(l => l.includes('deals'))).toBe(true);
  });

  it('default AI makes a desperate attack at low HP', () => {
    const e = runEnemyTurn(EnemyType.BANDIT, 0.1, (eng) => {
      eng.state.enemyHp = 2; // < 25% → desperate (0.1 < 0.3)
    });
    expect(e.state.log.some(l => l.includes('desperate attack'))).toBe(true);
  });

  it('default AI braces for the attack', () => {
    const e = runEnemyTurn(EnemyType.BANDIT, 0.1); // full HP, 0.1 < 0.2 → defend
    expect(e.state.enemyDefending).toBe(true);
  });

  it('enemyTurn is a no-op outside ENEMY_ACTION', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    const before = e.state.enemyTurnCount;
    e.enemyTurn();
    expect(e.state.enemyTurnCount).toBe(before);
  });

  it('enemyTurn ends in DONE when the enemy is already dead', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.ENEMY_ACTION;
    e.state.enemyHp = 0;
    e.enemyTurn();
    expect(e.state.phase).toBe(CombatPhase.DONE);
  });
});

describe('CombatEngine — bleed can kill the player on their enemy turn', () => {
  it('a bleeding player at 1 HP falls before the enemy acts', () => {
    const p = makePlayer();
    p.state.hp = 1;
    const e = new CombatEngine(p, makeEnemy());
    e.state.playerHp = 1;
    e.state.phase = CombatPhase.ENEMY_ACTION;
    e.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 2 });
    e.enemyTurn();
    expect(e.state.phase).toBe(CombatPhase.DONE);
    expect(e.state.log.some(l => l.includes('fallen'))).toBe(true);
  });
});

describe('CombatEngine — status effect refresh and expiry', () => {
  it('Intimidate re-applied refreshes the existing WEAKEN effect', () => {
    const p = makePlayer();
    p.state.classPath = ClassPath.BRIGAND;
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility(); // first WEAKEN
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility(); // refresh existing WEAKEN
    const weaken = e.state.enemyStatusEffects.filter(s => s.type === StatusEffectType.WEAKEN);
    expect(weaken.length).toBe(1);
    expect(weaken[0].magnitude).toBe(3);
  });

  it('WEAKEN expiry is announced when it ticks to zero', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.enemyStatusEffects.push({
      type: StatusEffectType.WEAKEN, turnsRemaining: 1, magnitude: 3,
    });
    e.state.phase = CombatPhase.ENEMY_ANIMATING;
    e.state.animationFrame = 21; // trigger end-of-animation tick
    e.update();
    expect(e.state.log.some(l => l.includes('no longer weakened'))).toBe(true);
  });
});

describe('CombatEngine — dagger Backstab ability', () => {
  function daggerEngine() {
    const p = makePlayer();
    p.state.level = 3;
    p.equipWeapon('dagger');
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    return e;
  }

  it('Backstab strikes off-guard when the enemy just defended', () => {
    const e = daggerEngine();
    e.state.enemyJustDefended = true;
    mockAttacks([0, 0, 0]); // no miss, variance 0, no crit
    e.playerUseAbility();
    expect(e.state.log.some(l => l.includes('off-guard'))).toBe(true);
    expect(e.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
  });

  it('Backstab goes for a backstab when the enemy did not defend', () => {
    const e = daggerEngine();
    e.state.enemyJustDefended = false;
    mockAttacks([0, 0, 0]);
    e.playerUseAbility();
    expect(e.state.log.some(l => l.includes('backstab'))).toBe(true);
  });

  it('Backstab that drops the enemy logs a defeat', () => {
    const e = daggerEngine();
    e.state.enemyHp = 1;
    mockAttacks([0, 0, 0.99]); // hit
    e.playerUseAbility();
    expect(e.state.enemyHp).toBe(0);
    expect(e.state.log.some(l => l.includes('is defeated'))).toBe(true);
  });

  it('Backstab doubles the dagger crit chance — crits at values between 0.3 and 0.6', () => {
    // dagger.critChance=0.3; Backstab applies critMultiplier=2 → effective critChance=0.6.
    // A crit roll of 0.5 misses the base threshold (0.5 >= 0.3 → no crit for a regular attack)
    // but falls within the Backstab range (0.5 < 0.6 → crit). If critMultiplier were ever
    // dropped to 1 this test would fail: damage would be 2 (no crit) instead of 4 (crit).
    const e = daggerEngine(); // level 3, dagger, PLAYER_ACTION phase
    e.state.enemyJustDefended = false;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)    // miss check: 0 < 0 (missChance) → no miss
      .mockReturnValueOnce(0.25) // variance: floor(0.25*4)-1 = 0
      .mockReturnValueOnce(0.5); // crit: 0.5 < 0.6 (doubled) → CRIT; 0.5 >= 0.3 so base rate wouldn't crit
    const hpBefore = e.state.enemyHp;
    e.playerUseAbility();
    const damage = hpBefore - e.state.enemyHp;
    // str(5)+dagger bonus(1)−skeleton def(4)+var(0) = 2 base; crit doubles → 4
    expect(damage).toBe(4);
    expect(e.state.log.some(l => l.includes('Critical'))).toBe(true);
  });
});

describe('CombatEngine — Mace Shatter on already-broken armor', () => {
  it('reports armor already broken when enemy DEF is 0', () => {
    const p = makePlayer();
    p.state.level = 3;
    p.equipWeapon('mace');
    const enemy = makeEnemy();
    enemy.def = 0;
    const e = new CombatEngine(p, enemy);
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility();
    expect(e.state.log.some(l => l.includes('already broken'))).toBe(true);
  });
});

describe('CombatEngine — Scout Ambush defeats the enemy', () => {
  it('logs a defeat when the guaranteed crit finishes the enemy', () => {
    const p = makePlayer();
    p.state.classPath = ClassPath.SCOUT;
    const enemy = makeEnemy();
    enemy.hp = 1;
    const e = new CombatEngine(p, enemy);
    e.state.enemyHp = 1;
    e.state.phase = CombatPhase.PLAYER_ACTION;
    mockAttacks([0, 0, 0]); // miss roll, variance — forceCrit makes crit guaranteed
    e.playerUseAbility();
    expect(e.state.enemyHp).toBe(0);
    expect(e.state.log.some(l => l.includes('is defeated'))).toBe(true);
  });
});

describe('CombatEngine — player attack into a defending enemy', () => {
  it('clears the enemyDefending flag, deals damage, and enters PLAYER_ANIMATING', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.state.enemyDefending = true;
    const hpBefore = e.state.enemyHp;
    mockAttacks([0, 0, 0]); // no miss, zero variance, no crit
    e.playerAttack();
    // playerAttack() must reset the flag before striking — removing this reset
    // would cause executePlayerAttack to double the enemy's DEF, breaking the game flow.
    expect(e.state.enemyDefending).toBe(false);
    // str(5)+damageBonus(2)=7, variance=floor(0*4)-1=-1, def=4 → max(1,7-4-1)=2; hp 20→18
    expect(e.state.enemyHp).toBe(18);
    // Turn must advance to the animating phase.
    expect(e.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
  });
});

describe('CombatEngine — update phase transitions', () => {
  it('enemy animation ending with a dead player ends combat', () => {
    const p = makePlayer();
    p.state.hp = 0;
    const e = new CombatEngine(p, makeEnemy());
    e.state.playerHp = 0;
    e.state.phase = CombatPhase.ENEMY_ANIMATING;
    e.state.animationFrame = 21;
    e.update();
    expect(e.state.phase).toBe(CombatPhase.DONE);
  });

  it('RESULT phase advances to DONE after the timer elapses', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.RESULT;
    for (let i = 0; i < 62; i++) e.update();
    expect(e.state.phase).toBe(CombatPhase.DONE);
  });
});

describe('CombatEngine — applyStatusEffect refreshes a magnitude-less existing effect', () => {
  it('Shield Bash applied twice refreshes turnsRemaining without adding a magnitude', () => {
    const player = makePlayer();
    player.state.classPath = ClassPath.WARRIOR;
    const engine = new CombatEngine(player, makeEnemy());

    // First Shield Bash: creates a STUN with no magnitude
    engine.playerUseAbility();
    expect(engine.state.enemyStatusEffects).toHaveLength(1);
    const firstStun = engine.state.enemyStatusEffects[0];
    expect(firstStun.type).toBe(StatusEffectType.STUN);
    expect(firstStun.magnitude).toBeUndefined();

    // Re-enable the ability
    engine.state.phase = CombatPhase.PLAYER_ACTION;

    // Second Shield Bash: finds existing STUN and refreshes turnsRemaining only
    engine.playerUseAbility();
    const effects = engine.state.enemyStatusEffects.filter(e => e.type === StatusEffectType.STUN);
    expect(effects).toHaveLength(1); // no duplicate
    expect(effects[0].turnsRemaining).toBe(1); // refreshed
    expect(effects[0].magnitude).toBeUndefined(); // still no magnitude
  });
});

describe('CombatEngine.getResult — fled outcome', () => {
  it('returns "fled" when combat is done with both combatants alive', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // guaranteed flee success
    e.playerFlee();
    expect(e.isDone()).toBe(true);
    expect(e.getResult()).toBe('fled');
  });

  it('returns "ongoing" while combat is still active', () => {
    const e = new CombatEngine(makePlayer(), makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    expect(e.getResult()).toBe('ongoing');
  });
});

// ---------------------------------------------------------------------------
// Branch-coverage completions: enemyDefending true path, non-BLEED player
// effect in tickPlayerEffects, non-WEAKEN enemy effect in tickEnemyEffects
// ---------------------------------------------------------------------------

describe('CombatEngine — executePlayerAttack with a defending enemy', () => {
  it('uses doubled enemy DEF when enemyDefending is true, capping damage at minimum 1', () => {
    // playerAttack() resets enemyDefending to false before calling executePlayerAttack,
    // so we call the private method directly to reach the defending branch (line 111).
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)   // miss check (dagger: missChance=0, consumed but irrelevant)
      .mockReturnValueOnce(0.25)  // variance: floor(0.25*4)-1 = 0
      .mockReturnValueOnce(0.9);  // crit check: 0.9 >= 0.3, no crit

    const player = makeFastPlayer(); // dagger, STR=5, damageBonus=1 → attackPower=6
    const enemy = makeEnemy(EnemyType.SKELETON); // DEF=4; defending → effectiveDef=8
    const engine = new CombatEngine(player, enemy);
    const hpBefore = engine.state.enemyHp;

    engine.state.enemyDefending = true;
    (engine as any).executePlayerAttack(); // bypass playerAttack()'s enemyDefending reset

    // effectiveDef=8, attackPower=6, variance=0: max(1, 6-8+0) = 1
    expect(hpBefore - engine.state.enemyHp).toBe(1);
  });
});

describe('CombatEngine — tickPlayerEffects skips damage for non-BLEED effects', () => {
  it('a STUN in playerStatusEffects is decremented without dealing bleed damage', () => {
    const player = makeFastPlayer();
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    engine.state.playerStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 2 });

    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // skeleton: 0.5 >= 0.4 → attacks

    engine.enemyTurn(); // tickPlayerEffects runs before the skeleton attacks

    expect(engine.state.log.some(l => l.includes('bleed'))).toBe(false);
    expect(engine.state.playerStatusEffects[0]?.turnsRemaining).toBe(1);
  });
});

describe('CombatEngine — tickEnemyEffects expires non-WEAKEN effects silently', () => {
  it('an expiring STUN in enemyStatusEffects is removed without a "no longer weakened" message', () => {
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });

    engine.state.phase = CombatPhase.ENEMY_ANIMATING;
    engine.state.animationFrame = 20; // after ++ → 21 > 20 → tickEnemyEffects fires

    engine.update();

    expect(engine.state.enemyStatusEffects).toHaveLength(0);
    expect(engine.state.log.some(l => l.includes('no longer weakened'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ignoresDefense formula — pins the armor-piercing damage calculation
// ---------------------------------------------------------------------------

describe('CombatEngine — ignoresDefense formula in executePlayerAttack', () => {
  // calcDamage: effectiveDef = defense * (1 - ignoresDefense)
  // damage = max(1, attackPower - effectiveDef + variance)
  //
  // Mock sequence per attack: [miss_check, variance, crit_check]
  // Variance mock 0.25 → Math.floor(0.25*4) - 1 = Math.floor(1) - 1 = 0

  it('mace (ignoresDefense=0.5) halves effective DEF, producing damage = max(1, atk - def*0.5 + 0)', () => {
    // mace: missChance=0, critChance=0, ignoresDefense=0.5, damageBonus=5
    // player str=5 → attackPower = 5+5 = 10
    // SKELETON def=4, agi=2; mace is SLOW: player goes first when agi > enemyAgi+3 = 2+3=5
    // effectiveDef = 4 * (1 - 0.5) = 2
    // expected damage = max(1, 10 - 2 + 0) = 8
    mockAttacks([0.5, 0.25, 0.5]);
    const player = makePlayer(); // str=5, agi=3 by default
    player.equipWeapon('mace');
    player.state.agi = 10; // 10 > 2+3=5 → player goes first with SLOW mace
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8);
  });

  it('rusty_shortsword (ignoresDefense=0) applies full DEF, producing damage = max(1, atk - def + 0)', () => {
    // rusty_shortsword: missChance=0, critChance=0, ignoresDefense=0, damageBonus=2
    // player str=5 → attackPower = 5+2 = 7
    // SKELETON def=4, agi=2; NORMAL: player goes first when agi >= enemyAgi = 3 >= 2 ✓
    // effectiveDef = 4 * (1 - 0) = 4
    // expected damage = max(1, 7 - 4 + 0) = 3
    mockAttacks([0.5, 0.25, 0.5]);
    const player = makePlayer(); // str=5, agi=3; rusty_shortsword equipped by default
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(3);
  });

  it('ignoresDefense=0.5 vs ignoresDefense=0 yields strictly more damage against a defended enemy', () => {
    // Confirms that ignoresDefense=0.5 always deals more than ignoresDefense=0
    // when the enemy has non-zero DEF, holding variance constant.
    // SKELETON def=4: mace damage=8, rusty damage=3 → 8 > 3 ✓
    mockAttacks([0.5, 0.25, 0.5]);
    const macePl = makePlayer();
    macePl.equipWeapon('mace');
    macePl.state.agi = 10;
    const maceEngine = new CombatEngine(macePl, makeEnemy(EnemyType.SKELETON));
    const maceHpBefore = maceEngine.state.enemyHp;
    maceEngine.playerAttack();
    const maceDmg = maceHpBefore - maceEngine.state.enemyHp;

    mockAttacks([0.5, 0.25, 0.5]);
    const rustyPl = makePlayer();
    const rustyEngine = new CombatEngine(rustyPl, makeEnemy(EnemyType.SKELETON));
    const rustyHpBefore = rustyEngine.state.enemyHp;
    rustyEngine.playerAttack();
    const rustyDmg = rustyHpBefore - rustyEngine.state.enemyHp;

    // mace: str(5)+bonus(5)=10, effectiveDef=4*0.5=2, var=0 → damage=8
    // rusty: str(5)+bonus(2)=7, effectiveDef=4, var=0 → damage=3
    expect(maceDmg).toBe(8);
    expect(rustyDmg).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Behavioral contracts: pin damage formulas and effect mechanics that the
// existing tests exercise only shallowly (log-only or any-damage checks).
// ---------------------------------------------------------------------------

describe('CombatEngine — Wolf howl overrides a defend bonus', () => {
  it('Math.min(nextAttackBonus, -2) sets bonus to -2 even when player just defended', () => {
    // playerDefend() sets nextAttackBonus = +1.  If the wolf howls on the very next
    // enemy turn the formula Math.min(+1, -2) = -2 negates that bonus entirely.
    // Regression guard: changing the howl to a plain `= -2` assignment would still
    // pass this test, but changing it to `+= -2` (additive) would produce -1 and fail.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → howl
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.state.nextAttackBonus = 1; // player defended last turn
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.nextAttackBonus).toBe(-2);
  });
});

describe('CombatEngine — Bandit Archer arrow ignoresDefense=0.3 vs knife ignoresDefense=0', () => {
  it('arrow deals strictly more damage than knife against a player with non-zero effective DEF', () => {
    // Arrow turn (odd): executeEnemyAttack(1, 0.3) → effectiveDef = 4 * 0.7 = 2.8 → floored to integer
    // Knife turn (even): executeEnemyAttack(1, 0)  → effectiveDef = 4 * 1.0 = 4.0
    // With ATK=7 and variance=1 (random=0.5): arrowDmg=floor(5.2)=5 > knifeDmg=4.
    // This would fail if ignoresDefense were removed from the archer's ranged attack.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makePlayer(); // effectiveDef = state.def(3) + leatherVest(1) = 4
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT_ARCHER));

    const hpStart = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1: arrow (ignoresDefense=0.3)
    const arrowDrop = hpStart - engine.state.playerHp;

    const hpBeforeKnife = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 2: knife (ignoresDefense=0)
    const knifeDrop = hpBeforeKnife - engine.state.playerHp;

    expect(arrowDrop).toBe(5); // floor(7 - 4*0.7 + 1) = floor(5.2) = 5
    expect(knifeDrop).toBe(4); // floor(7 - 4*1.0 + 1) = 4
  });

  it('arrow damage is a whole number — not fractional despite ignoresDefense=0.3', () => {
    // Bandit Archer ATK=7, ignoresDefense=0.3. Player effectiveDef = def(3) + leather_vest(1) = 4.
    // effectiveDef = 4 * (1-0.3) = 2.8 — a non-integer.
    // Without Math.floor in calcDamage: damage = max(1, 7-2.8+1) = 5.2 → HP becomes 34.8 (fractional).
    // The log would then print "deals 5.2 damage" and HP bars would show decimals.
    // With Math.floor: damage = max(1, floor(5.2)) = 5 → HP stays integer.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // variance = floor(0.5*4)-1 = 1, no crit
    const player = makePlayer(); // effectiveDef = 4
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT_ARCHER));
    const hpBefore = engine.state.playerHp;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1: arrow
    const damage = hpBefore - engine.state.playerHp;
    // Pinned: ATK=7 - effectiveDef=2.8 + variance=1 = 5.2 → floor → 5.
    expect(damage).toBe(5);
    expect(Number.isInteger(engine.state.playerHp)).toBe(true);
  });
});

describe('CombatEngine — Wild Boar charge exact damage (1.2× ATK multiplier)', () => {
  it('charge applies floor(ATK * 1.2) attack power — pins the exact damage dealt', () => {
    // Boar ATK=7. floor(7 * 1.2) = 8.  Player effectiveDef=4.  Variance=1 (random=0.5).
    // damage = max(1, 8 - 4 + 1) = 5.
    // If the 1.2× multiplier were removed (normal ATK=7): max(1, 7 - 4 + 1) = 4 — test fails.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makePlayer(); // effectiveDef = 3 + 1 = 4
    const engine = new CombatEngine(player, makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    const hpBefore = engine.state.playerHp;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(hpBefore - 5);
  });
});

describe('CombatEngine — Backstab 2× crit multiplier', () => {
  it('crits at roll=0.5 (2× dagger critChance = 0.6 > 0.5)', () => {
    // Dagger critChance=0.3.  Backstab passes critMultiplier=2 → baseCrit=min(1, 0.6)=0.6.
    // Roll 0.5 satisfies 0.5 < 0.6 → crit.  If the multiplier were dropped to 1, baseCrit=0.3
    // and 0.5 < 0.3 is false — no crit, test fails.
    const p = makeFastPlayer(); // dagger
    p.state.level = 3;
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    mockAttacks([0, 0, 0.5]); // no miss, zero variance, crit roll = 0.5
    e.playerUseAbility(); // Backstab
    expect(e.state.log.some(l => l.includes('Critical'))).toBe(true);
  });

  it('normal dagger attack does NOT crit at roll=0.5 (critChance=0.3 < 0.5)', () => {
    // Confirms the crit threshold: same roll that triggers Backstab leaves a normal attack cold.
    const p = makeFastPlayer();
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    mockAttacks([0, 0, 0.5]); // crit roll 0.5 → 0.5 < 0.3 = false
    e.playerAttack();
    expect(e.state.log.some(l => l.includes('Critical'))).toBe(false);
  });
});

describe('CombatEngine — Revenant Knight phase-2 BLEED refreshes rather than stacks', () => {
  it('two consecutive phase-2 hits leave exactly one BLEED entry with turnsRemaining=3', () => {
    // applyStatusEffect finds the existing BLEED and resets its duration instead of pushing
    // a second entry.  If it always pushed, bleeds.length would be 2 and the player would
    // take 4 bleed damage/turn instead of the intended 2.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → phase-2 attack each turn
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 10; // below 50% → phase 2
    engine.state.enemyIsPhaseTwo = true;

    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // first hit: BLEED applied (turnsRemaining=3)

    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // second hit: tickPlayerEffects ticks to 2, then applyStatusEffect refreshes to 3

    const bleeds = engine.state.playerStatusEffects.filter(e => e.type === StatusEffectType.BLEED);
    expect(bleeds).toHaveLength(1);
    expect(bleeds[0].turnsRemaining).toBe(3);
  });
});

describe('CombatEngine — nextAttackBonus actually affects damage and resets after use', () => {
  // nextAttackBonus is set by playerDefend (+1) and wolf howl (-2), but no prior
  // test verifies that it changes the damage dealt on the next attack.  These tests
  // exercise the full path from bonus → damage calculation → reset.
  //
  // Setup: makePlayer() starts with STR=5 and rusty_shortsword (damageBonus=2,
  // missChance=0, critChance=0). makeEnemy(SKELETON) has DEF=4.
  // Baseline damage (variance=0, no bonus): max(1, (5+2) - 4 + 0) = 3.
  // mockAttacks([miss, variance, crit]):
  //   miss=0   → 0 < missChance(0) = false → no miss
  //   variance=0.25 → floor(0.25×4)−1 = 0  → variance = 0
  //   crit=0   → 0 < critChance(0) = false → no crit

  it('defend bonus (+1) increases next attack damage by exactly 1', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.nextAttackBonus = 1;
    engine.state.phase = CombatPhase.PLAYER_ACTION;

    mockAttacks([0, 0.25, 0]);
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();

    // attackPower = (5+2) + 1 = 8; damage = max(1, 8-4+0) = 4 (not 3)
    expect(engine.state.enemyHp).toBe(hpBefore - 4);
  });

  it('nextAttackBonus is reset to 0 after the attack consumes it', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.nextAttackBonus = 1;
    engine.state.phase = CombatPhase.PLAYER_ACTION;

    mockAttacks([0, 0.25, 0]);
    engine.playerAttack();

    expect(engine.state.nextAttackBonus).toBe(0);
  });

  it('wolf howl penalty (-2) reduces next attack damage by exactly 2', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.nextAttackBonus = -2;
    engine.state.phase = CombatPhase.PLAYER_ACTION;

    mockAttacks([0, 0.25, 0]);
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();

    // attackPower = (5+2) + (-2) = 5; damage = max(1, 5-4+0) = 1 (not 3)
    expect(engine.state.enemyHp).toBe(hpBefore - 1);
  });

  it('penalty (-2) is also reset to 0 after the attack consumes it', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.nextAttackBonus = -2;
    engine.state.phase = CombatPhase.PLAYER_ACTION;

    mockAttacks([0, 0.25, 0]);
    engine.playerAttack();

    expect(engine.state.nextAttackBonus).toBe(0);
  });
});

describe('CombatEngine — Pin stun lasts exactly 1 turn', () => {
  it('turnsRemaining=1 — increasing to 2 would skip the enemy twice, breaking balance', () => {
    // Pin applies STUN. The existing test only asserts STUN exists but not its duration.
    // If turnsRemaining were changed from 1 to 2 or 3 (accidentally doubling the skip window)
    // no previous test would catch it. This pins the contract.
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.level = 3;
    player.state.agi = 10; // ensures player goes first (ranged: agi >= enemy agi)
    mockAttacks([0, 0, 0]); // consume the free opening shot fired by the RANGED constructor
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerUseAbility(); // Pin
    const stun = engine.state.enemyStatusEffects.find(e => e.type === StatusEffectType.STUN);
    expect(stun).toBeDefined();
    expect(stun!.turnsRemaining).toBe(1);
  });
});

describe('CombatEngine — Revenant Knight phase-2 attack 1.1× ATK multiplier', () => {
  it('phase-2 attack applies floor(ATK * 1.1) — pins exact damage dealt', () => {
    // Revenant Knight ATK=10. floor(10 * 1.1) = 11. playerEffectiveDef = 3 + 1 = 4.
    // Variance = floor(0.5 * 4) - 1 = 1. damage = max(1, 11 - 4 + 1) = 8.
    // Without the 1.1× multiplier: max(1, 10 - 4 + 1) = 7 — test fails.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → attack; variance=1; no crit (0.5 < 0 = false)
    const player = makePlayer(); // effectiveDef = def(3) + leather_vest.defBonus(1) = 4
    const engine = new CombatEngine(player, makeEnemy(EnemyType.REVENANT_KNIGHT));
    // Revenant Knight agi=4 > player agi=3 → engine starts in ENEMY_ACTION
    engine.state.enemyHp = 10; // < 50% of 60 — already in phase 2
    engine.state.enemyIsPhaseTwo = true;
    const hpBefore = engine.state.playerHp;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(hpBefore - 8);
  });
});

describe('CombatEngine — default AI desperate attack 1.5× ATK multiplier', () => {
  it('desperate attack applies floor(ATK * 1.5) — pins exact damage dealt', () => {
    // Bandit ATK=6. floor(6 * 1.5) = 9. playerEffectiveDef = 3 + 1 = 4.
    // Variance = floor(0.1 * 4) - 1 = -1. damage = max(1, 9 - 4 + (-1)) = max(1, 4) = 4.
    // Without the 1.5× multiplier: max(1, 6 - 4 - 1) = max(1, 1) = 1 — test fails.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → desperate; variance=-1; no crit
    const player = makePlayer(); // effectiveDef = 4
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT));
    // Bandit agi=3 == player agi=3 → player goes first → need to force ENEMY_ACTION
    engine.state.enemyHp = 2; // < 25% of 18 → desperate attack
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    const hpBefore = engine.state.playerHp;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(hpBefore - 4);
  });
});
