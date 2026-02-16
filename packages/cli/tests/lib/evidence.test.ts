import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  pathExists: vi.fn(),
}));

vi.mock('../../src/lib/fs-utils.js', () => ({
  atomicWriteFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { pathExists } from '../../src/lib/paths.js';
import { atomicWriteFile } from '../../src/lib/fs-utils.js';
import { readFile, mkdir } from 'node:fs/promises';
import {
  readEvidence,
  writeEvidence,
  recordEvidence,
  removeEvidence,
  hasEvidence,
  type EvidenceFile,
} from '../../src/lib/evidence.js';

describe('evidence', () => {
  const featureDir = '/test/specs/0010-test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readEvidence', () => {
    it('should return null when no file exists', async () => {
      vi.mocked(pathExists).mockReturnValue(false);

      const result = await readEvidence(featureDir);
      expect(result).toBeNull();
    });

    it('should parse valid evidence file', async () => {
      const evidenceData: EvidenceFile = {
        version: '1.0',
        featureDir,
        items: {
          'V-001': {
            itemId: 'V-001',
            timestamp: '2026-01-01T00:00:00.000Z',
            evidence: 'pnpm test passed',
          },
        },
      };

      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(evidenceData));

      const result = await readEvidence(featureDir);
      expect(result).toEqual(evidenceData);
    });

    it('should throw on malformed JSON', async () => {
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('not json');

      await expect(readEvidence(featureDir)).rejects.toThrow();
    });

    it('should throw on invalid schema', async () => {
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '2.0', bad: true }));

      await expect(readEvidence(featureDir)).rejects.toThrow();
    });
  });

  describe('writeEvidence', () => {
    it('should write evidence file atomically', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);

      const evidence: EvidenceFile = {
        version: '1.0',
        featureDir,
        items: {},
      };

      await writeEvidence(featureDir, evidence);

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('0010-test'),
        { recursive: true },
      );
      expect(atomicWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.evidence.json'),
        expect.stringContaining('"version": "1.0"'),
      );
    });
  });

  describe('recordEvidence', () => {
    it('should create new evidence file for single item', async () => {
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);

      const result = await recordEvidence(featureDir, ['V-001'], 'tests passed');

      expect(result.version).toBe('1.0');
      expect(result.items['V-001']).toBeDefined();
      expect(result.items['V-001'].evidence).toBe('tests passed');
      expect(result.items['V-001'].sharedWith).toBeUndefined();
    });

    it('should record batch shared evidence', async () => {
      vi.mocked(pathExists).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);

      const result = await recordEvidence(
        featureDir,
        ['V-030', 'V-031', 'V-032'],
        'pnpm test: 47 passed, 0 failed',
      );

      expect(result.items['V-030'].sharedWith).toEqual(['V-031', 'V-032']);
      expect(result.items['V-031'].sharedWith).toEqual(['V-030', 'V-032']);
      expect(result.items['V-032'].sharedWith).toEqual(['V-030', 'V-031']);
      expect(result.items['V-030'].evidence).toBe('pnpm test: 47 passed, 0 failed');
    });

    it('should append to existing evidence', async () => {
      const existing: EvidenceFile = {
        version: '1.0',
        featureDir,
        items: {
          'V-001': {
            itemId: 'V-001',
            timestamp: '2026-01-01T00:00:00.000Z',
            evidence: 'old evidence',
          },
        },
      };

      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);

      const result = await recordEvidence(featureDir, ['V-002'], 'new evidence');

      expect(result.items['V-001'].evidence).toBe('old evidence');
      expect(result.items['V-002'].evidence).toBe('new evidence');
    });
  });

  describe('removeEvidence', () => {
    it('should do nothing when no evidence file exists', async () => {
      vi.mocked(pathExists).mockReturnValue(false);

      await removeEvidence(featureDir, ['V-001']);
      expect(atomicWriteFile).not.toHaveBeenCalled();
    });

    it('should remove evidence for specified items', async () => {
      const existing: EvidenceFile = {
        version: '1.0',
        featureDir,
        items: {
          'V-001': {
            itemId: 'V-001',
            timestamp: '2026-01-01T00:00:00.000Z',
            evidence: 'test evidence',
          },
          'V-002': {
            itemId: 'V-002',
            timestamp: '2026-01-01T00:00:00.000Z',
            evidence: 'other evidence',
          },
        },
      };

      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(atomicWriteFile).mockResolvedValue(undefined);

      await removeEvidence(featureDir, ['V-001']);

      const written = vi.mocked(atomicWriteFile).mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed.items['V-001']).toBeUndefined();
      expect(parsed.items['V-002']).toBeDefined();
    });
  });

  describe('hasEvidence', () => {
    it('should return all missing when evidence is null', () => {
      const result = hasEvidence(null, ['V-001', 'V-002']);

      expect(result.complete).toBe(false);
      expect(result.missing).toEqual(['V-001', 'V-002']);
    });

    it('should return complete when all items have evidence', () => {
      const evidence: EvidenceFile = {
        version: '1.0',
        featureDir: '/test',
        items: {
          'V-001': { itemId: 'V-001', timestamp: '', evidence: 'tested' },
          'V-002': { itemId: 'V-002', timestamp: '', evidence: 'tested' },
        },
      };

      const result = hasEvidence(evidence, ['V-001', 'V-002']);

      expect(result.complete).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should identify missing items', () => {
      const evidence: EvidenceFile = {
        version: '1.0',
        featureDir: '/test',
        items: {
          'V-001': { itemId: 'V-001', timestamp: '', evidence: 'tested' },
        },
      };

      const result = hasEvidence(evidence, ['V-001', 'V-002', 'V-003']);

      expect(result.complete).toBe(false);
      expect(result.missing).toEqual(['V-002', 'V-003']);
    });

    it('should return complete for empty item list', () => {
      const evidence: EvidenceFile = {
        version: '1.0',
        featureDir: '/test',
        items: {},
      };

      const result = hasEvidence(evidence, []);

      expect(result.complete).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
