import { z } from 'zod';
import { OrchestrationConfigSchema } from './orchestration-config.js';
import { BatchTrackingSchema } from './batch-item.js';

/**
 * Status of the overall orchestration
 */
export const OrchestrationStatusSchema = z.enum([
  'running',
  'paused',
  'waiting_merge',
  'needs_attention', // Workflow failed/cancelled - awaiting user decision (retry, skip, abort)
  'completed',
  'failed',
  'cancelled',
]);

export type OrchestrationStatus = z.infer<typeof OrchestrationStatusSchema>;

/**
 * Current phase in orchestration flow
 */
export const OrchestrationPhaseSchema = z.enum([
  'design',
  'analyze',
  'implement',
  'verify',
  'merge',
  'complete',
]);

export type OrchestrationPhase = z.infer<typeof OrchestrationPhaseSchema>;

/**
 * Decision log entry for debugging orchestration decisions
 */
export const DecisionLogEntrySchema = z.object({
  /** ISO timestamp of the decision */
  timestamp: z.string().datetime(),
  /** What action was decided */
  decision: z.string(),
  /** Why this decision was made */
  reason: z.string(),
  /** Optional additional context/data */
  data: z.record(z.unknown()).optional(),
});

export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

/**
 * Linked workflow execution IDs for each orchestration step
 */
export const OrchestrationExecutionsSchema = z.object({
  /** Workflow execution ID for design phase */
  design: z.string().optional(),
  /** Workflow execution ID for analyze phase */
  analyze: z.string().optional(),
  /** Workflow execution IDs for implement batches (one per batch) */
  implement: z.array(z.string()).default([]),
  /** Workflow execution ID for verify phase */
  verify: z.string().optional(),
  /** Workflow execution ID for merge phase */
  merge: z.string().optional(),
  /** Auto-heal workflow execution IDs */
  healers: z.array(z.string()).default([]),
});

export type OrchestrationExecutions = z.infer<typeof OrchestrationExecutionsSchema>;

/**
 * Full orchestration execution state
 * Stored at {project}/.specflow/workflows/orchestration-{id}.json
 */
export const OrchestrationExecutionSchema = z.object({
  /** Unique identifier (UUID) */
  id: z.string().uuid(),
  /** Project ID from registry */
  projectId: z.string(),
  /** Current status */
  status: OrchestrationStatusSchema,

  /** User configuration from modal */
  config: OrchestrationConfigSchema,

  /** Current position in orchestration flow */
  currentPhase: OrchestrationPhaseSchema,

  /** Batch tracking during implement phase */
  batches: BatchTrackingSchema,

  /** Linked workflow execution IDs */
  executions: OrchestrationExecutionsSchema,

  /** ISO timestamp when orchestration started */
  startedAt: z.string().datetime(),
  /** ISO timestamp of last update */
  updatedAt: z.string().datetime(),
  /** ISO timestamp when orchestration completed */
  completedAt: z.string().datetime().optional(),

  /** Decision log for debugging */
  decisionLog: z.array(DecisionLogEntrySchema).default([]),

  /** Total cost spent so far (USD) */
  totalCostUsd: z.number().min(0).default(0),

  /** Error message if failed */
  errorMessage: z.string().optional(),

  /** Recovery context when status is 'needs_attention' */
  recoveryContext: z.object({
    /** What went wrong */
    issue: z.string(),
    /** Available recovery actions */
    options: z.array(z.enum(['retry', 'skip', 'abort'])),
    /** Workflow that caused the issue */
    failedWorkflowId: z.string().optional(),
  }).optional(),
});

export type OrchestrationExecution = z.infer<typeof OrchestrationExecutionSchema>;

/**
 * Create a new orchestration execution with defaults
 */
export function createOrchestrationExecution(
  id: string,
  projectId: string,
  config: z.infer<typeof OrchestrationConfigSchema>,
  batches: z.infer<typeof BatchTrackingSchema>
): OrchestrationExecution {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    status: 'running',
    config,
    currentPhase: config.skipDesign ? (config.skipAnalyze ? 'implement' : 'analyze') : 'design',
    batches,
    executions: {
      implement: [],
      healers: [],
    },
    startedAt: now,
    updatedAt: now,
    decisionLog: [],
    totalCostUsd: 0,
  };
}
