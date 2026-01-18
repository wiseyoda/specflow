import { spawn, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type {
  CommandExecution,
  CommandOutputEvent,
  ExecutionStatus,
} from '@specflow/shared';
import { ALLOWED_COMMANDS } from './allowed-commands';

/**
 * Internal execution state with process handle
 */
interface ExecutionState extends CommandExecution {
  process?: ChildProcess;
  listeners: Set<(event: CommandOutputEvent) => void>;
}

/**
 * Maximum command execution time in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Sanitize command arguments to prevent injection
 */
function sanitizeArg(arg: string): string {
  // Remove shell metacharacters that could enable injection
  // Allow alphanumeric, spaces, hyphens, underscores, dots, slashes, colons, equals
  return arg.replace(/[;&|`$(){}[\]<>!\\*?"'\n\r]/g, '');
}

/**
 * Validate that a command is allowed
 */
function isAllowedCommand(command: string): boolean {
  const baseCommand = command.split(' ')[0];
  return ALLOWED_COMMANDS.has(baseCommand);
}

/**
 * CLI Executor - manages specflow command execution
 */
class CLIExecutor {
  private executions: Map<string, ExecutionState> = new Map();

  /**
   * Execute a specflow command
   * @param command - Command to execute (e.g., "issue create")
   * @param args - Command arguments
   * @param projectPath - Project directory path
   * @param timeoutMs - Timeout in milliseconds (default 60s)
   * @returns Execution ID for tracking
   */
  execute(
    command: string,
    args: string[],
    projectPath: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): string {
    // Validate command is allowed
    if (!isAllowedCommand(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Sanitize arguments
    const sanitizedArgs = args.map(sanitizeArg);

    const executionId = randomUUID();
    const now = new Date().toISOString();

    // Build the full command
    const fullCommand = command.includes(' ')
      ? command.split(' ')
      : [command];

    // Spawn the process
    const proc = spawn('specflow', [...fullCommand, ...sanitizedArgs], {
      cwd: projectPath,
      env: {
        ...process.env,
        // Ensure we get clean output
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const execution: ExecutionState = {
      id: executionId,
      command: `specflow ${command}`,
      args: sanitizedArgs,
      projectPath,
      status: 'running',
      output: [],
      startedAt: now,
      process: proc,
      listeners: new Set(),
    };

    this.executions.set(executionId, execution);

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      execution.output.push(text);
      this.broadcast(executionId, { type: 'stdout', data: text });
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      execution.output.push(text);
      this.broadcast(executionId, { type: 'stderr', data: text });
    });

    // Handle process exit
    proc.on('close', (code, signal) => {
      execution.status = code === 0 ? 'completed' : 'failed';
      execution.exitCode = code ?? undefined;
      execution.completedAt = new Date().toISOString();
      execution.process = undefined;

      this.broadcast(executionId, {
        type: 'exit',
        code: code ?? -1,
        signal: signal ?? null,
      });
    });

    // Handle process error
    proc.on('error', (error) => {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.process = undefined;

      this.broadcast(executionId, {
        type: 'error',
        message: error.message,
      });
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (execution.status === 'running') {
        proc.kill('SIGTERM');
        execution.status = 'failed';
        execution.completedAt = new Date().toISOString();
        this.broadcast(executionId, {
          type: 'error',
          message: `Command timed out after ${timeoutMs / 1000} seconds`,
        });
      }
    }, timeoutMs);

    // Clear timeout when process exits
    proc.on('close', () => clearTimeout(timeoutId));
    proc.on('error', () => clearTimeout(timeoutId));

    return executionId;
  }

  /**
   * Get execution state by ID
   */
  getExecution(id: string): CommandExecution | undefined {
    const state = this.executions.get(id);
    if (!state) return undefined;

    // Return without internal properties
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { process: _proc, listeners: _listeners, ...execution } = state;
    return execution;
  }

  /**
   * Subscribe to execution output events
   */
  subscribe(
    id: string,
    listener: (event: CommandOutputEvent) => void
  ): () => void {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }

    execution.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      execution.listeners.delete(listener);
    };
  }

  /**
   * Cancel a running execution
   */
  cancel(id: string): boolean {
    const execution = this.executions.get(id);
    if (!execution || !execution.process) {
      return false;
    }

    execution.process.kill('SIGTERM');
    execution.status = 'cancelled';
    execution.completedAt = new Date().toISOString();

    this.broadcast(id, {
      type: 'error',
      message: 'Command cancelled by user',
    });

    return true;
  }

  /**
   * Get all executions (for history)
   */
  getAllExecutions(): CommandExecution[] {
    return Array.from(this.executions.values()).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ process: _proc, listeners: _listeners, ...execution }) => execution
    );
  }

  /**
   * Broadcast event to all listeners for an execution
   */
  private broadcast(id: string, event: CommandOutputEvent): void {
    const execution = this.executions.get(id);
    if (!execution) return;

    for (const listener of execution.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in execution listener:', error);
      }
    }
  }
}

// Export singleton instance
export const cliExecutor = new CLIExecutor();

// Export types for convenience
export type { CommandExecution, CommandOutputEvent, ExecutionStatus };
