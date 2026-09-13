export type NetworkConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface NetworkPlayer {
  id: string;
  displayName: string;
  sessionId: string | null;
  connectionStatus: 'online' | 'offline' | 'in_session';
  createdAt: string;
  lastSeenAt: string;
}

export interface NetworkSessionMember {
  id: string;
  sessionId: string;
  playerId: string;
  displayName?: string;
  role: 'host' | 'player' | 'spectator';
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
}

export interface NetworkGameSession {
  id: string;
  sessionStatus: 'waiting' | 'active' | 'finished' | 'closed';
  maxCapacity: number;
  hostPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
  activePlayerCount: number;
  members?: NetworkSessionMember[];
}

export interface PlayerStatePayload {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  velocityLength: number;
  animatorState: string;
  isDriving: boolean;
  vehicleId: string | null;
  seatIndex?: number;
  vehicleState?: {
    position: { x: number; y: number; z: number };
    rotationY: number;
    speed: number;
    steeringAngle: number;
  };
  isMicOn?: boolean;
}

export interface StateUpdatePayload {
  players: Record<string, PlayerStatePayload>;
}

export interface ChatMessagePayload {
  id: string;
  sessionId: string;
  playerId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface ChatHistoryPayload {
  messages: ChatMessagePayload[];
}

export interface WebRTCSignalPayload {
  targetId: string;
  senderId?: string; // Appended by the server before routing
  signal: any;
}

export interface NetworkEventMap {
  'connected': () => void;
  'disconnected': () => void;
  'identified': (player: NetworkPlayer) => void;
  'session_created': (session: NetworkGameSession) => void;
  'session_joined': (session: NetworkGameSession) => void;
  'session_left': (sessionId: string) => void;
  'session_status': (session: NetworkGameSession) => void;
  'player_joined': (payload: { sessionId: string; player: { id: string; displayName: string; role: string } }) => void;
  'player_left': (payload: { sessionId: string; playerId: string; newHostId?: string | null }) => void;
  'update_state': (payload: StateUpdatePayload) => void;
  'chat_message': (payload: ChatMessagePayload) => void;
  'chat_history': (payload: ChatHistoryPayload) => void;
  'webrtc_signal': (payload: WebRTCSignalPayload) => void;
  'error': (err: { code: string; message: string }) => void;
}
