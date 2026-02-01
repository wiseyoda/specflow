import { Command } from 'commander';
import chalk from 'chalk';
import { readState } from '../../lib/state.js';
import { output, header, keyValue, status } from '../../lib/output.js';
import { handleError } from '../../lib/errors.js';

/**
 * Show a human-readable summary of the current state
 */
export const show = new Command('show')
  .description('Show human-readable state summary')
  .option('--json', 'Output as JSON instead')
  .action(async (options: { json?: boolean }) => {
    try {
      const state = await readState();

      if (options.json) {
        output(state);
        return;
      }

      // Project info
      header('Project');
      keyValue('Name', state.project?.name);
      keyValue('Path', state.project?.path);
      keyValue('ID', state.project?.id);

      // Phase info
      header('Current Phase');
      const phase = state.orchestration?.phase;
      if (phase?.number) {
        keyValue('Number', phase.number);
        keyValue('Name', phase.name);
        keyValue('Branch', phase.branch);

        const phaseStatus = phase.status ?? 'unknown';
        const statusType =
          phaseStatus === 'complete'
            ? 'ok'
            : phaseStatus === 'in_progress'
              ? 'pending'
              : 'pending';
        status('Status', statusType, phaseStatus);
      } else {
        console.log(chalk.dim('  No phase active'));
      }

      // Step info
      header('Current Step');
      const step = state.orchestration?.step;
      if (step) {
        keyValue('Step', step.current);
        const stepStatus = step.status ?? 'unknown';
        const stepStatusType =
          stepStatus === 'complete'
            ? 'ok'
            : stepStatus === 'in_progress'
              ? 'pending'
              : stepStatus === 'failed' || stepStatus === 'blocked'
                ? 'error'
                : 'pending';
        status('Status', stepStatusType, stepStatus);
      }

      // Health info
      header('Health');
      const health = state.health;
      if (health) {
        const healthStatus = health.status ?? 'unknown';
        const healthType =
          healthStatus === 'ready' || healthStatus === 'healthy'
            ? 'ok'
            : healthStatus === 'warning'
              ? 'warn'
              : healthStatus === 'error'
                ? 'error'
                : 'pending';
        status('Status', healthType, healthStatus);

        if (health.issues && Array.isArray(health.issues) && health.issues.length > 0) {
          console.log(chalk.dim(`  Issues: ${health.issues.length}`));
        }
      }

      // Last updated
      console.log();
      keyValue('Last Updated', state.last_updated);
    } catch (err) {
      handleError(err);
    }
  });
