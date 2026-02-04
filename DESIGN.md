# Claudicus - Game Design Document

## Overview

**Claudicus** is a top-down 2D tile-based sprite RPG set in a gritty medieval fantasy world. Inspired by the grounded realism of Kingdom Come: Deliverance, the game blends historical medieval atmosphere with light fantasy elements — bandits, wolves, and the occasional undead menace roaming the countryside.

The game runs entirely in the browser using HTML5 Canvas, built with TypeScript, and requires no server or external dependencies.

## Theme & Setting

**Era:** Late medieval (14th-15th century aesthetic)
**Tone:** Grounded and gritty with light fantasy elements
**Setting:** The rural outskirts of a small feudal kingdom

The player is a peasant-turned-militia member tasked with defending their village from growing threats in the surrounding forest. Bandits have been raiding trade routes, wolves grow bolder, and rumors speak of something worse lurking deeper in the woods.

### Visual Style

All sprites are rendered in code as colored geometric shapes (rectangles, circles, lines). No external image assets required.

- **Village:** Brown/tan buildings, gray stone walls, green grass, dirt paths
- **Forest:** Dense dark green trees, brown dirt trails, gray boulders, dark undergrowth
- **Characters:** Simple humanoid shapes with color-coded clothing/armor
- **Enemies:** Distinct silhouettes — gray wolves, red-brown bandits, pale undead

## Technology

| Component | Choice |
|-----------|--------|
| Language | TypeScript |
| Rendering | HTML5 Canvas 2D |
| Build | Simple bundler (esbuild or none — single file OK for prototype) |
| Save System | localStorage |
| Dependencies | None (vanilla) |
| Target | Modern browsers (Chrome, Firefox, Safari, Edge) |

## Maps

### Phase 1: Two Maps

#### 1. Village — "Brannford"

A small medieval village. The player's home base.

- **Size:** 30x20 tiles (each tile 32x32 pixels)
- **Features:**
  - Player's cottage (spawn point)
  - Blacksmith — weapon shop (buy/upgrade weapons)
  - Village elder's house — quest giver
  - Well — central landmark
  - Market stalls — buy potions
  - Village gate — exit to forest
  - A few peasant NPCs wandering or standing
- **Tile types:** Grass, dirt path, cobblestone, wooden walls, stone walls, water (stream), fences
- **Enemies:** None (safe zone)

#### 2. Forest — "Thornwood"

A dark, dangerous woodland outside the village.

- **Size:** 40x30 tiles
- **Features:**
  - Winding dirt paths through dense trees
  - Bandit camp (cluster of enemies + loot chest)
  - Wolf den area (higher enemy density)
  - Abandoned chapel (optional mini-dungeon area with undead)
  - Herb patches (potion pickups)
  - Hidden treasure chests
  - Path back to village
- **Tile types:** Grass, dense trees (impassable), dirt path, rocks, bushes, dark grass
- **Enemies:** Wolves, bandits, skeletons (near chapel)

### Future Phase: Dungeon Map

A third map (stone dungeon/crypt) will be added later with a boss encounter.

## Player Character

### Base Stats

| Stat | Starting Value | Description |
|------|---------------|-------------|
| HP | 40 | Health points — 0 means death |
| Max HP | 40 | Maximum health |
| STR | 5 | Base strength, affects melee damage |
| DEF | 3 | Damage reduction |
| AGI | 3 | Affects dodge chance and turn order |
| LVL | 1 | Current level |
| XP | 0 | Experience points |
| Gold | 10 | Currency for shops |

### Leveling

- **XP to next level:** `LVL * 25`
- **Max level:** 10
- **On level up:**
  - HP + 5, Max HP + 5
  - STR + 2
  - DEF + 1
  - AGI + 1
  - Full HP restore
  - Brief level-up notification on screen

### Inventory

- **Weapon slot:** 1 equipped weapon
- **Potions:** Stackable, max carry 10
- **Gold:** No cap

## Weapons

Weapons define the player's primary attack in combat. Each has distinct trade-offs fitting the medieval setting.

### Weapon Types

| Weapon | Damage | Speed | Special | Cost | Where Found |
|--------|--------|-------|---------|------|-------------|
| Rusty Shortsword | STR + 2 | Normal | None (starter weapon) | — | Start |
| Iron Longsword | STR + 4 | Normal | Balanced, no special effect | 30g | Blacksmith |
| Mace | STR + 5 | Slow | Ignores 50% of enemy DEF | 40g | Blacksmith |
| Hand Axe | STR + 6 | Normal | 20% chance to miss | 35g | Blacksmith |
| Dagger | STR + 1 | Fast | Always strikes first; 30% crit chance (2x damage) | 20g | Blacksmith |
| Hunting Bow | STR + 3 | Ranged | Free first strike before combat starts | 25g | Blacksmith |
| Halberd | STR + 7 | Slow | 15% chance to miss; highest raw damage | 50g | Chest (forest) |

### Weapon Properties

- **Speed:**
  - **Fast** — Player always goes first in combat
  - **Normal** — Turn order based on AGI comparison
  - **Slow** — Player goes second unless AGI is much higher (AGI > enemy AGI + 3)
  - **Ranged** — One free attack before combat begins, then normal turn order

## Combat System

### Encounter Trigger

Enemies are visible on the overworld. Walking into an enemy sprite triggers turn-based combat. No random encounters.

### Combat Screen

The canvas switches to a combat view:
- Left side: Player sprite and stats (HP bar, weapon icon)
- Right side: Enemy sprite and HP bar
- Bottom: Action menu

### Turn Order

1. Check weapon speed property
2. If both Normal speed, compare AGI: higher AGI goes first (ties favor player)
3. Ranged weapons get a free opening attack, then use AGI

### Actions (Player Turn)

| Action | Effect |
|--------|--------|
| **Attack** | Deal weapon damage to enemy |
| **Defend** | Take 50% damage until next turn; +1 to next attack |
| **Use Potion** | Restore 20 HP (capped at Max HP); consumes 1 potion |
| **Flee** | 50% chance to escape (AGI > enemy AGI = 70% chance). Failure wastes the turn. |

### Damage Formula

```
base_damage = weapon_damage_value  (already includes STR)
modified_damage = base_damage - enemy_DEF
  (Mace: modified_damage = base_damage - enemy_DEF * 0.5)
random_variance = random(-1, +2)
final_damage = max(1, modified_damage + random_variance)

If critical hit (dagger): final_damage *= 2
If defending: incoming_damage *= 0.5 (rounded down, min 1)
```

### Enemy AI

Simple behavior per turn:
1. If enemy HP < 25%: 30% chance to use a "desperate attack" (1.5x damage, 0 defense that turn)
2. Otherwise: 80% Attack, 20% Defend

### Combat Rewards

On victory:
- Gain XP (enemy's XP reward value)
- Chance to drop Gold (50% chance, amount = enemy's gold value)
- Enemy is removed from the map permanently (until map reset/revisit)

### Death

On player HP reaching 0:
- "You have fallen" screen
- Option: "Return to Brannford" — respawn at village with full HP but lose 10% gold (min 0)
- All stats/XP/items preserved
- Enemies in the forest respawn

## Enemies

### Enemy Types

| Enemy | HP | ATK | DEF | AGI | XP | Gold | Location |
|-------|-----|-----|-----|-----|----|------|----------|
| Wolf | 12 | 5 | 1 | 5 | 8 | 3 | Forest (common) |
| Bandit | 18 | 6 | 3 | 3 | 12 | 10 | Forest — bandit camp |
| Bandit Archer | 14 | 7 | 2 | 4 | 14 | 8 | Forest — bandit camp |
| Skeleton | 20 | 5 | 4 | 2 | 15 | 5 | Forest — chapel |
| Wild Boar | 15 | 7 | 2 | 2 | 10 | 0 | Forest (uncommon) |

### Future Boss (Dungeon Phase)

| Enemy | HP | ATK | DEF | AGI | XP | Gold |
|-------|-----|-----|-----|-----|----|------|
| The Revenant Knight | 60 | 10 | 6 | 4 | 80 | 50 |

## NPCs

### Village NPCs

| NPC | Location | Role |
|-----|----------|------|
| Elder Aldric | Elder's house | Quest giver — main quest dialog |
| Gretta the Smith | Blacksmith | Weapon shop |
| Old Marta | Market stall | Sells potions (5g each) |
| Brother Tomas | Near the well | Lore/hint dialog |
| Farmer Wulf | Edge of village | Flavor dialog, warns about the forest |

### Dialog System

- Interact with NPC via spacebar/enter when adjacent
- Dialog appears in a box at the bottom of the screen
- Simple sequential text — press space to advance
- Shop NPCs open a buy menu after greeting dialog

### Quest

**Phase 1 Main Quest:** "The Forest Menace"
1. Talk to Elder Aldric: "Bandits and beasts terrorize the road to Thornwood. We need someone brave — or foolish — enough to clear them out."
2. Objective: Defeat 5 enemies in the forest
3. Return to Elder Aldric for reward: 50 gold + Iron Longsword (if not already owned)
4. Quest state tracked in save data

## Items

| Item | Effect | Cost | Source |
|------|--------|------|--------|
| Health Potion | Restore 20 HP | 5g | Marta's stall, forest chests |
| Antique Coin | Sell for 15g at market | — | Hidden chest in forest |

### Chests

- Chests are interactable objects on the map
- Each chest has a fixed loot table
- Once opened, stays open (saved to state)
- Visual: closed chest vs open chest sprite (drawn in code)

## Save System

### localStorage Keys

- `claudicus_save` — JSON blob of full game state

### Saved Data

```typescript
interface SaveData {
  player: {
    hp: number;
    maxHp: number;
    str: number;
    def: number;
    agi: number;
    level: number;
    xp: number;
    gold: number;
    weapon: string;
    potions: number;
    position: { x: number; y: number };
    currentMap: string;
  };
  quest: {
    started: boolean;
    enemiesDefeated: number;
    completed: boolean;
  };
  world: {
    openedChests: string[];       // chest IDs
    defeatedEnemies: string[];    // enemy IDs (for current session)
  };
}
```

### Save/Load

- **Auto-save** on map transitions and after combat
- **Manual save** from pause menu (Escape key)
- **Load** on game start if save exists, otherwise new game
- "New Game" option clears save data

## Controls

| Key | Context | Action |
|-----|---------|--------|
| W / ArrowUp | Overworld | Move up |
| S / ArrowDown | Overworld | Move down |
| A / ArrowLeft | Overworld | Move left |
| D / ArrowRight | Overworld | Move right |
| Space / Enter | Overworld | Interact with NPC/chest |
| Space / Enter | Dialog | Advance text |
| 1 | Combat | Attack |
| 2 | Combat | Defend |
| 3 | Combat | Use Potion |
| 4 | Combat | Flee |
| Escape | Any | Pause menu (save/quit) |

## Rendering

### Canvas Setup

- **Resolution:** 960x640 pixels (30x20 tiles at 32px)
- **Scaling:** CSS scales canvas to fit viewport while preserving aspect ratio
- **Frame rate:** 60fps via `requestAnimationFrame`

### Render Layers (bottom to top)

1. **Ground tiles** — grass, dirt, cobblestone, water
2. **Objects** — trees, rocks, fences, buildings, chests
3. **Entities** — NPCs, enemies, player
4. **UI Overlay** — HUD (HP bar, gold, weapon icon), dialog boxes, menus

### Placeholder Sprite Definitions

All sprites drawn with canvas primitives (fillRect, arc, lines).

**Player:**
- Body: 20x24 dark brown rectangle (leather armor)
- Head: 12x12 peach/tan circle
- Weapon indicator: small colored shape at side

**Wolf:**
- Body: 24x16 gray rectangle
- Head: 10x10 gray triangle (snout)
- Eyes: 2 small red dots

**Bandit:**
- Body: 20x24 dark red rectangle
- Head: 12x12 tan circle
- Hood: dark triangle on head

**Skeleton:**
- Body: 18x24 white/bone rectangle
- Head: 12x12 white circle
- Eyes: 2 black dots

**Buildings:**
- Rectangle with darker rectangle (door)
- Triangle on top (roof) in brown/red
- Small yellow squares (windows)

**Trees:**
- Brown rectangle trunk (6x12)
- Green circle canopy (20x20)
- Dark green variants for dense forest

**Chests:**
- Small brown rectangle (12x10)
- Darker brown line across middle (clasp)
- Open: same but with lid rectangle angled up

### Animation

- **Walking:** 2-frame cycle — sprite shifts 1-2px vertically to simulate bobbing
- **Combat attack:** Sprite slides toward enemy and back (simple tween)
- **Damage taken:** Sprite flashes red for 3 frames
- **Level up:** Brief golden glow effect (expanding yellow circle)

## Project Structure

```
Claudicus/
├── index.html              # Entry point, canvas element
├── style.css               # Canvas centering, background, fonts
├── tsconfig.json           # TypeScript config
├── src/
│   ├── main.ts             # Game init, main loop, state machine
│   ├── types.ts            # Shared TypeScript interfaces/types
│   ├── input.ts            # Keyboard input manager
│   ├── player.ts           # Player state, movement, leveling
│   ├── combat.ts           # Turn-based combat engine
│   ├── map.ts              # Map data, tile rendering, collision
│   ├── camera.ts           # Viewport/camera following player
│   ├── npc.ts              # NPC definitions, dialog system
│   ├── enemies.ts          # Enemy types, spawning, AI
│   ├── items.ts            # Weapons, potions, chests
│   ├── ui.ts               # HUD, menus, dialog rendering
│   ├── renderer.ts         # Sprite drawing functions (all code-drawn)
│   ├── save.ts             # localStorage save/load
│   └── data/
│       ├── maps.ts         # Map tile arrays
│       ├── weapons.ts      # Weapon definitions
│       ├── enemies.ts      # Enemy stat tables
│       ├── npcs.ts         # NPC data and dialogs
│       └── quests.ts       # Quest definitions
└── README.md
```

## Game States

The main loop is driven by a state machine:

```
TITLE_SCREEN → NEW_GAME / LOAD_GAME
  → OVERWORLD (exploration)
    → DIALOG (NPC interaction)
    → SHOP (buy weapons/potions)
    → COMBAT (enemy encounter)
      → COMBAT_VICTORY → OVERWORLD
      → COMBAT_DEFEAT → RESPAWN → OVERWORLD
    → MAP_TRANSITION → OVERWORLD (new map)
  → PAUSE_MENU
    → SAVE
    → QUIT → TITLE_SCREEN
  → VICTORY_SCREEN (quest complete)
```
