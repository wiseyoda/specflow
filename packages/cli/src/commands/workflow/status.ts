import { Command } from 'commander';
import chalk from 'chalk';
import type { WorkflowStatus } from '@specflow/shared';
import { output } from '../../lib/output.js';
import { findProjectRoot } from '../../lib/paths.js';
import { readState } from '../../lib/state.js';
import { getPendingQuestions, readQuestionQueue } from '../../lib/question-queue.js';

/**
 * Status command output for JSON mode
 */
interface StatusOutput {
  status: WorkflowStatus;
  workflowId: string | null;
  currentPhase: string | null;
  pendingQuestions: number;
  step: {
    current: string | null;
    index: number | null;
    status: string | null;
  } | null;
}

/**
 * Workflow status command action
 */
export async function workflowStatusAction(
  _options: { json?: boolean }
): Promise<void> {
  const projectPath = findProjectRoot() || process.cwd();

  try {
    // Read orchestration state
    const state = await readState(projectPath);
    const queue = await readQuestionQueue(projectPath);
    const pending = await getPendingQuestions(projectPath);

    // Determine workflow status
    let workflowStatus: WorkflowStatus = 'idle';
    let currentPhase: string | null = null;

    if (state.orchestration?.step?.status === 'in_progress') {
      workflowStatus = pending.length > 0 ? 'waiting_for_input' : 'running';
      currentPhase = state.orchestration.step.current || null;
    } else if (state.orchestration?.step?.status === 'complete') {
      workflowStatus = 'completed';
    } else if (state.orchestration?.step?.status === 'failed') {
      workflowStatus = 'failed';
    }

    const result: StatusOutput = {
      status: workflowStatus,
      workflowId: queue.workflowId || null,
      currentPhase,
      pendingQuestions: pending.length,
      step: state.orchestration?.step
        ? {
            current: state.orchestration.step.current ?? null,
            index: state.orchestration.step.index ?? null,
            status: state.orchestration.step.status ?? null,
          }
        : null,
    };

    // Format human-readable output
    const formatHumanReadable = (): string => {
      const statusColor =
        workflowStatus === 'running'
          ? chalk.blue
          : workflowStatus === 'completed'
            ? chalk.green
            : workflowStatus === 'failed'
              ? chalk.red
              : workflowStatus === 'waiting_for_input'
                ? chalk.yellow
                : chalk.gray;

      const lines = [
        statusColor(`Status: ${workflowStatus}`),
        `Phase: ${currentPhase || 'none'} | Questions: ${pending.length} pending`,
      ];

      if (workflowStatus === 'waiting_for_input') {
        lines.push(`Next: Run 'specflow workflow answer --list' to see questions`);
      } else if (workflowStatus === 'idle') {
        lines.push(`Next: Run 'specflow workflow design' to start`);
      } else if (workflowStatus === 'completed') {
        lines.push(`Next: Run '/flow.analyze' or continue with implementation`);
      }

      return lines.join('\n');
    };

    output(result, formatHumanReadable());
  } catch (_err) {
    // No state file - workflow is idle
    const result: StatusOutput = {
      status: 'idle',
      workflowId: null,
      currentPhase: null,
      pendingQuestions: 0,
      step: null,
    };

    const humanReadable = [
      chalk.gray('Status: idle'),
      'No active workflow',
      `Next: Run 'specflow workflow design' to start`,
    ].join('\n');

    output(result, humanReadable);
  }
}

/**
 * Create the workflow status subcommand
 */
export const workflowStatusCommand = new Command('status')
  .description('Check current workflow status')
  .option('--json', 'Output as JSON')
  .action(workflowStatusAction);
