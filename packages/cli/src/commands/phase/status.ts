import { output } from '../../lib/output.js';
import { readState } from '../../lib/state.js';
import { readRoadmap, getPhaseByNumber } from '../../lib/roadmap.js';
import { findProjectRoot, getSpecsDir, pathExists } from '../../lib/paths.js';
import { phaseSlug, getPhaseDetailPath } from '../../lib/phases.js';
import { handleError, NotFoundError } from '../../lib/errors.js';
import { join } from 'node:path';

/**
 * Phase status output
 */
export interface PhaseStatusOutput {
  phase: {
    number: string | null;
    name: string | null;
    status: string;
    branch: string | null;
  };
  artifacts: {
    specDir: string | null;
    phaseFile: string | null;
    hasSpec: boolean;
    hasPlan: boolean;
    hasTasks: boolean;
  };
  nextPhase: {
    number: string;
    name: string;
  } | null;
}

/**
 * Get current phase status
 */
async function getPhaseStatus(): Promise<PhaseStatusOutput> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
  }

  // Read state
  const state = await readState(projectRoot);
  const phase = state.orchestration?.phase;

  // Read roadmap for next phase
  const roadmap = await readRoadmap(projectRoot);
  const nextPhase = roadmap.nextPhase;

  // Check for artifacts
  let specDir: string | null = null;
  let hasSpec = false;
  let hasPlan = false;
  let hasTasks = false;

  if (phase?.number && phase?.name) {
    const slug = phaseSlug(phase.name);
    specDir = join(getSpecsDir(projectRoot), `${phase.number}-${slug}`);

    if (pathExists(specDir)) {
      hasSpec = pathExists(join(specDir, 'spec.md'));
      hasPlan = pathExists(join(specDir, 'plan.md'));
      hasTasks = pathExists(join(specDir, 'tasks.md'));
    }
  }

  // Get phase file path
  let phaseFile: string | null = null;
  if (phase?.number && phase?.name) {
    const phasePath = getPhaseDetailPath(phase.number, phase.name, projectRoot);
    if (pathExists(phasePath)) {
      phaseFile = phasePath;
    }
  }

  return {
    phase: {
      number: phase?.number ?? null,
      name: phase?.name ?? null,
      status: phase?.status ?? 'not_started',
      branch: phase?.branch ?? null,
    },
    artifacts: {
      specDir,
      phaseFile,
      hasSpec,
      hasPlan,
      hasTasks,
    },
    nextPhase: nextPhase
      ? { number: nextPhase.number, name: nextPhase.name }
      : null,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: PhaseStatusOutput): string {
  if (!result.phase.number) {
    const lines = ['No active phase'];
    if (result.nextPhase) {
      lines.push(`Next: Phase ${result.nextPhase.number} (${result.nextPhase.name})`);
    }
    return lines.join('\n');
  }

  const lines = [
    `Phase ${result.phase.number}: ${result.phase.name}`,
    `Status: ${result.phase.status}`,
  ];

  if (result.phase.branch) {
    lines.push(`Branch: ${result.phase.branch}`);
  }

  // Artifacts
  const artifacts: string[] = [];
  if (result.artifacts.hasSpec) artifacts.push('spec');
  if (result.artifacts.hasPlan) artifacts.push('plan');
  if (result.artifacts.hasTasks) artifacts.push('tasks');

  if (artifacts.length > 0) {
    lines.push(`Artifacts: ${artifacts.join(', ')}`);
  }

  if (result.nextPhase) {
    lines.push(`Next: Phase ${result.nextPhase.number} (${result.nextPhase.name})`);
  }

  return lines.join('\n');
}

/**
 * Phase status action
 */
export async function statusAction(options: { json?: boolean }): Promise<void> {
  try {
    const result = await getPhaseStatus();

    if (options.json) {
      output(result);
    } else {
      output(result, formatHumanReadable(result));
    }
  } catch (err) {
    handleError(err);
  }
}
