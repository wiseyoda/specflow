/**
 * Orchestration Decision Logic - Pure Functions
 *
 * Simplified decision matrix that trusts CLI state as the source of truth.
 * The runner supplies the current step/status, dashboard config, batch tracking,
 * and a snapshot of any active workflow.
 */

import type {
  BatchTracking,
  OrchestrationConfig,
  OrchestrationPhase,
  StepStatus,
} from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export type DecisionAction =
  | 'idle'
  | 'wait'
  | 'spawn'
  | 'transition'
  | 'wait_merge'
  | 'initialize_batches'
  | 'advance_batch'
  | 'heal_batch'
  | 'needs_attention';

export interface Decision {
  action: DecisionAction;
  reason: string;
  nextStep?: string;
  skill?: string;
  batchIndex?: number;
  context?: string;
  pauseAfterAdvance?: boolean;
}

export interface WorkflowState {
  id: string;
  status: 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';
}

export interface DecisionInput {
  active: boolean;
  step: {
    current: OrchestrationPhase;
    status: StepStatus | null;
  };
  config: OrchestrationConfig;
  batches: BatchTracking;
  workflow: WorkflowState | null;
}

// =============================================================================
// Helpers
// =============================================================================

const ACTIVE_WORKFLOW_STATUSES = new Set<WorkflowState['status']>([
  'running',
  'waiting_for_input',
]);

function hasActiveWorkflow(workflow: WorkflowState | null): boolean {
  return Boolean(workflow && ACTIVE_WORKFLOW_STATUSES.has(workflow.status));
}

export function areAllBatchesComplete(batches: BatchTracking): boolean {
  if (batches.items.length === 0) return false;
  return batches.items.every(
    (batch) => batch.status === 'completed' || batch.status === 'healed'
  );
}

function buildBatchContext(
  batch: BatchTracking['items'][number],
  additionalContext?: string
): string {
  const base = `Execute only the "${batch.section}" section (${batch.taskIds.join(', ')}). Do NOT work on tasks from other sections.`;
  return additionalContext ? `${base}\n\n${additionalContext}` : base;
}

// =============================================================================
// Decision Matrix
// =============================================================================

export function getNextAction(input: DecisionInput): Decision {
  if (!input.active) {
    return { action: 'idle', reason: 'No active orchestration' };
  }

  const stepStatus: StepStatus = input.step.status ?? 'not_started';

  if (hasActiveWorkflow(input.workflow) && stepStatus !== 'complete' && stepStatus !== 'failed') {
    return { action: 'wait', reason: 'Workflow running' };
  }

  switch (input.step.current) {
    case 'design':
      return handleSimpleStep('design', 'analyze', stepStatus, input.workflow);
    case 'analyze':
      return handleSimpleStep('analyze', 'implement', stepStatus, input.workflow);
    case 'implement':
      return handleImplement(stepStatus, input.batches, input.config, input.workflow);
    case 'verify':
      return handleVerify(stepStatus, input.config, input.workflow);
    case 'merge':
      return handleMerge(stepStatus, input.workflow);
    default:
      return { action: 'needs_attention', reason: `Unknown step: ${input.step.current}` };
  }
}

function handleSimpleStep(
  current: OrchestrationPhase,
  next: OrchestrationPhase,
  stepStatus: StepStatus,
  workflow: WorkflowState | null
): Decision {
  if (workflow?.status === 'failed') {
    return { action: 'needs_attention', reason: `${current} workflow failed` };
  }

  if (stepStatus === 'complete') {
    return {
      action: 'transition',
      nextStep: next,
      skill: `flow.${next}`,
      reason: `${current} complete`,
    };
  }

  if (stepStatus === 'failed') {
    return { action: 'needs_attention', reason: `${current} failed` };
  }

  if (!hasActiveWorkflow(workflow)) {
    return { action: 'spawn', skill: `flow.${current}`, reason: `Start ${current}` };
  }

  return { action: 'wait', reason: `${current} in progress` };
}

function handleImplement(
  stepStatus: StepStatus,
  batches: BatchTracking,
  config: OrchestrationConfig,
  workflow: WorkflowState | null
): Decision {
  if (stepStatus === 'complete' || areAllBatchesComplete(batches)) {
    return {
      action: 'transition',
      nextStep: 'verify',
      skill: 'flow.verify',
      reason: stepStatus === 'complete' ? 'Implement complete' : 'All batches complete',
    };
  }

  if (stepStatus === 'failed') {
    return { action: 'needs_attention', reason: 'Implement failed' };
  }

  if (batches.total === 0) {
    return { action: 'initialize_batches', reason: 'No batches initialized' };
  }

  const currentBatch = batches.items[batches.current];
  if (!currentBatch) {
    return { action: 'needs_attention', reason: 'Missing current batch' };
  }

  if (workflow?.status === 'failed') {
    if (config.autoHealEnabled && currentBatch.healAttempts < config.maxHealAttempts) {
      return {
        action: 'heal_batch',
        batchIndex: batches.current,
        reason: 'Batch workflow failed, attempting heal',
      };
    }
    return {
      action: 'needs_attention',
      reason: `Batch ${batches.current + 1} failed after ${currentBatch.healAttempts} attempts`,
    };
  }

  if (currentBatch.status === 'running' && workflow?.status === 'completed') {
    const hasNextBatch = batches.current < batches.total - 1;
    return {
      action: 'advance_batch',
      batchIndex: batches.current,
      pauseAfterAdvance: config.pauseBetweenBatches && hasNextBatch,
      reason: `Batch ${batches.current + 1} workflow completed`,
    };
  }

  if (currentBatch.status === 'completed' || currentBatch.status === 'healed') {
    const hasNextBatch = batches.current < batches.total - 1;
    return {
      action: 'advance_batch',
      batchIndex: batches.current,
      pauseAfterAdvance: config.pauseBetweenBatches && hasNextBatch,
      reason: `Batch ${batches.current + 1} complete`,
    };
  }

  if (currentBatch.status === 'failed') {
    if (config.autoHealEnabled && currentBatch.healAttempts < config.maxHealAttempts) {
      return {
        action: 'heal_batch',
        batchIndex: batches.current,
        reason: 'Batch failed, attempting heal',
      };
    }
    return {
      action: 'needs_attention',
      reason: `Batch ${batches.current + 1} failed after ${currentBatch.healAttempts} attempts`,
    };
  }

  if (currentBatch.status === 'running' && !hasActiveWorkflow(workflow)) {
    return {
      action: 'needs_attention',
      reason: 'Batch marked running but no workflow is active',
    };
  }

  if (currentBatch.status === 'pending' && !hasActiveWorkflow(workflow)) {
    return {
      action: 'spawn',
      skill: 'flow.implement',
      batchIndex: batches.current,
      context: buildBatchContext(currentBatch, config.additionalContext),
      reason: `Start batch ${batches.current + 1}/${batches.total}: ${currentBatch.section}`,
    };
  }

  return { action: 'wait', reason: 'Batch in progress' };
}

function handleVerify(
  stepStatus: StepStatus,
  config: OrchestrationConfig,
  workflow: WorkflowState | null
): Decision {
  if (workflow?.status === 'failed') {
    return { action: 'needs_attention', reason: 'Verify workflow failed' };
  }

  if (stepStatus === 'complete') {
    if (config.autoMerge) {
      return {
        action: 'transition',
        nextStep: 'merge',
        skill: 'flow.merge',
        reason: 'Verify complete, auto-merge',
      };
    }
    return { action: 'wait_merge', reason: 'Verify complete, waiting for user' };
  }

  if (stepStatus === 'failed') {
    return { action: 'needs_attention', reason: 'Verify failed' };
  }

  if (!hasActiveWorkflow(workflow)) {
    return { action: 'spawn', skill: 'flow.verify', reason: 'Start verify' };
  }

  return { action: 'wait', reason: 'Verify in progress' };
}

function handleMerge(
  stepStatus: StepStatus,
  workflow: WorkflowState | null
): Decision {
  if (workflow?.status === 'failed') {
    return { action: 'needs_attention', reason: 'Merge workflow failed' };
  }

  if (stepStatus === 'complete') {
    return { action: 'transition', nextStep: 'complete', reason: 'Merge complete' };
  }

  if (!hasActiveWorkflow(workflow)) {
    return { action: 'wait', reason: 'Awaiting merge trigger' };
  }

  return { action: 'wait', reason: 'Merge in progress' };
}
