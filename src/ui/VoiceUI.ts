import { VoiceManager } from '../network/VoiceManager';

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
  private playerList: HTMLDivElement;

  private players: Map<string, VoicePlayerInfo> = new Map();
  private playerElements: Map<string, HTMLDivElement> = new Map();

  constructor(voiceManager: VoiceManager) {
    this.voiceManager = voiceManager;
    this.container = document.createElement('div');
    this.headerBar = document.createElement('div');
    this.playerList = document.createElement('div');
    this.micBtn = document.createElement('button');

    this.createUI();

    this.voiceManager.setSpeakingStateCallback((playerId: string, isSpeaking: boolean) => {
      this.updateSpeakingState(playerId, isSpeaking);
    });
  }

  private createUI() {
    this.container.id = 'voice-ui';
    this.container.style.position = 'absolute';
    this.container.style.top = '12px';
    this.container.style.right = '12px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'flex-end';
    this.container.style.gap = '8px';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    this.container.style.zIndex = '1000';

    // Header bar with toggle
    this.headerBar.style.display = 'flex';
    this.headerBar.style.alignItems = 'center';
    this.headerBar.style.gap = '8px';
    this.headerBar.style.pointerEvents = 'auto';

    this.micBtn.textContent = '?? Mic: OFF';
    this.micBtn.style.padding = '8px 14px';
    this.micBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
    this.micBtn.style.color = '#ffffff';
    this.micBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    this.micBtn.style.borderRadius = '6px';
    this.micBtn.style.cursor = 'pointer';
    this.micBtn.style.fontWeight = 'bold';
    this.micBtn.style.fontSize = '12px';
    this.micBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
    this.micBtn.style.transition = 'all 0.2s ease';

    this.micBtn.onclick = async () => {
      const isNowEnabled = await this.voiceManager.toggleMic();
      this.updateLocalMicButton(isNowEnabled);
    };

    this.headerBar.appendChild(this.micBtn);

    // Player List Container
    this.playerList.style.display = 'flex';
    this.playerList.style.flexDirection = 'column';
    this.playerList.style.gap = '4px';
    this.playerList.style.minWidth = '240px';

    this.container.appendChild(this.headerBar);
    this.container.appendChild(this.playerList);
    document.body.appendChild(this.container);
  }

  public updateLocalMicButton(isEnabled: boolean) {
    if (isEnabled) {
      this.micBtn.textContent = '??? Mic: ON';
      this.micBtn.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
      this.micBtn.style.color = '#ffffff';
    } else {
      this.micBtn.textContent = '?? Mic: OFF';
      this.micBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
      this.micBtn.style.color = '#ffffff';
      this.micBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
    }

    this.setPlayerMicStatus('local', isEnabled);
  }

  public updatePlayerList(playerList: { id: string; name: string; isLocal?: boolean }[]) {
    const currentIds = new Set(playerList.map(p => p.id));

    // Add or update players
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

    // Remove obsolete players
    for (const [id, row] of this.playerElements.entries()) {
      if (!currentIds.has(id)) {
        if (row.parentElement) {
          row.parentElement.removeChild(row);
        }
        this.playerElements.delete(id);
        this.players.delete(id);
      }
    }
  }

  public setPlayerDistance(playerId: string, distance: number) {
    const p = this.players.get(playerId);
    if (p) {
      // Only re-render if distance changed by > 0.5m to avoid DOM spam
      if (p.distance === undefined || Math.abs(p.distance - distance) > 0.5) {
        p.distance = distance;
        this.renderPlayerRow(playerId);
      }
    }
  }

  public setPlayerMicStatus(playerId: string, isMicOn: boolean, displayName?: string) {
    let p = this.players.get(playerId);
    if (!p) {
      this.players.set(playerId, {
        id: playerId,
        name: displayName || (playerId === 'local' ? 'You' : `Player_${playerId.substring(0, 4)}`),
        isLocal: playerId === 'local',
        isMicOn: isMicOn,
        isSpeaking: false
      });
      p = this.players.get(playerId);
    }
    if (p) {
      p.isMicOn = isMicOn;
      if (displayName && p.name.startsWith('Player_') && !displayName.startsWith('Player_')) {
        p.name = displayName;
      }
      this.renderPlayerRow(playerId);
    }
  }

  public updateSpeakingState(playerId: string, isSpeaking: boolean, displayName?: string) {
    const targetId = playerId === 'local' ? 'local' : playerId;
    let p = this.players.get(targetId);
    if (!p) {
      this.players.set(targetId, {
        id: targetId,
        name: displayName || (targetId === 'local' ? 'You' : `Player_${targetId.substring(0, 4)}`),
        isLocal: targetId === 'local',
        isMicOn: targetId === 'local' ? this.voiceManager.isMicEnabled : isSpeaking,
        isSpeaking: isSpeaking
      });
      p = this.players.get(targetId);
    }
    if (p) {
      p.isSpeaking = isSpeaking;
      if (isSpeaking && targetId !== 'local') {
        p.isMicOn = true;
      }
      if (displayName && p.name.startsWith('Player_') && !displayName.startsWith('Player_')) {
        p.name = displayName;
      }
      this.renderPlayerRow(targetId);
    }

    if (targetId === 'local') {
      if (isSpeaking && this.voiceManager.isMicEnabled) {
        this.micBtn.style.boxShadow = '0 0 12px 2px #22c55e';
      } else {
        this.micBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
      }
    }
  }

  private renderPlayerRow(playerId: string) {
    const data = this.players.get(playerId);
    if (!data) return;

    let row = this.playerElements.get(playerId);
    if (!row) {
      row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
      row.style.backdropFilter = 'blur(6px)';
      row.style.padding = '5px 10px';
      row.style.borderRadius = '6px';
      row.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      row.style.color = '#f8fafc';
      row.style.fontSize = '12px';
      row.style.transition = 'all 0.15s ease';

      this.playerList.appendChild(row);
      this.playerElements.set(playerId, row);
    }

    const isOutOfRange = !data.isLocal && data.distance !== undefined && data.distance > this.voiceManager.config.maxDistance;

    // Styling based on speaking and range
    if (data.isSpeaking && !isOutOfRange) {
      row.style.border = '1px solid #22c55e';
      row.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.4)';
    } else {
      row.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      row.style.boxShadow = 'none';
    }

    const micIcon = data.isMicOn ? '🎙️' : '🔇';
    const micBadgeStyle = data.isMicOn
      ? 'background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4);'
      : 'background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);';
    const micText = data.isMicOn ? 'ON' : 'OFF';

    let distanceBadge = '';
    if (!data.isLocal && data.distance !== undefined) {
      if (data.distance <= this.voiceManager.config.maxDistance) {
        distanceBadge = `<span style="color:#38bdf8; font-size:10px; margin-left:3px;">(${Math.round(data.distance)}m)</span>`;
      } else {
        distanceBadge = `<span style="color:#ef4444; font-size:10px; margin-left:3px;">(>25m)</span>`;
      }
    }

    let speakingBadge = '';
    if (isOutOfRange) {
      speakingBadge = '<span style="color:#64748b; font-size:10px;">OUT OF RANGE</span>';
    } else if (data.isSpeaking) {
      speakingBadge = '<span style="color:#4ade80; font-weight:bold; font-size:10px;">🔊 SPEAKING</span>';
    } else {
      speakingBadge = '<span style="color:#64748b; font-size:10px;">IDLE</span>';
    }

    const localTag = data.isLocal ? ' <span style="color:#38bdf8; font-size:10px;">(You)</span>' : '';

    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="padding:2px 5px; border-radius:4px; font-size:10px; font-weight:bold; ${micBadgeStyle}">
          ${micIcon} ${micText}
        </span>
        <span style="font-weight:600; color:#e2e8f0; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${data.name}${localTag}${distanceBadge}
        </span>
      </div>
      <div>
        ${speakingBadge}
      </div>
    `;
  }

  public destroy() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
