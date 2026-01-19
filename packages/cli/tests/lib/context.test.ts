import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import {
  getFeatureContext,
  getMissingArtifacts,
  inferStepFromArtifacts,
  type FeatureArtifacts,
} from '../../src/lib/context.js';

// Mock paths module
vi.mock('../../src/lib/paths.js', () => ({
  findProjectRoot: vi.fn(() => '/test/project'),
  getSpecsDir: vi.fn((path) => join(path || '/test/project', 'specs')),
  getSpecifyDir: vi.fn((path) => join(path || '/test/project', '.specify')),
  getMemoryDir: vi.fn((path) => join(path || '/test/project', '.specify/memory')),
  getTemplatesDir: vi.fn((path) => join(path || '/test/project', '.specify/templates')),
  getRoadmapPath: vi.fn((path) => join(path || '/test/project', 'ROADMAP.md')),
  getStatePath: vi.fn((path) => join(path || '/test/project', '.specflow/orchestration-state.json')),
  pathExists: vi.fn(() => false),
}));

describe('context.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMissingArtifacts', () => {
    it('should return all artifacts when none exist', () => {
      const artifacts: FeatureArtifacts = {
        discovery: false,
        spec: false,
        requirements: false,
        plan: false,
        tasks: false,
        checklists: {
          implementation: false,
          verification: false,
          deferred: false,
        },
      };

      const missing = getMissingArtifacts(artifacts);
      expect(missing).toContain('discovery.md');
      expect(missing).toContain('spec.md');
      expect(missing).toContain('plan.md');
      expect(missing).toContain('tasks.md');
      expect(missing).toContain('checklists/implementation.md');
      expect(missing).toContain('checklists/verification.md');
      // deferred is optional, not in missing list
    });

    it('should return empty array when all required exist', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: true,
        plan: true,
        tasks: true,
        checklists: {
          implementation: true,
          verification: true,
          deferred: false, // optional
        },
      };

      const missing = getMissingArtifacts(artifacts);
      expect(missing).toHaveLength(0);
    });

    it('should only return missing required artifacts', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: false,
        plan: false,
        tasks: true,
        checklists: {
          implementation: true,
          verification: false,
          deferred: false,
        },
      };

      const missing = getMissingArtifacts(artifacts);
      expect(missing).toEqual(['plan.md', 'checklists/verification.md']);
    });
  });

  describe('inferStepFromArtifacts', () => {
    it('should return design when spec missing', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: false,
        requirements: false,
        plan: false,
        tasks: false,
        checklists: { implementation: false, verification: false, deferred: false },
      };

      expect(inferStepFromArtifacts(artifacts)).toBe('design');
    });

    it('should return design when plan missing', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: true,
        plan: false,
        tasks: false,
        checklists: { implementation: false, verification: false, deferred: false },
      };

      expect(inferStepFromArtifacts(artifacts)).toBe('design');
    });

    it('should return design when tasks missing', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: true,
        plan: true,
        tasks: false,
        checklists: { implementation: false, verification: false, deferred: false },
      };

      expect(inferStepFromArtifacts(artifacts)).toBe('design');
    });

    it('should return design when checklists missing', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: true,
        plan: true,
        tasks: true,
        checklists: { implementation: false, verification: false, deferred: false },
      };

      expect(inferStepFromArtifacts(artifacts)).toBe('design');
    });

    it('should return analyze when all design artifacts exist', () => {
      const artifacts: FeatureArtifacts = {
        discovery: true,
        spec: true,
        requirements: true,
        plan: true,
        tasks: true,
        checklists: { implementation: true, verification: true, deferred: false },
      };

      expect(inferStepFromArtifacts(artifacts)).toBe('analyze');
    });
  });
});
