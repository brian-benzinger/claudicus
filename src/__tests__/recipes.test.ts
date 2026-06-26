import { describe, it, expect } from 'vitest';
import { CRAFT_RECIPES } from '../data/recipes';
import { getWeapon } from '../data/weapons';
import { getArmor } from '../data/armors';

// ---------------------------------------------------------------------------
// CRAFT_RECIPES data — pin exact behavioral contracts for all three recipes.
//
// The UI renders recipe.name and recipe.description dynamically (see ui.test.ts),
// but only with the values currently in CRAFT_RECIPES.  If a cost, output ID,
// or description changed silently the UI tests would still pass (they'd just
// render the new wrong values).  These tests pin the data itself so that any
// change to a recipe's crafting cost, output weapon/armor, or display text
// breaks a test rather than silently reaching the player.
//
// The pattern mirrors weapons.test.ts, armors.test.ts, and quests.test.ts.
// ---------------------------------------------------------------------------

describe('CRAFT_RECIPES — exact count and structure', () => {
  it('defines exactly three recipes', () => {
    expect(CRAFT_RECIPES).toHaveLength(3);
  });

  it('every recipe has required fields: id, name, cost, description', () => {
    for (const r of CRAFT_RECIPES) {
      expect(typeof r.id, `${r.id}: id must be string`).toBe('string');
      expect(r.id.length, `${r.id}: id must be non-empty`).toBeGreaterThan(0);
      expect(typeof r.name, `${r.id}: name must be string`).toBe('string');
      expect(r.name.length, `${r.id}: name must be non-empty`).toBeGreaterThan(0);
      expect(typeof r.description, `${r.id}: description must be string`).toBe('string');
      expect(r.description.length, `${r.id}: description must be non-empty`).toBeGreaterThan(0);
      expect(typeof r.cost, `${r.id}: cost must be object`).toBe('object');
    }
  });

  it('every recipe produces exactly one output — either weaponId or armorId, never both', () => {
    for (const r of CRAFT_RECIPES) {
      const hasWeapon = r.weaponId !== undefined;
      const hasArmor  = r.armorId  !== undefined;
      expect(
        hasWeapon || hasArmor,
        `Recipe "${r.id}" must have either weaponId or armorId`
      ).toBe(true);
      expect(
        hasWeapon && hasArmor,
        `Recipe "${r.id}" must not have both weaponId and armorId`
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// studded_leather — armor recipe requiring wolf pelts only
// ---------------------------------------------------------------------------
describe('CRAFT_RECIPES — studded_leather', () => {
  const r = CRAFT_RECIPES.find(x => x.id === 'studded_leather')!;

  it('exists in CRAFT_RECIPES', () => {
    expect(r).toBeDefined();
  });

  it('has the exact display name "Studded Leather"', () => {
    expect(r.name).toBe('Studded Leather');
  });

  it('costs exactly 3 wolf pelts and no bandit steel', () => {
    // Changing the pelt cost from 3 to 1 (cheaper) or 5 (more expensive) would
    // silently break the economy — players could craft armor trivially or never.
    // bandit_steel must be absent so the recipe does not accidentally require steel.
    expect(r.cost.wolf_pelt).toBe(3);
    expect(r.cost.bandit_steel).toBeUndefined();
  });

  it('produces armorId "studded_leather" (not a weapon output)', () => {
    expect(r.armorId).toBe('studded_leather');
    expect(r.weaponId).toBeUndefined();
  });

  it('description is exactly "3 Wolf Pelts → Studded Leather (DEF +2)"', () => {
    // The description is shown verbatim in the forge UI. Any rephrasing would
    // silently change what the player reads (e.g. dropping the DEF value).
    expect(r.description).toBe('3 Wolf Pelts → Studded Leather (DEF +2)');
  });

  it('armorId maps to a real armor with the correct DEF bonus', () => {
    // Cross-reference: the armorId must exist in the armors table AND its
    // defBonus must match what the description promises (+2). If the description
    // and the actual armor data disagree, the player is misled.
    const armor = getArmor(r.armorId!);
    expect(armor.id, 'armorId must not fall back to the default armor').toBe('studded_leather');
    expect(armor.defBonus).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// iron_longsword — weapon recipe requiring bandit steel only
// ---------------------------------------------------------------------------
describe('CRAFT_RECIPES — iron_longsword', () => {
  const r = CRAFT_RECIPES.find(x => x.id === 'iron_longsword')!;

  it('exists in CRAFT_RECIPES', () => {
    expect(r).toBeDefined();
  });

  it('has the exact display name "Iron Longsword"', () => {
    expect(r.name).toBe('Iron Longsword');
  });

  it('costs exactly 2 bandit steel and no wolf pelts', () => {
    expect(r.cost.bandit_steel).toBe(2);
    expect(r.cost.wolf_pelt).toBeUndefined();
  });

  it('produces weaponId "iron_longsword" (not an armor output)', () => {
    expect(r.weaponId).toBe('iron_longsword');
    expect(r.armorId).toBeUndefined();
  });

  it('description is exactly "2 Bandit Steel → Iron Longsword (ATK +4)"', () => {
    expect(r.description).toBe('2 Bandit Steel → Iron Longsword (ATK +4)');
  });

  it('weaponId maps to a real weapon with the correct damage bonus', () => {
    const weapon = getWeapon(r.weaponId!);
    expect(weapon.id, 'weaponId must not fall back to rusty_shortsword').toBe('iron_longsword');
    expect(weapon.damageBonus).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// war_axe — weapon recipe requiring both materials
// ---------------------------------------------------------------------------
describe('CRAFT_RECIPES — war_axe', () => {
  const r = CRAFT_RECIPES.find(x => x.id === 'war_axe')!;

  it('exists in CRAFT_RECIPES', () => {
    expect(r).toBeDefined();
  });

  it('has the exact display name "War Axe"', () => {
    expect(r.name).toBe('War Axe');
  });

  it('costs exactly 2 bandit steel AND 1 wolf pelt', () => {
    // war_axe is the only recipe that requires both materials — this is what
    // makes it the premium craftable.  Dropping either requirement to 0 or
    // undefined would make the recipe trivially cheap.
    expect(r.cost.bandit_steel).toBe(2);
    expect(r.cost.wolf_pelt).toBe(1);
  });

  it('produces weaponId "war_axe" (not an armor output)', () => {
    expect(r.weaponId).toBe('war_axe');
    expect(r.armorId).toBeUndefined();
  });

  it('description is exactly "2 Bandit Steel + 1 Wolf Pelt → War Axe (ATK +8)"', () => {
    expect(r.description).toBe('2 Bandit Steel + 1 Wolf Pelt → War Axe (ATK +8)');
  });

  it('weaponId maps to a real weapon with the correct damage bonus', () => {
    const weapon = getWeapon(r.weaponId!);
    expect(weapon.id, 'weaponId must not fall back to rusty_shortsword').toBe('war_axe');
    expect(weapon.damageBonus).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Cross-reference integrity: all recipe outputs exist in their respective tables
// ---------------------------------------------------------------------------
describe('CRAFT_RECIPES — cross-reference integrity', () => {
  it('every weaponId maps to a real weapon (not the rusty_shortsword fallback)', () => {
    for (const r of CRAFT_RECIPES) {
      if (r.weaponId) {
        const w = getWeapon(r.weaponId);
        expect(
          w.id,
          `Recipe "${r.id}" weaponId "${r.weaponId}" falls back to rusty_shortsword — weapon is missing`
        ).toBe(r.weaponId);
      }
    }
  });

  it('every armorId maps to a real armor (not the leather_vest fallback)', () => {
    for (const r of CRAFT_RECIPES) {
      if (r.armorId) {
        const a = getArmor(r.armorId);
        expect(
          a.id,
          `Recipe "${r.id}" armorId "${r.armorId}" falls back to leather_vest — armor is missing`
        ).toBe(r.armorId);
      }
    }
  });

  it('war_axe is the only recipe requiring both materials — pins the "dual-cost" uniqueness contract', () => {
    // A future recipe editor might accidentally add wolf_pelt to the iron_longsword recipe
    // or bandit_steel to studded_leather.  This test pins that war_axe is the only
    // dual-material recipe, so any silent addition is caught.
    const dualCost = CRAFT_RECIPES.filter(
      r => r.cost.wolf_pelt !== undefined && r.cost.bandit_steel !== undefined
    );
    expect(dualCost).toHaveLength(1);
    expect(dualCost[0].id).toBe('war_axe');
  });

  it('exactly one recipe produces armor and two produce weapons', () => {
    // Pins the overall output-type distribution so swapping a recipe from weapon→armor
    // (or vice versa) breaks this test rather than silently changing the forge UI.
    const armorRecipes  = CRAFT_RECIPES.filter(r => r.armorId);
    const weaponRecipes = CRAFT_RECIPES.filter(r => r.weaponId);
    expect(armorRecipes).toHaveLength(1);
    expect(weaponRecipes).toHaveLength(2);
  });
});
