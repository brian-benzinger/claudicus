import { describe, it, expect } from 'vitest';
import { ARMORS, getArmor, getShopArmors } from '../data/armors';
import { CRAFT_RECIPES } from '../data/recipes';
import { getWeapon } from '../data/weapons';
import { PlayerManager } from '../player';
import { createDefaultPlayer } from '../types';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

describe('ARMORS data', () => {
  it('defines leather_vest as the starting armor', () => {
    expect(ARMORS.leather_vest).toBeDefined();
    expect(ARMORS.leather_vest.defBonus).toBeGreaterThan(0);
    expect(ARMORS.leather_vest.source).toBe('start');
  });

  it('chain_mail and iron_plate are shop armors', () => {
    expect(ARMORS.chain_mail.source).toBe('shop');
    expect(ARMORS.iron_plate.source).toBe('shop');
  });

  it('shadow_cloak is a chest armor', () => {
    expect(ARMORS.shadow_cloak.source).toBe('chest');
  });

  it('pins exact defBonus values: leather_vest=1, chain_mail=3, iron_plate=5, shadow_cloak=2', () => {
    // Relational ordering is insufficient — the combat damage formula subtracts
    // effectiveDef from attackPower, so each armor's exact bonus is a behavioral
    // contract. Changing any of these silently alters all combat outcomes.
    expect(ARMORS.leather_vest.defBonus).toBe(1);
    expect(ARMORS.chain_mail.defBonus).toBe(3);
    expect(ARMORS.iron_plate.defBonus).toBe(5);
    expect(ARMORS.shadow_cloak.defBonus).toBe(2);
  });
});

describe('getArmor', () => {
  it('returns the correct armor by id', () => {
    const a = getArmor('chain_mail');
    expect(a.id).toBe('chain_mail');
    expect(a.name).toBe('Chain Mail');
  });

  it('falls back to leather_vest for unknown ids', () => {
    const a = getArmor('does_not_exist');
    expect(a.id).toBe('leather_vest');
  });
});

describe('getShopArmors', () => {
  it('returns only shop-source armors', () => {
    const shop = getShopArmors();
    expect(shop.length).toBeGreaterThan(0);
    shop.forEach(a => expect(a.source).toBe('shop'));
  });

  it('does not include start or chest armors', () => {
    const shop = getShopArmors();
    expect(shop.find(a => a.id === 'leather_vest')).toBeUndefined();
    expect(shop.find(a => a.id === 'shadow_cloak')).toBeUndefined();
  });
});

describe('PlayerManager armor methods', () => {
  it('default player starts with leather_vest equipped', () => {
    const p = makePlayer();
    expect(p.state.armorId).toBe('leather_vest');
    expect(p.state.armors).toContain('leather_vest');
  });

  it('getArmor returns the equipped armor', () => {
    const p = makePlayer();
    expect(p.getArmor().id).toBe('leather_vest');
  });

  it('getEffectiveDef includes armor bonus', () => {
    const p = makePlayer();
    // default player: def=3, leather_vest defBonus=1 → effective=4
    expect(p.state.def).toBe(3);
    expect(p.getArmor().defBonus).toBe(1);
    expect(p.getEffectiveDef()).toBe(4);
  });

  it('equipArmor switches equipped armor', () => {
    const p = makePlayer();
    p.equipArmor('chain_mail');
    expect(p.state.armorId).toBe('chain_mail');
    expect(p.state.armors).toContain('chain_mail');
  });

  it('equipArmor adds armor to inventory if not owned', () => {
    const p = makePlayer();
    expect(p.state.armors).not.toContain('iron_plate');
    p.equipArmor('iron_plate');
    expect(p.state.armors).toContain('iron_plate');
  });

  it('equipArmor does not duplicate owned armor', () => {
    const p = makePlayer();
    p.equipArmor('leather_vest');
    expect(p.state.armors.filter(a => a === 'leather_vest').length).toBe(1);
  });

  it('addArmorToInventory adds without equipping', () => {
    const p = makePlayer();
    p.addArmorToInventory('chain_mail');
    expect(p.state.armors).toContain('chain_mail');
    expect(p.state.armorId).toBe('leather_vest');
  });

  it('ownsArmor returns true for owned armors', () => {
    const p = makePlayer();
    expect(p.ownsArmor('leather_vest')).toBe(true);
    expect(p.ownsArmor('iron_plate')).toBe(false);
  });

  it('getEffectiveDef is exact state.def + armor.defBonus: iron_plate gives 3+5=8', () => {
    // toBeGreaterThan would pass even if the formula doubled the bonus or used
    // additive XP scaling. The exact value 8 pins the contract: effectiveDef = def + defBonus.
    const p = makePlayer();
    p.equipArmor('iron_plate');
    expect(p.state.def).toBe(3);
    expect(p.getArmor().defBonus).toBe(5);
    expect(p.getEffectiveDef()).toBe(8);
  });
});

describe('studded_leather craftable armor', () => {
  it('is defined in ARMORS', () => {
    expect(ARMORS.studded_leather).toBeDefined();
    expect(ARMORS.studded_leather.defBonus).toBe(2);
    expect(ARMORS.studded_leather.source).toBe('chest');
  });

  it('is not in shop armors', () => {
    const shop = getShopArmors();
    expect(shop.find(a => a.id === 'studded_leather')).toBeUndefined();
  });
});

describe('CRAFT_RECIPES', () => {
  it('has three recipes', () => {
    expect(CRAFT_RECIPES.length).toBe(3);
  });

  it('studded_leather recipe costs 3 wolf pelts', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'studded_leather')!;
    expect(recipe).toBeDefined();
    expect(recipe.armorId).toBe('studded_leather');
    expect(recipe.cost.wolf_pelt).toBe(3);
    expect(recipe.cost.bandit_steel).toBeUndefined();
  });

  it('iron_longsword recipe costs 2 bandit steel', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'iron_longsword')!;
    expect(recipe).toBeDefined();
    expect(recipe.weaponId).toBe('iron_longsword');
    expect(recipe.cost.bandit_steel).toBe(2);
    expect(recipe.cost.wolf_pelt).toBeUndefined();
  });

  it('war_axe recipe costs 2 bandit steel + 1 wolf pelt', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'war_axe')!;
    expect(recipe).toBeDefined();
    expect(recipe.weaponId).toBe('war_axe');
    expect(recipe.cost.bandit_steel).toBe(2);
    expect(recipe.cost.wolf_pelt).toBe(1);
  });

  it('all recipes have a non-empty description', () => {
    for (const r of CRAFT_RECIPES) {
      expect(r.description.length).toBeGreaterThan(0);
    }
  });
});

describe('CRAFT_RECIPES item IDs reference real data', () => {
  it('every weaponId in CRAFT_RECIPES maps to a real weapon', () => {
    for (const recipe of CRAFT_RECIPES) {
      if (recipe.weaponId) {
        const w = getWeapon(recipe.weaponId);
        expect(w.id, `Recipe "${recipe.id}" weaponId "${recipe.weaponId}" falls back to rusty_shortsword — weapon is missing`).toBe(recipe.weaponId);
      }
    }
  });

  it('every armorId in CRAFT_RECIPES maps to a real armor', () => {
    for (const recipe of CRAFT_RECIPES) {
      if (recipe.armorId) {
        const a = getArmor(recipe.armorId);
        expect(a.id, `Recipe "${recipe.id}" armorId "${recipe.armorId}" falls back to leather_vest — armor is missing`).toBe(recipe.armorId);
      }
    }
  });
});
