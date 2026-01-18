import { Command } from 'commander';
import { readState, writeState, setStateValue, parseValue } from '../../lib/state.js';
import { success } from '../../lib/output.js';
import { handleError, ValidationError } from '../../lib/errors.js';

/**
 * Set a value in state using key=value format
 *
 * Examples:
 *   specflow state set orchestration.step.current=implement
 *   specflow state set orchestration.phase.status=in_progress
 *   specflow state set health.status=ready
 */
export const set = new Command('set')
  .description('Set a value in state')
  .argument('<keyvalue>', 'Key=value pair (e.g., orchestration.step.current=implement)')
  .option('--quiet', 'Suppress output')
  .action(async (keyvalue: string, options: { quiet?: boolean }) => {
    try {
      // Parse key=value
      const eqIndex = keyvalue.indexOf('=');
      if (eqIndex === -1) {
        throw new ValidationError(
          'Invalid format. Expected key=value',
          'Use format: specflow state set orchestration.step.current=implement',
        );
      }

      const key = keyvalue.slice(0, eqIndex);
      const valueStr = keyvalue.slice(eqIndex + 1);

      if (!key) {
        throw new ValidationError('Key cannot be empty');
      }

      // Parse value (handles JSON, numbers, booleans, strings)
      const value = parseValue(valueStr);

      // Read, update, write
      const state = await readState();
      const updatedState = setStateValue(state, key, value);
      await writeState(updatedState);

      if (!options.quiet) {
        success(`Set ${key} = ${JSON.stringify(value)}`);
      }
    } catch (err) {
      handleError(err);
    }
  });
