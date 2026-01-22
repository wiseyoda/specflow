/**
 * Auto-Healing Service - Recovery from batch failures
 *
 * Captures failure context and spawns healer Claude to fix issues.
 *
 * Features:
 * - Capture error details, stderr, failed tasks (FR-041)
 * - Build healer prompt with full context
 * - Spawn healer via Claude Helper with fork session
 * - Handle success/failure outcomes
 * - Limit heal attempts per batch (FR-043)
 */

import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { z } from 'zod';
import { claudeHelper, healWithClaude } from './claude-helper';
import { HealingResultSchema, type HealingResult } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

/**
 * Failure context captured from a failed batch
 */
export interface FailureContext {
  /** Error message from the failure */
  errorMessage: string;
  /** Stderr output if available */
  stderr: string;
  /** Section name from tasks.md */
  section: string;
  /** All task IDs in the batch */
  attemptedTaskIds: string[];
  /** Task IDs that completed before failure */
  completedTaskIds: string[];
  /** Task IDs that failed or were not attempted */
  failedTaskIds: string[];
  /** Session ID of the failed execution */
  sessionId?: string;
  /** Additional context from the workflow */
  additionalContext?: string;
  /** Last N messages from the session transcript (FR-041) */
  sessionTranscript?: string;
}

/**
 * Result from healer attempt
 */
export interface HealerResult {
  success: boolean;
  result?: HealingResult;
  errorMessage?: string;
  sessionId?: string;
  cost: number;
  duration: number;
}

// =============================================================================
// Failure Context Capture (FR-041, T022)
// =============================================================================

/**
 * Capture failure context from workflow execution
 *
 * @param projectPath - Path to the project
 * @param executionId - Workflow execution ID that failed
 * @param section - Section name from tasks.md
 * @param taskIds - All task IDs in the batch
 * @returns Captured failure context
 */
export function captureFailureContext(
  projectPath: string,
  executionId: string,
  section: string,
  taskIds: string[]
): FailureContext {
  // Default context
  const context: FailureContext = {
    errorMessage: 'Unknown failure',
    stderr: '',
    section,
    attemptedTaskIds: taskIds,
    completedTaskIds: [],
    failedTaskIds: taskIds, // Assume all failed until we check
  };

  // Try to load workflow execution metadata
  const workflowDir = join(projectPath, '.specflow', 'workflows');

  // Check multiple possible locations for execution metadata
  const possiblePaths = [
    join(workflowDir, `pending-${executionId}.json`),
    // Check session directories
    ...findSessionDirs(workflowDir).map((dir) => join(dir, 'metadata.json')),
  ];

  for (const metadataPath of possiblePaths) {
    if (existsSync(metadataPath)) {
      try {
        const content = readFileSync(metadataPath, 'utf-8');
        const metadata = JSON.parse(content);

        if (metadata.id === executionId || !context.errorMessage) {
          context.errorMessage = metadata.error || metadata.stderr || 'Execution failed';
          context.stderr = metadata.stderr || '';
          context.sessionId = metadata.sessionId;
          break;
        }
      } catch {
        // Continue to next path
      }
    }
  }

  // Try to determine completed tasks by checking tasks.md
  const completedTaskIds = getCompletedTaskIds(projectPath, taskIds);
  context.completedTaskIds = completedTaskIds;
  context.failedTaskIds = taskIds.filter((id) => !completedTaskIds.includes(id));

  // Capture session transcript if available (FR-041)
  if (context.sessionId) {
    const transcript = getSessionTranscript(context.sessionId, 10);
    if (transcript) {
      context.sessionTranscript = transcript;
    }
  }

  return context;
}

/**
 * Find session directories in workflow dir
 */
function findSessionDirs(workflowDir: string): string[] {
  if (!existsSync(workflowDir)) return [];

  try {
    const entries = readdirSync(workflowDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('pending-'))
      .map((e) => join(workflowDir, e.name));
  } catch {
    return [];
  }
}

/**
 * Get session transcript from JSONL file (FR-041)
 * Reads the last N messages from the Claude session history
 *
 * @param sessionId - The session ID to look up
 * @param maxMessages - Maximum number of messages to retrieve (default: 10)
 * @returns Formatted transcript string or undefined if not found
 */
function getSessionTranscript(sessionId: string | undefined, maxMessages: number = 10): string | undefined {
  if (!sessionId) {
    console.log('[auto-healing] No session ID provided for transcript retrieval');
    return undefined;
  }

  const homeDir = process.env.HOME || '';

  // Session JSONL files are stored in ~/.claude/projects/{project-hash}/{session-id}.jsonl
  // We need to search for the session file
  const claudeProjectsDir = join(homeDir, '.claude', 'projects');

  if (!existsSync(claudeProjectsDir)) {
    console.log(`[auto-healing] Claude projects directory not found: ${claudeProjectsDir}`);
    return undefined;
  }

  try {
    // Search through project directories for the session file
    const projectDirs = readdirSync(claudeProjectsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => join(claudeProjectsDir, e.name));

    for (const projectDir of projectDirs) {
      const sessionFile = join(projectDir, `${sessionId}.jsonl`);
      if (existsSync(sessionFile)) {
        const transcript = parseSessionTranscript(sessionFile, maxMessages);
        if (transcript) {
          console.log(`[auto-healing] Found session transcript for ${sessionId} (${transcript.length} chars)`);
        }
        return transcript;
      }
    }

    console.log(`[auto-healing] Session file not found for ${sessionId} in ${projectDirs.length} project directories`);
    return undefined;
  } catch (error) {
    console.error(`[auto-healing] Error searching for session transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return undefined;
  }
}

/**
 * Parse session JSONL file and extract last N messages
 */
function parseSessionTranscript(sessionFile: string, maxMessages: number): string {
  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: Array<{ role: string; content: string }> = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);

        // Look for message events from Claude or user
        if (event.type === 'assistant' && event.message?.content) {
          // Extract text content from assistant messages
          const textParts = Array.isArray(event.message.content)
            ? event.message.content
                .filter((c: { type: string }) => c.type === 'text')
                .map((c: { text: string }) => c.text)
                .join('\n')
            : String(event.message.content);

          if (textParts) {
            messages.push({ role: 'assistant', content: textParts.slice(0, 500) });
          }
        } else if (event.type === 'user' && event.message?.content) {
          const textContent = Array.isArray(event.message.content)
            ? event.message.content
                .filter((c: { type: string }) => c.type === 'text')
                .map((c: { text: string }) => c.text)
                .join('\n')
            : String(event.message.content);

          if (textContent) {
            messages.push({ role: 'user', content: textContent.slice(0, 500) });
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Get last N messages
    const recentMessages = messages.slice(-maxMessages);

    if (recentMessages.length === 0) return '';

    // Format as transcript
    return recentMessages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');
  } catch {
    return '';
  }
}

/**
 * Get completed task IDs by checking tasks.md
 */
function getCompletedTaskIds(projectPath: string, taskIds: string[]): string[] {
  const specsDir = join(projectPath, 'specs');
  if (!existsSync(specsDir)) return [];

  // Find current phase directory
  try {
    const entries = readdirSync(specsDir, { withFileTypes: true });
    const phaseDirs = entries
      .filter((e) => e.isDirectory() && /^\d{4}-/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();

    if (phaseDirs.length === 0) return [];

    const tasksPath = join(specsDir, phaseDirs[0], 'tasks.md');
    if (!existsSync(tasksPath)) return [];

    const content = readFileSync(tasksPath, 'utf-8');
    const completed: string[] = [];

    // Check each task ID for completion marker
    for (const id of taskIds) {
      // Pattern: - [x] T### or - [X] T###
      const completedPattern = new RegExp(`^[-*]\\s*\\[[xX]\\]\\s*${id}`, 'm');
      if (completedPattern.test(content)) {
        completed.push(id);
      }
    }

    return completed;
  } catch {
    return [];
  }
}

// =============================================================================
// Healer Prompt Building (FR-041)
// =============================================================================

/**
 * Build prompt for healer Claude
 *
 * @param context - Failure context from captureFailureContext
 * @returns Formatted prompt string for healer
 */
export function buildHealerPrompt(context: FailureContext): string {
  const prompt = `# Auto-Heal Request

A batch implementation failed and needs recovery. Your task is to complete the remaining tasks.

## Failure Details

**Section**: ${context.section}
**Error**: ${context.errorMessage}

${context.stderr ? `**Stderr**:\n\`\`\`\n${context.stderr.slice(0, 2000)}\n\`\`\`` : ''}

${context.sessionTranscript ? `## Recent Session Transcript

The following is the last portion of the conversation before the failure:

\`\`\`
${context.sessionTranscript.slice(0, 3000)}
\`\`\`` : ''}

## Task Status

**Attempted Tasks**: ${context.attemptedTaskIds.join(', ')}
**Completed Before Failure**: ${context.completedTaskIds.length > 0 ? context.completedTaskIds.join(', ') : 'None'}
**Tasks Needing Completion**: ${context.failedTaskIds.join(', ')}

## Instructions

1. **Analyze the error** - Understand what went wrong
2. **Fix the root cause** - Address the underlying issue (missing file, syntax error, etc.)
3. **Complete remaining tasks** - Implement the tasks listed above that weren't completed
4. **Verify fixes** - Ensure tests pass and no new errors are introduced

Focus ONLY on the remaining tasks: ${context.failedTaskIds.join(', ')}
Do NOT re-implement already completed tasks.

${context.additionalContext ? `## Additional Context\n\n${context.additionalContext}` : ''}

## Expected Output

Return a HealingResult with:
- status: 'fixed' (all tasks complete), 'partial' (some tasks done), or 'failed' (couldn't fix)
- tasksCompleted: Array of task IDs you completed
- tasksRemaining: Array of task IDs still incomplete
- fixApplied: Description of what you fixed (if applicable)
- blockerReason: Why you couldn't complete (if failed/partial)`;

  return prompt;
}

// =============================================================================
// Healer Execution (FR-040, FR-042)
// =============================================================================

/**
 * Spawn healer Claude to fix a failed batch
 *
 * @param projectPath - Path to the project
 * @param context - Failure context
 * @param budgetUsd - Maximum budget for healing attempt
 * @returns Healer result
 */
export async function spawnHealer(
  projectPath: string,
  context: FailureContext,
  budgetUsd: number = 2.0
): Promise<HealerResult> {
  const prompt = buildHealerPrompt(context);

  try {
    // Use healWithClaude which forks the session if available
    const response = context.sessionId
      ? await healWithClaude(prompt, HealingResultSchema, projectPath, context.sessionId, {
          maxBudgetUsd: budgetUsd,
        })
      : await claudeHelper({
          message: prompt,
          schema: HealingResultSchema,
          projectPath,
          model: 'sonnet',
          maxTurns: 15,
          maxBudgetUsd: budgetUsd,
          noSessionPersistence: false, // Keep session for potential retry
        });

    if (response.success) {
      return {
        success: response.result.status === 'fixed',
        result: response.result,
        sessionId: response.sessionId,
        cost: response.cost,
        duration: response.duration,
      };
    } else {
      // Type narrowing: response is ClaudeHelperError when success is false
      const errorResponse = response as { errorMessage: string; sessionId?: string; cost: number; duration: number };
      return {
        success: false,
        errorMessage: errorResponse.errorMessage,
        sessionId: errorResponse.sessionId,
        cost: errorResponse.cost,
        duration: errorResponse.duration,
      };
    }
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error during healing',
      cost: 0,
      duration: 0,
    };
  }
}

/**
 * Attempt to heal a failed batch
 *
 * @param projectPath - Path to the project
 * @param executionId - Failed workflow execution ID
 * @param section - Section name from tasks.md
 * @param taskIds - Task IDs in the batch
 * @param sessionId - Optional session ID to fork
 * @param budgetUsd - Maximum budget for healing
 * @returns Healer result
 */
export async function attemptHeal(
  projectPath: string,
  executionId: string,
  section: string,
  taskIds: string[],
  sessionId?: string,
  budgetUsd: number = 2.0
): Promise<HealerResult> {
  // Capture failure context
  const context = captureFailureContext(projectPath, executionId, section, taskIds);

  // Override session ID if provided
  if (sessionId) {
    context.sessionId = sessionId;
  }

  // Check if there are tasks to heal
  if (context.failedTaskIds.length === 0) {
    return {
      success: true,
      result: {
        status: 'fixed',
        tasksCompleted: context.completedTaskIds,
        tasksRemaining: [],
      },
      cost: 0,
      duration: 0,
    };
  }

  // Spawn healer
  return spawnHealer(projectPath, context, budgetUsd);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a healing result indicates success
 */
export function isHealingSuccessful(result: HealingResult): boolean {
  return result.status === 'fixed';
}

/**
 * Check if a healing result indicates partial progress
 */
export function isHealingPartial(result: HealingResult): boolean {
  return result.status === 'partial';
}

/**
 * Get summary of healing result for logging
 */
export function getHealingSummary(result: HealerResult): string {
  if (result.success && result.result) {
    const r = result.result;
    if (r.status === 'fixed') {
      return `Healed: completed ${r.tasksCompleted.length} tasks`;
    }
    if (r.status === 'partial') {
      return `Partial: completed ${r.tasksCompleted.length}, remaining ${r.tasksRemaining.length}`;
    }
    return `Failed: ${r.blockerReason || 'unknown reason'}`;
  }
  return `Error: ${result.errorMessage || 'unknown error'}`;
}
