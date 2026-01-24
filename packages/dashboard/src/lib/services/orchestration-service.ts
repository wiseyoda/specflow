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

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readPidFile, isPidAlive, killProcess, cleanupPidFile } from './process-spawner';
import {
  type OrchestrationConfig,
  type OrchestrationPhase,
  type OrchestrationStatus,
  type BatchTracking,
  type BatchPlan,
  type DecisionLogEntry,
  type DashboardState,
  type OrchestrationState,
  OrchestrationStateSchema,
  DashboardStateSchema,
} from '@specflow/shared';
import { parseBatchesFromProject, createBatchTracking } from './batch-parser';
import type { OrchestrationExecution } from './orchestration-types';

// =============================================================================
// Constants
// =============================================================================

const ORCHESTRATION_FILE_PREFIX = 'orchestration-';

// =============================================================================
// CLI State File Helpers (FR-001 - Single Source of Truth)
// =============================================================================

/**
 * Get the CLI state file path for a project
 */
function getCliStateFilePath(projectPath: string): string {
  // Try .specflow first (v3), then .specify (v2)
  const v3Path = join(projectPath, '.specflow', 'orchestration-state.json');
  const v2Path = join(projectPath, '.specify', 'orchestration-state.json');
  return existsSync(v3Path) ? v3Path : existsSync(v2Path) ? v2Path : v3Path;
}

/**
 * Read the full CLI state file
 */
function readCliState(projectPath: string): OrchestrationState | null {
  const statePath = getCliStateFilePath(projectPath);
  if (!existsSync(statePath)) {
    return null;
  }
  try {
    const content = readFileSync(statePath, 'utf-8');
    return OrchestrationStateSchema.parse(JSON.parse(content));
  } catch (error) {
    console.warn('[orchestration-service] Failed to read CLI state:', error);
    return null;
  }
}

/**
 * Read dashboard state from CLI state file
 * Returns the orchestration.dashboard section or null if not present
 */
export function readDashboardState(projectPath: string): DashboardState | null {
  const state = readCliState(projectPath);
  if (!state?.orchestration?.dashboard) {
    return null;
  }
  try {
    return DashboardStateSchema.parse(state.orchestration.dashboard);
  } catch (error) {
    console.warn('[orchestration-service] Invalid dashboard state:', error);
    return null;
  }
}

/**
 * Write dashboard state to CLI state file
 * Uses specflow state set for atomic, validated writes
 */
export async function writeDashboardState(
  projectPath: string,
  updates: Partial<DashboardState>
): Promise<void> {
  const commands: string[] = [];

  // Build specflow state set commands for each field
  if (updates.active !== undefined) {
    if (updates.active === null) {
      commands.push('orchestration.dashboard.active=null');
    } else {
      if (updates.active.id) commands.push(`orchestration.dashboard.active.id=${updates.active.id}`);
      if (updates.active.startedAt) commands.push(`orchestration.dashboard.active.startedAt=${updates.active.startedAt}`);
      if (updates.active.status) commands.push(`orchestration.dashboard.active.status=${updates.active.status}`);
      // Config is a complex object - serialize to JSON
      if (updates.active.config) {
        const configJson = JSON.stringify(updates.active.config).replace(/"/g, '\\"');
        commands.push(`orchestration.dashboard.active.config="${configJson}"`);
      }
    }
  }

  if (updates.batches !== undefined) {
    commands.push(`orchestration.dashboard.batches.total=${updates.batches.total}`);
    commands.push(`orchestration.dashboard.batches.current=${updates.batches.current}`);
    // Items array needs special handling - serialize to JSON
    const itemsJson = JSON.stringify(updates.batches.items).replace(/"/g, '\\"');
    commands.push(`orchestration.dashboard.batches.items="${itemsJson}"`);
  }

  if (updates.cost !== undefined) {
    commands.push(`orchestration.dashboard.cost.total=${updates.cost.total}`);
    const perBatchJson = JSON.stringify(updates.cost.perBatch);
    commands.push(`orchestration.dashboard.cost.perBatch="${perBatchJson}"`);
  }

  if (updates.lastWorkflow !== undefined) {
    if (updates.lastWorkflow === null) {
      commands.push('orchestration.dashboard.lastWorkflow=null');
    } else {
      commands.push(`orchestration.dashboard.lastWorkflow.id=${updates.lastWorkflow.id}`);
      commands.push(`orchestration.dashboard.lastWorkflow.skill=${updates.lastWorkflow.skill}`);
      commands.push(`orchestration.dashboard.lastWorkflow.status=${updates.lastWorkflow.status}`);
    }
  }

  if (updates.decisionLog !== undefined) {
    const logJson = JSON.stringify(updates.decisionLog).replace(/"/g, '\\"');
    commands.push(`orchestration.dashboard.decisionLog="${logJson}"`);
  }

  if (updates.recoveryContext !== undefined) {
    if (!updates.recoveryContext) {
      // Clear recovery context by setting to empty object
      commands.push('orchestration.dashboard.recoveryContext=null');
    } else {
      commands.push(`orchestration.dashboard.recoveryContext.issue=${updates.recoveryContext.issue}`);
      const optionsJson = JSON.stringify(updates.recoveryContext.options);
      commands.push(`orchestration.dashboard.recoveryContext.options="${optionsJson}"`);
      if (updates.recoveryContext.failedWorkflowId) {
        commands.push(`orchestration.dashboard.recoveryContext.failedWorkflowId=${updates.recoveryContext.failedWorkflowId}`);
      }
    }
  }

  if (commands.length === 0) {
    return; // Nothing to update
  }

  // Execute specflow state set with all updates
  const fullCommand = `specflow state set ${commands.join(' ')}`;
  try {
    execSync(fullCommand, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch (error) {
    console.error('[orchestration-service] Failed to write dashboard state:', error);
    throw error;
  }
}

/**
 * Helper to add a decision log entry via CLI state
 */
export async function logDashboardDecision(
  projectPath: string,
  action: string,
  reason: string
): Promise<void> {
  const state = readDashboardState(projectPath);
  const currentLog = state?.decisionLog || [];
  const newEntry = {
    timestamp: new Date().toISOString(),
    action,
    reason,
  };
  await writeDashboardState(projectPath, {
    decisionLog: [...currentLog, newEntry],
  });
}

// =============================================================================
// State Persistence (FR-023) - Legacy OrchestrationExecution file support
// =============================================================================

/**
 * Get the starting phase based on config skip settings
 */
function getStartingPhase(config: OrchestrationConfig): OrchestrationPhase {
  if (!config.skipDesign) return 'design';
  if (!config.skipAnalyze) return 'analyze';
  if (!config.skipImplement) return 'implement';
  if (!config.skipVerify) return 'verify';
  return 'merge';
}

/**
 * Create a new orchestration execution with defaults
 */
function createOrchestrationExecution(
  id: string,
  projectId: string,
  config: OrchestrationConfig,
  batches: BatchTracking
): OrchestrationExecution {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    status: 'running',
    config,
    currentPhase: getStartingPhase(config),
    batches,
    executions: {
      implement: [],
      healers: [],
    },
    startedAt: now,
    updatedAt: now,
    decisionLog: [],
    totalCostUsd: 0,
  };
}

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
 * Save orchestration state to file (atomic write - G5.1, G5.2)
 *
 * Uses write-to-temp + atomic rename pattern to prevent partial writes
 * from corrupting state during crashes or concurrent access.
 */
function saveOrchestration(projectPath: string, execution: OrchestrationExecution): void {
  const filePath = getOrchestrationPath(projectPath, execution.id);
  const tempPath = `${filePath}.tmp`;

  execution.updatedAt = new Date().toISOString();
  const content = JSON.stringify(execution, null, 2);

  // G5.1: Write to temp file first
  writeFileSync(tempPath, content);

  // G5.2: Atomic rename (POSIX guarantees atomicity on same filesystem)
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if rename fails
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Sync current phase to orchestration-state.json for UI consistency
 * This keeps the state file in sync with the orchestration execution
 */
function syncPhaseToStateFile(projectPath: string, phase: OrchestrationPhase): void {
  try {
    // Try .specflow first (v3), then .specify (v2)
    let statePath = join(projectPath, '.specflow', 'orchestration-state.json');
    if (!existsSync(statePath)) {
      statePath = join(projectPath, '.specify', 'orchestration-state.json');
    }
    if (!existsSync(statePath)) {
      return; // No state file to update
    }

    const content = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content);

    // Update step.current to match orchestration phase
    if (state.orchestration) {
      state.orchestration.step = state.orchestration.step || {};
      state.orchestration.step.current = phase;
      state.orchestration.step.status = 'in_progress';
      state.last_updated = new Date().toISOString();
    }

    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {
    // Non-critical: log but don't fail orchestration
    console.warn('[orchestration-service] Failed to sync phase to state file');
  }
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
    return JSON.parse(content) as OrchestrationExecution;
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
        const execution = JSON.parse(content) as OrchestrationExecution;
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
 * Staleness threshold for waiting_merge orchestrations
 * If an orchestration has been waiting for merge for longer than this, consider it stale
 */
const WAITING_MERGE_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check if an orchestration is stale based on its status and age
 */
function isOrchestrationStale(orchestration: OrchestrationExecution): boolean {
  // Only apply staleness check to waiting_merge status
  // running/paused should always be considered active regardless of age
  if (orchestration.status !== 'waiting_merge') {
    return false;
  }

  // Check if waiting_merge has been stale for too long
  const updatedAt = new Date(orchestration.updatedAt).getTime();
  const age = Date.now() - updatedAt;
  return age > WAITING_MERGE_STALE_MS;
}

/**
 * Find active orchestration for a project (FR-024)
 * Returns the first orchestration in 'running' or 'paused' status
 * Excludes stale waiting_merge orchestrations (older than 2 hours)
 */
function findActiveOrchestration(projectPath: string): OrchestrationExecution | null {
  const orchestrations = listOrchestrations(projectPath);
  return orchestrations.find((o) =>
    ['running', 'paused', 'waiting_merge'].includes(o.status) &&
    !isOrchestrationStale(o)
  ) || null;
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
/**
 * Check if a phase is complete based on specflow status
 * Exported for use by orchestration-runner.ts
 */
export function isPhaseComplete(status: SpecflowStatus | null, phase: OrchestrationPhase): boolean {
  if (!status) return false;

  // FR-001: Trust step.status as single source of truth
  // Sub-commands set step.status=complete when they finish
  // No artifact checks needed - we trust the state file
  const currentStep = status.orchestration?.step?.current;
  const stepStatus = status.orchestration?.step?.status;

  switch (phase) {
    case 'design':
      // Design complete when step moved past design OR status is complete
      return currentStep !== 'design' ||
        (currentStep === 'design' && stepStatus === 'complete');

    case 'analyze':
      // Analyze complete when step moved past analyze OR status is complete
      return currentStep === 'implement' ||
        currentStep === 'verify' ||
        currentStep === 'merge' ||
        (currentStep === 'analyze' && stepStatus === 'complete');

    case 'implement':
      // Implement complete when step moved past implement OR status is complete
      return currentStep === 'verify' ||
        currentStep === 'merge' ||
        (currentStep === 'implement' && stepStatus === 'complete');

    case 'verify':
      // Verify complete when step moved past verify OR status is complete
      return currentStep === 'merge' ||
        (currentStep === 'verify' && stepStatus === 'complete');

    case 'merge':
      // Merge is complete when step.status is complete at merge step
      return currentStep === 'merge' && stepStatus === 'complete';

    case 'complete':
      return true;

    default:
      return false;
  }
}

/**
 * Check if a step is complete for a project (convenience wrapper)
 */
function isStepComplete(projectPath: string, phase: OrchestrationPhase): boolean {
  const status = getSpecflowStatus(projectPath);
  return isPhaseComplete(status, phase);
}

// =============================================================================
// State Machine (FR-020, T016)
// =============================================================================

/**
 * Get the next phase in the orchestration flow
 * Respects all skip flags: skipDesign, skipAnalyze, skipImplement, skipVerify
 */
export function getNextPhase(
  current: OrchestrationPhase,
  config: OrchestrationConfig
): OrchestrationPhase | null {
  const phases: OrchestrationPhase[] = ['design', 'analyze', 'implement', 'verify', 'merge', 'complete'];

  // Find current index
  const currentIndex = phases.indexOf(current);
  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }

  // Get next phase, respecting skip flags
  let nextIndex = currentIndex + 1;
  let nextPhase = phases[nextIndex];

  // Skip phases as configured (loop to handle consecutive skips)
  while (nextPhase && nextIndex < phases.length - 1) {
    const shouldSkip =
      (nextPhase === 'design' && config.skipDesign) ||
      (nextPhase === 'analyze' && config.skipAnalyze) ||
      (nextPhase === 'implement' && config.skipImplement) ||
      (nextPhase === 'verify' && config.skipVerify);

    if (!shouldSkip) break;

    console.log(`[getNextPhase] Skipping ${nextPhase} (skip flag is true)`);
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

    // Save initial state to legacy file (for backwards compatibility during migration)
    saveOrchestration(projectPath, execution);

    // FR-001: Write to CLI state as single source of truth
    await writeDashboardState(projectPath, {
      active: {
        id,
        startedAt: execution.startedAt,
        status: 'running',
        config,
      },
      batches: {
        total: batches.total,
        current: batches.current,
        items: batches.items.map((b) => ({
          section: b.section,
          taskIds: b.taskIds,
          status: b.status,
          workflowId: b.workflowExecutionId,
          healAttempts: b.healAttempts,
        })),
      },
      cost: {
        total: 0,
        perBatch: [],
      },
      decisionLog: [{
        timestamp: new Date().toISOString(),
        action: 'start',
        reason: batchPlan ? 'User initiated orchestration' : 'User initiated orchestration (phase will be opened first)',
      }],
      lastWorkflow: null,
    });

    // Sync initial phase to state file for UI consistency
    syncPhaseToStateFile(projectPath, execution.currentPhase);

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
   * FR-001: Primarily reads from CLI state, falls back to legacy file
   */
  get(projectPath: string, id: string): OrchestrationExecution | null {
    // First try CLI state (single source of truth)
    const dashboardState = readDashboardState(projectPath);
    if (dashboardState?.active?.id === id) {
      // Convert CLI state to OrchestrationExecution format for compatibility
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    // Fall back to legacy file for backwards compatibility
    return loadOrchestration(projectPath, id);
  }

  /**
   * Get active orchestration for a project
   * FR-001: Primarily reads from CLI state, falls back to legacy file
   */
  getActive(projectPath: string): OrchestrationExecution | null {
    // First try CLI state (single source of truth)
    const dashboardState = readDashboardState(projectPath);
    if (dashboardState?.active) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    // Fall back to legacy finder
    return findActiveOrchestration(projectPath);
  }

  /**
   * Convert CLI dashboard state to OrchestrationExecution format
   * Used during migration period for backwards compatibility
   */
  private convertDashboardStateToExecution(
    projectPath: string,
    dashboardState: DashboardState
  ): OrchestrationExecution | null {
    if (!dashboardState.active) return null;

    // Read project ID from registry
    const cliState = readCliState(projectPath);
    const projectId = cliState?.project?.id || 'unknown';

    // Map dashboard status to orchestration status
    const statusMap: Record<string, OrchestrationStatus> = {
      'running': 'running',
      'paused': 'paused',
      'waiting_merge': 'waiting_merge',
      'needs_attention': 'needs_attention',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
    };

    // Get current phase from CLI state step
    const step = cliState?.orchestration?.step;
    const phaseMap: Record<string, OrchestrationPhase> = {
      'design': 'design',
      'analyze': 'analyze',
      'implement': 'implement',
      'verify': 'verify',
    };
    const currentPhase: OrchestrationPhase = step?.current && phaseMap[step.current]
      ? phaseMap[step.current]
      : 'design';

    return {
      id: dashboardState.active.id,
      projectId,
      status: statusMap[dashboardState.active.status] || 'running',
      config: dashboardState.active.config,
      currentPhase,
      batches: {
        total: dashboardState.batches?.total || 0,
        current: dashboardState.batches?.current || 0,
        items: (dashboardState.batches?.items || []).map((b, i) => ({
          index: i,
          section: b.section,
          taskIds: b.taskIds,
          status: b.status,
          healAttempts: b.healAttempts || 0,
          workflowExecutionId: b.workflowId,
        })),
      },
      executions: {
        implement: [],
        healers: [],
      },
      startedAt: dashboardState.active.startedAt,
      updatedAt: new Date().toISOString(),
      decisionLog: (dashboardState.decisionLog || []).map((d) => ({
        timestamp: d.timestamp,
        decision: d.action,
        reason: d.reason,
      })),
      totalCostUsd: dashboardState.cost?.total || 0,
      recoveryContext: dashboardState.recoveryContext,
    };
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
      // Sync to state file for UI consistency
      syncPhaseToStateFile(projectPath, nextPhase);
      return execution;
    }

    // Transition to next phase
    execution.currentPhase = nextPhase;
    logDecision(execution, 'transition', `Moving from ${currentPhase} to ${nextPhase}`);
    saveOrchestration(projectPath, execution);

    // Sync to state file for UI consistency (project list, sidebar)
    syncPhaseToStateFile(projectPath, nextPhase);

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
    if (!execution.executions.healers) execution.executions.healers = [];
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
   * Go back to a previous step (FR-004 - UI Step Override)
   *
   * This allows the UI to let users click a step to go back to it.
   * Sets step.current to the target step and step.status to not_started.
   *
   * @param projectPath - Project path for CLI commands
   * @param orchestrationId - Active orchestration ID
   * @param targetStep - The step to go back to (design, analyze, implement, verify)
   * @returns Updated orchestration execution or null if failed
   */
  async goBackToStep(
    projectPath: string,
    orchestrationId: string,
    targetStep: string
  ): Promise<OrchestrationExecution | null> {
    const validSteps = ['design', 'analyze', 'implement', 'verify'];
    if (!validSteps.includes(targetStep)) {
      console.error(`[orchestration-service] Invalid target step: ${targetStep}`);
      return null;
    }

    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return null;

    // Pause the orchestration if running
    if (execution.status === 'running') {
      // Kill any active workflow
      const currentWorkflowId = this.getCurrentWorkflowId(execution);
      if (currentWorkflowId) {
        const workflowDir = join(projectPath, '.specflow', 'workflows', currentWorkflowId);
        const pids = readPidFile(workflowDir);
        if (pids) {
          if (pids.claudePid && isPidAlive(pids.claudePid)) {
            killProcess(pids.claudePid, false);
          }
          if (pids.bashPid && isPidAlive(pids.bashPid)) {
            killProcess(pids.bashPid, false);
          }
          cleanupPidFile(workflowDir);
        }
      }
    }

    // Update CLI state via specflow state set
    try {
      const stepIndex = validSteps.indexOf(targetStep);
      execSync(
        `specflow state set orchestration.step.current=${targetStep} orchestration.step.status=not_started orchestration.step.index=${stepIndex}`,
        {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
        }
      );

      // Update dashboard state
      await writeDashboardState(projectPath, {
        lastWorkflow: null, // Clear last workflow when going back
      });

      // Update local execution state
      execution.currentPhase = targetStep as OrchestrationPhase;
      execution.status = 'running';
      logDecision(execution, 'go_back_to_step', `User navigated back to ${targetStep} step`);
      saveOrchestration(projectPath, execution);

      // Sync phase to state file
      syncPhaseToStateFile(projectPath, targetStep as OrchestrationPhase);

      console.log(`[orchestration-service] Went back to step: ${targetStep}`);
      return execution;
    } catch (error) {
      console.error(`[orchestration-service] Failed to go back to step: ${error}`);
      return null;
    }
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
   * Touch activity timestamp for external session detection (G6.6)
   * Called when external CLI session activity is detected
   */
  touchActivity(projectPath: string, orchestrationId: string): void {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return;

    // saveOrchestration already updates updatedAt, so just save
    saveOrchestration(projectPath, execution);
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

  /**
   * Add an entry to the decision log (public interface for runner)
   */
  logDecision(
    projectPath: string,
    orchestrationId: string,
    decision: string,
    reason: string,
    data?: Record<string, unknown>
  ): void {
    const execution = loadOrchestration(projectPath, orchestrationId);
    if (!execution) return;

    logDecision(execution, decision, reason, data);
    saveOrchestration(projectPath, execution);
  }
}

// Export singleton
export const orchestrationService = new OrchestrationService();
