import { describe, it, expect, beforeEach } from 'vitest';
import { NpcManager } from '../npc';
import { PlayerManager } from '../player';
import { createDefaultPlayer, createDefaultQuestState, NpcRole, QuestState } from '../types';
import { QUESTS } from '../data/quests';

function makePlayer() {
  return new PlayerManager(createDefaultPlayer());
}

function makeQuestState(overrides: Partial<QuestState> = {}): QuestState {
  return { ...createDefaultQuestState(), ...overrides };
}

/** Build a quests record with a single entry keyed to 'test_quest' */
function makeQuests(overrides: Partial<QuestState> = {}): Record<string, QuestState> {
  return { test_quest: makeQuestState(overrides) };
}

function makeQuestNpc() {
  return {
    id: 'elder',
    name: 'Elder Aldric',
    tileX: 5,
    tileY: 5,
    role: NpcRole.QUEST,
    questId: 'test_quest',
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
    mgr.startDialog(makeQuestNpc(), makeQuests());
    expect(mgr.getCurrentLine()).toBe('Please help us!');
  });

  it('returns questInProgress lines when quest started', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests({ started: true }));
    expect(mgr.getCurrentLine()).toBe('Keep fighting!');
  });

  it('returns questComplete lines when quest completed', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests({ started: true, completed: true }));
    expect(mgr.getCurrentLine()).toBe('Well done!');
  });

  it('returns questDone lines when reward claimed', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests({ started: true, completed: true, rewardClaimed: true }));
    expect(mgr.getCurrentLine()).toBe('Thank you, hero.');
  });

  it('returns default lines for NPCs with no questId', () => {
    const mgr = new NpcManager();
    const npc = makeShopNpc(NpcRole.SHOP_WEAPONS);
    mgr.startDialog(npc, makeQuests());
    expect(mgr.getCurrentLine()).toBe('Welcome to my shop!');
  });

  it('falls back to default when questComplete dialog is absent', () => {
    const mgr = new NpcManager();
    const npc = {
      ...makeQuestNpc(),
      dialogs: { default: ['Generic reply.'] },
    };
    mgr.startDialog(npc, makeQuests({ started: true, completed: true }));
    expect(mgr.getCurrentLine()).toBe('Generic reply.');
  });

  it('falls back to default when questDone dialog is absent', () => {
    const mgr = new NpcManager();
    const npc = {
      ...makeQuestNpc(),
      dialogs: { default: ['Generic reply.'] },
    };
    mgr.startDialog(npc, makeQuests({ started: true, completed: true, rewardClaimed: true }));
    expect(mgr.getCurrentLine()).toBe('Generic reply.');
  });

  it('falls back to default when questInProgress dialog is absent', () => {
    const mgr = new NpcManager();
    const npc = {
      ...makeQuestNpc(),
      dialogs: { default: ['Generic reply.'] },
    };
    mgr.startDialog(npc, makeQuests({ started: true }));
    expect(mgr.getCurrentLine()).toBe('Generic reply.');
  });
});

describe('NpcManager.advanceDialog', () => {
  it('returns continue when more lines exist', () => {
    const mgr = new NpcManager();
    // dialog advances two lines at a time, so need 4+ lines to still have a 'continue'
    const npc = { ...makeQuestNpc(), dialogs: { default: ['Line 1', 'Line 2', 'Line 3', 'Line 4'] } };
    mgr.startDialog(npc, makeQuests());
    expect(mgr.advanceDialog()).toBe('continue');
  });

  it('returns done for a quest NPC with one line', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests({ started: true, completed: true, rewardClaimed: true }));
    expect(mgr.advanceDialog()).toBe('done');
  });

  it('returns shop and opens shop for SHOP_WEAPONS NPC', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeShopNpc(NpcRole.SHOP_WEAPONS), makeQuests());
    expect(mgr.advanceDialog()).toBe('shop');
    expect(mgr.isInShop).toBe(true);
    expect(mgr.shopItems.length).toBeGreaterThan(0);
    expect(mgr.shopItems.every(i => i.type === 'weapon')).toBe(true);
  });

  it('returns done when called with no dialog state', () => {
    const mgr = new NpcManager();
    expect(mgr.advanceDialog()).toBe('done');
  });
});

describe('NpcManager.getSpeakerName', () => {
  it('returns npc name during dialog', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests());
    expect(mgr.getSpeakerName()).toBe('Elder Aldric');
  });

  it('returns null when no dialog', () => {
    expect(new NpcManager().getSpeakerName()).toBeNull();
  });
});

describe('NpcManager.getCurrentLine — paired vs single line', () => {
  it('joins the pair with \\n when both current and next lines exist', () => {
    const mgr = new NpcManager();
    const npc = { ...makeQuestNpc(), dialogs: { default: ['Line one.', 'Line two.'] } };
    mgr.startDialog(npc, makeQuests());
    expect(mgr.getCurrentLine()).toBe('Line one.\nLine two.');
  });

  it('returns just the single line when there is no paired second line', () => {
    const mgr = new NpcManager();
    const npc = { ...makeQuestNpc(), dialogs: { default: ['One lonely line.'] } };
    mgr.startDialog(npc, makeQuests());
    expect(mgr.getCurrentLine()).toBe('One lonely line.');
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
    expect(player.ownsWeapon(item.weaponId!)).toBe(true);
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
    mgr.buySelectedItem(player);
    const result = mgr.buySelectedItem(player);
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
    const quest = makeQuestState();
    mgr.startQuest(quest);
    expect(quest.started).toBe(true);
  });

  it('recordEnemyDefeated increments count when quest started', () => {
    const mgr = new NpcManager();
    const quest = makeQuestState({ started: true });
    mgr.recordEnemyDefeated(quest);
    mgr.recordEnemyDefeated(quest);
    expect(quest.count).toBe(2);
  });

  it('does not increment when quest not started', () => {
    const mgr = new NpcManager();
    const quest = makeQuestState();
    mgr.recordEnemyDefeated(quest);
    expect(quest.count).toBe(0);
  });

  it('does not increment when quest already completed', () => {
    const mgr = new NpcManager();
    const quest = makeQuestState({ started: true, completed: true });
    mgr.recordEnemyDefeated(quest);
    expect(quest.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Boss news dialog override
// ---------------------------------------------------------------------------
describe('NpcManager.startDialog — bossNews override', () => {
  function makeQuestsWithBossDefeated(npcQuestOverrides: Partial<QuestState> = {}): Record<string, QuestState> {
    return {
      test_quest: makeQuestState(npcQuestOverrides),
      revenant_threat: makeQuestState({ started: true, completed: true, rewardClaimed: true }),
    };
  }

  function makeNpcWithBossNews() {
    return {
      ...makeQuestNpc(),
      dialogs: {
        default: ['Hello.'],
        questNotStarted: ['Please help us!'],
        questInProgress: ['Keep fighting!'],
        questComplete: ['Well done!'],
        questDone: ['Thank you, hero.'],
        bossNews: ['The Revenant Knight is slain! A legend walks among us!'],
      },
    };
  }

  it('shows bossNews when revenant_threat reward is claimed (questDone state)', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeNpcWithBossNews(), makeQuestsWithBossDefeated({ started: true, completed: true, rewardClaimed: true }));
    expect(mgr.getCurrentLine()).toBe('The Revenant Knight is slain! A legend walks among us!');
  });

  it('shows bossNews for an NPC with no questId when revenant defeated', () => {
    const mgr = new NpcManager();
    const npc = {
      id: 'guard',
      name: 'Guard',
      tileX: 1,
      tileY: 1,
      role: NpcRole.DIALOG,
      color: '#888',
      dialogs: {
        default: ['Halt.'],
        bossNews: ['I heard you slew the Revenant Knight!'],
      },
    };
    mgr.startDialog(npc, { revenant_threat: makeQuestState({ started: true, completed: true, rewardClaimed: true }) });
    expect(mgr.getCurrentLine()).toBe('I heard you slew the Revenant Knight!');
  });

  it('does NOT show bossNews when revenant_threat reward is not yet claimed', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeNpcWithBossNews(), makeQuestsWithBossDefeated({ started: true, completed: true, rewardClaimed: true }));
    // Reset revenant quest to not-claimed
    const quests = {
      test_quest: makeQuestState({ started: true, completed: true, rewardClaimed: true }),
      revenant_threat: makeQuestState({ started: true, completed: true, rewardClaimed: false }),
    };
    mgr.startDialog(makeNpcWithBossNews(), quests);
    // Should show questDone since own quest is claimed but boss news not active
    expect(mgr.getCurrentLine()).toBe('Thank you, hero.');
  });

  it('still shows questComplete (pending reward) even when revenant defeated', () => {
    const mgr = new NpcManager();
    const quests = {
      test_quest: makeQuestState({ started: true, completed: true, rewardClaimed: false }),
      revenant_threat: makeQuestState({ started: true, completed: true, rewardClaimed: true }),
    };
    mgr.startDialog(makeNpcWithBossNews(), quests);
    // Pending reward takes priority so player can claim it
    expect(mgr.getCurrentLine()).toBe('Well done!');
  });
});

// ---------------------------------------------------------------------------
// Adventurer NPC and revenant_threat quest
// ---------------------------------------------------------------------------
describe('Duvain the Wanderer NPC placement', () => {
  it('is defined in FOREST_NPCS', async () => {
    const { FOREST_NPCS } = await import('../data/npcs');
    const duvain = FOREST_NPCS.find(n => n.id === 'duvain_wanderer');
    expect(duvain).toBeDefined();
    expect(duvain!.questId).toBe('revenant_threat');
  });

  it('has all required dialog states', async () => {
    const { FOREST_NPCS } = await import('../data/npcs');
    const duvain = FOREST_NPCS.find(n => n.id === 'duvain_wanderer')!;
    expect(duvain.dialogs.questNotStarted?.length).toBeGreaterThan(0);
    expect(duvain.dialogs.questInProgress?.length).toBeGreaterThan(0);
    expect(duvain.dialogs.questComplete?.length).toBeGreaterThan(0);
    expect(duvain.dialogs.questDone?.length).toBeGreaterThan(0);
  });
});

describe('revenant_threat quest definition', () => {
  it('targets REVENANT_KNIGHT enemy type', async () => {
    const { QUESTS } = await import('../data/quests');
    const { EnemyType } = await import('../types');
    const q = QUESTS.revenant_threat;
    expect(q).toBeDefined();
    expect(q.goalEnemyTypes).toContain(EnemyType.REVENANT_KNIGHT);
    expect(q.goalCount).toBe(1);
  });

  it('has a potion reward', async () => {
    const { QUESTS } = await import('../data/quests');
    const q = QUESTS.revenant_threat;
    expect(q.rewardPotions).toBeGreaterThan(0);
  });
});

describe('NpcManager.claimQuestReward', () => {
  const testQuestDef = QUESTS.forest_menace;

  it('grants gold and marks reward claimed', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    const quest = makeQuestState({ started: true, completed: true });
    const result = mgr.claimQuestReward(quest, player, testQuestDef);
    expect(result.success).toBe(true);
    expect(player.state.gold).toBe(10 + testQuestDef.rewardGold);
    expect(quest.rewardClaimed).toBe(true);
    // forest_menace gives gold + iron_longsword — both must be applied
    expect(player.ownsWeapon(testQuestDef.rewardWeaponId!)).toBe(true);
    expect(result.rewards).toHaveLength(2);
    expect(result.rewards[0]).toContain(String(testQuestDef.rewardGold));
    expect(result.rewards[1]).toContain('Iron Longsword');
  });

  it('grants potions when quest has potion reward', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.state.potions = 0;
    const quest = makeQuestState({ started: true, completed: true });
    const result = mgr.claimQuestReward(quest, player, QUESTS.boar_problem);
    expect(result.success).toBe(true);
    // boar_problem gives gold=25 + potions=3 — both must be applied
    expect(player.state.gold).toBe(10 + QUESTS.boar_problem.rewardGold);
    expect(player.state.potions).toBe(QUESTS.boar_problem.rewardPotions);
    expect(result.rewards).toHaveLength(2);
    expect(result.rewards[0]).toContain(String(QUESTS.boar_problem.rewardGold));
  });

  it('skips weapon reward when player already owns it, returning only gold message', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    player.equipWeapon('iron_longsword'); // already owns the forest_menace weapon reward
    const quest = makeQuestState({ started: true, completed: true });
    const result = mgr.claimQuestReward(quest, player, testQuestDef);
    expect(result.success).toBe(true);
    expect(player.state.gold).toBe(10 + testQuestDef.rewardGold);
    // Weapon skipped: only 1 reward message (gold), not 2
    expect(result.rewards).toHaveLength(1);
    expect(result.rewards[0]).toContain(String(testQuestDef.rewardGold));
  });

  it('fails when quest not completed', () => {
    const mgr = new NpcManager();
    const result = mgr.claimQuestReward(makeQuestState(), makePlayer(), testQuestDef);
    expect(result.success).toBe(false);
    expect(result.rewards).toHaveLength(0);
  });

  it('fails when reward already claimed', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    const quest = makeQuestState({ completed: true, rewardClaimed: true });
    const result = mgr.claimQuestReward(quest, player, testQuestDef);
    expect(result.success).toBe(false);
    expect(result.rewards).toHaveLength(0);
    expect(player.state.gold).toBe(10); // gold must not be granted twice
  });
});

// ---------------------------------------------------------------------------
// Forge / crafting NPC
// ---------------------------------------------------------------------------
describe('NpcManager.advanceDialog — SHOP_CRAFT role returns craft', () => {
  it('returns "craft" when dialog ends for a SHOP_CRAFT NPC', () => {
    const mgr = new NpcManager();
    const forgeNpc = {
      id: 'gretta_anvil',
      name: "Gretta's Forge",
      tileX: 22,
      tileY: 4,
      role: NpcRole.SHOP_CRAFT,
      color: '#555',
      dialogs: { default: ['The forge burns hot.'] },
    };
    mgr.startDialog(forgeNpc, {});
    const result = mgr.advanceDialog();
    expect(result).toBe('craft');
  });

  it('does not open shop items for SHOP_CRAFT NPC', () => {
    const mgr = new NpcManager();
    const forgeNpc = {
      id: 'gretta_anvil',
      name: "Gretta's Forge",
      tileX: 22,
      tileY: 4,
      role: NpcRole.SHOP_CRAFT,
      color: '#555',
      dialogs: { default: ['Ready to forge?'] },
    };
    mgr.startDialog(forgeNpc, {});
    mgr.advanceDialog();
    expect(mgr.isInShop).toBe(false);
    expect(mgr.shopItems.length).toBe(0);
  });
});

describe('Gretta\'s Forge NPC placement', () => {
  it('is defined in VILLAGE_NPCS', async () => {
    const { VILLAGE_NPCS } = await import('../data/npcs');
    const forge = VILLAGE_NPCS.find(n => n.id === 'gretta_anvil');
    expect(forge).toBeDefined();
    expect(forge!.role).toBe(NpcRole.SHOP_CRAFT);
  });
});

describe('NpcManager — armor shop', () => {
  function makeArmorNpc() {
    return {
      id: 'armorer',
      name: 'Armorer',
      tileX: 1,
      tileY: 1,
      role: NpcRole.SHOP_ARMOR,
      color: '#444',
      dialogs: { default: ['Steel for sale.'] },
    };
  }

  it('opens an armor shop after dialog completes', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeArmorNpc(), {});
    const result = mgr.advanceDialog();
    expect(result).toBe('shop');
    expect(mgr.isInShop).toBe(true);
    expect(mgr.shopItems.length).toBeGreaterThan(0);
    expect(mgr.shopItems.every(i => i.type === 'armor')).toBe(true);
  });

  it('marks owned armor via getShopItemsWithOwnership', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_ARMOR);
    const player = makePlayer();
    const owned = mgr.shopItems[0].armorId!;
    player.equipArmor(owned);
    const items = mgr.getShopItemsWithOwnership(player);
    expect(items.find(i => i.armorId === owned)!.owned).toBe(true);
  });

  it('buys an armor piece, spending gold', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_ARMOR);
    const player = makePlayer();
    player.addGold(1000);
    const before = player.state.gold;
    const item = mgr.shopItems[0];
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(true);
    expect(player.ownsArmor(item.armorId!)).toBe(true);
    expect(player.state.gold).toBe(before - item.cost);
  });

  it('refuses to buy armor already owned', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_ARMOR);
    const player = makePlayer();
    player.addGold(1000);
    player.equipArmor(mgr.shopItems[0].armorId!);
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already own');
  });

  it('refuses to buy armor without enough gold', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_ARMOR);
    const player = makePlayer();
    player.state.gold = 0;
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Not enough gold');
  });
});

describe('NpcManager — misc helpers', () => {
  it('buySelectedItem reports when nothing is selected', () => {
    const mgr = new NpcManager();
    mgr.shopItems = [];
    mgr.shopCursor = 0;
    const result = mgr.buySelectedItem(makePlayer());
    expect(result.success).toBe(false);
    expect(result.message).toContain('No item selected');
  });

  it('buySelectedItem returns "Unknown item" for an unrecognised type', () => {
    const mgr = new NpcManager();
    mgr.shopItems = [{ name: 'Mystery', cost: 0, type: 'mystery' as any }];
    mgr.shopCursor = 0;
    const player = makePlayer();
    player.addGold(100);
    const result = mgr.buySelectedItem(player);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown item');
  });

  it('getCurrentLine returns null when there is no dialog', () => {
    const mgr = new NpcManager();
    expect(mgr.getCurrentLine()).toBeNull();
    expect(mgr.getSpeakerName()).toBeNull();
  });

  it('claimQuestReward falls back to the main quest def when none is passed', () => {
    const mgr = new NpcManager();
    const player = makePlayer();
    const quest = makeQuestState({ completed: true, rewardClaimed: false });
    const result = mgr.claimQuestReward(quest, player);
    expect(result.success).toBe(true);
    expect(quest.rewardClaimed).toBe(true);
  });

  it('moveShopCursor wraps around both ends', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_ARMOR);
    const n = mgr.shopItems.length;
    mgr.shopCursor = 0;
    mgr.moveShopCursor(-1);
    expect(mgr.shopCursor).toBe(n - 1);
    mgr.moveShopCursor(1);
    expect(mgr.shopCursor).toBe(0);
  });

  it('getShopItemsWithOwnership reports potions (no weapon/armor) as not owned', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_POTIONS);
    const items = mgr.getShopItemsWithOwnership(makePlayer());
    expect(items[0].owned).toBe(false);
  });

  it('getShopItemsWithOwnership reflects weapon ownership for weapon shop items', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    const player = makePlayer();
    const firstWeaponId = mgr.shopItems[0].weaponId!;
    player.equipWeapon(firstWeaponId);
    const items = mgr.getShopItemsWithOwnership(player);
    expect(items.find(i => i.weaponId === firstWeaponId)!.owned).toBe(true);
  });

  it('clearDialog wipes the dialog state', () => {
    const mgr = new NpcManager();
    mgr.startDialog(makeQuestNpc(), makeQuests());
    expect(mgr.dialogState).not.toBeNull();
    mgr.clearDialog();
    expect(mgr.dialogState).toBeNull();
  });

  it('closeShop resets shop state', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.SHOP_WEAPONS);
    mgr.closeShop();
    expect(mgr.isInShop).toBe(false);
    expect(mgr.shopItems).toEqual([]);
    expect(mgr.shopCursor).toBe(0);
  });

  it('openShop with a non-shop role leaves shopItems empty', () => {
    const mgr = new NpcManager();
    mgr.openShop(NpcRole.QUEST);
    expect(mgr.isInShop).toBe(true);
    expect(mgr.shopItems).toEqual([]);
  });
});
