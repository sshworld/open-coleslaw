/**
 * mvp-cycle hook — standalone script.
 *
 * Checks the last flow-verify output for failures and, if found,
 * outputs a suggestion to re-convene a meeting.
 *
 * This hook is designed to be run AFTER flow-verify. It reads the
 * flow-verify output from stdin or from a file passed as an argument.
 *
 * Output (JSON to stdout):
 *   {
 *     "shouldRemeet": boolean,
 *     "reason": string,
 *     "failedFlows": string[]
 *   }
 *
 * Usage:
 *   node dist/hooks/flow-verify.js | node dist/hooks/mvp-cycle.js
 *   node dist/hooks/mvp-cycle.js <path-to-flow-verify-output.json>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowVerifyOutput {
  minutesFile: string | null;
  flows: { name: string; hasTest: boolean; testPaths: string[] }[];
  passCount: number;
  failCount: number;
  status: 'pass' | 'fail' | 'no-minutes';
}

interface MvpCycleOutput {
  shouldRemeet: boolean;
  reason: string;
  failedFlows: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readStdin(): Promise<string> {
  return new Promise((resolvePromise) => {
    if (process.stdin.isTTY) {
      resolvePromise('');
      return;
    }

    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin });

    rl.on('line', (line) => {
      chunks.push(line);
    });

    rl.on('close', () => {
      resolvePromise(chunks.join('\n'));
    });
  });
}

function parseFlowVerifyOutput(raw: string): FlowVerifyOutput | null {
  try {
    const parsed = JSON.parse(raw) as FlowVerifyOutput;
    if (typeof parsed.status !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function analyse(verifyOutput: FlowVerifyOutput): MvpCycleOutput {
  if (verifyOutput.status === 'no-minutes') {
    return {
      shouldRemeet: false,
      reason: 'No meeting minutes found — nothing to verify.',
      failedFlows: [],
    };
  }

  if (verifyOutput.status === 'pass') {
    return {
      shouldRemeet: false,
      reason: `All ${verifyOutput.passCount} flows have corresponding test files.`,
      failedFlows: [],
    };
  }

  // status === 'fail'
  const failedFlows = verifyOutput.flows
    .filter((f) => !f.hasTest)
    .map((f) => f.name);

  const total = verifyOutput.flows.length;
  const failRate = total > 0 ? ((failedFlows.length / total) * 100).toFixed(0) : '0';

  return {
    shouldRemeet: true,
    reason:
      `${failedFlows.length} of ${total} flows (${failRate}%) lack test coverage. ` +
      'Consider re-convening a meeting to discuss implementation gaps and assign missing test tasks.',
    failedFlows,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let raw = '';

  // Try reading from a file argument first
  const fileArg = process.argv[2];
  if (fileArg) {
    try {
      raw = readFileSync(resolve(fileArg), 'utf-8');
    } catch {
      // Fall through to stdin
    }
  }

  // Fall back to stdin
  if (!raw) {
    raw = await readStdin();
  }

  if (!raw.trim()) {
    const output: MvpCycleOutput = {
      shouldRemeet: false,
      reason: 'No flow-verify output provided. Run flow-verify first.',
      failedFlows: [],
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  const verifyOutput = parseFlowVerifyOutput(raw);
  if (!verifyOutput) {
    const output: MvpCycleOutput = {
      shouldRemeet: false,
      reason: 'Could not parse flow-verify output. Ensure it is valid JSON.',
      failedFlows: [],
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  const result = analyse(verifyOutput);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`mvp-cycle error: ${message}\n`);
  const fallback: MvpCycleOutput = {
    shouldRemeet: false,
    reason: `Error: ${message}`,
    failedFlows: [],
  };
  process.stdout.write(JSON.stringify(fallback, null, 2) + '\n');
  process.exit(0);
});
