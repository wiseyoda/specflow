/**
 * Tests for orchestration-decisions.ts
 *
 * Phase 1058 Update: Tests now use getNextAction (simplified API) instead of
 * the legacy makeDecision function which was removed.
 *
 * These tests verify the pure decision logic for orchestration.
 */

import { describe, it, expect } from 'vitest';
import {
  getNextAction,
  handleImplementBatching,
  getSkillForStep,
  getNextStep,
  calculateExponentialBackoff,
  areAllBatchesComplete,
  STALE_THRESHOLD_MS,
  type DecisionInput,
  type WorkflowState,
} from '../../src/lib/services/orchestration-decisions';
import type { OrchestrationExecution } from '../../src/lib/services/orchestration-types';
import type { DashboardState } from '@specflow/shared';

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

function createMockDashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    active: true,
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
    dashboardState: createMockDashboardState(),
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
// getNextAction Tests (Phase 1058 Simplified API)
// =============================================================================

describe('getNextAction - Core Decision Logic', () => {
  it('returns idle when no active orchestration', () => {
    const input = createMockInput({
      dashboardState: { active: false },
    });

    const result = getNextAction(input);
    expect(result.action).toBe('idle');
  });

  it('returns wait when workflow is running', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      workflow: { id: 'wf-1', status: 'running' },
      dashboardState: createMockDashboardState({
        lastWorkflow: { status: 'running', id: 'wf-1' },
      }),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('wait');
    expect(result.reason).toBe('Workflow running');
  });

  it('does not wait when dashboard says running but workflow is gone', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'complete' },
      workflow: null,
      dashboardState: createMockDashboardState({
        lastWorkflow: { status: 'running', id: 'wf-1' },
      }),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.reason).toBe('design complete');
  });

  it('returns spawn for design step when no workflow', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'in_progress' },
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.design');
  });

  it('returns transition when design complete', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'complete' },
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('analyze');
  });

  it('returns heal when design failed', () => {
    const input = createMockInput({
      step: { current: 'design', index: 0, status: 'failed' },
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('heal');
    expect(result.step).toBe('design');
  });

  it('returns transition when analyze complete', () => {
    const input = createMockInput({
      step: { current: 'analyze', index: 1, status: 'complete' },
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('implement');
  });

  it('returns wait_merge when verify complete and autoMerge=false', () => {
    const input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      execution: createMockExecution({
        config: {
          ...createMockExecution().config,
          autoMerge: false,
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('wait_merge');
  });

  it('returns transition to merge when verify complete and autoMerge=true', () => {
    const input = createMockInput({
      step: { current: 'verify', index: 3, status: 'complete' },
      execution: createMockExecution({
        config: {
          ...createMockExecution().config,
          autoMerge: true,
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('merge');
  });
});

describe('getNextAction - Implement Phase Batches', () => {
  it('returns advance_batch when batch complete', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'in_progress' },
      execution: createMockExecution({
        batches: {
          total: 2,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
          ],
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('advance_batch');
  });

  it('returns spawn for pending batch', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'in_progress' },
      execution: createMockExecution({
        batches: {
          total: 2,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'pending', healAttempts: 0 },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
          ],
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.implement');
    expect(result.batch?.section).toBe('Setup');
  });

  it('returns heal_batch when batch failed with attempts remaining', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'in_progress' },
      execution: createMockExecution({
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 1 },
          ],
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('heal_batch');
  });

  it('returns needs_attention when batch failed with no attempts remaining', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'in_progress' },
      execution: createMockExecution({
        batches: {
          total: 1,
          current: 0,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 3 },
          ],
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('needs_attention');
  });

  it('returns transition to verify when all batches complete', () => {
    const input = createMockInput({
      step: { current: 'implement', index: 2, status: 'in_progress' },
      execution: createMockExecution({
        batches: {
          total: 2,
          current: 1,
          items: [
            { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
            { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
          ],
        },
      }),
      dashboardState: createMockDashboardState(),
    });

    const result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('verify');
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
// Happy Path Integration Test
// =============================================================================

describe('Happy Path: design → analyze → implement → verify', () => {
  it('transitions through standard phases', () => {
    // Phase 1: design complete → transition to analyze
    let input = createMockInput({
      step: { current: 'design', index: 0, status: 'complete' },
      dashboardState: createMockDashboardState(),
    });
    let result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('analyze');

    // Phase 2: analyze complete → transition to implement
    input = createMockInput({
      step: { current: 'analyze', index: 1, status: 'complete' },
      dashboardState: createMockDashboardState(),
    });
    result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('implement');

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
      dashboardState: createMockDashboardState(),
    });
    result = getNextAction(input);
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('merge');
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
