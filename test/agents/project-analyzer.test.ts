import { describe, it, expect } from 'vitest';
import { analyzeProject, formatProjectContext } from '../../src/agents/project-analyzer.js';

const PROJECT_DIR = '/Users/sshworld/develop/open-coleslaw';

describe('analyzeProject', () => {
  it('detects TypeScript as the primary language', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.language).toBe('typescript');
  });

  it('finds package.json with project metadata', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.packageJson).not.toBeNull();
    expect(analysis.packageJson!.name).toBeTruthy();
  });

  it('detects ESM or mixed import style (project uses ESM with some CJS config files)', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(['esm', 'mixed']).toContain(analysis.patterns.importStyle);
  });

  it('detects vitest as the test framework', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.patterns.testFramework).toBe('vitest');
  });

  it('detects tsup as the build tool', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.patterns.buildTool).toBe('tsup');
  });

  it('detects TypeScript in project structure', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.structure.hasTypescript).toBe(true);
    expect(analysis.structure.hasSrcDir).toBe(true);
    expect(analysis.structure.hasTestDir).toBe(true);
  });

  it('finds config files including tsconfig.json and vitest.config.ts', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.structure.configFiles).toContain('tsconfig.json');
    expect(analysis.structure.configFiles).toContain('vitest.config.ts');
  });

  it('returns at least one manifest (package.json)', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    expect(analysis.manifests.length).toBeGreaterThanOrEqual(1);
    const pkgManifest = analysis.manifests.find((m) => m.file === 'package.json');
    expect(pkgManifest).toBeDefined();
  });
});

describe('formatProjectContext', () => {
  it('returns a non-empty markdown string with expected sections', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    const context = formatProjectContext(analysis);

    expect(context.length).toBeGreaterThan(0);
    expect(context).toContain('## Project Context');
    expect(context).toContain('**Primary Language:** typescript');
    expect(context).toContain('### Project Structure');
    expect(context).toContain('### Detected Patterns');
    expect(context).toContain('### Key Guidance');
  });

  it('includes dependency information', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    const context = formatProjectContext(analysis);

    expect(context).toContain('### Dependencies');
  });

  it('includes detected build tool', async () => {
    const analysis = await analyzeProject(PROJECT_DIR);
    const context = formatProjectContext(analysis);

    expect(context).toContain('tsup');
  });
});
