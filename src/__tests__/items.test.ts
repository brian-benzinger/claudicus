import { describe, it, expect } from 'vitest';
import { openChest, getItemDescription } from '../items';
import { PlayerManager } from '../player';
import { createDefaultPlayer } from '../types';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

function makeChest(loot: any[]) {
  return { id: 'test_chest', tileX: 0, tileY: 0, loot };
}

describe('openChest', () => {
  it('adds potions and returns message', () => {
    const player = makePlayer();
    const before = player.state.potions;
    const result = openChest(makeChest([{ type: 'potion', amount: 2 }]), player);
    expect(player.state.potions).toBe(before + 2);
    expect(result.messages[0]).toContain('Potion');
  });

  it('adds gold and returns message', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'gold', amount: 25 }]), player);
    expect(player.state.gold).toBe(35);
    expect(result.messages[0]).toContain('25 gold');
  });

  it('equips weapon and returns message', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'weapon', weaponId: 'dagger' }]), player);
    expect(player.state.weaponId).toBe('dagger');
    expect(result.messages[0]).toContain('Dagger');
  });

  it('chest weapon is added to the weapons array and previous weapon is preserved', () => {
    // openChest calls equipWeapon(), which adds to the weapons array without removing
    // existing weapons.  If this changed to a replace-style update, the player would
    // lose their previous weapon from inventory — a silent regression that this test pins.
    const player = makePlayer(); // starts with rusty_shortsword
    openChest(makeChest([{ type: 'weapon', weaponId: 'dagger' }]), player);
    expect(player.state.weapons).toContain('dagger');          // new weapon added
    expect(player.state.weapons).toContain('rusty_shortsword'); // old weapon preserved
  });

  it('equips armor and returns message', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'armor', armorId: 'shadow_cloak' }]), player);
    expect(player.state.armorId).toBe('shadow_cloak');
    expect(result.messages[0]).toContain('Shadow Cloak');
  });

  it('chest armor is added to the armors array and previous armor is preserved', () => {
    // openChest calls equipArmor(), which adds to the armors array without removing
    // existing armors.  If this changed to a replace-style update, the player would
    // lose their previous armor from inventory — a silent regression that this test pins.
    const player = makePlayer(); // starts with leather_vest
    openChest(makeChest([{ type: 'armor', armorId: 'shadow_cloak' }]), player);
    expect(player.state.armors).toContain('shadow_cloak');   // new armor added
    expect(player.state.armors).toContain('leather_vest');    // old armor preserved
  });

  it('ignores a weapon loot entry with no weaponId', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'weapon' }]), player);
    expect(result.messages[0]).toContain('empty');
    expect(player.state.weaponId).toBe('rusty_shortsword');
  });

  it('ignores an armor loot entry with no armorId', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'armor' }]), player);
    expect(result.messages[0]).toContain('empty');
    expect(player.state.armorId).toBe('leather_vest');
  });

  it('antique coin adds 15 gold', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'antique_coin' }]), player);
    expect(player.state.gold).toBe(25);
    expect(result.messages[0]).toContain('Antique Coin');
  });

  it('antique coin message is exactly "Found an Antique Coin! (+15 gold)"', () => {
    // Pins the exact in-game message format.  toContain('Antique Coin') above passes
    // even if the format changes to 'You found an Antique Coin' or the gold bonus is
    // omitted from the text — either of which would break what the player reads.
    const result = openChest(makeChest([{ type: 'antique_coin' }]), makePlayer());
    expect(result.messages[0]).toBe('Found an Antique Coin! (+15 gold)');
  });

  it('weapon message is exactly "Found <WeaponName>!"', () => {
    // The existing test uses toContain('Dagger'), which would pass even if the format
    // changed to 'You found a Dagger!' or 'Dagger obtained'.  This pins the exact
    // contract so any reformatting is caught before it silently reaches the player.
    const result = openChest(makeChest([{ type: 'weapon', weaponId: 'dagger' }]), makePlayer());
    expect(result.messages[0]).toBe('Found Dagger!');
  });

  it('armor message is exactly "Found <ArmorName>!"', () => {
    // Same gap as the weapon message: toContain('Shadow Cloak') passes with any prefix
    // or suffix change.  This test pins the exact in-game string.
    const result = openChest(makeChest([{ type: 'armor', armorId: 'shadow_cloak' }]), makePlayer());
    expect(result.messages[0]).toBe('Found Shadow Cloak!');
  });

  it('returns empty chest message for no loot', () => {
    const result = openChest(makeChest([]), makePlayer());
    expect(result.messages[0]).toContain('empty');
  });

  it('handles multiple loot items', () => {
    const player = makePlayer();
    const result = openChest(
      makeChest([{ type: 'gold', amount: 10 }, { type: 'potion', amount: 1 }]),
      player
    );
    expect(result.messages.length).toBe(2);
    expect(result.messages[0]).toBe('Found 10 gold!');
    expect(result.messages[1]).toBe('Found 1 Health Potion!');
    expect(player.state.gold).toBe(20);
    expect(player.state.potions).toBe(4);
  });

  it('singular potion message for amount=1', () => {
    const result = openChest(makeChest([{ type: 'potion', amount: 1 }]), makePlayer());
    expect(result.messages[0]).toBe('Found 1 Health Potion!');
  });

  it('plural potion message for amount>1', () => {
    const result = openChest(makeChest([{ type: 'potion', amount: 3 }]), makePlayer());
    expect(result.messages[0]).toBe('Found 3 Health Potions!');
  });

  it('defaults to 1 potion when amount is omitted', () => {
    const player = makePlayer();
    const before = player.state.potions;
    const result = openChest(makeChest([{ type: 'potion' }]), player);
    expect(player.state.potions).toBe(before + 1);
    expect(result.messages[0]).toBe('Found 1 Health Potion!');
  });

  it('defaults to 0 gold when amount is omitted', () => {
    const player = makePlayer();
    const before = player.state.gold;
    const result = openChest(makeChest([{ type: 'gold' }]), player);
    expect(player.state.gold).toBe(before);
    expect(result.messages[0]).toBe('Found 0 gold!');
  });
});

describe('getItemDescription', () => {
  it('describes potions', () => {
    expect(getItemDescription({ type: 'potion', amount: 2 })).toBe('2x Health Potion');
  });

  it('defaults to 1 potion when amount is omitted', () => {
    expect(getItemDescription({ type: 'potion' })).toBe('1x Health Potion');
  });

  it('describes gold', () => {
    expect(getItemDescription({ type: 'gold', amount: 50 })).toBe('50 Gold');
  });

  it('defaults to 0 gold when amount is omitted', () => {
    expect(getItemDescription({ type: 'gold' })).toBe('0 Gold');
  });

  it('describes a weapon by name', () => {
    expect(getItemDescription({ type: 'weapon', weaponId: 'dagger' })).toBe('Dagger');
  });

  it('describes unknown weapon', () => {
    expect(getItemDescription({ type: 'weapon' })).toBe('Unknown Weapon');
  });

  it('describes antique coin', () => {
    expect(getItemDescription({ type: 'antique_coin' })).toBe('Antique Coin');
  });

  it('describes armor by name', () => {
    expect(getItemDescription({ type: 'armor', armorId: 'chain_mail' })).toBe('Chain Mail');
  });

  it('describes unknown armor', () => {
    expect(getItemDescription({ type: 'armor' })).toBe('Unknown Armor');
  });

  it('describes an unknown item type', () => {
    expect(getItemDescription({ type: 'mystery' as any })).toBe('Unknown Item');
  });
});
