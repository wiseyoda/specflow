import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * Tests for JSON output of state commands
 * These verify that --json flag produces valid, parseable JSON output
 */

describe('state command JSON output', () => {
  let tempDir: string;
  let cliPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-json-test-'));
    cliPath = path.resolve(__dirname, '../../../../bin/specflow');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function runCli(args: string, cwd: string = tempDir): { stdout: string; exitCode: number } {
    try {
      const stdout = execSync(`${cliPath} ${args}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; status?: number };
      return {
        stdout: error.stdout ?? '',
        exitCode: error.status ?? 1,
      };
    }
  }

  describe('state init --json', () => {
    it('should output valid JSON on success', () => {
      const { stdout, exitCode } = runCli('state init --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('success');
      expect(result.command).toBe('state init');
      expect(result.project).toBeDefined();
      expect(result.project.id).toMatch(/^[0-9a-f-]+$/);
      expect(result.project.name).toBe(path.basename(tempDir));
      expect(result.statePath).toContain('.specflow/orchestration-state.json');
      expect(result.registered).toBe(true);
      expect(result.overwritten).toBe(false);
    });

    it('should output error JSON when state already exists', () => {
      // First init
      runCli('state init');

      // Second init without --force
      const { stdout, exitCode } = runCli('state init --json');

      expect(exitCode).toBe(1);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('error');
      expect(result.command).toBe('state init');
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('State file already exists');
      expect(result.error.hint).toBe('Use --force to overwrite');
    });

    it('should output success JSON with overwritten=true when --force used', () => {
      // First init
      runCli('state init');

      // Second init with --force
      const { stdout, exitCode } = runCli('state init --force --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('success');
      expect(result.overwritten).toBe(true);
    });
  });

  describe('state set --json', () => {
    beforeEach(() => {
      runCli('state init');
    });

    it('should output valid JSON on success', () => {
      const { stdout, exitCode } = runCli('state set foo=bar --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('success');
      expect(result.command).toBe('state set');
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].key).toBe('foo');
      expect(result.updates[0].value).toBe('bar');
    });

    it('should output error JSON for invalid key format', () => {
      const { stdout, exitCode } = runCli('state set invalid --json');

      expect(exitCode).toBe(1);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('error');
      expect(result.command).toBe('state set');
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Invalid format');
    });

    it('should handle multiple key=value pairs', () => {
      const { stdout, exitCode } = runCli('state set a=1 b=2 c=3 --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.status).toBe('success');
      expect(result.updates).toHaveLength(3);
      expect(result.updates.map((u: { key: string }) => u.key)).toEqual(['a', 'b', 'c']);
    });

    it('should include previousValue in updates', () => {
      // Set initial value
      runCli('state set counter=1');

      // Update value
      const { stdout } = runCli('state set counter=2 --json');

      const result = JSON.parse(stdout);
      expect(result.updates[0].previousValue).toBe(1);
      expect(result.updates[0].value).toBe(2);
    });
  });

  describe('state sync --json', () => {
    beforeEach(() => {
      runCli('state init');
    });

    it('should output valid JSON on success', () => {
      const { stdout, exitCode } = runCli('state sync --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.status).toMatch(/^(success|warning)$/);
      expect(result.command).toBe('state sync');
      expect(result.dryRun).toBe(false);
      expect(Array.isArray(result.changes)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should output JSON with dryRun=true for --dry-run', () => {
      const { stdout, exitCode } = runCli('state sync --dry-run --json');

      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.dryRun).toBe(true);
    });

    it('should include warning when ROADMAP.md is missing', () => {
      const { stdout } = runCli('state sync --json');

      const result = JSON.parse(stdout);
      expect(result.warnings).toContain('ROADMAP.md not found');
      expect(result.status).toBe('warning');
    });
  });

  describe('backward compatibility', () => {
    beforeEach(() => {
      runCli('state init');
    });

    it('should output text (not JSON) when --json is not used for state set', () => {
      const { stdout } = runCli('state set foo=bar');

      // Should not be valid JSON
      expect(() => JSON.parse(stdout)).toThrow();
      expect(stdout).toContain('Set foo =');
    });

    it('should output text (not JSON) when --json is not used for state sync', () => {
      const { stdout } = runCli('state sync');

      // Should not be valid JSON
      expect(() => JSON.parse(stdout)).toThrow();
      expect(stdout).toMatch(/(State is in sync|ROADMAP\.md not found)/);
    });
  });
});
