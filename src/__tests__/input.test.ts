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
  });
});
