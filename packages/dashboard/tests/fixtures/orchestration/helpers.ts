/**
 * Shared test fixtures and helpers for orchestration tests
 * T121/G12.5-9: Centralized test utilities
 */

import { vi } from 'vitest';
import type {
  OrchestrationExecution,
  OrchestrationConfig,
  OrchestrationPhase,
  BatchTracking,
  BatchItem,
} from '@specflow/shared';
import type { OrchestrationDeps } from '../../../src/lib/services/orchestration-runner';

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default orchestration config for tests
 */
export const defaultConfig: OrchestrationConfig = {
  autoMerge: false,
  additionalContext: '',
  skipDesign: false,
  skipAnalyze: false,
  skipImplement: false,
  skipVerify: false,
  autoHealEnabled: true,
  maxHealAttempts: 2,
  batchSizeFallback: 15,
  pauseBetweenBatches: false,
  budget: {
    maxPerBatch: 5,
    maxTotal: 50,
    healingBudget: 2,
    decisionBudget: 0.5,
  },
};

/**
 * Config with all skips enabled (fast path)
 */
export const skipAllConfig: OrchestrationConfig = {
  ...defaultConfig,
  skipDesign: true,
  skipAnalyze: true,
  skipImplement: true,
  skipVerify: true,
};

// =============================================================================
// Batch Fixtures
// =============================================================================

/**
 * Create a batch item with defaults
 */
export function createBatchItem(overrides: Partial<BatchItem> = {}): BatchItem {
  return {
    index: 0,
    section: 'Test Section',
    taskIds: ['T001', 'T002'],
    status: 'pending',
    healAttempts: 0,
    ...overrides,
  };
}

/**
 * Create batch tracking with defaults
 */
export function createBatchTracking(overrides: Partial<BatchTracking> = {}): BatchTracking {
  return {
    total: 2,
    current: 0,
    items: [
      createBatchItem({ index: 0, section: 'Phase 1', taskIds: ['T001', 'T002', 'T003'] }),
      createBatchItem({ index: 1, section: 'Phase 2', taskIds: ['T004', 'T005'] }),
    ],
    ...overrides,
  };
}

// =============================================================================
// Execution Fixtures
// =============================================================================

/**
 * Create an orchestration execution with defaults
 */
export function createOrchestration(
  overrides: Partial<OrchestrationExecution> = {}
): OrchestrationExecution {
  const id = overrides.id || 'orch-test-123';
  const projectId = overrides.projectId || 'project-test';

  return {
    id,
    projectId,
    status: 'running',
    config: defaultConfig,
    currentPhase: 'design',
    batches: createBatchTracking(),
    executions: {
      implement: [],
      healers: [],
    },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    decisionLog: [],
    totalCostUsd: 0,
    ...overrides,
  };
}

/**
 * Create an orchestration at a specific phase
 */
export function createOrchestrationAtPhase(
  phase: OrchestrationPhase,
  overrides: Partial<OrchestrationExecution> = {}
): OrchestrationExecution {
  const executions: OrchestrationExecution['executions'] = {
    implement: [],
    healers: [],
  };

  // Add workflow IDs for completed phases
  if (['analyze', 'implement', 'verify', 'merge', 'complete'].includes(phase)) {
    executions.design = 'wf-design-done';
  }
  if (['implement', 'verify', 'merge', 'complete'].includes(phase)) {
    executions.analyze = 'wf-analyze-done';
  }
  if (['verify', 'merge', 'complete'].includes(phase)) {
    executions.implement = ['wf-impl-1', 'wf-impl-2'];
  }
  if (['merge', 'complete'].includes(phase)) {
    executions.verify = 'wf-verify-done';
  }

  return createOrchestration({
    currentPhase: phase,
    executions,
    ...overrides,
  });
}

// =============================================================================
// Workflow Fixtures
// =============================================================================

export interface MockWorkflow {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_input';
  error?: string;
  costUsd?: number;
}

/**
 * Create a mock workflow
 */
export function createWorkflow(overrides: Partial<MockWorkflow> = {}): MockWorkflow {
  return {
    id: 'wf-test-123',
    status: 'running',
    ...overrides,
  };
}

// =============================================================================
// Specflow Status Fixtures
// =============================================================================

export interface MockSpecflowStatus {
  context?: {
    hasSpec?: boolean;
    hasPlan?: boolean;
    hasTasks?: boolean;
  };
  progress?: {
    tasksTotal?: number;
    tasksComplete?: number;
    percentage?: number;
  };
  orchestration?: {
    step?: {
      current?: string;
      status?: string;
    };
  };
}

/**
 * Create a mock specflow status
 */
export function createSpecflowStatus(overrides: Partial<MockSpecflowStatus> = {}): MockSpecflowStatus {
  return {
    context: {
      hasSpec: true,
      hasPlan: true,
      hasTasks: true,
      ...overrides.context,
    },
    progress: {
      tasksTotal: 10,
      tasksComplete: 0,
      percentage: 0,
      ...overrides.progress,
    },
    orchestration: {
      step: {
        current: 'design',
        status: 'in_progress',
        ...overrides.orchestration?.step,
      },
      ...overrides.orchestration,
    },
  };
}

/**
 * Create status showing design phase complete
 */
export function createDesignCompleteStatus(): MockSpecflowStatus {
  return createSpecflowStatus({
    context: { hasSpec: true, hasPlan: true, hasTasks: true },
  });
}

/**
 * Create status showing all tasks complete
 */
export function createAllTasksCompleteStatus(): MockSpecflowStatus {
  return createSpecflowStatus({
    progress: { tasksTotal: 10, tasksComplete: 10, percentage: 100 },
  });
}

// =============================================================================
// Decision Input Fixtures
// =============================================================================

export interface MockDecisionInput {
  step: { current: string; status: string };
  phase: { hasUserGate?: boolean; userGateStatus?: string };
  execution: OrchestrationExecution;
  workflow?: MockWorkflow;
  lastFileChangeTime?: number;
  lookupFailures?: number;
  currentTime?: number;
}

/**
 * Create a decision input for testing makeDecision
 */
export function createDecisionInput(overrides: Partial<MockDecisionInput> = {}): MockDecisionInput {
  return {
    step: { current: 'design', status: 'in_progress' },
    phase: {},
    execution: createOrchestration(),
    ...overrides,
  };
}

// =============================================================================
// Mock Dependencies (G12.9)
// =============================================================================

/**
 * Create a complete mock of OrchestrationDeps for testing
 *
 * @param overrides - Optional overrides to customize specific mock functions
 * @returns A fully mocked OrchestrationDeps object
 *
 * @example
 * ```typescript
 * const deps = createMockDeps({
 *   readState: vi.fn().mockResolvedValue(customState),
 * });
 * ```
 */
export function createMockDeps(
  overrides: Partial<OrchestrationDeps> = {}
): OrchestrationDeps {
  // Default mock orchestration service with all methods
  const mockOrchestrationService = {
    get: vi.fn().mockReturnValue(createOrchestration()),
    create: vi.fn().mockReturnValue(createOrchestration()),
    update: vi.fn(),
    updateBatches: vi.fn(),
    completeBatch: vi.fn(),
    incrementHealAttempt: vi.fn(),
    healBatch: vi.fn(),
    canHealBatch: vi.fn().mockReturnValue(true),
    fail: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    addCost: vi.fn(),
    transitionToNextPhase: vi.fn(),
    triggerMerge: vi.fn(),
    linkWorkflowExecution: vi.fn(),
    setNeedsAttention: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    delete: vi.fn(),
  };

  // Default mock workflow service with all methods
  const mockWorkflowService = {
    start: vi.fn().mockResolvedValue(createWorkflow()),
    get: vi.fn().mockReturnValue(createWorkflow()),
    list: vi.fn().mockReturnValue([]),
    cancel: vi.fn(),
    hasActiveWorkflow: vi.fn().mockReturnValue(false),
    findActiveByOrchestration: vi.fn().mockReturnValue([]),
    cleanup: vi.fn(),
  };

  return {
    // Required dependencies
    orchestrationService: {
      ...mockOrchestrationService,
      ...overrides.orchestrationService,
    } as unknown as OrchestrationDeps['orchestrationService'],

    workflowService: {
      ...mockWorkflowService,
      ...overrides.workflowService,
    } as unknown as OrchestrationDeps['workflowService'],

    getNextPhase: overrides.getNextPhase ?? vi.fn().mockReturnValue('implement'),

    isPhaseComplete: overrides.isPhaseComplete ?? vi.fn().mockReturnValue(false),

    // Optional dependencies with sensible defaults
    attemptHeal: overrides.attemptHeal ?? vi.fn().mockResolvedValue({
      success: true,
      cost: 0.01,
      result: { status: 'fixed' },
    }),

    quickDecision: overrides.quickDecision ?? vi.fn().mockResolvedValue({
      result: { action: 'wait', reason: 'Test decision' },
      cost: 0.01,
    }),

    parseBatchesFromProject: overrides.parseBatchesFromProject ?? vi.fn().mockReturnValue({
      batches: [
        { section: 'Test Section', taskIds: ['T001', 'T002'], incomplete: 2 },
      ],
      totalIncomplete: 2,
    }),
  };
}
