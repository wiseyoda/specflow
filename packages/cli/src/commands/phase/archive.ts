import { output } from '../../lib/output.js';
import { readRoadmap } from '../../lib/roadmap.js';
import { archivePhase, isPhaseArchived } from '../../lib/history.js';
import { findProjectRoot, getSpecsDir } from '../../lib/paths.js';
import { handleError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { cleanupPhaseSpecs, getSpecsCleanupPreview, findPhaseSpecsDir } from '../../lib/specs.js';
import { readTasks } from '../../lib/tasks.js';
import { join } from 'node:path';

/**
 * Phase archive output
 */
export interface PhaseArchiveOutput {
  action: 'archived' | 'dry_run' | 'skipped';
  phase: {
    number: string;
    name: string;
  };
  history: {
    alreadyArchived: boolean;
    archived: boolean;
  };
  specs: {
    found: boolean;
    fileCount: number;
    archived: boolean;
    archivePath: string | null;
  };
  tasks: {
    found: boolean;
    total: number;
    completed: number;
    incomplete: number;
  };
  message: string;
}

interface ArchiveOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Check task completion status for a phase
 */
async function checkPhaseTasks(
  phaseNumber: string,
  projectRoot: string,
): Promise<{ found: boolean; total: number; completed: number; incomplete: number }> {
  const phaseSpecsDir = await findPhaseSpecsDir(phaseNumber, projectRoot);
  if (!phaseSpecsDir) {
    return { found: false, total: 0, completed: 0, incomplete: 0 };
  }

  const tasksPath = join(phaseSpecsDir, 'tasks.md');
  try {
    const tasksData = await readTasks(tasksPath);
    return {
      found: true,
      total: tasksData.progress.total,
      completed: tasksData.progress.completed,
      incomplete: tasksData.progress.total - tasksData.progress.completed - tasksData.progress.deferred,
    };
  } catch {
    return { found: false, total: 0, completed: 0, incomplete: 0 };
  }
}

/**
 * Archive a completed phase retroactively
 *
 * This is for archiving phases that were completed before the archive workflow existed.
 * It verifies phase completion, checks for incomplete tasks, archives specs to
 * .specify/archive/, and ensures the phase is in HISTORY.md.
 */
async function archivePhaseByNumber(
  phaseNumber: string,
  options: ArchiveOptions = {},
): Promise<PhaseArchiveOutput> {
  const { dryRun = false, force = false } = options;
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
  }

  // Read roadmap to find phase info
  const roadmap = await readRoadmap(projectRoot);
  const phase = roadmap.phases.find(p => p.number === phaseNumber);

  if (!phase) {
    throw new NotFoundError(
      `Phase ${phaseNumber}`,
      `Phase not found in ROADMAP.md. Available phases: ${roadmap.phases.map(p => p.number).join(', ')}`,
    );
  }

  if (phase.status !== 'complete' && !force) {
    throw new ValidationError(
      `Phase ${phaseNumber} is not complete (status: ${phase.status})`,
      'Use --force to archive anyway, or wait until the phase is complete',
    );
  }

  // Check if already in HISTORY.md
  const alreadyInHistory = await isPhaseArchived(phaseNumber, projectRoot);

  // Get specs cleanup preview
  const specsPreview = await getSpecsCleanupPreview(phaseNumber, projectRoot);

  // Check task completion status
  const taskStatus = await checkPhaseTasks(phaseNumber, projectRoot);

  // Warn about incomplete tasks (but don't block if --force or phase marked complete)
  if (taskStatus.incomplete > 0 && !force && phase.status !== 'complete') {
    throw new ValidationError(
      `Phase ${phaseNumber} has ${taskStatus.incomplete} incomplete tasks`,
      'Use --force to archive anyway',
    );
  }

  // If nothing to do, skip
  if (alreadyInHistory && !specsPreview.hasSpecs) {
    return {
      action: 'skipped',
      phase: { number: phase.number, name: phase.name },
      history: { alreadyArchived: true, archived: false },
      specs: {
        found: false,
        fileCount: 0,
        archived: false,
        archivePath: null,
      },
      tasks: taskStatus,
      message: `Phase ${phaseNumber} already fully archived`,
    };
  }

  if (dryRun) {
    return {
      action: 'dry_run',
      phase: { number: phase.number, name: phase.name },
      history: { alreadyArchived: alreadyInHistory, archived: false },
      specs: {
        found: specsPreview.hasSpecs,
        fileCount: specsPreview.fileCount,
        archived: false,
        archivePath: null,
      },
      tasks: taskStatus,
      message: `Would archive Phase ${phaseNumber}`,
    };
  }

  // Archive to HISTORY.md if not already there
  let historyArchived = false;
  if (!alreadyInHistory) {
    await archivePhase(
      { number: phase.number, name: phase.name, status: 'complete', hasUserGate: false, line: 0 },
      projectRoot,
    );
    historyArchived = true;
  }

  // Archive specs if they exist
  let specsResult = {
    archived: false,
    archivePath: null as string | null,
  };
  if (specsPreview.hasSpecs) {
    const cleanup = await cleanupPhaseSpecs(phaseNumber, projectRoot);
    specsResult = {
      archived: cleanup.cleaned,
      archivePath: cleanup.archivePath,
    };
  }

  return {
    action: 'archived',
    phase: { number: phase.number, name: phase.name },
    history: { alreadyArchived: alreadyInHistory, archived: historyArchived },
    specs: {
      found: specsPreview.hasSpecs,
      fileCount: specsPreview.fileCount,
      archived: specsResult.archived,
      archivePath: specsResult.archivePath,
    },
    tasks: taskStatus,
    message: `Phase ${phaseNumber} archived`,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: PhaseArchiveOutput): string {
  const lines: string[] = [];

  if (result.action === 'skipped') {
    lines.push(`Phase ${result.phase.number} (${result.phase.name})`);
    lines.push('  Already fully archived - nothing to do');
    return lines.join('\n');
  }

  if (result.action === 'dry_run') {
    lines.push('DRY RUN - Would perform:');
    lines.push(`  Phase: ${result.phase.number} - ${result.phase.name}`);

    // Task status warning
    if (result.tasks.found && result.tasks.incomplete > 0) {
      lines.push(`  ⚠ WARNING: ${result.tasks.incomplete} incomplete tasks (${result.tasks.completed}/${result.tasks.total} done)`);
    } else if (result.tasks.found) {
      lines.push(`  Tasks: ${result.tasks.completed}/${result.tasks.total} complete`);
    }

    if (!result.history.alreadyArchived) {
      lines.push('  1. Add to HISTORY.md');
    } else {
      lines.push('  1. HISTORY.md (already archived)');
    }

    if (result.specs.found) {
      lines.push(`  2. Archive ${result.specs.fileCount} spec files to .specify/archive/`);
    } else {
      lines.push('  2. No specs to archive');
    }

    lines.push('');
    lines.push('No changes made.');
    return lines.join('\n');
  }

  lines.push(`Archiving phase ${result.phase.number}...`);

  // Task status
  if (result.tasks.found) {
    if (result.tasks.incomplete > 0) {
      lines.push(`⚠ Tasks: ${result.tasks.completed}/${result.tasks.total} complete (${result.tasks.incomplete} incomplete)`);
    } else {
      lines.push(`✓ Tasks: ${result.tasks.completed}/${result.tasks.total} complete`);
    }
  }

  if (result.history.archived) {
    lines.push('✓ Added to HISTORY.md');
  } else if (result.history.alreadyArchived) {
    lines.push('○ Already in HISTORY.md');
  }

  if (result.specs.archived) {
    lines.push(`✓ Archived ${result.specs.fileCount} spec files`);
  } else if (!result.specs.found) {
    lines.push('○ No specs to archive');
  }

  lines.push('');
  lines.push(`Phase ${result.phase.number} archived.`);

  return lines.join('\n');
}

/**
 * Phase archive action
 */
export async function archiveAction(
  phaseNumber: string,
  options: {
    json?: boolean;
    dryRun?: boolean;
    force?: boolean;
  },
): Promise<void> {
  try {
    const result = await archivePhaseByNumber(phaseNumber, {
      dryRun: options.dryRun,
      force: options.force,
    });

    if (options.json) {
      output(result);
    } else {
      output(result, formatHumanReadable(result));
    }
  } catch (err) {
    handleError(err);
  }
}
