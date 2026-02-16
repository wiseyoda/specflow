import { Command } from 'commander';
import { output } from '../lib/output.js';
import { getStatus, type StatusOutput, type NextAction } from '../lib/status.js';
import { handleError } from '../lib/errors.js';

// Re-export types for consumers that import from commands/status
export type { NextAction, StatusOutput };

/**
 * Format human-readable status output
 */
function formatHumanReadable(status: StatusOutput): string {
  const lines: string[] = [];

  // Phase info
  if (status.phase.number) {
    lines.push(`Phase ${status.phase.number}: ${status.phase.name ?? 'Unknown'}`);
    lines.push(`Status: ${status.phase.status ?? 'unknown'} | Step: ${status.step.current ?? 'none'}`);
  } else {
    lines.push('No active phase');
  }

  // Progress
  if (status.progress.tasksTotal > 0) {
    lines.push(`Tasks: ${status.progress.tasksCompleted}/${status.progress.tasksTotal} (${status.progress.percentage}%)`);
  }

  // Next action
  const actionMap: Record<NextAction, string> = {
    start_phase: 'Start next phase',
    run_design: 'Run /flow.design to create artifacts',
    run_analyze: 'Run /flow.analyze to validate',
    continue_implement: 'Continue implementing tasks',
    run_verify: 'Run /flow.verify to complete',
    ready_to_merge: 'Ready for /flow.merge',
    fix_health: 'Fix health issues first',
    awaiting_user_gate: 'Awaiting user verification',
    archive_phase: 'Archive completed phase',
  };
  lines.push(`Next: ${actionMap[status.nextAction]}`);

  return lines.join('\n');
}

/**
 * Status command
 */
export const statusCommand = new Command('status')
  .description('Get complete project status in a single call')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const status = await getStatus();

      if (options.json) {
        output(status);
      } else {
        output(status, formatHumanReadable(status));
      }
    } catch (err) {
      handleError(err);
    }
  });
