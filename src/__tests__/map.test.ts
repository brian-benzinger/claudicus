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
    expect(mgr.currentMap.width).toBeGreaterThan(0);
    expect(mgr.currentMap.height).toBeGreaterThan(0);
  });

  it('filters out defeated enemies from world state', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('village');
    const firstEnemy = mgr.currentMap.enemies[0];
    if (firstEnemy) {
      world.defeatedEnemies.push(firstEnemy.id);
      mgr.loadMap('village');
      expect(mgr.currentMap.enemies.find(e => e.id === firstEnemy.id)).toBeUndefined();
    }
  });
});

describe('MapManager.isWalkable', () => {
  it('returns false for out-of-bounds tiles', () => {
    const mgr = makeMapManager();
    expect(mgr.isWalkable(-1, -1)).toBe(false);
    expect(mgr.isWalkable(9999, 9999)).toBe(false);
  });

  it('returns false for WALL tiles', () => {
    const mgr = makeMapManager();
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
  });

  it('returns true for GRASS tiles', () => {
    const mgr = makeMapManager();
    const map = mgr.currentMap;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] === TileType.GRASS) {
          expect(mgr.isWalkable(x, y)).toBe(true);
          return;
        }
      }
    }
  });
});

describe('MapManager.getEnemyAt / getNpcAt', () => {
  it('returns null when no enemy at position', () => {
    const mgr = makeMapManager();
    expect(mgr.getEnemyAt(0, 0)).toBeNull();
  });

  it('returns enemy at its tile position', () => {
    const mgr = makeMapManager();
    const enemy = mgr.currentMap.enemies[0];
    if (enemy && enemy.alive) {
      expect(mgr.getEnemyAt(enemy.tileX, enemy.tileY)).not.toBeNull();
    }
  });

  it('returns null for dead enemy', () => {
    const mgr = makeMapManager();
    const enemy = mgr.currentMap.enemies[0];
    if (enemy) {
      enemy.alive = false;
      expect(mgr.getEnemyAt(enemy.tileX, enemy.tileY)).toBeNull();
    }
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
    const mgr = makeMapManager();
    const enemy = mgr.currentMap.enemies[0];
    if (enemy) {
      mgr.removeEnemy(enemy.id);
      expect(enemy.alive).toBe(false);
    }
  });

  it('adds enemy id to world state', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('village');
    const enemy = mgr.currentMap.enemies[0];
    if (enemy) {
      mgr.removeEnemy(enemy.id);
      expect(world.defeatedEnemies).toContain(enemy.id);
    }
  });

  it('does not duplicate in world state on second call', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('village');
    const enemy = mgr.currentMap.enemies[0];
    if (enemy) {
      mgr.removeEnemy(enemy.id);
      mgr.removeEnemy(enemy.id);
      expect(world.defeatedEnemies.filter(id => id === enemy.id).length).toBe(1);
    }
  });
});

describe('MapManager.openChest / isChestOpened', () => {
  it('marks a chest as opened', () => {
    const mgr = makeMapManager();
    expect(mgr.isChestOpened('test_chest')).toBe(false);
    mgr.openChest('test_chest');
    expect(mgr.isChestOpened('test_chest')).toBe(true);
  });
});

describe('MapManager.updateCamera / tileToScreen', () => {
  it('tileToScreen at (0,0) gives position offset by camera', () => {
    const mgr = makeMapManager();
    mgr.updateCamera(0, 0);
    const pos = mgr.tileToScreen(0, 0);
    // camera.x may be 0 or negative-clamped; tileToScreen = tile*TILE_SIZE - camera.x
    expect(pos.x).toBeCloseTo(0 * TILE_SIZE - mgr.camera.x);
    expect(pos.y).toBeCloseTo(0 * TILE_SIZE - mgr.camera.y);
  });

  it('tileToScreen converts correctly for a mid-map tile', () => {
    const mgr = makeMapManager();
    mgr.updateCamera(10, 10);
    const pos = mgr.tileToScreen(10, 10);
    expect(pos.x).toBeCloseTo(10 * TILE_SIZE - mgr.camera.x);
    expect(pos.y).toBeCloseTo(10 * TILE_SIZE - mgr.camera.y);
  });

  it('camera clamps to map bounds', () => {
    const mgr = makeMapManager();
    mgr.updateCamera(9999, 9999);
    const maxX = mgr.currentMap.width * TILE_SIZE - CANVAS_WIDTH;
    const maxY = mgr.currentMap.height * TILE_SIZE - CANVAS_HEIGHT;
    expect(mgr.camera.x).toBeLessThanOrEqual(Math.max(0, maxX));
    expect(mgr.camera.y).toBeLessThanOrEqual(Math.max(0, maxY));
  });

  it('camera does not go negative', () => {
    const mgr = makeMapManager();
    mgr.updateCamera(0, 0);
    expect(mgr.camera.x).toBeGreaterThanOrEqual(0);
    expect(mgr.camera.y).toBeGreaterThanOrEqual(0);
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
});

describe('MapManager.getTransition', () => {
  it('returns the transition inside its zone and null elsewhere', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    const t = mgr.currentMap.transitions[0];
    expect(t).toBeDefined();
    const found = mgr.getTransition(t.tileX, t.tileY);
    expect(found).not.toBeNull();
    expect(found!.targetMap).toBe(t.targetMap);
    // Far away → no transition
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
    expect(() => mgr.render(ctx, 0)).not.toThrow();
    expect(calls.length).toBeGreaterThan(0);
  });

  it('renders the forest with live enemies, chests and npcs', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    mgr.updateCamera(mgr.currentMap.spawnX, mgr.currentMap.spawnY);
    const { ctx } = makeCtx();
    expect(() => mgr.render(ctx, 5)).not.toThrow();
  });

  it('renders opened chests and dead enemies (alternate branches)', () => {
    const world = createDefaultWorld();
    const mgr = new MapManager(world);
    mgr.loadMap('forest');
    for (const c of mgr.currentMap.chests) mgr.openChest(c.id);
    if (mgr.currentMap.enemies[0]) mgr.currentMap.enemies[0].alive = false;
    mgr.updateCamera(0, 0);
    const { ctx } = makeCtx();
    expect(() => mgr.render(ctx, 1)).not.toThrow();
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
