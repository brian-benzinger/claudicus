import { describe, it, expect, beforeEach } from 'vitest';
import { MapManager } from '../map';
import { createDefaultWorld, TileType, TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { resetEnemyIdCounter } from '../data/enemies';

function makeMapManager() {
  const world = createDefaultWorld();
  const mgr = new MapManager(world);
  mgr.loadMap('village');
  return mgr;
}

beforeEach(() => {
  resetEnemyIdCounter();
});

describe('MapManager.loadMap', () => {
  it('loads the village map', () => {
    const mgr = makeMapManager();
    expect(mgr.currentMap.id).toBe('village');
    expect(mgr.currentMap.width).toBe(30);
    expect(mgr.currentMap.height).toBe(20);
  });

  it('filters out defeated enemies from world state', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const firstEnemy = mgr.currentMap.enemies[0];
    expect(firstEnemy).toBeDefined();
    world.defeatedEnemies.push(firstEnemy.id);
    mgr.loadMap('forest');
    expect(mgr.currentMap.enemies.find(e => e.id === firstEnemy.id)).toBeUndefined();
  });
});

describe('MapManager.isWalkable', () => {
  it('returns false for out-of-bounds tiles', () => {
    const mgr = makeMapManager();
    // Both axes out of bounds
    expect(mgr.isWalkable(-1, -1)).toBe(false);
    expect(mgr.isWalkable(9999, 9999)).toBe(false);
    // Single-axis out of bounds — pins that each axis is checked independently
    // (OR not AND). If the guard were `tileX < 0 && tileY < 0`, these would
    // silently return true and allow movement off the map edge.
    expect(mgr.isWalkable(-1, 0)).toBe(false);                          // only x negative
    expect(mgr.isWalkable(0, -1)).toBe(false);                          // only y negative
    const { width, height } = mgr.currentMap;
    expect(mgr.isWalkable(width, 0)).toBe(false);                       // x === width (≥)
    expect(mgr.isWalkable(0, height)).toBe(false);                      // y === height (≥)
  });

  it('returns false for WALL tiles', () => {
    // Forest map has TileType.WALL tiles; village does not.
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const map = mgr.currentMap;
    let wallFound = false;
    for (let y = 0; y < map.height && !wallFound; y++) {
      for (let x = 0; x < map.width && !wallFound; x++) {
        if (map.tiles[y][x] === TileType.WALL) {
          expect(mgr.isWalkable(x, y)).toBe(false);
          wallFound = true;
        }
      }
    }
    expect(wallFound).toBe(true); // guard: ensure a WALL tile was actually tested
  });

  it('returns true for GRASS tiles', () => {
    const mgr = makeMapManager();
    const map = mgr.currentMap;
    let grassFound = false;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.GRASS) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          grassFound = true;
          break;
        }
      }
      if (grassFound) break;
    }
    expect(grassFound).toBe(true); // guard: ensure a GRASS tile was actually tested
  });

  it('returns true for DIRT tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.DIRT) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: DIRT tile must exist in the forest map
  });

  it('returns true for COBBLESTONE tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon'); // dungeon has cobblestone floor tiles
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.COBBLESTONE) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: COBBLESTONE tile must exist in the dungeon map
  });

  it('returns true for DARK_GRASS tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.DARK_GRASS) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: DARK_GRASS tile must exist in the forest map
  });

  it('returns true for DOOR tiles', () => {
    const mgr = makeMapManager(); // village map has door tiles
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.DOOR) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: DOOR tile must exist in the village map
  });

  it('returns false for WATER tiles', () => {
    // WATER is not in any map but must never become walkable.
    // Inject it directly to pin the design intent.
    const mgr = makeMapManager();
    mgr.currentMap.tiles[1][1] = TileType.WATER;
    expect(mgr.isWalkable(1, 1)).toBe(false);
  });

  it('returns true for GATE tiles (player can exit through the village gate)', () => {
    // GATE is the tile under the village exit — removing it from the walkable list
    // would trap the player and make the map uncompletable.
    const mgr = makeMapManager(); // village map
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.GATE) {
          expect(
            mgr.isWalkable(x, y),
            `GATE tile at (${x}, ${y}) must be walkable`
          ).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: GATE tile must exist in the village map
  });

  it('returns true for BED tiles (player can walk onto a bed to save)', () => {
    // BED is walkable so the player can step onto it to trigger a rest/save.
    // If it were removed from the walkable list the save-at-bed feature would break silently.
    const mgr = makeMapManager(); // village map
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.BED) {
          expect(
            mgr.isWalkable(x, y),
            `BED tile at (${x}, ${y}) must be walkable`
          ).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: BED tile must exist in the village map
  });

  it('returns false for FENCE tiles (fences must block player movement)', () => {
    // FENCE is an impassable barrier in the village. If it accidentally became
    // walkable the player could pass through village fences and break map layout.
    const mgr = makeMapManager(); // village map
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.FENCE) {
          expect(
            mgr.isWalkable(x, y),
            `FENCE tile at (${x}, ${y}) must NOT be walkable`
          ).toBe(false);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: FENCE tile must exist in the village map
  });

  it('returns false for TREE tiles (trees form the impassable border and forest obstacles)', () => {
    // TREE makes up the outer border of all three maps. If it accidentally became
    // walkable the player could step off the edge of the map into undefined tile space.
    const mgr = makeMapManager(); // village map: entire border is TREE tiles
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.TREE) {
          expect(
            mgr.isWalkable(x, y),
            `TREE tile at (${x}, ${y}) must NOT be walkable`
          ).toBe(false);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: TREE tiles must exist in the village map
  });

  it('returns false for BUILDING_WALL tiles (building walls are solid in the village)', () => {
    // BUILDING_WALL forms the walls of all village structures. If it became walkable
    // the player could walk straight through cottages, the blacksmith, and elder's house.
    const mgr = makeMapManager(); // village map
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.BUILDING_WALL) {
          expect(
            mgr.isWalkable(x, y),
            `BUILDING_WALL tile at (${x}, ${y}) must NOT be walkable`
          ).toBe(false);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: BUILDING_WALL tiles must exist in the village map
  });

  it('returns false for ROCK tiles (rocks are impassable terrain in the forest)', () => {
    // ROCK appears as boulder clusters in the forest. If it accidentally became
    // walkable the player could pass through stone outcroppings, breaking map geometry.
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.ROCK) {
          expect(
            mgr.isWalkable(x, y),
            `ROCK tile at (${x}, ${y}) must NOT be walkable`
          ).toBe(false);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: ROCK tiles must exist in the forest map
  });

  it('returns false for WELL tiles (the village well is a solid landmark)', () => {
    // WELL marks the central landmark in the village square. If it became walkable
    // the player could step onto the well sprite, breaking the intended visual layout.
    const mgr = makeMapManager(); // village map
    const map = mgr.currentMap;
    let found = false;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.WELL) {
          expect(
            mgr.isWalkable(x, y),
            `WELL tile at (${x}, ${y}) must NOT be walkable`
          ).toBe(false);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // guard: WELL tile must exist in the village map
  });
});

describe('MapManager.getEnemyAt / getNpcAt', () => {
  it('returns null when no enemy at position', () => {
    const mgr = makeMapManager();
    expect(mgr.getEnemyAt(0, 0)).toBeNull();
  });

  it('returns enemy at its tile position', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies.find(e => e.alive);
    expect(enemy).toBeDefined();
    expect(mgr.getEnemyAt(enemy!.tileX, enemy!.tileY)).not.toBeNull();
  });

  it('returns null for dead enemy', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies.find(e => e.alive)!;
    enemy.alive = false;
    expect(mgr.getEnemyAt(enemy.tileX, enemy.tileY)).toBeNull();
  });

  it('returns npc at its tile position', () => {
    const mgr = makeMapManager();
    const npc = mgr.currentMap.npcs[0];
    if (npc) {
      expect(mgr.getNpcAt(npc.tileX, npc.tileY)).not.toBeNull();
    }
  });

  it('returns null when no npc at position', () => {
    const mgr = makeMapManager();
    expect(mgr.getNpcAt(0, 0)).toBeNull();
  });
});

describe('MapManager.getEnemyAt — live enemy in the forest', () => {
  it('returns the living enemy occupying a tile', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies.find(e => e.alive);
    expect(enemy).toBeDefined();
    const found = mgr.getEnemyAt(enemy!.tileX, enemy!.tileY);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(enemy!.id);
  });
});

describe('MapManager.removeEnemy', () => {
  it('marks enemy as not alive', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies[0];
    expect(enemy).toBeDefined();
    mgr.removeEnemy(enemy.id);
    expect(enemy.alive).toBe(false);
  });

  it('adds enemy id to world state', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies[0];
    expect(enemy).toBeDefined();
    mgr.removeEnemy(enemy.id);
    expect(world.defeatedEnemies).toContain(enemy.id);
  });

  it('does not duplicate in world state on second call', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies[0]!;
    mgr.removeEnemy(enemy.id);
    mgr.removeEnemy(enemy.id);
    expect(world.defeatedEnemies.filter(id => id === enemy.id).length).toBe(1);
  });
});

describe('MapManager.openChest / isChestOpened', () => {
  it('marks a chest as opened', () => {
    const mgr = makeMapManager();
    expect(mgr.isChestOpened('test_chest')).toBe(false);
    mgr.openChest('test_chest');
    expect(mgr.isChestOpened('test_chest')).toBe(true);
  });

  it('calling openChest twice does not duplicate the id in world state', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const chest = mgr.currentMap.chests[0]!;
    mgr.openChest(chest.id);
    mgr.openChest(chest.id);
    expect(world.openedChests.filter(id => id === chest.id).length).toBe(1);
  });
});

describe('MapManager.updateCamera / tileToScreen', () => {
  // Village is exactly 30×20 tiles at 32px = 960×640, same as the canvas, so
  // camera is always clamped to (0,0) there.  Forest (40×30) is larger than the
  // canvas and produces a real, non-zero camera offset — use it here.
  function makeForestManager() {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    return mgr;
  }

  it('tileToScreen reflects camera offset when map is larger than canvas', () => {
    const mgr = makeForestManager();
    // Player at tile (20,15): targetX = 20*32 + TILE_SIZE/2 - CANVAS_WIDTH/2 = 640+16-480 = 176
    mgr.updateCamera(20, 15);
    expect(mgr.camera.x).toBe(176);
    expect(mgr.camera.y).toBe(176);
    const pos = mgr.tileToScreen(5, 5);
    expect(pos.x).toBeCloseTo(5 * TILE_SIZE - mgr.camera.x);
    expect(pos.y).toBeCloseTo(5 * TILE_SIZE - mgr.camera.y);
  });

  it('tileToScreen converts correctly for the tile at camera origin', () => {
    const mgr = makeForestManager();
    mgr.updateCamera(20, 15);
    // The player tile itself should appear at screen center
    const pos = mgr.tileToScreen(20, 15);
    expect(pos.x).toBeCloseTo(20 * TILE_SIZE - mgr.camera.x);
    expect(pos.y).toBeCloseTo(15 * TILE_SIZE - mgr.camera.y);
  });

  it('camera clamps to map bounds', () => {
    const mgr = makeForestManager();
    mgr.updateCamera(9999, 9999);
    const maxX = mgr.currentMap.width * TILE_SIZE - CANVAS_WIDTH;
    const maxY = mgr.currentMap.height * TILE_SIZE - CANVAS_HEIGHT;
    expect(maxX).toBe(320); // 40 tiles × 32px − 960 canvas width
    expect(maxY).toBe(320); // 30 tiles × 32px − 640 canvas height
    expect(mgr.camera.x).toBe(maxX);
    expect(mgr.camera.y).toBe(maxY);
  });

  it('camera does not go negative', () => {
    const mgr = makeForestManager();
    mgr.updateCamera(0, 0);
    expect(mgr.camera.x).toBe(0);
    expect(mgr.camera.y).toBe(0);
  });
});

describe('MapManager.getNpcAdjacent', () => {
  it('returns npc in front of player based on facing', () => {
    const mgr = makeMapManager();
    const npc = mgr.currentMap.npcs[0];
    if (npc) {
      const result = mgr.getNpcAdjacent(npc.tileX, npc.tileY - 1, 'down');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(npc.id);
    }
  });

  it('returns null when no npc in facing direction', () => {
    const mgr = makeMapManager();
    expect(mgr.getNpcAdjacent(0, 0, 'up')).toBeNull();
  });
});

describe('MapManager.clearDefeatedEnemies', () => {
  it('clears the defeated enemies list', () => {
    const world = createDefaultWorld();
    world.defeatedEnemies.push('some_enemy');
    const mgr = new MapManager(world);
    mgr.loadMap('village');
    mgr.clearDefeatedEnemies();
    expect(world.defeatedEnemies.length).toBe(0);
  });

  it('enemies reappear on the map after clearing the defeated list and reloading', () => {
    // Contract: clearDefeatedEnemies() resets worldState.defeatedEnemies but does
    // NOT restore enemy.alive on the current map — a subsequent loadMap() call is
    // required for defeated enemies to reappear.  This test pins the full respawn
    // round-trip so a change to either clearDefeatedEnemies() or the loadMap()
    // filter is caught immediately.
    //
    // createForestMap() calls resetEnemyIdCounter(), so every loadMap('forest')
    // produces the same enemy IDs — the ID picked up in step 1 is valid in step 5.
    const world = createDefaultWorld();
    const mgr = new MapManager(world);

    // Step 1: load and capture an enemy id
    mgr.loadMap('forest');
    const enemyId = mgr.currentMap.enemies[0]!.id;

    // Step 2: defeat the enemy
    mgr.removeEnemy(enemyId);
    expect(world.defeatedEnemies).toContain(enemyId);

    // Step 3: reloading WITHOUT clearing still excludes the enemy
    mgr.loadMap('forest');
    expect(mgr.currentMap.enemies.find(e => e.id === enemyId)).toBeUndefined();

    // Step 4: clear the defeated list
    mgr.clearDefeatedEnemies();
    expect(world.defeatedEnemies).toHaveLength(0);

    // Step 5: reloading AFTER clearing restores the enemy as alive
    mgr.loadMap('forest');
    const restored = mgr.currentMap.enemies.find(e => e.id === enemyId);
    expect(restored).toBeDefined();
    expect(restored!.alive).toBe(true);
  });
});

describe('MapManager.getTransition', () => {
  it('returns the correct village transition at (4,1) with concrete spawn values', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const found = mgr.getTransition(4, 1);
    expect(found).not.toBeNull();
    // Pin concrete values rather than echoing back what transitions[0] says
    expect(found!.targetMap).toBe('village');
    expect(found!.spawnX).toBe(27);
    expect(found!.spawnY).toBe(17);
  });

  it('returns the dungeon transition at (34,25)', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const found = mgr.getTransition(34, 25);
    expect(found).not.toBeNull();
    expect(found!.targetMap).toBe('dungeon');
    expect(found!.spawnX).toBe(3);
    expect(found!.spawnY).toBe(2);
  });

  it('returns null one tile outside the village transition zone', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    // Village transition zone is exactly (4,1); tiles just outside must return null
    expect(mgr.getTransition(5, 1)).toBeNull();
    expect(mgr.getTransition(4, 2)).toBeNull();
    expect(mgr.getTransition(-5, -5)).toBeNull();
  });
});

describe('MapManager.removeEnemy — unknown id', () => {
  it('still records the id in world state even if no instance matches', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('village');
    mgr.removeEnemy('does_not_exist');
    expect(world.defeatedEnemies).toContain('does_not_exist');
  });
});

describe('MapManager.removeEnemy — forest map with live enemies', () => {
  it('marks the enemy instance as not alive when found in the current map', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const enemy = mgr.currentMap.enemies[0];
    expect(enemy).toBeDefined();
    expect(enemy!.alive).toBe(true);
    mgr.removeEnemy(enemy!.id);
    expect(enemy!.alive).toBe(false);
    expect(world.defeatedEnemies).toContain(enemy!.id);
  });
});

describe('MapManager.getChestAdjacent / getChestAt', () => {
  it('returns null when no chest at position', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    expect(mgr.getChestAt(0, 0)).toBeNull();
  });

  it('returns the chest in the facing direction', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const chest = mgr.currentMap.chests[0];
    expect(chest).toBeDefined();
    // Stand one tile above the chest, facing down
    const found = mgr.getChestAdjacent(chest.tileX, chest.tileY - 1, 'down');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(chest.id);
  });

  it('checks each facing direction', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const chest = mgr.currentMap.chests[0];
    expect(mgr.getChestAdjacent(chest.tileX, chest.tileY + 1, 'up')!.id).toBe(chest.id);
    expect(mgr.getChestAdjacent(chest.tileX + 1, chest.tileY, 'left')!.id).toBe(chest.id);
    expect(mgr.getChestAdjacent(chest.tileX - 1, chest.tileY, 'right')!.id).toBe(chest.id);
  });

  it('returns null when nothing is in front', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    expect(mgr.getChestAdjacent(0, 0, 'up')).toBeNull();
  });
});

describe('MapManager.getNpcAdjacent — all facings', () => {
  it('finds an NPC up/left/right of the player too', () => {
    const mgr = makeMapManager();
    const npc = mgr.currentMap.npcs[0];
    expect(mgr.getNpcAdjacent(npc.tileX, npc.tileY + 1, 'up')!.id).toBe(npc.id);
    expect(mgr.getNpcAdjacent(npc.tileX + 1, npc.tileY, 'left')!.id).toBe(npc.id);
    expect(mgr.getNpcAdjacent(npc.tileX - 1, npc.tileY, 'right')!.id).toBe(npc.id);
  });
});

describe('MapManager.isWalkable — unopened chests block', () => {
  it('an unopened chest tile is not walkable, an opened one is', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const chest = mgr.currentMap.chests[0];
    expect(mgr.isWalkable(chest.tileX, chest.tileY)).toBe(false);
    mgr.openChest(chest.id);
    expect(mgr.isWalkable(chest.tileX, chest.tileY)).toBe(true);
  });
});

describe('MapManager.setWorldState', () => {
  it('swaps the world state used for enemy/chest persistence', () => {
    const mgr = makeMapManager();
    const newWorld = createDefaultWorld();
    newWorld.openedChests.push('swapped_chest');
    mgr.setWorldState(newWorld);
    expect(mgr.isChestOpened('swapped_chest')).toBe(true);
  });
});

describe('MapManager.render', () => {
  // Minimal canvas mock that records draw calls.
  function makeCtx() {
    const calls: string[] = [];
    const rec = (m: string) => (...args: unknown[]) => { calls.push(m); };
    const ctx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      font: '', textAlign: 'left' as CanvasTextAlign,
      fillRect: rec('fillRect'), strokeRect: rec('strokeRect'),
      beginPath: rec('beginPath'), arc: rec('arc'), fill: rec('fill'),
      stroke: rec('stroke'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
      ellipse: rec('ellipse'), save: rec('save'), restore: rec('restore'),
      translate: rec('translate'), scale: rec('scale'), rotate: rec('rotate'),
      fillText: rec('fillText'), measureText: () => ({ width: 0 }),
      clearRect: rec('clearRect'), drawImage: rec('drawImage'),
      closePath: rec('closePath'), quadraticCurveTo: rec('quadraticCurveTo'),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  it('renders the village (tiles, chests, npcs, enemies) without throwing', () => {
    const mgr = makeMapManager();
    mgr.updateCamera(mgr.currentMap.spawnX, mgr.currentMap.spawnY);
    const { ctx, calls } = makeCtx();
    mgr.render(ctx, 0);
    // Village is 30×20 = 600 tiles, all visible at spawn camera; every tile type calls fillRect
    // at least once.  A gutted render() that skipped drawTile() would drop below 600.
    const fillRects = calls.filter(c => c === 'fillRect');
    expect(fillRects.length).toBeGreaterThanOrEqual(600);
    // NPCs and/or chests produce canvas calls beyond fillRect (arc, beginPath, etc.);
    // if drawNpc/drawChest were silently removed the total would collapse to fillRects.length.
    expect(calls.length).toBeGreaterThan(fillRects.length);
  });

  it('renders the forest with live enemies, chests and npcs', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    mgr.updateCamera(mgr.currentMap.spawnX, mgr.currentMap.spawnY);
    const { ctx } = makeCtx();
    expect(() => mgr.render(ctx, 5)).not.toThrow();
  });

  it('dead enemies are omitted from the draw-call sequence', () => {
    // Contract: render() guards enemy drawing with `if (enemy.alive)`.
    // Killing an on-screen enemy must reduce the total draw-call count — if the
    // guard were removed, the count would be identical and the dead sprite would
    // appear on screen.  Enemy[0] (Wolf at tile 8,5) is visible when camera is
    // at (0,0) on the 40×30 forest map.
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    mgr.updateCamera(0, 0);

    const { ctx: ctxAlive, calls: callsAlive } = makeCtx();
    mgr.render(ctxAlive, 0);
    const aliveCallCount = callsAlive.length;

    mgr.currentMap.enemies[0].alive = false; // kill the on-screen wolf
    const { ctx: ctxDead, calls: callsDead } = makeCtx();
    mgr.render(ctxDead, 0);

    expect(callsDead.length).toBeLessThan(aliveCallCount);
  });

  it('renders opened chests and dead enemies (alternate branches) without throwing', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    for (const c of mgr.currentMap.chests) mgr.openChest(c.id);
    if (mgr.currentMap.enemies[0]) mgr.currentMap.enemies[0].alive = false;
    mgr.updateCamera(0, 0);
    const { ctx } = makeCtx();
    expect(() => mgr.render(ctx, 1)).not.toThrow();
  });

  it('renders forest chests that are on screen (camera scrolled near tile 35,10)', () => {
    // Forest chests sit at tileX 30-36; the default spawn view (camera near origin)
    // puts them off-screen.  Centering on tile (35, 10) brings forest_chest_1 into
    // the visible area so drawChest() is actually called.
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    mgr.updateCamera(35, 10);
    const { ctx, calls } = makeCtx();
    expect(() => mgr.render(ctx, 0)).not.toThrow();
    expect(calls.length).toBeGreaterThan(0);
  });

  it('skips drawing tiles with negative indices when camera has a negative offset', () => {
    // Force camera.x < 0 so startTileX < 0, exercising the `if (y >= 0 && x >= 0)`
    // guard inside the tile-drawing loop (the false branch, which skips out-of-bounds tiles).
    // Behavioral contract: with a negative camera offset the tile-iteration loop visits
    // x/y = -1 but the guard must skip those iterations so fillRect is called exactly as
    // many times as in a baseline (camera 0,0) render.  Remove the guard and the -1
    // iterations call drawTile() on OOB coords, producing extra fillRect calls.
    const mgr = makeMapManager();

    // Baseline: camera at (0,0) renders all 600 village tiles
    const { ctx: ctxBase, calls: callsBase } = makeCtx();
    mgr.camera.x = 0;
    mgr.camera.y = 0;
    mgr.render(ctxBase, 0);
    const baseCount = callsBase.filter(c => c === 'fillRect').length;

    // Negative offset: startTileX/Y become -1; guard must yield same tile set
    mgr.camera.x = -TILE_SIZE;
    mgr.camera.y = -TILE_SIZE;
    const { ctx: ctxNeg, calls: callsNeg } = makeCtx();
    mgr.render(ctxNeg, 0);
    const negCount = callsNeg.filter(c => c === 'fillRect').length;

    expect(negCount).toBe(baseCount);
  });
});

describe('MapManager.updateCameraToPixel — small map centering', () => {
  it('centers when the map is smaller than the viewport', () => {
    // Force a tiny map by swapping currentMap dimensions
    const mgr = makeMapManager();
    mgr.currentMap = {
      ...mgr.currentMap,
      width: 5,
      height: 5,
      tiles: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]),
    };
    mgr.updateCameraToPixel(0, 0);
    const expectedX = (5 * TILE_SIZE - CANVAS_WIDTH) / 2;
    const expectedY = (5 * TILE_SIZE - CANVAS_HEIGHT) / 2;
    expect(mgr.camera.x).toBeCloseTo(expectedX);
    expect(mgr.camera.y).toBeCloseTo(expectedY);
  });
});

describe('Entity spawn placement - no blocking tiles', () => {
  it('all village NPCs are on walkable tiles', () => {
    const mgr = makeMapManager();
    // Pin exact count: adding/removing a village NPC must be a conscious decision
    expect(mgr.currentMap.npcs.length).toBe(6);
    for (const npc of mgr.currentMap.npcs) {
      expect(
        mgr.isWalkable(npc.tileX, npc.tileY),
        `NPC "${npc.id}" at (${npc.tileX}, ${npc.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('all forest enemies are on walkable tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    for (const enemy of mgr.currentMap.enemies) {
      expect(
        mgr.isWalkable(enemy.tileX, enemy.tileY),
        `Enemy "${enemy.id}" (${enemy.type}) at (${enemy.tileX}, ${enemy.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('all forest chests are on walkable tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    // Open all chests first — chests themselves block movement by design,
    // so we verify the underlying tile is a valid (walkable) location.
    for (const chest of mgr.currentMap.chests) mgr.openChest(chest.id);
    for (const chest of mgr.currentMap.chests) {
      expect(
        mgr.isWalkable(chest.tileX, chest.tileY),
        `Chest "${chest.id}" at (${chest.tileX}, ${chest.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('all dungeon enemies are on walkable tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon');
    for (const enemy of mgr.currentMap.enemies) {
      expect(
        mgr.isWalkable(enemy.tileX, enemy.tileY),
        `Enemy "${enemy.id}" (${enemy.type}) at (${enemy.tileX}, ${enemy.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('all dungeon chests are on walkable tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon');
    for (const chest of mgr.currentMap.chests) mgr.openChest(chest.id);
    for (const chest of mgr.currentMap.chests) {
      expect(
        mgr.isWalkable(chest.tileX, chest.tileY),
        `Chest "${chest.id}" at (${chest.tileX}, ${chest.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('all forest NPCs are on walkable tiles', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    for (const npc of mgr.currentMap.npcs) {
      expect(
        mgr.isWalkable(npc.tileX, npc.tileY),
        `NPC "${npc.id}" at (${npc.tileX}, ${npc.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('village spawn point is on a walkable tile', () => {
    // village spawnX=5, spawnY=6 is the initial new-game position AND the
    // hardcoded death-respawn point in player.respawn().  Unlike forest/dungeon
    // spawns, (5,6) is never a transition destination so it is NOT covered by
    // the all-transition-spawns-walkable test.  A non-walkable tile here traps
    // every new character and every death-respawn inside solid geometry.
    const mgr = makeMapManager(); // village
    const { spawnX, spawnY } = mgr.currentMap;
    expect(mgr.isWalkable(spawnX, spawnY)).toBe(true);
  });

  it('village map spawnX/spawnY matches the coordinates hardcoded in player.respawn()', () => {
    // player.respawn() sets tileX=5, tileY=6 (pinned in player.test.ts).
    // The village map's spawnX/spawnY must stay in sync: if maps.ts changes the
    // spawn to (6,7) but player.respawn() is not updated (or vice versa), the
    // player lands one tile away from the intended location on every death.
    // This cross-module contract test catches the drift before it reaches players.
    const mgr = makeMapManager(); // village
    expect(mgr.currentMap.spawnX).toBe(5);
    expect(mgr.currentMap.spawnY).toBe(6);
  });

  it('dungeon spawn point is on a walkable tile', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon');
    const { spawnX, spawnY } = mgr.currentMap;
    expect(mgr.isWalkable(spawnX, spawnY)).toBe(true);
  });

  it('dungeon exit transition is on a walkable tile', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon');
    for (const t of mgr.currentMap.transitions) {
      expect(
        mgr.isWalkable(t.tileX, t.tileY),
        `Dungeon transition at (${t.tileX}, ${t.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });

  it('forest dungeon entrance transition exists and points to dungeon', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const dungeonTransition = mgr.currentMap.transitions.find(t => t.targetMap === 'dungeon');
    expect(dungeonTransition).toBeDefined();
    expect(dungeonTransition!.targetMap).toBe('dungeon');
  });
});

// ---------------------------------------------------------------------------
// Transition exact-value contracts — pin trigger tile and destination spawn
//
// The existing getTransition test is circular (finds t from transitions[0] then
// asserts found.targetMap === t.targetMap — always true regardless of the value).
// The forest→dungeon test does the same (finds by targetMap === 'dungeon' then
// re-checks targetMap === 'dungeon').  Neither test pins the actual coordinate
// values, so:
//   • swapping tileX/Y moves the gate silently,
//   • changing spawnX/Y teleports the player into a wall,
//   • losing the second forest transition goes undetected.
// These tests use literal expected values so any change to maps.ts is caught.
// ---------------------------------------------------------------------------
describe('MapManager — transition exact-value contracts', () => {
  it('village has exactly 1 transition: (28,17) → forest, spawn (4,2)', () => {
    const mgr = makeMapManager(); // village
    expect(mgr.currentMap.transitions).toHaveLength(1);
    const t = mgr.currentMap.transitions[0];
    expect(t.tileX).toBe(28);
    expect(t.tileY).toBe(17);
    expect(t.targetMap).toBe('forest');
    expect(t.spawnX).toBe(4);
    expect(t.spawnY).toBe(2);
  });

  it('forest has exactly 2 transitions — one to village and one to dungeon', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    expect(mgr.currentMap.transitions).toHaveLength(2);
    const targets = mgr.currentMap.transitions.map(t => t.targetMap).sort();
    expect(targets).toEqual(['dungeon', 'village']);
  });

  it('forest→village transition: (4,1) → village, spawn (27,17)', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const t = mgr.currentMap.transitions.find(t => t.targetMap === 'village')!;
    expect(t).toBeDefined();
    expect(t.tileX).toBe(4);
    expect(t.tileY).toBe(1);
    expect(t.spawnX).toBe(27);
    expect(t.spawnY).toBe(17);
  });

  it('forest→dungeon transition: (34,25) → dungeon, spawn (3,2)', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const t = mgr.currentMap.transitions.find(t => t.targetMap === 'dungeon')!;
    expect(t).toBeDefined();
    expect(t.tileX).toBe(34);
    expect(t.tileY).toBe(25);
    expect(t.spawnX).toBe(3);
    expect(t.spawnY).toBe(2);
  });

  it('dungeon has exactly 1 transition: (3,1) → forest, spawn (34,25)', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('dungeon');
    expect(mgr.currentMap.transitions).toHaveLength(1);
    const t = mgr.currentMap.transitions[0];
    expect(t.tileX).toBe(3);
    expect(t.tileY).toBe(1);
    expect(t.targetMap).toBe('forest');
    expect(t.spawnX).toBe(34);
    expect(t.spawnY).toBe(25);
  });

  it('all transition trigger tiles are walkable on their source map', () => {
    // A non-walkable trigger tile would trap the player: they could never stand
    // on the tile to activate the zone change.
    const cases: Array<{ map: string; tileX: number; tileY: number }> = [
      { map: 'village', tileX: 28, tileY: 17 },
      { map: 'forest',  tileX:  4, tileY:  1 },
      { map: 'forest',  tileX: 34, tileY: 25 },
      { map: 'dungeon', tileX:  3, tileY:  1 },
    ];
    for (const { map, tileX, tileY } of cases) {
      const world = createDefaultWorld();
      const mgr = new MapManager(world);
      mgr.loadMap(map);
      expect(
        mgr.isWalkable(tileX, tileY),
        `${map} transition at (${tileX},${tileY}) must be walkable`
      ).toBe(true);
    }
  });

  it('all transition spawn points are walkable on the destination map', () => {
    // A non-walkable spawn point teleports the player into a wall.
    const cases: Array<{ targetMap: string; spawnX: number; spawnY: number }> = [
      { targetMap: 'forest',  spawnX:  4, spawnY:  2 },  // from village
      { targetMap: 'village', spawnX: 27, spawnY: 17 },  // from forest
      { targetMap: 'dungeon', spawnX:  3, spawnY:  2 },  // from forest
      { targetMap: 'forest',  spawnX: 34, spawnY: 25 },  // from dungeon
    ];
    for (const { targetMap, spawnX, spawnY } of cases) {
      const world = createDefaultWorld();
      const mgr = new MapManager(world);
      mgr.loadMap(targetMap);
      expect(
        mgr.isWalkable(spawnX, spawnY),
        `Spawn (${spawnX},${spawnY}) on ${targetMap} must be walkable`
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// MapManager.getTile — OOB returns TileType.WALL, in-bounds returns real tile
//
// isWalkable() calls getTile() and checks inclusion in a walkable-tile list.
// The existing OOB tests only verify isWalkable returns false — they do not pin
// the specific TileType returned by getTile().  If getTile were changed to return
// TileType.ROCK (also non-walkable) or TileType.GRASS (walkable) the isWalkable
// tests would catch a GRASS change but silently miss a ROCK change, because ROCK
// is also absent from the walkable list.
//
// The behavioral contract is: OOB coordinates are treated as TileType.WALL
// (not ROCK, not undefined, not a thrown error).  This matters if any future code
// calls getTile() directly and checks for WALL specifically — e.g. pathfinding or
// NPC AI that branches on `tile === TileType.WALL`.  Pinning the return value to
// TileType.WALL locks the intent expressed in the source comment "Out of bounds is solid".
// ---------------------------------------------------------------------------
describe('MapManager.getTile — exact return-value contracts', () => {
  it('returns TileType.WALL for every OOB coordinate variant — not ROCK, not GRASS, not undefined', () => {
    // Village is 30×20 tiles.  All four OOB axes are tested so that a change
    // to any one boundary guard is caught: e.g. checking `tileX < 0` but not
    // `tileX >= width` would leave the positive-overflow case uncaught.
    const mgr = makeMapManager(); // village: width=30, height=20

    // Negative axes (underflow)
    expect(mgr.getTile(-1,  0)).toBe(TileType.WALL);
    expect(mgr.getTile( 0, -1)).toBe(TileType.WALL);
    expect(mgr.getTile(-1, -1)).toBe(TileType.WALL);

    // At-or-beyond upper bounds (overflow)
    const { width, height } = mgr.currentMap;
    expect(mgr.getTile(width,     0)).toBe(TileType.WALL); // tileX === width → OOB
    expect(mgr.getTile(0,    height)).toBe(TileType.WALL); // tileY === height → OOB
    expect(mgr.getTile(width, height)).toBe(TileType.WALL); // both axes OOB

    // Far OOB — ensures the guard is not erroneously ranged (e.g. -1 < x < width+1)
    expect(mgr.getTile(-999,  0)).toBe(TileType.WALL);
    expect(mgr.getTile(9999,  0)).toBe(TileType.WALL);
  });

  it('returns the real TileType for valid in-bounds coordinates — not always WALL', () => {
    // Companion to the OOB test: getTile must NOT return WALL for valid tiles.
    // The village border row (y=0) is all TREE tiles (confirmed by other map tests
    // and the "TREE tiles form the outer border" contract).  Position (0,0) is
    // the northwest corner — definitively a TREE tile on every map load.
    // If getTile() were broken to always return WALL, this assertion would fail.
    const mgr = makeMapManager(); // village
    const cornerTile = mgr.getTile(0, 0);
    expect(cornerTile).not.toBe(TileType.WALL);
    expect(cornerTile).toBe(TileType.TREE); // village corner is always the border TREE tile
  });
});
