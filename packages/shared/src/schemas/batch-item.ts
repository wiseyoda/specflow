import { z } from 'zod';

/**
 * Status of a batch during orchestration
 */
export const BatchStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'healed',
]);

export type BatchStatus = z.infer<typeof BatchStatusSchema>;

/**
 * Individual batch tracking during implement phase
 * Each ## section in tasks.md becomes one batch
 */
export const BatchItemSchema = z.object({
  /** 0-indexed batch number */
  index: z.number().int().min(0),
  /** Section name from tasks.md (e.g., "Core Components") */
  section: z.string(),
  /** Task IDs in this batch (e.g., ["T001", "T002", "T003"]) */
  taskIds: z.array(z.string()),
  /** Current status of this batch */
  status: BatchStatusSchema,
  /** ISO timestamp when batch started */
  startedAt: z.string().datetime().optional(),
  /** ISO timestamp when batch completed */
  completedAt: z.string().datetime().optional(),
  /** Number of heal attempts made for this batch */
  healAttempts: z.number().int().min(0).default(0),
  /** Link to workflow execution ID for this batch */
  workflowExecutionId: z.string().optional(),
  /** Link to healer workflow execution ID if healed */
  healerExecutionId: z.string().optional(),
});

export type BatchItem = z.infer<typeof BatchItemSchema>;

/**
 * Batch tracking state during implement phase
 */
export const BatchTrackingSchema = z.object({
  /** Total number of batches */
  total: z.number().int().min(0),
  /** Current batch index (0-indexed) */
  current: z.number().int().min(0),
  /** All batch items */
  items: z.array(BatchItemSchema),
});

export type BatchTracking = z.infer<typeof BatchTrackingSchema>;

/**
 * Batch plan returned by batch parser
 * Used before orchestration starts to show batch count
 */
export const BatchPlanSchema = z.object({
  /** Detected batches with task groupings */
  batches: z.array(
    z.object({
      /** Section name */
      name: z.string(),
      /** Task IDs in this batch, sorted by dependencies */
      taskIds: z.array(z.string()),
      /** Count of incomplete tasks */
      incompleteCount: z.number().int().min(0),
      /** Task dependencies within this batch (taskId -> dependsOn[]) */
      dependencies: z.record(z.string(), z.array(z.string())).optional(),
    })
  ),
  /** Whether fallback batching was used (no ## sections) */
  usedFallback: z.boolean(),
  /** Fallback batch size if used */
  fallbackSize: z.number().int().optional(),
  /** Total incomplete tasks */
  totalIncomplete: z.number().int().min(0),
  /** Warnings about invalid dependencies (e.g., referencing non-existent tasks) */
  dependencyWarnings: z.array(z.string()).optional(),
});

export type BatchPlan = z.infer<typeof BatchPlanSchema>;
