import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { OrchestrationState } from '@specflow/shared';
import { OrchestrationStateSchema, DashboardStateSchema } from '@specflow/shared';
import { getStatePath, pathExists } from './paths.js';
import { NotFoundError, StateError, ValidationError } from './errors.js';
import { atomicWriteFile } from './fs-utils.js';

/**
 * State file operations for SpecFlow
 */

/**
 * Format Zod error for human-readable output
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 3).map(issue => {
    const path = issue.path.join('.');
    return `  - ${path}: ${issue.message}`;
  });
  if (error.issues.length > 3) {
    issues.push(`  ... and ${error.issues.length - 3} more issues`);
  }
  return issues.join('\n');
}

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
    if (err instanceof z.ZodError) {
      throw new StateError(
        `State file schema validation failed:\n${formatZodError(err)}\n\nRun "specflow check --fix" to attempt auto-repair.`
      );
    }
    throw err;
  }
}

/**
 * Result of reading raw state (for diagnostics)
 */
export interface RawStateResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  zodErrors?: z.ZodIssue[];
}

/**
 * Read state file without validation (for diagnostics and repair)
 * Returns parsed JSON data even if it fails Zod validation
 */
export async function readRawState(projectPath?: string): Promise<RawStateResult> {
  const statePath = getStatePath(projectPath);

  if (!pathExists(statePath)) {
    return { success: false, error: 'State file not found' };
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    const data = JSON.parse(content);

    // Try to validate but capture errors instead of throwing
    const result = OrchestrationStateSchema.safeParse(data);
    if (result.success) {
      return { success: true, data };
    } else {
      return {
        success: false,
        data, // Return the raw data anyway for repair
        error: 'Schema validation failed',
        zodErrors: result.error.issues,
      };
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON' };
    }
    return { success: false, error: String(err) };
  }
}

/**
 * Write raw data to state file (bypasses validation, use with caution)
 * Used for auto-repair scenarios
 */
export async function writeRawState(data: Record<string, unknown>, projectPath?: string): Promise<void> {
  const statePath = getStatePath(projectPath);
  const dir = dirname(statePath);
  await mkdir(dir, { recursive: true });
  await atomicWriteFile(statePath, JSON.stringify(data, null, 2));
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

  await atomicWriteFile(statePath, JSON.stringify(updatedState, null, 2) + '\n');
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

/**
 * Unwrap Zod wrapper types (Optional, Nullable, Default) to get the base type.
 */
function unwrapZodType(schema: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = schema._def.typeName;
  if (typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault') {
    return unwrapZodType(schema._def.innerType);
  }
  return schema;
}

/**
 * Resolve the expected Zod leaf type for a dot-path in the OrchestrationStateSchema.
 * Returns the Zod typeName (e.g., 'ZodString', 'ZodNumber', 'ZodBoolean') or null if unknown.
 */
export function resolveSchemaType(dotPath: string): string | null {
  const parts = dotPath.split('.');
  let schema: z.ZodTypeAny = OrchestrationStateSchema;

  for (const part of parts) {
    schema = unwrapZodType(schema);
    const typeName = schema._def.typeName;

    if (typeName === 'ZodObject') {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      if (!(part in shape)) {
        return null;
      }
      schema = shape[part];
    } else if (typeName === 'ZodRecord') {
      // For records, any key maps to the value schema
      schema = (schema as z.ZodRecord)._def.valueType;
    } else {
      return null;
    }
  }

  schema = unwrapZodType(schema);
  return schema._def.typeName ?? null;
}

/**
 * Coerce a parsed value to match the expected schema type for a given dot-path.
 * Returns the coerced value, or the original value if no coercion needed or path unknown.
 */
export function coerceValueForSchema(dotPath: string, value: unknown): unknown {
  const schemaType = resolveSchemaType(dotPath);
  if (!schemaType) return value;

  if (schemaType === 'ZodString' && typeof value === 'number') {
    return String(value);
  }
  if (schemaType === 'ZodNumber' && typeof value === 'string') {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  if (schemaType === 'ZodBoolean' && typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return value;
}

/** Maximum string length for JSON parsing (1MB) */
const MAX_JSON_PARSE_LENGTH = 1024 * 1024;

/** Parse a value string into appropriate type */
export function parseValue(valueStr: string): unknown {
  // Reject extremely long strings to prevent memory exhaustion during parsing
  if (valueStr.length > MAX_JSON_PARSE_LENGTH) {
    throw new Error(`Value too long: ${valueStr.length} chars exceeds max ${MAX_JSON_PARSE_LENGTH}`);
  }

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
  const dashboardState = DashboardStateSchema.parse({});

  return {
    schema_version: '3.0',
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
      dashboard: dashboardState,
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
