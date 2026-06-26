import {
  NpcDef,
  NpcRole,
  DialogState,
  QuestState,
  ShopItem,
  MAX_POTIONS,
  POTION_COST
} from './types';
import { PlayerManager } from './player';
import { getShopWeapons, getWeapon, WEAPONS } from './data/weapons';
import { getShopArmors, getArmor } from './data/armors';
import { QUESTS, QuestDef } from './data/quests';

export class NpcManager {
  dialogState: DialogState | null = null;
  shopItems: ShopItem[] = [];
  shopCursor: number = 0;
  isInShop: boolean = false;

  // Start dialog with an NPC
  startDialog(npc: NpcDef, quests: Record<string, QuestState>): string[] {
    const quest = npc.questId ? quests[npc.questId] : null;
    const revenantDefeated = quests['revenant_threat']?.rewardClaimed ?? false;
    let lines: string[];

    if (quest) {
      // Quest-aware dialog — check states in priority order
      if (quest.completed && !quest.rewardClaimed) {
        // Reward pending — always show completion dialog so player can claim it
        lines = npc.dialogs.questComplete || npc.dialogs.default;
      } else if (revenantDefeated && npc.dialogs.bossNews) {
        // Boss news overrides questDone / default once the adventurer has spread word
        lines = npc.dialogs.bossNews;
      } else if (quest.rewardClaimed) {
        lines = npc.dialogs.questDone || npc.dialogs.default;
      } else if (quest.started) {
        lines = npc.dialogs.questInProgress || npc.dialogs.default;
      } else {
        lines = npc.dialogs.questNotStarted || npc.dialogs.default;
      }
    } else if (revenantDefeated && npc.dialogs.bossNews) {
      lines = npc.dialogs.bossNews;
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
  advanceDialog(): 'continue' | 'done' | 'shop' | 'craft' {
    if (!this.dialogState) return 'done';

    this.dialogState.currentLine += 2;

    if (this.dialogState.currentLine >= this.dialogState.lines.length) {
      const role = this.dialogState.npc.role;

      if (role === NpcRole.SHOP_WEAPONS || role === NpcRole.SHOP_POTIONS || role === NpcRole.SHOP_ARMOR) {
        this.openShop(role);
        return 'shop';
      }

      if (role === NpcRole.SHOP_CRAFT) {
        this.dialogState = null;
        return 'craft';
      }

      this.dialogState = null;
      return 'done';
    }

    return 'continue';
  }

  // Get current dialog line (returns two lines joined with \n if available)
  getCurrentLine(): string | null {
    if (!this.dialogState) return null;
    const current = this.dialogState.lines[this.dialogState.currentLine];
    const next = this.dialogState.lines[this.dialogState.currentLine + 1];
    return next ? `${current}\n${next}` : current;
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
        cost: POTION_COST,
        type: 'potion' as const
      }];
    } else if (role === NpcRole.SHOP_ARMOR) {
      const armors = getShopArmors();
      this.shopItems = armors.map(a => ({
        armorId: a.id,
        name: a.name,
        cost: a.cost,
        type: 'armor' as const
      }));
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
      owned: item.weaponId
        ? player.ownsWeapon(item.weaponId)
        : item.armorId
          ? player.ownsArmor(item.armorId)
          : false
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
      if (player.state.potions >= MAX_POTIONS) {
        return { success: false, message: 'Cannot carry more potions!' };
      }

      player.removeGold(item.cost);
      player.addPotions(1);
      return { success: true, message: 'Purchased Health Potion!' };
    } else if (item.type === 'armor') {
      if (player.ownsArmor(item.armorId!)) {
        return { success: false, message: 'You already own this armor.' };
      }

      player.removeGold(item.cost);
      player.equipArmor(item.armorId!);
      return { success: true, message: `Purchased ${item.name}!` };
    }

    return { success: false, message: 'Unknown item.' };
  }

  // Claim quest reward using the quest definition for reward details
  claimQuestReward(
    quest: QuestState,
    player: PlayerManager,
    questDef?: QuestDef
  ): { success: boolean; rewards: string[] } {
    if (!quest.completed || quest.rewardClaimed) {
      return { success: false, rewards: [] };
    }

    // Fall back to the main quest def if none provided (legacy path)
    const def = questDef ?? QUESTS.forest_menace;
    const rewards: string[] = [];

    if (def.rewardGold > 0) {
      player.addGold(def.rewardGold);
      rewards.push(`Received ${def.rewardGold} gold!`);
    }

    if (def.rewardWeaponId && !player.ownsWeapon(def.rewardWeaponId)) {
      player.equipWeapon(def.rewardWeaponId);
      const weapon = getWeapon(def.rewardWeaponId);
      rewards.push(`Received ${weapon.name}!`);
    }

    if (def.rewardPotions && def.rewardPotions > 0) {
      player.addPotions(def.rewardPotions);
      const label = def.rewardPotions === 1 ? 'Health Potion' : 'Health Potions';
      rewards.push(`Received ${def.rewardPotions} ${label}!`);
    }

    quest.rewardClaimed = true;

    return { success: true, rewards };
  }

  // Start quest
  startQuest(quest: QuestState): void {
    quest.started = true;
  }

  // Increment progress counter
  recordEnemyDefeated(quest: QuestState): void {
    if (quest.started && !quest.completed) {
      quest.count++;
    }
  }

  // Clean up dialog state
  clearDialog(): void {
    this.dialogState = null;
  }
}
