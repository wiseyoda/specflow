import { Command } from 'commander';
import { z } from 'zod';
import {
  readState,
  readRawState,
  writeState,
  writeRawState,
  setStateValue,
  getStateValue,
  parseValue,
} from '../../lib/state.js';
import { output, success } from '../../lib/output.js';
import { handleError, ValidationError } from '../../lib/errors.js';
import { randomUUID } from 'node:crypto';

/**
 * Output structure for a single state set operation
 */
interface StateSetItem {
  key: string;
  value: unknown;
  previousValue?: unknown;
}

/**
 * Output structure for state set command with --json flag
 */
export interface StateSetOutput {
  status: 'success' | 'error';
  command: 'state set';
  updates: StateSetItem[];
  error?: { message: string; hint: string };
}

/**
 * Zod schema for state key validation
 * Keys must be dot-separated segments where each segment is either:
 * - An identifier (starts with letter/underscore, followed by alphanumerics)
 * - A numeric key (e.g., phase numbers like "0082")
 */
const stateKeySchema = z
  .string()
  .min(1, 'Key cannot be empty')
  .max(256, 'Key too long (max 256 characters)')
  .regex(
    /^([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+)(\.([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+))*$/,
    'Key must be dot-separated identifiers (e.g., orchestration.step.current, memory.archive_reviews.0082)',
  );

/**
 * Set one or more values in state using key=value format
 *
 * Examples:
 *   specflow state set orchestration.step.current=implement
 *   specflow state set orchestration.step.current=analyze orchestration.step.index=1 orchestration.step.status=in_progress
 */

/**
 * Format human-readable output for state set command
 */
function formatHumanReadable(result: StateSetOutput): string {
  if (result.status === 'error' && result.error) {
    return `Error: ${result.error.message}\nHint: ${result.error.hint}`;
  }
  return result.updates.map((u) => `Set ${u.key} = ${JSON.stringify(u.value)}`).join('\n');
}

export const set = new Command('set')
  .description('Set one or more values in state')
  .argument('<keyvalues...>', 'Key=value pairs (e.g., orchestration.step.current=implement)')
  .action(async (keyvalues: string[]) => {
    // Initialize result for JSON output
    const result: StateSetOutput = {
      status: 'error',
      command: 'state set',
      updates: [],
    };

    try {
      // Parse and validate all key=value pairs first
      const parsedPairs: { key: string; value: unknown }[] = [];

      for (const keyvalue of keyvalues) {
        const eqIndex = keyvalue.indexOf('=');
        if (eqIndex === -1) {
          result.error = {
            message: `Invalid format for "${keyvalue}". Expected key=value`,
            hint: 'Use format: specflow state set orchestration.step.current=implement',
          };
          // output() handles JSON vs text based on global --json flag
          output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
          process.exitCode = 1;
          return;
        }

        const key = keyvalue.slice(0, eqIndex);
        const valueStr = keyvalue.slice(eqIndex + 1);

        // Validate key format with Zod
        const keyResult = stateKeySchema.safeParse(key);
        if (!keyResult.success) {
          result.error = {
            message: keyResult.error.issues[0]?.message ?? `Invalid key format for "${key}"`,
            hint: 'Use format: orchestration.step.current',
          };
          output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
          process.exitCode = 1;
          return;
        }

        // Parse value (handles JSON, numbers, booleans, strings)
        const value = parseValue(valueStr);
        parsedPairs.push({ key, value });
      }

      // All pairs validated, now read state and apply all updates
      // Try validated read first, fall back to forgiving read if validation fails
      let state: Record<string, unknown>;
      let useRawWrite = false;

      try {
        state = await readState() as Record<string, unknown>;
      } catch {
        // Validation failed - use forgiving read and auto-repair
        const rawResult = await readRawState();
        if (!rawResult.data) {
          throw new Error('State file not found or unreadable');
        }
        state = rawResult.data;
        useRawWrite = true;

        // Auto-repair: if dashboard.active exists but is missing required fields, fill them
        const dashboard = (state.orchestration as Record<string, unknown>)?.dashboard as Record<string, unknown> | undefined;
        if (dashboard?.active && typeof dashboard.active === 'object') {
          const active = dashboard.active as Record<string, unknown>;
          if (!active.id) {
            active.id = randomUUID();
          }
          if (!active.startedAt) {
            active.startedAt = new Date().toISOString();
          }
          if (!active.config) {
            active.config = {};
          }
        }
      }

      for (const { key, value } of parsedPairs) {
        const previousValue = getStateValue(state as never, key);
        result.updates.push({ key, value, previousValue });
        state = setStateValue(state as never, key, value) as Record<string, unknown>;
      }

      // Write state once with all updates
      if (useRawWrite) {
        // Update timestamp for raw writes too
        state.last_updated = new Date().toISOString();
        await writeRawState(state);
      } else {
        await writeState(state as never);
      }

      // Success
      result.status = 'success';

      // output() handles JSON vs text based on global --json and --quiet flags
      output(result, formatHumanReadable(result));
    } catch (err) {
      // Handle unexpected errors
      result.error = {
        message: err instanceof Error ? err.message : 'Unknown error',
        hint: 'Check the error message for details',
      };
      output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
      process.exitCode = 1;
    }
  });
