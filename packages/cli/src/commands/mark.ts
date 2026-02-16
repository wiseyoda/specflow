import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { output } from '../lib/output.js';
import { readTasks, findNextTask, getTaskById, type TasksData } from '../lib/tasks.js';
import { recordEvidence } from '../lib/evidence.js';
import { resolveFeatureDir } from '../lib/context.js';
import { findProjectRoot } from '../lib/paths.js';
import { handleError, NotFoundError, ValidationError, ParseError } from '../lib/errors.js';

/**
 * Mark result output
 */
export interface MarkOutput {
  marked: string[];
  newStatus: 'complete' | 'incomplete' | 'blocked';
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  sectionStatus?: {
    name: string;
    completed: number;
    total: number;
    isComplete: boolean;
  };
  next?: {
    id: string;
    description: string;
    dependenciesMet?: boolean;
  };
  stepComplete: boolean;
  nextAction?: string;
  message?: string;
  evidence?: {
    recorded: boolean;
    itemCount: number;
    text: string;
  };
}

/**
 * Task ID pattern: T001, T001a
 */
const TASK_ID_PATTERN = /^T\d{3}[a-z]?$/;

/**
 * Legacy checklist ID pattern (V-001, I-001, etc.) for helpful error messages
 */
const LEGACY_CHECKLIST_ID_PATTERN = /^[VICD]-[A-Z0-9]+$/i;

/**
 * Determine if ID is a task
 */
function isTaskId(id: string): boolean {
  return TASK_ID_PATTERN.test(id);
}

/**
 * Determine if ID looks like a legacy checklist ID
 */
function isLegacyChecklistId(id: string): boolean {
  return LEGACY_CHECKLIST_ID_PATTERN.test(id);
}

/**
 * Parse task ID range (T001..T005) into array
 */
function parseTaskRange(range: string): string[] {
  const match = range.match(/^(T\d{3}[a-z]?)\.\.(T\d{3}[a-z]?)$/);
  if (!match) return [];

  const start = match[1];
  const end = match[2];

  const startNum = parseInt(start.slice(1, 4), 10);
  const endNum = parseInt(end.slice(1, 4), 10);

  if (startNum > endNum) return [];

  const result: string[] = [];
  for (let i = startNum; i <= endNum; i++) {
    result.push(`T${String(i).padStart(3, '0')}`);
  }
  return result;
}

/**
 * Parse task IDs from arguments
 */
function parseTaskIds(args: string[]): { taskIds: string[]; legacyIds: string[] } {
  const taskIds: string[] = [];
  const legacyIds: string[] = [];

  for (const arg of args) {
    if (arg.includes('..')) {
      taskIds.push(...parseTaskRange(arg));
    } else if (isTaskId(arg)) {
      taskIds.push(arg);
    } else if (isLegacyChecklistId(arg)) {
      legacyIds.push(arg);
    }
  }

  return {
    taskIds: [...new Set(taskIds)],
    legacyIds: [...new Set(legacyIds)],
  };
}

/**
 * Update task checkbox in file content
 */
function updateTaskCheckbox(
  content: string,
  taskId: string,
  status: 'complete' | 'incomplete' | 'blocked',
  blockedReason?: string,
): string {
  const lines = content.split('\n');
  const updated: string[] = [];

  for (const line of lines) {
    // Check if this line contains the task ID
    if (line.includes(taskId)) {
      let updatedLine = line;

      // First, normalize to incomplete state
      updatedLine = updatedLine.replace(/- \[[xXbB]\]/i, '- [ ]');
      // Remove any existing blocked reason
      updatedLine = updatedLine.replace(/\s*[\[(]blocked:\s*[^\])]+[\])]/i, '');

      if (status === 'complete') {
        // Mark as complete: [ ] -> [x]
        updatedLine = updatedLine.replace(/- \[ \]/, '- [x]');
      } else if (status === 'blocked') {
        // Mark as blocked: [ ] -> [b] and append reason
        updatedLine = updatedLine.replace(/- \[ \]/, '- [b]');
        if (blockedReason) {
          updatedLine = `${updatedLine} (blocked: ${blockedReason})`;
        }
      }
      // status === 'incomplete' is already handled by normalization

      updated.push(updatedLine);
    } else {
      updated.push(line);
    }
  }

  return updated.join('\n');
}

/**
 * Mark tasks complete or incomplete
 */
async function markTasks(
  taskIds: string[],
  options: { incomplete?: boolean; blocked?: string; evidence?: string },
): Promise<MarkOutput> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
  }

  const featureDir = await resolveFeatureDir(undefined, projectRoot);
  if (!featureDir) {
    throw new NotFoundError('Feature', 'No active feature found');
  }

  // Read current tasks
  const tasksData = await readTasks(featureDir);

  // Validate all task IDs exist
  const invalidIds: string[] = [];
  for (const taskId of taskIds) {
    if (!getTaskById(tasksData, taskId)) {
      invalidIds.push(taskId);
    }
  }

  if (invalidIds.length > 0) {
    throw new ValidationError(
      `Unknown task IDs: ${invalidIds.join(', ')}`,
      `Valid task IDs are: ${tasksData.tasks.map(t => t.id).join(', ')}`,
    );
  }

  // Read file content
  let content: string;
  try {
    content = await readFile(tasksData.filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new ParseError('tasks.md', `Failed to read: ${message}`);
  }

  // Determine target status
  let targetStatus: 'complete' | 'incomplete' | 'blocked';
  if (options.blocked) {
    targetStatus = 'blocked';
  } else if (options.incomplete) {
    targetStatus = 'incomplete';
  } else {
    targetStatus = 'complete';
  }

  // Update each task
  for (const taskId of taskIds) {
    content = updateTaskCheckbox(content, taskId, targetStatus, options.blocked);
  }

  // Write updated content
  try {
    await writeFile(tasksData.filePath, content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new ParseError('tasks.md', `Failed to write: ${message}`);
  }

  // Re-read tasks to get updated state
  const updatedTasks = await readTasks(featureDir);

  // Find next task
  const nextTask = findNextTask(updatedTasks);

  // Get section status for first marked task
  let sectionStatus: MarkOutput['sectionStatus'];
  const firstTask = getTaskById(updatedTasks, taskIds[0]);
  if (firstTask?.section) {
    const sectionTasks = updatedTasks.tasks.filter(t => t.section === firstTask.section);
    const sectionCompleted = sectionTasks.filter(t => t.status === 'done').length;
    sectionStatus = {
      name: firstTask.section,
      completed: sectionCompleted,
      total: sectionTasks.length,
      isComplete: sectionCompleted === sectionTasks.length,
    };
  }

  // Check if all tasks complete
  const allComplete = updatedTasks.progress.completed === updatedTasks.progress.total;

  const result: MarkOutput = {
    marked: taskIds,
    newStatus: targetStatus,
    progress: {
      completed: updatedTasks.progress.completed,
      total: updatedTasks.progress.total,
      percentage: updatedTasks.progress.percentage,
    },
    sectionStatus,
    stepComplete: allComplete,
  };

  if (nextTask) {
    const depsMet = !nextTask.dependencies || nextTask.dependencies.length === 0 ||
      nextTask.dependencies.every(depId => {
        const dep = updatedTasks.tasks.find(t => t.id === depId);
        return dep?.status === 'done';
      });

    result.next = {
      id: nextTask.id,
      description: nextTask.description,
      dependenciesMet: depsMet,
    };
  }

  // Record evidence if provided (optional, works for any task including [V] tasks)
  if (options.evidence && targetStatus === 'complete') {
    await recordEvidence(featureDir, taskIds, options.evidence);
    result.evidence = {
      recorded: true,
      itemCount: taskIds.length,
      text: options.evidence,
    };
  }

  if (allComplete) {
    result.nextAction = 'run_verify';
    result.message = 'All tasks complete! Ready for verification.';
  }

  return result;
}


/**
 * Format human-readable mark output
 */
function formatHumanReadable(result: MarkOutput): string {
  const lines = [
    `Marked ${result.marked.join(', ')} as ${result.newStatus}`,
    `Progress: ${result.progress.completed}/${result.progress.total} tasks (${result.progress.percentage}%)`,
  ];

  if (result.sectionStatus?.isComplete) {
    lines.push(`Section "${result.sectionStatus.name}" complete!`);
  }

  if (result.evidence?.recorded) {
    lines.push(`Evidence recorded for ${result.evidence.itemCount} item(s)`);
  }

  if (result.next) {
    lines.push(`Next: ${result.next.id} ${result.next.description}`);
  }

  if (result.message) {
    lines.push(result.message);
  }

  return lines.join('\n');
}

/**
 * Mark command
 */
export const markCommand = new Command('mark')
  .description('Mark task(s) complete')
  .argument('<items...>', 'Task ID(s) to mark (T001, T001..T005)')
  .option('--json', 'Output as JSON')
  .option('--incomplete', 'Mark as incomplete instead of complete')
  .option('--blocked <reason>', 'Mark as blocked with reason')
  .option('--evidence <text>', 'Evidence of what was verified (optional, for [V] tasks)')
  .action(async (items: string[], options) => {
    try {
      const parsed = parseTaskIds(items);

      // Check for legacy checklist IDs and show helpful error
      if (parsed.legacyIds.length > 0) {
        throw new ValidationError(
          `Checklist IDs (${parsed.legacyIds.join(', ')}) are no longer supported`,
          'Use task IDs (T###) with [V] marker instead. See tasks.md for verification tasks.',
        );
      }

      if (parsed.taskIds.length === 0) {
        throw new ValidationError(
          'No valid task IDs provided',
          'Use format: T001, T001..T005',
        );
      }

      const result = await markTasks(parsed.taskIds, options);

      if (options.json) {
        output(result);
      } else {
        output(result, formatHumanReadable(result));
      }
    } catch (err) {
      handleError(err);
    }
  });
