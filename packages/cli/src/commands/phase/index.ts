import { Command } from 'commander';
import { statusAction } from './status.js';
import { openAction } from './open.js';
import { closeAction } from './close.js';
import { deferAction } from './defer.js';
import { addCommand } from './add.js';

/**
 * Phase command - manage phase lifecycle
 *
 * Usage:
 *   specflow phase                      # Show current phase (alias for status)
 *   specflow phase status               # Current phase info
 *   specflow phase open [number]        # Start an existing phase
 *   specflow phase open --hotfix        # Create and start a hotfix phase
 *   specflow phase open --hotfix "name" # Create hotfix with custom name
 *   specflow phase close                # Close current phase
 *   specflow phase defer "item"         # Add item to backlog
 *   specflow phase add <num> <name>     # Add a new phase to ROADMAP
 */
export const phaseCommand = new Command('phase')
  .description('Manage phase lifecycle (open/close/status/defer/add)')
  .option('--json', 'Output as JSON')
  .action(statusAction); // Default action is status

// Subcommands
phaseCommand
  .command('status')
  .description('Show current phase information')
  .option('--json', 'Output as JSON')
  .action(statusAction);

phaseCommand
  .command('open [number]')
  .description('Start a phase (creates branch, initializes state)')
  .option('--json', 'Output as JSON')
  .option('--hotfix [name]', 'Create a new hotfix phase (auto-calculates number)')
  .action(openAction);

phaseCommand
  .command('close')
  .description('Close current phase (archives, updates ROADMAP)')
  .option('--json', 'Output as JSON')
  .option('--dry-run', 'Show what would happen without making changes')
  .action(closeAction);

phaseCommand
  .command('defer <items...>')
  .description('Add items to project BACKLOG.md')
  .option('--json', 'Output as JSON')
  .option('-p, --priority <level>', 'Priority level (P1, P2, P3)', 'P2')
  .option('-r, --reason <reason>', 'Reason for deferring')
  .action(deferAction);

phaseCommand.addCommand(addCommand);
