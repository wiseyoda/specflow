import { Command } from 'commander';
import chalk from 'chalk';
import type { WorkflowEvent } from '@specflow/shared';
import { createClaudeRunner, type WorkflowOutput } from '../../lib/claude-runner.js';
import { resolveAgentProvider, validateAgentCli } from '../../lib/claude-validator.js';
import { addQuestion } from '../../lib/question-queue.js';
import { output } from '../../lib/output.js';
import { findProjectRoot } from '../../lib/paths.js';

/**
 * Valid design sub-phases
 */
const VALID_PHASES = ['discover', 'specify', 'plan', 'tasks', 'checklists'];

/**
 * Design command output for JSON mode
 */
interface DesignOutput {
  success: boolean;
  status: 'completed' | 'needs_input' | 'error';
  phase?: string;
  message?: string;
  eventsEmitted: number;
  artifactsCreated: string[];
  questionsQueued: number;
  sessionId?: string;
  error?: string;
}

/**
 * Design command action
 */
export async function designAction(
  options: { phase?: string; json?: boolean; provider?: string }
): Promise<void> {
  const projectPath = findProjectRoot() || process.cwd();
  const json = options.json || false;
  const provider = resolveAgentProvider(options.provider);

  // Validate phase option if provided
  if (options.phase && !VALID_PHASES.includes(options.phase)) {
    const error = `Invalid phase: ${options.phase}. Valid phases: ${VALID_PHASES.join(', ')}`;
    if (json) {
      console.log(JSON.stringify({ success: false, status: 'error', error } as DesignOutput, null, 2));
    } else {
      console.error(chalk.red(`ERROR: ${error}`));
    }
    process.exit(1);
  }

  // Validate selected agent provider CLI
  const validation = validateAgentCli(provider);
  if (!validation.available) {
    if (json) {
      console.log(JSON.stringify({ success: false, status: 'error', error: validation.error } as DesignOutput, null, 2));
    } else {
      console.error(chalk.red(`ERROR: ${validation.error}`));
    }
    process.exit(1);
  }

  // Track artifacts and questions
  const artifactsCreated: string[] = [];
  let questionsQueued = 0;
  const workflowId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Event handler
  const handleEvent = async (event: WorkflowEvent): Promise<void> => {
    if (json) {
      // Stream each event as NDJSON line
      console.log(JSON.stringify(event));
    } else {
      // Human-readable output
      formatEventForHuman(event);
    }

    // Track artifacts
    if (event.type === 'artifact_created' && event.data.path) {
      artifactsCreated.push(event.data.path as string);
    }

    // Queue questions from events
    if (event.type === 'question_queued') {
      await addQuestion(projectPath, workflowId, {
        id: event.data.id as string,
        content: event.data.content as string,
        options: event.data.options as Array<{ label: string; description: string }>,
      });
      questionsQueued++;
    }
  };

  // Create runner and execute
  const runner = createClaudeRunner(handleEvent);

  if (!json) {
    // Three-Line Rule compliant header
    console.log(chalk.blue('Running /flow.design...'));
    console.log(`Provider: ${provider}`);
    console.log(`Phase: ${options.phase || 'all'}`);
    console.log('');
  }

  const result = await runner.run({
    cwd: projectPath,
    skill: '/flow.design',
    phase: options.phase,
    provider,
  });

  // Build output summary
  const workflowOutput = result.output as WorkflowOutput | undefined;
  const summary: DesignOutput = {
    success: result.success,
    status: workflowOutput?.status || (result.success ? 'completed' : 'error'),
    phase: workflowOutput?.phase,
    message: workflowOutput?.message,
    eventsEmitted: result.eventsEmitted,
    artifactsCreated,
    questionsQueued,
    sessionId: result.sessionId,
    error: result.error,
  };

  // Final output
  if (json) {
    console.log(JSON.stringify({ type: 'summary', ...summary }));
  } else {
    console.log('');

    if (workflowOutput?.status === 'needs_input') {
      // Workflow paused for user input
      console.log(chalk.yellow('Design paused - needs input'));
      console.log(`Questions: ${questionsQueued} pending`);
      console.log(`\nAnswer with: specflow workflow answer`);
      console.log(`Then resume: specflow workflow design`);
    } else if (result.success) {
      console.log(chalk.green('Design complete'));
      if (workflowOutput?.message) {
        console.log(workflowOutput.message);
      }
      console.log(`Artifacts: ${artifactsCreated.length} created`);
      console.log(`Next: Run /flow.analyze or specflow workflow implement`);
    } else {
      console.log(chalk.red(`Design failed: ${result.error}`));
    }
  }

  // Exit with appropriate code
  // needs_input is not a failure, just a pause
  const exitCode = result.success || workflowOutput?.status === 'needs_input' ? 0 : 1;
  process.exit(exitCode);
}

/**
 * Format event for human-readable output
 */
function formatEventForHuman(event: WorkflowEvent): void {
  const time = new Date(event.timestamp).toLocaleTimeString();

  switch (event.type) {
    case 'phase_started':
      console.log(chalk.blue(`[${time}] Phase: ${event.data.phase || event.data.skill}`));
      break;
    case 'phase_complete':
      console.log(chalk.green(`[${time}] Complete: ${event.data.phase}`));
      break;
    case 'artifact_created':
      console.log(chalk.cyan(`[${time}] Created: ${event.data.artifact}`));
      break;
    case 'question_queued':
      console.log(chalk.yellow(`[${time}] Question: ${event.data.id}`));
      console.log(`  ${event.data.content}`);
      break;
    case 'error':
      console.log(chalk.red(`[${time}] Error: ${event.data.message}`));
      break;
    case 'complete':
      if (event.data.status === 'needs_input') {
        console.log(chalk.yellow(`[${time}] Paused - awaiting input`));
      } else {
        console.log(chalk.blue(`[${time}] Complete`));
      }
      break;
  }
}

/**
 * Create the design subcommand
 */
export const designCommand = new Command('design')
  .description('Run /flow.design skill via configured agent provider')
  .option('--json', 'Output as JSON')
  .option('--provider <provider>', 'Agent provider: claude or codex')
  .option(
    '--phase <name>',
    `Run specific sub-phase: ${VALID_PHASES.join(', ')}`
  )
  .action(designAction);
