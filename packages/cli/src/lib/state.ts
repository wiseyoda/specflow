import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OrchestrationState } from '@specflow/shared';
import { OrchestrationStateSchema } from '@specflow/shared';
import { getStatePath, pathExists } from './paths.js';
import { NotFoundError, StateError, ValidationError } from './errors.js';

/**
 * State file operations for SpecFlow
 */

/** Read and parse the state file */
export async function readState(projectPath?: string): Promise<OrchestrationState> {
  const statePath = getStatePath(projectPath);

  if (!pathExists(statePath)) {
    throw new NotFoundError(
      'State file',
      'Run "specflow project init" to create a new project',
    );
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    const data = JSON.parse(content);
    return OrchestrationStateSchema.parse(data);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new StateError('State file contains invalid JSON');
    }
    throw err;
  }
}

/** Write state to file */
export async function writeState(
  state: OrchestrationState,
  projectPath?: string,
): Promise<void> {
  const statePath = getStatePath(projectPath);

  // Ensure directory exists
  await mkdir(dirname(statePath), { recursive: true });

  // Update timestamp
  const updatedState = {
    ...state,
    last_updated: new Date().toISOString(),
  };

  await writeFile(statePath, JSON.stringify(updatedState, null, 2) + '\n');
}

/** Get a nested value from state using dot notation */
export function getStateValue(state: OrchestrationState, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = state;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/** Set a nested value in state using dot notation */
export function setStateValue(
  state: OrchestrationState,
  key: string,
  value: unknown,
): OrchestrationState {
  const parts = key.split('.');
  const result = structuredClone(state);

  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;

  return result as OrchestrationState;
}

/** Parse a value string into appropriate type */
export function parseValue(valueStr: string): unknown {
  // Try to parse as JSON first
  try {
    return JSON.parse(valueStr);
  } catch {
    // Return as string if not valid JSON
    return valueStr;
  }
}

/** Create a new initial state */
export function createInitialState(projectName: string, projectPath: string): OrchestrationState {
  const now = new Date().toISOString();

  return {
    schema_version: '2.0',
    project: {
      id: crypto.randomUUID(),
      name: projectName,
      path: projectPath,
    },
    last_updated: now,
    orchestration: {
      phase: {
        id: null,
        number: null,
        name: null,
        branch: null,
        status: 'not_started',
      },
      next_phase: null,
      step: {
        current: 'design',
        index: 0,
        status: 'not_started',
      },
      implement: null,
    },
    health: {
      status: 'initializing',
      last_check: now,
      issues: [],
    },
  };
}

/** Validate state matches expected schema */
export function validateState(state: unknown): OrchestrationState {
  const result = OrchestrationStateSchema.safeParse(state);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ValidationError(`Invalid state: ${issues.join(', ')}`);
  }
  return result.data;
}
