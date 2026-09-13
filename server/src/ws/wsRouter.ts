import { WebSocket } from 'ws';
import { authService } from '../auth/authService.js';
import { playerService } from '../players/playerService.js';
import { sessionService } from '../sessions/sessionService.js';
import { gameStateManager, ConnectedClient } from '../gamestate/gameStateManager.js';
import {
  WSClientMessage,
  WSServerMessage,
  WSServerEvent,
  IdentifyPayload,
  CreateSessionPayload,
  JoinSessionPayload,
  LeaveSessionPayload,
  GetSessionStatusPayload,
  PingPayload,
  UpdateStatePayload,
  SendChatMessagePayload,
  ChatMessagePayload,
  ChatHistoryPayload,
  WebRTCSignalPayload
} from './wsTypes.js';
import { insertChatMessage, getChatHistory } from '../db/chatOperations.js';

export function sendWSMessage<T>(
  socket: WebSocket,
  event: WSServerEvent,
  payload: T,
  requestId?: string
): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  const response: WSServerMessage<T> = {
    event,
    requestId,
    payload,
    timestamp: new Date().toISOString(),
  };

  socket.send(JSON.stringify(response));
}

export function sendWSError(
  socket: WebSocket,
  code: string,
  message: string,
  requestId?: string
): void {
  sendWSMessage(socket, 'ERROR', { code, message }, requestId);
}

export async function handleWSMessage(socket: WebSocket, rawData: string): Promise<void> {
  let message: WSClientMessage;
  try {
    message = JSON.parse(rawData);
  } catch {
    sendWSError(socket, 'INVALID_JSON', 'Malformed JSON payload');
    return;
  }

  const { action, payload, requestId } = message;

  switch (action) {
    case 'IDENTIFY': {
      const p = (payload || {}) as IdentifyPayload;
      const identity = authService.identifyPlayer(p.playerId, p.displayName);
      const player = await playerService.getOrCreatePlayer(identity.playerId, identity.displayName);
      
      const client = gameStateManager.registerClient(socket, player.id, player.displayName);

      // If the player already had an active session in DB, restore it in GameStateManager
      if (player.sessionId) {
        const session = await sessionService.getSessionStatus(player.sessionId);
        if (session && session.sessionStatus !== 'closed' && session.sessionStatus !== 'finished') {
          gameStateManager.joinSessionRoom(player.sessionId, client);
        } else {
          // Clear dead session reference
          await playerService.setPlayerSession(player.id, null);
          player.sessionId = null;
          player.connectionStatus = 'online';
        }
      }

      sendWSMessage(socket, 'IDENTIFIED', { player }, requestId);
      break;
    }

    case 'CREATE_SESSION': {
      const client = gameStateManager.getClientBySocket(socket);
      if (!client) {
        sendWSError(socket, 'UNAUTHORIZED', 'Must IDENTIFY before creating a session', requestId);
        return;
      }

      const p = (payload || {}) as CreateSessionPayload;
      const session = await sessionService.createSession({
        hostPlayerId: client.playerId,
        maxCapacity: p.maxCapacity || 8,
      });

      gameStateManager.joinSessionRoom(session.id, client);

      sendWSMessage(socket, 'SESSION_CREATED', { session }, requestId);
      break;
    }

    case 'JOIN_SESSION': {
      const client = gameStateManager.getClientBySocket(socket);
      if (!client) {
        sendWSError(socket, 'UNAUTHORIZED', 'Must IDENTIFY before joining a session', requestId);
        return;
      }

      const p = payload as JoinSessionPayload;
      if (!p || !p.sessionId) {
        sendWSError(socket, 'BAD_REQUEST', 'Missing sessionId', requestId);
        return;
      }

      const result = await sessionService.joinSession(p.sessionId, client.playerId, p.role || 'player');
      if (!result.success || !result.session) {
        sendWSError(socket, 'JOIN_FAILED', result.message || 'Could not join session', requestId);
        return;
      }
      const session = result.session;

      gameStateManager.joinSessionRoom(p.sessionId, client);

      // Respond to joining client
      sendWSMessage(socket, 'SESSION_JOINED', { session }, requestId);

      // Fetch and send chat history asynchronously
      getChatHistory(session.id, 50).then(history => {
        const historyPayload: ChatHistoryPayload = {
          messages: history.map(msg => ({
            id: msg.id,
            sessionId: msg.session_id,
            playerId: msg.player_id,
            displayName: msg.display_name,
            content: msg.content,
            createdAt: msg.created_at
          }))
        };
        sendWSMessage(socket, 'CHAT_HISTORY', historyPayload);
      });

      // Broadcast to other members in the session room
      gameStateManager.broadcastToSession(
        p.sessionId,
        {
          event: 'PLAYER_JOINED',
          payload: {
            sessionId: p.sessionId,
            player: {
              id: client.playerId,
              displayName: client.displayName,
              role: p.role || 'player',
            },
          },
          timestamp: new Date().toISOString(),
        },
        client.playerId
      );
      break;
    }

    case 'LEAVE_SESSION': {
      const client = gameStateManager.getClientBySocket(socket);
      if (!client) {
        sendWSError(socket, 'UNAUTHORIZED', 'Must IDENTIFY first', requestId);
        return;
      }

      const p = (payload || {}) as LeaveSessionPayload;
      const sessionId = p.sessionId || client.sessionId;

      if (!sessionId) {
        sendWSError(socket, 'BAD_REQUEST', 'No active session to leave', requestId);
        return;
      }

      const result = await sessionService.leaveSession(sessionId, client.playerId);
      gameStateManager.leaveSessionRoom(sessionId, client);

      sendWSMessage(socket, 'SESSION_LEFT', { sessionId }, requestId);

      // Notify remaining players in the session room
      gameStateManager.broadcastToSession(
        sessionId,
        {
          event: 'PLAYER_LEFT',
          payload: {
            sessionId,
            playerId: client.playerId,
            newHostId: result.session?.hostPlayerId || null,
          },
          timestamp: new Date().toISOString(),
        }
      );
      break;
    }

    case 'GET_SESSION_STATUS': {
      const p = payload as GetSessionStatusPayload;
      if (!p || !p.sessionId) {
        sendWSError(socket, 'BAD_REQUEST', 'Missing sessionId', requestId);
        return;
      }

      const session = await sessionService.getSessionStatus(p.sessionId);
      if (!session) {
        sendWSError(socket, 'NOT_FOUND', `Session ${p.sessionId} not found`, requestId);
        return;
      }

      sendWSMessage(socket, 'SESSION_STATUS', { session }, requestId);
      break;
    }

    case 'PING': {
      const p = (payload || {}) as PingPayload;
      const client = gameStateManager.getClientBySocket(socket);
      if (client) {
        client.lastPingAt = new Date();
        playerService.touchPlayer(client.playerId).catch(() => {});
      }
      sendWSMessage(socket, 'PONG', { timestamp: p.timestamp || Date.now() }, requestId);
      break;
    }

    case 'UPDATE_STATE': {
      const client = gameStateManager.getClientBySocket(socket);
      if (client && client.sessionId) {
        const p = payload as UpdateStatePayload;
        if (p && p.state) {
          gameStateManager.updatePlayerState(client.playerId, p.state);
        }
      }
      break;
    }

    case 'SEND_CHAT_MESSAGE': {
      const client = gameStateManager.getClientBySocket(socket);
      if (!client || !client.sessionId) {
        return sendWSError(socket, 'NOT_IN_SESSION', 'You must be in a session to chat', requestId);
      }

      // Rate limit (1 message per 500ms)
      const now = Date.now();
      if (client.lastChatAt && now - client.lastChatAt < 500) {
        return sendWSError(socket, 'RATE_LIMIT', 'You are sending messages too fast', requestId);
      }
      client.lastChatAt = now;

      const p = payload as SendChatMessagePayload;
      if (!p || typeof p.content !== 'string' || p.content.trim() === '') {
        return; // silently ignore empty
      }

      // Sanitize and limit length
      let content = p.content.trim().substring(0, 255);
      content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // Insert into DB asynchronously but don't block
      insertChatMessage(client.sessionId, client.playerId, client.displayName, content)
        .then(msg => {
          const chatPayload: ChatMessagePayload = {
            id: msg.id,
            sessionId: msg.session_id,
            playerId: msg.player_id,
            displayName: msg.display_name,
            content: msg.content,
            createdAt: msg.created_at
          };
          
          gameStateManager.broadcastToSession(client.sessionId!, {
            event: 'CHAT_MESSAGE',
            payload: chatPayload,
            timestamp: new Date().toISOString()
          });
        })
        .catch(err => {
          console.error('[wsRouter] Failed to process chat message:', err);
        });
      break;
    }

    case 'WEBRTC_SIGNAL': {
      const client = gameStateManager.getClientBySocket(socket);
      if (!client || !client.sessionId) return;
      
      const p = payload as WebRTCSignalPayload;
      if (!p.targetId || !p.signal) return;

      const targetClient = gameStateManager.getClientByPlayerId(p.targetId);
      // Ensure target client exists and is in the same session
      if (targetClient && targetClient.sessionId === client.sessionId && targetClient.socket) {
        sendWSMessage(targetClient.socket, 'WEBRTC_SIGNAL', {
          senderId: client.playerId,
          targetId: p.targetId,
          signal: p.signal
        });
      }
      break;
    }

    default:
      sendWSError(socket, 'UNKNOWN_ACTION', `Action '${action}' is not supported`, requestId);
      break;
  }
}

/**
 * Clean up state when socket disconnects
 */
export async function handleWSDisconnect(socket: WebSocket): Promise<void> {
  const client = gameStateManager.unregisterClient(socket);
  if (!client) return;

  console.log(`[WebSocket] Client disconnected: ${client.displayName} (${client.playerId})`);

  // Update DB connection status to offline
  await playerService.updateConnectionStatus(client.playerId, 'offline');

  // If player was in a session, notify peers
  if (client.sessionId) {
    const result = await sessionService.leaveSession(client.sessionId, client.playerId);
    gameStateManager.broadcastToSession(
      client.sessionId,
      {
        event: 'PLAYER_LEFT',
        payload: {
          sessionId: client.sessionId,
          playerId: client.playerId,
          newHostId: result.session?.hostPlayerId || null,
        },
        timestamp: new Date().toISOString(),
      }
    );
  }
}
