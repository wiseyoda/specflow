/**
 * Orchestration Service - State machine for autonomous phase completion
 *
 * Manages orchestration lifecycle through phases:
 * design → analyze → implement → verify → merge
 *
 * Features:
 * - State machine with dual confirmation pattern
 * - Per-batch implementation tracking
 * - State persistence to project-local JSON
 * - Decision logging with timestamps
 * - Integration with specflow status --json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readPidFile, isPidAlive, killProcess, cleanupPidFile } from './process-spawner';
import {
  type OrchestrationExecution,
  type OrchestrationConfig,
  type OrchestrationPhase,
  type OrchestrationStatus,
  type BatchTracking,
  type BatchPlan,
  type DecisionLogEntry,
  OrchestrationExecutionSchema,
  createOrchestrationExecution,
} from '@specflow/shared';
import { parseBatchesFromProject, createBatchTracking } from './batch-parser';

// =============================================================================
// Constants
// =============================================================================

const ORCHESTRATION_FILE_PREFIX = 'orchestration-';

// =============================================================================
// State Persistence (FR-023)
// =============================================================================

/**
 * Get the orchestration directory for a project
 */
function getOrchestrationDir(projectPath: string): string {
  const dir = join(projectPath, '.specflow', 'workflows');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the file path for an orchestration
 */
function getOrchestrationPath(projectPath: string, id: string): string {
  return join(getOrchestrationDir(projectPath), `${ORCHESTRATION_FILE_PREFIX}${id}.json`);
}

/**
 * Save orchestration state to file
 */
function saveOrchestration(projectPath: string, execution: OrchestrationExecution): void {
  const filePath = getOrchestrationPath(projectPath, execution.id);
  execution.updatedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(execution, null, 2));
}

/**
 * Load orchestration state from file
 */
function loadOrchestration(projectPath: string, id: string): OrchestrationExecution | null {
  const filePath = getOrchestrationPath(projectPath, id);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return OrchestrationExecutionSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

/**
 * List all orchestrations for a project
 */
function listOrchestrations(projectPath: string): OrchestrationExecution[] {
  const dir = getOrchestrationDir(projectPath);
  const orchestrations: OrchestrationExecution[] = [];

  try {
    const files = readdirSync(dir).filter(
      (f) => f.startsWith(ORCHESTRATION_FILE_PREFIX) && f.endsWith('.json')
    );

    for (const file of files) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        const execution = OrchestrationExecutionSchema.parse(JSON.parse(content));
        orchestrations.push(execution);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Sort by updatedAt descending
  return orchestrations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Find active orchestration for a project (FR-024)
 * Returns the first orchestration in 'running' or 'paused' status
 */
function findActiveOrchestration(projectPath: string): OrchestrationExecution | null {
  const orchestrations = listOrchestrations(projectPath);
  return orchestrations.find((o) => ['running', 'paused', 'waiting_merge'].includes(o.status)) || null;
}

// =============================================================================
// Decision Logging (FR-064)
// =============================================================================

/**
 * Add entry to decision log
 */
function logDecision(
  execution: OrchestrationExecution,
  decision: string,
  reason: string,
  data?: Record<string, unknown>
): void {
  const entry: DecisionLogEntry = {
    timestamp: new Date().toISOString(),
    decision,
    reason,
    data,
  };
  execution.decisionLog.push(entry);
}

// =============================================================================
// Specflow Status Integration (FR-021, T020)
// =============================================================================

interface SpecflowStatus {
  phase?: {
    number?: number;
    name?: string;
    dir?: string;
  };
  context?: {
    hasSpec?: boolean;
    hasPlan?: boolean;
    hasTasks?: boolean;
    featureDir?: string;
  };
  progress?: {
    tasksTotal?: number;
    tasksComplete?: number;
    percentage?: number;
  };
  orchestration?: {
    step?: {
      current?: string;
      status?: string;
    };
  };
}

/**
 * Get specflow status for a project
 */
function getSpecflowStatus(projectPath: string): SpecflowStatus | null {
  try {
    const result = execSync('specflow status --json', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Check if a step is complete based on specflow status
 */
function isStepComplete(projectPath: string, phase: OrchestrationPhase): boolean {
  const status = getSpecflowStatus(projectPath);
  if (!status) return false;

  switch (phase) {
    case 'design':
      return status.context?.hasPlan === true && status.context?.hasTasks === true;
    case 'analyze':
      // Analyze doesn't produce new artifacts - check orchestration state
      return status.orchestration?.step?.current === 'implement';
    case 'implement':
      // All tasks complete
      return (
        status.progress?.tasksComplete === status.progress?.tasksTotal &&
        (status.progress?.tasksTotal ?? 0) > 0
      );
    case 'verify':
      // Check orchestration state moved to merge
      return status.orchestration?.step?.current === 'merge';
    case 'merge':
      return status.orchestration?.step?.status === 'complete';
    case 'complete':
      return true;
    default:
      return false;
  }
}

// =============================================================================
// State Machine (FR-020, T016)
// =============================================================================

/**
 * Get the next phase in the orchestration flow
 */
function getNextPhase(
  current: OrchestrationPhase,
  config: OrchestrationConfig
): OrchestrationPhase | null {
  const phases: OrchestrationPhase[] = ['design', 'analyze', 'implement', 'verify', 'merge', 'complete'];

  // Find current index
  const currentIndex = phases.indexOf(current);
  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }

  // Get next phase
  let nextIndex = currentIndex + 1;
  let nextPhase = phases[nextIndex];

  // Skip design if configured
  if (nextPhase === 'design' && config.skipDesign) {
    nextIndex++;
    nextPhase = phases[nextIndex];
  }

  // Skip analyze if configured
  if (nextPhase === 'analyze' && config.skipAnalyze) {
    nextIndex++;
    nextPhase = phases[nextIndex];
  }

  // Auto-merge handling: if disabled, stop at 'waiting_merge' instead of 'merge'
  // This is handled by the status, not the phase

  return nextPhase || null;
}

/**
 * Get the skill command for a phase
 */
function getPhaseSkill(phase: OrchestrationPhase): string {
  switch (phase) {
    case 'design':
      return '/flow.design';
    case 'analyze':
      return '/flow.analyze';
    case 'implement':
      return '/flow.implement';
    case 'verify':
      return '/flow.verify';
    case 'merge':
      return '/flow.merge';
    default:
      return '';
  }
}

// =============================================================================
// Orchestration Service Class
// =============================================================================

class OrchestrationService {
  /**
   * Start a new orchestration for a project
   *
   * @param projectId - Registry project key
   * @param projectPath - Path to the project root
   * @param config - Orchestration configuration
   * @param batchPlan - Pre-parsed batch plan (null when phase needs opening first)
   */
  async start(
    projectId: string,
    projectPath: string,
    config: OrchestrationConfig,
    batchPlan: BatchPlan | null = null
  ): Promise<OrchestrationExecution> {
    // Check for existing active orchestration (FR-024)
    const existing = findActiveOrchestration(projectPath);
    if (existing) {
      throw new Error(
        `Orchestration already in progress: ${existing.id}. Cancel it first or wait for completion.`
      );
    }

    // Create batch tracking from plan, or empty tracking if phase needs opening
    let batches: BatchTracking;
    let taskCount = 0;
    let usedFallback = false;

    if (batchPlan) {
      // Normal case: phase is open and we have tasks
      batches = createBatchTracking(batchPlan);
      taskCount = batchPlan.totalIncomplete;
      usedFallback = batchPlan.usedFallback;
    } else {
      // Phase needs opening: start with empty batches
      // Batches will be populated after design completes
      batches = {
        total: 0,
        current: 0,
        items: [],
      };
    }

    // Create execution
    const id = randomUUID();
    const execution = createOrchestrationExecution(id, projectId, config, batches);

    // Log initial decision
    logDecision(
      execution,
      'start',
      batchPlan ? 'User initiated orchestration' : 'User initiated orchestration (phase will be opened first)',
      {
        config,
        batchCount: batches.total,
        taskCount,
        usedFallback,
        phaseNeedsOpen: !batchPlan,
      }
    );

    // Save initial state
    saveOrchestration(projectPath, execution);

    return execution;
  }

  /**
   * Update batches after design phase completes
   * Called by runner when transitioning from design/analyze to implement
   */
  updateBatches(
    projectPath: string,
    orchestrationId: string,
    batchPlan: BatchPlan
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    // Only update if batches are empty (phase was opened during this orchestration)
    if (execution.batches.total === 0) {
      const batches = createBatchTracking(batchPlan);
      execution.batches = batches;

      logDecision(execution, 'update_batches', 'Batches populated after design phase', {
        batchCount: batches.total,
        taskCount: batchPlan.totalIncomplete,
        usedFallback: batchPlan.usedFallback,
      });

      saveOrchestration(projectPath, execution);
    }

    return execution;
  }

  /**
   * Get orchestration by ID
   */
  get(projectPath: string, id: string): OrchestrationExecution | null {
    return loadOrchestration(projectPath, id);
  }

  /**
   * Get active orchestration for a project
   */
  getActive(projectPath: string): OrchestrationExecution | null {
    return findActiveOrchestration(projectPath);
  }

  /**
   * List all orchestrations for a project
   */
  list(projectPath: string): OrchestrationExecution[] {
    return listOrchestrations(projectPath);
  }

  /**
   * Update orchestration with workflow execution ID
   */
  linkWorkflowExecution(
    projectPath: string,
    orchestrationId: string,
    workflowExecutionId: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const phase = execution.currentPhase;

    // Link to appropriate execution slot
    switch (phase) {
      case 'design':
        execution.executions.design = workflowExecutionId;
        break;
      case 'analyze':
        execution.executions.analyze = workflowExecutionId;
        break;
      case 'implement':
        execution.executions.implement.push(workflowExecutionId);
        // Also link to current batch
        const currentBatch = execution.batches.items[execution.batches.current];
        if (currentBatch) {
          currentBatch.workflowExecutionId = workflowExecutionId;
          currentBatch.status = 'running';
          currentBatch.startedAt = new Date().toISOString();
        }
        break;
      case 'verify':
        execution.executions.verify = workflowExecutionId;
        break;
      case 'merge':
        execution.executions.merge = workflowExecutionId;
        break;
    }

    logDecision(execution, 'link_execution', `Linked workflow execution for ${phase}`, {
      workflowExecutionId,
      phase,
    });

    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Transition to next phase (FR-020, FR-022)
   * Called after dual confirmation (state + process completion)
   */
  transitionToNextPhase(
    projectPath: string,
    orchestrationId: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const currentPhase = execution.currentPhase;
    const nextPhase = getNextPhase(currentPhase, execution.config);

    if (!nextPhase) {
      // No more phases - complete
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      logDecision(execution, 'complete', 'All phases finished');
      saveOrchestration(projectPath, execution);
      return execution;
    }

    // Handle merge phase with auto-merge disabled
    if (nextPhase === 'merge' && !execution.config.autoMerge) {
      execution.currentPhase = nextPhase;
      execution.status = 'waiting_merge';
      logDecision(execution, 'waiting_merge', 'Auto-merge disabled, waiting for user');
      saveOrchestration(projectPath, execution);
      return execution;
    }

    // Transition to next phase
    execution.currentPhase = nextPhase;
    logDecision(execution, 'transition', `Moving from ${currentPhase} to ${nextPhase}`);
    saveOrchestration(projectPath, execution);

    return execution;
  }

  /**
   * Mark current batch as complete and move to next
   */
  completeBatch(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const currentBatch = execution.batches.items[execution.batches.current];
    if (!currentBatch) return execution;

    // Mark batch complete
    currentBatch.status = 'completed';
    currentBatch.completedAt = new Date().toISOString();

    logDecision(execution, 'batch_complete', `Batch ${execution.batches.current + 1} completed`, {
      section: currentBatch.section,
      taskIds: currentBatch.taskIds,
    });

    // Check if more batches
    if (execution.batches.current < execution.batches.total - 1) {
      // Move to next batch
      execution.batches.current++;
      const nextBatch = execution.batches.items[execution.batches.current];
      logDecision(execution, 'next_batch', `Starting batch ${execution.batches.current + 1}`, {
        section: nextBatch.section,
        taskCount: nextBatch.taskIds.length,
      });
    } else {
      // All batches done - ready for verify
      logDecision(execution, 'all_batches_complete', 'All implement batches finished');
    }

    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Mark current batch as failed
   */
  failBatch(
    projectPath: string,
    orchestrationId: string,
    errorMessage: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const currentBatch = execution.batches.items[execution.batches.current];
    if (!currentBatch) return execution;

    currentBatch.status = 'failed';
    currentBatch.completedAt = new Date().toISOString();

    logDecision(execution, 'batch_failed', `Batch ${execution.batches.current + 1} failed`, {
      section: currentBatch.section,
      error: errorMessage,
    });

    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Mark batch as healed after successful auto-heal
   */
  healBatch(
    projectPath: string,
    orchestrationId: string,
    healerExecutionId: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const currentBatch = execution.batches.items[execution.batches.current];
    if (!currentBatch) return execution;

    currentBatch.status = 'healed';
    currentBatch.healerExecutionId = healerExecutionId;
    currentBatch.completedAt = new Date().toISOString();
    execution.executions.healers.push(healerExecutionId);

    logDecision(execution, 'batch_healed', `Batch ${execution.batches.current + 1} healed`, {
      section: currentBatch.section,
      healerExecutionId,
      healAttempts: currentBatch.healAttempts,
    });

    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Increment heal attempt count for current batch
   */
  incrementHealAttempt(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const currentBatch = execution.batches.items[execution.batches.current];
    if (!currentBatch) return execution;

    currentBatch.healAttempts++;
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Check if batch can be healed (FR-043)
   */
  canHealBatch(projectPath: string, orchestrationId: string): boolean {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return false;

    if (!execution.config.autoHealEnabled) return false;

    const currentBatch = execution.batches.items[execution.batches.current];
    if (!currentBatch) return false;

    return currentBatch.healAttempts < execution.config.maxHealAttempts;
  }

  /**
   * Pause orchestration and stop the current workflow process
   * Note: Claude doesn't support true pause - we kill the process and resume from current state
   */
  pause(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution || execution.status !== 'running') return null;

    // Kill the current workflow process
    const currentWorkflowId = this.getCurrentWorkflowId(execution);
    if (currentWorkflowId) {
      const workflowDir = join(projectPath, '.specflow', 'workflows', currentWorkflowId);
      const pids = readPidFile(workflowDir);
      if (pids) {
        if (pids.claudePid && isPidAlive(pids.claudePid)) {
          killProcess(pids.claudePid, false);
          logDecision(execution, 'process_killed', `Paused: killed Claude process ${pids.claudePid}`);
        }
        if (pids.bashPid && isPidAlive(pids.bashPid)) {
          killProcess(pids.bashPid, false);
          logDecision(execution, 'process_killed', `Paused: killed bash process ${pids.bashPid}`);
        }
        cleanupPidFile(workflowDir);
      }
    }

    execution.status = 'paused';
    logDecision(execution, 'pause', 'User requested pause');
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Resume paused orchestration
   */
  resume(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution || execution.status !== 'paused') return null;

    execution.status = 'running';
    logDecision(execution, 'resume', 'User requested resume');
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Trigger merge (for waiting_merge status)
   */
  triggerMerge(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution || execution.status !== 'waiting_merge') return null;

    execution.status = 'running';
    logDecision(execution, 'merge_triggered', 'User triggered merge');
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Cancel orchestration and kill any running workflow process
   */
  cancel(projectPath: string, orchestrationId: string): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    if (!['running', 'paused', 'waiting_merge', 'needs_attention'].includes(execution.status)) {
      return execution; // Already in terminal state
    }

    // Kill the current workflow process if one is running
    const currentWorkflowId = this.getCurrentWorkflowId(execution);
    if (currentWorkflowId) {
      const workflowDir = join(projectPath, '.specflow', 'workflows', currentWorkflowId);
      const pids = readPidFile(workflowDir);
      if (pids) {
        if (pids.claudePid && isPidAlive(pids.claudePid)) {
          killProcess(pids.claudePid, false);
          logDecision(execution, 'process_killed', `Killed Claude process ${pids.claudePid}`);
        }
        if (pids.bashPid && isPidAlive(pids.bashPid)) {
          killProcess(pids.bashPid, false);
          logDecision(execution, 'process_killed', `Killed bash process ${pids.bashPid}`);
        }
        cleanupPidFile(workflowDir);
      }
    }

    execution.status = 'cancelled';
    logDecision(execution, 'cancel', 'User cancelled orchestration');
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Get the current workflow execution ID from orchestration state
   */
  private getCurrentWorkflowId(execution: OrchestrationExecution): string | undefined {
    const { currentPhase, batches, executions } = execution;

    switch (currentPhase) {
      case 'design':
        return executions.design;
      case 'analyze':
        return executions.analyze;
      case 'implement':
        const currentBatch = batches.items[batches.current];
        return currentBatch?.workflowExecutionId;
      case 'verify':
        return executions.verify;
      case 'merge':
        return executions.merge;
      default:
        return undefined;
    }
  }

  /**
   * Mark orchestration as failed
   */
  fail(
    projectPath: string,
    orchestrationId: string,
    errorMessage: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    execution.status = 'failed';
    execution.errorMessage = errorMessage;
    logDecision(execution, 'fail', errorMessage);
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Set orchestration to needs_attention status (recoverable error)
   * Allows user to decide: retry, skip, or abort
   */
  setNeedsAttention(
    projectPath: string,
    orchestrationId: string,
    issue: string,
    options: Array<'retry' | 'skip' | 'abort'>,
    failedWorkflowId?: string
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    execution.status = 'needs_attention';
    execution.recoveryContext = {
      issue,
      options,
      failedWorkflowId,
    };
    logDecision(execution, 'needs_attention', issue);
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Handle recovery action from user (retry, skip, abort)
   */
  handleRecovery(
    projectPath: string,
    orchestrationId: string,
    action: 'retry' | 'skip' | 'abort'
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;
    if (execution.status !== 'needs_attention') return null;

    switch (action) {
      case 'retry':
        // Resume running - runner will respawn the workflow
        execution.status = 'running';
        execution.recoveryContext = undefined;
        logDecision(execution, 'recovery_retry', 'User chose to retry');
        break;

      case 'skip': {
        // Skip to next phase - mark current as done and move on
        execution.status = 'running';
        execution.recoveryContext = undefined;
        logDecision(execution, 'recovery_skip', 'User chose to skip current phase');
        // Actually transition to the next phase
        const nextPhase = getNextPhase(execution.currentPhase, execution.config);
        if (nextPhase) {
          execution.currentPhase = nextPhase;
          logDecision(execution, 'transition', `Skipped to ${nextPhase}`);
        }
        break;
      }

      case 'abort':
        // User chose to abort - mark as cancelled
        execution.status = 'cancelled';
        execution.recoveryContext = undefined;
        logDecision(execution, 'recovery_abort', 'User chose to abort');
        break;
    }

    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Update total cost
   */
  addCost(
    projectPath: string,
    orchestrationId: string,
    costUsd: number
  ): OrchestrationExecution | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    execution.totalCostUsd += costUsd;
    saveOrchestration(projectPath, execution);
    return execution;
  }

  /**
   * Check if budget exceeded (FR-053)
   */
  isBudgetExceeded(projectPath: string, orchestrationId: string): boolean {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return false;

    const budget = execution.config.budget;
    return execution.totalCostUsd >= budget.maxTotal;
  }

  /**
   * Get the skill to run for the current phase
   */
  getCurrentSkill(projectPath: string, orchestrationId: string): string | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    return getPhaseSkill(execution.currentPhase);
  }

  /**
   * Check if current step is complete using specflow status
   */
  isCurrentStepComplete(projectPath: string, orchestrationId: string): boolean {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return false;

    return isStepComplete(projectPath, execution.currentPhase);
  }

  /**
   * Check if all batches are complete
   */
  areAllBatchesComplete(projectPath: string, orchestrationId: string): boolean {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return false;

    return execution.batches.items.every(
      (b) => b.status === 'completed' || b.status === 'healed'
    );
  }

  /**
   * Get current batch info
   */
  getCurrentBatch(projectPath: string, orchestrationId: string): {
    index: number;
    total: number;
    section: string;
    taskIds: string[];
    status: string;
  } | null {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    const batch = execution.batches.items[execution.batches.current];
    if (!batch) return null;

    return {
      index: execution.batches.current,
      total: execution.batches.total,
      section: batch.section,
      taskIds: batch.taskIds,
      status: batch.status,
    };
  }
}

// Export singleton
export const orchestrationService = new OrchestrationService();
