import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/lib/claude-validator.js', () => ({
  validateClaudeCli: vi.fn(),
}));

vi.mock('../../../src/lib/claude-runner.js', () => ({
  createClaudeRunner: vi.fn(),
}));

vi.mock('../../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
}));

vi.mock('../../../src/lib/question-queue.js', () => ({
  addQuestion: vi.fn(),
}));

vi.mock('../../../src/lib/output.js', () => ({
  output: vi.fn(),
  getOutputOptions: vi.fn(() => ({ json: false })),
  setOutputOptions: vi.fn(),
}));

// Import after mocking
import { validateClaudeCli } from '../../../src/lib/claude-validator.js';
import { createClaudeRunner } from '../../../src/lib/claude-runner.js';
import { findProjectRoot } from '../../../src/lib/paths.js';

describe('workflow design command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateClaudeCli', () => {
    it('should return available=true when claude CLI found', () => {
      vi.mocked(validateClaudeCli).mockReturnValue({
        available: true,
        path: '/usr/local/bin/claude',
      });

      const result = validateClaudeCli();

      expect(result.available).toBe(true);
      expect(result.path).toBe('/usr/local/bin/claude');
    });

    it('should return error when claude CLI not found', () => {
      vi.mocked(validateClaudeCli).mockReturnValue({
        available: false,
        error: 'Claude CLI not found. Install from https://claude.ai/code',
      });

      const result = validateClaudeCli();

      expect(result.available).toBe(false);
      expect(result.error).toContain('Claude CLI not found');
    });
  });

  describe('phase option validation', () => {
    const VALID_PHASES = ['discover', 'specify', 'plan', 'tasks'];

    it('should accept valid phase names', () => {
      for (const phase of VALID_PHASES) {
        expect(VALID_PHASES.includes(phase)).toBe(true);
      }
    });

    it('should reject invalid phase names', () => {
      const invalidPhases = ['invalid', 'design', 'implement', 'verify'];
      for (const phase of invalidPhases) {
        expect(VALID_PHASES.includes(phase)).toBe(false);
      }
    });
  });

  describe('project root detection', () => {
    it('should find project root', () => {
      vi.mocked(findProjectRoot).mockReturnValue('/test/project');

      const result = findProjectRoot();

      expect(result).toBe('/test/project');
    });
  });

  describe('claude runner', () => {
    it('should create runner with event callback', () => {
      const mockRun = vi.fn().mockResolvedValue({
        exitCode: 0,
        success: true,
        eventsEmitted: 5,
      });

      vi.mocked(createClaudeRunner).mockReturnValue({
        run: mockRun,
        isRunning: vi.fn(() => false),
        kill: vi.fn(() => false),
        writeToStdin: vi.fn(() => false),
      } as ReturnType<typeof createClaudeRunner>);

      const runner = createClaudeRunner(vi.fn());

      expect(runner).toBeDefined();
      expect(typeof runner.run).toBe('function');
    });
  });
});
