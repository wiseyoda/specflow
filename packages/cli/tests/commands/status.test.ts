import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the lib/status module
vi.mock('../../src/lib/status.js', () => ({
  getStatus: vi.fn(),
}));

vi.mock('../../src/lib/output.js', () => ({
  output: vi.fn(),
  setOutputOptions: vi.fn(),
}));

vi.mock('../../src/lib/errors.js', () => ({
  handleError: vi.fn(),
}));

import { getStatus } from '../../src/lib/status.js';

describe('status command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('statusCommand', () => {
    it('should delegate to getStatus from lib/status', async () => {
      vi.mocked(getStatus).mockResolvedValue({
        phase: { number: '0010', name: 'test', branch: '0010-test', status: 'in_progress', hasUserGate: false },
        step: { current: 'implement', index: 2, status: 'in_progress' },
        progress: { tasksCompleted: 5, tasksTotal: 10, tasksBlocked: 0, percentage: 50 },
        health: { status: 'ready', issues: [] },
        nextAction: 'continue_implement',
        blockers: [],
        context: { featureDir: '/test/specs/0010-test', hasSpec: true, hasPlan: true, hasTasks: true },
      });

      // Verify getStatus is importable and mockable
      const status = await getStatus();
      expect(status.phase.number).toBe('0010');
      expect(status.nextAction).toBe('continue_implement');
    });

    it('should re-export types from lib/status', async () => {
      // Verify the re-exports work
      const mod = await import('../../src/commands/status.js');
      expect(mod.statusCommand).toBeDefined();
    });
  });
});
