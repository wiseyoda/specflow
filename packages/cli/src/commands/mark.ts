import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { output } from '../lib/output.js';
import { readTasks, findNextTask, getTaskById, type TasksData } from '../lib/tasks.js';
import {
  readFeatureChecklists,
  getChecklistItemById,
  findNextChecklistItem,
  areAllChecklistsComplete,
  type ChecklistData,
  type FeatureChecklists,
} from '../lib/checklist.js';
import { resolveFeatureDir } from '../lib/context.js';
import { findProjectRoot } from '../lib/paths.js';
import { handleError, NotFoundError, ValidationError, ParseError } from '../lib/errors.js';

/**
 * Item type discriminator
 */
export type ItemType = 'task' | 'checklist';

/**
 * Mark result output
 */
export interface MarkOutput {
  marked: string[];
  itemType: ItemType;
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
}

/**
 * Checklist item ID pattern: V-001, I-001, C-001, D-001, V-UI1, etc.
 * Supports standard (V-001) and custom prefixes (V-UI1, I-SEC2)
 */
const CHECKLIST_ID_PATTERN = /^[VICD]-[A-Z0-9]+$/i;

/**
 * Task ID pattern: T001, T001a
 */
const TASK_ID_PATTERN = /^T\d{3}[a-z]?$/;

/**
 * Determine if ID is a checklist item
 */
function isChecklistId(id: string): boolean {
  return CHECKLIST_ID_PATTERN.test(id);
}

/**
 * Determine if ID is a task
 */
function isTaskId(id: string): boolean {
  return TASK_ID_PATTERN.test(id);
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
 * Parsed IDs with type information
 */
interface ParsedIds {
  taskIds: string[];
  checklistIds: string[];
}

/**
 * Parse IDs from arguments, separating tasks from checklist items
 */
function parseIds(args: string[]): ParsedIds {
  const taskIds: string[] = [];
  const checklistIds: string[] = [];

  for (const arg of args) {
    if (arg.includes('..')) {
      // Range: T001..T005 (only for tasks)
      taskIds.push(...parseTaskRange(arg));
    } else if (isTaskId(arg)) {
      // Single task: T001
      taskIds.push(arg);
    } else if (isChecklistId(arg)) {
      // Checklist item: V-001, I-001, C-001, D-001
      checklistIds.push(arg);
    }
  }

  return {
    taskIds: [...new Set(taskIds)],
    checklistIds: [...new Set(checklistIds)],
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
  options: { incomplete?: boolean; blocked?: string },
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
    itemType: 'task',
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

  if (allComplete) {
    result.nextAction = 'run_verify';
    result.message = 'All tasks complete! Ready for verification.';
  }

  return result;
}

/**
 * Find checklist item across all checklists
 */
function findChecklistItem(
  checklists: FeatureChecklists,
  itemId: string,
): { checklist: ChecklistData; item: ReturnType<typeof getChecklistItemById> } | null {
  const allChecklists = [
    checklists.verification,
    checklists.implementation,
    checklists.deferred,
    ...checklists.other,
  ].filter(Boolean) as ChecklistData[];

  for (const checklist of allChecklists) {
    const item = getChecklistItemById(checklist, itemId);
    if (item) {
      return { checklist, item };
    }
  }
  return null;
}

/**
 * Mark checklist items complete or incomplete
 */
async function markChecklistItems(
  itemIds: string[],
  options: { incomplete?: boolean },
): Promise<MarkOutput> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
  }

  const featureDir = await resolveFeatureDir(undefined, projectRoot);
  if (!featureDir) {
    throw new NotFoundError('Feature', 'No active feature found');
  }

  // Read all checklists
  const checklists = await readFeatureChecklists(featureDir);

  // Validate all item IDs exist and group by file
  const invalidIds: string[] = [];
  const fileUpdates = new Map<string, { content: string; ids: string[] }>();

  for (const itemId of itemIds) {
    const found = findChecklistItem(checklists, itemId);
    if (!found) {
      invalidIds.push(itemId);
    } else {
      if (!fileUpdates.has(found.checklist.filePath)) {
        let content: string;
        try {
          content = await readFile(found.checklist.filePath, 'utf-8');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          throw new ParseError('checklist', `Failed to read ${found.checklist.filePath}: ${message}`);
        }
        fileUpdates.set(found.checklist.filePath, { content, ids: [] });
      }
      fileUpdates.get(found.checklist.filePath)!.ids.push(itemId);
    }
  }

  if (invalidIds.length > 0) {
    throw new ValidationError(
      `Unknown checklist item IDs: ${invalidIds.join(', ')}`,
      'Valid IDs are in format: V-001, I-001, C-001, D-001, V-UI1, etc.',
    );
  }

  // Update each file
  const checklistStatus: 'complete' | 'incomplete' = options.incomplete ? 'incomplete' : 'complete';
  for (const [filePath, { content, ids }] of fileUpdates) {
    let updatedContent = content;
    for (const itemId of ids) {
      updatedContent = updateTaskCheckbox(updatedContent, itemId, checklistStatus);
    }
    try {
      await writeFile(filePath, updatedContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ParseError('checklist', `Failed to write ${filePath}: ${message}`);
    }
  }

  // Re-read checklists to get updated state
  const updatedChecklists = await readFeatureChecklists(featureDir);
  const allComplete = areAllChecklistsComplete(updatedChecklists);

  // Calculate total progress across all checklists
  const allChecklistsList = [
    updatedChecklists.verification,
    updatedChecklists.implementation,
    ...updatedChecklists.other,
  ].filter(Boolean) as ChecklistData[];

  const totalItems = allChecklistsList.reduce((sum, c) => sum + c.progress.total, 0);
  const completedItems = allChecklistsList.reduce((sum, c) => sum + c.progress.completed, 0);

  // Get section status for first marked item
  let sectionStatus: MarkOutput['sectionStatus'];
  const firstFound = findChecklistItem(updatedChecklists, itemIds[0]);
  if (firstFound?.item?.section) {
    const sectionItems = firstFound.checklist.items.filter(i => i.section === firstFound.item!.section);
    const sectionCompleted = sectionItems.filter(i => i.status === 'done').length;
    sectionStatus = {
      name: firstFound.item.section,
      completed: sectionCompleted,
      total: sectionItems.length,
      isComplete: sectionCompleted === sectionItems.length,
    };
  }

  // Find next incomplete item
  let next: MarkOutput['next'];
  for (const checklist of allChecklistsList) {
    const nextItem = findNextChecklistItem(checklist);
    if (nextItem) {
      next = {
        id: nextItem.id,
        description: nextItem.description,
      };
      break;
    }
  }

  const result: MarkOutput = {
    marked: itemIds,
    itemType: 'checklist',
    newStatus: checklistStatus,
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    },
    sectionStatus,
    next,
    stepComplete: allComplete,
  };

  if (allComplete) {
    result.nextAction = 'ready_to_close';
    result.message = 'All checklists complete! Ready to close phase.';
  }

  return result;
}

/**
 * Format human-readable mark output
 */
function formatHumanReadable(result: MarkOutput): string {
  const typeLabel = result.itemType === 'task' ? 'tasks' : 'checklist items';
  const lines = [
    `Marked ${result.marked.join(', ')} as ${result.newStatus}`,
    `Progress: ${result.progress.completed}/${result.progress.total} ${typeLabel} (${result.progress.percentage}%)`,
  ];

  if (result.sectionStatus?.isComplete) {
    lines.push(`Section "${result.sectionStatus.name}" complete!`);
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
  .description('Mark task(s) or checklist item(s) complete')
  .argument('<items...>', 'Item ID(s) to mark (T001, T001..T005, V-001, V-UI1)')
  .option('--json', 'Output as JSON')
  .option('--incomplete', 'Mark as incomplete instead of complete')
  .option('--blocked <reason>', 'Mark as blocked with reason')
  .action(async (items: string[], options) => {
    try {
      const parsed = parseIds(items);

      // Validate we have some IDs
      if (parsed.taskIds.length === 0 && parsed.checklistIds.length === 0) {
        throw new ValidationError(
          'No valid item IDs provided',
          'Use format: T001, T001..T005, V-001, I-001, V-UI1, etc.',
        );
      }

      // Cannot mix task and checklist IDs
      if (parsed.taskIds.length > 0 && parsed.checklistIds.length > 0) {
        throw new ValidationError(
          'Cannot mix task and checklist IDs in one command',
          'Mark tasks and checklist items separately',
        );
      }

      // Route to appropriate handler
      let result: MarkOutput;
      if (parsed.taskIds.length > 0) {
        result = await markTasks(parsed.taskIds, options);
      } else {
        result = await markChecklistItems(parsed.checklistIds, options);
      }

      if (options.json) {
        output(result);
      } else {
        output(result, formatHumanReadable(result));
      }
    } catch (err) {
      handleError(err);
    }
  });
