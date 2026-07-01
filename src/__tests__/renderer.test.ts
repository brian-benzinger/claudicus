import { describe, it, expect, beforeEach } from 'vitest';
import { drawPlayer, drawTile, drawEnemy, drawChest, drawNpc } from '../renderer';
import { TileType, EnemyType, WeaponSpeed, TILE_SIZE, NpcRole } from '../types';

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
    // Exactly 3 arcs: tileX/tileY default to 0,0 so tilePrng(0,0) is deterministic,
    // yielding blobCount=2 → 1 main blob + 1 loop blob + 1 unconditional shadow.
    // The prior >= 3 bound would survive silently adding or dropping a blob.
    expect(arcs.length).toBe(3);
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
      it(`WeaponSpeed.${WeaponSpeed[speed]} facing ${facing} renders weapon-specific draw ops`, () => {
        const { ctx, calls } = makeCtx();
        drawPlayer(ctx, 100, 100, 10, facing, speed);
        if (speed === WeaponSpeed.RANGED) {
          // Male default player has exactly 1 arc (head); bow adds a second arc.
          // Failing with 1 means the bow arc was dropped; failing with 3+ means
          // a duplicate bow arc was accidentally introduced.
          const arcCount = calls.filter(c => c.method === 'arc').length;
          expect(arcCount).toBe(2);
        } else {
          // Melee blade uses moveTo+lineTo; male body without weapon has none.
          // Failing here means the blade drawing was dropped.
          expect(calls.some(c => c.method === 'moveTo')).toBe(true);
        }
      });
    }
  }

  it('produces more draw calls with a weapon than without', () => {
    const { ctx: noWeapon,   calls: noWeaponCalls   } = makeCtx();
    const { ctx: withWeapon, calls: withWeaponCalls } = makeCtx();

    drawPlayer(noWeapon,   100, 100, 0, 'right');
    drawPlayer(withWeapon, 100, 100, 0, 'right', WeaponSpeed.NORMAL);

    // Male facing right, no weapon: body fillRect + strokeRect + head (beginPath+arc+fill) +
    // eye fillRect + 2 leg fillRects = 8 calls.
    // NORMAL weapon adds: save + handle (beginPath+moveTo+lineTo+stroke) +
    // blade (beginPath+moveTo+lineTo+stroke) + crossguard (beginPath+moveTo+lineTo+stroke) + restore = 14 calls.
    expect(noWeaponCalls.length).toBe(8);
    expect(withWeaponCalls.length).toBe(22);
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

  it('RANGED bow arc is centered at (x+26, y+12) with radius 7 when facing right', () => {
    // frame=0 → bob=0. bx=x+(facing==='left'?2:26)=26, by=y+12+bob=12.
    // The existing arc-count test (==2) would pass even if the bow shifted to (0,0).
    // This pins WHERE the bow is drawn so position drift is caught separately.
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'right', WeaponSpeed.RANGED);
    const arcs = calls.filter(c => c.method === 'arc').map(c => c.args as number[]);
    // Head arc is at x=16; bow arc is at x=26 — distinct enough to identify each.
    const bowArc = arcs.find(a => a[0] === 26);
    expect(bowArc).toBeDefined();
    expect(bowArc![1]).toBe(12);  // by = y + 12
    expect(bowArc![2]).toBe(7);   // radius
  });

  it('NORMAL melee grip moveTo starts at (x+26, y+14) when facing right', () => {
    // frame=0 → bob=0. gx=x+26=26, gy=y+14+bob=14.
    // The existing moveTo existence check would pass if the grip moved to any other
    // coordinate; this pins the exact hand attachment point as a visual contract.
    // Male body has no dress moveTo, so the first moveTo in the call list is the grip.
    const { ctx, calls } = makeCtx();
    drawPlayer(ctx, 0, 0, 0, 'right', WeaponSpeed.NORMAL);
    const firstMoveTo = calls.find(c => c.method === 'moveTo');
    expect(firstMoveTo).toBeDefined();
    const [mx, my] = firstMoveTo!.args as [number, number];
    expect(mx).toBe(26);
    expect(my).toBe(14);
  });

  it('FAST weapon has no crossguard (2 moveTo), NORMAL and SLOW have crossguard (3 moveTo)', () => {
    // Male facing right has no dress moveTo calls, so all moveTo calls come from the weapon.
    // FAST skips the crossguard segment (speed === WeaponSpeed.FAST check in renderer).
    // If crossguard were added to FAST or removed from NORMAL/SLOW the moveTo count changes.
    const count = (speed: WeaponSpeed) => {
      const { ctx, calls } = makeCtx();
      drawPlayer(ctx, 0, 0, 0, 'right', speed);
      return calls.filter(c => c.method === 'moveTo').length;
    };
    expect(count(WeaponSpeed.FAST)).toBe(2);    // handle + blade only
    expect(count(WeaponSpeed.NORMAL)).toBe(3);  // handle + blade + crossguard
    expect(count(WeaponSpeed.SLOW)).toBe(3);    // handle + blade + crossguard
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
    // Female facing right, no weapon: hair (beginPath+arc+fill+2×fillRect) + tunic fillRect +
    // dress (beginPath+3×lineTo+closePath+fill) + strokeRect + head (beginPath+arc+fill) +
    // ponytail (4×fillRect) + eye fillRect = 22 calls; NORMAL weapon adds 14 = 36.
    expect(noWeaponCalls.length).toBe(22);
    expect(withWeaponCalls.length).toBe(36);
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

    // Skeleton: ribcage + 4 rib lines + skull (beginPath+arc+fill) + 2 eye sockets + jaw + 2 arms + 2 legs = 15
    // Revenant Knight: torso + chest plate + helmet + visor + 2 eyes + 2 pauldrons +
    // 2 arms + 2 legs + sword + crossguard + shield + emblem (beginPath+arc+fill) + 2 strokeRects = 20
    expect(skCalls.length).toBe(15);
    expect(rkCalls.length).toBe(20);
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

// ---------------------------------------------------------------------------
// drawChest — open vs closed visual contract
//
// drawChest is an exported renderer function with two clearly distinct visual
// branches.  The map render tests call render() and check aggregate call counts,
// but they do not pin the exact rect positions or colors that define whether a
// chest looks open or closed to the player.  These tests pin that contract.
//
// COLORS used: wood=#6b4423, woodLight=#8b5a2b, gold=#ffd700
// ---------------------------------------------------------------------------
describe('drawChest — closed chest visual contract', () => {
  it('produces exactly 3 fillRects: body, lid, clasp — in that order', () => {
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, false);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills.length).toBe(3);
  });

  it('body rect is wood (#6b4423) at (6,12,20,16)', () => {
    // The body is the tallest rect — covers the main chest box.
    // If its position shifts or it uses the wrong color, the chest blends into
    // the wrong terrain and the player cannot locate interactive objects.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, false);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[0].fillStyle).toBe('#6b4423');
    expect(fills[0].args).toEqual([6, 12, 20, 16]);
  });

  it('lid rect is woodLight (#8b5a2b) at (6,12,20,6)', () => {
    // The lighter lid visually separates the chest top from its body.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, false);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[1].fillStyle).toBe('#8b5a2b');
    expect(fills[1].args).toEqual([6, 12, 20, 6]);
  });

  it('clasp rect is gold (#ffd700) at (14,16,4,6)', () => {
    // The gold clasp is the only closed-chest detail that signals "locked, not empty."
    // Its position must sit on the lid seam (y=16) to look correct.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, false);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[2].fillStyle).toBe('#ffd700');
    expect(fills[2].args).toEqual([14, 16, 4, 6]);
  });

  it('x,y offset is applied to every rect', () => {
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 32, 64, false);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[0].args).toEqual([32 + 6, 64 + 12, 20, 16]); // body
    expect(fills[2].args).toEqual([32 + 14, 64 + 16, 4, 6]); // clasp
  });
});

describe('drawChest — open chest visual contract', () => {
  it('produces exactly 4 fillRects: base, open lid, two gold glints', () => {
    // An open chest reveals contents with a second gold glint not present when closed.
    // If the branch accidentally rendered the closed chest, this count would be 3.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, true);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills.length).toBe(4);
  });

  it('base rect is wood (#6b4423) at (6,16,20,12) — shorter than closed body', () => {
    // Open chest: base is y=16 (shifted down) and shorter (h=12 vs h=16).
    // If these don't differ from the closed chest, the two states are visually identical.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, true);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[0].fillStyle).toBe('#6b4423');
    expect(fills[0].args).toEqual([6, 16, 20, 12]);
  });

  it('open lid rect is woodLight (#8b5a2b) at (6,8,20,8) — raised higher than closed lid', () => {
    // The open lid is raised to y=8 (vs y=12 when closed), showing it swung open.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, true);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[1].fillStyle).toBe('#8b5a2b');
    expect(fills[1].args).toEqual([6, 8, 20, 8]);
  });

  it('first gold glint is gold (#ffd700) at (10,18,4,4)', () => {
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, true);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[2].fillStyle).toBe('#ffd700');
    expect(fills[2].args).toEqual([10, 18, 4, 4]);
  });

  it('second gold glint is gold (#ffd700) at (16,20,3,3)', () => {
    // Two gold pieces in the interior signal the chest has loot.
    // The second glint is smaller (3×3) and offset right, adding visual depth.
    const { ctx, calls } = makeCtx();
    drawChest(ctx, 0, 0, true);
    const fills = calls.filter(c => c.method === 'fillRect');
    expect(fills[3].fillStyle).toBe('#ffd700');
    expect(fills[3].args).toEqual([16, 20, 3, 3]);
  });

  it('open chest has more fillRects than closed — branches are visually distinct', () => {
    const { ctx: cClosed, calls: closedCalls } = makeCtx();
    const { ctx: cOpen, calls: openCalls } = makeCtx();
    drawChest(cClosed, 0, 0, false);
    drawChest(cOpen, 0, 0, true);
    const closedFills = closedCalls.filter(c => c.method === 'fillRect').length;
    const openFills = openCalls.filter(c => c.method === 'fillRect').length;
    expect(openFills).toBeGreaterThan(closedFills);
  });
});

// ---------------------------------------------------------------------------
// drawNpc — body, eyes, and optional visual feature contracts
//
// At frame=0, Math.sin(0) = 0 so bob=0 and all positions are exact offsets.
// The map render tests verify drawNpc is called, but none pin the exact body
// rect, eye positions, or the optional apron/hood/hat branches that visually
// distinguish each NPC.
// ---------------------------------------------------------------------------

function makeNpc(overrides: Partial<Parameters<typeof drawNpc>[1]> = {}): Parameters<typeof drawNpc>[1] {
  return {
    id: 'test_npc',
    name: 'Test NPC',
    tileX: 0,
    tileY: 0,
    role: NpcRole.QUEST,
    color: '#aabbcc',
    dialogs: { default: ['Hello.'] },
    ...overrides,
  } as Parameters<typeof drawNpc>[1];
}

describe('drawNpc — body and eye contract (frame=0, bob=0)', () => {
  it('body rect uses npc.color at (6,10,20,18)', () => {
    // The body rect position is the primary collision point for "which NPC is here".
    // If it shifts or uses the wrong color, the NPC is invisible against backgrounds.
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc({ color: '#aabbcc' }), 0, 0, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const body = fills.find(f => f.args[2] === 20 && f.args[3] === 18);
    expect(body).toBeDefined();
    expect(body!.fillStyle).toBe('#aabbcc');
    expect(body!.args).toEqual([6, 10, 20, 18]);
  });

  it('left eye is textDark (#000000) at (13,7,2,2)', () => {
    // Eyes are the player's primary cue that an NPC is a person and can be interacted with.
    // If eye positions shift, NPCs look expressionless and the visual language breaks.
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc(), 0, 0, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const leftEye = fills.find(f =>
      f.fillStyle === '#000000' && (f.args as number[])[0] === 13
    );
    expect(leftEye).toBeDefined();
    expect(leftEye!.args).toEqual([13, 7, 2, 2]);
  });

  it('right eye is textDark (#000000) at (17,7,2,2)', () => {
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc(), 0, 0, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const rightEye = fills.find(f =>
      f.fillStyle === '#000000' && (f.args as number[])[0] === 17
    );
    expect(rightEye).toBeDefined();
    expect(rightEye!.args).toEqual([17, 7, 2, 2]);
  });

  it('left leg rect is at (8,26,6,6)', () => {
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc(), 0, 0, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const leftLeg = fills.find(f => (f.args as number[])[0] === 8 && (f.args as number[])[1] === 26);
    expect(leftLeg).toBeDefined();
    expect(leftLeg!.args).toEqual([8, 26, 6, 6]);
  });

  it('x,y offset is applied — body rect shifts with position', () => {
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc(), 32, 64, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const body = fills.find(f => f.args[2] === 20 && f.args[3] === 18);
    expect(body!.args).toEqual([32 + 6, 64 + 10, 20, 18]);
  });
});

describe('drawNpc — apron branch', () => {
  it('NPC with apronColor draws more fillRects than one without', () => {
    // apronColor adds 3 extra rects (apron body + 2 apron strings).
    // If the apron branch were accidentally removed, apprentice-type NPCs would
    // look identical to plain NPCs, breaking their visual identity.
    const { ctx: cPlain, calls: plainCalls } = makeCtx();
    const { ctx: cApron, calls: apronCalls } = makeCtx();
    drawNpc(cPlain, makeNpc(), 0, 0, 0);
    drawNpc(cApron, makeNpc({ apronColor: '#cc6600' }), 0, 0, 0);
    const plainFills = plainCalls.filter(c => c.method === 'fillRect').length;
    const apronFills = apronCalls.filter(c => c.method === 'fillRect').length;
    expect(apronFills).toBe(plainFills + 3); // apron body + 2 strings
  });

  it('apron body rect uses apronColor at (9,13,14,13)', () => {
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc({ apronColor: '#cc6600' }), 0, 0, 0);
    const fills = calls.filter(c => c.method === 'fillRect');
    const apron = fills.find(f => f.fillStyle === '#cc6600' && f.args[2] === 14 && f.args[3] === 13);
    expect(apron).toBeDefined();
    expect(apron!.args).toEqual([9, 13, 14, 13]);
  });
});

describe('drawNpc — hood hat branch', () => {
  it('NPC with hatStyle="hood" draws exactly 2 arcs — hood circle then head circle', () => {
    // drawNpc renders the hood BEFORE the head so the head sits on top visually.
    // The prior `>= 2` bound would pass if a third decorative arc were accidentally
    // added (silently changing the monk NPC's appearance).  Pinning to exactly 2
    // catches both missing arcs and surplus ones.
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc({ hatColor: '#4a3770', hatStyle: 'hood' }), 0, 0, 0);
    const arcs = calls.filter(c => c.method === 'arc');
    expect(arcs.length).toBe(2);
  });

  it('hood arc (radius=9) comes before head arc (radius=7) — larger hood behind smaller head', () => {
    // The hood must be rendered first (behind) so the head circle sits on top.
    // The radii are distinct: hood=9 and head=7.  If the hood radius accidentally
    // became 7 (matching the head), the visual would collapse into an overlapping
    // duplicate — no visible hood ring around the face.  If the order swapped,
    // the hood would cover the face.
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc({ hatColor: '#4a3770', hatStyle: 'hood' }), 0, 0, 0);
    const arcs = calls.filter(c => c.method === 'arc');
    expect(arcs.length).toBe(2);
    expect(arcs[0].args[2]).toBe(9); // hood arc: radius=9 (larger, drawn first/behind)
    expect(arcs[1].args[2]).toBe(7); // head arc: radius=7 (smaller, drawn on top)
  });

  it('hood point is a triangle path (moveTo+lineTo), not a third arc', () => {
    // The hood's pointed tip is drawn as a filled triangle via moveTo+lineTo, NOT as
    // an arc.  If it were replaced with an arc, the sharp tip would become a rounded
    // bulge and the monk silhouette would change silently.
    // A plain NPC draws 0 moveTo calls; the hood adds exactly 1 moveTo (triangle path)
    // and exactly 2 lineTo calls (two sides of the triangle).
    const { ctx: plainCtx, calls: plainCalls } = makeCtx();
    const { ctx: hoodCtx,  calls: hoodCalls  } = makeCtx();
    drawNpc(plainCtx, makeNpc(), 0, 0, 0);
    drawNpc(hoodCtx,  makeNpc({ hatColor: '#4a3770', hatStyle: 'hood' }), 0, 0, 0);
    const plainMoveTos = plainCalls.filter(c => c.method === 'moveTo').length;
    const hoodMoveTos  = hoodCalls.filter(c  => c.method === 'moveTo').length;
    const plainLineTos = plainCalls.filter(c => c.method === 'lineTo').length;
    const hoodLineTos  = hoodCalls.filter(c  => c.method === 'lineTo').length;
    expect(plainMoveTos).toBe(0); // baseline: no moveTo on a plain NPC
    expect(hoodMoveTos).toBe(1);  // hood adds exactly 1 moveTo (triangle start)
    expect(plainLineTos).toBe(0); // baseline: no lineTo on a plain NPC
    expect(hoodLineTos).toBe(2);  // hood adds exactly 2 lineTo calls (two triangle sides)
  });

  it('NPC without hat draws exactly 1 arc (head only)', () => {
    // Baseline: a plain NPC draws only the head circle. Any hat or hood adds more arcs.
    const { ctx, calls } = makeCtx();
    drawNpc(ctx, makeNpc(), 0, 0, 0);
    const arcs = calls.filter(c => c.method === 'arc');
    expect(arcs.length).toBe(1);
  });
});

describe('drawNpc — tall and wide hat branches', () => {
  it('NPC with hatStyle="tall" draws more fillRects than one with no hat', () => {
    // Tall hat adds 2 fillRects (crown + brim). Elder NPCs use this style.
    const { ctx: cPlain, calls: plainCalls } = makeCtx();
    const { ctx: cHat, calls: hatCalls } = makeCtx();
    drawNpc(cPlain, makeNpc(), 0, 0, 0);
    drawNpc(cHat, makeNpc({ hatColor: '#2a1a0a', hatStyle: 'tall' }), 0, 0, 0);
    const plainFills = plainCalls.filter(c => c.method === 'fillRect').length;
    const hatFills = hatCalls.filter(c => c.method === 'fillRect').length;
    expect(hatFills).toBe(plainFills + 2);
  });

  it('NPC with hatStyle="wide" draws more fillRects than one with no hat', () => {
    // Wide hat adds 2 fillRects (crown + brim). Farmer/herbalist NPCs use this style.
    const { ctx: cPlain, calls: plainCalls } = makeCtx();
    const { ctx: cHat, calls: hatCalls } = makeCtx();
    drawNpc(cPlain, makeNpc(), 0, 0, 0);
    drawNpc(cHat, makeNpc({ hatColor: '#3a2a1a', hatStyle: 'wide' }), 0, 0, 0);
    const plainFills = plainCalls.filter(c => c.method === 'fillRect').length;
    const hatFills = hatCalls.filter(c => c.method === 'fillRect').length;
    expect(hatFills).toBe(plainFills + 2);
  });

  it('tall and wide hats produce the same fillRect count (both add 2)', () => {
    // Both hat styles differ in geometry, not quantity.
    // If one style accidentally added 3 rects, this catches the divergence.
    const { ctx: cTall, calls: tallCalls } = makeCtx();
    const { ctx: cWide, calls: wideCalls } = makeCtx();
    drawNpc(cTall, makeNpc({ hatColor: '#2a1a0a', hatStyle: 'tall' }), 0, 0, 0);
    drawNpc(cWide, makeNpc({ hatColor: '#3a2a1a', hatStyle: 'wide' }), 0, 0, 0);
    const tallFills = tallCalls.filter(c => c.method === 'fillRect').length;
    const wideFills = wideCalls.filter(c => c.method === 'fillRect').length;
    expect(tallFills).toBe(wideFills);
  });
});

describe('drawNpc — hairColor branch', () => {
  it('NPC with hairColor draws 3 more fillRects than one without', () => {
    // hairColor adds: left tuft, right tuft, chin — 3 rects total.
    // Beard NPCs (e.g. Elder) rely on this branch for their visual identity.
    const { ctx: cPlain, calls: plainCalls } = makeCtx();
    const { ctx: cHair, calls: hairCalls } = makeCtx();
    drawNpc(cPlain, makeNpc(), 0, 0, 0);
    drawNpc(cHair, makeNpc({ hairColor: '#5c3a1e' }), 0, 0, 0);
    const plainFills = plainCalls.filter(c => c.method === 'fillRect').length;
    const hairFills = hairCalls.filter(c => c.method === 'fillRect').length;
    expect(hairFills).toBe(plainFills + 3);
  });
});
