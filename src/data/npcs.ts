import { NpcDef, NpcRole } from '../types';

export const VILLAGE_NPCS: NpcDef[] = [
  {
    id: 'elder_aldric',
    name: 'Elder Aldric',
    tileX: 8,
    tileY: 4,
    role: NpcRole.QUEST,
    color: '#4a3728',
    dialogs: {
      default: [
        'Welcome, young one.',
        'These are troubled times for Brannford.'
      ],
      questNotStarted: [
        'Ah, you look capable enough.',
        'Bandits and beasts terrorize the road to Thornwood.',
        'We need someone brave - or foolish - enough to clear them out.',
        'Defeat five of those creatures and return to me.',
        'You shall be rewarded handsomely.'
      ],
      questInProgress: [
        'The forest still teems with danger.',
        'Have you slain five beasts yet?',
        'Return when the deed is done.'
      ],
      questComplete: [
        'You have done it! Five beasts felled by your hand.',
        'Brannford owes you a great debt.',
        'Take this gold and this fine blade as your reward.',
        'May it serve you well in battles to come.'
      ],
      questDone: [
        'The village sleeps easier thanks to you.',
        'You are always welcome in Brannford, hero.'
      ]
    }
  },
  {
    id: 'gretta_smith',
    name: 'Gretta the Smith',
    tileX: 20,
    tileY: 6,
    role: NpcRole.SHOP_WEAPONS,
    color: '#8b4513',
    dialogs: {
      default: [
        'Welcome to my forge, traveler.',
        'I craft the finest weapons in the region.',
        'What catches your eye?'
      ]
    }
  },
  {
    id: 'old_marta',
    name: 'Old Marta',
    tileX: 14,
    tileY: 12,
    role: NpcRole.SHOP_POTIONS,
    color: '#6b4423',
    dialogs: {
      default: [
        'Herbs and remedies, traveler!',
        'A health potion might save your life out there.',
        'Only five gold pieces each.'
      ]
    }
  },
  {
    id: 'brother_tomas',
    name: 'Brother Tomas',
    tileX: 15,
    tileY: 10,
    role: NpcRole.DIALOG,
    color: '#2f2f2f',
    dialogs: {
      default: [
        'Blessings upon you, child.',
        'They say an old chapel stands in Thornwood.',
        'Once holy ground, now... something else lurks there.',
        'The dead do not rest easy in these times.'
      ]
    }
  },
  {
    id: 'farmer_wulf',
    name: 'Farmer Wulf',
    tileX: 4,
    tileY: 14,
    role: NpcRole.DIALOG,
    color: '#5d4e37',
    dialogs: {
      default: [
        'Ho there, stranger.',
        'If you be heading to Thornwood, watch yourself.',
        'Wolves hunt in packs, and the bandits...',
        'Well, they be worse than wolves.',
        'Stick to the paths if you value your hide.'
      ]
    }
  }
];

export function getNpc(id: string): NpcDef | undefined {
  return VILLAGE_NPCS.find(npc => npc.id === id);
}
