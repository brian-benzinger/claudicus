# Claudicus

A top-down 2D tile-based sprite RPG set in a gritty medieval fantasy world. Built with vanilla **TypeScript** and the **HTML5 Canvas** — every sprite, tile, and note of music is generated in code, so the game runs entirely in the browser with no image, audio, or runtime dependencies.

You play a peasant-turned-militia member defending the village of **Brannford** from the bandits, beasts, and undead stirring in **Thornwood** forest and the depths of **Greymoor Crypt**.

**▶ Play it live: [claudicus.vercel.app](https://claudicus.vercel.app)**

---

## Quick Start

```bash
npm install        # install dev tooling (esbuild, vitest, jsdom)
npm run dev        # bundle + watch to dist/game.js, then open index.html
npm run build      # minified production bundle
npm test           # run the unit test suite
npm run test:coverage   # run with coverage report + thresholds
```

Open `index.html` in a browser after running `dev` or `build`. There is no server — `localStorage` holds your save.

---

## Gameplay

### Game flow

```
TITLE → CHARACTER_SELECT (gender) → OVERWORLD
  OVERWORLD ⇄ DIALOG ⇄ SHOP / CRAFT
  OVERWORLD → COMBAT → VICTORY → OVERWORLD
                     → DEFEAT  → respawn at Brannford
  OVERWORLD ⇄ INVENTORY · QUEST_LOG · PAUSE
  Level 3 reached → CLASS_SELECT (one-time)
  Revenant Knight slain → VICTORY (endgame)
```

The game is driven by a state machine in `src/main.ts`. New games start at the title screen; existing saves load automatically.

### Controls

| Key | Context | Action |
|-----|---------|--------|
| `W` `A` `S` `D` / Arrows | Overworld | Move |
| `W` `A` `S` `D` / Arrows | Menus | Move cursor |
| `Space` / `Enter` | Overworld | Interact with NPC or chest |
| `Space` / `Enter` | Dialog / Menu | Advance / confirm |
| `1` `2` `3` `4` | Combat | Attack · Defend · Potion · Flee |
| `5` | Combat | Use special ability (when available) |
| `I` | Overworld | Open inventory |
| `Q` | Overworld | Open quest log |
| `M` | Any | Toggle music/SFX mute |
| `Escape` | Any | Pause menu (save / quit) |

---

## The World

Three hand-built maps, each with its own code-synthesized music track.

| Map | Name | Size | Music | Contents |
|-----|------|------|-------|----------|
| `village` | **Brannford** | 30×20 | G-major folk | Safe hub: shops, quest-givers, the forge, village gate |
| `forest` | **Thornwood** | 40×30 | A-minor tension | Wolves, bandits, boars, chapel skeletons, chests, crypt entrance |
| `dungeon` | **Greymoor Crypt** | 30×20 | D-minor dread | The Revenant Knight boss and its treasure |

Camera follows the player smoothly and clamps to map bounds. Defeated enemies and opened chests persist in the save; dying clears defeated-enemy state so the wilds repopulate.

---

## Player Character

Choose your character's **gender** at the start (purely cosmetic). Base stats:

| HP | STR | DEF | AGI | Level | Gold | Potions |
|----|-----|-----|-----|-------|------|---------|
| 40 | 5 | 3 | 3 | 1 | 10 | 3 |

You begin with a **Rusty Shortsword** and a **Leather Vest**.

### Leveling

- XP to next level: `level × 25`; max level **10**.
- Every level: **+5 Max HP, +2 STR, +1 DEF, +1 AGI**, and a full heal.
- Milestone **level rewards** stack on top of the base gains:

| Lvl | Reward | Lvl | Reward |
|-----|--------|-----|--------|
| 2 | +2 Potions | 7 | Hand Axe |
| 3 | +50 Gold | 8 | +5 DEF, +10 Max HP |
| 4 | Iron Longsword | 9 | +200 Gold |
| 5 | +5 STR, +5 Max HP | 10 | War Halberd |
| 6 | +100 Gold | | |

### Class Paths (chosen at level 3, permanent)

| Class | Stat bonus | Combat ability |
|-------|-----------|----------------|
| **Warrior** | +2 DEF | **Shield Bash** — stun the enemy (harder to flee) |
| **Scout** | +2 AGI | **Ambush** — one guaranteed crit per fight (easier to flee) |
| **Brigand** | +2 STR | **Intimidate** — weaken enemy ATK by 3 for 3 turns |

---

## Equipment

### Weapons

| Weapon | DMG (+STR) | Speed | Special | Source |
|--------|-----------|-------|---------|--------|
| Rusty Shortsword | +2 | Normal | starter | start |
| Dagger | +1 | Fast | 30% crit; always strikes first | shop / quest |
| Iron Longsword | +4 | Normal | balanced | shop / craft / reward |
| Hunting Bow | +3 | Ranged | free opening shot | shop |
| Hand Axe | +6 | Normal | 20% miss | shop / reward |
| Mace | +5 | Slow | ignores 50% DEF | shop |
| Halberd | +7 | Slow | 15% miss; high raw damage | forest chest |
| War Axe | +8 | Slow | 10% miss, 10% crit, ignores 20% DEF | crafted |
| War Halberd | +9 | Slow | 10% miss; max-level reward | level 10 |

**Speed** decides turn order: Fast → you always go first; Slow → enemy first unless your AGI ≥ theirs + 4; Ranged → free opening shot, then AGI; Normal → AGI comparison (ties favor you).

### Armor (body slot, adds flat DEF)

| Armor | DEF | Source |
|-------|-----|--------|
| Leather Vest | +1 | start |
| Shadow Cloak | +2 | forest chest |
| Studded Leather | +2 | crafted (3 Wolf Pelts) |
| Chain Mail | +3 | shop |
| Iron Plate | +5 | shop |

### Crafting (Gretta's Forge)

Materials drop from kills. Recipes:

- **3× Wolf Pelt** → Studded Leather
- **2× Bandit Steel** → Iron Longsword
- **2× Bandit Steel + 1× Wolf Pelt** → War Axe

---

## Combat

Turn-based, triggered by walking into a visible enemy. Each turn you can **Attack**, **Defend** (halve incoming damage, +1 to your next hit), use a **Potion** (+20 HP), **Flee**, or unleash a **special ability** with `5`.

**Damage:** `max(1, attackPower − effectiveDEF + variance(−1…+2))`, doubled on a crit. Defending halves incoming damage; the Mace and other "ignores DEF" weapons reduce the defender's effective DEF.

### Weapon abilities (unlock at level 3)

| Weapon | Ability |
|--------|---------|
| Dagger | **Backstab** — double crit chance; bonus flavor if the enemy just defended |
| Hunting Bow | **Pin** — stun the enemy for 1 turn |
| Mace | **Shatter** — permanently shave 2 off enemy DEF |

### Status effects

- **Bleed** — 2 damage per turn (Revenant's phase-2 strikes)
- **Stun** — skip a turn (Pin, Shield Bash)
- **Weaken** — reduced ATK (Intimidate)

### Enemies

| Enemy | HP | ATK | DEF | AGI | XP | Gold | Behavior |
|-------|----|----|----|----|----|----|----------|
| Wolf | 12 | 5 | 1 | 5 | 8 | 3 | 30% chance to howl (−2 to your next hit) |
| Bandit | 18 | 6 | 3 | 3 | 12 | 10 | desperate attack when low |
| Bandit Archer | 14 | 7 | 2 | 4 | 14 | 8 | alternates piercing arrows and knife |
| Skeleton | 20 | 5 | 4 | 2 | 15 | 5 | heals every 3rd turn; shield of bones |
| Wild Boar | 15 | 7 | 2 | 2 | 10 | 0 | charges 90% of the time |
| **Revenant Knight** | 60 | 10 | 6 | 4 | 80 | 50 | **Boss** — enrages below 50% HP, inflicts bleed |

On victory: gain XP, a 50% gold drop, and possibly crafting materials. The enemy is removed from the map. On defeat: respawn in Brannford at full HP, losing 10% of your gold.

---

## Quests

Six quests, each from a different NPC, tracked in the **quest log** (`Q`) and the save file:

| Quest | Giver | Goal | Reward |
|-------|-------|------|--------|
| The Forest Menace | Elder Aldric | Defeat any 5 enemies | 50 g + Iron Longsword |
| Bandit Steel | Gretta the Smith | 3 bandits | 30 g + Hand Axe |
| The Boar Problem | Old Marta | 2 wild boars | 25 g + 3 Potions |
| Silence the Unquiet Dead | Brother Tomas | 2 skeletons | 40 g |
| Wolves at the Gate | Farmer Wulf | 3 wolves | 20 g + Dagger |
| The Revenant Threat | Duvain the Wanderer | slay the boss | 30 g + 2 Potions |

NPC dialog is quest-aware (not started / in progress / ready to claim / done), and the whole village reacts once the Revenant Knight has been slain.

## Titles

Cosmetic achievements earned through play and displayable next to your name:

- **Wolfsbane** — 5 wolves slain
- **Bandit Hunter** — 5 bandits slain
- **Grave Robber** — 3 chests opened
- **Survivor** — survive 3 fights at ≤5 HP

---

## Tech & Architecture

- **TypeScript**, no frameworks; bundled with **esbuild**.
- **HTML5 Canvas 2D** at 960×640, 60 fps via `requestAnimationFrame`. All sprites are drawn from canvas primitives (`renderer.ts`).
- **Web Audio API** synthesizer (`music.ts`) — four chiptune tracks plus level-up / quest / death / chest SFX, all from oscillators.
- **localStorage** save system (`save.ts`) with versioned saves and forward migrations (currently v6).

### Project structure

```
src/
├── main.ts        # game init, main loop, state machine
├── types.ts       # shared types, enums, constants, factories
├── input.ts       # keyboard manager (held vs. just-pressed)
├── player.ts      # stats, movement, leveling, classes, equipment
├── combat.ts      # turn-based engine, enemy AI, abilities, status effects
├── map.ts         # map loading, collision, camera, rendering
├── npc.ts         # dialog, shops, quest rewards
├── items.ts       # chest loot resolution
├── renderer.ts    # all code-drawn sprites
├── ui.ts          # HUD, menus, dialog, screens
├── music.ts       # Web Audio synth (music + SFX)
├── save.ts        # localStorage save/load/migrate
└── data/
    ├── maps.ts      # tile arrays + entity placement
    ├── weapons.ts   # weapon table
    ├── armors.ts    # armor table
    ├── enemies.ts   # enemy stat templates
    ├── npcs.ts      # NPC definitions + dialog
    ├── quests.ts    # quest definitions
    └── recipes.ts   # crafting recipes
```

See [DESIGN.md](DESIGN.md) for the original design document.

---

## Testing & Coverage

The suite runs on **Vitest** with the **jsdom** environment and **v8** coverage.

```bash
npm test                # run all tests once
npm run test:watch      # watch mode
npm run test:coverage   # report + enforce thresholds
```

Coverage is **enforced**: the build fails if it drops below **95% lines / 90% branches**. Pure-rendering and layout modules (`main.ts`, `renderer.ts`, `ui.ts`, `data/maps.ts`, `data/npcs.ts`) are excluded from the metric since they are exercised only through the canvas; everything else — game logic, combat, progression, persistence, audio scheduling — is covered by unit tests.
</content>
</invoke>

---

## License

Released under the [MIT License](LICENSE) — © 2026 Brian Benzinger.
