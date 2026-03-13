import { describe, it, expect } from 'vitest';
import { ARMORS, getArmor, getShopArmors } from '../data/armors';
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

  it('higher-tier armors have more defBonus', () => {
    expect(ARMORS.chain_mail.defBonus).toBeGreaterThan(ARMORS.leather_vest.defBonus);
    expect(ARMORS.iron_plate.defBonus).toBeGreaterThan(ARMORS.chain_mail.defBonus);
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
    const baseDef = p.state.def;
    const armorBonus = p.getArmor().defBonus;
    expect(p.getEffectiveDef()).toBe(baseDef + armorBonus);
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

  it('getEffectiveDef increases after equipping better armor', () => {
    const p = makePlayer();
    const defBefore = p.getEffectiveDef();
    p.equipArmor('iron_plate');
    expect(p.getEffectiveDef()).toBeGreaterThan(defBefore);
  });
});
