import { Request, Response } from 'express';
import { sessionService } from '../sessions/sessionService.js';
import { playerService } from '../players/playerService.js';
import { authService } from '../auth/authService.js';
import { gameStateManager } from '../gamestate/gameStateManager.js';

export class SessionController {
  /**
   * POST /api/sessions
   * Body: { hostPlayerId?: string, displayName?: string, maxCapacity?: number }
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { hostPlayerId, displayName, maxCapacity } = req.body;

      let validHostId = hostPlayerId;
      if (displayName || hostPlayerId) {
        const identity = authService.identifyPlayer(hostPlayerId, displayName);
        const player = await playerService.getOrCreatePlayer(identity.playerId, identity.displayName);
        validHostId = player.id;
      }

      const session = await sessionService.createSession({
        hostPlayerId: validHostId,
        maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : 8,
      });

      res.status(201).json({
        success: true,
        session,
      });
    } catch (error) {
      console.error('[SessionController] createSession error:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  /**
   * GET /api/sessions
   * Query: { status?: string }
   */
  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const statusFilter = status ? [status as any] : undefined;
      const sessions = await sessionService.listSessions(statusFilter);

      res.status(200).json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error('[SessionController] listSessions error:', error);
      res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
  }

  /**
   * GET /api/sessions/:id
   */
  async getSessionStatus(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      const session = await sessionService.getSessionStatus(sessionId);

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      res.status(200).json({
        success: true,
        session,
      });
    } catch (error) {
      console.error('[SessionController] getSessionStatus error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch session' });
    }
  }

  /**
   * POST /api/sessions/:id/join
   * Body: { playerId: string, displayName?: string, role?: 'player' | 'spectator' }
   */
  async joinSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      const { playerId, displayName, role } = req.body;

      if (!playerId) {
        res.status(400).json({ success: false, error: 'Missing playerId in request body' });
        return;
      }

      // Ensure player exists
      const identity = authService.identifyPlayer(playerId, displayName);
      const player = await playerService.getOrCreatePlayer(identity.playerId, identity.displayName);

      const result = await sessionService.joinSession(sessionId, player.id, role || 'player');

      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }

      res.status(200).json({
        success: true,
        session: result.session,
      });
    } catch (error) {
      console.error('[SessionController] joinSession error:', error);
      res.status(500).json({ success: false, error: 'Failed to join session' });
    }
  }

  /**
   * POST /api/sessions/:id/leave
   * Body: { playerId: string }
   */
  async leaveSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      const { playerId } = req.body;

      if (!playerId) {
        res.status(400).json({ success: false, error: 'Missing playerId in request body' });
        return;
      }

      const result = await sessionService.leaveSession(sessionId, playerId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }

      res.status(200).json({
        success: true,
        session: result.session,
      });
    } catch (error) {
      console.error('[SessionController] leaveSession error:', error);
      res.status(500).json({ success: false, error: 'Failed to leave session' });
    }
  }

  /**
   * GET /health
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      connectedPlayers: gameStateManager.getConnectedCount(),
      timestamp: new Date().toISOString(),
    });
  }
}

export const sessionController = new SessionController();
