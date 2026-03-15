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
  MAX_LEVEL,
  QuestState,
  StatusEffectType,
  ClassPath
} from './types';
import { getWeapon } from './data/weapons';
import { getArmor } from './data/armors';
import { drawPlayer, drawEnemy, drawCombatPlayer } from './renderer';
import { QUESTS } from './data/quests';

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

    // Class badge
    if (player.classPath) {
      const badge =
        player.classPath === ClassPath.WARRIOR ? '[WAR]' :
        player.classPath === ClassPath.SCOUT   ? '[SCT]' : '[BRG]';
      const badgeColor =
        player.classPath === ClassPath.WARRIOR ? '#e06060' :
        player.classPath === ClassPath.SCOUT   ? '#60c060' : '#c060e0';
      ctx.fillStyle = badgeColor;
      ctx.fillText(badge, 760, 26);
    }

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
  drawDialogBox(ctx: CanvasRenderingContext2D, speaker: string, text: string, revealFrame?: number): void {
    const boxHeight = 150;
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

    // Dialog text — split on \n for paragraph breaks, word-wrap each, then reveal left-to-right
    ctx.font = '14px monospace';
    const maxWidth = CANVAS_WIDTH - 60;
    const paragraphs = text.split('\n');
    const lines: string[] = [];

    for (let p = 0; p < paragraphs.length; p++) {
      if (p > 0) lines.push(''); // blank line between paragraphs
      const words = paragraphs[p].split(' ');
      let current = '';
      for (const word of words) {
        const test = current + word + ' ';
        if (ctx.measureText(test).width > maxWidth && current !== '') {
          lines.push(current.trimEnd());
          current = word + ' ';
        } else {
          current = test;
        }
      }
      if (current.trimEnd()) lines.push(current.trimEnd());
    }

    // 2 characters revealed per frame; undefined = instant (fully revealed)
    const charsToShow = revealFrame === undefined ? Infinity : Math.floor(revealFrame * 2);
    let charsRemaining = charsToShow;

    ctx.fillStyle = COLORS.text;
    lines.forEach((ln, i) => {
      const lineY = boxY + 52 + i * 20;
      if (ln === '') return; // blank separator — just takes up vertical space
      if (charsRemaining <= 0) return;
      const visible = ln.slice(0, charsRemaining);
      ctx.fillText(visible, 30, lineY);
      charsRemaining -= ln.length;
    });

    // Continue prompt — only show once text is fully revealed
    const totalChars = lines.reduce((s, l) => s + l.length, 0);
    if (charsToShow >= totalChars) {
      ctx.fillStyle = COLORS.textDark;
      ctx.font = '12px monospace';
      ctx.fillText('[SPACE] to continue', CANVAS_WIDTH - 180, boxY + boxHeight - 15);
    }
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
    drawCombatPlayer(ctx, 0, 0, frame, weaponSpeed, playerAttackProgress, player.armorId, player.gender, player.weaponId);
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

    // Status effects — player side
    const playerEffects = combat.playerStatusEffects ?? [];
    if (playerEffects.length > 0) {
      ctx.font = '12px monospace';
      playerEffects.forEach((eff, i) => {
        const label =
          eff.type === StatusEffectType.BLEED  ? `BLEED(${eff.turnsRemaining})` :
          eff.type === StatusEffectType.STUN   ? `STUN(${eff.turnsRemaining})`  :
          `WEAKEN(${eff.turnsRemaining})`;
        ctx.fillStyle = eff.type === StatusEffectType.BLEED ? '#e05050' : '#e0a030';
        ctx.fillText(label, 30, 108 + i * 16);
      });
    }

    // Status effects — enemy side
    const enemyEffects = combat.enemyStatusEffects ?? [];
    if (enemyEffects.length > 0) {
      ctx.font = '12px monospace';
      enemyEffects.forEach((eff, i) => {
        const label =
          eff.type === StatusEffectType.STUN   ? `STUNNED(${eff.turnsRemaining})` :
          eff.type === StatusEffectType.WEAKEN  ? `WEAK(${eff.turnsRemaining})` :
          `BLEED(${eff.turnsRemaining})`;
        ctx.fillStyle = '#60d0e0';
        ctx.textAlign = 'right';
        ctx.fillText(label, CANVAS_WIDTH - 30, 108 + i * 16);
        ctx.textAlign = 'left';
      });
    }

    // Combat log
    this.drawCombatLog(ctx, combat.log.slice(-4));

    // Combat menu (only during player action)
    if (combat.phase === CombatPhase.PLAYER_ACTION) {
      // Determine available ability from engine state (passed via combat state context)
      const abilityName = this.getAbilityName(player, combat);
      this.drawCombatMenu(ctx, player.potions, abilityName);
    }
  }

  private getAbilityName(player: PlayerState, combat: CombatState): string | null {
    if (player.level >= 3) {
      switch (player.weaponId) {
        case 'dagger':      return 'Backstab';
        case 'hunting_bow': return 'Pin';
        case 'mace':        return 'Shatter';
      }
    }
    if (player.classPath) {
      switch (player.classPath) {
        case ClassPath.WARRIOR: return 'Shield Bash';
        case ClassPath.SCOUT:   return combat.abilityUsedThisCombat ? null : 'Ambush';
        case ClassPath.BRIGAND: return 'Intimidate';
      }
    }
    return null;
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
  drawCombatMenu(ctx: CanvasRenderingContext2D, potions: number, abilityName: string | null = null): void {
    const menuY = CANVAS_HEIGHT - 90;

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(20, menuY, CANVAS_WIDTH - 40, 80);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(20, menuY, CANVAS_WIDTH - 40, 80);

    ctx.font = '16px monospace';
    ctx.fillStyle = COLORS.text;

    if (abilityName) {
      // 5-column layout to fit ability
      ctx.fillText('[1] Attack',            40,  menuY + 35);
      ctx.fillText('[2] Defend',            185, menuY + 35);
      ctx.fillStyle = potions > 0 ? COLORS.text : COLORS.textDark;
      ctx.fillText(`[3] Potion (${potions})`, 330, menuY + 35);
      ctx.fillStyle = COLORS.text;
      ctx.fillText('[4] Flee',              510, menuY + 35);
      ctx.fillStyle = '#a0d8ff';
      ctx.fillText(`[5] ${abilityName}`,   640, menuY + 35);
    } else {
      // Original 4-column layout
      ctx.fillText('[1] Attack',              50,  menuY + 35);
      ctx.fillText('[2] Defend',              200, menuY + 35);
      ctx.fillStyle = potions > 0 ? COLORS.text : COLORS.textDark;
      ctx.fillText(`[3] Potion (${potions})`, 350, menuY + 35);
      ctx.fillStyle = COLORS.text;
      ctx.fillText('[4] Flee',                550, menuY + 35);
    }
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

  drawQuestLog(
    ctx: CanvasRenderingContext2D,
    quests: Record<string, QuestState>
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const panelW = 640;
    const panelH = 440;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = (CANVAS_HEIGHT - panelH) / 2;

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QUEST LOG', CANVAS_WIDTH / 2, panelY + 32);
    ctx.textAlign = 'left';

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + 44);
    ctx.lineTo(panelX + panelW - 10, panelY + 44);
    ctx.stroke();

    const startY = panelY + 60;
    const rowH = 62;
    let row = 0;

    for (const [questId, state] of Object.entries(quests)) {
      if (!state.started) continue;
      const def = QUESTS[questId];
      if (!def) continue;

      const ry = startY + row * rowH;

      // Status badge
      if (state.rewardClaimed) {
        ctx.fillStyle = '#447744';
        ctx.fillText('✓', panelX + 20, ry + 16);
        ctx.fillStyle = COLORS.textDark;
      } else if (state.completed) {
        ctx.fillStyle = COLORS.textGold;
        ctx.fillText('!', panelX + 20, ry + 16);
        ctx.fillStyle = COLORS.textGold;
      } else {
        ctx.fillStyle = '#4488cc';
        ctx.fillText('◆', panelX + 20, ry + 16);
        ctx.fillStyle = COLORS.text;
      }

      // Quest name
      ctx.font = 'bold 14px monospace';
      ctx.fillText(def.name, panelX + 36, ry + 16);

      // Description
      ctx.fillStyle = COLORS.textDark;
      ctx.font = '12px monospace';
      ctx.fillText(def.description, panelX + 36, ry + 32);

      // Progress / status
      if (state.rewardClaimed) {
        ctx.fillStyle = '#447744';
        ctx.fillText('Complete', panelX + 36, ry + 48);
      } else if (state.completed) {
        ctx.fillStyle = COLORS.textGold;
        ctx.fillText('Return to ' + def.npcName, panelX + 36, ry + 48);
      } else {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`Progress: ${state.count} / ${def.goalCount}`, panelX + 36, ry + 48);
      }

      // Divider
      if (row > 0) {
        ctx.strokeStyle = 'rgba(90, 74, 58, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 10, ry - 4);
        ctx.lineTo(panelX + panelW - 10, ry - 4);
        ctx.stroke();
      }

      row++;
    }

    if (row === 0) {
      ctx.fillStyle = COLORS.textDark;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No active quests.', CANVAS_WIDTH / 2, panelY + panelH / 2);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[Q / ESC] Close', CANVAS_WIDTH / 2, panelY + panelH - 12);
    ctx.textAlign = 'left';
  }

  drawQuestRewardPanel(
    ctx: CanvasRenderingContext2D,
    questName: string,
    rewards: string[],
    timer: number,
    totalFrames: number
  ): void {
    const fadeFrames = 30;
    const alpha = timer <= fadeFrames ? timer / fadeFrames : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    const panelW = 380;
    const panelH = 50 + rewards.length * 24 + 20;
    const panelX = CANVAS_WIDTH / 2 - panelW / 2;
    const panelY = CANVAS_HEIGHT / 2 - panelH / 2 - 40;

    ctx.fillStyle = 'rgba(10, 25, 10, 0.92)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#55aa55';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#66ee66';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QUEST COMPLETE', CANVAS_WIDTH / 2, panelY + 22);

    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(questName, CANVAS_WIDTH / 2, panelY + 40);

    ctx.strokeStyle = '#336633';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 20, panelY + 48);
    ctx.lineTo(panelX + panelW - 20, panelY + 48);
    ctx.stroke();

    ctx.font = '13px monospace';
    rewards.forEach((r, i) => {
      ctx.fillStyle = COLORS.textGold;
      ctx.fillText(r, CANVAS_WIDTH / 2, panelY + 64 + i * 24);
    });

    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawCharacterSelectScreen(ctx: CanvasRenderingContext2D, cursor: number): void {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 32px monospace';
    ctx.fillText('Choose Your Hero', CANVAS_WIDTH / 2, 100);

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '16px monospace';
    ctx.fillText('Select your character', CANVAS_WIDTH / 2, 135);

    const options: Array<'male' | 'female'> = ['male', 'female'];
    const labels = ['Man', 'Woman'];
    const cardW = 160;
    const cardH = 200;
    const cardY = 175;
    const spacing = 60;
    const totalW = options.length * cardW + (options.length - 1) * spacing;
    const startX = CANVAS_WIDTH / 2 - totalW / 2;

    options.forEach((gender, i) => {
      const cardX = startX + i * (cardW + spacing);
      const isSelected = cursor === i;

      // Card background
      ctx.fillStyle = isSelected ? 'rgba(90, 74, 58, 0.9)' : 'rgba(30, 25, 35, 0.9)';
      ctx.fillRect(cardX, cardY, cardW, cardH);

      // Card border
      ctx.strokeStyle = isSelected ? COLORS.textGold : COLORS.border;
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Draw avatar preview (scaled up 3x) centered in card
      const avatarScale = 3;
      const avatarW = 32 * avatarScale;
      const avatarCenterX = cardX + cardW / 2;
      const avatarDrawX = avatarCenterX - avatarW / 2;
      const avatarDrawY = cardY + 20;

      ctx.save();
      ctx.translate(avatarDrawX, avatarDrawY);
      ctx.scale(avatarScale, avatarScale);
      drawPlayer(ctx, 0, 0, 0, 'down', undefined, undefined, gender);
      ctx.restore();

      // Label
      ctx.textAlign = 'center';
      ctx.fillStyle = isSelected ? COLORS.textGold : COLORS.text;
      ctx.font = `${isSelected ? 'bold ' : ''}20px monospace`;
      ctx.fillText(labels[i], cardX + cardW / 2, cardY + cardH - 20);

      // Selection indicator
      if (isSelected) {
        ctx.fillStyle = COLORS.textGold;
        ctx.font = '20px monospace';
        ctx.fillText('▲', cardX + cardW / 2, cardY - 10);
      }
    });

    // Instructions
    ctx.fillStyle = COLORS.textDark;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[A/D] or [←/→] Select   [SPACE/ENTER] Confirm', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50);
    ctx.textAlign = 'left';
  }

  drawClassSelectScreen(ctx: CanvasRenderingContext2D, cursor: number): void {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textGold;
    ctx.font = 'bold 32px monospace';
    ctx.fillText('Choose Your Path', CANVAS_WIDTH / 2, 80);

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '15px monospace';
    ctx.fillText('You have grown strong enough to master a discipline. This choice is permanent.', CANVAS_WIDTH / 2, 115);

    const classes: Array<{
      path: ClassPath;
      label: string;
      color: string;
      stats: string;
      ability: string;
      abilityDesc: string;
    }> = [
      {
        path: ClassPath.WARRIOR,
        label: 'WARRIOR',
        color: '#c04040',
        stats: '+2 DEF',
        ability: 'Shield Bash',
        abilityDesc: 'Stun the enemy for one turn'
      },
      {
        path: ClassPath.SCOUT,
        label: 'SCOUT',
        color: '#40a040',
        stats: '+2 AGI',
        ability: 'Ambush',
        abilityDesc: 'Guaranteed critical hit (once per fight)'
      },
      {
        path: ClassPath.BRIGAND,
        label: 'BRIGAND',
        color: '#9040c0',
        stats: '+2 STR',
        ability: 'Intimidate',
        abilityDesc: 'Reduce enemy ATK by 3 for 3 turns'
      }
    ];

    const cardW = 230;
    const cardH = 310;
    const cardY = 150;
    const spacing = 40;
    const totalW = classes.length * cardW + (classes.length - 1) * spacing;
    const startX = CANVAS_WIDTH / 2 - totalW / 2;

    classes.forEach((cls, i) => {
      const cardX = startX + i * (cardW + spacing);
      const isSelected = cursor === i;

      ctx.fillStyle = isSelected ? 'rgba(50, 40, 70, 0.95)' : 'rgba(25, 20, 35, 0.9)';
      ctx.fillRect(cardX, cardY, cardW, cardH);

      ctx.strokeStyle = isSelected ? cls.color : COLORS.border;
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Class name header
      ctx.fillStyle = cls.color;
      ctx.font = `bold 20px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(cls.label, cardX + cardW / 2, cardY + 38);

      // Divider
      ctx.strokeStyle = cls.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 20, cardY + 50);
      ctx.lineTo(cardX + cardW - 20, cardY + 50);
      ctx.stroke();

      // Stat bonus
      ctx.fillStyle = '#a8e0a8';
      ctx.font = '15px monospace';
      ctx.fillText(cls.stats, cardX + cardW / 2, cardY + 78);

      // Flee modifier flavour
      const fleeNote = cls.path === ClassPath.SCOUT   ? 'Easier to flee'  :
                       cls.path === ClassPath.WARRIOR ? 'Harder to flee' : '';
      if (fleeNote) {
        ctx.fillStyle = COLORS.textDark;
        ctx.font = '12px monospace';
        ctx.fillText(fleeNote, cardX + cardW / 2, cardY + 98);
      }

      // Ability name
      ctx.fillStyle = '#a0d8ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`[5] ${cls.ability}`, cardX + cardW / 2, cardY + 140);

      // Ability description (word-wrapped to two lines)
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px monospace';
      const words = cls.abilityDesc.split(' ');
      let line = '';
      let lineY = cardY + 162;
      words.forEach(w => {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > cardW - 20 && line !== '') {
          ctx.fillText(line.trim(), cardX + cardW / 2, lineY);
          line = w + ' ';
          lineY += 18;
        } else {
          line = test;
        }
      });
      if (line.trim()) ctx.fillText(line.trim(), cardX + cardW / 2, lineY);

      if (isSelected) {
        ctx.fillStyle = cls.color;
        ctx.font = '20px monospace';
        ctx.fillText('▲', cardX + cardW / 2, cardY - 10);
      }
    });

    ctx.fillStyle = COLORS.textDark;
    ctx.font = '14px monospace';
    ctx.fillText('[A/D] or [←/→] Select   [SPACE/ENTER] Confirm', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.textAlign = 'left';
  }
}
