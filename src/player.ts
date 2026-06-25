import {
  PlayerState,
  Weapon,
  Armor,
  LevelReward,
  LEVEL_REWARDS,
  ClassPath,
  createDefaultPlayer,
  xpForLevel,
  MAX_LEVEL,
  MAX_POTIONS,
  POTION_HEAL
} from './types';
import { getWeapon } from './data/weapons';
import { getArmor } from './data/armors';

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

  // Get current armor
  getArmor(): Armor {
    return getArmor(this.state.armorId);
  }

  // Effective DEF = base stat + equipped armor bonus
  getEffectiveDef(): number {
    return this.state.def + this.getArmor().defBonus;
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

  // Gain XP and check for level up; returns the LevelReward if leveled, else null
  gainXp(amount: number): LevelReward | null {
    this.state.xp += amount;
    return this.checkLevelUp();
  }

  // Check and apply level up; returns the LevelReward granted, or null
  checkLevelUp(): LevelReward | null {
    if (this.state.level >= MAX_LEVEL) {
      return null;
    }

    const needed = xpForLevel(this.state.level);
    if (this.state.xp >= needed) {
      this.state.xp -= needed;
      this.state.level++;

      // Base stat gains every level
      this.state.maxHp += 5;
      this.state.str += 2;
      this.state.def += 1;
      this.state.agi += 1;

      // Apply bonus reward for this level
      const reward = LEVEL_REWARDS[this.state.level] ?? null;
      if (reward) {
        if (reward.bonusHp)      { this.state.maxHp += reward.bonusHp; }
        if (reward.bonusStr)     { this.state.str += reward.bonusStr; }
        if (reward.bonusDef)     { this.state.def += reward.bonusDef; }
        if (reward.bonusAgi)     { this.state.agi += reward.bonusAgi; }
        if (reward.bonusGold)    { this.state.gold += reward.bonusGold; }
        if (reward.bonusPotions) { this.state.potions = Math.min(MAX_POTIONS, this.state.potions + reward.bonusPotions); }
        if (reward.weaponId) { this.addWeaponToInventory(reward.weaponId); }
      }

      this.state.hp = this.state.maxHp; // Full heal on level up
      return reward;
    }
    return null;
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

  // Equip a weapon (adds to owned list if not already there)
  equipWeapon(weaponId: string): void {
    this.addWeaponToInventory(weaponId);
    this.state.weaponId = weaponId;
  }

  // Add a weapon to the inventory without equipping it
  addWeaponToInventory(weaponId: string): void {
    if (!this.state.weapons.includes(weaponId)) {
      this.state.weapons.push(weaponId);
    }
  }

  // Check if player owns a weapon
  ownsWeapon(weaponId: string): boolean {
    return this.state.weapons.includes(weaponId);
  }

  // Equip an armor piece (adds to owned list if not already there)
  equipArmor(armorId: string): void {
    this.addArmorToInventory(armorId);
    this.state.armorId = armorId;
  }

  // Add armor to inventory without equipping it
  addArmorToInventory(armorId: string): void {
    if (!this.state.armors.includes(armorId)) {
      this.state.armors.push(armorId);
    }
  }

  // Check if player owns an armor
  ownsArmor(armorId: string): boolean {
    return this.state.armors.includes(armorId);
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

  // Choose a class path (one-time, at level 3)
  chooseClass(path: ClassPath): void {
    if (this.state.classPath !== null) return; // already chosen
    this.state.classPath = path;
    switch (path) {
      case ClassPath.WARRIOR: this.state.def += 2; break;
      case ClassPath.SCOUT:   this.state.agi += 2; break;
      case ClassPath.BRIGAND: this.state.str += 2; break;
    }
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
