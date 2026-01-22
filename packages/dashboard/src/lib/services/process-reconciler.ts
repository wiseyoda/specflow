/**
 * Process Reconciler - Startup cleanup and orphan detection
 *
 * On dashboard startup:
 * 1. Loads all workflows marked running/waiting_for_input
 * 2. Checks process health for each
 * 3. Updates status: dead → failed, stale → stale
 * 4. Finds orphaned claude processes
 * 5. Kills orphans older than grace period
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  findAllClaudeProcesses,
  isPidAlive,
  killProcess,
  readPidFile,
} from './process-spawner';
import {
  checkProcessHealth,
  ORPHAN_GRACE_PERIOD_MS,
  type ProcessHealthResult,
} from './process-health';
import { WorkflowExecutionSchema, type WorkflowExecution } from './workflow-service';
import {
  OrchestrationExecutionSchema,
  type OrchestrationExecution,
} from '@specflow/shared';

// Track reconciliation state
let reconciliationDone = false;
let reconciliationInProgress = false;

/**
 * Registry schema
 */
const RegistryProjectSchema = z.object({
  path: z.string(),
  name: z.string(),
  registered_at: z.string(),
  last_seen: z.string().optional(),
});

const RegistrySchema = z.object({
  projects: z.record(z.string(), RegistryProjectSchema),
  config: z
    .object({
      dev_folders: z.array(z.string()).optional(),
    })
    .optional(),
});

export interface ReconciliationResult {
  projectsChecked: number;
  workflowsChecked: number;
  workflowsUpdated: number;
  orchestrationsChecked: number;
  orchestrationsUpdated: number;
  orphansFound: number;
  orphansKilled: number;
  errors: string[];
}

/**
 * Get all registered projects
 */
function getAllProjects(): Array<{ id: string; path: string }> {
  const homeDir = process.env.HOME || '';
  const registryPath = join(homeDir, '.specflow', 'registry.json');

  if (!existsSync(registryPath)) {
    return [];
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = RegistrySchema.parse(JSON.parse(content));
    return Object.entries(registry.projects).map(([id, project]) => ({
      id,
      path: project.path,
    }));
  } catch {
    return [];
  }
}

/**
 * Load all workflow executions for a project
 */
function loadProjectWorkflows(projectPath: string): WorkflowExecution[] {
  const workflowDir = join(projectPath, '.specflow', 'workflows');
  const executions: WorkflowExecution[] = [];

  if (!existsSync(workflowDir)) {
    return [];
  }

  try {
    const entries = readdirSync(workflowDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('pending-') && entry.name.endsWith('.json')) {
        try {
          const content = readFileSync(join(workflowDir, entry.name), 'utf-8');
          executions.push(WorkflowExecutionSchema.parse(JSON.parse(content)));
        } catch {
          // Skip invalid files
        }
      } else if (entry.isDirectory()) {
        const metadataPath = join(workflowDir, entry.name, 'metadata.json');
        if (existsSync(metadataPath)) {
          try {
            const content = readFileSync(metadataPath, 'utf-8');
            executions.push(WorkflowExecutionSchema.parse(JSON.parse(content)));
          } catch {
            // Skip invalid files
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return executions;
}

/**
 * Load all orchestration executions for a project (T056)
 */
function loadProjectOrchestrations(projectPath: string): OrchestrationExecution[] {
  const workflowDir = join(projectPath, '.specflow', 'workflows');
  const executions: OrchestrationExecution[] = [];

  if (!existsSync(workflowDir)) {
    return [];
  }

  try {
    const files = readdirSync(workflowDir).filter(
      (f) => f.startsWith('orchestration-') && f.endsWith('.json')
    );

    for (const file of files) {
      try {
        const content = readFileSync(join(workflowDir, file), 'utf-8');
        executions.push(OrchestrationExecutionSchema.parse(JSON.parse(content)));
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return executions;
}

/**
 * Get the current linked workflow execution ID for an orchestration
 */
function getCurrentLinkedWorkflowId(orchestration: OrchestrationExecution): string | undefined {
  const { executions, currentPhase, batches } = orchestration;

  switch (currentPhase) {
    case 'design':
      return executions.design;
    case 'analyze':
      return executions.analyze;
    case 'implement':
      // Get the current batch's workflow execution
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
 * Save an orchestration execution
 */
function saveOrchestration(execution: OrchestrationExecution, projectPath: string): void {
  const workflowDir = join(projectPath, '.specflow', 'workflows');
  mkdirSync(workflowDir, { recursive: true });
  const filePath = join(workflowDir, `orchestration-${execution.id}.json`);
  writeFileSync(filePath, JSON.stringify(execution, null, 2));
}

/**
 * Save a workflow execution
 */
function saveWorkflow(execution: WorkflowExecution, projectPath: string): void {
  const workflowDir = join(projectPath, '.specflow', 'workflows');
  mkdirSync(workflowDir, { recursive: true });

  if (execution.sessionId) {
    const sessionDir = join(workflowDir, execution.sessionId);
    mkdirSync(sessionDir, { recursive: true });
    const metadataPath = join(sessionDir, 'metadata.json');
    writeFileSync(metadataPath, JSON.stringify(execution, null, 2));
  } else {
    const pendingPath = join(workflowDir, `pending-${execution.id}.json`);
    writeFileSync(pendingPath, JSON.stringify(execution, null, 2));
  }
}

/**
 * Collect all tracked PIDs from active workflows
 */
function collectTrackedPids(
  projects: Array<{ id: string; path: string }>
): Set<number> {
  const pids = new Set<number>();

  for (const project of projects) {
    const workflows = loadProjectWorkflows(project.path);
    for (const workflow of workflows) {
      // Only collect from active workflows
      if (['running', 'waiting_for_input', 'stale'].includes(workflow.status)) {
        // Check pid file
        const workflowDir = join(project.path, '.specflow', 'workflows', workflow.id);
        const pidInfo = readPidFile(workflowDir);
        if (pidInfo?.bashPid) pids.add(pidInfo.bashPid);
        if (pidInfo?.claudePid) pids.add(pidInfo.claudePid);

        // Also check legacy pid field
        if (workflow.pid) pids.add(workflow.pid);
      }
    }
  }

  return pids;
}

/**
 * Find orphaned Claude processes that aren't tracked by any workflow
 */
export async function findOrphanedClaudeProcesses(): Promise<
  Array<{ pid: number; startTime: Date; ageMs: number }>
> {
  const projects = getAllProjects();
  const trackedPids = collectTrackedPids(projects);
  const allClaude = findAllClaudeProcesses();
  const now = Date.now();

  return allClaude
    .filter((p) => !trackedPids.has(p.pid))
    .map((p) => ({
      pid: p.pid,
      startTime: p.startTime,
      ageMs: now - p.startTime.getTime(),
    }));
}

/**
 * Clean up an orphaned process if it's older than the grace period
 *
 * SAFETY WARNING: This should ONLY be called for processes that we have
 * explicit tracking for (via PID files from dashboard-spawned workflows).
 * Do NOT use this to kill arbitrary "claude" processes found via ps/pgrep.
 *
 * @param pid - Process ID to kill (must be a dashboard-tracked PID)
 * @param ageMs - Age of the process in milliseconds
 * @param workflowId - Optional workflow ID for logging (safety check)
 */
export async function cleanupOrphanedProcess(
  pid: number,
  ageMs: number,
  workflowId?: string
): Promise<boolean> {
  // Don't kill processes younger than grace period
  if (ageMs < ORPHAN_GRACE_PERIOD_MS) {
    console.log(`[process-reconciler] Skipping PID ${pid} - too young (${ageMs}ms < ${ORPHAN_GRACE_PERIOD_MS}ms)`);
    return false;
  }

  // Check if still alive
  if (!isPidAlive(pid)) {
    return false; // Already dead
  }

  // Log what we're about to do
  console.log(`[process-reconciler] Killing tracked process PID ${pid}${workflowId ? ` (workflow: ${workflowId})` : ''}`);

  // Kill the process
  return killProcess(pid, false);
}

/**
 * Reconcile all workflows across all projects
 *
 * This should be called on dashboard startup to:
 * 1. Update stale/dead workflow statuses
 * 2. Clean up orphaned processes
 */
export async function reconcileWorkflows(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    projectsChecked: 0,
    workflowsChecked: 0,
    workflowsUpdated: 0,
    orchestrationsChecked: 0,
    orchestrationsUpdated: 0,
    orphansFound: 0,
    orphansKilled: 0,
    errors: [],
  };

  const projects = getAllProjects();
  result.projectsChecked = projects.length;

  // Phase 1: Check workflow health
  for (const project of projects) {
    try {
      const workflows = loadProjectWorkflows(project.path);

      for (const workflow of workflows) {
        // Only check active workflows
        if (!['running', 'waiting_for_input', 'stale'].includes(workflow.status)) {
          continue;
        }

        result.workflowsChecked++;

        const health = checkProcessHealth(workflow, project.path);
        let updated = false;

        if (health.healthStatus === 'dead') {
          workflow.status = 'failed';
          workflow.error = 'Process terminated unexpectedly (detected on startup)';
          workflow.updatedAt = new Date().toISOString();
          workflow.logs.push(`[RECONCILE] Process dead, marking as failed`);
          updated = true;
        } else if (health.healthStatus === 'stale') {
          workflow.status = 'stale';
          workflow.error = `Session inactive (no updates in ${Math.floor(
            (health.sessionFileAge || 0) / 60000
          )}+ minutes)`;
          workflow.updatedAt = new Date().toISOString();
          workflow.logs.push(`[RECONCILE] Session stale, marking as stale`);
          updated = true;
        }

        if (updated) {
          saveWorkflow(workflow, project.path);
          result.workflowsUpdated++;
        }
      }

      // Phase 1b: Check orchestration health (T056, T057)
      const orchestrations = loadProjectOrchestrations(project.path);
      for (const orchestration of orchestrations) {
        // Only check active orchestrations
        if (!['running', 'paused', 'waiting_merge'].includes(orchestration.status)) {
          continue;
        }

        result.orchestrationsChecked++;
        let updated = false;

        // Check if linked workflow executions are still alive
        const currentWorkflowId = getCurrentLinkedWorkflowId(orchestration);
        if (currentWorkflowId) {
          // Find the workflow execution
          const workflows = loadProjectWorkflows(project.path);
          const linkedWorkflow = workflows.find(
            (w) => w.id === currentWorkflowId || w.sessionId === currentWorkflowId
          );

          if (linkedWorkflow) {
            // If workflow is failed/cancelled, orchestration should reflect that
            if (linkedWorkflow.status === 'failed' || linkedWorkflow.status === 'cancelled') {
              orchestration.status = 'failed';
              orchestration.errorMessage = `Linked workflow ${linkedWorkflow.status}: ${linkedWorkflow.error || 'Unknown error'}`;
              orchestration.updatedAt = new Date().toISOString();
              orchestration.decisionLog.push({
                timestamp: new Date().toISOString(),
                decision: 'reconcile_failed',
                reason: `Workflow ${linkedWorkflow.status} detected on startup`,
              });
              updated = true;
            }
          }
        }

        // If orchestration has been running for too long without updates, mark as failed
        const lastUpdateAge = Date.now() - new Date(orchestration.updatedAt).getTime();
        const MAX_ORCHESTRATION_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
        if (orchestration.status === 'running' && lastUpdateAge > MAX_ORCHESTRATION_AGE_MS) {
          orchestration.status = 'failed';
          orchestration.errorMessage = 'Orchestration stale (no updates in 4+ hours)';
          orchestration.updatedAt = new Date().toISOString();
          orchestration.decisionLog.push({
            timestamp: new Date().toISOString(),
            decision: 'reconcile_stale',
            reason: 'No updates in 4+ hours, marking as failed',
          });
          updated = true;
        }

        if (updated) {
          saveOrchestration(orchestration, project.path);
          result.orchestrationsUpdated++;
        }
      }
    } catch (err) {
      result.errors.push(
        `Error checking project ${project.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Phase 2: Find orphans (but DO NOT auto-kill them)
  // SAFETY: Orphan detection is too aggressive - it can match legitimate Claude
  // processes that weren't spawned by the dashboard. Only report, never auto-kill.
  // Users can manually kill via /api/workflow/kill if needed.
  try {
    const orphans = await findOrphanedClaudeProcesses();
    result.orphansFound = orphans.length;
    // Deliberately NOT killing orphans - too dangerous
    // result.orphansKilled stays at 0
    if (orphans.length > 0) {
      console.log('[process-reconciler] Found potential orphans (not killing):', orphans.map(o => o.pid));
    }
  } catch (err) {
    result.errors.push(
      `Error during orphan detection: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

/**
 * Ensure reconciliation has been run (idempotent)
 * Call this from workflowService.get() and .list()
 */
export async function ensureReconciliation(): Promise<void> {
  if (reconciliationDone || reconciliationInProgress) {
    return;
  }

  reconciliationInProgress = true;
  try {
    const result = await reconcileWorkflows();
    console.log('[process-reconciler] Reconciliation complete:', {
      projectsChecked: result.projectsChecked,
      workflowsChecked: result.workflowsChecked,
      workflowsUpdated: result.workflowsUpdated,
      orphansFound: result.orphansFound,
      orphansKilled: result.orphansKilled,
      errors: result.errors.length,
    });
    reconciliationDone = true;
  } catch (err) {
    console.error('[process-reconciler] Reconciliation failed:', err);
  } finally {
    reconciliationInProgress = false;
  }
}

/**
 * Reset reconciliation state (for testing)
 */
export function resetReconciliation(): void {
  reconciliationDone = false;
  reconciliationInProgress = false;
}
