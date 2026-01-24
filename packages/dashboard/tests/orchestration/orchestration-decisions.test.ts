/**
 * Tests for orchestration-decisions.ts
 *
 * These tests verify the pure decision logic extracted from orchestration-runner.ts.
 * Each test covers a specific condition from the decision matrix (G1.x, G2.x goals).
 */

import { describe, it, expect } from 'vitest';
import {
  makeDecision,
  handleImplementBatching,
  getSkillForStep,
  getNextStep,
  calculateExponentialBackoff,
  areAllBatchesComplete,
  STALE_THRESHOLD_MS,
  type DecisionInput,
  type WorkflowState,
} from '../../src/lib/services/orchestration-decisions';
import type { OrchestrationExecution } from '@specflow/shared';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockExecution(overrides: Partial<OrchestrationExecution> = {}): OrchestrationExecution {
  return {
    id: 'test-orch-id',
    projectId: 'test-project',
    status: 'running',
    config: {
      autoMerge: false,
      skipDesign: false,
      skipAnalyze: false,
      autoHealEnabled: true,
      maxHealAttempts: 3,
      pauseBetweenBatches: false,
      batchSizeFallback: 10,
      additionalContext: '',
      budget: {
        maxTotal: 50,
        maxPerBatch: 5,
        healingBudget: 5,
        decisionBudget: 2,
      },
    },
    currentPhase: 'implement',
    batches: {
      total: 0,
      current: 0,
      items: [],
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
  };
}

function createMockInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    step: {
      current: 'implement',
      index: 2,
      status: 'in_progress',
    },
    phase: {},
    execution: createMockExecution(),
    workflow: null,
    ...overrides,
  };
}

function createMockWorkflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'test-workflow-id',
    status: 'running',
    ...overrides,
  };
}

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('getSkillForStep', () => {
  it('returns correct skill for each step', () => {
    expect(getSkillForStep('design')).toBe('flow.design');
    expect(getSkillForStep('analyze')).toBe('flow.analyze');
    expect(getSkillForStep('implement')).toBe('flow.implement');
    expect(getSkillForStep('verify')).toBe('flow.verify');
    expect(getSkillForStep('merge')).toBe('flow.merge');
  });

  it('returns flow.implement for unknown step', () => {
    expect(getSkillForStep('unknown')).toBe('flow.implement');
  });
});

describe('getNextStep', () => {
  it('returns correct next step', () => {
    expect(getNextStep('design')).toBe('analyze');
    expect(getNextStep('analyze')).toBe('implement');
    expect(getNextStep('implement')).toBe('verify');
    expect(getNextStep('verify')).toBe('merge');
  });

  it('returns null for merge (last step)', () => {
    expect(getNextStep('merge')).toBeNull();
  });

  it('returns null for unknown step', () => {
    expect(getNextStep('unknown')).toBeNull();
  });
});

describe('calculateExponentialBackoff', () => {
  it('calculates backoff correctly', () => {
    expect(calculateExponentialBackoff(0)).toBe(1000);   // 1s
    expect(calculateExponentialBackoff(1)).toBe(2000);   // 2s
    expect(calculateExponentialBackoff(2)).toBe(4000);   // 4s
    expect(calculateExponentialBackoff(3)).toBe(8000);   // 8s
    expect(calculateExponentialBackoff(4)).toBe(16000);  // 16s
  });

  it('caps at 30 seconds', () => {
    expect(calculateExponentialBackoff(5)).toBe(30000);
    expect(calculateExponentialBackoff(10)).toBe(30000);
  });
});

describe('areAllBatchesComplete', () => {
  it('returns false for empty batches', () => {
    expect(areAllBatchesComplete({ total: 0, current: 0, items: [] })).toBe(false);
  });

  it('returns true when all batches completed', () => {
    const batches = {
      total: 2,
      current: 1,
      items: [
        { index: 0, section: 'A', taskIds: ['T001'], status: 'completed' as const, healAttempts: 0 },
        { index: 1, section: 'B', taskIds: ['T002'], status: 'completed' as const, healAttempts: 0 },
      ],
    };
    expect(areAllBatchesComplete(batches)).toBe(true);
  });

  it('returns true when all batches healed', () => {
    const batches = {
      total: 2,
      current: 1,
      items: [
        { index: 0, section: 'A', taskIds: ['T001'], status: 'healed' as const, healAttempts: 1 },
        { index: 1, section: 'B', taskIds: ['T002'], status: 'healed' as const, healAttempts: 1 },
      ],
    };
    expect(areAllBatchesComplete(batches)).toBe(true);
  });

  it('returns false when some batches pending', () => {
    const batches = {
      total: 2,
      current: 0,
      items: [
        { index: 0, section: 'A', taskIds: ['T001'], status: 'completed' as const, healAttempts: 0 },
        { index: 1, section: 'B', taskIds: ['T002'], status: 'pending' as const, healAttempts: 0 },
      ],
    };
    expect(areAllBatchesComplete(batches)).toBe(false);
  });
});

// =============================================================================
// Pre-Decision Gates Tests (G1.1, G1.2)
// =============================================================================

describe('makeDecision - Pre-Decision Gates', () => {
  it('G1.1: returns fail when budget exceeded', () => {
    const execution = createMockExecution({
      totalCostUsd: 60, // Exceeds maxTotal of 50
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('fail');
    expect(result.reason).toContain('Budget exceeded');
    expect(result.errorMessage).toContain('Budget limit exceeded');
  });

  it('G1.1: does not fail when under budget', () => {
    const execution = createMockExecution({
      totalCostUsd: 10,
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
      workflow: createMockWorkflow({ status: 'running' }),
      lastFileChangeTime: Date.now() - 1000,
    });

    const result = makeDecision(input);
    expect(result.action).not.toBe('fail');
  });

  it('G1.2: returns needs_attention when duration exceeds 4 hours', () => {
    const fourHoursAgo = Date.now() - (5 * 60 * 60 * 1000); // 5 hours ago
    const execution = createMockExecution({
      startedAt: new Date(fourHoursAgo).toISOString(),
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
      currentTime: Date.now(),
    });

    const result = makeDecision(input);
    expect(result.action).toBe('needs_attention');
    expect(result.reason).toContain('too long');
    expect(result.recoveryOptions).toContain('abort');
  });

  it('G1.2: does not fail when under 4 hours', () => {
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    const execution = createMockExecution({
      startedAt: new Date(twoHoursAgo).toISOString(),
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
      workflow: createMockWorkflow({ status: 'running' }),
      lastFileChangeTime: Date.now() - 1000,
      currentTime: Date.now(),
    });

    const result = makeDecision(input);
    expect(result.action).not.toBe('needs_attention');
  });

  it('G1.1 takes precedence over G1.2 (budget check first)', () => {
    const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
    const execution = createMockExecution({
      totalCostUsd: 60, // Over budget
      startedAt: new Date(fiveHoursAgo).toISOString(), // Also over time
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
      currentTime: Date.now(),
    });

    const result = makeDecision(input);
    expect(result.action).toBe('fail'); // Budget check takes precedence
  });
});

// =============================================================================
// Decision Matrix Tests (G1.x Goals)
// =============================================================================

describe('makeDecision - Workflow States', () => {
  it('G1.4: returns wait when workflow is running (recent activity)', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: createMockWorkflow({ status: 'running' }),
      lastFileChangeTime: Date.now() - 1000, // 1 second ago
    });

    const result = makeDecision(input);
    expect(result.action).toBe('wait');
    expect(result.reason).toBe('Workflow running');
  });

  it('G1.5: returns recover_stale when workflow stale (>10 min)', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: createMockWorkflow({ status: 'running' }),
      lastFileChangeTime: Date.now() - STALE_THRESHOLD_MS - 60000, // 11 minutes ago
    });

    const result = makeDecision(input);
    expect(result.action).toBe('recover_stale');
    expect(result.workflowId).toBe('test-workflow-id');
  });

  it('G1.6: returns wait when workflow waiting for input', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: createMockWorkflow({ status: 'waiting_for_input' }),
    });

    const result = makeDecision(input);
    expect(result.action).toBe('wait');
    expect(result.reason).toBe('Waiting for user input');
  });

  it('returns needs_attention when workflow failed', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: createMockWorkflow({ status: 'failed', error: 'Something went wrong' }),
    });

    const result = makeDecision(input);
    expect(result.action).toBe('needs_attention');
    expect(result.recoveryOptions).toContain('retry');
    expect(result.failedWorkflowId).toBe('test-workflow-id');
  });

  it('returns needs_attention when workflow cancelled', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: createMockWorkflow({ status: 'cancelled' }),
    });

    const result = makeDecision(input);
    expect(result.action).toBe('needs_attention');
  });
});

describe('makeDecision - Lookup Failures', () => {
  it('G1.3: returns wait_with_backoff when workflow lookup fails', () => {
    const execution = createMockExecution({
      currentPhase: 'design',
      executions: { design: 'stored-workflow-id', implement: [], healers: [] },
    });
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      execution,
      workflow: null, // Lookup failed
      lookupFailures: 2,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('wait_with_backoff');
    expect(result.backoffMs).toBe(4000); // 2^2 * 1000
  });
});

describe('makeDecision - Step Complete Transitions', () => {
  it('G1.8: waits for USER_GATE when verify complete', () => {
    const input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      phase: { hasUserGate: true, userGateStatus: 'pending' },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('wait_user_gate');
  });

  it('G1.9: waits for merge when autoMerge=false', () => {
    const execution = createMockExecution({
      config: {
        ...createMockExecution().config,
        autoMerge: false,
      },
    });
    const input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      execution,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('wait_merge');
  });

  it('G1.10: transitions to merge when autoMerge=true', () => {
    const execution = createMockExecution({
      config: {
        ...createMockExecution().config,
        autoMerge: true,
      },
    });
    const input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      execution,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('merge');
    expect(result.skill).toBe('flow.merge');
  });

  it('G1.11: completes when merge step is complete', () => {
    const input = createMockInput({
      step: { current: 'merge', index: 4, status: 'complete' },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('complete');
  });

  it('G1.12: transitions to next step when complete', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'complete' },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('analyze');
    expect(result.skill).toBe('flow.analyze');
  });
});

describe('makeDecision - Step Failed/Blocked', () => {
  it('G1.13: returns recover_failed when step failed', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'failed' },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('recover_failed');
  });

  it('G1.14: returns recover_failed when step blocked', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'blocked' },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('recover_failed');
  });
});

describe('makeDecision - Spawn Workflows', () => {
  it('G1.15: spawns workflow when in_progress but no workflow', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: null,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.design');
  });

  it('G1.16: spawns workflow when step not_started', () => {
    const input = createMockInput({
      step: { current: 'analyze', index: 1, status: 'not_started' },
      workflow: null,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.analyze');
  });

  it('G1.17: initializes batches when entering implement with no batches', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'not_started' },
      workflow: null,
    });

    const result = makeDecision(input);
    expect(result.action).toBe('initialize_batches');
  });
});

describe('makeDecision - Unknown Status', () => {
  it('G1.18: returns needs_attention for unknown status', () => {
    // Use design step to avoid batch handling logic
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'skipped' as any },
    });

    const result = makeDecision(input);
    expect(result.action).toBe('needs_attention');
  });
});

// =============================================================================
// Batch Handling Tests (G2.x Goals)
// =============================================================================

describe('handleImplementBatching', () => {
  it('G2.1: returns initialize_batches when no batches', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({ batches: { total: 0, current: 0, items: [] } });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('initialize_batches');
  });

  it('G2.4: spawns batch when pending and no workflow', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001', 'T002'], status: 'pending', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T003', 'T004'], status: 'pending', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('spawn_batch');
    expect(result?.skill).toBe('flow.implement');
    expect(result?.batchContext).toContain('T001');
    expect(result?.batchContext).toContain('Setup');
  });

  it('G2.5: defers to staleness check when batch running with workflow', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 1,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0 },
        ],
      },
    });
    const workflow = createMockWorkflow({ status: 'running' });

    const result = handleImplementBatching(step, execution, workflow);
    expect(result).toBeNull(); // Defer to main matrix
  });

  it('G2.6: pauses when batch complete and pauseBetweenBatches=true', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      config: {
        ...createMockExecution().config,
        pauseBetweenBatches: true,
      },
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('pause');
  });

  it('G2.7: advances batch when complete and pauseBetweenBatches=false', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('advance_batch');
    expect(result?.batchIndex).toBe(1);
  });

  it('G2.8: advances batch when healed', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'healed', healAttempts: 1 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('advance_batch');
  });

  it('G2.9: heals batch when failed and attempts remaining', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 1,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 1 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('heal_batch');
    expect(result?.batchIndex).toBe(0);
  });

  it('G2.9: returns recover_failed when no heal attempts remaining', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 1,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 3 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('recover_failed');
  });

  it('G2.10-11: forces step complete when all batches done but status not updated', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 1,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('force_step_complete');
  });

  it('G2.10: defers when all batches done and status is complete', () => {
    const step = { current: 'implement', index: 2, status: 'complete' as const };
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 1,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
        ],
      },
    });

    const result = handleImplementBatching(step, execution, null);
    expect(result).toBeNull(); // Let main matrix handle transition
  });
});

// =============================================================================
// Happy Path Integration Test (G11.5)
// =============================================================================

describe('Happy Path: design → analyze → implement → verify → merge', () => {
  it('transitions through all phases with autoMerge=true', () => {
    // Phase 1: design complete → transition to analyze
    let input = createMockInput({
      step: { current: 'design', index: 0, status: 'complete' },
    });
    let result = makeDecision(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('analyze');

    // Phase 2: analyze complete → transition to implement
    input = createMockInput({
      step: { current: 'analyze', index: 1, status: 'complete' },
    });
    result = makeDecision(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('implement');

    // Phase 3: implement batches → all batches complete → transition to verify
    // (This is handled by handleImplementBatching, tested separately)

    // Phase 4: verify complete with autoMerge=true → transition to merge
    const autoMergeExecution = createMockExecution({
      config: {
        ...createMockExecution().config,
        autoMerge: true,
      },
    });
    input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      execution: autoMergeExecution,
    });
    result = makeDecision(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('merge');
    expect(result.skill).toBe('flow.merge');

    // Phase 5: merge complete → orchestration complete
    input = createMockInput({
      step: { current: 'merge', index: 4, status: 'complete' },
    });
    result = makeDecision(input);
    expect(result.action).toBe('complete');
  });

  it('handles batch progression during implement phase', () => {
    const step = { current: 'implement', index: 2, status: 'in_progress' as const };

    // Batch 0 pending, no workflow → spawn_batch
    let execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'pending', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });
    let result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('spawn_batch');

    // Batch 0 completed → advance_batch to 1
    execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });
    result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('advance_batch');
    expect(result?.batchIndex).toBe(1);

    // Both batches completed → force_step_complete
    execution = createMockExecution({
      batches: {
        total: 2,
        current: 1,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
        ],
      },
    });
    result = handleImplementBatching(step, execution, null);
    expect(result?.action).toBe('force_step_complete');
  });
});
