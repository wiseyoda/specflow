import { Command } from 'commander';
import { output } from '../lib/output.js';
import { readState } from '../lib/state.js';
import { readTasks, findNextTask, type Task, type TasksData } from '../lib/tasks.js';
import { resolveFeatureDir, getProjectContext } from '../lib/context.js';
import { findProjectRoot } from '../lib/paths.js';
import { handleError, NotFoundError } from '../lib/errors.js';

/**
 * Type of action to take
 */
export type NextActionType =
  | 'implement_task'
  | 'verify_task'
  | 'none';

/**
 * Next task output
 */
export interface NextTaskOutput {
  action: 'implement_task';
  task: {
    id: string;
    description: string;
    section?: string;
    phase?: string;
    userStory?: string;
    line: number;
    file: string;
  };
  dependencies: {
    met: boolean;
    requires: string[];
    blockedBy: string[];
  };
  hints: {
    filesMentioned: string[];
    relatedSpecSection?: string;
  };
  queue: {
    remainingInSection: number;
    totalRemaining: number;
    nextUp: string[];
  };
}

/**
 * Next verification task output
 */
export interface NextVerifyOutput {
  action: 'verify_task';
  task: {
    id: string;
    description: string;
    section?: string;
    line: number;
    file: string;
  };
  queue: {
    remaining: number;
    nextUp: string[];
  };
}

/**
 * Nothing to do output
 */
export interface NextNoneOutput {
  action: 'none';
  reason: string;
  suggestion: string;
}

export type NextOutput = NextTaskOutput | NextVerifyOutput | NextNoneOutput;

/** Maximum description length to process for file extraction (prevent regex DoS) */
const MAX_DESCRIPTION_LENGTH = 4096;

/**
 * Extract file paths mentioned in task description.
 * Enforces length limit to prevent regex backtracking on very long strings.
 */
function extractFilesMentioned(description: string): string[] {
  // Truncate very long descriptions to prevent regex DoS
  const safeDescription = description.length > MAX_DESCRIPTION_LENGTH
    ? description.slice(0, MAX_DESCRIPTION_LENGTH)
    : description;

  const files: string[] = [];

  // Match common file patterns
  // src/... paths
  const srcMatch = safeDescription.match(/\bsrc\/[\w\-./]+\.\w+/g);
  if (srcMatch) files.push(...srcMatch);

  // tests/... paths
  const testMatch = safeDescription.match(/\btests?\/[\w\-./]+\.\w+/g);
  if (testMatch) files.push(...testMatch);

  // lib/... paths
  const libMatch = safeDescription.match(/\blib\/[\w\-./]+\.\w+/g);
  if (libMatch) files.push(...libMatch);

  // Any path with file extension
  const genericMatch = safeDescription.match(/\b[\w\-./]+\.(ts|js|md|json|tsx|jsx)\b/g);
  if (genericMatch) {
    for (const match of genericMatch) {
      if (!files.includes(match) && match.includes('/')) {
        files.push(match);
      }
    }
  }

  return [...new Set(files)];
}

/**
 * Get next task to work on
 */
async function getNextTask(featureDir: string): Promise<NextTaskOutput | NextNoneOutput> {
  const tasksData = await readTasks(featureDir);
  const nextTask = findNextTask(tasksData);

  if (!nextTask) {
    // Check if no tasks were parsed at all (likely format issue)
    if (tasksData.tasks.length === 0) {
      return {
        action: 'none',
        reason: 'no_tasks_found',
        suggestion: "No tasks found in tasks.md. Expected format: '- [ ] T001 Description'. " +
          "Task ID must be inline with checkbox, not as a header. See tasks-template.md for examples.",
      };
    }

    const allComplete = tasksData.tasks.every(t => t.status === 'done');
    if (allComplete) {
      return {
        action: 'none',
        reason: 'all_tasks_complete',
        suggestion: "Run 'specflow check' to verify completion, then proceed to verification step",
      };
    }

    // Some tasks exist but all remaining are blocked
    return {
      action: 'none',
      reason: 'all_tasks_blocked',
      suggestion: 'Remaining tasks have unmet dependencies. Review blocked tasks.',
    };
  }

  // Get dependencies info
  const depsMet = !nextTask.dependencies || nextTask.dependencies.length === 0 ||
    nextTask.dependencies.every(depId => {
      const dep = tasksData.tasks.find(t => t.id === depId);
      return dep?.status === 'done';
    });

  const blockedBy = nextTask.dependencies?.filter(depId => {
    const dep = tasksData.tasks.find(t => t.id === depId);
    return dep?.status !== 'done';
  }) ?? [];

  // Calculate queue info
  const currentSection = nextTask.section;
  const remainingInSection = currentSection
    ? tasksData.tasks.filter(t => t.section === currentSection && t.status !== 'done').length
    : 0;
  const totalRemaining = tasksData.tasks.filter(t => t.status !== 'done').length;

  // Get next few tasks in queue
  const nextUp: string[] = [];
  let foundCurrent = false;
  for (const section of tasksData.sections) {
    for (const task of section.tasks) {
      if (task.id === nextTask.id) {
        foundCurrent = true;
        continue;
      }
      if (foundCurrent && task.status === 'todo' && nextUp.length < 3) {
        nextUp.push(task.id);
      }
    }
  }

  return {
    action: 'implement_task',
    task: {
      id: nextTask.id,
      description: nextTask.description,
      section: nextTask.section,
      phase: nextTask.phase,
      userStory: nextTask.userStory,
      line: nextTask.line,
      file: tasksData.filePath,
    },
    dependencies: {
      met: depsMet,
      requires: nextTask.dependencies ?? [],
      blockedBy,
    },
    hints: {
      filesMentioned: extractFilesMentioned(nextTask.description),
    },
    queue: {
      remainingInSection,
      totalRemaining,
      nextUp,
    },
  };
}

/**
 * Get next verification task ([V] marker)
 */
async function getNextVerifyItem(featureDir: string): Promise<NextVerifyOutput | NextNoneOutput> {
  const tasksData = await readTasks(featureDir);
  const vTasks = tasksData.tasks.filter(t => t.isVerification);
  const todoVTasks = vTasks.filter(t => t.status === 'todo');

  if (todoVTasks.length > 0) {
    const nextTask = todoVTasks[0];
    const remaining = todoVTasks.length;
    const nextUp = todoVTasks
      .slice(1, 4)
      .map(t => t.id);

    return {
      action: 'verify_task',
      task: {
        id: nextTask.id,
        description: nextTask.description,
        section: nextTask.section,
        line: nextTask.line,
        file: tasksData.filePath,
      },
      queue: {
        remaining,
        nextUp,
      },
    };
  }

  return {
    action: 'none',
    reason: 'verification_complete',
    suggestion: "All verification tasks complete. Ready for '/flow.merge'.",
  };
}

/**
 * Get next item based on current step
 */
async function getNext(type: 'task' | 'verify'): Promise<NextOutput> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    return {
      action: 'none',
      reason: 'no_project',
      suggestion: 'Not in a SpecFlow project directory',
    };
  }

  const featureDir = await resolveFeatureDir(undefined, projectRoot);
  if (!featureDir) {
    return {
      action: 'none',
      reason: 'no_feature',
      suggestion: 'No active feature found. Start a phase first.',
    };
  }

  if (type === 'verify') {
    return getNextVerifyItem(featureDir);
  }

  return getNextTask(featureDir);
}

/**
 * Format human-readable next output
 */
function formatHumanReadable(next: NextOutput): string {
  if (next.action === 'none') {
    return `${next.reason}: ${next.suggestion}`;
  }

  if (next.action === 'implement_task') {
    const lines = [
      `Next: ${next.task.id} ${next.task.description}`,
      `Section: ${next.task.section ?? 'Unknown'} | Remaining: ${next.queue.totalRemaining}`,
    ];
    if (next.hints.filesMentioned.length > 0) {
      lines.push(`Files: ${next.hints.filesMentioned.join(', ')}`);
    }
    return lines.join('\n');
  }

  if (next.action === 'verify_task') {
    return [
      `Next: ${next.task.id} ${next.task.description}`,
      `Type: verification | Remaining: ${next.queue.remaining}`,
    ].join('\n');
  }

  return 'Unknown action';
}

/**
 * Next command
 */
export const nextCommand = new Command('next')
  .description('Get next actionable item with full context')
  .option('--json', 'Output as JSON')
  .option('--type <type>', 'Item type: task (default) or verify', 'task')
  .action(async (options) => {
    try {
      const type = options.type === 'verify' ? 'verify' : 'task';
      const next = await getNext(type);

      if (options.json) {
        output(next);
      } else {
        output(next, formatHumanReadable(next));
      }
    } catch (err) {
      handleError(err);
    }
  });
