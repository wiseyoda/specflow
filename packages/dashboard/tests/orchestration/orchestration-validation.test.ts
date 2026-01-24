/**
 * Tests for orchestration-validation.ts
 *
 * These tests verify the state validation logic for orchestration.
 * Each test covers a specific validation check from NFR-002 and G7.x goals.
 */

import { describe, it, expect } from 'vitest';
import {
  validateState,
  validateOrchestrationState,
  validateExecutionState,
  validateCrossFileConsistency,
  getDetailedValidationIssues,
} from '../../src/lib/services/orchestration-validation';
import type { OrchestrationExecution, OrchestrationState } from '@specflow/shared';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockState(overrides: Partial<OrchestrationState> = {}): OrchestrationState {
  return {
    schema_version: '3.0.0',
    project: {
      id: 'test-project',
      name: 'Test Project',
      path: '/path/to/project',
    },
    orchestration: {
      phase: {
        number: '1057',
        name: 'test-phase',
        status: 'in_progress',
      },
      step: {
        current: 'implement',
        index: 2,
        status: 'in_progress',
      },
    },
    ...overrides,
  };
}

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
      total: 2,
      current: 0,
      items: [
        { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0 },
        { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
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
  };
}

// =============================================================================
// Orchestration State Validation Tests (G7.1-G7.3)
// =============================================================================

describe('validateOrchestrationState', () => {
  it('returns no issues for valid state', () => {
    const state = createMockState();
    const issues = validateOrchestrationState(state);
    expect(issues).toHaveLength(0);
  });

  it('detects missing active phase', () => {
    const state = createMockState({
      orchestration: {
        phase: {},
        step: { current: 'implement', index: 2, status: 'in_progress' },
      },
    });
    const issues = validateOrchestrationState(state);
    expect(issues.some((i) => i.code === 'NO_ACTIVE_PHASE')).toBe(true);
  });

  it('G7.2: detects invalid step', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'invalid_step' as any, index: 99, status: 'in_progress' },
      },
    });
    const issues = validateOrchestrationState(state);
    expect(issues.some((i) => i.code === 'INVALID_STEP')).toBe(true);
  });

  it('G7.3: detects invalid status', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'implement', index: 2, status: 'invalid_status' as any },
      },
    });
    const issues = validateOrchestrationState(state);
    expect(issues.some((i) => i.code === 'INVALID_STATUS')).toBe(true);
  });

  it('G7.1: detects step index mismatch', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'implement', index: 0, status: 'in_progress' }, // Should be 2
      },
    });
    const issues = validateOrchestrationState(state);
    expect(issues.some((i) => i.code === 'STEP_INDEX_MISMATCH')).toBe(true);
  });
});

// =============================================================================
// Execution State Validation Tests (G7.4-G7.6)
// =============================================================================

describe('validateExecutionState', () => {
  it('returns no issues for valid execution', () => {
    const execution = createMockExecution();
    const issues = validateExecutionState(execution);
    expect(issues).toHaveLength(0);
  });

  it('G7.4: detects batch index mismatch', () => {
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 0,
        items: [
          { index: 1, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0 }, // Wrong index
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'BATCH_INDEX_MISMATCH')).toBe(true);
  });

  it('G7.5: detects batches.current out of bounds', () => {
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 5, // Out of bounds
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'running', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'pending', healAttempts: 0 },
        ],
      },
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'BATCH_CURRENT_OUT_OF_BOUNDS')).toBe(true);
  });

  it('G7.5: allows batches.current >= total when all complete', () => {
    const execution = createMockExecution({
      batches: {
        total: 2,
        current: 2, // At end
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'completed', healAttempts: 0 },
          { index: 1, section: 'Core', taskIds: ['T002'], status: 'completed', healAttempts: 0 },
        ],
      },
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'BATCH_CURRENT_OUT_OF_BOUNDS')).toBe(false);
  });

  it('G7.6: detects missing recoveryContext when needs_attention', () => {
    const execution = createMockExecution({
      status: 'needs_attention',
      recoveryContext: undefined,
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'MISSING_RECOVERY_CONTEXT')).toBe(true);
  });

  it('G7.6: accepts needs_attention with recoveryContext', () => {
    const execution = createMockExecution({
      status: 'needs_attention',
      recoveryContext: {
        issue: 'Test issue',
        options: ['retry', 'abort'],
      },
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'MISSING_RECOVERY_CONTEXT')).toBe(false);
  });

  it('detects invalid batch status', () => {
    const execution = createMockExecution({
      batches: {
        total: 1,
        current: 0,
        items: [
          { index: 0, section: 'Setup', taskIds: ['T001'], status: 'invalid' as any, healAttempts: 0 },
        ],
      },
    });
    const issues = validateExecutionState(execution);
    expect(issues.some((i) => i.code === 'INVALID_BATCH_STATUS')).toBe(true);
  });
});

// =============================================================================
// Cross-File Consistency Tests (G7.7)
// =============================================================================

describe('validateCrossFileConsistency', () => {
  it('returns no issues when state and execution match', () => {
    const state = createMockState();
    const execution = createMockExecution();
    const issues = validateCrossFileConsistency(state, execution);
    expect(issues).toHaveLength(0);
  });

  it('G7.7: detects step/phase mismatch', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'design', index: 0, status: 'in_progress' },
      },
    });
    const execution = createMockExecution({
      currentPhase: 'implement', // Mismatch
    });
    const issues = validateCrossFileConsistency(state, execution);
    expect(issues.some((i) => i.code === 'STEP_PHASE_MISMATCH')).toBe(true);
  });

  it('ignores mismatch when execution phase is complete', () => {
    const state = createMockState();
    const execution = createMockExecution({
      currentPhase: 'complete',
    });
    const issues = validateCrossFileConsistency(state, execution);
    expect(issues.some((i) => i.code === 'STEP_PHASE_MISMATCH')).toBe(false);
  });
});

// =============================================================================
// Combined Validation Tests
// =============================================================================

describe('validateState', () => {
  it('returns valid=true for valid state', () => {
    const state = createMockState();
    const execution = createMockExecution();
    const result = validateState(state, execution);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.severity).toBe('none');
  });

  it('returns valid=false with issues for invalid state', () => {
    const state = createMockState({
      orchestration: {
        phase: {},
        step: { current: 'invalid' as any, index: 99, status: 'invalid' as any },
      },
    });
    const execution = createMockExecution({
      status: 'needs_attention',
      recoveryContext: undefined,
    });
    const result = validateState(state, execution);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.severity).toBe('error');
  });

  it('returns warning severity when only warnings present', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'implement', index: 0, status: 'in_progress' }, // Wrong index (warning)
      },
    });
    const execution = createMockExecution();
    const result = validateState(state, execution);
    expect(result.severity).toBe('warning');
  });
});

describe('getDetailedValidationIssues', () => {
  it('returns issues with codes and suggested fixes', () => {
    const state = createMockState({
      orchestration: {
        phase: { number: '1057' },
        step: { current: 'implement', index: 0, status: 'in_progress' },
      },
    });
    const execution = createMockExecution();
    const issues = getDetailedValidationIssues(state, execution);

    const stepIndexIssue = issues.find((i) => i.code === 'STEP_INDEX_MISMATCH');
    expect(stepIndexIssue).toBeDefined();
    expect(stepIndexIssue?.suggestedFix).toContain('2'); // Should suggest index 2
  });
});
