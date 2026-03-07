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

  it('antique coin adds 15 gold', () => {
    const player = makePlayer();
    const result = openChest(makeChest([{ type: 'antique_coin' }]), player);
    expect(player.state.gold).toBe(25);
    expect(result.messages[0]).toContain('Antique Coin');
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
  });

  it('singular potion message for amount=1', () => {
    const result = openChest(makeChest([{ type: 'potion', amount: 1 }]), makePlayer());
    expect(result.messages[0]).not.toContain('Potions');
    expect(result.messages[0]).toContain('Potion');
  });

  it('plural potion message for amount>1', () => {
    const result = openChest(makeChest([{ type: 'potion', amount: 3 }]), makePlayer());
    expect(result.messages[0]).toContain('Potions');
  });
});

describe('getItemDescription', () => {
  it('describes potions', () => {
    expect(getItemDescription({ type: 'potion', amount: 2 })).toBe('2x Health Potion');
  });

  it('describes gold', () => {
    expect(getItemDescription({ type: 'gold', amount: 50 })).toBe('50 Gold');
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
});
