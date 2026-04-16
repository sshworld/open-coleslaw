#!/usr/bin/env bash
set -euo pipefail

# Open Coleslaw — Setup Hook
# Runs on first install: installs deps and builds the project.

ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "[open-coleslaw] Installing dependencies..." >&2
  npm install --production=false 2>&1 | tail -3 >&2
fi

# Build if needed
if [ ! -f "dist/index.js" ]; then
  echo "[open-coleslaw] Building..." >&2
  npx tsup 2>&1 | tail -3 >&2
fi

echo "[open-coleslaw] Setup complete" >&2
exit 0
