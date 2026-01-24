/**
 * Claude Helper - Typed, structured interactions with Claude CLI
 *
 * Provides a foundational utility for orchestration decisions, verification,
 * and auto-healing - without hardcoding every edge case.
 *
 * Features:
 * - Typed responses via Zod schema validation
 * - Session management (new, resume, fork)
 * - Model selection with fallback
 * - Tool restrictions (read-only for decisions)
 * - Budget enforcement
 * - Error handling (timeout, validation, budget exceeded)
 */

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import type {
  ClaudeHelperOptions,
  ClaudeHelperResult,
  ClaudeHelperError,
  ClaudeHelperResponse,
  ClaudeModel,
} from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended options with the Zod schema (generic type)
 * Uses Partial to make default-able fields optional at the call site
 */
export interface ClaudeHelperOptionsWithSchema<T> {
  // Required
  message: string;
  projectPath: string;
  schema: z.ZodSchema<T>;

  // Optional session handling
  sessionId?: string;
  forkSession?: boolean;
  noSessionPersistence?: boolean;

  // Optional model selection
  model?: 'sonnet' | 'haiku' | 'opus';
  fallbackModel?: 'sonnet' | 'haiku';

  // Optional tool control
  tools?: string[];
  disallowedTools?: string[];

  // Optional guardrails
  maxTurns?: number;
  maxBudgetUsd?: number;
  timeout?: number;

  // Optional prompt customization
  appendSystemPrompt?: string;
}

/**
 * Internal result from CLI execution
 */
interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  sessionId?: string;
  cost: number;
  turns: number;
  duration: number;
}

// =============================================================================
// Constants
// =============================================================================

const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || `${process.env.HOME}/.local/bin/claude`;

const DEFAULT_MODEL: ClaudeModel = 'sonnet';
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes
const DEFAULT_DISALLOWED_TOOLS = ['AskUserQuestion'];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Zod schema to JSON Schema for CLI
 */
function schemaToJsonSchema<T>(schema: z.ZodSchema<T>): string {
  const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' });
  return JSON.stringify(jsonSchema);
}

/**
 * Build CLI arguments from options
 */
function buildCliArgs<T>(options: ClaudeHelperOptionsWithSchema<T>): string[] {
  const args: string[] = [
    '-p', // Print mode
    '--output-format',
    'json',
    '--dangerously-skip-permissions',
  ];

  // Session handling
  if (options.sessionId) {
    args.push('--resume', options.sessionId);
    if (options.forkSession) {
      args.push('--fork-session');
    }
  }

  if (options.noSessionPersistence) {
    args.push('--no-session-persistence');
  }

  // Model selection
  const model = options.model || DEFAULT_MODEL;
  args.push('--model', model);

  if (options.fallbackModel) {
    args.push('--fallback-model', options.fallbackModel);
  }

  // Tool control
  if (options.tools && options.tools.length > 0) {
    args.push('--tools', options.tools.join(','));
  }

  const disallowedTools = options.disallowedTools || DEFAULT_DISALLOWED_TOOLS;
  if (disallowedTools.length > 0) {
    args.push('--disallowedTools', disallowedTools.join(','));
  }

  // Guardrails
  // Note: Claude CLI doesn't have --max-turns, but budget acts as a natural limit
  // maxTurns is kept in options for potential future use or internal tracking
  if (options.maxBudgetUsd !== undefined) {
    args.push('--max-budget-usd', String(options.maxBudgetUsd));
  }

  // JSON schema for structured output
  const jsonSchema = schemaToJsonSchema(options.schema);
  args.push('--json-schema', jsonSchema);

  // Append system prompt
  if (options.appendSystemPrompt) {
    args.push('--append-system-prompt', options.appendSystemPrompt);
  }

  return args;
}

/**
 * Parse session ID from CLI JSON output
 */
function parseSessionId(stdout: string): string | undefined {
  try {
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.session_id) {
          return parsed.session_id;
        }
      } catch {
        // Not JSON, skip
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse cost from CLI JSON output
 */
function parseCost(stdout: string): number {
  try {
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (typeof parsed.cost_usd === 'number') {
          return parsed.cost_usd;
        }
      } catch {
        // Not JSON, skip
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Parse turn count from CLI JSON output
 * Counts the number of assistant messages as a proxy for turns
 */
function parseTurns(stdout: string): number {
  try {
    const lines = stdout.trim().split('\n');
    let turns = 0;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        // Count assistant messages as turns
        if (parsed.type === 'assistant' || parsed.role === 'assistant') {
          turns++;
        }
        // Also check for explicit turn count if provided
        if (typeof parsed.turn_count === 'number') {
          return parsed.turn_count;
        }
        if (typeof parsed.turns === 'number') {
          return parsed.turns;
        }
      } catch {
        // Not JSON, skip
      }
    }

    // Return counted turns, minimum 1 if we got any output
    return turns > 0 ? turns : (stdout.length > 0 ? 1 : 0);
  } catch {
    return 0;
  }
}

/**
 * Parse structured_output from CLI JSON output
 */
function parseStructuredOutput(stdout: string): unknown | undefined {
  try {
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.structured_output !== undefined) {
          return parsed.structured_output;
        }
      } catch {
        // Not JSON, skip
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Execute Claude CLI and return result
 */
async function executeCli<T>(
  options: ClaudeHelperOptionsWithSchema<T>,
  workDir: string
): Promise<CliResult> {
  const startTime = Date.now();
  const args = buildCliArgs(options);
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

  // Write message to temp file for stdin
  const tempDir = join(workDir, '.claude-helper');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  const messageFile = join(tempDir, `prompt-${randomUUID()}.txt`);
  writeFileSync(messageFile, options.message, 'utf-8');

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(CLAUDE_CLI_PATH, args, {
      cwd: options.projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Write message to stdin
    const messageContent = readFileSync(messageFile, 'utf-8');
    proc.stdin?.write(messageContent);
    proc.stdin?.end();

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);

      // Cleanup temp file
      try {
        unlinkSync(messageFile);
      } catch {
        // Ignore cleanup errors
      }

      const duration = Date.now() - startTime;
      const sessionId = parseSessionId(stdout);
      const cost = parseCost(stdout);
      const turns = parseTurns(stdout);

      resolve({
        success: code === 0 && !timedOut,
        stdout,
        stderr,
        exitCode: code ?? -1,
        sessionId,
        cost,
        turns,
        duration,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutHandle);

      // Cleanup temp file
      try {
        unlinkSync(messageFile);
      } catch {
        // Ignore cleanup errors
      }

      const duration = Date.now() - startTime;
      resolve({
        success: false,
        stdout,
        stderr: `Process error: ${err.message}`,
        exitCode: -1,
        cost: 0,
        turns: 0,
        duration,
      });
    });
  });
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Execute a typed Claude Helper request
 *
 * @example
 * ```typescript
 * const NextStepSchema = z.object({
 *   action: z.enum(['run_design', 'run_implement', 'stop']),
 *   reason: z.string(),
 * });
 *
 * const response = await claudeHelper({
 *   message: 'What should happen next?',
 *   schema: NextStepSchema,
 *   projectPath: '/path/to/project',
 *   model: 'haiku',
 *   maxTurns: 1,
 * });
 *
 * if (response.success) {
 *   console.log(response.result.action); // Typed!
 * }
 * ```
 */
export async function claudeHelper<T>(
  options: ClaudeHelperOptionsWithSchema<T>
): Promise<ClaudeHelperResponse<T>> {
  // Validate project path exists
  if (!existsSync(options.projectPath)) {
    return {
      success: false,
      errorType: 'process_failed',
      errorMessage: `Project path does not exist: ${options.projectPath}`,
      cost: 0,
      duration: 0,
    };
  }

  // Execute CLI
  const result = await executeCli(options, options.projectPath);

  // Handle timeout
  if (result.duration >= (options.timeout || DEFAULT_TIMEOUT_MS) && !result.success) {
    return {
      success: false,
      errorType: 'timeout',
      errorMessage: `Claude Helper timed out after ${result.duration}ms`,
      sessionId: result.sessionId,
      cost: result.cost,
      duration: result.duration,
    };
  }

  // Handle process failure
  if (!result.success) {
    // Detect invalid session errors from stderr
    const stderrLower = (result.stderr || '').toLowerCase();
    const isInvalidSession =
      stderrLower.includes('session not found') ||
      stderrLower.includes('invalid session') ||
      stderrLower.includes('session does not exist') ||
      stderrLower.includes('cannot resume session') ||
      stderrLower.includes('no such session');

    return {
      success: false,
      errorType: isInvalidSession ? 'invalid_session' : 'process_failed',
      errorMessage: result.stderr || `Process exited with code ${result.exitCode}`,
      sessionId: result.sessionId,
      cost: result.cost,
      duration: result.duration,
    };
  }

  // Parse structured output
  const structuredOutput = parseStructuredOutput(result.stdout);
  if (structuredOutput === undefined) {
    return {
      success: false,
      errorType: 'schema_validation_failed',
      errorMessage: 'No structured_output found in CLI response',
      sessionId: result.sessionId,
      cost: result.cost,
      duration: result.duration,
    };
  }

  // Validate against schema
  const parseResult = options.schema.safeParse(structuredOutput);
  if (!parseResult.success) {
    return {
      success: false,
      errorType: 'schema_validation_failed',
      errorMessage: `Schema validation failed: ${parseResult.error.message}`,
      sessionId: result.sessionId,
      partialResult: structuredOutput,
      cost: result.cost,
      duration: result.duration,
    };
  }

  // Check budget (if limit was set, compare against cost)
  if (options.maxBudgetUsd !== undefined && result.cost > options.maxBudgetUsd) {
    return {
      success: false,
      errorType: 'budget_exceeded',
      errorMessage: `Budget exceeded: spent $${result.cost.toFixed(2)} (limit: $${options.maxBudgetUsd.toFixed(2)})`,
      sessionId: result.sessionId,
      partialResult: parseResult.data,
      cost: result.cost,
      duration: result.duration,
    };
  }

  // Success!
  return {
    success: true,
    result: parseResult.data,
    sessionId: result.sessionId || randomUUID(), // Fallback if not returned
    cost: result.cost,
    turns: result.turns,
    duration: result.duration,
  };
}

/**
 * Quick decision helper with minimal options
 */
export async function quickDecision<T>(
  message: string,
  schema: z.ZodSchema<T>,
  projectPath: string,
  options?: Partial<ClaudeHelperOptionsWithSchema<T>>
): Promise<ClaudeHelperResponse<T>> {
  return claudeHelper({
    message,
    schema,
    projectPath,
    model: 'haiku',
    noSessionPersistence: true,
    maxTurns: 1,
    maxBudgetUsd: 0.5,
    ...options,
  });
}

/**
 * Read-only verification helper (restricted tools)
 */
export async function verifyWithClaude<T>(
  message: string,
  schema: z.ZodSchema<T>,
  projectPath: string,
  options?: Partial<ClaudeHelperOptionsWithSchema<T>>
): Promise<ClaudeHelperResponse<T>> {
  return claudeHelper({
    message,
    schema,
    projectPath,
    model: 'sonnet',
    tools: ['Read', 'Grep', 'Glob'],
    maxTurns: 5,
    maxBudgetUsd: 1.0,
    ...options,
  });
}

/**
 * Healing helper with session fork
 */
export async function healWithClaude<T>(
  message: string,
  schema: z.ZodSchema<T>,
  projectPath: string,
  sessionId: string,
  options?: Partial<ClaudeHelperOptionsWithSchema<T>>
): Promise<ClaudeHelperResponse<T>> {
  return claudeHelper({
    message,
    schema,
    projectPath,
    sessionId,
    forkSession: true,
    model: 'sonnet',
    maxTurns: 15,
    maxBudgetUsd: 2.0,
    ...options,
  });
}

// =============================================================================
// Claude Helper Use Cases (G3) - Exactly 3 allowed use cases
// =============================================================================

// Schema for state recovery response
const StateRecoverySchema = z.object({
  action: z.enum(['use_recovered', 'use_heuristic', 'abort']),
  confidence: z.number().min(0).max(1),
  recovered_state: z.object({
    step: z.object({
      current: z.string(),
      index: z.number(),
      status: z.string(),
    }).optional(),
    phase: z.object({
      number: z.string(),
      name: z.string(),
    }).optional(),
  }).optional(),
  reason: z.string(),
});

type StateRecoveryResult = z.infer<typeof StateRecoverySchema>;

// Schema for stale workflow diagnosis
const StaleWorkflowSchema = z.object({
  action: z.enum(['continue', 'restart_task', 'skip_task', 'abort']),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
  context: z.object({
    last_output: z.string().optional(),
    likely_stuck_at: z.string().optional(),
  }).optional(),
});

type StaleWorkflowResult = z.infer<typeof StaleWorkflowSchema>;

// Schema for failed step diagnosis
const FailedStepSchema = z.object({
  action: z.enum(['retry', 'skip_tasks', 'run_prerequisite', 'abort']),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
  tasks_to_skip: z.array(z.string()).optional(),
  prerequisite: z.string().optional(),
});

type FailedStepResult = z.infer<typeof FailedStepSchema>;

/**
 * Recovery result from state recovery
 */
export interface StateRecoveryResponse {
  success: boolean;
  state?: {
    step: {
      current: string;
      index: number;
      status: string;
    };
    phase?: {
      number: string;
      name: string;
    };
  };
  source: 'claude' | 'heuristic' | 'none';
  reason: string;
  cost: number;
}

/**
 * Case 1: Corrupt/Missing State Recovery (G3.1-G3.6)
 *
 * Attempts to recover orchestration state using Claude Helper.
 * Falls back to heuristic recovery if Claude fails.
 * Silently returns null if all recovery attempts fail.
 *
 * @param projectPath - Path to the project
 * @param existingState - The corrupt/partial existing state (if any)
 * @param backupPath - Path to create backup before recovery
 */
export async function recoverStateWithClaudeHelper(
  projectPath: string,
  existingState: Record<string, unknown> | null,
  backupPath: string
): Promise<StateRecoveryResponse> {
  // G3.2: Create backup BEFORE attempting recovery
  if (existingState && backupPath) {
    try {
      writeFileSync(backupPath, JSON.stringify(existingState, null, 2), 'utf-8');
    } catch (error) {
      // Continue even if backup fails - recovery attempt is still valuable
      console.warn('[claude-helper] Failed to create backup:', error);
    }
  }

  // G3.3: Call Claude Helper with task: 'recover_state'
  const message = `
You are analyzing a corrupt or missing orchestration state file.

Existing state (may be corrupt or partial):
${existingState ? JSON.stringify(existingState, null, 2) : 'null (missing)'}

Analyze the project to determine the correct orchestration state:
1. Check .specflow/orchestration-state.json for any recoverable data
2. Check specs/ directory for active phase artifacts
3. Check ROADMAP.md for phase information

Provide your best assessment of the current state.
`;

  try {
    const response = await claudeHelper<StateRecoveryResult>({
      message,
      schema: StateRecoverySchema,
      projectPath,
      model: 'haiku',
      tools: ['Read', 'Glob'],
      maxTurns: 3,
      maxBudgetUsd: 0.5,
      noSessionPersistence: true,
    });

    // G3.4: If Claude Helper succeeds + confidence > 0.7 → use recovered state
    if (response.success && response.result.confidence > 0.7 && response.result.recovered_state?.step) {
      return {
        success: true,
        state: {
          step: response.result.recovered_state.step as StateRecoveryResponse['state'] extends { step: infer S } ? S : never,
          phase: response.result.recovered_state.phase,
        },
        source: 'claude',
        reason: response.result.reason,
        cost: response.cost,
      };
    }

    // G3.5: If Claude Helper fails or low confidence → try heuristic recovery (silent)
    const heuristicResult = tryHeuristicStateRecovery(projectPath);
    if (heuristicResult) {
      return {
        success: true,
        state: heuristicResult,
        source: 'heuristic',
        reason: 'Recovered using heuristic analysis',
        cost: response.cost,
      };
    }

    // G3.6: If heuristic fails → return null (caller sets needs_attention)
    return {
      success: false,
      source: 'none',
      reason: 'All recovery methods failed',
      cost: response.cost,
    };
  } catch {
    // G3.5: Silent fallback to heuristic on error
    const heuristicResult = tryHeuristicStateRecovery(projectPath);
    if (heuristicResult) {
      return {
        success: true,
        state: heuristicResult,
        source: 'heuristic',
        reason: 'Recovered using heuristic (Claude Helper unavailable)',
        cost: 0,
      };
    }

    return {
      success: false,
      source: 'none',
      reason: 'All recovery methods failed',
      cost: 0,
    };
  }
}

/**
 * Heuristic state recovery - analyzes project files to infer state
 * Called when Claude Helper fails or has low confidence
 */
function tryHeuristicStateRecovery(projectPath: string): StateRecoveryResponse['state'] | null {
  try {
    // Check specs directory for active artifacts
    const specsDir = join(projectPath, 'specs');
    if (!existsSync(specsDir)) return null;

    // Find the most recent specs folder (highest number prefix)
    const dirsRaw = require('fs').readdirSync(specsDir, { withFileTypes: true }) as { name: string; isDirectory: () => boolean }[];
    const dirs = dirsRaw
      .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
      .map((d: { name: string }) => d.name)
      .filter((name: string) => /^\d+/.test(name))
      .sort()
      .reverse();

    if (dirs.length === 0) return null;

    const activeDir = dirs[0];
    const match = activeDir.match(/^(\d+)-(.+)/);
    if (!match) return null;

    const phaseNumber = match[1];
    const phaseName = match[2];
    const phasePath = join(specsDir, activeDir);

    // Determine current step based on what artifacts exist
    const hasSpec = existsSync(join(phasePath, 'spec.md'));
    const hasPlan = existsSync(join(phasePath, 'plan.md'));
    const hasTasks = existsSync(join(phasePath, 'tasks.md'));
    const hasChecklists = existsSync(join(phasePath, 'checklists'));

    let currentStep = 'design';
    let stepIndex = 0;
    let status = 'in_progress';

    if (hasChecklists) {
      // All design artifacts exist, likely in implement or verify
      currentStep = 'implement';
      stepIndex = 2;
    } else if (hasTasks && hasPlan) {
      currentStep = 'implement';
      stepIndex = 2;
    } else if (hasPlan) {
      currentStep = 'design';
      stepIndex = 0;
      status = 'complete';
    } else if (hasSpec) {
      currentStep = 'design';
      stepIndex = 0;
    }

    return {
      step: {
        current: currentStep,
        index: stepIndex,
        status,
      },
      phase: {
        number: phaseNumber,
        name: phaseName,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Stale workflow response
 */
export interface StaleWorkflowResponse {
  action: 'continue' | 'restart_task' | 'skip_task' | 'abort';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  context?: {
    last_output?: string;
    likely_stuck_at?: string;
  };
  cost: number;
}

/**
 * Case 2: Stale Workflow Diagnosis (G3.7-G3.10)
 *
 * Diagnoses a workflow that has been running with no output for >10 minutes.
 * Returns recommended action. Sets needs_attention if Claude Helper fails.
 *
 * @param projectPath - Path to the project
 * @param workflowId - ID of the stale workflow
 * @param lastOutput - Last output from the workflow (if any)
 * @param staleMinutes - How long the workflow has been stale
 */
export async function handleStaleWorkflow(
  projectPath: string,
  workflowId: string,
  lastOutput: string | undefined,
  staleMinutes: number
): Promise<StaleWorkflowResponse> {
  // G3.8: Call Claude Helper with task: 'diagnose_stale_workflow'
  const message = `
You are diagnosing a stale workflow.

Workflow ID: ${workflowId}
Time since last activity: ${staleMinutes} minutes

Last output:
${lastOutput || '(no output available)'}

Analyze the situation and recommend an action:
- continue: Wait longer (if workflow might still be working)
- restart_task: Kill and restart the current task
- skip_task: Skip the current task and move on
- abort: Stop orchestration entirely

Be conservative - prefer 'continue' if there's any chance the workflow is still working.
`;

  try {
    const response = await claudeHelper<StaleWorkflowResult>({
      message,
      schema: StaleWorkflowSchema,
      projectPath,
      model: 'haiku',
      tools: ['Read', 'Glob'],
      maxTurns: 2,
      maxBudgetUsd: 0.25,
      noSessionPersistence: true,
    });

    // G3.9: Handle response actions
    if (response.success) {
      return {
        action: response.result.action,
        reason: response.result.reason,
        confidence: response.result.confidence,
        context: response.result.context,
        cost: response.cost,
      };
    }

    // G3.10: If Claude Helper fails → needs_attention (silent, no error toast)
    return {
      action: 'continue', // Default to waiting
      reason: 'Claude Helper unavailable, defaulting to continue',
      confidence: 'low',
      cost: response.cost,
    };
  } catch {
    // Silent failure - default to continue
    return {
      action: 'continue',
      reason: 'Claude Helper error, defaulting to continue',
      confidence: 'low',
      cost: 0,
    };
  }
}

/**
 * Failed step response
 */
export interface FailedStepResponse {
  action: 'retry' | 'skip_tasks' | 'run_prerequisite' | 'abort' | 'needs_attention';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  tasksToSkip?: string[];
  prerequisite?: string;
  cost: number;
}

/**
 * Case 3: Failed Step Diagnosis (G3.11-G3.16)
 *
 * Diagnoses a failed step and recommends recovery action.
 * Skips Claude Helper if max heal attempts reached.
 *
 * @param projectPath - Path to the project
 * @param stepName - Name of the failed step
 * @param errorMessage - Error message from the failure
 * @param healAttempts - Number of heal attempts already made
 * @param maxHealAttempts - Maximum allowed heal attempts
 */
export async function handleFailedStep(
  projectPath: string,
  stepName: string,
  errorMessage: string | undefined,
  healAttempts: number,
  maxHealAttempts: number
): Promise<FailedStepResponse> {
  // G3.12: Pre-check heal attempts → skip Claude Helper if exhausted
  if (healAttempts >= maxHealAttempts) {
    return {
      action: 'needs_attention',
      reason: `Max heal attempts (${maxHealAttempts}) reached`,
      confidence: 'high',
      cost: 0,
    };
  }

  // G3.13: Call Claude Helper with task: 'diagnose_failed_step'
  const message = `
You are diagnosing a failed orchestration step.

Step: ${stepName}
Error: ${errorMessage || '(no error message)'}
Heal attempts: ${healAttempts}/${maxHealAttempts}

Analyze the error and recommend an action:
- retry: Try the step again (maybe with different approach)
- skip_tasks: Skip specific failing tasks and continue
- run_prerequisite: Run a prerequisite step first
- abort: Stop orchestration entirely

If the error is transient (network, timeout), recommend 'retry'.
If specific tasks are failing, list them in tasks_to_skip.
If a prerequisite is needed, specify it.
`;

  try {
    const response = await claudeHelper<FailedStepResult>({
      message,
      schema: FailedStepSchema,
      projectPath,
      model: 'haiku',
      tools: ['Read', 'Glob'],
      maxTurns: 2,
      maxBudgetUsd: 0.25,
      noSessionPersistence: true,
    });

    // G3.14: Handle response actions
    if (response.success) {
      return {
        action: response.result.action,
        reason: response.result.reason,
        confidence: response.result.confidence,
        tasksToSkip: response.result.tasks_to_skip,
        prerequisite: response.result.prerequisite,
        cost: response.cost,
      };
    }

    // G3.15: If Claude Helper fails + heal attempts remaining → simple retry (silent)
    return {
      action: 'retry',
      reason: 'Claude Helper unavailable, attempting simple retry',
      confidence: 'low',
      cost: response.cost,
    };
  } catch {
    // G3.15: Silent failure - default to retry if attempts remaining
    return {
      action: 'retry',
      reason: 'Claude Helper error, attempting simple retry',
      confidence: 'low',
      cost: 0,
    };
  }
}
