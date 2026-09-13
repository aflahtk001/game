import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export interface AuthIdentity {
  playerId: string;
  displayName: string;
  isNew: boolean;
}

export class AuthService {
  /**
   * Identifies or creates a player identity from client payload.
   * If a valid UUID is provided, use it; otherwise generate a new unique player ID.
   */
  public identifyPlayer(providedPlayerId?: string | null, providedDisplayName?: string | null): AuthIdentity {
    let playerId: string;
    let isNew = false;

    if (providedPlayerId && validateUuid(providedPlayerId)) {
      playerId = providedPlayerId;
    } else {
      playerId = uuidv4();
      isNew = true;
    }

    const displayName = (providedDisplayName && providedDisplayName.trim().length > 0)
      ? providedDisplayName.trim().substring(0, 32)
      : `Player_${playerId.substring(0, 6)}`;

    return {
      playerId,
      displayName,
      isNew,
    };
  }
}

export const authService = new AuthService();
