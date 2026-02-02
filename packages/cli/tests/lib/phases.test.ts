import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  getPhasesDir: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { getPhasesDir, pathExists } from '../../src/lib/paths.js';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  phaseSlug,
  phaseDisplayName,
  getPhaseDetailPath,
  createPhaseDetailFile,
} from '../../src/lib/phases.js';

describe('phases.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('phaseSlug', () => {
    it('should convert spaces to hyphens', () => {
      expect(phaseSlug('Core Engine')).toBe('core-engine');
    });

    it('should lowercase the input', () => {
      expect(phaseSlug('DATABASE-Schema')).toBe('database-schema');
    });

    it('should remove special characters', () => {
      expect(phaseSlug('API (v2) Design!')).toBe('api-v2-design');
    });

    it('should collapse multiple hyphens', () => {
      expect(phaseSlug('core--engine')).toBe('core-engine');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(phaseSlug('-core-engine-')).toBe('core-engine');
    });

    it('should pass through already-kebab-case strings', () => {
      expect(phaseSlug('core-engine')).toBe('core-engine');
    });

    it('should handle multiple spaces', () => {
      expect(phaseSlug('Phase   Command   Implementation')).toBe(
        'phase-command-implementation',
      );
    });

    it('should handle empty string', () => {
      expect(phaseSlug('')).toBe('');
    });
  });

  describe('phaseDisplayName', () => {
    it('should convert kebab-case to title case', () => {
      expect(phaseDisplayName('core-engine')).toBe('Core Engine');
    });

    it('should handle single word', () => {
      expect(phaseDisplayName('migration')).toBe('Migration');
    });

    it('should handle multi-word slugs', () => {
      expect(phaseDisplayName('phase-command-implementation')).toBe(
        'Phase Command Implementation',
      );
    });
  });

  describe('getPhaseDetailPath', () => {
    it('should return correct path', () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');

      const result = getPhaseDetailPath('0080', 'CLI Migration', '/project');

      expect(result).toBe('/project/.specify/phases/0080-cli-migration.md');
    });

    it('should handle kebab-case names', () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');

      const result = getPhaseDetailPath('0010', 'core-engine', '/project');

      expect(result).toBe('/project/.specify/phases/0010-core-engine.md');
    });
  });

  describe('createPhaseDetailFile', () => {
    it('should create file with YAML frontmatter', async () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const result = await createPhaseDetailFile({
        phaseNumber: '0010',
        phaseName: 'core-engine',
        projectPath: '/project',
      });

      expect(result).toBe('/project/.specify/phases/0010-core-engine.md');
      expect(writeFile).toHaveBeenCalledOnce();

      const content = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(content).toContain('phase: 0010');
      expect(content).toContain('name: core-engine');
      expect(content).toContain('status: not_started');
      expect(content).toContain('# Phase 0010: Core Engine');
      expect(content).toContain('[Define success criteria]');
    });

    it('should populate verification gate from options', async () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      await createPhaseDetailFile({
        phaseNumber: '0020',
        phaseName: 'api-poc',
        projectPath: '/project',
        verificationGate: 'API returns valid data',
      });

      const content = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(content).toContain('**Verification Gate**: API returns valid data');
    });

    it('should not overwrite existing files', async () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');
      // First call: file exists check (returns true), second would be dir check
      vi.mocked(pathExists).mockReturnValue(true);

      const result = await createPhaseDetailFile({
        phaseNumber: '0010',
        phaseName: 'core-engine',
        projectPath: '/project',
      });

      expect(result).toBeNull();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should create phases directory if missing', async () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');
      // First call (file exists): false, second call (dir exists): false
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      await createPhaseDetailFile({
        phaseNumber: '0010',
        phaseName: 'core-engine',
        projectPath: '/project',
      });

      expect(mkdir).toHaveBeenCalledWith('/project/.specify/phases', { recursive: true });
    });

    it('should use provided status', async () => {
      vi.mocked(getPhasesDir).mockReturnValue('/project/.specify/phases');
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      await createPhaseDetailFile({
        phaseNumber: '0010',
        phaseName: 'core-engine',
        projectPath: '/project',
        status: 'in_progress',
      });

      const content = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(content).toContain('status: in_progress');
    });
  });
});
