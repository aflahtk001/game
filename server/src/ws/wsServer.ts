import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { handleWSMessage, handleWSDisconnect } from './wsRouter.js';
import { gameStateManager } from '../gamestate/gameStateManager.js';

export class GameWebSocketServer {
  private wss: WebSocketServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.init();
  }

  private init() {
    this.wss.on('connection', (socket: WebSocket, req) => {
      const ip = req.socket.remoteAddress;
      console.log(`[WebSocket] New incoming connection from ${ip}`);

      gameStateManager.registerSocket(socket);

      socket.on('message', async (data) => {
        try {
          await handleWSMessage(socket, data.toString());
        } catch (error) {
          console.error('[WebSocket] Message handling error:', error);
        }
      });

      socket.on('close', async (code, reason) => {
        console.log(`[WebSocket] Connection closed (code: ${code}, reason: ${reason})`);
        try {
          await handleWSDisconnect(socket);
        } catch (error) {
          console.error('[WebSocket] Disconnect handling error:', error);
        }
      });

      socket.on('error', (err) => {
        console.error('[WebSocket] Socket error:', err);
      });
    });

    // Setup 30s heartbeat interval to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.ping();
        }
      });
    }, 30000);
  }

  public close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public getWss(): WebSocketServer {
    return this.wss;
  }
}
