import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PlayerState,
  ShopItem,
  CombatState,
  CombatPhase,
  EnemyInstance
} from './types';
import { getWeapon } from './data/weapons';
import { drawPlayer, drawEnemy } from './renderer';

const COLORS = {
  bgDark: 'rgba(20, 20, 30, 0.95)',
  bgMedium: 'rgba(40, 35, 45, 0.9)',
  border: '#5a4a3a',
  borderLight: '#8a7a6a',
  text: '#ffffff',
  textDark: '#888888',
  textGold: '#ffd700',
  hpPlayer: '#44aa44',
  hpEnemy: '#cc4444',
  hpBg: '#333333',
  xpBar: '#4488cc',
  menuHighlight: 'rgba(100, 80, 60, 0.5)'
};

export class UIRenderer {
  // Draw HUD (top of screen during overworld)
  drawHUD(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    const hudHeight = 40;

    // Background
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(0, 0, CANVAS_WIDTH, hudHeight);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, hudHeight);

    // HP
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.fillText('HP:', 10, 26);
    this.drawHpBar(ctx, 40, 14, 120, 16, player.hp, player.maxHp, COLORS.hpPlayer);
    ctx.fillText(`${player.hp}/${player.maxHp}`, 170, 26);

    // Level & XP
    ctx.fillText(`LV ${player.level}`, 250, 26);

    // Gold
    ctx.fillStyle = COLORS.textGold;
    ctx.fillText(`${player.gold}g`, 320, 26);

    // Potions
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Potions: ${player.potions}`, 400, 26);

    // Weapon
    const weapon = getWeapon(player.weaponId);
    ctx.fillText(weapon.name, 520, 26);

    // Map name
    ctx.fillStyle = COLORS.textDark;
    ctx.fillText(player.currentMap === 'village' ? 'Brannford' : 'Thornwood', CANVAS_WIDTH - 100, 26);
  }

  // Draw HP bar
  drawHpBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    current: number,
    max: number,
    color: string
  ): void {
    // Background
    ctx.fillStyle = COLORS.hpBg;
    ctx.fillRect(x, y, width, height);

    // Fill
    const fillWidth = Math.max(0, (current / max) * width);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, fillWidth, height);

    // Border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  // Draw dialog box
  drawDialogBox(ctx: CanvasRenderingContext2D, speaker: string, text: string): void {
    const boxHeight = 120;
    const boxY = CANVAS_HEIGHT - boxHeight - 10;

    // Background
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(10, boxY, CANVAS_WIDTH - 20, boxHeight);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, boxY, CANVAS_WIDTH - 20, boxHeight);

    // Speaker name
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(speaker, 30, boxY + 30);

    // Dialog text
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';

    // Word wrap
    const maxWidth = CANVAS_WIDTH - 60;
    const words = text.split(' ');
    let line = '';
    let lineY = boxY + 55;

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, 30, lineY);
        line = word + ' ';
        lineY += 20;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 30, lineY);

    // Continue prompt
    ctx.fillStyle = COLORS.textDark;
    ctx.font = '12px monospace';
    ctx.fillText('[SPACE] to continue', CANVAS_WIDTH - 180, boxY + boxHeight - 15);
  }

  // Draw shop menu
  drawShopMenu(
    ctx: CanvasRenderingContext2D,
    items: ShopItem[],
    cursor: number,
    playerGold: number
  ): void {
    const menuWidth = 400;
    const menuHeight = 300;
    const menuX = (CANVAS_WIDTH - menuWidth) / 2;
    const menuY = (CANVAS_HEIGHT - menuHeight) / 2;

    // Background
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

    // Title
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SHOP', menuX + 170, menuY + 30);

    // Gold display
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.fillText(`Your Gold: ${playerGold}`, menuX + 20, menuY + 55);

    // Items
    ctx.font = '14px monospace';
    items.forEach((item, i) => {
      const itemY = menuY + 85 + i * 30;

      // Highlight selected
      if (i === cursor) {
        ctx.fillStyle = COLORS.menuHighlight;
        ctx.fillRect(menuX + 10, itemY - 18, menuWidth - 20, 26);
      }

      // Item name
      ctx.fillStyle = item.owned ? COLORS.textDark : COLORS.text;
      ctx.fillText(item.owned ? `${item.name} (owned)` : item.name, menuX + 20, itemY);

      // Price
      ctx.fillStyle = playerGold >= item.cost ? COLORS.textGold : '#cc4444';
      ctx.fillText(`${item.cost}g`, menuX + menuWidth - 60, itemY);
    });

    // Instructions
    ctx.fillStyle = COLORS.textDark;
    ctx.font = '12px monospace';
    ctx.fillText('[W/S] Select   [SPACE] Buy   [ESC] Exit', menuX + 60, menuY + menuHeight - 20);
  }

  // Draw combat screen
  drawCombatScreen(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    combat: CombatState,
    frame: number
  ): void {
    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ground
    ctx.fillStyle = '#3d5a3d';
    ctx.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

    // Combat area
    const playerX = 150;
    const enemyX = CANVAS_WIDTH - 200;
    const combatY = CANVAS_HEIGHT / 2 - 50;

    // Animation offsets
    let playerOffset = 0;
    let enemyOffset = 0;

    if (combat.phase === CombatPhase.PLAYER_ANIMATING) {
      const progress = combat.animationFrame / 20;
      playerOffset = Math.sin(progress * Math.PI) * 50;
    } else if (combat.phase === CombatPhase.ENEMY_ANIMATING) {
      const progress = combat.animationFrame / 20;
      enemyOffset = -Math.sin(progress * Math.PI) * 50;
    }

    // Draw player (scaled up)
    ctx.save();
    ctx.translate(playerX + playerOffset, combatY);
    ctx.scale(2, 2);
    drawPlayer(ctx, 0, 0, frame, 'right');
    ctx.restore();

    // Draw enemy (scaled up)
    ctx.save();
    ctx.translate(enemyX + enemyOffset, combatY);
    ctx.scale(2, 2);
    drawEnemy(ctx, combat.enemy.type, 0, 0);
    ctx.restore();

    // Player info box
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(20, 20, 200, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(20, 20, 200, 80);

    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.fillText('You', 30, 45);
    this.drawHpBar(ctx, 30, 55, 150, 16, combat.playerHp, player.maxHp, COLORS.hpPlayer);
    ctx.fillText(`${combat.playerHp}/${player.maxHp}`, 190, 68);

    // Enemy info box
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(CANVAS_WIDTH - 220, 20, 200, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(CANVAS_WIDTH - 220, 20, 200, 80);

    ctx.fillStyle = COLORS.text;
    ctx.fillText(combat.enemy.name, CANVAS_WIDTH - 210, 45);
    this.drawHpBar(ctx, CANVAS_WIDTH - 210, 55, 150, 16, combat.enemyHp, combat.enemy.maxHp, COLORS.hpEnemy);
    ctx.fillText(`${combat.enemyHp}/${combat.enemy.maxHp}`, CANVAS_WIDTH - 50, 68);

    // Combat log
    this.drawCombatLog(ctx, combat.log.slice(-4));

    // Combat menu (only during player action)
    if (combat.phase === CombatPhase.PLAYER_ACTION) {
      this.drawCombatMenu(ctx, player.potions);
    }
  }

  // Draw combat log
  drawCombatLog(ctx: CanvasRenderingContext2D, log: string[]): void {
    const logY = CANVAS_HEIGHT - 180;

    ctx.fillStyle = COLORS.bgMedium;
    ctx.fillRect(20, logY, CANVAS_WIDTH - 40, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(20, logY, CANVAS_WIDTH - 40, 80);

    ctx.fillStyle = COLORS.text;
    ctx.font = '13px monospace';

    log.forEach((line, i) => {
      ctx.fillText(line, 30, logY + 20 + i * 18);
    });
  }

  // Draw combat action menu
  drawCombatMenu(ctx: CanvasRenderingContext2D, potions: number): void {
    const menuY = CANVAS_HEIGHT - 90;

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(20, menuY, CANVAS_WIDTH - 40, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(20, menuY, CANVAS_WIDTH - 40, 80);

    ctx.font = '16px monospace';
    ctx.fillStyle = COLORS.text;

    ctx.fillText('[1] Attack', 50, menuY + 35);
    ctx.fillText('[2] Defend', 200, menuY + 35);
    ctx.fillStyle = potions > 0 ? COLORS.text : COLORS.textDark;
    ctx.fillText(`[3] Potion (${potions})`, 350, menuY + 35);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('[4] Flee', 550, menuY + 35);
  }

  // Draw pause menu
  drawPauseMenu(ctx: CanvasRenderingContext2D, cursor: number): void {
    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const menuWidth = 300;
    const menuHeight = 200;
    const menuX = (CANVAS_WIDTH - menuWidth) / 2;
    const menuY = (CANVAS_HEIGHT - menuHeight) / 2;

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PAUSED', menuX + 105, menuY + 40);

    const options = ['Resume', 'Save Game', 'Quit to Title'];
    ctx.font = '16px monospace';

    options.forEach((opt, i) => {
      const optY = menuY + 80 + i * 35;

      if (i === cursor) {
        ctx.fillStyle = COLORS.menuHighlight;
        ctx.fillRect(menuX + 20, optY - 20, menuWidth - 40, 30);
        ctx.fillStyle = COLORS.textGold;
      } else {
        ctx.fillStyle = COLORS.text;
      }

      ctx.fillText(opt, menuX + 100, optY);
    });
  }

  // Draw title screen
  drawTitleScreen(ctx: CanvasRenderingContext2D, hasSave: boolean, cursor: number): void {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 48px monospace';
    ctx.fillText('CLAUDICUS', CANVAS_WIDTH / 2 - 140, 200);

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '16px monospace';
    ctx.fillText('A Medieval Fantasy RPG', CANVAS_WIDTH / 2 - 110, 240);

    // Menu options
    const options = hasSave ? ['Continue', 'New Game'] : ['New Game'];
    ctx.font = '20px monospace';

    options.forEach((opt, i) => {
      const optY = 350 + i * 50;

      if (i === cursor) {
        ctx.fillStyle = COLORS.textGold;
        ctx.fillText('> ' + opt + ' <', CANVAS_WIDTH / 2 - 80, optY);
      } else {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(opt, CANVAS_WIDTH / 2 - 60, optY);
      }
    });

    // Instructions
    ctx.fillStyle = COLORS.textDark;
    ctx.font = '14px monospace';
    ctx.fillText('[W/S] Select   [SPACE/ENTER] Confirm', CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT - 50);
  }

  // Draw victory screen
  drawVictoryScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 36px monospace';
    ctx.fillText('QUEST COMPLETE!', CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT / 2 - 50);

    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.fillText('You have defended Brannford!', CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT / 2 + 10);

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '14px monospace';
    ctx.fillText('[SPACE] to continue', CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT / 2 + 80);
  }

  // Draw defeat screen
  drawDefeatScreen(ctx: CanvasRenderingContext2D, goldLost: number): void {
    ctx.fillStyle = 'rgba(30, 0, 0, 0.9)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#cc3333';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('YOU HAVE FALLEN', CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT / 2 - 50);

    ctx.fillStyle = COLORS.text;
    ctx.font = '16px monospace';
    ctx.fillText(`Lost ${goldLost} gold.`, CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT / 2 + 10);

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '14px monospace';
    ctx.fillText('[SPACE] Return to Brannford', CANVAS_WIDTH / 2 - 110, CANVAS_HEIGHT / 2 + 80);
  }

  // Draw level up banner
  drawLevelUpBanner(ctx: CanvasRenderingContext2D, newLevel: number, frame: number): void {
    const alpha = Math.min(1, frame / 10);
    const scale = 1 + Math.sin(frame * 0.1) * 0.05;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.scale(scale, scale);

    // Glow effect
    ctx.fillStyle = `rgba(255, 215, 0, ${0.3 - frame * 0.003})`;
    ctx.beginPath();
    ctx.arc(0, 0, 100 + frame * 2, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP!', 0, -10);
    ctx.font = '24px monospace';
    ctx.fillText(`Level ${newLevel}`, 0, 30);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  // Draw notification message
  drawNotification(ctx: CanvasRenderingContext2D, messages: string[]): void {
    const boxWidth = 400;
    const boxHeight = 30 + messages.length * 25;
    const boxX = (CANVAS_WIDTH - boxWidth) / 2;
    const boxY = 100;

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = COLORS.borderLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';

    messages.forEach((msg, i) => {
      ctx.fillText(msg, boxX + 20, boxY + 25 + i * 25);
    });
  }
}
