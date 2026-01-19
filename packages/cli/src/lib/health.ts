import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  findProjectRoot,
  getStatePath,
  getManifestPath,
  getRoadmapPath,
  getMemoryDir,
  pathExists,
} from './paths.js';
import { readState } from './state.js';
import { readRoadmap, getPhaseByNumber } from './roadmap.js';
import { getProjectContext, getMissingArtifacts } from './context.js';
import type { OrchestrationState } from '@specflow/shared';

/**
 * Zod schema for manifest.json validation
 */
const ManifestSchema = z.object({
  schema_version: z.string().optional(),
  project: z.object({
    name: z.string().optional(),
    id: z.string().optional(),
  }).optional(),
  compatibility: z.object({
    min_cli: z.string().optional(),
    max_cli: z.string().optional(),
  }).optional(),
}).passthrough(); // Allow additional fields for forward compatibility

// CLI version for compatibility checks
const CLI_VERSION = '3.0.0';

const execAsync = promisify(exec);

/**
 * Compare semver versions (simplified: major.minor.patch)
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number);
    return { major, minor, patch };
  };
  const av = parseVersion(a);
  const bv = parseVersion(b);
  if (av.major !== bv.major) return av.major - bv.major;
  if (av.minor !== bv.minor) return av.minor - bv.minor;
  return av.patch - bv.patch;
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Health issue with fix suggestion
 */
export interface HealthIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  fix?: string;
  autoFixable: boolean;
}

/**
 * Overall health status
 */
export type HealthStatus = 'ready' | 'healthy' | 'warning' | 'error' | 'initializing';

/**
 * Complete health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  issues: HealthIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  nextAction?: string;
}

/**
 * Collect all health issues for a project
 */
async function collectIssues(projectPath?: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const root = projectPath || findProjectRoot();

  if (!root) {
    issues.push({
      code: 'NO_PROJECT',
      severity: 'error',
      message: 'Not in a SpecFlow project directory',
      fix: 'Navigate to a SpecFlow project or run "/flow.init" to initialize',
      autoFixable: false,
    });
    return issues;
  }

  // Check state file
  const statePath = getStatePath(root);
  if (!pathExists(statePath)) {
    issues.push({
      code: 'NO_STATE',
      severity: 'error',
      message: 'No state file found',
      fix: 'Run "specflow phase open <number>" to start a phase, or "specflow state set" to initialize',
      autoFixable: true,
    });
    return issues; // Can't check further without state
  }

  // Try to read state
  let state: OrchestrationState;
  try {
    state = await readState(root);
  } catch (err) {
    issues.push({
      code: 'STATE_INVALID',
      severity: 'error',
      message: 'State file is corrupted or invalid',
      fix: 'Run "specflow state reset" to reset state, or manually repair .specflow/orchestration-state.json',
      autoFixable: false, // Requires manual intervention to preserve data
    });
    return issues;
  }

  // Check ROADMAP.md
  const roadmapPath = getRoadmapPath(root);
  if (!pathExists(roadmapPath)) {
    issues.push({
      code: 'NO_ROADMAP',
      severity: 'warning',
      message: 'No ROADMAP.md found',
      fix: 'Create ROADMAP.md with phase definitions',
      autoFixable: false,
    });
  }

  // Check memory documents
  const memoryDir = getMemoryDir(root);
  if (!pathExists(memoryDir)) {
    issues.push({
      code: 'NO_MEMORY',
      severity: 'info',
      message: 'No memory directory found',
      fix: 'Run "/flow.init" to set up memory documents',
      autoFixable: false,
    });
  }

  // Check for deprecated .specify/issues directory (removed in v3.0)
  const issuesDir = join(root, '.specify', 'issues');
  if (pathExists(issuesDir)) {
    issues.push({
      code: 'DEPRECATED_ISSUES_DIR',
      severity: 'warning',
      message: 'Deprecated .specify/issues/ directory found (removed in v3.0)',
      fix: 'Remove with: rm -rf .specify/issues/',
      autoFixable: false,
    });
  }

  // Check manifest version compatibility
  const manifestPath = getManifestPath(root);
  if (pathExists(manifestPath)) {
    try {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const jsonData = JSON.parse(manifestContent);
      const parseResult = ManifestSchema.safeParse(jsonData);

      if (!parseResult.success) {
        issues.push({
          code: 'MANIFEST_INVALID',
          severity: 'warning',
          message: `Invalid manifest.json structure: ${parseResult.error.issues[0]?.message ?? 'Unknown error'}`,
          fix: 'Run "/flow.init" to regenerate manifest',
          autoFixable: false,
        });
      } else {
        const manifest = parseResult.data;
        const minCli = manifest.compatibility?.min_cli;

        if (minCli && compareSemver(CLI_VERSION, minCli) < 0) {
          issues.push({
            code: 'CLI_VERSION_MISMATCH',
            severity: 'error',
            message: `Project requires CLI v${minCli}+ but running v${CLI_VERSION}`,
            fix: 'Update SpecFlow CLI: curl -fsSL https://specflow.dev/install.sh | bash',
            autoFixable: false,
          });
        }
      }
    } catch {
      issues.push({
        code: 'MANIFEST_INVALID',
        severity: 'warning',
        message: 'Cannot read or parse .specflow/manifest.json',
        fix: 'Run "/flow.init" to regenerate manifest',
        autoFixable: false,
      });
    }
  }

  // Check phase/roadmap consistency
  if (state.orchestration?.phase?.number && pathExists(roadmapPath)) {
    try {
      const roadmap = await readRoadmap(root);
      const statePhaseNumber = state.orchestration.phase.number;
      const roadmapPhase = getPhaseByNumber(roadmap, statePhaseNumber);

      if (!roadmapPhase) {
        issues.push({
          code: 'PHASE_NOT_IN_ROADMAP',
          severity: 'warning',
          message: `State references phase ${statePhaseNumber} but it's not in ROADMAP.md`,
          fix: 'Add phase to ROADMAP.md or update state with "specflow state set"',
          autoFixable: false,
        });
      } else {
        // Check status consistency
        const stateStatus = state.orchestration.phase.status;
        const roadmapStatus = roadmapPhase.status;

        if (stateStatus === 'in_progress' && roadmapStatus === 'complete') {
          issues.push({
            code: 'STATE_ROADMAP_DRIFT',
            severity: 'warning',
            message: 'State shows phase in progress but ROADMAP shows complete',
            fix: 'Run "specflow phase close" to close completed phase',
            autoFixable: false, // Requires user to verify before closing
          });
        }
      }
    } catch {
      // Roadmap parsing failed - already reported above
    }
  }

  // Check git branch consistency
  if (state.orchestration?.phase?.branch) {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: root,
      });
      const currentBranch = stdout.trim();
      const expectedBranch = state.orchestration.phase.branch;

      if (currentBranch && currentBranch !== expectedBranch) {
        // Check if we're on main/master (post-merge state)
        if (currentBranch === 'main' || currentBranch === 'master') {
          issues.push({
            code: 'ON_MAIN_BRANCH',
            severity: 'info',
            message: `On ${currentBranch} but state expects ${expectedBranch}`,
            fix: 'If phase was merged, run "specflow phase open <next>" to start next phase',
            autoFixable: false,
          });
        } else {
          issues.push({
            code: 'BRANCH_MISMATCH',
            severity: 'warning',
            message: `Current branch "${currentBranch}" doesn't match state "${expectedBranch}"`,
            fix: `Run "git checkout ${expectedBranch}" to switch branches`,
            autoFixable: true,
          });
        }
      }
    } catch {
      // Not a git repo or git not available
    }
  }

  // Check feature artifacts
  if (state.orchestration?.phase?.number) {
    try {
      const context = await getProjectContext(root);
      if (context.activeFeature) {
        const missingArtifacts = getMissingArtifacts(context.activeFeature.artifacts);
        const stepIndex = parseInt(String(state.orchestration.step?.index || 0), 10);

        // If past design step, should have all design artifacts
        if (stepIndex > 0 && missingArtifacts.length > 0) {
          issues.push({
            code: 'MISSING_ARTIFACTS',
            severity: 'warning',
            message: `Missing design artifacts: ${missingArtifacts.join(', ')}`,
            fix: 'Run "/flow.design" to generate missing artifacts',
            autoFixable: false,
          });
        }
      }
    } catch {
      // Context resolution failed
    }
  }

  // Check step status consistency
  const stepStatus = state.orchestration?.step?.status;
  if (stepStatus === 'blocked' || stepStatus === 'failed') {
    issues.push({
      code: 'STEP_BLOCKED',
      severity: 'warning',
      message: `Current step is ${stepStatus}`,
      fix: 'Review blockers and retry, or skip with "specflow state set orchestration.step.status=in_progress"',
      autoFixable: false,
    });
  }

  return issues;
}

/**
 * Determine health status from issues
 */
function determineStatus(issues: HealthIssue[]): HealthStatus {
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  if (hasErrors) return 'error';
  if (hasWarnings) return 'warning';
  return 'ready';
}

/**
 * Determine next action based on issues
 */
function determineNextAction(issues: HealthIssue[], status: HealthStatus): string | undefined {
  if (status === 'error') {
    const firstError = issues.find(i => i.severity === 'error');
    if (firstError?.autoFixable) {
      return 'run_check_fix';
    }
    return 'fix_errors';
  }

  if (status === 'warning') {
    const autoFixable = issues.some(i => i.severity === 'warning' && i.autoFixable);
    if (autoFixable) {
      return 'run_check_fix';
    }
    return 'review_warnings';
  }

  return undefined;
}

/**
 * Run complete health check
 */
export async function runHealthCheck(projectPath?: string): Promise<HealthCheckResult> {
  const issues = await collectIssues(projectPath);

  const summary = {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  };

  const status = determineStatus(issues);
  const nextAction = determineNextAction(issues, status);

  return {
    status,
    issues,
    summary,
    nextAction,
  };
}

/**
 * Get health issues that can be auto-fixed
 */
export function getAutoFixableIssues(result: HealthCheckResult): HealthIssue[] {
  return result.issues.filter(i => i.autoFixable);
}

/**
 * Quick health check - just returns status without full diagnostics
 */
export async function getQuickHealthStatus(projectPath?: string): Promise<HealthStatus> {
  const root = projectPath || findProjectRoot();

  if (!root) return 'error';
  if (!pathExists(getStatePath(root))) return 'initializing';

  try {
    await readState(root);
    // Could do more checks here, but keep it fast
    return 'ready';
  } catch {
    return 'error';
  }
}
