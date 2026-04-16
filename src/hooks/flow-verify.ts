/**
 * flow-verify hook — standalone script.
 *
 * Verifies PRD user flows after development by:
 * 1. Reading the latest meeting minutes from ~/.open-coleslaw/minutes/
 * 2. Extracting action items / user flows
 * 3. For each flow, checking if related test files exist
 * 4. Outputting verification status to stdout
 *
 * This is a lightweight check — it does NOT execute tests, only verifies
 * that test files exist for the identified flows.
 *
 * Output (JSON to stdout):
 *   {
 *     "minutesFile": string,
 *     "flows": [{ "name": string, "hasTest": boolean, "testPaths": string[] }],
 *     "passCount": number,
 *     "failCount": number,
 *     "status": "pass" | "fail" | "no-minutes"
 *   }
 *
 * Usage:
 *   node dist/hooks/flow-verify.js [cwd]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Find the most recent minutes file by sorting filenames (YYYY-MM-DD_NNN_ prefix).
 */
function findLatestMinutesFile(minutesDir: string): string | null {
  if (!existsSync(minutesDir)) return null;

  try {
    const files = readdirSync(minutesDir)
      .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
      .sort()
      .reverse();

    return files.length > 0 ? join(minutesDir, files[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Extract action items / user flows from minutes content.
 *
 * Looks for lines under "Action Items" sections, or lines starting with
 * "- [ ]", "- Action", "implement", "create", "build", etc.
 */
function extractFlows(content: string): string[] {
  const flows: string[] = [];
  const lines = content.split('\n');

  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect action item sections
    if (/^#+\s*.*action\s*items?/i.test(trimmed) || /^\*\*action\s*items?\*\*/i.test(trimmed)) {
      inActionSection = true;
      continue;
    }

    // End action section on next heading
    if (inActionSection && /^#+\s/.test(trimmed) && !/action/i.test(trimmed)) {
      inActionSection = false;
    }

    // Collect action items
    if (inActionSection && /^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+(\[.\]\s*)?/, '').trim();
      if (text && text !== 'None' && text !== 'No action items identified') {
        flows.push(text);
      }
    }

    // Also catch standalone "action" / "implement" / "build" / "create" lines
    if (!inActionSection && /^[-*]\s+(?:action|implement|create|build|add|fix)\b/i.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '').trim();
      if (text) {
        flows.push(text);
      }
    }
  }

  // Deduplicate
  return [...new Set(flows)];
}

/**
 * Derive search keywords from a flow description.
 */
function flowToKeywords(flow: string): string[] {
  return flow
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    // Remove extremely common words
    .filter((w) => !['the', 'and', 'for', 'that', 'this', 'with', 'from', 'should', 'must', 'need', 'will'].includes(w));
}

/**
 * Recursively find test files in the project directory.
 */
function findTestFiles(cwd: string): string[] {
  const testFiles: string[] = [];
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
  const testPatterns = ['.test.', '.spec.', '_test.', '_spec.'];

  function walk(dir: string, depth: number): void {
    if (depth > 5) return; // Limit recursion depth
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          const isTest = testPatterns.some((p) => lower.includes(p)) ||
            testDirs.some((d) => fullPath.includes(`/${d}/`));
          if (isTest) {
            testFiles.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  walk(cwd, 0);
  return testFiles;
}

/**
 * Check whether a flow has a corresponding test file.
 */
function findTestsForFlow(flow: string, testFiles: string[]): string[] {
  const keywords = flowToKeywords(flow);
  if (keywords.length === 0) return [];

  return testFiles.filter((testFile) => {
    const lower = testFile.toLowerCase();
    // At least one keyword must appear in the test file path
    return keywords.some((kw) => lower.includes(kw));
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface FlowResult {
  name: string;
  hasTest: boolean;
  testPaths: string[];
}

interface VerifyOutput {
  minutesFile: string | null;
  flows: FlowResult[];
  passCount: number;
  failCount: number;
  status: 'pass' | 'fail' | 'no-minutes';
}

function main(): void {
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const minutesDir = join(homedir(), '.open-coleslaw', 'minutes');

  // 1. Find latest minutes
  const latestFile = findLatestMinutesFile(minutesDir);

  if (!latestFile) {
    const output: VerifyOutput = {
      minutesFile: null,
      flows: [],
      passCount: 0,
      failCount: 0,
      status: 'no-minutes',
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  // 2. Read and extract flows
  const content = tryReadFile(latestFile);
  if (!content) {
    const output: VerifyOutput = {
      minutesFile: latestFile,
      flows: [],
      passCount: 0,
      failCount: 0,
      status: 'no-minutes',
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  const flowDescriptions = extractFlows(content);

  // 3. Find all test files in the project
  const testFiles = findTestFiles(cwd);

  // 4. Verify each flow
  const flows: FlowResult[] = flowDescriptions.map((flow) => {
    const matchedTests = findTestsForFlow(flow, testFiles);
    return {
      name: flow,
      hasTest: matchedTests.length > 0,
      testPaths: matchedTests,
    };
  });

  const passCount = flows.filter((f) => f.hasTest).length;
  const failCount = flows.filter((f) => !f.hasTest).length;

  const output: VerifyOutput = {
    minutesFile: latestFile,
    flows,
    passCount,
    failCount,
    status: failCount > 0 ? 'fail' : 'pass',
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
