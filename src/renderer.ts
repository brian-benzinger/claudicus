import { TileType, EnemyType, NpcDef, TILE_SIZE, WeaponSpeed } from './types';

// Color palette - medieval/earthy tones
const COLORS = {
  // Ground
  grass: '#4a7c23',
  grassDark: '#3d6b1c',
  dirt: '#8b7355',
  cobblestone: '#6b6b6b',
  water: '#2e5a8b',
  waterLight: '#3a6fa8',

  // Structures
  wall: '#5c5c5c',
  wallDark: '#4a4a4a',
  wood: '#6b4423',
  woodDark: '#4a2f17',
  woodLight: '#8b5a2b',
  roof: '#8b2500',
  roofDark: '#6b1c00',
  door: '#3d2817',
  well: '#555555',
  wellWater: '#1a3a5c',

  // Nature
  tree: '#2d5a1e',
  treeDark: '#1e4015',
  trunk: '#4a3728',
  fence: '#6b4423',
  rock: '#5a5a5a',
  rockLight: '#707070',

  // Player
  playerBody: '#4a3728',
  playerHead: '#d4a574',
  playerOutline: '#2a1f14',

  // Enemies
  wolfBody: '#6b6b6b',
  wolfDark: '#4a4a4a',
  wolfEyes: '#cc3333',
  banditBody: '#8b2500',
  banditDark: '#5c1a00',
  skeletonBody: '#e8e8d8',
  skeletonDark: '#c8c8b8',
  boarBody: '#6b4423',
  boarDark: '#4a2f17',

  // UI
  hpBar: '#cc3333',
  hpBarBg: '#333333',
  gold: '#ffd700',
  text: '#ffffff',
  textDark: '#000000',
  menuBg: 'rgba(20, 20, 30, 0.9)',
  menuBorder: '#5a4a3a'
};

// Seeded PRNG — returns a deterministic sequence of [0,1) values for a given tile position
function tilePrng(x: number, y: number) {
  let seed = (x * 1619 + y * 31337) ^ 0xdeadbeef;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
}

// Draw a single tile
export function drawTile(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number): void {
  const s = TILE_SIZE;

  switch (type) {
    case TileType.GRASS:
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      // Add some texture
      ctx.fillStyle = COLORS.grassDark;
      for (let i = 0; i < 3; i++) {
        const gx = x + Math.floor(Math.random() * 28) + 2;
        const gy = y + Math.floor(Math.random() * 28) + 2;
        ctx.fillRect(gx, gy, 2, 4);
      }
      break;

    case TileType.DARK_GRASS:
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.grass;
      for (let i = 0; i < 2; i++) {
        const gx = x + Math.floor(Math.random() * 26) + 3;
        const gy = y + Math.floor(Math.random() * 26) + 3;
        ctx.fillRect(gx, gy, 2, 3);
      }
      break;

    case TileType.DIRT:
      ctx.fillStyle = COLORS.dirt;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#7a6348';
      ctx.fillRect(x + 5, y + 8, 3, 3);
      ctx.fillRect(x + 20, y + 15, 4, 2);
      break;

    case TileType.COBBLESTONE:
      ctx.fillStyle = COLORS.cobblestone;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, 12, 12);
      ctx.strokeRect(x + 16, y + 2, 14, 12);
      ctx.strokeRect(x + 2, y + 16, 14, 14);
      ctx.strokeRect(x + 18, y + 16, 12, 14);
      break;

    case TileType.WATER:
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.waterLight;
      ctx.fillRect(x + 4, y + 8, 8, 2);
      ctx.fillRect(x + 18, y + 16, 10, 2);
      break;

    case TileType.WALL:
    case TileType.BUILDING_WALL:
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.wallDark;
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y, 2, s);
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 4, 10, 6);
      ctx.strokeRect(x + 18, y + 4, 10, 6);
      ctx.strokeRect(x + 4, y + 18, 10, 10);
      ctx.strokeRect(x + 18, y + 18, 10, 10);
      break;

    case TileType.TREE: {
      const rng = tilePrng(x, y);
      // Grass base
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(x, y, s, s);

      // Randomise trunk: width 6–10, height 10–16, offset ±3px from centre
      const trunkW = 6 + Math.floor(rng() * 5);
      const trunkH = 10 + Math.floor(rng() * 7);
      const trunkOffX = Math.floor(rng() * 7) - 3;
      const trunkX = x + 16 - trunkW / 2 + trunkOffX;
      const trunkY = y + s - trunkH;
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(trunkX, trunkY, trunkW, trunkH);

      // Randomise canopy: 2–3 overlapping blobs of varying radius and position
      const blobCount = 2 + Math.floor(rng() * 2); // 2 or 3
      const canopyR = 11 + Math.floor(rng() * 5);  // main radius 11–15
      const canopyCX = x + 14 + Math.floor(rng() * 5);
      const canopyCY = y + 10 + Math.floor(rng() * 5);

      // Main blob
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath();
      ctx.arc(canopyCX, canopyCY, canopyR, 0, Math.PI * 2);
      ctx.fill();

      // Additional highlight/shadow blobs
      for (let b = 1; b < blobCount; b++) {
        const bOffX = Math.floor(rng() * 14) - 7;
        const bOffY = Math.floor(rng() * 10) - 5;
        const bR = 5 + Math.floor(rng() * 6);
        const dark = rng() > 0.4;
        ctx.fillStyle = dark ? COLORS.treeDark : '#3a7028';
        ctx.beginPath();
        ctx.arc(canopyCX + bOffX, canopyCY + bOffY, bR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small dark shadow blob always present
      ctx.fillStyle = COLORS.treeDark;
      ctx.beginPath();
      ctx.arc(canopyCX + Math.floor(rng() * 8) - 4, canopyCY + Math.floor(rng() * 6), 4 + Math.floor(rng() * 4), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.FENCE:
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.fence;
      // Vertical posts
      ctx.fillRect(x + 2, y + 8, 4, 20);
      ctx.fillRect(x + 26, y + 8, 4, 20);
      // Horizontal rails
      ctx.fillRect(x, y + 12, s, 4);
      ctx.fillRect(x, y + 22, s, 3);
      break;

    case TileType.ROCK:
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.rock;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.rockLight;
      ctx.beginPath();
      ctx.ellipse(x + 14, y + 15, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TileType.DOOR:
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(x + 8, y + 6, 16, 26);
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(x + 10, y + 8, 12, 22);
      // Door handle
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(x + 18, y + 18, 3, 3);
      break;

    case TileType.WELL:
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      // Well base
      ctx.fillStyle = COLORS.well;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 20, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Water inside
      ctx.fillStyle = COLORS.wellWater;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 20, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Well rim
      ctx.strokeStyle = COLORS.wallDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18, 12, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case TileType.GATE:
      ctx.fillStyle = COLORS.dirt;
      ctx.fillRect(x, y, s, s);
      // Gate posts
      ctx.fillStyle = COLORS.wood;
      ctx.fillRect(x + 2, y, 6, s);
      ctx.fillRect(x + 24, y, 6, s);
      // Arch top
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(x + 2, y, 28, 6);
      break;

    default:
      ctx.fillStyle = '#ff00ff'; // Magenta for missing tiles
      ctx.fillRect(x, y, s, s);
  }
}

// Draw a small overworld weapon held in the player's hand
function drawOverworldWeapon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bob: number,
  facing: 'up' | 'down' | 'left' | 'right',
  speed: WeaponSpeed
): void {
  ctx.save();

  // Colour by type
  const bladeColor  = speed === WeaponSpeed.RANGED ? COLORS.wood : '#c8c8d4';
  const handleColor = COLORS.trunk;

  if (speed === WeaponSpeed.RANGED) {
    // Bow: small arc on the right side of the player
    const bx = x + (facing === 'left' ? 2 : 26);
    const by = y + 12 + bob;
    ctx.strokeStyle = COLORS.wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 7,
      facing === 'left' ? Math.PI * 0.6  : -Math.PI * 0.6,
      facing === 'left' ? Math.PI * 1.4  :  Math.PI * 0.6);
    ctx.stroke();
    // String
    ctx.strokeStyle = '#e8d8a0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const capAngle = facing === 'left' ? Math.PI : 0;
    ctx.moveTo(bx + Math.cos(capAngle - Math.PI * 0.6) * 7,
               by + Math.sin(capAngle - Math.PI * 0.6) * 7 - 6);
    ctx.lineTo(bx + Math.cos(capAngle + Math.PI * 0.6) * 7,
               by + Math.sin(capAngle + Math.PI * 0.6) * 7 + 6);
    ctx.stroke();
  } else {
    // Melee: handle + blade, length varies by speed
    const bladeLen = speed === WeaponSpeed.FAST ? 7
                   : speed === WeaponSpeed.SLOW ? 14
                   : 10; // NORMAL

    // Position grip at shoulder; direction depends on facing
    let gx: number, gy: number, angle: number;
    if (facing === 'right') {
      gx = x + 26; gy = y + 14 + bob; angle = -Math.PI / 6;
    } else if (facing === 'left') {
      gx = x + 6;  gy = y + 14 + bob; angle = Math.PI + Math.PI / 6;
    } else if (facing === 'up') {
      gx = x + 24; gy = y + 12 + bob; angle = -Math.PI / 2 - Math.PI / 6;
    } else { // down
      gx = x + 8;  gy = y + 14 + bob; angle = Math.PI / 2 + Math.PI / 6;
    }

    const cos = Math.cos(angle), sin = Math.sin(angle);

    // Handle (3px)
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + cos * 3, gy + sin * 3);
    ctx.stroke();

    // Blade
    ctx.strokeStyle = bladeColor;
    ctx.lineWidth = speed === WeaponSpeed.SLOW ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(gx + cos * 3, gy + sin * 3);
    ctx.lineTo(gx + cos * (3 + bladeLen), gy + sin * (3 + bladeLen));
    ctx.stroke();

    // Crossguard for NORMAL/SLOW
    if (speed !== WeaponSpeed.FAST) {
      const gLen = speed === WeaponSpeed.SLOW ? 4 : 3;
      const px = gx + cos * 3, py = gy + sin * 3;
      ctx.strokeStyle = '#888899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - sin * gLen, py + cos * gLen);
      ctx.lineTo(px + sin * gLen, py - cos * gLen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Draw player sprite
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  facing: 'up' | 'down' | 'left' | 'right',
  weaponSpeed?: WeaponSpeed
): void {
  const bob = Math.sin(frame * 0.2) * 1;

  // Draw weapon behind player when facing up
  if (weaponSpeed !== undefined && (facing === 'up')) {
    drawOverworldWeapon(ctx, x, y, bob, facing, weaponSpeed);
  }

  // Body
  ctx.fillStyle = COLORS.playerBody;
  ctx.fillRect(x + 6, y + 10 + bob, 20, 18);

  // Body outline
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 10 + bob, 20, 18);

  // Head
  ctx.fillStyle = COLORS.playerHead;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8 + bob, 7, 0, Math.PI * 2);
  ctx.fill();

  // Eyes based on facing
  ctx.fillStyle = COLORS.textDark;
  if (facing === 'down') {
    ctx.fillRect(x + 13, y + 7 + bob, 2, 2);
    ctx.fillRect(x + 17, y + 7 + bob, 2, 2);
  } else if (facing === 'up') {
    // No eyes visible from behind
  } else if (facing === 'left') {
    ctx.fillRect(x + 11, y + 7 + bob, 2, 2);
  } else {
    ctx.fillRect(x + 19, y + 7 + bob, 2, 2);
  }

  // Legs
  ctx.fillStyle = COLORS.woodDark;
  const legOffset = Math.sin(frame * 0.3) * 2;
  ctx.fillRect(x + 8, y + 26 + bob, 6, 6 + legOffset);
  ctx.fillRect(x + 18, y + 26 + bob, 6, 6 - legOffset);

  // Draw weapon in front of player when facing down/left/right
  if (weaponSpeed !== undefined && facing !== 'up') {
    drawOverworldWeapon(ctx, x, y, bob, facing, weaponSpeed);
  }
}

// Draw wolf
export function drawWolf(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Body
  ctx.fillStyle = COLORS.wolfBody;
  ctx.fillRect(x + 4, y + 12, 24, 14);

  // Head
  ctx.fillStyle = COLORS.wolfBody;
  ctx.fillRect(x + 22, y + 10, 10, 10);

  // Snout
  ctx.fillStyle = COLORS.wolfDark;
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 15);
  ctx.lineTo(x + 32, y + 20);
  ctx.lineTo(x + 28, y + 17);
  ctx.fill();

  // Eyes
  ctx.fillStyle = COLORS.wolfEyes;
  ctx.fillRect(x + 26, y + 12, 2, 2);

  // Tail
  ctx.fillStyle = COLORS.wolfDark;
  ctx.fillRect(x + 2, y + 10, 6, 4);

  // Legs
  ctx.fillStyle = COLORS.wolfDark;
  ctx.fillRect(x + 6, y + 24, 4, 6);
  ctx.fillRect(x + 14, y + 24, 4, 6);
  ctx.fillRect(x + 22, y + 24, 4, 6);
}

// Draw bandit
export function drawBandit(ctx: CanvasRenderingContext2D, x: number, y: number, isArcher: boolean): void {
  // Body
  ctx.fillStyle = COLORS.banditBody;
  ctx.fillRect(x + 6, y + 10, 20, 18);

  // Hood
  ctx.fillStyle = COLORS.banditDark;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.lineTo(x + 16, y + 2);
  ctx.lineTo(x + 24, y + 10);
  ctx.fill();

  // Face
  ctx.fillStyle = COLORS.playerHead;
  ctx.beginPath();
  ctx.arc(x + 16, y + 12, 5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = COLORS.textDark;
  ctx.fillRect(x + 13, y + 11, 2, 2);
  ctx.fillRect(x + 17, y + 11, 2, 2);

  // Legs
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x + 8, y + 26, 6, 6);
  ctx.fillRect(x + 18, y + 26, 6, 6);

  // Bow for archer
  if (isArcher) {
    ctx.strokeStyle = COLORS.wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 28, y + 16, 8, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    // Arrow
    ctx.strokeStyle = COLORS.woodDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 26, y + 16);
    ctx.lineTo(x + 32, y + 16);
    ctx.stroke();
  }
}

// Draw skeleton
export function drawSkeleton(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Ribcage
  ctx.fillStyle = COLORS.skeletonBody;
  ctx.fillRect(x + 8, y + 10, 16, 14);
  ctx.fillStyle = COLORS.skeletonDark;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 10, y + 12 + i * 3, 12, 1);
  }

  // Skull
  ctx.fillStyle = COLORS.skeletonBody;
  ctx.beginPath();
  ctx.arc(x + 16, y + 6, 6, 0, Math.PI * 2);
  ctx.fill();

  // Eye sockets
  ctx.fillStyle = COLORS.textDark;
  ctx.fillRect(x + 12, y + 4, 3, 3);
  ctx.fillRect(x + 17, y + 4, 3, 3);

  // Jaw
  ctx.fillStyle = COLORS.skeletonDark;
  ctx.fillRect(x + 12, y + 9, 8, 2);

  // Arms
  ctx.fillStyle = COLORS.skeletonBody;
  ctx.fillRect(x + 4, y + 12, 4, 12);
  ctx.fillRect(x + 24, y + 12, 4, 12);

  // Legs
  ctx.fillRect(x + 10, y + 24, 4, 8);
  ctx.fillRect(x + 18, y + 24, 4, 8);
}

// Draw wild boar
export function drawWildBoar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Body
  ctx.fillStyle = COLORS.boarBody;
  ctx.fillRect(x + 4, y + 12, 24, 12);

  // Head
  ctx.fillStyle = COLORS.boarBody;
  ctx.fillRect(x + 22, y + 10, 10, 12);

  // Snout
  ctx.fillStyle = COLORS.playerHead;
  ctx.fillRect(x + 28, y + 14, 6, 6);

  // Eyes
  ctx.fillStyle = COLORS.textDark;
  ctx.fillRect(x + 26, y + 12, 2, 2);

  // Tusks
  ctx.fillStyle = COLORS.skeletonBody;
  ctx.fillRect(x + 30, y + 20, 2, 4);

  // Legs
  ctx.fillStyle = COLORS.boarDark;
  ctx.fillRect(x + 6, y + 22, 4, 8);
  ctx.fillRect(x + 14, y + 22, 4, 8);
  ctx.fillRect(x + 22, y + 22, 4, 8);

  // Tail
  ctx.fillStyle = COLORS.boarDark;
  ctx.fillRect(x + 2, y + 14, 4, 2);
}

// Draw enemy by type
export function drawEnemy(ctx: CanvasRenderingContext2D, type: EnemyType, x: number, y: number): void {
  switch (type) {
    case EnemyType.WOLF:
      drawWolf(ctx, x, y);
      break;
    case EnemyType.BANDIT:
      drawBandit(ctx, x, y, false);
      break;
    case EnemyType.BANDIT_ARCHER:
      drawBandit(ctx, x, y, true);
      break;
    case EnemyType.SKELETON:
      drawSkeleton(ctx, x, y);
      break;
    case EnemyType.WILD_BOAR:
      drawWildBoar(ctx, x, y);
      break;
  }
}

// Draw weapon sprite, pivoted at (0,0) = grip, blade extends in +x when angle=0
function drawWeaponSprite(ctx: CanvasRenderingContext2D, speed: WeaponSpeed): void {
  switch (speed) {
    case WeaponSpeed.FAST: // dagger
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, -1, 10, 3);   // blade
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-6, -2, 6, 5);   // handle
      ctx.fillStyle = '#a08030';
      ctx.fillRect(-1, -3, 2, 7);   // crossguard
      break;

    case WeaponSpeed.NORMAL: // longsword
      ctx.fillStyle = '#d0d8e0';
      ctx.fillRect(0, -1, 18, 3);   // blade
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-8, -2, 8, 5);   // handle
      ctx.fillStyle = '#a08030';
      ctx.fillRect(-1, -4, 2, 9);   // crossguard
      break;

    case WeaponSpeed.SLOW: // halberd / mace — long heavy weapon
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-12, -2, 26, 4); // long pole
      ctx.fillStyle = '#808898';
      ctx.fillRect(10, -6, 5, 13);  // axe blade
      ctx.fillRect(13, -3, 6, 7);   // axe body
      break;

    case WeaponSpeed.RANGED: // hunting bow — drawn vertically, held at left
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      // bowstring
      ctx.strokeStyle = '#d4b896';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();
      break;
  }
}

// Draw player with weapon, used in combat screen (called inside a translated+scaled ctx)
export function drawCombatPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  weaponSpeed: WeaponSpeed,
  attackProgress: number  // -1 = idle, 0..1 = attack animation
): void {
  drawPlayer(ctx, x, y, frame, 'right');

  const bob = Math.sin(frame * 0.2);

  if (weaponSpeed === WeaponSpeed.RANGED) {
    // Bow is held vertically in the left hand, pointing up
    const bowX = x + 8;
    const bowY = y + 14 + bob;
    const pullback = attackProgress >= 0 && attackProgress < 0.5
      ? attackProgress * 2 * 5  // string pulls back up to 5px
      : attackProgress >= 0.5
        ? (1 - (attackProgress - 0.5) * 2) * 5
        : 0;

    ctx.save();
    ctx.translate(bowX, bowY);
    ctx.rotate(-Math.PI / 2); // bow points up
    drawWeaponSprite(ctx, WeaponSpeed.RANGED);

    // Draw taut string when pulling
    if (pullback > 0) {
      ctx.strokeStyle = '#d4b896';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(pullback, 0);
      ctx.lineTo(0, 10);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Melee weapons: extend from right hand
  const handX = x + 26;
  const handY = y + 14 + bob;

  // Compute weapon angle based on type and progress
  let angle = 0;
  if (attackProgress < 0) {
    // Idle stance
    switch (weaponSpeed) {
      case WeaponSpeed.FAST:   angle = -0.35; break;
      case WeaponSpeed.NORMAL: angle = -0.6;  break;
      case WeaponSpeed.SLOW:   angle = -Math.PI / 2; break;
    }
  } else {
    const p = attackProgress;
    switch (weaponSpeed) {
      case WeaponSpeed.FAST:
        // Two quick stabs: extend to 0 then retract, twice
        if      (p < 0.25) angle = -0.35 + (p / 0.25) * 0.35;
        else if (p < 0.5)  angle = -((p - 0.25) / 0.25) * 0.35;
        else if (p < 0.75) angle = -0.2 + ((p - 0.5) / 0.25) * 0.2;
        else               angle = -((1 - p) / 0.25) * 0.2;
        break;

      case WeaponSpeed.NORMAL:
        // Diagonal slash: sweep from -60° down to +50°, then snap back
        if (p < 0.65) angle = -1.05 + (p / 0.65) * 1.9;
        else          angle = 0.85 - ((p - 0.65) / 0.35) * 1.45;
        break;

      case WeaponSpeed.SLOW:
        // Overhead slam: raise weapon back over head, then slam down hard
        if      (p < 0.45) angle = -Math.PI / 2 - (p / 0.45) * Math.PI;
        else if (p < 0.55) angle = -Math.PI * 1.5;  // pause at top
        else               angle = -Math.PI * 1.5 + ((p - 0.55) / 0.45) * (Math.PI * 1.5 + 0.4);
        break;
    }
  }

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(angle);
  drawWeaponSprite(ctx, weaponSpeed);
  ctx.restore();
}

// Draw NPC
export function drawNpc(ctx: CanvasRenderingContext2D, npc: NpcDef, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame * 0.1) * 0.5;

  // Body
  ctx.fillStyle = npc.color;
  ctx.fillRect(x + 6, y + 10 + bob, 20, 18);

  // Head
  ctx.fillStyle = COLORS.playerHead;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8 + bob, 7, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = COLORS.textDark;
  ctx.fillRect(x + 13, y + 7 + bob, 2, 2);
  ctx.fillRect(x + 17, y + 7 + bob, 2, 2);

  // Legs
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x + 8, y + 26 + bob, 6, 6);
  ctx.fillRect(x + 18, y + 26 + bob, 6, 6);
}

// Draw chest
export function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
  if (open) {
    // Open chest
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(x + 6, y + 16, 20, 12);
    // Lid (open)
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x + 6, y + 8, 20, 8);
    // Inside (gold glint)
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x + 10, y + 18, 4, 4);
    ctx.fillRect(x + 16, y + 20, 3, 3);
  } else {
    // Closed chest
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(x + 6, y + 12, 20, 16);
    // Lid
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x + 6, y + 12, 20, 6);
    // Clasp
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x + 14, y + 16, 4, 6);
  }
}

// Draw building
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Walls
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(x, y, width * TILE_SIZE, height * TILE_SIZE);

  // Roof
  ctx.fillStyle = COLORS.roof;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + (width * TILE_SIZE) / 2, y - 16);
  ctx.lineTo(x + width * TILE_SIZE + 4, y);
  ctx.fill();
}
