import { Command } from 'commander';
import { runProjectInit, type InitOptions } from './project/init.js';

/**
 * Top-level init command - alias for `specflow project init`
 *
 * This provides a convenient shorthand:
 *   specflow init         → specflow project init
 *   specflow init --force → specflow project init --force
 */
export const initCommand = new Command('init')
  .description('Initialize a new SpecFlow project (alias for "project init")')
  .option('--force', 'Reinitialize even if already initialized')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .action(runProjectInit);
