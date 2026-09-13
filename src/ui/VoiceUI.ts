import { VoiceManager, type MicState } from '../network/VoiceManager';

export interface VoicePlayerInfo {
  id: string;
  name: string;
  isLocal?: boolean;
  isMicOn?: boolean;
  isSpeaking?: boolean;
  distance?: number;
}

export class VoiceUI {
  private voiceManager: VoiceManager;
  private container: HTMLDivElement;
  private headerBar: HTMLDivElement;
  private micBtn: HTMLButtonElement;
  private speakerBtn: HTMLButtonElement;
  private toggleListBtn: HTMLButtonElement;
  private playerList: HTMLDivElement;
  private errorToast: HTMLDivElement;

  private isListExpanded: boolean = false;
  private players: Map<string, VoicePlayerInfo> = new Map();
  private playerElements: Map<string, HTMLDivElement> = new Map();

  constructor(voiceManager: VoiceManager) {
    this.voiceManager = voiceManager;
    this.container = document.createElement('div');
    this.headerBar = document.createElement('div');
    this.playerList = document.createElement('div');
    this.micBtn = document.createElement('button');
    this.speakerBtn = document.createElement('button');
    this.toggleListBtn = document.createElement('button');
    this.errorToast = document.createElement('div');

    this.createUI();

    this.voiceManager.setSpeakingStateCallback((playerId: string, isSpeaking: boolean) => {
      this.updateSpeakingState(playerId, isSpeaking);
    });

    this.voiceManager.onMicStateChanged = (state: MicState, errorMsg?: string) => {
      this.updateMicButtonState(state, errorMsg);
    };

    this.voiceManager.onSpeakerStateChanged = (enabled: boolean) => {
      this.updateSpeakerButtonState(enabled);
    };
  }

  private createUI() {
    this.container.id = 'voice-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = 'calc(12px + env(safe-area-inset-top, 0px))';
    this.container.style.right = 'calc(12px + env(safe-area-inset-right, 0px))';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'flex-end';
    this.container.style.gap = '6px';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    this.container.style.zIndex = '1000';

    // Header bar with toggle
    this.headerBar.style.display = 'flex';
    this.headerBar.style.alignItems = 'center';
    this.headerBar.style.gap = '6px';
    this.headerBar.style.pointerEvents = 'auto';

    // Mic Button
    this.micBtn.textContent = '🔇 Mic: OFF';
    Object.assign(this.micBtn.style, {
      padding: '8px 12px',
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.15s ease',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    });

    this.micBtn.onclick = async () => {
      await this.voiceManager.toggleMic();
    };

    // Speaker Button (Deafen / Listen)
    this.speakerBtn.textContent = '🔊 Speaker: ON';
    Object.assign(this.speakerBtn.style, {
      padding: '8px 12px',
      backgroundColor: 'rgba(34, 197, 94, 0.95)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.15s ease',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    });

    this.speakerBtn.onclick = () => {
      this.voiceManager.toggleSpeaker();
    };

    // Toggle Player List Button
    this.toggleListBtn.innerHTML = '👥';
    Object.assign(this.toggleListBtn.style, {
      padding: '8px 10px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    });

    this.toggleListBtn.onclick = () => {
      this.isListExpanded = !this.isListExpanded;
      this.playerList.style.display = this.isListExpanded ? 'flex' : 'none';
      this.toggleListBtn.style.borderColor = this.isListExpanded ? '#6366f1' : 'rgba(255, 255, 255, 0.2)';
    };

    this.headerBar.appendChild(this.micBtn);
    this.headerBar.appendChild(this.speakerBtn);
    this.headerBar.appendChild(this.toggleListBtn);

    // Error Toast
    Object.assign(this.errorToast.style, {
      display: 'none',
      fontSize: '11px',
      color: '#fca5a5',
      backgroundColor: 'rgba(127, 29, 29, 0.9)',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      maxWidth: '220px',
      textAlign: 'right',
      pointerEvents: 'none'
    });

    // Player List Container
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    this.isListExpanded = !isMobile; // Open by default on desktop, collapsed on mobile

    Object.assign(this.playerList.style, {
      display: this.isListExpanded ? 'flex' : 'none',
      flexDirection: 'column',
      gap: '4px',
      minWidth: '200px',
      maxWidth: '280px',
      pointerEvents: 'auto',
      maxHeight: '160px',
      overflowY: 'auto'
    });

    this.container.appendChild(this.headerBar);
    this.container.appendChild(this.errorToast);
    this.container.appendChild(this.playerList);
    document.body.appendChild(this.container);

    window.addEventListener('resize', () => {
      this.container.style.top = 'calc(12px + env(safe-area-inset-top, 0px))';
      this.container.style.right = 'calc(12px + env(safe-area-inset-right, 0px))';
    });
  }

  public updateMicButtonState(state: MicState, errorMsg?: string) {
    switch (state) {
      case 'enabled':
        this.micBtn.textContent = '🎙️ Mic: ON';
        this.micBtn.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
        this.micBtn.style.color = '#ffffff';
        this.errorToast.style.display = 'none';
        this.setPlayerMicStatus('local', true);
        break;
      case 'disabled':
        this.micBtn.textContent = '🔇 Mic: OFF';
        this.micBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
        this.micBtn.style.color = '#ffffff';
        this.errorToast.style.display = 'none';
        this.setPlayerMicStatus('local', false);
        break;
      case 'requesting':
        this.micBtn.textContent = '⏳ Requesting...';
        this.micBtn.style.backgroundColor = 'rgba(234, 179, 8, 0.95)';
        this.micBtn.style.color = '#ffffff';
        this.errorToast.style.display = 'none';
        break;
      case 'denied':
        this.micBtn.textContent = '🚫 Mic Denied';
        this.micBtn.style.backgroundColor = 'rgba(185, 28, 28, 0.95)';
        this.micBtn.style.color = '#ffffff';
        this.showErrorToast(errorMsg || 'Microphone access was blocked. Please enable in browser settings.');
        this.setPlayerMicStatus('local', false);
        break;
      case 'error':
        this.micBtn.textContent = '⚠️ Voice Error';
        this.micBtn.style.backgroundColor = 'rgba(185, 28, 28, 0.95)';
        this.micBtn.style.color = '#ffffff';
        this.showErrorToast(errorMsg || 'Voice connection failed.');
        this.setPlayerMicStatus('local', false);
        break;
    }
  }

  public updateSpeakerButtonState(enabled: boolean) {
    if (enabled) {
      this.speakerBtn.textContent = '🔊 Speaker: ON';
      this.speakerBtn.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
    } else {
      this.speakerBtn.textContent = '🔇 Speaker: OFF';
      this.speakerBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
    }
  }

  private showErrorToast(msg: string) {
    this.errorToast.textContent = msg;
    this.errorToast.style.display = 'block';
    setTimeout(() => {
      this.errorToast.style.display = 'none';
    }, 5000);
  }

  public updatePlayerList(playerList: { id: string; name: string; isLocal?: boolean }[]) {
    const currentIds = new Set(playerList.map(p => p.id));

    for (const p of playerList) {
      if (!this.players.has(p.id)) {
        this.players.set(p.id, {
          id: p.id,
          name: p.name,
          isLocal: p.isLocal || false,
          isMicOn: p.isLocal ? this.voiceManager.isMicEnabled : false,
          isSpeaking: false
        });
      } else {
        const existing = this.players.get(p.id)!;
        existing.name = p.name;
        if (p.isLocal) {
          existing.isMicOn = this.voiceManager.isMicEnabled;
        }
      }
      this.renderPlayerRow(p.id);
    }

    // Remove obsolete
    for (const id of this.players.keys()) {
      if (!currentIds.has(id)) {
        const el = this.playerElements.get(id);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
        this.playerElements.delete(id);
        this.players.delete(id);
      }
    }
  }

  public setPlayerMicStatus(playerId: string, isMicOn: boolean, name?: string) {
    let p = this.players.get(playerId);
    if (!p) {
      p = { id: playerId, name: name || playerId, isMicOn, isSpeaking: false, isLocal: playerId === 'local' };
      this.players.set(playerId, p);
    } else {
      p.isMicOn = isMicOn;
      if (name) p.name = name;
    }
    this.renderPlayerRow(playerId);
  }

  public updateSpeakingState(playerId: string, isSpeaking: boolean, name?: string) {
    let p = this.players.get(playerId);
    if (!p) {
      p = { id: playerId, name: name || playerId, isMicOn: true, isSpeaking, isLocal: playerId === 'local' };
      this.players.set(playerId, p);
    } else {
      p.isSpeaking = isSpeaking;
      if (name) p.name = name;
    }
    this.renderPlayerRow(playerId);
  }

  public setPlayerDistance(playerId: string, distance: number) {
    const p = this.players.get(playerId);
    if (p) {
      p.distance = distance;
      this.renderPlayerRow(playerId);
    }
  }

  private renderPlayerRow(playerId: string) {
    const p = this.players.get(playerId);
    if (!p) return;

    let el = this.playerElements.get(playerId);
    if (!el) {
      el = document.createElement('div');
      Object.assign(el.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#f8fafc',
        backdropFilter: 'blur(6px)'
      });
      this.playerList.appendChild(el);
      this.playerElements.set(playerId, el);
    }

    const isSpeaking = p.isSpeaking;
    const isMicOn = p.isMicOn;
    const distText = p.distance !== undefined && !p.isLocal ? ` (${Math.round(p.distance)}m)` : '';

    el.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="
          width: 7px; height: 7px; border-radius: 50%; display: inline-block;
          background-color: ${isSpeaking ? '#22c55e' : (isMicOn ? '#3b82f6' : '#64748b')};
          box-shadow: ${isSpeaking ? '0 0 8px #22c55e' : 'none'};
        "></span>
        <span style="font-weight: 600;">${p.name}${p.isLocal ? ' (You)' : ''}</span>
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-left: 8px;">
        ${isSpeaking ? '🔊 Speaking' : (isMicOn ? '🎙️ Ready' : '🔇 Muted')}${distText}
      </div>
    `;

    el.style.borderColor = isSpeaking ? 'rgba(34, 197, 94, 0.6)' : 'rgba(255, 255, 255, 0.1)';
  }
}
