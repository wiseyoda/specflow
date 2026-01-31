import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
}));

vi.mock('../../../src/lib/roadmap.js', () => ({
  readRoadmap: vi.fn(),
  insertPhaseRow: vi.fn(),
}));

vi.mock('../../../src/lib/phases.js', () => ({
  createPhaseDetailFile: vi.fn(),
}));

vi.mock('../../../src/lib/output.js', () => ({
  output: vi.fn(),
}));

vi.mock('../../../src/lib/errors.js', () => ({
  handleError: vi.fn((err) => { throw err; }),
  NotFoundError: class extends Error {
    constructor(msg: string) { super(msg); }
  },
  ValidationError: class extends Error {
    constructor(msg: string) { super(msg); }
  },
  StateError: class extends Error {
    constructor(msg: string) { super(msg); }
  },
}));

import { findProjectRoot } from '../../../src/lib/paths.js';
import { readRoadmap, insertPhaseRow } from '../../../src/lib/roadmap.js';
import { createPhaseDetailFile } from '../../../src/lib/phases.js';
import { output } from '../../../src/lib/output.js';
import { addAction } from '../../../src/commands/phase/add.js';

describe('phase add command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create both ROADMAP entry and phase detail file', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/project/ROADMAP.md',
      phases: [],
      progress: { total: 0, completed: 0, percentage: 0 },
    });
    vi.mocked(insertPhaseRow).mockResolvedValue({
      inserted: true,
      filePath: '/project/ROADMAP.md',
      line: 10,
    });
    vi.mocked(createPhaseDetailFile).mockResolvedValue(
      '/project/.specify/phases/0010-core-engine.md',
    );

    await addAction('0010', 'core-engine', {});

    expect(insertPhaseRow).toHaveBeenCalledWith(
      '0010', 'core-engine', 'not_started', undefined, '/project',
    );
    expect(createPhaseDetailFile).toHaveBeenCalledWith({
      phaseNumber: '0010',
      phaseName: 'core-engine',
      projectPath: '/project',
      verificationGate: undefined,
    });
    expect(output).toHaveBeenCalledWith(
      expect.objectContaining({
        phaseDetailPath: '/project/.specify/phases/0010-core-engine.md',
        phaseDetailCreated: true,
      }),
      expect.stringContaining('Added phase 0010'),
    );
  });

  it('should skip file creation with --no-file', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/project/ROADMAP.md',
      phases: [],
      progress: { total: 0, completed: 0, percentage: 0 },
    });
    vi.mocked(insertPhaseRow).mockResolvedValue({
      inserted: true,
      filePath: '/project/ROADMAP.md',
      line: 10,
    });

    await addAction('0010', 'core-engine', { file: false });

    expect(createPhaseDetailFile).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith(
      expect.objectContaining({
        phaseDetailPath: null,
        phaseDetailCreated: false,
      }),
      expect.any(String),
    );
  });

  it('should populate gate text in phase detail file', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/project/ROADMAP.md',
      phases: [],
      progress: { total: 0, completed: 0, percentage: 0 },
    });
    vi.mocked(insertPhaseRow).mockResolvedValue({
      inserted: true,
      filePath: '/project/ROADMAP.md',
      line: 10,
    });
    vi.mocked(createPhaseDetailFile).mockResolvedValue(
      '/project/.specify/phases/0020-api-poc.md',
    );

    await addAction('0020', 'api-poc', { gate: 'API returns valid data' });

    expect(createPhaseDetailFile).toHaveBeenCalledWith({
      phaseNumber: '0020',
      phaseName: 'api-poc',
      projectPath: '/project',
      verificationGate: 'API returns valid data',
    });
  });

  it('should report when file already exists', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/project/ROADMAP.md',
      phases: [],
      progress: { total: 0, completed: 0, percentage: 0 },
    });
    vi.mocked(insertPhaseRow).mockResolvedValue({
      inserted: true,
      filePath: '/project/ROADMAP.md',
      line: 10,
    });
    // createPhaseDetailFile returns null when file already exists
    vi.mocked(createPhaseDetailFile).mockResolvedValue(null);

    await addAction('0010', 'core-engine', {});

    expect(output).toHaveBeenCalledWith(
      expect.objectContaining({
        phaseDetailPath: null,
        phaseDetailCreated: false,
      }),
      expect.stringContaining('already exists'),
    );
  });

  it('should pass USER GATE text to phase detail file', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/project/ROADMAP.md',
      phases: [],
      progress: { total: 0, completed: 0, percentage: 0 },
    });
    vi.mocked(insertPhaseRow).mockResolvedValue({
      inserted: true,
      filePath: '/project/ROADMAP.md',
      line: 10,
    });
    vi.mocked(createPhaseDetailFile).mockResolvedValue(
      '/project/.specify/phases/0030-api-poc.md',
    );

    await addAction('0030', 'api-poc', {
      gate: 'API works',
      userGate: true,
    });

    expect(createPhaseDetailFile).toHaveBeenCalledWith({
      phaseNumber: '0030',
      phaseName: 'api-poc',
      projectPath: '/project',
      verificationGate: '**USER GATE**: API works',
    });
  });
});
