export class InputManager {
  private held: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  private justPressedBuffer: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    // Prevent default for game keys
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
         ' ', 'enter', 'escape', '1', '2', '3', '4', '5', 'i', 'm', 'q'].includes(key)) {
      e.preventDefault();
    }

    if (!this.held.has(key)) {
      this.held.add(key);
      this.justPressedBuffer.add(key);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.held.delete(key);
  }

  // Call at start of each frame
  flushFrame(): void {
    this.justPressed = new Set(this.justPressedBuffer);
    this.justPressedBuffer.clear();
  }

  isHeld(key: string): boolean {
    return this.held.has(key.toLowerCase());
  }

  wasJustPressed(key: string): boolean {
    return this.justPressed.has(key.toLowerCase());
  }

  // Movement helpers (held — for overworld walking)
  moveUp(): boolean {
    return this.isHeld('w') || this.isHeld('arrowup');
  }

  moveDown(): boolean {
    return this.isHeld('s') || this.isHeld('arrowdown');
  }

  moveLeft(): boolean {
    return this.isHeld('a') || this.isHeld('arrowleft');
  }

  moveRight(): boolean {
    return this.isHeld('d') || this.isHeld('arrowright');
  }

  // Menu navigation helpers (just pressed — for menus)
  menuUp(): boolean {
    return this.wasJustPressed('w') || this.wasJustPressed('arrowup');
  }

  menuDown(): boolean {
    return this.wasJustPressed('s') || this.wasJustPressed('arrowdown');
  }

  menuLeft(): boolean {
    return this.wasJustPressed('a') || this.wasJustPressed('arrowleft');
  }

  menuRight(): boolean {
    return this.wasJustPressed('d') || this.wasJustPressed('arrowright');
  }

  interact(): boolean {
    return this.wasJustPressed(' ') || this.wasJustPressed('enter');
  }

  cancel(): boolean {
    return this.wasJustPressed('escape');
  }

  action1(): boolean {
    return this.wasJustPressed('1');
  }

  action2(): boolean {
    return this.wasJustPressed('2');
  }

  action3(): boolean {
    return this.wasJustPressed('3');
  }

  action4(): boolean {
    return this.wasJustPressed('4');
  }

  action5(): boolean {
    return this.wasJustPressed('5');
  }

  openInventory(): boolean {
    return this.wasJustPressed('i');
  }

  openQuestLog(): boolean {
    return this.wasJustPressed('q');
  }

  toggleMute(): boolean {
    return this.wasJustPressed('m');
  }
}
