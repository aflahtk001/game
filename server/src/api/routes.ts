import { Router } from 'express';
import { sessionController } from './sessionController.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => sessionController.healthCheck(req, res));

// Game Session Endpoints
apiRouter.post('/sessions', (req, res) => sessionController.createSession(req, res));
apiRouter.get('/sessions', (req, res) => sessionController.listSessions(req, res));
apiRouter.get('/sessions/:id', (req, res) => sessionController.getSessionStatus(req, res));
apiRouter.post('/sessions/:id/join', (req, res) => sessionController.joinSession(req, res));
apiRouter.post('/sessions/:id/leave', (req, res) => sessionController.leaveSession(req, res));
