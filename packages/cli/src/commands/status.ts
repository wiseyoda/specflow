import { Command } from 'commander';
import { output, header, keyValue, status as statusOutput } from '../lib/output.js';
import { readState } from '../lib/state.js';
import { readRoadmap, getPhaseByNumber } from '../lib/roadmap.js';
import { readTasks } from '../lib/tasks.js';
import { getProjectContext, resolveFeatureDir } from '../lib/context.js';
import { runHealthCheck, getQuickHealthStatus, type HealthStatus } from '../lib/health.js';
import { findProjectRoot, pathExists } from '../lib/paths.js';
import { handleError } from '../lib/errors.js';

/**
 * Next action values returned by status command
 */
export type NextAction =
  | 'start_phase'
  | 'run_design'
  | 'run_analyze'
  | 'continue_implement'
  | 'run_verify'
  | 'ready_to_merge'
  | 'fix_health'
  | 'awaiting_user_gate'
  | 'archive_phase';

/**
 * Status command output structure
 */
export interface StatusOutput {
  phase: {
    number: string | null;
    name: string | null;
    branch: string | null;
    status: string | null;
    hasUserGate: boolean;
  };
  step: {
    current: string | null;
    index: number;
    status: string | null;
  };
  progress: {
    tasksCompleted: number;
    tasksTotal: number;
    tasksBlocked: number;
    percentage: number;
  };
  health: {
    status: HealthStatus;
    issues: Array<{
      code: string;
      severity: string;
      message: string;
    }>;
  };
  nextAction: NextAction;
  blockers: string[];
  context: {
    featureDir: string | null;
    hasSpec: boolean;
    hasPlan: boolean;
    hasTasks: boolean;
    hasChecklists: boolean;
  };
}

/**
 * Determine next action based on current state
 */
function determineNextAction(
  phaseStatus: string | null | undefined,
  stepCurrent: string | null | undefined,
  stepStatus: string | null | undefined,
  healthStatus: HealthStatus,
  tasksComplete: boolean,
  hasDesignArtifacts: boolean,
  hasUserGate: boolean,
): NextAction {
  // Health issues take priority
  if (healthStatus === 'error') {
    return 'fix_health';
  }

  // No active phase
  if (!phaseStatus || phaseStatus === 'not_started') {
    return 'start_phase';
  }

  // Phase awaiting user gate
  if (phaseStatus === 'awaiting_user_gate') {
    return 'awaiting_user_gate';
  }

  // Phase complete but not archived
  if (phaseStatus === 'complete') {
    return 'archive_phase';
  }

  // Based on current step
  const step = stepCurrent || 'design';

  if (step === 'design') {
    if (!hasDesignArtifacts) {
      return 'run_design';
    }
    return 'run_analyze';
  }

  if (step === 'analyze') {
    return 'run_analyze';
  }

  if (step === 'implement') {
    if (tasksComplete) {
      return 'run_verify';
    }
    return 'continue_implement';
  }

  if (step === 'verify') {
    if (hasUserGate) {
      return 'awaiting_user_gate';
    }
    return 'ready_to_merge';
  }

  return 'continue_implement';
}

/**
 * Get status for the current project
 */
async function getStatus(): Promise<StatusOutput> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    return {
      phase: { number: null, name: null, branch: null, status: null, hasUserGate: false },
      step: { current: null, index: 0, status: null },
      progress: { tasksCompleted: 0, tasksTotal: 0, tasksBlocked: 0, percentage: 0 },
      health: { status: 'error', issues: [{ code: 'NO_PROJECT', severity: 'error', message: 'Not in a SpecFlow project' }] },
      nextAction: 'fix_health',
      blockers: ['Not in a SpecFlow project directory'],
      context: { featureDir: null, hasSpec: false, hasPlan: false, hasTasks: false, hasChecklists: false },
    };
  }

  // Read state
  let state;
  try {
    state = await readState(projectRoot);
  } catch {
    return {
      phase: { number: null, name: null, branch: null, status: null, hasUserGate: false },
      step: { current: null, index: 0, status: null },
      progress: { tasksCompleted: 0, tasksTotal: 0, tasksBlocked: 0, percentage: 0 },
      health: { status: 'error', issues: [{ code: 'NO_STATE', severity: 'error', message: 'No state file found' }] },
      nextAction: 'fix_health',
      blockers: ['No state file - run "specflow state init"'],
      context: { featureDir: null, hasSpec: false, hasPlan: false, hasTasks: false, hasChecklists: false },
    };
  }

  // Get phase info from state
  const phaseNumber = state.orchestration?.phase?.number ?? null;
  const phaseName = state.orchestration?.phase?.name ?? null;
  const phaseBranch = state.orchestration?.phase?.branch ?? null;
  const phaseStatus = state.orchestration?.phase?.status ?? null;

  // Check roadmap for user gate info
  let hasUserGate = false;
  try {
    const roadmap = await readRoadmap(projectRoot);
    if (phaseNumber) {
      const roadmapPhase = getPhaseByNumber(roadmap, phaseNumber);
      hasUserGate = roadmapPhase?.hasUserGate ?? false;
    }
  } catch {
    // Roadmap not found - continue without it
  }

  // Get step info
  const stepCurrent = state.orchestration?.step?.current ?? null;
  const stepIndex = parseInt(String(state.orchestration?.step?.index ?? 0), 10);
  const stepStatus = state.orchestration?.step?.status ?? null;

  // Get task progress
  let tasksCompleted = 0;
  let tasksTotal = 0;
  let tasksBlocked = 0;

  let featureDir: string | undefined;
  let hasSpec = false;
  let hasPlan = false;
  let hasTasks = false;
  let hasChecklists = false;

  // Only look for artifacts if there's an active phase
  // This prevents showing artifacts from old phases when no phase is started
  const hasActivePhase = phaseNumber && phaseStatus && phaseStatus !== 'not_started';

  if (hasActivePhase) {
    featureDir = await resolveFeatureDir(undefined, projectRoot);

    if (featureDir) {
      try {
        const context = await getProjectContext(projectRoot);
        if (context.activeFeature) {
          hasSpec = context.activeFeature.artifacts.spec;
          hasPlan = context.activeFeature.artifacts.plan;
          hasTasks = context.activeFeature.artifacts.tasks;
          hasChecklists = context.activeFeature.artifacts.checklists.implementation &&
                          context.activeFeature.artifacts.checklists.verification;
        }

        if (hasTasks) {
          const tasks = await readTasks(featureDir);
          tasksCompleted = tasks.progress.completed;
          tasksTotal = tasks.progress.total;
          tasksBlocked = tasks.progress.blocked;
        }
      } catch {
        // Context/tasks not available
      }
    }
  }

  // Run health check
  const healthResult = await runHealthCheck(projectRoot);

  // Determine blockers
  const blockers: string[] = [];
  if (stepStatus === 'blocked') {
    blockers.push('Current step is blocked');
  }
  if (stepStatus === 'failed') {
    blockers.push('Current step failed');
  }
  for (const issue of healthResult.issues) {
    if (issue.severity === 'error') {
      blockers.push(issue.message);
    }
  }

  // Determine next action
  const hasDesignArtifacts = hasSpec && hasPlan && hasTasks && hasChecklists;
  const tasksComplete = tasksTotal > 0 && tasksCompleted === tasksTotal;

  const nextAction = determineNextAction(
    phaseStatus,
    stepCurrent,
    stepStatus,
    healthResult.status,
    tasksComplete,
    hasDesignArtifacts,
    hasUserGate,
  );

  return {
    phase: {
      number: phaseNumber,
      name: phaseName,
      branch: phaseBranch,
      status: phaseStatus,
      hasUserGate,
    },
    step: {
      current: stepCurrent,
      index: stepIndex,
      status: stepStatus,
    },
    progress: {
      tasksCompleted,
      tasksTotal,
      tasksBlocked,
      percentage: tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
    },
    health: {
      status: healthResult.status,
      issues: healthResult.issues.map(i => ({
        code: i.code,
        severity: i.severity,
        message: i.message,
      })),
    },
    nextAction,
    blockers,
    context: {
      featureDir: featureDir ?? null,
      hasSpec,
      hasPlan,
      hasTasks,
      hasChecklists,
    },
  };
}

/**
 * Format human-readable status output
 */
function formatHumanReadable(status: StatusOutput): string {
  const lines: string[] = [];

  // Phase info
  if (status.phase.number) {
    lines.push(`Phase ${status.phase.number}: ${status.phase.name ?? 'Unknown'}`);
    lines.push(`Status: ${status.phase.status ?? 'unknown'} | Step: ${status.step.current ?? 'none'}`);
  } else {
    lines.push('No active phase');
  }

  // Progress
  if (status.progress.tasksTotal > 0) {
    lines.push(`Tasks: ${status.progress.tasksCompleted}/${status.progress.tasksTotal} (${status.progress.percentage}%)`);
  }

  // Next action
  const actionMap: Record<NextAction, string> = {
    start_phase: 'Start next phase',
    run_design: 'Run /flow.design to create artifacts',
    run_analyze: 'Run /flow.analyze to validate',
    continue_implement: 'Continue implementing tasks',
    run_verify: 'Run /flow.verify to complete',
    ready_to_merge: 'Ready for /flow.merge',
    fix_health: 'Fix health issues first',
    awaiting_user_gate: 'Awaiting user verification',
    archive_phase: 'Archive completed phase',
  };
  lines.push(`Next: ${actionMap[status.nextAction]}`);

  return lines.join('\n');
}

/**
 * Status command
 */
export const statusCommand = new Command('status')
  .description('Get complete project status in a single call')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const status = await getStatus();

      if (options.json) {
        output(status);
      } else {
        output(status, formatHumanReadable(status));
      }
    } catch (err) {
      handleError(err);
    }
  });
