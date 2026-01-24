/**
 * JSONL test fixture helpers
 * T122/G12.8: Utilities for loading and parsing JSONL test data
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get fixtures directory path
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a JSONL fixture file and parse each line
 */
export function loadJsonlFixture<T = unknown>(filename: string): T[] {
  const filepath = join(__dirname, filename);
  const content = readFileSync(filepath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

/**
 * Load the sample session fixture
 */
export function loadSampleSession() {
  return loadJsonlFixture('sample-session.jsonl');
}

/**
 * Load the workflow events fixture
 */
export function loadWorkflowEvents() {
  return loadJsonlFixture('workflow-events.jsonl');
}

/**
 * Create a temporary JSONL file for testing
 */
export function createTempJsonlContent(events: unknown[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n');
}

/**
 * Sample session event types
 */
export interface SessionEvent {
  type: 'init' | 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'end';
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Sample workflow event types
 */
export interface WorkflowEvent {
  type: 'workflow_start' | 'workflow_progress' | 'workflow_complete';
  timestamp: string;
  workflowId: string;
  [key: string]: unknown;
}
