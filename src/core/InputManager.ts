export class InputManager {
  private keys: Map<string, boolean> = new Map();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyDown(event: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }
    this.keys.set(event.code, true);
  }

  private onKeyUp(event: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }
    this.keys.set(event.code, false);
  }

  public isKeyDown(code: string): boolean {
    return this.keys.get(code) || false;
  }

  public getMovementVector(): { forward: number; right: number } {
    let forward = 0;
    let right = 0;

    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) forward += 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) forward -= 1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) right += 1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) right -= 1;

    return { forward, right };
  }

  public isSprinting(): boolean {
    return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
  }

  public isJumping(): boolean {
    return this.isKeyDown('Space');
  }

  public isInteractPressed(): boolean {
    return this.isKeyDown('KeyE');
  }

  public consumeInteract(): boolean {
    if (this.isInteractPressed()) {
      this.keys.set('KeyE', false); // Consume the key press
      return true;
    }
    return false;
  }

  public consumePassengerEnter(): boolean {
    if (this.isKeyDown('KeyF')) {
      this.keys.set('KeyF', false);
      return true;
    }
    return false;
  }

  public consumeSwitchEntity(): boolean {
    if (this.isKeyDown('KeyV')) {
      this.keys.set('KeyV', false); // Consume the key press
      return true;
    }
    return false;
  }
}
