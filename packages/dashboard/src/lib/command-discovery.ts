import { spawn } from 'child_process';
import type { SpecflowCommand, SpecflowSubcommand, CommandList } from '@specflow/shared';

/**
 * Cache for discovered commands
 */
let commandCache: CommandList | null = null;
let cacheRefreshTimeout: NodeJS.Timeout | null = null;

/**
 * Cache refresh interval (5 minutes)
 */
const CACHE_REFRESH_MS = 5 * 60 * 1000;

/**
 * Execute specflow help and capture output
 */
async function executeSpecflowHelp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('specflow', ['help'], {
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`specflow help failed: ${stderr || 'Unknown error'}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('specflow help timed out'));
    }, 10000);
  });
}

/**
 * Parse specflow help output to extract commands
 *
 * Expected format:
 * specflow <command> [options]
 *
 * COMMANDS:
 *     context          Show project context
 *     doctor           Diagnose project health
 *     ...
 */
function parseHelpOutput(output: string): SpecflowCommand[] {
  const commands: SpecflowCommand[] = [];
  const lines = output.split('\n');

  let inCommandsSection = false;

  for (const line of lines) {
    // Detect COMMANDS section
    if (line.trim() === 'COMMANDS:' || line.trim() === 'Commands:') {
      inCommandsSection = true;
      continue;
    }

    // End of commands section (empty line or new section)
    if (inCommandsSection && (line.trim() === '' || line.match(/^[A-Z]+:/))) {
      if (line.match(/^[A-Z]+:/) && !line.includes('COMMANDS')) {
        inCommandsSection = false;
      }
      continue;
    }

    if (inCommandsSection) {
      // Parse command line: "    command          Description text"
      const match = line.match(/^\s{4}(\S+)\s{2,}(.+)$/);
      if (match) {
        const [, name, description] = match;
        commands.push({
          name,
          description: description.trim(),
          subcommands: [], // Will be populated by subcommand discovery
        });
      }
    }
  }

  return commands;
}

/**
 * Discover subcommands for a command by running `specflow <cmd> help`
 */
async function discoverSubcommands(command: string): Promise<SpecflowSubcommand[]> {
  try {
    const output = await new Promise<string>((resolve) => {
      const proc = spawn('specflow', [command, '--help'], {
        env: { ...process.env, NO_COLOR: '1' },
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', () => {
        // Some commands don't have subcommands, that's OK
        resolve(stdout);
      });

      proc.on('error', () => {
        resolve('');
      });

      setTimeout(() => {
        proc.kill();
        resolve('');
      }, 5000);
    });

    return parseSubcommands(output, command);
  } catch {
    return [];
  }
}

/**
 * Parse subcommands from help output
 */
function parseSubcommands(output: string, parentCommand: string): SpecflowSubcommand[] {
  const subcommands: SpecflowSubcommand[] = [];
  const lines = output.split('\n');

  let inSubcommandsSection = false;

  for (const line of lines) {
    // Detect COMMANDS or SUBCOMMANDS section
    if (line.match(/^\s*(COMMANDS|SUBCOMMANDS|Commands):/i)) {
      inSubcommandsSection = true;
      continue;
    }

    // End section on new uppercase header or empty line followed by non-indented content
    if (inSubcommandsSection && line.match(/^[A-Z]+:/)) {
      inSubcommandsSection = false;
      continue;
    }

    if (inSubcommandsSection) {
      // Parse: "    subcommand      Description"
      const match = line.match(/^\s{4}(\S+)\s{2,}(.+)$/);
      if (match) {
        const [, name, description] = match;

        // Determine if args are required based on description
        const requiresArgs = description.toLowerCase().includes('<') ||
          ['create', 'mark', 'show', 'set', 'get'].includes(name);

        // Generate arg prompt based on command context
        let argPrompt: string | undefined;
        if (requiresArgs) {
          argPrompt = getArgPrompt(parentCommand, name);
        }

        subcommands.push({
          name,
          description: description.trim(),
          requiresArgs,
          argPrompt,
        });
      }
    }
  }

  return subcommands;
}

/**
 * Get appropriate argument prompt for a command
 */
function getArgPrompt(command: string, subcommand: string): string {
  const prompts: Record<string, Record<string, string>> = {
    issue: {
      create: 'Enter issue title',
      show: 'Enter issue ID (e.g., ISSUE-001)',
      close: 'Enter issue ID to close',
      update: 'Enter issue ID to update',
    },
    tasks: {
      mark: 'Enter task ID(s) (e.g., T001 or T001..T010)',
    },
    phase: {
      show: 'Enter phase number (e.g., 1040)',
      archive: 'Enter phase number to archive',
    },
    state: {
      get: 'Enter state key (e.g., orchestration.phase.status)',
      set: 'Enter key=value (e.g., orchestration.phase.status=complete)',
    },
  };

  return prompts[command]?.[subcommand] ?? 'Enter arguments';
}

/**
 * Discover all available specflow commands
 */
export async function discoverCommands(): Promise<CommandList> {
  // Return cached if fresh
  if (commandCache) {
    return commandCache;
  }

  const helpOutput = await executeSpecflowHelp();
  const commands = parseHelpOutput(helpOutput);

  // Discover subcommands for each command (in parallel)
  const commandsWithSubcommands = await Promise.all(
    commands.map(async (cmd) => ({
      ...cmd,
      subcommands: await discoverSubcommands(cmd.name),
    }))
  );

  const result: CommandList = {
    commands: commandsWithSubcommands,
    lastRefreshed: new Date().toISOString(),
  };

  // Update cache
  commandCache = result;

  // Schedule cache refresh
  if (cacheRefreshTimeout) {
    clearTimeout(cacheRefreshTimeout);
  }
  cacheRefreshTimeout = setTimeout(() => {
    commandCache = null;
  }, CACHE_REFRESH_MS);

  return result;
}

/**
 * Force refresh the command cache
 */
export async function refreshCommands(): Promise<CommandList> {
  commandCache = null;
  return discoverCommands();
}

/**
 * Get cached commands (or discover if not cached)
 */
export function getCachedCommands(): CommandList | null {
  return commandCache;
}
