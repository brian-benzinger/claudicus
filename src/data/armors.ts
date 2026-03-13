import { Armor } from '../types';

export const ARMORS: Record<string, Armor> = {
  leather_vest: {
    id: 'leather_vest',
    name: 'Leather Vest',
    defBonus: 1,
    cost: 0,
    source: 'start'
  },
  chain_mail: {
    id: 'chain_mail',
    name: 'Chain Mail',
    defBonus: 3,
    cost: 40,
    source: 'shop'
  },
  iron_plate: {
    id: 'iron_plate',
    name: 'Iron Plate',
    defBonus: 5,
    cost: 70,
    source: 'shop'
  },
  shadow_cloak: {
    id: 'shadow_cloak',
    name: 'Shadow Cloak',
    defBonus: 2,
    cost: 35,
    source: 'chest'
  }
};

export function getArmor(id: string): Armor {
  return ARMORS[id] || ARMORS.leather_vest;
}

export function getShopArmors(): Armor[] {
  return Object.values(ARMORS).filter(a => a.source === 'shop');
}
