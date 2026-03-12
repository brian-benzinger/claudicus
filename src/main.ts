import {
  GameState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TILE_SIZE,
  TileType,
  PlayerState,
  QuestState,
  WorldState,
  EnemyType,
  createDefaultPlayer,
  createDefaultWorld,
  NpcRole
} from './types';
import { InputManager } from './input';
import { PlayerManager } from './player';
import { MapManager } from './map';
import { CombatEngine } from './combat';
import { NpcManager } from './npc';
import { UIRenderer } from './ui';
import { save, load, hasSave, clearSave } from './save';
import { drawPlayer } from './renderer';
import { openChest } from './items';
import { QUESTS, createDefaultQuests } from './data/quests';
import { MusicEngine } from './music';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState = GameState.TITLE;

  private input: InputManager;
  private player: PlayerManager;
  private mapManager: MapManager;
  private combat: CombatEngine | null = null;
  private npcManager: NpcManager;
  private ui: UIRenderer;
  private music: MusicEngine;

  private quests: Record<string, QuestState>;
  private world: WorldState;

  private frame: number = 0;
  private titleCursor: number = 0;
  private characterSelectCursor: number = 0;
  private pauseCursor: number = 0;
  private inventoryCursor: number = 0;
  private inventoryReturnState: GameState = GameState.OVERWORLD;

  private levelUpTimer: number = 0;
  private newLevel: number = 0;
  private levelUpRewardLabel: string = '';

  // Bed save fade: 0=idle, 1-30=fade out, 31=save, 32-60=fade in
  private bedFadeTimer: number = 0;
  private victoryTimer: number = 0;
  private victoryXp: number = 0;
  private victoryGold: number = 0;
  private victoryLevelUp: string = '';

  // Smooth tile-to-tile movement
  private visualX: number = 0;
  private visualY: number = 0;
  private startPixelX: number = 0;
  private startPixelY: number = 0;
  private targetPixelX: number = 0;
  private targetPixelY: number = 0;
  private moveProgress: number = 1; // 1 = arrived at target
  private readonly MOVE_DURATION: number = 15; // frames at 120fps ≈ 125ms per tile

  // 120fps cap
  private lastTimestamp: number = 0;
  private readonly FRAME_MS: number = 1000 / 120;

  private notificationMessages: string[] = [];
  private notificationTimer: number = 0;

  private defeatGoldLost: number = 0;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.input = new InputManager();
    this.quests = createDefaultQuests();
    this.world = createDefaultWorld();
    this.player = new PlayerManager();
    this.mapManager = new MapManager(this.world);
    this.npcManager = new NpcManager();
    this.ui = new UIRenderer();
    this.music = new MusicEngine();

    requestAnimationFrame(this.gameLoop);
  }

  private gameLoop = (timestamp: number): void => {
    requestAnimationFrame(this.gameLoop);

    const delta = timestamp - this.lastTimestamp;
    if (delta < this.FRAME_MS) return;
    this.lastTimestamp = timestamp - (delta % this.FRAME_MS);

    this.input.flushFrame();
    this.update();
    this.render();
    this.frame++;
  };

  private initVisualPosition(): void {
    this.visualX = this.player.state.tileX * TILE_SIZE;
    this.visualY = this.player.state.tileY * TILE_SIZE;
    this.startPixelX = this.visualX;
    this.startPixelY = this.visualY;
    this.targetPixelX = this.visualX;
    this.targetPixelY = this.visualY;
    this.moveProgress = 1;
  }

  private updateVisualPosition(): void {
    if (this.moveProgress < 1) {
      this.moveProgress = Math.min(1, this.moveProgress + 1 / this.MOVE_DURATION);
      // Ease-out: starts fast, decelerates into tile
      const t = 1 - Math.pow(1 - this.moveProgress, 2);
      this.visualX = this.startPixelX + (this.targetPixelX - this.startPixelX) * t;
      this.visualY = this.startPixelY + (this.targetPixelY - this.startPixelY) * t;
    }
  }

  private update(): void {
    switch (this.state) {
      case GameState.TITLE:
        this.updateTitle();
        break;
      case GameState.CHARACTER_SELECT:
        this.updateCharacterSelect();
        break;
      case GameState.OVERWORLD:
        this.updateOverworld();
        break;
      case GameState.DIALOG:
        this.updateDialog();
        break;
      case GameState.SHOP:
        this.updateShop();
        break;
      case GameState.COMBAT:
        this.updateCombat();
        break;
      case GameState.COMBAT_VICTORY:
        this.updateCombatVictory();
        break;
      case GameState.COMBAT_DEFEAT:
        this.updateCombatDefeat();
        break;
      case GameState.PAUSE:
        this.updatePause();
        break;
      case GameState.VICTORY:
        this.updateVictory();
        break;
      case GameState.INVENTORY:
        this.updateInventory();
        break;
    }

    // Update timers
    if (this.levelUpTimer > 0) {
      this.levelUpTimer--;
    }
    if (this.notificationTimer > 0) {
      this.notificationTimer--;
      if (this.notificationTimer === 0) {
        this.notificationMessages = [];
      }
    }
  }

  private render(): void {
    // Clear
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    switch (this.state) {
      case GameState.TITLE:
        this.renderTitle();
        break;
      case GameState.CHARACTER_SELECT:
        this.ui.drawCharacterSelectScreen(this.ctx, this.characterSelectCursor);
        break;
      case GameState.OVERWORLD:
      case GameState.DIALOG:
      case GameState.SHOP:
      case GameState.PAUSE:
      case GameState.INVENTORY:
        this.renderOverworld();
        if (this.state === GameState.DIALOG) {
          this.renderDialog();
        } else if (this.state === GameState.SHOP) {
          this.renderShop();
        } else if (this.state === GameState.PAUSE) {
          this.ui.drawPauseMenu(this.ctx, this.pauseCursor);
        } else if (this.state === GameState.INVENTORY) {
          this.ui.drawInventoryScreen(this.ctx, this.player.state, this.inventoryCursor);
        }
        break;
      case GameState.COMBAT:
        this.renderCombat();
        break;
      case GameState.COMBAT_VICTORY:
        this.renderCombat();
        this.ui.drawCombatVictoryOverlay(this.ctx, this.victoryXp, this.victoryGold, this.victoryLevelUp, this.victoryTimer);
        break;
      case GameState.COMBAT_DEFEAT:
        this.ui.drawDefeatScreen(this.ctx, this.defeatGoldLost);
        break;
      case GameState.VICTORY:
        this.renderOverworld();
        this.ui.drawVictoryScreen(this.ctx);
        break;
    }

    // Overlays
    if (this.levelUpTimer > 0) {
      this.ui.drawLevelUpBanner(this.ctx, this.newLevel, this.levelUpRewardLabel, 120 - this.levelUpTimer);
    }

    if (this.notificationTimer > 0 && this.notificationMessages.length > 0) {
      this.ui.drawNotification(this.ctx, this.notificationMessages);
    }
  }

  // --- TITLE SCREEN ---

  private updateTitle(): void {
    const options = hasSave() ? 2 : 1;

    if (this.input.menuUp()) {
      this.titleCursor = (this.titleCursor - 1 + options) % options;
    }
    if (this.input.menuDown()) {
      this.titleCursor = (this.titleCursor + 1) % options;
    }

    if (this.input.interact()) {
      if (hasSave() && this.titleCursor === 0) {
        // Continue
        this.loadGame();
      } else {
        // New Game — go to character select
        this.characterSelectCursor = 0;
        this.state = GameState.CHARACTER_SELECT;
      }
    }
  }

  private renderTitle(): void {
    this.ui.drawTitleScreen(this.ctx, hasSave(), this.titleCursor);
  }

  private updateCharacterSelect(): void {
    if (this.input.menuLeft()) {
      this.characterSelectCursor = (this.characterSelectCursor - 1 + 2) % 2;
    }
    if (this.input.menuRight()) {
      this.characterSelectCursor = (this.characterSelectCursor + 1) % 2;
    }
    if (this.input.interact()) {
      const gender: 'male' | 'female' = this.characterSelectCursor === 0 ? 'male' : 'female';
      this.startNewGame(gender);
    }
  }

  private startNewGame(gender: 'male' | 'female' = 'male'): void {
    clearSave();
    this.player = new PlayerManager(createDefaultPlayer(gender));
    this.quests = createDefaultQuests();
    this.world = createDefaultWorld();
    this.mapManager = new MapManager(this.world);
    this.mapManager.loadMap('village');
    this.initVisualPosition();
    this.mapManager.updateCameraToPixel(this.visualX, this.visualY);
    this.music.init();
    this.music.play('village');
    this.state = GameState.OVERWORLD;
  }

  private loadGame(): void {
    const data = load();
    if (data) {
      this.player = new PlayerManager(data.player);
      this.quests = data.quests;
      this.world = data.world;
      this.mapManager = new MapManager(this.world);
      this.mapManager.loadMap(data.player.currentMap);
      this.initVisualPosition();
      this.mapManager.updateCameraToPixel(this.visualX, this.visualY);
      this.music.init();
      this.music.play(data.player.currentMap === 'forest' ? 'forest' : 'village');
      this.state = GameState.OVERWORLD;
    } else {
      this.startNewGame();
    }
  }

  // --- OVERWORLD ---

  private updateOverworld(): void {
    // Advance visual position animation
    this.updateVisualPosition();

    // Mute toggle
    if (this.input.toggleMute()) {
      const muted = this.music.toggleMute();
      this.showNotification([muted ? 'Music OFF' : 'Music ON']);
    }

    // Pause menu
    if (this.input.cancel()) {
      this.pauseCursor = 0;
      this.state = GameState.PAUSE;
      return;
    }

    // Inventory
    if (this.input.openInventory()) {
      this.inventoryCursor = 0;
      this.inventoryReturnState = GameState.OVERWORLD;
      this.state = GameState.INVENTORY;
      return;
    }

    // Movement — only when previous move animation is complete
    let dx = 0;
    let dy = 0;

    if (this.moveProgress >= 1) {
      if (this.input.moveUp()) dy = -1;
      else if (this.input.moveDown()) dy = 1;
      else if (this.input.moveLeft()) dx = -1;
      else if (this.input.moveRight()) dx = 1;
    }

    if (dx !== 0 || dy !== 0) {
      const newX = this.player.state.tileX + dx;
      const newY = this.player.state.tileY + dy;

      // Check collision
      if (this.mapManager.isWalkable(newX, newY)) {
        // Check for enemy at destination
        const enemy = this.mapManager.getEnemyAt(newX, newY);
        if (enemy) {
          this.startCombat(enemy);
          return;
        }

        // Check for NPC at destination (can't walk through)
        const npc = this.mapManager.getNpcAt(newX, newY);
        if (npc) {
          // Face the NPC but don't move
          this.player.state.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
          return;
        }

        // Move player logic
        this.player.move(dx, dy);

        // Start smooth animation toward new tile
        this.startPixelX = this.visualX;
        this.startPixelY = this.visualY;
        this.targetPixelX = this.player.state.tileX * TILE_SIZE;
        this.targetPixelY = this.player.state.tileY * TILE_SIZE;
        this.moveProgress = 0;

        // Check for map transition
        const transition = this.mapManager.getTransition(newX, newY);
        if (transition) {
          this.transitionMap(transition.targetMap, transition.spawnX, transition.spawnY);
          return;
        }
      }
    }

    // Update camera to follow visual (smooth) position
    this.mapManager.updateCameraToPixel(this.visualX, this.visualY);

    // Interaction
    if (this.input.interact()) {
      // Check for adjacent NPC
      const npc = this.mapManager.getNpcAdjacent(
        this.player.state.tileX,
        this.player.state.tileY,
        this.player.state.facing
      );

      if (npc) {
        this.startDialog(npc);
        return;
      }

      // Check for adjacent chest
      const chest = this.mapManager.getChestAdjacent(
        this.player.state.tileX,
        this.player.state.tileY,
        this.player.state.facing
      );

      if (chest && !this.mapManager.isChestOpened(chest.id)) {
        const result = openChest(chest, this.player);
        this.mapManager.openChest(chest.id);
        this.showNotification(result.messages);
        this.autoSave();
        return;
      }

      // Check for adjacent bed
      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      const onBed = dirs.some(({ dx, dy }) =>
        this.mapManager.getTile(
          this.player.state.tileX + dx,
          this.player.state.tileY + dy
        ) === TileType.BED
      ) || this.mapManager.getTile(this.player.state.tileX, this.player.state.tileY) === TileType.BED;

      if (onBed && this.bedFadeTimer === 0) {
        this.bedFadeTimer = 1;
      }
    }

    // Advance bed-save fade
    if (this.bedFadeTimer > 0) {
      this.bedFadeTimer++;
      if (this.bedFadeTimer === 31) {
        this.autoSave();
        this.player.state.hp = this.player.state.maxHp; // rest heals fully
        this.showNotification(['Game saved', 'HP restored']);
      }
      if (this.bedFadeTimer > 60) {
        this.bedFadeTimer = 0;
      }
    }
  }

  private renderOverworld(): void {
    // Render map
    this.mapManager.render(this.ctx, this.frame);

    // Render player at smooth visual position
    const screenX = this.visualX - this.mapManager.camera.x;
    const screenY = this.visualY - this.mapManager.camera.y;
    drawPlayer(this.ctx, screenX, screenY, this.frame, this.player.state.facing, this.player.getWeapon().speed, this.player.state.gender);

    // Render HUD
    this.ui.drawHUD(this.ctx, this.player.state);

    // Bed save fade overlay
    if (this.bedFadeTimer > 0) {
      const t = this.bedFadeTimer;
      // Frames 1-30: fade to black; frames 31-60: fade back in
      const alpha = t <= 30 ? t / 30 : 1 - (t - 30) / 30;
      this.ctx.save();
      this.ctx.globalAlpha = Math.min(1, alpha);
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.ctx.restore();
    }
  }

  private transitionMap(targetMap: string, spawnX: number, spawnY: number): void {
    this.autoSave();
    this.player.state.currentMap = targetMap;
    this.player.state.tileX = spawnX;
    this.player.state.tileY = spawnY;
    this.mapManager.loadMap(targetMap);
    this.initVisualPosition();
    this.mapManager.updateCameraToPixel(this.visualX, this.visualY);
    this.music.play(targetMap === 'forest' ? 'forest' : 'village');
  }

  // --- DIALOG ---

  private startDialog(npc: { id: string; name: string; tileX: number; tileY: number; role: NpcRole; questId?: string; dialogs: any; color: string }): void {
    this.npcManager.startDialog(npc, this.quests);

    // Start this NPC's quest on first encounter
    if (npc.questId) {
      const questState = this.quests[npc.questId];
      if (questState && !questState.started) {
        questState.started = true;
      }
    }

    this.state = GameState.DIALOG;
  }

  private updateDialog(): void {
    if (this.input.interact()) {
      const result = this.npcManager.advanceDialog();

      if (result === 'done' || result === 'shop') {
        // Claim quest reward for any NPC whose quest is complete but unclaimed
        const npc = this.npcManager.dialogState?.npc;
        if (npc?.questId) {
          const questState = this.quests[npc.questId];
          const questDef = QUESTS[npc.questId];
          if (questState?.completed && !questState.rewardClaimed) {
            const reward = this.npcManager.claimQuestReward(questState, this.player, questDef);
            if (reward.success) {
              this.showNotification(reward.rewards);
            }
          }
        }

        if (result === 'done') {
          this.npcManager.clearDialog();
          this.state = GameState.OVERWORLD;
        } else {
          this.state = GameState.SHOP;
        }
      }
    }

    if (this.input.cancel()) {
      this.npcManager.clearDialog();
      this.state = GameState.OVERWORLD;
    }
  }

  private renderDialog(): void {
    const speaker = this.npcManager.getSpeakerName();
    const line = this.npcManager.getCurrentLine();

    if (speaker && line) {
      this.ui.drawDialogBox(this.ctx, speaker, line);
    }
  }

  // --- SHOP ---

  private updateShop(): void {
    if (this.input.menuUp()) {
      this.npcManager.moveShopCursor(-1);
    }
    if (this.input.menuDown()) {
      this.npcManager.moveShopCursor(1);
    }

    if (this.input.interact()) {
      const result = this.npcManager.buySelectedItem(this.player);
      this.showNotification([result.message]);
    }

    if (this.input.cancel()) {
      this.npcManager.closeShop();
      this.state = GameState.OVERWORLD;
    }
  }

  private renderShop(): void {
    const items = this.npcManager.getShopItemsWithOwnership(this.player);
    this.ui.drawShopMenu(this.ctx, items, this.npcManager.shopCursor, this.player.state.gold);
  }

  // --- COMBAT ---

  private startCombat(enemy: { id: string; type: any; name: string; hp: number; maxHp: number; atk: number; def: number; agi: number; xp: number; gold: number; tileX: number; tileY: number; alive: boolean }): void {
    this.combat = new CombatEngine(this.player, enemy);
    this.state = GameState.COMBAT;
  }

  private updateCombat(): void {
    if (!this.combat) return;

    this.combat.update();

    // Player input during player action phase
    if (this.combat.state.phase === 'PLAYER_ACTION') {
      if (this.input.action1()) {
        this.combat.playerAttack();
      } else if (this.input.action2()) {
        this.combat.playerDefend();
      } else if (this.input.action3()) {
        this.combat.playerPotion();
      } else if (this.input.action4()) {
        this.combat.playerFlee();
      }
    }

    // Enemy turn (auto-execute after delay)
    if (this.combat.state.phase === 'ENEMY_ACTION') {
      this.combat.enemyTurn();
    }

    // Check for combat end
    if (this.combat.isDone()) {
      const result = this.combat.getResult();

      if (result === 'victory') {
        // Apply rewards immediately
        const rewards = this.combat.computeRewards();
        const levelReward = this.player.gainXp(rewards.xp);
        if (rewards.gold > 0) this.player.addGold(rewards.gold);

        this.victoryXp   = rewards.xp;
        this.victoryGold = rewards.gold;
        this.victoryLevelUp = levelReward ? `LEVEL UP! ${levelReward.label}` : '';

        if (levelReward) {
          this.newLevel = this.player.state.level;
          this.levelUpRewardLabel = levelReward.label;
          this.levelUpTimer = 120;
        }

        // Remove enemy and track quest progress before switching state
        this.mapManager.removeEnemy(this.combat.state.enemy.id);
        if (this.player.state.currentMap === 'forest') {
          this.checkQuestProgress(this.combat.state.enemy.type);
        }
        this.autoSave();

        this.victoryTimer = 360; // 6 seconds at 60fps
        this.state = GameState.COMBAT_VICTORY;
      } else if (result === 'defeat') {
        this.defeatGoldLost = Math.floor(this.player.state.gold * 0.1);
        this.state = GameState.COMBAT_DEFEAT;
      } else if (result === 'fled') {
        this.state = GameState.OVERWORLD;
        this.combat = null;
      }
    }
  }

  private updateCombatVictory(): void {
    this.victoryTimer--;
    // Allow early dismiss with interact key
    if (this.victoryTimer <= 0 || this.input.interact()) {
      this.combat = null;
      this.state = GameState.OVERWORLD;
    }
  }

  private updateCombatDefeat(): void {
    if (this.input.interact()) {
      // Respawn
      this.player.respawn();

      // Clear defeated enemies so they respawn
      this.mapManager.clearDefeatedEnemies();
      this.mapManager.loadMap('village');
      this.initVisualPosition();
      this.mapManager.updateCameraToPixel(this.visualX, this.visualY);

      this.autoSave();
      this.combat = null;
      this.state = GameState.OVERWORLD;
    }
  }

  private renderCombat(): void {
    if (!this.combat) return;
    this.ui.drawCombatScreen(this.ctx, this.player.state, this.combat.state, this.frame);
  }

  // --- PAUSE MENU ---

  private updatePause(): void {
    if (this.input.openInventory()) {
      this.inventoryCursor = 0;
      this.inventoryReturnState = GameState.PAUSE;
      this.state = GameState.INVENTORY;
      return;
    }

    if (this.input.menuUp()) {
      this.pauseCursor = (this.pauseCursor - 1 + 3) % 3;
    }
    if (this.input.menuDown()) {
      this.pauseCursor = (this.pauseCursor + 1) % 3;
    }

    if (this.input.interact()) {
      switch (this.pauseCursor) {
        case 0: // Resume
          this.state = GameState.OVERWORLD;
          break;
        case 1: // Save
          this.saveGame();
          this.showNotification(['Game saved!']);
          break;
        case 2: // Quit
          this.state = GameState.TITLE;
          this.titleCursor = 0;
          break;
      }
    }

    if (this.input.cancel()) {
      this.state = GameState.OVERWORLD;
    }
  }

  // --- INVENTORY ---

  private updateInventory(): void {
    // items = weapons[] + potions entry
    const itemCount = this.player.state.weapons.length + 1;

    if (this.input.menuUp()) {
      this.inventoryCursor = (this.inventoryCursor - 1 + itemCount) % itemCount;
    }
    if (this.input.menuDown()) {
      this.inventoryCursor = (this.inventoryCursor + 1) % itemCount;
    }

    if (this.input.interact()) {
      const isPotion = this.inventoryCursor === this.player.state.weapons.length;

      if (isPotion) {
        const used = this.player.usePotion();
        if (used) {
          this.showNotification(['Used Health Potion.', `HP: ${this.player.state.hp}/${this.player.state.maxHp}`]);
          this.autoSave();
        } else {
          this.showNotification(['No potions remaining!']);
        }
      } else {
        const weaponId = this.player.state.weapons[this.inventoryCursor];
        if (weaponId && weaponId !== this.player.state.weaponId) {
          this.player.equipWeapon(weaponId);
          const weapon = this.player.getWeapon();
          this.showNotification([`Equipped ${weapon.name}.`]);
          this.autoSave();
        }
      }
    }

    if (this.input.cancel() || this.input.openInventory()) {
      this.state = this.inventoryReturnState;
    }
  }

  // --- VICTORY ---

  private updateVictory(): void {
    if (this.input.interact()) {
      this.state = GameState.OVERWORLD;
    }
  }

  // --- HELPERS ---

  private checkQuestProgress(enemyType: EnemyType): void {
    for (const [questId, questDef] of Object.entries(QUESTS)) {
      const questState = this.quests[questId];
      if (!questState || !questState.started || questState.completed) continue;

      const counts =
        questDef.goalType === 'kill_any' ||
        (questDef.goalType === 'kill_type' && questDef.goalEnemyTypes?.includes(enemyType));

      if (counts) {
        questState.count++;
        if (questState.count >= questDef.goalCount) {
          questState.completed = true;
          this.showNotification([
            `${questDef.name}: Complete!`,
            `Return to ${questDef.npcName}.`
          ]);
        }
      }
    }
  }

  private saveGame(): void {
    save(this.player.state, this.quests, this.world);
  }

  private autoSave(): void {
    this.saveGame();
  }

  private showNotification(messages: string[]): void {
    this.notificationMessages = messages;
    this.notificationTimer = 120; // 2 seconds at 60fps
  }
}

// Start the game
new Game();
