import { db, ConnectionStatus } from '../db/dbAdapter.js';
import { PlayerDTO, toPlayerDTO } from './playerModel.js';

export class PlayerService {
  /**
   * Fetch or create a player by ID and ensure their profile is initialized.
   */
  async getOrCreatePlayer(id: string, displayName: string): Promise<PlayerDTO> {
    const existing = await db.getPlayer(id);
    let player;
    if (existing) {
      // Update display name if changed and connection status to online
      player = await db.upsertPlayer({
        id,
        display_name: displayName || existing.display_name,
        connection_status: 'online',
        last_seen_at: new Date().toISOString(),
      });
    } else {
      player = await db.upsertPlayer({
        id,
        display_name: displayName,
        connection_status: 'online',
      });
      // Initialize profile
      await db.upsertPlayerProfile({
        player_id: id,
        avatar_url: null,
        settings: {},
      });
    }

    const profile = await db.getPlayerProfile(id);
    return toPlayerDTO(player, profile);
  }

  /**
   * Get player by ID
   */
  async getPlayer(id: string): Promise<PlayerDTO | null> {
    const player = await db.getPlayer(id);
    if (!player) return null;
    const profile = await db.getPlayerProfile(id);
    return toPlayerDTO(player, profile);
  }

  /**
   * Update player connection status ('online', 'offline', 'in_session')
   */
  async updateConnectionStatus(id: string, status: ConnectionStatus): Promise<PlayerDTO | null> {
    const updated = await db.updatePlayer(id, {
      connection_status: status,
      last_seen_at: new Date().toISOString(),
    });
    if (!updated) return null;
    const profile = await db.getPlayerProfile(id);
    return toPlayerDTO(updated, profile);
  }

  /**
   * Update last seen timestamp (heartbeat)
   */
  async touchPlayer(id: string): Promise<void> {
    await db.updatePlayer(id, {
      last_seen_at: new Date().toISOString(),
    });
  }

  /**
   * Bind player to a session (or null when leaving)
   */
  async setPlayerSession(id: string, sessionId: string | null): Promise<PlayerDTO | null> {
    const status: ConnectionStatus = sessionId ? 'in_session' : 'online';
    const updated = await db.updatePlayer(id, {
      session_id: sessionId,
      connection_status: status,
      last_seen_at: new Date().toISOString(),
    });
    if (!updated) return null;
    const profile = await db.getPlayerProfile(id);
    return toPlayerDTO(updated, profile);
  }
}

export const playerService = new PlayerService();
