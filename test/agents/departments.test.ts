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

  it('returns qa department', () => {
    const qa = getDepartment('qa');
    expect(qa.name).toBe('qa');
    expect(qa.leaderRole).toBe('qa');
    expect(qa.allowedTools).toContain('Bash');
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
  it('returns all 5 departments', () => {
    const all = getAllDepartments();
    expect(all).toHaveLength(5);
    const names = all.map((d) => d.name);
    expect(names).toContain('architecture');
    expect(names).toContain('engineering');
    expect(names).toContain('qa');
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

  it('resolves qa-leader to qa', () => {
    expect(getDepartmentForRole('qa')).toBe('qa');
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
