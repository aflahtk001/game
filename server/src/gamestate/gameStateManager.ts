import { WebSocket, WebSocketServer } from 'ws';
import { PlayerStatePayload } from '../ws/wsTypes.js';

export interface ConnectedClient {
  socket: WebSocket;
  playerId: string;
  displayName: string;
  sessionId: string | null;
  connectedAt: Date;
  lastPingAt: Date;
  lastChatAt?: number;
}

export class GameStateManager {
  // Map of socket -> ConnectedClient
  private clientsBySocket: Map<WebSocket, ConnectedClient> = new Map();
  // Map of playerId -> ConnectedClient
  private clientsByPlayerId: Map<string, ConnectedClient> = new Map();
  // Map of sessionId -> Set of ConnectedClient
  private sessionRooms: Map<string, Set<ConnectedClient>> = new Map();
  // Map of playerId -> PlayerStatePayload
  private playerStates: Map<string, PlayerStatePayload> = new Map();

  private tickInterval: NodeJS.Timeout | null = null;

  /**
   * Register a new socket connection
   */
  public registerSocket(socket: WebSocket): void {
    // Initial placeholder until IDENTIFY message is received
  }

  /**
   * Bind socket to player identity
   */
  public registerClient(socket: WebSocket, playerId: string, displayName: string): ConnectedClient {
    // If player had an existing connection, disconnect old socket
    const existing = this.clientsByPlayerId.get(playerId);
    if (existing && existing.socket !== socket && existing.socket.readyState === WebSocket.OPEN) {
      try {
        existing.socket.close(4000, 'Superseded by new connection');
      } catch (err) {
        console.error('[GameState] Error closing old socket for player:', playerId, err);
      }
      this.unregisterClient(existing.socket);
    }

    const client: ConnectedClient = {
      socket,
      playerId,
      displayName,
      sessionId: null,
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    this.clientsBySocket.set(socket, client);
    this.clientsByPlayerId.set(playerId, client);
    return client;
  }

  /**
   * Unregister socket on disconnect
   */
  public unregisterClient(socket: WebSocket): ConnectedClient | null {
    const client = this.clientsBySocket.get(socket);
    if (!client) return null;

    if (client.sessionId) {
      this.leaveSessionRoom(client.sessionId, client);
    }

    this.clientsBySocket.delete(socket);
    this.clientsByPlayerId.delete(client.playerId);
    this.playerStates.delete(client.playerId);
    return client;
  }

  public getClientBySocket(socket: WebSocket): ConnectedClient | null {
    return this.clientsBySocket.get(socket) || null;
  }

  public getClientByPlayerId(playerId: string): ConnectedClient | null {
    return this.clientsByPlayerId.get(playerId) || null;
  }

  /**
   * Join a real-time session room
   */
  public joinSessionRoom(sessionId: string, client: ConnectedClient): void {
    if (client.sessionId && client.sessionId !== sessionId) {
      this.leaveSessionRoom(client.sessionId, client);
    }

    client.sessionId = sessionId;
    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }
    this.sessionRooms.get(sessionId)!.add(client);
  }

  /**
   * Leave a real-time session room
   */
  public leaveSessionRoom(sessionId: string, client: ConnectedClient): void {
    client.sessionId = null;
    const room = this.sessionRooms.get(sessionId);
    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
    }
  }

  /**
   * Broadcast message to all active clients in a session room
   */
  public broadcastToSession(sessionId: string, message: object, excludePlayerId?: string): void {
    const room = this.sessionRooms.get(sessionId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const client of room) {
      if (excludePlayerId && client.playerId === excludePlayerId) {
        continue;
      }
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  /**
   * Broadcast to all connected clients on server
   */
  public broadcastGlobal(message: object): void {
    const payload = JSON.stringify(message);
    for (const client of this.clientsBySocket.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  public updatePlayerState(playerId: string, state: PlayerStatePayload): void {
    this.playerStates.set(playerId, state);
  }

  public startTickLoop(wss: WebSocketServer): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    
    const TICK_RATE = 20; // 20Hz
    const TICK_MS = 1000 / TICK_RATE;

    this.tickInterval = setInterval(() => {
      // For each active session room, gather all member states and broadcast
      for (const [sessionId, roomClients] of this.sessionRooms.entries()) {
        if (roomClients.size === 0) continue;

        const sessionState: Record<string, PlayerStatePayload> = {};
        let hasState = false;

        for (const client of roomClients) {
          const state = this.playerStates.get(client.playerId);
          if (state) {
            sessionState[client.playerId] = state;
            hasState = true;
          }
        }

        if (hasState) {
          this.broadcastToSession(sessionId, {
            event: 'STATE_UPDATE',
            payload: { players: sessionState },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, TICK_MS);
  }

  /**
   * Get count of connected players
   */
  public getConnectedCount(): number {
    return this.clientsBySocket.size;
  }
}

export const gameStateManager = new GameStateManager();
