import { db, MemberRole, SessionStatus } from '../db/dbAdapter.js';
import { playerService } from '../players/playerService.js';
import { GameSessionDTO, toGameSessionDTO } from './sessionModel.js';

export interface CreateSessionOptions {
  hostPlayerId?: string | null;
  maxCapacity?: number;
}

export interface JoinSessionResult {
  success: boolean;
  message?: string;
  session?: GameSessionDTO;
}

export interface LeaveSessionResult {
  success: boolean;
  message?: string;
  session?: GameSessionDTO | null;
}

export class SessionService {
  /**
   * Create a new game session and optionally register the host.
   */
  async createSession(options: CreateSessionOptions = {}): Promise<GameSessionDTO> {
    const maxCapacity = Math.min(Math.max(options.maxCapacity || 8, 2), 64);
    const hostPlayerId = options.hostPlayerId || null;

    const dbSession = await db.createSession({
      host_player_id: hostPlayerId,
      max_capacity: maxCapacity,
      session_status: 'waiting',
    });

    const displayNames = new Map<string, string>();

    // If host player is provided, automatically add them as host member and update player session
    if (hostPlayerId) {
      await db.addSessionMember({
        session_id: dbSession.id,
        player_id: hostPlayerId,
        role: 'host',
      });
      await playerService.setPlayerSession(hostPlayerId, dbSession.id);
      
      const hostPlayer = await playerService.getPlayer(hostPlayerId);
      if (hostPlayer) {
        displayNames.set(hostPlayerId, hostPlayer.displayName);
      }
    }

    const members = await db.getSessionMembers(dbSession.id, true);
    return toGameSessionDTO(dbSession, members, displayNames);
  }

  /**
   * Check status of a game session.
   */
  async getSessionStatus(sessionId: string): Promise<GameSessionDTO | null> {
    const dbSession = await db.getSession(sessionId);
    if (!dbSession) return null;

    const members = await db.getSessionMembers(sessionId, true);
    const displayNames = new Map<string, string>();
    for (const member of members) {
      const player = await playerService.getPlayer(member.player_id);
      if (player) {
        displayNames.set(member.player_id, player.displayName);
      }
    }

    return toGameSessionDTO(dbSession, members, displayNames);
  }

  /**
   * List all available game sessions.
   */
  async listSessions(statuses?: SessionStatus[]): Promise<GameSessionDTO[]> {
    const dbSessions = await db.listSessions(statuses);
    const results: GameSessionDTO[] = [];

    for (const dbSession of dbSessions) {
      const members = await db.getSessionMembers(dbSession.id, true);
      results.push(toGameSessionDTO(dbSession, members));
    }

    return results;
  }

  /**
   * Player joins an existing game session.
   */
  async joinSession(sessionId: string, playerId: string, role: MemberRole = 'player'): Promise<JoinSessionResult> {
    const dbSession = await db.getSession(sessionId);
    if (!dbSession) {
      return { success: false, message: `Session ${sessionId} not found` };
    }

    if (dbSession.session_status === 'closed' || dbSession.session_status === 'finished') {
      return { success: false, message: `Session ${sessionId} is ${dbSession.session_status}` };
    }

    const currentMembers = await db.getSessionMembers(sessionId, true);
    const isAlreadyMember = currentMembers.some(m => m.player_id === playerId);

    if (!isAlreadyMember && currentMembers.length >= dbSession.max_capacity) {
      return { success: false, message: `Session ${sessionId} has reached maximum capacity (${dbSession.max_capacity})` };
    }

    // Leave any other active session first
    const existingMembership = await db.getActiveMembershipByPlayer(playerId);
    if (existingMembership && existingMembership.session_id !== sessionId) {
      await this.leaveSession(existingMembership.session_id, playerId);
    }

    // Add membership
    await db.addSessionMember({
      session_id: sessionId,
      player_id: playerId,
      role: isAlreadyMember ? undefined : role,
    });

    // Update player record
    await playerService.setPlayerSession(playerId, sessionId);

    // If session was waiting and reached min players or host started it, we can transition status
    if (dbSession.session_status === 'waiting' && currentMembers.length + 1 >= 1) {
      await db.updateSession(sessionId, { session_status: 'active' });
    }

    const updatedSession = await this.getSessionStatus(sessionId);
    return {
      success: true,
      session: updatedSession || undefined,
    };
  }

  /**
   * Player leaves a game session.
   */
  async leaveSession(sessionId: string, playerId: string): Promise<LeaveSessionResult> {
    const dbSession = await db.getSession(sessionId);
    if (!dbSession) {
      return { success: false, message: `Session ${sessionId} not found` };
    }

    await db.deactivateSessionMember(sessionId, playerId);
    await playerService.setPlayerSession(playerId, null);

    const remainingMembers = await db.getSessionMembers(sessionId, true);

    // If session is now empty, mark it as finished/closed
    if (remainingMembers.length === 0) {
      await db.updateSession(sessionId, { session_status: 'finished' });
    } else if (dbSession.host_player_id === playerId) {
      // Migrate host role to the next active player
      const nextHost = remainingMembers[0];
      await db.updateSession(sessionId, { host_player_id: nextHost.player_id });
    }

    const updatedSession = await this.getSessionStatus(sessionId);
    return {
      success: true,
      session: updatedSession,
    };
  }
}

export const sessionService = new SessionService();
