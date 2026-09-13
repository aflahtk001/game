import { PlayerDTO } from '../players/playerModel.js';
import { GameSessionDTO } from '../sessions/sessionModel.js';

export type WSClientAction =
  | 'JOIN_WORLD'
  | 'IDENTIFY'
  | 'CREATE_SESSION'
  | 'JOIN_SESSION'
  | 'LEAVE_SESSION'
  | 'GET_SESSION_STATUS'
  | 'PING'
  | 'UPDATE_STATE'
  | 'SEND_CHAT_MESSAGE'
  | 'WEBRTC_SIGNAL';

export type WSServerEvent =
  | 'WORLD_JOINED'
  | 'IDENTIFIED'
  | 'SESSION_CREATED'
  | 'SESSION_JOINED'
  | 'SESSION_LEFT'
  | 'SESSION_STATUS'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PONG'
  | 'ERROR'
  | 'STATE_UPDATE'
  | 'CHAT_MESSAGE'
  | 'CHAT_HISTORY'
  | 'WEBRTC_SIGNAL';

export interface WSClientMessage<T = unknown> {
  action: WSClientAction;
  requestId?: string;
  payload: T;
}

export interface WSServerMessage<T = unknown> {
  event: WSServerEvent;
  requestId?: string;
  payload: T;
  timestamp: string;
}

// Client Payloads
export interface JoinWorldPayload {
  playerId?: string;
  displayName: string;
}

export interface WorldJoinedPayload {
  player: PlayerDTO;
  activePlayers: Array<{ id: string; displayName: string }>;
}
export interface IdentifyPayload {
  playerId?: string;
  displayName?: string;
}

export interface CreateSessionPayload {
  maxCapacity?: number;
}

export interface JoinSessionPayload {
  sessionId: string;
  role?: 'player' | 'spectator';
}

export interface LeaveSessionPayload {
  sessionId?: string;
}

export interface GetSessionStatusPayload {
  sessionId: string;
}

export interface PingPayload {
  timestamp: number;
}

// Server Payloads
export interface IdentifiedPayload {
  player: PlayerDTO;
}

export interface SessionCreatedPayload {
  session: GameSessionDTO;
}

export interface SessionJoinedPayload {
  session: GameSessionDTO;
}

export interface SessionLeftPayload {
  sessionId: string;
}

export interface SessionStatusPayload {
  session: GameSessionDTO;
}

export interface PlayerJoinedPayload {
  sessionId: string;
  player: {
    id: string;
    displayName: string;
    role: string;
  };
}

export interface PlayerLeftPayload {
  sessionId: string;
  playerId: string;
  newHostId?: string | null;
}

export interface PongPayload {
  timestamp: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
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

export interface UpdateStatePayload {
  state: PlayerStatePayload;
}

export interface StateUpdatePayload {
  players: Record<string, PlayerStatePayload>;
}

export interface SendChatMessagePayload {
  content: string;
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
