import { createServer as createHttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getDashboardHTML } from './html.js';
import { StateBridge } from './state-bridge.js';
import { DashboardClient } from './client.js';
import { eventBus } from '../orchestrator/event-bus.js';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { AgentEvent, ServerMessage } from '../types/dashboard-events.js';

export interface DashboardHandle {
  isOwner: boolean;
  close: () => void;
}

export interface DashboardOptions {
  sessionId: string;
  projectPath: string;
  projectName: string;
}

export function startDashboard(options: DashboardOptions): Promise<DashboardHandle> {
  const port = getConfig().DASHBOARD_PORT;

  return new Promise((resolve) => {
    const httpServer = createHttpServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getDashboardHTML());
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use — become a client
        logger.info(`Dashboard port ${port} in use — connecting as client`);
        const client = new DashboardClient(options.sessionId, options.projectName, options.projectPath);
        client.connect(port);
        resolve({
          isOwner: false,
          close: () => client.disconnect(),
        });
      } else {
        logger.error(`Dashboard error: ${err.message}`);
        resolve({ isOwner: false, close: () => {} });
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      logger.info(`Dashboard owner — running at http://localhost:${port}`);

      const wss = new WebSocketServer({ server: httpServer });
      const bridge = new StateBridge();

      // Register own session
      const displayName = bridge.registerSession({
        sessionId: options.sessionId,
        projectPath: options.projectPath,
        projectName: options.projectName,
      });
      logger.info(`Registered own session: ${displayName}`);

      // Forward local events to bridge
      eventBus.on('agent_event', (event: AgentEvent) => {
        bridge.handleSessionEvent(options.sessionId, event);
      });

      // Handle browser clients + MCP server clients
      wss.on('connection', (ws: WebSocket) => {
        // Send full snapshot
        ws.send(JSON.stringify(bridge.getSnapshot()));

        ws.on('message', (data: Buffer) => {
          try {
            const msg: ServerMessage = JSON.parse(data.toString());

            if (msg.type === 'register') {
              const name = bridge.registerSession({
                sessionId: msg.sessionId,
                projectPath: msg.projectPath,
                projectName: msg.projectName,
              });
              // Notify all browser clients
              const notification = JSON.stringify({
                type: 'session-registered',
                sessionId: msg.sessionId,
                displayName: name,
                projectPath: msg.projectPath,
              });
              wss.clients.forEach((c) => {
                if (c !== ws && c.readyState === WebSocket.OPEN) c.send(notification);
              });
            } else if (msg.type === 'session-event') {
              bridge.handleSessionEvent(msg.sessionId, msg.event);
            } else if (msg.type === 'unregister') {
              bridge.unregisterSession(msg.sessionId);
              const notification = JSON.stringify({
                type: 'session-unregistered',
                sessionId: msg.sessionId,
              });
              wss.clients.forEach((c) => {
                if (c.readyState === WebSocket.OPEN) c.send(notification);
              });
            } else if ((msg as any).type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
          } catch {
            // ignore malformed
          }
        });
      });

      // Broadcast deltas to all browser clients
      bridge.on('broadcast', (data: string) => {
        wss.clients.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) c.send(data);
        });
      });

      resolve({
        isOwner: true,
        close: () => {
          bridge.unregisterSession(options.sessionId);
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}
