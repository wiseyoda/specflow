import { Command } from 'commander';
import { basename, resolve } from 'node:path';
import { createInitialState, writeState } from '../../lib/state.js';
import { getStatePath, pathExists } from '../../lib/paths.js';
import { registerProject } from '../../lib/registry.js';
import { output, success, warn } from '../../lib/output.js';

/**
 * Output structure for state init command with --json flag
 */
export interface StateInitOutput {
  status: 'success' | 'error';
  command: 'state init';
  project: {
    id: string;
    name: string;
    path: string;
  };
  statePath: string;
  registered: boolean;
  overwritten: boolean;
  error?: { message: string; hint: string };
}

/**
 * Format human-readable output for state init command
 */
function formatHumanReadable(result: StateInitOutput): string {
  if (result.status === 'error' && result.error) {
    return `Error: ${result.error.message}\nHint: ${result.error.hint}`;
  }
  return `Initialized state for "${result.project.name}"`;
}

/**
 * Initialize a new state file for a project
 *
 * Examples:
 *   specflow state init
 *   specflow state init --force
 *   specflow state init --name "My Project"
 */
export const init = new Command('init')
  .description('Initialize a new state file')
  .option('--force', 'Overwrite existing state file')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .action(async (options: { force?: boolean; name?: string }) => {
    // Initialize result for JSON output
    const projectPath = resolve(process.cwd());
    const statePath = getStatePath(projectPath);
    let result: StateInitOutput = {
      status: 'error',
      command: 'state init',
      project: {
        id: '',
        name: '',
        path: projectPath,
      },
      statePath,
      registered: false,
      overwritten: false,
    };

    try {
      // Check if state already exists
      const stateExists = pathExists(statePath);
      if (stateExists && !options.force) {
        result.error = {
          message: 'State file already exists',
          hint: 'Use --force to overwrite',
        };
        output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
        process.exitCode = 1;
        return;
      }

      if (stateExists && options.force) {
        result.overwritten = true;
        warn('Overwriting existing state file');
      }

      // Determine project name
      const projectName = options.name ?? basename(projectPath);
      result.project.name = projectName;

      // Create and write initial state
      const state = createInitialState(projectName, projectPath);
      result.project.id = state.project.id;

      await writeState(state, projectPath);

      // Register project in central registry for dashboard
      registerProject(state.project.id, projectName, projectPath);
      result.registered = true;

      // Success
      result.status = 'success';

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
