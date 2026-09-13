import { NetworkManager } from '../network/NetworkManager';

export class GlobalWorldHUD {
  private container: HTMLDivElement;
  private network: NetworkManager;
  private isCollapsed: boolean = true;

  private statusDot!: HTMLSpanElement;
  private playerCountText!: HTMLSpanElement;
  private playerListContainer!: HTMLDivElement;
  private toggleBtn!: HTMLButtonElement;

  constructor(network: NetworkManager) {
    this.network = network;

    this.container = document.createElement('div');
    this.container.id = 'global-world-hud';
    
    this.render();
    document.body.appendChild(this.container);

    this.bindEvents();

    // Initially hide until player is in world
    this.container.style.display = 'none';
  }

  private render(): void {
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '15px',
      left: '15px',
      width: '240px',
      backgroundColor: 'rgba(15, 18, 26, 0.85)',
      color: '#f8fafc',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontSize: '12px',
      zIndex: '1000',
      pointerEvents: 'auto',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s ease',
      userSelect: 'none',
      overflow: 'hidden'
    });

    this.container.innerHTML = `
      <div id="hud-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.03);
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="hud-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; display: inline-block;"></span>
          <span style="font-weight: 700; font-size: 13px; letter-spacing: 0.3px;">Global World</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span id="hud-player-count" style="font-size: 11px; color: #38bdf8; font-weight: 600;">1 Online</span>
          <button id="hud-toggle-btn" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; padding: 0;">▼</button>
        </div>
      </div>

      <div id="hud-body" style="
        display: none;
        padding: 10px 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        flex-direction: column;
        gap: 8px;
      ">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">
          Active Players in World
        </div>
        <div id="hud-player-list" style="
          max-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #cbd5e1;
        "></div>
        
        <div style="
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 10px;
          color: #64748b;
          display: flex;
          flex-direction: column;
          gap: 2px;
        ">
          <span>• <strong>Enter</strong> Chat</span>
          <span>• <strong>M</strong> Toggle Voice Mic</span>
          <span>• <strong>E / F</strong> Drive / Passenger</span>
        </div>
      </div>
    `;

    this.statusDot = this.container.querySelector('#hud-status-dot') as HTMLSpanElement;
    this.playerCountText = this.container.querySelector('#hud-player-count') as HTMLSpanElement;
    this.playerListContainer = this.container.querySelector('#hud-player-list') as HTMLDivElement;
    this.toggleBtn = this.container.querySelector('#hud-toggle-btn') as HTMLButtonElement;

    const header = this.container.querySelector('#hud-header') as HTMLDivElement;
    header.addEventListener('click', () => this.toggleCollapse());
  }

  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    const body = this.container.querySelector('#hud-body') as HTMLDivElement;
    if (body) {
      body.style.display = this.isCollapsed ? 'none' : 'flex';
    }
    if (this.toggleBtn) {
      this.toggleBtn.innerText = this.isCollapsed ? '▼' : '▲';
    }
  }

  public updatePlayerList(): void {
    const totalCount = this.network.activeWorldPlayers.size + 1; // self + remotes
    this.playerCountText.innerText = `${totalCount} Online`;

    const localName = this.network.localPlayer?.displayName || 'You';
    const items: string[] = [
      `<div style="display:flex; align-items:center; gap:6px;">
        <span style="width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
        <span style="color:#ffffff; font-weight:600;">${localName}</span>
        <span style="color:#6366f1; font-size:10px;">(You)</span>
      </div>`
    ];

    for (const remote of this.network.activeWorldPlayers.values()) {
      items.push(`
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="width:6px; height:6px; border-radius:50%; background:#38bdf8;"></span>
          <span>${remote.displayName}</span>
        </div>
      `);
    }

    this.playerListContainer.innerHTML = items.join('');
  }

  private bindEvents(): void {
    this.network.on('world_joined', () => {
      this.container.style.display = 'block';
      this.updatePlayerList();
    });

    this.network.on('player_joined', () => {
      this.updatePlayerList();
    });

    this.network.on('player_left', () => {
      this.updatePlayerList();
    });

    this.network.on('connected', () => {
      this.statusDot.style.backgroundColor = '#10b981';
    });

    this.network.on('disconnected', () => {
      this.statusDot.style.backgroundColor = '#ef4444';
      this.playerCountText.innerText = 'Reconnecting...';
    });
  }
}
