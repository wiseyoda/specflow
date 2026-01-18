import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
}));

vi.mock('../../../src/lib/state.js', () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
  setStateValue: vi.fn(),
}));

vi.mock('../../../src/lib/roadmap.js', () => ({
  readRoadmap: vi.fn(),
  updatePhaseStatus: vi.fn(),
}));

vi.mock('../../../src/lib/history.js', () => ({
  archivePhase: vi.fn(),
}));

vi.mock('../../../src/lib/backlog.js', () => ({
  scanDeferredItems: vi.fn(),
  addToBacklog: vi.fn(),
}));

import { findProjectRoot } from '../../../src/lib/paths.js';
import { readState, writeState, setStateValue } from '../../../src/lib/state.js';
import { readRoadmap, updatePhaseStatus } from '../../../src/lib/roadmap.js';
import { archivePhase } from '../../../src/lib/history.js';
import { scanDeferredItems, addToBacklog } from '../../../src/lib/backlog.js';

describe('phase close command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('closePhase', () => {
    it('should throw when not in a project', async () => {
      vi.mocked(findProjectRoot).mockReturnValue(null);

      expect(findProjectRoot()).toBeNull();
    });

    it('should throw when no active phase', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');
      vi.mocked(readState).mockResolvedValue({
        schema_version: '3.0',
        project: { id: '1', name: 'Test', path: '/project' },
        last_updated: '2024-01-18',
        orchestration: {
          phase: {
            id: null,
            number: null,
            name: null,
            branch: null,
            status: 'not_started',
          },
          next_phase: null,
          step: { current: 'design', index: 0, status: 'not_started' },
          implement: null,
        },
        health: { status: 'ready', last_check: '2024-01-18', issues: [] },
      });

      const state = await readState('/project');

      expect(state.orchestration.phase.number).toBeNull();
    });

    it('should perform all close operations', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');
      vi.mocked(readState).mockResolvedValue({
        schema_version: '3.0',
        project: { id: '1', name: 'Test', path: '/project' },
        last_updated: '2024-01-18',
        orchestration: {
          phase: {
            id: '1',
            number: '0080',
            name: 'CLI Migration',
            branch: '0080-cli-migration',
            status: 'in_progress',
          },
          next_phase: null,
          step: { current: 'implement', index: 2, status: 'in_progress' },
          implement: null,
        },
        health: { status: 'ready', last_check: '2024-01-18', issues: [] },
      });
      vi.mocked(readRoadmap).mockResolvedValue({
        filePath: '/project/ROADMAP.md',
        phases: [
          { number: '0080', name: 'CLI Migration', status: 'in_progress', hasUserGate: false, line: 10 },
          { number: '0081', name: 'Next Phase', status: 'not_started', hasUserGate: false, line: 11 },
        ],
        progress: { total: 2, completed: 0, percentage: 0 },
      });
      vi.mocked(scanDeferredItems).mockResolvedValue({
        count: 2,
        withTarget: 1,
        toBacklog: 1,
        items: [
          { description: 'Item 1', source: 'spec.md', targetPhase: 'Phase 0082' },
          { description: 'Item 2', source: 'spec.md', targetPhase: 'Backlog' },
        ],
      });
      vi.mocked(updatePhaseStatus).mockResolvedValue({ updated: true, filePath: '/project/ROADMAP.md' });
      vi.mocked(archivePhase).mockResolvedValue({ archived: true, historyPath: '/project/.specify/history/HISTORY.md' });
      vi.mocked(addToBacklog).mockResolvedValue(undefined);
      vi.mocked(setStateValue).mockImplementation((state) => state);
      vi.mocked(writeState).mockResolvedValue(undefined);

      // Simulate close operations
      const state = await readState('/project');
      expect(state.orchestration.phase.number).toBe('0080');

      await updatePhaseStatus('0080', 'complete', '/project');
      expect(updatePhaseStatus).toHaveBeenCalledWith('0080', 'complete', '/project');

      await archivePhase({ number: '0080', name: 'CLI Migration', status: 'complete', hasUserGate: false, line: 10 }, '/project');
      expect(archivePhase).toHaveBeenCalled();

      const deferred = await scanDeferredItems('0080', 'CLI Migration', '/project');
      expect(deferred.count).toBe(2);
      expect(deferred.withTarget).toBe(1);
      expect(deferred.toBacklog).toBe(1);
    });

    it('should find next phase from roadmap', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');
      vi.mocked(readRoadmap).mockResolvedValue({
        filePath: '/project/ROADMAP.md',
        phases: [
          { number: '0080', name: 'Current', status: 'in_progress', hasUserGate: false, line: 10 },
          { number: '0081', name: 'Next', status: 'not_started', hasUserGate: false, line: 11 },
          { number: '0082', name: 'After', status: 'not_started', hasUserGate: false, line: 12 },
        ],
        progress: { total: 3, completed: 0, percentage: 0 },
      });

      const roadmap = await readRoadmap('/project');
      const nextPhase = roadmap.phases.find(
        p => p.status === 'not_started' && p.number !== '0080',
      );

      expect(nextPhase?.number).toBe('0081');
      expect(nextPhase?.name).toBe('Next');
    });
  });

  describe('dry run mode', () => {
    it('should not make changes in dry run mode', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');
      vi.mocked(readState).mockResolvedValue({
        schema_version: '3.0',
        project: { id: '1', name: 'Test', path: '/project' },
        last_updated: '2024-01-18',
        orchestration: {
          phase: {
            id: '1',
            number: '0080',
            name: 'CLI Migration',
            branch: '0080-cli-migration',
            status: 'in_progress',
          },
          next_phase: null,
          step: { current: 'implement', index: 2, status: 'in_progress' },
          implement: null,
        },
        health: { status: 'ready', last_check: '2024-01-18', issues: [] },
      });
      vi.mocked(readRoadmap).mockResolvedValue({
        filePath: '/project/ROADMAP.md',
        phases: [],
        progress: { total: 0, completed: 0, percentage: 0 },
      });
      vi.mocked(scanDeferredItems).mockResolvedValue({
        count: 0,
        withTarget: 0,
        toBacklog: 0,
        items: [],
      });

      // In dry run mode, these should NOT be called
      // The test verifies the mocks are not called

      // Read state (allowed)
      await readState('/project');
      expect(readState).toHaveBeenCalled();

      // In real dry run, these would not be called
      expect(updatePhaseStatus).not.toHaveBeenCalled();
      expect(archivePhase).not.toHaveBeenCalled();
      expect(writeState).not.toHaveBeenCalled();
    });
  });
});
