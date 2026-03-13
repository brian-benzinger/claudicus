import { ChestDef, LootItem } from './types';
import { PlayerManager } from './player';
import { getWeapon } from './data/weapons';
import { getArmor } from './data/armors';

export interface LootResult {
  messages: string[];
}

export function openChest(chest: ChestDef, player: PlayerManager): LootResult {
  const messages: string[] = [];

  for (const item of chest.loot) {
    switch (item.type) {
      case 'potion':
        const potionsAdded = item.amount || 1;
        player.addPotions(potionsAdded);
        messages.push(`Found ${potionsAdded} Health Potion${potionsAdded > 1 ? 's' : ''}!`);
        break;

      case 'gold':
        const goldAmount = item.amount || 0;
        player.addGold(goldAmount);
        messages.push(`Found ${goldAmount} gold!`);
        break;

      case 'weapon':
        if (item.weaponId) {
          const weapon = getWeapon(item.weaponId);
          player.equipWeapon(item.weaponId);
          messages.push(`Found ${weapon.name}!`);
        }
        break;

      case 'antique_coin':
        // Antique coin is worth 15 gold
        player.addGold(15);
        messages.push('Found an Antique Coin! (+15 gold)');
        break;

      case 'armor':
        if (item.armorId) {
          const armor = getArmor(item.armorId);
          player.equipArmor(item.armorId);
          messages.push(`Found ${armor.name}!`);
        }
        break;
    }
  }

  if (messages.length === 0) {
    messages.push('The chest is empty.');
  }

  return { messages };
}

export function getItemDescription(item: LootItem): string {
  switch (item.type) {
    case 'potion':
      return `${item.amount || 1}x Health Potion`;
    case 'gold':
      return `${item.amount || 0} Gold`;
    case 'weapon':
      if (item.weaponId) {
        const weapon = getWeapon(item.weaponId);
        return weapon.name;
      }
      return 'Unknown Weapon';
    case 'antique_coin':
      return 'Antique Coin';
    case 'armor':
      if (item.armorId) {
        const armor = getArmor(item.armorId);
        return armor.name;
      }
      return 'Unknown Armor';
    default:
      return 'Unknown Item';
  }
}
