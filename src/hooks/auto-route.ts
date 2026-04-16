/**
 * auto-route hook — standalone script for user-prompt-submit.
 *
 * Analyses the user prompt and outputs a routing suggestion as JSON.
 * The prompt is read from the OPEN_COLESLAW_PROMPT environment variable
 * or, as a fallback, from stdin (first line).
 *
 * Output format (JSON to stdout):
 *   { "route": "<category>", "skill": "<skill-name> | null", "reason": "<why>" }
 *
 * Categories:
 *   - meeting-needed   — prompt requires a multi-agent meeting
 *   - status-check     — user wants project / agent status
 *   - mention-response — user is responding to an @mention
 *   - dashboard        — user wants the web dashboard
 *   - minutes          — user wants to view meeting minutes
 *   - pass-through     — no special routing; let Claude Code handle normally
 *
 * Usage:
 *   OPEN_COLESLAW_PROMPT="build a login page" node dist/hooks/auto-route.js
 *   echo "build a login page" | node dist/hooks/auto-route.js
 */

import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Keyword routing rules
// ---------------------------------------------------------------------------

interface RouteRule {
  route: string;
  skill: string | null;
  keywords: string[];
  /** If true, ALL keywords must match (AND). Default is OR. */
  matchAll?: boolean;
}

const RULES: RouteRule[] = [
  {
    route: 'mention-response',
    skill: 'mention',
    keywords: ['@mention', 'mention', 'respond to mention', 'pending mention'],
  },
  {
    route: 'status-check',
    skill: 'status',
    keywords: ['status', 'show status', 'what is running', 'active meetings', 'agents'],
  },
  {
    route: 'dashboard',
    skill: 'dashboard',
    keywords: ['dashboard', 'open dashboard', 'web ui', 'web dashboard'],
  },
  {
    route: 'minutes',
    skill: 'minutes',
    keywords: ['minutes', 'meeting minutes', 'show minutes', 'view minutes'],
  },
  {
    route: 'meeting-needed',
    skill: 'meeting',
    keywords: [
      'build', 'implement', 'create', 'develop', 'design', 'refactor',
      'add feature', 'fix bug', 'architecture', 'plan', 'meeting',
      'start meeting', 'discuss', 'let\'s meet',
    ],
  },
];

// ---------------------------------------------------------------------------
// Route analysis
// ---------------------------------------------------------------------------

interface RouteResult {
  route: string;
  skill: string | null;
  reason: string;
}

function analysePrompt(prompt: string): RouteResult {
  const lower = prompt.toLowerCase().trim();

  if (lower.length === 0) {
    return { route: 'pass-through', skill: null, reason: 'Empty prompt' };
  }

  for (const rule of RULES) {
    const matched = rule.matchAll
      ? rule.keywords.every((kw) => lower.includes(kw))
      : rule.keywords.some((kw) => lower.includes(kw));

    if (matched) {
      const matchedKeywords = rule.keywords.filter((kw) => lower.includes(kw));
      return {
        route: rule.route,
        skill: rule.skill,
        reason: `Matched keywords: ${matchedKeywords.join(', ')}`,
      };
    }
  }

  return { route: 'pass-through', skill: null, reason: 'No routing keywords matched' };
}

// ---------------------------------------------------------------------------
// stdin reader helper
// ---------------------------------------------------------------------------

function readStdinLine(): Promise<string> {
  return new Promise((resolve) => {
    // If stdin is a TTY (no pipe), resolve immediately with empty string
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    const rl = createInterface({ input: process.stdin });
    let firstLine = '';

    rl.on('line', (line) => {
      if (!firstLine) {
        firstLine = line;
      }
      rl.close();
    });

    rl.on('close', () => {
      resolve(firstLine);
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Read prompt from env or stdin
  let prompt = process.env['OPEN_COLESLAW_PROMPT'] ?? '';

  if (!prompt) {
    prompt = await readStdinLine();
  }

  const result = analysePrompt(prompt);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`auto-route error: ${message}\n`);
  // Output pass-through on error so we never block the user
  process.stdout.write(JSON.stringify({
    route: 'pass-through',
    skill: null,
    reason: `Error during routing: ${message}`,
  }) + '\n');
  process.exit(0);
});
