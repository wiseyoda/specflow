import { Command } from 'commander';
import { init } from './init.js';

/**
 * Project command - manage SpecFlow project lifecycle
 *
 * Subcommands:
 *   specflow project init        Initialize a new SpecFlow project
 */
export const projectCommand = new Command('project')
  .description('Manage SpecFlow project lifecycle')
  .addCommand(init);
