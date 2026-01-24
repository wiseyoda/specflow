import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// Store original process.cwd
const originalCwd = process.cwd;

describe('project init command', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `specflow-init-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    // Change to test directory
    process.cwd = () => testDir;
  });

  afterEach(async () => {
    // Restore original cwd
    process.cwd = originalCwd;
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('runProjectInit', () => {
    it('should create all required directories and files', async () => {
      // Dynamically import to get mocked cwd
      const { runProjectInit } = await import('../../../src/commands/project/init.js');
      const { pathExists } = await import('../../../src/lib/paths.js');

      await runProjectInit({ name: 'test-project' });

      // Verify .specflow/ structure
      expect(pathExists(join(testDir, '.specflow'))).toBe(true);
      expect(pathExists(join(testDir, '.specflow', 'orchestration-state.json'))).toBe(true);
      expect(pathExists(join(testDir, '.specflow', 'manifest.json'))).toBe(true);
      expect(pathExists(join(testDir, '.specflow', 'workflows'))).toBe(true);

      // Verify .specify/ structure
      expect(pathExists(join(testDir, '.specify'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'memory'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'templates'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'phases'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'archive'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'history'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'discovery'))).toBe(true);

      // Verify core files
      expect(pathExists(join(testDir, '.specify', 'history', 'HISTORY.md'))).toBe(true);
      expect(pathExists(join(testDir, '.specify', 'memory', 'constitution.md'))).toBe(true);
      expect(pathExists(join(testDir, 'ROADMAP.md'))).toBe(true);
      expect(pathExists(join(testDir, 'BACKLOG.md'))).toBe(true);
      expect(pathExists(join(testDir, 'specs'))).toBe(true);
    });

    it('should create valid state file', async () => {
      const { runProjectInit } = await import('../../../src/commands/project/init.js');
      const { readFile } = await import('node:fs/promises');

      await runProjectInit({ name: 'my-project' });

      const stateContent = await readFile(join(testDir, '.specflow', 'orchestration-state.json'), 'utf-8');
      const state = JSON.parse(stateContent);

      expect(state.schema_version).toBe('3.0');
      expect(state.project.name).toBe('my-project');
      expect(state.project.path).toBe(testDir);
      expect(state.orchestration.phase.status).toBe('not_started');
      expect(state.orchestration.step.current).toBe('design');
      expect(state.orchestration.step.index).toBe(0);
    });

    it('should fail if already initialized without --force', async () => {
      const { runProjectInit } = await import('../../../src/commands/project/init.js');

      // First init should succeed
      await runProjectInit({ name: 'test-project' });

      // Second init should fail (check exit code was set)
      const originalExitCode = process.exitCode;
      await runProjectInit({ name: 'test-project' });
      expect(process.exitCode).toBe(1);

      // Reset
      process.exitCode = originalExitCode;
    });

    it('should succeed with --force on existing project', async () => {
      const { runProjectInit } = await import('../../../src/commands/project/init.js');
      const { pathExists } = await import('../../../src/lib/paths.js');

      // First init
      await runProjectInit({ name: 'test-project' });

      // Clear exit code
      process.exitCode = undefined;

      // Second init with force should succeed
      await runProjectInit({ name: 'updated-project', force: true });

      // Verify still valid
      expect(pathExists(join(testDir, '.specflow', 'orchestration-state.json'))).toBe(true);
    });

    it('should use directory name as project name when not specified', async () => {
      const { runProjectInit } = await import('../../../src/commands/project/init.js');
      const { readFile } = await import('node:fs/promises');
      const { basename } = await import('node:path');

      await runProjectInit({});

      const stateContent = await readFile(join(testDir, '.specflow', 'orchestration-state.json'), 'utf-8');
      const state = JSON.parse(stateContent);

      // Should use the test directory name
      expect(state.project.name).toBe(basename(testDir));
    });
  });
});
