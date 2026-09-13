import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { apiRouter } from './api/routes.js';
import { sessionController } from './api/sessionController.js';
import { GameWebSocketServer } from './ws/wsServer.js';
import { getSupabaseClient } from './db/supabaseClient.js';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);
  app.get('/health', (req, res) => sessionController.healthCheck(req, res));

  // Root endpoint info
  app.get('/', (_req, res) => {
    res.json({
      name: 'GTA Multiplayer Game Backend',
      version: '1.0.0',
      status: 'running',
      supabase: config.supabase.isConfigured ? 'connected' : 'memory_fallback',
      websocket: `ws://localhost:${config.port}`,
    });
  });

  // Create HTTP and WebSocket server
  const server = http.createServer(app);
  const gameWsServer = new GameWebSocketServer(server);

  // Initialize DB connection check
  getSupabaseClient();
  
  // Start the server game loop
  import('./gamestate/gameStateManager.js').then((m) => {
    m.gameStateManager.startTickLoop(gameWsServer.getWss());
  });

  server.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(` GTA Multiplayer Game Backend Server`);
    console.log(` HTTP Server running on: http://localhost:${config.port}`);
    console.log(` WebSocket Server on:    ws://localhost:${config.port}`);
    console.log(` Environment:            ${config.nodeEnv}`);
    console.log(` Supabase Mode:          ${config.supabase.isConfigured ? 'Live PostgreSQL' : 'In-Memory Fallback'}`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    try {
      await gameWsServer.close();
      server.close(() => {
        console.log('[Server] HTTP and WebSocket servers closed successfully.');
        process.exit(0);
      });
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal bootstrap error:', err);
  process.exit(1);
});
