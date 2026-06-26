import { describe, it, expect } from 'vitest';
import { UIRenderer } from '../ui';
import { createDefaultPlayer, ClassPath, MAX_LEVEL, TITLES } from '../types';
import { CRAFT_RECIPES } from '../data/recipes';

// ---------------------------------------------------------------------------
// Minimal canvas mock that records fillText calls.
// ui.ts uses fillText to render all player-visible stats, labels, and dialog
// text — capturing those calls lets us assert that the correct text is rendered
// without needing a real browser canvas.
// ---------------------------------------------------------------------------
function makeCtx() {
  const textCalls: { text: string; x: number; y: number }[] = [];
  let _fillStyle = '';
  let _font = '';
  let _textAlign: CanvasTextAlign = 'left';

  const noop = () => {};

  const ctx = {
    get fillStyle() { return _fillStyle; },
    set fillStyle(v: string) { _fillStyle = v; },
    get font() { return _font; },
    set font(v: string) { _font = v; },
    get textAlign() { return _textAlign; },
    set textAlign(v: CanvasTextAlign) { _textAlign = v; },
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect:   noop,
    strokeRect: noop,
    beginPath:  noop,
    closePath:  noop,
    arc:        noop,
    fill:       noop,
    stroke:     noop,
    moveTo:     noop,
    lineTo:     noop,
    save:       noop,
    restore:    noop,
    translate:  noop,
    scale:      noop,
    fillText: (text: string, x: number, y: number) => {
      textCalls.push({ text, x, y });
    },
    measureText: () => ({ width: 0 }),
  } as unknown as CanvasRenderingContext2D;

  return { ctx, textCalls };
}

// ---------------------------------------------------------------------------
// UIRenderer.drawHUD — player stats display contracts
//
// The HUD is the player's primary source of game-state feedback during the
// overworld.  Each stat is rendered with a specific string format; a silent
// format change (e.g. "30 / 40" instead of "30/40") would mislead the player
// but cannot be caught by type checks alone.  These tests pin the exact text
// that must appear so any accidental change to the format string breaks a test.
// ---------------------------------------------------------------------------
describe('UIRenderer.drawHUD — stat display contracts', () => {
  const ui = new UIRenderer();

  it('renders HP as "${hp}/${maxHp}" — the exact fraction format', () => {
    // If the arguments were swapped (maxHp/hp) the bar would show the wrong
    // remaining fraction — a silent visual bug.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.hp = 30;
    player.maxHp = 40;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '30/40')).toBe(true);
  });

  it('renders gold as "${gold}g" — the "g" suffix is required', () => {
    // If the suffix were dropped the player would see "10" instead of "10g",
    // losing the visual context that the number represents gold.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // gold = 10
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '10g')).toBe(true);
  });

  it('renders potions as "Potions: ${potions}"', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // potions = 3
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'Potions: 3')).toBe(true);
  });

  it('renders level as "LV ${level}"', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.level = 5;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'LV 5')).toBe(true);
  });

  it('renders the equipped weapon name', () => {
    // The player sees the weapon name in the HUD to confirm which weapon is active.
    // If the lookup fell back to the wrong default the name would be wrong.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // weaponId = 'rusty_shortsword' → 'Rusty Shortsword'
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'Rusty Shortsword')).toBe(true);
  });

  it('renders "MAX" XP label at max level instead of a fraction', () => {
    // At MAX_LEVEL the XP bar is meaningless; the code substitutes "MAX" to
    // prevent rendering a 0/0 fraction.  If the branch were accidentally removed,
    // "10/250" (or a divide-by-zero artifact) would appear instead.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.level = MAX_LEVEL;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'MAX')).toBe(true);
  });

  it('renders "${xp}/${needed}" XP label below max level', () => {
    // At level 1 with 10 XP, the needed threshold is 25 (xpForLevel(1)=25).
    // The label must read "10/25", not "0/25" or the raw xp value.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // level = 1, xp = 0 → needed = 25
    player.xp = 10;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '10/25')).toBe(true);
  });

  it('renders "Brannford" for the village map', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // currentMap = 'village'
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'Brannford')).toBe(true);
  });

  it('renders "Thornwood" for the forest map', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.currentMap = 'forest';
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'Thornwood')).toBe(true);
  });

  it('renders "Greymoor Crypt" for the dungeon map', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.currentMap = 'dungeon';
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === 'Greymoor Crypt')).toBe(true);
  });

  it('renders "[WAR]" badge for the Warrior class', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.classPath = ClassPath.WARRIOR;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '[WAR]')).toBe(true);
  });

  it('renders "[SCT]" badge for the Scout class', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.classPath = ClassPath.SCOUT;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '[SCT]')).toBe(true);
  });

  it('renders "[BRG]" badge for the Brigand class', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.classPath = ClassPath.BRIGAND;
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '[BRG]')).toBe(true);
  });

  it('does not render any class badge when classPath is null', () => {
    // A null classPath means the player has not yet chosen a class.
    // No badge text must appear — any of the three badge strings would indicate
    // a wrong default being applied to an unchosen class.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // classPath = null
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text === '[WAR]')).toBe(false);
    expect(textCalls.some(c => c.text === '[SCT]')).toBe(false);
    expect(textCalls.some(c => c.text === '[BRG]')).toBe(false);
  });

  it('renders the active title label wrapped in double quotes', () => {
    // Active titles are displayed as e.g. `"Wolfsbane"` — the quotes are part
    // of the display contract.  If the format changed to bare text or single
    // quotes, the title would render incorrectly.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.activeTitle = 'wolfsbane';
    ui.drawHUD(ctx, player);
    const titleText = textCalls.find(c => c.text.startsWith('"') && c.text.endsWith('"'));
    expect(titleText).toBeDefined();
    expect(titleText!.text).toBe(`"${TITLES.wolfsbane.label}"`);
  });

  it('does not render any quoted title string when activeTitle is null', () => {
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer(); // activeTitle = null
    ui.drawHUD(ctx, player);
    expect(textCalls.some(c => c.text.startsWith('"') && c.text.endsWith('"'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawCombatMenu — combat action option contracts
//
// The combat menu is the player's interface for choosing actions.  Each option
// label must contain the correct key binding and description; a wrong count
// on the potion option or a missing ability key would leave the player
// uninformed about their options.
// ---------------------------------------------------------------------------
describe('UIRenderer.drawCombatMenu — combat action labels', () => {
  const ui = new UIRenderer();

  it('renders "[3] Potion (N)" with the exact player potion count', () => {
    // Contract: the potion option must embed the current count so the player
    // knows at a glance how many they have.  A hardcoded or wrong count here
    // would silently misreport the player's resources.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 7);
    expect(textCalls.some(c => c.text === '[3] Potion (7)')).toBe(true);
  });

  it('renders "[5] ${abilityName}" when an ability is available', () => {
    // The ability key [5] and its name are dynamically assembled; if either were
    // dropped or swapped the player would not know how to activate the ability.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 3, 'Backstab');
    expect(textCalls.some(c => c.text === '[5] Backstab')).toBe(true);
  });

  it('does not render a "[5]" key when no ability is available', () => {
    // Without an ability there should be no key-5 label — rendering a stale one
    // would confuse the player into pressing 5 with no effect.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 3, null);
    expect(textCalls.some(c => c.text.startsWith('[5]'))).toBe(false);
  });

  it('always renders all four base combat options', () => {
    // Attack, Defend, Potion, and Flee must always be present regardless of
    // whether an ability is available.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 0);
    const texts = textCalls.map(c => c.text);
    expect(texts).toContain('[1] Attack');
    expect(texts).toContain('[2] Defend');
    expect(texts).toContain('[3] Potion (0)');
    expect(texts).toContain('[4] Flee');
  });

  it('with ability: still renders all four base options plus the ability key', () => {
    // The `if (abilityName)` branch is a separate code path — its four base
    // options are independently listed from the 4-column branch.  Without this
    // test, silently dropping `[4] Flee` from that branch would pass all existing
    // tests because the only ability test only checks that `[5]` appears.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 2, 'Backstab');
    const texts = textCalls.map(c => c.text);
    expect(texts).toContain('[1] Attack');
    expect(texts).toContain('[2] Defend');
    expect(texts).toContain('[3] Potion (2)');
    expect(texts).toContain('[4] Flee');
    expect(texts).toContain('[5] Backstab');
  });

  it('5-column layout places [1] Attack at x=40 and [4] Flee at x=510', () => {
    // The two layout branches place options at different x-coordinates (5-col:
    // [1]@40 [4]@510 vs 4-col: [1]@50 [4]@550).  If the conditional were
    // accidentally removed and both cases used the same branch, [1] would be
    // at the wrong x and this test would fail — a layout bug the text-only
    // tests above cannot detect.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 0, 'Shield Bash');
    const attack = textCalls.find(c => c.text === '[1] Attack')!;
    const flee   = textCalls.find(c => c.text === '[4] Flee')!;
    expect(attack.x).toBe(40);
    expect(flee.x).toBe(510);
  });

  it('4-column layout places [1] Attack at x=50 and [4] Flee at x=550', () => {
    // Mirrors the 5-column test above for the no-ability branch so both halves
    // of the conditional are pinned to distinct coordinate contracts.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatMenu(ctx, 0);
    const attack = textCalls.find(c => c.text === '[1] Attack')!;
    const flee   = textCalls.find(c => c.text === '[4] Flee')!;
    expect(attack.x).toBe(50);
    expect(flee.x).toBe(550);
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawCombatLog — log line rendering contract
// ---------------------------------------------------------------------------
describe('UIRenderer.drawCombatLog — log line contracts', () => {
  const ui = new UIRenderer();

  it('renders each log line at the correct x/y position in order', () => {
    // logY = CANVAS_HEIGHT(640) - 180 = 460; each line i at y = 460 + 20 + i*18.
    // Using .some() would miss reversed order, wrong coordinates, or duplicates —
    // all silent regressions that would misalign text on screen.
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatLog(ctx, ['A Wolf appears!', 'You attack for 5 damage.']);
    expect(textCalls).toHaveLength(2);
    expect(textCalls[0]).toEqual({ text: 'A Wolf appears!',          x: 30, y: 480 });
    expect(textCalls[1]).toEqual({ text: 'You attack for 5 damage.', x: 30, y: 498 });
  });

  it('renders an empty log without throwing', () => {
    const { ctx } = makeCtx();
    expect(() => ui.drawCombatLog(ctx, [])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawDialogBox — speaker and text rendering contracts
//
// The dialog box is how NPCs communicate quest info, shop intros, and story
// to the player.  The speaker name and dialog text must appear as fillText
// calls; if either were accidentally dropped the player would see a blank box.
// ---------------------------------------------------------------------------
describe('UIRenderer.drawDialogBox — content contracts', () => {
  const ui = new UIRenderer();

  it('renders the speaker name', () => {
    const { ctx, textCalls } = makeCtx();
    ui.drawDialogBox(ctx, 'Elder Aldric', 'Please help us!');
    expect(textCalls.some(c => c.text === 'Elder Aldric')).toBe(true);
  });

  it('renders the dialog text', () => {
    const { ctx, textCalls } = makeCtx();
    ui.drawDialogBox(ctx, 'Elder Aldric', 'Please help us!');
    expect(textCalls.some(c => c.text === 'Please help us!')).toBe(true);
  });

  it('renders the "[SPACE] to continue" prompt once text is fully revealed', () => {
    // Without revealFrame the dialog is displayed instantly; the continue prompt
    // must appear so the player knows how to advance.
    const { ctx, textCalls } = makeCtx();
    ui.drawDialogBox(ctx, 'Guard', 'Halt.');
    expect(textCalls.some(c => c.text === '[SPACE] to continue')).toBe(true);
  });

  it('suppresses "[SPACE] to continue" while the text is still being revealed', () => {
    // revealFrame=0 means no characters have been revealed yet; the continue
    // prompt must not appear until all text is on screen — showing it early
    // would mislead the player into pressing space before reading the dialog.
    const { ctx, textCalls } = makeCtx();
    ui.drawDialogBox(ctx, 'Guard', 'Halt.', 0);
    expect(textCalls.some(c => c.text.includes('SPACE'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawCraftMenu — crafting screen display contracts
//
// drawCraftMenu renders the forge interface: material counts, all three recipe
// entries (name + description + cost indicators), and the key-binding hint.
// These tests pin the exact text strings the player sees so that format changes,
// wrong variable bindings, or silent omissions are caught before they reach the
// player.
// ---------------------------------------------------------------------------
describe('UIRenderer.drawCraftMenu — content contracts', () => {
  const ui = new UIRenderer();

  it('renders "FORGE" as the menu title', () => {
    // The title labels the UI context. If it were accidentally changed (e.g. to
    // "CRAFT" or left blank) the player would see a different header or nothing.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    expect(textCalls.some(c => c.text === 'FORGE')).toBe(true);
  });

  it('renders exact material counts — "Wolf Pelts: N   Bandit Steel: N"', () => {
    // The space-padded format "Wolf Pelts: 2   Bandit Steel: 3" is what the player
    // reads to decide what they can craft. A format change ("Wolf Pelt: 2" or swapped
    // order) silently breaks the display contract — this test pins both the template
    // and the values so any change in either is caught immediately.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    player.materials = { wolf_pelt: 2, bandit_steel: 3 };
    ui.drawCraftMenu(ctx, player, 0);
    expect(textCalls.some(c => c.text === 'Wolf Pelts: 2   Bandit Steel: 3')).toBe(true);
  });

  it('renders all three recipe names from CRAFT_RECIPES', () => {
    // CRAFT_RECIPES has 3 entries. Each name must appear so the player can see
    // every craftable option. Missing a name would leave a blank row in the menu.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    const renderedTexts = textCalls.map(c => c.text);
    for (const recipe of CRAFT_RECIPES) {
      expect(renderedTexts).toContain(recipe.name);
    }
  });

  it('renders all three recipe descriptions from CRAFT_RECIPES', () => {
    // Descriptions tell the player the cost and output (e.g. "3 Wolf Pelts → Studded
    // Leather (DEF +2)"). If any were dropped, the row would have a name but no detail.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    const renderedTexts = textCalls.map(c => c.text);
    for (const recipe of CRAFT_RECIPES) {
      expect(renderedTexts).toContain(recipe.description);
    }
  });

  it('renders pelt cost indicator "Pelts: N" for recipes that require wolf pelts', () => {
    // studded_leather costs wolf_pelt=3 and war_axe costs wolf_pelt=1.
    // The cost indicator appears as a separate label so the player can compare
    // their stockpile against the required amount at a glance.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    const renderedTexts = textCalls.map(c => c.text);
    // studded_leather: cost.wolf_pelt=3 → "Pelts: 3"
    expect(renderedTexts).toContain('Pelts: 3');
    // war_axe: cost.wolf_pelt=1 → "Pelts: 1"
    expect(renderedTexts).toContain('Pelts: 1');
  });

  it('renders steel cost indicator "Steel: N" for recipes that require bandit steel', () => {
    // iron_longsword costs bandit_steel=2 and war_axe also costs bandit_steel=2.
    // The indicator pins the format: "Steel: 2" not "Bandit Steel: 2" or just "2".
    // Both steel-requiring recipes must render their indicator: exactly 2 occurrences of
    // "Steel: 2".  The prior `toBeGreaterThanOrEqual(1)` would pass even if war_axe's
    // indicator were silently dropped — the exact count of 2 catches that regression.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    const steelLabels = textCalls.filter(c => c.text === 'Steel: 2');
    expect(steelLabels.length).toBe(2);
  });

  it('renders the key-binding hint at the bottom of the menu', () => {
    // Players rely on this hint to know how to navigate and confirm a craft.
    // If it were omitted or reformatted the controls would be invisible.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    ui.drawCraftMenu(ctx, player, 0);
    expect(
      textCalls.some(c => c.text === '[W/S] Select   [SPACE] Craft   [ESC] Exit')
    ).toBe(true);
  });

  it('renders material count as 0 when materials are absent (undefined guard)', () => {
    // drawCraftMenu uses `player.materials?.wolf_pelt ?? 0` to guard against
    // undefined materials (possible after a v4 save migration before the save
    // module backfills the field).  This test drives the ?? 0 fallback path.
    const { ctx, textCalls } = makeCtx();
    const player = createDefaultPlayer();
    (player as any).materials = undefined; // simulate missing field
    expect(() => ui.drawCraftMenu(ctx, player, 0)).not.toThrow();
    expect(textCalls.some(c => c.text === 'Wolf Pelts: 0   Bandit Steel: 0')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawCraftMenu — cursor selection highlight position contract
//
// The existing drawCraftMenu tests always pass cursor=0 and use a makeCtx()
// where fillRect is a no-op.  That means if the highlight logic
// (`if (i === cursor) { fillRect(...highlight...) }`) were broken — e.g.
// always highlighting row 0 regardless of cursor, or never highlighting
// anything — every existing test would still pass silently.
//
// These tests use a richer ctx mock that snapshots fillStyle at each fillRect
// call, then assert that:
//   1. Exactly one highlight appears per render (not zero, not three).
//   2. The highlighted row's y-coordinate matches the cursor index.
//
// Coordinate derivation (ui.ts drawCraftMenu):
//   menuX = (CANVAS_WIDTH-480)/2 = 240; menuY = (CANVAS_HEIGHT-340)/2 = 150
//   itemY(i) = menuY + 90 + i*55  →  240, 295, 350  for i=0,1,2
//   highlight y = itemY - 20       →  220, 275, 330  for i=0,1,2
//   highlight rect: (menuX+10, itemY-20, menuWidth-20, 50) = (250, y, 460, 50)
//
// If i===cursor were changed to i===0 (always row 0), cursor=1 and cursor=2
// tests would see y=220 instead of 275/330 and fail.
// If the branch were removed entirely, all three "exactly one" checks fail.
// ---------------------------------------------------------------------------
describe('UIRenderer.drawCraftMenu — cursor selection highlight position', () => {
  const ui = new UIRenderer();

  // Richer context that snapshots fillStyle at the moment fillRect is called.
  function makeFillCtx() {
    const fillRectCalls: { fillStyle: string; x: number; y: number; w: number; h: number }[] = [];
    let _fillStyle = '';
    const noop = () => {};
    const ctx = {
      get fillStyle() { return _fillStyle; },
      set fillStyle(v: string) { _fillStyle = v; },
      strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      font: '', textAlign: 'left' as CanvasTextAlign,
      fillRect: (x: number, y: number, w: number, h: number) => {
        fillRectCalls.push({ fillStyle: _fillStyle, x, y, w, h });
      },
      strokeRect: noop, beginPath: noop, closePath: noop, arc: noop,
      fill: noop, stroke: noop, moveTo: noop, lineTo: noop,
      save: noop, restore: noop, translate: noop, scale: noop,
      fillText: noop,
      measureText: () => ({ width: 0 }),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, fillRectCalls };
  }

  const HIGHLIGHT_COLOR = 'rgba(100, 80, 60, 0.5)';

  it('cursor=0 produces exactly one highlight and it is at y=220 (row 0)', () => {
    const { ctx, fillRectCalls } = makeFillCtx();
    ui.drawCraftMenu(ctx, createDefaultPlayer(), 0);
    const highlights = fillRectCalls.filter(c => c.fillStyle === HIGHLIGHT_COLOR);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].y).toBe(220);
  });

  it('cursor=1 produces exactly one highlight and it is at y=275 (row 1), not y=220 (row 0)', () => {
    // If `if (i === cursor)` were changed to `if (i === 0)` this would fail:
    // the highlight would appear at y=220 (row 0) rather than y=275 (row 1).
    const { ctx, fillRectCalls } = makeFillCtx();
    ui.drawCraftMenu(ctx, createDefaultPlayer(), 1);
    const highlights = fillRectCalls.filter(c => c.fillStyle === HIGHLIGHT_COLOR);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].y).toBe(275);
  });

  it('cursor=2 produces exactly one highlight and it is at y=330 (row 2)', () => {
    const { ctx, fillRectCalls } = makeFillCtx();
    ui.drawCraftMenu(ctx, createDefaultPlayer(), 2);
    const highlights = fillRectCalls.filter(c => c.fillStyle === HIGHLIGHT_COLOR);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].y).toBe(330);
  });

  it('highlight rect is always (x=250, w=460, h=50) regardless of cursor row', () => {
    // The x, width, and height of the selection box are fixed constants that
    // must not be accidentally changed to match a per-row variable.
    for (const cursor of [0, 1, 2]) {
      const { ctx, fillRectCalls } = makeFillCtx();
      ui.drawCraftMenu(ctx, createDefaultPlayer(), cursor);
      const h = fillRectCalls.find(c => c.fillStyle === HIGHLIGHT_COLOR)!;
      expect(h, `cursor ${cursor}: no highlight found`).toBeDefined();
      expect(h.x, `cursor ${cursor}: highlight x`).toBe(250);
      expect(h.w, `cursor ${cursor}: highlight width`).toBe(460);
      expect(h.h, `cursor ${cursor}: highlight height`).toBe(50);
    }
  });
});
