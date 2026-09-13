import { InputManager } from '../core/InputManager';
import { CameraManager } from '../core/CameraManager';
import { BaseVehicle } from '../entities/vehicles/BaseVehicle';

export type VehicleKind = 'car' | 'motorcycle' | 'bus' | 'truck' | 'generic';

export class MobileControlsUI {
  private inputManager: InputManager;
  private cameraManager: CameraManager;

  // Root container & camera touch zone
  private container: HTMLDivElement;
  private cameraZone: HTMLDivElement;

  // --- Walking UI Elements ---
  private walkingContainer: HTMLDivElement;
  private joystickZone: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickKnob: HTMLDivElement;
  private walkingButtons: HTMLDivElement;
  private jumpBtn: HTMLButtonElement;
  private sprintBtn: HTMLButtonElement;
  private sitBtn: HTMLButtonElement;
  private enterVehicleBtn: HTMLButtonElement;

  // --- Driving UI Elements ---
  private drivingContainer: HTMLDivElement;
  private steerLeftBtn: HTMLButtonElement;
  private steerRightBtn: HTMLButtonElement;
  private gasBtn: HTMLButtonElement;
  private brakeBtn: HTMLButtonElement;
  private exitVehicleBtn: HTMLButtonElement;
  private vehicleTypeBadge: HTMLDivElement;

  // State
  public isVisible: boolean = false;
  public isDriving: boolean = false;
  public isChatting: boolean = false;
  private currentVehicle: BaseVehicle | null = null;
  private currentVehicleKind: VehicleKind = 'generic';
  private nearbyVehicleKind: VehicleKind | null = null;

  public getCurrentVehicleKind(): VehicleKind {
    return this.currentVehicleKind;
  }

  public getNearbyVehicleKind(): VehicleKind | null {
    return this.nearbyVehicleKind;
  }

  // Touch tracking
  private joystickTouchId: number | null = null;
  private cameraTouchId: number | null = null;
  private lastCameraTouch: { x: number; y: number } | null = null;

  // Driving touch state
  private drivingState = {
    forward: 0,
    right: 0
  };

  // Joystick geometry
  private joystickBaseRect: DOMRect | null = null;
  private joystickRadius: number = 55;
  private deadzone: number = 0.08;

  // Camera sensitivity
  private cameraSensitivity: number = 0.0035;

  constructor(inputManager: InputManager, cameraManager: CameraManager) {
    this.inputManager = inputManager;
    this.cameraManager = cameraManager;

    // 1. Root Container
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls-root';

    // 2. Camera Touch Drag Zone (Full screen interactive backdrop)
    this.cameraZone = document.createElement('div');
    this.cameraZone.id = 'mobile-camera-zone';
    this.container.appendChild(this.cameraZone);

    // 3. Build Walking Controls Subsystem
    this.walkingContainer = document.createElement('div');
    this.walkingContainer.id = 'mobile-walking-container';

    // Joystick
    this.joystickZone = document.createElement('div');
    this.joystickZone.id = 'mobile-joystick-zone';
    this.joystickBase = document.createElement('div');
    this.joystickBase.id = 'mobile-joystick-base';
    this.joystickKnob = document.createElement('div');
    this.joystickKnob.id = 'mobile-joystick-knob';
    this.joystickBase.appendChild(this.joystickKnob);
    this.joystickZone.appendChild(this.joystickBase);
    this.walkingContainer.appendChild(this.joystickZone);

    // Walking Action Buttons
    this.walkingButtons = document.createElement('div');
    this.walkingButtons.id = 'mobile-walking-buttons';

    this.jumpBtn = this.createActionButton('jump-btn', 'JUMP', '⬆️', 'rgba(59, 130, 246, 0.45)');
    this.sprintBtn = this.createActionButton('sprint-btn', 'SPRINT', '⚡', 'rgba(234, 179, 8, 0.45)');
    this.sitBtn = this.createActionButton('sit-btn', 'SIT', '🪑', 'rgba(168, 85, 247, 0.45)');
    
    // Context-sensitive Enter Vehicle Button
    this.enterVehicleBtn = this.createActionButton('enter-vehicle-btn', 'ENTER', '🚗', 'rgba(16, 185, 129, 0.85)');
    this.enterVehicleBtn.style.display = 'none';

    this.walkingButtons.appendChild(this.sitBtn);
    this.walkingButtons.appendChild(this.sprintBtn);
    this.walkingButtons.appendChild(this.jumpBtn);
    this.walkingButtons.appendChild(this.enterVehicleBtn);
    this.walkingContainer.appendChild(this.walkingButtons);

    this.container.appendChild(this.walkingContainer);

    // 4. Build Driving Controls Subsystem
    this.drivingContainer = document.createElement('div');
    this.drivingContainer.id = 'mobile-driving-container';
    this.drivingContainer.style.display = 'none';

    // Steering Buttons (Left Side)
    const steerGroup = document.createElement('div');
    steerGroup.id = 'mobile-steer-group';
    this.steerLeftBtn = this.createDrivingButton('steer-left-btn', '◀', 'STEER LEFT', 'rgba(30, 41, 59, 0.65)');
    this.steerRightBtn = this.createDrivingButton('steer-right-btn', '▶', 'STEER RIGHT', 'rgba(30, 41, 59, 0.65)');
    steerGroup.appendChild(this.steerLeftBtn);
    steerGroup.appendChild(this.steerRightBtn);
    this.drivingContainer.appendChild(steerGroup);

    // Pedals & Exit (Right Side)
    const pedalGroup = document.createElement('div');
    pedalGroup.id = 'mobile-pedal-group';

    this.vehicleTypeBadge = document.createElement('div');
    this.vehicleTypeBadge.id = 'mobile-vehicle-badge';
    this.vehicleTypeBadge.innerText = 'CAR CONTROLS';
    pedalGroup.appendChild(this.vehicleTypeBadge);

    this.exitVehicleBtn = this.createDrivingButton('exit-vehicle-btn', '🚪', 'EXIT VEHICLE', 'rgba(239, 68, 68, 0.7)');
    this.gasBtn = this.createDrivingButton('gas-btn', '▲', 'GAS / ACCEL', 'rgba(16, 185, 129, 0.65)');
    this.brakeBtn = this.createDrivingButton('brake-btn', '▼', 'BRAKE / REV', 'rgba(245, 158, 11, 0.65)');

    pedalGroup.appendChild(this.exitVehicleBtn);
    pedalGroup.appendChild(this.gasBtn);
    pedalGroup.appendChild(this.brakeBtn);
    this.drivingContainer.appendChild(pedalGroup);

    this.container.appendChild(this.drivingContainer);

    // Assemble Styles & Events
    this.applyStyles();
    this.bindEvents();

    document.body.appendChild(this.container);

    this.checkMobileAndToggle();
  }

  public static isMobileDevice(): boolean {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
    const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return (hasTouch && (isMobileUA || isCoarsePointer)) || hasTouch;
  }

  private checkMobileAndToggle(): void {
    if (MobileControlsUI.isMobileDevice()) {
      this.show();
    } else {
      this.hide();
    }
  }

  public show(): void {
    this.container.style.display = 'block';
    this.isVisible = true;
    this.updateGeometry();
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
    this.resetAllTouches();
  }

  public setChatting(isChatting: boolean): void {
    this.isChatting = isChatting;
    if (isChatting) {
      this.resetAllTouches();
    }
  }

  public setNearbyVehicle(vehicleText: string | null): void {
    if (!vehicleText) {
      this.nearbyVehicleKind = null;
      this.enterVehicleBtn.style.display = 'none';
      this.sitBtn.style.display = 'flex';
      return;
    }

    const lower = vehicleText.toLowerCase();
    if (lower.includes('motorcycle') || lower.includes('bike')) {
      this.nearbyVehicleKind = 'motorcycle';
      this.enterVehicleBtn.innerHTML = `
        <div style="font-size: 20px; line-height: 1; pointer-events: none;">🏍️</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">RIDE</div>
      `;
    } else if (lower.includes('bus')) {
      this.nearbyVehicleKind = 'bus';
      this.enterVehicleBtn.innerHTML = `
        <div style="font-size: 20px; line-height: 1; pointer-events: none;">🚌</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">ENTER</div>
      `;
    } else if (lower.includes('truck')) {
      this.nearbyVehicleKind = 'truck';
      this.enterVehicleBtn.innerHTML = `
        <div style="font-size: 20px; line-height: 1; pointer-events: none;">🚚</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">DRIVE</div>
      `;
    } else {
      this.nearbyVehicleKind = 'car';
      this.enterVehicleBtn.innerHTML = `
        <div style="font-size: 20px; line-height: 1; pointer-events: none;">🚗</div>
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">DRIVE</div>
      `;
    }

    this.enterVehicleBtn.style.display = 'flex';
    // Hide sit button while enter prompt is active to avoid clutter
    this.sitBtn.style.display = 'none';
  }

  public setDrivingMode(isDriving: boolean, vehicle: BaseVehicle | null): void {
    if (this.isDriving === isDriving && this.currentVehicle === vehicle) return;

    this.isDriving = isDriving;
    this.currentVehicle = vehicle;
    this.resetAllTouches();

    if (isDriving && vehicle) {
      const className = vehicle.constructor.name.toLowerCase();
      if (className.includes('motorcycle') || className.includes('bike')) {
        this.currentVehicleKind = 'motorcycle';
        this.vehicleTypeBadge.innerText = '🏍️ MOTORCYCLE';
        this.gasBtn.querySelector('.btn-label')!.textContent = 'THROTTLE';
        this.brakeBtn.querySelector('.btn-label')!.textContent = 'BRAKE';
      } else if (className.includes('bus')) {
        this.currentVehicleKind = 'bus';
        this.vehicleTypeBadge.innerText = '🚌 CITY BUS';
        this.gasBtn.querySelector('.btn-label')!.textContent = 'GAS (HEAVY)';
        this.brakeBtn.querySelector('.btn-label')!.textContent = 'AIR BRAKE';
      } else if (className.includes('truck')) {
        this.currentVehicleKind = 'truck';
        this.vehicleTypeBadge.innerText = '🚚 TRUCK';
        this.gasBtn.querySelector('.btn-label')!.textContent = 'THROTTLE';
        this.brakeBtn.querySelector('.btn-label')!.textContent = 'BRAKE / REV';
      } else {
        this.currentVehicleKind = 'car';
        this.vehicleTypeBadge.innerText = '🚗 CAR CONTROLS';
        this.gasBtn.querySelector('.btn-label')!.textContent = 'GAS / DRIVE';
        this.brakeBtn.querySelector('.btn-label')!.textContent = 'BRAKE / REV';
      }

      this.walkingContainer.style.display = 'none';
      this.drivingContainer.style.display = 'flex';
    } else {
      this.currentVehicleKind = 'generic';
      this.drivingContainer.style.display = 'none';
      this.walkingContainer.style.display = 'block';
    }
  }

  private createActionButton(id: string, label: string, icon: string, baseBg: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = id;
    btn.innerHTML = `
      <div style="font-size: 20px; line-height: 1; pointer-events: none;">${icon}</div>
      <div class="btn-label" style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">${label}</div>
    `;

    Object.assign(btn.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderRadius: '50%',
      color: '#ffffff',
      backgroundColor: baseBg,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.45)',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none',
      outline: 'none',
      cursor: 'pointer',
      transition: 'transform 0.1s ease, background-color 0.15s ease, box-shadow 0.15s ease',
      pointerEvents: 'auto',
      padding: '0',
    });

    return btn;
  }

  private createDrivingButton(id: string, icon: string, label: string, baseBg: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = id;
    btn.innerHTML = `
      <div style="font-size: 22px; font-weight: 800; line-height: 1; pointer-events: none;">${icon}</div>
      <div class="btn-label" style="font-size: 9px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; pointer-events: none;">${label}</div>
    `;

    Object.assign(btn.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderRadius: '12px',
      color: '#ffffff',
      backgroundColor: baseBg,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.45)',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none',
      outline: 'none',
      cursor: 'pointer',
      transition: 'transform 0.08s ease, background-color 0.15s ease, box-shadow 0.15s ease',
      pointerEvents: 'auto',
      padding: '6px',
    });

    return btn;
  }

  private applyStyles(): void {
    // Root container
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '900',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none',
      overflow: 'hidden',
    });

    // Camera zone
    Object.assign(this.cameraZone.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'auto',
      touchAction: 'none',
      zIndex: '1',
    });

    // ── Walking Layout ──
    Object.assign(this.joystickZone.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      width: '45vw',
      maxWidth: '280px',
      height: '45vh',
      maxHeight: '280px',
      pointerEvents: 'auto',
      touchAction: 'none',
      zIndex: '10',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      paddingLeft: 'calc(24px + env(safe-area-inset-left, 0px))',
      boxSizing: 'border-box',
    });

    Object.assign(this.joystickBase.style, {
      width: '130px',
      height: '130px',
      borderRadius: '50%',
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      border: '2px solid rgba(255, 255, 255, 0.25)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(8px)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      touchAction: 'none',
    });

    Object.assign(this.joystickKnob.style, {
      width: '54px',
      height: '54px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      border: '2px solid rgba(255, 255, 255, 0.9)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 10px rgba(99, 102, 241, 0.5)',
      pointerEvents: 'none',
      touchAction: 'none',
      transform: 'translate(0px, 0px)',
      transition: 'transform 0.04s ease-out',
    });

    Object.assign(this.walkingButtons.style, {
      position: 'absolute',
      right: 'calc(20px + env(safe-area-inset-right, 0px))',
      bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 62px)',
      gridTemplateRows: 'repeat(2, 62px)',
      gap: '14px',
      alignItems: 'center',
      justifyItems: 'center',
      pointerEvents: 'auto',
      zIndex: '10',
    });

    Object.assign(this.sitBtn.style, { width: '56px', height: '56px', gridColumn: '1', gridRow: '1' });
    Object.assign(this.enterVehicleBtn.style, { width: '58px', height: '58px', gridColumn: '1', gridRow: '1' });
    Object.assign(this.sprintBtn.style, { width: '58px', height: '58px', gridColumn: '2', gridRow: '1' });
    Object.assign(this.jumpBtn.style, { width: '66px', height: '66px', gridColumn: '2', gridRow: '2' });

    // ── Driving Layout ──
    Object.assign(this.drivingContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
      display: 'none',
    });

    const steerGroup = this.drivingContainer.querySelector('#mobile-steer-group') as HTMLElement;
    if (steerGroup) {
      Object.assign(steerGroup.style, {
        position: 'absolute',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        left: 'calc(24px + env(safe-area-inset-left, 0px))',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        pointerEvents: 'auto',
      });
    }

    Object.assign(this.steerLeftBtn.style, { width: '70px', height: '70px', borderRadius: '14px' });
    Object.assign(this.steerRightBtn.style, { width: '70px', height: '70px', borderRadius: '14px' });

    const pedalGroup = this.drivingContainer.querySelector('#mobile-pedal-group') as HTMLElement;
    if (pedalGroup) {
      Object.assign(pedalGroup.style, {
        position: 'absolute',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        right: 'calc(24px + env(safe-area-inset-right, 0px))',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 70px)',
        gridTemplateRows: 'auto repeat(2, 64px)',
        gap: '12px',
        alignItems: 'center',
        justifyItems: 'center',
        pointerEvents: 'auto',
      });
    }

    Object.assign(this.vehicleTypeBadge.style, {
      gridColumn: '1 / -1',
      fontSize: '11px',
      fontWeight: '800',
      letterSpacing: '1px',
      color: '#818cf8',
      textTransform: 'uppercase',
      textAlign: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      padding: '4px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      width: '100%',
      boxSizing: 'border-box',
    });

    Object.assign(this.exitVehicleBtn.style, {
      gridColumn: '1 / -1',
      width: '100%',
      height: '42px',
      flexDirection: 'row',
      gap: '8px',
      borderRadius: '8px',
      backgroundColor: 'rgba(239, 68, 68, 0.75)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
    });

    Object.assign(this.gasBtn.style, {
      gridColumn: '2',
      gridRow: '3',
      width: '70px',
      height: '70px',
      borderRadius: '14px',
      backgroundColor: 'rgba(16, 185, 129, 0.75)',
    });

    Object.assign(this.brakeBtn.style, {
      gridColumn: '1',
      gridRow: '3',
      width: '70px',
      height: '70px',
      borderRadius: '14px',
      backgroundColor: 'rgba(245, 158, 11, 0.75)',
    });
  }

  private updateGeometry(): void {
    if (this.joystickBase) {
      this.joystickBaseRect = this.joystickBase.getBoundingClientRect();
      this.joystickRadius = Math.max(35, Math.min(60, (this.joystickBaseRect.width / 2) - 10));
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.applyStyles();
      this.updateGeometry();
      this.checkMobileAndToggle();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.applyStyles();
        this.updateGeometry();
        this.checkMobileAndToggle();
      }, 100);
    });

    window.addEventListener('blur', () => this.resetAllTouches());

    window.addEventListener('touchstart', () => {
      if (!this.isVisible) {
        this.show();
      }
    }, { passive: true, once: true });

    // ── Virtual Joystick (Walking) ─────────────────────────────────────────
    this.joystickZone.addEventListener('touchstart', (e: TouchEvent) => {
      if (this.isChatting || this.isDriving) return;
      e.preventDefault();
      if (this.joystickTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;
      this.updateGeometry();
      this.handleJoystickMove(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (this.isChatting || this.isDriving) return;
      if (this.joystickTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            e.preventDefault();
            this.handleJoystickMove(touch.clientX, touch.clientY);
            break;
          }
        }
      }
    }, { passive: false });

    const handleJoystickEnd = (e: TouchEvent) => {
      if (this.joystickTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          e.preventDefault();
          this.resetJoystick();
          break;
        }
      }
    };

    window.addEventListener('touchend', handleJoystickEnd, { passive: false });
    window.addEventListener('touchcancel', handleJoystickEnd, { passive: false });

    // ── Camera Touch Drag ───────────────────────────────────────────────────
    this.cameraZone.addEventListener('touchstart', (e: TouchEvent) => {
      if (this.isChatting) return;
      if (this.cameraTouchId !== null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) continue;

        this.cameraTouchId = touch.identifier;
        this.lastCameraTouch = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (this.isChatting || this.cameraTouchId === null || !this.lastCameraTouch) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.cameraTouchId) {
          const deltaX = touch.clientX - this.lastCameraTouch.x;
          const deltaY = touch.clientY - this.lastCameraTouch.y;

          this.lastCameraTouch = { x: touch.clientX, y: touch.clientY };
          this.cameraManager.rotate(deltaX, deltaY, this.cameraSensitivity);
          break;
        }
      }
    }, { passive: true });

    const handleCameraEnd = (e: TouchEvent) => {
      if (this.cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.cameraTouchId) {
          this.cameraTouchId = null;
          this.lastCameraTouch = null;
          break;
        }
      }
    };

    window.addEventListener('touchend', handleCameraEnd, { passive: true });
    window.addEventListener('touchcancel', handleCameraEnd, { passive: true });

    // ── Walking Action Button Handlers ─────────────────────────────────────
    this.bindTouchButton(this.jumpBtn, {
      onPress: () => this.inputManager.setMobileJump(true),
      onRelease: () => this.inputManager.setMobileJump(false),
      activeBg: 'rgba(59, 130, 246, 0.9)',
    });

    this.bindTouchButton(this.sprintBtn, {
      onPress: () => this.inputManager.setMobileSprint(true),
      onRelease: () => this.inputManager.setMobileSprint(false),
      activeBg: 'rgba(234, 179, 8, 0.9)',
    });

    this.bindTouchButton(this.sitBtn, {
      onPress: () => this.inputManager.triggerMobileInteract(),
      onRelease: () => {},
      activeBg: 'rgba(168, 85, 247, 0.9)',
    });

    this.bindTouchButton(this.enterVehicleBtn, {
      onPress: () => this.inputManager.triggerMobileInteract(),
      onRelease: () => {},
      activeBg: 'rgba(16, 185, 129, 1)',
    });

    // ── Driving Control Handlers ────────────────────────────────────────────
    this.bindTouchButton(this.steerLeftBtn, {
      onPress: () => {
        this.drivingState.right = -1;
        this.updateDrivingMovement();
      },
      onRelease: () => {
        if (this.drivingState.right === -1) {
          this.drivingState.right = 0;
        }
        this.updateDrivingMovement();
      },
      activeBg: 'rgba(59, 130, 246, 0.85)',
    });

    this.bindTouchButton(this.steerRightBtn, {
      onPress: () => {
        this.drivingState.right = 1;
        this.updateDrivingMovement();
      },
      onRelease: () => {
        if (this.drivingState.right === 1) {
          this.drivingState.right = 0;
        }
        this.updateDrivingMovement();
      },
      activeBg: 'rgba(59, 130, 246, 0.85)',
    });

    this.bindTouchButton(this.gasBtn, {
      onPress: () => {
        this.drivingState.forward = 1;
        this.updateDrivingMovement();
      },
      onRelease: () => {
        if (this.drivingState.forward === 1) {
          this.drivingState.forward = 0;
        }
        this.updateDrivingMovement();
      },
      activeBg: 'rgba(16, 185, 129, 0.95)',
    });

    this.bindTouchButton(this.brakeBtn, {
      onPress: () => {
        this.drivingState.forward = -1;
        this.updateDrivingMovement();
      },
      onRelease: () => {
        if (this.drivingState.forward === -1) {
          this.drivingState.forward = 0;
        }
        this.updateDrivingMovement();
      },
      activeBg: 'rgba(245, 158, 11, 0.95)',
    });

    this.bindTouchButton(this.exitVehicleBtn, {
      onPress: () => {
        this.inputManager.triggerMobileInteract();
      },
      onRelease: () => {},
      activeBg: 'rgba(239, 68, 68, 1)',
    });
  }

  private bindTouchButton(
    btn: HTMLButtonElement,
    options: {
      onPress: () => void;
      onRelease: () => void;
      activeBg: string;
    }
  ): void {
    const originalBg = btn.style.backgroundColor;

    const press = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.isChatting) return;
      btn.style.transform = 'scale(0.92)';
      btn.style.backgroundColor = options.activeBg;
      btn.style.boxShadow = '0 0 16px rgba(255, 255, 255, 0.5)';
      options.onPress();
    };

    const release = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.transform = 'scale(1)';
      btn.style.backgroundColor = originalBg;
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.45)';
      options.onRelease();
    };

    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  }

  private updateDrivingMovement(): void {
    this.inputManager.setMobileMovement(this.drivingState.forward, this.drivingState.right);
  }

  private handleJoystickMove(clientX: number, clientY: number): void {
    if (!this.joystickBaseRect) {
      this.updateGeometry();
    }
    if (!this.joystickBaseRect) return;

    const centerX = this.joystickBaseRect.left + this.joystickBaseRect.width / 2;
    const centerY = this.joystickBaseRect.top + this.joystickBaseRect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    const distance = Math.hypot(deltaX, deltaY);
    const maxRadius = this.joystickRadius;

    let clampedX = deltaX;
    let clampedY = deltaY;

    if (distance > maxRadius) {
      const angle = Math.atan2(deltaY, deltaX);
      clampedX = Math.cos(angle) * maxRadius;
      clampedY = Math.sin(angle) * maxRadius;
    }

    this.joystickKnob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

    let rawRight = clampedX / maxRadius;
    let rawForward = -clampedY / maxRadius;

    const rawDistance = Math.hypot(rawRight, rawForward);

    if (rawDistance < this.deadzone) {
      this.inputManager.setMobileMovement(0, 0);
    } else {
      const scaledDistance = (rawDistance - this.deadzone) / (1 - this.deadzone);
      const angle = Math.atan2(rawForward, rawRight);
      const forward = Math.sin(angle) * scaledDistance;
      const right = Math.cos(angle) * scaledDistance;

      this.inputManager.setMobileMovement(forward, right);
    }
  }

  private resetJoystick(): void {
    this.joystickTouchId = null;
    this.joystickKnob.style.transform = 'translate(0px, 0px)';
    this.inputManager.setMobileMovement(0, 0);
  }

  private resetDrivingState(): void {
    this.drivingState.forward = 0;
    this.drivingState.right = 0;
    this.updateDrivingMovement();
  }

  public resetAllTouches(): void {
    this.resetJoystick();
    this.resetDrivingState();
    this.cameraTouchId = null;
    this.lastCameraTouch = null;
    this.inputManager.resetMobileInput();
  }
}
