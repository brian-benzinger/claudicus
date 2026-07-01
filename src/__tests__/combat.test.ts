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

  it('adds appearance message naming the enemy to the log', () => {
    // Contract: constructor logs exactly "A <name> appears!" so the player knows
    // who they're fighting. A rename or dropped-name bug must not pass silently.
    const enemy = makeEnemy();
    const engine = new CombatEngine(makePlayer(), enemy);
    expect(engine.state.log[0]).toBe(`A ${enemy.name} appears!`);
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

  it('ranged opening shot reduces enemy HP by the calculated amount', () => {
    // Pins that the opening shot actually executes damage, not just sets a flag.
    // hunting_bow: str(5)+damageBonus(3)=8 attackPower; skeleton def=4; variance=floor(0*4)-1=-1
    // damage = max(1, 8-4-1) = 3; no crit (critChance=0). If executePlayerAttack were ever
    // skipped or made a no-op for the free hit, enemyHp would stay at 20 and this test fails.
    mockAttacks([0, 0, 0]); // miss=0 (no miss), variance=0→-1, crit=0 (no crit)
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    const enemy = makeEnemy(); // skeleton: hp=20, def=4
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.enemyHp).toBe(17); // 20 - 3 damage from opening shot
    expect(engine.state.log.some(l => l.includes('3 damage'))).toBe(true);
  });

  it('FAST weapon (dagger) does not fire an opening shot on construction', () => {
    // Contract: the free opening shot is exclusive to RANGED weapons.
    // The constructor guards with `speed === WeaponSpeed.RANGED`.  If that guard
    // were accidentally dropped, every weapon speed — FAST, NORMAL, SLOW — would
    // fire a free hit at construction time, completely breaking combat balance.
    // The positive case (bow fires) is pinned above; this pins the negative.
    const player = makePlayer();
    player.equipWeapon('dagger'); // FAST
    const enemy = makeEnemy();
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.freeHitUsed).toBe(false);
    expect(engine.state.log.some(l => l.includes('opening shot'))).toBe(false);
    expect(engine.state.enemyHp).toBe(enemy.hp); // no damage dealt at construction
  });

  it('NORMAL weapon (rusty_shortsword) does not fire an opening shot on construction', () => {
    // Same guard for NORMAL speed — the opening shot must not trigger.
    const player = makePlayer(); // defaults to rusty_shortsword (NORMAL)
    const enemy = makeEnemy();
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.freeHitUsed).toBe(false);
    expect(engine.state.log.some(l => l.includes('opening shot'))).toBe(false);
    expect(engine.state.enemyHp).toBe(enemy.hp);
  });

  it('SLOW weapon (mace) does not fire an opening shot on construction', () => {
    // SLOW weapons also must not fire a free hit — only RANGED gets the privilege.
    const player = makePlayer();
    player.equipWeapon('mace'); // SLOW; enemy agi > player agi → enemy goes first
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5; player agi=3 → enemy goes first
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.freeHitUsed).toBe(false);
    expect(engine.state.log.some(l => l.includes('opening shot'))).toBe(false);
    expect(engine.state.enemyHp).toBe(enemy.hp);
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

  it('slow weapon: enemy goes first when playerAgi equals enemyAgi + 3 (strict > not >=)', () => {
    // DESIGN.md: "Player goes second unless AGI is much higher (AGI > enemy AGI + 3)"
    // The condition is strict >: playerAgi must be GREATER THAN enemyAgi+3, not equal to it.
    // At exactly +3, the player does NOT meet the threshold — enemy goes first.
    // This pins the boundary: if > were changed to >=, playerAgi=8 vs wolf(5)+3=8 would
    // wrongly give the player first turn.
    const player = makePlayer();
    player.equipWeapon('mace'); // SLOW
    player.state.agi = 8;       // wolf(5)+3 = 8: 8 > 8 is false → enemy goes first
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('slow weapon: player goes first when playerAgi equals enemyAgi + 4 (just above threshold)', () => {
    // One above the boundary: 9 > wolf(5)+3=8 is true → PLAYER_ACTION.
    // Together with the at-threshold test above, these two pin the exact cutoff so that
    // any off-by-one change to the condition (> vs >=, +3 vs +4) is immediately caught.
    const player = makePlayer();
    player.equipWeapon('mace'); // SLOW
    player.state.agi = 9;       // 9 > wolf(5)+3=8 → player goes first
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
    expect(defendedDamage).toBe(2); // max(1, floor(5 * 0.5)) = 2
  });

  it('defend bonus (+1) reaches the executePlayerAttack damage formula — next attack deals 1 more damage', () => {
    // playerDefend() sets nextAttackBonus=1, and executePlayerAttack adds it to attackPower:
    //   const attackPower = player.computeWeaponDamage() + this.state.nextAttackBonus
    // The existing 'sets defending flag and nextAttackBonus' test only checks that the
    // FIELD is set to 1 — it never verifies the bonus is wired into the attack path.
    // If the "+this.state.nextAttackBonus" term were removed, all other tests still pass
    // because they start attacks with nextAttackBonus=0.  This test requires the +1 to
    // actually flow through to hit point reduction.
    //
    // rusty_shortsword: missChance=0, critChance=0, ignoresDefense=0, damageBonus=2
    // str(5) + damageBonus(2) = 7; skeleton def=4; variance=floor(0.25*4)−1=0
    // Baseline damage (no bonus):   max(1, 7−4+0) = 3
    // With defend bonus (+1):       max(1, 8−4+0) = 4

    // Baseline: plain attack without defending
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)   // miss: 0.5 < 0 = false (no miss)
      .mockReturnValueOnce(0.25)  // variance: floor(1)−1 = 0
      .mockReturnValueOnce(0.9);  // crit: 0.9 >= 0 = no crit
    const baseEngine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    const baseHp = baseEngine.state.enemyHp;
    baseEngine.playerAttack();
    const baselineDamage = baseHp - baseEngine.state.enemyHp;

    vi.restoreAllMocks();

    // Defended: playerDefend sets nextAttackBonus=1 then the player strikes
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)   // miss
      .mockReturnValueOnce(0.25)  // variance: 0
      .mockReturnValueOnce(0.9);  // crit: no crit
    const defEngine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    defEngine.playerDefend(); // nextAttackBonus = 1, phase → ENEMY_ACTION
    defEngine.state.phase = CombatPhase.PLAYER_ACTION; // skip enemy turn
    const defHp = defEngine.state.enemyHp;
    defEngine.playerAttack();
    const defendDamage = defHp - defEngine.state.enemyHp;

    expect(baselineDamage).toBe(3); // pin baseline so the comparison is grounded
    expect(defendDamage).toBe(4);   // 3 + 1 from the defend bonus
  });

  it('defend bonus is reset to 0 after the next attack consumes it', () => {
    // executePlayerAttack() resets this.state.nextAttackBonus = 0 after computing
    // attackPower.  If that line were removed, the bonus would persist and every
    // subsequent attack would also deal extra damage.  This test pins the consume-on-use
    // contract so the bonus cannot silently accumulate across multiple turns.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerDefend(); // nextAttackBonus = 1
    engine.state.phase = CombatPhase.PLAYER_ACTION; // skip enemy turn
    mockAttacks([0.5, 0.25, 0.9]); // no miss, variance=0, no crit
    engine.playerAttack(); // consumes the bonus
    expect(engine.state.nextAttackBonus).toBe(0); // bonus spent — not carried to next attack
  });

  it('defendingThisTurn is reset after enemyTurn — second undefended turn takes full damage', () => {
    // Contract: enemyTurn() resets defendingThisTurn=false after the AI acts, so the
    // damage-halving bonus from playerDefend() expires after exactly one enemy attack.
    // If the reset at the end of enemyTurn() were removed, a second enemy turn (where
    // the player never chose to defend) would also deal halved damage — silent regression.
    //
    // Setup: makeFastPlayer, def=0, skeleton atk=5, random=0.5 throughout.
    // playerDef = def(0) + leatherVest.defBonus(1) = 1
    // raw damage = max(1, 5-1+1) = 5; defended = max(1, floor(5*0.5)) = 2
    const p = makeFastPlayer();
    p.state.def = 0;
    const engine = new CombatEngine(p, makeEnemy(EnemyType.SKELETON));

    // Turn 1: player defends → enemy attacks at half damage
    engine.playerDefend(); // defendingThisTurn=true, phase→ENEMY_ACTION
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hpBeforeTurn1 = engine.state.playerHp;
    engine.enemyTurn();
    const damageTurn1 = hpBeforeTurn1 - engine.state.playerHp;
    expect(damageTurn1).toBe(2); // halved — pin so the contrast below is meaningful

    // After enemyTurn(), the flag must be gone — no defend action this round
    expect(engine.state.defendingThisTurn).toBe(false);

    // Turn 2: force another enemy turn without the player defending
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    const hpBeforeTurn2 = engine.state.playerHp;
    engine.enemyTurn();
    const damageTurn2 = hpBeforeTurn2 - engine.state.playerHp;
    expect(damageTurn2).toBe(5); // full damage — defend did not bleed into this turn
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

  it('logs the exact HP-restored message with the post-heal value', () => {
    // Contract: the combat log shows "You drink a potion. HP restored to <hp>." so the
    // player knows their current HP without opening the inventory.  If the message is
    // reformatted or the HP value is omitted, the UI feedback degrades silently.
    // player.hp starts at 40; take 10 → 30; potion heals 20 → 40 (at maxHp).
    const player = makeFastPlayer();
    player.takeDamage(10); // hp = 30
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerPotion(); // heals to 40; state.playerHp synced
    const expectedHp = engine.state.playerHp; // 40
    expect(engine.state.log.some(l => l === `You drink a potion. HP restored to ${expectedHp}.`)).toBe(true);
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

  it('logs "You flee from battle!" on a successful flee', () => {
    // Contract: the player reads this exact message in the combat log when they escape.
    // If the string changes (e.g. "You escaped!" or the word order shifts) the UI breaks
    // silently and no other test catches it — this one does.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerFlee();
    expect(engine.state.log.some(l => l === 'You flee from battle!')).toBe(true);
  });

  it('fails when random is above flee chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    const result = engine.playerFlee();
    expect(result).toBe(false);
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('logs "Failed to escape!" and sets playerTurn=false on a failed flee', () => {
    // Contract: the player reads this exact message when they fail to flee.
    // playerTurn=false is also checked because it drives the enemy turn in the
    // animation loop — if it stays true the enemy would never act after a failed flee.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerFlee();
    expect(engine.state.log.some(l => l === 'Failed to escape!')).toBe(true);
    expect(engine.state.playerTurn).toBe(false);
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

  it('gold drops at roll=0.499 (just below threshold) but NOT at roll=0.5 — pins the exact < 0.5 boundary', () => {
    // Existing tests use roll=0.1 (drop) and roll=0.9 (no drop); neither constrains the
    // threshold range: changing 0.5 → 0.4 or 0.6 would still pass both.  Rolls of 0.499
    // (success) and 0.5 (failure) pin the exact '< 0.5' condition:
    //   – if threshold became 0.4: 0.499 < 0.4 is false → gold=0 → first expect fails
    //   – if threshold became 0.6: 0.5 < 0.6 is true  → gold=3 → second expect fails
    const enemy = makeEnemy(EnemyType.WOLF); // gold=3

    vi.spyOn(Math, 'random').mockReturnValue(0.499);
    const engine1 = new CombatEngine(makePlayer(), enemy);
    expect(engine1.computeRewards().gold).toBe(3); // 0.499 < 0.5 → gold drops

    vi.restoreAllMocks();

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine2 = new CombatEngine(makePlayer(), enemy);
    expect(engine2.computeRewards().gold).toBe(0); // 0.5 < 0.5 is false → no gold (strict <)
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

  it('defaults to 3 entries and returns the LAST 3 (not the first)', () => {
    const engine = new CombatEngine(makePlayer(), makeEnemy());
    // Seed more than 3 entries so the slice is actually exercised.
    // The behavioral contract is slice(-3): if this were changed to slice(0,3)
    // the length would still be 3 but the content would be wrong.
    for (let i = 0; i < 5; i++) engine.state.log.push(`entry ${i}`);
    expect(engine.getRecentLog()).toEqual(['entry 2', 'entry 3', 'entry 4']);
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

  it('WEAKEN with magnitude 3 reduces the actual player HP by exactly 3 — not the unweckened 6', () => {
    // Contract: executeEnemyAttack() reads the WEAKEN magnitude and subtracts it from
    // the enemy's attackPower before calculating damage.  The existing test in this block
    // checks only the log message ("deals 3"), not the playerHp field.  If WEAKEN were
    // applied to the log string but not to the actual damage path — or if atkReduction
    // were read correctly but subtracted from the wrong variable — the log would still
    // say "3" while the player takes full ATK damage.  This test catches that regression.
    //
    // Bandit ATK=6, player.def=0, effectiveDef=leatherVest(1)=1, random=0.5 → variance=1.
    // Without WEAKEN: attackPower=6, damage=max(1,6-1+1)=6 → playerHp=40-6=34.
    // With WEAKEN(3): attackPower=max(1,6-3)=3, damage=max(1,3-1+1)=3 → playerHp=40-3=37.
    const player = makeFastPlayer();
    player.state.def = 0; // effectiveDef = 0 + leatherVest(1) = 1
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT));
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.WEAKEN, turnsRemaining: 3, magnitude: 3 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(37); // 40 - 3 (weakened), not 40 - 6 (unweckened)
  });

  it('without WEAKEN the same Bandit attack deals 6 damage — confirms the weakened baseline is meaningful', () => {
    // Companion to the WEAKEN HP test: pins the unweakened damage so the two values
    // (37 weakened vs 34 unweakened) are each grounded.  If the formula changed so that
    // an unweakened Bandit also dealt only 3 damage, the weakened test above would pass
    // vacuously.  Together these two tests pin that WEAKEN actually reduces damage.
    //
    // Same setup (player.def=0, random=0.5) but no WEAKEN effect.
    // attackPower=6, damage=max(1,6-1+1)=6 → playerHp=40-6=34.
    const player = makeFastPlayer();
    player.state.def = 0;
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(34); // 40 - 6 (full ATK)
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

  it('wolf howl overrides the defend bonus — nextAttackBonus becomes -2, not preserved at +1', () => {
    // playerDefend() sets nextAttackBonus = +1. The wolf's howl applies
    // Math.min(+1, -2) = -2, which must wipe out the defend bonus entirely.
    // If Math.min were changed to Math.max, the +1 would survive (max(+1,-2)=+1)
    // and the player would deal extra damage on the next attack — this test catches that.
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.playerDefend(); // nextAttackBonus = +1, phase → ENEMY_ACTION
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → wolf howls
    engine.enemyTurn();
    expect(engine.state.nextAttackBonus).toBe(-2); // Math.min(+1, -2) = -2, not +1
  });

  it('wolf howl -2 penalty flows through to reduce actual player attack damage', () => {
    // The field-level howl test pins nextAttackBonus = -2 but does NOT verify the
    // penalty is wired into executePlayerAttack's damage formula:
    //   attackPower = player.computeWeaponDamage() + this.state.nextAttackBonus
    // If that term were clamped to max(0, ...) for negatives, the field would read -2
    // while the player still deals baseline damage — field test passes, contract broken.
    //
    // dagger: missChance=0, critChance=0.3, damageBonus=1.
    // computeWeaponDamage() = str(5) + damageBonus(1) = 6.
    // After howl: nextAttackBonus=-2 → attackPower=4; wolf.def=1; variance=0 (random=0.25).
    // damage = max(1, 4-1+0) = 3 → enemyHp = 12 - 3 = 9.
    // Baseline (no howl): attackPower=6; damage=max(1,6-1+0)=5 → enemyHp = 12 - 5 = 7.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)   // wolf: < 0.30 → howl (wolfAI makes no further random calls)
      .mockReturnValueOnce(0.5)   // player attack miss: 0.5 >= 0 → no miss
      .mockReturnValueOnce(0.25)  // player attack variance: floor(0.25*4)-1 = 0
      .mockReturnValueOnce(0.9);  // player attack crit: 0.9 >= 0.3 → no crit
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // wolf howls; nextAttackBonus = -2; phase → PLAYER_ACTION
    expect(engine.state.nextAttackBonus).toBe(-2); // confirm howl fired
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(9);  // 12 - 3 (howled), not 12 - 5 (no howl)
    expect(engine.state.log.some(l => l.includes('3 damage'))).toBe(true);
  });

  it('wolf howl does not stack — a second howl leaves nextAttackBonus at -2, not -4', () => {
    // wolfAI: nextAttackBonus = Math.min(currentBonus, -2).
    // When already at -2: Math.min(-2, -2) = -2 — the formula is idempotent.
    // If the implementation used += -2 instead, a second howl would produce -4,
    // giving the player an extra -4 attack penalty — this test pins the cap contract.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // always < 0.30 → always howl
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // first howl → nextAttackBonus = -2
    expect(engine.state.nextAttackBonus).toBe(-2);
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // second howl → must stay at -2, not become -4
    expect(engine.state.nextAttackBonus).toBe(-2);
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

  it('heals again on 6th turn — % 3 === 0 repeats, not a one-shot === 3 condition', () => {
    // All prior heal tests start from enemyTurnCount=0 and run 3 turns, reaching
    // turn 3 (the first heal cycle).  If the condition were changed from
    // `enemyTurnCount % 3 === 0` to `enemyTurnCount === 3`, the skeleton would only
    // ever heal on turn 3 and skip turns 6, 9, etc. — a silent behavioral regression
    // that no existing test catches.
    //
    // This test pre-positions enemyTurnCount at 5 so the next call increments to 6.
    // 6 % 3 === 0 → heal fires; 6 === 3 → would NOT fire.
    // Skeleton maxHp=20, starting enemyHp=10; 10+5=15 < 20, so the cap does not mask the result.
    // random=0.5 (>= 0.40) → skeleton also attacks this turn, but player HP is unrelated to enemyHp.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.40 → attack branch (not defend)
    const enemy = makeEnemy(EnemyType.SKELETON); // maxHp=20
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 10; // below maxHp so the +5 heal visibly lands at 15
    engine.state.enemyTurnCount = 5; // pre-position: next increment → 6
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    // Second heal cycle: min(maxHp=20, 10+5=15) = 15
    expect(engine.state.enemyHp).toBe(15);
    expect(engine.state.log.some(l => l.includes('mends its bones'))).toBe(true);
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

  it('wild boar charge deals 1.2× damage — pins the exact HP reduction', () => {
    // wildBoarAI calls executeEnemyAttack(1.2); the multiplier feeds into
    // attackPower = max(1, floor(enemy.atk × multiplier)).  If the multiplier
    // were accidentally dropped to 1.0, the log would still say "charges"
    // while the player takes 7 damage instead of 8 — the log-only test above
    // cannot catch that regression.
    //
    // player.def=0, leatherVest.defBonus=1 → effectiveDef=1, random=0.5 throughout.
    // With 1.2×: attackPower=max(1,floor(7×1.2))=8; variance=1; damage=max(1,8−1+1)=8 → playerHp=32
    // Without:   attackPower=7; damage=max(1,7−1+1)=7 → playerHp=33
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = makeFastPlayer();
    player.state.def = 0; // effectiveDef = leatherVest.defBonus(1) only
    const engine = new CombatEngine(player, makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log.some(l => l.includes('charges'))).toBe(true);
    expect(engine.state.playerHp).toBe(32); // 40 − 8 (1.2×), not 40 − 7 (1.0× baseline)
  });

  it('wild boar stamps its hooves — sets enemyJustDefended to open the Backstab off-guard window', () => {
    // wildBoarAI sets BOTH enemyDefending and enemyJustDefended when it stamps.
    // The existing stamp test in the enemy-AI-branches suite only asserts enemyDefending=true.
    // If enemyJustDefended were removed from wildBoarAI, a dagger player's next Backstab
    // would show "backstab" flavor instead of "off-guard" — silently wrong game feedback
    // with no test failing.
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // >= 0.9 → stamp
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
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

  it('does NOT trigger at exactly 50% HP (HP=30/60) — pins the strict < 0.5 boundary', () => {
    // All existing phase-2 tests use HP at 40% or below; none verify that the
    // boundary falls at strictly < 50%, not <= 50%.  Changing `< 0.5` to `<= 0.5`
    // would make HP=30 (exactly 50%) trigger phase 2 — this test catches that regression.
    // REVENANT_KNIGHT maxHp=60; 30/60 = 0.5 exactly; 0.5 < 0.5 is false → no trigger.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.25 → attack (not brace)
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT); // maxHp=60
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 30; // exactly 50% — must NOT trigger phase 2
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyIsPhaseTwo).toBe(false);
    expect(engine.state.log.some(l => l.includes('fury'))).toBe(false);
  });

  it('DOES trigger at HP=29/60 (just below 50%) — the other side of the exact boundary', () => {
    // Companion to the above: 29/60 ≈ 0.4833 < 0.5 → triggers phase 2.
    // Together these two tests pin the exact < 0.5 threshold with no room for an off-by-one.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.25 → attack; phase-2 < 0.90 → also attack
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT); // maxHp=60
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 29; // 29/60 ≈ 0.483 < 0.5 → must trigger phase 2
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.enemyIsPhaseTwo).toBe(true);
    expect(engine.state.log.some(l => l.includes('fury'))).toBe(true);
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

  it('weapon ability takes priority over class ability when both are available at level 3+', () => {
    // getAvailableAbility() checks weapon abilities first (level >= 3), then class abilities.
    // If the order of the two blocks were swapped the class ability would shadow the weapon
    // ability — a Warrior with a dagger at level 3 would see 'Shield Bash' instead of
    // 'Backstab'.  This test pins the "weapon > class" priority contract.
    const player = makePlayer();
    player.equipWeapon('dagger'); // dagger ability: 'Backstab'
    player.state.level = 3;
    player.state.classPath = ClassPath.WARRIOR; // class ability: 'Shield Bash'
    const engine = new CombatEngine(player, makeEnemy());
    // Weapon ability must win — 'Backstab', not 'Shield Bash'
    expect(engine.getAvailableAbility()).toBe('Backstab');
  });
});

// ---------------------------------------------------------------------------
// getAvailableAbility — non-ability weapon at level 3+ still yields class ability
//
// The weapon-ability switch has three cases (dagger, hunting_bow, mace).  All
// other weapons have NO entry, so the switch falls through and execution
// continues to the class-ability block.  v8 branch coverage does NOT track this
// "no case matched" path as a branch (there is no default: clause), meaning
// 100% branch coverage is achievable without ever testing a level-3+ player
// whose weapon is NOT in the switch.
//
// Contract: any weapon without a weapon ability must still surface the player's
// class ability.  If a case were accidentally added for a non-ability weapon,
// the class ability would be silently shadowed and these tests would catch it.
// ---------------------------------------------------------------------------
describe('CombatEngine.getAvailableAbility — non-ability weapon at level 3+ yields class ability', () => {
  it('Warrior at level 3 with rusty_shortsword (no weapon ability) gets Shield Bash', () => {
    // rusty_shortsword is not in the weapon-ability switch, so the switch falls
    // through to the class check.  Warrior class must return 'Shield Bash'.
    // Without this test, adding `case 'rusty_shortsword': return 'SomeAbility'`
    // would shadow Shield Bash for default-weapon Warriors with no test failing.
    const player = makePlayer(); // rusty_shortsword equipped, agi=3 ≥ skeleton agi=2 → PLAYER_ACTION
    player.state.level = 3;
    player.state.classPath = ClassPath.WARRIOR;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Shield Bash');
  });

  it('Brigand at level 5 with iron_longsword (no weapon ability) gets Intimidate', () => {
    // Mirrors the Warrior test: iron_longsword has no weapon-ability case, so the
    // class branch is reached and Intimidate is returned.  Pins the contract for a
    // second weapon and a different class so the fallthrough is clearly documented.
    const player = makePlayer();
    player.equipWeapon('iron_longsword');
    player.state.level = 5;
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
    const enemy = makeEnemy(EnemyType.SKELETON); // DEF = 4 (pinned in enemies.test.ts)
    const engine = new CombatEngine(player, enemy);
    const defBefore = engine.state.enemy.def; // 4
    engine.playerUseAbility();
    // Shatter reduces by exactly 2; concrete pin rather than mirroring the formula.
    expect(engine.state.enemy.def).toBe(defBefore - 2); // 4 - 2 = 2
    expect(engine.state.log.some(l => l.includes('Shatter'))).toBe(true);
    expect(engine.state.log.some(l => l.includes('DEF reduced by 2'))).toBe(true);
  });

  it('does not reduce enemy DEF below 0', () => {
    const player = makePlayer();
    player.equipWeapon('mace');
    player.state.agi = 10;
    player.state.level = 3;
    const enemy = makeEnemy(EnemyType.WOLF); // Wolf has DEF = 1; min(2,1)=1 → reduced to 0
    const engine = new CombatEngine(player, enemy);
    engine.playerUseAbility();
    expect(engine.state.enemy.def).toBe(0);
  });

  it('reduced DEF from Shatter flows into subsequent attack damage — not a cached snapshot', () => {
    // Contract: Shatter mutates this.state.enemy.def; executePlayerAttack reads that field
    // live when computing effectiveDef.  The two existing Shatter tests only verify the
    // FIELD value after the ability — they do not prove the damage formula uses it.
    // If executePlayerAttack were ever changed to snapshot enemy.def at construction, the
    // field test would still pass (def reads 2) while attacks silently used 4, dealing 8
    // instead of 9.  This test pins the full pipeline from Shatter → damage to HP.
    //
    // mace: missChance=0, critChance=0, ignoresDefense=0.5, damageBonus=5; player str=5.
    // attackPower = 5+5 = 10; skeleton def=4, agi=2; player agi=10.
    // SLOW: 10 > 2+3=5 → player goes first in both engines.
    // variance=0 (roll=0.25 → floor(1)−1=0).
    //
    // Baseline (no Shatter): effectiveDef=4*0.5=2; damage=max(1,10−2+0)=8.
    // Post-Shatter (def→2): effectiveDef=2*0.5=1;  damage=max(1,10−1+0)=9.

    // Baseline: plain mace attack without Shatter
    mockAttacks([0.5, 0.25, 0.5]); // no miss, variance=0, no crit
    const p1 = makePlayer();
    p1.equipWeapon('mace');
    p1.state.agi = 10;
    p1.state.level = 3;
    const e1 = new CombatEngine(p1, makeEnemy(EnemyType.SKELETON));
    const hp1Before = e1.state.enemyHp;
    e1.playerAttack();
    const baselineDamage = hp1Before - e1.state.enemyHp;

    // Post-Shatter: Shatter reduces def 4 → 2, then a regular attack
    const p2 = makePlayer();
    p2.equipWeapon('mace');
    p2.state.agi = 10;
    p2.state.level = 3;
    const e2 = new CombatEngine(p2, makeEnemy(EnemyType.SKELETON));
    e2.playerUseAbility(); // Shatter: enemy.def 4 → 2
    e2.state.phase = CombatPhase.PLAYER_ACTION; // skip animation / enemy turn
    mockAttacks([0.5, 0.25, 0.5]); // no miss, variance=0, no crit
    const hp2Before = e2.state.enemyHp;
    e2.playerAttack();
    const postShatterDamage = hp2Before - e2.state.enemyHp;

    expect(baselineDamage).toBe(8);  // pre-Shatter: effectiveDef=2, damage=8
    expect(postShatterDamage).toBe(9); // post-Shatter: effectiveDef=1, damage=9
    expect(postShatterDamage).toBe(baselineDamage + 1); // reduced DEF wired into the formula
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
  it('forces a critical hit — "Critical hit!" log entry and reduced enemy HP prove the crit executed', () => {
    // The 'Ambush! Striking from the shadows...' entry is always logged when the ability
    // triggers, so the old check `includes('Ambush') || includes('Critical')` was satisfied
    // by the Ambush announcement alone — it passed even when forceCrit was absent.
    // This version pins the actual contract: Ambush must produce a guaranteed critical hit.
    const player = makeFastPlayer(); // dagger: missChance=0, so the attack always lands
    player.state.classPath = ClassPath.SCOUT;
    // No weapon ability (dagger at level 1 has no ability → class ability takes effect)
    player.state.level = 1; // below 3 so weapon ability doesn't kick in
    const engine = new CombatEngine(player, makeEnemy());
    // random=0.5: miss(0.5<0=false), variance=floor(0.5×4)−1=1, crit(0.5<1=true)
    // attackPower=STR(5)+dagger.damageBonus(1)=6, def=4, base_dmg=max(1,6−4+1)=3, ×2 crit=6
    // enemy HP: 20 − 6 = 14
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    engine.playerUseAbility();
    expect(engine.state.abilityUsedThisCombat).toBe(true);
    // forceCrit=true makes critChance=1 inside calcDamage — "Critical hit!" must appear.
    // If forceCrit is removed, this assertion fails (only ~30% chance of a crit with dagger).
    expect(engine.state.log.some(l => l.includes('Critical hit!'))).toBe(true);
    expect(engine.state.enemyHp).toBe(14);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ANIMATING);
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
    expect(weaken?.type).toBe(StatusEffectType.WEAKEN);
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
    // Guard must block ALL defend side-effects, not just the flag
    expect(e.state.nextAttackBonus).toBe(0);
    expect(e.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('playerPotion is a no-op outside PLAYER_ACTION', () => {
    // Create player externally so we can inspect potions after the call
    const player = makePlayer();
    player.state.hp = 20; // damage so a heal would be detectable via playerHp
    const e = new CombatEngine(player, makeEnemy());
    e.state.phase = CombatPhase.ENEMY_ACTION;
    const hpBefore = e.state.playerHp;       // 20 — engine mirrors player hp
    const potionsBefore = player.state.potions;
    expect(e.playerPotion()).toBe(false);
    // Guard must block ALL side-effects: no heal, no potion consumed, no phase change
    expect(e.state.playerHp).toBe(hpBefore);
    expect(player.state.potions).toBe(potionsBefore);
    expect(e.state.phase).toBe(CombatPhase.ENEMY_ACTION);
  });

  it('playerFlee is a no-op outside PLAYER_ACTION', () => {
    const e = engineInEnemyPhase();
    const logLenBefore = e.state.log.length;
    expect(e.playerFlee()).toBe(false);
    // Guard must block phase transition and log writes
    expect(e.state.phase).toBe(CombatPhase.ENEMY_ACTION);
    expect(e.state.log.length).toBe(logLenBefore);
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
    const logLenBefore = e.state.log.length;
    e.playerUseAbility();
    expect(e.state.phase).toBe(CombatPhase.PLAYER_ACTION);
    expect(e.state.abilityUsedThisCombat).toBe(false);
    expect(e.state.log.length).toBe(logLenBefore);
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
    expect(e.getResult()).toBe('victory');
  });
});

describe('Enemy AI — Bandit desperate attack multiplier', () => {
  it('desperate attack 1.5× multiplier flows through to player HP reduction', () => {
    // The existing "default AI makes a desperate attack at low HP" test pins only the log
    // message — it does NOT verify that the 1.5× ATK multiplier in executeEnemyAttack(1.5)
    // actually reaches the damage calculation and reduces the player's HP.  If the multiplier
    // were silently dropped to 1.0×, the log would still say "desperate attack" while the
    // player takes 3 damage instead of 6 — this test catches that regression.
    //
    // Bandit: ATK=6, maxHp=18.  Player: def=3, leatherVest(+1) → effectiveDef=4.
    // Random call order in enemyTurn: [desperate check, variance, crit].
    // With 1.5×: attackPower=max(1,floor(6×1.5))=9; variance=1; damage=max(1,9−4+1)=6
    // → playerHp = 40−6 = 34.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)   // desperate check: 0.1 < 0.3 → desperate attack
      .mockReturnValueOnce(0.5)   // calcDamage variance: floor(0.5×4)−1 = 1
      .mockReturnValueOnce(0.9);  // calcDamage crit: 0.9 ≥ 0 → no crit
    const player = makePlayer();
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT));
    engine.state.enemyHp = 2; // 2/18 ≈ 0.11 < 0.25 → desperate condition met
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log.some(l => l.includes('desperate attack'))).toBe(true);
    expect(engine.state.playerHp).toBe(34); // 40 − 6 (1.5×), not 40 − 3 (1.0× baseline)
  });

  it('same setup without desperate (bandit at full HP) deals 3 damage — confirms the 1.5× baseline is meaningful', () => {
    // Companion to the above: pins the unweakened baseline so the two values
    // (34 desperate vs 37 normal) are each independently grounded.  If ATK were
    // secretly raised from 6 to 9 the desperate test above would pass vacuously
    // while the 1.5× multiplier contract would go unverified.
    //
    // Full HP (18/18=1.0 ≥ 0.25) → desperate branch short-circuits without a random call.
    // First random call is the brace check (0.5 ≥ 0.2 → normal attack); then variance and crit.
    // attackPower=6; variance=1; damage=max(1,6−4+1)=3 → playerHp=40−3=37.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)   // brace check: 0.5 ≥ 0.2 → normal attack (no brace)
      .mockReturnValueOnce(0.5)   // calcDamage variance: 1
      .mockReturnValueOnce(0.9);  // calcDamage crit: no
    const player = makePlayer();
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.playerHp).toBe(37); // 40 − 3 (normal), not 40 − 6 (desperate)
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
    // Bleed specifically drained the remaining 1 HP (2 dmg tick reduces to 0)
    expect(e.state.playerHp).toBe(0);
    // The bleed tick message must appear before the death message — bleed was the killer
    expect(e.state.log.some(l => l.includes('bleed for 2'))).toBe(true);
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
    expect(weaken[0].turnsRemaining).toBe(3);
  });

  it('Intimidate refresh resets turnsRemaining to 3, not accumulated', () => {
    // If applyStatusEffect accumulated turns (existing.turnsRemaining += new.turnsRemaining)
    // instead of resetting (= new.turnsRemaining), re-applying mid-duration would extend
    // WEAKEN beyond the stated 3-turn contract. This test catches that regression.
    const p = makePlayer();
    p.state.classPath = ClassPath.BRIGAND;
    const e = new CombatEngine(p, makeEnemy());
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility(); // first Intimidate: turnsRemaining = 3
    // Simulate one enemy turn passing: tick the counter down to 2
    e.state.enemyStatusEffects[0].turnsRemaining = 2;
    // Re-apply Intimidate: should RESET to 3, not accumulate to 2+3=5
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.playerUseAbility();
    const weaken = e.state.enemyStatusEffects.filter(s => s.type === StatusEffectType.WEAKEN);
    expect(weaken.length).toBe(1);
    expect(weaken[0].turnsRemaining).toBe(3); // reset, not 2+3=5
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

  it('Backstab off-guard window is consumed — enemyJustDefended resets to false after the strike', () => {
    // When enemyJustDefended is true before Backstab, the ability shows the "off-guard"
    // flavor AND must clear the flag.  If `this.state.enemyJustDefended = false` were
    // removed from the Backstab branch, the window would persist: a second Backstab
    // (without the enemy defending again) would still show "off-guard", silently granting
    // the flavor bonus for free.  This test pins the consume-on-use contract.
    const e = daggerEngine();
    e.state.enemyJustDefended = true; // enemy just defended
    mockAttacks([0, 0, 0]); // no miss, variance 0, no crit
    e.playerUseAbility();
    expect(e.state.log.some(l => l.includes('off-guard'))).toBe(true); // off-guard window used
    expect(e.state.enemyJustDefended).toBe(false); // flag consumed — cannot be reused
  });

  it('Backstab goes for a backstab when the enemy did not defend — pins damage, phase, and flag reset', () => {
    // Contracts: uses 'backstab' flavor (not 'off-guard'), deals damage, transitions phase,
    // and clears enemyJustDefended.  Also confirms critMultiplier=2 is active on this path:
    // baseCrit = min(1, dagger.critChance(0.3) * 2) = 0.6; crit roll=0 < 0.6 → crit.
    // attackPower = str(5)+damageBonus(1)=6; skeleton def=4; variance=floor(0*4)-1=-1;
    // damage = max(1, 6-4-1)=1; crit doubles → 2; enemyHp = 20-2 = 18.
    const e = daggerEngine();
    e.state.enemyJustDefended = false;
    mockAttacks([0, 0, 0]);
    e.playerUseAbility();
    expect(e.state.log.some(l => l.includes('backstab'))).toBe(true);
    expect(e.state.enemyHp).toBe(18);                          // damage was dealt (not just logged)
    expect(e.state.phase).toBe(CombatPhase.PLAYER_ANIMATING); // state machine advanced
    expect(e.state.enemyJustDefended).toBe(false);             // flag cleared by the ability
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

describe('CombatEngine — playerAttack clears enemyJustDefended (off-guard window consumed by normal attack)', () => {
  it('enemyJustDefended is reset to false after playerAttack() so a later Backstab cannot falsely show "off-guard"', () => {
    // playerAttack() resets `this.state.enemyJustDefended = false` alongside enemyDefending.
    // The existing "player attack into a defending enemy" test only asserts that
    // enemyDefending is cleared — it does not check enemyJustDefended.  If this
    // second reset were removed, a normal attack after an enemy defend would leave
    // the flag set; any Backstab used on a *later* turn (after the window should
    // have expired) would still show the "off-guard" flavor incorrectly, giving
    // the player misleading combat feedback.
    //
    // Scenario: enemy defended last turn (enemyJustDefended=true).  Player chooses
    // a normal attack instead of Backstab.  The flag must be consumed by playerAttack()
    // so that a subsequent Backstab does NOT see a stale "off-guard" window.
    //
    // rusty_shortsword: missChance=0, critChance=0, NORMAL; bandit agi=3 == player agi=3
    // → player goes first (PLAYER_ACTION phase at start).
    const p = makePlayer();
    const e = new CombatEngine(p, makeEnemy(EnemyType.BANDIT));
    e.state.phase = CombatPhase.PLAYER_ACTION;
    e.state.enemyJustDefended = true; // enemy defended on their previous turn
    mockAttacks([0, 0.25, 0.5]);      // no miss, variance=0, no crit
    e.playerAttack();
    // The off-guard window must be closed — if a dagger-wielding level-3 player were
    // to Backstab now, it must show "backstab" (not "off-guard") because the normal
    // attack already consumed the window.
    expect(e.state.enemyJustDefended).toBe(false);
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

describe('CombatEngine — Revenant Knight phase-2 exact log messages', () => {
  // These tests pin the exact strings logged during phase-2 events.
  // The existing phase-2 tests use `.includes('fury')` or only check BLEED state,
  // so a rephrasing of either message (e.g. "filled with fury" or dropping the
  // damage rate from the bleed notice) would pass those tests undetected.

  it('logs the exact phase-transition message "The Revenant Knight roars with dark fury!"', () => {
    // The phase-1 → phase-2 transition fires the first time HP drops below 50%.
    // If the enemy name were accidentally omitted, or "dark fury" changed to "fury",
    // the existing includes('fury') check would still pass.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → phase-2 attack (not defend)
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = Math.floor(enemy.maxHp * 0.4); // below 50% → trigger phase 2
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain(`The ${enemy.name} roars with dark fury!`);
  });

  it('logs the exact bleed notification "The wound begins to bleed! (2 dmg/turn, 3 turns)"', () => {
    // This message tells the player both the per-turn damage and the duration, giving
    // them the information to decide whether to use a potion now.  It is entirely absent
    // from the existing test suite — only BLEED presence is checked, not the message.
    // If the message were changed to omit the rate or duration, the player would lose
    // key tactical information and no test would catch it.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → phase-2 attack branch
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = Math.floor(enemy.maxHp * 0.4);
    engine.state.enemyIsPhaseTwo = true; // already in phase 2 — no transition message
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The wound begins to bleed! (2 dmg/turn, 3 turns)');
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

// ---------------------------------------------------------------------------
// Flee chance — AGI bonus
// The flee formula: fleeChance = base(0.5) + agiBonus + classBonus
// where agiBonus = player.agi > enemy.agi ? 0.2 : 0 (strict greater-than).
// Prior tests cover Scout (+0.15) and Warrior (-0.1) class modifiers but do not
// isolate the AGI bonus branch.  These tests pin it at the boundary.
// ---------------------------------------------------------------------------

describe('CombatEngine.playerFlee — AGI bonus (+0.2 when player agi strictly exceeds enemy agi)', () => {
  it('flee succeeds at roll=0.55 when player agi(5) > enemy agi(3) provides the +0.2 bonus', () => {
    // fleeChance = 0.5 + 0.2 = 0.70. roll=0.55 < 0.70 → success.
    // Without the bonus: fleeChance=0.50, 0.55 >= 0.50 → failure.
    const player = makePlayer(); // agi=3 by default
    player.state.agi = 5; // strictly above BANDIT agi(3)
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT)); // agi=3
    engine.state.phase = CombatPhase.PLAYER_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.55);
    expect(engine.playerFlee()).toBe(true);
  });

  it('flee fails at roll=0.55 when player agi equals enemy agi (strict > means equal gives no bonus)', () => {
    // agiBonus = player.agi > enemy.agi ? 0.2 : 0. Equal agi → 0.
    // fleeChance = 0.5, roll=0.55 >= 0.5 → failure.
    const player = makePlayer(); // agi=3
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT)); // agi=3, equal
    engine.state.phase = CombatPhase.PLAYER_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.55);
    expect(engine.playerFlee()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STUN + WEAKEN interaction — WEAKEN does not consume a turn while enemy is stunned
//
// tickEnemyEffects() (which decrements WEAKEN) only runs in update() when
// transitioning out of ENEMY_ANIMATING.  When the enemy is stunned, enemyTurn()
// sets phase directly to PLAYER_ACTION and returns early, skipping ENEMY_ANIMATING
// entirely.  Contract: WEAKEN turnsRemaining is NOT decremented on a stunned turn.
// ---------------------------------------------------------------------------

describe('CombatEngine — WEAKEN does not decrement during a stunned enemy turn', () => {
  it('WEAKEN turnsRemaining stays at 3 when the enemy is simultaneously stunned', () => {
    // Scenario: player applied both WEAKEN (3 turns) and STUN (1 turn) on the same
    // enemy turn.  On the next enemy turn, the stun fires first, phase goes directly
    // to PLAYER_ACTION (no ENEMY_ANIMATING transition), so tickEnemyEffects() never
    // runs.  WEAKEN's 3 turns are preserved — the stun did not "burn" one of them.
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.enemyStatusEffects.push(
      { type: StatusEffectType.WEAKEN, turnsRemaining: 3, magnitude: 3 },
      { type: StatusEffectType.STUN,   turnsRemaining: 1 }
    );
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();

    expect(engine.state.enemyStatusEffects.find(e => e.type === StatusEffectType.STUN))
      .toBeUndefined(); // stun consumed (1 → 0 → removed)

    const weaken = engine.state.enemyStatusEffects.find(e => e.type === StatusEffectType.WEAKEN);
    expect(weaken).toBeDefined();
    expect(weaken!.turnsRemaining).toBe(3); // unchanged — tickEnemyEffects never ran
  });
});

// ---------------------------------------------------------------------------
// Weapon ability vs. class ability priority
//
// getAvailableAbility() checks the level >= 3 weapon-ability branch FIRST.
// If the equipped weapon has an ability, it is returned and the class-ability
// branch is never reached — even when the player has chosen a class.
// A reordering of those two if-blocks would silently change gameplay (class
// abilities would always shadow weapon abilities), so pin the priority here.
// ---------------------------------------------------------------------------

describe('CombatEngine.getAvailableAbility — weapon ability takes priority over class ability at level 3+', () => {
  it('Brigand at level 3 with dagger returns Backstab, not Intimidate', () => {
    const player = makeFastPlayer(); // dagger, FAST → player goes first
    player.state.level = 3;
    player.state.classPath = ClassPath.BRIGAND;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Backstab');
  });

  it('Warrior at level 3 with mace returns Shatter, not Shield Bash', () => {
    const player = makePlayer();
    player.equipWeapon('mace');
    player.state.agi = 10; // SLOW: playerAgi(10) > enemyAgi(4)+3 → player goes first
    player.state.level = 3;
    player.state.classPath = ClassPath.WARRIOR;
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Shatter');
  });

  it('Scout at level 3 with hunting_bow returns Pin, not Ambush', () => {
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.agi = 10;
    player.state.level = 3;
    player.state.classPath = ClassPath.SCOUT;
    mockAttacks([0, 0, 0]); // opening-shot randoms: miss=0, variance=0, crit=0
    const engine = new CombatEngine(player, makeEnemy());
    expect(engine.getAvailableAbility()).toBe('Pin');
  });
});

describe('CombatEngine.playerUseAbility — weapon ability executes over class ability at level 3+', () => {
  // Brigand Intimidate applies WEAKEN and logs "Intimidate!".
  // Backstab logs a backstab flavor and deals damage instead.
  // If the priority ever flips, WEAKEN would appear and no backstab message would.
  it('Brigand at level 3 with dagger executes Backstab (not Intimidate) on playerUseAbility', () => {
    const player = makeFastPlayer(); // dagger, FAST → PLAYER_ACTION phase
    player.state.level = 3;
    player.state.classPath = ClassPath.BRIGAND;
    mockAttacks([0, 0.25, 0.5]); // miss=0(no miss), variance=0, crit=0.5(≥0.3 → no crit)
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerUseAbility();
    expect(engine.state.log.some(l => l.includes('backstab') || l.includes('off-guard'))).toBe(true);
    expect(engine.state.log.some(l => l.toLowerCase().includes('intimidate'))).toBe(false);
    expect(engine.state.enemyStatusEffects.some(e => e.type === StatusEffectType.WEAKEN)).toBe(false);
  });
});

describe('CombatEngine — skeleton heals AND attacks on the same 3rd turn', () => {
  it('when random >= 0.40, skeleton heals then also attacks in the same turn (independent branches)', () => {
    // skeletonAI(): if (turnCount%3===0) { heal }; if (random<0.40) { defend } else { attack }.
    // The heal and the attack/defend branches are NOT mutually exclusive — healing does not
    // return early or else-gate the attack check. If the code were refactored to
    // `if (healed) { return; }` or `if (healTurn) { heal } else { attack }`, the player
    // would take 0 damage on turn 3 while this test would still have passed with the old
    // check-only-enemyHp approach. This test pins both effects happen in the same turn.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 >= 0.40 → attack (not defend)
    const player = makeFastPlayer(); // dagger FAST: no Math.random in constructor
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    engine.state.enemyHp = 12;      // below maxHp(20) so healing has room
    engine.state.enemyTurnCount = 2; // next enemyTurn() increments to 3 → heal turn
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    const playerHpBefore = engine.state.playerHp;

    engine.enemyTurn();

    // Healing branch fired: 12 + 5 = 17
    expect(engine.state.enemyHp).toBe(17);
    expect(engine.state.log.some(l => l.includes('mends'))).toBe(true);
    // Attack branch also fired independently: Skeleton ATK=5, playerDef=3+1=4,
    // variance=floor(0.5×4)−1=1, damage=max(1,5−4+1)=2 → exact HP must drop by 2.
    expect(engine.state.playerHp).toBe(38);
  });
});

describe('CombatEngine — BRIGAND class has no flee modifier', () => {
  it('BRIGAND flee chance equals the 50% base — random just-above and just-below both behave as expected', () => {
    // Scout gets +0.15, Warrior gets -0.1, BRIGAND gets 0 (no entry in playerFlee).
    // Pins that if a classBonus for BRIGAND were accidentally added, a random value
    // just above the base 0.5 threshold would succeed instead of fail (catching the regression).
    // Player agi(3) === BANDIT agi(3) → agiBonus = 0. fleeChance = 0.5 + 0 + 0 = 0.5.
    const makeBrigandEngine = () => {
      const p = makePlayer(); // agi=3, rusty_shortsword NORMAL
      p.state.classPath = ClassPath.BRIGAND;
      // BANDIT agi=3 == player agi=3 → no agi bonus; NORMAL weapon + equal agi → PLAYER_ACTION
      return new CombatEngine(p, makeEnemy(EnemyType.BANDIT));
    };

    // random=0.49 < 0.5 → flee succeeds (base threshold met)
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    expect(makeBrigandEngine().playerFlee()).toBe(true);

    vi.restoreAllMocks();

    // random=0.51 > 0.5 → flee fails (BRIGAND adds no bonus to shift this over 0.51)
    vi.spyOn(Math, 'random').mockReturnValue(0.51);
    expect(makeBrigandEngine().playerFlee()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// war_axe — pins all three special properties at their exact boundary values.
//
// war_axe stats: damageBonus=8, SLOW, missChance=0.1, critChance=0.1,
// ignoresDefense=0.2.  The ignoresDefense tests only cover mace (0.5) and
// rusty_shortsword (0); war_axe (0.2) is never tested in combat — a silent
// change to any of its three special values would go undetected.
//
// Setup: player.state.agi=10, REVENANT_KNIGHT (agi=4).
// SLOW: playerTurn = 10 > 4+3=7 → player goes first, no phase forcing needed.
// attackPower = str(5) + damageBonus(8) = 13.
// effectiveDef = def(6) * (1-0.2) = 4.8.
// variance=0: random=0.25 → floor(0.25*4)-1 = 0.
// damage = max(1, floor(13-4.8+0)) = max(1, floor(8.2)) = 8.
// ---------------------------------------------------------------------------

describe('CombatEngine — war_axe (ignoresDefense=0.2, missChance=0.1, critChance=0.1)', () => {
  function makeWarAxePlayer() {
    const p = makePlayer(); // str=5
    p.equipWeapon('war_axe');
    p.state.agi = 10; // SLOW: 10 > REVENANT_KNIGHT.agi(4)+3=7 → player goes first
    return p;
  }

  it('ignoresDefense=0.2 against def=6 yields floor(13 - 4.8 + 0) = 8, not 7', () => {
    // effectiveDef = 6*(1-0.2) = 4.8 → damage = floor(8.2) = 8.
    // Without ignoresDefense: floor(13-6+0) = 7. The 0.2 factor must survive.
    mockAttacks([0.15, 0.25, 0.15]); // no miss (≥0.1), variance=0, no crit (≥0.1)
    const engine = new CombatEngine(makeWarAxePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8);
  });

  it('misses when miss random < missChance(0.1) — enemy hp is unchanged', () => {
    // missChance=0.1: roll 0.05 < 0.1 → miss. If missChance were set to 0,
    // executePlayerAttack would never early-return and damage would always be dealt.
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.1 → miss
    const engine = new CombatEngine(makeWarAxePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(hpBefore);
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(true);
  });

  it('crits when crit random < critChance(0.1) — damage is exactly doubled to 16', () => {
    // critChance=0.1: roll 0.05 < 0.1 → crit. Base damage=8 (from test above); crit doubles to 16.
    // If critChance were set to 0, 0.05 < 0 is never true and damage stays at 8.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.15)  // miss check: 0.15 >= 0.1 → no miss
      .mockReturnValueOnce(0.25)  // variance: floor(1)-1 = 0
      .mockReturnValueOnce(0.05); // crit check: 0.05 < 0.1 → crit
    const engine = new CombatEngine(makeWarAxePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(16); // 8 * 2
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(true);
  });

  it('does NOT crit when crit random >= critChance(0.1) — pins the exact upper boundary', () => {
    // roll=0.10 satisfies 0.10 >= 0.10 → no crit. Guards against accidentally widening
    // critChance (e.g. 0.1 → 0.2): if that change were made, 0.10 < 0.20 = true → crit
    // → damage would be 16, not 8, and this test would fail.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.15)  // miss check: no miss
      .mockReturnValueOnce(0.25)  // variance: 0
      .mockReturnValueOnce(0.10); // crit check: 0.10 < 0.10 = false → no crit
    const engine = new CombatEngine(makeWarAxePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8); // base, not doubled
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enemyJustDefended contract — pins that enemy AI branches set the flag
//
// Existing "enemy defends" tests only assert `enemyDefending === true`.
// The Backstab ability reads a separate flag, `enemyJustDefended`, to choose
// its flavor text ("off-guard" vs "backstab").  If any AI branch dropped the
// `this.state.enemyJustDefended = true` assignment, the flag would never be
// set by actual gameplay, and Backstab would always show the wrong flavor —
// yet all existing tests would still pass (they set the flag manually).
// These tests pin the contract across three AI profiles plus an integration
// path that exercises the full pipeline: enemy defends → flag set → Backstab
// reads it.
// ---------------------------------------------------------------------------

describe('CombatEngine — skeleton defend sets enemyJustDefended', () => {
  it('enemyJustDefended is true after the skeleton raises its shield of bones', () => {
    // skeletonAI random < 0.40 → defend branch; sets both enemyDefending and
    // enemyJustDefended.  Existing tests only check enemyDefending; dropping
    // the enemyJustDefended assignment would make Backstab show the wrong flavor
    // without failing any prior test.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.40 → skeleton defends
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
  });
});

describe('CombatEngine — wild boar stamp sets enemyJustDefended', () => {
  it('enemyJustDefended is true after the wild boar stamps its hooves', () => {
    // wildBoarAI random >= 0.90 → stamp branch; sets enemyJustDefended alongside
    // enemyDefending.  Mirrors the skeleton contract above for the boar profile.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // 0.95 >= 0.90 → stamp
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
  });
});

describe('CombatEngine — default AI (BANDIT) brace sets enemyJustDefended', () => {
  it('enemyJustDefended is true after the bandit braces for your attack', () => {
    // defaultEnemyAI: hpPercent >= 0.25 and random < 0.20 → defend branch.
    // Bandit full HP = 18; 0.1 < 0.20 → brace.  Same flag contract as the
    // skeleton and boar profiles.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.BANDIT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // full HP, 0.1 < 0.20 → defend
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
  });
});

describe('CombatEngine — Backstab "off-guard" flavor via actual skeleton defend turn', () => {
  it('skeleton defends → enemyJustDefended stays true → Backstab shows "off-guard" not "backstab"', () => {
    // Integration test: prior Backstab tests set enemyJustDefended manually.
    // This test exercises the full pipeline so that removing the assignment from
    // skeletonAI (or the check from Backstab) breaks the test, not just one side.
    //
    // Setup: dagger-wielding level-3 player (Backstab unlocked; dagger is FAST
    // so the constructor starts in PLAYER_ACTION).  Force skeleton to defend.
    // After the enemy turn, call playerUseAbility() — must show 'off-guard'.
    const player = makeFastPlayer(); // dagger, FAST → PLAYER_ACTION at start
    player.state.level = 3;         // unlock Backstab
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));

    // Enemy turn: skeleton defends (random=0.1 < 0.40)
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // sets enemyJustDefended=true, phase→PLAYER_ACTION

    expect(engine.state.enemyJustDefended).toBe(true);
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);

    // Player Backstab: must see "off-guard" because the skeleton just defended
    vi.restoreAllMocks();
    mockAttacks([0, 0.25, 0.9]); // no miss; variance=0; no crit (0.9 >= 0.6)
    engine.playerUseAbility();
    expect(engine.state.log.some(l => l.includes('off-guard'))).toBe(true);
    expect(engine.state.log.some(l => l.includes('backstab'))).toBe(false);
  });
});

describe('CombatEngine — Revenant Knight phase 1 brace sets enemyJustDefended', () => {
  it('enemyJustDefended is true after the Revenant Knight braces in phase 1', () => {
    // revenantKnightAI phase 1 (hp >= 50%): random < 0.25 → brace branch.
    // The branch sets both enemyDefending and enemyJustDefended.  The existing
    // "phase one braces for the attack" test only checks enemyDefending.  If the
    // enemyJustDefended assignment were removed here, Backstab against the boss
    // would always show the wrong "backstab" flavor instead of "off-guard" —
    // yet no prior test would catch it.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // full HP, 0.1 < 0.25 → phase-1 brace
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
    expect(engine.state.log.some(l => l.includes('braces'))).toBe(true);
  });
});

describe('CombatEngine — Revenant Knight phase 2 raise cursed blade sets enemyJustDefended', () => {
  it('enemyJustDefended is true after the Revenant Knight raises its cursed blade in phase 2', () => {
    // revenantKnightAI phase 2 (hp < 50%): random >= 0.90 → defend branch.
    // The branch sets both enemyDefending and enemyJustDefended.  The existing
    // "phase two can raise its cursed blade" test only checks enemyDefending.
    // Dropping the enemyJustDefended assignment would silently break the Backstab
    // off-guard flavor for the Revenant Knight's phase-2 defend, undetected by any
    // other test.
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.state.enemyHp = 10;         // < 50% of 60 → phase 2 active
    engine.state.enemyIsPhaseTwo = true;
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // 0.95 >= 0.90 → phase-2 defend
    engine.enemyTurn();
    expect(engine.state.enemyDefending).toBe(true);
    expect(engine.state.enemyJustDefended).toBe(true);
    expect(engine.state.log.some(l => l.includes('cursed blade'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// war_halberd — pins all three special stat values at their exact boundary values.
//
// war_halberd stats: damageBonus=9 (highest of any weapon), SLOW,
// missChance=0.1, critChance=0, ignoresDefense=0.
// war_axe (the only comparable weapon) has critChance=0.1 and ignoresDefense=0.2.
// war_halberd zeros both those fields — a silent copy-paste of war_axe values
// would change combat outcomes without any existing test catching it.
//
// Setup: player.state.agi=10, REVENANT_KNIGHT (agi=4).
// SLOW: playerTurn = 10 > 4+3=7 → player goes first, no phase forcing needed.
// attackPower = str(5) + damageBonus(9) = 14.
// effectiveDef = def(6) * (1-0) = 6.          [ignoresDefense=0 → full DEF]
// variance=0: varRoll=0.25 → floor(0.25*4)-1 = 0.
// damage = max(1, floor(14-6+0)) = 8.
// ---------------------------------------------------------------------------

describe('CombatEngine — war_halberd (ignoresDefense=0, missChance=0.1, critChance=0)', () => {
  function makeWarHalberdPlayer() {
    const p = makePlayer(); // str=5
    p.equipWeapon('war_halberd');
    p.state.agi = 10; // SLOW: 10 > REVENANT_KNIGHT.agi(4)+3=7 → player goes first
    return p;
  }

  it('ignoresDefense=0 against def=6 yields floor(14 - 6 + 0) = 8, not 9', () => {
    // effectiveDef = 6*(1-0) = 6 → damage = floor(8.0) = 8.
    // If ignoresDefense were accidentally set to 0.2 (like war_axe):
    // effectiveDef = 6*0.8 = 4.8 → damage = floor(9.2) = 9. The 0 factor must survive.
    mockAttacks([0.15, 0.25, 0.15]); // no miss (≥0.1), variance=0, crit roll irrelevant (critChance=0)
    const engine = new CombatEngine(makeWarHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8);
  });

  it('misses when miss random < missChance(0.1) — enemy hp is unchanged', () => {
    // missChance=0.1: roll 0.05 < 0.1 → miss. If missChance were 0, the weapon
    // would never miss and executePlayerAttack would never early-return.
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.1 → miss
    const engine = new CombatEngine(makeWarHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(hpBefore);
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(true);
  });

  it('critChance=0 — never crits even when crit random is exactly 0', () => {
    // The crit check is `random() < critChance`. For critChance=0, even roll=0 gives
    // `0 < 0 = false`, so a crit is impossible. If critChance were accidentally set to
    // 0.1 (like war_axe), roll=0 would satisfy 0 < 0.1 → crit → damage doubles to 16.
    mockAttacks([0.15, 0.25, 0.0]); // no miss, variance=0, crit roll=0 (still < critChance=0? No)
    const engine = new CombatEngine(makeWarHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8); // base damage, not doubled to 16
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(false);
  });

  it('does NOT miss when miss random equals missChance(0.1) — pins the exact upper boundary', () => {
    // roll=0.10 satisfies 0.10 >= 0.10 → no miss. Together with the miss test (0.05 < 0.1
    // → miss) this pins both sides of the 0.1 threshold. If missChance were widened to
    // 0.15, both tests would still pass — but narrowing to 0.05 would make this test fail.
    mockAttacks([0.10, 0.25, 0.15]); // at-threshold: 0.10 >= 0.1 → no miss; variance=0; no crit
    const engine = new CombatEngine(makeWarHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(8); // damage dealt, not a miss
  });
});

// ---------------------------------------------------------------------------
// halberd — pins all three special stat values at their exact boundary values.
//
// halberd stats: damageBonus=7 (SLOW, chest-only), missChance=0.15 (highest
// miss rate in the game), critChance=0, ignoresDefense=0.
//
// war_axe (0.10 miss) and war_halberd (0.10 miss) are both tested in combat;
// plain halberd's 0.15 miss threshold is higher than both — a silent change
// (e.g. 0.15 → 0.10 to match war_halberd) would let it miss less often than
// designed, favouring the player, with no test catching it.
//
// Setup: player.state.agi=10, REVENANT_KNIGHT (agi=4).
// SLOW: playerTurn = 10 > 4+3=7 → player goes first, no phase forcing needed.
// attackPower = str(5) + damageBonus(7) = 12.
// effectiveDef = def(6) * (1-0) = 6.          [ignoresDefense=0 → full DEF]
// variance=0: varRoll=0.25 → floor(0.25*4)-1 = 0.
// damage = max(1, floor(12-6+0)) = 6.
// ---------------------------------------------------------------------------

describe('CombatEngine — halberd (ignoresDefense=0, missChance=0.15, critChance=0)', () => {
  function makeHalberdPlayer() {
    const p = makePlayer(); // str=5
    p.equipWeapon('halberd');
    p.state.agi = 10; // SLOW: 10 > REVENANT_KNIGHT.agi(4)+3=7 → player goes first
    return p;
  }

  it('ignoresDefense=0 against def=6 yields floor(12 - 6 + 0) = 6, not 7', () => {
    // effectiveDef = 6*(1-0) = 6 → damage = floor(6.0) = 6.
    // If ignoresDefense were accidentally set to 0.2 (like war_axe):
    // effectiveDef = 6*0.8 = 4.8 → damage = floor(7.2) = 7. The 0 factor must survive.
    mockAttacks([0.20, 0.25, 0.20]); // no miss (≥0.15), variance=0, crit roll irrelevant (critChance=0)
    const engine = new CombatEngine(makeHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(6);
  });

  it('misses when miss random < missChance(0.15) — enemy hp is unchanged', () => {
    // missChance=0.15: roll 0.10 < 0.15 → miss. If missChance were lowered to 0.10
    // (matching war_halberd), executePlayerAttack would land and deal damage instead.
    vi.spyOn(Math, 'random').mockReturnValue(0.10); // 0.10 < 0.15 → miss
    const engine = new CombatEngine(makeHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(hpBefore);
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(true);
  });

  it('critChance=0 — never crits even when crit random is exactly 0', () => {
    // The crit check is `random() < critChance`. For critChance=0, even roll=0 gives
    // `0 < 0 = false`, so a crit is impossible. If critChance were accidentally set to
    // 0.1 (like war_axe), roll=0 would satisfy 0 < 0.1 → crit → damage doubles to 12.
    mockAttacks([0.20, 0.25, 0.0]); // no miss, variance=0, crit roll=0 (still 0 < 0? No)
    const engine = new CombatEngine(makeHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(6); // base damage, not doubled to 12
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(false);
  });

  it('does NOT miss when miss random equals missChance(0.15) — pins the exact upper boundary', () => {
    // roll=0.15 satisfies 0.15 >= 0.15 → no miss. Together with the miss test (0.10 < 0.15
    // → miss) this pins both sides of the 0.15 threshold. If missChance were widened to
    // 0.20, both tests would still pass — but narrowing to 0.10 would make this test fail.
    mockAttacks([0.15, 0.25, 0.20]); // at-threshold: 0.15 >= 0.15 → no miss; variance=0; no crit
    const engine = new CombatEngine(makeHalberdPlayer(), makeEnemy(EnemyType.REVENANT_KNIGHT));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(6); // damage dealt, not a miss
  });
});

// ---------------------------------------------------------------------------
// hand_axe miss boundary — pins the exact < 0.2 threshold.
//
// hand_axe: damageBonus=6, NORMAL speed, missChance=0.20, critChance=0.
// Existing miss tests use roll=0.1, which is well inside the miss zone.
// Changing missChance from 0.20 to 0.15 would leave 0.1 < 0.15 still true —
// neither existing test would catch the drift.  These two tests use rolls at
// 0.199 (just below) and 0.200 (exactly at threshold) to pin both sides so
// that ANY change to the 0.20 threshold is immediately caught.
//
// Setup: player agi=10, SKELETON (agi=2). NORMAL: 10 >= 2 → player goes first.
// attackPower = str(5) + damageBonus(6) = 11.
// effectiveDef = def(4) * (1-0) = 4. variance=0 (roll=0.25).
// damage = max(1, 11-4+0) = 7.
// ---------------------------------------------------------------------------

describe('CombatEngine — hand_axe miss boundary (missChance=0.2)', () => {
  function makeHandAxePlayer() {
    const p = makePlayer(); // str=5, agi=3
    p.equipWeapon('hand_axe'); // missChance=0.20, NORMAL speed, damageBonus=6
    p.state.agi = 10;           // NORMAL: 10 >= skeleton(2) → player goes first
    return p;
  }

  it('misses at roll=0.199 (just below 0.2) — enemy HP is unchanged', () => {
    // 0.199 < 0.20 = true → miss. If missChance were lowered to 0.15 (matching halberd),
    // 0.199 < 0.15 = false → the attack would land and this test would fail.
    vi.spyOn(Math, 'random').mockReturnValue(0.199);
    const engine = new CombatEngine(makeHandAxePlayer(), makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(engine.state.enemyHp).toBe(hpBefore);
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(true);
  });

  it('does NOT miss at roll=0.200 (exactly at threshold) — pins the strict < 0.2 boundary', () => {
    // 0.200 < 0.200 = false → no miss → damage=7 is dealt.
    // If the condition changed to <= 0.2, roll=0.200 would miss (hp unchanged) and this
    // test would fail.  Together with the just-below test, both sides of the exact threshold
    // are pinned.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.200)  // miss check: 0.200 < 0.200 = false → no miss
      .mockReturnValueOnce(0.25)   // variance: floor(0.25*4)-1 = 0
      .mockReturnValueOnce(0.5);   // crit check: critChance=0 → never crits
    const engine = new CombatEngine(makeHandAxePlayer(), makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(7); // str(5)+bonus(6)-def(4)+var(0) = 7
    expect(engine.state.log.some(l => l.includes('misses'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dagger critChance boundary — pins the exact < 0.3 threshold.
//
// dagger: damageBonus=1, FAST, missChance=0, critChance=0.30.
// Existing crit tests use roll=0.1 (crit) and roll=0.5 (no crit).
// Changing critChance from 0.30 to 0.15 would leave 0.1 < 0.15 still true;
// changing to 0.60 would leave 0.5 < 0.60 still true.  Neither drift is caught.
// These two tests use rolls at 0.299 (just below) and 0.300 (exactly at) to
// pin both sides so that ANY change to the 0.30 threshold is immediately caught.
//
// Setup: makeFastPlayer() = dagger FAST → PLAYER_ACTION phase at start.
// attackPower = str(5) + damageBonus(1) = 6; skeleton def=4; variance=0 (roll=0.25).
// non-crit damage = max(1, 6-4+0) = 2; crit damage = 2 * 2 = 4.
// ---------------------------------------------------------------------------

describe('CombatEngine — dagger critChance boundary (critChance=0.3)', () => {
  it('crits at roll=0.299 (just below 0.3) — damage is doubled to 4', () => {
    // 0.299 < 0.30 = true → crit. If critChance were lowered to 0.20, 0.299 < 0.20 = false
    // → no crit → damage stays at 2 and the expect(4) here would fail.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)      // miss check: 0 < 0 (missChance=0) = false → no miss
      .mockReturnValueOnce(0.25)   // variance: floor(0.25*4)-1 = 0
      .mockReturnValueOnce(0.299); // crit: 0.299 < 0.30 = true → crit
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(4); // 2 base × 2 crit multiplier
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(true);
  });

  it('does NOT crit at roll=0.300 (exactly at threshold) — pins the strict < 0.3 boundary', () => {
    // 0.300 < 0.300 = false → no crit → damage=2, not 4.
    // If the condition changed to <= 0.3, roll=0.300 would crit (damage=4) and this test
    // would fail.  Together with the just-below test, both sides of the exact threshold
    // are pinned: any narrowing or widening of 0.30 breaks at least one of these two tests.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)      // miss check: no miss
      .mockReturnValueOnce(0.25)   // variance: 0
      .mockReturnValueOnce(0.300); // crit: 0.300 < 0.300 = false → no crit
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    const hpBefore = engine.state.enemyHp;
    engine.playerAttack();
    expect(hpBefore - engine.state.enemyHp).toBe(2); // base damage, not doubled
    expect(engine.state.log.some(l => l.includes('Critical'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exact log message pin contracts — player action messages
//
// Several combat log messages are currently verified only with l.includes(substring),
// which passes as long as the keyword appears somewhere.  A rephrasing that preserves
// the keyword (e.g. "You have fallen to the ground!" still contains 'fallen') would
// pass undetected.  These tests pin the full literal strings so any reformatting —
// dropping tactical hints, changing punctuation, or adding extra words — breaks a
// test rather than reaching the player silently.
// ---------------------------------------------------------------------------

describe('CombatEngine — exact log message: playerDefend', () => {
  it('logs the exact string "You brace for impact. (+1 damage next turn)"', () => {
    // The existing test uses l.includes('brace'), which passes if the word "brace"
    // appears anywhere.  The parenthetical "(+1 damage next turn)" is the tactical
    // hint that tells the player why defending is useful.  If that clause were
    // dropped or rephrased the player would lose key in-combat information.
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.playerDefend();
    expect(engine.state.log).toContain('You brace for impact. (+1 damage next turn)');
  });
});

describe('CombatEngine — exact log message: playerPotion (no potions)', () => {
  it('logs exactly "No potions left!" when the player has no potions', () => {
    // The existing test uses l.includes('No potions'), which would also pass for
    // "No potions available!" or "No potions in bag!".  Pinning the exact message
    // catches any rewording that changes what the player reads in combat.
    const player = makeFastPlayer();
    player.state.potions = 0;
    const engine = new CombatEngine(player, makeEnemy());
    engine.playerPotion();
    expect(engine.state.log).toContain('No potions left!');
  });
});

describe('CombatEngine — exact log message: enemy defeated by playerAttack', () => {
  it('logs exactly "The <name> is defeated!" when playerAttack kills the enemy', () => {
    // The existing tests use l.includes('is defeated'), which passes for "enemy is
    // now defeated!" or "is defeated!!" (double exclamation).  Pinning the exact
    // format ensures both the enemy name and punctuation are preserved across any
    // future log reformatting.
    //
    // dagger: missChance=0, critChance=0.3. Mocked rolls:
    //   0.5 < 0 (miss)  → false → no miss
    //   floor(0.25×4)−1 → 0 (variance)
    //   0.5 < 0.3 (crit) → false → no crit
    // damage = max(1, str(5)+bonus(1) − def(4) + 0) = 2 → kills enemy at HP=1.
    const enemy = makeEnemy(EnemyType.SKELETON);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 1;
    mockAttacks([0.5, 0.25, 0.5]); // no miss, variance=0, no crit
    engine.playerAttack();
    expect(engine.state.log).toContain(`The ${enemy.name} is defeated!`);
  });
});

describe('CombatEngine — exact log message: player death', () => {
  it('logs exactly "You have fallen!" when bleed kills the player', () => {
    // The existing test uses l.includes('fallen'), which passes for "You have fallen
    // to the ground!" or "You have fallen!!" (double exclamation).  Pinning the exact
    // string ensures downstream code that matches this literal keeps matching.
    //
    // Setup: player HP=1, BLEED(2 dmg) kills on enemy turn → death log fires before
    // the enemy AI dispatches, so no random mock is needed.
    const p = makePlayer();
    p.state.hp = 1;
    const e = new CombatEngine(p, makeEnemy());
    e.state.playerHp = 1;
    e.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 2 });
    e.state.phase = CombatPhase.ENEMY_ACTION;
    e.enemyTurn();
    expect(e.state.log).toContain('You have fallen!');
  });
});

// ---------------------------------------------------------------------------
// Exact log message pin contracts — enemy AI action messages
//
// The tests above verify these messages exist using l.includes(substring)
// checks, which pass as long as a keyword appears somewhere in the string.
// These tests pin the full literal messages so any reformatting — dropping
// tactical parentheticals, changing punctuation, or adding extra words —
// breaks a test rather than silently reaching the player.
// ---------------------------------------------------------------------------

describe('CombatEngine — exact log message: Wolf howl', () => {
  it('logs exactly "The Wolf lets out a fearsome howl! (-2 to your next attack)"', () => {
    // The existing test checks l.includes('howl'), which passes even if the
    // parenthetical "(-2 to your next attack)" were dropped.  That hint is the
    // only in-combat signal that the howl applied a -2 attack debuff; removing
    // it would leave players unable to understand why their next hit underperformed.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → howl branch
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WOLF));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain(
      'The Wolf lets out a fearsome howl! (-2 to your next attack)'
    );
  });
});

describe('CombatEngine — exact log message: Skeleton mends its bones', () => {
  it('logs exactly "The Skeleton mends its bones! (+5 HP)" on the 3rd turn', () => {
    // The existing test checks l.includes('mends'), passing even if "(+5 HP)"
    // is stripped.  The parenthetical tells the player how much HP the skeleton
    // recovered — essential when deciding whether to prioritize killing the
    // skeleton before its next heal cycle.  Pinning the exact string ensures
    // the tactical hint is never silently removed.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.40 → attack (not defend)
    const enemy = makeEnemy(EnemyType.SKELETON);
    enemy.hp = 15; // below maxHp(20) so heal has visible room
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = 15;
    for (let t = 0; t < 3; t++) {
      engine.state.phase = CombatPhase.ENEMY_ACTION;
      engine.enemyTurn();
    }
    expect(engine.state.log).toContain('The Skeleton mends its bones! (+5 HP)');
  });
});

describe('CombatEngine — exact log message: Wild Boar charge and stamp', () => {
  it('logs exactly "The Wild Boar charges!" when the boar charges', () => {
    // The existing test checks l.includes('charges'), which passes for any variant
    // ("wildly charges at you!" / "charges forward!").  Pinning the exact format
    // locks the punctuation and phrasing contract.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.90 → charge branch
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Wild Boar charges!');
  });

  it('logs exactly "The Wild Boar stamps its hooves." when the boar stamps', () => {
    // The existing test checks l.includes('stamps its hooves').  Pinning the full
    // string (including the trailing period) catches punctuation drift too.
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // >= 0.90 → stamp branch
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.WILD_BOAR));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Wild Boar stamps its hooves.');
  });
});

describe('CombatEngine — exact log message: Skeleton raises a shield of bones', () => {
  it('logs exactly "The Skeleton raises a shield of bones." when defending', () => {
    // The existing test checks l.includes('shield of bones'), which passes for
    // "uses a shield of bones" or "a shield of bones appears".  Pinning the verb
    // "raises" and the trailing period locks the full sentence.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.40 → defend branch
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Skeleton raises a shield of bones.');
  });
});

describe('CombatEngine — exact log message: Revenant Knight raises its cursed blade', () => {
  it('logs exactly "The Revenant Knight raises its cursed blade." in phase-2 defend', () => {
    // The existing test checks l.includes('cursed blade'), which passes if the
    // verb changed to "wields" or the article to "the".  Pinning the full string
    // locks the exact phrase shown during the boss phase-2 defend animation.
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // >= 0.90 → raise-blade branch
    const enemy = makeEnemy(EnemyType.REVENANT_KNIGHT);
    const engine = new CombatEngine(makeFastPlayer(), enemy);
    engine.state.enemyHp = Math.floor(enemy.maxHp * 0.4); // < 50% → phase 2
    engine.state.enemyIsPhaseTwo = true;
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Revenant Knight raises its cursed blade.');
  });
});

describe('CombatEngine — exact log message: Bandit desperate attack', () => {
  it('logs exactly "The Bandit makes a desperate attack!" at low HP', () => {
    // The existing test checks l.includes('desperate attack'), which passes for
    // "is desperately attacking!" or "makes its desperate attack!".  Pinning
    // the full string locks the exact low-HP message the player sees.
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.30 → desperate branch; variance=-1
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.BANDIT));
    engine.state.enemyHp = 2; // < 25% of maxHp(18) → desperate branch
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Bandit makes a desperate attack!');
  });
});

describe('CombatEngine — exact log message: Bandit Archer alternating attacks', () => {
  it('logs exactly "The Bandit Archer fires an arrow!" on odd enemy turns', () => {
    // The existing test checks l.includes('arrow'), passing for "shoots an arrow"
    // or "fires arrows".  Pinning "fires an arrow!" locks the verb and singularity.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.BANDIT_ARCHER));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // enemyTurnCount → 1 (odd → arrow)
    expect(engine.state.log).toContain('The Bandit Archer fires an arrow!');
  });

  it('logs exactly "The Bandit Archer draws a knife!" on even enemy turns', () => {
    // The existing test checks l.includes('knife'), passing for "pulls a knife"
    // or "draws knife" (missing article).  Pinning "draws a knife!" locks both
    // the verb and the article.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.BANDIT_ARCHER));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 1 (odd → arrow)
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn(); // turn 2 (even → knife)
    expect(engine.state.log).toContain('The Bandit Archer draws a knife!');
  });
});

describe('CombatEngine — exact log message: ranged weapon opening shot', () => {
  it('logs exactly "You fire an opening shot!" for the hunting_bow free hit', () => {
    // The existing test uses l.includes('opening shot'), which passes for any
    // variant ("fires an opening volley!" / "took an opening shot!").  Pinning
    // the exact string locks the player-facing phrasing of this free-hit announcement.
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.agi = 10; // RANGED: agi(10) >= skeleton.agi(2) → player acts first
    mockAttacks([0, 0.25, 0]); // opening-shot: miss=0 (no miss), variance=0, crit=0
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    expect(engine.state.log).toContain('You fire an opening shot!');
  });
});

describe('CombatEngine — exact log message: Backstab flavor messages', () => {
  it('logs exactly "You strike while they\'re off-guard!" when enemyJustDefended', () => {
    // The existing test uses l.includes('off-guard'), which passes for
    // "caught them off-guard!" or "off-guard strike!".  The exact phrasing
    // "while they're off-guard" uses a possessive contraction that could easily
    // be mangled; pinning it catches both typos and intentional rewording.
    const p = makePlayer();
    p.state.level = 3;
    p.equipWeapon('dagger');
    const engine = new CombatEngine(p, makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ACTION;
    engine.state.enemyJustDefended = true;
    mockAttacks([0, 0, 0]); // no miss, variance=0, no crit
    engine.playerUseAbility();
    expect(engine.state.log).toContain("You strike while they're off-guard!");
  });

  it('logs exactly "You go for a backstab!" on a normal Backstab strike', () => {
    // The existing test uses l.includes('backstab'), passing for "Backstab!"
    // or "goes for the backstab!".  Pinning "You go for a backstab!" locks
    // the first-person phrasing that distinguishes this from the off-guard variant.
    const p = makePlayer();
    p.state.level = 3;
    p.equipWeapon('dagger');
    const engine = new CombatEngine(p, makeEnemy());
    engine.state.phase = CombatPhase.PLAYER_ACTION;
    engine.state.enemyJustDefended = false;
    mockAttacks([0, 0, 0]); // no miss, variance=0, no crit
    engine.playerUseAbility();
    expect(engine.state.log).toContain('You go for a backstab!');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: player attack damage format
//
// Existing tests check HP reductions or use l.includes('damage') / l.includes(N),
// passing even if the format changes from "You deal 3 damage." to "You hit for 3"
// or "3 damage dealt".  Pinning the exact string catches verb, article, and
// punctuation drift before it silently reaches the player's combat log.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: player attack damage format', () => {
  it('logs exactly "You deal N damage." on a non-crit hit', () => {
    // Setup: dagger (missChance=0, critChance=0.3, damageBonus=1); player str=5
    // → attackPower=6.  Skeleton def=4, effectiveDef=4*(1-0)=4.
    // mockAttacks: miss=0.5 (no miss, dagger missChance=0 so any value works),
    //   variance=0.5 → floor(0.5*4)-1=1, crit=0.5 (0.5<0.3=false → no crit).
    // damage = max(1, floor(6-4+1)) = 3 → "You deal 3 damage."
    // If the verb changed to "hit for" or the period became "!" this test fails.
    mockAttacks([0.5, 0.5, 0.5]); // no miss, variance=1, no crit
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.log).toContain('You deal 3 damage.');
  });

  it('logs exactly "Critical hit! You deal N damage!" on a crit', () => {
    // Same weapon/enemy; crit=0 (0<0.3=true) → damage doubled: 3*2=6.
    // Pinning "Critical hit! You deal 6 damage!" locks the exclamation marks,
    // capitalization, and the exact phrasing of the two-part crit message.
    // If either half were dropped or the separator changed from "! " to ": "
    // the existing l.includes('Critical hit!') check would still pass.
    mockAttacks([0.5, 0.5, 0]); // no miss, variance=1, crit (0<0.3=true)
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.log).toContain('Critical hit! You deal 6 damage!');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: enemy attack damage format
//
// The same gap exists on the enemy side: tests check playerHp or
// l.includes('deals') + toContain(digit), not the full sentence.
// Pinning "The Bandit deals N damage." locks the article, verb, and period.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: enemy attack damage format', () => {
  it('logs exactly "The Bandit deals N damage." on a basic enemy attack', () => {
    // Setup: BANDIT (atk=6), makePlayer (def=3, leather_vest defBonus=1 → effectiveDef=4).
    // Full HP (hpPercent=1 → not desperate), random=0.5:
    //   – defending check: 0.5 < 0.20 = false → attack executes
    //   – variance = floor(0.5*4)-1 = 1; damage = max(1, floor(6-4+1)) = 3; no crit.
    // If the message changed to "Bandit hits you for 3" or "The Bandit deals 3!"
    // (missing the trailing period) the existing includes('deals') checks pass
    // while this test fails, surfacing the regression.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.BANDIT));
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('The Bandit deals 3 damage.');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: bleed tick format
//
// tickPlayerEffects() emits "You bleed for 2 damage." each turn the BLEED
// status effect is active.  Existing tests check l.includes('bleed') or
// l.includes('bleed for 2'), which pass if the format drifts to
// "Bleeding: 2 damage" or "You bleed for 2 dmg." — different verb, missing
// period, or abbreviated unit.  Pinning the full sentence locks the verb
// ("bleed"), the preposition ("for"), the numeral, and the trailing period
// in the same way the player/enemy attack formats are pinned above.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: bleed tick format', () => {
  it('logs exactly "You bleed for 2 damage." on each bleed tick', () => {
    // Stun the enemy so it takes no action this turn, making the bleed tick
    // the only log entry and leaving no ambiguity about the message source.
    // A stunned enemy skips its attack without a Math.random roll.
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy());
    engine.state.playerStatusEffects.push({ type: StatusEffectType.BLEED, turnsRemaining: 2 });
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('You bleed for 2 damage.');
  });
});

// ---------------------------------------------------------------------------
// RANGED weapon phase contract when player AGI < enemy AGI
//
// determineFirstTurn() sets playerTurn = playerAgi >= enemyAgi for RANGED weapons,
// identical to NORMAL.  However the subsequent phase-assignment block reads:
//   if (!playerTurn && speed !== WeaponSpeed.RANGED) { phase = ENEMY_ACTION }
// This exclusion means RANGED weapons NEVER start in ENEMY_ACTION, regardless of
// AGI.  The opening shot always fires in the constructor.
//
// All prior ranged tests use player AGI >= enemy AGI, so the exclusion branch is
// never exercised.  These three tests pin the contract from all angles so that
// removing the `!== RANGED` guard would be immediately caught.
// ---------------------------------------------------------------------------

describe('CombatEngine constructor — RANGED weapon keeps PLAYER_ACTION when player AGI < enemy AGI', () => {
  it('stays in PLAYER_ACTION even when player AGI is strictly below enemy AGI', () => {
    // NORMAL/SLOW weapons enter ENEMY_ACTION when playerTurn=false; RANGED does not:
    // the guard is `!playerTurn && speed !== RANGED`, so the assignment is skipped.
    // If that guard were removed, a low-AGI bow user would start in ENEMY_ACTION
    // and miss the opening shot — a silent regression in game balance.
    // Wolf agi=5 > player agi=1 → playerTurn=false for RANGED, yet phase must be PLAYER_ACTION.
    mockAttacks([0, 0, 0]); // opening-shot randoms: miss=0, variance=-1, crit=0
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.agi = 1; // strictly below WOLF agi(5)
    const engine = new CombatEngine(player, makeEnemy(EnemyType.WOLF)); // wolf agi=5
    expect(engine.state.phase).toBe(CombatPhase.PLAYER_ACTION);
  });

  it('fires the opening shot and deals damage even when player AGI is strictly below enemy AGI', () => {
    // The opening shot executes unconditionally for RANGED weapons because the constructor
    // always reaches the `if (speed === RANGED && !freeHitUsed)` block.  The RANGED
    // exclusion from the ENEMY_ACTION assignment ensures the phase is still PLAYER_ACTION
    // when the shot fires.  Without the exclusion the shot would be skipped entirely
    // (ENEMY_ACTION is set → opening-shot block is not reached in normal flow after an
    // ENEMY_ACTION phase starts) — freeHitUsed would remain false and enemyHp unchanged.
    mockAttacks([0, 0.25, 0]); // miss=0 (no miss), variance=0, crit=0 (no crit)
    const player = makePlayer();
    player.equipWeapon('hunting_bow');
    player.state.agi = 1; // strictly below WOLF agi(5)
    const enemy = makeEnemy(EnemyType.WOLF); // agi=5
    const engine = new CombatEngine(player, enemy);
    expect(engine.state.freeHitUsed).toBe(true); // opening shot consumed
    expect(engine.state.log.some(l => l.includes('opening shot'))).toBe(true);
    // hunting_bow: str(5)+damageBonus(3)=8; wolf.def=1; variance=floor(0.25*4)-1=0
    // damage = max(1, 8-1+0) = 7 (missChance=0 so shot never misses; crit=0 → no crit)
    expect(engine.state.enemyHp).toBe(enemy.hp - 7); // opening shot dealt damage
  });

  it('contrast: NORMAL weapon with the same AGI mismatch starts in ENEMY_ACTION', () => {
    // Side-by-side with the two tests above: identical player (agi=1) and enemy (wolf agi=5),
    // but rusty_shortsword (NORMAL) instead of hunting_bow.  The absence of the RANGED
    // exclusion means NORMAL obeys the standard rule — enemy goes first when player loses
    // the AGI check.  The contrast isolates the RANGED exclusion as the sole difference.
    const player = makePlayer(); // rusty_shortsword (NORMAL speed)
    player.state.agi = 1;       // strictly below WOLF agi(5)
    const engine = new CombatEngine(player, makeEnemy(EnemyType.WOLF)); // wolf agi=5
    expect(engine.state.phase).toBe(CombatPhase.ENEMY_ACTION); // NORMAL: enemy acts first
  });
});

// ---------------------------------------------------------------------------
// Exact log messages: player abilities (Pin, Shatter, Shield Bash, Ambush, Intimidate)
//
// All five ability tests above use l.includes('keyword'), which passes for any
// variant ("pinned!", "shield-bash", "AMBUSH!") while missing the full structured
// sentence the player reads in the combat log.  Pinning the complete string
// catches verb changes, missing parentheticals, renamed classes, and punctuation
// drift in the same way the existing exact-message suites do for enemy AI.
// ---------------------------------------------------------------------------

describe('CombatEngine — exact log message: Pin ability (hunting_bow)', () => {
  it('logs exactly "Your arrow pins the Skeleton! (stunned 1 turn)" when Pin is used', () => {
    // The existing l.includes('stunned') check matches "The Skeleton is stunned and cannot act!"
    // (the per-turn stun announcement) just as well as the Pin announcement — so a rename
    // of "pins" to "stuns" in the Pin message would go undetected.  Pinning the full sentence
    // locks the verb ("pins"), the parenthetical "(stunned 1 turn)", and the trailing "!".
    const player = makePlayer();
    player.state.level = 3;           // weapon abilities unlock at level 3
    player.equipWeapon('hunting_bow'); // hunting_bow: missChance=0, critChance=0, damageBonus=3
    // RANGED constructor fires an opening shot — consume its three random calls first.
    // miss=0 (no miss), variance=0.25→floor(1)-1=0, crit=0 (critChance=0, always no crit).
    mockAttacks([0, 0.25, 0]);
    const engine = new CombatEngine(player, makeEnemy()); // skeleton hp=20; opening shot deals 4
    // Phase is PLAYER_ACTION after RANGED constructor (opening shot consumed).
    engine.playerUseAbility(); // Pin: stun the skeleton for 1 turn
    expect(engine.state.log).toContain('Your arrow pins the Skeleton! (stunned 1 turn)');
  });
});

describe('CombatEngine — exact log message: Shatter ability (mace)', () => {
  it('logs exactly "Shatter! Skeleton\'s DEF reduced by 2!" when Shatter reduces DEF by 2', () => {
    // The existing l.includes('Shatter') check passes for "SHATTER!", "Shattered!", or any
    // message containing that word.  Pinning the full sentence locks the apostrophe
    // possessive, the reduction amount "2", and the trailing "!" so a rename of
    // the ability or a different reduction format is caught immediately.
    const player = makePlayer();
    player.state.level = 3;   // weapon abilities unlock at level 3
    player.equipWeapon('mace'); // SLOW; skeleton.agi=2 < player.agi=3; SLOW rule: 3>2+3=5 → false
    const engine = new CombatEngine(player, makeEnemy()); // skeleton def=4; phase=ENEMY_ACTION (mace SLOW)
    engine.state.phase = CombatPhase.PLAYER_ACTION; // advance to player turn for test
    engine.playerUseAbility(); // Shatter: reduction=min(2,4)=2; enemy.def 4→2
    expect(engine.state.log).toContain("Shatter! Skeleton's DEF reduced by 2!");
  });

  it('logs exactly "Skeleton\'s armor is already broken!" when Shatter is used on an enemy with DEF 0', () => {
    // The "Mace Shatter on already-broken armor" test at line ~1884 uses
    // l.includes('already broken'), which passes even if the message changes from
    // "Skeleton's armor is already broken!" to "The armor is already broken!" (losing
    // the enemy name) or "Skeleton's armor cannot be broken further!" (different phrasing).
    // Pinning the full exact string matches the contract set for the Shatter-success path
    // above: both branches of the `if (reduction > 0)` guard must have exact message pins
    // so any player-facing reword is caught before it silently ships.
    const player = makePlayer();
    player.state.level = 3;
    player.equipWeapon('mace'); // SLOW; mace starts in ENEMY_ACTION against skeleton
    const enemy = makeEnemy();  // Skeleton (name = 'Skeleton', def = 4)
    enemy.def = 0;              // force DEF to 0 so reduction = min(2, 0) = 0 → "already broken" branch
    const engine = new CombatEngine(player, enemy);
    engine.state.phase = CombatPhase.PLAYER_ACTION;
    engine.playerUseAbility();
    expect(engine.state.log).toContain("Skeleton's armor is already broken!");
  });
});

describe('CombatEngine — exact log message: Shield Bash ability (Warrior)', () => {
  it('logs exactly "Shield Bash! The Skeleton is stunned!" when Shield Bash is used', () => {
    // The existing l.includes('Shield Bash') check passes for "Shield-Bash" or "shield bash" (case
    // change).  Pinning the full sentence locks the "The" article, the "is stunned!" verb phrase,
    // and the exclamation mark — matching the phrasing pattern used by all other stun announcements.
    const player = makePlayer(); // level=1: no weapon ability; rusty_shortsword, agi=3
    player.chooseClass(ClassPath.WARRIOR); // class ability: Shield Bash (no weapon-ability competition)
    const engine = new CombatEngine(player, makeEnemy()); // skeleton agi=2; NORMAL: 3>=2 → PLAYER_ACTION
    engine.playerUseAbility(); // Shield Bash: stun skeleton; no random calls needed
    expect(engine.state.log).toContain('Shield Bash! The Skeleton is stunned!');
  });
});

describe('CombatEngine — exact log message: Ambush ability (Scout)', () => {
  it('logs exactly "Ambush! Striking from the shadows..." when Ambush is used', () => {
    // The existing l.includes('Ambush') check passes for "ambush!" (lower case) or "AMBUSH STRIKE!".
    // Pinning the full sentence locks the ellipsis "..." and the "Striking from the shadows" phrasing
    // so any rephrasing of the ability announcement is caught even if "Ambush" still appears.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // miss=0.5 (rusty_shortsword missChance=0 → no miss),
    // variance=0.5→floor(2)-1=1; forceCrit=true → critChance=1 → crit always fires.
    const player = makePlayer(); // level=1; rusty_shortsword; agi=3
    player.chooseClass(ClassPath.SCOUT); // class ability: Ambush
    const engine = new CombatEngine(player, makeEnemy()); // skeleton agi=2; NORMAL → PLAYER_ACTION
    engine.playerUseAbility(); // Ambush: forceCrit=true; logs announcement then attack
    expect(engine.state.log).toContain('Ambush! Striking from the shadows...');
  });
});

describe('CombatEngine — exact log message: Intimidate ability (Brigand)', () => {
  it('logs exactly "Intimidate! Skeleton ATK reduced by 3 for 3 turns!" when Intimidate is used', () => {
    // The existing l.includes('Intimidate') check passes for "Intimidated!" or a log that merely
    // mentions the word without the ATK/turn details.  Pinning the full sentence locks the
    // reduction magnitude "3", the duration "3 turns", and the "ATK reduced by" phrasing so a
    // balance change to the WEAKEN magnitude or duration silently breaks the announced contract.
    const player = makePlayer(); // level=1; rusty_shortsword; agi=3
    player.chooseClass(ClassPath.BRIGAND); // class ability: Intimidate
    const engine = new CombatEngine(player, makeEnemy()); // skeleton agi=2; NORMAL → PLAYER_ACTION
    engine.playerUseAbility(); // Intimidate: no random calls; just logs and applies WEAKEN
    expect(engine.state.log).toContain('Intimidate! Skeleton ATK reduced by 3 for 3 turns!');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: stun-skip announcement
//
// Status effects — STUN tests at line 802 check l.includes('stunned'), which
// passes for any string containing that word — including the Pin announcement
// "Your arrow pins the Skeleton! (stunned 1 turn)".  The actual stun-skip
// message is `"${enemy.name} is stunned and cannot act!"`.  Pinning the full
// sentence locks the verb phrase, the exclamation mark, and the enemy name so
// a rename ("cannot move", "is immobilized") or dropped subject ("stunned and
// cannot act!") is caught rather than silently changing the combat log.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: stun-skip announcement', () => {
  it('logs exactly "Skeleton is stunned and cannot act!" when a stunned enemy\'s turn is skipped', () => {
    // The existing l.includes('stunned') test is not an exact pin: it would also
    // pass if the message were "The Skeleton is stunned!" (extra "The") or
    // "stunned — cannot act." (different punctuation).  This test pins the full
    // literal so any reformatting is caught immediately.
    const engine = new CombatEngine(makeFastPlayer(), makeEnemy()); // Skeleton
    engine.state.enemyStatusEffects.push({ type: StatusEffectType.STUN, turnsRemaining: 1 });
    engine.state.phase = CombatPhase.ENEMY_ACTION;
    engine.enemyTurn();
    expect(engine.state.log).toContain('Skeleton is stunned and cannot act!');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: WEAKEN expiry announcement
//
// The tickEnemyEffects() helper (called from update() at end of
// ENEMY_ANIMATING) emits `"${enemy.name} is no longer weakened."` when a
// WEAKEN effect reaches zero turns.  The existing test (status effect refresh
// and expiry suite) checks l.includes('no longer weakened'), which passes for
// any variant ("Skeleton is no longer WEAKENED" / "no longer weakened!" with
// an exclamation mark).  Pinning the full sentence — including the trailing
// period and the enemy's name — ensures the exact player-facing text is locked
// so rephrasing or punctuation drift breaks a test rather than reaching the UI.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: WEAKEN expiry announcement', () => {
  it('logs exactly "Skeleton is no longer weakened." when a WEAKEN effect expires', () => {
    // Setup: push a WEAKEN with 1 turn remaining, then trigger the ENEMY_ANIMATING
    // → end-of-animation path in update() (animationFrame >= 20) which calls
    // tickEnemyEffects().  The WEAKEN decrements to 0, fires the expiry log, and
    // is removed from enemyStatusEffects.
    const engine = new CombatEngine(makePlayer(), makeEnemy()); // Skeleton
    engine.state.enemyStatusEffects.push({
      type: StatusEffectType.WEAKEN, turnsRemaining: 1, magnitude: 3,
    });
    engine.state.phase = CombatPhase.ENEMY_ANIMATING;
    engine.state.animationFrame = 21; // triggers end-of-animation (>= 20) → tickEnemyEffects
    engine.update();
    expect(engine.state.log).toContain('Skeleton is no longer weakened.');
  });
});

// ---------------------------------------------------------------------------
// Exact log message: player attack miss
//
// executePlayerAttack() emits "Your attack misses!" when the random miss roll
// falls below the weapon's missChance.  Five existing tests check
// l.includes('misses'), which passes for any variant: "You miss!", "Attack
// misses the target.", or "Your attack misses the Skeleton!" (name suffix).
// Pinning the full literal — verb, possessive, and trailing exclamation mark —
// ensures the player-facing feedback is never silently reworded.
// ---------------------------------------------------------------------------
describe('CombatEngine — exact log message: player attack miss', () => {
  it('logs exactly "Your attack misses!" when the miss roll falls below missChance', () => {
    // hand_axe: missChance=0.2, NORMAL speed, player.agi=10 ensures player goes first.
    // random=0.1 < 0.2 → miss branch fires.  executePlayerAttack() returns early
    // after logging the miss, so no damage message or crit message is appended.
    // If "misses" were changed to "missed" or the subject dropped to just "Misses!",
    // the five existing l.includes('misses') checks would still pass while this test
    // fails — catching the reword before it reaches the player.
    const player = makePlayer();
    player.equipWeapon('hand_axe'); // missChance=0.2
    player.state.agi = 10;          // ensure PLAYER_ACTION phase
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.2 → miss
    const engine = new CombatEngine(player, makeEnemy(EnemyType.SKELETON));
    engine.playerAttack();
    expect(engine.state.log).toContain('Your attack misses!');
  });
});

// ---------------------------------------------------------------------------
// playerFlee — AGI bonus and Brigand class modifier
//
// playerFlee() computes:
//   fleeChance = 0.5 + agiBonus + classBonus
// where agiBonus = player.agi > enemy.agi ? 0.2 : 0, and classBonus is
// +0.15 for Scout and −0.1 for Warrior.  Brigand gets 0.
//
// All existing flee tests use random=0 (guaranteed succeed) or random=0.99
// (guaranteed fail), so neither isolates the +0.2 agiBonus boundary.  The
// Scout test uses random=0.6 with fleeChance=0.5+0.2(agi)+0.15(scout)=0.85 —
// the agiBonus is unnecessary for that test to pass (0.6 < 0.65 without it).
//
// These three tests pin the gap:
//   1. player.agi > enemy.agi → +0.2 is wired into the calculation
//   2. player.agi === enemy.agi → condition is strict > (not >=), no bonus
//   3. ClassPath.BRIGAND → classBonus stays at 0
// ---------------------------------------------------------------------------
describe('CombatEngine.playerFlee — AGI bonus and Brigand class modifier', () => {
  it('player AGI > enemy AGI applies +0.2 flee bonus — roll=0.6 succeeds with bonus but not without', () => {
    // player.agi(3) > skeleton.agi(2) → agiBonus=0.2; no classPath.
    // fleeChance = 0.5 + 0.2 + 0 = 0.7; random=0.6 < 0.7 → flee succeeds.
    // Without the agiBonus: fleeChance=0.5 and 0.6 >= 0.5 → flee fails.
    // This is the only test that isolates the +0.2 as load-bearing.
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.SKELETON));
    expect(engine.playerFlee()).toBe(true);
    expect(engine.state.log).toContain('You flee from battle!');
  });

  it('player AGI equal to enemy AGI gives NO flee bonus — strict > means ties are excluded', () => {
    // player.agi(3) === bandit.agi(3): `player.agi > enemy.agi` is false → agiBonus=0.
    // fleeChance = 0.5 + 0 + 0 = 0.5; random=0.6 >= 0.5 → flee fails.
    // If the condition were changed to >= (including equal), agiBonus=0.2 and
    // fleeChance=0.7: 0.6 < 0.7 → succeed — this test would catch that regression.
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const engine = new CombatEngine(makePlayer(), makeEnemy(EnemyType.BANDIT)); // agi=3 vs agi=3
    expect(engine.playerFlee()).toBe(false);
    expect(engine.state.log).toContain('Failed to escape!');
  });

  it('Brigand class has no flee modifier — classBonus stays 0, not +0.15 like Scout or −0.1 like Warrior', () => {
    // playerFlee sets classBonus only for SCOUT (+0.15) and WARRIOR (−0.1).
    // Brigand is absent from both branches, so classBonus=0.
    // player.agi(3) === bandit.agi(3) → no agiBonus; fleeChance = 0.5.
    // random=0.55 >= 0.5 → flee fails.
    // If Brigand were accidentally granted SCOUT's +0.15: fleeChance=0.65, 0.55 < 0.65 → succeed.
    // If Brigand were accidentally granted WARRIOR's −0.1: fleeChance=0.4, 0.55 >= 0.4 → still fail
    // (that regression would be caught only by a succeed-expected test, but the positive Brigand
    // test with random=0.4 in the existing suite already covers a successful flee for Brigand
    // and would break if a penalty were applied: fleeChance=0.4, 0.4 < 0.4=false → fail).
    vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const player = makePlayer();
    player.state.classPath = ClassPath.BRIGAND;
    const engine = new CombatEngine(player, makeEnemy(EnemyType.BANDIT)); // equal agi → no agiBonus
    expect(engine.playerFlee()).toBe(false);
    expect(engine.state.log).toContain('Failed to escape!');
  });
});
