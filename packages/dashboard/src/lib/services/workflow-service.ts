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
 */
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().min(1), // Registry key (not necessarily UUID)
  sessionId: z.string().optional(),
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
// State Persistence (T004)
// =============================================================================

/**
 * Get the workflow state directory, creating if needed (FR-001)
 */
function getStateDir(): string {
  const homeDir = process.env.HOME || '/tmp';
  const stateDir = join(homeDir, '.specflow', 'workflows');
  mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

/**
 * Save execution state to disk (FR-003)
 */
function saveExecution(execution: WorkflowExecution): void {
  const stateDir = getStateDir();
  const stateFile = join(stateDir, `${execution.id}.json`);
  writeFileSync(stateFile, JSON.stringify(execution, null, 2));
}

/**
 * Load execution state from disk
 */
function loadExecution(id: string): WorkflowExecution | null {
  const stateDir = getStateDir();
  const stateFile = join(stateDir, `${id}.json`);

  if (!existsSync(stateFile)) {
    return null;
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    const data = JSON.parse(content);
    return WorkflowExecutionSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * List all executions, optionally filtered by projectId
 */
function listExecutions(projectId?: string): WorkflowExecution[] {
  const stateDir = getStateDir();

  let files: string[];
  try {
    files = readdirSync(stateDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const executions = files
    .map((f) => {
      try {
        const content = readFileSync(join(stateDir, f), 'utf-8');
        const data = JSON.parse(content);
        return WorkflowExecutionSchema.parse(data);
      } catch {
        return null;
      }
    })
    .filter((e): e is WorkflowExecution => e !== null);

  // Filter by projectId if provided
  const filtered = projectId
    ? executions.filter((e) => e.projectId === projectId)
    : executions;

  // Sort by updatedAt descending (most recent first)
  return filtered.sort(
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

class WorkflowService {
  /**
   * Start a new workflow execution (T007)
   */
  async start(
    projectId: string,
    skill: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<WorkflowExecution> {
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
    };

    execution.logs.push(`[${now}] Starting workflow for project ${projectId}`);
    execution.logs.push(`[INFO] Skill: ${skill}`);
    execution.logs.push(`[INFO] Timeout: ${timeoutMs}ms`);
    saveExecution(execution);

    // Run Claude in background (don't await)
    this.runClaude(id, projectPath, false).catch((err) => {
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
    saveExecution(execution);

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
   * Get execution by ID (T010)
   */
  get(id: string): WorkflowExecution | undefined {
    return loadExecution(id) || undefined;
  }

  /**
   * List executions, optionally filtered by projectId (T015)
   */
  list(projectId?: string): WorkflowExecution[] {
    return listExecutions(projectId);
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
   */
  private async runClaude(
    id: string,
    projectPath: string,
    isResume: boolean
  ): Promise<void> {
    const execution = loadExecution(id);
    if (!execution) return;

    const isTestMode = execution.skill === 'test';

    // Create .specify directory in project
    const specifyDir = join(projectPath, '.specify');
    mkdirSync(specifyDir, { recursive: true });

    const scriptFile = join(specifyDir, 'run-workflow.sh');
    const outputFile = join(specifyDir, 'workflow-output.json');
    const claudePath = '$HOME/.local/bin/claude';

    let scriptContent: string;

    if (isTestMode) {
      // Simple test mode
      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json "Say hello" < /dev/null > "${outputFile}" 2>&1
`;
      execution.logs.push(`[TEST] Simple hello test`);
    } else if (isResume && execution.sessionId) {
      // Resume existing session with answers
      const resumePrompt = buildResumePrompt(execution.answers);
      const promptFile = join(specifyDir, 'resume-prompt.txt');
      writeFileSync(promptFile, resumePrompt);

      const schemaFile = join(specifyDir, 'schema.json');
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_JSON_SCHEMA));

      execution.logs.push(`[RESUME] Session: ${execution.sessionId}`);
      execution.logs.push(`[INFO] Resume prompt (${resumePrompt.length} chars)`);

      scriptContent = `#!/bin/bash
cd "${projectPath}"
${claudePath} -p --output-format json --resume "${execution.sessionId}" --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat ${schemaFile})" < "${promptFile}" > "${outputFile}" 2>&1
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

      const promptFile = join(specifyDir, 'prompt.txt');
      writeFileSync(promptFile, prompt);
      execution.logs.push(`[INFO] Initial prompt (${prompt.length} chars)`);

      const schemaFile = join(specifyDir, 'schema.json');
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
