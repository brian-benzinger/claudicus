import { describe, it, expect, beforeEach } from 'vitest';
import { drawPlayer, drawTile, drawEnemy } from '../renderer';
import { TileType, EnemyType, WeaponSpeed } from '../types';

// ---------------------------------------------------------------------------
// Minimal canvas mock that records every draw call
// ---------------------------------------------------------------------------
type Call = { method: string; args: unknown[] };

function makeCtx() {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const ctx = {
    // state
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    // draw ops
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    ellipse: record('ellipse'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    rotate: record('rotate'),
    fillText: record('fillText'),
    measureText: () => ({ width: 0 }),
    clearRect: record('clearRect'),
    drawImage: record('drawImage'),
    // path ops used by trees etc.
    closePath: record('closePath'),
  } as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

// ---------------------------------------------------------------------------
// drawTile — tree tile determinism
// ---------------------------------------------------------------------------
describe('drawTile — TREE determinism', () => {
  it('produces identical draw calls for the same pixel position', () => {
    const { ctx: ctx1, calls: calls1 } = makeCtx();
    const { ctx: ctx2, calls: calls2 } = makeCtx();

    drawTile(ctx1, TileType.TREE, 64, 96);
    drawTile(ctx2, TileType.TREE, 64, 96);

    expect(calls1).toEqual(calls2);
  });

  it('produces different draw calls for different positions', () => {
    const { ctx: ctx1, calls: calls1 } = makeCtx();
    const { ctx: ctx2, calls: calls2 } = makeCtx();

    drawTile(ctx1, TileType.TREE, 0, 0);
    drawTile(ctx2, TileType.TREE, 32, 32);

    // They may occasionally match by coincidence, but arc radii / positions differ
    expect(calls1).not.toEqual(calls2);
  });

  it('always draws a trunk (fillRect) and at least one canopy arc', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.TREE, 128, 64);

    const rects = calls.filter(c => c.method === 'fillRect');
    const arcs  = calls.filter(c => c.method === 'arc');
    expect(rects.length).toBeGreaterThanOrEqual(2); // grass base + trunk
    expect(arcs.length).toBeGreaterThanOrEqual(2);  // main blob + shadow
  });

  it('does not throw for any grid-aligned position', () => {
    const { ctx } = makeCtx();
    for (let tx = 0; tx < 10; tx++) {
      for (let ty = 0; ty < 10; ty++) {
        expect(() => drawTile(ctx, TileType.TREE, tx * 32, ty * 32)).not.toThrow();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// drawTile — other tile types produce draw calls
// ---------------------------------------------------------------------------
describe('drawTile — all tile types produce draw calls', () => {
  const allTypes: TileType[] = [
    TileType.GRASS, TileType.DIRT, TileType.COBBLESTONE, TileType.WATER,
    TileType.WALL, TileType.TREE, TileType.FENCE, TileType.DARK_GRASS,
    TileType.ROCK, TileType.BUILDING_WALL, TileType.DOOR, TileType.ROOF,
    TileType.WELL, TileType.GATE,
  ];
  for (const type of allTypes) {
    it(`TileType ${type} fills the tile background`, () => {
      const { ctx, calls } = makeCtx();
      drawTile(ctx, type, 0, 0);
      expect(calls.some(c => c.method === 'fillRect')).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// drawPlayer — overworld weapon rendering
// ---------------------------------------------------------------------------
describe('drawPlayer — without weapon', () => {
  it('produces draw calls when facing up', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 100, 100, 0, 'up');
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });

  it('draws body and head (fillRect + arc calls)', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'down');
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
    expect(calls.some(c => c.method === 'arc')).toBe(true);
  });
});

describe('drawPlayer — with weaponSpeed', () => {
  const facings = ['up', 'down', 'left', 'right'] as const;
  const speeds  = [WeaponSpeed.FAST, WeaponSpeed.NORMAL, WeaponSpeed.SLOW, WeaponSpeed.RANGED];

  for (const facing of facings) {
    for (const speed of speeds) {
      it(`WeaponSpeed.${WeaponSpeed[speed]} facing ${facing} produces draw calls`, () => {
        const { ctx, calls } = makeCtx();
        drawPlayer(ctx, 100, 100, 10, facing, speed);
        expect(calls.length).toBeGreaterThan(0);
      });
    }
  }

  it('produces more draw calls with a weapon than without', () => {
    const { ctx: noWeapon,   calls: noWeaponCalls   } = makeCtx();
    const { ctx: withWeapon, calls: withWeaponCalls } = makeCtx();

    drawPlayer(noWeapon,   100, 100, 0, 'right');
    drawPlayer(withWeapon, 100, 100, 0, 'right', WeaponSpeed.NORMAL);

    expect(withWeaponCalls.length).toBeGreaterThan(noWeaponCalls.length);
  });

  it('RANGED weapon draws an arc (bow curve)', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'right', WeaponSpeed.RANGED);
    expect(calls.some(c => c.method === 'arc')).toBe(true);
  });

  it('melee weapons draw lines (blade)', () => {
    for (const speed of [WeaponSpeed.FAST, WeaponSpeed.NORMAL, WeaponSpeed.SLOW]) {
      const { ctx, calls } = makeCtx();
      drawPlayer(ctx, 0, 0, 0, 'right', speed);
      expect(calls.some(c => c.method === 'moveTo' || c.method === 'lineTo')).toBe(true);
    }
  });

  it('weapon drawn behind body when facing up', () => {
    // When facing up the weapon is drawn before the body.
    // We verify weapon-related stroke/moveTo appears before the first fillRect (body).
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'up', WeaponSpeed.NORMAL);

    const firstFillRect = calls.findIndex(c => c.method === 'fillRect');
    const firstMoveTo   = calls.findIndex(c => c.method === 'moveTo');
    // moveTo (weapon blade) should come before first fillRect (body)
    expect(firstMoveTo).toBeGreaterThanOrEqual(0);
    expect(firstMoveTo).toBeLessThan(firstFillRect);
  });
});

// ---------------------------------------------------------------------------
// drawPlayer — gender avatars
// ---------------------------------------------------------------------------
describe('drawPlayer — gender', () => {
  it('male avatar fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'down', undefined, undefined, 'male');
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });

  it('female avatar fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'down', undefined, undefined, 'female');
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });

  it('female avatar produces more arc calls (hair)', () => {
    const { ctx: maleCtx, calls: maleCalls } = makeCtx();
    const { ctx: femaleCtx, calls: femaleCalls } = makeCtx();
    drawPlayer(maleCtx,   0, 0, 0, 'down', undefined, undefined, 'male');
    drawPlayer(femaleCtx, 0, 0, 0, 'down', undefined, undefined, 'female');
    const maleArcs   = maleCalls.filter(c => c.method === 'arc').length;
    const femaleArcs = femaleCalls.filter(c => c.method === 'arc').length;
    expect(femaleArcs).toBeGreaterThan(maleArcs);
  });

  it('female avatar with weapon produces more draw calls than without', () => {
    const { ctx: noWeapon, calls: noWeaponCalls } = makeCtx();
    const { ctx: withWeapon, calls: withWeaponCalls } = makeCtx();
    drawPlayer(noWeapon,   0, 0, 0, 'right', undefined,          undefined, 'female');
    drawPlayer(withWeapon, 0, 0, 0, 'right', WeaponSpeed.NORMAL, undefined, 'female');
    expect(withWeaponCalls.length).toBeGreaterThan(noWeaponCalls.length);
  });
});

// ---------------------------------------------------------------------------
// drawEnemy — all types produce draw calls
// ---------------------------------------------------------------------------
describe('drawEnemy — all enemy types produce draw calls', () => {
  it('WOLF fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WOLF, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
  it('BANDIT fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.BANDIT, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
  it('BANDIT_ARCHER fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.BANDIT_ARCHER, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
  it('SKELETON fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.SKELETON, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
  it('WILD_BOAR fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WILD_BOAR, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
  it('REVENANT_KNIGHT fills body rect', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.REVENANT_KNIGHT, 0, 0);
    expect(calls.some(c => c.method === 'fillRect')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drawEnemy — REVENANT_KNIGHT visual characteristics
// ---------------------------------------------------------------------------
describe('drawEnemy — REVENANT_KNIGHT visual details', () => {
  it('draws more elements than a regular skeleton (armoured boss)', () => {
    const { ctx: skCtx, calls: skCalls } = makeCtx();
    const { ctx: rkCtx, calls: rkCalls } = makeCtx();

    drawEnemy(skCtx, EnemyType.SKELETON, 0, 0);
    drawEnemy(rkCtx, EnemyType.REVENANT_KNIGHT, 0, 0);

    // Revenant Knight has sword, shield, pauldrons, outline — more draw calls
    expect(rkCalls.length).toBeGreaterThan(skCalls.length);
  });

  it('draws an arc (glowing emblem on shield)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.REVENANT_KNIGHT, 0, 0);
    expect(calls.some(c => c.method === 'arc')).toBe(true);
  });

  it('uses strokeRect (armour outline)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.REVENANT_KNIGHT, 0, 0);
    expect(calls.some(c => c.method === 'strokeRect')).toBe(true);
  });

  it('renders consistently at different positions', () => {
    const { ctx: c1, calls: calls1 } = makeCtx();
    const { ctx: c2, calls: calls2 } = makeCtx();
    drawEnemy(c1, EnemyType.REVENANT_KNIGHT, 0, 0);
    drawEnemy(c2, EnemyType.REVENANT_KNIGHT, 64, 96);
    // Same number of draw operations regardless of position
    expect(calls1.length).toBe(calls2.length);
  });
});
