#!/usr/bin/env node

// src/hooks/auto-route.ts
import { createInterface } from "readline";
var RULES = [
  {
    route: "mention-response",
    skill: "mention",
    keywords: ["@mention", "mention", "respond to mention", "pending mention"]
  },
  {
    route: "status-check",
    skill: "status",
    keywords: ["status", "show status", "what is running", "active meetings", "agents"]
  },
  {
    route: "dashboard",
    skill: "dashboard",
    keywords: ["dashboard", "open dashboard", "web ui", "web dashboard"]
  },
  {
    route: "minutes",
    skill: "minutes",
    keywords: ["minutes", "meeting minutes", "show minutes", "view minutes"]
  },
  {
    route: "meeting-needed",
    skill: "meeting",
    keywords: [
      "build",
      "implement",
      "create",
      "develop",
      "design",
      "refactor",
      "add feature",
      "fix bug",
      "architecture",
      "plan",
      "meeting",
      "start meeting",
      "discuss",
      "let's meet"
    ]
  }
];
function analysePrompt(prompt) {
  const lower = prompt.toLowerCase().trim();
  if (lower.length === 0) {
    return { route: "pass-through", skill: null, reason: "Empty prompt" };
  }
  for (const rule of RULES) {
    const matched = rule.matchAll ? rule.keywords.every((kw) => lower.includes(kw)) : rule.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      const matchedKeywords = rule.keywords.filter((kw) => lower.includes(kw));
      return {
        route: rule.route,
        skill: rule.skill,
        reason: `Matched keywords: ${matchedKeywords.join(", ")}`
      };
    }
  }
  return { route: "pass-through", skill: null, reason: "No routing keywords matched" };
}
function readStdinLine() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    const rl = createInterface({ input: process.stdin });
    let firstLine = "";
    rl.on("line", (line) => {
      if (!firstLine) {
        firstLine = line;
      }
      rl.close();
    });
    rl.on("close", () => {
      resolve(firstLine);
    });
  });
}
async function main() {
  let prompt = process.env["OPEN_COLESLAW_PROMPT"] ?? "";
  if (!prompt) {
    prompt = await readStdinLine();
  }
  const result = analysePrompt(prompt);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`auto-route error: ${message}
`);
  process.stdout.write(JSON.stringify({
    route: "pass-through",
    skill: null,
    reason: `Error during routing: ${message}`
  }) + "\n");
  process.exit(0);
});
//# sourceMappingURL=auto-route.js.map