import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { WorkflowEvent } from '@specflow/shared';
import {
  assertAgentCliAvailable,
  resolveAgentProvider,
  type AgentProvider,
} from './claude-validator.js';

type JsonRecord = Record<string, unknown>;

function normalizeSkillIdentifier(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const token = trimmed.split(/\s+/)[0]
    .replace(/^[/$]+/, '')
    .toLowerCase();

  let core: string;
  if (token.startsWith('flow.')) {
    core = token.slice('flow.'.length);
  } else if (token.startsWith('flow-')) {
    core = token.slice('flow-'.length);
  } else {
    return null;
  }

  core = core.replace(/_/g, '-');
  if (core === 'tasks-to-issues') {
    core = 'taskstoissues';
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(core)) {
    return null;
  }

  return `flow.${core}`;
}

/**
 * Load a skill file from provider-specific locations.
 */
function loadSkillContent(
  skill: string,
  provider: AgentProvider,
  cwd: string
): string | null {
  const canonicalSkill = normalizeSkillIdentifier(skill);
  if (!canonicalSkill) {
    return null;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  const candidates = provider === 'codex'
    ? [
        join(homeDir, '.codex', 'skills', canonicalSkill.replace('.', '-'), 'SKILL.md'),
      ]
    : [
        join(homeDir, '.claude', 'commands', `${canonicalSkill}.md`),
        join(cwd, 'commands', `${canonicalSkill}.md`),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8');
    }
  }

  return null;
}

/**
 * JSON Schema for workflow structured output.
 */
const WORKFLOW_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['completed', 'needs_input', 'error'],
      description: 'Current workflow status',
    },
    phase: {
      type: 'string',
      description: 'Current phase (discover, specify, plan, tasks, checklists)',
    },
    message: {
      type: 'string',
      description: 'Status message or summary',
    },
    questions: {
      type: 'array',
      description: 'Questions needing user input (mirrors AskUserQuestion format)',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question text' },
          header: { type: 'string', description: 'Short label (max 12 chars)' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Option display text' },
                description: { type: 'string', description: 'Option explanation' },
              },
              required: ['label', 'description'],
            },
          },
          multiSelect: {
            type: 'boolean',
            description: 'Allow multiple selections',
            default: false,
          },
        },
        required: ['question'],
      },
    },
    artifacts: {
      type: 'array',
      description: 'Files created or modified',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['created', 'modified'] },
        },
      },
    },
  },
  required: ['status'],
};

/**
 * Codex strict mode requires:
 * - additionalProperties: false for all objects
 * - required includes all object keys
 * Optional keys are modeled as anyOf: [<schema>, {type: 'null'}]
 */
function toCodexStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((value) => toCodexStrictSchema(value));
  }

  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const next: JsonRecord = { ...(schema as JsonRecord) };

  if (next.properties && typeof next.properties === 'object') {
    const originalRequired = new Set(
      Array.isArray(next.required)
        ? (next.required as unknown[]).filter((value): value is string => typeof value === 'string')
        : []
    );
    const strictProperties: JsonRecord = {};

    for (const [propertyName, propertySchema] of Object.entries(next.properties as JsonRecord)) {
      let strictProperty = toCodexStrictSchema(propertySchema);

      if (!originalRequired.has(propertyName)) {
        strictProperty = {
          anyOf: [strictProperty, { type: 'null' }],
        };
      }

      strictProperties[propertyName] = strictProperty;
      originalRequired.add(propertyName);
    }

    next.properties = strictProperties;
    next.required = [...originalRequired];
    next.additionalProperties = false;
  }

  if (next.items) {
    next.items = toCodexStrictSchema(next.items);
  }

  if (Array.isArray(next.anyOf)) {
    next.anyOf = next.anyOf.map((value) => toCodexStrictSchema(value));
  }

  if (Array.isArray(next.oneOf)) {
    next.oneOf = next.oneOf.map((value) => toCodexStrictSchema(value));
  }

  if (Array.isArray(next.allOf)) {
    next.allOf = next.allOf.map((value) => toCodexStrictSchema(value));
  }

  return next;
}

const CODEX_WORKFLOW_SCHEMA = toCodexStrictSchema(WORKFLOW_SCHEMA);

/**
 * Options for spawning an agent CLI.
 */
export interface ClaudeRunnerOptions {
  /** Working directory for execution */
  cwd: string;
  /** Skill to invoke (e.g., '/flow.design') */
  skill: string;
  /** Optional phase flag for design command */
  phase?: string;
  /** Additional arguments to pass */
  args?: string[];
  /** Answers to provide for questions (for resuming) */
  answers?: Record<string, string>;
  /** Explicit provider override */
  provider?: AgentProvider | string;
  /** Existing session/thread identifier for resume */
  sessionId?: string;
}

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
 * Structured output from workflow execution.
 */
export interface WorkflowOutput {
  status: 'completed' | 'needs_input' | 'error';
  phase?: string;
  message?: string;
  questions?: WorkflowQuestion[];
  artifacts?: Array<{
    path: string;
    action: 'created' | 'modified';
  }>;
}

/**
 * Result of CLI execution.
 */
export interface ClaudeRunnerResult {
  /** Exit code from process */
  exitCode: number | null;
  /** Whether execution completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Structured output from workflow */
  output?: WorkflowOutput;
  /** Session ID for JSONL file access */
  sessionId?: string;
  /** Number of events emitted */
  eventsEmitted: number;
}

/**
 * Callback for workflow events.
 */
export type WorkflowEventCallback = (event: WorkflowEvent) => void;

/**
 * Claude CLI result JSON structure.
 */
interface ClaudeCliResult {
  type: string;
  subtype: string;
  is_error: boolean;
  session_id: string;
  structured_output?: WorkflowOutput;
  result?: string;
}

/**
 * Parsed Codex JSONL result.
 */
interface CodexParsedResult {
  sessionId?: string;
  output?: WorkflowOutput;
  error?: string;
}

function stripNullValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripNullValues(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: JsonRecord = {};
  for (const [key, rawValue] of Object.entries(value as JsonRecord)) {
    if (rawValue === null) {
      continue;
    }
    result[key] = stripNullValues(rawValue);
  }
  return result;
}

function coerceWorkflowOutput(raw: unknown): WorkflowOutput | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = stripNullValues(raw) as JsonRecord;
  const status = data.status;
  if (status !== 'completed' && status !== 'needs_input' && status !== 'error') {
    return null;
  }

  const output: WorkflowOutput = { status };

  if (typeof data.phase === 'string') {
    output.phase = data.phase;
  }

  if (typeof data.message === 'string') {
    output.message = data.message;
  }

  if (Array.isArray(data.questions)) {
    output.questions = data.questions
      .filter((entry): entry is JsonRecord => !!entry && typeof entry === 'object')
      .map((entry) => ({
        question: typeof entry.question === 'string' ? entry.question : '',
        header: typeof entry.header === 'string' ? entry.header : undefined,
        options: Array.isArray(entry.options)
          ? entry.options
              .filter((opt): opt is JsonRecord => !!opt && typeof opt === 'object')
              .map((opt) => ({
                label: typeof opt.label === 'string' ? opt.label : '',
                description: typeof opt.description === 'string' ? opt.description : '',
              }))
              .filter((opt) => opt.label.length > 0)
          : undefined,
        multiSelect: typeof entry.multiSelect === 'boolean' ? entry.multiSelect : undefined,
      }))
      .filter((question) => question.question.length > 0);
  }

  if (Array.isArray(data.artifacts)) {
    output.artifacts = data.artifacts
      .filter((entry): entry is JsonRecord => !!entry && typeof entry === 'object')
      .map((entry) => ({
        path: typeof entry.path === 'string' ? entry.path : '',
        action: entry.action === 'created' || entry.action === 'modified' ? entry.action : 'modified',
      }))
      .filter((artifact) => artifact.path.length > 0);
  }

  return output;
}

export function parseCodexJsonlOutput(stdout: string): CodexParsedResult {
  let sessionId: string | undefined;
  let lastAgentMessageText: string | undefined;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('{')) {
      continue;
    }

    try {
      const event = JSON.parse(line) as JsonRecord;
      const eventType = event.type;

      if (eventType === 'thread.started' && typeof event.thread_id === 'string') {
        sessionId = event.thread_id;
      }

      if (eventType === 'item.completed') {
        const item = event.item;
        if (item && typeof item === 'object') {
          const typedItem = item as JsonRecord;
          if (typedItem.type === 'agent_message' && typeof typedItem.text === 'string') {
            lastAgentMessageText = typedItem.text;
          }
        }
      }
    } catch {
      // Non-JSON lines are expected from tool logging on stderr, ignore.
    }
  }

  if (!lastAgentMessageText) {
    return {
      sessionId,
      error: 'Failed to parse Codex output: missing final agent_message event',
    };
  }

  try {
    const structured = JSON.parse(lastAgentMessageText);
    const coerced = coerceWorkflowOutput(structured);
    if (!coerced) {
      return {
        sessionId,
        error: 'Failed to parse Codex output: final message does not match workflow schema',
      };
    }
    return { sessionId, output: coerced };
  } catch {
    // If output schema was not applied, fallback to plain completed message.
    return {
      sessionId,
      output: {
        status: 'completed',
        message: lastAgentMessageText,
      },
    };
  }
}

/**
 * Agent runner that supports Claude and Codex backends.
 */
export class ClaudeRunner {
  private eventCallback: WorkflowEventCallback;

  constructor(eventCallback: WorkflowEventCallback) {
    this.eventCallback = eventCallback;
  }

  /**
   * Start workflow execution with the selected provider.
   */
  async run(options: ClaudeRunnerOptions): Promise<ClaudeRunnerResult> {
    const provider = resolveAgentProvider(options.provider);
    assertAgentCliAvailable(provider);

    const prompt = this.buildPrompt(options, provider);

    let schemaDir: string | undefined;
    let args: string[];
    let command: string;

    if (provider === 'codex') {
      command = 'codex';
      if (options.sessionId) {
        args = [
          'exec',
          'resume',
          '--json',
          options.sessionId,
          prompt,
          ...(options.args || []),
        ];
      } else {
        schemaDir = mkdtempSync(join(tmpdir(), 'specflow-codex-schema-'));
        const schemaPath = join(schemaDir, 'workflow-output-schema.json');
        writeFileSync(schemaPath, JSON.stringify(CODEX_WORKFLOW_SCHEMA, null, 2));
        args = [
          'exec',
          '--json',
          '--output-schema',
          schemaPath,
          prompt,
          ...(options.args || []),
        ];
      }
    } else {
      command = 'claude';
      args = [
        '-p',
        '--output-format',
        'json',
        '--dangerously-skip-permissions',
        '--disallowedTools',
        'AskUserQuestion',
        '--json-schema',
        JSON.stringify(WORKFLOW_SCHEMA),
        prompt,
        ...(options.args || []),
      ];
    }

    this.eventCallback({
      type: 'phase_started',
      timestamp: new Date().toISOString(),
      data: { phase: 'workflow', skill: options.skill, provider },
    });

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let eventsEmitted = 1;

      const proc = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
        },
      });

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const result: ClaudeRunnerResult = {
          exitCode: code,
          success: code === 0,
          eventsEmitted,
        };

        if (provider === 'codex') {
          const parsed = parseCodexJsonlOutput(stdout);
          result.sessionId = parsed.sessionId;
          result.output = parsed.output;
          if (parsed.error) {
            result.success = false;
            result.error = parsed.error;
          }
        } else {
          try {
            const parsed = JSON.parse(stdout) as ClaudeCliResult;
            result.sessionId = parsed.session_id;

            if (parsed.structured_output) {
              result.output = parsed.structured_output;
            }

            if (parsed.is_error) {
              result.success = false;
              result.error = parsed.result || 'Unknown error';
            }
          } catch {
            result.success = false;
            result.error = `Failed to parse Claude output: ${stdout.slice(0, 200)}`;
            if (stderr) {
              result.error += `\nStderr: ${stderr.slice(0, 200)}`;
            }
          }
        }

        if (result.output) {
          eventsEmitted = this.emitStructuredOutputEvents(result.output, eventsEmitted);
        }

        this.eventCallback({
          type: 'complete',
          timestamp: new Date().toISOString(),
          data: {
            exitCode: code,
            success: result.success,
            status: result.output?.status,
            provider,
            eventsEmitted,
          },
        });
        eventsEmitted++;
        result.eventsEmitted = eventsEmitted;

        if (schemaDir) {
          rmSync(schemaDir, { recursive: true, force: true });
        }

        resolve(result);
      });

      proc.on('error', (error) => {
        this.eventCallback({
          type: 'error',
          timestamp: new Date().toISOString(),
          data: { message: error.message, source: 'process' },
        });

        if (schemaDir) {
          rmSync(schemaDir, { recursive: true, force: true });
        }

        resolve({
          exitCode: null,
          success: false,
          error: error.message,
          eventsEmitted: eventsEmitted + 1,
        });
      });
    });
  }

  private emitStructuredOutputEvents(output: WorkflowOutput, count: number): number {
    let eventsEmitted = count;

    if (output.phase) {
      this.eventCallback({
        type: 'phase_started',
        timestamp: new Date().toISOString(),
        data: { phase: output.phase },
      });
      eventsEmitted++;
    }

    if (output.questions) {
      for (let i = 0; i < output.questions.length; i++) {
        const question = output.questions[i];
        const id = question.header
          ? question.header.toLowerCase().replace(/\s+/g, '_')
          : `q${i + 1}`;
        this.eventCallback({
          type: 'question_queued',
          timestamp: new Date().toISOString(),
          data: {
            id,
            content: question.question,
            header: question.header,
            options: question.options || [],
            multiSelect: question.multiSelect || false,
          },
        });
        eventsEmitted++;
      }
    }

    if (output.artifacts) {
      for (const artifact of output.artifacts) {
        this.eventCallback({
          type: 'artifact_created',
          timestamp: new Date().toISOString(),
          data: {
            path: artifact.path,
            artifact: artifact.path.split('/').pop(),
            action: artifact.action,
          },
        });
        eventsEmitted++;
      }
    }

    return eventsEmitted;
  }

  /**
   * Build the prompt for the selected provider.
   */
  private buildPrompt(options: ClaudeRunnerOptions, provider: AgentProvider): string {
    const skillContent = loadSkillContent(options.skill, provider, options.cwd);

    if (!skillContent) {
      return `Error: Could not find skill file for ${options.skill}`;
    }

    let prompt = `# CLI Mode Instructions

You are running in non-interactive CLI mode. IMPORTANT:
1. Do NOT call AskUserQuestion or any interactive question tool
2. Output a structured workflow response matching the provided schema
3. If user input is needed, set status to "needs_input" and populate questions[]
4. Questions should use:
   - question: The question text
   - header: Short label (max 12 chars)
   - options: Array of {label, description}
   - multiSelect: true if multiple selections are allowed

# Skill Instructions

Execute the following skill:

`;

    if (options.phase) {
      prompt += `Arguments: --${options.phase}\n\n`;
    }

    prompt += skillContent;

    if (options.answers && Object.keys(options.answers).length > 0) {
      prompt += `\n\n# Previous User Answers\n\nThe user has already answered these questions:\n${JSON.stringify(options.answers, null, 2)}\n\nContinue from where you left off using these answers.`;
    }

    return prompt;
  }
}

/**
 * Create a new runner instance.
 */
export function createClaudeRunner(
  eventCallback: WorkflowEventCallback
): ClaudeRunner {
  return new ClaudeRunner(eventCallback);
}
