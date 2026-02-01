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

import { existsSync, readFileSync } from 'fs';
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
  type DashboardState,
  type OrchestrationState,
  OrchestrationStateSchema,
  DashboardStateSchema,
  STEP_INDEX_MAP,
} from '@specflow/shared';
import { createBatchTracking } from './batch-parser';
import type { OrchestrationExecution } from './orchestration-types';
import { getSpecflowEnv } from '@/lib/specflow-env';


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
 * Uses safeParse to handle schema mismatches gracefully
 */
function readCliState(projectPath: string): OrchestrationState | null {
  const statePath = getCliStateFilePath(projectPath);
  if (!existsSync(statePath)) {
    return null;
  }
  try {
    const content = readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = OrchestrationStateSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // Return the raw parsed data with type assertion for graceful degradation
    // The dashboard state extraction will handle any missing fields
    return parsed as OrchestrationState;
  } catch (error) {
    console.warn('[orchestration-service] Failed to read CLI state:', error);
    return null;
  }
}

/**
 * Read dashboard state from CLI state file
 * Returns the orchestration.dashboard section or null if not present
 * Uses safeParse for graceful handling of partial/incomplete state
 */
export function readDashboardState(projectPath: string): DashboardState | null {
  const state = readCliState(projectPath);
  if (!state?.orchestration?.dashboard) {
    return null;
  }
  try {
    const result = DashboardStateSchema.safeParse(state.orchestration.dashboard);
    if (result.success) {
      return result.data;
    }
    // Extract what we can from the raw data for graceful degradation
    const raw = state.orchestration.dashboard as Record<string, unknown>;
    const active = raw.active as Record<string, unknown> | null;

    // Build active object with defaults for missing required fields
    type ActiveType = NonNullable<DashboardState['active']>;
    const defaultConfig: ActiveType['config'] = {
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
      budget: { maxPerBatch: 10.0, maxTotal: 50.0, healingBudget: 1.0, decisionBudget: 0.5 },
    };

    return {
      active: active ? {
        id: (active.id as string) || 'unknown',
        startedAt: (active.startedAt as string) || new Date().toISOString(),
        status: ((active.status as string) || 'running') as ActiveType['status'],
        config: (active.config as ActiveType['config']) || defaultConfig,
      } : null,
      batches: { total: 0, current: 0, items: [] },
      cost: { total: 0, perBatch: [] },
      decisionLog: [],
      lastWorkflow: (raw.lastWorkflow as DashboardState['lastWorkflow']) || null,
      recoveryContext: raw.recoveryContext as DashboardState['recoveryContext'],
    };
  } catch (error) {
    console.warn('[orchestration-service] Invalid dashboard state:', error);
    return null;
  }
}

/**
 * Read orchestration step info from CLI state file
 * Returns the orchestration.step object or null if not present
 */
export function readOrchestrationStep(
  projectPath: string
): OrchestrationState['orchestration'] extends { step?: infer Step } ? Step | null : null {
  const state = readCliState(projectPath);
  return state?.orchestration?.step ?? null;
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
      env: getSpecflowEnv(),
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
// Dashboard State Helpers
// =============================================================================

function getActiveDashboardState(
  projectPath: string,
  orchestrationId?: string
): DashboardState | null {
  const state = readDashboardState(projectPath);
  if (!state?.active) return null;
  if (orchestrationId && state.active.id !== orchestrationId) return null;
  return state;
}

async function persistDashboardState(
  projectPath: string,
  state: DashboardState
): Promise<void> {
  await writeDashboardState(projectPath, {
    active: state.active,
    batches: state.batches,
    cost: state.cost,
    decisionLog: state.decisionLog,
    lastWorkflow: state.lastWorkflow,
    recoveryContext: state.recoveryContext,
  });
}

// =============================================================================
// Orchestration Flow Helpers
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
 * Sync current phase to orchestration state via `specflow state set`
 * Uses the CLI as the single source of truth (avoids direct JSON writes)
 */
function syncPhaseToStateFile(
  projectPath: string,
  phase: OrchestrationPhase,
  status: 'in_progress' | 'not_started' | 'complete' = 'in_progress'
): void {
  try {
    // Only sync phases that map to workflow steps
    const stepIndex = STEP_INDEX_MAP[phase as keyof typeof STEP_INDEX_MAP];
    if (stepIndex === undefined) {
      return;
    }

    const commandParts = [
      `orchestration.step.current=${phase}`,
      `orchestration.step.status=${status}`,
      `orchestration.step.index=${stepIndex}`,
    ];

    execSync(`specflow state set ${commandParts.join(' ')}`, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000,
      env: getSpecflowEnv(),
    });
  } catch {
    // Non-critical: log but don't fail orchestration
    console.warn('[orchestration-service] Failed to sync phase to state file');
  }
}

/**
 * Ensure CLI step aligns with orchestration status (e.g., waiting_merge -> merge step).
 */
function ensureStepMatchesStatus(
  projectPath: string,
  status: OrchestrationStatus | undefined
): void {
  if (status !== 'waiting_merge') return;

  const cliState = readCliState(projectPath);
  const step = cliState?.orchestration?.step;
  const expectedIndex = STEP_INDEX_MAP.merge;

  if (
    step?.current !== 'merge' ||
    step?.status !== 'not_started' ||
    step?.index !== expectedIndex
  ) {
    syncPhaseToStateFile(projectPath, 'merge', 'not_started');
  }
}

// =============================================================================
// Decision Logging (FR-064)
// =============================================================================

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
      env: getSpecflowEnv(),
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
    _projectId: string,
    projectPath: string,
    config: OrchestrationConfig,
    batchPlan: BatchPlan | null = null
  ): Promise<OrchestrationExecution> {
    // Check for existing active orchestration (FR-024)
    const existing = getActiveDashboardState(projectPath);
    if (existing?.active) {
      throw new Error(
        `Orchestration already in progress: ${existing.active.id}. Cancel it first or wait for completion.`
      );
    }

    // Create batch tracking from plan, or empty tracking if phase needs opening
    let batches: BatchTracking;
    if (batchPlan) {
      // Normal case: phase is open and we have tasks
      batches = createBatchTracking(batchPlan);
    } else {
      // Phase needs opening: start with empty batches
      // Batches will be populated after design completes
      batches = {
        total: 0,
        current: 0,
        items: [],
      };
    }

    const id = randomUUID();
    const startedAt = new Date().toISOString();
    const startingPhase = getStartingPhase(config);

  const dashboardState: DashboardState = {
      active: {
        id,
        startedAt,
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
      recoveryContext: undefined,
    };

    await persistDashboardState(projectPath, dashboardState);

    // Sync initial phase to state file for UI consistency
    syncPhaseToStateFile(projectPath, startingPhase);

    const execution = this.convertDashboardStateToExecution(projectPath, dashboardState);
    if (!execution) {
      throw new Error('Failed to initialize orchestration state');
    }

    return execution;
  }

  /**
   * Update batches after design phase completes
   * Called by runner when transitioning from design/analyze to implement
   */
  async updateBatches(
    projectPath: string,
    orchestrationId: string,
    batchPlan: BatchPlan
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    if (dashboardState.batches.total !== 0) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    const batches = createBatchTracking(batchPlan);
    const nextState: DashboardState = {
      ...dashboardState,
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
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'update_batches',
          reason: 'Batches populated after design phase',
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Get orchestration by ID from CLI dashboard state
   */
  get(projectPath: string, id: string): OrchestrationExecution | null {
    const dashboardState = getActiveDashboardState(projectPath, id);
    if (!dashboardState) return null;
    return this.convertDashboardStateToExecution(projectPath, dashboardState);
  }

  /**
   * Get active orchestration for a project from CLI dashboard state
   */
  getActive(projectPath: string): OrchestrationExecution | null {
    const dashboardState = readDashboardState(projectPath);
    if (!dashboardState?.active) return null;
    ensureStepMatchesStatus(projectPath, dashboardState.active.status);
    return this.convertDashboardStateToExecution(projectPath, dashboardState);
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
      'merge': 'merge',
      'complete': 'complete',
    };
    let currentPhase: OrchestrationPhase = step?.current && phaseMap[step.current]
      ? phaseMap[step.current]
      : 'design';

    if (dashboardState.active.status === 'waiting_merge') {
      currentPhase = 'merge';
    } else if (!step?.current && dashboardState.lastWorkflow?.skill) {
      const skillPhase = dashboardState.lastWorkflow.skill.replace(/^\/?flow\./, '');
      if (phaseMap[skillPhase]) {
        currentPhase = phaseMap[skillPhase];
      }
    }

    const executions: OrchestrationExecution['executions'] = {
      implement: [],
      healers: [],
    };

    const batchWorkflowIds = (dashboardState.batches?.items || [])
      .map((b) => b.workflowId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (batchWorkflowIds.length > 0) {
      executions.implement = Array.from(new Set(batchWorkflowIds));
    }

    const lastWorkflowId = dashboardState.lastWorkflow?.id;
    if (lastWorkflowId) {
      switch (currentPhase) {
        case 'design':
          executions.design = lastWorkflowId;
          break;
        case 'analyze':
          executions.analyze = lastWorkflowId;
          break;
        case 'implement':
          if (!executions.implement.includes(lastWorkflowId)) {
            executions.implement = [lastWorkflowId, ...executions.implement];
          }
          break;
        case 'verify':
          executions.verify = lastWorkflowId;
          break;
        case 'merge':
          executions.merge = lastWorkflowId;
          break;
      }
    }

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
      executions,
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
    const active = this.getActive(projectPath);
    return active ? [active] : [];
  }

  /**
   * Update orchestration with workflow execution ID
   */
  async linkWorkflowExecution(
    projectPath: string,
    orchestrationId: string,
    workflowExecutionId: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const cliState = readCliState(projectPath);
    const phase = cliState?.orchestration?.step?.current || 'design';

    let batches = dashboardState.batches;
    if (phase === 'implement' && batches.items.length > 0) {
      const items = [...batches.items];
      const currentIndex = batches.current;
      const currentBatch = items[currentIndex];
      if (currentBatch) {
        items[currentIndex] = {
          ...currentBatch,
          workflowId: workflowExecutionId,
          status: 'running',
        };
      }
      batches = {
        ...batches,
        items,
      };
    }

    const nextState: DashboardState = {
      ...dashboardState,
      batches,
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'link_execution',
          reason: `Linked workflow execution for ${phase}`,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Transition to next phase (FR-020, FR-022)
   * Called after dual confirmation (state + process completion)
   */
  async transitionToNextPhase(
    projectPath: string,
    orchestrationId: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    const cliState = readCliState(projectPath);
    const currentPhase = (cliState?.orchestration?.step?.current ||
      getStartingPhase(dashboardState.active.config)) as OrchestrationPhase;
    const nextPhase = getNextPhase(currentPhase, dashboardState.active.config);

    if (!nextPhase) {
      const nextState: DashboardState = {
        ...dashboardState,
        active: {
          ...dashboardState.active,
          status: 'completed',
        },
        decisionLog: [
          ...(dashboardState.decisionLog || []),
          {
            timestamp: new Date().toISOString(),
            action: 'complete',
            reason: 'All phases finished',
          },
        ],
      };

      await persistDashboardState(projectPath, nextState);
      syncPhaseToStateFile(projectPath, currentPhase, 'complete');
      return this.convertDashboardStateToExecution(projectPath, nextState);
    }

    if (nextPhase === 'merge' && !dashboardState.active.config.autoMerge) {
      const nextState: DashboardState = {
        ...dashboardState,
        active: {
          ...dashboardState.active,
          status: 'waiting_merge',
        },
        decisionLog: [
          ...(dashboardState.decisionLog || []),
          {
            timestamp: new Date().toISOString(),
            action: 'waiting_merge',
            reason: 'Auto-merge disabled, waiting for user',
          },
        ],
      };
      await persistDashboardState(projectPath, nextState);
      syncPhaseToStateFile(projectPath, nextPhase, 'not_started');
      return this.convertDashboardStateToExecution(projectPath, nextState);
    }

    const nextState: DashboardState = {
      ...dashboardState,
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'transition',
          reason: `Moving from ${currentPhase} to ${nextPhase}`,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    syncPhaseToStateFile(projectPath, nextPhase);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Mark current batch as complete and move to next
   */
  async completeBatch(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const batches = dashboardState.batches;
    const currentBatch = batches.items[batches.current];
    if (!currentBatch) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    const items = [...batches.items];
    items[batches.current] = {
      ...currentBatch,
      status: 'completed',
    };

    const decisionLog = [...(dashboardState.decisionLog || [])];
    decisionLog.push({
      timestamp: new Date().toISOString(),
      action: 'batch_complete',
      reason: `Batch ${batches.current + 1} completed`,
    });

    let nextCurrent = batches.current;
    if (batches.current < batches.total - 1) {
      nextCurrent = batches.current + 1;
      const nextBatch = items[nextCurrent];
      decisionLog.push({
        timestamp: new Date().toISOString(),
        action: 'next_batch',
        reason: `Starting batch ${nextCurrent + 1}`,
      });
    } else {
      decisionLog.push({
        timestamp: new Date().toISOString(),
        action: 'all_batches_complete',
        reason: 'All implement batches finished',
      });
    }

    const nextState: DashboardState = {
      ...dashboardState,
      batches: {
        ...batches,
        current: nextCurrent,
        items,
      },
      decisionLog,
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Mark current batch as failed
   */
  async failBatch(
    projectPath: string,
    orchestrationId: string,
    errorMessage: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const batches = dashboardState.batches;
    const currentBatch = batches.items[batches.current];
    if (!currentBatch) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    const items = [...batches.items];
    items[batches.current] = {
      ...currentBatch,
      status: 'failed',
    };

    const nextState: DashboardState = {
      ...dashboardState,
      batches: {
        ...batches,
        items,
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'batch_failed',
          reason: `Batch ${batches.current + 1} failed`,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Mark batch as healed after successful auto-heal
   */
  async healBatch(
    projectPath: string,
    orchestrationId: string,
    healerExecutionId: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const batches = dashboardState.batches;
    const currentBatch = batches.items[batches.current];
    if (!currentBatch) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    const items = [...batches.items];
    items[batches.current] = {
      ...currentBatch,
      status: 'healed',
    };

    const nextState: DashboardState = {
      ...dashboardState,
      batches: {
        ...batches,
        items,
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'batch_healed',
          reason: `Batch ${batches.current + 1} healed`,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Increment heal attempt count for current batch
   */
  async incrementHealAttempt(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const batches = dashboardState.batches;
    const currentBatch = batches.items[batches.current];
    if (!currentBatch) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    const items = [...batches.items];
    items[batches.current] = {
      ...currentBatch,
      healAttempts: (currentBatch.healAttempts || 0) + 1,
    };

    const nextState: DashboardState = {
      ...dashboardState,
      batches: {
        ...batches,
        items,
      },
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Check if batch can be healed (FR-043)
   */
  canHealBatch(projectPath: string, orchestrationId: string): boolean {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return false;

    if (!dashboardState.active.config.autoHealEnabled) return false;

    const currentBatch = dashboardState.batches.items[dashboardState.batches.current];
    if (!currentBatch) return false;

    return (currentBatch.healAttempts || 0) < dashboardState.active.config.maxHealAttempts;
  }

  /**
   * Pause orchestration and stop the current workflow process
   * Note: Claude doesn't support true pause - we kill the process and resume from current state
   */
  async pause(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active || dashboardState.active.status !== 'running') return null;

    // Kill the current workflow process
    const currentWorkflowId = this.getCurrentWorkflowId(projectPath, dashboardState);
    const decisionLog = [...(dashboardState.decisionLog || [])];
    if (currentWorkflowId) {
      const workflowDir = join(projectPath, '.specflow', 'workflows', currentWorkflowId);
      const pids = readPidFile(workflowDir);
      if (pids) {
        if (pids.claudePid && isPidAlive(pids.claudePid)) {
          killProcess(pids.claudePid, false);
          decisionLog.push({
            timestamp: new Date().toISOString(),
            action: 'process_killed',
            reason: `Paused: killed Claude process ${pids.claudePid}`,
          });
        }
        if (pids.bashPid && isPidAlive(pids.bashPid)) {
          killProcess(pids.bashPid, false);
          decisionLog.push({
            timestamp: new Date().toISOString(),
            action: 'process_killed',
            reason: `Paused: killed bash process ${pids.bashPid}`,
          });
        }
        cleanupPidFile(workflowDir);
      }
    }

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'paused',
      },
      decisionLog: [
        ...decisionLog,
        {
          timestamp: new Date().toISOString(),
          action: 'pause',
          reason: 'User requested pause',
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Resume paused orchestration
   */
  async resume(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active || dashboardState.active.status !== 'paused') return null;

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'running',
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'resume',
          reason: 'User requested resume',
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
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

    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    const shouldResetBatches = ['design', 'analyze', 'implement'].includes(targetStep);
    const resetBatches: DashboardState['batches'] = shouldResetBatches
      ? { total: 0, current: 0, items: [] }
      : dashboardState.batches;
    const resetCost: DashboardState['cost'] = shouldResetBatches
      ? { total: 0, perBatch: [] }
      : dashboardState.cost;

    // Pause the orchestration if running
    if (dashboardState.active.status === 'running') {
      // Kill any active workflow
      const currentWorkflowId = this.getCurrentWorkflowId(projectPath, dashboardState);
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
          env: getSpecflowEnv(),
        }
      );

      // Update dashboard state
      await writeDashboardState(projectPath, {
        lastWorkflow: null, // Clear last workflow when going back
        batches: resetBatches,
        cost: resetCost,
      });

      const nextState: DashboardState = {
        ...dashboardState,
        active: {
          ...dashboardState.active,
          status: 'running',
        },
        batches: resetBatches,
        cost: resetCost,
        lastWorkflow: null,
        decisionLog: [
          ...(dashboardState.decisionLog || []),
          {
            timestamp: new Date().toISOString(),
            action: 'go_back_to_step',
            reason: shouldResetBatches
              ? `User navigated back to ${targetStep} step (reset batches)`
              : `User navigated back to ${targetStep} step`,
          },
        ],
      };

      await persistDashboardState(projectPath, nextState);

      console.log(`[orchestration-service] Went back to step: ${targetStep}`);
      return this.convertDashboardStateToExecution(projectPath, nextState);
    } catch (error) {
      console.error(`[orchestration-service] Failed to go back to step: ${error}`);
      return null;
    }
  }

  /**
   * Trigger merge (for waiting_merge status)
   */
  async triggerMerge(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active || dashboardState.active.status !== 'waiting_merge') return null;

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'running',
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'merge_triggered',
          reason: 'User triggered merge',
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    syncPhaseToStateFile(projectPath, 'merge', 'in_progress');
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Cancel orchestration and kill any running workflow process
   */
  async cancel(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    if (!['running', 'paused', 'waiting_merge', 'needs_attention'].includes(dashboardState.active.status)) {
      return this.convertDashboardStateToExecution(projectPath, dashboardState);
    }

    // Kill the current workflow process if one is running
    const currentWorkflowId = this.getCurrentWorkflowId(projectPath, dashboardState);
    const decisionLog = [...(dashboardState.decisionLog || [])];
    if (currentWorkflowId) {
      const workflowDir = join(projectPath, '.specflow', 'workflows', currentWorkflowId);
      const pids = readPidFile(workflowDir);
      if (pids) {
        if (pids.claudePid && isPidAlive(pids.claudePid)) {
          killProcess(pids.claudePid, false);
          decisionLog.push({
            timestamp: new Date().toISOString(),
            action: 'process_killed',
            reason: `Killed Claude process ${pids.claudePid}`,
          });
        }
        if (pids.bashPid && isPidAlive(pids.bashPid)) {
          killProcess(pids.bashPid, false);
          decisionLog.push({
            timestamp: new Date().toISOString(),
            action: 'process_killed',
            reason: `Killed bash process ${pids.bashPid}`,
          });
        }
        cleanupPidFile(workflowDir);
      }
    }

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'cancelled',
      },
      decisionLog: [
        ...decisionLog,
        {
          timestamp: new Date().toISOString(),
          action: 'cancel',
          reason: 'User cancelled orchestration',
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Get the current workflow execution ID from orchestration state
   */
  private getCurrentWorkflowId(
    projectPath: string,
    dashboardState: DashboardState
  ): string | undefined {
    const cliState = readCliState(projectPath);
    const currentStep = cliState?.orchestration?.step?.current;

    if (currentStep === 'implement') {
      const batch = dashboardState.batches.items[dashboardState.batches.current];
      return batch?.workflowId || dashboardState.lastWorkflow?.id;
    }

    return dashboardState.lastWorkflow?.id;
  }

  /**
   * Mark orchestration as failed
   */
  async fail(
    projectPath: string,
    orchestrationId: string,
    errorMessage: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'failed',
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'fail',
          reason: errorMessage,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Set orchestration to needs_attention status (recoverable error)
   * Allows user to decide: retry, skip, or abort
   */
  async setNeedsAttention(
    projectPath: string,
    orchestrationId: string,
    issue: string,
    options: Array<'retry' | 'skip' | 'abort'>,
    failedWorkflowId?: string
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status: 'needs_attention',
      },
      recoveryContext: {
        issue,
        options,
        failedWorkflowId,
      },
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: 'needs_attention',
          reason: issue,
        },
      ],
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Handle recovery action from user (retry, skip, abort)
   */
  async handleRecovery(
    projectPath: string,
    orchestrationId: string,
    action: 'retry' | 'skip' | 'abort'
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;
    if (dashboardState.active.status !== 'needs_attention') return null;

    const decisionLog = [...(dashboardState.decisionLog || [])];
    let status = dashboardState.active.status;

    if (action === 'retry') {
      status = 'running';
      decisionLog.push({
        timestamp: new Date().toISOString(),
        action: 'recovery_retry',
        reason: 'User chose to retry',
      });
    }

    if (action === 'skip') {
      status = 'running';
      decisionLog.push({
        timestamp: new Date().toISOString(),
        action: 'recovery_skip',
        reason: 'User chose to skip current phase',
      });

      const cliState = readCliState(projectPath);
      const currentPhase = (cliState?.orchestration?.step?.current ||
        getStartingPhase(dashboardState.active.config)) as OrchestrationPhase;
      const nextPhase = getNextPhase(currentPhase, dashboardState.active.config);
      if (nextPhase) {
        decisionLog.push({
          timestamp: new Date().toISOString(),
          action: 'transition',
          reason: `Skipped to ${nextPhase}`,
        });
        syncPhaseToStateFile(projectPath, nextPhase);
      }
    }

    if (action === 'abort') {
      status = 'cancelled';
      decisionLog.push({
        timestamp: new Date().toISOString(),
        action: 'recovery_abort',
        reason: 'User chose to abort',
      });
    }

    const nextState: DashboardState = {
      ...dashboardState,
      active: {
        ...dashboardState.active,
        status,
      },
      recoveryContext: undefined,
      decisionLog,
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Update total cost
   */
  async addCost(
    projectPath: string,
    orchestrationId: string,
    costUsd: number
  ): Promise<OrchestrationExecution | null> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const nextState: DashboardState = {
      ...dashboardState,
      cost: {
        ...dashboardState.cost,
        total: (dashboardState.cost?.total || 0) + costUsd,
      },
    };

    await persistDashboardState(projectPath, nextState);
    return this.convertDashboardStateToExecution(projectPath, nextState);
  }

  /**
   * Check if budget exceeded (FR-053)
   */
  isBudgetExceeded(projectPath: string, orchestrationId: string): boolean {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return false;

    const budget = dashboardState.active.config.budget;
    const total = dashboardState.cost?.total || 0;
    return total >= budget.maxTotal;
  }

  /**
   * Touch activity timestamp for external session detection (G6.6)
   * Called when external CLI session activity is detected
   */
  touchActivity(projectPath: string, orchestrationId: string): void {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return;
    // No-op: CLI state is the source of truth and does not track updatedAt.
  }

  /**
   * Get the skill to run for the current phase
   */
  getCurrentSkill(projectPath: string, orchestrationId: string): string | null {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return null;

    const cliState = readCliState(projectPath);
    const phase = (cliState?.orchestration?.step?.current ||
      getStartingPhase(dashboardState.active.config)) as OrchestrationPhase;

    return getPhaseSkill(phase);
  }

  /**
   * Check if current step is complete using specflow status
   */
  isCurrentStepComplete(projectPath: string, orchestrationId: string): boolean {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState?.active) return false;

    const cliState = readCliState(projectPath);
    const phase = (cliState?.orchestration?.step?.current ||
      getStartingPhase(dashboardState.active.config)) as OrchestrationPhase;

    return isStepComplete(projectPath, phase);
  }

  /**
   * Check if all batches are complete
   */
  areAllBatchesComplete(projectPath: string, orchestrationId: string): boolean {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return false;

    return dashboardState.batches.items.every(
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
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return null;

    const batch = dashboardState.batches.items[dashboardState.batches.current];
    if (!batch) return null;

    return {
      index: dashboardState.batches.current,
      total: dashboardState.batches.total,
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
    _data?: Record<string, unknown>
  ): Promise<void> {
    const dashboardState = getActiveDashboardState(projectPath, orchestrationId);
    if (!dashboardState) return Promise.resolve();

    const nextState: DashboardState = {
      ...dashboardState,
      decisionLog: [
        ...(dashboardState.decisionLog || []),
        {
          timestamp: new Date().toISOString(),
          action: decision,
          reason,
        },
      ],
    };

    return persistDashboardState(projectPath, nextState);
  }
}

// Export singleton
export const orchestrationService = new OrchestrationService();
