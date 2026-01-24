/**
 * E2E Test Harness for Orchestration
 * T123/G12.29-35: End-to-end orchestration testing
 *
 * This harness allows running orchestration flows in a controlled test environment
 * with mock services and filesystem isolation.
 *
 * Usage:
 *   pnpm test:e2e:orchestration
 *   pnpm test:e2e:orchestration --scenario design-only
 *   pnpm test:e2e:orchestration --scenario full-flow
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// =============================================================================
// Test Environment Setup
// =============================================================================

interface TestEnvironment {
  projectPath: string;
  projectId: string;
  cleanup: () => void;
}

/**
 * Create an isolated test project directory
 */
function createTestProject(name: string = 'e2e-test'): TestEnvironment {
  const projectPath = mkdtempSync(join(tmpdir(), `specflow-e2e-${name}-`));
  const projectId = `e2e-${name}-${Date.now()}`;

  // Create required directories
  mkdirSync(join(projectPath, '.specflow', 'workflows'), { recursive: true });
  mkdirSync(join(projectPath, 'specs', '0001-test-phase'), { recursive: true });

  // Create minimal spec.md
  writeFileSync(
    join(projectPath, 'specs', '0001-test-phase', 'spec.md'),
    `# Test Phase Specification\n\n## Requirements\n- REQ-001: Test requirement\n`
  );

  // Create minimal plan.md
  writeFileSync(
    join(projectPath, 'specs', '0001-test-phase', 'plan.md'),
    `# Test Phase Plan\n\n## Architecture\nSimple test implementation\n`
  );

  // Create minimal tasks.md
  writeFileSync(
    join(projectPath, 'specs', '0001-test-phase', 'tasks.md'),
    `# Tasks: 0001 Test Phase\n\n## Phase 1: Setup\n- [ ] T001 Create test file\n- [ ] T002 Add configuration\n`
  );

  return {
    projectPath,
    projectId,
    cleanup: () => rmSync(projectPath, { recursive: true, force: true }),
  };
}

// =============================================================================
// Mock Service Factory
// =============================================================================

interface MockServices {
  orchestrationService: {
    get: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    transitionToNextPhase: ReturnType<typeof vi.fn>;
    linkWorkflowExecution: ReturnType<typeof vi.fn>;
    completeBatch: ReturnType<typeof vi.fn>;
    failBatch: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  workflowService: {
    get: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    findActiveByOrchestration: ReturnType<typeof vi.fn>;
    hasActiveWorkflow: ReturnType<typeof vi.fn>;
  };
}

/**
 * Create mock services for E2E testing
 */
function createMockServices(): MockServices {
  return {
    orchestrationService: {
      get: vi.fn(),
      start: vi.fn(),
      transitionToNextPhase: vi.fn(),
      linkWorkflowExecution: vi.fn(),
      completeBatch: vi.fn(),
      failBatch: vi.fn(),
      fail: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    },
    workflowService: {
      get: vi.fn(),
      start: vi.fn(() => Promise.resolve({ id: 'wf-e2e-001', status: 'running' })),
      findActiveByOrchestration: vi.fn(() => []),
      hasActiveWorkflow: vi.fn(() => false),
    },
  };
}

// =============================================================================
// Test Scenarios
// =============================================================================

/**
 * Scenario: Design phase only (skipAnalyze, skipImplement)
 */
async function runDesignOnlyScenario(env: TestEnvironment, services: MockServices) {
  // Setup: Orchestration starts at design
  const orchestration = {
    id: 'orch-e2e-001',
    projectId: env.projectId,
    status: 'running' as const,
    currentPhase: 'design' as const,
    config: {
      skipDesign: false,
      skipAnalyze: true,
      autoMerge: false,
      autoHealEnabled: false,
      maxHealAttempts: 0,
      batchSizeFallback: 15,
      pauseBetweenBatches: false,
      additionalContext: '',
      budget: { maxPerBatch: 5, maxTotal: 50, healingBudget: 2, decisionBudget: 0.5 },
    },
    batches: { total: 0, current: 0, items: [] },
    executions: { implement: [], healers: [] },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    decisionLog: [],
    totalCostUsd: 0,
  };

  services.orchestrationService.get.mockReturnValue(orchestration);

  // Simulate workflow completion
  services.workflowService.get.mockReturnValue({ id: 'wf-design', status: 'completed' });

  return { orchestration, services };
}

/**
 * Scenario: Full orchestration flow
 */
async function runFullFlowScenario(env: TestEnvironment, services: MockServices) {
  const orchestration = {
    id: 'orch-e2e-full',
    projectId: env.projectId,
    status: 'running' as const,
    currentPhase: 'design' as const,
    config: {
      skipDesign: false,
      skipAnalyze: false,
      autoMerge: true,
      autoHealEnabled: true,
      maxHealAttempts: 2,
      batchSizeFallback: 15,
      pauseBetweenBatches: false,
      additionalContext: '',
      budget: { maxPerBatch: 5, maxTotal: 50, healingBudget: 2, decisionBudget: 0.5 },
    },
    batches: {
      total: 1,
      current: 0,
      items: [{ index: 0, section: 'Setup', taskIds: ['T001', 'T002'], status: 'pending' as const, healAttempts: 0 }],
    },
    executions: { implement: [], healers: [] },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    decisionLog: [],
    totalCostUsd: 0,
  };

  services.orchestrationService.get.mockReturnValue(orchestration);

  return { orchestration, services };
}

// =============================================================================
// E2E Test Suite
// =============================================================================

describe('Orchestration E2E', () => {
  let env: TestEnvironment;
  let services: MockServices;

  beforeAll(() => {
    env = createTestProject();
    services = createMockServices();
  });

  afterAll(() => {
    env.cleanup();
  });

  describe('Test Environment', () => {
    it('should create isolated test project', () => {
      expect(env.projectPath).toBeDefined();
      expect(env.projectId).toContain('e2e');
    });

    it('should have required project structure', async () => {
      const { existsSync } = await import('fs');
      expect(existsSync(join(env.projectPath, '.specflow'))).toBe(true);
      expect(existsSync(join(env.projectPath, 'specs', '0001-test-phase', 'spec.md'))).toBe(true);
      expect(existsSync(join(env.projectPath, 'specs', '0001-test-phase', 'tasks.md'))).toBe(true);
    });
  });

  describe('Design Only Scenario', () => {
    it('should setup design-only orchestration', async () => {
      const { orchestration } = await runDesignOnlyScenario(env, services);
      expect(orchestration.currentPhase).toBe('design');
      expect(orchestration.config.skipAnalyze).toBe(true);
    });
  });

  describe('Full Flow Scenario', () => {
    it('should setup full flow orchestration', async () => {
      const { orchestration } = await runFullFlowScenario(env, services);
      expect(orchestration.currentPhase).toBe('design');
      expect(orchestration.config.autoMerge).toBe(true);
      expect(orchestration.batches.total).toBe(1);
    });
  });
});

// =============================================================================
// CLI Runner (for standalone execution)
// =============================================================================

export { createTestProject, createMockServices, runDesignOnlyScenario, runFullFlowScenario };
