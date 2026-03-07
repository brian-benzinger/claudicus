import {
  NpcDef,
  NpcRole,
  DialogState,
  QuestState,
  ShopItem
} from './types';
import { PlayerManager } from './player';
import { getShopWeapons, getWeapon, WEAPONS } from './data/weapons';
import { MAIN_QUEST } from './data/quests';

export class NpcManager {
  dialogState: DialogState | null = null;
  shopItems: ShopItem[] = [];
  shopCursor: number = 0;
  isInShop: boolean = false;

  // Start dialog with an NPC
  startDialog(npc: NpcDef, quest: QuestState): string[] {
    let lines: string[];

    if (npc.role === NpcRole.QUEST) {
      // Quest NPC - determine which dialog to show
      if (quest.rewardClaimed) {
        lines = npc.dialogs.questDone || npc.dialogs.default;
      } else if (quest.completed) {
        lines = npc.dialogs.questComplete || npc.dialogs.default;
      } else if (quest.started) {
        lines = npc.dialogs.questInProgress || npc.dialogs.default;
      } else {
        lines = npc.dialogs.questNotStarted || npc.dialogs.default;
      }
    } else {
      lines = npc.dialogs.default;
    }

    this.dialogState = {
      npc,
      lines,
      currentLine: 0
    };

    return lines;
  }

  // Advance to next dialog line
  advanceDialog(): 'continue' | 'done' | 'shop' {
    if (!this.dialogState) return 'done';

    this.dialogState.currentLine++;

    if (this.dialogState.currentLine >= this.dialogState.lines.length) {
      // Dialog finished
      const role = this.dialogState.npc.role;

      // If shop NPC, open shop after dialog
      if (role === NpcRole.SHOP_WEAPONS || role === NpcRole.SHOP_POTIONS) {
        this.openShop(role);
        return 'shop';
      }

      this.dialogState = null;
      return 'done';
    }

    return 'continue';
  }

  // Get current dialog line
  getCurrentLine(): string | null {
    if (!this.dialogState) return null;
    return this.dialogState.lines[this.dialogState.currentLine];
  }

  // Get NPC name for dialog display
  getSpeakerName(): string | null {
    if (!this.dialogState) return null;
    return this.dialogState.npc.name;
  }

  // Open shop
  openShop(role: NpcRole): void {
    this.isInShop = true;
    this.shopCursor = 0;

    if (role === NpcRole.SHOP_WEAPONS) {
      const weapons = getShopWeapons();
      this.shopItems = weapons.map(w => ({
        weaponId: w.id,
        name: w.name,
        cost: w.cost,
        type: 'weapon' as const
      }));
    } else if (role === NpcRole.SHOP_POTIONS) {
      this.shopItems = [{
        name: 'Health Potion',
        cost: 5,
        type: 'potion' as const
      }];
    }
  }

  // Close shop
  closeShop(): void {
    this.isInShop = false;
    this.shopItems = [];
    this.shopCursor = 0;
    this.dialogState = null;
  }

  // Move shop cursor
  moveShopCursor(delta: number): void {
    this.shopCursor += delta;
    if (this.shopCursor < 0) this.shopCursor = this.shopItems.length - 1;
    if (this.shopCursor >= this.shopItems.length) this.shopCursor = 0;
  }

  // Get shop items with ownership info
  getShopItemsWithOwnership(player: PlayerManager): ShopItem[] {
    return this.shopItems.map(item => ({
      ...item,
      owned: item.weaponId ? player.ownsWeapon(item.weaponId) : false
    }));
  }

  // Attempt to buy selected item
  buySelectedItem(player: PlayerManager): { success: boolean; message: string } {
    const item = this.shopItems[this.shopCursor];
    if (!item) {
      return { success: false, message: 'No item selected.' };
    }

    if (player.state.gold < item.cost) {
      return { success: false, message: 'Not enough gold!' };
    }

    if (item.type === 'weapon') {
      if (player.ownsWeapon(item.weaponId!)) {
        return { success: false, message: 'You already own this weapon.' };
      }

      player.removeGold(item.cost);
      player.equipWeapon(item.weaponId!);
      return { success: true, message: `Purchased ${item.name}!` };
    } else if (item.type === 'potion') {
      if (player.state.potions >= 10) {
        return { success: false, message: 'Cannot carry more potions!' };
      }

      player.removeGold(item.cost);
      player.addPotions(1);
      return { success: true, message: 'Purchased Health Potion!' };
    }

    return { success: false, message: 'Unknown item.' };
  }

  // Handle quest completion check
  checkQuestComplete(quest: QuestState, player: PlayerManager): { completed: boolean; message: string[] } {
    if (!quest.started || quest.rewardClaimed) {
      return { completed: false, message: [] };
    }

    if (quest.enemiesDefeated >= MAIN_QUEST.goalCount && !quest.completed) {
      quest.completed = true;
      return { completed: true, message: ['You have completed the quest objective!'] };
    }

    return { completed: false, message: [] };
  }

  // Claim quest reward
  claimQuestReward(quest: QuestState, player: PlayerManager): { success: boolean; rewards: string[] } {
    if (!quest.completed || quest.rewardClaimed) {
      return { success: false, rewards: [] };
    }

    const rewards: string[] = [];

    // Add gold
    player.addGold(MAIN_QUEST.rewardGold);
    rewards.push(`Received ${MAIN_QUEST.rewardGold} gold!`);

    // Add weapon if not owned
    if (MAIN_QUEST.rewardWeaponId && !player.ownsWeapon(MAIN_QUEST.rewardWeaponId)) {
      player.equipWeapon(MAIN_QUEST.rewardWeaponId);
      const weapon = getWeapon(MAIN_QUEST.rewardWeaponId);
      rewards.push(`Received ${weapon.name}!`);
    }

    quest.rewardClaimed = true;

    return { success: true, rewards };
  }

  // Start quest
  startQuest(quest: QuestState): void {
    quest.started = true;
  }

  // Increment enemy defeated count
  recordEnemyDefeated(quest: QuestState): void {
    if (quest.started && !quest.completed) {
      quest.enemiesDefeated++;
    }
  }

  // Clean up dialog state
  clearDialog(): void {
    this.dialogState = null;
  }
}
