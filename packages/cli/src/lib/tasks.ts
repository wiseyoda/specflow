import { readFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { pathExists, getSpecsDir, findProjectRoot } from './paths.js';
import { NotFoundError } from './errors.js';

/**
 * Task status based on checkbox state
 */
export type TaskStatus = 'todo' | 'done' | 'blocked' | 'deferred';

/**
 * Parsed task from tasks.md
 */
export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  phase?: string;
  section?: string;
  userStory?: string;
  isParallel?: boolean;
  isVerification?: boolean;
  dependencies?: string[];
  blockedReason?: string;
  line: number;
}

/**
 * Section in tasks.md (e.g., "Phase 1: Setup")
 */
export interface TaskSection {
  name: string;
  phase?: string;
  purpose?: string;
  isComplete: boolean;
  tasks: Task[];
  startLine: number;
  endLine: number;
}

/**
 * Complete parsed tasks data
 */
export interface TasksData {
  featureDir: string;
  filePath: string;
  title?: string;
  sections: TaskSection[];
  tasks: Task[];
  progress: {
    total: number;
    completed: number;
    blocked: number;
    deferred: number;
    percentage: number;
  };
  currentSection?: string;
  lastUpdated?: string;
}

/**
 * Parse checkbox state from task line
 */
function parseCheckboxStatus(line: string): TaskStatus | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
    return 'done';
  }
  if (trimmed.startsWith('- [ ]')) {
    return 'todo';
  }
  if (trimmed.startsWith('- [b]') || trimmed.startsWith('- [B]')) {
    return 'blocked';
  }
  if (trimmed.startsWith('- [~]') || trimmed.startsWith('- [-]')) {
    return 'deferred';
  }
  return null;
}

/**
 * Extract task ID from description (T001, T002, etc.)
 */
function extractTaskId(description: string): string | null {
  const match = description.match(/\bT\d{3}[a-z]?\b/);
  return match ? match[0] : null;
}

/**
 * Extract user story reference from description ([US1], [US2], etc.)
 */
function extractUserStory(description: string): string | null {
  const match = description.match(/\[US(\d+)\]/);
  return match ? `US${match[1]}` : null;
}

/**
 * Check if task is marked parallel [P]
 */
function isParallelTask(description: string): boolean {
  return description.includes('[P]');
}

/**
 * Check if task is a verification task [V]
 */
function isVerificationTask(description: string): boolean {
  return description.includes('[V]');
}

/**
 * Extract dependencies from task description
 * Patterns: "Depends on T001", "After T002", "Requires T001, T002"
 */
function extractDependencies(description: string): string[] {
  const deps: string[] = [];

  // Match "Depends on T###" or "After T###" or "Requires T###, T###"
  const patterns = [
    /(?:depends on|after|requires)\s+([T\d,\s]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = description.matchAll(pattern);
    for (const match of matches) {
      const taskRefs = match[1].match(/T\d{3}[a-z]?/g);
      if (taskRefs) {
        deps.push(...taskRefs);
      }
    }
  }

  return [...new Set(deps)];
}

/**
 * Parse a single task line
 */
/**
 * Extract blocked reason from task description.
 * Matches: (blocked: reason) or [BLOCKED: reason]
 */
function extractBlockedReason(description: string): string | undefined {
  // Match (blocked: reason) or [BLOCKED: reason] patterns
  const match = description.match(/[\[(]blocked:\s*([^\])]+)[\])]/i);
  return match ? match[1].trim() : undefined;
}

function parseTaskLine(line: string, lineNumber: number): Task | null {
  const status = parseCheckboxStatus(line);
  if (!status) return null;

  // Extract the description (everything after checkbox)
  // Matches [x], [X], [ ], [~], [-], [b], [B]
  const match = line.match(/^-\s*\[[xX ~\-bB]\]\s*(.+)$/);
  if (!match) return null;

  const fullDescription = match[1].trim();
  const taskId = extractTaskId(fullDescription);

  // Require task ID for structured parsing
  if (!taskId) return null;

  // Strip the task ID from the description to avoid duplication in output
  const description = fullDescription.replace(/^\s*T\d{3}[a-z]?\s*/, '').trim();

  return {
    id: taskId,
    description,
    status,
    userStory: extractUserStory(description) ?? undefined,
    isParallel: isParallelTask(description) || undefined,
    isVerification: isVerificationTask(description) || undefined,
    dependencies: extractDependencies(description) || undefined,
    blockedReason: status === 'blocked' ? extractBlockedReason(description) : undefined,
    line: lineNumber,
  };
}

/**
 * Parse section header (## Phase N: Name or ## Name)
 */
function parseSectionHeader(line: string): { name: string; phase?: string } | null {
  // Match "## Phase N: Name" or "## Phase N - Name"
  const phaseMatch = line.match(/^##\s+Phase\s+(\d+)[:\-]\s*(.+)/i);
  if (phaseMatch) {
    return {
      name: phaseMatch[2].trim(),
      phase: phaseMatch[1],
    };
  }

  // Match any "## Name" header
  const headerMatch = line.match(/^##\s+(.+)/);
  if (headerMatch) {
    return { name: headerMatch[1].trim() };
  }

  return null;
}

/**
 * Parse purpose line (**Purpose**: ...)
 */
function parsePurpose(line: string): string | null {
  const match = line.match(/^\*\*Purpose\*\*:\s*(.+)/);
  return match ? match[1].trim() : null;
}

/**
 * Parse tasks.md file content
 */
export function parseTasksContent(content: string, filePath: string): TasksData {
  const lines = content.split('\n');
  const sections: TaskSection[] = [];
  const allTasks: Task[] = [];

  let currentSection: TaskSection | null = null;
  let title: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Parse title (# Tasks: ...)
    if (!title && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }

    // Parse section header
    const sectionHeader = parseSectionHeader(line);
    if (sectionHeader) {
      // Close previous section
      if (currentSection) {
        currentSection.endLine = lineNumber - 1;
        currentSection.isComplete = currentSection.tasks.every(t => t.status === 'done');
        sections.push(currentSection);
      }

      currentSection = {
        name: sectionHeader.name,
        phase: sectionHeader.phase,
        tasks: [],
        isComplete: false,
        startLine: lineNumber,
        endLine: lineNumber,
      };
      continue;
    }

    // Parse purpose
    if (currentSection) {
      const purpose = parsePurpose(line);
      if (purpose) {
        currentSection.purpose = purpose;
        continue;
      }
    }

    // Parse task
    const task = parseTaskLine(line, lineNumber);
    if (task) {
      if (currentSection) {
        task.section = currentSection.name;
        task.phase = currentSection.phase;
        currentSection.tasks.push(task);
      }
      allTasks.push(task);
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.isComplete = currentSection.tasks.every(t => t.status === 'done');
    sections.push(currentSection);
  }

  // Calculate progress
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === 'done').length;
  const blocked = allTasks.filter(t => t.status === 'blocked').length;
  const deferred = allTasks.filter(t => t.status === 'deferred').length;

  // Find current section (first incomplete section with tasks)
  const currentSectionName = sections.find(s => !s.isComplete && s.tasks.length > 0)?.name;

  return {
    featureDir: dirname(filePath),
    filePath,
    title,
    sections,
    tasks: allTasks,
    progress: {
      total,
      completed,
      blocked,
      deferred,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    currentSection: currentSectionName,
  };
}

/**
 * Read and parse tasks.md for current feature
 */
export async function readTasks(featureDirOrPath?: string): Promise<TasksData> {
  let tasksPath: string;

  if (featureDirOrPath && featureDirOrPath.endsWith('.md')) {
    // Direct path to tasks file
    tasksPath = featureDirOrPath;
  } else if (featureDirOrPath && featureDirOrPath.startsWith('/')) {
    // Absolute path to feature directory
    tasksPath = join(featureDirOrPath, 'tasks.md');
  } else {
    // Find tasks.md in feature directory or current project
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      throw new NotFoundError(
        'SpecFlow project',
        'Ensure you are in a SpecFlow project directory',
      );
    }

    const specsDir = getSpecsDir(projectRoot);

    if (featureDirOrPath) {
      // Relative feature directory name provided
      tasksPath = join(specsDir, featureDirOrPath, 'tasks.md');
    } else {
      // Find active feature from specs directory
      // Look for directories matching pattern NNNN-*
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(specsDir, { withFileTypes: true });

      const featureDirs = entries
        .filter(e => e.isDirectory() && /^\d{4}-/.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse();

      if (featureDirs.length === 0) {
        throw new NotFoundError(
          'Feature directory',
          'No feature directories found in specs/',
        );
      }

      // Use most recent feature
      tasksPath = join(specsDir, featureDirs[0], 'tasks.md');
    }
  }

  if (!pathExists(tasksPath)) {
    throw new NotFoundError(
      'tasks.md',
      `No tasks file found at ${tasksPath}`,
    );
  }

  const content = await readFile(tasksPath, 'utf-8');
  return parseTasksContent(content, tasksPath);
}

/**
 * Find next unblocked task in queue order
 */
export function findNextTask(tasksData: TasksData): Task | null {
  for (const section of tasksData.sections) {
    for (const task of section.tasks) {
      if (task.status === 'todo') {
        // Check if dependencies are met
        if (task.dependencies && task.dependencies.length > 0) {
          const allDependenciesMet = task.dependencies.every(depId => {
            const depTask = tasksData.tasks.find(t => t.id === depId);
            return depTask?.status === 'done';
          });
          if (!allDependenciesMet) continue;
        }
        return task;
      }
    }
  }
  return null;
}

/**
 * Get task by ID
 */
export function getTaskById(tasksData: TasksData, taskId: string): Task | null {
  return tasksData.tasks.find(t => t.id === taskId) ?? null;
}

/**
 * Check for circular dependencies in task graph
 */
export function detectCircularDependencies(tasksData: TasksData): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string, path: string[]): boolean {
    if (recursionStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const cycle = path.slice(cycleStart).concat(taskId);
      cycles.push(cycle.join(' → '));
      return true;
    }

    if (visited.has(taskId)) return false;

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = getTaskById(tasksData, taskId);
    if (task?.dependencies) {
      for (const depId of task.dependencies) {
        dfs(depId, [...path, taskId]);
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of tasksData.tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}
