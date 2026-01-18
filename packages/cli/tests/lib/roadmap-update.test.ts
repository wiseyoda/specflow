import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(),
  pathExists: vi.fn(),
  getRoadmapPath: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { findProjectRoot, pathExists, getRoadmapPath } from '../../src/lib/paths.js';
import { readFile, writeFile } from 'node:fs/promises';
import { updatePhaseStatus } from '../../src/lib/roadmap.js';

describe('updatePhaseStatus', () => {
  const sampleRoadmapContent = `# ROADMAP

**Project**: Test Project
**Schema Version**: 2.1

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0080 | CLI Migration | In Progress | Tests pass |
| 0081 | Next Phase | Not Started | Feature works |
| 0082 | Future Phase | Not Started | All done |
`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when not in a project', async () => {
    vi.mocked(findProjectRoot).mockReturnValue(null);

    await expect(updatePhaseStatus('0080', 'complete')).rejects.toThrow('SpecFlow project');
  });

  it('should throw when ROADMAP.md does not exist', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(false);

    await expect(updatePhaseStatus('0080', 'complete')).rejects.toThrow('ROADMAP.md');
  });

  it('should update phase status from in_progress to complete', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await updatePhaseStatus('0080', 'complete', '/project');

    expect(result.updated).toBe(true);
    expect(result.filePath).toBe('/project/ROADMAP.md');
    expect(writeFile).toHaveBeenCalled();

    // Verify the written content has the updated status
    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('| 0080 | CLI Migration | Complete | Tests pass |');
  });

  it('should return updated=false when phase not found', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);

    const result = await updatePhaseStatus('9999', 'complete', '/project');

    expect(result.updated).toBe(false);
    expect(result.filePath).toBe('/project/ROADMAP.md');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should use provided projectPath instead of findProjectRoot', async () => {
    vi.mocked(getRoadmapPath).mockReturnValue('/custom/path/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await updatePhaseStatus('0080', 'complete', '/custom/path');

    expect(findProjectRoot).not.toHaveBeenCalled();
    expect(getRoadmapPath).toHaveBeenCalledWith('/custom/path');
    expect(result.filePath).toBe('/custom/path/ROADMAP.md');
  });

  it('should update to in_progress status', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await updatePhaseStatus('0081', 'in_progress', '/project');

    expect(result.updated).toBe(true);

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('| 0081 | Next Phase | In Progress | Feature works |');
  });

  it('should update to blocked status', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await updatePhaseStatus('0080', 'blocked', '/project');

    expect(result.updated).toBe(true);

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('| 0080 | CLI Migration | Blocked | Tests pass |');
  });

  it('should update to awaiting_user status', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await updatePhaseStatus('0080', 'awaiting_user', '/project');

    expect(result.updated).toBe(true);

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('| 0080 | CLI Migration | Awaiting User | Tests pass |');
  });

  it('should preserve other phases when updating one', async () => {
    vi.mocked(findProjectRoot).mockReturnValue('/project');
    vi.mocked(getRoadmapPath).mockReturnValue('/project/ROADMAP.md');
    vi.mocked(pathExists).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(sampleRoadmapContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await updatePhaseStatus('0080', 'complete', '/project');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Phase 0080 should be updated
    expect(writtenContent).toContain('| 0080 | CLI Migration | Complete | Tests pass |');
    // Other phases should remain unchanged
    expect(writtenContent).toContain('| 0081 | Next Phase | Not Started | Feature works |');
    expect(writtenContent).toContain('| 0082 | Future Phase | Not Started | All done |');
  });
});
