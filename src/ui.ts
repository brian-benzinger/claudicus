import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PlayerState,
  ShopItem,
  CombatState,
  CombatPhase,
  EnemyInstance,
  WeaponSpeed,
  xpForLevel,
  MAX_LEVEL
} from './types';
import { getWeapon } from './data/weapons';
import { getArmor } from './data/armors';
import { drawPlayer, drawEnemy, drawCombatPlayer } from './renderer';

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

    // Level & XP bar
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`LV ${player.level}`, 250, 26);

    const needed = xpForLevel(player.level);
    const xpPct = player.level >= MAX_LEVEL ? 1 : Math.min(1, player.xp / needed);
    const xpBarX = 290;
    const xpBarW = 80;
    const xpBarY = 14;
    const xpBarH = 8;
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    // Fill
    ctx.fillStyle = COLORS.xpBar;
    ctx.fillRect(xpBarX, xpBarY, Math.floor(xpPct * xpBarW), xpBarH);
    // Border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);
    // XP label underneath bar
    ctx.fillStyle = COLORS.textDark;
    ctx.font = '10px monospace';
    if (player.level >= MAX_LEVEL) {
      ctx.fillText('MAX', xpBarX + 26, xpBarY + xpBarH + 10);
    } else {
      ctx.fillText(`${player.xp}/${needed}`, xpBarX, xpBarY + xpBarH + 10);
    }
    ctx.font = '14px monospace';

    // Gold
    ctx.fillStyle = COLORS.textGold;
    ctx.fillText(`${player.gold}g`, 390, 26);

    // Potions
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Potions: ${player.potions}`, 460, 26);

    // Weapon
    const weapon = getWeapon(player.weaponId);
    ctx.fillText(weapon.name, 600, 26);

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

    const weapon = getWeapon(player.weaponId);
    const weaponSpeed = weapon.speed;

    // Animation offsets
    let playerOffset = 0;
    let enemyOffset = 0;
    let playerAttackProgress = -1;

    if (combat.phase === CombatPhase.PLAYER_ANIMATING) {
      const progress = combat.animationFrame / 20;
      playerAttackProgress = progress;

      switch (weaponSpeed) {
        case WeaponSpeed.FAST:
          // Two short forward dashes
          playerOffset = Math.sin(progress * Math.PI * 2) * 28;
          break;
        case WeaponSpeed.NORMAL:
          // Big lunge forward
          playerOffset = Math.sin(progress * Math.PI) * 55;
          break;
        case WeaponSpeed.SLOW:
          // Subtle step in — overhead weapon does the work
          playerOffset = Math.sin(Math.min(progress * 2, 1) * Math.PI) * 22;
          break;
        case WeaponSpeed.RANGED:
          // Stay put — it's a ranged attack
          playerOffset = 0;
          break;
      }

      // Enemy flinches backward when hit (during second half of player animation)
      if (progress > 0.45) {
        const flinchP = (progress - 0.45) / 0.55;
        enemyOffset = Math.sin(flinchP * Math.PI) * 18;
      }
    } else if (combat.phase === CombatPhase.ENEMY_ANIMATING) {
      const progress = combat.animationFrame / 20;
      enemyOffset = -Math.sin(progress * Math.PI) * 50;
    }

    // Draw player (scaled up)
    ctx.save();
    ctx.translate(playerX + playerOffset, combatY);
    ctx.scale(2, 2);
    drawCombatPlayer(ctx, 0, 0, frame, weaponSpeed, playerAttackProgress);
    ctx.restore();

    // Draw arrow projectile for ranged attack (in screen space, after player draw)
    if (combat.phase === CombatPhase.PLAYER_ANIMATING &&
        weaponSpeed === WeaponSpeed.RANGED &&
        combat.animationFrame / 20 > 0.5) {
      const arrowProgress = (combat.animationFrame / 20 - 0.5) / 0.5;
      const arrowStartX = playerX + 32;
      const arrowStartY = combatY + 28;
      const arrowEndX = enemyX - 10;
      const arrowEndY = combatY + 28;
      const arrowX = arrowStartX + (arrowEndX - arrowStartX) * arrowProgress;
      const arrowY = arrowStartY - Math.sin(arrowProgress * Math.PI) * 12;

      ctx.save();
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(arrowX - 10, arrowY);
      ctx.lineTo(arrowX + 6, arrowY);
      ctx.stroke();
      // arrowhead
      ctx.fillStyle = '#b0b0b0';
      ctx.beginPath();
      ctx.moveTo(arrowX + 6, arrowY);
      ctx.lineTo(arrowX,     arrowY - 3);
      ctx.lineTo(arrowX,     arrowY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

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
  drawCombatVictoryOverlay(
    ctx: CanvasRenderingContext2D,
    xpGained: number,
    goldGained: number,
    levelUpText: string,
    timerRemaining: number
  ): void {
    const totalFrames = 360; // 6 seconds at 60 fps
    const fadeInFrames  = 20;
    const fadeOutFrames = 60;
    const elapsed = totalFrames - timerRemaining;

    const panelAlpha = Math.min(1, elapsed / fadeInFrames) *
                       (timerRemaining <= fadeOutFrames ? timerRemaining / fadeOutFrames : 1);

    // Panel
    ctx.save();
    ctx.globalAlpha = panelAlpha;

    const panelW = 320, panelH = levelUpText ? 190 : 155;
    const panelX = CANVAS_WIDTH / 2 - panelW / 2;
    const panelY = CANVAS_HEIGHT / 2 - panelH / 2;

    ctx.fillStyle = 'rgba(10, 20, 10, 0.88)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#44bb44';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#66ee66';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', CANVAS_WIDTH / 2, panelY + 44);

    ctx.strokeStyle = '#336633';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 20, panelY + 56);
    ctx.lineTo(panelX + panelW - 20, panelY + 56);
    ctx.stroke();

    ctx.font = '18px monospace';
    ctx.fillStyle = COLORS.textGold;
    ctx.fillText(`+${xpGained} XP`, CANVAS_WIDTH / 2, panelY + 84);
    if (goldGained > 0) {
      ctx.fillText(`+${goldGained} Gold`, CANVAS_WIDTH / 2, panelY + 110);
    }

    if (levelUpText) {
      ctx.fillStyle = '#aaddff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(levelUpText, CANVAS_WIDTH / 2, panelY + 140);
    }

    ctx.font = '11px monospace';
    ctx.fillStyle = COLORS.textDark;
    ctx.fillText('[SPACE] to continue', CANVAS_WIDTH / 2, panelY + panelH - 10);

    ctx.textAlign = 'left';
    ctx.restore();

    // Full-screen black fade-out that covers everything
    if (timerRemaining <= fadeOutFrames) {
      const fadeAlpha = 1 - timerRemaining / fadeOutFrames;
      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }

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
  drawLevelUpBanner(ctx: CanvasRenderingContext2D, newLevel: number, rewardLabel: string, frame: number): void {
    // Fade in over first 10 frames, fade out over last 20 frames of 120 total
    const fadeIn  = Math.min(1, frame / 10);
    const fadeOut = Math.max(0, 1 - Math.max(0, frame - 100) / 20);
    const alpha   = fadeIn * fadeOut;
    const scale   = 1 + Math.sin(frame * 0.1) * 0.04;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.scale(scale, scale);

    // Glow
    ctx.fillStyle = `rgba(255, 215, 0, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP!', 0, -20);
    ctx.font = '22px monospace';
    ctx.fillText(`Level ${newLevel}`, 0, 16);

    // Reward line
    if (rewardLabel) {
      ctx.font = '16px monospace';
      ctx.fillStyle = '#aaddff';
      ctx.fillText(`Reward: ${rewardLabel}`, 0, 46);
    }

    ctx.textAlign = 'left';

    ctx.restore();
  }

  // Draw inventory screen
  drawInventoryScreen(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    cursor: number
  ): void {
    // Darken overworld behind
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const panelW = 620;
    const panelH = 420;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = (CANVAS_HEIGHT - panelH) / 2;

    // Panel background
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('INVENTORY', panelX + 240, panelY + 32);

    // Divider
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + 44);
    ctx.lineTo(panelX + panelW - 10, panelY + 44);
    ctx.stroke();

    // Build item list: weapons, then armors, then potions
    const items: Array<
      | { type: 'weapon'; id: string }
      | { type: 'armor'; id: string }
      | { type: 'potions' }
    > = [
      ...player.weapons.map(id => ({ type: 'weapon' as const, id })),
      ...(player.armors ?? []).map(id => ({ type: 'armor' as const, id })),
      { type: 'potions' as const }
    ];

    // Left column: item list
    ctx.font = '14px monospace';
    const listX = panelX + 20;
    const listStartY = panelY + 65;
    const rowH = 28;

    items.forEach((item, i) => {
      const rowY = listStartY + i * rowH;

      // Cursor highlight
      if (i === cursor) {
        ctx.fillStyle = COLORS.menuHighlight;
        ctx.fillRect(panelX + 10, rowY - 18, 280, rowH);
      }

      if (item.type === 'weapon') {
        const weapon = getWeapon(item.id);
        const isEquipped = player.weaponId === item.id;

        ctx.fillStyle = isEquipped ? COLORS.textGold : COLORS.text;
        const label = isEquipped ? `[E] ${weapon.name}` : `    ${weapon.name}`;
        ctx.fillText(label, listX, rowY);
      } else if (item.type === 'armor') {
        const armor = getArmor(item.id);
        const isEquipped = player.armorId === item.id;

        ctx.fillStyle = isEquipped ? COLORS.textGold : COLORS.text;
        const label = isEquipped ? `[E] ${armor.name}` : `    ${armor.name}`;
        ctx.fillText(label, listX, rowY);
      } else {
        ctx.fillStyle = player.potions > 0 ? COLORS.text : COLORS.textDark;
        ctx.fillText(`    Health Potion x${player.potions}`, listX, rowY);
      }
    });

    // Vertical divider between list and detail panel
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 310, panelY + 44);
    ctx.lineTo(panelX + 310, panelY + panelH - 10);
    ctx.stroke();

    // Right column: selected item details
    const detailX = panelX + 325;
    const detailY = panelY + 70;
    const selectedItem = items[cursor];

    if (selectedItem?.type === 'weapon') {
      const weapon = getWeapon(selectedItem.id);
      const isEquipped = player.weaponId === selectedItem.id;

      ctx.fillStyle = COLORS.textGold;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(weapon.name, detailX, detailY);

      ctx.fillStyle = COLORS.textDark;
      ctx.font = '12px monospace';
      ctx.fillText(isEquipped ? 'Currently Equipped' : '', detailX, detailY + 20);

      const speedLabel: Record<WeaponSpeed, string> = {
        [WeaponSpeed.FAST]: 'Fast',
        [WeaponSpeed.NORMAL]: 'Normal',
        [WeaponSpeed.SLOW]: 'Slow',
        [WeaponSpeed.RANGED]: 'Ranged'
      };

      ctx.fillStyle = COLORS.text;
      ctx.font = '14px monospace';
      ctx.fillText(`Damage:  +${weapon.damageBonus}`, detailX, detailY + 55);
      ctx.fillText(`Speed:   ${speedLabel[weapon.speed]}`, detailX, detailY + 80);

      if (weapon.critChance > 0) {
        ctx.fillText(`Crit:    ${Math.round(weapon.critChance * 100)}%`, detailX, detailY + 105);
      }
      if (weapon.missChance > 0) {
        ctx.fillText(`Miss:    ${Math.round(weapon.missChance * 100)}%`, detailX, detailY + 105 + (weapon.critChance > 0 ? 25 : 0));
      }
      if (weapon.ignoresDefense > 0) {
        ctx.fillText(`Armor pierce: ${Math.round(weapon.ignoresDefense * 100)}%`, detailX, detailY + 130 + (weapon.critChance > 0 ? 25 : 0));
      }

      // Action hint
      if (!isEquipped) {
        ctx.fillStyle = COLORS.textGold;
        ctx.font = '13px monospace';
        ctx.fillText('[SPACE] Equip', detailX, detailY + 200);
      }
    } else if (selectedItem?.type === 'armor') {
      const armor = getArmor(selectedItem.id);
      const isEquipped = player.armorId === selectedItem.id;

      ctx.fillStyle = COLORS.textGold;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(armor.name, detailX, detailY);

      ctx.fillStyle = COLORS.textDark;
      ctx.font = '12px monospace';
      ctx.fillText(isEquipped ? 'Currently Equipped' : '', detailX, detailY + 20);

      ctx.fillStyle = COLORS.text;
      ctx.font = '14px monospace';
      ctx.fillText('Slot:    Body', detailX, detailY + 55);
      ctx.fillText(`Defense: +${armor.defBonus}`, detailX, detailY + 80);

      if (!isEquipped) {
        ctx.fillStyle = COLORS.textGold;
        ctx.font = '13px monospace';
        ctx.fillText('[SPACE] Equip', detailX, detailY + 200);
      }
    } else if (selectedItem?.type === 'potions') {
      ctx.fillStyle = COLORS.textGold;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Health Potion', detailX, detailY);

      ctx.fillStyle = COLORS.text;
      ctx.font = '14px monospace';
      ctx.fillText(`In pack: ${player.potions}`, detailX, detailY + 55);
      ctx.fillText('Restores 20 HP', detailX, detailY + 80);

      if (player.potions > 0) {
        ctx.fillStyle = COLORS.textGold;
        ctx.font = '13px monospace';
        ctx.fillText('[SPACE] Use Potion', detailX, detailY + 200);
      }
    }

    // Footer
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + panelH - 30);
    ctx.lineTo(panelX + panelW - 10, panelY + panelH - 30);
    ctx.stroke();

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '12px monospace';
    ctx.fillText('[W/S] Navigate   [SPACE] Use/Equip   [I/ESC] Close', panelX + 100, panelY + panelH - 12);
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
