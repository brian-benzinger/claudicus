import { Weapon, WeaponSpeed } from '../types';

export const WEAPONS: Record<string, Weapon> = {
  rusty_shortsword: {
    id: 'rusty_shortsword',
    name: 'Rusty Shortsword',
    damageBonus: 2,
    speed: WeaponSpeed.NORMAL,
    missChance: 0,
    critChance: 0,
    ignoresDefense: 0,
    cost: 0,
    source: 'start'
  },
  iron_longsword: {
    id: 'iron_longsword',
    name: 'Iron Longsword',
    damageBonus: 4,
    speed: WeaponSpeed.NORMAL,
    missChance: 0,
    critChance: 0,
    ignoresDefense: 0,
    cost: 30,
    source: 'shop'
  },
  mace: {
    id: 'mace',
    name: 'Mace',
    damageBonus: 5,
    speed: WeaponSpeed.SLOW,
    missChance: 0,
    critChance: 0,
    ignoresDefense: 0.5,
    cost: 40,
    source: 'shop'
  },
  hand_axe: {
    id: 'hand_axe',
    name: 'Hand Axe',
    damageBonus: 6,
    speed: WeaponSpeed.NORMAL,
    missChance: 0.2,
    critChance: 0,
    ignoresDefense: 0,
    cost: 35,
    source: 'shop'
  },
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    damageBonus: 1,
    speed: WeaponSpeed.FAST,
    missChance: 0,
    critChance: 0.3,
    ignoresDefense: 0,
    cost: 20,
    source: 'shop'
  },
  hunting_bow: {
    id: 'hunting_bow',
    name: 'Hunting Bow',
    damageBonus: 3,
    speed: WeaponSpeed.RANGED,
    missChance: 0,
    critChance: 0,
    ignoresDefense: 0,
    cost: 25,
    source: 'shop'
  },
  halberd: {
    id: 'halberd',
    name: 'Halberd',
    damageBonus: 7,
    speed: WeaponSpeed.SLOW,
    missChance: 0.15,
    critChance: 0,
    ignoresDefense: 0,
    cost: 50,
    source: 'chest'
  },
  war_axe: {
    id: 'war_axe',
    name: 'War Axe',
    damageBonus: 8,
    speed: WeaponSpeed.SLOW,
    missChance: 0.1,
    critChance: 0.1,
    ignoresDefense: 0.2,
    cost: 0,
    source: 'chest'  // 'chest' so it doesn't appear in shops
  }
};

export function getWeapon(id: string): Weapon {
  return WEAPONS[id] || WEAPONS.rusty_shortsword;
}

export function getShopWeapons(): Weapon[] {
  return Object.values(WEAPONS).filter(w => w.source === 'shop');
}
