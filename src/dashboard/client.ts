import WebSocket from 'ws';
import type { AgentEvent, RegisterMessage, SessionEventMessage, UnregisterMessage } from '../types/dashboard-events.js';
import { eventBus } from '../orchestrator/event-bus.js';
import { logger } from '../utils/logger.js';

export class DashboardClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private projectName: string;
  private projectPath: string;

  constructor(sessionId: string, projectName: string, projectPath: string) {
    this.sessionId = sessionId;
    this.projectName = projectName;
    this.projectPath = projectPath;
  }

  connect(port: number): void {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);

    this.ws.on('open', () => {
      logger.info(`Connected to dashboard as client (session: ${this.sessionId})`);
      // Register this session
      const msg: RegisterMessage = {
        type: 'register',
        sessionId: this.sessionId,
        projectPath: this.projectPath,
        projectName: this.projectName,
      };
      this.ws!.send(JSON.stringify(msg));

      // Forward local events to the dashboard server
      eventBus.on('agent_event', (event: AgentEvent) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const sessionMsg: SessionEventMessage = {
            type: 'session-event',
            sessionId: this.sessionId,
            event,
          };
          this.ws.send(JSON.stringify(sessionMsg));
        }
      });
    });

    this.ws.on('error', (err) => {
      logger.warn(`Dashboard client error: ${err.message}`);
    });

    this.ws.on('close', () => {
      logger.info('Dashboard client disconnected');
    });
  }

  disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: UnregisterMessage = {
        type: 'unregister',
        sessionId: this.sessionId,
      };
      this.ws.send(JSON.stringify(msg));
      this.ws.close();
    }
    this.ws = null;
  }
}
