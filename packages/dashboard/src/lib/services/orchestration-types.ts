/**
 * Orchestration Types - Dependency Injection Interfaces
 *
 * This module defines the dependency injection interfaces for orchestration
 * to enable testing and separation of concerns.
 *
 * Key interfaces:
 * - OrchestrationDeps: All external dependencies for the orchestration runner
 * - Clock: Time abstraction for testability
 * - StateIO: File I/O abstraction for state management
 * - WorkflowIO: Workflow management abstraction
 */

import type {
  OrchestrationState,
  WorkflowExecution,
  BatchPlan,
  OrchestrationConfig,
  OrchestrationStatus,
  OrchestrationPhase,
  DecisionLogEntry,
  BatchTracking,
} from '@specflow/shared';

// =============================================================================
// OrchestrationExecution Type (Legacy Compatibility)
// =============================================================================

/**
 * Legacy OrchestrationExecution type - kept for dashboard compatibility
 * This was previously in @specflow/shared/schemas/orchestration-execution.ts
 * Now defined locally as we transition to CLI state as single source of truth
 */
export interface OrchestrationExecution {
  /** Unique identifier */
  id: string;
  /** Project ID from registry */
  projectId: string;
  /** Current status */
  status: OrchestrationStatus;
  /** Configuration options */
  config: OrchestrationConfig;
  /** Current phase */
  currentPhase: OrchestrationPhase;
  /** Batch tracking */
  batches: BatchTracking;
  /** Linked workflow execution IDs */
  executions: {
    design?: string;
    analyze?: string;
    implement: string[];
    verify?: string;
    merge?: string;
    healers?: string[];
  };
  /** ISO timestamp when started */
  startedAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** ISO timestamp when completed/failed */
  completedAt?: string;
  /** Decision log for debugging */
  decisionLog: DecisionLogEntry[];
  /** Total cost in USD */
  totalCostUsd: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Recovery context for needs_attention state */
  recoveryContext?: {
    issue: string;
    options: Array<'retry' | 'skip' | 'abort'>;
    failedWorkflowId?: string;
  };
}

// =============================================================================
// Clock Interface (NFR-003 - Testability)
// =============================================================================

/**
 * Clock abstraction for time-based logic
 *
 * Allows tests to control time without depending on real time.
 */
export interface Clock {
  /** Get current timestamp in milliseconds */
  now(): number;
  /** Get current ISO timestamp string */
  isoNow(): string;
}

/**
 * Default clock implementation using real time
 */
export const realClock: Clock = {
  now: () => Date.now(),
  isoNow: () => new Date().toISOString(),
};

// =============================================================================
// State I/O Interface
// =============================================================================

/**
 * State file I/O abstraction
 *
 * Enables atomic writes and testable file operations.
 */
export interface StateIO {
  /**
   * Read orchestration state from project
   * @param projectPath - Path to project root
   * @returns State or null if not found
   */
  readState(projectPath: string): Promise<OrchestrationState | null>;

  /**
   * Write orchestration state atomically
   * Uses temp file + rename pattern for atomicity
   * @param projectPath - Path to project root
   * @param state - State to write
   */
  writeState(projectPath: string, state: OrchestrationState): Promise<void>;

  /**
   * Read orchestration execution state
   * @param projectPath - Path to project root
   * @param orchestrationId - UUID of the orchestration
   * @returns Execution state or null if not found
   */
  readExecution(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Write orchestration execution state atomically
   * @param projectPath - Path to project root
   * @param orchestrationId - UUID of the orchestration
   * @param execution - Execution state to write
   */
  writeExecution(projectPath: string, orchestrationId: string, execution: OrchestrationExecution): Promise<void>;

  /**
   * Create backup of state file before recovery
   * @param projectPath - Path to project root
   * @returns Path to backup file
   */
  createBackup(projectPath: string): Promise<string>;
}

// =============================================================================
// Workflow I/O Interface
// =============================================================================

/**
 * Workflow management abstraction
 */
export interface WorkflowIO {
  /**
   * Get workflow by ID
   * @param workflowId - Workflow UUID
   * @param projectId - Project ID
   * @returns Workflow execution or undefined
   */
  getWorkflow(workflowId: string, projectId: string): WorkflowExecution | undefined;

  /**
   * Check if orchestration has an active workflow
   * @param projectId - Project ID
   * @param orchestrationId - Orchestration UUID
   * @returns True if active workflow exists
   */
  hasActiveWorkflow(projectId: string, orchestrationId: string): boolean;

  /**
   * Find active workflows by orchestration
   * @param projectId - Project ID
   * @param orchestrationId - Orchestration UUID
   * @returns Array of active workflows
   */
  findActiveByOrchestration(projectId: string, orchestrationId: string): WorkflowExecution[];

  /**
   * Start a new workflow
   * @param projectId - Project ID
   * @param skill - Skill command to run
   * @param timeout - Optional timeout
   * @param resumeSessionId - Optional session ID to resume
   * @param orchestrationId - Optional orchestration ID to link
   * @returns Started workflow execution
   */
  startWorkflow(
    projectId: string,
    skill: string,
    timeout?: number,
    resumeSessionId?: string,
    orchestrationId?: string
  ): Promise<WorkflowExecution>;

  /**
   * Kill a running workflow
   * @param workflowId - Workflow UUID
   */
  killWorkflow(workflowId: string): Promise<void>;
}

// =============================================================================
// Orchestration Service Interface
// =============================================================================

/**
 * Orchestration service abstraction
 */
export interface OrchestrationIO {
  /**
   * Get orchestration execution by ID
   */
  get(projectPath: string, orchestrationId: string): OrchestrationExecution | null;

  /**
   * Update orchestration state
   */
  update(projectPath: string, orchestrationId: string, updates: Partial<OrchestrationExecution>): Promise<OrchestrationExecution | null>;

  /**
   * Transition to next phase
   */
  transitionToNextPhase(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Link workflow execution to orchestration
   */
  linkWorkflowExecution(projectPath: string, orchestrationId: string, workflowId: string): Promise<OrchestrationExecution | null>;

  /**
   * Add cost to orchestration
   */
  addCost(projectPath: string, orchestrationId: string, cost: number): Promise<OrchestrationExecution | null>;

  /**
   * Update batch tracking
   */
  updateBatches(projectPath: string, orchestrationId: string, batchPlan: BatchPlan): Promise<OrchestrationExecution | null>;

  /**
   * Complete current batch
   */
  completeBatch(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Mark batch as healed
   */
  healBatch(projectPath: string, orchestrationId: string, healerSessionId: string): Promise<OrchestrationExecution | null>;

  /**
   * Increment heal attempt counter
   */
  incrementHealAttempt(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Check if batch can be healed (has remaining attempts)
   */
  canHealBatch(projectPath: string, orchestrationId: string): boolean;

  /**
   * Set orchestration to needs_attention status
   */
  setNeedsAttention(
    projectPath: string,
    orchestrationId: string,
    issue: string,
    options: Array<'retry' | 'skip' | 'abort'>,
    failedWorkflowId?: string
  ): Promise<OrchestrationExecution | null>;

  /**
   * Pause orchestration
   */
  pause(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Resume orchestration from paused state
   */
  resume(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Trigger merge phase
   */
  triggerMerge(projectPath: string, orchestrationId: string): Promise<OrchestrationExecution | null>;

  /**
   * Mark orchestration as failed
   */
  fail(projectPath: string, orchestrationId: string, errorMessage: string): Promise<OrchestrationExecution | null>;
}

// =============================================================================
// Batch Parser Interface
// =============================================================================

/**
 * Batch parsing abstraction
 */
export interface BatchParser {
  /**
   * Parse batches from project's tasks.md
   * @param projectPath - Path to project root
   * @param fallbackBatchSize - Batch size if no sections found
   * @returns Batch plan or null if no tasks
   */
  parseBatches(projectPath: string, fallbackBatchSize: number): BatchPlan | null;
}

// =============================================================================
// File Activity Interface
// =============================================================================

/**
 * File activity tracking abstraction
 */
export interface FileActivityTracker {
  /**
   * Get last modification time of any relevant file
   * @param projectPath - Path to project root
   * @returns Timestamp in milliseconds
   */
  getLastFileChangeTime(projectPath: string): number;
}

// =============================================================================
// Main Dependencies Interface (NFR-003)
// =============================================================================

/**
 * All external dependencies for the orchestration runner
 *
 * This interface enables:
 * - Unit testing with mocks
 * - Separation of pure logic from I/O
 * - Easy swapping of implementations
 */
export interface OrchestrationDeps {
  /** Clock for time operations */
  clock: Clock;

  /** State file I/O */
  stateIO: StateIO;

  /** Workflow management */
  workflowIO: WorkflowIO;

  /** Orchestration service */
  orchestrationIO: OrchestrationIO;

  /** Batch parser */
  batchParser: BatchParser;

  /** File activity tracking */
  fileActivity: FileActivityTracker;
}

// =============================================================================
// Runner Context
// =============================================================================

/**
 * Context passed through the orchestration runner
 */
export interface RunnerContext {
  /** Project ID from registry */
  projectId: string;
  /** Path to project root */
  projectPath: string;
  /** Orchestration UUID */
  orchestrationId: string;
  /** Polling interval in ms */
  pollingInterval: number;
  /** Max polling attempts before timeout */
  maxPollingAttempts: number;
  /** Counter for consecutive unclear decisions */
  consecutiveUnclearChecks: number;
  /** Dependencies */
  deps: OrchestrationDeps;
}

// =============================================================================
// Spawn Intent Pattern Types (FR-006)
// =============================================================================

/**
 * Spawn intent for preventing duplicate workflow spawns
 */
export interface SpawnIntent {
  /** Skill being spawned */
  skill: string;
  /** Timestamp when intent was created */
  timestamp: number;
  /** Context for implement batches */
  context?: string;
}
