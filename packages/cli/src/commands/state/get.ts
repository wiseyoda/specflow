import { Command } from 'commander';
import { readState, getStateValue } from '../../lib/state.js';
import { output } from '../../lib/output.js';
import { handleError } from '../../lib/errors.js';

/**
 * Get a value from state by dot-notation key
 *
 * Examples:
 *   specflow state get orchestration.step.current
 *   specflow state get project.name
 *   specflow state get --json orchestration
 */
export const get = new Command('get')
  .description('Get a value from state')
  .argument('[key]', 'Dot-notation key (e.g., orchestration.step.current)')
  .option('--json', 'Output as JSON')
  .action(async (key: string | undefined, options: { json?: boolean }) => {
    try {
      const state = await readState();

      if (!key) {
        // No key provided - output entire state
        output(state);
        return;
      }

      const value = getStateValue(state, key);

      if (value === undefined) {
        if (options.json) {
          output(null);
        } else {
          console.log('(not set)');
        }
        return;
      }

      if (options.json || typeof value === 'object') {
        output(value);
      } else {
        console.log(String(value));
      }
    } catch (err) {
      handleError(err);
    }
  });
