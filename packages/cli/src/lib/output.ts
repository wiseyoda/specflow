import chalk from 'chalk';

/**
 * Output formatting utilities for consistent CLI output
 */

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

/** Global output options set by CLI flags */
let globalOptions: OutputOptions = {};

/** Set global output options */
export function setOutputOptions(options: OutputOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

/** Output JSON if --json flag, otherwise human-readable (respects --quiet) */
export function output(data: unknown, humanReadable?: string): void {
  if (globalOptions.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (!globalOptions.quiet) {
    if (humanReadable !== undefined) {
      console.log(humanReadable);
    } else if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/** Print success message (suppressed in quiet or JSON mode) */
export function success(message: string): void {
  if (!globalOptions.quiet && !globalOptions.json) {
    console.log(chalk.green('✓'), message);
  }
}

/** Print info message (suppressed in quiet or JSON mode) */
export function info(message: string): void {
  if (!globalOptions.quiet && !globalOptions.json) {
    console.log(chalk.blue('ℹ'), message);
  }
}

/** Print warning message (suppressed in JSON mode) */
export function warn(message: string): void {
  if (!globalOptions.json) {
    console.log(chalk.yellow('⚠'), message);
  }
}

/** Print error message */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/** Print a header */
export function header(text: string): void {
  if (!globalOptions.quiet && !globalOptions.json) {
    console.log();
    console.log(chalk.bold(text));
    console.log(chalk.dim('─'.repeat(Math.min(text.length, 60))));
  }
}

/** Print a key-value pair */
export function keyValue(key: string, value: string | number | boolean | null | undefined): void {
  if (!globalOptions.quiet && !globalOptions.json) {
    const displayValue = value === null || value === undefined ? chalk.dim('(not set)') : String(value);
    console.log(`${chalk.dim(key + ':')} ${displayValue}`);
  }
}

/** Print a status indicator */
export function status(
  label: string,
  state: 'ok' | 'warn' | 'error' | 'pending',
  detail?: string,
): void {
  if (globalOptions.quiet || globalOptions.json) return;

  const icons = {
    ok: chalk.green('✓'),
    warn: chalk.yellow('⚠'),
    error: chalk.red('✗'),
    pending: chalk.dim('○'),
  };

  const parts = [icons[state], label];
  if (detail) {
    parts.push(chalk.dim(`(${detail})`));
  }
  console.log(parts.join(' '));
}

