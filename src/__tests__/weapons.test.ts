import { describe, it, expect } from 'vitest';
import { getWeapon, getShopWeapons, WEAPONS } from '../data/weapons';
import { WeaponSpeed, LEVEL_REWARDS } from '../types';
import { QUESTS } from '../data/quests';

describe('getWeapon', () => {
  it('returns the correct weapon by id', () => {
    const w = getWeapon('dagger');
    expect(w.id).toBe('dagger');
    expect(w.name).toBe('Dagger');
    expect(w.speed).toBe(WeaponSpeed.FAST);
    expect(w.critChance).toBe(0.3);
  });

  it('falls back to rusty_shortsword for unknown id', () => {
    const w = getWeapon('nonexistent_weapon');
    expect(w.id).toBe('rusty_shortsword');
    expect(w.name).toBe('Rusty Shortsword');
    expect(w.damageBonus).toBe(2);
    expect(w.speed).toBe(WeaponSpeed.NORMAL);
  });

  it('returns all expected weapons', () => {
    const ids = ['rusty_shortsword', 'iron_longsword', 'mace', 'hand_axe', 'dagger', 'hunting_bow', 'halberd', 'war_axe', 'war_halberd'];
    for (const id of ids) {
      expect(getWeapon(id).id).toBe(id);
    }
  });
});

describe('getShopWeapons', () => {
  it('only returns weapons with source=shop', () => {
    const shopWeapons = getShopWeapons();
    for (const w of shopWeapons) {
      expect(w.source).toBe('shop');
    }
  });

  it('excludes start and chest weapons', () => {
    const shopWeapons = getShopWeapons();
    const ids = shopWeapons.map(w => w.id);
    expect(ids).not.toContain('rusty_shortsword'); // source: start
    expect(ids).not.toContain('halberd');           // source: chest
    expect(ids).not.toContain('war_axe');           // source: chest (crafted only)
  });

  it('returns exactly 5 shop weapons (iron_longsword, mace, hand_axe, dagger, hunting_bow)', () => {
    // Pin the exact set and insertion order — wrong members or duplicates would silently
    // pass a length-only check while breaking the shop UI contract.
    expect(getShopWeapons().map(w => w.id)).toEqual([
      'iron_longsword', 'mace', 'hand_axe', 'dagger', 'hunting_bow',
    ]);
  });
});

describe('WEAPONS data integrity', () => {
  it('every weapon has required fields with valid types and values', () => {
    const validSpeeds = new Set(Object.values(WeaponSpeed));
    const validSources = new Set<string>(['start', 'shop', 'chest', 'reward']);
    for (const w of Object.values(WEAPONS)) {
      expect(typeof w.id, `${w.id}: id must be string`).toBe('string');
      expect(w.id.length, `${w.id}: id must be non-empty`).toBeGreaterThan(0);
      expect(typeof w.name, `${w.id}: name must be string`).toBe('string');
      expect(w.name.length, `${w.id}: name must be non-empty`).toBeGreaterThan(0);
      expect(typeof w.damageBonus, `${w.id}: damageBonus must be number`).toBe('number');
      expect(w.damageBonus, `${w.id}: damageBonus must be ≥0`).toBeGreaterThanOrEqual(0);
      expect(validSpeeds.has(w.speed), `${w.id}: speed "${w.speed}" must be a valid WeaponSpeed`).toBe(true);
      expect(validSources.has(w.source), `${w.id}: source "${w.source}" must be one of: start, shop, chest, reward`).toBe(true);
      expect(w.missChance, `${w.id}: missChance`).toBeGreaterThanOrEqual(0);
      expect(w.missChance, `${w.id}: missChance`).toBeLessThan(1);
      expect(w.critChance, `${w.id}: critChance`).toBeGreaterThanOrEqual(0);
      expect(w.critChance, `${w.id}: critChance`).toBeLessThan(1);
      expect(w.ignoresDefense, `${w.id}: ignoresDefense`).toBeGreaterThanOrEqual(0);
      expect(w.ignoresDefense, `${w.id}: ignoresDefense`).toBeLessThanOrEqual(1);
    }
  });

  it('mace ignores 50% defense', () => {
    expect(getWeapon('mace').ignoresDefense).toBe(0.5);
  });

  it('hunting_bow is ranged speed', () => {
    expect(getWeapon('hunting_bow').speed).toBe(WeaponSpeed.RANGED);
  });

  it('mace is slow speed', () => {
    expect(getWeapon('mace').speed).toBe(WeaponSpeed.SLOW);
  });

  it('pins exact cost values for every weapon — shop prices are a game-balance contract', () => {
    // Weapon costs drive the economy: players must earn gold to upgrade.
    // A silent change (e.g. iron_longsword 30 → 300, or dagger 20 → 0) would
    // make the shop unaffordable or trivially free — with no other test catching it.
    // Shop weapons (ascending cost order):
    expect(WEAPONS.dagger.cost).toBe(20);
    expect(WEAPONS.hunting_bow.cost).toBe(25);
    expect(WEAPONS.iron_longsword.cost).toBe(30);
    expect(WEAPONS.hand_axe.cost).toBe(35);
    expect(WEAPONS.mace.cost).toBe(40);
    // Non-purchasable weapons must have cost=0 (no price leak into the shop)
    expect(WEAPONS.rusty_shortsword.cost).toBe(0);
    expect(WEAPONS.halberd.cost).toBe(50); // chest item — not sold, but has a notional value
    expect(WEAPONS.war_axe.cost).toBe(0);
    expect(WEAPONS.war_halberd.cost).toBe(0);
  });
});

describe('WEAPONS data — exact damageBonus contract table', () => {
  it('pins exact damageBonus values for all weapons — changing any value silently rebalances combat for that weapon', () => {
    // Mirrors the exact defBonus pin in armors.test.ts: the combat damage formula
    // attackPower = player.str + weapon.damageBonus drives every combat outcome.
    // The general field-validity test above only asserts damageBonus >= 0, so
    // hand_axe (6), halberd (7), and war_halberd (9) have no existing exact pin.
    // A silent change (e.g. hand_axe 6 → 4) rebalances those fights with no test failing.
    expect(WEAPONS.rusty_shortsword.damageBonus).toBe(2);
    expect(WEAPONS.dagger.damageBonus).toBe(1);
    expect(WEAPONS.iron_longsword.damageBonus).toBe(4);
    expect(WEAPONS.mace.damageBonus).toBe(5);
    expect(WEAPONS.hand_axe.damageBonus).toBe(6);
    expect(WEAPONS.hunting_bow.damageBonus).toBe(3);
    expect(WEAPONS.halberd.damageBonus).toBe(7);
    expect(WEAPONS.war_axe.damageBonus).toBe(8);
    expect(WEAPONS.war_halberd.damageBonus).toBe(9);
  });
});

describe('war_axe weapon', () => {
  it('has the correct damage, speed, and source', () => {
    const w = getWeapon('war_axe');
    expect(w.id).toBe('war_axe');
    expect(w.name).toBe('War Axe');
    expect(w.damageBonus).toBe(8);
    expect(w.speed).toBe(WeaponSpeed.SLOW);
    expect(w.source).toBe('chest');
  });

  it('has all three non-zero special properties', () => {
    const w = getWeapon('war_axe');
    expect(w.missChance).toBe(0.1);
    expect(w.critChance).toBe(0.1);
    expect(w.ignoresDefense).toBe(0.2);
  });

  it('is the only weapon combining missChance, critChance, and ignoresDefense simultaneously', () => {
    const multiSpecial = Object.values(WEAPONS).filter(
      w => w.missChance > 0 && w.critChance > 0 && w.ignoresDefense > 0
    );
    expect(multiSpecial).toHaveLength(1);
    expect(multiSpecial[0].id).toBe('war_axe');
  });
});

describe('war_halberd weapon', () => {
  it('exists in WEAPONS and is retrievable by id', () => {
    const w = getWeapon('war_halberd');
    expect(w.id).toBe('war_halberd');
    expect(w.name).toBe('War Halberd');
  });

  it('is the highest-damage weapon in the game', () => {
    const max = Math.max(...Object.values(WEAPONS).map(w => w.damageBonus));
    expect(getWeapon('war_halberd').damageBonus).toBe(max);
  });

  it('is slow speed and source=reward (never in shops)', () => {
    const w = getWeapon('war_halberd');
    expect(w.speed).toBe(WeaponSpeed.SLOW);
    expect(w.source).toBe('reward');
  });

  it('is not returned by getShopWeapons', () => {
    const ids = getShopWeapons().map(w => w.id);
    expect(ids).not.toContain('war_halberd');
  });
});

describe('LEVEL_REWARDS weaponIds all exist in WEAPONS', () => {
  it('every weaponId referenced in LEVEL_REWARDS maps to a real weapon', () => {
    for (const [lvl, reward] of Object.entries(LEVEL_REWARDS)) {
      if (reward.weaponId) {
        const w = getWeapon(reward.weaponId);
        expect(w.id, `Level ${lvl} reward weaponId "${reward.weaponId}" falls back to rusty_shortsword — weapon is missing`).toBe(reward.weaponId);
      }
    }
  });
});

describe('QUESTS rewardWeaponIds all exist in WEAPONS', () => {
  it('every rewardWeaponId in QUESTS maps to a real weapon', () => {
    for (const [id, quest] of Object.entries(QUESTS)) {
      if (quest.rewardWeaponId) {
        const w = getWeapon(quest.rewardWeaponId);
        expect(w.id, `Quest "${id}" rewardWeaponId "${quest.rewardWeaponId}" falls back to rusty_shortsword — weapon is missing`).toBe(quest.rewardWeaponId);
      }
    }
  });
});
