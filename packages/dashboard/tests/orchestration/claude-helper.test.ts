/**
 * Tests for claude-helper.ts
 *
 * Tests typed Claude CLI interactions with mocked subprocess.
 * NOTE: These tests mock the child_process spawn function to avoid
 * actually invoking the Claude CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock fs operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => 'test message'),
  unlinkSync: vi.fn(),
}));

// Import after mocking
import { spawn } from 'child_process';
import { claudeHelper, quickDecision, verifyWithClaude } from '@/lib/services/claude-helper';

// Test schema
const TestSchema = z.object({
  action: z.enum(['proceed', 'stop']),
  reason: z.string(),
});

type TestResponse = z.infer<typeof TestSchema>;

// Helper to create mock spawn
function createMockSpawn(stdout: string, stderr: string = '', exitCode: number = 0) {
  const mockStdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
  const mockStdout = {
    on: vi.fn((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data') {
        setTimeout(() => callback(Buffer.from(stdout)), 10);
      }
    }),
  };
  const mockStderr = {
    on: vi.fn((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data' && stderr) {
        setTimeout(() => callback(Buffer.from(stderr)), 10);
      }
    }),
  };

  const mockProc = {
    stdin: mockStdin,
    stdout: mockStdout,
    stderr: mockStderr,
    on: vi.fn((event: string, callback: (code: number | Error) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 20);
      }
    }),
    kill: vi.fn(),
    killed: false,
  };

  (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);
  return mockProc;
}

describe('claudeHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful responses', () => {
    it('should parse structured output from CLI', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'test-session-123',
        cost_usd: 0.01,
        structured_output: {
          action: 'proceed',
          reason: 'All checks passed',
        },
      });

      createMockSpawn(cliOutput);

      const response = await claudeHelper({
        message: 'What should we do next?',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.result.action).toBe('proceed');
        expect(response.result.reason).toBe('All checks passed');
        expect(response.sessionId).toBe('test-session-123');
        expect(response.cost).toBe(0.01);
      }
    });

    it('should handle multiline JSON output', async () => {
      const cliOutput = [
        '{"type": "progress", "message": "Processing..."}',
        JSON.stringify({
          session_id: 'multi-line-session',
          cost_usd: 0.02,
          structured_output: {
            action: 'stop',
            reason: 'Task complete',
          },
        }),
      ].join('\n');

      createMockSpawn(cliOutput);

      const response = await claudeHelper({
        message: 'Check status',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.result.action).toBe('stop');
        expect(response.sessionId).toBe('multi-line-session');
      }
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent project path', async () => {
      const { existsSync } = await import('fs');
      (existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

      const response = await claudeHelper({
        message: 'Test',
        schema: TestSchema,
        projectPath: '/nonexistent/path',
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.errorType).toBe('process_failed');
        expect(response.errorMessage).toContain('does not exist');
      }
    });

    it('should return error when CLI fails', async () => {
      createMockSpawn('', 'CLI error: rate limited', 1);

      const response = await claudeHelper({
        message: 'Test',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.errorType).toBe('process_failed');
        expect(response.errorMessage).toContain('CLI error');
      }
    });

    it('should return error when no structured_output in response', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'test-session',
        cost_usd: 0.01,
        // Missing structured_output
      });

      createMockSpawn(cliOutput);

      const response = await claudeHelper({
        message: 'Test',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.errorType).toBe('schema_validation_failed');
        expect(response.errorMessage).toContain('No structured_output');
      }
    });

    it('should return error when schema validation fails', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'test-session',
        cost_usd: 0.01,
        structured_output: {
          action: 'invalid_action', // Not in enum
          reason: 123, // Should be string
        },
      });

      createMockSpawn(cliOutput);

      const response = await claudeHelper({
        message: 'Test',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.errorType).toBe('schema_validation_failed');
        expect(response.partialResult).toBeDefined();
      }
    });

    it('should return error when budget exceeded', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'test-session',
        cost_usd: 1.5, // Over budget
        structured_output: {
          action: 'proceed',
          reason: 'Expensive operation',
        },
      });

      createMockSpawn(cliOutput);

      const response = await claudeHelper({
        message: 'Test',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
        maxBudgetUsd: 1.0, // Budget limit
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.errorType).toBe('budget_exceeded');
        expect(response.errorMessage).toContain('Budget exceeded');
        expect(response.partialResult).toEqual({
          action: 'proceed',
          reason: 'Expensive operation',
        });
      }
    });
  });

  describe('session handling', () => {
    it('should pass session ID for resume', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'resumed-session',
        cost_usd: 0.01,
        structured_output: { action: 'proceed', reason: 'Resumed' },
      });

      createMockSpawn(cliOutput);

      await claudeHelper({
        message: 'Continue',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
        sessionId: 'previous-session-id',
      });

      expect(spawn).toHaveBeenCalled();
      const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(args).toContain('--resume');
      expect(args).toContain('previous-session-id');
    });

    it('should pass fork-session flag when requested', async () => {
      const cliOutput = JSON.stringify({
        session_id: 'forked-session',
        cost_usd: 0.01,
        structured_output: { action: 'proceed', reason: 'Forked' },
      });

      createMockSpawn(cliOutput);

      await claudeHelper({
        message: 'Fork and continue',
        schema: TestSchema,
        projectPath: '/tmp/test-project',
        sessionId: 'previous-session-id',
        forkSession: true,
      });

      const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(args).toContain('--fork-session');
    });
  });
});

describe('quickDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use haiku model by default', async () => {
    const cliOutput = JSON.stringify({
      session_id: 'quick-session',
      cost_usd: 0.001,
      structured_output: { action: 'proceed', reason: 'Quick decision' },
    });

    createMockSpawn(cliOutput);

    await quickDecision('Quick question', TestSchema, '/tmp/test-project');

    const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(args).toContain('haiku');
  });

  it('should have no session persistence by default', async () => {
    const cliOutput = JSON.stringify({
      session_id: 'quick-session',
      cost_usd: 0.001,
      structured_output: { action: 'proceed', reason: 'Quick' },
    });

    createMockSpawn(cliOutput);

    await quickDecision('Quick question', TestSchema, '/tmp/test-project');

    const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(args).toContain('--no-session-persistence');
  });
});

describe('verifyWithClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use restricted read-only tools', async () => {
    const cliOutput = JSON.stringify({
      session_id: 'verify-session',
      cost_usd: 0.05,
      structured_output: { action: 'proceed', reason: 'Verification passed' },
    });

    createMockSpawn(cliOutput);

    await verifyWithClaude('Verify the implementation', TestSchema, '/tmp/test-project');

    const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(args).toContain('--tools');
    expect(args.join(' ')).toMatch(/Read.*Grep.*Glob/);
  });

  it('should use sonnet model for verification', async () => {
    const cliOutput = JSON.stringify({
      session_id: 'verify-session',
      cost_usd: 0.05,
      structured_output: { action: 'proceed', reason: 'Verified' },
    });

    createMockSpawn(cliOutput);

    await verifyWithClaude('Verify', TestSchema, '/tmp/test-project');

    const args = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(args).toContain('sonnet');
  });
});
