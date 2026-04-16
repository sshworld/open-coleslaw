import { defineConfig } from 'tsup';

export default defineConfig([
  // Main MCP server entry point
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    dts: false,
    clean: true,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['better-sqlite3'],
  },
  // Standalone hook scripts (each gets its own shebang)
  {
    entry: [
      'src/hooks/pre-read.ts',
      'src/hooks/auto-route.ts',
      'src/hooks/auto-commit.ts',
      'src/hooks/doc-update.ts',
      'src/hooks/flow-verify.ts',
      'src/hooks/mvp-cycle.ts',
    ],
    outDir: 'dist/hooks',
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    dts: false,
    clean: false,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['better-sqlite3'],
  },
]);
