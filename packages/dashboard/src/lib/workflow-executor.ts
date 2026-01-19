import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

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
 * JSON Schema for workflow structured output
 */
const WORKFLOW_SCHEMA = {
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

/**
 * Load a skill file content
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
 * Workflow Executor - manages Claude CLI workflow execution
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

    const execution: WorkflowExecution = {
      id,
      projectPath,
      skill,
      status: 'running',
      answers: {},
      logs: [],
      stdout: '',
      stderr: '',
      startedAt: now,
      updatedAt: now,
    };

    execution.logs.push(`[${now}] Starting workflow...`);
    saveExecution(execution);

    // Run Claude in background (don't await)
    this.runClaude(id, false).catch((err) => {
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

    // Run Claude with session resume
    this.runClaude(id, true).catch((err) => {
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
   * Run Claude CLI
   * @param isResume - If true, use --resume with session ID
   */
  private async runClaude(id: string, isResume: boolean): Promise<void> {
    const execution = loadExecution(id);
    if (!execution) return;

    const isTestMode = execution.skill === 'test';

    // Create .specflow directory in project for workflow files
    const specifyDir = join(execution.projectPath, '.specflow');
    mkdirSync(specifyDir, { recursive: true });

    const scriptFile = join(specifyDir, 'run-workflow.sh');
    const outputFile = join(specifyDir, 'workflow-output.json');
    const claudePath = '$HOME/.local/bin/claude';

    let scriptContent: string;

    if (isTestMode) {
      // Simple test mode
      scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
${claudePath} -p --output-format json "Say hello" < /dev/null > "${outputFile}" 2>&1
`;
      execution.logs.push(`[TEST] Simple hello test`);
    } else if (isResume && execution.sessionId) {
      // Resume existing session with answers
      const resumePrompt = buildResumePrompt(execution.answers);
      const promptFile = join(specifyDir, 'resume-prompt.txt');
      writeFileSync(promptFile, resumePrompt);

      const schemaFile = join(specifyDir, 'schema.json');
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_SCHEMA));

      execution.logs.push(`[RESUME] Session: ${execution.sessionId}`);
      execution.logs.push(`[INFO] Resume prompt (${resumePrompt.length} chars)`);

      scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
${claudePath} -p --output-format json --resume "${execution.sessionId}" --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat ${schemaFile})" < "${promptFile}" > "${outputFile}" 2>&1
`;
    } else {
      // Initial run
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
      writeFileSync(schemaFile, JSON.stringify(WORKFLOW_SCHEMA));

      scriptContent = `#!/bin/bash
cd "${execution.projectPath}"
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
          } catch (parseError) {
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
