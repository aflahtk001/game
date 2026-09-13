import * as THREE from 'three';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'auto';

export interface GraphicsConfig {
  preset: GraphicsPreset;
  pixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  farPlane: number;
  powerPreference: 'high-performance' | 'default' | 'low-power';
}

export class GraphicsSettingsManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private currentConfig: GraphicsConfig;

  // UI elements
  private settingsBtn: HTMLButtonElement;
  private settingsModal: HTMLDivElement;
  private isOpen: boolean = false;
  private fpsDisplay: HTMLSpanElement;

  // FPS tracking
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  public currentFPS: number = 60;

  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const defaultPreset: GraphicsPreset = isMobile ? 'medium' : 'high';
    this.currentConfig = this.getConfigForPreset(defaultPreset);

    // Create UI Elements
    this.settingsBtn = document.createElement('button');
    this.settingsBtn.id = 'graphics-settings-btn';
    this.settingsBtn.innerHTML = '⚙️';

    this.settingsModal = document.createElement('div');
    this.settingsModal.id = 'graphics-settings-modal';

    this.fpsDisplay = document.createElement('span');
    this.fpsDisplay.innerText = '60 FPS';

    this.createUI();
    this.applyConfig(this.currentConfig);
  }

  private getConfigForPreset(preset: GraphicsPreset): GraphicsConfig {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const maxMobileDPR = 1.5;
    const rawDPR = window.devicePixelRatio || 1;

    switch (preset) {
      case 'low':
        return {
          preset: 'low',
          pixelRatio: Math.min(1.0, rawDPR),
          shadowsEnabled: false,
          shadowMapSize: 512,
          farPlane: 400,
          powerPreference: 'low-power'
        };
      case 'medium':
        return {
          preset: 'medium',
          pixelRatio: isMobile ? Math.min(1.25, maxMobileDPR) : Math.min(1.5, rawDPR),
          shadowsEnabled: true,
          shadowMapSize: 512,
          farPlane: 700,
          powerPreference: 'default'
        };
      case 'high':
      case 'auto':
      default:
        return {
          preset: 'high',
          pixelRatio: isMobile ? Math.min(1.5, maxMobileDPR) : Math.min(2.0, rawDPR),
          shadowsEnabled: true,
          shadowMapSize: 1024,
          farPlane: 1000,
          powerPreference: 'high-performance'
        };
    }
  }

  public applyConfig(config: GraphicsConfig): void {
    this.currentConfig = config;

    // 1. Pixel Ratio
    this.renderer.setPixelRatio(config.pixelRatio);

    // 2. Shadows
    this.renderer.shadowMap.enabled = config.shadowsEnabled;
    this.renderer.shadowMap.type = config.shadowsEnabled ? THREE.PCFShadowMap : THREE.BasicShadowMap;

    // 3. Camera Render Distance
    this.camera.far = config.farPlane;
    this.camera.updateProjectionMatrix();
  }

  public setPreset(preset: GraphicsPreset): void {
    const config = this.getConfigForPreset(preset);
    this.applyConfig(config);
    this.updateActivePresetButtons(preset);
  }

  public update(): void {
    // Track FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFPS = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.fpsDisplay.innerText = `${this.currentFPS} FPS`;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  private createUI(): void {
    // Settings Button
    Object.assign(this.settingsBtn.style, {
      position: 'fixed',
      top: 'calc(12px + env(safe-area-inset-top, 0px))',
      right: 'calc(170px + env(safe-area-inset-right, 0px))',
      zIndex: '1000',
      padding: '8px 10px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    });

    this.settingsBtn.onclick = () => {
      this.isOpen = !this.isOpen;
      this.settingsModal.style.display = this.isOpen ? 'flex' : 'none';
    };

    // Settings Modal
    Object.assign(this.settingsModal.style, {
      position: 'fixed',
      top: 'calc(55px + env(safe-area-inset-top, 0px))',
      right: 'calc(12px + env(safe-area-inset-right, 0px))',
      width: '260px',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(12px)',
      zIndex: '1050',
      display: 'none',
      flexDirection: 'column',
      padding: '14px',
      gap: '12px',
      color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px'
    });

    this.settingsModal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px;">
        <span style="font-weight: 700; font-size: 13px;">⚙️ Graphics & Perf</span>
        <span id="fps-counter" style="color: #10b981; font-weight: 700;">60 FPS</span>
      </div>
      <div>
        <div style="font-weight: 600; margin-bottom: 6px; color: #94a3b8;">Graphics Quality:</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;" id="preset-buttons-container">
          <button data-preset="low" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-weight: 600;">Low</button>
          <button data-preset="medium" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(99,102,241,0.6); color: white; cursor: pointer; font-weight: 600;">Med</button>
          <button data-preset="high" style="padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-weight: 600;">High</button>
        </div>
      </div>
      <div style="font-size: 10px; color: #64748b; line-height: 1.4;">
        💡 <strong>Low/Med</strong> optimizes battery and framerate on mobile GPUs.
      </div>
    `;

    const counterSpan = this.settingsModal.querySelector('#fps-counter') as HTMLSpanElement;
    if (counterSpan) {
      this.fpsDisplay = counterSpan;
    }

    const presetButtons = this.settingsModal.querySelectorAll<HTMLButtonElement>('[data-preset]');
    presetButtons.forEach(btn => {
      btn.onclick = () => {
        const preset = btn.getAttribute('data-preset') as GraphicsPreset;
        this.setPreset(preset);
      };
    });

    document.body.appendChild(this.settingsBtn);
    document.body.appendChild(this.settingsModal);

    window.addEventListener('resize', () => {
      this.settingsBtn.style.top = 'calc(12px + env(safe-area-inset-top, 0px))';
      this.settingsBtn.style.right = 'calc(170px + env(safe-area-inset-right, 0px))';
      this.settingsModal.style.top = 'calc(55px + env(safe-area-inset-top, 0px))';
      this.settingsModal.style.right = 'calc(12px + env(safe-area-inset-right, 0px))';
    });

    this.updateActivePresetButtons(this.currentConfig.preset);
  }

  private updateActivePresetButtons(activePreset: GraphicsPreset): void {
    const presetButtons = this.settingsModal.querySelectorAll<HTMLButtonElement>('[data-preset]');
    presetButtons.forEach(btn => {
      const preset = btn.getAttribute('data-preset');
      if (preset === activePreset) {
        btn.style.backgroundColor = 'rgba(99, 102, 241, 0.8)';
        btn.style.borderColor = '#818cf8';
      } else {
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }
    });
  }
}
