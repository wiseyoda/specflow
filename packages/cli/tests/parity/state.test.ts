import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readState,
  writeState,
  getStateValue,
  setStateValue,
  createInitialState,
  parseValue,
} from '../../src/lib/state.js';

/**
 * Parity tests to ensure TypeScript CLI matches bash behavior
 * These tests verify output format and behavior matches the original bash scripts
 */

describe('state parity tests', () => {
  let tempDir: string;
  let stateDir: string;
  let statePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-parity-'));
    stateDir = path.join(tempDir, '.specify');
    statePath = path.join(stateDir, 'orchestration-state.json');
    fs.mkdirSync(stateDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('schema version', () => {
    it('should use schema_version 3.0', () => {
      const state = createInitialState('test-project', tempDir);
      expect(state.schema_version).toBe('3.0');
    });

    it('should have correct schema structure', () => {
      const state = createInitialState('test-project', tempDir);

      // Must have required top-level fields
      expect(state).toHaveProperty('schema_version');
      expect(state).toHaveProperty('project');
      expect(state).toHaveProperty('orchestration');
      expect(state).toHaveProperty('health');
      expect(state).toHaveProperty('last_updated');

      // Project must have id, name, path
      expect(state.project).toHaveProperty('id');
      expect(state.project).toHaveProperty('name');
      expect(state.project).toHaveProperty('path');

      // Orchestration must have phase, step
      expect(state.orchestration).toHaveProperty('phase');
      expect(state.orchestration).toHaveProperty('step');
    });
  });

  describe('project fields', () => {
    it('should generate UUID for project.id', () => {
      const state = createInitialState('test-project', tempDir);

      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(state.project.id).toMatch(uuidRegex);
    });

    it('should set project.name and project.path', () => {
      const state = createInitialState('my-project', '/path/to/project');
      expect(state.project.name).toBe('my-project');
      expect(state.project.path).toBe('/path/to/project');
    });
  });

  describe('orchestration defaults', () => {
    it('should initialize phase with null values', () => {
      const state = createInitialState('test', tempDir);

      expect(state.orchestration.phase.id).toBeNull();
      expect(state.orchestration.phase.number).toBeNull();
      expect(state.orchestration.phase.name).toBeNull();
      expect(state.orchestration.phase.branch).toBeNull();
      expect(state.orchestration.phase.status).toBe('not_started');
    });

    it('should initialize step at design/index 0', () => {
      const state = createInitialState('test', tempDir);

      expect(state.orchestration.step.current).toBe('design');
      expect(state.orchestration.step.index).toBe(0);
      expect(state.orchestration.step.status).toBe('not_started');
    });
  });

  describe('getStateValue', () => {
    it('should get nested values using dot notation', () => {
      const state = createInitialState('test', tempDir);
      state.orchestration.phase.number = '0010';
      state.orchestration.phase.name = 'test-feature';

      expect(getStateValue(state, 'orchestration.phase.number')).toBe('0010');
      expect(getStateValue(state, 'orchestration.phase.name')).toBe('test-feature');
      expect(getStateValue(state, 'project.name')).toBe('test');
    });

    it('should return undefined for missing paths', () => {
      const state = createInitialState('test', tempDir);

      expect(getStateValue(state, 'nonexistent.path')).toBeUndefined();
      expect(getStateValue(state, 'orchestration.invalid.key')).toBeUndefined();
    });

    it('should handle top-level keys', () => {
      const state = createInitialState('test', tempDir);

      expect(getStateValue(state, 'schema_version')).toBe('3.0');
    });
  });

  describe('setStateValue', () => {
    it('should set nested values using dot notation', () => {
      const state = createInitialState('test', tempDir);

      const updated = setStateValue(state, 'orchestration.phase.number', '0020');
      expect(updated.orchestration.phase.number).toBe('0020');

      // Original should be unchanged (immutable)
      expect(state.orchestration.phase.number).toBeNull();
    });

    it('should create intermediate objects if missing', () => {
      const state = createInitialState('test', tempDir);

      const updated = setStateValue(state, 'orchestration.implement.task_id', 'T001');
      expect((updated.orchestration.implement as any)?.task_id).toBe('T001');
    });

    it('should handle setting status values', () => {
      const state = createInitialState('test', tempDir);

      const updated = setStateValue(state, 'orchestration.step.status', 'in_progress');
      expect(updated.orchestration.step.status).toBe('in_progress');
    });

    it('should handle numeric keys in path (e.g., phase numbers)', () => {
      const state = createInitialState('test', tempDir);

      // Numeric keys are used for phase numbers in archive_reviews
      const updated = setStateValue(state, 'memory.archive_reviews.0082.reviewed_at', '2026-01-18');
      expect((updated as any).memory.archive_reviews['0082'].reviewed_at).toBe('2026-01-18');
    });
  });

  describe('parseValue', () => {
    it('should parse JSON values', () => {
      expect(parseValue('true')).toBe(true);
      expect(parseValue('false')).toBe(false);
      expect(parseValue('123')).toBe(123);
      expect(parseValue('null')).toBe(null);
      expect(parseValue('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('should return strings for non-JSON values', () => {
      expect(parseValue('hello')).toBe('hello');
      expect(parseValue('in_progress')).toBe('in_progress');
      expect(parseValue('0010-feature')).toBe('0010-feature');
    });
  });

  describe('state file I/O', () => {
    it('should write and read state correctly', async () => {
      const state = createInitialState('test-project', tempDir);
      state.orchestration.phase.number = '0010';
      state.orchestration.phase.name = 'test-feature';

      // Write to temp directory
      await writeState(state, tempDir);

      // Read back
      const readBack = await readState(tempDir);

      expect(readBack.project.name).toBe('test-project');
      expect(readBack.orchestration.phase.number).toBe('0010');
      expect(readBack.orchestration.phase.name).toBe('test-feature');
    });

    it('should update last_updated on write', async () => {
      const state = createInitialState('test', tempDir);
      const originalTimestamp = state.last_updated;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await writeState(state, tempDir);
      const readBack = await readState(tempDir);

      expect(readBack.last_updated).not.toBe(originalTimestamp);
    });

    it('should format JSON with 2-space indentation', async () => {
      const state = createInitialState('test', tempDir);
      await writeState(state, tempDir);

      const content = fs.readFileSync(statePath, 'utf-8');

      // Should have newlines and 2-space indentation
      expect(content).toContain('\n');
      expect(content).toMatch(/^\s{2}"/m);
    });
  });

  describe('health structure', () => {
    it('should have correct health defaults', () => {
      const state = createInitialState('test', tempDir);

      expect(state.health.status).toBe('initializing');
      expect(state.health.issues).toEqual([]);
      expect(state.health.last_check).toBeDefined();
    });
  });

  describe('timestamp format', () => {
    it('should use ISO 8601 timestamp format', () => {
      const state = createInitialState('test', tempDir);

      // ISO format: 2024-01-15T10:30:00.000Z
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(state.last_updated).toMatch(isoRegex);
      expect(state.health.last_check).toMatch(isoRegex);
    });
  });
});
