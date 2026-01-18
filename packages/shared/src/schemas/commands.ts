import { z } from 'zod';

/**
 * Schema for a speckit subcommand
 */
export const SpeckitSubcommandSchema = z.object({
  name: z.string().describe('Subcommand name (e.g., "create", "list")'),
  description: z.string().describe('Brief description of what the subcommand does'),
  requiresArgs: z.boolean().describe('Whether the subcommand requires arguments'),
  argPrompt: z.string().optional().describe('Prompt text for required arguments'),
});

/**
 * Schema for a speckit command
 */
export const SpeckitCommandSchema = z.object({
  name: z.string().describe('Command name (e.g., "issue", "tasks")'),
  description: z.string().describe('Brief description of what the command does'),
  subcommands: z.array(SpeckitSubcommandSchema).describe('Available subcommands'),
});

/**
 * Schema for the command list response
 */
export const CommandListSchema = z.object({
  commands: z.array(SpeckitCommandSchema).describe('Available speckit commands'),
  lastRefreshed: z.string().describe('ISO 8601 timestamp of last refresh'),
});

/**
 * Execution status enum
 */
export const ExecutionStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);

/**
 * Schema for a command execution request
 */
export const CommandExecuteRequestSchema = z.object({
  command: z.string().min(1).describe('Command to execute (e.g., "issue create")'),
  args: z.array(z.string()).default([]).describe('Command arguments'),
  projectPath: z.string().min(1).describe('Absolute path to the project'),
});

/**
 * Schema for a command execution response
 */
export const CommandExecuteResponseSchema = z.object({
  executionId: z.string().uuid().describe('Unique ID for tracking this execution'),
  streamUrl: z.string().describe('SSE endpoint URL for streaming output'),
});

/**
 * Schema for SSE output events during command execution
 */
export const CommandOutputEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stdout'),
    data: z.string(),
  }),
  z.object({
    type: z.literal('stderr'),
    data: z.string(),
  }),
  z.object({
    type: z.literal('exit'),
    code: z.number(),
    signal: z.string().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

/**
 * Schema for a command execution record
 */
export const CommandExecutionSchema = z.object({
  id: z.string().uuid().describe('Execution ID'),
  command: z.string().describe('Full command executed'),
  args: z.array(z.string()).describe('Arguments passed'),
  projectPath: z.string().describe('Project path'),
  projectId: z.string().optional().describe('Project UUID if available'),
  status: ExecutionStatusSchema.describe('Current execution status'),
  exitCode: z.number().optional().describe('Exit code if completed'),
  output: z.array(z.string()).describe('Collected output lines'),
  startedAt: z.string().describe('ISO 8601 timestamp'),
  completedAt: z.string().optional().describe('ISO 8601 timestamp if completed'),
});

/**
 * Schema for command history entry (simplified for UI display)
 */
export const CommandHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  command: z.string(),
  status: ExecutionStatusSchema,
  startedAt: z.string(),
});

/**
 * Project status for action filtering
 */
export const ProjectStatusSchema = z.enum([
  'not_initialized',
  'initializing',
  'needs_setup',
  'ready',
  'error',
  'warning',
]);

/**
 * Action group for menu organization
 */
export const ActionGroupSchema = z.enum(['setup', 'maintenance', 'advanced']);

/**
 * Button variant for action styling
 */
export const ButtonVariantSchema = z.enum(['default', 'destructive', 'outline', 'secondary']);

/**
 * Schema for project action definitions
 */
export const ProjectActionSchema = z.object({
  id: z.string().describe('Unique action identifier'),
  label: z.string().describe('Display label'),
  description: z.string().describe('Short description for tooltips'),
  command: z.string().describe('CLI command to execute'),
  args: z.array(z.string()).describe('Default command arguments'),
  requiresConfirmation: z.boolean().describe('Whether confirmation is required'),
  confirmationTitle: z.string().optional().describe('Confirmation dialog title'),
  confirmationDescription: z.string().optional().describe('Confirmation dialog description'),
  confirmationItems: z.array(z.string()).optional().describe('Bullet list for confirmation'),
  applicableStatuses: z.array(ProjectStatusSchema).describe('Statuses where action applies'),
  variant: ButtonVariantSchema.describe('Button styling variant'),
  group: ActionGroupSchema.describe('Menu group'),
  showOnCard: z.boolean().optional().describe('Show as primary action on card'),
});

// Type exports
export type SpeckitSubcommand = z.infer<typeof SpeckitSubcommandSchema>;
export type SpeckitCommand = z.infer<typeof SpeckitCommandSchema>;
export type CommandList = z.infer<typeof CommandListSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type CommandExecuteRequest = z.infer<typeof CommandExecuteRequestSchema>;
export type CommandExecuteResponse = z.infer<typeof CommandExecuteResponseSchema>;
export type CommandOutputEvent = z.infer<typeof CommandOutputEventSchema>;
export type CommandExecution = z.infer<typeof CommandExecutionSchema>;
export type CommandHistoryEntry = z.infer<typeof CommandHistoryEntrySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ActionGroup = z.infer<typeof ActionGroupSchema>;
export type ButtonVariant = z.infer<typeof ButtonVariantSchema>;
export type ProjectAction = z.infer<typeof ProjectActionSchema>;
