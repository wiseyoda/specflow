import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRoadmapContent,
  getPhaseByNumber,
  getPhasesByStatus,
  hasPendingUserGates,
  calculateNextHotfix,
} from '../../src/lib/roadmap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures');

describe('roadmap.ts', () => {

  describe('parseRoadmapContent - sample-roadmap.md', () => {
    it('should parse roadmap from markdown content', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      expect(result.projectName).toBe('Sample Test Project');
      expect(result.schemaVersion).toBe('2.1 (ABBC numbering)');
      // 8 phases total including hotfix
      expect(result.phases).toHaveLength(8);
    });

    it('should parse phase status correctly with emojis', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      // 0010 has ✅ Complete
      expect(result.phases[0].status).toBe('complete');
      // 0020 has 🔄 In Progress
      expect(result.phases[1].status).toBe('in_progress');
      // 0030 has ⬜ Not Started
      expect(result.phases[3].status).toBe('not_started');
    });

    it('should detect USER GATE phases', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      const userGatePhases = result.phases.filter(p => p.hasUserGate);
      // 0030, 1010, 1020 have USER GATE markers
      expect(userGatePhases.length).toBeGreaterThanOrEqual(3);
      expect(userGatePhases.some(p => p.number === '0030')).toBe(true);
    });

    it('should identify active and next phases', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      expect(result.activePhase?.number).toBe('0020');
      expect(result.nextPhase?.number).toBe('0030');
    });

    it('should calculate progress', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      expect(result.progress.total).toBe(8);
      // 0010 and 0021 are complete
      expect(result.progress.completed).toBe(2);
      expect(result.progress.percentage).toBe(25); // 2/8
    });

    it('should extract phase numbers including hotfix phases', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      const phaseNumbers = result.phases.map(p => p.number);
      expect(phaseNumbers).toContain('0010');
      expect(phaseNumbers).toContain('0021'); // Hotfix phase
      expect(phaseNumbers).toContain('1010'); // Milestone 1
    });

    it('should extract verification gates', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      expect(result.phases[0].verificationGate).toBe('All tests pass');
      expect(result.phases[1].verificationGate).toBe('Feature works end-to-end');
    });
  });

  describe('parseRoadmapContent - roadmap-minimal.md', () => {
    it('should parse minimal roadmap', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'roadmap-minimal.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      expect(result.phases).toHaveLength(3);
      expect(result.phases[0].number).toBe('0010');
      expect(result.phases[0].status).toBe('complete');
    });

    it('should handle missing optional fields', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'roadmap-minimal.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      // No project name or schema version in minimal
      expect(result.projectName).toBeUndefined();
      expect(result.schemaVersion).toBeUndefined();
    });
  });

  describe('parseRoadmapContent - roadmap-edge-cases.md', () => {
    it('should parse alternative status formats (DONE, COMPLETE, IN_PROGRESS)', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'roadmap-edge-cases.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      // Find phases from "Alternative Status Formats" table (2010-2050 series)
      const alphaPhase = result.phases.find(p => p.number === '2010');
      expect(alphaPhase?.name).toBe('Alpha Phase');
      expect(alphaPhase?.status).toBe('complete'); // COMPLETE maps to complete

      const gammaPhase = result.phases.find(p => p.number === '2030');
      expect(gammaPhase?.name).toBe('Gamma Phase');
      expect(gammaPhase?.status).toBe('not_started'); // PENDING maps to not_started

      const deltaPhase = result.phases.find(p => p.number === '2040');
      expect(deltaPhase?.name).toBe('Delta Phase');
      expect(deltaPhase?.status).toBe('blocked'); // BLOCKED maps to blocked
    });

    it('should handle special characters in phase names', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'roadmap-edge-cases.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      // Find phases with special chars
      const nodePhase = result.phases.find(p => p.name.includes('Node.js'));
      expect(nodePhase).toBeDefined();

      const apiPhase = result.phases.find(p => p.name.includes('REST/GraphQL'));
      expect(apiPhase).toBeDefined();
    });

    it('should handle performance metrics in gates', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'roadmap-edge-cases.md'), 'utf-8');
      const result = parseRoadmapContent(content, 'test/ROADMAP.md');

      const perfPhase = result.phases.find(p => p.verificationGate?.includes('<100ms'));
      expect(perfPhase).toBeDefined();
    });
  });

  describe('getPhaseByNumber', () => {
    it('should find phase by number', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      const phase = getPhaseByNumber(roadmap, '0030');
      expect(phase?.name).toBe('User Authentication');
      expect(phase?.hasUserGate).toBe(true);
    });

    it('should find hotfix phase by number', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      const phase = getPhaseByNumber(roadmap, '0021');
      expect(phase?.name).toBe('Hotfix: Auth Bug');
      expect(phase?.status).toBe('complete');
    });

    it('should return null for unknown phase', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      const phase = getPhaseByNumber(roadmap, '9999');
      expect(phase).toBeNull();
    });
  });

  describe('getPhasesByStatus', () => {
    it('should filter phases by status', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      const notStarted = getPhasesByStatus(roadmap, 'not_started');
      expect(notStarted.length).toBeGreaterThanOrEqual(3);

      const complete = getPhasesByStatus(roadmap, 'complete');
      expect(complete).toHaveLength(2); // 0010 and 0021
    });

    it('should return empty array when no phases match', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      const blocked = getPhasesByStatus(roadmap, 'blocked');
      expect(blocked).toHaveLength(0);
    });
  });

  describe('hasPendingUserGates', () => {
    it('should return false when no user gates in progress', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      // In sample-roadmap.md, the user gate phase (0030) is not_started
      expect(hasPendingUserGates(roadmap)).toBe(false);
    });

    it('should return true when user gate phase is in progress', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0010', name: 'Test', status: 'in_progress' as const, hasUserGate: true, line: 1 },
        ],
        progress: { total: 1, completed: 0, percentage: 0 },
      };

      expect(hasPendingUserGates(roadmap)).toBe(true);
    });

    it('should return true when user gate phase is awaiting_user', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0010', name: 'Test', status: 'awaiting_user' as const, hasUserGate: true, line: 1 },
        ],
        progress: { total: 1, completed: 0, percentage: 0 },
      };

      expect(hasPendingUserGates(roadmap)).toBe(true);
    });

    it('should return false when user gate phase is complete', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0010', name: 'Test', status: 'complete' as const, hasUserGate: true, line: 1 },
        ],
        progress: { total: 1, completed: 1, percentage: 100 },
      };

      expect(hasPendingUserGates(roadmap)).toBe(false);
    });
  });

  describe('calculateNextHotfix', () => {
    it('should return next hotfix number for active phase', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0010', name: 'Phase 1', status: 'complete' as const, hasUserGate: false, line: 1 },
          { number: '0020', name: 'Phase 2', status: 'in_progress' as const, hasUserGate: false, line: 2 },
        ],
        activePhase: { number: '0020', name: 'Phase 2', status: 'in_progress' as const, hasUserGate: false, line: 2 },
        progress: { total: 2, completed: 1, percentage: 50 },
      };

      const result = calculateNextHotfix(roadmap);
      expect(result).toBe('0021');
    });

    it('should skip existing hotfix slots', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0020', name: 'Phase 2', status: 'in_progress' as const, hasUserGate: false, line: 1 },
          { number: '0021', name: 'Hotfix 1', status: 'complete' as const, hasUserGate: false, line: 2 },
          { number: '0022', name: 'Hotfix 2', status: 'complete' as const, hasUserGate: false, line: 3 },
        ],
        activePhase: { number: '0020', name: 'Phase 2', status: 'in_progress' as const, hasUserGate: false, line: 1 },
        progress: { total: 3, completed: 2, percentage: 67 },
      };

      const result = calculateNextHotfix(roadmap);
      expect(result).toBe('0023');
    });

    it('should use last completed phase if no active phase', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0010', name: 'Phase 1', status: 'complete' as const, hasUserGate: false, line: 1 },
          { number: '0020', name: 'Phase 2', status: 'complete' as const, hasUserGate: false, line: 2 },
        ],
        progress: { total: 2, completed: 2, percentage: 100 },
      };

      const result = calculateNextHotfix(roadmap);
      expect(result).toBe('0021');
    });

    it('should return null when no phases exist', () => {
      const roadmap = {
        filePath: 'test',
        phases: [],
        progress: { total: 0, completed: 0, percentage: 0 },
      };

      const result = calculateNextHotfix(roadmap);
      expect(result).toBeNull();
    });

    it('should return null when all hotfix slots are used (0-9)', () => {
      const roadmap = {
        filePath: 'test',
        phases: [
          { number: '0020', name: 'Phase', status: 'in_progress' as const, hasUserGate: false, line: 1 },
          { number: '0021', name: 'Hotfix 1', status: 'complete' as const, hasUserGate: false, line: 2 },
          { number: '0022', name: 'Hotfix 2', status: 'complete' as const, hasUserGate: false, line: 3 },
          { number: '0023', name: 'Hotfix 3', status: 'complete' as const, hasUserGate: false, line: 4 },
          { number: '0024', name: 'Hotfix 4', status: 'complete' as const, hasUserGate: false, line: 5 },
          { number: '0025', name: 'Hotfix 5', status: 'complete' as const, hasUserGate: false, line: 6 },
          { number: '0026', name: 'Hotfix 6', status: 'complete' as const, hasUserGate: false, line: 7 },
          { number: '0027', name: 'Hotfix 7', status: 'complete' as const, hasUserGate: false, line: 8 },
          { number: '0028', name: 'Hotfix 8', status: 'complete' as const, hasUserGate: false, line: 9 },
          { number: '0029', name: 'Hotfix 9', status: 'complete' as const, hasUserGate: false, line: 10 },
        ],
        activePhase: { number: '0020', name: 'Phase', status: 'in_progress' as const, hasUserGate: false, line: 1 },
        progress: { total: 10, completed: 9, percentage: 90 },
      };

      const result = calculateNextHotfix(roadmap);
      expect(result).toBeNull();
    });

    it('should work with sample roadmap fixture', async () => {
      const content = await readFile(join(FIXTURES_DIR, 'sample-roadmap.md'), 'utf-8');
      const roadmap = parseRoadmapContent(content, 'test/ROADMAP.md');

      // Active phase is 0020, and 0021 already exists
      const result = calculateNextHotfix(roadmap);
      expect(result).toBe('0022');
    });
  });
});
