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

/** Get current output options */
export function getOutputOptions(): OutputOptions {
  return globalOptions;
}

/** Output JSON if --json flag, otherwise human-readable */
export function output(data: unknown, humanReadable?: string): void {
  if (globalOptions.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (humanReadable !== undefined) {
    console.log(humanReadable);
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/** Print success message (suppressed in quiet mode) */
export function success(message: string): void {
  if (!globalOptions.quiet) {
    console.log(chalk.green('✓'), message);
  }
}

/** Print info message (suppressed in quiet mode) */
export function info(message: string): void {
  if (!globalOptions.quiet) {
    console.log(chalk.blue('ℹ'), message);
  }
}

/** Print warning message */
export function warn(message: string): void {
  console.log(chalk.yellow('⚠'), message);
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

/** Format a table for output */
export function table(headers: string[], rows: (string | number)[][]): void {
  if (globalOptions.json) return;

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)),
  );

  // Print header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(headerLine));
  console.log(chalk.dim('─'.repeat(headerLine.length)));

  // Print rows
  for (const row of rows) {
    console.log(row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('  '));
  }
}
