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
  skill: z.string(),
  status: z.enum([
    'running',
    'waiting_for_input',
    'completed',
    'failed',
    'cancelled',
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
  pid: z.number().optional(),
  cancelledAt: z.string().optional(),
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

const DEFAULT_TIMEOUT_MS = 600000; // 10 minutes

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

        // Skip active workflows per FR-017
        if (data.status === 'running' || data.status === 'waiting_for_input') {
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

  const entry: WorkflowIndexEntry = {
    sessionId: execution.sessionId,
    executionId: execution.id,
    skill: execution.skill,
    status: execution.status,
    startedAt: execution.startedAt,
    updatedAt: execution.updatedAt,
    costUsd: execution.costUsd,
  };

  if (existingIdx >= 0) {
    index.sessions[existingIdx] = entry;
  } else {
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
 */
function buildInitialPrompt(skill: string): string | null {
  const skillContent = loadSkillContent(skill);
  if (!skillContent) return null;

  return `# CLI Mode Instructions

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
   */
  async start(
    projectId: string,
    skill: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    resumeSessionId?: string
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
    };

    execution.logs.push(`[${now}] Starting workflow for project ${projectId}`);
    execution.logs.push(`[INFO] Skill: ${skill}`);
    execution.logs.push(`[INFO] Timeout: ${timeoutMs}ms`);
    if (resumeSessionId) {
      execution.logs.push(`[INFO] Resuming session: ${resumeSessionId}`);
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
    let projectPath: string | undefined;
    if (projectId) {
      const path = getProjectPath(projectId);
      if (path) projectPath = path;
    }
    const execution = loadExecution(id, projectPath);
    if (!execution) return undefined;

    // If workflow is running but no session ID yet, try to detect it from file system
    // This handles the case where CLI hasn't completed but session file exists
    if (execution.status === 'running' && !execution.sessionId && projectPath) {
      const detectedSessionId = findRecentSessionFile(projectPath, execution.startedAt);
      if (detectedSessionId) {
        execution.sessionId = detectedSessionId;
        execution.logs.push(`[DETECT] Session detected from file: ${detectedSessionId}`);
        saveExecution(execution, projectPath);
      }
    }

    return execution;
  }

  /**
   * List executions for a project
   * @param projectId - Registry key for the project
   */
  list(projectId: string): WorkflowExecution[] {
    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return [];
    }
    return listExecutions(projectPath);
  }

  /**
   * Cancel a running workflow (T017)
   */
  cancel(id: string): WorkflowExecution {
    const execution = loadExecution(id);
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }

    // Can only cancel running or waiting workflows
    if (!['running', 'waiting_for_input'].includes(execution.status)) {
      throw new Error(
        `Cannot cancel workflow in ${execution.status} state`
      );
    }

    const now = new Date().toISOString();

    // Kill the process if running (FR-009)
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

    execution.status = 'cancelled';
    execution.cancelledAt = now;
    execution.updatedAt = now;
    execution.pid = undefined;
    execution.logs.push(`[CANCELLED] Workflow cancelled by user`);
    saveExecution(execution);

    return execution;
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

    const scriptFile = join(workflowDir, 'run-workflow.sh');
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
      const prompt = buildInitialPrompt(execution.skill);
      if (!prompt) {
        execution.status = 'failed';
        execution.error = `Could not load skill: ${execution.skill}`;
        execution.updatedAt = new Date().toISOString();
        execution.logs.push(`[ERROR] Could not load skill: ${execution.skill}`);
        saveExecution(execution);
        return;
      }

      const promptFile = join(workflowDir, 'prompt.txt');
      writeFileSync(promptFile, prompt);
      execution.logs.push(`[INFO] Initial prompt (${prompt.length} chars)`);

      const schemaFile = join(workflowDir, 'schema.json');
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_JSON_SCHEMA));

      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat ${schemaFile})" < "${promptFile}" > "${outputFile}" 2>&1
`;
    }

    writeFileSync(scriptFile, scriptContent, { mode: 0o755 });
    execution.logs.push(`[INFO] Script: ${scriptFile}`);
    execution.logs.push(`[EXEC] Running...`);
    saveExecution(execution);

    return new Promise((resolve) => {
      const cmd = `/bin/bash "${scriptFile}"`;

      // Pass through full environment
      const env = {
        ...process.env,
        HOME: process.env.HOME || '/Users/ppatterson',
        PATH: `${process.env.HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
      };

      const childProcess = exec(
        cmd,
        {
          cwd: projectPath,
          timeout: execution.timeoutMs,
          shell: '/bin/bash',
          env,
        },
        (error, _stdout, _stderr) => {
          // Remove from running processes
          runningProcesses.delete(id);

          // Reload execution state (might have been updated)
          const exec = loadExecution(id);
          if (!exec) {
            resolve();
            return;
          }

          // Don't update if already cancelled
          if (exec.status === 'cancelled') {
            resolve();
            return;
          }

          exec.updatedAt = new Date().toISOString();
          exec.pid = undefined;

          // Read output from file
          let stdout = '';
          try {
            stdout = readFileSync(outputFile, 'utf-8');
            exec.stdout = stdout;
            exec.logs.push(`[OK] Output (${stdout.length} bytes)`);
          } catch (e) {
            exec.logs.push(`[ERROR] Could not read output: ${e}`);
          }

          const stderr = _stderr || '';
          exec.stderr = stderr;
          if (stderr) {
            exec.logs.push(`[STDERR] ${stderr.slice(0, 500)}`);
          }

          // Check for timeout (FR-008)
          if (error && error.killed) {
            exec.status = 'failed';
            exec.error = `Timeout exceeded (${exec.timeoutMs}ms)`;
            exec.logs.push(`[TIMEOUT] ${exec.error}`);
            saveExecution(exec);
            resolve();
            return;
          }

          if (error) {
            exec.status = 'failed';
            exec.error = String(error);
            exec.logs.push(`[ERROR] ${error}`);
            saveExecution(exec);
            resolve();
            return;
          }

          if (!stdout) {
            exec.status = 'failed';
            exec.error = 'No output received';
            exec.logs.push(`[ERROR] No output`);
            saveExecution(exec);
            resolve();
            return;
          }

          // Parse result (FR-006, FR-007)
          try {
            const result = JSON.parse(stdout) as ClaudeCliResult;
            exec.sessionId = result.session_id;
            exec.costUsd = exec.costUsd + (result.total_cost_usd || 0);

            exec.logs.push(`[OK] Session: ${result.session_id}`);
            exec.logs.push(`[OK] Cost: $${result.total_cost_usd?.toFixed(4)}`);

            if (result.is_error) {
              exec.status = 'failed';
              exec.error = result.result || 'Unknown error';
              exec.logs.push(`[ERROR] ${exec.error}`);
            } else if (result.structured_output) {
              exec.output = result.structured_output;

              if (result.structured_output.status === 'needs_input') {
                exec.status = 'waiting_for_input';
                exec.logs.push(
                  `[WAITING] ${result.structured_output.questions?.length || 0} questions`
                );
              } else if (result.structured_output.status === 'completed') {
                exec.status = 'completed';
                exec.logs.push('[COMPLETE] Workflow finished!');
              } else if (result.structured_output.status === 'error') {
                exec.status = 'failed';
                exec.error = result.structured_output.message;
                exec.logs.push(`[ERROR] ${exec.error}`);
              }
            } else {
              // Test mode or no structured output
              exec.status = 'completed';
              exec.logs.push(`[COMPLETE] ${result.result?.slice(0, 100)}`);
            }
          } catch (parseError) {
            exec.status = 'failed';
            exec.error = `Parse error: ${stdout.slice(0, 200)}`;
            exec.logs.push(`[PARSE ERROR] ${exec.error}`);
          }

          saveExecution(exec);
          resolve();
        }
      );

      // Track process for cancel (store PID)
      if (childProcess.pid) {
        runningProcesses.set(id, childProcess);
        const exec = loadExecution(id);
        if (exec) {
          exec.pid = childProcess.pid;
          saveExecution(exec);
        }
      }
    });
  }
}

// Export singleton
export const workflowService = new WorkflowService();
