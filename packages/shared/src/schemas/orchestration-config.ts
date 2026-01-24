import { z } from 'zod';

/**
 * Budget configuration for orchestration
 * Limits spending on batches, healing, and decisions
 */
export const OrchestrationBudgetSchema = z.object({
  /** Max cost per implement batch (USD) */
  maxPerBatch: z.number().min(0).default(5.0),
  /** Max total orchestration cost (USD) */
  maxTotal: z.number().min(0).default(50.0),
  /** Max cost per auto-heal attempt (USD) */
  healingBudget: z.number().min(0).default(2.0),
  /** Max cost per decision call (USD) */
  decisionBudget: z.number().min(0).default(0.5),
});

export type OrchestrationBudget = z.infer<typeof OrchestrationBudgetSchema>;

/**
 * User configuration from orchestration modal
 * Collected before starting autonomous execution
 */
export const OrchestrationConfigSchema = z.object({
  // Core options (always visible in modal)
  /** Automatically run /flow.merge after verify succeeds */
  autoMerge: z.boolean().default(false),
  /** Free-form text injected into all skill prompts */
  additionalContext: z.string().default(''),
  /** Skip /flow.design if specs already exist */
  skipDesign: z.boolean().default(false),
  /** Skip /flow.analyze step */
  skipAnalyze: z.boolean().default(false),
  /** Skip /flow.implement if all tasks are already complete */
  skipImplement: z.boolean().default(false),
  /** Skip /flow.verify if verify step is already complete */
  skipVerify: z.boolean().default(false),

  // Advanced options (collapsed section in modal)
  /** Attempt automatic recovery on batch failure */
  autoHealEnabled: z.boolean().default(true),
  /** Retry limit per batch (prevents infinite loops) */
  maxHealAttempts: z.number().int().min(0).max(5).default(1),
  /** Task count per batch if no ## sections found */
  batchSizeFallback: z.number().int().min(1).max(50).default(15),
  /** Require user confirmation between implement batches */
  pauseBetweenBatches: z.boolean().default(false),

  // Budget limits
  budget: OrchestrationBudgetSchema.default({}),
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  autoMerge: false,
  additionalContext: '',
  skipDesign: false,
  skipAnalyze: false,
  skipImplement: false,
  skipVerify: false,
  autoHealEnabled: true,
  maxHealAttempts: 1,
  batchSizeFallback: 15,
  pauseBetweenBatches: false,
  budget: {
    maxPerBatch: 5.0,
    maxTotal: 50.0,
    healingBudget: 2.0,
    decisionBudget: 0.5,
  },
};
