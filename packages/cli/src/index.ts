import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { stateCommand } from './commands/state/index.js';

const program = new Command()
  .name('specflow')
  .version('3.0.0')
  .description('SpecFlow CLI - Spec-driven development for Claude Code')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--no-color', 'Disable color output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    setOutputOptions({
      json: opts.json,
      quiet: opts.quiet,
    });
  });

// Add command groups
program.addCommand(stateCommand);

// TODO: Add remaining commands as they are implemented
// program.addCommand(phaseCommand);
// program.addCommand(taskCommand);
// program.addCommand(checkCommand);
// program.addCommand(projectCommand);

// Parse and execute
program.parse();
