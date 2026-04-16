import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'go'
  | 'rust'
  | 'swift'
  | 'dart'
  | 'ruby'
  | 'csharp'
  | 'cpp'
  | 'unknown';

/** Language-agnostic dependency info extracted from any manifest file. */
export interface DependencyManifest {
  file: string;                               // e.g. "package.json", "build.gradle.kts"
  language: ProjectLanguage;
  dependencies: Record<string, string>;       // name -> version/spec
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;            // build/test/run commands
  metadata: Record<string, string>;           // language-specific extras
}

export interface ProjectAnalysis {
  /** Primary language detected. */
  language: ProjectLanguage;

  /** All dependency manifests found (can be multi-language monorepo). */
  manifests: DependencyManifest[];

  /** Parsed package.json contents, or null if not found. (Kept for backward compat.) */
  packageJson: {
    name: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
    type?: string; // "module" or "commonjs"
  } | null;

  /** High-level project structure signals. */
  structure: {
    hasTypescript: boolean;
    hasSrcDir: boolean;
    hasTestDir: boolean;
    configFiles: string[]; // tsconfig, eslint, prettier, etc.
    entryPoints: string[];
  };

  /** Detected coding patterns and tooling. */
  patterns: {
    importStyle: 'esm' | 'commonjs' | 'mixed';
    testFramework: string | null; // vitest, jest, mocha, etc.
    linter: string | null; // eslint, biome, etc.
    formatter: string | null; // prettier, biome, etc.
    buildTool: string | null; // tsup, esbuild, webpack, vite, etc.
  };

  /** Existing utility files and their named exports. */
  existingUtils: {
    file: string;
    exports: string[];
  }[];
}

// ---------------------------------------------------------------------------
// Config-file detection lists
// ---------------------------------------------------------------------------

const CONFIG_FILE_PATTERNS: string[] = [
  'tsconfig.json',
  'tsconfig.build.json',
  'tsconfig.node.json',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.cjs',
  'biome.json',
  'biome.jsonc',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.mjs',
  'rollup.config.js',
  'rollup.config.ts',
  'rollup.config.mjs',
  'tsup.config.ts',
  'tsup.config.js',
  'esbuild.config.js',
  'esbuild.config.ts',
  'jest.config.js',
  'jest.config.ts',
  'jest.config.mjs',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mts',
  '.mocharc.yml',
  '.mocharc.json',
  '.mocharc.js',
  '.babelrc',
  'babel.config.js',
  'babel.config.json',
  '.swcrc',
  'turbo.json',
  'nx.json',
];

/** Directories that commonly house reusable utility code. */
const UTIL_DIR_NAMES = ['utils', 'lib', 'helpers', 'shared', 'common'];

/** Language-specific dependency manifest files and how to parse them. */
const MANIFEST_FILES: {
  file: string;
  language: ProjectLanguage;
  parse: (content: string, projectDir: string) => Omit<DependencyManifest, 'file' | 'language'>;
}[] = [
  // -- JavaScript / TypeScript --
  {
    file: 'package.json',
    language: 'typescript', // refined later if no TS config
    parse: (content) => {
      const raw = JSON.parse(content);
      return {
        dependencies: raw.dependencies ?? {},
        devDependencies: raw.devDependencies ?? {},
        scripts: raw.scripts ?? {},
        metadata: { type: raw.type ?? 'commonjs', name: raw.name ?? '' },
      };
    },
  },
  // -- Python --
  {
    file: 'pyproject.toml',
    language: 'python',
    parse: (content) => {
      const deps: Record<string, string> = {};
      const devDeps: Record<string, string> = {};
      const scripts: Record<string, string> = {};
      // Parse [project.dependencies]
      for (const m of content.matchAll(/^\s*"([^"]+?)(?:[><=!~]+.*)?".*$/gm)) {
        deps[m[1]] = '*';
      }
      // Parse [project.scripts]
      for (const m of content.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)) {
        scripts[m[1]] = m[2];
      }
      return { dependencies: deps, devDependencies: devDeps, scripts, metadata: {} };
    },
  },
  {
    file: 'requirements.txt',
    language: 'python',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*([><=!~].*)?$/);
        if (match) deps[match[1]] = match[2]?.trim() ?? '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    },
  },
  {
    file: 'Pipfile',
    language: 'python',
    parse: (content) => {
      const deps: Record<string, string> = {};
      const inPackages = content.indexOf('[packages]');
      if (inPackages >= 0) {
        const section = content.slice(inPackages);
        for (const m of section.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)) {
          deps[m[1]] = m[2];
        }
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    },
  },
  // -- Java / Kotlin (Gradle) --
  {
    file: 'build.gradle',
    language: 'java',
    parse: (content) => {
      const deps: Record<string, string> = {};
      // implementation 'group:artifact:version'
      for (const m of content.matchAll(/(?:implementation|api|compileOnly)\s+['"]([^'"]+)['"]/g)) {
        const parts = m[1].split(':');
        if (parts.length >= 2) deps[`${parts[0]}:${parts[1]}`] = parts[2] ?? '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: 'gradle' } };
    },
  },
  {
    file: 'build.gradle.kts',
    language: 'kotlin',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/(?:implementation|api|compileOnly)\s*\(\s*"([^"]+)"\s*\)/g)) {
        const parts = m[1].split(':');
        if (parts.length >= 2) deps[`${parts[0]}:${parts[1]}`] = parts[2] ?? '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: 'gradle-kts' } };
    },
  },
  {
    file: 'pom.xml',
    language: 'java',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>(?:\s*<version>([^<]+)<\/version>)?/gs)) {
        deps[`${m[1]}:${m[2]}`] = m[3] ?? '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: 'maven' } };
    },
  },
  // -- Go --
  {
    file: 'go.mod',
    language: 'go',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/^\s+(\S+)\s+(v[\d.]+\S*)/gm)) {
        deps[m[1]] = m[2];
      }
      const moduleMatch = content.match(/^module\s+(\S+)/m);
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { module: moduleMatch?.[1] ?? '' } };
    },
  },
  // -- Rust --
  {
    file: 'Cargo.toml',
    language: 'rust',
    parse: (content) => {
      const deps: Record<string, string> = {};
      const devDeps: Record<string, string> = {};
      let inDeps = false;
      let inDevDeps = false;
      for (const line of content.split('\n')) {
        if (line.match(/^\[dependencies\]/)) { inDeps = true; inDevDeps = false; continue; }
        if (line.match(/^\[dev-dependencies\]/)) { inDevDeps = true; inDeps = false; continue; }
        if (line.match(/^\[/)) { inDeps = false; inDevDeps = false; continue; }
        const m = line.match(/^(\w[\w-]*)\s*=\s*"([^"]+)"/);
        if (m) {
          if (inDeps) deps[m[1]] = m[2];
          if (inDevDeps) devDeps[m[1]] = m[2];
        }
      }
      return { dependencies: deps, devDependencies: devDeps, scripts: {}, metadata: {} };
    },
  },
  // -- Swift --
  {
    file: 'Package.swift',
    language: 'swift',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/\.package\s*\(\s*url:\s*"([^"]+)"/g)) {
        const name = m[1].split('/').pop()?.replace('.git', '') ?? m[1];
        deps[name] = '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    },
  },
  // -- Dart / Flutter --
  {
    file: 'pubspec.yaml',
    language: 'dart',
    parse: (content) => {
      const deps: Record<string, string> = {};
      let inDeps = false;
      for (const line of content.split('\n')) {
        if (line.match(/^dependencies:/)) { inDeps = true; continue; }
        if (line.match(/^\S/) && inDeps) { inDeps = false; continue; }
        if (inDeps) {
          const m = line.match(/^\s+(\w[\w_-]*):\s*(.+)?/);
          if (m) deps[m[1]] = m[2]?.trim() ?? '*';
        }
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    },
  },
  // -- Ruby --
  {
    file: 'Gemfile',
    language: 'ruby',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/gem\s+['"]([^'"]+)['"]/g)) {
        deps[m[1]] = '*';
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    },
  },
  // -- C# / .NET --
  {
    file: '*.csproj', // handled specially in the scanner
    language: 'csharp',
    parse: (content) => {
      const deps: Record<string, string> = {};
      for (const m of content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)) {
        deps[m[1]] = m[2];
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: 'dotnet' } };
    },
  },
];

/** Detect project language from found manifests. */
function detectLanguage(projectDir: string, manifests: DependencyManifest[]): ProjectLanguage {
  if (manifests.length === 0) return 'unknown';

  // If there's a tsconfig, it's TypeScript regardless
  if (existsSync(join(projectDir, 'tsconfig.json'))) return 'typescript';

  // Use the first manifest's language as primary
  const languages = manifests.map((m) => m.language);
  if (languages.includes('typescript')) return 'typescript';
  if (languages.includes('kotlin')) return 'kotlin';

  return languages[0];
}

/** Scan for all dependency manifests in a project. */
function scanManifests(projectDir: string): DependencyManifest[] {
  const results: DependencyManifest[] = [];

  for (const spec of MANIFEST_FILES) {
    // Handle glob pattern (*.csproj)
    if (spec.file.includes('*')) {
      const ext = spec.file.replace('*', '');
      try {
        const entries = readdirSync(projectDir);
        for (const entry of entries) {
          if (entry.endsWith(ext)) {
            const content = readFileSync(join(projectDir, entry), 'utf-8');
            try {
              const parsed = spec.parse(content, projectDir);
              results.push({ file: entry, language: spec.language, ...parsed });
            } catch { /* skip malformed */ }
          }
        }
      } catch { /* skip */ }
      continue;
    }

    const filePath = join(projectDir, spec.file);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = spec.parse(content, projectDir);
      results.push({ file: spec.file, language: spec.language, ...parsed });
    } catch {
      logger.debug(`Failed to parse manifest: ${spec.file}`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe(filePath: string): unknown | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Collect named exports from a .ts or .js file using lightweight regex. */
function extractExports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const exports: string[] = [];

    // export function foo
    for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    // export class Foo
    for (const m of content.matchAll(/export\s+class\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    // export const/let/var foo
    for (const m of content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    // export interface Foo / export type Foo
    for (const m of content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    // export enum Foo
    for (const m of content.matchAll(/export\s+enum\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    // export default (just record "default")
    if (/export\s+default\s/.test(content)) {
      exports.push('default');
    }

    return [...new Set(exports)];
  } catch {
    return [];
  }
}

/** Sample up to N .ts/.js files from a directory tree (non-recursive beyond 2 levels). */
function sampleSourceFiles(dir: string, max: number): string[] {
  const results: string[] = [];
  const extensions = new Set(['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs']);

  function walk(currentDir: string, depth: number): void {
    if (depth > 2 || results.length >= max) return;
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= max) return;
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
      const full = join(currentDir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1);
        } else if (stat.isFile() && extensions.has(extname(entry))) {
          results.push(full);
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  walk(dir, 0);
  return results;
}

/** Detect import style by scanning a few source files. */
function detectImportStyle(
  projectDir: string,
  packageType: string | undefined,
): 'esm' | 'commonjs' | 'mixed' {
  const sourceDir = existsSync(join(projectDir, 'src'))
    ? join(projectDir, 'src')
    : projectDir;

  const files = sampleSourceFiles(sourceDir, 10);
  let esmCount = 0;
  let cjsCount = 0;

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (/\bimport\s+/.test(content) || /\bexport\s+/.test(content)) {
        esmCount++;
      }
      if (/\brequire\s*\(/.test(content) || /\bmodule\.exports\b/.test(content)) {
        cjsCount++;
      }
    } catch {
      // skip
    }
  }

  // If we have no signal from files, fall back to package.json "type"
  if (esmCount === 0 && cjsCount === 0) {
    return packageType === 'module' ? 'esm' : 'commonjs';
  }

  if (esmCount > 0 && cjsCount > 0) return 'mixed';
  if (esmCount > 0) return 'esm';
  return 'commonjs';
}

function detectTestFramework(deps: Record<string, string>): string | null {
  const candidates: [string, string][] = [
    ['vitest', 'vitest'],
    ['jest', 'jest'],
    ['@jest/core', 'jest'],
    ['mocha', 'mocha'],
    ['ava', 'ava'],
    ['tap', 'tap'],
    ['uvu', 'uvu'],
  ];
  for (const [pkg, name] of candidates) {
    if (pkg in deps) return name;
  }
  return null;
}

function detectLinter(deps: Record<string, string>, configFiles: string[]): string | null {
  if ('biome' in deps || '@biomejs/biome' in deps || configFiles.some((f) => f.startsWith('biome.'))) {
    return 'biome';
  }
  if ('eslint' in deps || configFiles.some((f) => f.includes('eslint'))) {
    return 'eslint';
  }
  return null;
}

function detectFormatter(deps: Record<string, string>, configFiles: string[]): string | null {
  // Biome also formats — if it is the linter and prettier is absent, biome is the formatter
  if ('prettier' in deps || configFiles.some((f) => f.includes('prettier'))) {
    return 'prettier';
  }
  if ('biome' in deps || '@biomejs/biome' in deps || configFiles.some((f) => f.startsWith('biome.'))) {
    return 'biome';
  }
  return null;
}

function detectBuildTool(
  deps: Record<string, string>,
  scripts: Record<string, string>,
): string | null {
  const candidates: [string, string][] = [
    ['tsup', 'tsup'],
    ['esbuild', 'esbuild'],
    ['vite', 'vite'],
    ['webpack', 'webpack'],
    ['rollup', 'rollup'],
    ['@swc/core', 'swc'],
    ['turbopack', 'turbopack'],
    ['parcel', 'parcel'],
  ];

  for (const [pkg, name] of candidates) {
    if (pkg in deps) return name;
  }

  // Fallback: check build script content
  const buildScript = scripts['build'] ?? '';
  for (const [, name] of candidates) {
    if (buildScript.includes(name)) return name;
  }

  // tsc-only builds
  if (buildScript.includes('tsc')) return 'tsc';

  return null;
}

function detectEntryPoints(
  projectDir: string,
  packageJson: ProjectAnalysis['packageJson'],
): string[] {
  const entries: string[] = [];

  if (packageJson) {
    // "main" field
    const raw = readJsonSafe(join(projectDir, 'package.json')) as Record<string, unknown> | null;
    if (raw) {
      if (typeof raw['main'] === 'string') entries.push(raw['main']);
      if (typeof raw['module'] === 'string') entries.push(raw['module']);
      if (raw['exports'] && typeof raw['exports'] === 'object') {
        const exp = raw['exports'] as Record<string, unknown>;
        // Check "." entry
        const dot = exp['.'];
        if (typeof dot === 'string') {
          entries.push(dot);
        } else if (dot && typeof dot === 'object') {
          const dotObj = dot as Record<string, unknown>;
          if (typeof dotObj['import'] === 'string') entries.push(dotObj['import']);
          if (typeof dotObj['require'] === 'string') entries.push(dotObj['require']);
        }
      }
    }
  }

  // Common default entry points
  const commonEntries = ['src/index.ts', 'src/main.ts', 'src/index.js', 'src/main.js', 'index.ts', 'index.js'];
  for (const candidate of commonEntries) {
    if (existsSync(join(projectDir, candidate)) && !entries.includes(candidate)) {
      entries.push(candidate);
    }
  }

  return [...new Set(entries)];
}

/** Collect utility files from well-known directories under src/. */
function collectUtilFiles(projectDir: string): ProjectAnalysis['existingUtils'] {
  const results: ProjectAnalysis['existingUtils'] = [];
  const srcDir = join(projectDir, 'src');
  const extensions = new Set(['.ts', '.js', '.mts', '.mjs']);

  for (const dirName of UTIL_DIR_NAMES) {
    const utilDir = join(srcDir, dirName);
    if (!existsSync(utilDir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(utilDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const ext = extname(entry);
      if (!extensions.has(ext)) continue;
      // Skip index files — they are typically re-exports
      if (basename(entry, ext) === 'index') continue;

      const filePath = join(utilDir, entry);
      try {
        if (!statSync(filePath).isFile()) continue;
      } catch {
        continue;
      }

      const exports = extractExports(filePath);
      if (exports.length > 0) {
        // Store a relative path from projectDir for readability
        const relPath = filePath.slice(projectDir.length + 1);
        results.push({ file: relPath, exports });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a project directory and return structured metadata about its
 * dependencies, tooling, patterns, and existing utilities.
 *
 * This is intentionally lightweight (no AST parsing, limited FS traversal)
 * so it can run before every meeting without noticeable delay.
 */
export async function analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
  logger.debug(`Analyzing project: ${projectDir}`);

  // 1. Read package.json
  let packageJson: ProjectAnalysis['packageJson'] = null;
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    const raw = readJsonSafe(pkgPath) as Record<string, unknown> | null;
    if (raw) {
      packageJson = {
        name: (raw['name'] as string) ?? '',
        dependencies: (raw['dependencies'] as Record<string, string>) ?? {},
        devDependencies: (raw['devDependencies'] as Record<string, string>) ?? {},
        scripts: (raw['scripts'] as Record<string, string>) ?? {},
        type: raw['type'] as string | undefined,
      };
    }
  }

  // 2. Detect config files
  const configFiles: string[] = [];
  for (const pattern of CONFIG_FILE_PATTERNS) {
    if (existsSync(join(projectDir, pattern))) {
      configFiles.push(pattern);
    }
  }

  // 3. Structure
  const hasTypescript =
    existsSync(join(projectDir, 'tsconfig.json')) ||
    configFiles.some((f) => f.startsWith('tsconfig'));
  const hasSrcDir = existsSync(join(projectDir, 'src'));
  const hasTestDir =
    existsSync(join(projectDir, 'test')) ||
    existsSync(join(projectDir, 'tests')) ||
    existsSync(join(projectDir, '__tests__'));
  const entryPoints = detectEntryPoints(projectDir, packageJson);

  const structure: ProjectAnalysis['structure'] = {
    hasTypescript,
    hasSrcDir,
    hasTestDir,
    configFiles,
    entryPoints,
  };

  // 4. All deps combined for detection
  const allDeps: Record<string, string> = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  // 5. Patterns
  const patterns: ProjectAnalysis['patterns'] = {
    importStyle: detectImportStyle(projectDir, packageJson?.type),
    testFramework: detectTestFramework(allDeps),
    linter: detectLinter(allDeps, configFiles),
    formatter: detectFormatter(allDeps, configFiles),
    buildTool: detectBuildTool(allDeps, packageJson?.scripts ?? {}),
  };

  // 6. Existing utility files
  const existingUtils = collectUtilFiles(projectDir);

  // 7. Scan all language-specific manifests
  const manifests = scanManifests(projectDir);

  // 8. Detect primary language
  const language = detectLanguage(projectDir, manifests);

  logger.debug(`Project analysis complete: ${packageJson?.name ?? '(unnamed)'}, language: ${language}, manifests: ${manifests.length}`, {
    department: 'research',
  });

  return {
    language,
    manifests,
    packageJson,
    structure,
    patterns,
    existingUtils,
  };
}

/**
 * Format a {@link ProjectAnalysis} into a Markdown summary suitable for
 * injection into agent system prompts.
 */
export function formatProjectContext(analysis: ProjectAnalysis): string {
  const sections: string[] = [];

  // Header
  sections.push('## Project Context');
  sections.push('');
  sections.push(`**Primary Language:** ${analysis.language}`);
  sections.push('');

  // Multi-language manifests (non-JS)
  const nonJsManifests = analysis.manifests.filter((m) => m.file !== 'package.json');
  if (nonJsManifests.length > 0) {
    sections.push('### Dependency Manifests');
    for (const manifest of nonJsManifests) {
      sections.push(`#### ${manifest.file} (${manifest.language})`);
      const depNames = Object.keys(manifest.dependencies);
      if (depNames.length > 0) {
        sections.push(depNames.slice(0, 30).map((d) => `- \`${d}\`: ${manifest.dependencies[d]}`).join('\n'));
        if (depNames.length > 30) sections.push(`- ... and ${depNames.length - 30} more`);
      }
      if (Object.keys(manifest.metadata).length > 0) {
        sections.push(`- Metadata: ${JSON.stringify(manifest.metadata)}`);
      }
      sections.push('');
    }
  }

  // Package info (JS/TS — backward compat)
  if (analysis.packageJson) {
    const pkg = analysis.packageJson;
    sections.push(`**Project:** ${pkg.name || '(unnamed)'}`);
    sections.push(`**Module system:** ${pkg.type ?? 'commonjs (default)'}`);
    sections.push('');

    // Dependencies
    const depNames = Object.keys(pkg.dependencies);
    if (depNames.length > 0) {
      sections.push('### Dependencies');
      sections.push(depNames.map((d) => `- \`${d}\`: ${pkg.dependencies[d]}`).join('\n'));
      sections.push('');
    }

    const devDepNames = Object.keys(pkg.devDependencies);
    if (devDepNames.length > 0) {
      sections.push('### Dev Dependencies');
      sections.push(devDepNames.map((d) => `- \`${d}\`: ${pkg.devDependencies[d]}`).join('\n'));
      sections.push('');
    }

    // Scripts
    const scriptEntries = Object.entries(pkg.scripts);
    if (scriptEntries.length > 0) {
      sections.push('### Scripts');
      sections.push(scriptEntries.map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n'));
      sections.push('');
    }
  } else {
    sections.push('*No package.json found.*');
    sections.push('');
  }

  // Structure
  sections.push('### Project Structure');
  sections.push(`- TypeScript: ${analysis.structure.hasTypescript ? 'yes' : 'no'}`);
  sections.push(`- src/ directory: ${analysis.structure.hasSrcDir ? 'yes' : 'no'}`);
  sections.push(`- Test directory: ${analysis.structure.hasTestDir ? 'yes' : 'no'}`);
  if (analysis.structure.entryPoints.length > 0) {
    sections.push(`- Entry points: ${analysis.structure.entryPoints.map((e) => `\`${e}\``).join(', ')}`);
  }
  if (analysis.structure.configFiles.length > 0) {
    sections.push(`- Config files: ${analysis.structure.configFiles.map((f) => `\`${f}\``).join(', ')}`);
  }
  sections.push('');

  // Patterns
  sections.push('### Detected Patterns');
  sections.push(`- Import style: **${analysis.patterns.importStyle}**`);
  sections.push(`- Test framework: ${analysis.patterns.testFramework ?? 'none detected'}`);
  sections.push(`- Linter: ${analysis.patterns.linter ?? 'none detected'}`);
  sections.push(`- Formatter: ${analysis.patterns.formatter ?? 'none detected'}`);
  sections.push(`- Build tool: ${analysis.patterns.buildTool ?? 'none detected'}`);
  sections.push('');

  // Existing utilities
  if (analysis.existingUtils.length > 0) {
    sections.push('### Existing Utilities (reuse before creating new ones)');
    for (const util of analysis.existingUtils) {
      sections.push(`- **\`${util.file}\`**: ${util.exports.map((e) => `\`${e}\``).join(', ')}`);
    }
    sections.push('');
  }

  // Key guidance
  sections.push('### Key Guidance');
  if (analysis.patterns.importStyle === 'esm') {
    sections.push('- Use ESM imports (`import`/`export`). Use `.js` extensions in relative imports if TypeScript with bundler resolution.');
  } else if (analysis.patterns.importStyle === 'commonjs') {
    sections.push('- Use CommonJS (`require`/`module.exports`).');
  } else {
    sections.push('- Mixed import styles detected. Prefer the dominant style in the module you are editing.');
  }
  if (analysis.packageJson) {
    sections.push('- Do NOT run `npm install` for packages already listed in dependencies or devDependencies.');
  }
  if (analysis.patterns.testFramework) {
    sections.push(`- Write tests using **${analysis.patterns.testFramework}** (already installed).`);
  }
  if (analysis.patterns.buildTool) {
    sections.push(`- Build with **${analysis.patterns.buildTool}** (already configured).`);
  }

  return sections.join('\n');
}
