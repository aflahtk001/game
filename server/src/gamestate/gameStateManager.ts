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
  // Single Global World Clients Set
  private globalClients: Set<ConnectedClient> = new Set();
  // Map of sessionId -> Set of ConnectedClient (for backward compatibility if needed)
  private sessionRooms: Map<string, Set<ConnectedClient>> = new Map();
  // Map of playerId -> PlayerStatePayload
  private playerStates: Map<string, PlayerStatePayload> = new Map();

  private tickInterval: NodeJS.Timeout | null = null;

  /**
   * Register a new socket connection
   */
  public registerSocket(socket: WebSocket): void {
    // Initial placeholder until IDENTIFY/JOIN_WORLD message is received
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
      sessionId: 'global',
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    this.clientsBySocket.set(socket, client);
    this.clientsByPlayerId.set(playerId, client);
    return client;
  }

  /**
   * Join the single global world
   */
  public joinGlobalWorld(client: ConnectedClient): void {
    client.sessionId = 'global';
    this.globalClients.add(client);
  }

  /**
   * Leave the single global world
   */
  public leaveGlobalWorld(client: ConnectedClient): void {
    this.globalClients.delete(client);
  }

  /**
   * Get active players in the global world
   */
  public getGlobalActivePlayers(excludePlayerId?: string): Array<{ id: string; displayName: string }> {
    const list: Array<{ id: string; displayName: string }> = [];
    for (const client of this.globalClients) {
      if (excludePlayerId && client.playerId === excludePlayerId) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        list.push({
          id: client.playerId,
          displayName: client.displayName,
        });
      }
    }
    return list;
  }

  /**
   * Broadcast message to all active clients in the global world
   */
  public broadcastToWorld(message: object, excludePlayerId?: string): void {
    const payload = JSON.stringify(message);
    for (const client of this.globalClients) {
      if (excludePlayerId && client.playerId === excludePlayerId) {
        continue;
      }
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  /**
   * Unregister socket on disconnect
   */
  public unregisterClient(socket: WebSocket): ConnectedClient | null {
    const client = this.clientsBySocket.get(socket);
    if (!client) return null;

    this.leaveGlobalWorld(client);

    if (client.sessionId && client.sessionId !== 'global') {
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
   * Join a real-time session room (backward compatibility)
   */
  public joinSessionRoom(sessionId: string, client: ConnectedClient): void {
    if (client.sessionId && client.sessionId !== sessionId && client.sessionId !== 'global') {
      this.leaveSessionRoom(client.sessionId, client);
    }

    client.sessionId = sessionId;
    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }
    this.sessionRooms.get(sessionId)!.add(client);
  }

  /**
   * Leave a real-time session room (backward compatibility)
   */
  public leaveSessionRoom(sessionId: string, client: ConnectedClient): void {
    const room = this.sessionRooms.get(sessionId);
    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
    }
  }

  /**
   * Broadcast message to all active clients in a session room (backward compatibility)
   */
  public broadcastToSession(sessionId: string, message: object, excludePlayerId?: string): void {
    if (sessionId === 'global') {
      this.broadcastToWorld(message, excludePlayerId);
      return;
    }
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
      // 1. Broadcast global world state
      if (this.globalClients.size > 0) {
        const worldState: Record<string, PlayerStatePayload> = {};
        let hasState = false;

        for (const client of this.globalClients) {
          const state = this.playerStates.get(client.playerId);
          if (state) {
            worldState[client.playerId] = state;
            hasState = true;
          }
        }

        if (hasState) {
          this.broadcastToWorld({
            event: 'STATE_UPDATE',
            payload: { players: worldState },
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 2. Broadcast any legacy session rooms
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
