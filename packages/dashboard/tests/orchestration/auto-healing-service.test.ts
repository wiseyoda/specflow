/**
 * Tests for auto-healing-service.ts
 *
 * Tests failure context capture, healer prompt building, and healing execution.
 * Uses mocked file system and Claude helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock data to be accessible in vi.mock factories
const { mockFiles, mockClaudeHelper, mockHealWithClaude } = vi.hoisted(() => ({
  mockFiles: new Map<string, string>(),
  mockClaudeHelper: vi.fn(),
  mockHealWithClaude: vi.fn(),
}));

// Mock fs operations
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => mockFiles.has(path)),
  readFileSync: vi.fn((path: string) => {
    if (mockFiles.has(path)) {
      return mockFiles.get(path);
    }
    throw new Error(`File not found: ${path}`);
  }),
  readdirSync: vi.fn((path: string, options?: { withFileTypes?: boolean }) => {
    const files: Array<string | { isDirectory: () => boolean; name: string }> = [];
    const prefix = path.endsWith('/') ? path : `${path}/`;

    mockFiles.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        const relativePath = key.slice(prefix.length);
        const firstSegment = relativePath.split('/')[0];
        if (firstSegment && !files.find(f => (typeof f === 'string' ? f : f.name) === firstSegment)) {
          if (options?.withFileTypes) {
            const isDir = relativePath.includes('/');
            files.push({
              isDirectory: () => isDir,
              name: firstSegment,
            });
          } else {
            files.push(firstSegment);
          }
        }
      }
    });
    return files;
  }),
}));

// Mock claude-helper
vi.mock('@/lib/services/claude-helper', () => ({
  claudeHelper: mockClaudeHelper,
  healWithClaude: mockHealWithClaude,
}));

// Import after mocking
import {
  captureFailureContext,
  buildHealerPrompt,
  spawnHealer,
  attemptHeal,
  isHealingSuccessful,
  isHealingPartial,
  getHealingSummary,
  type FailureContext,
} from '@/lib/services/auto-healing-service';

describe('AutoHealingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
  });

  describe('captureFailureContext', () => {
    const projectPath = '/test/project';
    const executionId = 'exec-123';
    const section = 'Core Components';
    const taskIds = ['T001', 'T002', 'T003'];

    it('should capture basic failure context when no metadata found', () => {
      const context = captureFailureContext(projectPath, executionId, section, taskIds);

      expect(context.errorMessage).toBe('Unknown failure');
      expect(context.stderr).toBe('');
      expect(context.section).toBe(section);
      expect(context.attemptedTaskIds).toEqual(taskIds);
      expect(context.failedTaskIds).toEqual(taskIds);
      expect(context.completedTaskIds).toEqual([]);
    });

    it('should capture error from workflow metadata file', () => {
      const metadataPath = `${projectPath}/.specflow/workflows/pending-${executionId}.json`;
      mockFiles.set(metadataPath, JSON.stringify({
        id: executionId,
        error: 'Type error in component',
        stderr: 'TypeError: Cannot read property',
        sessionId: 'session-456',
      }));
      mockFiles.set(`${projectPath}/.specflow/workflows`, ''); // Directory marker

      const context = captureFailureContext(projectPath, executionId, section, taskIds);

      expect(context.errorMessage).toBe('Type error in component');
      expect(context.stderr).toBe('TypeError: Cannot read property');
      expect(context.sessionId).toBe('session-456');
    });

    // Note: Testing completed task detection from tasks.md requires complex fs mocking
    // that doesn't work well with require('fs') inside the module. This functionality
    // is tested through manual integration testing.
  });

  describe('buildHealerPrompt', () => {
    it('should build prompt with all failure context fields', () => {
      const context: FailureContext = {
        errorMessage: 'Module not found: react-dom',
        stderr: 'npm ERR! Cannot find module',
        section: 'UI Components',
        attemptedTaskIds: ['T010', 'T011', 'T012'],
        completedTaskIds: ['T010'],
        failedTaskIds: ['T011', 'T012'],
        sessionId: 'session-789',
      };

      const prompt = buildHealerPrompt(context);

      expect(prompt).toContain('# Auto-Heal Request');
      expect(prompt).toContain('**Section**: UI Components');
      expect(prompt).toContain('**Error**: Module not found: react-dom');
      expect(prompt).toContain('npm ERR! Cannot find module');
      expect(prompt).toContain('T010, T011, T012'); // Attempted tasks
      expect(prompt).toContain('T010'); // Completed
      expect(prompt).toContain('T011, T012'); // Failed
    });

    it('should include session transcript when available', () => {
      const context: FailureContext = {
        errorMessage: 'Test failure',
        stderr: '',
        section: 'Tests',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
        sessionTranscript: '[USER]: Run the tests\n\n[ASSISTANT]: Running tests now...',
      };

      const prompt = buildHealerPrompt(context);

      expect(prompt).toContain('## Recent Session Transcript');
      expect(prompt).toContain('[USER]: Run the tests');
      expect(prompt).toContain('[ASSISTANT]: Running tests now');
    });

    it('should include additional context when provided', () => {
      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Setup',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
        additionalContext: 'Use TypeScript strict mode',
      };

      const prompt = buildHealerPrompt(context);

      expect(prompt).toContain('## Additional Context');
      expect(prompt).toContain('Use TypeScript strict mode');
    });

    it('should truncate long stderr to prevent token bloat', () => {
      const context: FailureContext = {
        errorMessage: 'Build error',
        stderr: 'E'.repeat(3000), // Very long error
        section: 'Build',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
      };

      const prompt = buildHealerPrompt(context);

      // Should be truncated to 2000 chars
      const stderrMatch = prompt.match(/```\n(E+)\n```/);
      expect(stderrMatch).toBeTruthy();
      expect(stderrMatch?.[1]?.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('spawnHealer', () => {
    it('should use claudeHelper for new session', async () => {
      mockClaudeHelper.mockResolvedValue({
        success: true,
        result: {
          status: 'fixed',
          tasksCompleted: ['T001'],
          tasksRemaining: [],
        },
        sessionId: 'new-session',
        cost: 0.50,
        duration: 5000,
      });

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
      };

      const result = await spawnHealer('/project', context);

      expect(mockClaudeHelper).toHaveBeenCalled();
      expect(mockHealWithClaude).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result?.status).toBe('fixed');
    });

    it('should use healWithClaude when sessionId is available', async () => {
      mockHealWithClaude.mockResolvedValue({
        success: true,
        result: {
          status: 'fixed',
          tasksCompleted: ['T001'],
          tasksRemaining: [],
        },
        sessionId: 'forked-session',
        cost: 0.75,
        duration: 6000,
      });

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
        sessionId: 'original-session',
      };

      const result = await spawnHealer('/project', context);

      expect(mockHealWithClaude).toHaveBeenCalled();
      expect(mockClaudeHelper).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should return failure result when healer fails', async () => {
      mockClaudeHelper.mockResolvedValue({
        success: false,
        errorMessage: 'Claude API error',
        cost: 0.10,
        duration: 1000,
      });

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
      };

      const result = await spawnHealer('/project', context);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Claude API error');
      expect(result.cost).toBe(0.10);
    });

    it('should handle partial healing results', async () => {
      mockClaudeHelper.mockResolvedValue({
        success: true,
        result: {
          status: 'partial',
          tasksCompleted: ['T001'],
          tasksRemaining: ['T002'],
          blockerReason: 'Missing dependency',
        },
        sessionId: 'session',
        cost: 0.50,
        duration: 5000,
      });

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001', 'T002'],
        completedTaskIds: [],
        failedTaskIds: ['T001', 'T002'],
      };

      const result = await spawnHealer('/project', context);

      expect(result.success).toBe(false); // partial != fixed
      expect(result.result?.status).toBe('partial');
      expect(result.result?.tasksCompleted).toEqual(['T001']);
      expect(result.result?.tasksRemaining).toEqual(['T002']);
    });
  });

  describe('attemptHeal', () => {
    const projectPath = '/test/project';
    const executionId = 'exec-123';
    const section = 'Core Components';
    const taskIds = ['T001', 'T002', 'T003'];

    it('should return success immediately when no failed tasks', async () => {
      // Setup: All tasks are already completed
      // The getCompletedTaskIds function lists phase directories and picks first
      const specsDir = `${projectPath}/specs`;
      const phaseDir = `${specsDir}/1055-smart-batching`;
      const tasksPath = `${phaseDir}/tasks.md`;

      // Set up directory structure
      // Note: the mock's readdirSync uses relativePath.includes('/') to detect directories
      // So we need to add a file inside the phase directory to mark it as a directory
      mockFiles.set(specsDir, ''); // specs directory exists
      mockFiles.set(tasksPath, `
## Core Components
- [x] T001 First task
- [x] T002 Second task
- [x] T003 Third task
      `);
      // tasksPath includes /1055-smart-batching/tasks.md which makes the mock
      // recognize 1055-smart-batching as a directory (relativePath includes '/')

      const result = await attemptHeal(projectPath, executionId, section, taskIds);

      // Should return success without calling healer
      expect(result.success).toBe(true);
      expect(result.result?.status).toBe('fixed');
      expect(result.cost).toBe(0);
      expect(mockClaudeHelper).not.toHaveBeenCalled();
      expect(mockHealWithClaude).not.toHaveBeenCalled();
    });

    it('should spawn healer when there are failed tasks', async () => {
      // Setup: Some tasks still incomplete
      mockClaudeHelper.mockResolvedValue({
        success: true,
        result: {
          status: 'fixed',
          tasksCompleted: ['T002', 'T003'],
          tasksRemaining: [],
        },
        sessionId: 'healer-session',
        cost: 1.50,
        duration: 8000,
      });

      const result = await attemptHeal(projectPath, executionId, section, taskIds);

      // Should call healer since no completed tasks were found
      expect(mockClaudeHelper).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result?.status).toBe('fixed');
    });

    it('should use provided sessionId for healing', async () => {
      mockHealWithClaude.mockResolvedValue({
        success: true,
        result: {
          status: 'fixed',
          tasksCompleted: ['T001'],
          tasksRemaining: [],
        },
        sessionId: 'forked-session',
        cost: 0.75,
        duration: 5000,
      });

      const result = await attemptHeal(
        projectPath,
        executionId,
        section,
        taskIds,
        'original-session-123'
      );

      // Should use healWithClaude since sessionId is provided
      expect(mockHealWithClaude).toHaveBeenCalled();
      expect(mockClaudeHelper).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should respect budget limit', async () => {
      mockClaudeHelper.mockResolvedValue({
        success: true,
        result: {
          status: 'fixed',
          tasksCompleted: ['T001'],
          tasksRemaining: [],
        },
        sessionId: 'session',
        cost: 3.00,
        duration: 10000,
      });

      const result = await attemptHeal(
        projectPath,
        executionId,
        section,
        taskIds,
        undefined,
        5.0 // Custom budget
      );

      // Should pass through budget to healer
      expect(mockClaudeHelper).toHaveBeenCalledWith(
        expect.objectContaining({
          maxBudgetUsd: 5.0,
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('isHealingSuccessful', () => {
    it('should return true for fixed status', () => {
      expect(isHealingSuccessful({ status: 'fixed', tasksCompleted: [], tasksRemaining: [] })).toBe(true);
    });

    it('should return false for partial status', () => {
      expect(isHealingSuccessful({ status: 'partial', tasksCompleted: [], tasksRemaining: [] })).toBe(false);
    });

    it('should return false for failed status', () => {
      expect(isHealingSuccessful({ status: 'failed', tasksCompleted: [], tasksRemaining: [] })).toBe(false);
    });
  });

  describe('isHealingPartial', () => {
    it('should return true for partial status', () => {
      expect(isHealingPartial({ status: 'partial', tasksCompleted: [], tasksRemaining: [] })).toBe(true);
    });

    it('should return false for fixed status', () => {
      expect(isHealingPartial({ status: 'fixed', tasksCompleted: [], tasksRemaining: [] })).toBe(false);
    });
  });

  describe('getHealingSummary', () => {
    it('should return success message for fixed result', () => {
      const result = {
        success: true,
        result: { status: 'fixed' as const, tasksCompleted: ['T001', 'T002'], tasksRemaining: [] },
        cost: 0.50,
        duration: 5000,
      };

      expect(getHealingSummary(result)).toBe('Healed: completed 2 tasks');
    });

    it('should return partial message with counts', () => {
      const result = {
        success: true,
        result: {
          status: 'partial' as const,
          tasksCompleted: ['T001'],
          tasksRemaining: ['T002', 'T003'],
        },
        cost: 0.50,
        duration: 5000,
      };

      expect(getHealingSummary(result)).toBe('Partial: completed 1, remaining 2');
    });

    it('should return failure message with reason', () => {
      const result = {
        success: true,
        result: {
          status: 'failed' as const,
          tasksCompleted: [],
          tasksRemaining: ['T001'],
          blockerReason: 'Missing API key',
        },
        cost: 0.25,
        duration: 3000,
      };

      expect(getHealingSummary(result)).toBe('Failed: Missing API key');
    });

    it('should return error message for failed healer call', () => {
      const result = {
        success: false,
        errorMessage: 'Network timeout',
        cost: 0,
        duration: 30000,
      };

      expect(getHealingSummary(result)).toBe('Error: Network timeout');
    });
  });
});
