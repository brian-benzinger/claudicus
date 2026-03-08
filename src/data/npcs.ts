import { NpcDef, NpcRole } from '../types';

export const VILLAGE_NPCS: NpcDef[] = [
  {
    id: 'elder_aldric',
    name: 'Elder Aldric',
    tileX: 8,
    tileY: 4,
    role: NpcRole.QUEST,
    questId: 'forest_menace',
    color: '#4a3728',
    dialogs: {
      default: [
        'Welcome, young one.',
        'These are troubled times for Brannford.'
      ],
      questNotStarted: [
        'Ah, you look capable enough.',
        'Bandits and beasts terrorize the road to Thornwood.',
        'We need someone brave — or foolish — enough to clear them out.',
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
    questId: 'bandit_steel',
    color: '#8b4513',
    dialogs: {
      default: [
        'Welcome to my forge, traveler.',
        'I craft the finest weapons in the region.',
        'What catches your eye?'
      ],
      questNotStarted: [
        'Those bandits robbed my last iron shipment!',
        'Three of my apprentices were beaten on the road to Thornwood.',
        'If you\'re heading out there, deal with those cutthroats for me.',
        'Three bandits — that\'s what I need cleared out.',
        'I\'ll reward you with a weapon straight from my forge.'
      ],
      questInProgress: [
        'Still those bandits lurking in Thornwood?',
        'Come back when you\'ve dealt with three of them.',
        'Now, can I interest you in something for the road?'
      ],
      questComplete: [
        'You cleared those bandits? My supply wagons can roll again!',
        'Take this hand axe — forged it myself.',
        'And browse the shop while you\'re here.'
      ],
      questDone: [
        'Business is flowing smoothly now, thanks to you.',
        'See anything you like?'
      ]
    }
  },
  {
    id: 'old_marta',
    name: 'Old Marta',
    tileX: 14,
    tileY: 13,
    role: NpcRole.SHOP_POTIONS,
    questId: 'boar_problem',
    color: '#6b4423',
    dialogs: {
      default: [
        'Herbs and remedies, traveler!',
        'A health potion might save your life out there.',
        'Only five gold pieces each.'
      ],
      questNotStarted: [
        'Those wild boars have been trampling my herb garden!',
        'I need boar bristles for my best healing salves.',
        'Two of the beasts roam Thornwood — prove they\'re gone.',
        'I\'ll repay you with a fresh batch of potions.',
        'Now, anything else I can help you with today?'
      ],
      questInProgress: [
        'Those boars still running loose in Thornwood?',
        'Two of them — remember?',
        'Potions, dear? I still have some in stock.'
      ],
      questComplete: [
        'The boars are gone! My poor herb garden can recover at last.',
        'Take these potions — freshly brewed, just for you.',
        'And feel free to buy more whenever you need.'
      ],
      questDone: [
        'My garden is growing nicely again. Thank you, dear.',
        'Anything else I can get you?'
      ]
    }
  },
  {
    id: 'brother_tomas',
    name: 'Brother Tomas',
    tileX: 15,
    tileY: 10,
    role: NpcRole.DIALOG,
    questId: 'quiet_dead',
    color: '#2f2f2f',
    dialogs: {
      default: [
        'Blessings upon you, child.',
        'They say an old chapel stands in Thornwood.',
        'Once holy ground, now... something else lurks there.',
        'The dead do not rest easy in these times.'
      ],
      questNotStarted: [
        'That old chapel in the deep forest troubles me greatly.',
        'Two skeletons walk its ruined halls — souls that cannot find peace.',
        'The Light calls on a brave soul to lay them to rest.',
        'Please, put them to rest. You will be compensated from the church coffers.'
      ],
      questInProgress: [
        'Have the chapel\'s guardians been laid to rest?',
        'Two skeletons still wander those ruins.',
        'Their souls cry out for release.'
      ],
      questComplete: [
        'You have given those lost souls peace at last.',
        'The chapel is quiet once more.',
        'Take this gold — a small token from those who pray for Thornwood.'
      ],
      questDone: [
        'The chapel rests quietly now.',
        'May it remain so. Blessings upon you, hero.'
      ]
    }
  },
  {
    id: 'farmer_wulf',
    name: 'Farmer Wulf',
    tileX: 5,
    tileY: 13,
    role: NpcRole.DIALOG,
    questId: 'wolves_gate',
    color: '#5d4e37',
    dialogs: {
      default: [
        'Ho there, stranger.',
        'If you be heading to Thornwood, watch yourself.',
        'Wolves hunt in packs, and the bandits...',
        'Well, they be worse than wolves.',
        'Stick to the paths if you value your hide.'
      ],
      questNotStarted: [
        'Wolves been circling my farm every night this week.',
        'Lost two sheep already to those cursed beasts.',
        'Three of the biggest ones have been spotted near the forest edge.',
        'Clear them out and I\'ll pay you with everything I can spare.',
        'Throw in a dagger I found in the fields too.'
      ],
      questInProgress: [
        'Still hearing howling at night...',
        'Three wolves — that\'s what I need dealt with.',
        'My sheep won\'t last much longer.'
      ],
      questComplete: [
        'You slew those wolves? My sheep haven\'t slept so well in weeks!',
        'Here — the gold and that dagger I promised.',
        'You\'ve done this farm a great service.'
      ],
      questDone: [
        'The farm\'s been peaceful since. Much appreciated, friend.',
        'You\'re welcome at my hearth any time.'
      ]
    }
  }
];

export function getNpc(id: string): NpcDef | undefined {
  return VILLAGE_NPCS.find(npc => npc.id === id);
}
