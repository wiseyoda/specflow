/**
 * Tests for orchestration-service.ts
 *
 * Tests the orchestration state machine and phase transitions.
 * NOTE: Uses mocked file system and specflow CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import type { OrchestrationConfig, BatchTracking, BatchPlan } from '@specflow/shared';

// Mock fs operations
const mockFiles = new Map<string, string>();

vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => mockFiles.has(path) || path.includes('.specflow')),
  readFileSync: vi.fn((path: string) => {
    if (mockFiles.has(path)) {
      return mockFiles.get(path);
    }
    throw new Error(`File not found: ${path}`);
  }),
  writeFileSync: vi.fn((path: string, content: string) => {
    mockFiles.set(path, content);
  }),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn((path: string) => {
    // Return orchestration files or spec phase dirs depending on path
    if (path.includes('workflows')) {
      const files: string[] = [];
      mockFiles.forEach((_, key) => {
        if (key.includes('orchestration-') && key.endsWith('.json')) {
          files.push(key.split('/').pop() || '');
        }
      });
      return files;
    }
    if (path.includes('specs')) {
      return [{ isDirectory: () => true, name: '1055-smart-batching' }];
    }
    return [];
  }),
  renameSync: vi.fn((oldPath: string, newPath: string) => {
    // For atomic writes: copy content from temp to final path
    if (mockFiles.has(oldPath)) {
      mockFiles.set(newPath, mockFiles.get(oldPath)!);
      mockFiles.delete(oldPath);
    }
  }),
  unlinkSync: vi.fn((path: string) => {
    mockFiles.delete(path);
  }),
}));

// Mock child_process for specflow status
vi.mock('child_process', () => ({
  execSync: vi.fn(() =>
    JSON.stringify({
      phase: { number: 1055, name: 'smart-batching', dir: 'specs/1055-smart-batching' },
      context: { hasSpec: true, hasPlan: true, hasTasks: true },
      progress: { tasksTotal: 10, tasksComplete: 0, percentage: 0 },
    })
  ),
  spawn: vi.fn(),
}));

// Mock batch-parser
vi.mock('@/lib/services/batch-parser', () => ({
  parseBatchesFromProject: vi.fn(() => ({
    batches: [
      { name: 'Phase 1', taskIds: ['T001', 'T002', 'T003'], incompleteCount: 3 },
      { name: 'Phase 2', taskIds: ['T004', 'T005'], incompleteCount: 2 },
    ],
    usedFallback: false,
    totalIncomplete: 5,
  })),
  createBatchTracking: vi.fn(() => ({
    total: 2,
    current: 0,
    items: [
      { index: 0, section: 'Phase 1', taskIds: ['T001', 'T002', 'T003'], status: 'pending', healAttempts: 0 },
      { index: 1, section: 'Phase 2', taskIds: ['T004', 'T005'], status: 'pending', healAttempts: 0 },
    ],
  })),
}));

// Import after mocking
import { orchestrationService } from '@/lib/services/orchestration-service';

describe('OrchestrationService', () => {
  const projectPath = '/tmp/test-project';
  const projectId = 'test-project-id';

  // Mock batch plan to pass to start method
  const mockBatchPlan: BatchPlan = {
    batches: [
      { name: 'Phase 1', taskIds: ['T001', 'T002', 'T003'], incompleteCount: 3 },
      { name: 'Phase 2', taskIds: ['T004', 'T005'], incompleteCount: 2 },
    ],
    usedFallback: false,
    totalIncomplete: 5,
  };

  const defaultConfig: OrchestrationConfig = {
    skipDesign: true,
    skipAnalyze: true,
    autoMerge: false,
    additionalContext: '',
    autoHealEnabled: true,
    maxHealAttempts: 2,
    batchSizeFallback: 15,
    pauseBetweenBatches: false,
    budget: {
      maxPerBatch: 5.0,
      maxTotal: 10.0,
      healingBudget: 2.0,
      decisionBudget: 0.5,
    },
  };

  beforeEach(() => {
    mockFiles.clear();
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should create new orchestration with initial state', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      expect(execution.id).toBeDefined();
      expect(execution.projectId).toBe(projectId);
      expect(execution.status).toBe('running');
      // With skipDesign=true and skipAnalyze=true, starts at 'implement'
      expect(execution.currentPhase).toBe('implement');
      expect(execution.config).toEqual(defaultConfig);
      expect(execution.batches.total).toBe(2);
      expect(execution.batches.current).toBe(0);
      expect(execution.decisionLog.length).toBeGreaterThan(0);
    });

    it('should start at design when skipDesign is false', async () => {
      const designConfig = { ...defaultConfig, skipDesign: false, skipAnalyze: false };
      const execution = await orchestrationService.start(projectId, projectPath, designConfig, mockBatchPlan);

      expect(execution.currentPhase).toBe('design');
    });

    it('should throw error if orchestration already active', async () => {
      // Start first orchestration
      await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      // Try to start second
      await expect(
        orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan)
      ).rejects.toThrow('Orchestration already in progress');
    });
  });

  describe('get and getActive', () => {
    it('should retrieve orchestration by ID', async () => {
      const started = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      const retrieved = orchestrationService.get(projectPath, started.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(started.id);
    });

    it('should return null for non-existent ID', () => {
      const retrieved = orchestrationService.get(projectPath, 'non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should find active orchestration', async () => {
      const started = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      const active = orchestrationService.getActive(projectPath);

      expect(active).toBeDefined();
      expect(active?.id).toBe(started.id);
    });

    it('should return null when no active orchestration', () => {
      const active = orchestrationService.getActive(projectPath);
      expect(active).toBeNull();
    });
  });

  describe('phase transitions', () => {
    it('should transition to next phase', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      // With skipDesign=true, skipAnalyze=true, starts at 'implement'
      // Transition should go from implement to verify
      const updated = orchestrationService.transitionToNextPhase(projectPath, execution.id);

      expect(updated).toBeDefined();
      expect(updated?.currentPhase).toBe('verify');
    });

    it('should set waiting_merge when auto-merge disabled', async () => {
      const config = { ...defaultConfig, skipDesign: true, skipAnalyze: true, autoMerge: false };
      const execution = await orchestrationService.start(projectId, projectPath, config, mockBatchPlan);

      // Starts at implement, then:
      // Transition 1: implement -> verify
      orchestrationService.transitionToNextPhase(projectPath, execution.id);
      // Transition 2: verify -> merge (with waiting_merge status)
      const atMerge = orchestrationService.transitionToNextPhase(projectPath, execution.id);

      // Should be waiting_merge since auto-merge is disabled
      expect(atMerge?.currentPhase).toBe('merge');
      expect(atMerge?.status).toBe('waiting_merge');
    });
  });

  describe('batch operations', () => {
    it('should link workflow execution to current batch', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      orchestrationService.transitionToNextPhase(projectPath, execution.id);
      orchestrationService.transitionToNextPhase(projectPath, execution.id);

      // Move to implement phase
      const updated = orchestrationService.get(projectPath, execution.id);
      if (updated?.currentPhase === 'implement') {
        const workflowId = 'workflow-123';
        const linked = orchestrationService.linkWorkflowExecution(
          projectPath,
          execution.id,
          workflowId
        );

        expect(linked?.executions.implement).toContain(workflowId);
        expect(linked?.batches.items[0].workflowExecutionId).toBe(workflowId);
        expect(linked?.batches.items[0].status).toBe('running');
      }
    });

    it('should complete batch and move to next', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      // Complete first batch
      const afterComplete = orchestrationService.completeBatch(projectPath, execution.id);

      expect(afterComplete?.batches.items[0].status).toBe('completed');
      expect(afterComplete?.batches.current).toBe(1); // Moved to second batch
    });

    it('should mark batch as failed', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      const afterFail = orchestrationService.failBatch(
        projectPath,
        execution.id,
        'Tests failed'
      );

      expect(afterFail?.batches.items[0].status).toBe('failed');
    });

    it('should heal batch and mark as healed', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      const healerId = 'healer-workflow-456';
      const afterHeal = orchestrationService.healBatch(projectPath, execution.id, healerId);

      expect(afterHeal?.batches.items[0].status).toBe('healed');
      expect(afterHeal?.batches.items[0].healerExecutionId).toBe(healerId);
      expect(afterHeal?.executions.healers).toContain(healerId);
    });

    it('should check if batch can be healed', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      // Initially can heal (0 attempts < maxHealAttempts)
      expect(orchestrationService.canHealBatch(projectPath, execution.id)).toBe(true);

      // Increment attempts
      orchestrationService.incrementHealAttempt(projectPath, execution.id);
      orchestrationService.incrementHealAttempt(projectPath, execution.id);

      // Now at max attempts, cannot heal
      expect(orchestrationService.canHealBatch(projectPath, execution.id)).toBe(false);
    });
  });

  describe('pause, resume, cancel', () => {
    it('should pause running orchestration', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      const paused = orchestrationService.pause(projectPath, execution.id);

      expect(paused?.status).toBe('paused');
    });

    it('should resume paused orchestration', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      orchestrationService.pause(projectPath, execution.id);

      const resumed = orchestrationService.resume(projectPath, execution.id);

      expect(resumed?.status).toBe('running');
    });

    it('should not pause non-running orchestration', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      orchestrationService.cancel(projectPath, execution.id);

      const result = orchestrationService.pause(projectPath, execution.id);

      expect(result).toBeNull();
    });

    it('should cancel orchestration', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      const cancelled = orchestrationService.cancel(projectPath, execution.id);

      expect(cancelled?.status).toBe('cancelled');
    });
  });

  describe('trigger merge', () => {
    it('should trigger merge from waiting_merge status', async () => {
      const config = { ...defaultConfig, autoMerge: false };
      const execution = await orchestrationService.start(projectId, projectPath, config, mockBatchPlan);

      // Manually set to waiting_merge for test
      const exec = orchestrationService.get(projectPath, execution.id);
      if (exec) {
        exec.status = 'waiting_merge';
        exec.currentPhase = 'merge';
        mockFiles.set(
          `/tmp/test-project/.specflow/workflows/orchestration-${execution.id}.json`,
          JSON.stringify(exec)
        );
      }

      const triggered = orchestrationService.triggerMerge(projectPath, execution.id);

      expect(triggered?.status).toBe('running');
    });
  });

  describe('budget tracking', () => {
    it('should track total cost', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      orchestrationService.addCost(projectPath, execution.id, 0.5);
      orchestrationService.addCost(projectPath, execution.id, 0.3);

      const updated = orchestrationService.get(projectPath, execution.id);
      expect(updated?.totalCostUsd).toBe(0.8);
    });

    it('should detect budget exceeded', async () => {
      const config = { ...defaultConfig, budget: { ...defaultConfig.budget, maxTotal: 1.0 } };
      const execution = await orchestrationService.start(projectId, projectPath, config, mockBatchPlan);

      // Add cost under budget
      orchestrationService.addCost(projectPath, execution.id, 0.5);
      expect(orchestrationService.isBudgetExceeded(projectPath, execution.id)).toBe(false);

      // Add cost to exceed budget
      orchestrationService.addCost(projectPath, execution.id, 0.6);
      expect(orchestrationService.isBudgetExceeded(projectPath, execution.id)).toBe(true);
    });
  });

  describe('decision logging', () => {
    it('should log decisions with timestamps', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      expect(execution.decisionLog.length).toBeGreaterThan(0);
      expect(execution.decisionLog[0].timestamp).toBeDefined();
      expect(execution.decisionLog[0].decision).toBe('start');
      expect(execution.decisionLog[0].reason).toContain('User initiated');
    });

    it('should log transition decisions', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      orchestrationService.transitionToNextPhase(projectPath, execution.id);

      const updated = orchestrationService.get(projectPath, execution.id);
      const transitionLog = updated?.decisionLog.find((d) => d.decision === 'transition');

      expect(transitionLog).toBeDefined();
      expect(transitionLog?.reason).toContain('from');
      expect(transitionLog?.reason).toContain('to');
    });
  });

  describe('getCurrentSkill', () => {
    it('should return correct skill for each phase', async () => {
      // With skipDesign=true, skipAnalyze=true, starts at 'implement'
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);

      expect(orchestrationService.getCurrentSkill(projectPath, execution.id)).toBe('/flow.implement');
    });

    it('should return design skill when starting at design phase', async () => {
      const designConfig = { ...defaultConfig, skipDesign: false, skipAnalyze: false };
      const execution = await orchestrationService.start(projectId, projectPath, designConfig, mockBatchPlan);

      expect(orchestrationService.getCurrentSkill(projectPath, execution.id)).toBe('/flow.design');
    });
  });

  describe('getCurrentBatch', () => {
    it('should return current batch info', async () => {
      const execution = await orchestrationService.start(projectId, projectPath, defaultConfig, mockBatchPlan);
      const batch = orchestrationService.getCurrentBatch(projectPath, execution.id);

      expect(batch).toBeDefined();
      expect(batch?.index).toBe(0);
      expect(batch?.total).toBe(2);
      expect(batch?.section).toBe('Phase 1');
      expect(batch?.taskIds).toEqual(['T001', 'T002', 'T003']);
      expect(batch?.status).toBe('pending');
    });
  });
});
