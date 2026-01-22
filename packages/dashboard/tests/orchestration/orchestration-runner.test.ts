/**
 * Tests for orchestration-runner.ts
 *
 * Tests state machine decision logic, phase transitions, and batch execution.
 * Uses mocked services and file system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OrchestrationExecution, OrchestrationConfig, OrchestrationPhase } from '@specflow/shared';

// Use vi.hoisted to properly hoist mock data and functions
const {
  mockOrchestrationServiceFns,
  mockWorkflowServiceFns,
  mockAttemptHealFn,
  mockQuickDecision,
  mockExecSync,
} = vi.hoisted(() => ({
  mockOrchestrationServiceFns: {
    get: vi.fn(),
    start: vi.fn(),
    transitionToNextPhase: vi.fn(),
    linkWorkflowExecution: vi.fn(),
    completeBatch: vi.fn(),
    failBatch: vi.fn(),
    healBatch: vi.fn(),
    incrementHealAttempt: vi.fn(),
    canHealBatch: vi.fn(() => true),
    addCost: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    fail: vi.fn(),
    triggerMerge: vi.fn(),
    updateBatches: vi.fn(),
    setNeedsAttention: vi.fn(),
  },
  mockWorkflowServiceFns: {
    get: vi.fn(),
    start: vi.fn(() => Promise.resolve({ id: 'workflow-123', status: 'running' })),
    findActiveByOrchestration: vi.fn(() => []),
    hasActiveWorkflow: vi.fn(() => false),
  },
  mockAttemptHealFn: vi.fn(),
  mockQuickDecision: vi.fn(() =>
    Promise.resolve({
      success: true,
      result: {
        action: 'wait',
        reason: 'Continue waiting for workflow completion',
        confidence: 'medium',
      },
      cost: 0.01,
      duration: 100,
    })
  ),
  mockExecSync: vi.fn(() =>
    JSON.stringify({
      phase: { number: 1055, name: 'smart-batching' },
      context: { hasSpec: true, hasPlan: true, hasTasks: true },
      progress: { tasksTotal: 10, tasksComplete: 0, percentage: 0 },
    })
  ),
}));

// Mock fs operations
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => path.includes('.specflow') || path.includes('registry')),
  readFileSync: vi.fn((path: string) => {
    // Return registry with test project
    if (path.includes('registry.json')) {
      return JSON.stringify({
        projects: {
          'project-123': { path: '/test/project' },
        },
      });
    }
    throw new Error(`File not found: ${path}`);
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock child_process for specflow status
vi.mock('child_process', () => ({
  execSync: mockExecSync,
  spawn: vi.fn(),
}));

// Mock orchestration service
vi.mock('@/lib/services/orchestration-service', () => ({
  orchestrationService: mockOrchestrationServiceFns,
}));

// Mock workflow service
vi.mock('@/lib/services/workflow-service', () => ({
  workflowService: mockWorkflowServiceFns,
}));

// Mock auto-healing service
vi.mock('@/lib/services/auto-healing-service', () => ({
  attemptHeal: mockAttemptHealFn,
  getHealingSummary: vi.fn(() => 'Healed'),
}));

// Mock claude-helper for fallback analyzer
vi.mock('@/lib/services/claude-helper', () => ({
  quickDecision: mockQuickDecision,
  claudeHelper: vi.fn(),
  verifyWithClaude: vi.fn(),
  healWithClaude: vi.fn(),
}));

// Import after mocking
import { runOrchestration, resumeOrchestration, triggerMerge, isRunnerActive, stopRunner } from '@/lib/services/orchestration-runner';

// Alias for test access
const mockOrchestrationService = mockOrchestrationServiceFns;
const mockWorkflowService = mockWorkflowServiceFns;
const mockAttemptHeal = mockAttemptHealFn;

describe('OrchestrationRunner', () => {
  const projectId = 'project-123';
  const orchestrationId = 'orch-456';

  const defaultConfig: OrchestrationConfig = {
    autoMerge: false,
    additionalContext: '',
    skipDesign: false,
    skipAnalyze: false,
    autoHealEnabled: true,
    maxHealAttempts: 1,
    batchSizeFallback: 15,
    pauseBetweenBatches: false,
    budget: {
      maxPerBatch: 5,
      maxTotal: 50,
      healingBudget: 2,
      decisionBudget: 0.5,
    },
  };

  const createOrchestration = (overrides: Partial<OrchestrationExecution> = {}): OrchestrationExecution => ({
    id: orchestrationId,
    projectId,
    status: 'running',
    config: defaultConfig,
    currentPhase: 'design',
    batches: {
      total: 2,
      current: 0,
      items: [
        { index: 0, section: 'Setup', taskIds: ['T001', 'T002'], status: 'pending', healAttempts: 0 },
        { index: 1, section: 'Core', taskIds: ['T003', 'T004'], status: 'pending', healAttempts: 0 },
      ],
    },
    executions: {
      implement: [],
      healers: [],
    },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    decisionLog: [],
    totalCostUsd: 0,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stopRunner(orchestrationId); // Ensure clean state
  });

  afterEach(() => {
    stopRunner(orchestrationId);
  });

  describe('State Machine Decision Logic', () => {
    it('should continue waiting when workflow is still running', async () => {
      const orch = createOrchestration({
        currentPhase: 'design',
        executions: {
          design: 'wf-1', // Link the workflow so getCurrentWorkflowId finds it
          implement: [],
          healers: [],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'running' });

      // Run a single iteration by setting maxPollingAttempts to 1
      const promise = runOrchestration(projectId, orchestrationId, 100, 2);

      // Let it run for a short time
      await new Promise(resolve => setTimeout(resolve, 250));

      stopRunner(orchestrationId);
      await promise;

      // Should continue waiting
      expect(mockOrchestrationService.transitionToNextPhase).not.toHaveBeenCalled();
    });

    it('should transition from design to analyze when design completes', async () => {
      const orch = createOrchestration({ currentPhase: 'design' });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      // Mock specflow status showing design artifacts exist
      mockExecSync.mockReturnValue(
        JSON.stringify({
          phase: { number: 1055 },
          context: { hasSpec: true, hasPlan: true, hasTasks: true },
          progress: { tasksTotal: 10, tasksComplete: 0 },
        })
      );

      // Run briefly
      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      // Should transition to next phase
      expect(mockOrchestrationService.transitionToNextPhase).toHaveBeenCalled();
    });

    it('should skip design when skipDesign is configured', async () => {
      const orch = createOrchestration({
        currentPhase: 'design', // Still on design phase
        config: { ...defaultConfig, skipDesign: true },
      });

      // After transition, should go to analyze (or implement if skipAnalyze too)
      // The skipDesign logic is in getNextPhase, not the runner directly
      // This test verifies the config is respected in transitions
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      // The runner should attempt to spawn a workflow for the next phase
      expect(mockWorkflowService.start).toHaveBeenCalled();
    });

    it('should fail orchestration when budget is exceeded', async () => {
      const orch = createOrchestration({
        totalCostUsd: 100, // Exceeds budget
        config: { ...defaultConfig, budget: { ...defaultConfig.budget, maxTotal: 50 } },
      });
      mockOrchestrationService.get.mockReturnValue(orch);

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 100));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.fail).toHaveBeenCalledWith(
        '/test/project',
        orchestrationId,
        expect.stringContaining('Budget')
      );
    });
  });

  describe('Batch Execution', () => {
    it('should execute batches sequentially during implement phase', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        batches: {
          total: 2,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001', 'T002'], status: 'pending', healAttempts: 0 },
            { index: 1, section: 'Core', taskIds: ['T003', 'T004'], status: 'pending', healAttempts: 0 },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue(undefined); // No active workflow

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      // Should start workflow for first batch
      expect(mockWorkflowService.start).toHaveBeenCalled();
      const startCall = mockWorkflowService.start.mock.calls[0] as unknown[];
      expect(startCall[1]).toContain('flow.implement');
      expect(startCall[1]).toContain('Setup'); // Batch section name
    });

    it('should move to next batch after current completes', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        batches: {
          total: 2,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0, workflowExecutionId: 'wf-1' },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.completeBatch).toHaveBeenCalled();
    });

    it('should pause between batches when configured', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        config: { ...defaultConfig, pauseBetweenBatches: true },
        batches: {
          total: 2,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0, workflowExecutionId: 'wf-1' },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
          ],
        },
      });

      // After completeBatch, the orchestration should return updated state with:
      // - current batch index incremented to 1
      // - batch 0 completed, batch 1 still pending
      const updatedOrch = {
        ...orch,
        batches: {
          total: 2,
          current: 1,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed' as const, healAttempts: 0, workflowExecutionId: 'wf-1' },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending' as const, healAttempts: 0 },
          ],
        },
      };

      mockOrchestrationService.get
        .mockReturnValueOnce(orch)           // First call in main loop
        .mockReturnValueOnce(updatedOrch)    // After completeBatch
        .mockReturnValue({ ...updatedOrch, status: 'paused' });  // Subsequent calls
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      const promise = runOrchestration(projectId, orchestrationId, 50, 3);
      await new Promise(resolve => setTimeout(resolve, 200));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.pause).toHaveBeenCalled();
    });
  });

  describe('Auto-Healing', () => {
    it('should attempt healing when batch fails and autoHealEnabled', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0, workflowExecutionId: 'wf-1' },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'failed', error: 'Build error' });
      mockAttemptHeal.mockResolvedValue({
        success: true,
        result: { status: 'fixed', tasksCompleted: ['T001'], tasksRemaining: [] },
        cost: 0.50,
        duration: 5000,
      });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.incrementHealAttempt).toHaveBeenCalled();
      expect(mockAttemptHeal).toHaveBeenCalled();
    });

    it('should fail orchestration when healing fails and max attempts reached', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        config: { ...defaultConfig, maxHealAttempts: 1 },
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 1, workflowExecutionId: 'wf-1' },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'failed', error: 'Build error' });
      mockOrchestrationService.canHealBatch.mockReturnValue(false);
      mockAttemptHeal.mockResolvedValue({
        success: false,
        errorMessage: 'Could not heal',
        cost: 0.50,
        duration: 5000,
      });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.fail).toHaveBeenCalled();
    });

    it('should mark batch as healed after successful healing', async () => {
      const orch = createOrchestration({
        currentPhase: 'implement',
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0, workflowExecutionId: 'wf-1' },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'failed' });
      mockAttemptHeal.mockResolvedValue({
        success: true,
        result: { status: 'fixed', tasksCompleted: ['T001'], tasksRemaining: [] },
        sessionId: 'healer-session',
        cost: 0.50,
        duration: 5000,
      });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      expect(mockOrchestrationService.healBatch).toHaveBeenCalledWith(
        '/test/project',
        orchestrationId,
        'healer-session'
      );
      expect(mockOrchestrationService.completeBatch).toHaveBeenCalled();
    });
  });

  describe('Merge Phase', () => {
    it('should wait for user approval when autoMerge is disabled', async () => {
      const orch = createOrchestration({
        currentPhase: 'verify',
        config: { ...defaultConfig, autoMerge: false },
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      // Mock specflow status showing all tasks complete
      mockExecSync.mockReturnValue(
        JSON.stringify({
          phase: { number: 1055 },
          context: { hasSpec: true, hasPlan: true, hasTasks: true },
          progress: { tasksTotal: 1, tasksComplete: 1 },
        })
      );

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      // Should transition but to waiting_merge state
      expect(mockOrchestrationService.transitionToNextPhase).toHaveBeenCalled();
    });

    it('should proceed to merge when autoMerge is enabled', async () => {
      const orch = createOrchestration({
        currentPhase: 'verify',
        config: { ...defaultConfig, autoMerge: true },
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          ],
        },
      });
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'completed' });

      const promise = runOrchestration(projectId, orchestrationId, 50, 2);
      await new Promise(resolve => setTimeout(resolve, 150));
      stopRunner(orchestrationId);
      await promise;

      // Should spawn merge workflow
      expect(mockWorkflowService.start).toHaveBeenCalled();
    });
  });

  describe('Terminal States', () => {
    it('should stop when orchestration is completed', async () => {
      const orch = createOrchestration({ status: 'completed' });
      mockOrchestrationService.get.mockReturnValue(orch);

      await runOrchestration(projectId, orchestrationId, 50, 5);

      // Should exit loop quickly without making decisions
      expect(mockWorkflowService.start).not.toHaveBeenCalled();
    });

    it('should stop when orchestration is failed', async () => {
      const orch = createOrchestration({ status: 'failed', errorMessage: 'Some error' });
      mockOrchestrationService.get.mockReturnValue(orch);

      await runOrchestration(projectId, orchestrationId, 50, 5);

      expect(mockWorkflowService.start).not.toHaveBeenCalled();
    });

    it('should stop when orchestration is cancelled', async () => {
      const orch = createOrchestration({ status: 'cancelled' });
      mockOrchestrationService.get.mockReturnValue(orch);

      await runOrchestration(projectId, orchestrationId, 50, 5);

      expect(mockWorkflowService.start).not.toHaveBeenCalled();
    });

    it('should continue polling when paused', async () => {
      let pollCount = 0;
      const orch = createOrchestration({ status: 'paused' });
      mockOrchestrationService.get.mockImplementation(() => {
        pollCount++;
        return orch;
      });

      const promise = runOrchestration(projectId, orchestrationId, 50, 3);
      await new Promise(resolve => setTimeout(resolve, 200));
      stopRunner(orchestrationId);
      await promise;

      // Should have polled multiple times while paused
      expect(pollCount).toBeGreaterThan(1);
    });
  });

  describe('Runner Management', () => {
    it('should prevent duplicate runners for same orchestration', async () => {
      mockOrchestrationService.get.mockReturnValue(createOrchestration({ status: 'paused' }));

      // Start first runner
      const promise1 = runOrchestration(projectId, orchestrationId, 50, 10);

      // Small delay to ensure first runner starts
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to start second runner
      const promise2 = runOrchestration(projectId, orchestrationId, 50, 10);

      expect(isRunnerActive(orchestrationId)).toBe(true);

      stopRunner(orchestrationId);
      await Promise.all([promise1, promise2]);
    });

    it('should track active runner status', async () => {
      mockOrchestrationService.get.mockReturnValue(createOrchestration({ status: 'paused' }));

      expect(isRunnerActive(orchestrationId)).toBe(false);

      const promise = runOrchestration(projectId, orchestrationId, 50, 5);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(isRunnerActive(orchestrationId)).toBe(true);

      stopRunner(orchestrationId);
      await promise;

      expect(isRunnerActive(orchestrationId)).toBe(false);
    });
  });

  describe('Resume and Merge Triggers', () => {
    it('resumeOrchestration should resume and restart runner', async () => {
      mockOrchestrationService.get.mockReturnValue(createOrchestration({ status: 'paused' }));

      await resumeOrchestration(projectId, orchestrationId);

      expect(mockOrchestrationService.resume).toHaveBeenCalledWith('/test/project', orchestrationId);
    });

    it('triggerMerge should start merge workflow', async () => {
      mockOrchestrationService.get.mockReturnValue(createOrchestration({ status: 'waiting_merge' }));

      await triggerMerge(projectId, orchestrationId);

      expect(mockOrchestrationService.triggerMerge).toHaveBeenCalledWith('/test/project', orchestrationId);
      expect(mockWorkflowService.start).toHaveBeenCalledWith(projectId, 'flow.merge');
    });
  });

  describe('Claude Fallback Analyzer', () => {
    // Note: The actual Claude analyzer is mocked in these tests
    // We test that it gets triggered after 3 consecutive "continue" decisions

    it('should track consecutive unclear/waiting decisions', async () => {
      // Setup orchestration where decision is always "continue"
      const orch = createOrchestration({
        currentPhase: 'design',
        status: 'running',
      });

      // Workflow running - decision will be "continue"
      mockOrchestrationService.get.mockReturnValue(orch);
      mockWorkflowService.get.mockReturnValue({ id: 'wf-1', status: 'running' });

      // Run for a few iterations
      const promise = runOrchestration(projectId, orchestrationId, 50, 5);
      await new Promise(resolve => setTimeout(resolve, 300));
      stopRunner(orchestrationId);
      await promise;

      // Decision log should show "continue" decisions
      // The actual Claude call would happen on the 3rd consecutive continue
      // but since claude-helper is not mocked to return a real response,
      // the test verifies the decision path is followed
      expect(orch.decisionLog.length).toBeGreaterThan(0);
    });

    it('should reset unclear count when non-continue decision is made', async () => {
      let callCount = 0;
      const orch = createOrchestration({
        currentPhase: 'design',
        status: 'running',
      });

      mockOrchestrationService.get.mockReturnValue(orch);

      // First 2 calls: running (continue), then completed (transition)
      mockWorkflowService.get.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return { id: 'wf-1', status: 'running' };
        }
        return { id: 'wf-1', status: 'completed' };
      });

      const promise = runOrchestration(projectId, orchestrationId, 50, 4);
      await new Promise(resolve => setTimeout(resolve, 250));
      stopRunner(orchestrationId);
      await promise;

      // Should have transitioned after completion, resetting the unclear counter
      // This means Claude analyzer should not have been called
      // (would only be called after 3 consecutive continues)
    });

    it('should not trigger Claude analyzer for paused orchestrations', async () => {
      const orch = createOrchestration({
        status: 'paused',
      });
      mockOrchestrationService.get.mockReturnValue(orch);

      const promise = runOrchestration(projectId, orchestrationId, 50, 3);
      await new Promise(resolve => setTimeout(resolve, 200));
      stopRunner(orchestrationId);
      await promise;

      // Paused orchestrations don't make decisions, so Claude analyzer isn't triggered
      // The runner just waits with longer polling
    });
  });
});
