import {
  PlayerState,
  Weapon,
  createDefaultPlayer,
  xpForLevel,
  MAX_LEVEL,
  MAX_POTIONS,
  POTION_HEAL
} from './types';
import { getWeapon } from './data/weapons';

export class PlayerManager {
  state: PlayerState;

  constructor(state?: PlayerState) {
    this.state = state || createDefaultPlayer();
  }

  reset(): void {
    this.state = createDefaultPlayer();
  }

  loadState(state: PlayerState): void {
    this.state = { ...state };
  }

  // Movement
  move(dx: number, dy: number): void {
    this.state.tileX += dx;
    this.state.tileY += dy;

    // Update facing direction
    if (dx > 0) this.state.facing = 'right';
    else if (dx < 0) this.state.facing = 'left';
    else if (dy > 0) this.state.facing = 'down';
    else if (dy < 0) this.state.facing = 'up';
  }

  // Get current weapon
  getWeapon(): Weapon {
    return getWeapon(this.state.weaponId);
  }

  // Compute weapon damage (STR + weapon bonus)
  computeWeaponDamage(): number {
    const weapon = this.getWeapon();
    return this.state.str + weapon.damageBonus;
  }

  // Take damage, returns remaining HP
  takeDamage(amount: number, defending: boolean = false): number {
    let damage = amount;
    if (defending) {
      damage = Math.max(1, Math.floor(damage * 0.5));
    }
    this.state.hp = Math.max(0, this.state.hp - damage);
    return this.state.hp;
  }

  // Heal player
  heal(amount: number): number {
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
    return this.state.hp;
  }

  // Use a potion, returns false if none available
  usePotion(): boolean {
    if (this.state.potions <= 0) {
      return false;
    }
    this.state.potions--;
    this.heal(POTION_HEAL);
    return true;
  }

  // Add potions
  addPotions(count: number): number {
    this.state.potions = Math.min(MAX_POTIONS, this.state.potions + count);
    return this.state.potions;
  }

  // Gain XP and check for level up
  gainXp(amount: number): boolean {
    this.state.xp += amount;
    return this.checkLevelUp();
  }

  // Check and apply level up, returns true if leveled
  checkLevelUp(): boolean {
    if (this.state.level >= MAX_LEVEL) {
      return false;
    }

    const needed = xpForLevel(this.state.level);
    if (this.state.xp >= needed) {
      this.state.xp -= needed;
      this.state.level++;

      // Apply stat gains
      this.state.maxHp += 5;
      this.state.hp = this.state.maxHp; // Full heal on level up
      this.state.str += 2;
      this.state.def += 1;
      this.state.agi += 1;

      return true;
    }
    return false;
  }

  // Add gold
  addGold(amount: number): void {
    this.state.gold += amount;
  }

  // Remove gold (for purchases or death penalty)
  removeGold(amount: number): boolean {
    if (this.state.gold < amount) {
      return false;
    }
    this.state.gold -= amount;
    return true;
  }

  // Equip weapon
  equipWeapon(weaponId: string): void {
    this.state.weaponId = weaponId;
  }

  // Check if player owns a weapon (for shop display)
  // For now, just check if it's equipped - could add inventory later
  ownsWeapon(weaponId: string): boolean {
    return this.state.weaponId === weaponId;
  }

  // Respawn after death
  respawn(): void {
    // Lose 10% gold
    const goldLost = Math.floor(this.state.gold * 0.1);
    this.state.gold -= goldLost;

    // Full heal
    this.state.hp = this.state.maxHp;

    // Move to village spawn
    this.state.currentMap = 'village';
    this.state.tileX = 5;
    this.state.tileY = 6;
    this.state.facing = 'down';
  }

  // Check if dead
  isDead(): boolean {
    return this.state.hp <= 0;
  }

  // Get XP progress for display
  getXpProgress(): { current: number; needed: number; percent: number } {
    const needed = xpForLevel(this.state.level);
    return {
      current: this.state.xp,
      needed,
      percent: Math.min(100, Math.floor((this.state.xp / needed) * 100))
    };
  }
}
