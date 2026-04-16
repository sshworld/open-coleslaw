import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import type { AgentConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvokeOptions {
  prompt: string;
  systemPrompt: string;
  allowedTools: string[];
  maxTurns: number;
  maxBudgetUsd?: number;
  cwd?: string;
  /** Timeout in milliseconds. Defaults to 300_000 (5 min). */
  timeoutMs?: number;
}

export interface InvokeResult {
  success: boolean;
  output: string;
  error?: string;
  costUsd?: number;
}

// ---------------------------------------------------------------------------
// Mock mode detection
// ---------------------------------------------------------------------------

let _claudeAvailable: boolean | null = null;

/**
 * Check whether the `claude` CLI binary is available on PATH.
 * Result is cached after the first check.
 */
function isClaudeAvailable(): boolean {
  if (_claudeAvailable !== null) return _claudeAvailable;

  try {
    execSync('which claude', { stdio: 'ignore' });
    _claudeAvailable = true;
  } catch {
    _claudeAvailable = false;
  }
  return _claudeAvailable;
}

/**
 * Returns `true` when mock mode is active.
 *
 * Mock mode is enabled when:
 * - The environment variable `COLESLAW_MOCK=1` is set, OR
 * - The `claude` CLI is not found on PATH.
 */
export function isMockMode(): boolean {
  if (process.env['COLESLAW_MOCK'] === '1') return true;
  return !isClaudeAvailable();
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

/**
 * Returns a mock response that is deterministic based on the prompt content.
 * Used when Claude CLI is unavailable or when COLESLAW_MOCK=1 is set.
 */
async function invokeMock(options: InvokeOptions): Promise<InvokeResult> {
  // Tiny delay to simulate async work
  await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 70));

  const lower = options.prompt.toLowerCase();

  let output: string;
  if (lower.includes('opening') || lower.includes('initial position')) {
    output =
      '[Mock] Acknowledged the agenda. From my department perspective, I see several important considerations. ' +
      'We should ensure proper separation of concerns and define clear boundaries. ' +
      'Key concern: we must avoid tight coupling between new and existing components.';
  } else if (lower.includes('synthesis') || lower.includes('final position')) {
    output =
      '[Mock] FINAL POSITION: I support the agreed approach. Action items for my department: ' +
      '(1) Deliver the agreed outputs, (2) Coordinate with dependent departments, ' +
      '(3) Report completion status once done.';
  } else if (lower.includes('discussion') || lower.includes('perspective')) {
    output =
      '[Mock] Building on the previous points, I propose we move forward with the discussed approach. ' +
      'This aligns with existing patterns and allows parallel work across departments. ' +
      'I can have my team start on the deliverables immediately.';
  } else if (lower.includes('schema') || lower.includes('design')) {
    output =
      '[Mock] Schema analysis complete. Proposed 3 tables with proper foreign-key relationships and indexes. ' +
      'No circular dependencies detected.';
  } else if (lower.includes('test')) {
    output =
      '[Mock] Test suite generated: 8 unit tests, 2 integration tests. All assertions use strict equality. ' +
      'Coverage target: 90%.';
  } else if (lower.includes('implement') || lower.includes('build') || lower.includes('feature')) {
    output =
      '[Mock] Implementation complete. Created 2 new files, modified 1 existing file. ' +
      'All changes follow project conventions.';
  } else if (lower.includes('research') || lower.includes('explore')) {
    output =
      '[Mock] Research complete. Found 5 relevant code references and 2 documentation entries. ' +
      'Summary provided in structured format.';
  } else if (lower.includes('security') || lower.includes('audit')) {
    output =
      '[Mock] Security audit complete. No critical vulnerabilities found. ' +
      '1 advisory: ensure input validation on user-facing endpoints.';
  } else if (lower.includes('fix') || lower.includes('bug')) {
    output =
      '[Mock] Bug fix applied. Root cause identified and corrected. Fix verified with regression test.';
  } else {
    output = '[Mock] Task completed successfully. Output ready for review.';
  }

  return {
    success: true,
    output,
    costUsd: 0,
  };
}

// ---------------------------------------------------------------------------
// Real Claude CLI invocation
// ---------------------------------------------------------------------------

/**
 * Spawn the `claude` CLI as a subprocess and collect its output.
 *
 * The CLI is invoked in non-interactive `--print` mode with JSON output
 * format, a custom system prompt, tool restrictions, and turn limits.
 */
async function invokeReal(options: InvokeOptions): Promise<InvokeResult> {
  const {
    prompt,
    systemPrompt,
    allowedTools,
    maxTurns,
    maxBudgetUsd,
    cwd,
    timeoutMs = 300_000,
  } = options;

  const args: string[] = [
    '--print',
    '--output-format', 'json',
    '--system-prompt', systemPrompt,
    '--max-turns', String(maxTurns),
    '--no-session-persistence',
  ];

  if (allowedTools.length > 0) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  if (maxBudgetUsd !== undefined) {
    args.push('--max-budget', String(maxBudgetUsd));
  }

  // The prompt is the final positional argument
  args.push(prompt);

  logger.info('Invoking Claude CLI', {
    maxTurns: maxTurns as unknown as string,
    toolCount: allowedTools.length as unknown as string,
  });

  return new Promise<InvokeResult>((resolve) => {
    const child = spawn('claude', args, {
      cwd: cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    // Timeout guard
    const timer = setTimeout(() => {
      logger.warn('Claude CLI timed out, killing process', { timeoutMs: timeoutMs as unknown as string });
      child.kill('SIGTERM');
      // Give it a moment to clean up, then force-kill
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5_000);
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);

      const rawStdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const rawStderr = Buffer.concat(stderrChunks).toString('utf-8');

      if (code !== 0) {
        logger.error('Claude CLI exited with non-zero code', {
          exitCode: String(code),
        });
        resolve({
          success: false,
          output: '',
          error: rawStderr || `Claude CLI exited with code ${code}`,
        });
        return;
      }

      // Try to parse JSON output from the CLI
      const parsed = parseCliOutput(rawStdout);

      logger.info('Claude CLI invocation completed', {
        outputLength: String(parsed.output.length),
      });

      resolve(parsed);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      logger.error('Failed to spawn Claude CLI', { error: err.message });
      resolve({
        success: false,
        output: '',
        error: `Failed to spawn Claude CLI: ${err.message}`,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

interface CliJsonOutput {
  result?: string;
  output?: string;
  cost_usd?: number;
  is_error?: boolean;
  error?: string;
}

/**
 * Parse the JSON (or plain-text) output from the Claude CLI.
 *
 * The `--output-format json` flag produces a JSON object. If parsing fails
 * we fall back to treating the raw text as the output.
 */
function parseCliOutput(raw: string): InvokeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { success: false, output: '', error: 'Empty output from Claude CLI' };
  }

  try {
    const json = JSON.parse(trimmed) as CliJsonOutput;

    if (json.is_error || json.error) {
      return {
        success: false,
        output: json.result ?? json.output ?? '',
        error: json.error ?? 'Unknown CLI error',
        costUsd: json.cost_usd,
      };
    }

    return {
      success: true,
      output: json.result ?? json.output ?? trimmed,
      costUsd: json.cost_usd,
    };
  } catch {
    // Not valid JSON — treat as raw text output
    return {
      success: true,
      output: trimmed,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Invoke Claude to process a prompt.
 *
 * When `COLESLAW_MOCK=1` is set or the `claude` CLI is not available on PATH,
 * this automatically falls back to a mock implementation with a warning log.
 */
export async function invokeClaude(options: InvokeOptions): Promise<InvokeResult> {
  if (isMockMode()) {
    if (!isClaudeAvailable()) {
      logger.warn('Claude CLI not found on PATH — using mock mode');
    } else {
      logger.info('COLESLAW_MOCK=1 set — using mock mode');
    }
    return invokeMock(options);
  }

  return invokeReal(options);
}

/**
 * Build InvokeOptions from an AgentConfig, a user prompt, and a system prompt.
 *
 * This is a convenience helper that maps the AgentConfig fields into the
 * shape expected by `invokeClaude`.
 */
export function buildInvokeOptions(
  config: AgentConfig,
  prompt: string,
  systemPrompt: string,
  cwd?: string,
): InvokeOptions {
  return {
    prompt,
    systemPrompt,
    allowedTools: config.allowedTools,
    maxTurns: config.maxTurns,
    maxBudgetUsd: config.maxBudgetUsd,
    cwd,
  };
}
