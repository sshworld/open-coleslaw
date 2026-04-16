#!/usr/bin/env node

// src/hooks/auto-commit.ts
import { execSync } from "child_process";
import { resolve } from "path";
function exec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}
function isGitRepo(cwd) {
  const result = exec("git rev-parse --is-inside-work-tree", cwd);
  return result === "true";
}
function getStagedFiles(cwd) {
  const output = exec("git diff --cached --name-only", cwd);
  return output ? output.split("\n").filter(Boolean) : [];
}
function getUnstagedFiles(cwd) {
  const output = exec("git diff --name-only", cwd);
  return output ? output.split("\n").filter(Boolean) : [];
}
function getUntrackedFiles(cwd) {
  const output = exec("git ls-files --others --exclude-standard", cwd);
  return output ? output.split("\n").filter(Boolean) : [];
}
function inferCommitType(files) {
  const allPaths = files.join(" ").toLowerCase();
  if (files.every((f) => f.includes("test") || f.includes("spec") || f.includes("__tests__"))) {
    return "test";
  }
  if (files.every(
    (f) => f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".rst") || f.includes("docs/") || f.includes("doc/")
  )) {
    return "docs";
  }
  if (allPaths.includes("fix") || allPaths.includes("patch") || allPaths.includes("hotfix")) {
    return "fix";
  }
  if (files.every(
    (f) => f.includes("config") || f.includes(".json") || f.includes(".yaml") || f.includes(".yml") || f.includes("ci/") || f.includes(".github/") || f.includes("Makefile") || f.includes("Dockerfile")
  )) {
    return "chore";
  }
  if (allPaths.includes("refactor")) {
    return "refactor";
  }
  return "feat";
}
function inferScope(files) {
  const dirs = files.map((f) => {
    const parts = f.split("/");
    return parts.length > 1 ? parts[parts.length - 2] : null;
  }).filter((d) => d !== null);
  if (dirs.length === 0) return null;
  const unique = [...new Set(dirs)];
  if (unique.length === 1) return unique[0];
  const counts = /* @__PURE__ */ new Map();
  for (const d of dirs) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted[0] && sorted[0][1] >= dirs.length * 0.5) {
    return sorted[0][0];
  }
  return null;
}
function buildMessage(type, scope, files) {
  const scopePart = scope ? `(${scope})` : "";
  const fileCount = files.length;
  let description;
  if (fileCount === 1) {
    const fileName = files[0].split("/").pop() ?? files[0];
    description = `update ${fileName}`;
  } else {
    description = `update ${fileCount} files`;
  }
  return `${type}${scopePart}: ${description}`;
}
function main() {
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  if (!isGitRepo(cwd)) {
    process.stdout.write(
      JSON.stringify({ hasChanges: false, reason: "Not a git repository" }, null, 2) + "\n"
    );
    return;
  }
  const staged = getStagedFiles(cwd);
  const unstaged = getUnstagedFiles(cwd);
  const untracked = getUntrackedFiles(cwd);
  const allChanged = [...staged, ...unstaged, ...untracked];
  if (allChanged.length === 0) {
    process.stdout.write(
      JSON.stringify({ hasChanges: false, reason: "No changes detected" }, null, 2) + "\n"
    );
    return;
  }
  const type = inferCommitType(allChanged);
  const scope = inferScope(allChanged);
  const suggestedMessage = buildMessage(type, scope, allChanged);
  const stageCmd = "git add -A";
  const commitCmd = `git commit -m "${suggestedMessage}"`;
  const command = `${stageCmd} && ${commitCmd}`;
  const result = {
    hasChanges: true,
    staged,
    unstaged,
    untracked,
    suggestedType: type,
    suggestedMessage,
    command
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
main();
//# sourceMappingURL=auto-commit.js.map