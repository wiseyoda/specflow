import { Command } from 'commander';
import { get } from './get.js';
import { set } from './set.js';
import { show } from './show.js';
import { init } from './init.js';
import { sync } from './sync.js';

/**
 * State command group - manages orchestration state
 *
 * Usage:
 *   specflow state get <key>           Get a value by dot-path
 *   specflow state set <key>=<value>   Set a value
 *   specflow state show                Show human-readable summary
 *   specflow state init                Initialize new state file
 *   specflow state sync                Sync state with filesystem
 */
export const stateCommand = new Command('state')
  .description('Manage orchestration state')
  .addCommand(get)
  .addCommand(set)
  .addCommand(show)
  .addCommand(init)
  .addCommand(sync);
