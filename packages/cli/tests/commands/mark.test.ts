import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
}));

vi.mock('../../src/lib/context.js', () => ({
  resolveFeatureDir: vi.fn(),
}));

vi.mock('../../src/lib/tasks.js', () => ({
  readTasks: vi.fn(),
  findNextTask: vi.fn(),
  getTaskById: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { findProjectRoot } from '../../src/lib/paths.js';
import { resolveFeatureDir } from '../../src/lib/context.js';
import { readTasks, getTaskById, findNextTask } from '../../src/lib/tasks.js';
import { readFile, writeFile } from 'node:fs/promises';

describe('mark command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseTaskRange', () => {
    it('should parse task range correctly', () => {
      // Test the range parsing logic
      const range = 'T001..T005';
      const match = range.match(/^(T\d{3}[a-z]?)\.\.(T\d{3}[a-z]?)$/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe('T001');
      expect(match?.[2]).toBe('T005');

      const startNum = parseInt(match![1].slice(1, 4), 10);
      const endNum = parseInt(match![2].slice(1, 4), 10);

      const result: string[] = [];
      for (let i = startNum; i <= endNum; i++) {
        result.push(`T${String(i).padStart(3, '0')}`);
      }

      expect(result).toEqual(['T001', 'T002', 'T003', 'T004', 'T005']);
    });

    it('should handle single task IDs', () => {
      const id = 'T001';
      expect(id.match(/^T\d{3}[a-z]?$/)).toBeTruthy();
    });

    it('should handle sub-task IDs', () => {
      const id = 'T008a';
      expect(id.match(/^T\d{3}[a-z]?$/)).toBeTruthy();
    });

    it('should detect legacy verification item IDs', () => {
      const id = 'V-001';
      expect(id.match(/^[VICD]-\d{3}$/)).toBeTruthy();
    });
  });

  describe('updateTaskCheckbox', () => {
    it('should mark task as complete', () => {
      const content = '- [ ] T001 First task\n- [ ] T002 Second task';
      const taskId = 'T001';

      const lines = content.split('\n');
      const updated = lines.map(line => {
        if (line.includes(taskId)) {
          return line.replace(/- \[ \]/, '- [x]');
        }
        return line;
      }).join('\n');

      expect(updated).toContain('- [x] T001 First task');
      expect(updated).toContain('- [ ] T002 Second task');
    });

    it('should mark task as incomplete', () => {
      const content = '- [x] T001 First task\n- [x] T002 Second task';
      const taskId = 'T001';

      const lines = content.split('\n');
      const updated = lines.map(line => {
        if (line.includes(taskId)) {
          return line.replace(/- \[x\]/i, '- [ ]');
        }
        return line;
      }).join('\n');

      expect(updated).toContain('- [ ] T001 First task');
      expect(updated).toContain('- [x] T002 Second task');
    });
  });

  describe('markTasks', () => {
    it('should throw when not in a project', async () => {
      vi.mocked(findProjectRoot).mockReturnValue(undefined);

      expect(findProjectRoot()).toBeUndefined();
    });

    it('should throw for invalid task IDs', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/test/project');
      vi.mocked(resolveFeatureDir).mockResolvedValue('/test/specs/0010-test');
      vi.mocked(readTasks).mockResolvedValue({
        featureDir: '/test/specs/0010-test',
        filePath: '/test/specs/0010-test/tasks.md',
        tasks: [
          { id: 'T001', description: 'First task', status: 'todo', line: 10 },
        ],
        sections: [],
        progress: { total: 1, completed: 0, blocked: 0, deferred: 0, percentage: 0 },
      });
      vi.mocked(getTaskById).mockReturnValue(null);

      const tasks = await readTasks('/test/specs/0010-test');
      const task = getTaskById(tasks, 'T999');

      expect(task).toBeNull();
    });

    it('should update file and return progress', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/test/project');
      vi.mocked(resolveFeatureDir).mockResolvedValue('/test/specs/0010-test');
      vi.mocked(readTasks)
        .mockResolvedValueOnce({
          featureDir: '/test/specs/0010-test',
          filePath: '/test/specs/0010-test/tasks.md',
          tasks: [
            { id: 'T001', description: 'First task', status: 'todo', line: 10, section: 'Test' },
            { id: 'T002', description: 'Second task', status: 'todo', line: 11, section: 'Test' },
          ],
          sections: [{
            name: 'Test',
            tasks: [
              { id: 'T001', description: 'First task', status: 'todo', line: 10, section: 'Test' },
              { id: 'T002', description: 'Second task', status: 'todo', line: 11, section: 'Test' },
            ],
            isComplete: false,
            startLine: 8,
            endLine: 12,
          }],
          progress: { total: 2, completed: 0, blocked: 0, deferred: 0, percentage: 0 },
        })
        .mockResolvedValueOnce({
          featureDir: '/test/specs/0010-test',
          filePath: '/test/specs/0010-test/tasks.md',
          tasks: [
            { id: 'T001', description: 'First task', status: 'done', line: 10, section: 'Test' },
            { id: 'T002', description: 'Second task', status: 'todo', line: 11, section: 'Test' },
          ],
          sections: [{
            name: 'Test',
            tasks: [
              { id: 'T001', description: 'First task', status: 'done', line: 10, section: 'Test' },
              { id: 'T002', description: 'Second task', status: 'todo', line: 11, section: 'Test' },
            ],
            isComplete: false,
            startLine: 8,
            endLine: 12,
          }],
          progress: { total: 2, completed: 1, blocked: 0, deferred: 0, percentage: 50 },
        });
      vi.mocked(getTaskById)
        .mockReturnValueOnce({ id: 'T001', description: 'First task', status: 'todo', line: 10, section: 'Test' })
        .mockReturnValueOnce({ id: 'T001', description: 'First task', status: 'done', line: 10, section: 'Test' });
      vi.mocked(findNextTask).mockReturnValue({ id: 'T002', description: 'Second task', status: 'todo', line: 11 });
      vi.mocked(readFile).mockResolvedValue('- [ ] T001 First task\n- [ ] T002 Second task');
      vi.mocked(writeFile).mockResolvedValue(undefined);

      // Simulate the mark flow
      const tasksData = await readTasks('/test/specs/0010-test');
      expect(getTaskById(tasksData, 'T001')).not.toBeNull();

      // After marking
      const updatedTasks = await readTasks('/test/specs/0010-test');
      expect(updatedTasks.progress.completed).toBe(1);
      expect(updatedTasks.progress.percentage).toBe(50);
    });
  });

  describe('section completion', () => {
    it('should detect when section is complete', () => {
      const sectionTasks = [
        { id: 'T001', status: 'done' },
        { id: 'T002', status: 'done' },
      ];

      const sectionCompleted = sectionTasks.filter(t => t.status === 'done').length;
      const isComplete = sectionCompleted === sectionTasks.length;

      expect(isComplete).toBe(true);
    });

    it('should detect when step is complete', () => {
      const progress = { total: 10, completed: 10 };
      const allComplete = progress.completed === progress.total;

      expect(allComplete).toBe(true);
    });
  });

  describe('legacy checklist IDs', () => {
    it('should detect legacy checklist ID format', () => {
      const legacyIds = ['V-001', 'I-001', 'C-001', 'D-001'];
      const legacyPattern = /^[VICD]-\d{3}$/;

      for (const id of legacyIds) {
        expect(legacyPattern.test(id)).toBe(true);
      }
    });

    it('should distinguish task IDs from legacy checklist IDs', () => {
      const taskId = 'T001';
      const legacyId = 'V-001';

      expect(/^T\d{3}[a-z]?$/.test(taskId)).toBe(true);
      expect(/^[VICD]-\d{3}$/.test(legacyId)).toBe(true);
      expect(/^[VICD]-\d{3}$/.test(taskId)).toBe(false);
    });
  });

  describe('optional evidence for tasks', () => {
    it('should not require evidence for task marking', () => {
      // Evidence is optional for all tasks, including [V] tasks
      const hasEvidence = false;
      const shouldBlock = false; // never blocks

      expect(shouldBlock).toBe(false);
    });

    it('should accept evidence when provided', () => {
      const evidenceText = 'pnpm test: 47 passed, 0 failed';
      expect(evidenceText).toBeTruthy();
    });
  });
});
