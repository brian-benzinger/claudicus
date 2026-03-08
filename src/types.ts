// Game state machine states
export enum GameState {
  TITLE = 'TITLE',
  OVERWORLD = 'OVERWORLD',
  DIALOG = 'DIALOG',
  SHOP = 'SHOP',
  COMBAT = 'COMBAT',
  COMBAT_VICTORY = 'COMBAT_VICTORY',
  COMBAT_DEFEAT = 'COMBAT_DEFEAT',
  PAUSE = 'PAUSE',
  VICTORY = 'VICTORY',
  INVENTORY = 'INVENTORY'
}

// Tile types for map rendering
export enum TileType {
  GRASS = 0,
  DIRT = 1,
  COBBLESTONE = 2,
  WATER = 3,
  WALL = 4,
  TREE = 5,
  FENCE = 6,
  DARK_GRASS = 7,
  ROCK = 8,
  BUILDING_WALL = 9,
  DOOR = 10,
  ROOF = 11,
  WELL = 12,
  GATE = 13
}

// Weapon speed categories
export enum WeaponSpeed {
  FAST = 'FAST',
  NORMAL = 'NORMAL',
  SLOW = 'SLOW',
  RANGED = 'RANGED'
}

// Enemy type identifiers
export enum EnemyType {
  WOLF = 'WOLF',
  BANDIT = 'BANDIT',
  BANDIT_ARCHER = 'BANDIT_ARCHER',
  SKELETON = 'SKELETON',
  WILD_BOAR = 'WILD_BOAR'
}

// NPC role types
export enum NpcRole {
  DIALOG = 'DIALOG',
  SHOP_WEAPONS = 'SHOP_WEAPONS',
  SHOP_POTIONS = 'SHOP_POTIONS',
  QUEST = 'QUEST'
}

// Combat phases
export enum CombatPhase {
  PLAYER_ACTION = 'PLAYER_ACTION',
  PLAYER_ANIMATING = 'PLAYER_ANIMATING',
  ENEMY_ACTION = 'ENEMY_ACTION',
  ENEMY_ANIMATING = 'ENEMY_ANIMATING',
  RESULT = 'RESULT',
  DONE = 'DONE'
}

// 2D vector for positions
export interface Vec2 {
  x: number;
  y: number;
}

// Weapon definition
export interface Weapon {
  id: string;
  name: string;
  damageBonus: number;
  speed: WeaponSpeed;
  missChance: number;      // 0-1, chance to miss
  critChance: number;      // 0-1, chance for 2x damage
  ignoresDefense: number;  // 0-1, portion of DEF to ignore (mace = 0.5)
  cost: number;
  source: 'shop' | 'chest' | 'start';
}

// Enemy stat definition (template)
export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  atk: number;
  def: number;
  agi: number;
  xp: number;
  gold: number;
}

// Enemy instance on map
export interface EnemyInstance {
  id: string;
  type: EnemyType;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  agi: number;
  xp: number;
  gold: number;
  tileX: number;
  tileY: number;
  alive: boolean;
}

// NPC definition
export interface NpcDef {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  role: NpcRole;
  questId?: string;       // links to a QuestDef; any role can have a quest
  dialogs: {
    default: string[];
    questNotStarted?: string[];
    questInProgress?: string[];
    questComplete?: string[];
    questDone?: string[];
  };
  color: string;  // body color for rendering
}

// Chest loot item
export interface LootItem {
  type: 'potion' | 'gold' | 'weapon' | 'antique_coin';
  amount?: number;
  weaponId?: string;
}

// Chest definition
export interface ChestDef {
  id: string;
  tileX: number;
  tileY: number;
  loot: LootItem[];
}

// Map transition zone
export interface TransitionDef {
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  targetMap: string;
  spawnX: number;
  spawnY: number;
}

// Full map definition
export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: number[][];
  spawnX: number;
  spawnY: number;
  enemies: EnemyInstance[];
  npcs: NpcDef[];
  chests: ChestDef[];
  transitions: TransitionDef[];
}

// Player state
export interface PlayerState {
  hp: number;
  maxHp: number;
  str: number;
  def: number;
  agi: number;
  level: number;
  xp: number;
  gold: number;
  weaponId: string;
  weapons: string[];   // all owned weapon IDs
  potions: number;
  tileX: number;
  tileY: number;
  currentMap: string;
  facing: 'up' | 'down' | 'left' | 'right';
}

// Quest state tracking (generic per-quest progress counter)
export interface QuestState {
  started: boolean;
  count: number;          // progress toward goalCount
  completed: boolean;
  rewardClaimed: boolean;
}

// World persistence state
export interface WorldState {
  openedChests: string[];
  defeatedEnemies: string[];
}

// Full save data structure
export interface SaveData {
  player: PlayerState;
  quests: Record<string, QuestState>;
  world: WorldState;
  version: number;
}

// Combat state
export interface CombatState {
  enemy: EnemyInstance;
  playerHp: number;
  enemyHp: number;
  playerTurn: boolean;
  phase: CombatPhase;
  log: string[];
  defendingThisTurn: boolean;
  nextAttackBonus: number;
  freeHitUsed: boolean;
  enemyDefending: boolean;
  animationFrame: number;
  resultTimer: number;
}

// Shop item for display
export interface ShopItem {
  weaponId?: string;
  name: string;
  cost: number;
  type: 'weapon' | 'potion';
  owned?: boolean;
}

// Dialog state
export interface DialogState {
  npc: NpcDef;
  lines: string[];
  currentLine: number;
  onComplete?: () => void;
}

// Menu cursor state
export interface MenuState {
  items: string[];
  cursor: number;
}

// Animation state for entities
export interface AnimationState {
  frame: number;
  walking: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
}

// Camera viewport
export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Game constants
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;
export const VIEWPORT_TILES_X = 30;
export const VIEWPORT_TILES_Y = 20;
export const MAX_POTIONS = 10;
export const POTION_HEAL = 20;
export const POTION_COST = 5;
export const MAX_LEVEL = 10;
export const SAVE_VERSION = 3;

// Default player state factory
export function createDefaultPlayer(): PlayerState {
  return {
    hp: 40,
    maxHp: 40,
    str: 5,
    def: 3,
    agi: 3,
    level: 1,
    xp: 0,
    gold: 10,
    weaponId: 'rusty_shortsword',
    weapons: ['rusty_shortsword'],
    potions: 3,
    tileX: 5,
    tileY: 5,
    currentMap: 'village',
    facing: 'down'
  };
}

// Single quest state factory
export function createDefaultQuestState(): QuestState {
  return { started: false, count: 0, completed: false, rewardClaimed: false };
}

// Kept for backward compatibility with existing tests
export function createDefaultQuest(): QuestState {
  return createDefaultQuestState();
}

// Default world state factory
export function createDefaultWorld(): WorldState {
  return {
    openedChests: [],
    defeatedEnemies: []
  };
}

// XP needed for next level
export function xpForLevel(level: number): number {
  return level * 25;
}

// Reward granted when reaching a given level
export interface LevelReward {
  level: number;
  label: string;       // short description shown in banner
  bonusHp?: number;    // extra max HP (on top of the base +5)
  bonusStr?: number;   // extra STR (on top of base +2)
  bonusDef?: number;   // extra DEF (on top of base +1)
  bonusAgi?: number;   // extra AGI (on top of base +1)
  bonusGold?: number;
  bonusPotions?: number;
  weaponId?: string;   // unlock a free weapon
}

export const LEVEL_REWARDS: Record<number, LevelReward> = {
  2:  { level: 2,  label: '+2 Potions',         bonusPotions: 2 },
  3:  { level: 3,  label: '+50 Gold',            bonusGold: 50 },
  4:  { level: 4,  label: 'Iron Longsword',      weaponId: 'iron_longsword' },
  5:  { level: 5,  label: '+5 STR, +5 Max HP',   bonusStr: 5, bonusHp: 5 },
  6:  { level: 6,  label: '+100 Gold',            bonusGold: 100 },
  7:  { level: 7,  label: 'Hand Axe',            weaponId: 'hand_axe' },
  8:  { level: 8,  label: '+5 DEF, +10 Max HP',  bonusDef: 5, bonusHp: 10 },
  9:  { level: 9,  label: '+200 Gold',            bonusGold: 200 },
  10: { level: 10, label: 'War Halberd — MAX',   weaponId: 'war_halberd' },
};
