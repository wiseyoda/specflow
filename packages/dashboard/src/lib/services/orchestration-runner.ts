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
 * - Auto-heal on workflow completion
 * - Decision logging
 * - Decision logging
 */

import { join, basename } from 'path';
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import { orchestrationService, readDashboardState, writeDashboardState, readOrchestrationStep } from './orchestration-service';
import { workflowService, type WorkflowExecution } from './workflow-service';
import { attemptHeal, getHealingSummary } from './auto-healing-service';
import { parseBatchesFromProject } from './batch-parser';
import { type OrchestrationPhase, type SSEEvent, type StepStatus } from '@specflow/shared';
import type { OrchestrationExecution } from './orchestration-types';
import { getNextAction, type DecisionInput, type Decision, type WorkflowState } from './orchestration-decisions';
import { getSpecflowEnv } from '@/lib/specflow-env';

// =============================================================================
// Types
// =============================================================================

interface RunnerContext {
  projectId: string;
  projectPath: string;
  orchestrationId: string;
  pollingInterval: number;
  maxPollingAttempts: number;
  /** Short repo name for log readability (e.g., "arrs-mcp-server") */
  repoName: string;
}

/** Log prefix with repo name for readability */
function runnerLog(ctx: RunnerContext | { repoName: string }): string {
  return `[orchestration-runner][${ctx.repoName}]`;
}

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
    console.log(`${runnerLog(ctx)} Spawn intent already exists for orchestration ${ctx.orchestrationId}, skipping spawn`);
    return null;
  }

  // G5.5: Check if there's already an active workflow
  if (workflowService.hasActiveWorkflow(ctx.projectId, ctx.orchestrationId)) {
    console.log(`${runnerLog(ctx)} Workflow already active for orchestration ${ctx.orchestrationId}, skipping spawn`);
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
    await orchestrationService.linkWorkflowExecution(ctx.projectPath, ctx.orchestrationId, workflow.id);

    // FR-003: Update dashboard lastWorkflow state for auto-heal tracking
    await writeDashboardState(ctx.projectPath, {
      lastWorkflow: {
        id: workflow.id,
        skill: skill,
        status: 'running',
      },
    });

    console.log(`${runnerLog(ctx)} Spawned workflow ${workflow.id} for ${skill} (linked to orchestration ${ctx.orchestrationId})`);

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
 * If the workflow's expected step doesn't match the current step,
 * log and skip to avoid forcing state changes.
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

  // Read CLI state to get step info
  const stepState = readOrchestrationStep(projectPath);
  const currentStep = stepState?.current;
  const stepStatus = stepState?.status;

  console.log(`[auto-heal] Workflow ${completedSkill} ${workflowStatus}`);
  console.log(`[auto-heal]   Expected step: ${expectedStep}`);
  console.log(`[auto-heal]   Current step: ${currentStep}, status: ${stepStatus}`);

  // Workflow completed successfully
  if (workflowStatus === 'completed') {
    if (dashboardState.lastWorkflow) {
      await writeDashboardState(projectPath, {
        lastWorkflow: {
          id: dashboardState.lastWorkflow.id || 'unknown',
          skill: completedSkill,
          status: 'completed',
        },
      });
    }

    // Check if step matches and status needs updating
    if (currentStep === expectedStep && stepStatus !== 'complete') {
      console.log(`[auto-heal] Setting ${expectedStep}.status = complete`);
      try {
        const { execSync } = await import('child_process');
        execSync(`specflow state set orchestration.step.status=complete`, {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
          env: getSpecflowEnv(),
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
  if (workflowStatus === 'failed') {
    if (dashboardState.lastWorkflow) {
      await writeDashboardState(projectPath, {
        lastWorkflow: {
          id: dashboardState.lastWorkflow.id || 'unknown',
          skill: completedSkill,
          status: 'failed',
        },
      });
    }

    if (currentStep === expectedStep && stepStatus !== 'failed') {
      console.log(`[auto-heal] Setting ${expectedStep}.status = failed`);
      try {
        const { execSync } = await import('child_process');
        execSync(`specflow state set orchestration.step.status=failed`, {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
          env: getSpecflowEnv(),
        });

        console.log(`[auto-heal] Successfully healed step.status to failed`);
        return true;
      } catch (error) {
        console.error(`[auto-heal] Failed to heal state: ${error}`);
        return false;
      }
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
 * Detects orphaned runner state files where the process is no longer running.
 * Returns IDs of orchestrations that had runner state files cleaned up
 * (i.e., were previously managed by this dashboard instance).
 */
export function reconcileRunners(projectPath: string): Set<string> {
  const cleanedUpIds = new Set<string>();
  const workflowsDir = join(projectPath, '.specflow', 'workflows');
  if (!existsSync(workflowsDir)) return cleanedUpIds;

  try {
    const files = readdirSync(workflowsDir);
    const runnerFiles = files.filter((f) => f.startsWith('runner-') && f.endsWith('.json'));

    for (const file of runnerFiles) {
      const filePath = join(workflowsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const state = JSON.parse(content) as RunnerState;

        if (state.pid !== process.pid) {
          // PID doesn't match current server — runner is from a previous instance.
          // Don't use isProcessAlive() because PIDs can be reused by unrelated processes.
          console.log(`[orchestration-runner] Detected orphaned runner for ${state.orchestrationId} (PID ${state.pid} vs current ${process.pid}), cleaning up`);
          unlinkSync(filePath);
          cleanedUpIds.add(state.orchestrationId);

          // Also clear from in-memory map if present
          activeRunners.delete(state.orchestrationId);
        } else {
          // PID matches current process — runner is ours (shouldn't happen on fresh startup)
          console.log(`[orchestration-runner] Runner for ${state.orchestrationId} belongs to current process (PID ${state.pid})`);
          runnerGeneration++;
          activeRunners.set(state.orchestrationId, runnerGeneration);
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

  return cleanedUpIds;
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
    if (event.type === 'tasks' || event.type === 'workflow' || event.type === 'state') {
      wakeUp(orchestrationId);
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
// Decision Input Normalization
// =============================================================================

const VALID_PHASES: OrchestrationPhase[] = ['design', 'analyze', 'implement', 'verify', 'merge'];
const VALID_STEP_STATUSES: StepStatus[] = [
  'not_started',
  'pending',
  'in_progress',
  'complete',
  'failed',
  'blocked',
  'skipped',
];

function normalizeStepCurrent(
  current: unknown,
  fallback: OrchestrationPhase
): OrchestrationPhase {
  return VALID_PHASES.includes(current as OrchestrationPhase)
    ? (current as OrchestrationPhase)
    : fallback;
}

function normalizeStepStatus(status: unknown): StepStatus {
  return VALID_STEP_STATUSES.includes(status as StepStatus)
    ? (status as StepStatus)
    : 'not_started';
}

function toWorkflowState(workflow: WorkflowExecution | undefined): WorkflowState | null {
  if (!workflow) return null;
  const allowed = ['running', 'waiting_for_input', 'completed', 'failed', 'cancelled'] as const;
  return allowed.includes(workflow.status as typeof allowed[number])
    ? { id: workflow.id, status: workflow.status as WorkflowState['status'] }
    : null;
}

// =============================================================================
// Orchestration Runner
// =============================================================================

/**
 * Active runners tracked by orchestration ID
 */
const activeRunners = new Map<string, number>();
let runnerGeneration = 0;

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
 */
export async function runOrchestration(
  projectId: string,
  orchestrationId: string,
  pollingInterval: number = 5000,
  maxPollingAttempts: number = 500
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) {
    console.error(`[orchestration-runner] Project not found: ${projectId}`);
    return;
  }

  // Prevent duplicate runners (unless force-restarted via stopRunner + runOrchestration)
  if (activeRunners.has(orchestrationId)) {
    console.log(`[orchestration-runner] Runner already active for ${orchestrationId}`);
    return;
  }

  runnerGeneration++;
  const myGeneration = runnerGeneration;
  activeRunners.set(orchestrationId, myGeneration);

  // G5.8: Persist runner state to file for cross-process detection
  persistRunnerState(projectPath, orchestrationId);

  const repoName = basename(projectPath);

  console.log(`[orchestration-runner][${repoName}] Starting event-driven runner for ${orchestrationId}`);

  const ctx: RunnerContext = {
    projectId,
    projectPath,
    orchestrationId,
    pollingInterval,
    maxPollingAttempts,
    repoName,
  };

  // T025: Subscribe to file events for event-driven wake-up
  let eventCleanup: (() => void) | null = null;
  try {
    eventCleanup = subscribeToFileEvents(orchestrationId, projectId, () => {
      // Wake-up callback is set by eventDrivenSleep
    });
    console.log(`${runnerLog(ctx)} Subscribed to file events for ${projectId}`);
  } catch (error) {
    console.log(`${runnerLog(ctx)} Event subscription not available, using polling fallback: ${error}`);
  }

  let attempts = 0;
  let lastLoggedStatus: string | null = null;

  try {
    // T026: Event-driven loop - wake on file events OR timeout
    while (attempts < maxPollingAttempts) {
      attempts++;

      // Check if this runner has been superseded (force-restarted via Resume)
      if (activeRunners.get(orchestrationId) !== myGeneration) {
        console.log(`${runnerLog(ctx)} Runner ${orchestrationId} superseded by newer runner, exiting`);
        return; // Return early — don't run finally cleanup (new runner owns it now)
      }

      // Load current orchestration state
      const orchestration = orchestrationService.get(projectPath, orchestrationId);
      if (!orchestration) {
        console.error(`${runnerLog(ctx)} Orchestration not found: ${orchestrationId}`);
        break;
      }

      // Check for terminal states
      if (['completed', 'failed', 'cancelled'].includes(orchestration.status)) {
        console.log(`${runnerLog(ctx)} Orchestration ${orchestrationId} reached terminal state: ${orchestration.status}`);
        break;
      }

      // Check for paused/waiting states - use longer wait, still event-driven
      // Only log once per state to avoid repeating on every poll cycle
      if (['needs_attention', 'paused', 'waiting_merge'].includes(orchestration.status)) {
        if (lastLoggedStatus !== orchestration.status) {
          lastLoggedStatus = orchestration.status;
          console.log(`${runnerLog(ctx)} Status: ${orchestration.status}, waiting...`);
        }
        await eventDrivenSleep(ctx.pollingInterval * 2, orchestrationId);
        continue;
      }
      lastLoggedStatus = null;

      const dashboardState = readDashboardState(projectPath);

      if (!dashboardState?.active) {
        console.log(`${runnerLog(ctx)} No active dashboard state found, stopping runner`);
        break;
      }

      const initialStepState = readOrchestrationStep(projectPath);
      const stepCurrent = normalizeStepCurrent(initialStepState?.current, orchestration.currentPhase);

      const expectedSkill = `flow.${stepCurrent}`;
      const lastSkill = (dashboardState.lastWorkflow?.skill || '').replace(/^\//, '');
      const matchesStep = !lastSkill || lastSkill === expectedSkill;
      const workflowId = dashboardState.lastWorkflow?.id && matchesStep
        ? dashboardState.lastWorkflow.id
        : undefined;

      const workflow = workflowId ? workflowService.get(workflowId, projectId) : undefined;

      // Auto-heal when a running workflow completes or fails
      if (dashboardState.lastWorkflow?.status === 'running' &&
          workflow &&
          ['completed', 'failed', 'cancelled'].includes(workflow.status)) {
        console.log(`${runnerLog(ctx)} Workflow status changed: running → ${workflow.status}`);
        const healStatus = workflow.status === 'completed' ? 'completed' : 'failed';
        await autoHealAfterWorkflow(projectPath, dashboardState.lastWorkflow.skill, healStatus);
      }

      const refreshedStepState = readOrchestrationStep(projectPath);
      const decisionInput: DecisionInput = {
        active: Boolean(dashboardState.active),
        step: {
          current: normalizeStepCurrent(refreshedStepState?.current, stepCurrent),
          status: normalizeStepStatus(refreshedStepState?.status),
        },
        config: orchestration.config,
        batches: orchestration.batches,
        workflow: toWorkflowState(workflow),
      };

      const decision = getNextAction(decisionInput);

      if (decision.action === 'idle') {
        console.log(`${runnerLog(ctx)} No active orchestration, exiting runner loop`);
        break;
      }

      if (decision.action !== 'wait') {
        await orchestrationService.logDecision(
          ctx.projectPath,
          ctx.orchestrationId,
          decision.action,
          decision.reason
        );
      }

      await executeDecision(ctx, orchestration, decision, workflow);

      // T026: Event-driven wait - wakes on file events OR timeout
      // This replaces fixed polling with reactive wake-up
      await eventDrivenSleep(ctx.pollingInterval, orchestrationId);
    }

    if (attempts >= maxPollingAttempts) {
      console.error(`${runnerLog(ctx)} Max polling attempts reached for ${orchestrationId}`);
      await orchestrationService.fail(projectPath, orchestrationId, 'Max polling attempts exceeded');
    }
  } catch (error) {
    console.error(`${runnerLog(ctx)} Error in runner: ${error}`);
    await orchestrationService.fail(
      projectPath,
      orchestrationId,
      error instanceof Error ? error.message : 'Unknown error in orchestration runner'
    );
  } finally {
    // Cleanup event subscription
    if (eventCleanup) {
      eventCleanup();
      console.log(`${runnerLog(ctx)} Unsubscribed from file events for ${projectId}`);
    }

    // Only clean up runner state if this runner is still the active one.
    // If superseded by a newer runner (force-restart), the new runner owns cleanup.
    if (activeRunners.get(orchestrationId) === myGeneration) {
      clearRunnerState(projectPath, orchestrationId);
      activeRunners.delete(orchestrationId);
      console.log(`${runnerLog(ctx)} Runner stopped for ${orchestrationId}`);
    } else {
      console.log(`${runnerLog(ctx)} Superseded runner exiting for ${orchestrationId}`);
    }
  }
}

/**
 * Execute a decision
 */
async function executeDecision(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  decision: Decision,
  currentWorkflow: WorkflowExecution | undefined
): Promise<void> {
  switch (decision.action) {
    case 'idle':
    case 'wait':
      break;

    case 'spawn': {
      if (!decision.skill) {
        console.error(`${runnerLog(ctx)} No skill specified for spawn action`);
        return;
      }

      const workflow = await spawnWorkflowWithIntent(ctx, decision.skill, decision.context);
      if (!workflow) {
        return;
      }

      if (currentWorkflow?.costUsd) {
        await orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }
      break;
    }

    case 'transition': {
      await orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);

      if (currentWorkflow?.costUsd) {
        await orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      if (decision.skill) {
        await spawnWorkflowWithIntent(ctx, decision.skill, decision.context);
      } else {
        await writeDashboardState(ctx.projectPath, { lastWorkflow: null });
      }

      console.log(`${runnerLog(ctx)} Transitioned to ${decision.nextStep ?? 'next phase'}`);
      break;
    }

    case 'wait_merge': {
      if (currentWorkflow?.costUsd) {
        await orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      await orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      console.log(`${runnerLog(ctx)} Waiting for user to trigger merge`);
      break;
    }

    case 'initialize_batches': {
      const batchPlan = parseBatchesFromProject(ctx.projectPath, orchestration.config.batchSizeFallback);
      if (batchPlan && batchPlan.totalIncomplete > 0) {
        await orchestrationService.updateBatches(ctx.projectPath, ctx.orchestrationId, batchPlan);
        console.log(`${runnerLog(ctx)} Initialized batches: ${batchPlan.batches.length} batches, ${batchPlan.totalIncomplete} tasks`);
      } else {
        console.error(`${runnerLog(ctx)} No tasks found to create batches`);
        await orchestrationService.setNeedsAttention(
          ctx.projectPath,
          ctx.orchestrationId,
          'No tasks found to create batches',
          ['retry', 'abort']
        );
      }
      break;
    }

    case 'advance_batch': {
      await orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);

      if (currentWorkflow?.costUsd) {
        await orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      if (decision.pauseAfterAdvance) {
        await orchestrationService.pause(ctx.projectPath, ctx.orchestrationId);
        console.log(`${runnerLog(ctx)} Paused between batches`);
      } else {
        console.log(`${runnerLog(ctx)} Batch complete, advancing to next batch`);
      }
      break;
    }

    case 'heal_batch': {
      const batchIndex = decision.batchIndex ?? orchestration.batches.current;
      const batch = orchestration.batches.items[batchIndex];
      if (!batch) {
        console.error(`${runnerLog(ctx)} No batch found to heal`);
        return;
      }

      await orchestrationService.incrementHealAttempt(ctx.projectPath, ctx.orchestrationId);

      const healResult = await attemptHeal(
        ctx.projectPath,
        batch.workflowExecutionId || '',
        batch.section,
        batch.taskIds,
        currentWorkflow?.sessionId,
        orchestration.config.budget.healingBudget
      );

      await orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, healResult.cost);

      console.log(`${runnerLog(ctx)} Heal result: ${getHealingSummary(healResult)}`);

      if (healResult.success && healResult.result?.status === 'fixed') {
        await orchestrationService.healBatch(
          ctx.projectPath,
          ctx.orchestrationId,
          healResult.sessionId || ''
        );
        await orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);
      } else {
        const canRetry = orchestrationService.canHealBatch(ctx.projectPath, ctx.orchestrationId);
        if (!canRetry) {
          await orchestrationService.fail(
            ctx.projectPath,
            ctx.orchestrationId,
            `Batch healing failed after max attempts: ${healResult.errorMessage || 'Unknown error'}`
          );
        }
      }
      break;
    }

    case 'needs_attention': {
      await orchestrationService.setNeedsAttention(
        ctx.projectPath,
        ctx.orchestrationId,
        decision.reason,
        ['retry', 'skip', 'abort']
      );
      console.log(`${runnerLog(ctx)} Orchestration needs attention: ${decision.reason}`);
      break;
    }

    default:
      console.error(`${runnerLog(ctx)} Unknown decision action: ${decision.action}`);
      break;
  }
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
  await orchestrationService.resume(projectPath, orchestrationId);

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
    await orchestrationService.triggerMerge(projectPath, orchestrationId);

    // Spawn merge workflow
    const workflow = await workflowService.start(projectId, 'flow.merge', undefined, undefined, orchestrationId);
    await orchestrationService.linkWorkflowExecution(projectPath, orchestrationId, workflow.id);
    await writeDashboardState(projectPath, {
      lastWorkflow: {
        id: workflow.id,
        skill: 'flow.merge',
        status: 'running',
      },
    });

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
  return activeRunners.has(orchestrationId);
}

/**
 * Stop a runner (for cleanup)
 */
export function stopRunner(orchestrationId: string): void {
  activeRunners.delete(orchestrationId);
}
