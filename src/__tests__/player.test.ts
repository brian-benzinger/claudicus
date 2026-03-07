import { describe, it, expect } from 'vitest';
import { PlayerManager } from '../player';
import { createDefaultPlayer, MAX_POTIONS, POTION_HEAL } from '../types';

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
    const leveled = p.gainXp(10);
    expect(leveled).toBe(false);
    expect(p.state.xp).toBe(10);
    expect(p.state.level).toBe(1);
  });

  it('levels up when xp threshold is met', () => {
    const p = makePlayer();
    const leveled = p.gainXp(25); // xpForLevel(1) = 25
    expect(leveled).toBe(true);
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
