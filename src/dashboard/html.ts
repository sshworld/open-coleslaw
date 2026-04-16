/**
 * getDashboardHTML() — returns the full inline HTML/CSS/JS for the Open Coleslaw
 * real-time dashboard.  Everything is self-contained; the only external deps are
 * Cytoscape.js + dagre loaded from CDN.
 *
 * Multi-session aware: one tab per project session in the tab bar.
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
   LAYOUT — five areas via CSS Grid
   =================================================================== */
#app {
  display: grid;
  width: 100%; height: 100%;
  grid-template-rows: 48px 36px 1fr 200px;
  grid-template-columns: 1fr 320px;
  grid-template-areas:
    "header  header"
    "tabs    tabs"
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
   TAB BAR
   =================================================================== */
#tab-bar {
  grid-area: tabs;
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
#tab-bar::-webkit-scrollbar { display: none; }

.session-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  font-size: 11px;
  font-family: var(--font);
  font-weight: 500;
  color: var(--text2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, border-color 0.2s, opacity 0.2s;
  position: relative;
}
.session-tab:hover {
  color: var(--text);
  background: rgba(255,255,255,0.02);
}
.session-tab.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
  text-shadow: 0 0 8px rgba(0,240,255,0.4);
}
.session-tab.inactive {
  opacity: 0.45;
  text-decoration: line-through;
  color: var(--text2);
}
.session-tab.inactive:hover {
  opacity: 0.6;
}

.tab-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(0,240,255,0.15);
  color: var(--cyan);
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}
.tab-badge.meeting {
  background: rgba(245,158,11,0.2);
  color: var(--warning);
}

.tab-empty-msg {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--text2);
  font-style: italic;
  padding: 0 8px;
}

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
.log-session {
  color: var(--cyan);
  font-size: 10px;
  flex-shrink: 0;
  min-width: 80px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}
.log-kind {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 90px;
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
.log-kind.session  { color: var(--purple); }

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
      <span class="badge" id="badge-sessions">0 sessions</span>
      <span class="badge" id="badge-agents">0 agents</span>
      <span class="badge purple" id="badge-meeting">No meeting</span>
      <span class="badge green" id="badge-cost">$0.0000</span>
    </div>
  </header>

  <!-- TAB BAR ----------------------------------------------------------- -->
  <div id="tab-bar">
    <span class="tab-empty-msg" id="tab-empty">Waiting for sessions...</span>
  </div>

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
// IIFE -- all dashboard JS
// ======================================================================
(function () {
  'use strict';

  // ====================================================================
  // 1. STATE STORE  (per-session)
  // ====================================================================
  // sessions: Map<sessionId, { displayName, projectPath, isActive, agents: Map, edges: [], meeting, totalCost, eventHistory[] }>
  const sessions = new Map();
  let activeTabId = null;       // currently viewed session
  let selectedAgentId = null;   // clicked node

  function getSession(id) { return sessions.get(id); }

  function activeSession() {
    if (!activeTabId) return null;
    return sessions.get(activeTabId) || null;
  }

  // ====================================================================
  // 2. CONNECTION MANAGER -- WebSocket with exponential backoff
  // ====================================================================
  const ConnectionManager = {
    ws: null,
    backoff: 1000,
    maxBackoff: 30000,
    timer: null,
    _heartbeat: null,

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
          this.handleMessage(data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {};

      if (this._heartbeat) clearInterval(this._heartbeat);
      this._heartbeat = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    },

    handleMessage(data) {
      switch (data.type) {
        case 'multi-snapshot':
          this.handleMultiSnapshot(data);
          break;
        case 'session-delta':
          this.handleSessionDelta(data);
          break;
        case 'session-registered':
          this.handleSessionRegistered(data);
          break;
        case 'session-unregistered':
          this.handleSessionUnregistered(data);
          break;
        case 'pong':
          break;
        default:
          break;
      }
    },

    handleMultiSnapshot(data) {
      sessions.clear();
      (data.sessions || []).forEach(function (s) {
        var agentsMap = new Map();
        (s.snapshot.agents || []).forEach(function (a) { agentsMap.set(a.id, a); });
        sessions.set(s.sessionId, {
          displayName: s.displayName,
          projectPath: s.projectPath,
          isActive: s.isActive,
          agents: agentsMap,
          edges: s.snapshot.edges || [],
          meeting: s.snapshot.meeting || null,
          totalCost: s.snapshot.totalCost || 0,
          eventHistory: [],
        });
      });
      // Auto-select first active tab if none selected
      if (!activeTabId || !sessions.has(activeTabId)) {
        var first = null;
        sessions.forEach(function (s, id) { if (!first && s.isActive) first = id; });
        if (!first && sessions.size > 0) first = sessions.keys().next().value;
        activeTabId = first;
      }
      TabBar.render();
      StatusBar.update();
      GraphRenderer.rebuild();
    },

    handleSessionDelta(data) {
      var sess = sessions.get(data.sessionId);
      if (!sess) {
        // Session not yet known -- create a placeholder
        sess = {
          displayName: data.displayName,
          projectPath: '',
          isActive: true,
          agents: new Map(),
          edges: [],
          meeting: null,
          totalCost: 0,
          eventHistory: [],
        };
        sessions.set(data.sessionId, sess);
        TabBar.render();
      }

      (data.events || []).forEach(function (ev) {
        applyEventToSession(data.sessionId, sess, ev);
      });

      TabBar.updateBadge(data.sessionId);
      StatusBar.update();

      // Rebuild graph only if this is the active tab
      if (data.sessionId === activeTabId) {
        GraphRenderer.rebuild();
        if (selectedAgentId) SidebarPanel.show(selectedAgentId);
      }
    },

    handleSessionRegistered(data) {
      if (!sessions.has(data.sessionId)) {
        sessions.set(data.sessionId, {
          displayName: data.displayName,
          projectPath: data.projectPath,
          isActive: true,
          agents: new Map(),
          edges: [],
          meeting: null,
          totalCost: 0,
          eventHistory: [],
        });
      }
      // Auto-select if no tab is active
      if (!activeTabId) activeTabId = data.sessionId;
      TabBar.render();
      StatusBar.update();
      EventLog.appendSystem(data.displayName, 'Session connected');
    },

    handleSessionUnregistered(data) {
      var sess = sessions.get(data.sessionId);
      if (sess) {
        sess.isActive = false;
        TabBar.render();
        StatusBar.update();
        EventLog.appendSystem(sess.displayName, 'Session disconnected');
      }
    },

    scheduleReconnect() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
        this.connect();
      }, this.backoff);
    },

    setStatus(status) {
      var dot = document.getElementById('conn-dot');
      var label = document.getElementById('conn-label');
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
  // Event application (scoped to a session)
  // ====================================================================
  function applyEventToSession(sessionId, sess, ev) {
    sess.eventHistory.push(ev);
    if (sess.eventHistory.length > 500) sess.eventHistory.shift();

    EventLog.append(sessionId, sess.displayName, ev);

    switch (ev.kind) {
      case 'agent_spawned': {
        var agent = {
          id: ev.agentId,
          type: ev.agentType,
          label: ev.label,
          status: 'idle',
          parentId: ev.parentId,
          department: ev.department,
          currentTask: null,
          costUsd: 0,
        };
        sess.agents.set(ev.agentId, agent);
        if (ev.parentId) {
          sess.edges.push({
            id: 'edge-' + ev.parentId + '-' + ev.agentId,
            source: ev.parentId,
            target: ev.agentId,
            edgeType: 'hierarchy',
            active: true,
            label: '',
          });
        }
        break;
      }
      case 'agent_destroyed': {
        sess.agents.delete(ev.agentId);
        sess.edges = sess.edges.filter(function (e) {
          return e.source !== ev.agentId && e.target !== ev.agentId;
        });
        if (sessionId === activeTabId && selectedAgentId === ev.agentId) {
          selectedAgentId = null;
          SidebarPanel.clear();
        }
        break;
      }
      case 'state_changed': {
        var a = sess.agents.get(ev.agentId);
        if (a) a.status = ev.to;
        break;
      }
      case 'task_assigned': {
        var a = sess.agents.get(ev.agentId);
        if (a) { a.currentTask = ev.taskSummary; a.status = 'working'; }
        break;
      }
      case 'task_completed': {
        var a = sess.agents.get(ev.agentId);
        if (a) { a.currentTask = null; a.status = ev.result === 'success' ? 'completed' : 'failed'; }
        break;
      }
      case 'message_sent': {
        var edgeId = 'msg-' + ev.fromId + '-' + ev.toId + '-' + Date.now();
        var edge = { id: edgeId, source: ev.fromId, target: ev.toId, edgeType: 'message', active: true, label: ev.summary };
        sess.edges.push(edge);
        setTimeout(function () {
          sess.edges = sess.edges.filter(function (e) { return e.id !== edgeId; });
          if (sessionId === activeTabId) GraphRenderer.rebuild();
        }, 5000);
        break;
      }
      case 'cost_update': {
        sess.totalCost = ev.totalCost;
        break;
      }
      default:
        break;
    }
  }

  // ====================================================================
  // 3. TAB BAR
  // ====================================================================
  var TabBar = {
    render: function () {
      var bar = document.getElementById('tab-bar');
      var emptyMsg = document.getElementById('tab-empty');

      // Remove old tabs (keep the empty msg span)
      var old = bar.querySelectorAll('.session-tab');
      old.forEach(function (el) { el.remove(); });

      if (sessions.size === 0) {
        emptyMsg.style.display = '';
        return;
      }
      emptyMsg.style.display = 'none';

      sessions.forEach(function (sess, sessionId) {
        var tab = document.createElement('button');
        tab.className = 'session-tab';
        if (sessionId === activeTabId) tab.classList.add('active');
        if (!sess.isActive) tab.classList.add('inactive');
        tab.dataset.sessionId = sessionId;

        // Tab label
        var lbl = document.createElement('span');
        lbl.textContent = sess.displayName || sessionId.slice(0, 8);
        tab.appendChild(lbl);

        // Agent count badge
        var badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = String(sess.agents.size);
        tab.appendChild(badge);

        // Meeting indicator
        if (sess.meeting) {
          var mb = document.createElement('span');
          mb.className = 'tab-badge meeting';
          mb.textContent = 'MTG';
          tab.appendChild(mb);
        }

        tab.addEventListener('click', function () {
          TabBar.switchTo(sessionId);
        });

        bar.appendChild(tab);
      });
    },

    switchTo: function (sessionId) {
      activeTabId = sessionId;
      selectedAgentId = null;
      SidebarPanel.clear();
      this.render();
      StatusBar.update();
      GraphRenderer.rebuild();
    },

    updateBadge: function (sessionId) {
      var bar = document.getElementById('tab-bar');
      var tabs = bar.querySelectorAll('.session-tab');
      tabs.forEach(function (tab) {
        if (tab.dataset.sessionId === sessionId) {
          var sess = sessions.get(sessionId);
          if (!sess) return;
          var badge = tab.querySelector('.tab-badge:not(.meeting)');
          if (badge) badge.textContent = String(sess.agents.size);
        }
      });
    },
  };

  // ====================================================================
  // 4. GRAPH RENDERER -- Cytoscape.js
  // ====================================================================
  var GraphRenderer = {
    cy: null,
    _layoutTimer: null,
    _animFrame: null,
    _dashOffset: 0,

    init: function () {
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
              'width': 60, 'height': 60,
              'border-width': 3,
              'border-color': '#00f0ff',
              'background-color': 'rgba(0,240,255,0.1)',
              'color': '#00f0ff',
              'font-size': 12, 'font-weight': '700',
              'text-outline-color': '#0a0e17',
              'text-outline-width': 2,
            },
          },
          // Leader
          {
            selector: 'node[tier="leader"]',
            style: {
              'width': 48, 'height': 48,
              'border-width': 2,
              'border-color': '#a855f7',
              'background-color': 'rgba(168,85,247,0.1)',
              'color': '#a855f7',
              'font-size': 11, 'font-weight': '600',
            },
          },
          // Worker
          {
            selector: 'node[tier="worker"]',
            style: {
              'width': 36, 'height': 36,
              'border-width': 2,
              'border-color': '#22d3ee',
              'background-color': 'rgba(34,211,238,0.08)',
              'color': '#22d3ee',
              'font-size': 10,
            },
          },
          // Status: idle
          { selector: 'node[status="idle"]', style: { 'opacity': 0.5, 'border-color': '#475569' } },
          // Status: working
          { selector: 'node[status="working"]', style: { 'border-width': 3, 'opacity': 1 } },
          // Status: in-meeting
          { selector: 'node[status="in-meeting"]', style: { 'border-color': '#f59e0b', 'background-color': 'rgba(245,158,11,0.1)', 'opacity': 1 } },
          // Status: spawning-workers
          { selector: 'node[status="spawning-workers"]', style: { 'border-color': '#a855f7', 'opacity': 1 } },
          // Status: waiting-for-user
          { selector: 'node[status="waiting-for-user"]', style: { 'border-color': '#f59e0b', 'opacity': 0.8 } },
          // Status: aggregating
          { selector: 'node[status="aggregating"]', style: { 'border-color': '#22d3ee', 'opacity': 1 } },
          // Status: completed
          { selector: 'node[status="completed"]', style: { 'border-color': '#10b981', 'background-color': 'rgba(16,185,129,0.1)', 'opacity': 0.7 } },
          // Status: failed
          { selector: 'node[status="failed"]', style: { 'border-color': '#ef4444', 'background-color': 'rgba(239,68,68,0.1)', 'opacity': 0.8 } },
          // Selected node
          { selector: 'node:selected', style: { 'border-width': 4, 'overlay-padding': 6, 'overlay-color': '#00f0ff', 'overlay-opacity': 0.08 } },
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
          { selector: 'edge[edgeType="hierarchy"][?active]', style: { 'line-color': '#475569', 'target-arrow-color': '#475569', 'line-style': 'solid', 'opacity': 0.6, 'width': 1.5 } },
          { selector: 'edge[edgeType="delegation"]', style: { 'line-color': '#a855f7', 'target-arrow-color': '#a855f7', 'line-style': 'dashed', 'line-dash-pattern': [8, 4], 'opacity': 0.8, 'width': 2 } },
          { selector: 'edge[edgeType="report"]', style: { 'line-color': '#10b981', 'target-arrow-color': '#10b981', 'opacity': 0.8, 'width': 2 } },
          { selector: 'edge[edgeType="message"]', style: { 'line-color': '#22d3ee', 'target-arrow-color': '#22d3ee', 'line-style': 'dashed', 'line-dash-pattern': [6, 3], 'opacity': 0.7, 'width': 1.5 } },
          { selector: 'edge[edgeType="mention"]', style: { 'line-color': '#ef4444', 'target-arrow-color': '#ef4444', 'line-style': 'dashed', 'line-dash-pattern': [4, 4], 'opacity': 0.9, 'width': 2.5 } },
        ],
        layout: { name: 'preset' },
        minZoom: 0.3,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });

      // Click handling
      this.cy.on('tap', 'node', function (evt) {
        var id = evt.target.id();
        selectedAgentId = id;
        SidebarPanel.show(id);
      });

      this.cy.on('tap', function (evt) {
        if (evt.target === GraphRenderer.cy) {
          selectedAgentId = null;
          SidebarPanel.clear();
        }
      });

      this.startAnimations();
    },

    rebuild: function () {
      if (!this.cy) return;
      this.cy.elements().remove();

      var sess = activeSession();
      if (!sess) return;

      sess.agents.forEach(function (agent) {
        GraphRenderer.cy.add({
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

      sess.edges.forEach(function (edge) {
        if (GraphRenderer.cy.getElementById(edge.source).length && GraphRenderer.cy.getElementById(edge.target).length) {
          GraphRenderer.cy.add({
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

    runLayout: function () {
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

    startAnimations: function () {
      var self = this;
      var animate = function () {
        self._dashOffset += 0.5;
        if (self.cy) {
          self.cy.edges('[edgeType="delegation"], [edgeType="message"], [edgeType="mention"]').forEach(function (edge) {
            edge.style('line-dash-offset', -self._dashOffset);
          });

          var t = Date.now();
          self.cy.nodes('[status="working"]').forEach(function (node) {
            var glow = 2 + Math.sin(t / 400) * 1;
            node.style('border-width', glow);
          });
          self.cy.nodes('[status="in-meeting"]').forEach(function (node) {
            var op = 0.4 + (Math.sin(t / 1000) + 1) * 0.3;
            node.style('opacity', op);
          });
          self.cy.nodes('[status="waiting-for-user"]').forEach(function (node) {
            var op = 0.5 + (Math.sin(t / 1500) + 1) * 0.25;
            node.style('opacity', op);
          });
          self.cy.nodes('[status="spawning-workers"]').forEach(function (node) {
            var c = Math.sin(t / 600) > 0 ? '#a855f7' : '#22d3ee';
            node.style('border-color', c);
          });
        }
        self._animFrame = requestAnimationFrame(animate);
      };
      self._animFrame = requestAnimationFrame(animate);
    },
  };

  // ====================================================================
  // 5. SIDEBAR PANEL
  // ====================================================================
  var SidebarPanel = {
    show: function (agentId) {
      var sess = activeSession();
      if (!sess) { this.clear(); return; }
      var agent = sess.agents.get(agentId);
      if (!agent) { this.clear(); return; }

      document.getElementById('sidebar-empty').style.display = 'none';
      var el = document.getElementById('sidebar-content');
      el.style.display = 'block';

      // Children
      var children = [];
      sess.agents.forEach(function (a) {
        if (a.parentId === agentId) children.push(a);
      });

      // Recent events for this agent
      var recentEvents = sess.eventHistory
        .filter(function (ev) { return ev.agentId === agentId || ev.fromId === agentId || ev.toId === agentId; })
        .slice(-10)
        .reverse();

      var tierIcon = agent.type === 'orchestrator' ? '&#x1F3AF;' : agent.type === 'leader' ? '&#x1F451;' : '&#x2699;&#xFE0F;';

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
            children.map(function (c) { return '<li>' + escHtml(c.label) + ' <span class="status-chip ' + c.status + '" style="font-size:10px;">' + c.status + '</span></li>'; }).join('') +
            '</ul>'
          : '') +
        (recentEvents.length > 0
          ? '<h2 style="margin-top:12px;">Recent Activity</h2><div id="task-history">' +
            recentEvents.map(function (ev) { return '<div class="history-item">' + summarizeEventShort(ev) + '</div>'; }).join('') +
            '</div>'
          : '');
    },

    clear: function () {
      document.getElementById('sidebar-empty').style.display = 'block';
      document.getElementById('sidebar-content').style.display = 'none';
    },
  };

  // ====================================================================
  // 6. EVENT LOG
  // ====================================================================
  var EventLog = {
    el: null,
    pauseEl: null,
    autoScroll: true,
    maxEntries: 500,

    init: function () {
      this.el = document.getElementById('log-entries');
      this.pauseEl = document.getElementById('log-pause');
      var self = this;
      this.el.addEventListener('scroll', function () {
        var atBottom = self.el.scrollHeight - self.el.scrollTop - self.el.clientHeight < 30;
        self.autoScroll = atBottom;
        self.pauseEl.classList.toggle('visible', !atBottom);
      });
    },

    append: function (sessionId, displayName, ev) {
      var row = document.createElement('div');
      row.className = 'log-entry';

      var now = new Date();
      var ts = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

      var kindLabel = '';
      var kindClass = '';
      var message = '';

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
        '<span class="log-session">' + escHtml(displayName) + '</span>' +
        '<span class="log-kind ' + kindClass + '">' + kindLabel + '</span>' +
        '<span class="log-msg">' + message + '</span>';

      this.el.appendChild(row);

      while (this.el.children.length > this.maxEntries) {
        this.el.removeChild(this.el.firstChild);
      }

      if (this.autoScroll) {
        this.el.scrollTop = this.el.scrollHeight;
      }
    },

    appendSystem: function (displayName, message) {
      var row = document.createElement('div');
      row.className = 'log-entry';
      var now = new Date();
      var ts = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
      row.innerHTML =
        '<span class="log-time">' + ts + '</span>' +
        '<span class="log-session">' + escHtml(displayName) + '</span>' +
        '<span class="log-kind session">SESSION</span>' +
        '<span class="log-msg">' + escHtml(message) + '</span>';
      this.el.appendChild(row);
      if (this.autoScroll) this.el.scrollTop = this.el.scrollHeight;
    },
  };

  // ====================================================================
  // 7. STATUS BAR
  // ====================================================================
  var StatusBar = {
    update: function () {
      // Session count
      var totalSessions = sessions.size;
      var activeSessions = 0;
      sessions.forEach(function (s) { if (s.isActive) activeSessions++; });
      document.getElementById('badge-sessions').textContent = activeSessions + '/' + totalSessions + ' sessions';

      // Agent count + meeting + cost for active tab
      var sess = activeSession();
      if (sess) {
        document.getElementById('badge-agents').textContent = sess.agents.size + ' agent' + (sess.agents.size !== 1 ? 's' : '');

        if (sess.meeting) {
          document.getElementById('badge-meeting').textContent = sess.meeting.phase;
          document.getElementById('badge-meeting').className = 'badge amber';
        } else {
          document.getElementById('badge-meeting').textContent = 'No meeting';
          document.getElementById('badge-meeting').className = 'badge purple';
        }

        document.getElementById('badge-cost').textContent = '$' + sess.totalCost.toFixed(4);
      } else {
        document.getElementById('badge-agents').textContent = '0 agents';
        document.getElementById('badge-meeting').textContent = 'No meeting';
        document.getElementById('badge-meeting').className = 'badge purple';
        document.getElementById('badge-cost').textContent = '$0.0000';
      }
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
  document.addEventListener('DOMContentLoaded', function () {
    GraphRenderer.init();
    EventLog.init();
    StatusBar.update();
    ConnectionManager.connect();
  });

})();
</script>
</body>
</html>`;
}
