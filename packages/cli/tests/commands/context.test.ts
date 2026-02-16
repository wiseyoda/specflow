import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/status.js', () => ({
  getStatus: vi.fn(),
}));

vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
  getMemoryDir: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('../../src/lib/output.js', () => ({
  output: vi.fn(),
  setOutputOptions: vi.fn(),
}));

vi.mock('../../src/lib/errors.js', () => ({
  handleError: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import { getStatus } from '../../src/lib/status.js';
import { findProjectRoot, getMemoryDir, pathExists } from '../../src/lib/paths.js';
import { output } from '../../src/lib/output.js';

const mockStatus = {
  phase: { number: '0010', name: 'test', branch: '0010-test', status: 'in_progress', hasUserGate: false },
  step: { current: 'implement', index: 2, status: 'in_progress' },
  progress: { tasksCompleted: 5, tasksTotal: 10, tasksBlocked: 0, percentage: 50 },
  health: { status: 'ready' as const, issues: [] },
  nextAction: 'continue_implement' as const,
  blockers: [],
  context: { featureDir: '/test/specs/0010-test', hasSpec: true, hasPlan: true, hasTasks: true },
};

describe('context command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.mocked(getStatus).mockResolvedValue(mockStatus);
  });

  it('should return status + all memory docs when memory dir exists', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(getMemoryDir).mockReturnValue('/test/project/.specify/memory');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('constitution.md')) return '# Constitution';
      if (pathStr.endsWith('tech-stack.md')) return '# Tech Stack';
      if (pathStr.endsWith('glossary.md')) return '# Glossary';
      if (pathStr.endsWith('coding-standards.md')) return '# Coding Standards';
      if (pathStr.endsWith('testing-strategy.md')) return '# Testing Strategy';
      throw new Error('File not found');
    });

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json']);

    expect(output).toHaveBeenCalledTimes(1);
    const result = vi.mocked(output).mock.calls[0][0] as any;

    expect(result.status).toEqual(mockStatus);
    expect(result.memory.constitution).toBe('# Constitution');
    expect(result.memory.techStack).toBe('# Tech Stack');
    expect(result.memory.glossary).toBe('# Glossary');
    expect(result.memory.codingStandards).toBe('# Coding Standards');
    expect(result.memory.testingStrategy).toBe('# Testing Strategy');
    expect(result.memoryDir).toBe('/test/project/.specify/memory');
  });

  it('should return null for each missing memory doc file', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(getMemoryDir).mockReturnValue('/test/project/.specify/memory');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('constitution.md')) return '# Constitution';
      throw new Error('File not found');
    });

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json']);

    const result = vi.mocked(output).mock.calls[0][0] as any;
    expect(result.memory.constitution).toBe('# Constitution');
    expect(result.memory.techStack).toBeNull();
    expect(result.memory.glossary).toBeNull();
    expect(result.memory.codingStandards).toBeNull();
    expect(result.memory.testingStrategy).toBeNull();
  });

  it('should skip memory loading with --no-memory flag', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json', '--no-memory']);

    const result = vi.mocked(output).mock.calls[0][0] as any;
    expect(result.status).toEqual(mockStatus);
    expect(result.memory).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });

  it('should only load specified keys with --memory-keys', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(getMemoryDir).mockReturnValue('/test/project/.specify/memory');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('constitution.md')) return '# Constitution';
      if (pathStr.endsWith('tech-stack.md')) return '# Tech Stack';
      throw new Error('File not found');
    });

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json', '--memory-keys', 'constitution,tech-stack']);

    const result = vi.mocked(output).mock.calls[0][0] as any;
    expect(result.memory.constitution).toBe('# Constitution');
    expect(result.memory.techStack).toBe('# Tech Stack');
    // Other keys should not be present
    expect(result.memory.glossary).toBeUndefined();
    expect(result.memory.codingStandards).toBeUndefined();
  });

  it('should handle unreadable memory files gracefully', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(getMemoryDir).mockReturnValue('/test/project/.specify/memory');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json']);

    const result = vi.mocked(output).mock.calls[0][0] as any;
    expect(result.status).toEqual(mockStatus);
    // All docs should be null, not throw
    expect(result.memory.constitution).toBeNull();
    expect(result.memory.techStack).toBeNull();
  });

  it('should return proper structure when not in a project', async () => {
    vi.mocked(getStatus).mockResolvedValue({
      phase: { number: null, name: null, branch: null, status: null, hasUserGate: false },
      step: { current: null, index: 0, status: null },
      progress: { tasksCompleted: 0, tasksTotal: 0, tasksBlocked: 0, percentage: 0 },
      health: { status: 'error', issues: [{ code: 'NO_PROJECT', severity: 'error', message: 'Not in a SpecFlow project' }] },
      nextAction: 'fix_health',
      blockers: ['Not in a SpecFlow project directory'],
      context: { featureDir: null, hasSpec: false, hasPlan: false, hasTasks: false },
    });
    vi.mocked(findProjectRoot).mockReturnValue(null);

    const { contextCommand } = await import('../../src/commands/context.js');
    await contextCommand.parseAsync(['node', 'test', '--json']);

    const result = vi.mocked(output).mock.calls[0][0] as any;
    expect(result.status.health.status).toBe('error');
    expect(result.memory).toBeNull();
    expect(result.memoryDir).toBeNull();
  });
});
