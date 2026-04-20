#!/usr/bin/env node
/**
 * Mock dashboard injector — used to populate the live dashboard with a
 * realistic sample meeting so we can capture a screenshot for the README.
 *
 * Usage:
 *   1. Start the dashboard: `node dist/index.js` (keep running)
 *   2. In another shell: `node scripts/mock-dashboard.mjs`
 *   3. Open http://localhost:35143 and screenshot.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://127.0.0.1:35143';

// Register against the same projectPath the dashboard owner was launched
// with (/tmp/balance-game-demo) so events merge into the existing tab.
const SESSION_ID = 'mock-balance-game';
const PROJECT_PATH = '/private/tmp/balance-game';
const PROJECT_NAME = 'balance-game';
const MEETING_ID = 'mtg-001';

const MVPS = [
  {
    id: 'mvp-1',
    title: 'Core question engine',
    goal: 'Render balance-game questions and capture A/B choices',
    status: 'in-progress',
    orderIndex: 0,
  },
  {
    id: 'mvp-2',
    title: 'Shareable results screen',
    goal: 'Summary screen with tally + share link',
    status: 'pending',
    orderIndex: 1,
  },
  {
    id: 'mvp-3',
    title: 'Persistence + history',
    goal: 'Store past answers in localStorage with reset',
    status: 'pending',
    orderIndex: 2,
  },
];

const COMMENTS = [
  {
    role: 'planner',
    content:
      'Opening MVP-1 design meeting. Agenda: (1) question data shape, (2) state transitions, (3) test strategy. Architect first.',
    stance: 'speaking',
  },
  {
    role: 'architect',
    content:
      'Question as `{ id, prompt, choices: [A, B] }`. Keep state in a reducer — `{ index, answers[] }`. No server yet.',
    stance: 'speaking',
  },
  {
    role: 'engineer',
    content:
      'Reducer fits. I want choices typed as a tuple `[ChoiceA, ChoiceB]` so TS enforces exactly two options.',
    stance: 'speaking',
  },
  {
    role: 'verifier',
    content:
      'Tests: (1) reducer unit tests for every transition, (2) Playwright happy-path for 3 questions → results.',
    stance: 'speaking',
  },
  {
    role: 'planner',
    content: 'Consensus check — does everyone agree on the tuple-typed choices + reducer model?',
    stance: 'speaking',
  },
  {
    role: 'architect',
    content: 'Agree.',
    stance: 'agree',
  },
  {
    role: 'engineer',
    content: 'Agree.',
    stance: 'agree',
  },
  {
    role: 'verifier',
    content: 'Agree — with the caveat that reducer tests ship first.',
    stance: 'agree',
  },
  {
    role: 'planner',
    content:
      'All agreed. Synthesising minutes: tuple-typed choices, reducer state machine, TDD on reducer before implementation.',
    stance: 'speaking',
  },
];

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  console.log('[mock] connected');

  send(ws, {
    type: 'register',
    sessionId: SESSION_ID,
    projectPath: PROJECT_PATH,
    projectName: PROJECT_NAME,
  });

  await wait(100);

  send(ws, {
    type: 'session-event',
    sessionId: SESSION_ID,
    event: { kind: 'mvp_progress', mvps: MVPS },
  });

  send(ws, {
    type: 'session-event',
    sessionId: SESSION_ID,
    event: {
      kind: 'meeting_started',
      meetingId: MEETING_ID,
      meetingType: 'design',
      topic: 'MVP-1 · Core question engine — design',
      agenda: [
        'Question data shape',
        'Reducer state transitions',
        'Test strategy before implementation',
      ],
      participants: ['planner', 'architect', 'engineer', 'verifier'],
    },
  });

  let id = 1;
  for (const c of COMMENTS) {
    await wait(80);
    send(ws, {
      type: 'session-event',
      sessionId: SESSION_ID,
      event: {
        kind: 'transcript_added',
        meetingId: MEETING_ID,
        comment: {
          id: id++,
          speakerRole: c.role,
          agendaItemIndex: 0,
          roundNumber: 1,
          content: c.content,
          stance: c.stance,
          createdAt: Date.now(),
        },
      },
    });
  }

  send(ws, {
    type: 'session-event',
    sessionId: SESSION_ID,
    event: {
      kind: 'consensus_checked',
      meetingId: MEETING_ID,
      allAgreed: true,
      stances: [
        { role: 'architect', stance: 'agree' },
        { role: 'engineer', stance: 'agree' },
        { role: 'verifier', stance: 'agree', reason: 'reducer tests ship first' },
      ],
    },
  });

  send(ws, {
    type: 'session-event',
    sessionId: SESSION_ID,
    event: {
      kind: 'minutes_finalized',
      meetingId: MEETING_ID,
      decisions: [
        'Choices typed as tuple `[ChoiceA, ChoiceB]`',
        'State owned by a reducer keyed on `{ index, answers[] }`',
        'TDD: reducer unit tests ship before any UI code',
      ],
      actionItems: [
        'Write reducer tests (happy path + edge cases)',
        'Implement reducer until tests pass',
        'Build Question component wired to reducer',
        'Playwright smoke test: 3 questions → results',
      ],
    },
  });

  send(ws, {
    type: 'session-event',
    sessionId: SESSION_ID,
    event: { kind: 'cost_update', totalCost: 0.0342 },
  });

  await wait(300);
  console.log('[mock] events sent, closing ws');
  ws.close();
}

main().catch((err) => {
  console.error('[mock] error', err);
  process.exit(1);
});
