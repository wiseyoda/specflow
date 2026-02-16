import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTasksContent,
  findNextTask,
  getTaskById,
  detectCircularDependencies,
  type TasksData,
} from '../../src/lib/tasks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures');

describe('tasks.ts', () => {
  describe('parseTasksContent - sample-tasks.md', () => {
    it('should parse tasks from markdown content', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      expect(result.title).toBe('Tasks: Sample Feature Implementation');
      // 21 tasks total in the new fixture
      expect(result.tasks.length).toBeGreaterThanOrEqual(21);
      // Multiple sections including Setup, Core, User Stories, Polish
      expect(result.sections.length).toBeGreaterThanOrEqual(5);
    });

    it('should calculate progress correctly', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // Should have completed, todo, and deferred tasks
      expect(result.progress.total).toBeGreaterThan(0);
      expect(result.progress.completed).toBeGreaterThan(0);
      expect(result.progress.percentage).toBeGreaterThan(0);
    });

    it('should extract task IDs including sub-task IDs', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const taskIds = result.tasks.map(t => t.id);
      expect(taskIds).toContain('T001');
      expect(taskIds).toContain('T011a'); // Sub-task
      expect(taskIds).toContain('T011b'); // Sub-task
      expect(taskIds).toContain('T011c'); // Sub-task
    });

    it('should detect parallel tasks with [P] tag', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const parallelTasks = result.tasks.filter(t => t.isParallel);
      expect(parallelTasks.length).toBeGreaterThan(0);
      // T002, T003, T004, T005, T008, T010, T011a, T011b, T011c, T019, T021 are parallel
      expect(parallelTasks.some(t => t.id === 'T002')).toBe(true);
    });

    it('should extract user story references', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const us1Tasks = result.tasks.filter(t => t.userStory === 'US1');
      expect(us1Tasks.length).toBeGreaterThan(0);
      // T012-T015 are US1 tasks
      expect(us1Tasks.some(t => t.id === 'T012')).toBe(true);
    });

    it('should extract dependencies with various formats', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // T009 has "After T007"
      const t009 = result.tasks.find(t => t.id === 'T009');
      expect(t009?.dependencies).toContain('T007');

      // T015 has "Requires T012, T013"
      const t015 = result.tasks.find(t => t.id === 'T015');
      expect(t015?.dependencies).toContain('T012');
      expect(t015?.dependencies).toContain('T013');

      // T018 has "Depends on T016"
      const t018 = result.tasks.find(t => t.id === 'T018');
      expect(t018?.dependencies).toContain('T016');
    });

    it('should identify sections with status suffixes', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // Find setup section which has "✅ COMPLETE" suffix
      const setupSection = result.sections.find(s => s.name.includes('Setup'));
      expect(setupSection?.isComplete).toBe(true);
    });

    it('should handle deferred tasks with [~] marker', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const deferredTasks = result.tasks.filter(t => t.status === 'deferred');
      expect(deferredTasks.length).toBeGreaterThan(0);
      expect(result.progress.deferred).toBeGreaterThan(0);
    });

    it('should identify current section as first incomplete section with tasks', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // Current section should be Core Implementation (first incomplete section with tasks)
      // Progress Dashboard has no tasks, so it should be skipped
      expect(result.currentSection).toBeDefined();
      // Should not be Progress Dashboard (no tasks)
      expect(result.currentSection).not.toBe('Progress Dashboard');
    });
  });

  describe('parseTasksContent - tasks-minimal.md', () => {
    it('should parse minimal tasks file without sections', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-minimal.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      expect(result.title).toBe('Tasks: Minimal Feature');
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].id).toBe('T001');
      expect(result.tasks[0].status).toBe('done');
      expect(result.tasks[1].status).toBe('todo');
    });
  });

  describe('parseTasksContent - tasks-edge-cases.md', () => {
    it('should parse tasks with multiple tags', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-edge-cases.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // T007 has [P1] [US2] [FR-001]
      const t007 = result.tasks.find(t => t.id === 'T007');
      expect(t007?.userStory).toBe('US2');
    });

    it('should parse deferred items', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-edge-cases.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const deferred = result.tasks.filter(t => t.status === 'deferred');
      expect(deferred.length).toBeGreaterThanOrEqual(2);
      expect(deferred.some(t => t.id === 'T009')).toBe(true);
    });

    it('should parse tasks with special characters in descriptions', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-edge-cases.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      // T011 has backticks and bold
      const t011 = result.tasks.find(t => t.id === 'T011');
      expect(t011?.description).toContain('`code blocks`');

      // T014 has special chars
      const t014 = result.tasks.find(t => t.id === 'T014');
      expect(t014?.description).toContain('<angle>');
    });

    it('should detect [V] verification tasks', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-edge-cases.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const vTasks = result.tasks.filter(t => t.isVerification);
      expect(vTasks.length).toBe(3);
      expect(vTasks.some(t => t.id === 'T018')).toBe(true);
      expect(vTasks.some(t => t.id === 'T019')).toBe(true);
      expect(vTasks.some(t => t.id === 'T020')).toBe(true);
    });

    it('should handle sub-tasks (T008a, T008b, T008c)', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'tasks-edge-cases.md'), 'utf-8');
      const result = parseTasksContent(content, 'test/tasks.md');

      const taskIds = result.tasks.map(t => t.id);
      expect(taskIds).toContain('T008');
      expect(taskIds).toContain('T008a');
      expect(taskIds).toContain('T008b');
      expect(taskIds).toContain('T008c');
    });
  });

  describe('findNextTask', () => {
    it('should find first incomplete task with no unmet dependencies', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const tasksData = parseTasksContent(content, 'test/tasks.md');

      const next = findNextTask(tasksData);
      // Should find a task that is todo and has met dependencies
      expect(next).not.toBeNull();
      expect(next?.status).toBe('todo');
    });

    it('should skip tasks with unmet dependencies', () => {
      const tasksData: TasksData = {
        featureDir: 'test',
        filePath: 'test/tasks.md',
        sections: [{
          name: 'Test',
          tasks: [
            { id: 'T001', description: 'First', status: 'todo', line: 1, dependencies: ['T002'] },
            { id: 'T002', description: 'Second', status: 'todo', line: 2 },
          ],
          isComplete: false,
          startLine: 1,
          endLine: 3,
        }],
        tasks: [
          { id: 'T001', description: 'First', status: 'todo', line: 1, dependencies: ['T002'] },
          { id: 'T002', description: 'Second', status: 'todo', line: 2 },
        ],
        progress: { total: 2, completed: 0, blocked: 0, deferred: 0, percentage: 0 },
      };

      const next = findNextTask(tasksData);
      expect(next?.id).toBe('T002'); // T001 blocked by T002
    });

    it('should skip deferred tasks', () => {
      const tasksData: TasksData = {
        featureDir: 'test',
        filePath: 'test/tasks.md',
        sections: [{
          name: 'Test',
          tasks: [
            { id: 'T001', description: 'Deferred', status: 'deferred', line: 1 },
            { id: 'T002', description: 'Todo', status: 'todo', line: 2 },
          ],
          isComplete: false,
          startLine: 1,
          endLine: 3,
        }],
        tasks: [
          { id: 'T001', description: 'Deferred', status: 'deferred', line: 1 },
          { id: 'T002', description: 'Todo', status: 'todo', line: 2 },
        ],
        progress: { total: 2, completed: 0, blocked: 0, deferred: 1, percentage: 0 },
      };

      const next = findNextTask(tasksData);
      expect(next?.id).toBe('T002'); // Should skip deferred T001
    });

    it('should return null when all tasks complete', () => {
      const tasksData: TasksData = {
        featureDir: 'test',
        filePath: 'test/tasks.md',
        sections: [],
        tasks: [
          { id: 'T001', description: 'First', status: 'done', line: 1 },
        ],
        progress: { total: 1, completed: 1, blocked: 0, deferred: 0, percentage: 100 },
      };

      const next = findNextTask(tasksData);
      expect(next).toBeNull();
    });
  });

  describe('getTaskById', () => {
    it('should find task by ID', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const tasksData = parseTasksContent(content, 'test/tasks.md');

      const task = getTaskById(tasksData, 'T007');
      expect(task?.id).toBe('T007');
    });

    it('should find sub-task by ID', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const tasksData = parseTasksContent(content, 'test/tasks.md');

      const task = getTaskById(tasksData, 'T011a');
      expect(task?.id).toBe('T011a');
    });

    it('should return null for unknown ID', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const tasksData = parseTasksContent(content, 'test/tasks.md');

      const task = getTaskById(tasksData, 'T999');
      expect(task).toBeNull();
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect circular dependencies', () => {
      const tasksData: TasksData = {
        featureDir: 'test',
        filePath: 'test/tasks.md',
        sections: [],
        tasks: [
          { id: 'T001', description: 'First', status: 'todo', line: 1, dependencies: ['T002'] },
          { id: 'T002', description: 'Second', status: 'todo', line: 2, dependencies: ['T003'] },
          { id: 'T003', description: 'Third', status: 'todo', line: 3, dependencies: ['T001'] },
        ],
        progress: { total: 3, completed: 0, blocked: 0, deferred: 0, percentage: 0 },
      };

      const cycles = detectCircularDependencies(tasksData);
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('T001');
    });

    it('should return empty for valid dependency graph', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-tasks.md'), 'utf-8');
      const tasksData = parseTasksContent(content, 'test/tasks.md');

      const cycles = detectCircularDependencies(tasksData);
      expect(cycles).toHaveLength(0);
    });
  });
});
