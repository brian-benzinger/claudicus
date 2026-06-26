import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from '../input';

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function release(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  describe('isHeld', () => {
    it('returns true while key is held', () => {
      press('w');
      expect(input.isHeld('w')).toBe(true);
    });

    it('returns false after key is released', () => {
      press('w');
      release('w');
      expect(input.isHeld('w')).toBe(false);
    });

    it('is case-insensitive', () => {
      press('W');
      expect(input.isHeld('w')).toBe(true);
    });

    it('returns false for keys not pressed', () => {
      expect(input.isHeld('z')).toBe(false);
    });
  });

  describe('wasJustPressed', () => {
    it('returns true on the frame a key is first pressed', () => {
      press('a');
      input.flushFrame();
      expect(input.wasJustPressed('a')).toBe(true);
    });

    it('returns false if flushFrame not yet called', () => {
      press('a');
      expect(input.wasJustPressed('a')).toBe(false);
    });

    it('returns false on subsequent frames while held', () => {
      press('a');
      input.flushFrame();
      input.flushFrame(); // second frame
      expect(input.wasJustPressed('a')).toBe(false);
    });

    it('returns false after key is released', () => {
      press('a');
      input.flushFrame();
      release('a');
      input.flushFrame();
      expect(input.wasJustPressed('a')).toBe(false);
    });

    it('a repeated keydown for an already-held key does not re-trigger wasJustPressed', () => {
      // Browsers fire repeated keydown events while a key is held.
      // The `if (!this.held.has(key))` guard must prevent those repeats from
      // being re-queued in justPressedBuffer — otherwise held keys would trigger
      // actions every frame (e.g., the attack key fires on every game loop tick).
      press('a');
      input.flushFrame(); // first keydown → promoted to justPressed
      input.flushFrame(); // buffer cleared; justPressed empty

      press('a'); // browser key-repeat: keydown fires again for the still-held 'a'
      input.flushFrame();
      expect(input.wasJustPressed('a')).toBe(false); // guard must have fired
    });

    it('re-press after release triggers wasJustPressed again', () => {
      // Pins the full tap-release-tap lifecycle.  If onKeyUp ever fails to clear
      // the `held` set, the second press looks like a browser key-repeat and
      // wasJustPressed stays false — breaking any action the player taps twice
      // in quick succession (e.g., two consecutive combat attacks or menu presses).
      press('a');
      input.flushFrame();  // first press registered
      release('a');        // held cleared
      press('a');          // fresh press — must NOT be treated as a key-repeat
      input.flushFrame();
      expect(input.wasJustPressed('a')).toBe(true);
    });
  });

  describe('movement helpers', () => {
    it('moveUp returns true when w is held', () => {
      press('w');
      expect(input.moveUp()).toBe(true);
    });

    it('moveUp returns true when ArrowUp is held', () => {
      press('ArrowUp');
      expect(input.moveUp()).toBe(true);
    });

    it('moveDown returns true when s is held', () => {
      press('s');
      expect(input.moveDown()).toBe(true);
    });

    it('moveDown returns true when ArrowDown is held', () => {
      press('ArrowDown');
      expect(input.moveDown()).toBe(true);
    });

    it('moveLeft returns true when a is held', () => {
      press('a');
      expect(input.moveLeft()).toBe(true);
    });

    it('moveLeft returns true when ArrowLeft is held', () => {
      press('ArrowLeft');
      expect(input.moveLeft()).toBe(true);
    });

    it('moveRight returns true when d is held', () => {
      press('d');
      expect(input.moveRight()).toBe(true);
    });

    it('moveRight returns true when ArrowRight is held', () => {
      press('ArrowRight');
      expect(input.moveRight()).toBe(true);
    });

    it('movement returns false when key is not pressed', () => {
      expect(input.moveUp()).toBe(false);
      expect(input.moveDown()).toBe(false);
      expect(input.moveLeft()).toBe(false);
      expect(input.moveRight()).toBe(false);
    });
  });

  describe('action helpers (wasJustPressed)', () => {
    it('interact returns true for Space', () => {
      press(' ');
      input.flushFrame();
      expect(input.interact()).toBe(true);
    });

    it('interact returns true for Enter', () => {
      press('Enter');
      input.flushFrame();
      expect(input.interact()).toBe(true);
    });

    it('cancel returns true for Escape', () => {
      press('Escape');
      input.flushFrame();
      expect(input.cancel()).toBe(true);
    });

    it('action1 returns true for key 1', () => {
      press('1');
      input.flushFrame();
      expect(input.action1()).toBe(true);
    });

    it('action2 returns true for key 2', () => {
      press('2');
      input.flushFrame();
      expect(input.action2()).toBe(true);
    });

    it('action3 returns true for key 3', () => {
      press('3');
      input.flushFrame();
      expect(input.action3()).toBe(true);
    });

    it('action4 returns true for key 4', () => {
      press('4');
      input.flushFrame();
      expect(input.action4()).toBe(true);
    });

    it('action5 returns true for key 5', () => {
      press('5');
      input.flushFrame();
      expect(input.action5()).toBe(true);
    });

    it('openInventory returns true for key i', () => {
      press('i');
      input.flushFrame();
      expect(input.openInventory()).toBe(true);
    });

    it('openQuestLog returns true for key q', () => {
      press('q');
      input.flushFrame();
      expect(input.openQuestLog()).toBe(true);
    });

    it('toggleMute returns true for key m', () => {
      press('m');
      input.flushFrame();
      expect(input.toggleMute()).toBe(true);
    });
  });

  describe('menu navigation helpers (wasJustPressed)', () => {
    it('menuUp responds to w and ArrowUp', () => {
      press('w');
      input.flushFrame();
      expect(input.menuUp()).toBe(true);
    });

    it('menuUp responds to ArrowUp', () => {
      press('ArrowUp');
      input.flushFrame();
      expect(input.menuUp()).toBe(true);
    });

    it('menuDown responds to s and ArrowDown', () => {
      press('ArrowDown');
      input.flushFrame();
      expect(input.menuDown()).toBe(true);
    });

    it('menuLeft responds to a and ArrowLeft', () => {
      press('a');
      input.flushFrame();
      expect(input.menuLeft()).toBe(true);
    });

    it('menuLeft responds to ArrowLeft', () => {
      press('ArrowLeft');
      input.flushFrame();
      expect(input.menuLeft()).toBe(true);
    });

    it('menuRight responds to d and ArrowRight', () => {
      press('d');
      input.flushFrame();
      expect(input.menuRight()).toBe(true);
    });

    it('menuRight responds to ArrowRight', () => {
      press('ArrowRight');
      input.flushFrame();
      expect(input.menuRight()).toBe(true);
    });

    it('menu helpers are false when nothing pressed', () => {
      input.flushFrame();
      expect(input.menuUp()).toBe(false);
      expect(input.menuDown()).toBe(false);
      expect(input.menuLeft()).toBe(false);
      expect(input.menuRight()).toBe(false);
    });
  });

  describe('action key exclusivity', () => {
    // Each action key must trigger exactly one helper and leave all others false.
    // A swap or OR-expansion in any helper (e.g. action1 accidentally checking '2')
    // would silently pass the individual happy-path tests above but fail here.

    it('pressing a combat key (1) fires only action1, not other action helpers', () => {
      press('1');
      input.flushFrame();
      expect(input.action1()).toBe(true);
      expect(input.action2()).toBe(false);
      expect(input.action3()).toBe(false);
      expect(input.action4()).toBe(false);
      expect(input.action5()).toBe(false);
      expect(input.openInventory()).toBe(false);
      expect(input.openQuestLog()).toBe(false);
      expect(input.toggleMute()).toBe(false);
    });

    it('pressing a UI key (i) fires only openInventory, not combat or other UI helpers', () => {
      press('i');
      input.flushFrame();
      expect(input.openInventory()).toBe(true);
      expect(input.action1()).toBe(false);
      expect(input.action2()).toBe(false);
      expect(input.action3()).toBe(false);
      expect(input.action4()).toBe(false);
      expect(input.action5()).toBe(false);
      expect(input.openQuestLog()).toBe(false);
      expect(input.toggleMute()).toBe(false);
    });

    it('pressing a UI key (q) fires only openQuestLog, not combat or other UI helpers', () => {
      press('q');
      input.flushFrame();
      expect(input.openQuestLog()).toBe(true);
      expect(input.action1()).toBe(false);
      expect(input.action2()).toBe(false);
      expect(input.action3()).toBe(false);
      expect(input.action4()).toBe(false);
      expect(input.action5()).toBe(false);
      expect(input.openInventory()).toBe(false);
      expect(input.toggleMute()).toBe(false);
    });

    it('pressing a UI key (m) fires only toggleMute, not combat or other UI helpers', () => {
      press('m');
      input.flushFrame();
      expect(input.toggleMute()).toBe(true);
      expect(input.action1()).toBe(false);
      expect(input.action2()).toBe(false);
      expect(input.action3()).toBe(false);
      expect(input.action4()).toBe(false);
      expect(input.action5()).toBe(false);
      expect(input.openInventory()).toBe(false);
      expect(input.openQuestLog()).toBe(false);
    });
  });

  describe('non-game keys', () => {
    it('a key not in the game key list is still tracked as held and does not call preventDefault', () => {
      // Verify BOTH halves of the contract: the key is added to held AND
      // preventDefault is not called (browser defaults — copy/paste, tab focus,
      // etc. — must remain intact for non-game keys).
      const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(input.isHeld('x')).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('game-key preventDefault contract', () => {
    it('calls preventDefault for every recognized game key', () => {
      // If any of these keys stop calling preventDefault the browser may scroll the
      // page (arrows/space), trigger navigation (escape), or fire other built-in
      // actions during gameplay — a silent UX regression that the state-change tests
      // above cannot catch because they never inspect event.defaultPrevented.
      const gameKeys = [
        'w', 'a', 's', 'd',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        ' ', 'Enter', 'Escape',
        '1', '2', '3', '4', '5',
        'i', 'm', 'q',
      ];

      for (const key of gameKeys) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented, `preventDefault not called for key "${key}"`).toBe(true);
      }
    });

    it('does NOT call preventDefault for non-game keys', () => {
      // Blocking non-game keys would interfere with browser shortcuts, clipboard
      // operations, dev tools, and any text input present in the page.
      const nonGameKeys = ['x', 'c', 'v'];
      for (const key of nonGameKeys) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented, `preventDefault incorrectly called for non-game key "${key}"`).toBe(false);
      }
    });
  });
});
