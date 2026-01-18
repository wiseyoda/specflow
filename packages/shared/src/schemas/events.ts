import { z } from 'zod';
import { RegistrySchema } from './registry.js';
import { TasksDataSchema } from './tasks.js';

/**
 * Schema for orchestration state (simplified for SSE events)
 */
/**
 * Valid step status values
 */
export const StepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'complete',
  'failed',
  'blocked',
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
      status: z.string().nullish(),
    }).nullish(),
    // Next pending phase from ROADMAP (populated on archive)
    next_phase: z.object({
      number: z.string().nullish(),
      name: z.string().nullish(),
      description: z.string().nullish(),
    }).nullish(),
    step: z.object({
      current: z.string().nullish(),
      index: z.union([z.number(), z.string()]).nullish(),
      status: z.string().nullish(), // Values: pending, in_progress, complete, failed, blocked, skipped
    }).nullish(),
    // Track currently in-progress tasks (batch tracking)
    implement: z.object({
      current_tasks: z.array(z.string()).nullish(),
      current_section: z.string().nullish(),
      started_at: z.string().nullish(),
    }).nullish(),
  }).passthrough().nullish(),
  health: z.object({
    status: z.string().nullish(), // Values: ready, healthy, warning, error, initializing, migrated
    last_check: z.string().nullish(),
    issues: z.array(z.unknown()).nullish(),
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
 * Union of all SSE event types
 */
export const SSEEventSchema = z.discriminatedUnion('type', [
  ConnectedEventSchema,
  HeartbeatEventSchema,
  RegistryEventSchema,
  StateEventSchema,
  TasksEventSchema,
]);

// Type exports
export type SSEEventType = z.infer<typeof SSEEventTypeSchema>;
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;
export type RegistryEvent = z.infer<typeof RegistryEventSchema>;
export type StateEvent = z.infer<typeof StateEventSchema>;
export type TasksEvent = z.infer<typeof TasksEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>;
