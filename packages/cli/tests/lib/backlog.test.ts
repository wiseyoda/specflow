import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  pathExists: vi.fn(),
  getSpecsDir: vi.fn(),
  getTemplatesDir: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { pathExists, getSpecsDir } from '../../src/lib/paths.js';
import { readFile, writeFile } from 'node:fs/promises';
import {
  getBacklogPath,
  getDeferredPath,
  parseDeferredFile,
  scanDeferredItems,
} from '../../src/lib/backlog.js';

describe('backlog.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBacklogPath', () => {
    it('should return correct backlog path', () => {
      const result = getBacklogPath('/project');

      expect(result).toBe('/project/BACKLOG.md');
    });
  });

  describe('getDeferredPath', () => {
    it('should return correct deferred file path', () => {
      vi.mocked(getSpecsDir).mockReturnValue('/project/specs');

      const result = getDeferredPath('0080', 'CLI Migration', '/project');

      expect(result).toBe('/project/specs/0080-cli-migration/checklists/deferred.md');
    });
  });

  describe('parseDeferredFile', () => {
    it('should return empty array when file does not exist', async () => {
      vi.mocked(pathExists).mockReturnValue(false);

      const result = await parseDeferredFile('/nonexistent/deferred.md');

      expect(result).toEqual([]);
    });

    it('should parse deferred items from table', async () => {
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Deferred Items

| Item | Source | Reason | Target Phase |
|------|--------|--------|--------------|
| Add caching | spec.md:45 | Out of scope | Phase 0082 |
| Dark mode | tasks.md:12 | Time constraint | Backlog |
`);

      const result = await parseDeferredFile('/project/deferred.md');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        description: 'Add caching',
        source: 'spec.md:45',
        reason: 'Out of scope',
        targetPhase: 'Phase 0082',
      });
      expect(result[1]).toEqual({
        description: 'Dark mode',
        source: 'tasks.md:12',
        reason: 'Time constraint',
        targetPhase: 'Backlog',
      });
    });

    it('should skip template placeholder rows', async () => {
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Deferred Items

| Item | Source | Reason | Target Phase |
|------|--------|--------|--------------|
| [ITEM_1] | [SOURCE] | [REASON] | Phase [NNNN] |
| Real item | real.md:1 | Real reason | Phase 0082 |
`);

      const result = await parseDeferredFile('/project/deferred.md');

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Real item');
    });

    it('should handle table with minimal columns', async () => {
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Deferred Items

| Item | Source |
|------|--------|
| Simple item | source.md |
`);

      const result = await parseDeferredFile('/project/deferred.md');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: 'Simple item',
        source: 'source.md',
        reason: undefined,
        targetPhase: undefined,
      });
    });
  });

  describe('scanDeferredItems', () => {
    it('should return empty summary when no deferred file exists', async () => {
      vi.mocked(getSpecsDir).mockReturnValue('/project/specs');
      vi.mocked(pathExists).mockReturnValue(false);

      const result = await scanDeferredItems('0080', 'CLI Migration', '/project');

      expect(result).toEqual({
        count: 0,
        withTarget: 0,
        toBacklog: 0,
        items: [],
      });
    });

    it('should categorize deferred items correctly', async () => {
      vi.mocked(getSpecsDir).mockReturnValue('/project/specs');
      vi.mocked(pathExists).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(`# Deferred Items

| Item | Source | Reason | Target Phase |
|------|--------|--------|--------------|
| Targeted item | spec.md:1 | Scope | Phase 0082 |
| Another targeted | spec.md:2 | Time | Phase 0090 |
| Backlog item | spec.md:3 | Later | Backlog |
| No target item | spec.md:4 | Unknown | |
`);

      const result = await scanDeferredItems('0080', 'CLI Migration', '/project');

      expect(result.count).toBe(4);
      expect(result.withTarget).toBe(2); // Phase 0082 and Phase 0090
      expect(result.toBacklog).toBe(2); // Backlog and empty target
    });
  });
});
