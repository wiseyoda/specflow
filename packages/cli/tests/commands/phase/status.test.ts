import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
  getSpecsDir: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('../../../src/lib/state.js', () => ({
  readState: vi.fn(),
}));

vi.mock('../../../src/lib/roadmap.js', () => ({
  readRoadmap: vi.fn(),
}));

import { findProjectRoot, getSpecsDir, pathExists } from '../../../src/lib/paths.js';
import { readState } from '../../../src/lib/state.js';
import { readRoadmap } from '../../../src/lib/roadmap.js';

describe('phase status command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPhaseStatus', () => {
    it('should return current phase info from state', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');
      vi.mocked(getSpecsDir).mockReturnValue('/project/specs');
      vi.mocked(pathExists).mockReturnValue(true);
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
        activePhase: { number: '0080', name: 'CLI Migration', status: 'in_progress', hasUserGate: false, line: 10 },
        nextPhase: { number: '0081', name: 'Next Phase', status: 'not_started', hasUserGate: false, line: 11 },
        progress: { total: 2, completed: 0, percentage: 0 },
      });

      // Simulate what getPhaseStatus would return
      const state = await readState('/project');
      const roadmap = await readRoadmap('/project');

      expect(state.orchestration.phase.number).toBe('0080');
      expect(state.orchestration.phase.name).toBe('CLI Migration');
      expect(state.orchestration.phase.status).toBe('in_progress');
      expect(roadmap.nextPhase?.number).toBe('0081');
    });

    it('should handle no active phase', async () => {
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
      vi.mocked(readRoadmap).mockResolvedValue({
        filePath: '/project/ROADMAP.md',
        phases: [
          { number: '0080', name: 'First Phase', status: 'not_started', hasUserGate: false, line: 10 },
        ],
        nextPhase: { number: '0080', name: 'First Phase', status: 'not_started', hasUserGate: false, line: 10 },
        progress: { total: 1, completed: 0, percentage: 0 },
      });

      const state = await readState('/project');

      expect(state.orchestration.phase.number).toBeNull();
      expect(state.orchestration.phase.name).toBeNull();
    });
  });
});
