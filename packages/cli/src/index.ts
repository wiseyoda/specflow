import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { stateCommand } from './commands/state/index.js';
import { statusCommand } from './commands/status.js';
import { nextCommand } from './commands/next.js';
import { markCommand } from './commands/mark.js';
import { checkCommand } from './commands/check.js';
import { initCommand } from './commands/init.js';
import { phaseCommand } from './commands/phase/index.js';
import { projectCommand } from './commands/project/index.js';
import { upgradeCommand } from './commands/upgrade.js';
import { workflowCommand } from './commands/workflow/index.js';
import { templatesCommand } from './commands/templates.js';

const program = new Command()
  .name('specflow')
  .version('3.0.0')
  .description('SpecFlow CLI - Spec-driven development for AI coding agents')
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
program.addCommand(initCommand);
program.addCommand(phaseCommand);
program.addCommand(projectCommand);
program.addCommand(upgradeCommand);
program.addCommand(workflowCommand);
program.addCommand(templatesCommand);

// Parse and execute
program.parse();
