/**
 * Tests for batch-parser.ts
 *
 * Tests batch detection from tasks.md sections and fallback behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  parseBatchesFromTasksMd,
  createBatchTracking,
  getBatchPlanSummary,
} from '@/lib/services/batch-parser';

describe('parseBatchesFromTasksMd', () => {
  describe('section-based batching', () => {
    it('should create batches from ## section headers', () => {
      const content = `# Tasks

## Phase 1: Foundation
- [ ] T001 Setup project structure
- [ ] T002 Create schemas

## Phase 2: Core
- [ ] T003 Implement service
- [ ] T004 Add API routes
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.usedFallback).toBe(false);
      expect(plan.batches.length).toBe(2);
      expect(plan.batches[0].name).toBe('Phase 1: Foundation');
      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002']);
      expect(plan.batches[1].name).toBe('Phase 2: Core');
      expect(plan.batches[1].taskIds).toEqual(['T003', 'T004']);
      expect(plan.totalIncomplete).toBe(4);
    });

    it('should skip completed tasks (marked with [x])', () => {
      const content = `## Setup
- [x] T001 Already done
- [ ] T002 Not done
- [X] T003 Also done
- [ ] T004 Still pending
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches.length).toBe(1);
      expect(plan.batches[0].taskIds).toEqual(['T002', 'T004']);
      expect(plan.batches[0].incompleteCount).toBe(2);
      expect(plan.totalIncomplete).toBe(2);
    });

    it('should skip sections with no incomplete tasks', () => {
      const content = `## Phase 1: Done
- [x] T001 Complete
- [x] T002 Complete

## Phase 2: Active
- [ ] T003 Pending
- [ ] T004 Pending
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches.length).toBe(1);
      expect(plan.batches[0].name).toBe('Phase 2: Active');
    });

    it('should handle asterisk task markers', () => {
      const content = `## Tasks
* [ ] T001 Task one
* [ ] T002 Task two
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002']);
    });
  });

  describe('task dependencies', () => {
    it('should parse dependencies from [depends: T001, T002] format', () => {
      const content = `## Setup
- [ ] T001 Base setup
- [ ] T002 Config setup [depends: T001]
- [ ] T003 Final setup [depends: T001, T002]
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches[0].dependencies).toBeDefined();
      expect(plan.batches[0].dependencies?.['T002']).toEqual(['T001']);
      expect(plan.batches[0].dependencies?.['T003']).toEqual(['T001', 'T002']);
    });

    it('should parse dependencies from [dep: T001] short format', () => {
      const content = `## Setup
- [ ] T001 First task
- [ ] T002 Dependent task [dep: T001]
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches[0].dependencies?.['T002']).toEqual(['T001']);
    });

    it('should parse dependencies from [after: T001] format', () => {
      const content = `## Setup
- [ ] T001 First task
- [ ] T002 Runs after [after: T001]
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches[0].dependencies?.['T002']).toEqual(['T001']);
    });

    it('should topologically sort tasks respecting dependencies', () => {
      const content = `## Setup
- [ ] T003 Depends on T001 and T002 [depends: T001, T002]
- [ ] T001 No dependencies
- [ ] T002 Depends on T001 [depends: T001]
`;
      const plan = parseBatchesFromTasksMd(content);

      // T001 should come first (no deps), then T002 (depends on T001), then T003 (depends on both)
      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002', 'T003']);
    });

    it('should handle tasks with no dependencies in original order', () => {
      const content = `## Setup
- [ ] T001 First task
- [ ] T002 Second task
- [ ] T003 Third task
`;
      const plan = parseBatchesFromTasksMd(content);

      // No dependencies - should maintain original order
      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002', 'T003']);
      expect(plan.batches[0].dependencies).toBeUndefined();
    });

    it('should warn about dependencies on non-existent tasks', () => {
      const content = `## Setup
- [ ] T001 Task with missing dep [depends: T999]
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.dependencyWarnings).toBeDefined();
      expect(plan.dependencyWarnings?.length).toBeGreaterThan(0);
      expect(plan.dependencyWarnings?.[0]).toContain('T999');
    });

    it('should handle circular dependencies gracefully', () => {
      const content = `## Setup
- [ ] T001 Depends on T002 [depends: T002]
- [ ] T002 Depends on T001 [depends: T001]
`;
      // Should not throw, should fall back to original order
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches[0].taskIds.length).toBe(2);
      // Both tasks should be present
      expect(plan.batches[0].taskIds).toContain('T001');
      expect(plan.batches[0].taskIds).toContain('T002');
    });

    it('should ignore dependencies on completed tasks', () => {
      const content = `## Setup
- [x] T001 Completed
- [ ] T002 Depends on completed [depends: T001]
- [ ] T003 No dependencies
`;
      const plan = parseBatchesFromTasksMd(content);

      // T001 is completed, so only T002 and T003 in batch
      expect(plan.batches[0].taskIds).toContain('T002');
      expect(plan.batches[0].taskIds).toContain('T003');
      // T002's dependency on T001 should be preserved in the data
      // but T001 won't be in taskIds since it's completed
    });

    it('should handle dependencies across multiple batches independently', () => {
      const content = `## Phase 1
- [ ] T001 First
- [ ] T002 Second [depends: T001]

## Phase 2
- [ ] T003 Third
- [ ] T004 Fourth [depends: T003]
`;
      const plan = parseBatchesFromTasksMd(content);

      // Each batch should be sorted independently
      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002']);
      expect(plan.batches[1].taskIds).toEqual(['T003', 'T004']);
      expect(plan.batches[0].dependencies?.['T002']).toEqual(['T001']);
      expect(plan.batches[1].dependencies?.['T004']).toEqual(['T003']);
    });
  });

  describe('fallback batching', () => {
    it('should use fixed-size batches when no ## sections exist', () => {
      const content = `# Tasks
- [ ] T001 First
- [ ] T002 Second
- [ ] T003 Third
- [ ] T004 Fourth
- [ ] T005 Fifth
`;
      const plan = parseBatchesFromTasksMd(content, 2);

      expect(plan.usedFallback).toBe(true);
      expect(plan.fallbackSize).toBe(2);
      expect(plan.batches.length).toBe(3); // 5 tasks / 2 = 3 batches
      expect(plan.batches[0].name).toBe('Batch 1');
      expect(plan.batches[0].taskIds).toEqual(['T001', 'T002']);
      expect(plan.batches[1].taskIds).toEqual(['T003', 'T004']);
      expect(plan.batches[2].taskIds).toEqual(['T005']);
    });

    it('should use default batch size of 15', () => {
      const content = `# Tasks
${Array.from({ length: 20 }, (_, i) => `- [ ] T${String(i + 1).padStart(3, '0')} Task ${i + 1}`).join('\n')}
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.usedFallback).toBe(true);
      expect(plan.fallbackSize).toBe(15);
      expect(plan.batches.length).toBe(2); // 20 / 15 = 2 batches
    });
  });

  describe('edge cases', () => {
    it('should return empty batches for empty content', () => {
      const plan = parseBatchesFromTasksMd('');

      expect(plan.batches.length).toBe(0);
      expect(plan.totalIncomplete).toBe(0);
    });

    it('should return empty batches when all tasks are complete', () => {
      const content = `## Done
- [x] T001 Complete
- [x] T002 Complete
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches.length).toBe(0);
      expect(plan.totalIncomplete).toBe(0);
    });

    it('should handle content with no tasks', () => {
      const content = `# Phase Overview

This is just documentation.

## Notes
Some notes about the project.
`;
      const plan = parseBatchesFromTasksMd(content);

      expect(plan.batches.length).toBe(0);
      expect(plan.totalIncomplete).toBe(0);
    });
  });
});

describe('createBatchTracking', () => {
  it('should create tracking state from batch plan', () => {
    const plan = parseBatchesFromTasksMd(`## Phase 1
- [ ] T001 Task
- [ ] T002 Task

## Phase 2
- [ ] T003 Task
`);
    const tracking = createBatchTracking(plan);

    expect(tracking.total).toBe(2);
    expect(tracking.current).toBe(0);
    expect(tracking.items.length).toBe(2);
    expect(tracking.items[0]).toEqual({
      index: 0,
      section: 'Phase 1',
      taskIds: ['T001', 'T002'],
      status: 'pending',
      healAttempts: 0,
    });
    expect(tracking.items[1]).toEqual({
      index: 1,
      section: 'Phase 2',
      taskIds: ['T003'],
      status: 'pending',
      healAttempts: 0,
    });
  });
});

describe('getBatchPlanSummary', () => {
  it('should return summary for section-based batches', () => {
    const plan = parseBatchesFromTasksMd(`## Phase 1
- [ ] T001 Task
## Phase 2
- [ ] T002 Task
`);
    const summary = getBatchPlanSummary(plan);

    expect(summary).toBe('2 batches from tasks.md sections (2 tasks)');
  });

  it('should return summary for fallback batches', () => {
    const plan = parseBatchesFromTasksMd(`# Tasks
- [ ] T001 Task
- [ ] T002 Task
`, 5);
    const summary = getBatchPlanSummary(plan);

    expect(summary).toBe('1 batch (2 tasks, fallback sizing)');
  });

  it('should return empty message for no tasks', () => {
    const plan = parseBatchesFromTasksMd('');
    const summary = getBatchPlanSummary(plan);

    expect(summary).toBe('No incomplete tasks found');
  });
});
