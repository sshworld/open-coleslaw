import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getDashboardHTML } from './html.js';
import { StateBridge } from './state-bridge.js';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export function startDashboard(): { close: () => void } {
  const config = getConfig();
  const port = config.DASHBOARD_PORT; // 35143

  const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHTML());
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const wss = new WebSocketServer({ server: httpServer });
  const bridge = new StateBridge(wss);

  wss.on('connection', (ws: WebSocket) => {
    // Send full snapshot on connect
    const snapshot = bridge.getSnapshot();
    ws.send(JSON.stringify(snapshot));

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  httpServer.listen(port, '127.0.0.1', () => {
    logger.info(`Dashboard running at http://localhost:${port}`);
  });

  // Handle port-in-use gracefully
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Dashboard port ${port} in use, trying ${port + 1}`);
      httpServer.listen(port + 1, '127.0.0.1');
    } else {
      logger.error(`Dashboard server error: ${err.message}`);
    }
  });

  return {
    close: () => {
      wss.close();
      httpServer.close();
    },
  };
}
