import { MapDef, TileType, EnemyType, NpcRole } from '../types';
import { createEnemy, resetEnemyIdCounter } from './enemies';
import { VILLAGE_NPCS } from './npcs';

// Tile type shortcuts for readability
const G = TileType.GRASS;
const D = TileType.DIRT;
const C = TileType.COBBLESTONE;
const W = TileType.WATER;
const L = TileType.WALL;
const T = TileType.TREE;
const F = TileType.FENCE;
const K = TileType.DARK_GRASS;
const R = TileType.ROCK;
const B = TileType.BUILDING_WALL;
const O = TileType.DOOR;
const E = TileType.WELL;
const A = TileType.GATE;

// Village "Brannford" - 30x20 tiles
// Features: Player cottage, Elder's house, Blacksmith, Market, Well, Gate to forest
const VILLAGE_TILES: number[][] = [
  //0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T], // 1
  [T,G,B,B,B,B,G,G,B,B,B,B,G,G,G,G,G,G,G,B,B,B,B,B,G,G,G,G,G,T], // 2
  [T,G,B,G,G,B,G,G,B,G,G,B,G,G,G,G,G,G,G,B,G,G,G,B,G,G,G,G,G,T], // 3
  [T,G,B,G,G,B,G,G,O,G,G,B,G,G,G,G,G,G,G,B,G,G,G,B,G,G,G,G,G,T], // 4
  [T,G,B,B,O,B,G,G,B,B,B,B,G,G,G,G,G,G,G,B,B,O,B,B,G,G,G,G,G,T], // 5
  [T,G,G,G,D,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 6
  [T,G,G,G,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,G,G,G,G,G,G,G,T], // 7
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,E,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 8
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 9
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 10
  [T,G,G,F,F,F,F,F,G,G,G,G,G,G,G,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 11
  [T,G,G,F,G,G,G,F,G,G,G,G,F,F,F,F,F,G,G,G,G,D,G,G,G,G,G,G,G,T], // 12
  [T,G,G,F,G,G,G,F,G,G,G,G,F,G,G,G,F,G,G,G,G,D,G,G,G,G,G,G,G,T], // 13
  [T,G,G,F,F,F,F,F,G,G,G,G,F,F,F,F,F,G,G,G,G,D,G,G,G,G,G,G,G,T], // 14
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,G,G,G,G,G,G,G,T], // 15
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,D,D,D,D,D,D,D,T], // 16
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,A,T], // 17
  [T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,D,T], // 18
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 19
];

// Forest "Thornwood" - 40x30 tiles
// Features: Winding paths, bandit camp, wolf den, abandoned chapel, chests
const FOREST_TILES: number[][] = [
  //0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,D,D,D,A,D,D,D,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 1
  [T,D,K,K,D,K,K,D,D,D,D,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 2
  [T,D,K,K,D,K,K,K,K,K,D,D,D,T,T,T,T,T,K,K,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 3
  [T,T,K,K,D,K,K,K,K,K,K,K,D,D,D,D,D,D,D,K,K,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 4
  [T,T,T,K,D,D,D,D,D,K,K,K,K,K,K,K,K,K,D,K,K,K,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 5
  [T,T,T,K,K,K,K,K,D,K,K,K,K,K,K,K,K,K,D,D,D,D,K,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T,T,T], // 6
  [T,T,T,T,K,K,K,K,D,D,D,D,D,D,K,K,K,K,K,K,K,D,K,K,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T,T], // 7
  [T,T,T,T,T,K,K,K,K,K,K,K,K,D,K,K,K,K,K,K,K,D,D,D,D,K,K,K,K,T,T,T,T,T,T,T,T,T,T,T], // 8
  [T,T,T,T,T,T,K,K,K,K,K,K,K,D,D,D,D,D,K,K,K,K,K,K,D,K,K,K,K,K,T,T,T,T,T,R,R,T,T,T], // 9
  [T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,K,K,D,K,K,K,K,K,K,D,D,D,K,K,K,K,T,T,T,R,K,K,R,T,T], // 10
  [T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,K,D,D,D,D,D,D,D,D,K,D,D,D,K,K,K,T,T,R,K,K,R,T,T], // 11
  [T,T,T,T,T,T,T,T,T,K,K,K,R,R,K,K,K,K,K,K,K,K,K,K,K,K,D,K,D,K,K,K,K,T,T,K,K,T,T,T], // 12
  [T,T,T,T,T,T,T,T,T,T,K,K,R,K,K,K,K,K,K,K,K,K,K,K,K,K,D,K,D,D,D,K,K,K,K,K,K,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,T,T,T,T,K,K,K,K,D,D,K,K,K,D,K,K,K,K,K,K,K,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,T,T,K,K,T,T,K,K,K,D,K,K,K,K,D,D,D,D,D,D,K,K,K,T], // 15
  [T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,T,K,K,K,K,T,T,K,K,D,K,K,K,K,K,K,K,K,K,D,K,K,K,T], // 16
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,T,T,D,D,K,K,K,K,K,K,K,K,K,D,D,K,K,T], // 17
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,K,D,K,K,K,T,T,T,T,K,K,K,K,D,K,K,T], // 18
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,D,K,K,T,T,L,L,T,T,K,K,K,D,K,T,T], // 19
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,D,D,D,T,L,K,K,L,T,T,K,K,D,T,T,T], // 20
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,D,T,L,K,K,L,T,T,K,D,D,T,T,T], // 21
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,D,D,L,L,L,L,T,K,K,D,T,T,T,T], // 22
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,D,D,D,D,T,T,K,D,D,T,T,T,T], // 23
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,K,D,T,K,K,D,T,T,T,T,T], // 24
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,D,D,D,D,D,T,T,T,T,T], // 25
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,K,K,K,T,T,T,T,T,T], // 26
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,K,K,K,K,T,T,T,T,T,T,T], // 27
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,K,K,K,K,T,T,T,T,T,T,T,T], // 28
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 29
];

export function createVillageMap(): MapDef {
  resetEnemyIdCounter();

  return {
    id: 'village',
    name: 'Brannford',
    width: 30,
    height: 20,
    tiles: VILLAGE_TILES,
    spawnX: 5,
    spawnY: 6,
    enemies: [], // Village is safe
    npcs: [...VILLAGE_NPCS],
    chests: [],
    transitions: [
      {
        tileX: 28,
        tileY: 17,
        width: 1,
        height: 1,
        targetMap: 'forest',
        spawnX: 4,
        spawnY: 2
      }
    ]
  };
}

export function createForestMap(): MapDef {
  resetEnemyIdCounter();

  return {
    id: 'forest',
    name: 'Thornwood',
    width: 40,
    height: 30,
    tiles: FOREST_TILES,
    spawnX: 4,
    spawnY: 2,
    enemies: [
      // Wolves near the entrance path
      createEnemy(EnemyType.WOLF, 8, 5),
      createEnemy(EnemyType.WOLF, 12, 8),
      createEnemy(EnemyType.WOLF, 7, 10),

      // Wolf den area (upper right area)
      createEnemy(EnemyType.WOLF, 25, 6),
      createEnemy(EnemyType.WOLF, 27, 8),

      // Bandit camp (middle-right area)
      createEnemy(EnemyType.BANDIT, 32, 14),
      createEnemy(EnemyType.BANDIT, 34, 15),
      createEnemy(EnemyType.BANDIT_ARCHER, 33, 16),

      // Wild boar (scattered)
      createEnemy(EnemyType.WILD_BOAR, 18, 12),
      createEnemy(EnemyType.WILD_BOAR, 22, 18),

      // Skeletons near chapel (bottom right, near the walls)
      createEnemy(EnemyType.SKELETON, 30, 20),
      createEnemy(EnemyType.SKELETON, 27, 22),
    ],
    npcs: [],
    chests: [
      {
        id: 'forest_chest_1',
        tileX: 35,
        tileY: 10,
        loot: [
          { type: 'potion', amount: 2 },
          { type: 'gold', amount: 15 }
        ]
      },
      {
        id: 'forest_chest_2',
        tileX: 36,
        tileY: 16,
        loot: [
          { type: 'gold', amount: 25 }
        ]
      },
      {
        id: 'forest_chest_halberd',
        tileX: 30,
        tileY: 23,
        loot: [
          { type: 'weapon', weaponId: 'halberd' }
        ]
      },
      {
        id: 'forest_chest_antique',
        tileX: 36,
        tileY: 11,
        loot: [
          { type: 'antique_coin' }
        ]
      }
    ],
    transitions: [
      {
        tileX: 4,
        tileY: 1,
        width: 1,
        height: 1,
        targetMap: 'village',
        spawnX: 27,
        spawnY: 17
      }
    ]
  };
}

export function getMap(id: string): MapDef {
  if (id === 'village') {
    return createVillageMap();
  } else if (id === 'forest') {
    return createForestMap();
  }
  return createVillageMap();
}
