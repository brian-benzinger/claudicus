import { describe, it, expect } from 'vitest';
import { PlayerManager } from '../player';
import { createDefaultPlayer, ClassPath, MAX_POTIONS, MAX_LEVEL, LEVEL_REWARDS, POTION_HEAL, xpForLevel, TITLES } from '../types';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

describe('PlayerManager.move', () => {
  it('updates tileX and tileY', () => {
    const p = makePlayer();
    p.move(1, 0);
    expect(p.state.tileX).toBe(6);
    expect(p.state.tileY).toBe(5);
  });

  it('sets facing right when dx > 0', () => {
    const p = makePlayer();
    p.move(1, 0);
    expect(p.state.facing).toBe('right');
  });

  it('sets facing left when dx < 0', () => {
    const p = makePlayer();
    p.move(-1, 0);
    expect(p.state.facing).toBe('left');
  });

  it('sets facing down when dy > 0', () => {
    const p = makePlayer();
    p.move(0, 1);
    expect(p.state.facing).toBe('down');
  });

  it('sets facing up when dy < 0', () => {
    const p = makePlayer();
    p.move(0, -1);
    expect(p.state.facing).toBe('up');
  });

  it('does not change facing when dx and dy are both 0', () => {
    const p = makePlayer();
    p.move(1, 0); // face right first
    p.move(0, 0); // null move should not change facing
    expect(p.state.facing).toBe('right');
  });
});

describe('PlayerManager.takeDamage', () => {
  it('reduces hp by the damage amount', () => {
    const p = makePlayer();
    p.takeDamage(10);
    expect(p.state.hp).toBe(30);
  });

  it('cannot go below 0', () => {
    const p = makePlayer();
    p.takeDamage(999);
    expect(p.state.hp).toBe(0);
  });

  it('halves damage (min 1) when defending', () => {
    const p = makePlayer();
    p.takeDamage(10, true);
    expect(p.state.hp).toBe(35); // 10 * 0.5 = 5 damage
  });

  it('defending damage is at least 1', () => {
    const p = makePlayer();
    p.takeDamage(1, true);
    expect(p.state.hp).toBe(39); // 1 damage even when defending
  });
});

describe('PlayerManager.heal', () => {
  it('restores hp', () => {
    const p = makePlayer();
    p.takeDamage(20);
    p.heal(10);
    expect(p.state.hp).toBe(30);
  });

  it('cannot exceed maxHp', () => {
    const p = makePlayer();
    p.heal(999);
    expect(p.state.hp).toBe(p.state.maxHp);
  });
});

describe('PlayerManager.usePotion', () => {
  it('heals by POTION_HEAL and decrements potions', () => {
    const p = makePlayer();
    p.takeDamage(30);
    const before = p.state.potions;
    const result = p.usePotion();
    expect(result).toBe(true);
    expect(p.state.potions).toBe(before - 1);
    expect(p.state.hp).toBe(10 + POTION_HEAL);
  });

  it('returns false with no potions', () => {
    const p = makePlayer();
    p.state.potions = 0;
    expect(p.usePotion()).toBe(false);
    expect(p.state.hp).toBe(p.state.maxHp);
  });
});

describe('PlayerManager.addPotions', () => {
  it('adds potions', () => {
    const p = makePlayer();
    p.state.potions = 0;
    p.addPotions(3);
    expect(p.state.potions).toBe(3);
  });

  it('caps at MAX_POTIONS', () => {
    const p = makePlayer();
    p.state.potions = 9;
    p.addPotions(5);
    expect(p.state.potions).toBe(MAX_POTIONS);
  });
});

describe('PlayerManager.addGold / removeGold', () => {
  it('adds gold correctly', () => {
    const p = makePlayer();
    p.addGold(50);
    expect(p.state.gold).toBe(60);
  });

  it('removes gold and returns true', () => {
    const p = makePlayer();
    const result = p.removeGold(5);
    expect(result).toBe(true);
    expect(p.state.gold).toBe(5);
  });

  it('returns false and does not remove if insufficient gold', () => {
    const p = makePlayer();
    const result = p.removeGold(999);
    expect(result).toBe(false);
    expect(p.state.gold).toBe(10);
  });
});

describe('PlayerManager.equipWeapon / ownsWeapon', () => {
  it('equips and recognizes weapon', () => {
    const p = makePlayer();
    p.equipWeapon('iron_longsword');
    expect(p.state.weaponId).toBe('iron_longsword');
    expect(p.ownsWeapon('iron_longsword')).toBe(true);
  });

  it('returns false for unequipped weapon', () => {
    const p = makePlayer();
    expect(p.ownsWeapon('iron_longsword')).toBe(false);
  });
});

describe('PlayerManager.gainXp / checkLevelUp', () => {
  it('accumulates xp without leveling', () => {
    const p = makePlayer();
    const reward = p.gainXp(10);
    expect(reward).toBeNull();
    expect(p.state.xp).toBe(10);
    expect(p.state.level).toBe(1);
  });

  it('levels up when xp threshold is met', () => {
    const p = makePlayer();
    const reward = p.gainXp(25); // xpForLevel(1) = 25
    expect(reward).not.toBeNull();
    expect(p.state.level).toBe(2);
    expect(p.state.xp).toBe(0);
  });

  it('fully heals on level up', () => {
    const p = makePlayer();
    p.takeDamage(20);
    p.gainXp(25);
    expect(p.state.hp).toBe(p.state.maxHp);
  });

  it('increases stats on level up', () => {
    const p = makePlayer();
    const prevStr = p.state.str;
    const prevDef = p.state.def;
    const prevAgi = p.state.agi;
    p.gainXp(25);
    expect(p.state.str).toBeGreaterThan(prevStr);
    expect(p.state.def).toBeGreaterThan(prevDef);
    expect(p.state.agi).toBeGreaterThan(prevAgi);
  });
});

describe('PlayerManager.isDead', () => {
  it('returns false when hp > 0', () => {
    const p = makePlayer();
    expect(p.isDead()).toBe(false);
  });

  it('returns true when hp is 0', () => {
    const p = makePlayer();
    p.takeDamage(999);
    expect(p.isDead()).toBe(true);
  });
});

describe('PlayerManager.respawn', () => {
  it('fully heals the player', () => {
    const p = makePlayer();
    p.takeDamage(30);
    p.respawn();
    expect(p.state.hp).toBe(p.state.maxHp);
  });

  it('moves to village spawn', () => {
    const p = makePlayer();
    p.state.currentMap = 'forest';
    p.state.tileX = 20;
    p.state.tileY = 20;
    p.respawn();
    expect(p.state.currentMap).toBe('village');
    expect(p.state.tileX).toBe(5);
    expect(p.state.tileY).toBe(6);
  });

  it('loses 10% gold', () => {
    const p = makePlayer();
    p.state.gold = 100;
    p.respawn();
    expect(p.state.gold).toBe(90);
  });
});

describe('PlayerManager.getXpProgress', () => {
  it('returns correct percent', () => {
    const p = makePlayer();
    p.gainXp(10); // 10 of 25 needed = 40%
    const prog = p.getXpProgress();
    expect(prog.current).toBe(10);
    expect(prog.needed).toBe(25);
    expect(prog.percent).toBe(40);
  });

  it('caps percent at 100', () => {
    const p = makePlayer();
    p.state.xp = 9999;
    const prog = p.getXpProgress();
    expect(prog.percent).toBe(100);
  });
});

describe('PlayerManager.computeWeaponDamage', () => {
  it('adds STR and weapon bonus', () => {
    const p = makePlayer(); // str=5, rusty_shortsword damageBonus=2
    expect(p.computeWeaponDamage()).toBe(7);
  });

  it('changes after equipping new weapon', () => {
    const p = makePlayer();
    p.equipWeapon('iron_longsword'); // damageBonus=4
    expect(p.computeWeaponDamage()).toBe(9); // 5 + 4
  });
});

describe('PlayerManager.reset', () => {
  it('resets to default state', () => {
    const p = makePlayer();
    p.state.gold = 9999;
    p.state.level = 5;
    p.reset();
    expect(p.state.gold).toBe(10);
    expect(p.state.level).toBe(1);
  });
});

describe('PlayerManager inventory', () => {
  it('starts with the default weapon in the weapons array', () => {
    const p = makePlayer();
    expect(p.state.weapons).toContain('rusty_shortsword');
  });

  it('equipWeapon adds weapon to the array if not present', () => {
    const p = makePlayer();
    p.equipWeapon('iron_longsword');
    expect(p.state.weapons).toContain('iron_longsword');
    expect(p.state.weaponId).toBe('iron_longsword');
  });

  it('equipWeapon does not duplicate weapon in array', () => {
    const p = makePlayer();
    p.equipWeapon('rusty_shortsword');
    p.equipWeapon('rusty_shortsword');
    expect(p.state.weapons.filter(w => w === 'rusty_shortsword').length).toBe(1);
  });

  it('addWeaponToInventory adds without equipping', () => {
    const p = makePlayer();
    p.addWeaponToInventory('halberd');
    expect(p.state.weapons).toContain('halberd');
    expect(p.state.weaponId).toBe('rusty_shortsword');
  });

  it('addWeaponToInventory does not duplicate', () => {
    const p = makePlayer();
    p.addWeaponToInventory('rusty_shortsword');
    expect(p.state.weapons.filter(w => w === 'rusty_shortsword').length).toBe(1);
  });

  it('ownsWeapon checks the weapons array', () => {
    const p = makePlayer();
    expect(p.ownsWeapon('rusty_shortsword')).toBe(true);
    expect(p.ownsWeapon('halberd')).toBe(false);
    p.addWeaponToInventory('halberd');
    expect(p.ownsWeapon('halberd')).toBe(true);
  });
});

describe('Level rewards', () => {
  // Helper: level a player up to a target level by granting exact XP
  function levelTo(p: PlayerManager, targetLevel: number) {
    while (p.state.level < targetLevel) {
      p.gainXp(xpForLevel(p.state.level));
    }
  }

  it('gainXp returns null when no level-up occurs', () => {
    const p = makePlayer();
    expect(p.gainXp(1)).toBeNull();
  });

  it('gainXp returns a LevelReward object on level-up', () => {
    const p = makePlayer();
    const reward = p.gainXp(xpForLevel(1));
    expect(reward).not.toBeNull();
    expect(typeof reward!.label).toBe('string');
  });

  it('reward label matches LEVEL_REWARDS table for each defined level', () => {
    for (const [lvlStr, def] of Object.entries(LEVEL_REWARDS)) {
      const targetLevel = Number(lvlStr);
      const p = makePlayer();
      levelTo(p, targetLevel - 1);
      const reward = p.gainXp(xpForLevel(p.state.level));
      expect(reward).not.toBeNull();
      expect(reward!.label).toBe(def.label);
    }
  });

  it('bonus gold is added on level-up with gold reward', () => {
    // Level 3 gives +50 gold
    const p = makePlayer();
    levelTo(p, 2);
    const goldBefore = p.state.gold;
    p.gainXp(xpForLevel(2)); // reaches level 3
    expect(p.state.gold).toBe(goldBefore + (LEVEL_REWARDS[3].bonusGold ?? 0));
  });

  it('bonus potions are added on level-up with potion reward', () => {
    // Level 2 gives +2 potions
    const p = makePlayer();
    p.state.potions = 0;
    p.gainXp(xpForLevel(1)); // reaches level 2
    expect(p.state.potions).toBe(LEVEL_REWARDS[2].bonusPotions ?? 0);
  });

  it('bonus potions do not exceed MAX_POTIONS', () => {
    const p = makePlayer();
    p.state.potions = MAX_POTIONS;
    p.gainXp(xpForLevel(1)); // level 2 gives +2 potions but already at cap
    expect(p.state.potions).toBe(MAX_POTIONS);
  });

  it('weapon reward is added to inventory without equipping', () => {
    // Level 4 gives iron_longsword
    const p = makePlayer();
    levelTo(p, 3);
    p.gainXp(xpForLevel(3)); // reaches level 4
    expect(p.state.weapons).toContain(LEVEL_REWARDS[4].weaponId);
    expect(p.state.weaponId).toBe('rusty_shortsword'); // still equipped original
  });

  it('weapon reward is not added twice if already owned', () => {
    const p = makePlayer();
    const weaponId = LEVEL_REWARDS[4].weaponId!;
    p.state.weapons.push(weaponId);
    levelTo(p, 3);
    p.gainXp(xpForLevel(3));
    expect(p.state.weapons.filter(w => w === weaponId).length).toBe(1);
  });

  it('returns null at MAX_LEVEL even with excess XP', () => {
    const p = makePlayer();
    levelTo(p, MAX_LEVEL);
    expect(p.state.level).toBe(MAX_LEVEL);
    expect(p.gainXp(9999)).toBeNull();
    expect(p.state.level).toBe(MAX_LEVEL);
  });

  it('every level in LEVEL_REWARDS has a non-empty label', () => {
    for (const def of Object.values(LEVEL_REWARDS)) {
      expect(def.label.length).toBeGreaterThan(0);
    }
  });
});

describe('PlayerManager.chooseClass', () => {
  it('sets classPath on the player', () => {
    const p = new PlayerManager(createDefaultPlayer());
    p.chooseClass(ClassPath.WARRIOR);
    expect(p.state.classPath).toBe(ClassPath.WARRIOR);
  });

  it('Warrior grants +2 DEF', () => {
    const p = new PlayerManager(createDefaultPlayer());
    const defBefore = p.state.def;
    p.chooseClass(ClassPath.WARRIOR);
    expect(p.state.def).toBe(defBefore + 2);
  });

  it('Scout grants +2 AGI', () => {
    const p = new PlayerManager(createDefaultPlayer());
    const agiBefore = p.state.agi;
    p.chooseClass(ClassPath.SCOUT);
    expect(p.state.agi).toBe(agiBefore + 2);
  });

  it('Brigand grants +2 STR', () => {
    const p = new PlayerManager(createDefaultPlayer());
    const strBefore = p.state.str;
    p.chooseClass(ClassPath.BRIGAND);
    expect(p.state.str).toBe(strBefore + 2);
  });

  it('cannot change class once chosen', () => {
    const p = new PlayerManager(createDefaultPlayer());
    p.chooseClass(ClassPath.WARRIOR);
    const defAfterFirst = p.state.def;
    p.chooseClass(ClassPath.SCOUT); // should be ignored
    expect(p.state.classPath).toBe(ClassPath.WARRIOR);
    expect(p.state.def).toBe(defAfterFirst); // no second bonus
  });

  it('new players start with classPath null', () => {
    const p = new PlayerManager(createDefaultPlayer());
    expect(p.state.classPath).toBeNull();
  });
});

describe('PlayerManager materials', () => {
  it('starts with zero wolf pelts and bandit steel', () => {
    const p = makePlayer();
    expect(p.state.materials.wolf_pelt).toBe(0);
    expect(p.state.materials.bandit_steel).toBe(0);
  });

  it('can accumulate wolf pelts', () => {
    const p = makePlayer();
    p.state.materials.wolf_pelt += 3;
    expect(p.state.materials.wolf_pelt).toBe(3);
  });

  it('crafting consumes materials correctly', () => {
    const p = makePlayer();
    p.state.materials.wolf_pelt = 3;
    p.state.materials.bandit_steel = 2;
    // Simulate consuming recipe: 3 pelts → armor
    p.state.materials.wolf_pelt -= 3;
    expect(p.state.materials.wolf_pelt).toBe(0);
    expect(p.state.materials.bandit_steel).toBe(2); // unchanged
  });
});

describe('PlayerManager titles', () => {
  it('starts with no earned titles', () => {
    const p = makePlayer();
    expect(p.state.earnedTitles).toEqual([]);
    expect(p.state.activeTitle).toBeNull();
  });

  it('can earn a title', () => {
    const p = makePlayer();
    p.state.earnedTitles.push('wolfsbane');
    expect(p.state.earnedTitles).toContain('wolfsbane');
  });

  it('can set an active title', () => {
    const p = makePlayer();
    p.state.earnedTitles.push('wolfsbane');
    p.state.activeTitle = 'wolfsbane';
    expect(p.state.activeTitle).toBe('wolfsbane');
  });

  it('TITLES constant defines all four titles', () => {
    expect(TITLES.wolfsbane).toBeDefined();
    expect(TITLES.bandit_hunter).toBeDefined();
    expect(TITLES.grave_robber).toBeDefined();
    expect(TITLES.survivor).toBeDefined();
  });

  it('each TITLES entry has id, label, and requirement', () => {
    for (const def of Object.values(TITLES)) {
      expect(def.id.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.requirement.length).toBeGreaterThan(0);
    }
  });
});

describe('PlayerManager constructor default', () => {
  it('creates a default player when no state is provided', () => {
    const p = new PlayerManager();
    expect(p.state.level).toBe(1);
    expect(p.state.weaponId).toBe('rusty_shortsword');
  });
});

describe('PlayerManager.loadState / reset', () => {
  it('loadState replaces the player state with a copy', () => {
    const p = makePlayer();
    const incoming = createDefaultPlayer('female');
    incoming.gold = 500;
    incoming.level = 7;
    p.loadState(incoming);
    expect(p.state.gold).toBe(500);
    expect(p.state.level).toBe(7);
    expect(p.state.gender).toBe('female');
    // It should be a copy, not the same reference
    expect(p.state).not.toBe(incoming);
  });

  it('reset returns the player to default starting state', () => {
    const p = makePlayer();
    p.state.gold = 9999;
    p.state.level = 9;
    p.reset();
    expect(p.state.gold).toBe(10);
    expect(p.state.level).toBe(1);
  });
});

describe('PlayerManager.addArmorToInventory / addWeaponToInventory', () => {
  it('adds armor without equipping it', () => {
    const p = makePlayer();
    p.addArmorToInventory('iron_plate');
    expect(p.ownsArmor('iron_plate')).toBe(true);
    expect(p.state.armorId).not.toBe('iron_plate');
    // No duplicate on second add
    p.addArmorToInventory('iron_plate');
    expect(p.state.armors.filter(a => a === 'iron_plate').length).toBe(1);
  });

  it('adds a weapon without equipping it', () => {
    const p = makePlayer();
    p.addWeaponToInventory('mace');
    expect(p.ownsWeapon('mace')).toBe(true);
    expect(p.state.weaponId).not.toBe('mace');
    p.addWeaponToInventory('mace');
    expect(p.state.weapons.filter(w => w === 'mace').length).toBe(1);
  });
});
