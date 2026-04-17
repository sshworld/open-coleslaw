import { describe, it, expect } from 'vitest';
import { getDepartment, getAllDepartments, getDepartmentForRole } from '../../src/agents/departments.js';

describe('getDepartment', () => {
  it('returns architecture department with correct leader role, worker types, and tools', () => {
    const arch = getDepartment('architecture');
    expect(arch.name).toBe('architecture');
    expect(arch.leaderRole).toBe('architect');
    expect(arch.workerTypes).toEqual(['schema-designer', 'api-designer', 'dependency-analyzer']);
    expect(arch.allowedTools).toEqual(['Read', 'Grep', 'Glob']);
  });

  it('returns engineering department with Write/Edit/Bash tools', () => {
    const eng = getDepartment('engineering');
    expect(eng.name).toBe('engineering');
    expect(eng.leaderRole).toBe('engineer');
    expect(eng.allowedTools).toContain('Write');
    expect(eng.allowedTools).toContain('Edit');
    expect(eng.allowedTools).toContain('Bash');
  });

  it('returns verification department', () => {
    const verification = getDepartment('verification');
    expect(verification.name).toBe('verification');
    expect(verification.leaderRole).toBe('verifier');
    expect(verification.allowedTools).toContain('Bash');
  });

  it('returns planning department', () => {
    const planning = getDepartment('planning');
    expect(planning.name).toBe('planning');
    expect(planning.leaderRole).toBe('planner');
    expect(planning.allowedTools).toContain('Read');
  });

  it('returns product department', () => {
    const product = getDepartment('product');
    expect(product.name).toBe('product');
    expect(product.leaderRole).toBe('product-manager');
  });

  it('returns research department', () => {
    const research = getDepartment('research');
    expect(research.name).toBe('research');
    expect(research.leaderRole).toBe('researcher');
    expect(research.allowedTools).toContain('WebSearch');
  });

  it('throws for unknown department', () => {
    // @ts-expect-error testing invalid input
    expect(() => getDepartment('unknown')).toThrow('Unknown department');
  });
});

describe('getAllDepartments', () => {
  it('returns all 6 departments', () => {
    const all = getAllDepartments();
    expect(all).toHaveLength(6);
    const names = all.map((d) => d.name);
    expect(names).toContain('planning');
    expect(names).toContain('architecture');
    expect(names).toContain('engineering');
    expect(names).toContain('verification');
    expect(names).toContain('product');
    expect(names).toContain('research');
  });
});

describe('getDepartmentForRole', () => {
  it('resolves architect to architecture', () => {
    expect(getDepartmentForRole('architect')).toBe('architecture');
  });

  it('resolves engineer to engineering', () => {
    expect(getDepartmentForRole('engineer')).toBe('engineering');
  });

  it('resolves verifier to verification', () => {
    expect(getDepartmentForRole('verifier')).toBe('verification');
  });

  it('resolves planner to planning', () => {
    expect(getDepartmentForRole('planner')).toBe('planning');
  });

  it('resolves pm-leader to product', () => {
    expect(getDepartmentForRole('product-manager')).toBe('product');
  });

  it('resolves researchitect to research', () => {
    expect(getDepartmentForRole('researcher')).toBe('research');
  });

  it('throws for unknown role', () => {
    // @ts-expect-error testing invalid input
    expect(() => getDepartmentForRole('unknown-role')).toThrow('Unknown leader role');
  });
});
