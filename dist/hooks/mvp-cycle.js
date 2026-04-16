#!/usr/bin/env node

// src/hooks/mvp-cycle.ts
import { readFileSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";
function readStdin() {
  return new Promise((resolvePromise) => {
    if (process.stdin.isTTY) {
      resolvePromise("");
      return;
    }
    const chunks = [];
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      chunks.push(line);
    });
    rl.on("close", () => {
      resolvePromise(chunks.join("\n"));
    });
  });
}
function parseFlowVerifyOutput(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.status !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
function analyse(verifyOutput) {
  if (verifyOutput.status === "no-minutes") {
    return {
      shouldRemeet: false,
      reason: "No meeting minutes found \u2014 nothing to verify.",
      failedFlows: []
    };
  }
  if (verifyOutput.status === "pass") {
    return {
      shouldRemeet: false,
      reason: `All ${verifyOutput.passCount} flows have corresponding test files.`,
      failedFlows: []
    };
  }
  const failedFlows = verifyOutput.flows.filter((f) => !f.hasTest).map((f) => f.name);
  const total = verifyOutput.flows.length;
  const failRate = total > 0 ? (failedFlows.length / total * 100).toFixed(0) : "0";
  return {
    shouldRemeet: true,
    reason: `${failedFlows.length} of ${total} flows (${failRate}%) lack test coverage. Consider re-convening a meeting to discuss implementation gaps and assign missing test tasks.`,
    failedFlows
  };
}
async function main() {
  let raw = "";
  const fileArg = process.argv[2];
  if (fileArg) {
    try {
      raw = readFileSync(resolve(fileArg), "utf-8");
    } catch {
    }
  }
  if (!raw) {
    raw = await readStdin();
  }
  if (!raw.trim()) {
    const output = {
      shouldRemeet: false,
      reason: "No flow-verify output provided. Run flow-verify first.",
      failedFlows: []
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return;
  }
  const verifyOutput = parseFlowVerifyOutput(raw);
  if (!verifyOutput) {
    const output = {
      shouldRemeet: false,
      reason: "Could not parse flow-verify output. Ensure it is valid JSON.",
      failedFlows: []
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return;
  }
  const result = analyse(verifyOutput);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`mvp-cycle error: ${message}
`);
  const fallback = {
    shouldRemeet: false,
    reason: `Error: ${message}`,
    failedFlows: []
  };
  process.stdout.write(JSON.stringify(fallback, null, 2) + "\n");
  process.exit(0);
});
//# sourceMappingURL=mvp-cycle.js.map