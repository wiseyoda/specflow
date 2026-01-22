import { z } from 'zod';
import { RegistrySchema } from './registry.js';
import { TasksDataSchema } from './tasks.js';
import { WorkflowDataSchema } from './workflow.js';
import { PhasesDataSchema } from './phases.js';

/**
 * Schema for orchestration state (simplified for SSE events)
 */
/**
 * Valid step status values
 */
export const StepStatusSchema = z.enum([
  'not_started',
  'pending',
  'in_progress',
  'complete',
  'failed',
  'blocked',
  'skipped',
]);

/**
 * Valid workflow step names
 */
export const WorkflowStepSchema = z.enum([
  'design',
  'analyze',
  'implement',
  'verify',
]);

/**
 * Step index mapping - single source of truth
 */
export const STEP_INDEX_MAP = {
  design: 0,
  analyze: 1,
  implement: 2,
  verify: 3,
} as const;

/**
 * Valid phase status values
 */
export const PhaseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'complete',
]);

/**
 * User gate status values
 */
export const UserGateStatusSchema = z.enum([
  'pending',
  'confirmed',
  'skipped',
]);

export const OrchestrationStateSchema = z.object({
  schema_version: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
  }),
  last_updated: z.string().nullish(),
  // File modification time - added by watcher for activity tracking
  // More reliable than last_updated as it reflects any file write
  _fileMtime: z.string().nullish(),
  orchestration: z.object({
    phase: z.object({
      id: z.string().nullish(),
      number: z.string().nullish(),
      name: z.string().nullish(),
      branch: z.string().nullish(),
      status: PhaseStatusSchema.nullish(),
      // Phase goals - persisted for conversation compaction survival
      goals: z.array(z.string()).nullish(),
      // Whether phase has a USER GATE requiring confirmation
      hasUserGate: z.boolean().nullish(),
      // USER GATE confirmation status
      userGateStatus: UserGateStatusSchema.nullish(),
      // USER GATE criteria text (for compaction recovery)
      userGateCriteria: z.string().nullish(),
    }).nullish(),
    // Next pending phase from ROADMAP (populated on archive)
    next_phase: z.object({
      number: z.string().nullish(),
      name: z.string().nullish(),
      description: z.string().nullish(),
    }).nullish(),
    step: z.object({
      current: WorkflowStepSchema.nullish(),
      index: z.number().nullish(),
      status: StepStatusSchema.nullish(),
    }).nullish(),
    // Track analyze step state (iteration tracking for auto-fix loop)
    analyze: z.object({
      iteration: z.number().nullish(),
      completedAt: z.number().nullish(), // Unix timestamp
    }).nullish(),
    // Track currently in-progress tasks (batch tracking)
    implement: z.object({
      current_tasks: z.array(z.string()).nullish(),
      current_section: z.string().nullish(),
      started_at: z.string().nullish(),
    }).nullish(),
    // Progress tracking (set by phase/open, read by status)
    progress: z.object({
      tasks_completed: z.number().nullish(),
      tasks_total: z.number().nullish(),
      percentage: z.number().nullish(),
    }).nullish(),
  }).passthrough().nullish(),
  health: z.object({
    status: z.string().nullish(), // Values: ready, healthy, warning, error, initializing, migrated
    last_check: z.string().nullish(),
    issues: z.array(z.unknown()).nullish(),
  }).nullish(),
  // Memory management state
  memory: z.object({
    // Track which archived phases have been reviewed for memory promotion
    archive_reviews: z.record(z.string(), z.object({
      reviewed_at: z.string().nullish(),
      promotions: z.array(z.string()).nullish(),
      skipped: z.array(z.string()).nullish(),
    })).nullish(),
  }).nullish(),
  // Actions tracking (history of completed phases)
  actions: z.object({
    available: z.array(z.string()).nullish(),
    pending: z.array(z.string()).nullish(),
    history: z.array(z.object({
      // Phase completion entries (written by CLI phase/close)
      type: z.string().nullish(),
      phase_number: z.string().nullish(),
      phase_name: z.string().nullish(),
      branch: z.string().nullish(),
      completed_at: z.string().nullish(),
      tasks_completed: z.union([z.number(), z.string()]).nullish(),
      tasks_total: z.union([z.number(), z.string()]).nullish(),
      // Legacy fields (kept for backward compatibility)
      phase: z.string().nullish(),
      action: z.string().nullish(),
      timestamp: z.string().nullish(),
    }).passthrough()).nullish(),
  }).nullish(),
}).passthrough(); // Allow additional fields

export type StepStatus = z.infer<typeof StepStatusSchema>;

/**
 * SSE Event Types
 */
export const SSEEventTypeSchema = z.enum([
  'connected',    // Initial connection established
  'heartbeat',    // Keep-alive ping
  'registry',     // Registry file changed
  'state',        // Project state file changed
  'tasks',        // Project tasks.md file changed
  'workflow',     // Project workflow index changed
  'phases',       // Project ROADMAP.md phases changed
]);

/**
 * Connected event - sent when client first connects
 */
export const ConnectedEventSchema = z.object({
  type: z.literal('connected'),
  timestamp: z.string(),
});

/**
 * Heartbeat event - keep-alive ping
 */
export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  timestamp: z.string(),
});

/**
 * Registry event - registry.json changed
 */
export const RegistryEventSchema = z.object({
  type: z.literal('registry'),
  timestamp: z.string(),
  data: RegistrySchema,
});

/**
 * State event - project state file changed
 */
export const StateEventSchema = z.object({
  type: z.literal('state'),
  timestamp: z.string(),
  projectId: z.string(),
  data: OrchestrationStateSchema,
});

/**
 * Tasks event - project tasks.md file changed
 */
export const TasksEventSchema = z.object({
  type: z.literal('tasks'),
  timestamp: z.string(),
  projectId: z.string(),
  data: TasksDataSchema,
});

/**
 * Workflow event - project workflow index changed
 */
export const WorkflowSSEEventSchema = z.object({
  type: z.literal('workflow'),
  timestamp: z.string(),
  projectId: z.string(),
  data: WorkflowDataSchema,
});

/**
 * Phases event - project ROADMAP.md phases changed
 */
export const PhasesEventSchema = z.object({
  type: z.literal('phases'),
  timestamp: z.string(),
  projectId: z.string(),
  data: PhasesDataSchema,
});

/**
 * Union of all SSE event types
 */
export const SSEEventSchema = z.discriminatedUnion('type', [
  ConnectedEventSchema,
  HeartbeatEventSchema,
  RegistryEventSchema,
  StateEventSchema,
  TasksEventSchema,
  WorkflowSSEEventSchema,
  PhasesEventSchema,
]);

// Type exports
export type SSEEventType = z.infer<typeof SSEEventTypeSchema>;
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;
export type RegistryEvent = z.infer<typeof RegistryEventSchema>;
export type StateEvent = z.infer<typeof StateEventSchema>;
export type TasksEvent = z.infer<typeof TasksEventSchema>;
export type WorkflowSSEEvent = z.infer<typeof WorkflowSSEEventSchema>;
export type PhasesEvent = z.infer<typeof PhasesEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>;
