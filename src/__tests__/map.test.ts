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
    for (const chest of mgr.currentMap.chests) {
      expect(
        mgr.isWalkable(chest.tileX, chest.tileY),
        `Chest "${chest.id}" at (${chest.tileX}, ${chest.tileY}) is on a blocking tile`
      ).toBe(true);
    }
  });
});
