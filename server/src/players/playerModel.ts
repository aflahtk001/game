import { ConnectionStatus, DbPlayer, DbPlayerProfile } from '../db/dbAdapter.js';

export interface PlayerDTO {
  id: string;
  displayName: string;
  sessionId: string | null;
  connectionStatus: ConnectionStatus;
  createdAt: string;
  lastSeenAt: string;
  profile?: {
    avatarUrl: string | null;
    settings: Record<string, unknown>;
  };
}

export function toPlayerDTO(dbPlayer: DbPlayer, profile?: DbPlayerProfile | null): PlayerDTO {
  return {
    id: dbPlayer.id,
    displayName: dbPlayer.display_name,
    sessionId: dbPlayer.session_id,
    connectionStatus: dbPlayer.connection_status,
    createdAt: dbPlayer.created_at,
    lastSeenAt: dbPlayer.last_seen_at,
    profile: profile ? {
      avatarUrl: profile.avatar_url,
      settings: profile.settings,
    } : undefined,
  };
}
