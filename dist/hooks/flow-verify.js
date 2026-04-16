#!/usr/bin/env node

// src/hooks/flow-verify.ts
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
function tryReadFile(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function findLatestMinutesFile(minutesDir) {
  if (!existsSync(minutesDir)) return null;
  try {
    const files = readdirSync(minutesDir).filter((f) => f.endsWith(".md") && f !== "INDEX.md").sort().reverse();
    return files.length > 0 ? join(minutesDir, files[0]) : null;
  } catch {
    return null;
  }
}
function extractFlows(content) {
  const flows = [];
  const lines = content.split("\n");
  let inActionSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#+\s*.*action\s*items?/i.test(trimmed) || /^\*\*action\s*items?\*\*/i.test(trimmed)) {
      inActionSection = true;
      continue;
    }
    if (inActionSection && /^#+\s/.test(trimmed) && !/action/i.test(trimmed)) {
      inActionSection = false;
    }
    if (inActionSection && /^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+(\[.\]\s*)?/, "").trim();
      if (text && text !== "None" && text !== "No action items identified") {
        flows.push(text);
      }
    }
    if (!inActionSection && /^[-*]\s+(?:action|implement|create|build|add|fix)\b/i.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, "").trim();
      if (text) {
        flows.push(text);
      }
    }
  }
  return [...new Set(flows)];
}
function flowToKeywords(flow) {
  return flow.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2).filter((w) => !["the", "and", "for", "that", "this", "with", "from", "should", "must", "need", "will"].includes(w));
}
function findTestFiles(cwd) {
  const testFiles = [];
  const testDirs = ["test", "tests", "__tests__", "spec", "specs"];
  const testPatterns = [".test.", ".spec.", "_test.", "_spec."];
  function walk(dir, depth) {
    if (depth > 5) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          const isTest = testPatterns.some((p) => lower.includes(p)) || testDirs.some((d) => fullPath.includes(`/${d}/`));
          if (isTest) {
            testFiles.push(fullPath);
          }
        }
      }
    } catch {
    }
  }
  walk(cwd, 0);
  return testFiles;
}
function findTestsForFlow(flow, testFiles) {
  const keywords = flowToKeywords(flow);
  if (keywords.length === 0) return [];
  return testFiles.filter((testFile) => {
    const lower = testFile.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });
}
function main() {
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const minutesDir = join(homedir(), ".open-coleslaw", "minutes");
  const latestFile = findLatestMinutesFile(minutesDir);
  if (!latestFile) {
    const output2 = {
      minutesFile: null,
      flows: [],
      passCount: 0,
      failCount: 0,
      status: "no-minutes"
    };
    process.stdout.write(JSON.stringify(output2, null, 2) + "\n");
    return;
  }
  const content = tryReadFile(latestFile);
  if (!content) {
    const output2 = {
      minutesFile: latestFile,
      flows: [],
      passCount: 0,
      failCount: 0,
      status: "no-minutes"
    };
    process.stdout.write(JSON.stringify(output2, null, 2) + "\n");
    return;
  }
  const flowDescriptions = extractFlows(content);
  const testFiles = findTestFiles(cwd);
  const flows = flowDescriptions.map((flow) => {
    const matchedTests = findTestsForFlow(flow, testFiles);
    return {
      name: flow,
      hasTest: matchedTests.length > 0,
      testPaths: matchedTests
    };
  });
  const passCount = flows.filter((f) => f.hasTest).length;
  const failCount = flows.filter((f) => !f.hasTest).length;
  const output = {
    minutesFile: latestFile,
    flows,
    passCount,
    failCount,
    status: failCount > 0 ? "fail" : "pass"
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
main();
//# sourceMappingURL=flow-verify.js.map