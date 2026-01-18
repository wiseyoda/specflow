import chalk from 'chalk';

/**
 * Custom error types for SpecFlow CLI
 */

export class SpecflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'SpecflowError';
  }

  /** Format error for CLI output */
  format(): string {
    const lines = [chalk.red(`Error: ${this.message}`)];

    if (this.suggestion) {
      lines.push(chalk.yellow(`Suggestion: ${this.suggestion}`));
    }

    return lines.join('\n');
  }
}

export class NotFoundError extends SpecflowError {
  constructor(what: string, suggestion?: string) {
    super(`${what} not found`, 'NOT_FOUND', suggestion);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends SpecflowError {
  constructor(message: string, suggestion?: string) {
    super(message, 'VALIDATION', suggestion);
    this.name = 'ValidationError';
  }
}

export class StateError extends SpecflowError {
  constructor(message: string, suggestion?: string) {
    super(message, 'STATE', suggestion);
    this.name = 'StateError';
  }
}

export class ProjectError extends SpecflowError {
  constructor(message: string, suggestion?: string) {
    super(message, 'PROJECT', suggestion);
    this.name = 'ProjectError';
  }
}

/** Handle and format errors for CLI output */
export function handleError(error: unknown): never {
  if (error instanceof SpecflowError) {
    console.error(error.format());
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error(chalk.red('An unknown error occurred'));
  process.exit(1);
}
