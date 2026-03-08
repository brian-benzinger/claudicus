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
// drawTile — other tile types don't throw
// ---------------------------------------------------------------------------
describe('drawTile — all tile types render without throwing', () => {
  const allTypes: TileType[] = [
    TileType.GRASS, TileType.DIRT, TileType.COBBLESTONE, TileType.WATER,
    TileType.WALL, TileType.TREE, TileType.FENCE, TileType.DARK_GRASS,
    TileType.ROCK, TileType.BUILDING_WALL, TileType.DOOR, TileType.ROOF,
    TileType.WELL, TileType.GATE,
  ];
  for (const type of allTypes) {
    it(`TileType ${type} renders without error`, () => {
      const { ctx } = makeCtx();
      expect(() => drawTile(ctx, type, 0, 0)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// drawPlayer — overworld weapon rendering
// ---------------------------------------------------------------------------
describe('drawPlayer — without weapon', () => {
  it('renders without throwing', () => {
    const { ctx } = makeCtx();
    expect(() => drawPlayer(ctx, 100, 100, 0, 'down')).not.toThrow();
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
      it(`renders WeaponSpeed.${WeaponSpeed[speed]} facing ${facing} without throwing`, () => {
        const { ctx } = makeCtx();
        expect(() => drawPlayer(ctx, 100, 100, 10, facing, speed)).not.toThrow();
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
// drawEnemy — all types render without throwing
// ---------------------------------------------------------------------------
describe('drawEnemy — all enemy types render without throwing', () => {
  it('WOLF renders without error', () => {
    const { ctx } = makeCtx();
    expect(() => drawEnemy(ctx, EnemyType.WOLF, 0, 0)).not.toThrow();
  });
  it('BANDIT renders without error', () => {
    const { ctx } = makeCtx();
    expect(() => drawEnemy(ctx, EnemyType.BANDIT, 0, 0)).not.toThrow();
  });
  it('BANDIT_ARCHER renders without error', () => {
    const { ctx } = makeCtx();
    expect(() => drawEnemy(ctx, EnemyType.BANDIT_ARCHER, 0, 0)).not.toThrow();
  });
  it('SKELETON renders without error', () => {
    const { ctx } = makeCtx();
    expect(() => drawEnemy(ctx, EnemyType.SKELETON, 0, 0)).not.toThrow();
  });
  it('WILD_BOAR renders without error', () => {
    const { ctx } = makeCtx();
    expect(() => drawEnemy(ctx, EnemyType.WILD_BOAR, 0, 0)).not.toThrow();
  });
});
