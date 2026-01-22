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
import type { z } from 'zod';
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
