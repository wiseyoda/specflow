/**
 * Workflow Service - Production workflow execution management
 *
 * Refactored from workflow-executor.ts POC with:
 * - Project ID linking to registered dashboard projects
 * - Production state directory (~/.specflow/workflows/)
 * - Timeout and cancel support
 * - Zod validation for type safety
 */

import { exec, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { findRecentSessionFile } from '@/lib/project-hash';
import {
  spawnDetachedClaude,
  pollForCompletion,
  writePidFile,
  cleanupPidFile,
  isPidAlive,
  killProcess,
  readPidFile,
} from './process-spawner';
import { checkProcessHealth, getHealthStatusMessage, didSessionEndGracefully } from './process-health';
import { ensureReconciliation } from './process-reconciler';

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Question format (mirrors AskUserQuestion tool input)
 */
export const WorkflowQuestionSchema = z.object({
  question: z.string(),
  header: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  multiSelect: z.boolean().optional(),
});

export type WorkflowQuestion = z.infer<typeof WorkflowQuestionSchema>;

/**
 * Structured output from Claude CLI
 */
export const WorkflowOutputSchema = z.object({
  status: z.enum(['completed', 'needs_input', 'error']),
  phase: z.string().optional(),
  message: z.string().optional(),
  questions: z.array(WorkflowQuestionSchema).optional(),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        action: z.enum(['created', 'modified']),
      })
    )
    .optional(),
});

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

/**
 * Workflow execution state (persisted to disk)
 * Note: sessionId becomes available (required) after first CLI response completes.
 * It's obtained from CLI JSON output, not from polling.
 */
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().min(1), // Registry key (not necessarily UUID)
  sessionId: z.string().optional(), // Populated from CLI JSON output after first response
  orchestrationId: z.string().uuid().optional(), // Links workflow to orchestration (if any)
  skill: z.string(),
  status: z.enum([
    'running',
    'waiting_for_input',
    'completed',
    'failed',
    'cancelled',
    'detached', // Dashboard lost track but session may still be running
    'stale', // PID alive but session file hasn't updated (possibly stuck)
  ]),
  output: WorkflowOutputSchema.optional(),
  answers: z.record(z.string(), z.string()),
  logs: z.array(z.string()),
  stdout: z.string(),
  stderr: z.string(),
  error: z.string().optional(),
  costUsd: z.number(),
  startedAt: z.string(),
  updatedAt: z.string(),
  timeoutMs: z.number(),
  pid: z.number().optional(), // Bash shell PID (legacy)
  claudePid: z.number().optional(), // Actual claude CLI PID
  cancelledAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

/**
 * Start workflow request
 */
export const StartWorkflowRequestSchema = z.object({
  projectId: z.string().min(1), // Registry key (not necessarily UUID)
  skill: z.string().min(1),
  timeoutMs: z.number().positive().optional(),
  /** Optional session ID to resume (uses --resume flag per FR-014) */
  resumeSessionId: z.string().optional(),
});

export type StartWorkflowRequest = z.infer<typeof StartWorkflowRequestSchema>;

/**
 * Answer workflow request
 */
export const AnswerWorkflowRequestSchema = z.object({
  id: z.string().uuid(), // Execution ID is always UUID
  answers: z.record(z.string(), z.string()),
});

export type AnswerWorkflowRequest = z.infer<typeof AnswerWorkflowRequestSchema>;

/**
 * Workflow index entry for quick session listing
 * Stored at {project}/.specflow/workflows/index.json
 */
export const WorkflowIndexEntrySchema = z.object({
  sessionId: z.string(),
  executionId: z.string().uuid(),
  skill: z.string(),
  status: z.enum([
    'running',
    'waiting_for_input',
    'completed',
    'failed',
    'cancelled',
    'detached', // Dashboard lost track but session may still be running
    'stale', // PID alive but session file hasn't updated (possibly stuck)
  ]),
  startedAt: z.string(),
  updatedAt: z.string(),
  costUsd: z.number(),
});

export type WorkflowIndexEntry = z.infer<typeof WorkflowIndexEntrySchema>;

/**
 * Workflow index for a project
 * Provides quick lookup of all sessions without loading full metadata
 */
export const WorkflowIndexSchema = z.object({
  sessions: z.array(WorkflowIndexEntrySchema),
});

export type WorkflowIndex = z.infer<typeof WorkflowIndexSchema>;

// =============================================================================
// Constants
// =============================================================================

// 4 hours - workflows can run for extended periods during implementation phases
// This is a dashboard tracking timeout, not the actual CLI timeout
const DEFAULT_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * JSON Schema for workflow structured output (sent to Claude CLI)
 */
const WORKFLOW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'needs_input', 'error'],
    },
    phase: { type: 'string' },
    message: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          header: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          multiSelect: { type: 'boolean' },
        },
        required: ['question'],
      },
    },
    artifacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string' },
        },
      },
    },
  },
  required: ['status'],
};

// =============================================================================
// State Persistence - Project-Local Storage (Phase 1053)
// =============================================================================

// In-memory mapping of executionId -> projectPath for lookups
const executionProjectMap = new Map<string, string>();

// Track if cleanup has been performed this session
let globalCleanupDone = false;

/**
 * Clean up old global workflows from ~/.specflow/workflows/
 * Per FR-017: Skip active (running/waiting_for_input) workflows
 */
function cleanupGlobalWorkflows(): void {
  if (globalCleanupDone) return;
  globalCleanupDone = true;

  const homeDir = process.env.HOME || '/tmp';
  const globalDir = join(homeDir, '.specflow', 'workflows');

  if (!existsSync(globalDir)) return;

  try {
    const files = readdirSync(globalDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(globalDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Skip active workflows per FR-017 (includes detached/stale - session may still be running)
        if (['running', 'waiting_for_input', 'detached', 'stale'].includes(data.status)) {
          console.log(`[workflow-service] Skipping active workflow: ${file}`);
          continue;
        }

        // Delete completed/failed/cancelled workflows
        const { unlinkSync } = require('fs');
        unlinkSync(filePath);
        console.log(`[workflow-service] Cleaned up old workflow: ${file}`);
      } catch {
        // Skip files that can't be read/parsed
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Get the project-local workflow directory
 */
function getProjectWorkflowDir(projectPath: string): string {
  const workflowDir = join(projectPath, '.specflow', 'workflows');
  mkdirSync(workflowDir, { recursive: true });
  return workflowDir;
}

/**
 * Get path to the workflow index file for a project
 */
function getIndexPath(projectPath: string): string {
  return join(getProjectWorkflowDir(projectPath), 'index.json');
}

/**
 * Load the workflow index for a project
 */
function loadWorkflowIndex(projectPath: string): WorkflowIndex {
  const indexPath = getIndexPath(projectPath);
  if (!existsSync(indexPath)) {
    return { sessions: [] };
  }
  try {
    const content = readFileSync(indexPath, 'utf-8');
    return WorkflowIndexSchema.parse(JSON.parse(content));
  } catch {
    return { sessions: [] };
  }
}

/**
 * Save the workflow index for a project
 */
function saveWorkflowIndex(projectPath: string, index: WorkflowIndex): void {
  const indexPath = getIndexPath(projectPath);
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Update the workflow index with execution data
 */
function updateWorkflowIndex(projectPath: string, execution: WorkflowExecution): void {
  if (!execution.sessionId) return; // Can't index without session ID

  const index = loadWorkflowIndex(projectPath);
  const existingIdx = index.sessions.findIndex(s => s.sessionId === execution.sessionId);

  if (existingIdx >= 0) {
    // Update existing entry - preserve original skill name, update status/timestamps/cost
    const existing = index.sessions[existingIdx];
    index.sessions[existingIdx] = {
      ...existing,
      executionId: execution.id,
      status: execution.status,
      updatedAt: execution.updatedAt,
      costUsd: existing.costUsd + execution.costUsd,
    };
  } else {
    // New session - create full entry
    const entry: WorkflowIndexEntry = {
      sessionId: execution.sessionId,
      executionId: execution.id,
      skill: execution.skill,
      status: execution.status,
      startedAt: execution.startedAt,
      updatedAt: execution.updatedAt,
      costUsd: execution.costUsd,
    };
    index.sessions.unshift(entry); // Add to front (newest first)
  }

  // Limit to 50 sessions per project
  if (index.sessions.length > 50) {
    index.sessions = index.sessions.slice(0, 50);
  }

  saveWorkflowIndex(projectPath, index);
}

/**
 * Save execution state to project-local storage
 * - Before sessionId: {project}/.specflow/workflows/pending-{executionId}.json
 * - After sessionId: {project}/.specflow/workflows/{sessionId}/metadata.json
 */
function saveExecution(execution: WorkflowExecution, projectPath?: string): void {
  // Get project path from parameter, map, or registry
  let resolvedProjectPath: string | undefined = projectPath;
  if (!resolvedProjectPath) {
    resolvedProjectPath = executionProjectMap.get(execution.id);
  }
  if (!resolvedProjectPath) {
    const registryPath = getProjectPath(execution.projectId);
    if (registryPath) {
      resolvedProjectPath = registryPath;
    }
  }
  if (!resolvedProjectPath) {
    console.error(`[workflow-service] Cannot save execution: no project path for ${execution.id}`);
    return;
  }

  // Store mapping for future lookups
  executionProjectMap.set(execution.id, resolvedProjectPath);

  const workflowDir = getProjectWorkflowDir(resolvedProjectPath);

  if (execution.sessionId) {
    // Session ID available - use session-keyed storage
    const sessionDir = join(workflowDir, execution.sessionId);
    mkdirSync(sessionDir, { recursive: true });
    const metadataPath = join(sessionDir, 'metadata.json');
    writeFileSync(metadataPath, JSON.stringify(execution, null, 2));

    // Clean up pending file if it exists
    const pendingPath = join(workflowDir, `pending-${execution.id}.json`);
    if (existsSync(pendingPath)) {
      try {
        const { unlinkSync } = require('fs');
        unlinkSync(pendingPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Update the index
    updateWorkflowIndex(resolvedProjectPath, execution);
  } else {
    // No session ID yet - use pending storage
    const pendingPath = join(workflowDir, `pending-${execution.id}.json`);
    writeFileSync(pendingPath, JSON.stringify(execution, null, 2));
  }
}

/**
 * Load execution state from project-local storage
 */
function loadExecution(id: string, projectPath?: string): WorkflowExecution | null {
  // Get project path from parameter or map
  let resolvedProjectPath = projectPath;
  if (!resolvedProjectPath) {
    resolvedProjectPath = executionProjectMap.get(id);
  }
  if (!resolvedProjectPath) {
    return null;
  }

  const workflowDir = getProjectWorkflowDir(resolvedProjectPath);

  // Try pending file first
  const pendingPath = join(workflowDir, `pending-${id}.json`);
  if (existsSync(pendingPath)) {
    try {
      const content = readFileSync(pendingPath, 'utf-8');
      return WorkflowExecutionSchema.parse(JSON.parse(content));
    } catch {
      // Continue to check session dirs
    }
  }

  // Search session directories for matching execution ID
  try {
    const entries = readdirSync(workflowDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('pending-')) {
        const metadataPath = join(workflowDir, entry.name, 'metadata.json');
        if (existsSync(metadataPath)) {
          try {
            const content = readFileSync(metadataPath, 'utf-8');
            const execution = WorkflowExecutionSchema.parse(JSON.parse(content));
            if (execution.id === id) {
              return execution;
            }
          } catch {
            // Continue searching
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return null;
}

/**
 * List all executions for a project
 */
function listExecutions(projectPath: string): WorkflowExecution[] {
  const workflowDir = getProjectWorkflowDir(projectPath);
  const executions: WorkflowExecution[] = [];

  try {
    const entries = readdirSync(workflowDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('pending-') && entry.name.endsWith('.json')) {
        // Pending execution
        try {
          const content = readFileSync(join(workflowDir, entry.name), 'utf-8');
          executions.push(WorkflowExecutionSchema.parse(JSON.parse(content)));
        } catch {
          // Skip invalid files
        }
      } else if (entry.isDirectory()) {
        // Session directory
        const metadataPath = join(workflowDir, entry.name, 'metadata.json');
        if (existsSync(metadataPath)) {
          try {
            const content = readFileSync(metadataPath, 'utf-8');
            executions.push(WorkflowExecutionSchema.parse(JSON.parse(content)));
          } catch {
            // Skip invalid files
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Sort by updatedAt descending (most recent first)
  return executions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// =============================================================================
// Skill Loading & Prompt Building (T005)
// =============================================================================

/**
 * Parse skill input which may include additional context
 * Examples:
 *   "/flow.merge" -> { skillName: "flow.merge", context: null }
 *   "/flow.merge I verified everything" -> { skillName: "flow.merge", context: "I verified everything" }
 *   "flow.orchestrate" -> { skillName: "flow.orchestrate", context: null }
 *   "Just do the thing" -> { skillName: null, context: "Just do the thing" }
 */
function parseSkillInput(input: string): { skillName: string | null; context: string | null } {
  const trimmed = input.trim();

  // Check if it starts with a slash command
  if (trimmed.startsWith('/')) {
    // Find the command part (ends at space or end of string)
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
      // Just the command, no context
      return { skillName: trimmed.slice(1), context: null };
    }
    // Command + context
    const skillName = trimmed.slice(1, spaceIndex);
    const context = trimmed.slice(spaceIndex + 1).trim();
    return { skillName, context: context || null };
  }

  // Check if it looks like a skill name without slash (e.g., "flow.orchestrate")
  if (trimmed.startsWith('flow.') && !trimmed.includes(' ')) {
    return { skillName: trimmed, context: null };
  }

  // Check if it starts with flow. followed by a space (e.g., "flow.orchestrate do this")
  if (trimmed.startsWith('flow.')) {
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex !== -1) {
      const skillName = trimmed.slice(0, spaceIndex);
      const context = trimmed.slice(spaceIndex + 1).trim();
      return { skillName, context: context || null };
    }
  }

  // Plain text - treat as context only (will be used for session resume)
  return { skillName: null, context: trimmed };
}

/**
 * Load skill file content from ~/.claude/commands/
 */
function loadSkillContent(skill: string): string | null {
  const skillName = skill.replace(/^\//, '');
  const skillFile = `${skillName}.md`;
  const homeDir = process.env.HOME || '';

  const installedPath = join(homeDir, '.claude', 'commands', skillFile);
  if (existsSync(installedPath)) {
    return readFileSync(installedPath, 'utf-8');
  }

  return null;
}

/**
 * Build the initial prompt for Claude CLI
 * @param skillInput - Raw skill input which may include additional context (e.g., "/flow.merge I verified")
 * @returns Object with prompt and parsed skill name, or null if skill not found
 */
function buildInitialPrompt(skillInput: string): { prompt: string; skillName: string } | null {
  const { skillName, context } = parseSkillInput(skillInput);

  // If no skill name, can't build an initial prompt (this is a plain message)
  if (!skillName) return null;

  const skillContent = loadSkillContent(skillName);
  if (!skillContent) return null;

  let prompt = `# CLI Mode Instructions

You are running in non-interactive CLI mode. IMPORTANT:
1. You CANNOT use AskUserQuestion tool - it is disabled
2. When you need user input, output questions in the JSON structured_output
3. Set status to "needs_input" and include a questions array
4. Use the SAME format as AskUserQuestion tool input:
   - question: The question text
   - header: Short label (max 12 chars)
   - options: Array of {label, description} choices
   - multiSelect: true if multiple selections allowed

# Skill Instructions

Execute the following skill:

${skillContent}`;

  // If user provided additional context, append it
  if (context) {
    prompt += `

# User Context

The user provided the following additional context for this workflow:

${context}`;
  }

  return { prompt, skillName };
}

/**
 * Build the resume prompt with user answers
 */
function buildResumePrompt(answers: Record<string, string>): string {
  const answerText = Object.entries(answers)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `# User Answers

The user has answered the questions:

${answerText}

Continue the workflow using these answers. Remember:
- You CANNOT use AskUserQuestion tool - it is disabled
- If you need more input, set status to "needs_input" with questions array
- If the workflow is complete, set status to "completed"
- Use the structured_output JSON format`;
}

/**
 * Ensure a pattern exists in .gitignore, create file if needed
 */
function ensureGitignoreEntry(projectPath: string, pattern: string): void {
  const gitignorePath = join(projectPath, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.includes(pattern)) {
      return; // Already present
    }
    // Append with newline safety
    const separator = content.endsWith('\n') ? '' : '\n';
    writeFileSync(gitignorePath, `${content}${separator}${pattern}\n`);
  } else {
    // Create new .gitignore
    writeFileSync(gitignorePath, `${pattern}\n`);
  }
}

// =============================================================================
// Registry Validation (T008)
// =============================================================================

/**
 * Registry schema for project lookup
 */
const RegistryProjectSchema = z.object({
  path: z.string(),
  name: z.string(),
  registered_at: z.string(),
  last_seen: z.string().optional(),
});

const RegistrySchema = z.object({
  projects: z.record(z.string(), RegistryProjectSchema),
  config: z
    .object({
      dev_folders: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Get project path from registry by projectId (FR-010)
 */
function getProjectPath(projectId: string): string | null {
  const homeDir = process.env.HOME || '';
  const registryPath = join(homeDir, '.specflow', 'registry.json');

  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = RegistrySchema.parse(JSON.parse(content));
    const project = registry.projects[projectId];
    return project?.path || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Claude CLI Result Type
// =============================================================================

interface ClaudeCliResult {
  type: string;
  subtype: string;
  is_error: boolean;
  session_id: string;
  structured_output?: WorkflowOutput;
  result?: string;
  total_cost_usd?: number;
}

// =============================================================================
// Process Tracking (for cancel)
// =============================================================================

const runningProcesses = new Map<string, ChildProcess>();

// =============================================================================
// Workflow Service Class
// =============================================================================

// Note: Session ID detection removed (Phase 1053 - T001)
// Session ID is now obtained directly from CLI JSON output (result.session_id)
// instead of polling sessions-index.json which had race conditions

class WorkflowService {
  /**
   * Start a new workflow execution (T007)
   * @param resumeSessionId - Optional session ID to resume (FR-014, FR-015)
   * @param orchestrationId - Optional orchestration ID to link this workflow to
   */
  async start(
    projectId: string,
    skill: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    resumeSessionId?: string,
    orchestrationId?: string
  ): Promise<WorkflowExecution> {
    // Clean up old global workflows on first run (T008, FR-016, FR-017)
    cleanupGlobalWorkflows();

    // Validate project exists in registry (FR-010)
    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const execution: WorkflowExecution = {
      id,
      projectId,
      skill,
      status: 'running',
      answers: {},
      logs: [],
      stdout: '',
      stderr: '',
      costUsd: 0,
      startedAt: now,
      updatedAt: now,
      timeoutMs,
      // If resuming, pre-populate sessionId (FR-015: new execution linked to same session)
      ...(resumeSessionId ? { sessionId: resumeSessionId } : {}),
      // Link to orchestration if provided
      ...(orchestrationId ? { orchestrationId } : {}),
    };

    execution.logs.push(`[${now}] Starting workflow for project ${projectId}`);
    execution.logs.push(`[INFO] Skill: ${skill}`);
    execution.logs.push(`[INFO] Timeout: ${timeoutMs}ms`);
    if (resumeSessionId) {
      execution.logs.push(`[INFO] Resuming session: ${resumeSessionId}`);
    }
    if (orchestrationId) {
      execution.logs.push(`[INFO] Linked to orchestration: ${orchestrationId}`);
    }
    saveExecution(execution, projectPath);

    // Run Claude in background (don't await)
    // Session ID will be obtained from CLI JSON output when it completes
    // For resume, we pass isResume=true and sessionId is already set
    this.runClaude(id, projectPath, !!resumeSessionId, resumeSessionId).catch((err) => {
      const exec = loadExecution(id);
      if (exec) {
        exec.status = 'failed';
        exec.error = err.message;
        exec.updatedAt = new Date().toISOString();
        exec.logs.push(`[ERROR] ${err.message}`);
        saveExecution(exec);
      }
    });

    return execution;
  }

  /**
   * Resume a workflow with answers (T012)
   */
  async resume(
    id: string,
    answers: Record<string, string>
  ): Promise<WorkflowExecution> {
    const execution = loadExecution(id);
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }

    if (execution.status !== 'waiting_for_input') {
      throw new Error(
        `Cannot answer workflow in ${execution.status} state`
      );
    }

    const projectPath = getProjectPath(execution.projectId);
    if (!projectPath) {
      throw new Error(`Project not found: ${execution.projectId}`);
    }

    // Merge new answers with existing (T013)
    execution.answers = { ...execution.answers, ...answers };
    execution.status = 'running';
    execution.updatedAt = new Date().toISOString();
    execution.logs.push(`[RESUME] With answers: ${JSON.stringify(answers)}`);
    saveExecution(execution, projectPath);

    // Run Claude with session resume
    this.runClaude(id, projectPath, true).catch((err) => {
      const exec = loadExecution(id);
      if (exec) {
        exec.status = 'failed';
        exec.error = err.message;
        exec.updatedAt = new Date().toISOString();
        exec.logs.push(`[ERROR] ${err.message}`);
        saveExecution(exec);
      }
    });

    return execution;
  }

  /**
   * Get execution by ID
   * @param id - Execution UUID
   * @param projectId - Optional project registry key for direct lookup
   */
  get(id: string, projectId?: string): WorkflowExecution | undefined {
    // Ensure reconciliation has been run on startup
    void ensureReconciliation();

    let projectPath: string | undefined;
    if (projectId) {
      const path = getProjectPath(projectId);
      if (path) projectPath = path;
    }
    const execution = loadExecution(id, projectPath);
    if (!execution) return undefined;

    // If workflow is active but no session ID yet, try to detect it from file system
    // This handles the case where CLI hasn't completed but session file exists
    // Also applies to detached/stale workflows which may have lost tracking before session ID was captured
    if (['running', 'detached', 'stale'].includes(execution.status) && !execution.sessionId && projectPath) {
      const detectedSessionId = findRecentSessionFile(projectPath, execution.startedAt);
      if (detectedSessionId) {
        execution.sessionId = detectedSessionId;
        execution.logs.push(`[DETECT] Session detected from file: ${detectedSessionId}`);
        saveExecution(execution, projectPath);
      }
    }

    // Runtime health checking for active workflows (Phase 4)
    if (['running', 'waiting_for_input', 'stale'].includes(execution.status) && projectPath) {
      const health = checkProcessHealth(execution, projectPath);

      if (health.healthStatus === 'dead') {
        // Check if the session ended gracefully before marking as failed
        if (didSessionEndGracefully(projectPath, execution.sessionId)) {
          execution.status = 'completed';
          execution.completedAt = new Date().toISOString();
          execution.updatedAt = new Date().toISOString();
          execution.logs.push(`[HEALTH] Session completed gracefully`);
          saveExecution(execution, projectPath);
          // Also update the workflow index
          this.updateSessionStatus(execution.sessionId, projectPath, 'completed');
        } else {
          execution.status = 'failed';
          execution.error = 'Process terminated unexpectedly';
          execution.updatedAt = new Date().toISOString();
          execution.logs.push(`[HEALTH] ${getHealthStatusMessage(health)}`);
          saveExecution(execution, projectPath);
        }
      } else if (health.healthStatus === 'stale' && execution.status !== 'stale') {
        execution.status = 'stale';
        execution.error = getHealthStatusMessage(health);
        execution.updatedAt = new Date().toISOString();
        execution.logs.push(`[HEALTH] ${getHealthStatusMessage(health)}`);
        saveExecution(execution, projectPath);
      } else if (health.healthStatus === 'running' && execution.status === 'stale') {
        // Recovery: process was stale but now has activity
        execution.status = 'running';
        execution.error = undefined;
        execution.updatedAt = new Date().toISOString();
        execution.logs.push(`[HEALTH] Process recovered - session file updated`);
        saveExecution(execution, projectPath);
      } else if (health.healthStatus === 'unknown') {
        if (didSessionEndGracefully(projectPath, execution.sessionId)) {
          execution.status = 'completed';
          execution.completedAt = new Date().toISOString();
          execution.updatedAt = new Date().toISOString();
          execution.logs.push(`[HEALTH] Session completed gracefully (no PID)`);
          saveExecution(execution, projectPath);
          this.updateSessionStatus(execution.sessionId, projectPath, 'completed');
        } else if (health.isStale && execution.status !== 'stale') {
          execution.status = 'stale';
          execution.error = getHealthStatusMessage({
            ...health,
            healthStatus: 'stale',
          });
          execution.updatedAt = new Date().toISOString();
          execution.logs.push(`[HEALTH] ${execution.error}`);
          saveExecution(execution, projectPath);
        }
      }
    }

    return execution;
  }

  /**
   * List executions for a project
   * @param projectId - Registry key for the project
   */
  list(projectId: string): WorkflowExecution[] {
    // Ensure reconciliation has been run on startup
    void ensureReconciliation();

    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return [];
    }
    return listExecutions(projectPath);
  }

  /**
   * Find all workflows linked to a specific orchestration
   * @param projectId - Registry key for the project
   * @param orchestrationId - Orchestration ID to filter by
   * @returns Workflows linked to this orchestration, sorted by startedAt (newest first)
   */
  findByOrchestration(projectId: string, orchestrationId: string): WorkflowExecution[] {
    const all = this.list(projectId);
    return all
      .filter(w => w.orchestrationId === orchestrationId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /**
   * Find active workflows for an orchestration (running or waiting_for_input)
   * @param projectId - Registry key for the project
   * @param orchestrationId - Orchestration ID to filter by
   * @returns Active workflows for this orchestration
   */
  findActiveByOrchestration(projectId: string, orchestrationId: string): WorkflowExecution[] {
    return this.findByOrchestration(projectId, orchestrationId)
      .filter(w => ['running', 'waiting_for_input'].includes(w.status));
  }

  /**
   * Check if an orchestration has any active workflows
   * @param projectId - Registry key for the project
   * @param orchestrationId - Orchestration ID to check
   * @returns True if there's at least one active workflow
   */
  hasActiveWorkflow(projectId: string, orchestrationId: string): boolean {
    return this.findActiveByOrchestration(projectId, orchestrationId).length > 0;
  }

  /**
   * Cancel a running workflow (T017)
   */
  cancel(id: string): WorkflowExecution {
    const execution = loadExecution(id);
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }

    // Can only cancel active workflows (running, waiting, detached, or stale)
    if (!['running', 'waiting_for_input', 'detached', 'stale'].includes(execution.status)) {
      throw new Error(
        `Cannot cancel workflow in ${execution.status} state`
      );
    }

    const projectPath = getProjectPath(execution.projectId);
    const now = new Date().toISOString();

    // Kill the process if running (FR-009)
    // First try in-memory process reference
    const process = runningProcesses.get(id);
    if (process && process.pid) {
      try {
        process.kill('SIGTERM');
        execution.logs.push(`[CANCEL] Process ${process.pid} terminated`);
      } catch (err) {
        execution.logs.push(
          `[WARN] Could not kill process: ${err}`
        );
      }
      runningProcesses.delete(id);
    }

    // Also try PID from pid file (for detached processes)
    if (projectPath) {
      const workflowDir = join(projectPath, '.specflow', 'workflows', id);
      const pids = readPidFile(workflowDir);
      if (pids) {
        if (pids.claudePid && isPidAlive(pids.claudePid)) {
          killProcess(pids.claudePid, false);
          execution.logs.push(`[CANCEL] Claude PID ${pids.claudePid} terminated`);
        }
        if (pids.bashPid && isPidAlive(pids.bashPid)) {
          killProcess(pids.bashPid, false);
          execution.logs.push(`[CANCEL] Bash PID ${pids.bashPid} terminated`);
        }
        cleanupPidFile(workflowDir);
      }
    }

    execution.status = 'cancelled';
    execution.cancelledAt = now;
    execution.updatedAt = now;
    execution.pid = undefined;
    execution.claudePid = undefined;
    execution.logs.push(`[CANCELLED] Workflow cancelled by user`);
    saveExecution(execution);

    return execution;
  }

  /**
   * Cancel or complete a workflow by session ID (for when execution tracking is lost)
   * Updates the workflow index to mark the session with the given status
   *
   * @param sessionId - Session ID to update
   * @param projectId - Project ID
   * @param finalStatus - Status to set: 'cancelled' (user cancelled) or 'completed' (graceful end)
   */
  cancelBySession(
    sessionId: string,
    projectId: string,
    finalStatus: 'cancelled' | 'completed' = 'cancelled'
  ): boolean {
    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return false;
    }

    const index = loadWorkflowIndex(projectPath);
    const sessionIdx = index.sessions.findIndex(s => s.sessionId === sessionId);

    if (sessionIdx < 0) {
      return false;
    }

    const session = index.sessions[sessionIdx];

    // Only update if in an active state (includes detached/stale - session may still be running)
    if (!['running', 'waiting_for_input', 'detached', 'stale'].includes(session.status)) {
      return false;
    }

    // Update the index entry
    session.status = finalStatus;
    session.updatedAt = new Date().toISOString();
    saveWorkflowIndex(projectPath, index);

    // Also try to update the metadata file if it exists
    const workflowDir = getProjectWorkflowDir(projectPath);
    const metadataPath = join(workflowDir, sessionId, 'metadata.json');
    if (existsSync(metadataPath)) {
      try {
        const content = readFileSync(metadataPath, 'utf-8');
        const execution = WorkflowExecutionSchema.parse(JSON.parse(content));
        execution.status = finalStatus;
        if (finalStatus === 'cancelled') {
          execution.cancelledAt = new Date().toISOString();
          execution.logs.push('[CANCELLED] Session cancelled by user (tracking recovered)');
        } else {
          execution.completedAt = new Date().toISOString();
          execution.logs.push('[COMPLETED] Session completed (detected from messages)');
        }
        execution.updatedAt = new Date().toISOString();
        writeFileSync(metadataPath, JSON.stringify(execution, null, 2));
      } catch {
        // Ignore errors updating metadata
      }
    }

    return true;
  }

  /**
   * Update session status in workflow index (internal helper)
   */
  private updateSessionStatus(
    sessionId: string | undefined,
    projectPath: string,
    status: 'completed' | 'cancelled' | 'failed'
  ): void {
    if (!sessionId) return;

    const index = loadWorkflowIndex(projectPath);
    const session = index.sessions.find(s => s.sessionId === sessionId);

    if (session && ['running', 'waiting_for_input', 'detached', 'stale'].includes(session.status)) {
      session.status = status;
      session.updatedAt = new Date().toISOString();
      saveWorkflowIndex(projectPath, index);
    }
  }

  /**
   * Run Claude CLI (T006)
   * @param isResume - If true, use --resume with session ID
   * @param resumeSessionId - Optional explicit session ID for resuming historical sessions
   */
  private async runClaude(
    id: string,
    projectPath: string,
    isResume: boolean,
    resumeSessionId?: string
  ): Promise<void> {
    const execution = loadExecution(id);
    if (!execution) return;

    const isTestMode = execution.skill === 'test';
    // For historical session resume, use the explicit sessionId passed in
    // For answer-based resume, use execution.sessionId
    const effectiveSessionId = resumeSessionId || execution.sessionId;

    // Create session-specific workflow directory to avoid collisions
    const workflowDir = join(projectPath, '.specflow', 'workflows', id);
    mkdirSync(workflowDir, { recursive: true });

    // Ensure .gitignore has workflow session files excluded
    ensureGitignoreEntry(projectPath, '.specflow/workflows/');

    const outputFile = join(workflowDir, 'workflow-output.json');
    const claudePath = '$HOME/.local/bin/claude';

    let scriptContent: string;

    if (isTestMode) {
      // Simple test mode
      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json "Say hello" < /dev/null > "${outputFile}" 2>&1
`;
      execution.logs.push(`[TEST] Simple hello test`);
    } else if (isResume && effectiveSessionId) {
      // Resume existing session
      // Two cases:
      // 1. Resuming with answers (from workflow resume method) - use buildResumePrompt
      // 2. Resuming historical session (from start with resumeSessionId) - use skill as follow-up
      const hasAnswers = Object.keys(execution.answers).length > 0;
      const resumePrompt = hasAnswers
        ? buildResumePrompt(execution.answers)
        : execution.skill; // skill contains the follow-up message for US3

      const promptFile = join(workflowDir, 'resume-prompt.txt');
      writeFileSync(promptFile, resumePrompt);

      const schemaFile = join(workflowDir, 'schema.json');
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_JSON_SCHEMA));

      execution.logs.push(`[RESUME] Session: ${effectiveSessionId}`);
      execution.logs.push(`[INFO] Resume prompt (${resumePrompt.length} chars)`);

      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json --resume "${effectiveSessionId}" --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat ${schemaFile})" < "${promptFile}" > "${outputFile}" 2>&1
`;
    } else {
      // Initial run (FR-005)
      const promptResult = buildInitialPrompt(execution.skill);
      if (!promptResult) {
        // No skill found - check if this is a plain message for an active session
        // This case is handled at the API level by resuming the session
        execution.status = 'failed';
        execution.error = `Could not load skill: ${execution.skill}. Use a slash command like /flow.orchestrate`;
        execution.updatedAt = new Date().toISOString();
        execution.logs.push(`[ERROR] Could not load skill: ${execution.skill}`);
        saveExecution(execution);
        return;
      }

      const promptFile = join(workflowDir, 'prompt.txt');
      writeFileSync(promptFile, promptResult.prompt);
      execution.logs.push(`[INFO] Skill: ${promptResult.skillName}`);
      execution.logs.push(`[INFO] Initial prompt (${promptResult.prompt.length} chars)`);

      const schemaFile = join(workflowDir, 'schema.json');
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_JSON_SCHEMA));

      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat ${schemaFile})" < "${promptFile}" > "${outputFile}" 2>&1
`;
    }

    // Pass through full environment with specflow CLI in PATH
    const homeDir = process.env.HOME || '/Users/ppatterson';
    const env: Record<string, string> = {
      HOME: homeDir,
      PATH: `${homeDir}/.claude/specflow-system/bin:${homeDir}/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
    };

    // Copy relevant environment variables
    if (process.env.TERM) env.TERM = process.env.TERM;
    if (process.env.SHELL) env.SHELL = process.env.SHELL;
    if (process.env.USER) env.USER = process.env.USER;
    if (process.env.LANG) env.LANG = process.env.LANG;

    execution.logs.push(`[EXEC] Spawning detached process...`);
    saveExecution(execution);

    // Spawn detached process (survives dashboard restart)
    const spawnResult = spawnDetachedClaude({
      cwd: projectPath,
      workflowDir,
      scriptContent,
      env,
      timeoutMs: execution.timeoutMs,
    });

    // Update execution with PIDs
    execution.pid = spawnResult.bashPid;
    execution.logs.push(`[INFO] Bash PID: ${spawnResult.bashPid}`);
    saveExecution(execution);

    // Poll for completion in background
    // This doesn't block the API response - process runs independently
    this.pollAndUpdateExecution(id, projectPath, workflowDir, outputFile, execution.timeoutMs);
  }

  /**
   * Poll for process completion and update execution state
   */
  private async pollAndUpdateExecution(
    id: string,
    projectPath: string,
    workflowDir: string,
    outputFile: string,
    timeoutMs: number
  ): Promise<void> {
    const result = await pollForCompletion(workflowDir, timeoutMs);

    // Reload execution state (might have been updated/cancelled)
    const exec = loadExecution(id);
    if (!exec) return;

    // Don't update if already cancelled
    if (exec.status === 'cancelled') return;

    exec.updatedAt = new Date().toISOString();
    exec.pid = undefined;
    exec.claudePid = undefined;

    if (result.timedOut) {
      // Dashboard tracking timeout - process may still be running
      exec.status = 'detached';
      exec.error = `Dashboard tracking timeout (${timeoutMs}ms) - session may still be running`;
      exec.logs.push(`[DETACHED] ${exec.error}`);
      exec.logs.push('[DETACHED] Check session history to reconnect');
      saveExecution(exec, projectPath);
      return;
    }

    if (!result.completed || !result.output) {
      exec.status = 'failed';
      exec.error = 'Process terminated without output';
      exec.logs.push(`[ERROR] No output received`);
      saveExecution(exec, projectPath);
      return;
    }

    // Read and process output
    const stdout = result.output;
    exec.stdout = stdout;
    exec.logs.push(`[OK] Output (${stdout.length} bytes)`);

    // Parse result (FR-006, FR-007)
    try {
      const cliResult = JSON.parse(stdout) as ClaudeCliResult;
      // Only set sessionId if we don't have one (new session, not resume)
      // When resuming, keep the original sessionId we intended to resume
      if (!exec.sessionId) {
        exec.sessionId = cliResult.session_id;
      }
      exec.costUsd = exec.costUsd + (cliResult.total_cost_usd || 0);

      exec.logs.push(`[OK] Session: ${exec.sessionId}`);
      exec.logs.push(`[OK] Cost: $${cliResult.total_cost_usd?.toFixed(4)}`);

      if (cliResult.is_error) {
        exec.status = 'failed';
        exec.error = cliResult.result || 'Unknown error';
        exec.logs.push(`[ERROR] ${exec.error}`);
      } else if (cliResult.structured_output) {
        exec.output = cliResult.structured_output;

        if (cliResult.structured_output.status === 'needs_input') {
          exec.status = 'waiting_for_input';
          exec.logs.push(
            `[WAITING] ${cliResult.structured_output.questions?.length || 0} questions`
          );

          // Broadcast questions via SSE so the UI can display them
          if (cliResult.structured_output.questions && exec.sessionId) {
            const { broadcastWorkflowQuestions } = require('../watcher');
            broadcastWorkflowQuestions(
              exec.sessionId,
              exec.projectId,
              cliResult.structured_output.questions
            );
          }
        } else if (cliResult.structured_output.status === 'completed') {
          exec.status = 'completed';
          exec.logs.push('[COMPLETE] Workflow finished!');
        } else if (cliResult.structured_output.status === 'error') {
          exec.status = 'failed';
          exec.error = cliResult.structured_output.message;
          exec.logs.push(`[ERROR] ${exec.error}`);
        }
      } else {
        // Test mode or no structured output
        exec.status = 'completed';
        exec.logs.push(`[COMPLETE] ${cliResult.result?.slice(0, 100)}`);
      }
    } catch (parseError) {
      exec.status = 'failed';
      exec.error = `Parse error: ${stdout.slice(0, 200)}`;
      exec.logs.push(`[PARSE ERROR] ${exec.error}`);
    }

    saveExecution(exec, projectPath);
  }
}

// Export singleton
export const workflowService = new WorkflowService();
