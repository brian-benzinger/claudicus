import {
  CombatState,
  CombatPhase,
  EnemyInstance,
  EnemyType,
  WeaponSpeed,
  Weapon,
  StatusEffect,
  StatusEffectType,
  ClassPath
} from './types';
import { PlayerManager } from './player';

export class CombatEngine {
  state: CombatState;
  private player: PlayerManager;
  private weapon: Weapon;

  constructor(player: PlayerManager, enemy: EnemyInstance) {
    this.player = player;
    this.weapon = player.getWeapon();

    this.state = {
      enemy: { ...enemy },
      playerHp: player.state.hp,
      enemyHp: enemy.hp,
      playerTurn: true,
      phase: CombatPhase.PLAYER_ACTION,
      log: [`A ${enemy.name} appears!`],
      defendingThisTurn: false,
      nextAttackBonus: 0,
      freeHitUsed: false,
      enemyDefending: false,
      animationFrame: 0,
      resultTimer: 0,
      playerStatusEffects: [],
      enemyStatusEffects: [],
      enemyTurnCount: 0,
      enemyIsPhaseTwo: false,
      enemyJustDefended: false,
      abilityUsedThisCombat: false
    };

    this.determineFirstTurn();

    if (this.weapon.speed === WeaponSpeed.RANGED && !this.state.freeHitUsed) {
      this.state.log.push('You fire an opening shot!');
      this.executePlayerAttack(true);
      this.state.freeHitUsed = true;
    }
  }

  private determineFirstTurn(): void {
    const playerAgi = this.player.state.agi;
    const enemyAgi = this.state.enemy.agi;

    switch (this.weapon.speed) {
      case WeaponSpeed.FAST:
        this.state.playerTurn = true;
        break;
      case WeaponSpeed.SLOW:
        this.state.playerTurn = playerAgi > enemyAgi + 3;
        break;
      case WeaponSpeed.RANGED:
        this.state.playerTurn = playerAgi >= enemyAgi;
        break;
      case WeaponSpeed.NORMAL:
      default:
        this.state.playerTurn = playerAgi >= enemyAgi;
        break;
    }

    if (!this.state.playerTurn && this.weapon.speed !== WeaponSpeed.RANGED) {
      this.state.phase = CombatPhase.ENEMY_ACTION;
    }
  }

  // Calculate damage
  private calcDamage(
    attackPower: number,
    defense: number,
    ignoresDefense: number,
    critChance: number
  ): { damage: number; crit: boolean } {
    const effectiveDef = defense * (1 - ignoresDefense);
    const variance = Math.floor(Math.random() * 4) - 1; // -1 to +2
    let damage = Math.max(1, Math.floor(attackPower - effectiveDef + variance));

    const crit = Math.random() < critChance;
    if (crit) damage *= 2;

    return { damage, crit };
  }

  // Execute player attack — forceCrit=true for Ambush, critMultiplier for Backstab
  private executePlayerAttack(
    isFreeHit: boolean = false,
    forceCrit: boolean = false,
    critMultiplier: number = 1
  ): void {
    if (Math.random() < this.weapon.missChance) {
      this.state.log.push('Your attack misses!');
      return;
    }

    const attackPower = this.player.computeWeaponDamage() + this.state.nextAttackBonus;
    const baseCrit = forceCrit ? 1 : Math.min(1, this.weapon.critChance * critMultiplier);

    const { damage, crit } = this.calcDamage(
      attackPower,
      this.state.enemyDefending ? this.state.enemy.def * 2 : this.state.enemy.def,
      this.weapon.ignoresDefense,
      baseCrit
    );

    this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
    this.state.nextAttackBonus = 0;

    if (crit) {
      this.state.log.push(`Critical hit! You deal ${damage} damage!`);
    } else {
      this.state.log.push(`You deal ${damage} damage.`);
    }
  }

  // Execute enemy attack — shared helper for all AI profiles
  private executeEnemyAttack(multiplier: number = 1, ignoresDef: number = 0): void {
    const enemy = this.state.enemy;

    // Apply WEAKEN debuff to enemy ATK
    const weaken = this.state.enemyStatusEffects.find(e => e.type === StatusEffectType.WEAKEN);
    const atkReduction = weaken?.magnitude ?? 0;
    const attackPower = Math.max(1, Math.floor(enemy.atk * multiplier) - atkReduction);

    const playerDef = this.player.getEffectiveDef();
    const { damage } = this.calcDamage(attackPower, playerDef, ignoresDef, 0);

    const actualDamage = this.state.defendingThisTurn
      ? Math.max(1, Math.floor(damage * 0.5))
      : damage;

    this.player.takeDamage(actualDamage, false);
    this.state.playerHp = this.player.state.hp;
    this.state.log.push(`The ${enemy.name} deals ${actualDamage} damage.`);
  }

  // Player attack action
  playerAttack(): void {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return;

    this.state.defendingThisTurn = false;
    this.state.enemyDefending = false;
    this.state.enemyJustDefended = false;

    this.executePlayerAttack();

    if (this.state.enemyHp <= 0) {
      this.state.log.push(`The ${this.state.enemy.name} is defeated!`);
    }

    this.enterPlayerAnimation();
  }

  // Player defend action
  playerDefend(): void {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return;

    this.state.defendingThisTurn = true;
    this.state.nextAttackBonus = 1;
    this.state.log.push('You brace for impact. (+1 damage next turn)');

    this.state.phase = CombatPhase.ENEMY_ACTION;
    this.state.playerTurn = false;
  }

  // Player use potion
  playerPotion(): boolean {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return false;

    if (this.player.usePotion()) {
      this.state.playerHp = this.player.state.hp;
      this.state.log.push(`You drink a potion. HP restored to ${this.state.playerHp}.`);

      this.state.phase = CombatPhase.ENEMY_ACTION;
      this.state.playerTurn = false;
      return true;
    } else {
      this.state.log.push('No potions left!');
      return false;
    }
  }

  // Player flee attempt
  playerFlee(): boolean {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return false;

    const baseChance = 0.5;
    const agiBonus = this.player.state.agi > this.state.enemy.agi ? 0.2 : 0;
    let classBonus = 0;
    if (this.player.state.classPath === ClassPath.SCOUT)   classBonus =  0.15;
    if (this.player.state.classPath === ClassPath.WARRIOR) classBonus = -0.1;
    const fleeChance = baseChance + agiBonus + classBonus;

    if (Math.random() < fleeChance) {
      this.state.log.push('You flee from battle!');
      this.state.phase = CombatPhase.DONE;
      return true;
    } else {
      this.state.log.push('Failed to escape!');
      this.state.phase = CombatPhase.ENEMY_ACTION;
      this.state.playerTurn = false;
      return false;
    }
  }

  // --- AI / ability helpers ---

  private setEnemyDefending(): void {
    this.state.enemyDefending = true;
    this.state.enemyJustDefended = true;
  }

  private enterPlayerAnimation(): void {
    this.state.phase = CombatPhase.PLAYER_ANIMATING;
    this.state.animationFrame = 0;
  }

  // --- Status effect helpers ---

  private applyStatusEffect(target: 'player' | 'enemy', effect: StatusEffect): void {
    const list = target === 'player'
      ? this.state.playerStatusEffects
      : this.state.enemyStatusEffects;
    const existing = list.find(e => e.type === effect.type);
    if (existing) {
      existing.turnsRemaining = effect.turnsRemaining;
      if (effect.magnitude !== undefined) existing.magnitude = effect.magnitude;
    } else {
      list.push({ ...effect });
    }
  }

  // Tick BLEED on player (called at start of enemy turn)
  private tickPlayerEffects(): void {
    for (let i = this.state.playerStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.state.playerStatusEffects[i];
      if (effect.type === StatusEffectType.BLEED) {
        const dmg = 2;
        this.player.takeDamage(dmg, false);
        this.state.playerHp = this.player.state.hp;
        this.state.log.push(`You bleed for ${dmg} damage.`);
      }
      effect.turnsRemaining--;
      if (effect.turnsRemaining <= 0) {
        this.state.playerStatusEffects.splice(i, 1);
      }
    }
  }

  // Tick enemy effects at end of ENEMY_ANIMATING phase (in update())
  private tickEnemyEffects(): void {
    for (let i = this.state.enemyStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.state.enemyStatusEffects[i];
      effect.turnsRemaining--;
      if (effect.turnsRemaining <= 0) {
        if (effect.type === StatusEffectType.WEAKEN) {
          this.state.log.push(`${this.state.enemy.name} is no longer weakened.`);
        }
        this.state.enemyStatusEffects.splice(i, 1);
      }
    }
  }

  // --- Enemy AI ---

  enemyTurn(): void {
    if (this.state.phase !== CombatPhase.ENEMY_ACTION) return;
    if (this.state.enemyHp <= 0) {
      this.state.phase = CombatPhase.DONE;
      return;
    }

    this.state.phase = CombatPhase.ENEMY_ANIMATING;
    this.state.animationFrame = 0;

    // Tick player effects (bleed, etc.) before enemy acts
    this.tickPlayerEffects();
    if (this.state.playerHp <= 0) {
      this.state.phase = CombatPhase.DONE;
      this.state.log.push('You have fallen!');
      return;
    }

    // Check if enemy is stunned — skip their turn
    const stunIdx = this.state.enemyStatusEffects.findIndex(
      e => e.type === StatusEffectType.STUN
    );
    if (stunIdx !== -1) {
      const stun = this.state.enemyStatusEffects[stunIdx];
      stun.turnsRemaining--;
      this.state.log.push(`${this.state.enemy.name} is stunned and cannot act!`);
      if (stun.turnsRemaining <= 0) {
        this.state.enemyStatusEffects.splice(stunIdx, 1);
      }
      this.state.phase = CombatPhase.PLAYER_ACTION;
      this.state.playerTurn = true;
      return;
    }

    this.state.enemyTurnCount++;
    this.dispatchEnemyAI();
    this.state.defendingThisTurn = false;

    if (this.state.playerHp <= 0) {
      this.state.phase = CombatPhase.DONE;
      this.state.log.push('You have fallen!');
    } else {
      this.state.phase = CombatPhase.PLAYER_ACTION;
      this.state.playerTurn = true;
    }
  }

  private dispatchEnemyAI(): void {
    switch (this.state.enemy.type) {
      case EnemyType.WOLF:          this.wolfAI();          break;
      case EnemyType.BANDIT_ARCHER: this.banditArcherAI();  break;
      case EnemyType.SKELETON:      this.skeletonAI();       break;
      case EnemyType.WILD_BOAR:     this.wildBoarAI();       break;
      case EnemyType.REVENANT_KNIGHT: this.revenantKnightAI(); break;
      default:                      this.defaultEnemyAI();   break;
    }
  }

  private wolfAI(): void {
    if (Math.random() < 0.30) {
      // Howl: weaken player's next attack
      this.state.nextAttackBonus = Math.min(this.state.nextAttackBonus, -2);
      this.state.log.push(
        `The ${this.state.enemy.name} lets out a fearsome howl! (-2 to your next attack)`
      );
    } else {
      this.executeEnemyAttack();
    }
  }

  private banditArcherAI(): void {
    if (this.state.enemyTurnCount % 2 === 1) {
      // Odd turns: ranged shot ignores 30% DEF
      this.state.log.push(`The ${this.state.enemy.name} fires an arrow!`);
      this.executeEnemyAttack(1, 0.3);
    } else {
      // Even turns: melee attack
      this.state.log.push(`The ${this.state.enemy.name} draws a knife!`);
      this.executeEnemyAttack();
    }
  }

  private skeletonAI(): void {
    // Heal every 3rd turn
    if (this.state.enemyTurnCount % 3 === 0) {
      const healAmt = 5;
      this.state.enemyHp = Math.min(this.state.enemy.maxHp, this.state.enemyHp + healAmt);
      this.state.log.push(`The ${this.state.enemy.name} mends its bones! (+${healAmt} HP)`);
    }
    if (Math.random() < 0.40) {
      this.setEnemyDefending();
      this.state.log.push(`The ${this.state.enemy.name} raises a shield of bones.`);
    } else {
      this.executeEnemyAttack();
    }
  }

  private wildBoarAI(): void {
    if (Math.random() < 0.90) {
      this.state.log.push(`The ${this.state.enemy.name} charges!`);
      this.executeEnemyAttack(1.2);
    } else {
      this.setEnemyDefending();
      this.state.log.push(`The ${this.state.enemy.name} stamps its hooves.`);
    }
  }

  private revenantKnightAI(): void {
    const hpPercent = this.state.enemyHp / this.state.enemy.maxHp;

    // Phase 2 trigger at 50% HP
    if (hpPercent < 0.5 && !this.state.enemyIsPhaseTwo) {
      this.state.enemyIsPhaseTwo = true;
      this.state.log.push(`The ${this.state.enemy.name} roars with dark fury!`);
    }

    if (this.state.enemyIsPhaseTwo) {
      if (Math.random() < 0.90) {
        this.executeEnemyAttack(1.1);
        // Phase 2 attacks cause bleed
        this.applyStatusEffect('player', { type: StatusEffectType.BLEED, turnsRemaining: 3 });
        this.state.log.push('The wound begins to bleed! (2 dmg/turn, 3 turns)');
      } else {
        this.setEnemyDefending();
        this.state.log.push(`The ${this.state.enemy.name} raises its cursed blade.`);
      }
    } else {
      if (Math.random() < 0.25) {
        this.setEnemyDefending();
        this.state.log.push(`The ${this.state.enemy.name} braces for your attack.`);
      } else {
        this.executeEnemyAttack();
      }
    }
  }

  private defaultEnemyAI(): void {
    const hpPercent = this.state.enemyHp / this.state.enemy.maxHp;

    if (hpPercent < 0.25 && Math.random() < 0.3) {
      this.state.log.push(`The ${this.state.enemy.name} makes a desperate attack!`);
      this.executeEnemyAttack(1.5);
    } else if (Math.random() < 0.2) {
      this.setEnemyDefending();
      this.state.log.push(`The ${this.state.enemy.name} braces for your attack.`);
    } else {
      this.executeEnemyAttack();
    }
  }

  // --- Player abilities ---

  // Returns the name of the currently available ability, or null if none
  getAvailableAbility(): string | null {
    const player = this.player.state;

    // Weapon-specific abilities unlock at level 3
    if (player.level >= 3) {
      switch (player.weaponId) {
        case 'dagger':      return 'Backstab';
        case 'hunting_bow': return 'Pin';
        case 'mace':        return 'Shatter';
      }
    }

    // Class abilities unlock after choosing a class
    if (player.classPath) {
      switch (player.classPath) {
        case ClassPath.WARRIOR: return 'Shield Bash';
        case ClassPath.SCOUT:   return this.state.abilityUsedThisCombat ? null : 'Ambush';
        case ClassPath.BRIGAND: return 'Intimidate';
      }
    }

    return null;
  }

  playerUseAbility(): void {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return;
    if (!this.getAvailableAbility()) return;

    const player = this.player.state;

    // Weapon abilities
    if (player.level >= 3) {
      switch (player.weaponId) {
        case 'dagger': {
          // Backstab: 2× crit chance attack
          this.state.defendingThisTurn = false;
          this.state.enemyDefending = false;
          const flavor = this.state.enemyJustDefended
            ? 'You strike while they\'re off-guard!'
            : 'You go for a backstab!';
          this.state.log.push(flavor);
          this.state.enemyJustDefended = false;
          this.executePlayerAttack(false, false, 2);
          if (this.state.enemyHp <= 0) {
            this.state.log.push(`The ${this.state.enemy.name} is defeated!`);
          }
          this.enterPlayerAnimation();
          return;
        }
        case 'hunting_bow': {
          // Pin: stun enemy for 1 turn
          this.applyStatusEffect('enemy', { type: StatusEffectType.STUN, turnsRemaining: 1 });
          this.state.log.push(`Your arrow pins the ${this.state.enemy.name}! (stunned 1 turn)`);
          this.enterPlayerAnimation();
          return;
        }
        case 'mace': {
          // Shatter: permanently reduce enemy DEF by 2
          const reduction = Math.min(2, this.state.enemy.def);
          this.state.enemy.def = Math.max(0, this.state.enemy.def - reduction);
          if (reduction > 0) {
            this.state.log.push(`Shatter! ${this.state.enemy.name}'s DEF reduced by ${reduction}!`);
          } else {
            this.state.log.push(`${this.state.enemy.name}'s armor is already broken!`);
          }
          this.enterPlayerAnimation();
          return;
        }
      }
    }

    // Class abilities
    if (player.classPath) {
      switch (player.classPath) {
        case ClassPath.WARRIOR: {
          // Shield Bash: stun the enemy
          this.applyStatusEffect('enemy', { type: StatusEffectType.STUN, turnsRemaining: 1 });
          this.state.log.push(`Shield Bash! The ${this.state.enemy.name} is stunned!`);
          this.enterPlayerAnimation();
          return;
        }
        case ClassPath.SCOUT: {
          // Ambush: guaranteed crit attack (once per combat)
          if (!this.state.abilityUsedThisCombat) {
            this.state.abilityUsedThisCombat = true;
            this.state.defendingThisTurn = false;
            this.state.enemyDefending = false;
            this.state.log.push('Ambush! Striking from the shadows...');
            this.executePlayerAttack(false, true);
            if (this.state.enemyHp <= 0) {
              this.state.log.push(`The ${this.state.enemy.name} is defeated!`);
            }
            this.enterPlayerAnimation();
          }
          return;
        }
        case ClassPath.BRIGAND: {
          // Intimidate: weaken enemy ATK for 3 turns
          this.applyStatusEffect('enemy', {
            type: StatusEffectType.WEAKEN,
            turnsRemaining: 3,
            magnitude: 3
          });
          this.state.log.push(
            `Intimidate! ${this.state.enemy.name} ATK reduced by 3 for 3 turns!`
          );
          this.enterPlayerAnimation();
          return;
        }
      }
    }
  }

  // Update animation frames
  update(): void {
    if (this.state.phase === CombatPhase.PLAYER_ANIMATING ||
        this.state.phase === CombatPhase.ENEMY_ANIMATING) {
      this.state.animationFrame++;
      if (this.state.animationFrame > 20) {
        if (this.state.phase === CombatPhase.PLAYER_ANIMATING) {
          if (this.state.enemyHp <= 0) {
            this.state.phase = CombatPhase.DONE;
          } else {
            this.state.phase = CombatPhase.ENEMY_ACTION;
          }
        } else {
          // End of enemy animation — tick enemy effect durations
          this.tickEnemyEffects();
          if (this.state.playerHp <= 0) {
            this.state.phase = CombatPhase.DONE;
          } else {
            this.state.phase = CombatPhase.PLAYER_ACTION;
          }
        }
      }
    }

    if (this.state.phase === CombatPhase.RESULT) {
      this.state.resultTimer++;
      if (this.state.resultTimer > 60) {
        this.state.phase = CombatPhase.DONE;
      }
    }
  }

  isDone(): boolean {
    return this.state.phase === CombatPhase.DONE;
  }

  getResult(): 'victory' | 'defeat' | 'fled' | 'ongoing' {
    if (!this.isDone()) return 'ongoing';
    if (this.state.playerHp <= 0) return 'defeat';
    if (this.state.enemyHp <= 0) return 'victory';
    return 'fled';
  }

  computeRewards(): { xp: number; gold: number } {
    const xp = this.state.enemy.xp;
    const gold = Math.random() < 0.5 ? this.state.enemy.gold : 0;
    return { xp, gold };
  }

  getRecentLog(count: number = 3): string[] {
    return this.state.log.slice(-count);
  }
}
