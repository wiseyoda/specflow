import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  getSpecifyDir: vi.fn(),
  pathExists: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

import { getSpecifyDir, pathExists } from '../../src/lib/paths.js';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import {
  getHistoryPath,
  getPhasesDir,
  getPhaseFilePath,
  isPhaseArchived,
} from '../../src/lib/history.js';

describe('history.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHistoryPath', () => {
    it('should return correct history path', () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');

      const result = getHistoryPath('/project');

      expect(result).toBe('/project/.specify/history/HISTORY.md');
    });
  });

  describe('getPhasesDir', () => {
    it('should return correct phases directory path', () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');

      const result = getPhasesDir('/project');

      expect(result).toBe('/project/.specify/phases');
    });
  });

  describe('getPhaseFilePath', () => {
    it('should return correct phase file path', () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');

      const result = getPhaseFilePath('0080', 'CLI Migration', '/project');

      expect(result).toBe('/project/.specify/phases/0080-cli-migration.md');
    });

    it('should handle multi-word phase names', () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');

      const result = getPhaseFilePath('0081', 'Phase Command Implementation', '/project');

      expect(result).toBe('/project/.specify/phases/0081-phase-command-implementation.md');
    });
  });

  describe('isPhaseArchived', () => {
    it('should return false when history file does not exist', async () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');
      vi.mocked(pathExists).mockReturnValue(false);

      const result = await isPhaseArchived('0080', '/project');

      expect(result).toBe(false);
    });

    it('should return true when phase is in history', async () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Completed Phases

---

## 0080 - CLI Migration

**Completed**: 2024-01-18

Phase details here.

---

## 0079 - Previous Phase

**Completed**: 2024-01-17
`);

      const result = await isPhaseArchived('0080', '/project');

      expect(result).toBe(true);
    });

    it('should return false when phase is not in history', async () => {
      vi.mocked(getSpecifyDir).mockReturnValue('/project/.specify');
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Completed Phases

---

## 0079 - Previous Phase

**Completed**: 2024-01-17
`);

      const result = await isPhaseArchived('0080', '/project');

      expect(result).toBe(false);
    });
  });
});
