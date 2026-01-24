import { NextResponse } from 'next/server';
import { z } from 'zod';
import { execSync } from 'child_process';
import { OrchestrationConfigSchema, type OrchestrationPhase, type OrchestrationConfig } from '@specflow/shared';
import { orchestrationService } from '@/lib/services/orchestration-service';
import { parseBatchesFromProject, getBatchPlanSummary } from '@/lib/services/batch-parser';
import { runOrchestration } from '@/lib/services/orchestration-runner';

// =============================================================================
// Skill Mapping
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
// Request Schema
// =============================================================================

const StartOrchestrationRequestSchema = z.object({
  projectId: z.string().min(1),
  config: OrchestrationConfigSchema,
});

// =============================================================================
// Specflow Status
// =============================================================================

interface SpecflowStatus {
  phase?: {
    number?: number | null;
    name?: string | null;
    status?: string;
  };
  context?: {
    hasSpec?: boolean;
    hasPlan?: boolean;
    hasTasks?: boolean;
  };
  progress?: {
    tasksTotal?: number;
    tasksCompleted?: number;
  };
  step?: {
    current?: string;
    status?: string;
  };
  nextAction?: string;
}

/**
 * Get full specflow status for a project
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
 * Check if phase needs to be opened (no active phase)
 */
function needsPhaseOpen(status: SpecflowStatus | null): boolean {
  if (!status) return false;
  return status.nextAction === 'start_phase' || status.phase?.status === 'not_started';
}

/**
 * Check if design phase needs to run (phase open but no artifacts)
 */
function needsDesign(status: SpecflowStatus | null): boolean {
  if (!status) return false;
  // Phase is open but design hasn't been run yet
  return !status.context?.hasSpec && !status.context?.hasPlan && !status.context?.hasTasks;
}

/**
 * Determine smart starting phase based on project state
 * Returns config overrides for skipDesign/skipAnalyze/skipImplement/skipVerify
 *
 * Phase ordering: design → analyze → implement → verify → merge
 */
function getSmartConfig(
  status: SpecflowStatus | null,
  config: OrchestrationConfig
): OrchestrationConfig {
  if (!status) return config;

  const hasSpec = status.context?.hasSpec ?? false;
  const hasPlan = status.context?.hasPlan ?? false;
  const hasTasks = status.context?.hasTasks ?? false;
  const tasksTotal = status.progress?.tasksTotal ?? 0;
  const tasksCompleted = status.progress?.tasksCompleted ?? 0;
  const allTasksComplete = tasksTotal > 0 && tasksCompleted >= tasksTotal;

  // Check step.current to determine what phase we're at (state file may be stale)
  const stepCurrent = status.step?.current;
  const stepStatus = status.step?.status;

  // Phase ordering for determining "past" phases
  const phaseOrder = ['design', 'analyze', 'implement', 'verify', 'merge'];
  const currentPhaseIndex = stepCurrent ? phaseOrder.indexOf(stepCurrent) : -1;

  // Helper: is current phase at or past a given phase?
  const isPastPhase = (phase: string) => {
    const phaseIndex = phaseOrder.indexOf(phase);
    return currentPhaseIndex >= 0 && currentPhaseIndex > phaseIndex;
  };

  // Helper: is current phase at a given phase and complete?
  const isPhaseComplete = (phase: string) => {
    return stepCurrent === phase && stepStatus === 'complete';
  };

  // Design is complete if:
  // - Artifacts exist (spec, plan, tasks)
  // - OR we're past design phase
  const designComplete = (hasSpec && hasPlan && hasTasks) || isPastPhase('design');

  // Analyze is complete if:
  // - User explicitly skips it
  // - OR we're past analyze phase (at implement, verify, or merge)
  // - OR step.current is 'analyze' and status is 'complete'
  // - OR all tasks are complete (implies we're past analyze - analyze happens before implement)
  const analyzeComplete = config.skipAnalyze || isPastPhase('analyze') || isPhaseComplete('analyze') || allTasksComplete;

  // Implement is complete if:
  // - All tasks are complete
  // - OR we're past implement phase (at verify or merge)
  const implementComplete = allTasksComplete || isPastPhase('implement');

  // Verify is complete if:
  // - step.current is 'verify' and status is 'complete'
  // - OR we're past verify phase (at merge)
  // Note: verify completion also requires all tasks to be complete
  const verifyComplete = (isPhaseComplete('verify') || isPastPhase('verify')) && allTasksComplete;

  console.log(`[getSmartConfig] stepCurrent=${stepCurrent}, stepStatus=${stepStatus}, phaseIndex=${currentPhaseIndex}`);
  console.log(`[getSmartConfig] designComplete=${designComplete}, analyzeComplete=${analyzeComplete}, implementComplete=${implementComplete}, verifyComplete=${verifyComplete}`);

  return {
    ...config,
    skipDesign: config.skipDesign || designComplete,
    skipAnalyze: config.skipAnalyze || analyzeComplete,
    skipImplement: implementComplete,
    skipVerify: verifyComplete,
  };
}

// =============================================================================
// Registry Lookup
// =============================================================================

/**
 * Get project path from registry by projectId
 */
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

// =============================================================================
// POST /api/workflow/orchestrate (T023-T026)
// =============================================================================

/**
 * POST /api/workflow/orchestrate
 *
 * Start a new orchestration for a project.
 *
 * Request body:
 * - projectId: string (required) - Registry project key
 * - config: OrchestrationConfig (required) - User configuration from modal
 *
 * Response (201):
 * - orchestration: OrchestrationExecution object
 * - batchPlan: Summary of detected batches
 *
 * Errors:
 * - 400: Invalid request body
 * - 404: Project not found
 * - 409: Orchestration already in progress
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body (T024)
    const parseResult = StartOrchestrationRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { projectId, config } = parseResult.data;

    // Get project path from registry (T024)
    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Get specflow status for smart decisions
    const specflowStatus = getSpecflowStatus(projectPath);

    // Check if phase needs to be opened first
    const phaseNeedsOpen = needsPhaseOpen(specflowStatus);

    // Check if design needs to run (phase open but no artifacts)
    const designNeeded = needsDesign(specflowStatus);

    // Apply smart config based on actual project state
    // This auto-skips design/analyze if artifacts already exist
    const smartConfig = getSmartConfig(specflowStatus, config);

    // Parse batch plan (T025) - only required if design is complete
    const batchPlan = parseBatchesFromProject(projectPath, smartConfig.batchSizeFallback);

    if (!phaseNeedsOpen && !designNeeded && !batchPlan) {
      // Phase is open, design is done, but no tasks.md found
      return NextResponse.json(
        { error: 'Could not find tasks.md in project specs directory' },
        { status: 400 }
      );
    }

    // Note: We allow starting even with 0 incomplete tasks
    // User may want to run verify/merge after implementation is complete

    // Start orchestration (T025, T026)
    // When phase needs opening or design needs to run, pass null batchPlan
    // Service will create empty batches that get populated after design completes
    const orchestration = await orchestrationService.start(
      projectId,
      projectPath,
      smartConfig,
      (phaseNeedsOpen || designNeeded) ? null : batchPlan
    );

    // Start the orchestration runner in the background
    // The runner will spawn the first workflow - this prevents race conditions
    // where both API and runner try to spawn workflows
    runOrchestration(projectId, orchestration.id).catch((error) => {
      console.error('[orchestrate] Runner error:', error);
    });

    // Determine what skill will be run (for response info)
    const baseSkill = getSkillForPhase(orchestration.currentPhase);
    const skill = smartConfig.additionalContext
      ? `${baseSkill} ${smartConfig.additionalContext}`
      : baseSkill;

    return NextResponse.json(
      {
        orchestration: {
          id: orchestration.id,
          projectId: orchestration.projectId,
          status: orchestration.status,
          currentPhase: orchestration.currentPhase,
          batches: {
            total: orchestration.batches.total,
            current: orchestration.batches.current,
          },
          startedAt: orchestration.startedAt,
          phaseNeedsOpen,
          designNeeded,
        },
        // Workflow will be spawned by runner - return expected skill info
        workflow: {
          id: null,
          skill: skill,
          status: 'pending',
          sessionId: null,
        },
        batchPlan: batchPlan
          ? {
              summary: getBatchPlanSummary(batchPlan),
              batchCount: batchPlan.batches.length,
              taskCount: batchPlan.totalIncomplete,
              usedFallback: batchPlan.usedFallback,
            }
          : {
              summary: phaseNeedsOpen
                ? 'Phase will be opened first, batches detected after design'
                : designNeeded
                ? 'Design will run first, batches detected after completion'
                : 'No batches available',
              batchCount: 0,
              taskCount: 0,
              usedFallback: false,
            },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Existing orchestration returns 409
    if (message.includes('already in progress')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    // Project not found returns 404
    if (message.includes('Project not found') || message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
