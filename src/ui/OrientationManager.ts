import { isMobileDevice } from '../utils/deviceUtils';

export class OrientationManager {
  private overlay: HTMLDivElement;
  private floatingFullscreenBtn: HTMLButtonElement;
  private onOrientationChanged?: (isLandscape: boolean) => void;

  constructor(onOrientationChanged?: (isLandscape: boolean) => void) {
    this.onOrientationChanged = onOrientationChanged;
    this.overlay = document.createElement('div');
    this.overlay.id = 'orientation-lock-overlay';
    
    this.floatingFullscreenBtn = document.createElement('button');
    this.floatingFullscreenBtn.id = 'floating-fullscreen-btn';
    this.floatingFullscreenBtn.innerHTML = '⛶ <span style="font-size: 11px; font-weight: 700;">Full</span>';

    this.createOverlay();
    this.createFloatingButton();
    this.bindEvents();
    this.checkOrientation();
  }

  private createOverlay(): void {
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(10, 14, 23, 0.96)',
      backdropFilter: 'blur(16px)',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px',
      boxSizing: 'border-box',
      textAlign: 'center',
      touchAction: 'none'
    });

    this.overlay.innerHTML = `
      <style>
        @keyframes rotateDeviceAnim {
          0% {
            transform: rotate(0deg) scale(1);
          }
          30% {
            transform: rotate(-90deg) scale(1.08);
          }
          70% {
            transform: rotate(-90deg) scale(1.08);
          }
          100% {
            transform: rotate(0deg) scale(1);
          }
        }
        .phone-rotate-icon {
          animation: rotateDeviceAnim 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .fullscreen-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
        }
        .fullscreen-action-btn:active {
          transform: translateY(1px);
        }
      </style>

      <div style="display: flex; flex-direction: column; align-items: center; max-width: 380px; gap: 20px;">
        <div class="phone-rotate-icon" style="
          width: 80px;
          height: 80px;
          background: rgba(99, 102, 241, 0.15);
          border: 2px solid rgba(99, 102, 241, 0.4);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.25);
        ">
          📱
        </div>

        <div>
          <h2 style="
            margin: 0 0 8px 0;
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.3px;
          ">
            Rotate Your Device
          </h2>
          <p style="
            margin: 0;
            font-size: 14px;
            color: #94a3b8;
            line-height: 1.5;
          ">
            Please turn your phone <strong>horizontally</strong> to play in fullscreen landscape mode.
          </p>
        </div>

        <button 
          id="btn-force-landscape" 
          class="fullscreen-action-btn"
          style="
            background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
          "
        >
          <span>⛶</span>
          <span>Enter Fullscreen Landscape</span>
        </button>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const btn = this.overlay.querySelector('#btn-force-landscape');
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.requestLandscapeFullscreen();
        this.checkOrientation();
      });
      btn.addEventListener('touchend', async (e) => {
        e.stopPropagation();
        await this.requestLandscapeFullscreen();
        this.checkOrientation();
      });
    }
  }

  private createFloatingButton(): void {
    Object.assign(this.floatingFullscreenBtn.style, {
      position: 'fixed',
      top: 'calc(12px + env(safe-area-inset-top, 0px))',
      right: 'calc(210px + env(safe-area-inset-right, 0px))',
      zIndex: '1000',
      padding: '8px 12px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      cursor: 'pointer',
      display: 'none',
      alignItems: 'center',
      gap: '4px',
      fontSize: '13px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none'
    });

    const triggerFull = async (e: Event) => {
      e.stopPropagation();
      await this.requestLandscapeFullscreen();
      this.checkOrientation();
    };

    this.floatingFullscreenBtn.addEventListener('click', triggerFull);
    this.floatingFullscreenBtn.addEventListener('touchend', triggerFull);

    document.body.appendChild(this.floatingFullscreenBtn);
  }

  public isPortraitMode(): boolean {
    if (!isMobileDevice()) return false;
    
    // Check inner dimensions or orientation query
    const isPortraitDimensions = window.innerHeight > window.innerWidth;
    const isPortraitMedia = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
    const screenAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle) !== undefined
      ? (window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180)
      : false;

    return isPortraitDimensions || isPortraitMedia || screenAngle;
  }

  public checkOrientation(): void {
    if (!isMobileDevice()) {
      this.overlay.style.display = 'none';
      this.floatingFullscreenBtn.style.display = 'none';
      if (this.onOrientationChanged) this.onOrientationChanged(true);
      return;
    }

    const isPortrait = this.isPortraitMode();

    if (isPortrait) {
      this.overlay.style.display = 'flex';
      this.floatingFullscreenBtn.style.display = 'none';
      if (this.onOrientationChanged) this.onOrientationChanged(false);
    } else {
      this.overlay.style.display = 'none';
      this.floatingFullscreenBtn.style.display = 'flex';
      if (this.onOrientationChanged) this.onOrientationChanged(true);
    }
  }

  public async requestLandscapeFullscreen(): Promise<void> {
    try {
      const docEl = document.documentElement as any;

      // 1. Request Fullscreen if not already active
      if (!document.fullscreenElement && !docEl.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen().catch(() => {});
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen().catch(() => {});
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen().catch(() => {});
        }
      }

      // 2. Lock screen orientation to landscape
      if (window.screen && window.screen.orientation && 'lock' in window.screen.orientation) {
        await (window.screen.orientation as any).lock('landscape').catch(() => {
          (window.screen.orientation as any).lock('landscape-primary').catch(() => {});
        });
      }
    } catch {
      // Ignored for environments where orientation lock is not permitted
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.checkOrientation(), 150);
      setTimeout(() => this.checkOrientation(), 350);
    });

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', () => {
        setTimeout(() => this.checkOrientation(), 150);
      });
    }

    // Attempt orientation lock on first touch gesture
    const handleFirstTouch = async () => {
      if (isMobileDevice()) {
        await this.requestLandscapeFullscreen();
        this.checkOrientation();
      }
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
    };

    window.addEventListener('touchstart', handleFirstTouch, { once: true, passive: true });
    window.addEventListener('pointerdown', handleFirstTouch, { once: true, passive: true });
  }
}