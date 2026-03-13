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
    hatColor: '#1a0f08',
    hatStyle: 'tall',
    hairColor: '#b8b8b8',
    dialogs: {
      default: [
        'Welcome, young one.',
        'I have watched over Brannford for forty years.',
        'In all that time, I have never seen the forest so restless.',
        'These are troubled times for Brannford.',
        'If you have business here, speak to the folk in the village.',
        'Many have need of a capable hand.'
      ],
      questNotStarted: [
        'Ah, you look capable enough.',
        'Bandits and beasts terrorize the road to Thornwood.',
        'It began three months past — a strange fog rolled in from the deep forest.',
        'Since then, the creatures have grown bold, venturing closer to the village each night.',
        'We need someone brave — or foolish — enough to clear them out.',
        'My guards are stretched thin protecting the walls.',
        'Defeat five of those creatures and return to me.',
        'You shall be rewarded handsomely.'
      ],
      questInProgress: [
        'The forest still teems with danger.',
        'I can see the smoke of their fires from the watchtower at night.',
        'Have you slain five beasts yet?',
        'Every creature you fell is one less threat to our farmers and travelers.',
        'Return when the deed is done.',
        'Brannford is counting on you.'
      ],
      questComplete: [
        'You have done it! Five beasts felled by your hand.',
        'Word has already reached me from the forest scouts.',
        'The roads are safer already — a merchant caravan arrived just this morning.',
        'Brannford owes you a great debt.',
        'In my youth, I too walked those dangerous roads.',
        'I know the courage it takes to face such creatures.',
        'Take this gold and this fine blade as your reward.',
        'The sword belonged to my predecessor — let it serve a new champion.',
        'May it serve you well in battles to come.'
      ],
      questDone: [
        'The village sleeps easier thanks to you.',
        'The council wishes to honor you at the harvest festival.',
        'You are always welcome in Brannford, hero.',
        'If ever you need a place to rest or resupply, our gates are open.',
        'Travel safe, wherever your road takes you.'
      ],
      bossNews: [
        'Word has reached us from the forest — the Revenant Knight is no more?',
        'By the Light... that ancient horror has plagued this region for generations.',
        'Brannford will celebrate this night. You have done something truly historic.',
        'You are always welcome here, hero. Always.'
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
    apronColor: '#2a1a0a',
    dialogs: {
      default: [
        'Welcome to my forge, traveler.',
        'Mind the heat — I was just tempering a new batch of blades.',
        'I craft the finest weapons in the region.',
        'Learned the trade from my father, who learned from his.',
        'Three generations of Brannford steel.',
        'What catches your eye?'
      ],
      questNotStarted: [
        'Those bandits robbed my last iron shipment!',
        'Jumped the wagons on the Thornwood road, broad daylight.',
        'Three of my apprentices were beaten on the road to Thornwood.',
        'Young Fen still can\'t lift a hammer — broke two of his fingers.',
        'Without iron, I can\'t fill the guard\'s weapons order.',
        'The whole village suffers when the forge goes cold.',
        'If you\'re heading out there, deal with those cutthroats for me.',
        'Three bandits — that\'s what I need cleared out.',
        'I\'ll reward you with a weapon straight from my forge.',
        'Something with real edge to it.'
      ],
      questInProgress: [
        'Still those bandits lurking in Thornwood?',
        'I\'ve had to turn away two more merchants because I\'m running low on stock.',
        'Come back when you\'ve dealt with three of them.',
        'My forge needs to roar again.',
        'Now, can I interest you in something for the road?',
        'Even half-stocked, I\'ve got better steel than any peddler.'
      ],
      questComplete: [
        'You cleared those bandits? My supply wagons can roll again!',
        'The iron master in Eastfen will be sending a cart by week\'s end.',
        'Fen\'s fingers are healing — he\'ll be back at the anvil soon.',
        'Take this hand axe — forged it myself, balanced for real fighting.',
        'Not one of those decorative things the nobles carry.',
        'This one\'s meant to be used.',
        'And browse the shop while you\'re here.'
      ],
      questDone: [
        'Business is flowing smoothly now, thanks to you.',
        'Filled that guard order and had steel left over for the first time in months.',
        'Fen says he wants to train as a fighter when his hand heals.',
        'Ha! I\'ll believe it when I see it.',
        'See anything you like?'
      ],
      bossNews: [
        'The wanderer rode in shouting about you — you felled the Revenant Knight!',
        'Even I wouldn\'t face that cursed armour for all the steel in the realm.',
        'Finest hero this village has ever seen. Now, browse the shop — you\'ve earned it.'
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
    hatColor: '#4a6b20',
    hatStyle: 'wide',
    hairColor: '#e0e0e0',
    dialogs: {
      default: [
        'Herbs and remedies, traveler!',
        'Come closer, don\'t be shy.',
        'Seventy years of herb lore in these old hands.',
        'I\'ve brewed potions for kings and paupers alike.',
        'A health potion might save your life out there.',
        'Only five gold pieces each — a bargain, truly.',
        'Now, what can old Marta do for you?'
      ],
      questNotStarted: [
        'Oh, those wild boars have been trampling my herb garden!',
        'Forty years I\'ve tended that garden, and now...',
        'Look at this — crushed lavender, ruined moonbloom.',
        'Those plants take seasons to grow back properly.',
        'I need boar bristles for my best healing salves.',
        'Without them, I can only make weaker potions.',
        'Two of the beasts roam Thornwood — prove they\'re gone.',
        'Bring me back proof and I\'ll brew you the strongest batch I can manage.',
        'I\'ll repay you with a fresh batch of potions.',
        'Now, anything else I can help you with today?'
      ],
      questInProgress: [
        'Those boars still running loose in Thornwood?',
        'I patched the fence again yesterday, but it won\'t hold forever.',
        'Two of them — remember?',
        'Big ones too, judging by the hoof prints.',
        'Potions, dear? I still have some in stock.',
        'Not my best work without the bristles, but they\'ll do in a pinch.'
      ],
      questComplete: [
        'The boars are gone! My poor herb garden can recover at last.',
        'I can already see new shoots coming up where they trampled.',
        'Give it a month and it\'ll be lush again.',
        'I brewed these last night the moment I heard the news.',
        'Take these potions — freshly brewed, just for you.',
        'That\'s my special recipe — double-steeped with silverroot.',
        'They\'ll close wounds faster than anything else you\'ll find.',
        'And feel free to buy more whenever you need.'
      ],
      questDone: [
        'My garden is growing nicely again. Thank you, dear.',
        'The moonbloom came back even stronger after being trampled — imagine that.',
        'Nature\'s resilient, much like you.',
        'I\'ve been teaching young Petra the apprentice your remedy recipe.',
        'Anything else I can get you?'
      ],
      bossNews: [
        'The Revenant Knight, slain! Can you believe it, dearie?',
        'I brewed an extra batch of potions this morning in your honour.',
        'Take one on the house. You\'ve earned far more than that.'
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
    hatColor: '#1a1a2a',
    hatStyle: 'hood',
    dialogs: {
      default: [
        'Blessings upon you, child.',
        'I am Brother Tomas, keeper of the village shrine.',
        'The Light watches over all who dwell in Brannford.',
        'Though I confess, it has felt... distant of late.',
        'They say an old chapel stands in Thornwood.',
        'Built by the first settlers of this valley, over a century ago.',
        'Once holy ground, now... something else lurks there.',
        'The dead do not rest easy in these times.',
        'Pray with me before you venture out, if you are willing.',
        'The Light\'s blessing may yet carry you through.'
      ],
      questNotStarted: [
        'That old chapel in the deep forest troubles me greatly.',
        'I have had visions — dark shapes moving between the broken pews.',
        'Two skeletons walk its ruined halls — souls that cannot find peace.',
        'In life they may have been faithful — guards, perhaps, or clerics.',
        'Now they are bound by some dark compulsion I cannot name.',
        'The Light calls on a brave soul to lay them to rest.',
        'True rest, not destruction — but sometimes the path is the same.',
        'Please, put them to rest. You will be compensated from the church coffers.',
        'And know that what you do there is a mercy, not merely a battle.'
      ],
      questInProgress: [
        'Have the chapel\'s guardians been laid to rest?',
        'I meditate on them each night, trying to reach them through the veil.',
        'There is only silence — and sometimes, something like screaming.',
        'Two skeletons still wander those ruins.',
        'Their souls cry out for release.',
        'I light candles for them here at the shrine.',
        'It is the small kindnesses that matter, even across death.',
        'Return when it is done, and I will pray with you in thanks.'
      ],
      questComplete: [
        'You have given those lost souls peace at last.',
        'I felt it — a lifting, like a weight removed from the air.',
        'The chapel is quiet once more.',
        'Last night I dreamed of it as it once was: candles lit, voices singing.',
        'Perhaps one day we can restore it properly.',
        'Take this gold — a small token from those who pray for Thornwood.',
        'But know the true reward is the peace you brought to those poor souls.',
        'May the Light walk with you always.'
      ],
      questDone: [
        'The chapel rests quietly now.',
        'I sent Brother Alric there yesterday to assess the restoration.',
        'The walls still stand — it is a good sign.',
        'May it remain so. Blessings upon you, hero.',
        'You carry a good soul, traveler. I can see it clearly.',
        'Whatever road lies ahead, you will face it with honor.'
      ],
      bossNews: [
        'News of your victory spreads like dawn breaking after the darkest night.',
        'The Revenant Knight\'s curse is broken. The crypt can finally rest.',
        'You have done something truly holy this day. The Light is with you.'
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
    hatColor: '#c8a84a',
    hatStyle: 'wide',
    legColor: '#3d5a28',
    dialogs: {
      default: [
        'Ho there, stranger.',
        'Don\'t get many travelers through here who look like fighters.',
        'Most folks skirt wide around Thornwood these days.',
        'Can\'t say I blame \'em.',
        'If you be heading to Thornwood, watch yourself.',
        'Wolves hunt in packs, and the bandits...',
        'Well, they be worse than wolves.',
        'At least wolves don\'t take your coin before they bite you.',
        'Stick to the paths if you value your hide.',
        'And keep an eye on the tree line — that\'s where they wait.'
      ],
      questNotStarted: [
        'Hold a moment — if you\'re going out there, I\'ve got a problem you might help with.',
        'Wolves been circling my farm every night this week.',
        'Used to be, wolves stayed deep in the forest. Now they come right up to the fence.',
        'Lost two sheep already to those cursed beasts.',
        'Old Bessy — best wool producer I ever had.',
        'Three of the biggest ones have been spotted near the forest edge.',
        'My boy Tomlin wants to go after them himself.',
        'I told him no — he\'s not ready — but he won\'t listen to me much longer.',
        'Clear them out and I\'ll pay you with everything I can spare.',
        'Throw in a dagger I found in the fields too.',
        'Belonged to some poor soul before me. Sharp as the day it was made.'
      ],
      questInProgress: [
        'Still hearing howling at night...',
        'Tomlin sat up at the window again last night, couldn\'t sleep.',
        'Three wolves — that\'s what I need dealt with.',
        'The big grey one is the pack leader.',
        'You drop it, the others might scatter.',
        'My sheep won\'t last much longer.',
        'Nor my patience.'
      ],
      questComplete: [
        'You slew those wolves? By the deep roots, thank you!',
        'My sheep haven\'t slept so well in weeks!',
        'Nor have I, truth be told.',
        'Tomlin heard the news and went straight out to check on old Rosie.',
        'That\'s his favorite ewe — been worried sick about her.',
        'Here — the gold and that dagger I promised.',
        'You\'ve done this farm a great service.',
        'If you need a place to sleep, the barn\'s warm and the hay\'s fresh.'
      ],
      questDone: [
        'The farm\'s been peaceful since. Much appreciated, friend.',
        'Tomlin started learning to use a bow — says he wants to protect the flock himself.',
        'Maybe I was wrong to hold him back.',
        'Kids grow up whether you like it or not.',
        'You\'re welcome at my hearth any time.',
        'Harvest season\'s coming — we\'ll have good eating if you\'re around.'
      ],
      bossNews: [
        'The wanderer came galloping through the village shouting about you!',
        'Said you walked into Greymoor Crypt and put that Revenant Knight to rest.',
        'Ha! There\'ll be songs about you in every tavern from here to the capital.'
      ]
    }
  }
];

// Forest NPCs — placed in Thornwood
export const FOREST_NPCS: NpcDef[] = [
  {
    id: 'duvain_wanderer',
    name: 'Duvain the Wanderer',
    tileX: 26,
    tileY: 24,
    role: NpcRole.DIALOG,
    questId: 'revenant_threat',
    color: '#7a5a3a',
    dialogs: {
      default: [
        'A wanderer, passing through.',
        'These forests are more dangerous than they look.'
      ],
      questNotStarted: [
        'Halt! Whatever you do, don\'t go into that crypt beyond the arch to the east.',
        'Something ancient has awoken in Greymoor Crypt — a Revenant Knight.',
        'Cursed armour walking on its own, blade swinging without a hand to guide it.',
        'It cut down two of my companions before I managed to flee.',
        'If you\'re brave — or foolish — enough to face it, the gate is just east of here.'
      ],
      questInProgress: [
        'The Revenant Knight is still out there.',
        'It won\'t stay dead by accident — you\'ll need real steel and real courage.',
        'Come back when the deed is done.'
      ],
      questComplete: [
        'You slew the Revenant Knight?! By all the saints — you actually did it!',
        'I must ride straight to Brannford and spread the word.',
        'The folk there will sleep far easier tonight.',
        'Take this for your trouble. You\'ve done something the whole region will remember.'
      ],
      questDone: [
        'I\'ve spread the word throughout Brannford.',
        'They\'re already calling you the Crypt\'s End.',
        'Stay safe out there, friend — though I doubt anything will trouble you now.'
      ]
    }
  }
];

export function getNpc(id: string): NpcDef | undefined {
  return [...VILLAGE_NPCS, ...FOREST_NPCS].find(npc => npc.id === id);
}
