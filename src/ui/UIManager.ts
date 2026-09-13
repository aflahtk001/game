import { isMobileDevice } from '../utils/deviceUtils';

export class UIManager {
  private container: HTMLDivElement;
  private interactionPrompt: HTMLDivElement;
  private hud: HTMLDivElement;
  private speedElement: HTMLSpanElement;
  private vehicleNameElement: HTMLDivElement;
  private exitHint: HTMLDivElement;

  public onPromptChanged?: (promptText: string | null) => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'game-ui-container';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.container.style.zIndex = '850';
    document.body.appendChild(this.container);

    // Interaction Prompt
    this.interactionPrompt = document.createElement('div');
    this.interactionPrompt.id = 'interaction-prompt';
    Object.assign(this.interactionPrompt.style, {
      position: 'absolute',
      top: '22%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      padding: '8px 18px',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: '600',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'none',
      textAlign: 'center',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: '860'
    });
    this.container.appendChild(this.interactionPrompt);

    // Vehicle Speedometer HUD
    this.hud = document.createElement('div');
    this.hud.id = 'vehicle-hud';
    
    this.vehicleNameElement = document.createElement('div');
    this.vehicleNameElement.innerText = 'VEHICLE';
    this.vehicleNameElement.style.fontSize = '11px';
    this.vehicleNameElement.style.fontWeight = '700';
    this.vehicleNameElement.style.letterSpacing = '1px';
    this.vehicleNameElement.style.color = '#818cf8';
    this.vehicleNameElement.style.textTransform = 'uppercase';
    this.vehicleNameElement.style.marginBottom = '2px';
    this.hud.appendChild(this.vehicleNameElement);

    const speedRow = document.createElement('div');
    speedRow.style.display = 'flex';
    speedRow.style.alignItems = 'baseline';
    speedRow.style.justifyContent = 'center';
    speedRow.style.gap = '4px';

    this.speedElement = document.createElement('span');
    this.speedElement.innerText = '0';
    this.speedElement.style.fontSize = '26px';
    this.speedElement.style.fontWeight = '800';
    this.speedElement.style.color = '#ffffff';
    speedRow.appendChild(this.speedElement);

    const unitLabel = document.createElement('span');
    unitLabel.innerText = 'MPH';
    unitLabel.style.fontSize = '11px';
    unitLabel.style.fontWeight = '700';
    unitLabel.style.color = '#94a3b8';
    speedRow.appendChild(unitLabel);

    this.hud.appendChild(speedRow);

    this.exitHint = document.createElement('div');
    this.exitHint.innerText = isMobileDevice() ? 'Tap 🚪 Exit' : '[E] Exit Vehicle';
    this.exitHint.style.fontSize = '11px';
    this.exitHint.style.marginTop = '4px';
    this.exitHint.style.color = '#cbd5e1';
    this.hud.appendChild(this.exitHint);

    this.container.appendChild(this.hud);

    this.applyHUDStyles();

    window.addEventListener('resize', () => this.applyHUDStyles());
  }

  private applyHUDStyles() {
    const isMobile = isMobileDevice();
    this.exitHint.innerText = isMobile ? 'Tap 🚪 Exit' : '[E] Exit Vehicle';

    if (isMobile) {
      // Top Center on Mobile (below voice / global HUD)
      Object.assign(this.hud.style, {
        position: 'absolute',
        top: 'calc(16px + env(safe-area-inset-top, 0px))',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        color: 'white',
        padding: '8px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        textAlign: 'center',
        minWidth: '100px',
        zIndex: '860'
      });
    } else {
      // Bottom Right on Desktop
      Object.assign(this.hud.style, {
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        top: 'auto',
        left: 'auto',
        transform: 'none',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        textAlign: 'center',
        minWidth: '110px',
        zIndex: '860'
      });
    }
  }

  public showInteractionPrompt(text: string) {
    this.interactionPrompt.innerText = text;
    this.interactionPrompt.style.display = 'block';
    if (this.onPromptChanged) {
      this.onPromptChanged(text);
    }
  }

  public hideInteractionPrompt() {
    this.interactionPrompt.style.display = 'none';
    if (this.onPromptChanged) {
      this.onPromptChanged(null);
    }
  }

  public setHUDVisible(visible: boolean) {
    this.hud.style.display = visible ? 'block' : 'none';
  }

  public updateHUD(speed: number, vehicleName?: string, isPassenger?: boolean) {
    const clampedSpeed = Math.abs(speed) < 0.5 ? 0 : speed;
    const mph = Math.abs(clampedSpeed) * 2.237;
    this.speedElement.innerText = Math.round(mph).toString();
    
    if (vehicleName) {
      this.vehicleNameElement.innerText = isPassenger ? `${vehicleName} (PASSENGER)` : vehicleName;
    }
  }
}
