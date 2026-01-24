/**
 * Orchestration State Validation - Pure Functions
 *
 * This module validates orchestration state files and ensures consistency
 * between the project state file and execution state.
 *
 * Key validations (NFR-002):
 * - step.index === STEP_INDEX_MAP[step.current]
 * - step.current is valid
 * - step.status is valid
 * - batches.items[i].index === i
 * - batches.current < batches.total (unless all complete)
 * - recoveryContext exists when status === 'needs_attention'
 * - Cross-file consistency
 */

import type { OrchestrationState, StepStatus } from '@specflow/shared';
import { STEP_INDEX_MAP } from '@specflow/shared';
import type { OrchestrationExecution } from './orchestration-types';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of state validation
 */
export interface ValidationResult {
  /** Whether the state is valid */
  valid: boolean;
  /** List of validation issues found */
  issues: string[];
  /** Severity of the issues */
  severity: 'none' | 'warning' | 'error';
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'warning' | 'error';

/**
 * A single validation issue
 */
export interface ValidationIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
  /** Suggested fix if available */
  suggestedFix?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Valid step names */
const VALID_STEPS = ['design', 'analyze', 'implement', 'verify', 'merge'] as const;

/** Valid step status values */
const VALID_STATUSES: StepStatus[] = [
  'not_started',
  'pending',
  'in_progress',
  'complete',
  'failed',
  'blocked',
  'skipped',
];

/** Valid batch status values */
const VALID_BATCH_STATUSES = ['pending', 'running', 'completed', 'failed', 'healed'] as const;

/** Valid orchestration status values */
const VALID_ORCHESTRATION_STATUSES = [
  'running',
  'paused',
  'waiting_merge',
  'needs_attention',
  'completed',
  'failed',
  'cancelled',
] as const;

// =============================================================================
// Validation Functions (Pure)
// =============================================================================

/**
 * Validate the orchestration state file
 *
 * Checks:
 * - Phase exists
 * - Step is valid
 * - Status is valid
 * - Step index matches step name
 *
 * @param state - Orchestration state from state file
 * @returns Validation issues found
 */
export function validateOrchestrationState(state: OrchestrationState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check phase exists
  if (!state.orchestration?.phase?.number) {
    issues.push({
      code: 'NO_ACTIVE_PHASE',
      message: 'No active phase set in orchestration state',
      severity: 'error',
    });
  }

  // Check step is valid
  const stepCurrent = state.orchestration?.step?.current;
  if (stepCurrent && !VALID_STEPS.includes(stepCurrent as typeof VALID_STEPS[number])) {
    issues.push({
      code: 'INVALID_STEP',
      message: `Invalid step: ${stepCurrent}. Must be one of: ${VALID_STEPS.join(', ')}`,
      severity: 'error',
      suggestedFix: 'Set step.current to a valid step name',
    });
  }

  // Check status is valid
  const stepStatus = state.orchestration?.step?.status;
  if (stepStatus && !VALID_STATUSES.includes(stepStatus)) {
    issues.push({
      code: 'INVALID_STATUS',
      message: `Invalid step status: ${stepStatus}. Must be one of: ${VALID_STATUSES.join(', ')}`,
      severity: 'error',
      suggestedFix: 'Set step.status to a valid status value',
    });
  }

  // Check step.index matches step.current (G7.1)
  if (stepCurrent && VALID_STEPS.includes(stepCurrent as typeof VALID_STEPS[number])) {
    const expectedIndex = STEP_INDEX_MAP[stepCurrent as keyof typeof STEP_INDEX_MAP];
    const actualIndex = state.orchestration?.step?.index;
    if (expectedIndex !== undefined && actualIndex !== undefined && actualIndex !== expectedIndex) {
      issues.push({
        code: 'STEP_INDEX_MISMATCH',
        message: `Step index mismatch: ${stepCurrent} should be index ${expectedIndex}, but got ${actualIndex}`,
        severity: 'warning',
        suggestedFix: `Set step.index to ${expectedIndex}`,
      });
    }
  }

  return issues;
}

/**
 * Validate the orchestration execution state
 *
 * Checks:
 * - Status is valid
 * - Batch indices are sequential
 * - batches.current < batches.total
 * - recoveryContext exists when needed
 *
 * @param execution - Orchestration execution state
 * @returns Validation issues found
 */
export function validateExecutionState(execution: OrchestrationExecution): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check execution status is valid
  if (!VALID_ORCHESTRATION_STATUSES.includes(execution.status)) {
    issues.push({
      code: 'INVALID_EXECUTION_STATUS',
      message: `Invalid execution status: ${execution.status}`,
      severity: 'error',
    });
  }

  // Check batch indices match position (G7.4)
  execution.batches.items.forEach((batch, index) => {
    if (batch.index !== index) {
      issues.push({
        code: 'BATCH_INDEX_MISMATCH',
        message: `Batch at position ${index} has index ${batch.index}`,
        severity: 'error',
        suggestedFix: `Set batch.index to ${index}`,
      });
    }

    // Validate batch status
    if (!VALID_BATCH_STATUSES.includes(batch.status)) {
      issues.push({
        code: 'INVALID_BATCH_STATUS',
        message: `Batch ${index} has invalid status: ${batch.status}`,
        severity: 'error',
      });
    }
  });

  // Check batches.current is valid (G7.5)
  if (execution.batches.total > 0 && execution.batches.current >= execution.batches.total) {
    // Only an issue if not all batches are complete
    const allComplete = execution.batches.items.every(
      (b) => b.status === 'completed' || b.status === 'healed'
    );
    if (!allComplete) {
      issues.push({
        code: 'BATCH_CURRENT_OUT_OF_BOUNDS',
        message: `batches.current (${execution.batches.current}) >= batches.total (${execution.batches.total})`,
        severity: 'error',
        suggestedFix: `Set batches.current to a value less than ${execution.batches.total}`,
      });
    }
  }

  // Check recoveryContext exists when status is needs_attention (G7.6)
  if (execution.status === 'needs_attention' && !execution.recoveryContext) {
    issues.push({
      code: 'MISSING_RECOVERY_CONTEXT',
      message: 'needs_attention status requires recoveryContext to be set',
      severity: 'error',
      suggestedFix: 'Set recoveryContext with issue, options, and optionally failedWorkflowId',
    });
  }

  // Check heal attempts are non-negative
  execution.batches.items.forEach((batch, index) => {
    if (batch.healAttempts < 0) {
      issues.push({
        code: 'INVALID_HEAL_ATTEMPTS',
        message: `Batch ${index} has negative healAttempts: ${batch.healAttempts}`,
        severity: 'error',
      });
    }
  });

  return issues;
}

/**
 * Validate cross-file consistency between state and execution
 *
 * Checks:
 * - Step in state matches currentPhase in execution
 *
 * @param state - Orchestration state from state file
 * @param execution - Orchestration execution state
 * @returns Validation issues found
 */
export function validateCrossFileConsistency(
  state: OrchestrationState,
  execution: OrchestrationExecution
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check step/phase alignment (G7.7)
  const stepCurrent = state.orchestration?.step?.current;
  const execPhase = execution.currentPhase;

  if (stepCurrent && execPhase && execPhase !== 'complete') {
    if (stepCurrent !== execPhase) {
      issues.push({
        code: 'STEP_PHASE_MISMATCH',
        message: `State has step '${stepCurrent}' but execution has phase '${execPhase}'`,
        severity: 'warning',
        suggestedFix: `Align state.orchestration.step.current with execution.currentPhase`,
      });
    }
  }

  return issues;
}

/**
 * Validate both state files and their consistency
 *
 * This is the main validation entry point that runs all checks.
 *
 * @param state - Orchestration state from state file
 * @param execution - Orchestration execution state
 * @returns Combined validation result
 */
export function validateState(
  state: OrchestrationState,
  execution: OrchestrationExecution
): ValidationResult {
  const stateIssues = validateOrchestrationState(state);
  const executionIssues = validateExecutionState(execution);
  const crossFileIssues = validateCrossFileConsistency(state, execution);

  const allIssues = [...stateIssues, ...executionIssues, ...crossFileIssues];
  const hasErrors = allIssues.some((i) => i.severity === 'error');
  const hasWarnings = allIssues.some((i) => i.severity === 'warning');

  return {
    valid: allIssues.length === 0,
    issues: allIssues.map((i) => i.message),
    severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'none',
  };
}

/**
 * Get detailed validation issues with codes and suggested fixes
 *
 * @param state - Orchestration state from state file
 * @param execution - Orchestration execution state
 * @returns Detailed validation issues
 */
export function getDetailedValidationIssues(
  state: OrchestrationState,
  execution: OrchestrationExecution
): ValidationIssue[] {
  const stateIssues = validateOrchestrationState(state);
  const executionIssues = validateExecutionState(execution);
  const crossFileIssues = validateCrossFileConsistency(state, execution);

  return [...stateIssues, ...executionIssues, ...crossFileIssues];
}
