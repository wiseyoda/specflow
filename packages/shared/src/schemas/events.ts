import { z } from 'zod';
import { RegistrySchema } from './registry.js';
import { TasksDataSchema } from './tasks.js';
import { WorkflowDataSchema, QuestionOptionSchema, DashboardWorkflowStatusSchema } from './workflow.js';
import { PhasesDataSchema } from './phases.js';
import { OrchestrationConfigSchema } from './orchestration-config.js';

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
  'merge',
]);

/**
 * Step index mapping - single source of truth
 */
export const STEP_INDEX_MAP = {
  design: 0,
  analyze: 1,
  implement: 2,
  verify: 3,
  merge: 4,
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

/**
 * Batch status values (matches BatchStatusSchema from batch-item.ts)
 */
export const DashboardBatchStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'healed',
]);

/**
 * Orchestration status for dashboard.active
 * Also exported as OrchestrationStatusSchema for backward compatibility
 */
export const DashboardOrchestrationStatusSchema = z.enum([
  'running',
  'paused',
  'waiting_merge',
  'needs_attention',
  'completed',
  'failed',
  'cancelled',
]);

// Backward compatibility aliases
export const OrchestrationStatusSchema = DashboardOrchestrationStatusSchema;
export type OrchestrationStatus = z.infer<typeof OrchestrationStatusSchema>;

/**
 * Current phase in orchestration flow
 * Includes merge and complete phases beyond the basic workflow steps
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
 * Also exported as DecisionLogEntrySchema for backward compatibility
 */
export const DecisionLogEntrySchema = z.object({
  timestamp: z.string(),
  decision: z.string(),
  reason: z.string(),
  data: z.record(z.unknown()).optional(),
});

export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

/**
 * Batch item in dashboard state
 */
export const DashboardBatchItemSchema = z.object({
  section: z.string(),
  taskIds: z.array(z.string()),
  status: DashboardBatchStatusSchema,
  workflowId: z.string().optional(),
  healAttempts: z.number().default(0),
});

/**
 * Decision log entry for debugging
 */
export const DashboardDecisionLogEntrySchema = z.object({
  timestamp: z.string(),
  action: z.string(),
  reason: z.string(),
});

/**
 * Last workflow tracking for decision logic
 */
export const DashboardLastWorkflowSchema = z.object({
  id: z.string(),
  skill: z.string(),
  status: DashboardWorkflowStatusSchema,
});

/**
 * Dashboard state stored in CLI state file
 * Single source of truth for orchestration - replaces OrchestrationExecution
 */
export const DashboardStateSchema = z.object({
  /** Active orchestration run (null when no orchestration active) */
  active: z.object({
    id: z.string(),
    startedAt: z.string(),
    status: DashboardOrchestrationStatusSchema.default('running'),
    config: OrchestrationConfigSchema,
  }).nullable().default(null),

  /** Batch tracking for implement phase */
  batches: z.object({
    total: z.number().default(0),
    current: z.number().default(0),
    items: z.array(DashboardBatchItemSchema).default([]),
  }).default({ total: 0, current: 0, items: [] }),

  /** Cost tracking */
  cost: z.object({
    total: z.number().default(0),
    perBatch: z.array(z.number()).default([]),
  }).default({ total: 0, perBatch: [] }),

  /** Decision log for debugging */
  decisionLog: z.array(DashboardDecisionLogEntrySchema).default([]),

  /** Last workflow that was spawned (for decision logic) */
  lastWorkflow: DashboardLastWorkflowSchema.nullable().default(null),

  /** Recovery context when status is 'needs_attention' */
  recoveryContext: z.object({
    issue: z.string(),
    options: z.array(z.enum(['retry', 'skip', 'abort'])),
    failedWorkflowId: z.string().optional(),
  }).optional(),
});

export type DashboardState = z.infer<typeof DashboardStateSchema>;
export type DashboardBatchItem = z.infer<typeof DashboardBatchItemSchema>;
export type DashboardDecisionLogEntry = z.infer<typeof DashboardDecisionLogEntrySchema>;
export type DashboardLastWorkflow = z.infer<typeof DashboardLastWorkflowSchema>;
export type DashboardBatchStatus = z.infer<typeof DashboardBatchStatusSchema>;
export type DashboardOrchestrationStatus = z.infer<typeof DashboardOrchestrationStatusSchema>;

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
    // Dashboard state - single source of truth for orchestration (FR-001)
    dashboard: DashboardStateSchema.nullish(),
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
 * Session message schema for real-time session content
 * Matches the structure in session-parser.ts
 */
export const ToolCallInfoSchema = z.object({
  name: z.string(),
  operation: z.enum(['read', 'write', 'edit', 'search', 'execute', 'todo', 'agent']),
  files: z.array(z.string()),
  input: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Agent task information from Task tool calls
 */
export const AgentTaskInfoSchema = z.object({
  id: z.string(),
  description: z.string(),
  subagentType: z.string(),
  status: z.enum(['running', 'completed']),
});

export const SessionMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().optional(),
  toolCalls: z.array(ToolCallInfoSchema).optional(),
  isCommandInjection: z.boolean().optional(),
  commandName: z.string().optional(),
  isSessionEnd: z.boolean().optional(),
  questions: z.array(z.object({
    question: z.string(),
    header: z.string().optional(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string().optional(),
    })),
    multiSelect: z.boolean().optional(),
  })).optional(),
  agentTasks: z.array(AgentTaskInfoSchema).optional(),
});

export const TodoItemSchema = z.object({
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string(),
});

/**
 * Question from AskUserQuestion tool call (for session:question SSE events)
 * Uses QuestionOptionSchema from workflow.ts for consistency
 */
export const SessionQuestionSchema = z.object({
  question: z.string(),
  header: z.string().optional(),
  options: z.array(QuestionOptionSchema),
  multiSelect: z.boolean().optional(),
});

/**
 * Workflow output from StructuredOutput tool call
 */
export const WorkflowOutputSchema = z.object({
  status: z.string(), // 'completed' | 'error' | 'needs_input' | 'cancelled' | etc.
  phase: z.string().optional(),
  message: z.string().optional(),
  artifacts: z.array(z.object({
    path: z.string(),
    action: z.string(),
  })).optional(),
  questions: z.array(SessionQuestionSchema).optional(),
});

/**
 * Session content structure for SSE
 */
export const SessionContentSchema = z.object({
  messages: z.array(SessionMessageSchema),
  filesModified: z.array(z.string()),
  elapsedMs: z.number(),
  currentTodos: z.array(TodoItemSchema),
  workflowOutput: WorkflowOutputSchema.optional(),
  agentTasks: z.array(AgentTaskInfoSchema).optional(),
});

/**
 * SSE Event Types
 */
export const SSEEventTypeSchema = z.enum([
  'connected',        // Initial connection established
  'heartbeat',        // Keep-alive ping
  'registry',         // Registry file changed
  'state',            // Project state file changed
  'tasks',            // Project tasks.md file changed
  'workflow',         // Project workflow index changed
  'phases',           // Project ROADMAP.md phases changed
  'session:message',  // Session JSONL content changed
  'session:question', // AskUserQuestion detected
  'session:end',      // Session ended
  'session:created',  // New session JSONL file detected (G6.4)
  'session:activity', // Existing session JSONL file modified (G6.5)
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
 * Session message event - session JSONL content changed
 */
export const SessionMessageEventSchema = z.object({
  type: z.literal('session:message'),
  timestamp: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
  data: SessionContentSchema,
});

/**
 * Session question event - AskUserQuestion detected
 */
export const SessionQuestionEventSchema = z.object({
  type: z.literal('session:question'),
  timestamp: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
  data: z.object({
    questions: z.array(SessionQuestionSchema),
  }),
});

/**
 * Session end event - session ended
 */
export const SessionEndEventSchema = z.object({
  type: z.literal('session:end'),
  timestamp: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
});

/**
 * Session created event - new session JSONL file detected (G6.4)
 */
export const SessionCreatedEventSchema = z.object({
  type: z.literal('session:created'),
  timestamp: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
});

/**
 * Session activity event - existing session JSONL file modified (G6.5)
 */
export const SessionActivityEventSchema = z.object({
  type: z.literal('session:activity'),
  timestamp: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
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
  SessionMessageEventSchema,
  SessionQuestionEventSchema,
  SessionEndEventSchema,
  SessionCreatedEventSchema,
  SessionActivityEventSchema,
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
export type SessionMessageEvent = z.infer<typeof SessionMessageEventSchema>;
export type SessionQuestionEvent = z.infer<typeof SessionQuestionEventSchema>;
export type SessionEndEvent = z.infer<typeof SessionEndEventSchema>;
export type SessionCreatedEvent = z.infer<typeof SessionCreatedEventSchema>;
export type SessionActivityEvent = z.infer<typeof SessionActivityEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>;
export type ToolCallInfo = z.infer<typeof ToolCallInfoSchema>;
export type AgentTaskInfo = z.infer<typeof AgentTaskInfoSchema>;
export type SessionMessage = z.infer<typeof SessionMessageSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;
// QuestionOption is exported from workflow.ts
export type SessionQuestion = z.infer<typeof SessionQuestionSchema>;
export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;
export type SessionContent = z.infer<typeof SessionContentSchema>;
