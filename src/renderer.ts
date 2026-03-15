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
  playerBodyFemale: '#2e4a6b',
  playerHair: '#2a1f14',
  playerHairFemale: '#5c3a1e',
  playerDress: '#3a6b9e',
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
// tileX/tileY are the grid coordinates and are used as a stable PRNG seed for tree variation.
export function drawTile(
  ctx: CanvasRenderingContext2D,
  type: TileType,
  x: number,
  y: number,
  tileX: number = 0,
  tileY: number = 0
): void {
  const s = TILE_SIZE;

  switch (type) {
    case TileType.GRASS: {
      const rng = tilePrng(tileX, tileY);
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.grassDark;
      for (let i = 0; i < 3; i++) {
        const gx = x + Math.floor(rng() * 28) + 2;
        const gy = y + Math.floor(rng() * 28) + 2;
        ctx.fillRect(gx, gy, 2, 4);
      }
      break;
    }

    case TileType.DARK_GRASS: {
      const rng = tilePrng(tileX, tileY);
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.grass;
      for (let i = 0; i < 2; i++) {
        const gx = x + Math.floor(rng() * 26) + 3;
        const gy = y + Math.floor(rng() * 26) + 3;
        ctx.fillRect(gx, gy, 2, 3);
      }
      break;
    }

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
      const rng = tilePrng(tileX, tileY);
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

    case TileType.BED:
      // Floor
      ctx.fillStyle = COLORS.wood;
      ctx.fillRect(x, y, s, s);
      // Bed frame
      ctx.fillStyle = COLORS.woodDark;
      ctx.fillRect(x + 4, y + 4, 24, 24);
      // Mattress
      ctx.fillStyle = '#c8b4a0';
      ctx.fillRect(x + 6, y + 6, 20, 16);
      // Pillow
      ctx.fillStyle = '#f0e8e0';
      ctx.fillRect(x + 8, y + 7, 8, 6);
      // Blanket
      ctx.fillStyle = '#7a8cc4';
      ctx.fillRect(x + 6, y + 16, 20, 6);
      // Headboard
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(x + 4, y + 4, 24, 4);
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

// Draw armor overlay on the player body
// Body torso region: (x+6, y+10+bob, 20, 18)
function drawArmorLayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bob: number,
  armorId: string,
  gender: 'male' | 'female'
): void {
  ctx.save();

  const bx = x + 6;       // body left edge
  const by = y + 10 + bob; // body top edge
  const bw = 20;            // body width
  const bh = 18;            // body height

  switch (armorId) {

    case 'leather_vest': {
      // Leather-colored vest over the torso
      ctx.fillStyle = '#9b6435';
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);

      // Shoulder stitching
      ctx.fillStyle = '#6b3d1a';
      ctx.fillRect(bx + 1, by + 1, bw - 2, 3);  // shoulder band

      // Belt line at the base
      ctx.fillStyle = '#5c3010';
      ctx.fillRect(bx + 1, by + bh - 5, bw - 2, 2);

      // Center seam
      ctx.fillStyle = '#7a4a20';
      ctx.fillRect(bx + 9, by + 4, 2, bh - 8);

      // Female: waist-taper side panels (darker strips at sides near waist)
      if (gender === 'female') {
        ctx.fillStyle = '#7a4a20';
        ctx.fillRect(bx + 1, by + 7, 3, 6);  // left taper
        ctx.fillRect(bx + bw - 4, by + 7, 3, 6);  // right taper
      }
      break;
    }

    case 'chain_mail': {
      // Chain mail — gray base with horizontal chain rows
      ctx.fillStyle = '#8a8a9a';
      ctx.fillRect(bx, by, bw, bh);

      // Chain row lines (horizontal)
      ctx.fillStyle = '#6a6a7a';
      for (let row = 0; row < 5; row++) {
        const ry = by + 2 + row * 3;
        ctx.fillRect(bx + 1, ry, bw - 2, 1);
      }

      // Small link squares alternating per row
      ctx.fillStyle = '#9a9aaa';
      for (let row = 0; row < 5; row++) {
        const ry = by + 2 + row * 3;
        const offset = (row % 2) * 3;
        for (let col = offset; col < bw - 2; col += 6) {
          ctx.fillRect(bx + 1 + col, ry - 1, 3, 2);
        }
      }

      // Collar at top
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(bx + 4, by, bw - 8, 3);

      // Female: subtle waist narrowing indicator — darker bands at sides
      if (gender === 'female') {
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(bx, by + 8, 2, 5);
        ctx.fillRect(bx + bw - 2, by + 8, 2, 5);
      }
      // Male: wide shoulder pauldrons
      if (gender === 'male') {
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(bx - 2, by, 4, 5);          // left pauldron
        ctx.fillRect(bx + bw - 2, by, 4, 5);     // right pauldron
      }
      break;
    }

    case 'iron_plate': {
      // Plate armor — silver chest plate
      ctx.fillStyle = '#b8b8c8';
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 3);

      // Outline highlight (top-left) and shadow (bottom-right)
      ctx.fillStyle = '#dcdce8';
      ctx.fillRect(bx + 1, by + 1, bw - 2, 2);  // top highlight
      ctx.fillRect(bx + 1, by + 1, 2, bh - 4);  // left highlight
      ctx.fillStyle = '#7a7a88';
      ctx.fillRect(bx + 1, by + bh - 4, bw - 2, 2);  // bottom shadow
      ctx.fillRect(bx + bw - 3, by + 1, 2, bh - 4);  // right shadow

      // Center breastplate ridge
      ctx.fillStyle = '#9090a0';
      ctx.fillRect(bx + 9, by + 3, 2, bh - 6);

      if (gender === 'male') {
        // Wide square pauldrons with rivets
        ctx.fillStyle = '#a0a0b0';
        ctx.fillRect(bx - 3, by, 5, 7);          // left pauldron
        ctx.fillRect(bx + bw - 2, by, 5, 7);     // right pauldron
        // Rivets
        ctx.fillStyle = '#c8c8d8';
        ctx.fillRect(bx - 2, by + 1, 2, 2);
        ctx.fillRect(bx + bw - 1, by + 1, 2, 2);
        // Gorget (neck guard)
        ctx.fillStyle = '#9090a0';
        ctx.fillRect(bx + 5, by, bw - 10, 3);
      } else {
        // Female: elegant narrower pauldrons and formed breastplate curves
        ctx.fillStyle = '#a0a0b0';
        ctx.fillRect(bx - 1, by + 1, 4, 5);      // left pauldron (smaller)
        ctx.fillRect(bx + bw - 3, by + 1, 4, 5); // right pauldron (smaller)
        // Waist definition — slightly narrowed plate at waist
        ctx.fillStyle = '#9090a0';
        ctx.fillRect(bx + 1, by + 9, 3, 4);      // left waist indent
        ctx.fillRect(bx + bw - 4, by + 9, 3, 4); // right waist indent
        // Decorative chest curve lines
        ctx.fillStyle = '#c8c8d8';
        ctx.fillRect(bx + 5, by + 4, 3, 1);
        ctx.fillRect(bx + 12, by + 4, 3, 1);
      }
      break;
    }

    case 'shadow_cloak': {
      // Dark cloak — slightly wider than body to show draping
      ctx.fillStyle = 'rgba(30, 28, 50, 0.88)';
      ctx.fillRect(bx - 2, by - 1, bw + 4, bh + 2);

      // Lighter inner lining
      ctx.fillStyle = 'rgba(60, 55, 90, 0.6)';
      ctx.fillRect(bx + 3, by + 2, bw - 6, bh - 4);

      // Hood shadow above head (cloak drapes up)
      ctx.fillStyle = 'rgba(20, 18, 36, 0.7)';
      ctx.fillRect(bx + 2, by - 3, bw - 4, 4);

      // Clasp / brooch at center top
      if (gender === 'male') {
        // Simple rectangular clasp
        ctx.fillStyle = '#8888aa';
        ctx.fillRect(bx + 8, by + 1, 4, 3);
      } else {
        // Gem-style round clasp
        ctx.fillStyle = '#aa88cc';
        ctx.beginPath();
        ctx.arc(bx + 10, by + 3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cc99ee';
        ctx.beginPath();
        ctx.arc(bx + 10, by + 2, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    default:
      break; // no armor overlay for unknown / unarmored
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
  weaponSpeed?: WeaponSpeed,
  armorId?: string,
  gender: 'male' | 'female' = 'male'
): void {
  const bob = Math.sin(frame * 0.2) * 1;
  const isFemale = gender === 'female';

  // Draw weapon behind player when facing up
  if (weaponSpeed !== undefined && (facing === 'up')) {
    drawOverworldWeapon(ctx, x, y, bob, facing, weaponSpeed);
  }

  if (isFemale) {
    // Female: long hair behind head (draw before head)
    ctx.fillStyle = COLORS.playerHairFemale;
    ctx.beginPath();
    ctx.arc(x + 16, y + 8 + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    // Hair strands extending down
    ctx.fillRect(x + 7, y + 10 + bob, 4, 14);
    ctx.fillRect(x + 21, y + 10 + bob, 4, 14);

    // Body (tunic)
    ctx.fillStyle = COLORS.playerBodyFemale;
    ctx.fillRect(x + 7, y + 10 + bob, 18, 14);

    // Dress/skirt — wider trapezoid at bottom
    ctx.fillStyle = COLORS.playerDress;
    ctx.beginPath();
    ctx.moveTo(x + 7,  y + 24 + bob);
    ctx.lineTo(x + 25, y + 24 + bob);
    ctx.lineTo(x + 28, y + 32 + bob);
    ctx.lineTo(x + 4,  y + 32 + bob);
    ctx.closePath();
    ctx.fill();

    // Body outline
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 7, y + 10 + bob, 18, 14);
  } else {
    // Male: original body
    ctx.fillStyle = COLORS.playerBody;
    ctx.fillRect(x + 6, y + 10 + bob, 20, 18);

    // Body outline
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6, y + 10 + bob, 20, 18);
  }

  // Armor layer drawn over body
  if (armorId) {
    drawArmorLayer(ctx, x, y, bob, armorId, gender);
  }

  // Head
  ctx.fillStyle = COLORS.playerHead;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8 + bob, isFemale ? 6 : 7, 0, Math.PI * 2);
  ctx.fill();

  // Female: pronounced ponytail
  if (gender === 'female') {
    ctx.fillStyle = COLORS.playerHairFemale;
    if (facing === 'up') {
      // Back view — ponytail hangs straight down, most visible
      ctx.fillRect(x + 12, y + 13 + bob, 8, 2);  // band at base of head
      ctx.fillRect(x + 13, y + 15 + bob, 6, 9);  // main shaft
      ctx.fillRect(x + 14, y + 24 + bob, 4, 4);  // fuller tip
      ctx.fillRect(x + 15, y + 28 + bob, 2, 3);  // taper
    } else if (facing === 'right') {
      // Facing right — ponytail trails to the left (behind)
      ctx.fillRect(x + 6,  y + 7  + bob, 5, 3);  // attachment at back of head
      ctx.fillRect(x + 4,  y + 10 + bob, 5, 3);  // shaft curving back/down
      ctx.fillRect(x + 3,  y + 13 + bob, 4, 4);  // lower shaft
      ctx.fillRect(x + 4,  y + 17 + bob, 3, 3);  // tip
    } else if (facing === 'left') {
      // Facing left — ponytail trails to the right (behind)
      ctx.fillRect(x + 21, y + 7  + bob, 5, 3);  // attachment at back of head
      ctx.fillRect(x + 23, y + 10 + bob, 5, 3);  // shaft curving back/down
      ctx.fillRect(x + 25, y + 13 + bob, 4, 4);  // lower shaft
      ctx.fillRect(x + 25, y + 17 + bob, 3, 3);  // tip
    } else {
      // Down / front view — ponytail peeks as a bun above the head
      ctx.fillRect(x + 13, y + 1  + bob, 6, 3);  // bun base
      ctx.fillRect(x + 14, y - 1  + bob, 4, 3);  // bun top
    }
  }

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

  if (!isFemale) {
    // Legs (male only — female has dress)
    ctx.fillStyle = COLORS.woodDark;
    const legOffset = Math.sin(frame * 0.3) * 2;
    ctx.fillRect(x + 8, y + 26 + bob, 6, 6 + legOffset);
    ctx.fillRect(x + 18, y + 26 + bob, 6, 6 - legOffset);
  }

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

// Draw revenant knight (armored undead boss)
export function drawRevenantKnight(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Armored torso (dark steel plate)
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x + 7, y + 9, 18, 16);
  // Chest plate highlight
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(x + 9, y + 10, 8, 5);

  // Helmet
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x + 9, y + 2, 14, 10);
  // Visor slit
  ctx.fillStyle = '#1a1a28';
  ctx.fillRect(x + 11, y + 5, 10, 3);
  // Glowing eyes through visor
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x + 12, y + 6, 3, 2);
  ctx.fillRect(x + 17, y + 6, 3, 2);

  // Pauldrons (shoulder guards)
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x + 2, y + 9, 7, 8);
  ctx.fillRect(x + 23, y + 9, 7, 8);

  // Arms (armored gauntlets)
  ctx.fillRect(x + 2, y + 17, 5, 9);
  ctx.fillRect(x + 25, y + 17, 5, 9);

  // Legs (greaves)
  ctx.fillRect(x + 9, y + 25, 5, 7);
  ctx.fillRect(x + 18, y + 25, 5, 7);

  // Sword (right side, upright)
  ctx.fillStyle = '#9090a0';
  ctx.fillRect(x + 28, y + 8, 3, 20);
  // Gold crossguard
  ctx.fillStyle = '#c8a030';
  ctx.fillRect(x + 24, y + 13, 11, 3);

  // Shield (left side)
  ctx.fillStyle = '#4a4a5a';
  ctx.fillRect(x - 4, y + 10, 8, 14);
  // Gold emblem on shield
  ctx.fillStyle = '#c8a030';
  ctx.beginPath();
  ctx.arc(x, y + 17, 3, 0, Math.PI * 2);
  ctx.fill();

  // Dark outline/shadow
  ctx.strokeStyle = '#1a1a28';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 7, y + 9, 18, 16);
  ctx.strokeRect(x + 9, y + 2, 14, 10);
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
    case EnemyType.REVENANT_KNIGHT:
      drawRevenantKnight(ctx, x, y);
      break;
  }
}

// Draw weapon sprite, pivoted at (0,0) = grip, blade extends in +x when angle=0
function drawWeaponSprite(ctx: CanvasRenderingContext2D, speed: WeaponSpeed, weaponId?: string): void {
  switch (speed) {
    case WeaponSpeed.FAST: // dagger
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, -1, 10, 3);   // blade
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-6, -2, 6, 5);   // handle
      ctx.fillStyle = '#a08030';
      ctx.fillRect(-1, -3, 2, 7);   // crossguard
      break;

    case WeaponSpeed.NORMAL:
      if (weaponId === 'hand_axe') {
        // Hand axe — short handle, wide single-sided blade
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-6, -2, 10, 4);  // short handle
        ctx.fillStyle = '#a08030';
        ctx.fillRect(3, -3, 3, 6);    // collar
        ctx.fillStyle = '#909aa8';
        ctx.fillRect(6, -8, 8, 16);   // blade body (wide, tall)
        ctx.fillStyle = '#b8c4d0';
        ctx.fillRect(6, -11, 5, 4);   // top hook
        ctx.fillRect(6, 8, 4, 3);     // bottom beard
      } else {
        // longsword / shortsword
        ctx.fillStyle = '#d0d8e0';
        ctx.fillRect(0, -1, 18, 3);   // blade
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-8, -2, 8, 5);   // handle
        ctx.fillStyle = '#a08030';
        ctx.fillRect(-1, -4, 2, 9);   // crossguard
      }
      break;

    case WeaponSpeed.SLOW:
      if (weaponId === 'mace') {
        // Mace — shaft with round flanged head
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-12, -2, 22, 4); // shaft
        ctx.fillStyle = '#a08030';
        ctx.fillRect(7, -3, 3, 6);    // collar ring
        ctx.fillStyle = '#6e7880';
        ctx.beginPath();
        ctx.arc(14, 0, 7, 0, Math.PI * 2);
        ctx.fill();                    // round ball head
        ctx.fillStyle = '#a8b4c0';
        ctx.fillRect(9, -11, 9, 4);   // top flange
        ctx.fillRect(9, 7, 9, 4);     // bottom flange
        ctx.fillRect(19, -2, 4, 4);   // front flange
      } else if (weaponId === 'halberd') {
        // Halberd — long polearm with axe blade and top spike
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-14, -2, 30, 4); // long pole
        ctx.fillStyle = '#a08030';
        ctx.fillRect(12, -3, 3, 6);   // collar
        ctx.fillStyle = '#808898';
        ctx.fillRect(13, -14, 5, 16); // blade stem
        ctx.fillRect(8, -14, 10, 5);  // blade top (wide)
        ctx.fillRect(14, -18, 3, 5);  // tip spike
        ctx.fillStyle = '#a0acb8';
        ctx.fillRect(9, 2, 6, 4);     // back beard
      } else {
        // fallback
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-12, -2, 26, 4); // long pole
        ctx.fillStyle = '#808898';
        ctx.fillRect(10, -6, 5, 13);  // axe blade
        ctx.fillRect(13, -3, 6, 7);   // axe body
      }
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
  attackProgress: number,  // -1 = idle, 0..1 = attack animation
  armorId?: string,
  gender: 'male' | 'female' = 'male',
  weaponId?: string
): void {
  drawPlayer(ctx, x, y, frame, 'right', undefined, armorId, gender);

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
    drawWeaponSprite(ctx, WeaponSpeed.RANGED, weaponId);

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
  drawWeaponSprite(ctx, weaponSpeed, weaponId);
  ctx.restore();
}

// Draw NPC
export function drawNpc(ctx: CanvasRenderingContext2D, npc: NpcDef, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame * 0.1) * 0.5;

  // Hood drawn first (behind head) for monk-style NPCs
  if (npc.hatColor && npc.hatStyle === 'hood') {
    ctx.fillStyle = npc.hatColor;
    ctx.beginPath();
    ctx.arc(x + 16, y + 8 + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    // Hood point
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 4 + bob);
    ctx.lineTo(x + 16, y - 4 + bob);
    ctx.lineTo(x + 22, y + 4 + bob);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = npc.color;
  ctx.fillRect(x + 6, y + 10 + bob, 20, 18);

  // Apron overlay (over the body)
  if (npc.apronColor) {
    ctx.fillStyle = npc.apronColor;
    ctx.fillRect(x + 9, y + 13 + bob, 14, 13);
    // Apron strings at top
    ctx.fillRect(x + 9, y + 11 + bob, 2, 3);
    ctx.fillRect(x + 21, y + 11 + bob, 2, 3);
  }

  // Head
  ctx.fillStyle = COLORS.playerHead;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8 + bob, 7, 0, Math.PI * 2);
  ctx.fill();

  // Beard / hair tufts below chin
  if (npc.hairColor) {
    ctx.fillStyle = npc.hairColor;
    // Side tufts
    ctx.fillRect(x + 9, y + 12 + bob, 3, 3);
    ctx.fillRect(x + 20, y + 12 + bob, 3, 3);
    // Chin
    ctx.fillRect(x + 13, y + 14 + bob, 6, 2);
  }

  // Eyes
  ctx.fillStyle = COLORS.textDark;
  ctx.fillRect(x + 13, y + 7 + bob, 2, 2);
  ctx.fillRect(x + 17, y + 7 + bob, 2, 2);

  // Hat (drawn over head)
  if (npc.hatColor && npc.hatStyle !== 'hood') {
    ctx.fillStyle = npc.hatColor;
    if (npc.hatStyle === 'tall') {
      // Tall narrow hat (elder)
      ctx.fillRect(x + 11, y - 1 + bob, 10, 8);
      // Brim
      ctx.fillRect(x + 8, y + 2 + bob, 16, 3);
    } else if (npc.hatStyle === 'wide') {
      // Wide brim hat (farmer / herbalist)
      ctx.fillRect(x + 10, y + 1 + bob, 12, 5);
      // Wide brim
      ctx.fillRect(x + 5, y + 4 + bob, 22, 3);
    }
  }

  // Legs
  ctx.fillStyle = npc.legColor ?? COLORS.woodDark;
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
