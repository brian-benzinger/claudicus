import { describe, it, expect, beforeEach } from 'vitest';
import { NpcManager } from '../npc';
import { PlayerManager } from '../player';
import { createDefaultPlayer, createDefaultQuest, NpcRole } from '../types';
import { MAIN_QUEST } from '../data/quests';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

function makeQuest() {
  return createDefaultQuest();
}

function makeQuestNpc() {
  return {
    id: 'elder',
    name: 'Elder Aldric',
    tileX: 5,
    tileY: 5,
    role: NpcRole.QUEST,
    color: '#fff',
    dialogs: {
      default: ['Hello.'],
      questNotStarted: ['Please help us!'],
      questInProgress: ['Keep fighting!'],
      questComplete: ['Well done!'],
      questDone: ['Thank you, hero.'],
    },
  };
}

function makeShopNpc(role: NpcRole) {
  return {
    id: 'shopkeeper',
    name: 'Shopkeeper',
    tileX: 3,
    tileY: 3,
    role,
    color: '#aaa',
    dialogs: { default: ['Welcome to my shop!'] },
  };
}

describe('NpcManager.startDialog', () => {
  it('returns questNotStarted lines when quest not started', () => {
    const mgr = new NpcManager();
    const quest = makeQuest();
    mgr.startDialog(makeQuestNpc(), quest);
    expect(mgr.getCurrentLine()).toBe('Please help us!');
  });

  it('returns questInProgress lines when quest started', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), started: true };
    mgr.startDialog(makeQuestNpc(), quest);
    expect(mgr.getCurrentLine()).toBe('Keep fighting!');
  });

  it('returns questComplete lines when quest completed', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), started: true, completed: true };
    mgr.startDialog(makeQuestNpc(), quest);
    expect(mgr.getCurrentLine()).toBe('Well done!');
  });

  it('returns questDone lines when reward claimed', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), started: true, completed: true, rewardClaimed: true };
    mgr.startDialog(makeQuestNpc(), quest);
    expect(mgr.getCurrentLine()).toBe('Thank you, hero.');
  });

  it('returns default lines for non-quest NPCs', () => {
    const mgr = new NpcManager();
    const npc = makeShopNpc(NpcRole.SHOP_WEAPONS);
    mgr.startDialog(npc, makeQuest());
    expect(mgr.getCurrentLine()).toBe('Welcome to my shop!');
  });
});

describe('NpcManager.advanceDialog', () => {
  it('returns continue when more lines exist', () => {
    const mgr = new NpcManager();
    const npc = { ...makeQuestNpc(), dialogs: { default: ['Line 1', 'Line 2'] } };
    mgr.startDialog(npc, makeQuest());
    expect(mgr.advanceDialog()).toBe('continue');
  });

  it('returns done for a quest NPC with one line', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), { ...makeQuest(), rewardClaimed: true });
    expect(mgr.advanceDialog()).toBe('done');
  });

  it('returns shop and opens shop for SHOP_WEAPONS NPC', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeShopNpc(NpcRole.SHOP_WEAPONS), makeQuest());
    expect(mgr.advanceDialog()).toBe('shop');
    expect(mgr.isInShop).toBe(true);
    expect(mgr.shopItems.length).toBeGreaterThan(0);
  });

  it('returns done when called with no dialog state', () => {
    const mgr = new NpcManager();
    expect(mgr.advanceDialog()).toBe('done');
  });
});

describe('NpcManager.getSpeakerName', () => {
  it('returns npc name during dialog', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuest());
    expect(mgr.getSpeakerName()).toBe('Elder Aldric');
  });

  it('returns null when no dialog', () => {
    expect(new NpcManager().getSpeakerName()).toBeNull();
  });
});

describe('NpcManager shop', () => {
  it('opens potion shop with correct item', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_POTIONS);
    expect(mgr.shopItems.length).toBe(1);
    expect(mgr.shopItems[0].type).toBe('potion');
  });

  it('moveShopCursor wraps around', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.shopCursor = 0;
    mgr.moveShopCursor(-1);
    expect(mgr.shopCursor).toBe(mgr.shopItems.length - 1);
  });

  it('moveShopCursor wraps at end', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.shopCursor = mgr.shopItems.length - 1;
    mgr.moveShopCursor(1);
    expect(mgr.shopCursor).toBe(0);
  });

  it('closeShop clears state', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.closeShop();
    expect(mgr.isInShop).toBe(false);
    expect(mgr.shopItems.length).toBe(0);
  });
});

describe('NpcManager.buySelectedItem', () => {
  it('purchases a weapon successfully', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.gold = 100;
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.shopCursor = 0;
    const item = mgr.shopItems[0];
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(true);
    expect(player.state.gold).toBe(100 - item.cost);
  });

  it('fails when not enough gold', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.gold = 0;
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(false);
    expect(result.message).toContain('gold');
  });

  it('fails when weapon already owned', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.gold = 999;
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.buySelectedItem(player); // buy it
    const result = mgr.buySelectedItem(player); // try again
    expect(result.success).toBe(false);
    expect(result.message).toContain('already own');
  });

  it('purchases a potion successfully', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.potions = 0;
    player.state.gold = 10;
    mgr.openShop(NpcRole.SHOP_POTIONS);
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(true);
    expect(player.state.potions).toBe(1);
  });

  it('fails when potion inventory is full', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.potions = 10;
    player.state.gold = 100;
    mgr.openShop(NpcRole.SHOP_POTIONS);
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(false);
  });
});

describe('NpcManager.startQuest / recordEnemyDefeated', () => {
  it('startQuest sets quest.started', () => {
    const mgr = new NpcManager();
    const quest = makeQuest();
    mgr.startQuest(quest);
    expect(quest.started).toBe(true);
  });

  it('recordEnemyDefeated increments count when quest started', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), started: true };
    mgr.recordEnemyDefeated(quest);
    mgr.recordEnemyDefeated(quest);
    expect(quest.enemiesDefeated).toBe(2);
  });

  it('does not increment when quest not started', () => {
    const mgr = new NpcManager();
    const quest = makeQuest();
    mgr.recordEnemyDefeated(quest);
    expect(quest.enemiesDefeated).toBe(0);
  });

  it('does not increment when quest already completed', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), started: true, completed: true };
    mgr.recordEnemyDefeated(quest);
    expect(quest.enemiesDefeated).toBe(0);
  });
});

describe('NpcManager.claimQuestReward', () => {
  it('grants gold and marks reward claimed', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    const quest = { ...makeQuest(), started: true, completed: true };
    const result = mgr.claimQuestReward(quest, player);
    expect(result.success).toBe(true);
    expect(player.state.gold).toBe(10 + MAIN_QUEST.rewardGold);
    expect(quest.rewardClaimed).toBe(true);
  });

  it('fails when quest not completed', () => {
    const mgr = new NpcManager();
    const result = mgr.claimQuestReward(makeQuest(), makePlayer());
    expect(result.success).toBe(false);
  });

  it('fails when reward already claimed', () => {
    const mgr = new NpcManager();
    const quest = { ...makeQuest(), completed: true, rewardClaimed: true };
    const result = mgr.claimQuestReward(quest, makePlayer());
    expect(result.success).toBe(false);
  });
});
