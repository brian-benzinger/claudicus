import {
  CombatState,
  CombatPhase,
  EnemyInstance,
  WeaponSpeed,
  Weapon
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
      resultTimer: 0
    };

    // Determine first turn based on weapon speed
    this.determineFirstTurn();

    // Handle ranged free hit
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
        // Player goes second unless AGI > enemy AGI + 3
        this.state.playerTurn = playerAgi > enemyAgi + 3;
        break;
      case WeaponSpeed.RANGED:
        // Free hit handled separately, then AGI
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
    let damage = Math.max(1, attackPower - effectiveDef + variance);

    const crit = Math.random() < critChance;
    if (crit) {
      damage *= 2;
    }

    return { damage, crit };
  }

  // Execute player attack
  private executePlayerAttack(isFreeHit: boolean = false): void {
    // Check for miss
    if (Math.random() < this.weapon.missChance) {
      this.state.log.push('Your attack misses!');
      return;
    }

    const attackPower = this.player.computeWeaponDamage() + this.state.nextAttackBonus;
    const { damage, crit } = this.calcDamage(
      attackPower,
      this.state.enemyDefending ? this.state.enemy.def * 2 : this.state.enemy.def,
      this.weapon.ignoresDefense,
      this.weapon.critChance
    );

    this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
    this.state.nextAttackBonus = 0;

    if (crit) {
      this.state.log.push(`Critical hit! You deal ${damage} damage!`);
    } else {
      this.state.log.push(`You deal ${damage} damage.`);
    }
  }

  // Player attack action
  playerAttack(): void {
    if (this.state.phase !== CombatPhase.PLAYER_ACTION) return;

    this.state.defendingThisTurn = false;
    this.state.enemyDefending = false;

    this.executePlayerAttack();

    if (this.state.enemyHp <= 0) {
      this.state.log.push(`The ${this.state.enemy.name} is defeated!`);
    }

    // Phase transitions happen in update() after animation completes
    this.state.phase = CombatPhase.PLAYER_ANIMATING;
    this.state.animationFrame = 0;
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
    const fleeChance = baseChance + agiBonus;

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

  // Execute enemy turn
  enemyTurn(): void {
    if (this.state.phase !== CombatPhase.ENEMY_ACTION) return;
    if (this.state.enemyHp <= 0) {
      this.state.phase = CombatPhase.DONE;
      return;
    }

    this.state.phase = CombatPhase.ENEMY_ANIMATING;
    this.state.animationFrame = 0;

    const enemy = this.state.enemy;
    const hpPercent = this.state.enemyHp / enemy.maxHp;

    // Enemy AI
    let attackMultiplier = 1;
    let defending = false;

    if (hpPercent < 0.25 && Math.random() < 0.3) {
      // Desperate attack
      attackMultiplier = 1.5;
      this.state.log.push(`The ${enemy.name} makes a desperate attack!`);
    } else if (Math.random() < 0.2) {
      // Defend
      defending = true;
      this.state.enemyDefending = true;
      this.state.log.push(`The ${enemy.name} braces for your attack.`);
    }

    if (!defending) {
      const attackPower = Math.floor(enemy.atk * attackMultiplier);
      const playerDef = this.player.getEffectiveDef();
      const { damage } = this.calcDamage(attackPower, playerDef, 0, 0);

      const actualDamage = this.state.defendingThisTurn
        ? Math.max(1, Math.floor(damage * 0.5))
        : damage;

      this.player.takeDamage(actualDamage, false);
      this.state.playerHp = this.player.state.hp;
      this.state.log.push(`The ${enemy.name} deals ${actualDamage} damage.`);
    }

    this.state.defendingThisTurn = false;

    if (this.state.playerHp <= 0) {
      this.state.phase = CombatPhase.DONE;
      this.state.log.push('You have fallen!');
    } else {
      this.state.phase = CombatPhase.PLAYER_ACTION;
      this.state.playerTurn = true;
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

  // Check if combat is over
  isDone(): boolean {
    return this.state.phase === CombatPhase.DONE;
  }

  // Get combat result
  getResult(): 'victory' | 'defeat' | 'fled' | 'ongoing' {
    if (!this.isDone()) return 'ongoing';
    if (this.state.playerHp <= 0) return 'defeat';
    if (this.state.enemyHp <= 0) return 'victory';
    return 'fled';
  }

  // Compute rewards for victory
  computeRewards(): { xp: number; gold: number } {
    const xp = this.state.enemy.xp;
    const gold = Math.random() < 0.5 ? this.state.enemy.gold : 0;
    return { xp, gold };
  }

  // Get last few log entries for display
  getRecentLog(count: number = 3): string[] {
    return this.state.log.slice(-count);
  }
}
