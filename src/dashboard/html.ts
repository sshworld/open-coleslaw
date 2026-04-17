/**
 * getDashboardHTML() — inline HTML/CSS/JS for the Open Coleslaw dashboard.
 *
 * Thread-and-comment model: each session shows its current meeting as a thread
 * with speaker comments, plus an MVP progress panel. Users can drop a comment
 * from the browser, which is queued for the orchestrator to pick up.
 *
 * Multi-session aware: one tab per active project. No external JS deps.
 */

export function getDashboardHTML(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Coleslaw Dashboard</title>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #0a0e17;
  --surface:     #111827;
  --surface2:    #0d1422;
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

#app {
  display: grid;
  width: 100%; height: 100%;
  grid-template-rows: 48px 36px 1fr;
  grid-template-columns: 320px 1fr;
  grid-template-areas:
    "header  header"
    "tabs    tabs"
    "sidebar main";
}

/* Header */
#header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
}
#header .brand {
  font-size: 16px;
  font-weight: 700;
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(0,240,255,0.5);
}
#header .status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text2);
}
.conn-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--error);
  box-shadow: 0 0 6px rgba(239,68,68,0.6);
}
.conn-dot.connected {
  background: var(--success);
  box-shadow: 0 0 6px rgba(16,185,129,0.6);
}

/* Tabs */
#tab-bar {
  grid-area: tabs;
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.session-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  background: transparent;
  border: none;
  color: var(--text2);
  font-family: var(--font);
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.session-tab:hover { color: var(--text); }
.session-tab.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
}
.session-tab.inactive { opacity: 0.45; }

/* Sidebar */
#sidebar {
  grid-area: sidebar;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px;
}
.sidebar-section {
  margin-bottom: 20px;
}
.sidebar-section h3 {
  color: var(--lightcyan);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  font-weight: 600;
}
.mvp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 12px;
}
.mvp-item .dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text2);
  flex-shrink: 0;
}
.mvp-item.done       .dot { background: var(--success); }
.mvp-item.in-progress .dot { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.mvp-item.blocked    .dot { background: var(--error); }
.mvp-item .title { flex: 1; }
.mvp-item .status {
  font-size: 10px;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.past-meeting {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text2);
  border-left: 2px solid var(--border);
  margin-bottom: 4px;
}

/* Main thread area */
#main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#meeting-header {
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
#meeting-title {
  color: var(--cyan);
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
#meeting-meta {
  color: var(--text2);
  font-size: 11px;
}
#meeting-agenda {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.agenda-chip {
  background: rgba(0,240,255,0.1);
  border: 1px solid rgba(0,240,255,0.25);
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  color: var(--lightcyan);
}

#thread {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  scroll-behavior: smooth;
}
.comment {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--surface2);
  border-left: 3px solid var(--border);
  border-radius: 4px;
  animation: slideIn 0.3s ease-out;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.comment.role-planner      { border-left-color: var(--purple); }
.comment.role-architect    { border-left-color: var(--cyan); }
.comment.role-engineer     { border-left-color: var(--success); }
.comment.role-verifier     { border-left-color: var(--warning); }
.comment.role-product-manager { border-left-color: #ec4899; }
.comment.role-researcher   { border-left-color: #60a5fa; }
.comment.role-user         { border-left-color: #f97316; background: rgba(249,115,22,0.05); }
.comment .avatar {
  font-size: 18px;
  line-height: 1;
  padding-top: 2px;
  flex-shrink: 0;
}
.comment .body { flex: 1; min-width: 0; }
.comment .meta {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 10px;
  color: var(--text2);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.comment .role-name { color: var(--text); font-weight: 600; }
.comment .stance-chip {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 600;
}
.stance-chip.agree    { background: rgba(16,185,129,0.15); color: var(--success); }
.stance-chip.disagree { background: rgba(239,68,68,0.15); color: var(--error); }
.comment .content {
  font-size: 13px;
  color: var(--text);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.decisions-panel {
  margin-top: 16px;
  padding: 14px 18px;
  background: rgba(16,185,129,0.05);
  border: 1px solid rgba(16,185,129,0.25);
  border-radius: 6px;
}
.decisions-panel h4 {
  color: var(--success);
  font-size: 12px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.decisions-panel ul {
  list-style: none;
  padding-left: 0;
}
.decisions-panel li {
  padding: 4px 0;
  padding-left: 18px;
  position: relative;
  font-size: 12px;
}
.decisions-panel li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--success);
  font-weight: 700;
}

#empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text2);
  font-size: 13px;
  flex-direction: column;
  gap: 8px;
}

/* Comment input */
#comment-box {
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 12px 20px;
  display: flex;
  gap: 10px;
  align-items: stretch;
}
#comment-input {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  padding: 8px 12px;
  resize: none;
  outline: none;
}
#comment-input:focus { border-color: var(--cyan); }
#comment-send {
  background: var(--cyan);
  color: var(--bg);
  border: none;
  font-family: var(--font);
  font-weight: 700;
  padding: 0 18px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
#comment-send:hover { background: var(--lightcyan); }
#comment-send:disabled {
  background: var(--border);
  color: var(--text2);
  cursor: not-allowed;
}
</style>
</head>
<body>
<div id="app">

  <div id="header">
    <div class="brand">🥬 Open Coleslaw</div>
    <div class="status">
      <span id="conn-dot" class="conn-dot"></span>
      <span id="conn-text">Connecting…</span>
    </div>
  </div>

  <div id="tab-bar"></div>

  <aside id="sidebar">
    <div class="sidebar-section">
      <h3>MVP Progress</h3>
      <div id="mvp-list"><div class="empty">No MVPs yet</div></div>
    </div>
    <div class="sidebar-section">
      <h3>Past Meetings</h3>
      <div id="past-list"><div class="empty">No past meetings</div></div>
    </div>
  </aside>

  <main id="main">
    <div id="meeting-header">
      <div id="meeting-title">No meeting in progress</div>
      <div id="meeting-meta">Waiting for orchestrator…</div>
      <div id="meeting-agenda"></div>
    </div>
    <div id="thread">
      <div id="empty">
        <div>🗣️</div>
        <div>When a meeting starts, comments appear here.</div>
      </div>
    </div>
    <form id="comment-box" onsubmit="return sendComment(event)">
      <textarea id="comment-input" rows="1" placeholder="Add a comment to this meeting… (Enter to send, Shift+Enter for newline)" disabled></textarea>
      <button id="comment-send" type="submit" disabled>Send</button>
    </form>
  </main>

</div>

<script>
// -----------------------------------------------------------------
// State
// -----------------------------------------------------------------
const state = {
  sessions: new Map(),     // sessionId → SessionSnapshot
  activeSessionId: null,
  ws: null,
};

const AVATARS = {
  planner:           '📌',
  architect:         '🏛',
  engineer:          '🔧',
  verifier:          '🧪',
  'product-manager': '📋',
  researcher:        '🔍',
  user:              '👤',
};

// -----------------------------------------------------------------
// WebSocket
// -----------------------------------------------------------------
function connect() {
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  const ws = new WebSocket(url);
  state.ws = ws;

  ws.onopen = () => setConnected(true);
  ws.onclose = () => {
    setConnected(false);
    setTimeout(connect, 1500);
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleServerMessage(msg);
    } catch (e) { /* ignore */ }
  };
}
function setConnected(on) {
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');
  dot.classList.toggle('connected', on);
  text.textContent = on ? 'Connected' : 'Disconnected';
}

function handleServerMessage(msg) {
  if (msg.type === 'multi-snapshot') {
    state.sessions.clear();
    for (const s of msg.sessions) {
      state.sessions.set(s.sessionId, s);
    }
    if (!state.activeSessionId && state.sessions.size > 0) {
      state.activeSessionId = [...state.sessions.keys()][0];
    }
    renderAll();
  } else if (msg.type === 'session-registered') {
    if (!state.sessions.has(msg.sessionId)) {
      state.sessions.set(msg.sessionId, {
        sessionId: msg.sessionId,
        displayName: msg.displayName,
        projectPath: msg.projectPath,
        isActive: true,
        currentMeeting: null,
        pastMeetings: [],
        mvps: [],
        totalCost: 0,
      });
      if (!state.activeSessionId) state.activeSessionId = msg.sessionId;
      renderAll();
    }
  } else if (msg.type === 'session-unregistered') {
    const s = state.sessions.get(msg.sessionId);
    if (s) { s.isActive = false; renderAll(); }
  } else if (msg.type === 'session-delta') {
    applyDelta(msg);
  }
}

function applyDelta(delta) {
  const session = state.sessions.get(delta.sessionId);
  if (!session) return;
  for (const ev of delta.events) {
    applyEvent(session, ev);
  }
  renderAll();
}

function applyEvent(session, event) {
  switch (event.kind) {
    case 'meeting_started':
      if (session.currentMeeting) {
        session.pastMeetings = [session.currentMeeting, ...(session.pastMeetings || [])].slice(0, 5);
      }
      session.currentMeeting = {
        meetingId: event.meetingId,
        meetingType: event.meetingType,
        topic: event.topic,
        agenda: event.agenda,
        participants: event.participants,
        status: 'in-progress',
        phase: 'opening',
        comments: [],
        mvps: [],
        decisions: [],
        actionItems: [],
        startedAt: Date.now(),
        completedAt: null,
      };
      break;
    case 'transcript_added':
      if (session.currentMeeting && session.currentMeeting.meetingId === event.meetingId) {
        session.currentMeeting.comments.push(event.comment);
      }
      break;
    case 'consensus_checked':
      if (session.currentMeeting && session.currentMeeting.meetingId === event.meetingId) {
        session.currentMeeting.status = event.allAgreed ? 'in-progress' : 'awaiting-consensus';
      }
      break;
    case 'minutes_finalized':
      if (session.currentMeeting && session.currentMeeting.meetingId === event.meetingId) {
        session.currentMeeting.decisions = event.decisions;
        session.currentMeeting.actionItems = event.actionItems;
        session.currentMeeting.status = 'completed';
        session.currentMeeting.completedAt = Date.now();
      }
      break;
    case 'user_comment_added':
      if (session.currentMeeting && session.currentMeeting.meetingId === event.meetingId) {
        session.currentMeeting.comments.push({
          id: session.currentMeeting.comments.length + 1,
          speakerRole: 'user',
          agendaItemIndex: -3,
          roundNumber: 0,
          content: event.content,
          stance: 'speaking',
          createdAt: Date.now(),
        });
      }
      break;
    case 'mvp_progress':
      session.mvps = event.mvps;
      if (session.currentMeeting) session.currentMeeting.mvps = event.mvps;
      break;
    case 'cost_update':
      session.totalCost = event.totalCost;
      break;
  }
}

// -----------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------
function renderAll() {
  renderTabs();
  renderSidebar();
  renderMain();
}

function renderTabs() {
  const bar = document.getElementById('tab-bar');
  bar.innerHTML = '';
  for (const [sid, s] of state.sessions) {
    const btn = document.createElement('button');
    btn.className = 'session-tab';
    if (sid === state.activeSessionId) btn.classList.add('active');
    if (!s.isActive) btn.classList.add('inactive');
    btn.textContent = s.displayName + (s.currentMeeting ? ' •' : '');
    btn.onclick = () => { state.activeSessionId = sid; renderAll(); };
    bar.appendChild(btn);
  }
}

function renderSidebar() {
  const s = state.sessions.get(state.activeSessionId);
  const mvpEl = document.getElementById('mvp-list');
  const pastEl = document.getElementById('past-list');
  mvpEl.innerHTML = '';
  pastEl.innerHTML = '';
  if (!s) return;

  if (!s.mvps || s.mvps.length === 0) {
    mvpEl.innerHTML = '<div class="empty" style="color:var(--text2);font-size:11px;">No MVPs yet</div>';
  } else {
    for (const mvp of s.mvps) {
      const row = document.createElement('div');
      row.className = 'mvp-item ' + mvp.status;
      row.innerHTML =
        '<span class="dot"></span>' +
        '<span class="title">' + escapeHtml(mvp.title) + '</span>' +
        '<span class="status">' + mvp.status + '</span>';
      mvpEl.appendChild(row);
    }
  }

  if (!s.pastMeetings || s.pastMeetings.length === 0) {
    pastEl.innerHTML = '<div class="empty" style="color:var(--text2);font-size:11px;">No past meetings</div>';
  } else {
    for (const m of s.pastMeetings) {
      const row = document.createElement('div');
      row.className = 'past-meeting';
      row.textContent = m.topic + ' — ' + (m.decisions?.length || 0) + ' decisions';
      pastEl.appendChild(row);
    }
  }
}

function renderMain() {
  const s = state.sessions.get(state.activeSessionId);
  const title = document.getElementById('meeting-title');
  const meta  = document.getElementById('meeting-meta');
  const agenda = document.getElementById('meeting-agenda');
  const thread = document.getElementById('thread');
  const input = document.getElementById('comment-input');
  const send  = document.getElementById('comment-send');

  if (!s || !s.currentMeeting) {
    title.textContent = 'No meeting in progress';
    meta.textContent  = s ? 'Session ready' : 'No active session';
    agenda.innerHTML  = '';
    thread.innerHTML  = '<div id="empty"><div>🗣️</div><div>When a meeting starts, comments appear here.</div></div>';
    input.disabled = true;
    send.disabled = true;
    return;
  }

  const m = s.currentMeeting;
  title.textContent = m.topic;
  meta.textContent = [m.meetingType.toUpperCase(), m.status, m.participants.join(', ')].join(' · ');
  agenda.innerHTML = '';
  (m.agenda || []).forEach((item, i) => {
    const chip = document.createElement('span');
    chip.className = 'agenda-chip';
    chip.textContent = (i + 1) + '. ' + item;
    agenda.appendChild(chip);
  });

  thread.innerHTML = '';
  for (const c of (m.comments || [])) {
    thread.appendChild(commentEl(c));
  }
  if ((m.decisions || []).length > 0 || (m.actionItems || []).length > 0) {
    thread.appendChild(decisionsEl(m));
  }
  thread.scrollTop = thread.scrollHeight;

  input.disabled = (m.status === 'completed');
  send.disabled  = (m.status === 'completed');
}

function commentEl(c) {
  const el = document.createElement('div');
  el.className = 'comment role-' + c.speakerRole;
  const stance = (c.stance === 'agree' || c.stance === 'disagree')
    ? '<span class="stance-chip ' + c.stance + '">' + c.stance + '</span>'
    : '';
  el.innerHTML =
    '<div class="avatar">' + (AVATARS[c.speakerRole] || '•') + '</div>' +
    '<div class="body">' +
      '<div class="meta">' +
        '<span class="role-name">' + escapeHtml(c.speakerRole) + '</span>' +
        '<span>r' + c.roundNumber + '</span>' +
        stance +
      '</div>' +
      '<div class="content">' + escapeHtml(c.content) + '</div>' +
    '</div>';
  return el;
}

function decisionsEl(m) {
  const el = document.createElement('div');
  el.className = 'decisions-panel';
  const dec = (m.decisions || []).map((d) => '<li>' + escapeHtml(d) + '</li>').join('');
  const act = (m.actionItems || []).map((a) => '<li>' + escapeHtml(a) + '</li>').join('');
  el.innerHTML =
    (dec ? '<h4>Decisions</h4><ul>' + dec + '</ul>' : '') +
    (act ? '<h4 style="margin-top:10px;color:var(--warning);">Action Items</h4><ul>' + act + '</ul>' : '');
  return el;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// -----------------------------------------------------------------
// Comment submission
// -----------------------------------------------------------------
function sendComment(ev) {
  ev.preventDefault();
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return false;
  const s = state.sessions.get(state.activeSessionId);
  if (!s || !s.currentMeeting) return false;

  state.ws.send(JSON.stringify({
    type: 'user-comment',
    sessionId: state.activeSessionId,
    meetingId: s.currentMeeting.meetingId,
    content,
  }));
  input.value = '';
  input.style.height = 'auto';
  return false;
}

// Enter sends, Shift+Enter newline
document.getElementById('comment-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendComment(e);
  }
});

connect();
</script>
</body>
</html>`;
}
