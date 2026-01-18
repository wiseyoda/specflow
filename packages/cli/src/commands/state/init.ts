import { Command } from 'commander';
import { basename, resolve } from 'node:path';
import { createInitialState, writeState } from '../../lib/state.js';
import { getStatePath, pathExists } from '../../lib/paths.js';
import { registerProject } from '../../lib/registry.js';
import { success, warn } from '../../lib/output.js';
import { handleError, ValidationError } from '../../lib/errors.js';

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
    try {
      const projectPath = resolve(process.cwd());
      const statePath = getStatePath(projectPath);

      // Check if state already exists
      if (pathExists(statePath) && !options.force) {
        throw new ValidationError(
          'State file already exists',
          'Use --force to overwrite',
        );
      }

      if (pathExists(statePath) && options.force) {
        warn('Overwriting existing state file');
      }

      // Determine project name
      const projectName = options.name ?? basename(projectPath);

      // Create and write initial state
      const state = createInitialState(projectName, projectPath);
      await writeState(state, projectPath);

      // Register project in central registry for dashboard
      registerProject(state.project.id, projectName, projectPath);

      success(`Initialized state for "${projectName}"`);
    } catch (err) {
      handleError(err);
    }
  });
