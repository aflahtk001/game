import type {
  NetworkConnectionState,
  NetworkGameSession,
  NetworkPlayer,
  NetworkEventMap,
} from './networkTypes';

export class NetworkManager {
  private url: string;
  private socket: WebSocket | null = null;
  private state: NetworkConnectionState = 'disconnected';
  private pingInterval: number | null = null;
  private reconnectTimer: number | null = null;

  public localPlayer: NetworkPlayer | null = null;
  public currentSession: NetworkGameSession | null = null;

  private listeners: Map<keyof NetworkEventMap, Set<Function>> = new Map();

  constructor(serverUrl?: string) {
    const envUrl = (import.meta as any).env?.VITE_WS_SERVER_URL;
    this.url = serverUrl || envUrl || 'ws://localhost:3001';
  }

  public getState(): NetworkConnectionState {
    return this.state;
  }

  public get isConnected(): boolean {
    return this.state === 'connected';
  }

  public on<K extends keyof NetworkEventMap>(event: K, handler: NetworkEventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  public off<K extends keyof NetworkEventMap>(event: K, handler: NetworkEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  private emit<K extends keyof NetworkEventMap>(event: K, ...args: Parameters<NetworkEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          (fn as any)(...args);
        } catch (e) {
          console.error(`[NetworkManager] Error in listener for event '${event}':`, e);
        }
      });
    }
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.state = 'connecting';
    console.log(`[NetworkManager] Connecting to ${this.url}...`);

    try {
      this.socket = new WebSocket(this.url);
      this.setupSocketEvents();
    } catch (err) {
      console.error('[NetworkManager] Connection failed:', err);
      this.handleDisconnect();
    }
  }

  private setupSocketEvents(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[NetworkManager] WebSocket connected');
      this.state = 'connected';
      this.emit('connected');
      this.startHeartbeat();

      // Automatically identify player
      this.identify();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (err) {
        console.error('[NetworkManager] Failed to parse message:', err);
      }
    };

    this.socket.onclose = () => {
      this.handleDisconnect();
    };

    this.socket.onerror = (err) => {
      console.warn('[NetworkManager] WebSocket error event:', err);
    };
  }

  private handleDisconnect(): void {
    this.state = 'disconnected';
    this.stopHeartbeat();
    this.emit('disconnected');

    if (this.reconnectTimer === null) {
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        console.log('[NetworkManager] Attempting to reconnect...');
        this.connect();
      }, 3000);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send('PING', { timestamp: Date.now() });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleServerMessage(msg: { event: string; payload: any; requestId?: string }): void {
    const { event, payload } = msg;

    switch (event) {
      case 'IDENTIFIED':
        this.localPlayer = payload.player;
        if (this.localPlayer) {
          sessionStorage.setItem('gta_player_id', this.localPlayer.id);
          sessionStorage.setItem('gta_display_name', this.localPlayer.displayName);
        }
        this.emit('identified', payload.player);
        break;

      case 'SESSION_CREATED':
      case 'SESSION_JOINED':
        this.currentSession = payload.session;
        if (event === 'SESSION_CREATED') {
          this.emit('session_created', payload.session);
        } else {
          this.emit('session_joined', payload.session);
        }
        break;

      case 'SESSION_LEFT':
        this.currentSession = null;
        this.emit('session_left', payload.sessionId);
        break;

      case 'SESSION_STATUS':
        this.currentSession = payload.session;
        this.emit('session_status', payload.session);
        break;

      case 'PLAYER_JOINED':
        if (this.currentSession && this.currentSession.id === payload.sessionId) {
          this.currentSession.activePlayerCount += 1;
          if (!this.currentSession.members) {
            this.currentSession.members = [];
          }
          const existingIdx = this.currentSession.members.findIndex(m => m.playerId === payload.player.id);
          if (existingIdx >= 0) {
            this.currentSession.members[existingIdx].isActive = true;
            this.currentSession.members[existingIdx].displayName = payload.player.displayName;
          } else {
            this.currentSession.members.push({
              id: payload.player.id,
              sessionId: payload.sessionId,
              playerId: payload.player.id,
              displayName: payload.player.displayName,
              role: (payload.player.role as any) || 'player',
              isActive: true,
              joinedAt: new Date().toISOString(),
              leftAt: null
            });
          }
          // Fetch full authoritative session status in background
          this.fetchSessionStatus(payload.sessionId);
        }
        this.emit('player_joined', payload);
        break;

      case 'PLAYER_LEFT':
        if (this.currentSession && this.currentSession.id === payload.sessionId) {
          this.currentSession.activePlayerCount = Math.max(0, this.currentSession.activePlayerCount - 1);
          if (this.currentSession.members) {
            const member = this.currentSession.members.find(m => m.playerId === payload.playerId);
            if (member) {
              member.isActive = false;
              member.leftAt = new Date().toISOString();
            }
          }
          // Fetch full authoritative session status in background
          this.fetchSessionStatus(payload.sessionId);
        }
        this.emit('player_left', payload);
        break;

      case 'STATE_UPDATE':
        this.emit('update_state', payload);
        break;

      case 'CHAT_MESSAGE':
        this.emit('chat_message', payload);
        break;

      case 'CHAT_HISTORY':
        this.emit('chat_history', payload);
        break;

      case 'WEBRTC_SIGNAL':
        this.emit('webrtc_signal', payload);
        break;

      case 'ERROR':
        console.error('[NetworkManager] Server error:', payload);
        this.emit('error', payload);
        break;

      case 'PONG':
        // Heartbeat response
        break;

      default:
        console.log('[NetworkManager] Unhandled server event:', event, payload);
        break;
    }
  }

  public send(action: string, payload: unknown = {}): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // console.warn('[NetworkManager] Cannot send message, socket not connected');
      return;
    }
    this.socket.send(JSON.stringify({ action, payload }));
  }

  private lastStateSendTime: number = 0;
  private readonly SEND_INTERVAL_MS = 50; // Max 20 updates per second

  public sendPlayerState(state: import('./networkTypes').PlayerStatePayload): void {
    const now = Date.now();
    if (now - this.lastStateSendTime >= this.SEND_INTERVAL_MS) {
      this.send('UPDATE_STATE', { state });
      this.lastStateSendTime = now;
    }
  }

  public sendChatMessage(content: string): void {
    if (this.currentSession) {
      this.send('SEND_CHAT_MESSAGE', { content });
    }
  }

  public sendWebRTCSignal(targetId: string, signal: any): void {
    if (this.currentSession) {
      this.send('WEBRTC_SIGNAL', { targetId, signal });
    }
  }

  public identify(displayName?: string): void {
    const savedId = sessionStorage.getItem('gta_player_id');
    const savedName = displayName || sessionStorage.getItem('gta_display_name') || `Player_${Math.floor(Math.random() * 10000)}`;
    this.send('IDENTIFY', {
      playerId: savedId || undefined,
      displayName: savedName,
    });
  }

  public createSession(maxCapacity: number = 8): void {
    this.send('CREATE_SESSION', { maxCapacity });
  }

  public joinSession(sessionId: string): void {
    this.send('JOIN_SESSION', { sessionId, role: 'player' });
  }

  public leaveSession(): void {
    this.send('LEAVE_SESSION', {});
  }

  public fetchSessionStatus(sessionId: string): void {
    this.send('GET_SESSION_STATUS', { sessionId });
  }

  public disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.state = 'disconnected';
  }
}
