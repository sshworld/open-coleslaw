/**
 * getDashboardHTML() — returns the full inline HTML/CSS/JS for the Open Coleslaw
 * real-time dashboard.  Everything is self-contained; the only external deps are
 * Cytoscape.js + dagre loaded from CDN.
 */

export function getDashboardHTML(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Coleslaw Dashboard</title>

<!-- CDN deps -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.4/cytoscape.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>

<!-- Google Fonts: JetBrains Mono -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

<style>
/* ===================================================================
   RESET & VARIABLES
   =================================================================== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #0a0e17;
  --surface:     #111827;
  --border:      #1e293b;
  --cyan:        #00f0ff;
  --purple:      #a855f7;
  --lightcyan:   #22d3ee;
  --success:     #10b981;
  --warning:     #f59e0b;
  --error:       #ef4444;
  --text:        #e2e8f0;
  --text2:       #94a3b8;
  --font:        'JetBrains Mono', 'Fira Code', monospace;
}

html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.5;
}

/* ===================================================================
   LAYOUT — four areas via CSS Grid
   =================================================================== */
#app {
  display: grid;
  width: 100%; height: 100%;
  grid-template-rows: 48px 1fr 200px;
  grid-template-columns: 1fr 320px;
  grid-template-areas:
    "header  header"
    "graph   sidebar"
    "log     log";
}

/* ===================================================================
   HEADER
   =================================================================== */
#header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  z-index: 10;
}

#header .brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(0,240,255,0.5);
  white-space: nowrap;
}

#header .center-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.conn-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--error);
  transition: background 0.3s;
  box-shadow: 0 0 6px rgba(239,68,68,0.6);
}
.conn-dot.connected {
  background: var(--success);
  box-shadow: 0 0 6px rgba(16,185,129,0.6);
}
.conn-dot.reconnecting {
  background: var(--warning);
  box-shadow: 0 0 6px rgba(245,158,11,0.6);
  animation: breathe 1.5s ease-in-out infinite;
}

#header .right-stats {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
}

.badge {
  background: rgba(0,240,255,0.1);
  border: 1px solid rgba(0,240,255,0.25);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  white-space: nowrap;
}
.badge.purple { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); }
.badge.amber  { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: var(--warning); }
.badge.green  { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: var(--success); }

/* ===================================================================
   GRAPH VIEWPORT
   =================================================================== */
#graph-container {
  grid-area: graph;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}
#cy {
  width: 100%; height: 100%;
}
/* watermark text */
#graph-container::after {
  content: 'AGENT GRAPH';
  position: absolute;
  bottom: 12px; left: 16px;
  font-size: 10px;
  color: rgba(148,163,184,0.25);
  letter-spacing: 3px;
  pointer-events: none;
}

/* ===================================================================
   SIDEBAR
   =================================================================== */
#sidebar {
  grid-area: sidebar;
  background: var(--surface);
  border-left: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#sidebar h2 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text2);
  margin-bottom: 4px;
}

.sidebar-empty {
  color: var(--text2);
  font-style: italic;
  font-size: 12px;
  margin-top: 40px;
  text-align: center;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.detail-row .label { color: var(--text2); }
.detail-row .value { color: var(--text); font-weight: 500; }

.status-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.status-chip.idle        { background: rgba(148,163,184,0.15); color: var(--text2); }
.status-chip.working     { background: rgba(0,240,255,0.15); color: var(--cyan); }
.status-chip.in-meeting  { background: rgba(245,158,11,0.15); color: var(--warning); }
.status-chip.spawning-workers { background: rgba(168,85,247,0.15); color: var(--purple); }
.status-chip.aggregating { background: rgba(34,211,238,0.15); color: var(--lightcyan); }
.status-chip.waiting-for-user { background: rgba(245,158,11,0.15); color: var(--warning); }
.status-chip.completed   { background: rgba(16,185,129,0.15); color: var(--success); }
.status-chip.failed      { background: rgba(239,68,68,0.15); color: var(--error); }

.task-block {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  color: var(--text2);
  line-height: 1.6;
  max-height: 160px;
  overflow-y: auto;
}

/* Children list */
.children-list {
  list-style: none;
  padding: 0;
  font-size: 12px;
}
.children-list li {
  padding: 3px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.children-list li::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--lightcyan);
}

/* Task history */
#task-history {
  max-height: 250px;
  overflow-y: auto;
}
.history-item {
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(30,41,59,0.5);
  color: var(--text2);
}

/* ===================================================================
   EVENT LOG
   =================================================================== */
#event-log {
  grid-area: log;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#event-log .log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#event-log .log-header .pause-indicator {
  color: var(--warning);
  font-weight: 600;
  display: none;
}
#event-log .log-header .pause-indicator.visible {
  display: inline;
}

#log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  font-size: 12px;
  scroll-behavior: smooth;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 3px 16px;
  border-bottom: 1px solid rgba(30,41,59,0.3);
  align-items: baseline;
}
.log-entry:hover { background: rgba(255,255,255,0.02); }

.log-time {
  color: var(--text2);
  font-size: 11px;
  flex-shrink: 0;
  min-width: 64px;
}
.log-kind {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 100px;
  font-size: 11px;
}
.log-msg {
  color: var(--text);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Kind colours */
.log-kind.spawn    { color: var(--cyan); }
.log-kind.destroy  { color: var(--error); }
.log-kind.state    { color: var(--purple); }
.log-kind.task     { color: var(--lightcyan); }
.log-kind.done     { color: var(--success); }
.log-kind.msg      { color: var(--text); }
.log-kind.mention  { color: var(--error); }
.log-kind.resolved { color: var(--success); }
.log-kind.cost     { color: var(--warning); }

/* ===================================================================
   ANIMATIONS
   =================================================================== */
@keyframes breathe {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(0,240,255,0.3); }
  50%      { box-shadow: 0 0 18px rgba(0,240,255,0.7); }
}
@keyframes amber-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1.0; }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }
</style>
</head>
<body>

<div id="app">
  <!-- HEADER ------------------------------------------------------------ -->
  <header id="header">
    <div class="brand">
      <span style="font-size:22px">&#x1F96C;</span>
      <span>Open Coleslaw</span>
    </div>
    <div class="center-status">
      <span class="conn-dot" id="conn-dot"></span>
      <span id="conn-label">Connecting...</span>
    </div>
    <div class="right-stats">
      <span class="badge" id="badge-agents">0 agents</span>
      <span class="badge purple" id="badge-meeting">No meeting</span>
      <span class="badge green" id="badge-cost">$0.0000</span>
    </div>
  </header>

  <!-- GRAPH ------------------------------------------------------------- -->
  <div id="graph-container">
    <div id="cy"></div>
  </div>

  <!-- SIDEBAR ----------------------------------------------------------- -->
  <aside id="sidebar">
    <h2>Agent Details</h2>
    <div class="sidebar-empty" id="sidebar-empty">Click a node to inspect</div>
    <div id="sidebar-content" style="display:none;"></div>
  </aside>

  <!-- EVENT LOG --------------------------------------------------------- -->
  <div id="event-log">
    <div class="log-header">
      <span>Event Log</span>
      <span class="pause-indicator" id="log-pause">PAUSED (scroll up)</span>
    </div>
    <div id="log-entries"></div>
  </div>
</div>

<script>
// ======================================================================
// IIFE — all dashboard JS
// ======================================================================
(function () {
  'use strict';

  // ====================================================================
  // 1. STATE STORE
  // ====================================================================
  const StateStore = {
    agents: new Map(),    // id -> AgentState
    edges: [],            // EdgeState[]
    meeting: null,        // MeetingState | null
    totalCost: 0,
    selectedAgentId: null,
    eventHistory: [],     // {kind, agentId, ...}[]

    applySnapshot(data) {
      this.agents.clear();
      (data.agents || []).forEach(a => this.agents.set(a.id, a));
      this.edges = data.edges || [];
      this.meeting = data.meeting || null;
      StatusBar.update();
    },

    applyDelta(data) {
      (data.events || []).forEach(ev => this.applyEvent(ev));
      StatusBar.update();
    },

    applyEvent(ev) {
      this.eventHistory.push(ev);
      EventLog.append(ev);

      switch (ev.kind) {
        case 'agent_spawned': {
          const agent = {
            id: ev.agentId,
            type: ev.agentType,
            label: ev.label,
            status: 'idle',
            parentId: ev.parentId,
            department: ev.department,
            currentTask: null,
            costUsd: 0,
          };
          this.agents.set(ev.agentId, agent);

          GraphRenderer.addNode(agent);

          if (ev.parentId) {
            const edge = {
              id: 'edge-' + ev.parentId + '-' + ev.agentId,
              source: ev.parentId,
              target: ev.agentId,
              edgeType: 'hierarchy',
              active: true,
              label: '',
            };
            this.edges.push(edge);
            GraphRenderer.addEdge(edge);
          }
          break;
        }
        case 'agent_destroyed': {
          this.agents.delete(ev.agentId);
          this.edges = this.edges.filter(e => e.source !== ev.agentId && e.target !== ev.agentId);
          GraphRenderer.removeNode(ev.agentId);
          if (this.selectedAgentId === ev.agentId) {
            this.selectedAgentId = null;
            SidebarPanel.clear();
          }
          break;
        }
        case 'state_changed': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.status = ev.to; GraphRenderer.updateNode(a); }
          break;
        }
        case 'task_assigned': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.currentTask = ev.taskSummary; a.status = 'working'; GraphRenderer.updateNode(a); }
          break;
        }
        case 'task_completed': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.currentTask = null; a.status = ev.result === 'success' ? 'completed' : 'failed'; GraphRenderer.updateNode(a); }
          break;
        }
        case 'message_sent': {
          const edgeId = 'msg-' + ev.fromId + '-' + ev.toId + '-' + Date.now();
          const edge = { id: edgeId, source: ev.fromId, target: ev.toId, edgeType: 'message', active: true, label: ev.summary };
          this.edges.push(edge);
          GraphRenderer.addEdge(edge);
          setTimeout(() => {
            this.edges = this.edges.filter(e => e.id !== edgeId);
            GraphRenderer.removeEdge(edgeId);
          }, 5000);
          break;
        }
        case 'mention_created': {
          break;
        }
        case 'mention_resolved': {
          break;
        }
        case 'cost_update': {
          this.totalCost = ev.totalCost;
          break;
        }
      }

      // Refresh sidebar if the selected agent was affected
      if (this.selectedAgentId) {
        const agentId = ev.agentId || ev.fromId || ev.toId || null;
        if (agentId === this.selectedAgentId) {
          SidebarPanel.show(this.selectedAgentId);
        }
      }
    },
  };

  // ====================================================================
  // 2. CONNECTION MANAGER — WebSocket with exponential backoff
  // ====================================================================
  const ConnectionManager = {
    ws: null,
    backoff: 1000,
    maxBackoff: 30000,
    timer: null,

    connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = proto + '://' + location.host;
      this.ws = new WebSocket(url);
      this.setStatus('reconnecting');

      this.ws.onopen = () => {
        this.backoff = 1000;
        this.setStatus('connected');
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'snapshot') {
            StateStore.applySnapshot(data);
            GraphRenderer.rebuild();
          } else if (data.type === 'delta') {
            StateStore.applyDelta(data);
          } else if (data.type === 'pong') {
            // heartbeat response
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };

      // Heartbeat every 25s
      this._heartbeat = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    },

    scheduleReconnect() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
        this.connect();
      }, this.backoff);
    },

    setStatus(status) {
      const dot = document.getElementById('conn-dot');
      const label = document.getElementById('conn-label');
      dot.className = 'conn-dot';
      if (status === 'connected') {
        dot.classList.add('connected');
        label.textContent = 'Connected';
      } else if (status === 'reconnecting') {
        dot.classList.add('reconnecting');
        label.textContent = 'Connecting...';
      } else {
        label.textContent = 'Disconnected';
      }
    },
  };

  // ====================================================================
  // 3. GRAPH RENDERER — Cytoscape.js
  // ====================================================================
  const GraphRenderer = {
    cy: null,

    init() {
      this.cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
          // --- NODES ---
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'text-valign': 'bottom',
              'text-halign': 'center',
              'text-margin-y': 8,
              'font-family': "'JetBrains Mono', monospace",
              'font-size': 10,
              'color': '#94a3b8',
              'text-outline-width': 0,
              'background-color': '#1e293b',
              'border-width': 2,
              'border-color': '#334155',
              'width': 40,
              'height': 40,
              'transition-property': 'background-color, border-color, border-width, opacity, width, height',
              'transition-duration': '0.3s',
            },
          },
          // Orchestrator
          {
            selector: 'node[tier="orchestrator"]',
            style: {
              'width': 60,
              'height': 60,
              'border-width': 3,
              'border-color': '#00f0ff',
              'background-color': 'rgba(0,240,255,0.1)',
              'color': '#00f0ff',
              'font-size': 12,
              'font-weight': '700',
              'text-outline-color': '#0a0e17',
              'text-outline-width': 2,
            },
          },
          // Leader
          {
            selector: 'node[tier="leader"]',
            style: {
              'width': 48,
              'height': 48,
              'border-width': 2,
              'border-color': '#a855f7',
              'background-color': 'rgba(168,85,247,0.1)',
              'color': '#a855f7',
              'font-size': 11,
              'font-weight': '600',
            },
          },
          // Worker
          {
            selector: 'node[tier="worker"]',
            style: {
              'width': 36,
              'height': 36,
              'border-width': 2,
              'border-color': '#22d3ee',
              'background-color': 'rgba(34,211,238,0.08)',
              'color': '#22d3ee',
              'font-size': 10,
            },
          },
          // Status: idle
          {
            selector: 'node[status="idle"]',
            style: {
              'opacity': 0.5,
              'border-color': '#475569',
            },
          },
          // Status: working / executing
          {
            selector: 'node[status="working"]',
            style: {
              'border-width': 3,
              'opacity': 1,
            },
          },
          // Status: in-meeting
          {
            selector: 'node[status="in-meeting"]',
            style: {
              'border-color': '#f59e0b',
              'background-color': 'rgba(245,158,11,0.1)',
              'opacity': 1,
            },
          },
          // Status: spawning-workers
          {
            selector: 'node[status="spawning-workers"]',
            style: {
              'border-color': '#a855f7',
              'opacity': 1,
            },
          },
          // Status: waiting-for-user
          {
            selector: 'node[status="waiting-for-user"]',
            style: {
              'border-color': '#f59e0b',
              'opacity': 0.8,
            },
          },
          // Status: aggregating
          {
            selector: 'node[status="aggregating"]',
            style: {
              'border-color': '#22d3ee',
              'opacity': 1,
            },
          },
          // Status: completed
          {
            selector: 'node[status="completed"]',
            style: {
              'border-color': '#10b981',
              'background-color': 'rgba(16,185,129,0.1)',
              'opacity': 0.7,
            },
          },
          // Status: failed
          {
            selector: 'node[status="failed"]',
            style: {
              'border-color': '#ef4444',
              'background-color': 'rgba(239,68,68,0.1)',
              'opacity': 0.8,
            },
          },
          // Selected node
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'overlay-padding': 6,
              'overlay-color': '#00f0ff',
              'overlay-opacity': 0.08,
            },
          },
          // --- EDGES ---
          {
            selector: 'edge',
            style: {
              'width': 1.5,
              'line-color': '#334155',
              'target-arrow-color': '#334155',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'curve-style': 'bezier',
              'opacity': 0.5,
              'transition-property': 'line-color, opacity, width',
              'transition-duration': '0.3s',
            },
          },
          // Active hierarchy edges
          {
            selector: 'edge[edgeType="hierarchy"][?active]',
            style: {
              'line-color': '#475569',
              'target-arrow-color': '#475569',
              'line-style': 'solid',
              'opacity': 0.6,
              'width': 1.5,
            },
          },
          // Delegation edges
          {
            selector: 'edge[edgeType="delegation"]',
            style: {
              'line-color': '#a855f7',
              'target-arrow-color': '#a855f7',
              'line-style': 'dashed',
              'line-dash-pattern': [8, 4],
              'opacity': 0.8,
              'width': 2,
            },
          },
          // Report edges
          {
            selector: 'edge[edgeType="report"]',
            style: {
              'line-color': '#10b981',
              'target-arrow-color': '#10b981',
              'opacity': 0.8,
              'width': 2,
            },
          },
          // Message edges
          {
            selector: 'edge[edgeType="message"]',
            style: {
              'line-color': '#22d3ee',
              'target-arrow-color': '#22d3ee',
              'line-style': 'dashed',
              'line-dash-pattern': [6, 3],
              'opacity': 0.7,
              'width': 1.5,
            },
          },
          // Mention edges
          {
            selector: 'edge[edgeType="mention"]',
            style: {
              'line-color': '#ef4444',
              'target-arrow-color': '#ef4444',
              'line-style': 'dashed',
              'line-dash-pattern': [4, 4],
              'opacity': 0.9,
              'width': 2.5,
            },
          },
        ],
        layout: { name: 'preset' },
        minZoom: 0.3,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });

      // Click handling
      this.cy.on('tap', 'node', function (evt) {
        const id = evt.target.id();
        StateStore.selectedAgentId = id;
        SidebarPanel.show(id);
      });

      this.cy.on('tap', function (evt) {
        if (evt.target === GraphRenderer.cy) {
          StateStore.selectedAgentId = null;
          SidebarPanel.clear();
        }
      });

      // Start animations
      this.startAnimations();
    },

    rebuild() {
      if (!this.cy) return;
      this.cy.elements().remove();

      StateStore.agents.forEach(agent => {
        this.cy.add({
          group: 'nodes',
          data: {
            id: agent.id,
            label: agent.label,
            tier: agent.type,
            status: agent.status,
            department: agent.department,
          },
        });
      });

      StateStore.edges.forEach(edge => {
        // Only add if source and target exist
        if (this.cy.getElementById(edge.source).length && this.cy.getElementById(edge.target).length) {
          this.cy.add({
            group: 'edges',
            data: {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              edgeType: edge.edgeType,
              active: edge.active,
            },
          });
        }
      });

      this.runLayout();
    },

    runLayout() {
      if (!this.cy || this.cy.nodes().length === 0) return;
      this.cy.layout({
        name: 'dagre',
        rankDir: 'TB',
        rankSep: 80,
        nodeSep: 40,
        edgeSep: 20,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-out',
        padding: 40,
      }).run();
    },

    addNode(agent) {
      if (!this.cy) return;
      this.cy.add({
        group: 'nodes',
        data: {
          id: agent.id,
          label: agent.label,
          tier: agent.type,
          status: agent.status,
          department: agent.department,
        },
      });
      // Re-layout after a short delay to batch additions
      clearTimeout(this._layoutTimer);
      this._layoutTimer = setTimeout(() => this.runLayout(), 200);
    },

    removeNode(id) {
      if (!this.cy) return;
      const node = this.cy.getElementById(id);
      if (node.length) {
        node.animate({ style: { opacity: 0 } }, { duration: 300, complete: () => node.remove() });
      }
    },

    updateNode(agent) {
      if (!this.cy) return;
      const node = this.cy.getElementById(agent.id);
      if (node.length) {
        node.data('status', agent.status);
        node.data('label', agent.label);
      }
    },

    addEdge(edge) {
      if (!this.cy) return;
      if (!this.cy.getElementById(edge.source).length || !this.cy.getElementById(edge.target).length) return;
      if (this.cy.getElementById(edge.id).length) return; // already exists
      this.cy.add({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edgeType: edge.edgeType,
          active: edge.active,
        },
      });
    },

    removeEdge(id) {
      if (!this.cy) return;
      const el = this.cy.getElementById(id);
      if (el.length) el.remove();
    },

    // Edge dash animation
    _animFrame: null,
    _dashOffset: 0,
    startAnimations() {
      const animate = () => {
        this._dashOffset += 0.5;
        if (this.cy) {
          this.cy.edges('[edgeType="delegation"], [edgeType="message"], [edgeType="mention"]').forEach(edge => {
            const base = edge.data('edgeType') === 'mention' ? [4, 4] : [8, 4];
            edge.style('line-dash-offset', -this._dashOffset);
          });

          // Pulse glow for working nodes
          const t = Date.now();
          this.cy.nodes('[status="working"]').forEach(node => {
            const glow = 2 + Math.sin(t / 400) * 1;
            node.style('border-width', glow);
          });
          this.cy.nodes('[status="in-meeting"]').forEach(node => {
            const op = 0.4 + (Math.sin(t / 1000) + 1) * 0.3;
            node.style('opacity', op);
          });
          this.cy.nodes('[status="waiting-for-user"]').forEach(node => {
            const op = 0.5 + (Math.sin(t / 1500) + 1) * 0.25;
            node.style('opacity', op);
          });
          this.cy.nodes('[status="spawning-workers"]').forEach(node => {
            const c = Math.sin(t / 600) > 0 ? '#a855f7' : '#22d3ee';
            node.style('border-color', c);
          });
        }
        this._animFrame = requestAnimationFrame(animate);
      };
      this._animFrame = requestAnimationFrame(animate);
    },
  };

  // ====================================================================
  // 4. SIDEBAR PANEL
  // ====================================================================
  const SidebarPanel = {
    show(agentId) {
      const agent = StateStore.agents.get(agentId);
      if (!agent) { this.clear(); return; }

      document.getElementById('sidebar-empty').style.display = 'none';
      const el = document.getElementById('sidebar-content');
      el.style.display = 'block';

      // Find children
      const children = [];
      StateStore.agents.forEach(a => {
        if (a.parentId === agentId) children.push(a);
      });

      // Find related events
      const recentEvents = StateStore.eventHistory
        .filter(ev => (ev.agentId === agentId || ev.fromId === agentId || ev.toId === agentId))
        .slice(-10)
        .reverse();

      const tierIcon = agent.type === 'orchestrator' ? '&#x1F3AF;' : agent.type === 'leader' ? '&#x1F451;' : '&#x2699;&#xFE0F;';

      el.innerHTML =
        '<div style="text-align:center;margin-bottom:8px;">' +
          '<span style="font-size:28px;">' + tierIcon + '</span>' +
          '<div style="font-size:14px;font-weight:700;color:var(--cyan);margin-top:4px;">' + escHtml(agent.label) + '</div>' +
          '<div style="font-size:11px;color:var(--text2);">' + escHtml(agent.id) + '</div>' +
        '</div>' +
        '<div class="detail-row"><span class="label">Type</span><span class="value">' + agent.type + '</span></div>' +
        '<div class="detail-row"><span class="label">Department</span><span class="value">' + escHtml(agent.department) + '</span></div>' +
        '<div class="detail-row"><span class="label">Status</span><span class="value"><span class="status-chip ' + agent.status + '">' + agent.status + '</span></span></div>' +
        '<div class="detail-row"><span class="label">Cost</span><span class="value">$' + agent.costUsd.toFixed(4) + '</span></div>' +
        '<div class="detail-row"><span class="label">Workers</span><span class="value">' + children.length + '</span></div>' +
        (agent.currentTask
          ? '<h2 style="margin-top:12px;">Current Task</h2><div class="task-block">' + escHtml(agent.currentTask) + '</div>'
          : '') +
        (children.length > 0
          ? '<h2 style="margin-top:12px;">Children</h2><ul class="children-list">' +
            children.map(c => '<li>' + escHtml(c.label) + ' <span class="status-chip ' + c.status + '" style="font-size:10px;">' + c.status + '</span></li>').join('') +
            '</ul>'
          : '') +
        (recentEvents.length > 0
          ? '<h2 style="margin-top:12px;">Recent Activity</h2><div id="task-history">' +
            recentEvents.map(ev => '<div class="history-item">' + summarizeEventShort(ev) + '</div>').join('') +
            '</div>'
          : '');
    },

    clear() {
      document.getElementById('sidebar-empty').style.display = 'block';
      document.getElementById('sidebar-content').style.display = 'none';
    },
  };

  // ====================================================================
  // 5. EVENT LOG
  // ====================================================================
  const EventLog = {
    el: null,
    pauseEl: null,
    autoScroll: true,
    maxEntries: 500,

    init() {
      this.el = document.getElementById('log-entries');
      this.pauseEl = document.getElementById('log-pause');

      this.el.addEventListener('scroll', () => {
        const atBottom = this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 30;
        this.autoScroll = atBottom;
        this.pauseEl.classList.toggle('visible', !atBottom);
      });
    },

    append(ev) {
      const row = document.createElement('div');
      row.className = 'log-entry';

      const now = new Date();
      const ts = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

      let kindLabel = '';
      let kindClass = '';
      let message = '';

      switch (ev.kind) {
        case 'agent_spawned':
          kindLabel = 'SPAWN'; kindClass = 'spawn';
          message = '<b>' + escHtml(ev.label) + '</b> (' + ev.agentType + ') in ' + escHtml(ev.department);
          break;
        case 'agent_destroyed':
          kindLabel = 'DESTROY'; kindClass = 'destroy';
          message = escHtml(ev.agentId);
          break;
        case 'state_changed':
          kindLabel = 'STATE'; kindClass = 'state';
          message = escHtml(ev.agentId) + ': ' + ev.from + ' &#x2192; ' + ev.to;
          break;
        case 'task_assigned':
          kindLabel = 'TASK'; kindClass = 'task';
          message = escHtml(ev.agentId) + ': ' + escHtml(ev.taskSummary);
          break;
        case 'task_completed':
          kindLabel = ev.result === 'success' ? 'SUCCESS' : 'FAILED';
          kindClass = ev.result === 'success' ? 'done' : 'destroy';
          message = escHtml(ev.agentId);
          break;
        case 'message_sent':
          kindLabel = 'MSG'; kindClass = 'msg';
          message = escHtml(ev.fromId) + ' &#x2192; ' + escHtml(ev.toId) + ': ' + escHtml(ev.summary);
          break;
        case 'mention_created':
          kindLabel = '@MENTION'; kindClass = 'mention';
          message = escHtml(ev.summary) + ' [' + ev.urgency + ']';
          break;
        case 'mention_resolved':
          kindLabel = '@RESOLVED'; kindClass = 'resolved';
          message = escHtml(ev.mentionId) + ': ' + escHtml(ev.decision);
          break;
        case 'cost_update':
          kindLabel = 'COST'; kindClass = 'cost';
          message = 'Total: $' + ev.totalCost.toFixed(4);
          break;
        default:
          kindLabel = 'EVENT'; kindClass = '';
          message = JSON.stringify(ev);
      }

      row.innerHTML =
        '<span class="log-time">' + ts + '</span>' +
        '<span class="log-kind ' + kindClass + '">' + kindLabel + '</span>' +
        '<span class="log-msg">' + message + '</span>';

      this.el.appendChild(row);

      // Prune old entries
      while (this.el.children.length > this.maxEntries) {
        this.el.removeChild(this.el.firstChild);
      }

      if (this.autoScroll) {
        this.el.scrollTop = this.el.scrollHeight;
      }
    },
  };

  // ====================================================================
  // 6. STATUS BAR
  // ====================================================================
  const StatusBar = {
    update() {
      const agentCount = StateStore.agents.size;
      document.getElementById('badge-agents').textContent = agentCount + ' agent' + (agentCount !== 1 ? 's' : '');

      const meeting = StateStore.meeting;
      const meetingEl = document.getElementById('badge-meeting');
      if (meeting) {
        meetingEl.textContent = meeting.phase;
        meetingEl.className = 'badge amber';
      } else {
        meetingEl.textContent = 'No meeting';
        meetingEl.className = 'badge purple';
      }

      document.getElementById('badge-cost').textContent = '$' + StateStore.totalCost.toFixed(4);
    },
  };

  // ====================================================================
  // HELPERS
  // ====================================================================
  function escHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function summarizeEventShort(ev) {
    switch (ev.kind) {
      case 'agent_spawned': return 'Spawned: ' + escHtml(ev.label);
      case 'agent_destroyed': return 'Destroyed';
      case 'state_changed': return ev.from + ' &#x2192; ' + ev.to;
      case 'task_assigned': return 'Task: ' + escHtml(ev.taskSummary);
      case 'task_completed': return 'Completed: ' + ev.result;
      case 'message_sent': return 'Msg to ' + escHtml(ev.toId);
      case 'mention_created': return '@mention: ' + escHtml(ev.summary);
      case 'mention_resolved': return '@resolved: ' + escHtml(ev.decision);
      case 'cost_update': return 'Cost: $' + ev.totalCost.toFixed(4);
      default: return ev.kind;
    }
  }

  // ====================================================================
  // BOOT
  // ====================================================================
  document.addEventListener('DOMContentLoaded', () => {
    GraphRenderer.init();
    EventLog.init();
    StatusBar.update();
    ConnectionManager.connect();

    // Welcome log entry
    EventLog.append({ kind: 'state_changed', agentId: 'dashboard', from: 'offline', to: 'connected' });
  });

})();
</script>
</body>
</html>`;
}
