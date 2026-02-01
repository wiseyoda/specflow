import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { orchestrationService } from '@/lib/services/orchestration-service';
import { parseBatchesFromProject } from '@/lib/services/batch-parser';
import { workflowService } from '@/lib/services/workflow-service';
import { isRunnerActive } from '@/lib/services/orchestration-runner';
import type { OrchestrationPhase } from '@specflow/shared';
import type { OrchestrationExecution } from '@/lib/services/orchestration-types';

// =============================================================================
// Types
// =============================================================================

interface SpecflowStatus {
  phase?: {
    number?: number | null;
    name?: string | null;
    dir?: string;
    status?: string;
  };
  context?: {
    hasSpec?: boolean;
    hasPlan?: boolean;
    hasTasks?: boolean;
    featureDir?: string;
  };
  progress?: {
    tasksTotal?: number;
    tasksCompleted?: number;  // Note: specflow uses 'tasksCompleted' with 'd'
    percentage?: number;
  };
  nextAction?: string;  // e.g., 'start_phase', 'run_design', 'implement', etc.
}

interface PreflightStatus {
  hasSpec: boolean;
  hasPlan: boolean;
  hasTasks: boolean;
  tasksTotal: number;
  tasksComplete: number;
  phaseNumber: number | null;
  phaseName: string | null;
  /** Current phase status: 'not_started' means phase needs to be opened */
  phaseStatus: string | null;
  /** Next action from specflow: 'start_phase' means no active phase */
  nextAction: string | null;
}

// =============================================================================
// Registry Lookup
// =============================================================================

/**
 * Sync current phase to orchestration-state.json for UI consistency
 * Also syncs status for completed phases (e.g., waiting_merge means verify is complete)
 */
function syncPhaseToStateFile(projectPath: string, phase: OrchestrationPhase, orchStatus?: string): void {
  try {
    let statePath = join(projectPath, '.specflow', 'orchestration-state.json');
    if (!existsSync(statePath)) {
      statePath = join(projectPath, '.specify', 'orchestration-state.json');
    }
    if (!existsSync(statePath)) return;

    const content = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content);

    // Determine step status based on orchestration status
    // waiting_merge means verify is complete, merge is pending user action
    let stepStatus = 'in_progress';
    if (orchStatus === 'waiting_merge') {
      stepStatus = 'complete'; // Previous step (verify) is complete
    } else if (orchStatus === 'completed') {
      stepStatus = 'complete';
    } else if (orchStatus === 'failed') {
      stepStatus = 'failed';
    }

    // Only update if phase or status differs (avoid unnecessary writes)
    const currentStep = state.orchestration?.step?.current;
    const currentStatus = state.orchestration?.step?.status;
    if (currentStep !== phase || currentStatus !== stepStatus) {
      state.orchestration = state.orchestration || {};
      state.orchestration.step = state.orchestration.step || {};
      state.orchestration.step.current = phase;
      state.orchestration.step.status = stepStatus;
      state.last_updated = new Date().toISOString();
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    }
  } catch {
    // Non-critical
  }
}

function getProjectPath(projectId: string): string | null {
  const { existsSync, readFileSync } = require('fs');
  const { join } = require('path');

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
 * Get pre-flight status from specflow status --json
 */
function getPreflightStatus(projectPath: string): PreflightStatus {
  try {
    const result = execSync('specflow status --json', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });
    const status: SpecflowStatus = JSON.parse(result);

    return {
      hasSpec: status.context?.hasSpec ?? false,
      hasPlan: status.context?.hasPlan ?? false,
      hasTasks: status.context?.hasTasks ?? false,
      tasksTotal: status.progress?.tasksTotal ?? 0,
      tasksComplete: status.progress?.tasksCompleted ?? 0,
      phaseNumber: status.phase?.number ?? null,
      phaseName: status.phase?.name ?? null,
      phaseStatus: status.phase?.status ?? null,
      nextAction: status.nextAction ?? null,
    };
  } catch {
    // Return defaults if specflow status fails
    return {
      hasSpec: false,
      hasPlan: false,
      hasTasks: false,
      tasksTotal: 0,
      tasksComplete: 0,
      phaseNumber: null,
      phaseName: null,
      phaseStatus: null,
      nextAction: null,
    };
  }
}

// =============================================================================
// GET /api/workflow/orchestrate/status (T027)
// =============================================================================

/**
 * GET /api/workflow/orchestrate/status
 *
 * Get orchestration status for a project.
 *
 * Query params:
 * - projectId: string (required) - Registry project key
 * - id: string (optional) - Specific orchestration ID, otherwise returns active
 *
 * Response (200):
 * - orchestration: Full OrchestrationExecution object or null if none active
 *
 * Errors:
 * - 400: Missing projectId
 * - 404: Project not found or orchestration not found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const orchestrationId = searchParams.get('id');
    const preview = searchParams.get('preview') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: projectId' },
        { status: 400 }
      );
    }

    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Preview mode: return batch plan info without starting orchestration
    if (preview) {
      const batchPlan = parseBatchesFromProject(projectPath);
      const preflight = getPreflightStatus(projectPath);

      if (!batchPlan) {
        return NextResponse.json({
          orchestration: null,
          batchPlan: null,
          preflight,
        }, { status: 200 });
      }

      // Calculate total task count from batches
      const taskCount = batchPlan.batches.reduce(
        (sum, batch) => sum + batch.taskIds.length,
        0
      );

      return NextResponse.json({
        orchestration: null,
        batchPlan: {
          summary: `${batchPlan.batches.length} batch${batchPlan.batches.length !== 1 ? 'es' : ''} with ${taskCount} task${taskCount !== 1 ? 's' : ''}`,
          batchCount: batchPlan.batches.length,
          taskCount,
          usedFallback: batchPlan.usedFallback,
        },
        preflight,
      });
    }

    let orchestration;
    if (orchestrationId) {
      // Get specific orchestration
      orchestration = orchestrationService.get(projectPath, orchestrationId);
      if (!orchestration) {
        return NextResponse.json(
          { error: `Orchestration not found: ${orchestrationId}` },
          { status: 404 }
        );
      }
    } else {
      // Get active orchestration
      orchestration = orchestrationService.getActive(projectPath);
    }

    if (!orchestration) {
      return NextResponse.json({ orchestration: null, workflow: null }, { status: 200 });
    }

    // Sync current phase to state file (ensures UI consistency for project list)
    syncPhaseToStateFile(projectPath, orchestration.currentPhase, orchestration.status);

    // Look up the current workflow to get its sessionId
    let workflowInfo: { id: string; sessionId?: string; status?: string } | null = null;
    const currentWorkflowId = getCurrentWorkflowId(orchestration);
    if (currentWorkflowId && projectId) {
      const workflowExecution = workflowService.get(currentWorkflowId, projectId);
      if (workflowExecution) {
        workflowInfo = {
          id: currentWorkflowId,
          sessionId: workflowExecution.sessionId,
          status: workflowExecution.status,
        };
      }
    }

    return NextResponse.json({
      orchestration: {
        id: orchestration.id,
        projectId: orchestration.projectId,
        status: orchestration.status,
        config: orchestration.config,
        currentPhase: orchestration.currentPhase,
        batches: orchestration.batches,
        executions: orchestration.executions,
        startedAt: orchestration.startedAt,
        updatedAt: orchestration.updatedAt,
        completedAt: orchestration.completedAt,
        decisionLog: orchestration.decisionLog.slice(-20), // Last 20 decisions
        totalCostUsd: orchestration.totalCostUsd,
        errorMessage: orchestration.errorMessage,
        recoveryContext: orchestration.recoveryContext,
      },
      workflow: workflowInfo,
      runnerActive: isRunnerActive(orchestration.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
