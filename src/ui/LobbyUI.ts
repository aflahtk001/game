import { NetworkManager } from '../network/NetworkManager';

export class LobbyUI {
  private container: HTMLDivElement;
  private network: NetworkManager;
  private isCollapsed: boolean = false;

  private statusDot!: HTMLSpanElement;
  private statusText!: HTMLSpanElement;
  private nameInput!: HTMLInputElement;
  private lobbyContent!: HTMLDivElement;
  private sessionInfoBox!: HTMLDivElement;
  private noSessionBox!: HTMLDivElement;

  constructor(network: NetworkManager) {
    this.network = network;

    this.container = document.createElement('div');
    this.container.id = 'multiplayer-lobby-ui';
    this.container.style.position = 'absolute';
    this.container.style.top = '15px';
    this.container.style.left = '15px';
    this.container.style.width = '320px';
    this.container.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
    this.container.style.color = '#e2e8f0';
    this.container.style.borderRadius = '10px';
    this.container.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
    this.container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    this.container.style.fontSize = '13px';
    this.container.style.zIndex = '1000';
    this.container.style.pointerEvents = 'auto';
    this.container.style.backdropFilter = 'blur(6px)';
    this.container.style.transition = 'all 0.2s ease-in-out';

    this.render();
    document.body.appendChild(this.container);

    this.bindNetworkEvents();

    // Toggle shortcut (Press 'M')
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'm' && document.activeElement?.tagName !== 'INPUT') {
        this.toggleCollapse();
      }
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div id="mp-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; user-select: none;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="mp-status-dot" style="width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444; display: inline-block;"></span>
          <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">Multiplayer Lobby</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span id="mp-status-text" style="font-size: 11px; color: #94a3b8;">Offline</span>
          <button id="mp-toggle-btn" style="background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px;">▼</button>
        </div>
      </div>
      <div id="mp-body" style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; display: block; margin-bottom: 4px;">Player Name</label>
          <div style="display: flex; gap: 6px;">
            <input id="mp-name-input" type="text" maxlength="24" placeholder="Enter name" style="flex: 1; padding: 6px 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 13px; outline: none;" />
            <button id="mp-save-name-btn" style="padding: 6px 12px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; font-weight: 600;">Save</button>
          </div>
        </div>

        <!-- No Active Session Section -->
        <div id="mp-no-session" style="display: flex; flex-direction: column; gap: 8px;">
          <button id="mp-create-btn" style="width: 100%; padding: 8px; background: #10b981; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 13px; font-weight: 600;">Create Game Session</button>
          
          <div style="display: flex; align-items: center; gap: 8px; margin: 2px 0;">
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
            <span style="font-size: 11px; color: #64748b;">OR</span>
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
          </div>

          <div style="display: flex; gap: 6px;">
            <input id="mp-session-id-input" type="text" placeholder="Paste Session ID" style="flex: 1; padding: 6px 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 12px; outline: none;" />
            <button id="mp-join-btn" style="padding: 6px 12px; background: #6366f1; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; font-weight: 600;">Join</button>
          </div>
        </div>

        <!-- Active Session Section -->
        <div id="mp-session-info" style="display: none; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #94a3b8;">Session ID:</span>
            <span id="mp-session-status-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #10b981; color: #fff; text-transform: uppercase;">Active</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px;">
            <span id="mp-session-id-display" style="font-family: monospace; font-size: 11px; color: #38bdf8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;">-</span>
            <button id="mp-copy-id-btn" title="Copy Session ID" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px;">📋</button>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #cbd5e1;">
            <span>Connected Players:</span>
            <span id="mp-session-count" style="font-weight: 700;">1 / 8</span>
          </div>
          <div id="mp-session-members-list" style="max-height: 100px; overflow-y: auto; font-size: 12px; color: #94a3b8; display: flex; flex-direction: column; gap: 3px;">
          </div>
          <button id="mp-leave-btn" style="width: 100%; margin-top: 4px; padding: 6px; background: #ef4444; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; font-weight: 600;">Leave Session</button>
        </div>

        <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 2px;">
          Press [M] to toggle lobby UI
        </div>
      </div>
    `;

    this.statusDot = this.container.querySelector('#mp-status-dot') as HTMLSpanElement;
    this.statusText = this.container.querySelector('#mp-status-text') as HTMLSpanElement;
    this.nameInput = this.container.querySelector('#mp-name-input') as HTMLInputElement;
    this.lobbyContent = this.container.querySelector('#mp-body') as HTMLDivElement;
    this.sessionInfoBox = this.container.querySelector('#mp-session-info') as HTMLDivElement;
    this.noSessionBox = this.container.querySelector('#mp-no-session') as HTMLDivElement;

    const header = this.container.querySelector('#mp-header') as HTMLDivElement;
    header.addEventListener('click', () => this.toggleCollapse());

    const saveNameBtn = this.container.querySelector('#mp-save-name-btn') as HTMLButtonElement;
    saveNameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = this.nameInput.value.trim();
      if (val) {
        this.network.identify(val);
      }
    });

    const createBtn = this.container.querySelector('#mp-create-btn') as HTMLButtonElement;
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.network.createSession(8);
    });

    const joinBtn = this.container.querySelector('#mp-join-btn') as HTMLButtonElement;
    const sessionInput = this.container.querySelector('#mp-session-id-input') as HTMLInputElement;
    joinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = sessionInput.value.trim();
      if (id) {
        this.network.joinSession(id);
      }
    });

    const leaveBtn = this.container.querySelector('#mp-leave-btn') as HTMLButtonElement;
    leaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.network.leaveSession();
    });

    const copyBtn = this.container.querySelector('#mp-copy-id-btn') as HTMLButtonElement;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = this.network.currentSession?.id;
      if (id) {
        navigator.clipboard.writeText(id).catch(() => {});
        copyBtn.innerText = '✓';
        setTimeout(() => { copyBtn.innerText = '📋'; }, 1500);
      }
    });
  }

  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.lobbyContent.style.display = this.isCollapsed ? 'none' : 'flex';
    const toggleBtn = this.container.querySelector('#mp-toggle-btn') as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.innerText = this.isCollapsed ? '▲' : '▼';
    }
  }

  private bindNetworkEvents(): void {
    this.network.on('connected', () => {
      this.statusDot.style.backgroundColor = '#10b981';
      this.statusText.innerText = 'Online';
      this.statusText.style.color = '#10b981';
    });

    this.network.on('disconnected', () => {
      this.statusDot.style.backgroundColor = '#ef4444';
      this.statusText.innerText = 'Offline';
      this.statusText.style.color = '#ef4444';
    });

    this.network.on('identified', (player) => {
      this.nameInput.value = player.displayName;
    });

    const updateSessionUI = () => {
      const session = this.network.currentSession;
      if (session) {
        this.noSessionBox.style.display = 'none';
        this.sessionInfoBox.style.display = 'flex';
        
        const idDisplay = this.container.querySelector('#mp-session-id-display') as HTMLSpanElement;
        const countDisplay = this.container.querySelector('#mp-session-count') as HTMLSpanElement;
        const statusBadge = this.container.querySelector('#mp-session-status-badge') as HTMLSpanElement;
        const membersList = this.container.querySelector('#mp-session-members-list') as HTMLDivElement;

        if (idDisplay) idDisplay.innerText = session.id;
        if (countDisplay) countDisplay.innerText = `${session.activePlayerCount} / ${session.maxCapacity}`;
        if (statusBadge) statusBadge.innerText = session.sessionStatus;

        if (membersList && session.members) {
          membersList.innerHTML = session.members
            .filter(m => m.isActive)
            .map(m => `<div>• ${m.displayName || m.playerId.substring(0, 8)} <span style="color:#64748b;font-size:10px;">(${m.role})</span></div>`)
            .join('');
        }
      } else {
        this.noSessionBox.style.display = 'flex';
        this.sessionInfoBox.style.display = 'none';
      }
    };

    this.network.on('session_created', updateSessionUI);
    this.network.on('session_joined', updateSessionUI);
    this.network.on('session_status', updateSessionUI);
    this.network.on('session_left', updateSessionUI);
    this.network.on('player_joined', () => {
      if (this.network.currentSession) {
        this.network.fetchSessionStatus(this.network.currentSession.id);
      }
    });
    this.network.on('player_left', () => {
      if (this.network.currentSession) {
        this.network.fetchSessionStatus(this.network.currentSession.id);
      }
    });
  }
}
