/**
 * Orchestration Decision Logic - Pure Functions
 *
 * This module contains pure decision-making functions extracted from orchestration-runner.ts
 * for better testability and separation of concerns.
 *
 * Key principles:
 * - All functions are pure (no I/O, no side effects)
 * - State is passed in, decisions are returned
 * - Trusts step.status from state file (FR-001)
 * - Complete decision matrix with no ambiguous cases (FR-002)
 */

import type {
  OrchestrationPhase,
  OrchestrationState,
  StepStatus,
  BatchItem,
  DashboardState,
} from '@specflow/shared';
import { STEP_INDEX_MAP } from '@specflow/shared';
import type { OrchestrationExecution } from './orchestration-types';

// =============================================================================
// Types
// =============================================================================

/**
 * Decision actions that the runner can execute
 */
export type DecisionAction =
  | 'wait'                    // Continue polling, nothing to do
  | 'wait_with_backoff'       // Wait with exponential backoff (lookup failure)
  | 'wait_user_gate'          // Wait for USER_GATE confirmation
  | 'wait_merge'              // Wait for user to trigger merge
  | 'transition'              // Transition to next step
  | 'spawn'                   // Spawn workflow for current step
  | 'spawn_batch'             // Spawn workflow for current batch
  | 'advance_batch'           // Move to next batch
  | 'initialize_batches'      // Initialize batch tracking
  | 'force_step_complete'     // Force step.status to complete (all batches done)
  | 'heal_batch'              // Attempt to heal failed batch
  | 'pause'                   // Pause orchestration (pauseBetweenBatches)
  | 'complete'                // Orchestration complete
  | 'recover_stale'           // Recover from stale workflow
  | 'recover_failed'          // Recover from failed step/workflow
  | 'needs_attention'         // Needs user intervention
  | 'fail';                   // Terminal failure

/**
 * Result of the decision function
 */
export interface DecisionResult {
  action: DecisionAction;
  reason: string;
  /** Skill to spawn (for spawn/spawn_batch actions) */
  skill?: string;
  /** Next step to transition to */
  nextStep?: string;
  /** Next step index */
  nextIndex?: number;
  /** Batch context for implement phase */
  batchContext?: string;
  /** Batch index for batch operations */
  batchIndex?: number;
  /** Error message for failure cases */
  errorMessage?: string;
  /** Recovery options for needs_attention */
  recoveryOptions?: Array<'retry' | 'skip' | 'abort'>;
  /** Failed workflow ID for recovery context */
  failedWorkflowId?: string;
  /** Backoff time in ms */
  backoffMs?: number;
  /** Workflow ID for stale recovery */
  workflowId?: string;
}

/**
 * Workflow state passed to decision functions
 * Simplified interface to avoid coupling to workflow service
 * NOTE: 'detached' and 'stale' are intermediate health states that
 * can occur during workflow execution monitoring
 */
export interface WorkflowState {
  id: string;
  status: 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled' | 'detached' | 'stale';
  error?: string;
  lastActivityAt?: string;
}

/**
 * Input for makeDecision - all state needed to make a decision
 */
export interface DecisionInput {
  /** Current orchestration step from state file */
  step: {
    current: string | null;
    index: number | null;
    status: StepStatus | null;
  };
  /** Phase info from state file */
  phase: {
    hasUserGate?: boolean;
    userGateStatus?: 'pending' | 'confirmed' | 'skipped';
  };
  /** Orchestration execution state */
  execution: OrchestrationExecution;
  /** Current workflow state (if any) */
  workflow: WorkflowState | null;
  /** Last file change time (for staleness detection) */
  lastFileChangeTime?: number;
  /** Lookup failures count (for backoff) */
  lookupFailures?: number;
  /** Current timestamp (for duration checks) */
  currentTime?: number;
  /** FR-001: Dashboard state from CLI state file (single source of truth) */
  dashboardState?: DashboardState;
}

// =============================================================================
// Constants
// =============================================================================

/** Stale threshold - 10 minutes with no activity */
export const STALE_THRESHOLD_MS = 10 * 60 * 1000;

/** Maximum orchestration duration - 4 hours */
export const MAX_ORCHESTRATION_DURATION_MS = 4 * 60 * 60 * 1000;

/** Step order for transitions */
const STEP_ORDER: readonly string[] = ['design', 'analyze', 'implement', 'verify', 'merge'] as const;

// =============================================================================
// Helper Functions (Pure)
// =============================================================================

/**
 * Get the skill command for a given step
 */
export function getSkillForStep(step: string): string {
  const skillMap: Record<string, string> = {
    design: 'flow.design',
    analyze: 'flow.analyze',
    implement: 'flow.implement',
    verify: 'flow.verify',
    merge: 'flow.merge',
  };
  return skillMap[step] || 'flow.implement';
}

/**
 * Get the next step in the orchestration flow
 * Returns null if current step is the last one (merge)
 */
export function getNextStep(current: string): string | null {
  const currentIndex = STEP_ORDER.indexOf(current);
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}

/**
 * Calculate exponential backoff for lookup failures
 */
export function calculateExponentialBackoff(failures: number): number {
  const baseMs = 1000;
  const maxMs = 30000;
  const backoff = Math.min(baseMs * Math.pow(2, failures), maxMs);
  return backoff;
}

/**
 * Check if all batches are complete (completed or healed)
 */
export function areAllBatchesComplete(batches: OrchestrationExecution['batches']): boolean {
  if (batches.items.length === 0) return false;
  return batches.items.every(
    (b) => b.status === 'completed' || b.status === 'healed'
  );
}

/**
 * Get the current batch from execution state
 */
export function getCurrentBatch(execution: OrchestrationExecution): BatchItem | undefined {
  return execution.batches.items[execution.batches.current];
}

// =============================================================================
// Batch Handling (Pure) - FR-003
// =============================================================================

/**
 * Handle implement phase batching decisions
 *
 * This is the batch state machine from FR-003:
 * - No batches → initialize_batches
 * - Pending batch + no workflow → spawn_batch
 * - Running batch + workflow running → let staleness check handle
 * - Completed batch + pauseBetweenBatches → pause
 * - Completed batch + continue → advance_batch
 * - Failed batch + heal attempts remaining → heal_batch
 * - Failed batch + no attempts → recover_failed
 * - All batches complete + step not complete → force_step_complete
 *
 * Returns null if no batch-specific decision needed (defer to main matrix)
 */
export function handleImplementBatching(
  step: DecisionInput['step'],
  execution: OrchestrationExecution,
  workflow: WorkflowState | null
): DecisionResult | null {
  const { batches, config } = execution;

  // No batches yet - need to initialize (G2.1)
  if (batches.total === 0) {
    return {
      action: 'initialize_batches',
      reason: 'No batches populated',
    };
  }

  const currentBatch = batches.items[batches.current];
  const allBatchesComplete = areAllBatchesComplete(batches);

  // All batches done (G2.10) → check if step.status needs updating
  if (allBatchesComplete) {
    // Trust sub-command to set step.status=complete
    // But if it didn't, force it (G2.11)
    if (step.status !== 'complete') {
      return {
        action: 'force_step_complete',
        reason: 'All batches complete but step.status not updated',
      };
    }
    return null; // Let normal decision matrix handle transition
  }

  // Current batch running with active workflow (G2.5) → defer to staleness check
  if (currentBatch?.status === 'running' && workflow?.status === 'running') {
    return null; // Let normal staleness check handle this
  }

  // Current batch running but workflow completed → mark batch complete and advance (G2.5b)
  if (currentBatch?.status === 'running' && workflow?.status === 'completed') {
    // Check pauseBetweenBatches config (G2.6)
    if (config.pauseBetweenBatches) {
      return {
        action: 'advance_batch',
        batchIndex: batches.current,
        reason: 'Batch workflow complete, pauseBetweenBatches enabled - completing and pausing',
      };
    }

    const nextBatchIndex = batches.current + 1;
    if (nextBatchIndex < batches.total) {
      return {
        action: 'advance_batch',
        batchIndex: batches.current,
        reason: `Batch ${batches.current} workflow complete, advancing to batch ${nextBatchIndex}`,
      };
    }

    // All batches done, but step not marked complete yet
    return {
      action: 'force_step_complete',
      reason: 'All batches completed (last batch workflow done)',
    };
  }

  // Current batch completed or healed → advance to next batch (G2.7, G2.8)
  if (currentBatch?.status === 'completed' || currentBatch?.status === 'healed') {
    // Check pauseBetweenBatches config (G2.6)
    if (config.pauseBetweenBatches) {
      return {
        action: 'pause',
        reason: 'Batch complete, pauseBetweenBatches enabled',
      };
    }

    const nextBatchIndex = batches.current + 1;
    if (nextBatchIndex < batches.total) {
      return {
        action: 'advance_batch',
        batchIndex: nextBatchIndex,
        reason: `Batch ${batches.current} complete, advancing to batch ${nextBatchIndex}`,
      };
    }
  }

  // Current batch pending + no workflow (G2.4) → spawn batch
  if (currentBatch?.status === 'pending' && !workflow) {
    const batchContext = `Execute tasks ${currentBatch.taskIds.join(', ')} in section "${currentBatch.section}"`;
    return {
      action: 'spawn_batch',
      skill: 'flow.implement',
      batchContext: config.additionalContext
        ? `${batchContext}\n\n${config.additionalContext}`
        : batchContext,
      reason: `Starting batch ${batches.current + 1}/${batches.total}: ${currentBatch.section}`,
    };
  }

  // Current batch failed (G2.9) → try healing
  if (currentBatch?.status === 'failed') {
    if (config.autoHealEnabled && currentBatch.healAttempts < config.maxHealAttempts) {
      return {
        action: 'heal_batch',
        batchIndex: batches.current,
        reason: 'Batch failed, attempting heal',
      };
    }
    return {
      action: 'recover_failed',
      reason: `Batch ${batches.current} failed after ${currentBatch.healAttempts} heal attempts`,
      errorMessage: `Batch ${batches.current} failed`,
    };
  }

  return null; // No batch-specific decision, use normal matrix
}

// =============================================================================
// Simplified Decision Function (FR-002) - NEW Single Source of Truth
// =============================================================================

/**
 * Decision type for simplified getNextAction
 */
export interface Decision {
  action: 'idle' | 'wait' | 'spawn' | 'transition' | 'heal' | 'heal_batch' | 'advance_batch' | 'wait_merge' | 'error' | 'needs_attention';
  reason: string;
  nextStep?: string;
  step?: string;
  skill?: string;
  batch?: { section: string; taskIds: string[] };
  batchIndex?: number;
}

/**
 * Get next action using simplified decision logic (FR-002)
 *
 * Target: < 100 lines of decision logic
 * Principle: Trust CLI state (step.status, dashboard.lastWorkflow)
 *
 * @param input Decision input with state from CLI
 * @returns Simplified decision
 */
export function getNextAction(input: DecisionInput): Decision {
  const { step, execution, dashboardState } = input;
  const { config, batches } = execution;

  // No active orchestration (check dashboard state first)
  if (!dashboardState?.active) {
    return { action: 'idle', reason: 'No active orchestration' };
  }

  // Decision based on step
  const currentStep = step.current || 'design';
  const stepStatus = step.status || 'not_started';

  // Workflow running - wait, BUT only if the step isn't already complete/failed.
  // The CLI sets step.status=complete when the skill finishes its work, even while
  // the workflow process is still winding down. Step completion is the source of truth.
  if (dashboardState.lastWorkflow?.status === 'running' && input.workflow) {
    if (stepStatus !== 'complete' && stepStatus !== 'failed') {
      return { action: 'wait', reason: 'Workflow running' };
    }
  }

  switch (currentStep) {
    case 'design':
      return handleStep('design', 'analyze', stepStatus, dashboardState, config, input.workflow);

    case 'analyze':
      return handleStep('analyze', 'implement', stepStatus, dashboardState, config, input.workflow);

    case 'implement':
      return handleImplement(stepStatus, batches, dashboardState, config, input.workflow);

    case 'verify':
      return handleVerify(stepStatus, dashboardState, config, input.workflow);

    default:
      return { action: 'error', reason: `Unknown step: ${currentStep}` };
  }
}

/**
 * Handle standard step transition (design, analyze)
 */
function handleStep(
  current: string,
  next: string,
  stepStatus: StepStatus | null,
  dashboard: DashboardState,
  config: OrchestrationExecution['config'],
  workflow: WorkflowState | null = null
): Decision {
  if (stepStatus === 'complete') {
    return { action: 'transition', nextStep: next, skill: `flow.${next}`, reason: `${current} complete` };
  }
  if (stepStatus === 'failed') {
    return { action: 'heal', step: current, reason: `${current} failed` };
  }
  // Spawn if no active workflow (check the actual workflow, not stale dashboard state)
  const hasActiveWorkflow = workflow && (workflow.status === 'running' || workflow.status === 'waiting_for_input');
  if (!hasActiveWorkflow) {
    return { action: 'spawn', skill: `flow.${current}`, reason: `Start ${current}` };
  }
  return { action: 'wait', reason: `${current} in progress` };
}

/**
 * Handle implement phase with batches
 */
function handleImplement(
  stepStatus: StepStatus | null,
  batches: OrchestrationExecution['batches'],
  dashboard: DashboardState,
  config: OrchestrationExecution['config'],
  workflow: WorkflowState | null = null
): Decision {
  // Step-level status is the source of truth (FR-001)
  // CLI sets step.status=complete when all tasks are done, regardless of batch tracking
  if (stepStatus === 'complete') {
    return { action: 'transition', nextStep: 'verify', skill: 'flow.verify', reason: 'Implement complete' };
  }
  if (stepStatus === 'failed') {
    return { action: 'heal', step: 'implement', reason: 'Implement failed' };
  }

  // All batches done (redundant with stepStatus check above, but covers edge cases)
  if (areAllBatchesComplete(batches)) {
    return { action: 'transition', nextStep: 'verify', skill: 'flow.verify', reason: 'All batches complete' };
  }

  const currentBatch = batches.items[batches.current];
  if (!currentBatch) {
    return { action: 'error', reason: 'No current batch' };
  }

  if (currentBatch.status === 'completed' || currentBatch.status === 'healed') {
    return { action: 'advance_batch', batchIndex: batches.current, reason: 'Batch complete' };
  }
  if (currentBatch.status === 'failed') {
    if (config.autoHealEnabled && currentBatch.healAttempts < config.maxHealAttempts) {
      return { action: 'heal_batch', batchIndex: batches.current, reason: 'Attempting heal' };
    }
    return { action: 'needs_attention', reason: `Batch failed after ${currentBatch.healAttempts} attempts` };
  }
  const hasActiveWorkflow = workflow && (workflow.status === 'running' || workflow.status === 'waiting_for_input');
  if (currentBatch.status === 'pending' && !hasActiveWorkflow) {
    return {
      action: 'spawn',
      skill: 'flow.implement',
      batch: { section: currentBatch.section, taskIds: currentBatch.taskIds },
      reason: `Start batch ${batches.current}`,
    };
  }

  return { action: 'wait', reason: 'Batch in progress' };
}

/**
 * Handle verify phase
 */
function handleVerify(
  stepStatus: StepStatus | null,
  dashboard: DashboardState,
  config: OrchestrationExecution['config'],
  workflow: WorkflowState | null = null
): Decision {
  if (stepStatus === 'complete') {
    if (config.autoMerge) {
      return { action: 'transition', nextStep: 'merge', skill: 'flow.merge', reason: 'Verify complete, auto-merge' };
    }
    return { action: 'wait_merge', reason: 'Verify complete, waiting for user' };
  }
  if (stepStatus === 'failed') {
    return { action: 'heal', step: 'verify', reason: 'Verify failed' };
  }
  // Spawn if no active workflow
  const hasActiveWorkflow = workflow && (workflow.status === 'running' || workflow.status === 'waiting_for_input');
  if (!hasActiveWorkflow) {
    return { action: 'spawn', skill: 'flow.verify', reason: 'Start verify' };
  }
  return { action: 'wait', reason: 'Verify in progress' };
}

// NOTE: The legacy makeDecision function was removed in Phase 1058 (T012)
// Use getNextAction instead for simplified decision logic (<100 lines)

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Get the stored workflow ID for a given step from execution state
 */
function getStoredWorkflowId(execution: OrchestrationExecution, step: string): string | undefined {
  const { executions, batches } = execution;

  switch (step) {
    case 'design':
      return executions.design;
    case 'analyze':
      return executions.analyze;
    case 'implement':
      return batches.items[batches.current]?.workflowExecutionId;
    case 'verify':
      return executions.verify;
    case 'merge':
      return executions.merge;
    default:
      return undefined;
  }
}
