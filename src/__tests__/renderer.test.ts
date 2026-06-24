import { describe, it, expect, beforeEach } from 'vitest';
import { drawPlayer, drawTile, drawEnemy } from '../renderer';
import { TileType, EnemyType, WeaponSpeed, TILE_SIZE } from '../types';

// ---------------------------------------------------------------------------
// Minimal canvas mock that records every draw call
// ---------------------------------------------------------------------------
type Call = { method: string; args: unknown[]; fillStyle?: string };

function makeCtx() {
  const calls: Call[] = [];
  let _fillStyle = '';

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const ctx = {
    // state — fillStyle backed by a variable so fillRect can snapshot it at call time
    get fillStyle() { return _fillStyle; },
    set fillStyle(v: string) { _fillStyle = v; },
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    // draw ops — fillRect snapshots the active fillStyle for per-tile color assertions
    fillRect: (...args: unknown[]) => { calls.push({ method: 'fillRect', args, fillStyle: _fillStyle }); },
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
    // Exactly 2 fillRects: the grass-base underlay and the trunk.  No other fillRect
    // exists in the TREE case, so >= 2 would pass even if one was accidentally dropped.
    expect(rects.length).toBe(2);
    // At least 3 arcs: main canopy blob (always) + at least 1 extra blob from the loop
    // (blobCount is always 2 or 3, loop starts at b=1) + the unconditional shadow blob.
    // The prior >= 2 bound would survive removing the shadow or the loop body.
    expect(arcs.length).toBeGreaterThanOrEqual(3);
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
// drawTile — base background color and full-tile coverage per tile type
// ---------------------------------------------------------------------------
describe('drawTile — base background color per tile type', () => {
  // Helpers that inspect the FIRST fillRect call, which is always the background fill.
  const firstFillRect = (calls: Call[]) => calls.find(c => c.method === 'fillRect');

  // Non-zero position so coordinate passthrough is also verified.
  const tx = 64, ty = 96;

  it('GRASS: base fill is grass-green (#4a7c23) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.GRASS, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#4a7c23');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('DARK_GRASS: base fill is dark-grass-green (#3d6b1c) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.DARK_GRASS, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#3d6b1c');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('DIRT: base fill is dirt-brown (#8b7355) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.DIRT, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#8b7355');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('COBBLESTONE: base fill is grey (#6b6b6b) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.COBBLESTONE, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#6b6b6b');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('WATER: base fill is deep-blue (#2e5a8b) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.WATER, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#2e5a8b');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('WALL: base fill is wall-grey (#5c5c5c) covering the full tile', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.WALL, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#5c5c5c');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('BUILDING_WALL: shares WALL rendering — base fill is wall-grey (#5c5c5c)', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.BUILDING_WALL, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#5c5c5c');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('TREE: base fill is dark-grass-green (#3d6b1c) — grass underlay beneath the canopy', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.TREE, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#3d6b1c');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('FENCE: base fill is grass-green (#4a7c23) — grass visible around the posts', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.FENCE, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#4a7c23');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('ROCK: base fill is dark-grass-green (#3d6b1c) — grass underlay beneath the rock', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.ROCK, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#3d6b1c');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('DOOR: base fill is grass-green (#4a7c23) — grass surrounding the door frame', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.DOOR, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#4a7c23');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('WELL: base fill is grass-green (#4a7c23) — grass around the well base', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.WELL, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#4a7c23');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  it('GATE: base fill is dirt-brown (#8b7355) — dirt beneath the gate posts', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.GATE, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#8b7355');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });

  // ROOF has no dedicated case in drawTile and falls through to the default placeholder.
  // This test pins that behavior so any future ROOF implementation is noticed.
  it('ROOF: no dedicated renderer case — falls to magenta placeholder (#ff00ff)', () => {
    const { ctx, calls } = makeCtx();
    drawTile(ctx, TileType.ROOF, tx, ty);
    const fr = firstFillRect(calls);
    expect(fr?.fillStyle).toBe('#ff00ff');
    expect(fr?.args).toEqual([tx, ty, TILE_SIZE, TILE_SIZE]);
  });
});

// ---------------------------------------------------------------------------
// drawPlayer — overworld weapon rendering
// ---------------------------------------------------------------------------
describe('drawPlayer — without weapon', () => {
  it('male body rect is 20×18 with playerBody color at frame=0', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'up');
    // bob = Math.sin(0) = 0, male body fillRect(6, 10, 20, 18) with #4a3728
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[2] === 20 &&
      (c.args as number[])[3] === 18 &&
      c.fillStyle === '#4a3728'
    );
    expect(body).toBeDefined();
  });

  it('facing-down draws two eye rects; facing-up draws none', () => {
    const { ctx: downCtx, calls: downCalls } = makeCtx();
    const { ctx: upCtx, calls: upCalls } = makeCtx();
    drawPlayer(downCtx, 0, 0, 0, 'down');
    drawPlayer(upCtx, 0, 0, 0, 'up');
    // Eyes are 2×2 fillRects drawn only when facing toward the viewer
    const eyeRects = (cs: Call[]) =>
      cs.filter(c => c.method === 'fillRect' && (c.args as number[])[2] === 2 && (c.args as number[])[3] === 2);
    expect(eyeRects(downCalls).length).toBe(2);
    expect(eyeRects(upCalls).length).toBe(0);
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
  it('male avatar body is playerBody color (#4a3728) at (6,10,20,18)', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'down', undefined, undefined, 'male');
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 6 &&
      (c.args as number[])[1] === 10 &&
      (c.args as number[])[2] === 20 &&
      (c.args as number[])[3] === 18 &&
      c.fillStyle === '#4a3728'
    );
    expect(body).toBeDefined();
  });

  it('female avatar body is playerBodyFemale color (#2e4a6b) at (7,10,18,14)', () => {
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'down', undefined, undefined, 'female');
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 7 &&
      (c.args as number[])[1] === 10 &&
      (c.args as number[])[2] === 18 &&
      (c.args as number[])[3] === 14 &&
      c.fillStyle === '#2e4a6b'
    );
    expect(body).toBeDefined();
  });

  it('female avatar produces more arc calls (hair)', () => {
    const { ctx: maleCtx, calls: maleCalls } = makeCtx();
    const { ctx: femaleCtx, calls: femaleCalls } = makeCtx();
    drawPlayer(maleCtx,   0, 0, 0, 'down', undefined, undefined, 'male');
    drawPlayer(femaleCtx, 0, 0, 0, 'down', undefined, undefined, 'female');
    const maleArcs   = maleCalls.filter(c => c.method === 'arc').length;
    const femaleArcs = femaleCalls.filter(c => c.method === 'arc').length;
    // Male: exactly 1 arc (head circle only — no hair arc).
    // Female: exactly 2 arcs (hair-behind-head circle + head circle).
    // Purely relational (female > male) would pass even if, e.g., male mistakenly
    // gained a hair arc, leaving female with 3 and male with 2.
    expect(maleArcs).toBe(1);
    expect(femaleArcs).toBe(2);
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
// drawEnemy — exact body colors and distinguishing visual contracts
//
// Replaces shallow "fills body rect" checks with pinned exact-color assertions
// so that swapping enemy body colors is caught immediately.  The color values
// are taken directly from the COLORS palette in renderer.ts.
// ---------------------------------------------------------------------------
describe('drawEnemy — WOLF body color and red eyes', () => {
  it('body is wolf-grey (#6b6b6b) at (4,12,24,14)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WOLF, 0, 0);
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 4 &&
      (c.args as number[])[1] === 12 &&
      (c.args as number[])[2] === 24 &&
      (c.args as number[])[3] === 14 &&
      c.fillStyle === '#6b6b6b'
    );
    expect(body).toBeDefined();
  });

  it('eye fillRect uses wolfEyes red (#cc3333)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WOLF, 0, 0);
    // Eye is a 2x2 fillRect drawn with wolfEyes color
    const eye = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[2] === 2 &&
      (c.args as number[])[3] === 2 &&
      c.fillStyle === '#cc3333'
    );
    expect(eye).toBeDefined();
  });
});

describe('drawEnemy — BANDIT body color', () => {
  it('body is bandit dark-red (#8b2500) at (6,10,20,18)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.BANDIT, 0, 0);
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 6 &&
      (c.args as number[])[1] === 10 &&
      (c.args as number[])[2] === 20 &&
      (c.args as number[])[3] === 18 &&
      c.fillStyle === '#8b2500'
    );
    expect(body).toBeDefined();
  });

  it('BANDIT draws no stroke call (no bow — face arc uses fill, not stroke)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.BANDIT, 0, 0);
    expect(calls.some(c => c.method === 'stroke')).toBe(false);
  });
});

describe('drawEnemy — BANDIT_ARCHER body color and bow', () => {
  it('body is bandit dark-red (#8b2500) at (6,10,20,18)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.BANDIT_ARCHER, 0, 0);
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 6 &&
      (c.args as number[])[1] === 10 &&
      (c.args as number[])[2] === 20 &&
      (c.args as number[])[3] === 18 &&
      c.fillStyle === '#8b2500'
    );
    expect(body).toBeDefined();
  });

  it('BANDIT_ARCHER uses stroke (bow arc) but BANDIT does not', () => {
    // The bow is drawn with ctx.arc() + ctx.stroke(); the face uses arc + fill.
    // Both bandits have the face arc, but only the archer adds a stroke call.
    const { ctx: archerCtx, calls: archerCalls } = makeCtx();
    const { ctx: banditCtx, calls: banditCalls } = makeCtx();
    drawEnemy(archerCtx, EnemyType.BANDIT_ARCHER, 0, 0);
    drawEnemy(banditCtx, EnemyType.BANDIT, 0, 0);
    expect(archerCalls.some(c => c.method === 'stroke')).toBe(true);
    expect(banditCalls.some(c => c.method === 'stroke')).toBe(false);
  });
});

describe('drawEnemy — SKELETON body color', () => {
  it('ribcage is bone-white (#e8e8d8) at (8,10,16,14)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.SKELETON, 0, 0);
    const ribcage = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 8 &&
      (c.args as number[])[1] === 10 &&
      (c.args as number[])[2] === 16 &&
      (c.args as number[])[3] === 14 &&
      c.fillStyle === '#e8e8d8'
    );
    expect(ribcage).toBeDefined();
  });

  it('skeleton is distinct from wolf — different dominant body color', () => {
    const { ctx: wolfCtx, calls: wolfCalls } = makeCtx();
    const { ctx: skCtx, calls: skCalls } = makeCtx();
    drawEnemy(wolfCtx, EnemyType.WOLF, 0, 0);
    drawEnemy(skCtx, EnemyType.SKELETON, 0, 0);
    const wolfBodyColors = wolfCalls.filter(c => c.method === 'fillRect').map(c => c.fillStyle);
    const skBodyColors   = skCalls.filter(c => c.method === 'fillRect').map(c => c.fillStyle);
    expect(wolfBodyColors[0]).not.toBe(skBodyColors[0]);
  });
});

describe('drawEnemy — WILD_BOAR body color', () => {
  it('body is boar-brown (#6b4423) at (4,12,24,12)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WILD_BOAR, 0, 0);
    const body = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 4 &&
      (c.args as number[])[1] === 12 &&
      (c.args as number[])[2] === 24 &&
      (c.args as number[])[3] === 12 &&
      c.fillStyle === '#6b4423'
    );
    expect(body).toBeDefined();
  });

  it('boar tusks are bone-white (#e8e8d8), distinguishing it from wolf and bandit', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.WILD_BOAR, 0, 0);
    // Tusks: 2x4 fillRect with skeletonBody color (#e8e8d8)
    const tusk = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[2] === 2 &&
      (c.args as number[])[3] === 4 &&
      c.fillStyle === '#e8e8d8'
    );
    expect(tusk).toBeDefined();
  });
});

describe('drawEnemy — REVENANT_KNIGHT armour color and glowing eyes', () => {
  it('torso plate is dark-steel (#3a3a4a) at (7,9,18,16)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.REVENANT_KNIGHT, 0, 0);
    const torso = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 7 &&
      (c.args as number[])[1] === 9 &&
      (c.args as number[])[2] === 18 &&
      (c.args as number[])[3] === 16 &&
      c.fillStyle === '#3a3a4a'
    );
    expect(torso).toBeDefined();
  });

  it('glowing eyes are red (#cc2200) at (12,6,3,2)', () => {
    const { ctx, calls } = makeCtx();
    drawEnemy(ctx, EnemyType.REVENANT_KNIGHT, 0, 0);
    const eye = calls.find(c =>
      c.method === 'fillRect' &&
      (c.args as number[])[0] === 12 &&
      (c.args as number[])[1] === 6 &&
      (c.args as number[])[2] === 3 &&
      (c.args as number[])[3] === 2 &&
      c.fillStyle === '#cc2200'
    );
    expect(eye).toBeDefined();
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
