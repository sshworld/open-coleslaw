import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppConfig {
  /** Root data directory: ~/.open-coleslaw/ */
  DATA_DIR: string;
  /** SQLite database path: ~/.open-coleslaw/data.db */
  DB_PATH: string;
  /** Directory for meeting minutes files: ~/.open-coleslaw/minutes/ */
  MINUTES_DIR: string;
  /** WebSocket dashboard port */
  DASHBOARD_PORT: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function buildConfig(): AppConfig {
  const DATA_DIR = join(homedir(), '.open-coleslaw');
  return {
    DATA_DIR,
    DB_PATH: join(DATA_DIR, 'data.db'),
    MINUTES_DIR: join(DATA_DIR, 'minutes'),
    DASHBOARD_PORT: 35143,
  };
}

// Singleton — computed once, reused thereafter.
let _config: AppConfig | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the runtime configuration.
 *
 * Values are derived from well-known paths under `~/.open-coleslaw/`.
 * The config object is created once and cached for the lifetime of the process.
 */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

/**
 * Ensure all required data directories exist (creates them recursively if missing).
 *
 * Call this once during server startup before any storage or file I/O.
 */
export function ensureDataDirs(): void {
  const config = getConfig();
  mkdirSync(config.DATA_DIR, { recursive: true });
  mkdirSync(config.MINUTES_DIR, { recursive: true });
}
