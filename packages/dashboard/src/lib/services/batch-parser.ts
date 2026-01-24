/**
 * Batch Parser - Detects batches from tasks.md sections
 *
 * Parses tasks.md to detect batches from ## section headers.
 * Falls back to fixed-size batches when no sections exist.
 *
 * Features:
 * - Parse ## section headers as batch boundaries
 * - Identify incomplete tasks per section
 * - Skip completed tasks (marked with [x])
 * - Parse task dependencies [depends: T001, T002]
 * - Topological sort within batches respecting dependencies
 * - Fall back to configurable fixed-size batches
 * - Return structured BatchPlan for orchestration
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { BatchPlan, BatchItem, BatchTracking } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed task from tasks.md
 */
interface ParsedTask {
  id: string;
  completed: boolean;
  description: string;
  section: string;
  line: number;
  /** Task IDs that this task depends on */
  dependencies: string[];
}

/**
 * Parsed section from tasks.md
 */
interface ParsedSection {
  name: string;
  startLine: number;
  tasks: ParsedTask[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_BATCH_SIZE_FALLBACK = 15;

// Task patterns - match CLI parser behavior
// Matches: - [ ] T001, - [x] T002, etc.
const TASK_PATTERN = /^[-*]\s*\[([ xX])\]\s*(T\d{3})/;

// Section pattern - ## with any text
const SECTION_PATTERN = /^##\s+(.+)$/;

// Dependency pattern - [depends: T001, T002] or [dep: T001] or [after: T001]
const DEPENDENCY_PATTERN = /\[(depends?|dep|after):\s*([^\]]+)\]/i;

// =============================================================================
// Dependency Helpers
// =============================================================================

/**
 * Parse dependencies from a task line
 * Supports formats: [depends: T001, T002], [dep: T001], [after: T003]
 */
function parseDependencies(text: string): string[] {
  const match = text.match(DEPENDENCY_PATTERN);
  if (!match) {
    return [];
  }

  // Extract the dependency list (match[2])
  const depList = match[2];

  // Parse task IDs (T followed by 3 digits)
  const taskIds = depList.match(/T\d{3}/g);
  return taskIds || [];
}

/**
 * Topological sort of tasks within a batch respecting dependencies
 * Returns tasks in execution order (dependencies first)
 *
 * @param tasks - Tasks to sort
 * @returns Sorted task IDs (dependencies before dependents)
 */
function topologicalSortTasks(tasks: ParsedTask[]): string[] {
  // Build dependency graph
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const taskSet = new Set(tasks.map((t) => t.id));

  // Initialize
  for (const task of tasks) {
    graph.set(task.id, []);
    inDegree.set(task.id, 0);
  }

  // Build edges (task -> tasks that depend on it)
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // Only consider dependencies within this batch
      if (taskSet.has(dep)) {
        graph.get(dep)?.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Start with tasks that have no dependencies (in-degree 0)
  for (const task of tasks) {
    if ((inDegree.get(task.id) || 0) === 0) {
      queue.push(task.id);
    }
  }

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    result.push(taskId);

    // Reduce in-degree of dependent tasks
    for (const dependent of graph.get(taskId) || []) {
      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycles (if result doesn't include all tasks)
  if (result.length !== tasks.length) {
    console.warn('[batch-parser] Circular dependency detected, falling back to original order');
    return tasks.map((t) => t.id);
  }

  return result;
}

/**
 * Check if tasks have valid dependencies (all dependencies exist)
 * Returns warnings for invalid dependencies
 */
function validateDependencies(tasks: ParsedTask[]): string[] {
  const warnings: string[] = [];
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        warnings.push(`Task ${task.id} depends on ${dep}, which doesn't exist`);
      }
    }
  }

  return warnings;
}

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse tasks.md content to extract sections and tasks
 */
function parseTasksContent(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  // Create a default section for tasks that appear before any ## header
  const defaultSection: ParsedSection = {
    name: '__default__',
    startLine: 0,
    tasks: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for section header
    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      // Start new section
      currentSection = {
        name: sectionMatch[1].trim(),
        startLine: lineNumber,
        tasks: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Check for task
    const taskMatch = line.match(TASK_PATTERN);
    if (taskMatch) {
      // Use current section or default section for tasks before any ## header
      const targetSection = currentSection || defaultSection;
      const completed = taskMatch[1].toLowerCase() === 'x';
      const id = taskMatch[2];
      const descriptionPart = line.slice(line.indexOf(id) + id.length).trim();

      // Parse dependencies from the task line
      const dependencies = parseDependencies(descriptionPart);

      // Remove dependency annotation from description for cleaner display
      const description = descriptionPart.replace(DEPENDENCY_PATTERN, '').trim();

      targetSection.tasks.push({
        id,
        completed,
        description,
        section: targetSection.name,
        line: lineNumber,
        dependencies,
      });
    }
  }

  // If we have tasks in the default section (no ## headers found), add it to sections
  if (defaultSection.tasks.length > 0) {
    sections.unshift(defaultSection);
  }

  return sections;
}

/**
 * Create batches from parsed sections
 * Each section with incomplete tasks becomes one batch (FR-011)
 * Tasks are sorted by dependencies within each batch (FR-014, FR-015)
 */
function createBatchesFromSections(sections: ParsedSection[]): {
  batches: BatchPlan['batches'];
  dependencyWarnings: string[];
} {
  const batches: BatchPlan['batches'] = [];
  const allWarnings: string[] = [];

  for (const section of sections) {
    // Get incomplete tasks in this section (FR-013)
    const incompleteTasks = section.tasks.filter((t) => !t.completed);

    // Only create batch if section has incomplete tasks
    if (incompleteTasks.length > 0) {
      // Validate dependencies
      const warnings = validateDependencies(incompleteTasks);
      allWarnings.push(...warnings);

      // Topological sort tasks by dependencies (FR-014, FR-015)
      const sortedTaskIds = topologicalSortTasks(incompleteTasks);

      // Build dependency map for the batch
      const dependencies: Record<string, string[]> = {};
      for (const task of incompleteTasks) {
        if (task.dependencies.length > 0) {
          dependencies[task.id] = task.dependencies;
        }
      }

      batches.push({
        name: section.name,
        taskIds: sortedTaskIds,
        incompleteCount: incompleteTasks.length,
        dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
      });
    }
  }

  return { batches, dependencyWarnings: allWarnings };
}

/**
 * Create fixed-size batches from all incomplete tasks (FR-012)
 * Used as fallback when no ## sections found
 */
function createFallbackBatches(
  sections: ParsedSection[],
  batchSize: number
): BatchPlan['batches'] {
  // Collect all incomplete tasks across all sections
  const allIncompleteTasks: ParsedTask[] = [];

  for (const section of sections) {
    for (const task of section.tasks) {
      if (!task.completed) {
        allIncompleteTasks.push(task);
      }
    }
  }

  // Split into fixed-size batches
  const batches: BatchPlan['batches'] = [];
  let batchIndex = 1;

  for (let i = 0; i < allIncompleteTasks.length; i += batchSize) {
    const batchTasks = allIncompleteTasks.slice(i, i + batchSize);
    batches.push({
      name: `Batch ${batchIndex}`,
      taskIds: batchTasks.map((t) => t.id),
      incompleteCount: batchTasks.length,
    });
    batchIndex++;
  }

  return batches;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Parse batches from tasks.md file content (FR-010, FR-011, FR-012, FR-013)
 *
 * @param tasksContent - Raw content of tasks.md file
 * @param batchSizeFallback - Fixed batch size to use if no sections found (default: 15)
 * @returns BatchPlan with detected batches
 */
export function parseBatchesFromTasksMd(
  tasksContent: string,
  batchSizeFallback: number = DEFAULT_BATCH_SIZE_FALLBACK
): BatchPlan {
  const sections = parseTasksContent(tasksContent);

  // Count total incomplete tasks
  let totalIncomplete = 0;
  for (const section of sections) {
    for (const task of section.tasks) {
      if (!task.completed) {
        totalIncomplete++;
      }
    }
  }

  // Check if we have proper ## sections with tasks (not just __default__)
  // Fallback is used when there are no explicit ## section headers
  const realSections = sections.filter(
    (s) => s.name !== '__default__' && s.tasks.length > 0
  );
  const useFallback = realSections.length === 0 && totalIncomplete > 0;

  let batches: BatchPlan['batches'];
  let dependencyWarnings: string[] = [];

  if (useFallback) {
    // No sections with tasks - use fallback batching (FR-012)
    batches = createFallbackBatches(sections, batchSizeFallback);
  } else {
    // Use section-based batching with dependency sorting (FR-010, FR-011, FR-014, FR-015)
    const result = createBatchesFromSections(sections);
    batches = result.batches;
    dependencyWarnings = result.dependencyWarnings;
  }

  return {
    batches,
    usedFallback: useFallback,
    fallbackSize: useFallback ? batchSizeFallback : undefined,
    totalIncomplete,
    dependencyWarnings: dependencyWarnings.length > 0 ? dependencyWarnings : undefined,
  };
}

/**
 * Parse batches from a project's tasks.md file
 *
 * @param projectPath - Path to the project root
 * @param batchSizeFallback - Fixed batch size to use if no sections found
 * @returns BatchPlan with detected batches, or null if tasks.md not found
 */
export function parseBatchesFromProject(
  projectPath: string,
  batchSizeFallback: number = DEFAULT_BATCH_SIZE_FALLBACK
): BatchPlan | null {
  // Find active phase specs directory
  const specsDir = join(projectPath, 'specs');

  if (!existsSync(specsDir)) {
    return null;
  }

  // Find the current phase directory (matches specflow status behavior)
  // Look for directories matching pattern: NNNN-* (phase number prefix)
  const { readdirSync } = require('fs');
  const entries = readdirSync(specsDir, { withFileTypes: true });

  // Find phase directories and sort to get the latest
  const phaseDirs = entries
    .filter((e: { isDirectory: () => boolean; name: string }) =>
      e.isDirectory() && /^\d{4}-/.test(e.name)
    )
    .map((e: { name: string }) => e.name)
    .sort()
    .reverse();

  if (phaseDirs.length === 0) {
    return null;
  }

  // Use the most recent phase directory
  const currentPhaseDir = phaseDirs[0];
  const tasksPath = join(specsDir, currentPhaseDir, 'tasks.md');

  if (!existsSync(tasksPath)) {
    return null;
  }

  const content = readFileSync(tasksPath, 'utf-8');
  return parseBatchesFromTasksMd(content, batchSizeFallback);
}

/**
 * Create initial batch tracking state from a batch plan
 *
 * @param plan - BatchPlan from parseBatchesFromTasksMd
 * @returns BatchTracking structure for orchestration execution
 */
export function createBatchTracking(plan: BatchPlan): BatchTracking {
  const items: BatchItem[] = plan.batches.map((batch, index) => ({
    index,
    section: batch.name,
    taskIds: batch.taskIds,
    status: 'pending',
    healAttempts: 0,
  }));

  return {
    total: items.length,
    current: 0,
    items,
  };
}

/**
 * Get summary of batch plan for display
 *
 * @param plan - BatchPlan from parseBatchesFromTasksMd
 * @returns Human-readable summary string
 */
export function getBatchPlanSummary(plan: BatchPlan): string {
  const batchCount = plan.batches.length;
  const taskCount = plan.totalIncomplete;

  if (batchCount === 0) {
    return 'No incomplete tasks found';
  }

  if (plan.usedFallback) {
    return `${batchCount} batch${batchCount !== 1 ? 'es' : ''} (${taskCount} tasks, fallback sizing)`;
  }

  return `${batchCount} batch${batchCount !== 1 ? 'es' : ''} from tasks.md sections (${taskCount} tasks)`;
}

/**
 * Verify which tasks from a batch are actually complete in tasks.md
 *
 * @param projectPath - Path to the project root
 * @param taskIds - List of task IDs to verify
 * @returns Object with completed and incomplete task IDs
 */
export function verifyBatchTaskCompletion(
  projectPath: string,
  taskIds: string[]
): { completedTasks: string[]; incompleteTasks: string[] } {
  // Re-parse tasks.md to get current state
  const plan = parseBatchesFromProject(projectPath);

  if (!plan) {
    // Can't verify - assume all incomplete
    return { completedTasks: [], incompleteTasks: taskIds };
  }

  // Get all tasks from the current plan
  const allTaskIds = new Set<string>();
  const completedTaskIds = new Set<string>();

  // We need to re-parse to get completion status, not just batch structure
  const specsDir = join(projectPath, 'specs');
  const { readdirSync } = require('fs');
  const entries = readdirSync(specsDir, { withFileTypes: true });

  const phaseDirs = entries
    .filter((e: { isDirectory: () => boolean; name: string }) =>
      e.isDirectory() && /^\d{4}-/.test(e.name)
    )
    .map((e: { name: string }) => e.name)
    .sort()
    .reverse();

  if (phaseDirs.length === 0) {
    return { completedTasks: [], incompleteTasks: taskIds };
  }

  const tasksPath = join(specsDir, phaseDirs[0], 'tasks.md');
  if (!existsSync(tasksPath)) {
    return { completedTasks: [], incompleteTasks: taskIds };
  }

  const content = readFileSync(tasksPath, 'utf-8');
  const lines = content.split('\n');

  // Parse all tasks and their completion status
  for (const line of lines) {
    const taskMatch = line.match(TASK_PATTERN);
    if (taskMatch) {
      const completed = taskMatch[1].toLowerCase() === 'x';
      const id = taskMatch[2];
      allTaskIds.add(id);
      if (completed) {
        completedTaskIds.add(id);
      }
    }
  }

  // Check which of the requested tasks are complete
  const completedTasks: string[] = [];
  const incompleteTasks: string[] = [];

  for (const taskId of taskIds) {
    if (completedTaskIds.has(taskId)) {
      completedTasks.push(taskId);
    } else {
      incompleteTasks.push(taskId);
    }
  }

  return { completedTasks, incompleteTasks };
}

/**
 * Check total incomplete task count in a project
 *
 * @param projectPath - Path to the project root
 * @returns Number of incomplete tasks, or null if can't determine
 */
export function getTotalIncompleteTasks(projectPath: string): number | null {
  const plan = parseBatchesFromProject(projectPath);
  return plan?.totalIncomplete ?? null;
}
