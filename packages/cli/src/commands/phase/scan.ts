import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../../lib/output.js';
import { findProjectRoot, getArchiveDir, pathExists } from '../../lib/paths.js';
import { handleError, NotFoundError } from '../../lib/errors.js';
import { readTasks, type Task } from '../../lib/tasks.js';

/**
 * Incomplete task from archive scan
 */
export interface IncompleteTask {
  phaseNumber: string;
  phaseName: string;
  taskId: string;
  description: string;
  status: string;
}

/**
 * Phase scan result
 */
export interface PhaseScanResult {
  phaseNumber: string;
  phaseName: string;
  tasksFound: boolean;
  total: number;
  completed: number;
  incomplete: number;
  incompleteTasks: IncompleteTask[];
}

/**
 * Archive scan output
 */
export interface ArchiveScanOutput {
  scannedPhases: number;
  phasesWithIncomplete: number;
  totalIncomplete: number;
  phases: PhaseScanResult[];
  backlogSuggestions: string[];
}

/**
 * Scan archived phases for incomplete tasks
 */
async function scanArchives(projectRoot: string): Promise<ArchiveScanOutput> {
  const archiveDir = getArchiveDir(projectRoot);

  if (!pathExists(archiveDir)) {
    throw new NotFoundError('Archive directory', 'No archived phases found');
  }

  const entries = await readdir(archiveDir, { withFileTypes: true });
  const phaseDirs = entries
    .filter(e => e.isDirectory() && /^\d{4}-/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const results: PhaseScanResult[] = [];
  const backlogSuggestions: string[] = [];

  for (const dir of phaseDirs) {
    const phaseNumber = dir.name.slice(0, 4);
    const phaseName = dir.name.slice(5);
    const tasksPath = join(archiveDir, dir.name, 'tasks.md');

    if (!pathExists(tasksPath)) {
      results.push({
        phaseNumber,
        phaseName,
        tasksFound: false,
        total: 0,
        completed: 0,
        incomplete: 0,
        incompleteTasks: [],
      });
      continue;
    }

    try {
      const tasksData = await readTasks(tasksPath);
      const incompleteTasks: IncompleteTask[] = tasksData.tasks
        .filter(t => t.status === 'todo' || t.status === 'blocked')
        .map(t => ({
          phaseNumber,
          phaseName,
          taskId: t.id,
          description: t.description,
          status: t.status,
        }));

      // Generate backlog suggestions for incomplete tasks
      for (const task of incompleteTasks) {
        if (task.taskId) {
          backlogSuggestions.push(
            `[${task.phaseNumber}-${task.taskId}] Verify completion: ${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}`,
          );
        }
      }

      results.push({
        phaseNumber,
        phaseName,
        tasksFound: true,
        total: tasksData.progress.total,
        completed: tasksData.progress.completed,
        incomplete: incompleteTasks.length,
        incompleteTasks,
      });
    } catch {
      results.push({
        phaseNumber,
        phaseName,
        tasksFound: false,
        total: 0,
        completed: 0,
        incomplete: 0,
        incompleteTasks: [],
      });
    }
  }

  const phasesWithIncomplete = results.filter(r => r.incomplete > 0).length;
  const totalIncomplete = results.reduce((sum, r) => sum + r.incomplete, 0);

  return {
    scannedPhases: results.length,
    phasesWithIncomplete,
    totalIncomplete,
    phases: results,
    backlogSuggestions,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: ArchiveScanOutput, verbose: boolean): string {
  const lines: string[] = [];

  lines.push(`Scanned ${result.scannedPhases} archived phases`);
  lines.push(`Phases with incomplete tasks: ${result.phasesWithIncomplete}`);
  lines.push(`Total incomplete tasks: ${result.totalIncomplete}`);
  lines.push('');

  if (result.phasesWithIncomplete === 0) {
    lines.push('All archived phases have complete tasks.');
    return lines.join('\n');
  }

  lines.push('Phases with incomplete tasks:');
  for (const phase of result.phases) {
    if (phase.incomplete === 0) continue;

    lines.push(`  ${phase.phaseNumber} - ${phase.phaseName}: ${phase.incomplete} incomplete (${phase.completed}/${phase.total})`);

    if (verbose) {
      for (const task of phase.incompleteTasks.slice(0, 5)) {
        const desc = task.description.slice(0, 50) + (task.description.length > 50 ? '...' : '');
        lines.push(`    - [${task.taskId || '?'}] ${desc}`);
      }
      if (phase.incompleteTasks.length > 5) {
        lines.push(`    ... and ${phase.incompleteTasks.length - 5} more`);
      }
    }
  }

  if (result.backlogSuggestions.length > 0 && !verbose) {
    lines.push('');
    lines.push(`Use --verbose to see task details, or --suggest-backlog to generate BACKLOG entries`);
  }

  return lines.join('\n');
}

/**
 * Format backlog suggestions
 */
function formatBacklogSuggestions(result: ArchiveScanOutput): string {
  const lines: string[] = [];

  lines.push('# Suggested BACKLOG.md Entries');
  lines.push('');
  lines.push('Review these and add relevant items to BACKLOG.md:');
  lines.push('');
  lines.push('| Item | Source | Reason Deferred | Notes |');
  lines.push('|------|--------|-----------------|-------|');

  for (const suggestion of result.backlogSuggestions.slice(0, 50)) {
    const escaped = suggestion.replace(/\|/g, '\\|');
    lines.push(`| ${escaped} | Archive scan | Verify completion | Review if still needed |`);
  }

  if (result.backlogSuggestions.length > 50) {
    lines.push('');
    lines.push(`... and ${result.backlogSuggestions.length - 50} more (use --json for full list)`);
  }

  return lines.join('\n');
}

/**
 * Phase scan action
 */
export async function scanAction(options: {
  json?: boolean;
  verbose?: boolean;
  suggestBacklog?: boolean;
}): Promise<void> {
  try {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
    }

    const result = await scanArchives(projectRoot);

    if (options.json) {
      output(result);
    } else if (options.suggestBacklog) {
      console.log(formatBacklogSuggestions(result));
    } else {
      output(result, formatHumanReadable(result, options.verbose || false));
    }
  } catch (err) {
    handleError(err);
  }
}
