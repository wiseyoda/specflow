/**
 * Orchestration Runner - State Machine Execution Loop
 *
 * This is the CRITICAL missing piece that drives orchestration forward.
 * It monitors workflow completion and automatically transitions through phases.
 *
 * Flow: design → analyze → implement (batches) → verify → merge
 *
 * Features:
 * - Background polling for workflow completion
 * - State machine decision logic
 * - Sequential batch execution
 * - Auto-healing on failure
 * - Budget enforcement
 * - Decision logging
 * - Claude fallback analyzer (after 3 unclear state checks)
 */

import { join } from 'path';
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync, type Dirent } from 'fs';
import { z } from 'zod';
import { orchestrationService, getNextPhase, isPhaseComplete, readDashboardState, writeDashboardState } from './orchestration-service';
import { workflowService, type WorkflowExecution } from './workflow-service';
import { attemptHeal, getHealingSummary } from './auto-healing-service';
import { quickDecision } from './claude-helper';
import { parseBatchesFromProject, verifyBatchTaskCompletion, getTotalIncompleteTasks } from './batch-parser';
import { isClaudeHelperError, type OrchestrationPhase, type SSEEvent, type DashboardState } from '@specflow/shared';
import type { OrchestrationExecution } from './orchestration-types';
// G2 Compliance: Import pure decision functions from orchestration-decisions module
import {
  getNextAction,
  type DecisionInput,
  type Decision,
  type WorkflowState,
  getSkillForStep,
  STALE_THRESHOLD_MS,
} from './orchestration-decisions';

// =============================================================================
// Types
// =============================================================================

interface RunnerContext {
  projectId: string;
  projectPath: string;
  orchestrationId: string;
  pollingInterval: number;
  maxPollingAttempts: number;
  consecutiveUnclearChecks: number;
}

/**
 * Dependency injection interface for testing (T120/G12.4)
 * Allows injecting mock services without vi.mock
 */
export interface OrchestrationDeps {
  orchestrationService: typeof orchestrationService;
  workflowService: typeof workflowService;
  getNextPhase: typeof getNextPhase;
  isPhaseComplete: typeof isPhaseComplete;
  attemptHeal?: typeof attemptHeal;
  quickDecision?: typeof quickDecision;
  parseBatchesFromProject?: typeof parseBatchesFromProject;
}

/**
 * Default dependencies using module imports
 */
const defaultDeps: OrchestrationDeps = {
  orchestrationService,
  workflowService,
  getNextPhase,
  isPhaseComplete,
  attemptHeal,
  quickDecision,
  parseBatchesFromProject,
};

// =============================================================================
// Spawn Intent Pattern (G5.3-G5.7)
// =============================================================================

/**
 * Get the path to the spawn intent file for an orchestration
 * Uses a separate file to avoid race conditions with state updates
 */
function getSpawnIntentPath(projectPath: string, orchestrationId: string): string {
  return join(projectPath, '.specflow', 'workflows', `spawn-intent-${orchestrationId}.json`);
}

/**
 * SpawnIntent structure - tracks what we're trying to spawn
 */
interface SpawnIntent {
  skill: string;
  orchestrationId: string;
  timestamp: string;
}

/**
 * Check if a spawn intent exists for this orchestration (G5.4)
 * If an intent exists, another process is already spawning a workflow
 */
function hasSpawnIntent(projectPath: string, orchestrationId: string): boolean {
  const intentPath = getSpawnIntentPath(projectPath, orchestrationId);
  if (!existsSync(intentPath)) {
    return false;
  }

  // Check if intent is stale (older than 30 seconds)
  try {
    const content = readFileSync(intentPath, 'utf-8');
    const intent = JSON.parse(content) as SpawnIntent;
    const intentTime = new Date(intent.timestamp).getTime();
    const now = Date.now();
    const staleThresholdMs = 30 * 1000; // 30 seconds

    if (now - intentTime > staleThresholdMs) {
      // Stale intent - clean it up
      console.log(`[orchestration-runner] Found stale spawn intent (${Math.round((now - intentTime) / 1000)}s old), clearing`);
      clearSpawnIntent(projectPath, orchestrationId);
      return false;
    }

    return true;
  } catch {
    // If we can't read it, assume it's stale and clean it up
    clearSpawnIntent(projectPath, orchestrationId);
    return false;
  }
}

/**
 * Write spawn intent BEFORE calling workflowService.start() (G5.6)
 * This prevents race conditions where two runners try to spawn simultaneously
 */
function writeSpawnIntent(projectPath: string, orchestrationId: string, skill: string): void {
  const intentPath = getSpawnIntentPath(projectPath, orchestrationId);
  const intent: SpawnIntent = {
    skill,
    orchestrationId,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(intentPath, JSON.stringify(intent, null, 2));
}

/**
 * Clear spawn intent in finally block (G5.7)
 * Called regardless of whether spawn succeeded or failed
 */
function clearSpawnIntent(projectPath: string, orchestrationId: string): void {
  const intentPath = getSpawnIntentPath(projectPath, orchestrationId);
  try {
    if (existsSync(intentPath)) {
      unlinkSync(intentPath);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Spawn a workflow with intent pattern to prevent race conditions (G5.3)
 *
 * This wraps the workflow spawn logic with:
 * 1. Check for existing spawn intent (G5.4)
 * 2. Check hasActiveWorkflow() (G5.5)
 * 3. Write spawn intent BEFORE calling start() (G5.6)
 * 4. Clear spawn intent in finally block (G5.7)
 */
async function spawnWorkflowWithIntent(
  ctx: RunnerContext,
  skill: string,
  context?: string
): Promise<WorkflowExecution | null> {
  const fullSkill = context ? `${skill} ${context}` : skill;

  // G5.4: Check for existing spawn intent
  if (hasSpawnIntent(ctx.projectPath, ctx.orchestrationId)) {
    console.log(`[orchestration-runner] Spawn intent already exists for orchestration ${ctx.orchestrationId}, skipping spawn`);
    return null;
  }

  // G5.5: Check if there's already an active workflow
  if (workflowService.hasActiveWorkflow(ctx.projectId, ctx.orchestrationId)) {
    console.log(`[orchestration-runner] Workflow already active for orchestration ${ctx.orchestrationId}, skipping spawn`);
    return null;
  }

  try {
    // G5.6: Write spawn intent BEFORE calling start()
    writeSpawnIntent(ctx.projectPath, ctx.orchestrationId, skill);

    // Actually spawn the workflow
    const workflow = await workflowService.start(
      ctx.projectId,
      fullSkill,
      undefined, // default timeout
      undefined, // no resume session
      ctx.orchestrationId // link to this orchestration
    );

    // Link workflow to orchestration for backwards compatibility
    orchestrationService.linkWorkflowExecution(ctx.projectPath, ctx.orchestrationId, workflow.id);

    // FR-003: Update dashboard lastWorkflow state for auto-heal tracking
    await writeDashboardState(ctx.projectPath, {
      lastWorkflow: {
        id: workflow.id,
        skill: skill,
        status: 'running',
      },
    });

    console.log(`[orchestration-runner] Spawned workflow ${workflow.id} for ${skill} (linked to orchestration ${ctx.orchestrationId})`);

    return workflow;
  } finally {
    // G5.7: Clear spawn intent regardless of success/failure
    clearSpawnIntent(ctx.projectPath, ctx.orchestrationId);
  }
}

// =============================================================================
// Persistent Runner State (G5.8-G5.10)
// =============================================================================

/**
 * Get the path to the runner state file for an orchestration
 * This file persists runner info across process restarts
 */
function getRunnerStatePath(projectPath: string, orchestrationId: string): string {
  return join(projectPath, '.specflow', 'workflows', `runner-${orchestrationId}.json`);
}

/**
 * RunnerState structure - tracks which process is running the orchestration
 */
interface RunnerState {
  orchestrationId: string;
  pid: number;
  startedAt: string;
}

/**
 * Persist runner state to file (G5.8)
 * Called when runner starts to track which process owns this orchestration
 */
function persistRunnerState(projectPath: string, orchestrationId: string): void {
  const statePath = getRunnerStatePath(projectPath, orchestrationId);
  const state: RunnerState = {
    orchestrationId,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(`[orchestration-runner] Persisted runner state for ${orchestrationId} (PID: ${process.pid})`);
  } catch (error) {
    console.error(`[orchestration-runner] Failed to persist runner state: ${error}`);
  }
}

/**
 * Clear runner state file (G5.9)
 * Called when runner exits (normally or due to error)
 */
function clearRunnerState(projectPath: string, orchestrationId: string): void {
  const statePath = getRunnerStatePath(projectPath, orchestrationId);
  try {
    if (existsSync(statePath)) {
      unlinkSync(statePath);
      console.log(`[orchestration-runner] Cleared runner state for ${orchestrationId}`);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

// =============================================================================
// Auto-Heal Logic (FR-003) - Trust Sub-Commands
// =============================================================================

/**
 * Map skill names to expected step names
 */
function getExpectedStepForSkill(skill: string): string {
  const map: Record<string, string> = {
    'flow.design': 'design',
    'flow.analyze': 'analyze',
    'flow.implement': 'implement',
    'flow.verify': 'verify',
    'flow.merge': 'merge',
    '/flow.design': 'design',
    '/flow.analyze': 'analyze',
    '/flow.implement': 'implement',
    '/flow.verify': 'verify',
    '/flow.merge': 'merge',
  };
  return map[skill] || 'unknown';
}

/**
 * Auto-heal state after workflow completes (FR-003)
 *
 * When a workflow ends, check if state matches expectations and fix if needed.
 * This allows sub-commands to update step.status, with dashboard as backup.
 *
 * Rules:
 * - Workflow completed: If step.status != complete, set it to complete
 * - Workflow failed: If step.status != failed, set it to failed
 *
 * Only use Claude helper for truly ambiguous cases:
 * 1. State file corrupted/unparseable
 * 2. Workflow ended but step.current doesn't match expected skill
 * 3. Multiple conflicting signals
 *
 * @param projectPath - Project path for CLI commands
 * @param completedSkill - The skill that just completed (e.g., 'flow.design')
 * @param workflowStatus - How the workflow ended
 * @returns true if healing was performed
 */
export async function autoHealAfterWorkflow(
  projectPath: string,
  completedSkill: string,
  workflowStatus: 'completed' | 'failed'
): Promise<boolean> {
  const expectedStep = getExpectedStepForSkill(completedSkill);

  // Read current state from CLI state file
  const dashboardState = readDashboardState(projectPath);

  // If no active orchestration, nothing to heal
  if (!dashboardState?.active) {
    console.log('[auto-heal] No active orchestration, skipping heal');
    return false;
  }

  // Read specflow status to get step info
  const specflowStatus = getSpecflowStatus(projectPath);
  const currentStep = specflowStatus?.orchestration?.step?.current;
  const stepStatus = specflowStatus?.orchestration?.step?.status;

  console.log(`[auto-heal] Workflow ${completedSkill} ${workflowStatus}`);
  console.log(`[auto-heal]   Expected step: ${expectedStep}`);
  console.log(`[auto-heal]   Current step: ${currentStep}, status: ${stepStatus}`);

  // Workflow completed successfully
  if (workflowStatus === 'completed') {
    // Check if step matches and status needs updating
    if (currentStep === expectedStep && stepStatus !== 'complete') {
      console.log(`[auto-heal] Setting ${expectedStep}.status = complete`);
      try {
        const { execSync } = await import('child_process');
        execSync(`specflow state set orchestration.step.status=complete`, {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
        });

        // Also update dashboard lastWorkflow status
        await writeDashboardState(projectPath, {
          lastWorkflow: {
            id: dashboardState.lastWorkflow?.id || 'unknown',
            skill: completedSkill,
            status: 'completed',
          },
        });

        console.log(`[auto-heal] Successfully healed step.status to complete`);
        return true;
      } catch (error) {
        console.error(`[auto-heal] Failed to heal state: ${error}`);
        return false;
      }
    }
  }

  // Workflow failed - mark step as failed if not already
  if (workflowStatus === 'failed' && stepStatus !== 'failed') {
    console.log(`[auto-heal] Setting ${expectedStep}.status = failed`);
    try {
      const { execSync } = await import('child_process');
      execSync(`specflow state set orchestration.step.status=failed`, {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 30000,
      });

      // Also update dashboard lastWorkflow status
      await writeDashboardState(projectPath, {
        lastWorkflow: {
          id: dashboardState.lastWorkflow?.id || 'unknown',
          skill: completedSkill,
          status: 'failed',
        },
      });

      console.log(`[auto-heal] Successfully healed step.status to failed`);
      return true;
    } catch (error) {
      console.error(`[auto-heal] Failed to heal state: ${error}`);
      return false;
    }
  }

  console.log('[auto-heal] No healing needed');
  return false;
}

/**
 * Check if a runner process is still alive by PID
 */
function isProcessAlive(pid: number): boolean {
  try {
    // Sending signal 0 doesn't actually send a signal, but checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reconcile runners on dashboard startup (G5.10)
 * Detects orphaned runner state files where the process is no longer running
 */
export function reconcileRunners(projectPath: string): void {
  const workflowsDir = join(projectPath, '.specflow', 'workflows');
  if (!existsSync(workflowsDir)) return;

  try {
    const files = readdirSync(workflowsDir);
    const runnerFiles = files.filter((f) => f.startsWith('runner-') && f.endsWith('.json'));

    for (const file of runnerFiles) {
      const filePath = join(workflowsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const state = JSON.parse(content) as RunnerState;

        if (!isProcessAlive(state.pid)) {
          // Process is dead but state file exists - orphaned runner
          console.log(`[orchestration-runner] Detected orphaned runner for ${state.orchestrationId} (PID ${state.pid} is dead), cleaning up`);
          unlinkSync(filePath);

          // Also clear from in-memory map if present
          activeRunners.delete(state.orchestrationId);
        } else {
          // Process is alive - mark as active in memory
          console.log(`[orchestration-runner] Runner for ${state.orchestrationId} is still active (PID ${state.pid})`);
          activeRunners.set(state.orchestrationId, true);
        }
      } catch {
        // Corrupted file, remove it
        console.log(`[orchestration-runner] Removing corrupted runner state file: ${file}`);
        try {
          unlinkSync(filePath);
        } catch {
          // Ignore
        }
      }
    }
  } catch (error) {
    console.error(`[orchestration-runner] Failed to reconcile runners: ${error}`);
  }
}

// =============================================================================
// Claude State Analyzer (Fallback)
// =============================================================================

/**
 * Schema for Claude state analysis decision
 * Used when state is unclear after 3 consecutive checks
 */
const StateAnalyzerDecisionSchema = z.object({
  action: z.enum(['run_design', 'run_analyze', 'run_implement', 'run_verify', 'run_merge', 'wait', 'stop', 'fail']),
  reason: z.string().describe('Explanation for this decision'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How confident are you in this decision?'),
  suggestedSkill: z.string().optional().describe('If action requires running a skill, which one?'),
});

type StateAnalyzerDecision = z.infer<typeof StateAnalyzerDecisionSchema>;

/**
 * Maximum consecutive "unclear" checks before spawning Claude analyzer
 */
const MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE = 3;

/**
 * Spawn Claude to analyze state and make a decision
 * Called when state is unclear after MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE consecutive waits
 */
async function analyzeStateWithClaude(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  workflow: WorkflowExecution | undefined,
  specflowStatus: SpecflowStatus | null
): Promise<DecisionResult> {
  console.log(`[orchestration-runner] State unclear after ${ctx.consecutiveUnclearChecks} checks, spawning Claude analyzer`);

  const prompt = `You are analyzing orchestration state to determine the next action.

## Current Orchestration State
- **Phase**: ${orchestration.currentPhase}
- **Status**: ${orchestration.status}
- **Batch Progress**: ${orchestration.batches.current + 1}/${orchestration.batches.total} batches
- **Current Batch Status**: ${orchestration.batches.items[orchestration.batches.current]?.status ?? 'N/A'}
- **Config**: autoMerge=${orchestration.config.autoMerge}, skipDesign=${orchestration.config.skipDesign}, skipAnalyze=${orchestration.config.skipAnalyze}

## Current Workflow
- **Workflow ID**: ${workflow?.id ?? 'None'}
- **Workflow Status**: ${workflow?.status ?? 'None'}
- **Workflow Skill**: ${workflow?.skill ?? 'None'}

## Specflow Status
\`\`\`json
${JSON.stringify(specflowStatus, null, 2)}
\`\`\`

## Decision History (last 5)
${orchestration.decisionLog.slice(-5).map((d) => `- ${d.decision}: ${d.reason}`).join('\n')}

## Problem
The orchestration has been in "continue/wait" state for ${ctx.consecutiveUnclearChecks} consecutive checks.
This may indicate a stuck state or unclear completion status.

## Your Task
Analyze the state and determine what should happen next:
- **run_design**: Run /flow.design
- **run_analyze**: Run /flow.analyze
- **run_implement**: Run /flow.implement
- **run_verify**: Run /flow.verify
- **run_merge**: Run /flow.merge
- **wait**: Continue waiting (only if you're confident the workflow will complete)
- **stop**: Pause and notify user (ambiguous state needing human review)
- **fail**: Mark as failed (unrecoverable state)

Provide a clear reason for your decision.`;

  try {
    const response = await quickDecision(
      prompt,
      StateAnalyzerDecisionSchema,
      ctx.projectPath,
      {
        maxBudgetUsd: orchestration.config.budget.decisionBudget,
        maxTurns: 3, // Allow a few turns to read files if needed
        tools: ['Read', 'Grep', 'Glob'], // Read-only tools
      }
    );

    if (isClaudeHelperError(response)) {
      console.error(`[orchestration-runner] Claude analyzer failed: ${response.errorMessage}`);
      return {
        action: 'fail',
        reason: `Claude analyzer failed after ${ctx.consecutiveUnclearChecks} unclear checks: ${response.errorMessage}`,
        errorMessage: 'State analysis failed - manual intervention required',
      };
    }

    const decision = response.result;

    // Track cost
    if (response.cost > 0) {
      orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, response.cost);
    }

    // Log Claude decision
    console.log(`[orchestration-runner] Claude analyzer decision: ${decision.action} (${decision.confidence}) - ${decision.reason}`);

    // Map Claude decision to DecisionResult
    return mapClaudeDecision(decision);
  } catch (error) {
    console.error(`[orchestration-runner] Error in Claude analyzer: ${error}`);
    return {
      action: 'fail',
      reason: `Claude analyzer error after ${ctx.consecutiveUnclearChecks} unclear checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errorMessage: 'State analysis error - manual intervention required',
    };
  }
}

/**
 * Map Claude analyzer decision to runner DecisionResult
 */
function mapClaudeDecision(decision: StateAnalyzerDecision): DecisionResult {
  switch (decision.action) {
    case 'run_design':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.design',
      };
    case 'run_analyze':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.analyze',
      };
    case 'run_implement':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: decision.suggestedSkill || 'flow.implement',
      };
    case 'run_verify':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.verify',
      };
    case 'run_merge':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.merge',
      };
    case 'wait':
      return {
        action: 'continue',
        reason: `[Claude analyzer] ${decision.reason}`,
      };
    case 'stop':
      return {
        action: 'wait_merge', // Use wait_merge to pause - user must manually resume
        reason: `[Claude analyzer - PAUSED] ${decision.reason}`,
      };
    case 'fail':
      return {
        action: 'fail',
        reason: `[Claude analyzer] ${decision.reason}`,
        errorMessage: decision.reason,
      };
    default:
      return {
        action: 'continue',
        reason: `[Claude analyzer] Unknown action: ${decision.action}`,
      };
  }
}

interface DecisionResult {
  action:
    // Legacy actions (kept for compatibility)
    | 'continue'
    | 'spawn_workflow'
    | 'spawn_batch'
    | 'heal'
    | 'wait_merge'
    | 'needs_attention'
    | 'complete'
    | 'fail'
    // G2 Compliance: New actions from pure decision module
    | 'transition'
    | 'advance_batch'
    | 'initialize_batches'
    | 'force_step_complete'
    | 'pause'
    | 'recover_stale'
    | 'recover_failed'
    | 'wait_with_backoff'
    | 'wait_user_gate';
  reason: string;
  skill?: string;
  batchContext?: string;
  errorMessage?: string;
  /** Recovery options when action is 'needs_attention' */
  recoveryOptions?: Array<'retry' | 'skip' | 'abort'>;
  /** Failed workflow ID for recovery context */
  failedWorkflowId?: string;
  /** Next step for transition action */
  nextStep?: string;
  /** Batch index for batch actions */
  batchIndex?: number;
  /** Workflow ID for stale recovery */
  workflowId?: string;
  /** Backoff time for wait_with_backoff */
  backoffMs?: number;
}

// =============================================================================
// Registry Lookup
// =============================================================================

function getProjectPath(projectId: string): string | null {
  const homeDir = process.env.HOME || '';
  const registryPath = join(homeDir, '.specflow', 'registry.json');

  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content);
    const project = registry.projects?.[projectId];
    return project?.path || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Specflow Status Integration (Direct File Access - No Subprocess)
// =============================================================================

interface SpecflowStatus {
  phase?: {
    number?: number;
    name?: string;
    hasUserGate?: boolean;
    userGateStatus?: 'pending' | 'confirmed' | 'skipped';
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
      index?: number;
      status?: string;
    };
  };
}

/**
 * Task counts from parsing tasks.md directly
 */
interface TaskCounts {
  total: number;
  completed: number;
  blocked: number;
  deferred: number;
  percentage: number;
}

/**
 * Get task counts by parsing tasks.md directly (no subprocess)
 *
 * @param tasksPath - Path to tasks.md file
 * @returns Task counts or null if file doesn't exist
 */
function getTaskCounts(tasksPath: string): TaskCounts | null {
  if (!existsSync(tasksPath)) {
    return null;
  }

  try {
    const content = readFileSync(tasksPath, 'utf-8');
    const lines = content.split('\n');

    let total = 0;
    let completed = 0;
    let blocked = 0;
    let deferred = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match task lines: - [x] T###, - [ ] T###, etc.
      const taskMatch = trimmed.match(/^-\s*\[[xX ~\-bB]\]\s*T\d{3}/);
      if (!taskMatch) continue;

      total++;

      // Determine status from checkbox
      if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
        completed++;
      } else if (trimmed.startsWith('- [b]') || trimmed.startsWith('- [B]')) {
        blocked++;
      } else if (trimmed.startsWith('- [~]') || trimmed.startsWith('- [-]')) {
        deferred++;
      }
      // else it's '- [ ]' which is todo (not counted separately)
    }

    return {
      total,
      completed,
      blocked,
      deferred,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Check if design artifacts exist in a feature directory (no subprocess)
 *
 * @param featureDir - Path to the feature directory (specs/NNNN-name/)
 * @returns Object indicating which artifacts exist
 */
function checkArtifactExistence(featureDir: string): { hasSpec: boolean; hasPlan: boolean; hasTasks: boolean } {
  return {
    hasSpec: existsSync(join(featureDir, 'spec.md')),
    hasPlan: existsSync(join(featureDir, 'plan.md')),
    hasTasks: existsSync(join(featureDir, 'tasks.md')),
  };
}

/**
 * Find the active feature directory in a project
 * Looks for specs/NNNN-name/ directories and returns the highest numbered one
 *
 * @param projectPath - Root path of the project
 * @returns Feature directory path or null if none found
 */
function findActiveFeatureDir(projectPath: string): string | null {
  const specsDir = join(projectPath, 'specs');
  if (!existsSync(specsDir)) {
    return null;
  }

  try {
    const entries = readdirSync(specsDir, { withFileTypes: true }) as Dirent[];

    // Find directories matching NNNN-* pattern
    const featureDirs = entries
      .filter((e) => e.isDirectory() && /^\d{4}-/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();

    if (featureDirs.length === 0) {
      return null;
    }

    return join(specsDir, featureDirs[0]);
  } catch {
    return null;
  }
}

/**
 * Get specflow status by reading files directly (no subprocess)
 * Replaces the previous getSpecflowStatus that called `specflow status --json`
 *
 * @param projectPath - Root path of the project
 * @returns Status object compatible with previous interface
 */
function getSpecflowStatus(projectPath: string): SpecflowStatus | null {
  try {
    // Find active feature directory
    const featureDir = findActiveFeatureDir(projectPath);
    if (!featureDir) {
      return {
        context: {
          hasSpec: false,
          hasPlan: false,
          hasTasks: false,
        },
        progress: {
          tasksTotal: 0,
          tasksComplete: 0,
          percentage: 0,
        },
      };
    }

    // Check which artifacts exist
    const artifacts = checkArtifactExistence(featureDir);

    // Get task counts if tasks.md exists
    const tasksPath = join(featureDir, 'tasks.md');
    const taskCounts = artifacts.hasTasks ? getTaskCounts(tasksPath) : null;

    // Extract phase info from directory name (e.g., "1056-jsonl-watcher" -> 1056)
    const dirName = featureDir.split('/').pop() || '';
    const phaseMatch = dirName.match(/^(\d+)-(.+)/);

    // Read orchestration state from state file
    let orchestrationState: SpecflowStatus['orchestration'] = undefined;
    let phaseGateInfo: Pick<NonNullable<SpecflowStatus['phase']>, 'hasUserGate' | 'userGateStatus'> = {};
    try {
      // Try .specflow first (v3), then .specify (v2)
      let statePath = join(projectPath, '.specflow', 'orchestration-state.json');
      if (!existsSync(statePath)) {
        statePath = join(projectPath, '.specify', 'orchestration-state.json');
      }
      if (existsSync(statePath)) {
        const stateContent = readFileSync(statePath, 'utf-8');
        const state = JSON.parse(stateContent);
        if (state?.orchestration?.step) {
          orchestrationState = {
            step: {
              current: state.orchestration.step.current,
              index: state.orchestration.step.index,
              status: state.orchestration.step.status,
            },
          };
        }
        // Extract phase gate info from state file
        if (state?.orchestration?.phase) {
          phaseGateInfo = {
            hasUserGate: state.orchestration.phase.hasUserGate,
            userGateStatus: state.orchestration.phase.userGateStatus,
          };
        }
      }
    } catch {
      // Ignore errors reading state file
    }

    return {
      phase: phaseMatch ? {
        number: parseInt(phaseMatch[1], 10),
        name: phaseMatch[2].replace(/-/g, ' '),
        ...phaseGateInfo,
      } : phaseGateInfo.hasUserGate !== undefined ? phaseGateInfo : undefined,
      context: {
        hasSpec: artifacts.hasSpec,
        hasPlan: artifacts.hasPlan,
        hasTasks: artifacts.hasTasks,
        featureDir,
      },
      progress: taskCounts ? {
        tasksTotal: taskCounts.total,
        tasksComplete: taskCounts.completed,
        percentage: taskCounts.percentage,
      } : {
        tasksTotal: 0,
        tasksComplete: 0,
        percentage: 0,
      },
      orchestration: orchestrationState,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Staleness Detection
// =============================================================================

/**
 * Get the last file change time for the project
 * Used for staleness detection (G1.5)
 */
function getLastFileChangeTime(projectPath: string): number {
  try {
    // Check common directories for recent changes
    const dirsToCheck = [
      join(projectPath, 'src'),
      join(projectPath, 'specs'),
      join(projectPath, '.specflow'),
    ];

    let latestTime = 0;
    for (const dir of dirsToCheck) {
      if (existsSync(dir)) {
        const stat = require('fs').statSync(dir);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
        }
      }
    }
    return latestTime || Date.now();
  } catch {
    return Date.now();
  }
}

// =============================================================================
// State Machine Decision Logic
// =============================================================================

/**
 * Map orchestration phase to skill command
 */
function getSkillForPhase(phase: OrchestrationPhase): string {
  switch (phase) {
    case 'design':
      return 'flow.design';
    case 'analyze':
      return 'flow.analyze';
    case 'implement':
      return 'flow.implement';
    case 'verify':
      return 'flow.verify';
    case 'merge':
      return 'flow.merge';
    default:
      return 'flow.implement';
  }
}

// =============================================================================
// G2 Compliance: Adapter for Pure Decision Functions
// =============================================================================

/**
 * Convert runner context to DecisionInput for the pure makeDecision function
 * This adapter bridges the old runner patterns with the new pure decision module
 *
 * FR-001: Now also reads from CLI state dashboard section as single source of truth
 */
function createDecisionInput(
  orchestration: OrchestrationExecution,
  workflow: WorkflowExecution | undefined,
  specflowStatus: SpecflowStatus | null,
  lastFileChangeTime?: number,
  dashboardState?: DashboardState | null
): DecisionInput {
  // Convert workflow to WorkflowState (simplified interface)
  // FR-001: If dashboard state has lastWorkflow, prefer that
  let workflowState: WorkflowState | null = null;

  if (dashboardState?.lastWorkflow) {
    // Use dashboard state as source of truth for workflow tracking
    workflowState = {
      id: dashboardState.lastWorkflow.id,
      status: dashboardState.lastWorkflow.status as WorkflowState['status'],
      error: undefined,
      lastActivityAt: new Date().toISOString(),
    };
  } else if (workflow) {
    workflowState = {
      id: workflow.id,
      status: workflow.status as WorkflowState['status'],
      error: workflow.error,
      lastActivityAt: workflow.updatedAt,
    };
  }

  // Extract step info from specflow status and orchestration
  // IMPORTANT: The state file tracks the PROJECT's current step, which may differ from
  // the orchestration's currentPhase (e.g., when skipping to merge).
  // We only trust step.status if it's for the SAME step as the orchestration's currentPhase.
  const stateFileStep = specflowStatus?.orchestration?.step?.current;
  const rawStatus = specflowStatus?.orchestration?.step?.status;
  const validStatuses = ['not_started', 'pending', 'in_progress', 'complete', 'failed', 'blocked', 'skipped'] as const;

  // Only use the state file's status if it matches the orchestration's current phase
  // Otherwise, the step hasn't been started in this orchestration
  const stepStatus = (stateFileStep === orchestration.currentPhase && rawStatus && validStatuses.includes(rawStatus as typeof validStatuses[number]))
    ? (rawStatus as typeof validStatuses[number])
    : 'not_started';

  const stepCurrent = orchestration.currentPhase;
  const stepIndex = specflowStatus?.orchestration?.step?.index ?? 0;

  return {
    step: {
      current: stepCurrent,
      index: stepIndex,
      status: stepStatus,
    },
    phase: {
      hasUserGate: specflowStatus?.phase?.hasUserGate,
      userGateStatus: specflowStatus?.phase?.userGateStatus,
    },
    execution: orchestration,
    workflow: workflowState,
    lastFileChangeTime,
    lookupFailures: 0,
    currentTime: Date.now(),
    // FR-001: Include dashboard state for future decision logic enhancements
    dashboardState: dashboardState ?? undefined,
  };
}

/**
 * Convert new Decision type to legacy DecisionResult
 */
function adaptNewDecisionToLegacy(decision: Decision): DecisionResult {
  const actionMap: Record<Decision['action'], DecisionResult['action']> = {
    'idle': 'continue',
    'wait': 'continue',
    'spawn': 'spawn_workflow',
    'transition': 'transition',
    'heal': 'heal',
    'heal_batch': 'heal',
    'advance_batch': 'advance_batch',
    'wait_merge': 'pause',
    'error': 'fail',
    'needs_attention': 'needs_attention',
  };

  return {
    action: actionMap[decision.action] || 'continue',
    reason: decision.reason,
    skill: decision.skill ? `/${decision.skill}` : undefined,
    // Convert batch object to string for legacy compatibility
    batchContext: decision.batch ? decision.batch.section : undefined,
    batchIndex: decision.batchIndex,
  };
}

/**
 * Make a decision using the simplified getNextAction function (FR-002)
 *
 * FR-001: Uses dashboardState as single source of truth
 * FR-002: Always uses getNextAction (<100 lines)
 */
function makeDecisionWithAdapter(
  orchestration: OrchestrationExecution,
  workflow: WorkflowExecution | undefined,
  specflowStatus: SpecflowStatus | null,
  lastFileChangeTime?: number,
  dashboardState?: DashboardState | null
): DecisionResult {
  // Create input for decision function (FR-001: includes dashboard state)
  const input = createDecisionInput(orchestration, workflow, specflowStatus, lastFileChangeTime, dashboardState);

  // FR-002: Use simplified getNextAction
  const decision = getNextAction(input);
  console.log(`[orchestration-runner] DEBUG: getNextAction returned: ${decision.action} - ${decision.reason}`);
  return adaptNewDecisionToLegacy(decision);
}

// =============================================================================
// Event-Driven Orchestration (T025-T026, G5.11-G5.13)
// =============================================================================

/**
 * Pending event signals for each orchestration runner
 * G5.11: Changed from single callback to Set of callbacks to support multiple sleepers
 * When a relevant file change is detected, ALL registered callbacks are invoked
 */
const eventSignals = new Map<string, Set<() => void>>();

/**
 * Wake up all sleepers for an orchestration (G5.13)
 * Called when a relevant file change is detected
 */
function wakeUp(orchestrationId: string): void {
  const callbacks = eventSignals.get(orchestrationId);
  if (callbacks && callbacks.size > 0) {
    // Copy to avoid modification during iteration
    const callbacksCopy = [...callbacks];
    for (const callback of callbacksCopy) {
      try {
        callback();
      } catch (error) {
        console.error(`[orchestration-runner] Error in wake-up callback:`, error);
      }
    }
  }
}

/**
 * Subscribe to file events for event-driven orchestration
 *
 * T025: Subscribe to watcher events to wake up the runner when relevant files change
 * instead of relying purely on fixed-interval polling
 *
 * @param orchestrationId - ID of the orchestration runner
 * @param projectId - Project ID to filter events
 * @param onEvent - Callback when relevant event occurs (wakes up runner)
 * @returns Cleanup function to unsubscribe
 */
function subscribeToFileEvents(
  orchestrationId: string,
  projectId: string,
  onEvent: () => void
): () => void {
  // Import addListener from watcher
  const { addListener: addWatcherListener } = require('../watcher');

  // G5.11: Initialize Set if needed, then add callback
  if (!eventSignals.has(orchestrationId)) {
    eventSignals.set(orchestrationId, new Set());
  }
  eventSignals.get(orchestrationId)!.add(onEvent);

  // Subscribe to SSE events from watcher
  const cleanup = addWatcherListener((event: SSEEvent) => {
    // Only react to events for this project
    if ('projectId' in event && event.projectId !== projectId) {
      return;
    }

    // Wake up runner on relevant events
    switch (event.type) {
      case 'tasks':
        // Task file changed - might have new completions
        console.log(`[orchestration-runner] Tasks event for ${projectId}, waking runner`);
        wakeUp(orchestrationId);
        break;
      case 'workflow':
        // Workflow index changed - workflow might have completed
        console.log(`[orchestration-runner] Workflow event for ${projectId}, waking runner`);
        wakeUp(orchestrationId);
        break;
      case 'state':
        // Orchestration state changed - might need to react
        console.log(`[orchestration-runner] State event for ${projectId}, waking runner`);
        wakeUp(orchestrationId);
        break;
      // Ignore: registry, phases, heartbeat, session events
    }
  });

  return () => {
    // Remove this specific callback from the Set
    const callbacks = eventSignals.get(orchestrationId);
    if (callbacks) {
      callbacks.delete(onEvent);
      // Clean up empty Sets
      if (callbacks.size === 0) {
        eventSignals.delete(orchestrationId);
      }
    }
    cleanup();
  };
}

/**
 * Event-driven sleep with early wake-up on file events
 *
 * T026, G5.12: Replace fixed sleep with event-triggered wake-up
 * This allows the runner to react immediately to file changes
 * while still having a maximum wait time
 *
 * G5.12: Now adds callback to Set instead of replacing
 *
 * @param ms - Maximum time to wait (fallback if no events)
 * @param orchestrationId - ID to check for wake-up signal
 * @returns Promise that resolves when woken up or timeout reached
 */
function eventDrivenSleep(ms: number, orchestrationId: string): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);

    // G5.12: Create a wake-up callback that clears timeout and resolves
    const wakeUpCallback = () => {
      clearTimeout(timeout);
      resolve();
    };

    // G5.12: Initialize Set if needed, then add callback
    if (!eventSignals.has(orchestrationId)) {
      eventSignals.set(orchestrationId, new Set());
    }
    eventSignals.get(orchestrationId)!.add(wakeUpCallback);

    // When promise resolves (either by timeout or wake-up), remove our callback
    // This prevents memory leaks from accumulated callbacks
    const cleanup = () => {
      const callbacks = eventSignals.get(orchestrationId);
      if (callbacks) {
        callbacks.delete(wakeUpCallback);
      }
    };

    // Set up cleanup for both paths
    setTimeout(() => cleanup(), ms + 1); // Cleanup after max timeout
  });
}

// =============================================================================
// Orchestration Runner
// =============================================================================

/**
 * Active runners tracked by orchestration ID
 */
const activeRunners = new Map<string, boolean>();

/**
 * Run the orchestration state machine loop
 *
 * This function runs in the background and drives orchestration forward
 * until completion, failure, or cancellation.
 *
 * @param projectId - Project identifier
 * @param orchestrationId - Orchestration execution ID
 * @param pollingInterval - Interval between state checks (ms)
 * @param maxPollingAttempts - Maximum polling iterations before stopping
 * @param deps - Optional dependency injection for testing (T120/G12.4)
 */
export async function runOrchestration(
  projectId: string,
  orchestrationId: string,
  pollingInterval: number = 3000,
  maxPollingAttempts: number = 1000,
  deps: OrchestrationDeps = defaultDeps
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) {
    console.error(`[orchestration-runner] Project not found: ${projectId}`);
    return;
  }

  // Prevent duplicate runners
  if (activeRunners.get(orchestrationId)) {
    console.log(`[orchestration-runner] Runner already active for ${orchestrationId}`);
    return;
  }

  activeRunners.set(orchestrationId, true);

  // G5.8: Persist runner state to file for cross-process detection
  persistRunnerState(projectPath, orchestrationId);

  console.log(`[orchestration-runner] Starting event-driven runner for ${orchestrationId}`);

  const ctx: RunnerContext = {
    projectId,
    projectPath,
    orchestrationId,
    pollingInterval,
    maxPollingAttempts,
    consecutiveUnclearChecks: 0,
  };

  // T025: Subscribe to file events for event-driven wake-up
  let eventCleanup: (() => void) | null = null;
  try {
    eventCleanup = subscribeToFileEvents(orchestrationId, projectId, () => {
      // Wake-up callback is set by eventDrivenSleep
    });
    console.log(`[orchestration-runner] Subscribed to file events for ${projectId}`);
  } catch (error) {
    console.log(`[orchestration-runner] Event subscription not available, using polling fallback: ${error}`);
  }

  let attempts = 0;

  try {
    // T026: Event-driven loop - wake on file events OR timeout
    while (attempts < maxPollingAttempts) {
      attempts++;

      // Load current orchestration state
      const orchestration = orchestrationService.get(projectPath, orchestrationId);
      if (!orchestration) {
        console.error(`[orchestration-runner] Orchestration not found: ${orchestrationId}`);
        break;
      }

      // Check for terminal states
      if (['completed', 'failed', 'cancelled'].includes(orchestration.status)) {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} reached terminal state: ${orchestration.status}`);
        break;
      }

      // Check for paused/waiting states - use longer wait, still event-driven
      if (orchestration.status === 'needs_attention') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} needs attention, waiting for user action...`);
        await eventDrivenSleep(ctx.pollingInterval * 2, orchestrationId);
        continue;
      }

      if (orchestration.status === 'paused') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} is paused, waiting...`);
        await eventDrivenSleep(ctx.pollingInterval * 2, orchestrationId);
        continue;
      }

      if (orchestration.status === 'waiting_merge') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} waiting for merge trigger`);
        await eventDrivenSleep(ctx.pollingInterval * 2, orchestrationId);
        continue;
      }

      // Get the current workflow (if any)
      // First try the stored workflow ID, then fallback to querying by orchestrationId
      // This provides resilience if the stored ID is stale/wrong
      const currentWorkflowId = getCurrentWorkflowId(orchestration);
      let workflow = currentWorkflowId
        ? workflowService.get(currentWorkflowId, projectId)
        : undefined;

      // Fallback: if stored ID didn't find a workflow, check for any active workflows
      // linked to this orchestration (handles race conditions and cancelled workflows)
      if (!workflow || !['running', 'waiting_for_input'].includes(workflow.status)) {
        const activeWorkflows = workflowService.findActiveByOrchestration(projectId, orchestrationId);
        if (activeWorkflows.length > 0) {
          workflow = activeWorkflows[0];
          console.log(`[orchestration-runner] Found active workflow via orchestration link: ${workflow.id}`);
        }
      }

      // FR-003: Auto-heal when workflow transitions to completed/failed
      // Check if dashboard lastWorkflow was running but workflow is now complete/failed
      const previousWorkflowStatus = readDashboardState(projectPath)?.lastWorkflow?.status;
      const currentWorkflowStatus = workflow?.status;
      const lastWorkflowSkill = readDashboardState(projectPath)?.lastWorkflow?.skill;

      if (previousWorkflowStatus === 'running' &&
          currentWorkflowStatus &&
          ['completed', 'failed', 'cancelled'].includes(currentWorkflowStatus)) {
        console.log(`[orchestration-runner] Workflow status changed: ${previousWorkflowStatus} → ${currentWorkflowStatus}`);
        if (lastWorkflowSkill) {
          const healStatus = currentWorkflowStatus === 'completed' ? 'completed' : 'failed';
          await autoHealAfterWorkflow(projectPath, lastWorkflowSkill, healStatus);
        }
      }

      // Get specflow status (now direct file access, no subprocess - T021-T024)
      const specflowStatus = getSpecflowStatus(projectPath);

      // FR-001: Read dashboard state from CLI state file (single source of truth)
      const dashboardState = readDashboardState(projectPath);

      // Get last file change time for staleness detection
      const lastFileChangeTime = getLastFileChangeTime(projectPath);

      // DEBUG: Log state before decision
      console.log(`[orchestration-runner] DEBUG: Making decision for ${orchestrationId}`);
      console.log(`[orchestration-runner] DEBUG:   currentPhase=${orchestration.currentPhase}`);
      console.log(`[orchestration-runner] DEBUG:   workflow.id=${workflow?.id ?? 'none'}, workflow.status=${workflow?.status ?? 'none'}`);
      console.log(`[orchestration-runner] DEBUG:   specflowStatus.step=${specflowStatus?.orchestration?.step?.current ?? 'none'}, stepStatus=${specflowStatus?.orchestration?.step?.status ?? 'none'}`);
      console.log(`[orchestration-runner] DEBUG:   dashboardState.active=${dashboardState?.active?.id ?? 'none'}, lastWorkflow=${dashboardState?.lastWorkflow?.id ?? 'none'}`);

      // Make decision using the G2-compliant pure decision module
      // FR-001: Now includes dashboard state for single source of truth
      let decision = makeDecisionWithAdapter(orchestration, workflow, specflowStatus, lastFileChangeTime, dashboardState);

      // Track consecutive "continue" (unclear/waiting) decisions
      // Only count as "unclear" if NO workflow is actively running
      if (decision.action === 'continue') {
        // If workflow is actively running, this is a CLEAR state - we know what's happening
        // Don't count these as "unclear" checks that would trigger Claude analyzer
        if (workflow && ['running', 'waiting_for_input'].includes(workflow.status)) {
          ctx.consecutiveUnclearChecks = 0; // Reset - state is clear, just waiting
        } else {
          // No workflow running but we're not spawning one - this IS unclear
          ctx.consecutiveUnclearChecks++;
        }

        // FR-003: Only use Claude analyzer as LAST RESORT when dashboard state is not available
        // With single source of truth (dashboard state), unclear states should be rare
        // Claude analyzer should only be needed for truly ambiguous cases like:
        // - State file corrupted/unparseable
        // - Workflow ended but step doesn't match expected
        if (!dashboardState?.active && ctx.consecutiveUnclearChecks >= MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE) {
          console.log('[orchestration-runner] No dashboard state, falling back to Claude analyzer');
          decision = await analyzeStateWithClaude(ctx, orchestration, workflow, specflowStatus);
          ctx.consecutiveUnclearChecks = 0; // Reset counter after Claude analysis
        }
      } else {
        // Reset counter on any non-continue decision
        ctx.consecutiveUnclearChecks = 0;
      }

      // Log decision
      console.log(`[orchestration-runner] DEBUG:   DECISION: action=${decision.action}, skill=${decision.skill ?? 'none'}, reason=${decision.reason}`);
      logDecision(ctx, orchestration, decision);

      // Execute decision
      await executeDecision(ctx, orchestration, decision, workflow);

      // T026: Event-driven wait - wakes on file events OR timeout
      // This replaces fixed polling with reactive wake-up
      await eventDrivenSleep(ctx.pollingInterval, orchestrationId);
    }

    if (attempts >= maxPollingAttempts) {
      console.error(`[orchestration-runner] Max polling attempts reached for ${orchestrationId}`);
      orchestrationService.fail(projectPath, orchestrationId, 'Max polling attempts exceeded');
    }
  } catch (error) {
    console.error(`[orchestration-runner] Error in runner: ${error}`);
    orchestrationService.fail(
      projectPath,
      orchestrationId,
      error instanceof Error ? error.message : 'Unknown error in orchestration runner'
    );
  } finally {
    // Cleanup event subscription
    if (eventCleanup) {
      eventCleanup();
      console.log(`[orchestration-runner] Unsubscribed from file events for ${projectId}`);
    }

    // G5.9: Clear runner state file when exiting
    clearRunnerState(projectPath, orchestrationId);

    activeRunners.delete(orchestrationId);
    console.log(`[orchestration-runner] Runner stopped for ${orchestrationId}`);
  }
}

/**
 * Get the current workflow execution ID from orchestration state
 */
function getCurrentWorkflowId(orchestration: OrchestrationExecution): string | undefined {
  const { currentPhase, batches, executions } = orchestration;

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
 * Log a decision to the orchestration state
 */
function logDecision(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  decision: DecisionResult
): void {
  // Add to orchestration decision log
  orchestration.decisionLog.push({
    timestamp: new Date().toISOString(),
    decision: decision.action,
    reason: decision.reason,
    data: {
      currentPhase: orchestration.currentPhase,
      batchIndex: orchestration.batches.current,
      skill: decision.skill,
    },
  });

  // Console log for debugging
  console.log(
    `[orchestration-runner] Decision: ${decision.action} - ${decision.reason}`
  );
}

/**
 * Execute a decision
 */
async function executeDecision(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  decision: DecisionResult,
  currentWorkflow: WorkflowExecution | undefined
): Promise<void> {
  switch (decision.action) {
    case 'continue':
      // Nothing to do, just wait
      break;

    case 'spawn_workflow': {
      if (!decision.skill) {
        console.error('[orchestration-runner] No skill specified for spawn_workflow');
        return;
      }

      // Transition to next phase if needed
      const nextPhase = getNextPhaseFromSkill(decision.skill);

      // GUARD: Never transition OUT of implement phase while batches are incomplete
      // This prevents Claude analyzer or other decisions from prematurely jumping to verify/merge
      // NOTE: This guard is redundant with getNextAction (which checks areAllBatchesComplete)
      // but kept as defense-in-depth for the legacy decision path
      const completedBatchCount = orchestration.batches.items.filter(
        (b) => b.status === 'completed' || b.status === 'healed'
      ).length;
      const allBatchesComplete = orchestration.batches.items.length > 0 &&
        completedBatchCount === orchestration.batches.items.length;

      if (orchestration.currentPhase === 'implement' && nextPhase !== 'implement') {
        console.log(`[orchestration-runner] GUARD CHECK: implement→${nextPhase}, batches=${completedBatchCount}/${orchestration.batches.items.length}, allComplete=${allBatchesComplete}`);
        if (!allBatchesComplete) {
          console.log(`[orchestration-runner] BLOCKED: Cannot transition from implement to ${nextPhase} - batches incomplete`);
          return;
        }
      }

      if (nextPhase && nextPhase !== orchestration.currentPhase) {
        // Before transitioning to implement, ensure batches are populated
        // This handles the case when phase was opened during this orchestration
        if (nextPhase === 'implement' && orchestration.batches.total === 0) {
          const batchPlan = parseBatchesFromProject(ctx.projectPath, orchestration.config.batchSizeFallback);
          if (batchPlan && batchPlan.totalIncomplete > 0) {
            orchestrationService.updateBatches(ctx.projectPath, ctx.orchestrationId, batchPlan);
            console.log(`[orchestration-runner] Populated batches: ${batchPlan.batches.length} batches, ${batchPlan.totalIncomplete} tasks`);
          } else {
            console.error('[orchestration-runner] No tasks found after design phase');
            orchestrationService.fail(ctx.projectPath, ctx.orchestrationId, 'No tasks found after design phase completed');
            return;
          }
        }

        orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      }

      // Use spawn intent pattern (G5.3-G5.7) to prevent race conditions
      const workflow = await spawnWorkflowWithIntent(ctx, decision.skill);
      if (!workflow) {
        // Spawn was skipped (intent exists or workflow already active)
        return;
      }

      // Track cost from previous workflow
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }
      break;
    }

    case 'spawn_batch': {
      // DO NOT call completeBatch here - the batch hasn't been executed yet!
      // spawn_batch is triggered when batch.status === 'pending' && no workflow
      // We spawn a workflow for the CURRENT batch, not advance to next.

      // Track cost from previous workflow (if any - for healing scenarios)
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Get the current batch (which is pending)
      const currentBatch = orchestration.batches.items[orchestration.batches.current];
      if (!currentBatch || currentBatch.status !== 'pending') {
        console.error(`[orchestration-runner] spawn_batch called but current batch is not pending: ${currentBatch?.status}`);
        break;
      }

      // Check for pause between batches (only applies after first batch)
      if (orchestration.batches.current > 0 && orchestration.config.pauseBetweenBatches) {
        orchestrationService.pause(ctx.projectPath, ctx.orchestrationId);
        console.log(`[orchestration-runner] Paused between batches (configured)`);
        break;
      }

      // Build batch context for the CURRENT batch
      const batchContext = `Execute only the "${currentBatch.section}" section (${currentBatch.taskIds.join(', ')}). Do NOT work on tasks from other sections.`;
      const fullContext = orchestration.config.additionalContext
        ? `${batchContext}\n\n${orchestration.config.additionalContext}`
        : batchContext;

      // Use spawn intent pattern (G5.3-G5.7) to prevent race conditions
      const workflow = await spawnWorkflowWithIntent(ctx, 'flow.implement', fullContext);
      if (workflow) {
        console.log(`[orchestration-runner] Spawned batch ${orchestration.batches.current + 1}/${orchestration.batches.total}: "${currentBatch.section}" (linked to orchestration ${ctx.orchestrationId})`);
      }
      break;
    }

    case 'heal': {
      const batch = orchestration.batches.items[orchestration.batches.current];
      if (!batch) {
        console.error('[orchestration-runner] No current batch to heal');
        return;
      }

      // Increment heal attempt
      orchestrationService.incrementHealAttempt(ctx.projectPath, ctx.orchestrationId);

      // Attempt healing
      const healResult = await attemptHeal(
        ctx.projectPath,
        batch.workflowExecutionId || '',
        batch.section,
        batch.taskIds,
        currentWorkflow?.sessionId,
        orchestration.config.budget.healingBudget
      );

      // Track healing cost
      orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, healResult.cost);

      console.log(`[orchestration-runner] Heal result: ${getHealingSummary(healResult)}`);

      if (healResult.success && healResult.result?.status === 'fixed') {
        // Healing successful - mark batch as healed and continue
        orchestrationService.healBatch(
          ctx.projectPath,
          ctx.orchestrationId,
          healResult.sessionId || ''
        );
        orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);
      } else {
        // Healing failed
        const canRetry = orchestrationService.canHealBatch(ctx.projectPath, ctx.orchestrationId);
        if (!canRetry) {
          orchestrationService.fail(
            ctx.projectPath,
            ctx.orchestrationId,
            `Batch healing failed after max attempts: ${healResult.errorMessage || 'Unknown error'}`
          );
        }
      }
      break;
    }

    case 'wait_merge': {
      // Track cost from verify workflow
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Transition to merge phase but in waiting status
      orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      console.log(`[orchestration-runner] Waiting for user to trigger merge`);
      break;
    }

    case 'complete': {
      // Track final cost
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Mark complete
      const finalOrchestration = orchestrationService.get(ctx.projectPath, ctx.orchestrationId);
      if (finalOrchestration) {
        finalOrchestration.status = 'completed';
        finalOrchestration.completedAt = new Date().toISOString();
        finalOrchestration.decisionLog.push({
          timestamp: new Date().toISOString(),
          decision: 'complete',
          reason: 'All phases completed successfully',
        });
      }
      console.log(`[orchestration-runner] Orchestration complete!`);
      break;
    }

    case 'needs_attention': {
      // Set orchestration to needs_attention instead of failing
      // This allows the user to decide what to do (retry, skip, abort)
      orchestrationService.setNeedsAttention(
        ctx.projectPath,
        ctx.orchestrationId,
        decision.errorMessage || 'Unknown issue',
        decision.recoveryOptions || ['retry', 'abort'],
        decision.failedWorkflowId
      );
      console.log(`[orchestration-runner] Orchestration needs attention: ${decision.errorMessage}`);
      break;
    }

    case 'fail': {
      orchestrationService.fail(ctx.projectPath, ctx.orchestrationId, decision.errorMessage || 'Unknown error');
      console.error(`[orchestration-runner] Orchestration failed: ${decision.errorMessage}`);
      break;
    }

    // =========================================================================
    // G2 Compliance: New action types from pure decision module
    // =========================================================================

    case 'transition': {
      // Transition to next step (G2.3)
      if (!decision.skill) {
        console.error('[orchestration-runner] No skill specified for transition');
        return;
      }
      orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      const workflow = await spawnWorkflowWithIntent(ctx, decision.skill);
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }
      console.log(`[orchestration-runner] Transitioned to ${decision.nextStep}`);
      break;
    }

    case 'advance_batch': {
      // Move to next batch (G2.7, G2.8) - but first verify tasks were actually completed
      const currentBatch = orchestration.batches.items[orchestration.batches.current];
      if (currentBatch) {
        // Verify which tasks are actually complete in tasks.md
        const { completedTasks, incompleteTasks } = verifyBatchTaskCompletion(
          ctx.projectPath,
          currentBatch.taskIds
        );

        console.log(`[orchestration-runner] Batch ${orchestration.batches.current + 1} verification: ${completedTasks.length}/${currentBatch.taskIds.length} tasks complete`);

        if (incompleteTasks.length > 0) {
          // Tasks still incomplete - re-spawn the batch workflow to continue
          console.log(`[orchestration-runner] Batch has ${incompleteTasks.length} incomplete tasks, re-spawning workflow`);
          orchestrationService.logDecision(
            ctx.projectPath,
            ctx.orchestrationId,
            'batch_incomplete',
            `Batch ${orchestration.batches.current + 1} still has ${incompleteTasks.length} incomplete tasks: ${incompleteTasks.join(', ')}`
          );

          // Re-spawn the batch workflow to continue working on incomplete tasks
          const batchContext = `Continue working on incomplete tasks in batch "${currentBatch.section}": ${incompleteTasks.join(', ')}`;
          const workflow = await spawnWorkflowWithIntent(
            ctx,
            'flow.implement',
            orchestration.config.additionalContext
              ? `${batchContext}\n\n${orchestration.config.additionalContext}`
              : batchContext
          );

          if (workflow) {
            orchestrationService.linkWorkflowExecution(ctx.projectPath, ctx.orchestrationId, workflow.id);
          }

          // Don't advance - stay on current batch
          break;
        }
      }

      // All tasks in batch are complete - advance to next batch
      orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }
      console.log(`[orchestration-runner] Batch complete, advancing to batch ${decision.batchIndex}`);
      break;
    }

    case 'initialize_batches': {
      // Initialize batch tracking (G2.1)
      const batchPlan = parseBatchesFromProject(ctx.projectPath, orchestration.config.batchSizeFallback);
      if (batchPlan && batchPlan.totalIncomplete > 0) {
        orchestrationService.updateBatches(ctx.projectPath, ctx.orchestrationId, batchPlan);
        console.log(`[orchestration-runner] Initialized batches: ${batchPlan.batches.length} batches, ${batchPlan.totalIncomplete} tasks`);
      } else {
        console.error('[orchestration-runner] No tasks found to create batches');
        orchestrationService.setNeedsAttention(
          ctx.projectPath,
          ctx.orchestrationId,
          'No tasks found to create batches',
          ['retry', 'abort']
        );
      }
      break;
    }

    case 'force_step_complete': {
      // Force step.status to complete when all batches done (G2.2)
      // First verify all tasks are actually complete in tasks.md
      const totalIncomplete = getTotalIncompleteTasks(ctx.projectPath);

      if (totalIncomplete !== null && totalIncomplete > 0) {
        // Tasks still incomplete - don't transition, re-initialize batches
        console.log(`[orchestration-runner] Still ${totalIncomplete} incomplete tasks, re-initializing batches`);
        orchestrationService.logDecision(
          ctx.projectPath,
          ctx.orchestrationId,
          'tasks_incomplete',
          `Cannot mark implement complete: ${totalIncomplete} tasks still incomplete`
        );

        // Re-parse and update batches with remaining incomplete tasks
        const batchPlan = parseBatchesFromProject(ctx.projectPath, orchestration.config.batchSizeFallback);
        if (batchPlan && batchPlan.totalIncomplete > 0) {
          orchestrationService.updateBatches(ctx.projectPath, ctx.orchestrationId, batchPlan);
          console.log(`[orchestration-runner] Re-initialized batches: ${batchPlan.batches.length} batches, ${batchPlan.totalIncomplete} tasks`);
        }
        break;
      }

      // All tasks complete - transition to next phase
      orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      console.log(`[orchestration-runner] All tasks complete, transitioning to next phase`);
      break;
    }

    case 'pause': {
      // Pause orchestration (G2.6)
      orchestrationService.pause(ctx.projectPath, ctx.orchestrationId);
      console.log(`[orchestration-runner] Paused: ${decision.reason}`);
      break;
    }

    case 'recover_stale': {
      // Recover from stale workflow (G1.5, G3.7-G3.10)
      console.log(`[orchestration-runner] Workflow appears stale: ${decision.reason}`);
      orchestrationService.setNeedsAttention(
        ctx.projectPath,
        ctx.orchestrationId,
        `Workflow stale: ${decision.reason}`,
        ['retry', 'skip', 'abort'],
        decision.workflowId
      );
      break;
    }

    case 'recover_failed': {
      // Recover from failed step/workflow (G1.13, G1.14, G2.10, G3.11-G3.16)
      console.log(`[orchestration-runner] Step/batch failed: ${decision.reason}`);
      orchestrationService.setNeedsAttention(
        ctx.projectPath,
        ctx.orchestrationId,
        decision.errorMessage || decision.reason,
        decision.recoveryOptions || ['retry', 'skip', 'abort'],
        decision.failedWorkflowId
      );
      break;
    }

    case 'wait_with_backoff': {
      // Wait with exponential backoff (G1.7)
      console.log(`[orchestration-runner] Waiting with backoff: ${decision.reason}`);
      // The backoff is handled by the main loop, not here
      break;
    }

    case 'wait_user_gate': {
      // Wait for USER_GATE confirmation (G1.8)
      console.log(`[orchestration-runner] Waiting for USER_GATE confirmation`);
      // Update orchestration status to indicate waiting for user gate
      const orchToUpdate = orchestrationService.get(ctx.projectPath, ctx.orchestrationId);
      if (orchToUpdate) {
        orchToUpdate.status = 'waiting_user_gate' as OrchestrationExecution['status'];
      }
      break;
    }

    default: {
      // Unknown action - log error but don't crash
      console.error(`[orchestration-runner] Unknown decision action: ${decision.action}`);
      break;
    }
  }
}

/**
 * Get phase from skill name
 */
function getNextPhaseFromSkill(skill: string): OrchestrationPhase | null {
  const skillName = skill.split(' ')[0].replace('flow.', '');
  const phaseMap: Record<string, OrchestrationPhase> = {
    design: 'design',
    analyze: 'analyze',
    implement: 'implement',
    verify: 'verify',
    merge: 'merge',
  };
  return phaseMap[skillName] || null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Resume/Merge Trigger Helpers
// =============================================================================

/**
 * Resume orchestration from paused state
 * This restarts the runner loop
 */
export async function resumeOrchestration(
  projectId: string,
  orchestrationId: string
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) return;

  // Resume via orchestration service
  orchestrationService.resume(projectPath, orchestrationId);

  // Restart the runner
  runOrchestration(projectId, orchestrationId).catch(console.error);
}

/**
 * Trigger merge workflow
 * Called when user approves merge from waiting_merge state
 */
export async function triggerMerge(
  projectId: string,
  orchestrationId: string
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) return;

  // Use spawn intent pattern for race condition safety (G5.3-G5.7)
  // Check for existing spawn intent
  if (hasSpawnIntent(projectPath, orchestrationId)) {
    console.log(`[orchestration-runner] Spawn intent already exists for merge, skipping`);
    return;
  }

  // Check if there's already an active workflow
  if (workflowService.hasActiveWorkflow(projectId, orchestrationId)) {
    console.log(`[orchestration-runner] Workflow already active for merge, skipping`);
    return;
  }

  try {
    // Write spawn intent BEFORE calling start()
    writeSpawnIntent(projectPath, orchestrationId, 'flow.merge');

    // Update status via orchestration service
    orchestrationService.triggerMerge(projectPath, orchestrationId);

    // Spawn merge workflow
    const workflow = await workflowService.start(projectId, 'flow.merge', undefined, undefined, orchestrationId);
    orchestrationService.linkWorkflowExecution(projectPath, orchestrationId, workflow.id);

    // Restart the runner to handle merge completion
    runOrchestration(projectId, orchestrationId).catch(console.error);
  } finally {
    // Clear spawn intent regardless of success/failure
    clearSpawnIntent(projectPath, orchestrationId);
  }
}

/**
 * Check if a runner is active for an orchestration
 */
export function isRunnerActive(orchestrationId: string): boolean {
  return activeRunners.get(orchestrationId) === true;
}

/**
 * Stop a runner (for cleanup)
 */
export function stopRunner(orchestrationId: string): void {
  activeRunners.delete(orchestrationId);
}
