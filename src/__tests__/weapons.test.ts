import { describe, it, expect } from 'vitest';
import { getWeapon, getShopWeapons, WEAPONS } from '../data/weapons';
import { WeaponSpeed } from '../types';

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
  });

  it('returns all expected weapons', () => {
    const ids = ['rusty_shortsword', 'iron_longsword', 'mace', 'hand_axe', 'dagger', 'hunting_bow', 'halberd'];
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
  });

  it('returns at least one weapon', () => {
    expect(getShopWeapons().length).toBeGreaterThan(0);
  });
});

describe('WEAPONS data integrity', () => {
  it('every weapon has required fields', () => {
    for (const w of Object.values(WEAPONS)) {
      expect(w.id).toBeTruthy();
      expect(w.name).toBeTruthy();
      expect(w.missChance).toBeGreaterThanOrEqual(0);
      expect(w.missChance).toBeLessThan(1);
      expect(w.critChance).toBeGreaterThanOrEqual(0);
      expect(w.critChance).toBeLessThan(1);
      expect(w.ignoresDefense).toBeGreaterThanOrEqual(0);
      expect(w.ignoresDefense).toBeLessThanOrEqual(1);
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
});
