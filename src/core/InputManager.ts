export class InputManager {
  private keys: Map<string, boolean> = new Map();

  // Mobile inputs
  private mobileMovement: { forward: number; right: number } = { forward: 0, right: 0 };
  private mobileSprint: boolean = false;
  private mobileJump: boolean = false;
  private mobileInteractTriggered: boolean = false;
  private mobilePassengerTriggered: boolean = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('blur', this.onBlur.bind(this));
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

  private onBlur() {
    this.keys.clear();
    this.resetMobileInput();
  }

  public isKeyDown(code: string): boolean {
    return this.keys.get(code) || false;
  }

  // --- Mobile Input Setters ---
  public setMobileMovement(forward: number, right: number) {
    this.mobileMovement.forward = Math.max(-1, Math.min(1, forward));
    this.mobileMovement.right = Math.max(-1, Math.min(1, right));
  }

  public setMobileSprint(isSprinting: boolean) {
    this.mobileSprint = isSprinting;
  }

  public setMobileJump(isJumping: boolean) {
    this.mobileJump = isJumping;
  }

  public triggerMobileInteract() {
    this.mobileInteractTriggered = true;
  }

  public triggerMobilePassengerEnter() {
    this.mobilePassengerTriggered = true;
  }

  public resetMobileInput() {
    this.mobileMovement = { forward: 0, right: 0 };
    this.mobileSprint = false;
    this.mobileJump = false;
    this.mobileInteractTriggered = false;
    this.mobilePassengerTriggered = false;
  }

  // --- Combined Input Querying ---
  public getMovementVector(): { forward: number; right: number } {
    let forward = 0;
    let right = 0;

    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) forward += 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) forward -= 1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) right += 1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) right -= 1;

    // Combine with mobile input
    forward += this.mobileMovement.forward;
    right += this.mobileMovement.right;

    forward = Math.max(-1, Math.min(1, forward));
    right = Math.max(-1, Math.min(1, right));

    return { forward, right };
  }

  public isSprinting(): boolean {
    return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight') || this.mobileSprint;
  }

  public isJumping(): boolean {
    return this.isKeyDown('Space') || this.mobileJump;
  }

  public isInteractPressed(): boolean {
    return this.isKeyDown('KeyE') || this.mobileInteractTriggered;
  }

  public consumeInteract(): boolean {
    if (this.mobileInteractTriggered) {
      this.mobileInteractTriggered = false;
      return true;
    }
    if (this.isKeyDown('KeyE')) {
      this.keys.set('KeyE', false); // Consume the key press
      return true;
    }
    return false;
  }

  public consumePassengerEnter(): boolean {
    if (this.mobilePassengerTriggered) {
      this.mobilePassengerTriggered = false;
      return true;
    }
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
