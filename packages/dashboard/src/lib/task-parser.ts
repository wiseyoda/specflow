import type { Task, TaskStatus, TasksData } from '@speckit/shared';

/**
 * Options for parsing tasks
 */
export interface ParseTasksOptions {
  /** Task IDs currently being worked on (from state.orchestration.implement.current_tasks) */
  currentTasks?: string[];
}

/**
 * Parse tasks from a tasks.md file content
 * @param content The markdown content of tasks.md
 * @param projectId The project UUID
 * @param options Optional parsing options including current in-progress tasks from state
 */
export function parseTasks(
  content: string,
  projectId: string,
  options?: ParseTasksOptions
): TasksData {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  const seenIds = new Set<string>();
  let currentPhase: string | undefined;

  // Build a Set for O(1) lookup of in-progress tasks
  const inProgressTasks = new Set(options?.currentTasks ?? []);

  for (const line of lines) {
    // Check for phase header: ## Phase N: Name or ## Phase: Name
    const phaseMatch = line.match(/^##\s+(?:Phase\s*\d*:?\s*)?(.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // Check for task line: - [ ] T### or - [x] T### (with optional bold **T###**)
    const taskMatch = line.match(/^-\s+\[([ xX])\]\s+\*{0,2}(T\d+)\*{0,2}\s*(.*)$/);
    if (taskMatch) {
      const [, checkbox, id, rest] = taskMatch;

      // Skip duplicate task IDs (e.g., from Quick Status summary section)
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);

      const status = parseTaskStatus(checkbox, id, inProgressTasks);
      const { description, userStory, isParallel, filePath } = parseTaskDescription(rest);

      tasks.push({
        id,
        description,
        status,
        phase: currentPhase,
        userStory,
        isParallel,
        filePath,
      });
    }
  }

  const completedCount = tasks.filter((t) => t.status === 'done').length;

  return {
    projectId,
    tasks,
    totalCount: tasks.length,
    completedCount,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Parse checkbox state to TaskStatus
 * @param checkbox The checkbox character (space or x)
 * @param taskId The task ID
 * @param inProgressTasks Set of task IDs currently being worked on
 */
function parseTaskStatus(
  checkbox: string,
  taskId: string,
  inProgressTasks: Set<string>
): TaskStatus {
  // If checkbox is checked, it's done
  if (checkbox.toLowerCase() === 'x') {
    return 'done';
  }
  // If task is in the current_tasks array from state, it's in_progress
  if (inProgressTasks.has(taskId)) {
    return 'in_progress';
  }
  // Otherwise it's todo
  return 'todo';
}

/**
 * Parse task description for markers and metadata
 */
function parseTaskDescription(rest: string): {
  description: string;
  userStory?: string;
  isParallel?: boolean;
  filePath?: string;
} {
  let description = rest.trim();
  let userStory: string | undefined;
  let isParallel = false;
  let filePath: string | undefined;

  // Check for [P] parallel marker
  if (description.includes('[P]')) {
    isParallel = true;
    description = description.replace(/\[P\]\s*/g, '');
  }

  // Check for [US#] user story marker
  const usMatch = description.match(/\[US(\d+)\]/);
  if (usMatch) {
    userStory = `US${usMatch[1]}`;
    description = description.replace(/\[US\d+\]\s*/g, '');
  }

  // Extract file path from backticks or path-like segments
  const backtickMatch = description.match(/`([^`]+)`/);
  if (backtickMatch) {
    const potentialPath = backtickMatch[1];
    if (potentialPath.includes('/') || potentialPath.includes('.')) {
      filePath = potentialPath;
    }
  }

  return {
    description: description.trim(),
    userStory,
    isParallel,
    filePath,
  };
}

/**
 * Group tasks by status for Kanban display
 */
export function groupTasksByStatus(tasks: Task[]): {
  todo: Task[];
  in_progress: Task[];
  done: Task[];
} {
  return {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  };
}
