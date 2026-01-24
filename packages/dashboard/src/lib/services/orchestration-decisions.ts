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
  OrchestrationExecution,
  OrchestrationPhase,
  OrchestrationState,
  StepStatus,
  BatchItem,
} from '@specflow/shared';
import { STEP_INDEX_MAP } from '@specflow/shared';

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
// Main Decision Function (Pure) - FR-001, FR-002
// =============================================================================

/**
 * Make a decision about what to do next
 *
 * This is the complete decision matrix from FR-002. Every possible state
 * combination has an explicit action - no ambiguous cases.
 *
 * Key principle (FR-001): Trust step.status from state file. Sub-commands
 * set step.status=complete when done. We don't check for artifacts.
 *
 * @param input - All state needed to make a decision
 * @returns Decision result with action and reason
 */
export function makeDecision(input: DecisionInput): DecisionResult {
  const { step, phase, execution, workflow, lastFileChangeTime, lookupFailures, currentTime } = input;
  const { config, batches } = execution;
  const currentStep = step.current || 'design';

  // ═══════════════════════════════════════════════════════════════════
  // PRE-DECISION GATES (G1.1, G1.2)
  // ═══════════════════════════════════════════════════════════════════

  // G1.1: Budget gate - fail if budget exceeded
  if (execution.totalCostUsd >= config.budget.maxTotal) {
    return {
      action: 'fail',
      reason: `Budget exceeded: $${execution.totalCostUsd.toFixed(2)} >= $${config.budget.maxTotal}`,
      errorMessage: 'Budget limit exceeded',
    };
  }

  // G1.2: Duration gate - needs_attention if running too long (4 hours)
  if (currentTime !== undefined) {
    const startTime = new Date(execution.startedAt).getTime();
    const duration = currentTime - startTime;
    if (duration > MAX_ORCHESTRATION_DURATION_MS) {
      return {
        action: 'needs_attention',
        reason: `Orchestration running too long: ${Math.round(duration / (60 * 60 * 1000))} hours`,
        errorMessage: 'Orchestration duration exceeded 4 hours',
        recoveryOptions: ['retry', 'abort'],
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // IMPLEMENT PHASE: BATCH HANDLING (checked first) - FR-003
  // ═══════════════════════════════════════════════════════════════════
  if (currentStep === 'implement') {
    const batchDecision = handleImplementBatching(step, execution, workflow);
    if (batchDecision) return batchDecision;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW IS RUNNING (G1.4, G1.5)
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'running') {
    // Check for stale workflow (G1.5)
    // Use the workflow's lastActivityAt, NOT project file changes
    // A workflow is stale if it's been running but hasn't had any activity
    if (workflow.lastActivityAt) {
      const workflowActivityTime = new Date(workflow.lastActivityAt).getTime();
      const staleDuration = Date.now() - workflowActivityTime;
      if (staleDuration > STALE_THRESHOLD_MS) {
        return {
          action: 'recover_stale',
          reason: `No activity for ${Math.round(staleDuration / 60000)} minutes`,
          workflowId: workflow.id,
        };
      }
    }

    // Active workflow (G1.4)
    return {
      action: 'wait',
      reason: 'Workflow running',
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW NEEDS INPUT (G1.6, G1.7)
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'waiting_for_input') {
    return {
      action: 'wait',
      reason: 'Waiting for user input',
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW DETACHED OR STALE - Intermediate Health States
  // These are monitoring states that indicate the workflow might be stuck
  // We treat 'stale' as needing recovery and 'detached' as waiting
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'stale') {
    console.log(`[orchestration-decisions] DEBUG: Workflow ${workflow.id} is stale`);
    return {
      action: 'recover_stale',
      reason: `Workflow ${workflow.id} appears stale - no recent activity`,
      workflowId: workflow.id,
    };
  }

  if (workflow?.status === 'detached') {
    // Detached means process was orphaned but might still be running
    // Wait a bit and let the health checker determine final state
    console.log(`[orchestration-decisions] DEBUG: Workflow ${workflow.id} is detached, waiting`);
    return {
      action: 'wait',
      reason: `Workflow ${workflow.id} detached, waiting for health check`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW FAILED OR CANCELLED
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'failed' || workflow?.status === 'cancelled') {
    // If cancelled by user, don't auto-heal
    if (workflow.status === 'cancelled') {
      return {
        action: 'needs_attention',
        reason: 'Workflow was cancelled by user',
        errorMessage: 'Workflow cancelled',
        recoveryOptions: ['retry', 'skip', 'abort'],
        failedWorkflowId: workflow.id,
      };
    }

    // If failed in implement phase, try auto-healing first (G2.9)
    if (currentStep === 'implement' && config.autoHealEnabled) {
      const currentBatch = batches.items[batches.current];
      if (currentBatch && currentBatch.healAttempts < config.maxHealAttempts) {
        return {
          action: 'heal_batch',
          reason: `Workflow failed, attempting heal (attempt ${currentBatch.healAttempts + 1}/${config.maxHealAttempts})`,
          batchIndex: batches.current,
        };
      }
    }

    // Otherwise, needs user attention
    return {
      action: 'needs_attention',
      reason: `Workflow ${workflow.status}: ${workflow.error || 'Unknown error'}`,
      errorMessage: workflow.error,
      recoveryOptions: ['retry', 'skip', 'abort'],
      failedWorkflowId: workflow.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW ID EXISTS BUT LOOKUP FAILS (G1.3)
  // ═══════════════════════════════════════════════════════════════════
  const storedWorkflowId = getStoredWorkflowId(execution, currentStep);
  if (storedWorkflowId && !workflow) {
    return {
      action: 'wait_with_backoff',
      reason: `Workflow ${storedWorkflowId} lookup failed, waiting...`,
      backoffMs: calculateExponentialBackoff(lookupFailures || 0),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW COMPLETED - INFER STEP COMPLETION (G1.7)
  // For non-implement phases, workflow completion means step is done.
  // Implement phase uses batch logic instead (handled separately).
  // ═══════════════════════════════════════════════════════════════════
  console.log(`[orchestration-decisions] DEBUG: workflow=${workflow?.id ?? 'none'}, status=${workflow?.status ?? 'none'}, currentStep=${currentStep}`);
  if (workflow?.status === 'completed' && currentStep !== 'implement') {
    console.log(`[orchestration-decisions] DEBUG: Workflow completed for ${currentStep}, transitioning...`);
    const nextStep = getNextStep(currentStep);

    // All steps done - after merge completes
    if (nextStep === null) {
      return {
        action: 'complete',
        reason: 'All steps finished (workflow completed)',
      };
    }

    // Verify complete → check USER_GATE before merge
    if (currentStep === 'verify' && nextStep === 'merge') {
      if (phase.hasUserGate && phase.userGateStatus !== 'confirmed') {
        return {
          action: 'wait_user_gate',
          reason: 'USER_GATE requires confirmation',
        };
      }
      if (!config.autoMerge) {
        return {
          action: 'wait_merge',
          reason: 'Verify workflow complete, waiting for user to trigger merge',
        };
      }
      return {
        action: 'transition',
        nextStep: 'merge',
        nextIndex: STEP_INDEX_MAP.verify + 1,
        skill: getSkillForStep('merge'),
        reason: 'Verify workflow complete, auto-merge enabled',
      };
    }

    // Normal step transition when workflow completes
    return {
      action: 'transition',
      nextStep,
      nextIndex: STEP_INDEX_MAP[nextStep as keyof typeof STEP_INDEX_MAP],
      skill: getSkillForStep(nextStep),
      reason: `${currentStep} workflow complete, advancing to ${nextStep}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP IS COMPLETE - DETERMINE NEXT ACTION (G1.8 - G1.12)
  // ═══════════════════════════════════════════════════════════════════
  if (step.status === 'complete') {
    const nextStep = getNextStep(currentStep);

    // All steps done - after merge completes (G1.11)
    if (nextStep === null) {
      return {
        action: 'complete',
        reason: 'All steps finished',
      };
    }

    // Verify complete → check USER_GATE before merge (G1.8)
    if (currentStep === 'verify' && nextStep === 'merge') {
      // USER_GATE requires explicit confirmation
      if (phase.hasUserGate && phase.userGateStatus !== 'confirmed') {
        return {
          action: 'wait_user_gate',
          reason: 'USER_GATE requires confirmation',
        };
      }
      // autoMerge disabled → wait for user to trigger (G1.9)
      if (!config.autoMerge) {
        return {
          action: 'wait_merge',
          reason: 'Auto-merge disabled, waiting for user',
        };
      }
      // autoMerge enabled → transition to merge step (G1.10)
      return {
        action: 'transition',
        nextStep: 'merge',
        nextIndex: STEP_INDEX_MAP.verify + 1, // merge is after verify
        skill: getSkillForStep('merge'),
        reason: 'Verify complete, auto-merge enabled',
      };
    }

    // Normal step transition (G1.12)
    return {
      action: 'transition',
      nextStep,
      nextIndex: STEP_INDEX_MAP[nextStep as keyof typeof STEP_INDEX_MAP],
      skill: getSkillForStep(nextStep),
      reason: `${currentStep} complete, advancing to ${nextStep}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP FAILED OR BLOCKED (G1.13, G1.14)
  // ═══════════════════════════════════════════════════════════════════
  if (step.status === 'failed' || step.status === 'blocked') {
    return {
      action: 'recover_failed',
      reason: `Step ${currentStep} is ${step.status}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP IN PROGRESS BUT NO WORKFLOW (G1.15)
  // ═══════════════════════════════════════════════════════════════════
  if (step.status === 'in_progress' && !workflow) {
    return {
      action: 'spawn',
      skill: getSkillForStep(currentStep),
      reason: `Step ${currentStep} in_progress but no active workflow`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP NOT STARTED - SPAWN WORKFLOW (G1.16, G1.17)
  // ═══════════════════════════════════════════════════════════════════
  if (step.status === 'not_started' || step.status === null || step.status === undefined) {
    // Initialize batches when entering implement (G1.17)
    if (currentStep === 'implement' && batches.total === 0) {
      return {
        action: 'initialize_batches',
        reason: 'Entering implement, need to populate batches',
      };
    }
    return {
      action: 'spawn',
      skill: getSkillForStep(currentStep),
      reason: `Step ${currentStep} not started, spawning workflow`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UNKNOWN STATUS - SHOULD NOT HAPPEN (G1.18)
  // ═══════════════════════════════════════════════════════════════════
  console.error(`[orchestration-decisions] Unknown step.status: ${step.status}`);
  return {
    action: 'needs_attention',
    reason: `Unknown status: ${step.status}`,
    errorMessage: `Unexpected step status: ${step.status}`,
    recoveryOptions: ['retry', 'abort'],
  };
}

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
