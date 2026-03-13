import {
  MapDef,
  TileType,
  EnemyInstance,
  NpcDef,
  ChestDef,
  TransitionDef,
  WorldState,
  Camera,
  TILE_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from './types';
import { getMap } from './data/maps';
import { drawTile, drawEnemy, drawNpc, drawChest } from './renderer';

export class MapManager {
  currentMap: MapDef;
  camera: Camera;
  private worldState: WorldState;

  constructor(worldState: WorldState) {
    this.worldState = worldState;
    this.currentMap = getMap('village');
    this.camera = {
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT
    };
  }

  loadMap(mapId: string): void {
    this.currentMap = getMap(mapId);

    // Apply world state - filter out defeated enemies
    this.currentMap.enemies = this.currentMap.enemies.filter(
      e => !this.worldState.defeatedEnemies.includes(e.id)
    );
  }

  setWorldState(worldState: WorldState): void {
    this.worldState = worldState;
  }

  // Get tile type at position
  getTile(tileX: number, tileY: number): TileType {
    if (tileX < 0 || tileX >= this.currentMap.width ||
        tileY < 0 || tileY >= this.currentMap.height) {
      return TileType.WALL; // Out of bounds is solid
    }
    return this.currentMap.tiles[tileY][tileX] as TileType;
  }

  // Check if tile is walkable
  isWalkable(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    const walkableTiles = [
      TileType.GRASS,
      TileType.DIRT,
      TileType.COBBLESTONE,
      TileType.DARK_GRASS,
      TileType.DOOR,
      TileType.GATE,
      TileType.BED
    ];
    if (!walkableTiles.includes(tile)) return false;
    // Unopened chests block movement
    const chest = this.getChestAt(tileX, tileY);
    if (chest && !this.isChestOpened(chest.id)) return false;
    return true;
  }

  // Get transition at position
  getTransition(tileX: number, tileY: number): TransitionDef | null {
    for (const t of this.currentMap.transitions) {
      if (tileX >= t.tileX && tileX < t.tileX + t.width &&
          tileY >= t.tileY && tileY < t.tileY + t.height) {
        return t;
      }
    }
    return null;
  }

  // Get enemy at position
  getEnemyAt(tileX: number, tileY: number): EnemyInstance | null {
    for (const e of this.currentMap.enemies) {
      if (e.alive && e.tileX === tileX && e.tileY === tileY) {
        return e;
      }
    }
    return null;
  }

  // Get NPC at or adjacent to position
  getNpcAt(tileX: number, tileY: number): NpcDef | null {
    for (const npc of this.currentMap.npcs) {
      if (npc.tileX === tileX && npc.tileY === tileY) {
        return npc;
      }
    }
    return null;
  }

  // Get NPC adjacent to player (for interaction)
  getNpcAdjacent(playerX: number, playerY: number, facing: string): NpcDef | null {
    let checkX = playerX;
    let checkY = playerY;

    switch (facing) {
      case 'up': checkY--; break;
      case 'down': checkY++; break;
      case 'left': checkX--; break;
      case 'right': checkX++; break;
    }

    return this.getNpcAt(checkX, checkY);
  }

  // Get chest at position
  getChestAt(tileX: number, tileY: number): ChestDef | null {
    for (const chest of this.currentMap.chests) {
      if (chest.tileX === tileX && chest.tileY === tileY) {
        return chest;
      }
    }
    return null;
  }

  // Get chest adjacent to player
  getChestAdjacent(playerX: number, playerY: number, facing: string): ChestDef | null {
    let checkX = playerX;
    let checkY = playerY;

    switch (facing) {
      case 'up': checkY--; break;
      case 'down': checkY++; break;
      case 'left': checkX--; break;
      case 'right': checkX++; break;
    }

    return this.getChestAt(checkX, checkY);
  }

  // Mark enemy as defeated
  removeEnemy(id: string): void {
    const enemy = this.currentMap.enemies.find(e => e.id === id);
    if (enemy) {
      enemy.alive = false;
    }
    // Add to world state
    if (!this.worldState.defeatedEnemies.includes(id)) {
      this.worldState.defeatedEnemies.push(id);
    }
  }

  // Mark chest as opened
  openChest(id: string): void {
    if (!this.worldState.openedChests.includes(id)) {
      this.worldState.openedChests.push(id);
    }
  }

  // Check if chest is opened
  isChestOpened(id: string): boolean {
    return this.worldState.openedChests.includes(id);
  }

  // Update camera to follow player (tile coords)
  updateCamera(playerTileX: number, playerTileY: number): void {
    this.updateCameraToPixel(playerTileX * TILE_SIZE, playerTileY * TILE_SIZE);
  }

  // Update camera using smooth pixel position
  updateCameraToPixel(pixelX: number, pixelY: number): void {
    const mapPixelWidth = this.currentMap.width * TILE_SIZE;
    const mapPixelHeight = this.currentMap.height * TILE_SIZE;

    let targetX = pixelX + TILE_SIZE / 2 - CANVAS_WIDTH / 2;
    let targetY = pixelY + TILE_SIZE / 2 - CANVAS_HEIGHT / 2;

    targetX = Math.max(0, Math.min(targetX, mapPixelWidth - CANVAS_WIDTH));
    targetY = Math.max(0, Math.min(targetY, mapPixelHeight - CANVAS_HEIGHT));

    if (mapPixelWidth <= CANVAS_WIDTH) {
      targetX = (mapPixelWidth - CANVAS_WIDTH) / 2;
    }
    if (mapPixelHeight <= CANVAS_HEIGHT) {
      targetY = (mapPixelHeight - CANVAS_HEIGHT) / 2;
    }

    this.camera.x = targetX;
    this.camera.y = targetY;
  }

  // Convert tile coords to screen coords
  tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * TILE_SIZE - this.camera.x,
      y: tileY * TILE_SIZE - this.camera.y
    };
  }

  // Render the map
  render(ctx: CanvasRenderingContext2D, frame: number): void {
    // Calculate visible tile range
    const startTileX = Math.floor(this.camera.x / TILE_SIZE);
    const startTileY = Math.floor(this.camera.y / TILE_SIZE);
    const endTileX = Math.ceil((this.camera.x + CANVAS_WIDTH) / TILE_SIZE);
    const endTileY = Math.ceil((this.camera.y + CANVAS_HEIGHT) / TILE_SIZE);

    // Draw ground tiles
    for (let y = startTileY; y <= endTileY && y < this.currentMap.height; y++) {
      for (let x = startTileX; x <= endTileX && x < this.currentMap.width; x++) {
        if (y >= 0 && x >= 0) {
          const screenPos = this.tileToScreen(x, y);
          const tileType = this.getTile(x, y);
          // Floor to integers to eliminate sub-pixel gaps between tiles
          drawTile(ctx, tileType, Math.floor(screenPos.x), Math.floor(screenPos.y), x, y);
        }
      }
    }

    // Draw chests
    for (const chest of this.currentMap.chests) {
      const screenPos = this.tileToScreen(chest.tileX, chest.tileY);
      if (this.isOnScreen(screenPos.x, screenPos.y)) {
        drawChest(ctx, screenPos.x, screenPos.y, this.isChestOpened(chest.id));
      }
    }

    // Draw NPCs
    for (const npc of this.currentMap.npcs) {
      const screenPos = this.tileToScreen(npc.tileX, npc.tileY);
      if (this.isOnScreen(screenPos.x, screenPos.y)) {
        drawNpc(ctx, npc, screenPos.x, screenPos.y, frame);
      }
    }

    // Draw enemies
    for (const enemy of this.currentMap.enemies) {
      if (enemy.alive) {
        const screenPos = this.tileToScreen(enemy.tileX, enemy.tileY);
        if (this.isOnScreen(screenPos.x, screenPos.y)) {
          drawEnemy(ctx, enemy.type, screenPos.x, screenPos.y);
        }
      }
    }
  }

  // Check if position is visible on screen
  private isOnScreen(x: number, y: number): boolean {
    return x >= -TILE_SIZE && x < CANVAS_WIDTH + TILE_SIZE &&
           y >= -TILE_SIZE && y < CANVAS_HEIGHT + TILE_SIZE;
  }

  // Clear defeated enemies (for respawn on death)
  clearDefeatedEnemies(): void {
    this.worldState.defeatedEnemies = [];
  }
}
