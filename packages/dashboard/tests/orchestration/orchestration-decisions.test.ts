/**
 * Tests for orchestration-decisions.ts (simplified matrix)
 */

import { describe, it, expect } from 'vitest';
import {
  getNextAction,
  areAllBatchesComplete,
  type DecisionInput,
  type WorkflowState,
} from '../../src/lib/services/orchestration-decisions';
import type { BatchTracking, OrchestrationConfig } from '@specflow/shared';

const defaultConfig: OrchestrationConfig = {
  autoMerge: false,
  additionalContext: '',
  skipDesign: false,
  skipAnalyze: false,
  skipImplement: false,
  skipVerify: false,
  autoHealEnabled: true,
  maxHealAttempts: 3,
  pauseBetweenBatches: false,
  batchSizeFallback: 5,
  budget: {
    maxPerBatch: 10,
    maxTotal: 50,
    healingBudget: 1,
    decisionBudget: 0.5,
  },
};

const emptyBatches: BatchTracking = {
  total: 0,
  current: 0,
  items: [],
};

function createBatches(overrides: Partial<BatchTracking> = {}): BatchTracking {
  return {
    total: 1,
    current: 0,
    items: [
      { index: 0, section: 'Setup', taskIds: ['T001'], status: 'pending', healAttempts: 0 },
    ],
    ...overrides,
  };
}

function createInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    active: true,
    step: { current: 'implement', status: 'in_progress' },
    config: defaultConfig,
    batches: emptyBatches,
    workflow: null,
    ...overrides,
  };
}

function createWorkflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf-1',
    status: 'running',
    ...overrides,
  };
}

describe('areAllBatchesComplete', () => {
  it('returns false for empty batches', () => {
    expect(areAllBatchesComplete(emptyBatches)).toBe(false);
  });

  it('returns true when all batches completed', () => {
    const batches = createBatches({
      total: 2,
      current: 1,
      items: [
        { index: 0, section: 'A', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
        { index: 1, section: 'B', taskIds: ['T002'], status: 'healed', healAttempts: 1 },
      ],
    });
    expect(areAllBatchesComplete(batches)).toBe(true);
  });
});

describe('getNextAction', () => {
  it('returns idle when no active orchestration', () => {
    const result = getNextAction(createInput({ active: false }));
    expect(result.action).toBe('idle');
  });

  it('returns wait when workflow is running and step not complete', () => {
    const result = getNextAction(createInput({
      step: { current: 'design', status: 'in_progress' },
      workflow: createWorkflow(),
    }));
    expect(result.action).toBe('wait');
  });

  it('spawns design when no workflow', () => {
    const result = getNextAction(createInput({
      step: { current: 'design', status: 'in_progress' },
    }));
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.design');
  });

  it('transitions when design complete', () => {
    const result = getNextAction(createInput({
      step: { current: 'design', status: 'complete' },
    }));
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('analyze');
  });

  it('needs attention when design failed', () => {
    const result = getNextAction(createInput({
      step: { current: 'design', status: 'failed' },
    }));
    expect(result.action).toBe('needs_attention');
  });

  it('waits for merge when verify complete and autoMerge=false', () => {
    const result = getNextAction(createInput({
      step: { current: 'verify', status: 'complete' },
      config: { ...defaultConfig, autoMerge: false },
    }));
    expect(result.action).toBe('wait_merge');
  });

  it('transitions to merge when verify complete and autoMerge=true', () => {
    const result = getNextAction(createInput({
      step: { current: 'verify', status: 'complete' },
      config: { ...defaultConfig, autoMerge: true },
    }));
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('merge');
  });

  it('initializes batches when none exist', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: emptyBatches,
    }));
    expect(result.action).toBe('initialize_batches');
  });

  it('spawns implement workflow for pending batch', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: createBatches(),
    }));
    expect(result.action).toBe('spawn');
    expect(result.skill).toBe('flow.implement');
  });

  it('advances batch when current batch complete', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: createBatches({
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      }),
    }));
    expect(result.action).toBe('advance_batch');
  });

  it('pauses after advance when pauseBetweenBatches enabled', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      config: { ...defaultConfig, pauseBetweenBatches: true },
      batches: createBatches({
        total: 2,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      }),
    }));
    expect(result.action).toBe('advance_batch');
    expect(result.pauseAfterAdvance).toBe(true);
  });

  it('heals batch when failed and attempts remaining', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: createBatches({
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 1 },
        ],
      }),
    }));
    expect(result.action).toBe('heal_batch');
  });

  it('needs attention when batch failed and attempts exhausted', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: createBatches({
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'failed', healAttempts: 3 },
        ],
      }),
    }));
    expect(result.action).toBe('needs_attention');
  });

  it('transitions when all batches complete', () => {
    const result = getNextAction(createInput({
      step: { current: 'implement', status: 'in_progress' },
      batches: createBatches({
        total: 2,
        current: 1,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
        ],
      }),
    }));
    expect(result.action).toBe('transition');
    expect(result.nextStep).toBe('verify');
  });

  it('waits for merge trigger when in merge step and not complete', () => {
    const result = getNextAction(createInput({
      step: { current: 'merge', status: 'in_progress' },
    }));
    expect(result.action).toBe('wait');
  });
});
