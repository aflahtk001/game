import { NetworkManager } from '../network/NetworkManager';

export class JoinScreenUI {
  private overlay: HTMLDivElement;
  private network: NetworkManager;
  private nameInput!: HTMLInputElement;
  private joinBtn!: HTMLButtonElement;
  private errorMsg!: HTMLDivElement;
  private statusIndicator!: HTMLDivElement;
  private onJoinSuccessCallback?: () => void;

  constructor(network: NetworkManager, onJoinSuccess?: () => void) {
    this.network = network;
    this.onJoinSuccessCallback = onJoinSuccess;

    this.overlay = document.createElement('div');
    this.overlay.id = 'join-screen-overlay';
    
    this.render();
    document.body.appendChild(this.overlay);

    this.bindEvents();
  }

  private render(): void {
    const savedName = sessionStorage.getItem('gta_display_name') || '';

    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(8, 10, 15, 0.82)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: '#f8fafc',
      padding: '20px',
      boxSizing: 'border-box',
      transition: 'opacity 0.4s ease, visibility 0.4s ease',
    });

    this.overlay.innerHTML = `
      <div style="
        background: linear-gradient(145deg, rgba(26, 31, 44, 0.95), rgba(15, 18, 26, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
        width: 100%;
        max-width: 440px;
        padding: 36px 32px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 20px;
        text-align: center;
        animation: joinFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <style>
          @keyframes joinFadeIn {
            from { opacity: 0; transform: translateY(16px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .join-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          }
          .join-btn:active {
            transform: translateY(1px);
          }
          .join-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
          }
        </style>

        <!-- Brand / Title Section -->
        <div>
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(99, 102, 241, 0.15);
            color: #818cf8;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 12px;
            border: 1px solid rgba(99, 102, 241, 0.3);
          ">
            <span>🌐 Persistent Global World</span>
          </div>

          <h1 style="
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          ">GTA 3D OPEN WORLD</h1>

          <p style="
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
            color: #94a3b8;
          ">
            Enter the living multiplayer city. Drive vehicles, talk with spatial 3D voice chat, and explore together in one shared global world.
          </p>
        </div>

        <!-- Connection Status -->
        <div id="join-status-indicator" style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.25);
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        ">
          <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #eab308; display: inline-block;"></span>
          <span id="join-status-text">Connecting to game server...</span>
        </div>

        <!-- Input Form -->
        <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
          <label style="
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #cbd5e1;
          ">Choose Display Name</label>
          
          <input 
            id="join-name-input"
            type="text" 
            maxlength="24" 
            placeholder="e.g. Maverick, Driver99" 
            value="${savedName}"
            style="
              width: 100%;
              box-sizing: border-box;
              padding: 12px 14px;
              background: rgba(0, 0, 0, 0.4);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 8px;
              color: #ffffff;
              font-size: 15px;
              outline: none;
              transition: border-color 0.2s ease, box-shadow 0.2s ease;
            "
          />

          <!-- Error Message Display -->
          <div id="join-error-msg" style="
            display: none;
            color: #f87171;
            font-size: 12px;
            line-height: 1.4;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.25);
            padding: 8px 12px;
            border-radius: 6px;
            margin-top: 4px;
          "></div>
        </div>

        <!-- Join Button -->
        <button 
          id="join-world-btn" 
          class="join-btn"
          style="
            width: 100%;
            padding: 13px 20px;
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
          "
        >
          Join World
        </button>

        <!-- Footer / Shortcuts Info -->
        <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
          🎮 Controls: <strong>WASD</strong> Move/Drive • <strong>E</strong> Enter Car • <strong>F</strong> Passenger • <strong>Enter</strong> Chat • <strong>M</strong> Mic
        </div>
      </div>
    `;

    this.nameInput = this.overlay.querySelector('#join-name-input') as HTMLInputElement;
    this.joinBtn = this.overlay.querySelector('#join-world-btn') as HTMLButtonElement;
    this.errorMsg = this.overlay.querySelector('#join-error-msg') as HTMLDivElement;
    this.statusIndicator = this.overlay.querySelector('#join-status-indicator') as HTMLDivElement;

    // Focus input on load
    setTimeout(() => {
      this.nameInput.focus();
      this.nameInput.select();
    }, 100);
  }

  private validateName(name: string): { valid: boolean; cleanName: string; error?: string } {
    const raw = name.trim();
    if (!raw || raw.length === 0) {
      return { valid: false, cleanName: '', error: 'Please enter a display name.' };
    }

    if (raw.length < 2) {
      return { valid: false, cleanName: '', error: 'Display name must be at least 2 characters long.' };
    }

    if (raw.length > 24) {
      return { valid: false, cleanName: '', error: 'Display name cannot exceed 24 characters.' };
    }

    // Check for unsafe HTML or script characters
    if (/[<>"'`\\]/.test(raw) || /script/i.test(raw)) {
      return { valid: false, cleanName: '', error: 'Name contains invalid or unsafe characters.' };
    }

    return { valid: true, cleanName: raw };
  }

  private showError(msg: string): void {
    this.errorMsg.innerText = msg;
    this.errorMsg.style.display = 'block';
    this.nameInput.style.borderColor = '#ef4444';
  }

  private clearError(): void {
    this.errorMsg.style.display = 'none';
    this.nameInput.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  }

  private handleJoin(): void {
    this.clearError();
    const validation = this.validateName(this.nameInput.value);

    if (!validation.valid) {
      this.showError(validation.error || 'Invalid name');
      return;
    }

    this.joinBtn.disabled = true;
    this.joinBtn.innerText = 'Joining World...';

    // Call joinWorld in NetworkManager
    this.network.joinWorld(validation.cleanName);
  }

  private bindEvents(): void {
    this.joinBtn.addEventListener('click', () => this.handleJoin());

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleJoin();
      } else {
        this.clearError();
      }
    });

    this.nameInput.addEventListener('focus', () => {
      this.nameInput.style.borderColor = '#6366f1';
      this.nameInput.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
    });

    this.nameInput.addEventListener('blur', () => {
      this.nameInput.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      this.nameInput.style.boxShadow = 'none';
    });

    // Update connection status display
    const updateConnectionUI = () => {
      const dot = this.statusIndicator.querySelector('span:first-child') as HTMLSpanElement;
      const text = this.statusIndicator.querySelector('#join-status-text') as HTMLSpanElement;
      if (!dot || !text) return;

      if (this.network.isConnected) {
        dot.style.backgroundColor = '#10b981';
        text.innerText = 'Connected to Server';
        text.style.color = '#34d399';
      } else if (this.network.getState() === 'connecting') {
        dot.style.backgroundColor = '#eab308';
        text.innerText = 'Connecting to game server...';
        text.style.color = '#fbbf24';
      } else {
        dot.style.backgroundColor = '#ef4444';
        text.innerText = 'Server Offline (Reconnecting...)';
        text.style.color = '#f87171';
      }
    };

    this.network.on('connected', updateConnectionUI);
    this.network.on('disconnected', updateConnectionUI);
    updateConnectionUI();

    // On successful world join, smoothly hide overlay
    this.network.on('world_joined', () => {
      this.hide();
      if (this.onJoinSuccessCallback) {
        this.onJoinSuccessCallback();
      }
    });

    // On join error, re-enable button and show message
    this.network.on('error', (err) => {
      this.joinBtn.disabled = false;
      this.joinBtn.innerText = 'Join World';
      this.showError(err.message || 'Failed to join game world.');
    });
  }

  public show(): void {
    this.overlay.style.opacity = '1';
    this.overlay.style.visibility = 'visible';
    this.overlay.style.pointerEvents = 'auto';
    this.joinBtn.disabled = false;
    this.joinBtn.innerText = 'Join World';
  }

  public hide(): void {
    this.overlay.style.opacity = '0';
    this.overlay.style.visibility = 'hidden';
    this.overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }, 450);
  }
}
