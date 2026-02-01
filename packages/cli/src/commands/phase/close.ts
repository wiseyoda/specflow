import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../../lib/output.js';
import { readState, writeState, setStateValue } from '../../lib/state.js';
import { readRoadmap, updatePhaseStatus } from '../../lib/roadmap.js';
import { archivePhase } from '../../lib/history.js';
import {
  scanDeferredItems,
  addToBacklog,
  type DeferredSummary,
  type DeferredItem,
} from '../../lib/backlog.js';
import { findProjectRoot, getSpecsDir, pathExists } from '../../lib/paths.js';
import { handleError, NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  cleanupPhaseSpecs,
  getSpecsCleanupPreview,
  findPhaseSpecsDir,
  type SpecCleanupResult,
} from '../../lib/specs.js';
import { readTasks } from '../../lib/tasks.js';

/**
 * Phase close output
 */
export interface PhaseCloseOutput {
  action: 'closed' | 'dry_run';
  phase: {
    number: string;
    name: string;
  };
  archived: boolean;
  specsCleanup: {
    cleaned: boolean;
    filesArchived: number;
    archivePath: string | null;
    skipped: boolean;
  };
  tasks: {
    total: number;
    completed: number;
    incomplete: number;
    promotedToBacklog: number;
  };
  deferredItems: {
    count: number;
    withTarget: number;
    toBacklog: number;
  };
  memoryPrompts: string[];
  nextPhase: {
    number: string;
    name: string;
  } | null;
  message: string;
}

interface CloseOptions {
  dryRun?: boolean;
  keepSpecs?: boolean;
}

/**
 * Get incomplete tasks from a phase's tasks.md
 */
async function getIncompleteTasks(
  phaseNumber: string,
  projectRoot: string,
): Promise<{ total: number; completed: number; incomplete: DeferredItem[] }> {
  const phaseSpecsDir = await findPhaseSpecsDir(phaseNumber, projectRoot);
  if (!phaseSpecsDir) {
    return { total: 0, completed: 0, incomplete: [] };
  }

  const tasksPath = join(phaseSpecsDir, 'tasks.md');
  if (!pathExists(tasksPath)) {
    return { total: 0, completed: 0, incomplete: [] };
  }

  try {
    const tasksData = await readTasks(tasksPath);
    const incomplete: DeferredItem[] = tasksData.tasks
      .filter(t => t.status === 'todo' || t.status === 'blocked')
      .map(t => ({
        description: `[${t.id || '?'}] Verify: ${t.description.slice(0, 80)}${t.description.length > 80 ? '...' : ''}`,
        source: `Phase ${phaseNumber}`,
        reason: t.status === 'blocked' ? 'Blocked' : 'Incomplete at close',
      }));

    return {
      total: tasksData.progress.total,
      completed: tasksData.progress.completed,
      incomplete,
    };
  } catch {
    return { total: 0, completed: 0, incomplete: [] };
  }
}

/**
 * Extract memory promotion suggestions from spec.md
 * Looks for sections that might contain learnings worth promoting
 */
async function getMemoryPrompts(
  phaseNumber: string,
  projectRoot: string,
): Promise<string[]> {
  const phaseSpecsDir = await findPhaseSpecsDir(phaseNumber, projectRoot);
  if (!phaseSpecsDir) {
    return [];
  }

  const prompts: string[] = [];
  const specPath = join(phaseSpecsDir, 'spec.md');

  if (pathExists(specPath)) {
    try {
      const content = await readFile(specPath, 'utf-8');

      // Look for sections that might have memory-worthy content
      const memoryPatterns = [
        { pattern: /## (?:Key )?Decisions?\b/i, prompt: 'Review Key Decisions for architecture/patterns memory' },
        { pattern: /## (?:Technical )?Approach/i, prompt: 'Review Technical Approach for coding-standards memory' },
        { pattern: /## (?:Lessons? Learned|Retrospective)/i, prompt: 'Review Lessons Learned for memory promotion' },
        { pattern: /## (?:API|Interface) Design/i, prompt: 'Review API Design for tech-stack memory' },
        { pattern: /## (?:Testing|Test) Strategy/i, prompt: 'Review Testing Strategy for testing-strategy memory' },
      ];

      for (const { pattern, prompt } of memoryPatterns) {
        if (pattern.test(content)) {
          prompts.push(prompt);
        }
      }

      // Check for explicit memory markers
      if (content.includes('[PROMOTE]') || content.includes('[MEMORY]')) {
        prompts.push('Content marked [PROMOTE] or [MEMORY] needs review');
      }
    } catch {
      // Ignore read errors
    }
  }

  return prompts;
}

/**
 * Close the current phase
 */
async function closePhase(options: CloseOptions = {}): Promise<PhaseCloseOutput> {
  const { dryRun = false, keepSpecs = false } = options;
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
  }

  // Read current state
  const state = await readState(projectRoot);
  const phase = state.orchestration?.phase;

  if (!phase?.number || !phase?.name) {
    throw new ValidationError(
      'No active phase',
      'Use "specflow phase open" to start a phase first',
    );
  }

  if (phase.status === 'complete') {
    throw new ValidationError(
      `Phase ${phase.number} is already complete`,
      'Use "specflow phase open" to start the next phase',
    );
  }

  // Read roadmap to find next phase
  const roadmap = await readRoadmap(projectRoot);
  const nextPhase = roadmap.phases.find(
    p => p.status === 'not_started' && p.number !== phase.number,
  );

  // Scan for deferred items
  const deferred: DeferredSummary = await scanDeferredItems(
    phase.number,
    phase.name,
    projectRoot,
  );

  // Get specs cleanup preview
  const specsPreview = await getSpecsCleanupPreview(phase.number, projectRoot);

  // Get incomplete tasks
  const taskStatus = await getIncompleteTasks(phase.number, projectRoot);

  // Get memory promotion suggestions
  const memoryPrompts = await getMemoryPrompts(phase.number, projectRoot);

  if (dryRun) {
    return {
      action: 'dry_run',
      phase: {
        number: phase.number,
        name: phase.name,
      },
      archived: false,
      specsCleanup: {
        cleaned: false,
        filesArchived: specsPreview.fileCount,
        archivePath: null,
        skipped: keepSpecs,
      },
      tasks: {
        total: taskStatus.total,
        completed: taskStatus.completed,
        incomplete: taskStatus.incomplete.length,
        promotedToBacklog: taskStatus.incomplete.length,
      },
      deferredItems: {
        count: deferred.count,
        withTarget: deferred.withTarget,
        toBacklog: deferred.toBacklog,
      },
      memoryPrompts,
      nextPhase: nextPhase
        ? { number: nextPhase.number, name: nextPhase.name }
        : null,
      message: `Would close Phase ${phase.number}`,
    };
  }

  // 1. Update ROADMAP.md status
  await updatePhaseStatus(phase.number, 'complete', projectRoot);

  // 2. Archive phase to HISTORY.md
  const archiveResult = await archivePhase(
    { number: phase.number, name: phase.name, status: 'complete', hasUserGate: false, line: 0 },
    projectRoot,
  );

  // 3. Handle deferred items - add backlog items
  const backlogItems = deferred.items.filter(
    i => !i.targetPhase || i.targetPhase === 'Backlog',
  );
  if (backlogItems.length > 0) {
    await addToBacklog(backlogItems, phase.number, projectRoot);
  }

  // 3b. Promote incomplete tasks to BACKLOG
  if (taskStatus.incomplete.length > 0) {
    await addToBacklog(taskStatus.incomplete, phase.number, projectRoot);
  }

  // 4. Clean up specs directory (archive to .specify/archive/, delete from specs/)
  let specsCleanupResult: SpecCleanupResult = {
    cleaned: false,
    specsDir: null,
    archivePath: null,
    filesArchived: 0,
  };
  if (!keepSpecs) {
    specsCleanupResult = await cleanupPhaseSpecs(phase.number, projectRoot);
  }

  // 5. Add to actions.history in state file
  const historyEntry: Record<string, unknown> = {
    type: 'phase_completed',
    phase_number: phase.number,
    phase_name: phase.name,
    branch: phase.branch,
    completed_at: new Date().toISOString(),
    tasks_completed: state.orchestration?.progress?.tasks_completed ?? 0,
    tasks_total: state.orchestration?.progress?.tasks_total ?? 0,
  };

  // Get existing history or create empty array
  const existingHistory = (state.actions?.history as unknown[]) ?? [];
  const updatedHistory = [...existingHistory, historyEntry];

  // 5. Reset state for next phase
  let newState = state;
  newState = setStateValue(newState, 'actions.history', updatedHistory);
  newState = setStateValue(newState, 'orchestration.phase.number', null);
  newState = setStateValue(newState, 'orchestration.phase.name', null);
  newState = setStateValue(newState, 'orchestration.phase.branch', null);
  newState = setStateValue(newState, 'orchestration.phase.status', 'not_started');
  newState = setStateValue(newState, 'orchestration.step.current', 'design');
  newState = setStateValue(newState, 'orchestration.step.index', 0);
  newState = setStateValue(newState, 'orchestration.step.status', 'not_started');
  newState = setStateValue(newState, 'orchestration.implement', null);
  newState = setStateValue(
    newState,
    'orchestration.next_phase',
    nextPhase ? { number: nextPhase.number, name: nextPhase.name } : null,
  );

  await writeState(newState, projectRoot);

  return {
    action: 'closed',
    phase: {
      number: phase.number,
      name: phase.name,
    },
    archived: archiveResult.archived,
    specsCleanup: {
      cleaned: specsCleanupResult.cleaned,
      filesArchived: specsCleanupResult.filesArchived,
      archivePath: specsCleanupResult.archivePath,
      skipped: keepSpecs,
    },
    tasks: {
      total: taskStatus.total,
      completed: taskStatus.completed,
      incomplete: taskStatus.incomplete.length,
      promotedToBacklog: taskStatus.incomplete.length,
    },
    deferredItems: {
      count: deferred.count,
      withTarget: deferred.withTarget,
      toBacklog: deferred.toBacklog,
    },
    memoryPrompts,
    nextPhase: nextPhase
      ? { number: nextPhase.number, name: nextPhase.name }
      : null,
    message: `Phase ${phase.number} complete`,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: PhaseCloseOutput): string {
  const lines: string[] = [];

  if (result.action === 'dry_run') {
    lines.push('DRY RUN - Would perform:');
    lines.push(`  1. Update ROADMAP.md: Phase ${result.phase.number} → Complete`);
    lines.push(`  2. Archive phase to HISTORY.md`);
    lines.push(`  3. Reset orchestration state`);

    let stepNum = 4;

    // Task status
    if (result.tasks.total > 0) {
      lines.push(`  ${stepNum}. Tasks: ${result.tasks.completed}/${result.tasks.total} complete`);
      if (result.tasks.incomplete > 0) {
        lines.push(`     ⚠ ${result.tasks.incomplete} incomplete → promote to BACKLOG.md`);
      }
      stepNum++;
    }

    if (result.deferredItems.count > 0) {
      lines.push(`  ${stepNum}. Handle ${result.deferredItems.count} deferred items:`);
      if (result.deferredItems.withTarget > 0) {
        lines.push(`     - ${result.deferredItems.withTarget} targeted to future phases`);
      }
      if (result.deferredItems.toBacklog > 0) {
        lines.push(`     - ${result.deferredItems.toBacklog} added to BACKLOG.md`);
      }
      stepNum++;
    }

    if (result.specsCleanup.skipped) {
      lines.push(`  ${stepNum}. Skip specs cleanup (--keep-specs)`);
    } else if (result.specsCleanup.filesArchived > 0) {
      lines.push(
        `  ${stepNum}. Archive ${result.specsCleanup.filesArchived} spec files to .specify/archive/`,
      );
    }

    // Memory prompts
    if (result.memoryPrompts.length > 0) {
      lines.push('');
      lines.push('Memory review suggestions:');
      for (const prompt of result.memoryPrompts) {
        lines.push(`  → ${prompt}`);
      }
    }

    lines.push('');
    lines.push('No changes made.');
    return lines.join('\n');
  }

  lines.push(`Closing phase ${result.phase.number}...`);
  lines.push('✓ Updated ROADMAP.md');
  lines.push('✓ Archived to HISTORY.md');
  lines.push('✓ Reset orchestration state');

  // Task status
  if (result.tasks.total > 0) {
    if (result.tasks.incomplete > 0) {
      lines.push(`⚠ Tasks: ${result.tasks.completed}/${result.tasks.total} complete`);
      lines.push(`  → ${result.tasks.promotedToBacklog} incomplete tasks promoted to BACKLOG.md`);
    } else {
      lines.push(`✓ Tasks: ${result.tasks.completed}/${result.tasks.total} complete`);
    }
  }

  // Specs cleanup status
  if (result.specsCleanup.skipped) {
    lines.push('○ Specs kept (--keep-specs)');
  } else if (result.specsCleanup.cleaned) {
    lines.push(`✓ Archived ${result.specsCleanup.filesArchived} spec files`);
  }

  if (result.deferredItems.count > 0) {
    lines.push('');
    lines.push(`${result.deferredItems.count} deferred items found:`);
    if (result.deferredItems.withTarget > 0) {
      lines.push(`  → ${result.deferredItems.withTarget} targeted to future phases`);
    }
    if (result.deferredItems.toBacklog > 0) {
      lines.push(`  → ${result.deferredItems.toBacklog} added to BACKLOG.md`);
    }
  }

  // Memory prompts
  if (result.memoryPrompts.length > 0) {
    lines.push('');
    lines.push('Memory review needed:');
    for (const prompt of result.memoryPrompts) {
      lines.push(`  → ${prompt}`);
    }
  }

  lines.push('');
  lines.push(`Phase ${result.phase.number} complete.`);

  if (result.nextPhase) {
    lines.push(`Next: Phase ${result.nextPhase.number} (${result.nextPhase.name})`);
  }

  return lines.join('\n');
}

/**
 * Phase close action
 */
export async function closeAction(options: {
  json?: boolean;
  dryRun?: boolean;
  keepSpecs?: boolean;
}): Promise<void> {
  try {
    const result = await closePhase({
      dryRun: options.dryRun,
      keepSpecs: options.keepSpecs,
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
