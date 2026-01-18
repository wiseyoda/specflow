import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { stateCommand } from './commands/state/index.js';
import { statusCommand } from './commands/status.js';
import { nextCommand } from './commands/next.js';
import { markCommand } from './commands/mark.js';
import { checkCommand } from './commands/check.js';
import { phaseCommand } from './commands/phase/index.js';

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

// Add all commands
program.addCommand(stateCommand);
program.addCommand(statusCommand);
program.addCommand(nextCommand);
program.addCommand(markCommand);
program.addCommand(checkCommand);
program.addCommand(phaseCommand);

// Parse and execute
program.parse();
