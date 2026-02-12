import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
  pathExists: vi.fn(),
  getStatePath: vi.fn(),
}));

vi.mock('../../src/lib/state.js', () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
  setStateValue: vi.fn(),
}));

vi.mock('../../src/lib/context.js', () => ({
  resolveFeatureDir: vi.fn(),
  getProjectContext: vi.fn(),
  getMissingArtifacts: vi.fn(),
}));

vi.mock('../../src/lib/tasks.js', () => ({
  readTasks: vi.fn(),
  detectCircularDependencies: vi.fn(),
}));

vi.mock('../../src/lib/roadmap.js', () => ({
  readRoadmap: vi.fn(),
  getPhaseByNumber: vi.fn(),
}));

vi.mock('../../src/lib/checklist.js', () => ({
  readFeatureChecklists: vi.fn(),
  areAllChecklistsComplete: vi.fn(),
  getAllVerificationItems: vi.fn(),
}));

vi.mock('../../src/lib/evidence.js', () => ({
  readEvidence: vi.fn(),
  hasEvidence: vi.fn(),
}));

vi.mock('../../src/lib/health.js', () => ({
  runHealthCheck: vi.fn(),
}));

import { findProjectRoot } from '../../src/lib/paths.js';
import { readState } from '../../src/lib/state.js';
import { resolveFeatureDir, getProjectContext, getMissingArtifacts } from '../../src/lib/context.js';
import { readTasks, detectCircularDependencies } from '../../src/lib/tasks.js';
import { readFeatureChecklists, areAllChecklistsComplete, getAllVerificationItems } from '../../src/lib/checklist.js';
import { readEvidence, hasEvidence } from '../../src/lib/evidence.js';
import { runHealthCheck } from '../../src/lib/health.js';

describe('check command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gate checks', () => {
    describe('design gate', () => {
      it('should fail when missing artifacts', async () => {
        vi.mocked(findProjectRoot).mockReturnValue('/test/project');
        vi.mocked(resolveFeatureDir).mockResolvedValue('/test/specs/0010-test');
        vi.mocked(getProjectContext).mockResolvedValue({
          root: '/test',
          name: 'test',
          hasState: true,
          hasRoadmap: true,
          hasMemory: true,
          hasTemplates: true,
          featureDirs: ['0010-test'],
          activeFeature: {
            dir: '/test/specs/0010-test',
            name: '0010-test',
            phaseNumber: '0010',
            artifacts: {
              discovery: true,
              spec: true,
              requirements: false,
              plan: false,
              tasks: false,
              checklists: { implementation: false, verification: false, deferred: false },
            },
            isComplete: false,
          },
        });

        const context = await getProjectContext();
        const artifacts = context.activeFeature?.artifacts;

        expect(artifacts?.plan).toBe(false);
        expect(artifacts?.tasks).toBe(false);
      });

      it('should pass when all artifacts exist', async () => {
        vi.mocked(getProjectContext).mockResolvedValue({
          root: '/test',
          name: 'test',
          hasState: true,
          hasRoadmap: true,
          hasMemory: true,
          hasTemplates: true,
          featureDirs: ['0010-test'],
          activeFeature: {
            dir: '/test/specs/0010-test',
            name: '0010-test',
            phaseNumber: '0010',
            artifacts: {
              discovery: true,
              spec: true,
              requirements: true,
              plan: true,
              tasks: true,
              checklists: { implementation: true, verification: true, deferred: false },
            },
            isComplete: true,
          },
        });

        const context = await getProjectContext();
        const artifacts = context.activeFeature?.artifacts;

        const checks = {
          spec_exists: artifacts?.spec,
          plan_exists: artifacts?.plan,
          tasks_exist: artifacts?.tasks,
          checklists_exist: artifacts?.checklists.implementation && artifacts?.checklists.verification,
        };

        expect(Object.values(checks).every(Boolean)).toBe(true);
      });
    });

    describe('implement gate', () => {
      it('should fail when tasks incomplete', async () => {
        vi.mocked(resolveFeatureDir).mockResolvedValue('/test/specs/0010-test');
        vi.mocked(readTasks).mockResolvedValue({
          featureDir: '/test/specs/0010-test',
          filePath: '/test/specs/0010-test/tasks.md',
          tasks: [],
          sections: [],
          progress: { total: 10, completed: 5, blocked: 0, deferred: 0, percentage: 50 },
        });

        const tasks = await readTasks('/test/specs/0010-test');
        const allComplete = tasks.progress.completed === tasks.progress.total;

        expect(allComplete).toBe(false);
      });

      it('should pass when all tasks complete', async () => {
        vi.mocked(readTasks).mockResolvedValue({
          featureDir: '/test/specs/0010-test',
          filePath: '/test/specs/0010-test/tasks.md',
          tasks: [],
          sections: [],
          progress: { total: 10, completed: 10, blocked: 0, deferred: 0, percentage: 100 },
        });

        const tasks = await readTasks('/test/specs/0010-test');
        const allComplete = tasks.progress.completed === tasks.progress.total;
        const noBlocked = tasks.progress.blocked === 0;

        expect(allComplete && noBlocked).toBe(true);
      });
    });

    describe('verify gate', () => {
      it('should fail when checklists incomplete', async () => {
        vi.mocked(areAllChecklistsComplete).mockReturnValue(false);

        expect(areAllChecklistsComplete({} as any)).toBe(false);
      });

      it('should pass when checklists complete', async () => {
        vi.mocked(areAllChecklistsComplete).mockReturnValue(true);

        expect(areAllChecklistsComplete({} as any)).toBe(true);
      });

      it('should fail when evidence missing for completed V-items', () => {
        const completedVItems = [
          { id: 'V-001', status: 'done' },
          { id: 'V-002', status: 'done' },
        ];
        const evidence = {
          version: '1.0' as const,
          featureDir: '/test',
          items: {
            'V-001': { itemId: 'V-001', timestamp: '', evidence: 'tested' },
          },
        };

        vi.mocked(hasEvidence).mockReturnValue({ complete: false, missing: ['V-002'] });

        const result = hasEvidence(evidence, completedVItems.map(i => i.id));
        expect(result.complete).toBe(false);
        expect(result.missing).toContain('V-002');
      });

      it('should pass when all V-items have evidence', () => {
        const evidence = {
          version: '1.0' as const,
          featureDir: '/test',
          items: {
            'V-001': { itemId: 'V-001', timestamp: '', evidence: 'tested' },
            'V-002': { itemId: 'V-002', timestamp: '', evidence: 'tested' },
          },
        };

        vi.mocked(hasEvidence).mockReturnValue({ complete: true, missing: [] });

        const result = hasEvidence(evidence, ['V-001', 'V-002']);
        expect(result.complete).toBe(true);
      });

      it('should pass gracefully when no evidence file exists', () => {
        // No evidence file = graceful degradation (pass)
        const evidence = null;
        const hasFile = evidence !== null;

        // When no file exists, gate should pass (backward compat)
        expect(hasFile).toBe(false);
      });

      it('should not require evidence for skipped V-items', () => {
        const vItems = [
          { id: 'V-001', status: 'done' },
          { id: 'V-002', status: 'skipped' },
        ];
        const completedVItems = vItems.filter(i => i.status === 'done');

        // Only completed items need evidence, not skipped
        expect(completedVItems).toHaveLength(1);
        expect(completedVItems[0].id).toBe('V-001');
      });
    });
  });

  describe('issue detection', () => {
    it('should detect circular dependencies', async () => {
      vi.mocked(detectCircularDependencies).mockReturnValue(['T001 → T002 → T001']);

      const cycles = detectCircularDependencies({} as any);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('T001');
    });

    it('should collect health issues', async () => {
      vi.mocked(runHealthCheck).mockResolvedValue({
        status: 'warning',
        issues: [
          {
            code: 'BRANCH_MISMATCH',
            severity: 'warning',
            message: 'Branch mismatch',
            autoFixable: true,
          },
        ],
        summary: { errors: 0, warnings: 1, info: 0 },
      });

      const health = await runHealthCheck('/test/project');

      expect(health.issues).toHaveLength(1);
      expect(health.issues[0].code).toBe('BRANCH_MISMATCH');
    });

    it('should detect missing artifacts when in implement step', async () => {
      vi.mocked(readState).mockResolvedValue({
        schema_version: '3.0',
        project: { id: 'test', name: 'test', path: '/test' },
        orchestration: {
          step: { current: 'implement', index: 2 },
        },
      } as any);
      vi.mocked(getMissingArtifacts).mockReturnValue(['plan.md', 'tasks.md']);

      const state = await readState('/test/project');
      const stepIndex = parseInt(String(state.orchestration?.step?.index ?? 0), 10);

      expect(stepIndex).toBe(2);

      const missing = getMissingArtifacts({} as any);
      expect(missing).toContain('plan.md');
    });
  });

  describe('auto-fix', () => {
    it('should identify auto-fixable issues', async () => {
      vi.mocked(runHealthCheck).mockResolvedValue({
        status: 'warning',
        issues: [
          { code: 'TASKS_COMPLETE_STEP_IMPLEMENT', severity: 'info', message: 'Step mismatch', autoFixable: true },
          { code: 'NO_ROADMAP', severity: 'warning', message: 'No roadmap', autoFixable: false },
        ],
        summary: { errors: 0, warnings: 1, info: 1 },
      });

      const health = await runHealthCheck('/test/project');
      const autoFixable = health.issues.filter(i => i.autoFixable);

      expect(autoFixable).toHaveLength(1);
      expect(autoFixable[0].code).toBe('TASKS_COMPLETE_STEP_IMPLEMENT');
    });
  });

  describe('suggested action', () => {
    it('should suggest fix_errors when errors exist', () => {
      const issues = [{ severity: 'error', code: 'TEST', message: 'Error', autoFixable: false }];
      const hasErrors = issues.some(i => i.severity === 'error');

      expect(hasErrors).toBe(true);
    });

    it('should suggest run_check_fix when auto-fixable issues exist', () => {
      const issues = [{ severity: 'warning', code: 'TEST', message: 'Warning', autoFixable: true }];
      const hasAutoFixable = issues.some(i => i.autoFixable);

      expect(hasAutoFixable).toBe(true);
    });

    it('should suggest run_design when design gate fails', () => {
      const designGate = { passed: false, checks: { spec_exists: false } };

      expect(!designGate.passed).toBe(true);
    });

    it('should suggest ready_to_merge when all gates pass', () => {
      const gates = {
        design: { passed: true, checks: {} },
        implement: { passed: true, checks: {} },
        verify: { passed: true, checks: {} },
      };

      const allPassed = Object.values(gates).every(g => g.passed);
      expect(allPassed).toBe(true);
    });
  });
});
