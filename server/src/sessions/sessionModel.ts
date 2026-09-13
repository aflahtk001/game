import { DbGameSession, DbSessionMembership, MemberRole, SessionStatus } from '../db/dbAdapter.js';

export interface SessionMemberDTO {
  id: string;
  sessionId: string;
  playerId: string;
  displayName?: string;
  role: MemberRole;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
}

export interface GameSessionDTO {
  id: string;
  sessionStatus: SessionStatus;
  maxCapacity: number;
  hostPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
  activePlayerCount: number;
  members?: SessionMemberDTO[];
}

export function toSessionMemberDTO(membership: DbSessionMembership, displayName?: string): SessionMemberDTO {
  return {
    id: membership.id,
    sessionId: membership.session_id,
    playerId: membership.player_id,
    displayName,
    role: membership.role,
    isActive: membership.is_active,
    joinedAt: membership.joined_at,
    leftAt: membership.left_at,
  };
}

export function toGameSessionDTO(
  session: DbGameSession,
  members: DbSessionMembership[] = [],
  playerDisplayNames: Map<string, string> = new Map()
): GameSessionDTO {
  const activeMembers = members.filter(m => m.is_active);
  return {
    id: session.id,
    sessionStatus: session.session_status,
    maxCapacity: session.max_capacity,
    hostPlayerId: session.host_player_id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    activePlayerCount: activeMembers.length,
    members: members.map(m => toSessionMemberDTO(m, playerDisplayNames.get(m.player_id))),
  };
}
