import { z } from 'zod';

/**
 * Model selection for Claude Helper
 */
export const ClaudeModelSchema = z.enum(['sonnet', 'haiku', 'opus']);

export type ClaudeModel = z.infer<typeof ClaudeModelSchema>;

/**
 * Error types that can occur during Claude Helper execution
 */
export const ClaudeHelperErrorTypeSchema = z.enum([
  'schema_validation_failed',
  'budget_exceeded',
  'timeout',
  'process_failed',
  'invalid_session',
  'unknown',
]);

export type ClaudeHelperErrorType = z.infer<typeof ClaudeHelperErrorTypeSchema>;

/**
 * Configuration options for Claude Helper calls
 * Passed to claudeHelper<T>(options) function
 */
export const ClaudeHelperOptionsSchema = z.object({
  // Session handling (one of these patterns)
  /** Resume existing session by ID */
  sessionId: z.string().optional(),
  /** Branch session (don't pollute original) */
  forkSession: z.boolean().optional(),
  /** Don't save session (quick decisions) */
  noSessionPersistence: z.boolean().optional(),

  // Core (required)
  /** What to send to Claude */
  message: z.string(),
  /** Working directory for Claude - required for file operations */
  projectPath: z.string(),
  // Note: schema is passed as a generic type parameter, not validated here

  // Model selection
  /** Model to use (default: sonnet) */
  model: ClaudeModelSchema.optional().default('sonnet'),
  /** Auto-fallback model if primary overloaded */
  fallbackModel: z.enum(['sonnet', 'haiku']).optional(),

  // Tool control
  /** Restrict to specific tools only */
  tools: z.array(z.string()).optional(),
  /** Block specific tools (default: ['AskUserQuestion']) */
  disallowedTools: z.array(z.string()).optional().default(['AskUserQuestion']),

  // Guardrails
  /** Limit agentic turns (default: 10) */
  maxTurns: z.number().int().min(1).max(100).optional().default(10),
  /** Cost cap for this call in USD */
  maxBudgetUsd: z.number().min(0).optional(),
  /** Process timeout in ms (default: 120000) */
  timeout: z.number().int().min(1000).optional().default(120000),

  // Prompt customization
  /** Add to default system prompt */
  appendSystemPrompt: z.string().optional(),
});

export type ClaudeHelperOptions = z.infer<typeof ClaudeHelperOptionsSchema>;

/**
 * Result from Claude Helper execution
 * Generic type T is the validated response matching the provided schema
 */
export const ClaudeHelperResultSchema = z.object({
  /** Whether the call succeeded - literal true for discriminated union */
  success: z.literal(true),
  /** Session ID for potential follow-up */
  sessionId: z.string(),
  /** USD spent on this call */
  cost: z.number().min(0),
  /** Agentic turns used */
  turns: z.number().int().min(0),
  /** Time in ms */
  duration: z.number().int().min(0),
  // Note: result is generic T, validated separately
});

export type ClaudeHelperResult<T> = z.infer<typeof ClaudeHelperResultSchema> & {
  success: true;
  result: T;
};

/**
 * Error result from Claude Helper
 * Returned when success=false
 */
export const ClaudeHelperErrorSchema = z.object({
  success: z.literal(false),
  /** Error type for programmatic handling */
  errorType: ClaudeHelperErrorTypeSchema,
  /** Human-readable error message */
  errorMessage: z.string(),
  /** Session ID if available */
  sessionId: z.string().optional(),
  /** Partial result if available */
  partialResult: z.unknown().optional(),
  /** USD spent before error */
  cost: z.number().min(0).default(0),
  /** Time in ms before error */
  duration: z.number().int().min(0).default(0),
});

export type ClaudeHelperError = z.infer<typeof ClaudeHelperErrorSchema>;

/**
 * Union type for Claude Helper response
 */
export type ClaudeHelperResponse<T> = ClaudeHelperResult<T> | ClaudeHelperError;

/**
 * Check if response is an error
 */
export function isClaudeHelperError<T>(
  response: ClaudeHelperResponse<T>
): response is ClaudeHelperError {
  return !response.success;
}

/**
 * Common schemas for Claude Helper responses
 */

/** Decision schema for orchestration state machine */
export const NextStepDecisionSchema = z.object({
  action: z.enum(['run_design', 'run_analyze', 'run_implement', 'run_verify', 'run_merge', 'wait', 'stop']),
  reason: z.string(),
  context: z.record(z.unknown()).optional(),
});

export type NextStepDecision = z.infer<typeof NextStepDecisionSchema>;

/** Verification schema for batch completion checking */
export const BatchVerificationSchema = z.object({
  completed: z.boolean(),
  tasksVerified: z.array(z.string()),
  failures: z
    .array(
      z.object({
        taskId: z.string(),
        reason: z.string(),
        evidence: z.string(),
      })
    )
    .optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type BatchVerification = z.infer<typeof BatchVerificationSchema>;

/** Healing schema for auto-heal attempts */
export const HealingResultSchema = z.object({
  status: z.enum(['fixed', 'partial', 'failed']),
  tasksCompleted: z.array(z.string()),
  tasksRemaining: z.array(z.string()),
  fixApplied: z.string().optional(),
  blockerReason: z.string().optional(),
});

export type HealingResult = z.infer<typeof HealingResultSchema>;
