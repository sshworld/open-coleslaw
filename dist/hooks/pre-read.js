#!/usr/bin/env node

// src/hooks/pre-read.ts
import { readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
function tryReadFile(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function section(title, content) {
  return `
<!-- open-coleslaw: ${title} -->
${content}
<!-- /open-coleslaw: ${title} -->
`;
}
function main() {
  const dataDir = join(homedir(), ".open-coleslaw");
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const parts = [];
  const rules = tryReadFile(join(dataDir, "rules.md"));
  if (rules) {
    parts.push(section("rules", rules));
  }
  const guide = tryReadFile(join(dataDir, "plugin-guide.md"));
  if (guide) {
    parts.push(section("plugin-guide", guide));
  }
  const claudeMd = tryReadFile(join(cwd, "CLAUDE.md"));
  if (claudeMd) {
    parts.push(section("CLAUDE.md", claudeMd));
  }
  const readmeMd = tryReadFile(join(cwd, "README.md"));
  if (readmeMd) {
    parts.push(section("README.md", readmeMd));
  }
  if (parts.length === 0) {
    process.stdout.write("");
    return;
  }
  process.stdout.write(parts.join("\n"));
}
main();
//# sourceMappingURL=pre-read.js.map