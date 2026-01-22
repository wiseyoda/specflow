/**
 * Integration tests for orchestration system
 *
 * Tests logical flows and component interactions for the orchestration system.
 * Focuses on testable scenarios without full file system simulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FailureContext } from '@/lib/services/auto-healing-service';

// =============================================================================
// Hoist Mock Data
// =============================================================================

const { mockFiles, mockClaudeHelper, mockHealWithClaude } = vi.hoisted(() => ({
  mockFiles: new Map<string, string>(),
  mockClaudeHelper: vi.fn(),
  mockHealWithClaude: vi.fn(),
}));

// =============================================================================
// Mock Setup
// =============================================================================

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => mockFiles.has(path)),
  readFileSync: vi.fn((path: string, encoding?: string) => {
    if (mockFiles.has(path)) {
      return mockFiles.get(path);
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }),
  writeFileSync: vi.fn((path: string, content: string) => {
    mockFiles.set(path, content);
  }),
  mkdirSync: vi.fn(),
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

// =============================================================================
// Tests
// =============================================================================

describe('Orchestration Integration Tests', () => {
  const projectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
  });

  describe('Auto-Healing Prompt Building', () => {
    it('should build comprehensive healer prompt', async () => {
      const { buildHealerPrompt } = await import('@/lib/services/auto-healing-service');

      const context: FailureContext = {
        errorMessage: 'TypeError: Cannot read property "map" of undefined',
        stderr: 'at Array.map (<anonymous>)\n    at renderList (src/components/list.tsx:15:23)',
        section: 'Core Components',
        attemptedTaskIds: ['T001', 'T002', 'T003'],
        completedTaskIds: ['T001'],
        failedTaskIds: ['T002', 'T003'],
        sessionId: 'session-123',
        sessionTranscript: '[USER]: Implement the list component\n\n[ASSISTANT]: Creating list.tsx now...',
        additionalContext: 'Using React 19 with strict mode',
      };

      const prompt = buildHealerPrompt(context);

      // Check all sections are present
      expect(prompt).toContain('# Auto-Heal Request');
      expect(prompt).toContain('**Section**: Core Components');
      expect(prompt).toContain('**Error**: TypeError: Cannot read property "map" of undefined');

      // Check stderr is included
      expect(prompt).toContain('renderList (src/components/list.tsx:15:23)');

      // Check task breakdown
      expect(prompt).toContain('T001, T002, T003'); // Attempted
      expect(prompt).toContain('T001'); // Completed
      expect(prompt).toContain('T002, T003'); // Failed

      // Check session transcript
      expect(prompt).toContain('## Recent Session Transcript');
      expect(prompt).toContain('[USER]: Implement the list component');

      // Check additional context
      expect(prompt).toContain('## Additional Context');
      expect(prompt).toContain('React 19 with strict mode');
    });

    it('should truncate very long error output', async () => {
      const { buildHealerPrompt } = await import('@/lib/services/auto-healing-service');

      const context: FailureContext = {
        errorMessage: 'Build failed',
        stderr: 'X'.repeat(5000), // Very long error
        section: 'Build',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
      };

      const prompt = buildHealerPrompt(context);

      // Prompt should be truncated to prevent token bloat
      expect(prompt.length).toBeLessThan(6000);
    });
  });

  describe('Healing Result Evaluation', () => {
    it('should correctly identify successful healing', async () => {
      const { isHealingSuccessful, isHealingPartial } = await import('@/lib/services/auto-healing-service');

      const fixedResult = { status: 'fixed' as const, tasksCompleted: ['T001'], tasksRemaining: [] };
      const partialResult = { status: 'partial' as const, tasksCompleted: ['T001'], tasksRemaining: ['T002'] };
      const failedResult = { status: 'failed' as const, tasksCompleted: [], tasksRemaining: ['T001'] };

      expect(isHealingSuccessful(fixedResult)).toBe(true);
      expect(isHealingSuccessful(partialResult)).toBe(false);
      expect(isHealingSuccessful(failedResult)).toBe(false);

      expect(isHealingPartial(partialResult)).toBe(true);
      expect(isHealingPartial(fixedResult)).toBe(false);
    });

    it('should generate appropriate healing summaries', async () => {
      const { getHealingSummary } = await import('@/lib/services/auto-healing-service');

      expect(getHealingSummary({
        success: true,
        result: { status: 'fixed', tasksCompleted: ['T001', 'T002', 'T003'], tasksRemaining: [] },
        cost: 0.5,
        duration: 5000,
      })).toBe('Healed: completed 3 tasks');

      expect(getHealingSummary({
        success: true,
        result: { status: 'partial', tasksCompleted: ['T001'], tasksRemaining: ['T002', 'T003'] },
        cost: 0.5,
        duration: 5000,
      })).toBe('Partial: completed 1, remaining 2');

      expect(getHealingSummary({
        success: true,
        result: { status: 'failed', tasksCompleted: [], tasksRemaining: ['T001'], blockerReason: 'Missing dependencies' },
        cost: 0.25,
        duration: 3000,
      })).toBe('Failed: Missing dependencies');

      expect(getHealingSummary({
        success: false,
        errorMessage: 'API timeout',
        cost: 0,
        duration: 30000,
      })).toBe('Error: API timeout');
    });
  });

  describe('Healer Spawning', () => {
    it('should use claudeHelper for new sessions', async () => {
      mockClaudeHelper.mockResolvedValue({
        success: true,
        result: { status: 'fixed', tasksCompleted: ['T001'], tasksRemaining: [] },
        sessionId: 'new-session',
        cost: 0.5,
        duration: 5000,
      });

      const { spawnHealer } = await import('@/lib/services/auto-healing-service');

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
        // No sessionId - should use claudeHelper
      };

      const result = await spawnHealer(projectPath, context);

      expect(mockClaudeHelper).toHaveBeenCalled();
      expect(mockHealWithClaude).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result?.status).toBe('fixed');
    });

    it('should use healWithClaude for session continuation', async () => {
      mockHealWithClaude.mockResolvedValue({
        success: true,
        result: { status: 'fixed', tasksCompleted: ['T001'], tasksRemaining: [] },
        sessionId: 'continued-session',
        cost: 0.75,
        duration: 6000,
      });

      const { spawnHealer } = await import('@/lib/services/auto-healing-service');

      const context: FailureContext = {
        errorMessage: 'Error',
        stderr: '',
        section: 'Test',
        attemptedTaskIds: ['T001'],
        completedTaskIds: [],
        failedTaskIds: ['T001'],
        sessionId: 'original-session', // Has sessionId - should use healWithClaude
      };

      const result = await spawnHealer(projectPath, context);

      expect(mockHealWithClaude).toHaveBeenCalled();
      expect(mockClaudeHelper).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    it('should have valid OrchestrationConfig schema', async () => {
      const { OrchestrationConfigSchema } = await import('@specflow/shared');

      // Valid config
      const validConfig = {
        startPhase: 'implement',
        continueOnVerifyFail: false,
        mergeStrategy: 'manual',
        maxHealAttempts: 3,
        batchSizeFallback: 10,
      };

      const result = OrchestrationConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should have valid HealingResult schema', async () => {
      const { HealingResultSchema } = await import('@specflow/shared');

      const fixedResult = {
        status: 'fixed',
        tasksCompleted: ['T001', 'T002'],
        tasksRemaining: [],
      };

      const partialResult = {
        status: 'partial',
        tasksCompleted: ['T001'],
        tasksRemaining: ['T002'],
        blockerReason: 'Missing dependency',
      };

      expect(HealingResultSchema.safeParse(fixedResult).success).toBe(true);
      expect(HealingResultSchema.safeParse(partialResult).success).toBe(true);
    });
  });
});
