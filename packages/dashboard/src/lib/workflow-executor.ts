import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  formatProviderName,
  resolveAgentProvider,
  type AgentProvider,
} from '@/lib/agent-provider';
import {
  getSkillFilePath,
  normalizeSkillIdentifier,
  parseSkillWithContext,
  toSlashSkillCommand,
} from '@/lib/skill-utils';

/**
 * Question format (mirrors AskUserQuestion tool input)
 */
export interface WorkflowQuestion {
  question: string;
  header?: string;
  options?: Array<{ label: string; description: string }>;
  multiSelect?: boolean;
}

/**
 * Structured output from Claude CLI
 */
export interface WorkflowOutput {
  status: 'completed' | 'needs_input' | 'error';
  phase?: string;
  message?: string;
  questions?: WorkflowQuestion[];
  artifacts?: Array<{ path: string; action: 'created' | 'modified' }>;
}

/**
 * Workflow execution state (persisted to disk)
 */
export interface WorkflowExecution {
  id: string;
  sessionId?: string;
  projectPath: string;
  provider: AgentProvider;
  skill: string;
  status: 'running' | 'waiting_for_input' | 'completed' | 'failed';
  output?: WorkflowOutput;
  answers: Record<string, string>;
  logs: string[];
  stdout: string;
  stderr: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  costUsd?: number;
}

/**
 * Load a skill file content
 */
function loadSkillContent(skill: string, provider: AgentProvider): string | null {
  const skillName = normalizeSkillIdentifier(skill);
  if (!skillName) return null;

  const homeDir = process.env.HOME || '';
  const installedPath = getSkillFilePath(provider, homeDir, skillName);
  if (existsSync(installedPath)) {
    return readFileSync(installedPath, 'utf-8');
  }

  return null;
}

/**
 * Build the initial prompt for agent CLI
 */
function buildInitialPrompt(skill: string, provider: AgentProvider): string | null {
  const skillContent = loadSkillContent(skill, provider);
  if (!skillContent) return null;

  return `# CLI Mode Instructions

You are running in non-interactive CLI mode. IMPORTANT:
1. Do NOT call AskUserQuestion or any interactive question tool
2. Return a structured response matching the configured schema
3. If user input is needed, set status to "needs_input" and include questions[]

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

  return `# Answers to your questions

${answerText}

Continue the workflow using these answers.
If you need more input, set status to "needs_input" and include questions[].`;
}

/**
 * Claude CLI result structure
 */
interface ClaudeCliResult {
  type: string;
  subtype: string;
  is_error: boolean;
  session_id: string;
  structured_output?: WorkflowOutput;
  result?: string;
  total_cost_usd?: number;
}

const CODEX_WORKFLOW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'phase', 'message', 'questions', 'artifacts'],
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'needs_input', 'error'],
    },
    phase: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    message: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    questions: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['question', 'header', 'options', 'multiSelect'],
            properties: {
              question: { type: 'string' },
              header: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              options: {
                anyOf: [
                  {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['label', 'description'],
                      properties: {
                        label: { type: 'string' },
                        description: { type: 'string' },
                      },
                    },
                  },
                  { type: 'null' },
                ],
              },
              multiSelect: {
                anyOf: [{ type: 'boolean' }, { type: 'null' }],
              },
            },
          },
        },
        { type: 'null' },
      ],
    },
    artifacts: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['path', 'action'],
            properties: {
              path: { type: 'string' },
              action: { type: 'string', enum: ['created', 'modified'] },
            },
          },
        },
        { type: 'null' },
      ],
    },
  },
} as const;

function parseCodexOutput(stdout: string): {
  sessionId?: string;
  output?: WorkflowOutput;
  error?: string;
} {
  let sessionId: string | undefined;
  let finalText: string | undefined;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('{')) continue;

    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
        sessionId = event.thread_id;
      }
      if (event.type === 'item.completed') {
        const item = event.item;
        if (item && typeof item === 'object') {
          const typedItem = item as Record<string, unknown>;
          if (typedItem.type === 'agent_message' && typeof typedItem.text === 'string') {
            finalText = typedItem.text;
          }
        }
      }
    } catch {
      // Ignore non-JSON lines.
    }
  }

  if (!finalText) {
    return { sessionId, error: 'No final agent_message found in Codex output' };
  }

  try {
    const parsed = JSON.parse(finalText) as Record<string, unknown>;
    if (
      parsed.status !== 'completed' &&
      parsed.status !== 'needs_input' &&
      parsed.status !== 'error'
    ) {
      return { sessionId, error: 'Invalid structured status in Codex output' };
    }

    const output: WorkflowOutput = {
      status: parsed.status,
      ...(typeof parsed.phase === 'string' ? { phase: parsed.phase } : {}),
      ...(typeof parsed.message === 'string' ? { message: parsed.message } : {}),
    };
    return { sessionId, output };
  } catch {
    return {
      sessionId,
      output: { status: 'completed', message: finalText },
    };
  }
}

/**
 * Get the workflow state directory
 */
function getStateDir(): string {
  const homeDir = process.env.HOME || '/tmp';
  const stateDir = join(homeDir, '.specflow', 'workflow-debug');
  mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

/**
 * Save execution state to disk
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
    return JSON.parse(content) as WorkflowExecution;
  } catch {
    return null;
  }
}

/**
 * List all executions
 */
function listExecutions(): WorkflowExecution[] {
  const stateDir = getStateDir();
  const files = readdirSync(stateDir).filter(f => f.endsWith('.json'));

  return files
    .map(f => {
      try {
        const content = readFileSync(join(stateDir, f), 'utf-8');
        return JSON.parse(content) as WorkflowExecution;
      } catch {
        return null;
      }
    })
    .filter((e): e is WorkflowExecution => e !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Workflow Executor - manages provider-backed workflow execution
 * State is persisted to ~/.specflow/workflow-debug/
 */
class WorkflowExecutor {
  /**
   * Start a new workflow execution
   */
  async start(
    projectPath: string,
    skill: string = '/flow.design'
  ): Promise<WorkflowExecution> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const provider = resolveAgentProvider();

    const execution: WorkflowExecution = {
      id,
      projectPath,
      provider,
      skill,
      status: 'running',
      answers: {},
      logs: [],
      stdout: '',
      stderr: '',
      startedAt: now,
      updatedAt: now,
    };

    execution.logs.push(`[${now}] Starting ${formatProviderName(provider)} workflow...`);
    saveExecution(execution);

    // Run agent in background (don't await)
    this.runAgent(id, false).catch((err) => {
      const exec = loadExecution(id);
      if (exec) {
        exec.status = 'failed';
        exec.error = err.message;
        exec.logs.push(`[ERROR] ${err.message}`);
        saveExecution(exec);
      }
    });

    return execution;
  }

  /**
   * Resume a workflow with answers
   */
  async resume(
    id: string,
    answers: Record<string, string>
  ): Promise<WorkflowExecution> {
    const execution = loadExecution(id);
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }

    // Merge new answers
    execution.answers = { ...execution.answers, ...answers };
    execution.status = 'running';
    execution.updatedAt = new Date().toISOString();
    execution.logs.push(`[RESUME] With answers: ${JSON.stringify(answers)}`);
    saveExecution(execution);

    // Run agent with session resume
    this.runAgent(id, true).catch((err) => {
      const exec = loadExecution(id);
      if (exec) {
        exec.status = 'failed';
        exec.error = err.message;
        exec.logs.push(`[ERROR] ${err.message}`);
        saveExecution(exec);
      }
    });

    return execution;
  }

  /**
   * Get execution by ID (loads from disk)
   */
  get(id: string): WorkflowExecution | undefined {
    return loadExecution(id) || undefined;
  }

  /**
   * List all executions
   */
  list(): WorkflowExecution[] {
    return listExecutions();
  }

  /**
   * Run selected agent CLI.
   * @param isResume - If true, run provider resume command with session ID
   */
  private async runAgent(id: string, isResume: boolean): Promise<void> {
    const execution = loadExecution(id);
    if (!execution) return;

    const provider = resolveAgentProvider(execution.provider);
    execution.provider = provider;
    const isTestMode = execution.skill === 'test';

    // Create .specflow directory in project for workflow files
    const specifyDir = join(execution.projectPath, '.specflow');
    mkdirSync(specifyDir, { recursive: true });

    const scriptFile = join(specifyDir, 'run-workflow.sh');
    const outputFile = join(specifyDir, 'workflow-output.json');

    let scriptContent: string;

    if (isTestMode) {
      // Simple test mode
      if (provider === 'codex') {
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
codex exec --json "Say hello" > "${outputFile}" 2>&1
`;
      } else {
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
claude -p --output-format json "Say hello" < /dev/null > "${outputFile}" 2>&1
`;
      }
      execution.logs.push(`[TEST] Simple hello test`);
    } else if (isResume && execution.sessionId) {
      // Resume existing session with answers
      const resumePrompt = buildResumePrompt(execution.answers);
      const promptFile = join(specifyDir, 'resume-prompt.txt');
      writeFileSync(promptFile, resumePrompt);

      execution.logs.push(`[RESUME] Session: ${execution.sessionId}`);
      execution.logs.push(`[INFO] Resume prompt (${resumePrompt.length} chars)`);

      if (provider === 'codex') {
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
PROMPT="$(cat "${promptFile}")"
codex exec resume --json "${execution.sessionId}" "$PROMPT" > "${outputFile}" 2>&1
`;
      } else {
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
claude -p --output-format json --resume "${execution.sessionId}" --dangerously-skip-permissions < "${promptFile}" > "${outputFile}" 2>&1
`;
      }
    } else {
      // Initial run
      const prompt = buildInitialPrompt(execution.skill, provider);
      if (!prompt) {
        const { skillName } = parseSkillWithContext(execution.skill);
        execution.status = 'failed';
        execution.error = skillName
          ? `Could not load skill: ${skillName}`
          : `Could not load skill: ${execution.skill}. Use a command like ${toSlashSkillCommand('flow.orchestrate')}`;
        execution.updatedAt = new Date().toISOString();
        execution.logs.push(`[ERROR] Could not load skill: ${execution.skill}`);
        saveExecution(execution);
        return;
      }

      const promptFile = join(specifyDir, 'prompt.txt');
      writeFileSync(promptFile, prompt);
      execution.logs.push(`[INFO] Initial prompt (${prompt.length} chars)`);

      if (provider === 'codex') {
        const schemaFile = join(specifyDir, 'workflow-output-schema.json');
        writeFileSync(schemaFile, JSON.stringify(CODEX_WORKFLOW_SCHEMA, null, 2));
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
PROMPT="$(cat "${promptFile}")"
codex exec --json --output-schema "${schemaFile}" "$PROMPT" > "${outputFile}" 2>&1
`;
      } else {
        scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
claude -p --output-format json --dangerously-skip-permissions < "${promptFile}" > "${outputFile}" 2>&1
`;
      }
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
        PATH: `${process.env.HOME}/.bun/bin:${process.env.HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
      };

      exec(
        cmd,
        {
          cwd: execution.projectPath,
          timeout: 600000, // 10 minutes
          shell: '/bin/bash',
          env,
        },
        (error, _stdout, _stderr) => {
          // Reload execution state (might have been updated)
          const exec = loadExecution(id);
          if (!exec) {
            resolve();
            return;
          }

          exec.updatedAt = new Date().toISOString();

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

          // Parse result
          try {
            if (provider === 'codex') {
              const parsed = parseCodexOutput(stdout);
              if (parsed.sessionId) {
                exec.sessionId = parsed.sessionId;
              }
              if (parsed.error) {
                exec.status = 'failed';
                exec.error = parsed.error;
                exec.logs.push(`[ERROR] ${parsed.error}`);
              } else if (parsed.output) {
                exec.output = parsed.output;
                exec.status = parsed.output.status === 'needs_input'
                  ? 'waiting_for_input'
                  : parsed.output.status === 'error'
                    ? 'failed'
                    : 'completed';
                if (parsed.output.status === 'error') {
                  exec.error = parsed.output.message;
                }
              }
            } else {
              const result = JSON.parse(stdout) as ClaudeCliResult;
              exec.sessionId = result.session_id;
              exec.costUsd = (exec.costUsd || 0) + (result.total_cost_usd || 0);

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
            }
          } catch {
            exec.status = 'failed';
            exec.error = `Parse error: ${stdout.slice(0, 200)}`;
            exec.logs.push(`[PARSE ERROR] ${exec.error}`);
          }

          saveExecution(exec);
          resolve();
        }
      );
    });
  }
}

// Export singleton
export const workflowExecutor = new WorkflowExecutor();
