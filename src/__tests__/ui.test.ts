import { describe, it, expect } from 'vitest';
import { UIRenderer } from '../ui';
import { createDefaultPlayer, ClassPath, MAX_LEVEL, TITLES } from '../types';

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
    expect(texts.some(t => t.includes('Attack'))).toBe(true);
    expect(texts.some(t => t.includes('Defend'))).toBe(true);
    expect(texts.some(t => t.includes('Potion'))).toBe(true);
    expect(texts.some(t => t.includes('Flee'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UIRenderer.drawCombatLog — log line rendering contract
// ---------------------------------------------------------------------------
describe('UIRenderer.drawCombatLog — log line contracts', () => {
  const ui = new UIRenderer();

  it('renders each log line as a fillText call', () => {
    const { ctx, textCalls } = makeCtx();
    ui.drawCombatLog(ctx, ['A Wolf appears!', 'You attack for 5 damage.']);
    expect(textCalls.some(c => c.text === 'A Wolf appears!')).toBe(true);
    expect(textCalls.some(c => c.text === 'You attack for 5 damage.')).toBe(true);
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
    expect(textCalls.some(c => c.text.includes('SPACE'))).toBe(true);
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
