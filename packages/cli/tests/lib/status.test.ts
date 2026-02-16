import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modules before importing
vi.mock('../../src/lib/state.js', () => ({
  readState: vi.fn(),
}));

vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('../../src/lib/roadmap.js', () => ({
  readRoadmap: vi.fn(),
  getPhaseByNumber: vi.fn(),
}));

vi.mock('../../src/lib/tasks.js', () => ({
  readTasks: vi.fn(),
}));

vi.mock('../../src/lib/context.js', () => ({
  resolveFeatureDir: vi.fn(),
  getProjectContext: vi.fn(),
}));

vi.mock('../../src/lib/health.js', () => ({
  runHealthCheck: vi.fn(),
  getQuickHealthStatus: vi.fn(),
}));

// Import after mocking
import { readState } from '../../src/lib/state.js';
import { findProjectRoot } from '../../src/lib/paths.js';
import { readRoadmap, getPhaseByNumber } from '../../src/lib/roadmap.js';
import { readTasks } from '../../src/lib/tasks.js';
import { resolveFeatureDir, getProjectContext } from '../../src/lib/context.js';
import { runHealthCheck } from '../../src/lib/health.js';
import { determineNextAction, getStatus } from '../../src/lib/status.js';

describe('determineNextAction', () => {
  it('should return fix_health when health has errors', () => {
    expect(determineNextAction('in_progress', 'implement', 'in_progress', 'error', false, true, false))
      .toBe('fix_health');
  });

  it('should return start_phase when no active phase', () => {
    expect(determineNextAction(null, null, null, 'ready', false, false, false))
      .toBe('start_phase');
  });

  it('should return start_phase when phase is not_started', () => {
    expect(determineNextAction('not_started', null, null, 'ready', false, false, false))
      .toBe('start_phase');
  });

  it('should return awaiting_user_gate when phase status is awaiting_user_gate', () => {
    expect(determineNextAction('awaiting_user_gate', 'verify', 'in_progress', 'ready', true, true, true))
      .toBe('awaiting_user_gate');
  });

  it('should return archive_phase when phase is complete', () => {
    expect(determineNextAction('complete', 'verify', 'complete', 'ready', true, true, false))
      .toBe('archive_phase');
  });

  it('should return run_design when in design step without artifacts', () => {
    expect(determineNextAction('in_progress', 'design', 'in_progress', 'ready', false, false, false))
      .toBe('run_design');
  });

  it('should return run_analyze when in design step with all artifacts', () => {
    expect(determineNextAction('in_progress', 'design', 'in_progress', 'ready', false, true, false))
      .toBe('run_analyze');
  });

  it('should return run_analyze when in analyze step', () => {
    expect(determineNextAction('in_progress', 'analyze', 'in_progress', 'ready', false, true, false))
      .toBe('run_analyze');
  });

  it('should return continue_implement when in implement step with incomplete tasks', () => {
    expect(determineNextAction('in_progress', 'implement', 'in_progress', 'ready', false, true, false))
      .toBe('continue_implement');
  });

  it('should return run_verify when in implement step with all tasks complete', () => {
    expect(determineNextAction('in_progress', 'implement', 'in_progress', 'ready', true, true, false))
      .toBe('run_verify');
  });

  it('should return awaiting_user_gate when in verify step with user gate', () => {
    expect(determineNextAction('in_progress', 'verify', 'in_progress', 'ready', true, true, true))
      .toBe('awaiting_user_gate');
  });

  it('should return ready_to_merge when in verify step without user gate', () => {
    expect(determineNextAction('in_progress', 'verify', 'in_progress', 'ready', true, true, false))
      .toBe('ready_to_merge');
  });

  it('should default to design when step is null', () => {
    expect(determineNextAction('in_progress', null, null, 'ready', false, false, false))
      .toBe('run_design');
  });

  it('should return continue_implement for unknown step values', () => {
    expect(determineNextAction('in_progress', 'unknown_step', 'in_progress', 'ready', false, true, false))
      .toBe('continue_implement');
  });
});

describe('getStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when not in a project', async () => {
    vi.mocked(findProjectRoot).mockReturnValue(null);

    const status = await getStatus();

    expect(status.health.status).toBe('error');
    expect(status.health.issues[0].code).toBe('NO_PROJECT');
    expect(status.nextAction).toBe('fix_health');
  });

  it('should return state error when state file missing', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(readState).mockRejectedValue(new Error('No state file'));

    const status = await getStatus();

    expect(status.health.status).toBe('error');
    expect(status.health.issues[0].code).toBe('NO_STATE');
    expect(status.nextAction).toBe('fix_health');
  });

  it('should aggregate phase info from state', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(readState).mockResolvedValue({
      schema_version: '3.0',
      project: { id: 'test', name: 'test', path: '/test' },
      orchestration: {
        phase: {
          number: '0010',
          name: 'test-phase',
          branch: '0010-test-phase',
          status: 'in_progress',
        },
        step: {
          current: 'implement',
          index: 2,
          status: 'in_progress',
        },
      },
      health: { status: 'ready', issues: [] },
    } as any);
    vi.mocked(readRoadmap).mockResolvedValue({
      filePath: '/test/ROADMAP.md',
      phases: [{ number: '0010', name: 'test-phase', status: 'in_progress', hasUserGate: false, line: 10 }],
      progress: { total: 1, completed: 0, percentage: 0 },
    });
    vi.mocked(getPhaseByNumber).mockReturnValue({
      number: '0010',
      name: 'test-phase',
      status: 'in_progress',
      hasUserGate: false,
      line: 10,
    });
    vi.mocked(resolveFeatureDir).mockResolvedValue('/test/specs/0010-test-phase');
    vi.mocked(getProjectContext).mockResolvedValue({
      root: '/test',
      name: 'test',
      hasState: true,
      hasRoadmap: true,
      hasMemory: true,
      hasTemplates: true,
      featureDirs: ['0010-test-phase'],
      activeFeature: {
        dir: '/test/specs/0010-test-phase',
        name: '0010-test-phase',
        phaseNumber: '0010',
        artifacts: {
          discovery: true,
          spec: true,
          requirements: true,
          plan: true,
          tasks: true,
          uiDesign: true,
        },
        isComplete: true,
      },
    });
    vi.mocked(readTasks).mockResolvedValue({
      featureDir: '/test/specs/0010-test-phase',
      filePath: '/test/specs/0010-test-phase/tasks.md',
      tasks: [],
      sections: [],
      progress: { total: 10, completed: 5, blocked: 0, deferred: 0, percentage: 50 },
    });
    vi.mocked(runHealthCheck).mockResolvedValue({
      status: 'ready',
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    });

    const status = await getStatus();

    expect(status.phase.number).toBe('0010');
    expect(status.phase.name).toBe('test-phase');
    expect(status.step.current).toBe('implement');
    expect(status.step.index).toBe(2);
    expect(status.progress.tasksCompleted).toBe(5);
    expect(status.progress.tasksTotal).toBe(10);
    expect(status.progress.percentage).toBe(50);
    expect(status.nextAction).toBe('continue_implement');
    expect(status.context.hasSpec).toBe(true);
    expect(status.context.hasPlan).toBe(true);
    expect(status.context.hasTasks).toBe(true);
  });

  it('should include blockers for blocked steps', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/test/project');
    vi.mocked(readState).mockResolvedValue({
      schema_version: '3.0',
      project: { id: 'test', name: 'test', path: '/test' },
      orchestration: {
        phase: { number: '0010', name: 'test', branch: '0010-test', status: 'in_progress' },
        step: { current: 'implement', index: 2, status: 'blocked' },
      },
    } as any);
    vi.mocked(readRoadmap).mockRejectedValue(new Error('No roadmap'));
    vi.mocked(resolveFeatureDir).mockResolvedValue(undefined);
    vi.mocked(runHealthCheck).mockResolvedValue({
      status: 'ready',
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    });

    const status = await getStatus();

    expect(status.blockers).toContain('Current step is blocked');
  });
});
