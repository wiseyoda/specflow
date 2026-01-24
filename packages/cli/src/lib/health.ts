import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { z } from 'zod';
import {
  findProjectRoot,
  getStatePath,
  getManifestPath,
  getRoadmapPath,
  getMemoryDir,
  getTemplatesDir,
  getSystemTemplatesDir,
  getSpecsDir,
  getArchiveDir,
  getHistoryDir,
  getPhasesDir,
  getSpecifyDir,
  pathExists,
} from './paths.js';
import { readState, readRawState } from './state.js';
import { readRoadmap, getPhaseByNumber } from './roadmap.js';
import { getProjectContext, getMissingArtifacts, resolveFeatureDir } from './context.js';
import { readTasks } from './tasks.js';
import type { OrchestrationState } from '@specflow/shared';

/**
 * Valid enum values for schema validation
 */
const VALID_STEP_NAMES = ['design', 'analyze', 'implement', 'verify'] as const;
const VALID_STEP_STATUSES = ['not_started', 'pending', 'in_progress', 'complete', 'failed', 'blocked', 'skipped'] as const;
const VALID_PHASE_STATUSES = ['not_started', 'in_progress', 'complete'] as const;
const STEP_INDEX_MAP: Record<string, number> = { design: 0, analyze: 1, implement: 2, verify: 3 };

/**
 * ABBC naming pattern - 4 digits (e.g., 0010, 0020, 1015)
 */
const ABBC_PATTERN = /^\d{4}-/;

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
      fix: 'Run "specflow init" to initialize the project',
      autoFixable: false, // Requires full project setup, not just state file
    });
    return issues; // Can't check further without state
  }

  // Try to read state
  let state: OrchestrationState;
  try {
    state = await readState(root);
  } catch (err) {
    // Try to read raw state for better diagnostics
    const rawResult = await readRawState(root);
    if (rawResult.zodErrors && rawResult.zodErrors.length > 0) {
      // Provide specific error messages for each Zod validation issue
      for (const zodIssue of rawResult.zodErrors.slice(0, 5)) {
        const path = zodIssue.path.join('.');
        issues.push({
          code: 'STATE_SCHEMA_ERROR',
          severity: 'error',
          message: `${path}: ${zodIssue.message}`,
          fix: 'Run "specflow check --fix" to attempt auto-repair',
          autoFixable: true,
        });
      }
      if (rawResult.zodErrors.length > 5) {
        issues.push({
          code: 'STATE_SCHEMA_ERROR',
          severity: 'error',
          message: `... and ${rawResult.zodErrors.length - 5} more validation errors`,
          autoFixable: false,
        });
      }
    } else {
      issues.push({
        code: 'STATE_INVALID',
        severity: 'error',
        message: rawResult.error || 'State file is corrupted or invalid',
        fix: 'Run "specflow state reset" to reset state, or manually repair .specflow/orchestration-state.json',
        autoFixable: false,
      });
    }
    return issues;
  }

  // === NEW: Schema validation checks ===

  // Check schema_version
  if (state.schema_version !== '3.0') {
    issues.push({
      code: 'SCHEMA_VERSION_OUTDATED',
      severity: 'error',
      message: `schema_version is "${state.schema_version}", expected "3.0"`,
      fix: 'Run "specflow check --fix" to update schema version',
      autoFixable: true,
    });
  }

  // Check step.index is a number (not string)
  const stepIndex = state.orchestration?.step?.index;
  if (stepIndex !== null && stepIndex !== undefined && typeof stepIndex !== 'number') {
    issues.push({
      code: 'STEP_INDEX_TYPE_ERROR',
      severity: 'error',
      message: `step.index is "${typeof stepIndex}" ("${stepIndex}"), must be a number`,
      fix: 'Run "specflow check --fix" to convert to correct type',
      autoFixable: true,
    });
  }

  // Check step.current is valid enum or null
  const stepCurrent = state.orchestration?.step?.current;
  if (stepCurrent !== null && stepCurrent !== undefined) {
    if (!VALID_STEP_NAMES.includes(stepCurrent as typeof VALID_STEP_NAMES[number])) {
      issues.push({
        code: 'STEP_CURRENT_INVALID',
        severity: 'error',
        message: `step.current is "${stepCurrent}", must be one of: ${VALID_STEP_NAMES.join(', ')} (or null)`,
        fix: 'Run "specflow check --fix" to reset to valid value',
        autoFixable: true,
      });
    }
  }

  // Check step.status is valid enum
  const stepStatus = state.orchestration?.step?.status;
  if (stepStatus !== null && stepStatus !== undefined) {
    if (!VALID_STEP_STATUSES.includes(stepStatus as typeof VALID_STEP_STATUSES[number])) {
      issues.push({
        code: 'STEP_STATUS_INVALID',
        severity: 'error',
        message: `step.status is "${stepStatus}", must be one of: ${VALID_STEP_STATUSES.join(', ')}`,
        fix: 'Run "specflow check --fix" to reset to valid value',
        autoFixable: true,
      });
    }
  }

  // Check phase.status is valid enum
  const phaseStatus = state.orchestration?.phase?.status;
  if (phaseStatus !== null && phaseStatus !== undefined) {
    if (!VALID_PHASE_STATUSES.includes(phaseStatus as typeof VALID_PHASE_STATUSES[number])) {
      issues.push({
        code: 'PHASE_STATUS_INVALID',
        severity: 'error',
        message: `phase.status is "${phaseStatus}", must be one of: ${VALID_PHASE_STATUSES.join(', ')}`,
        fix: 'Run "specflow check --fix" to reset to valid value',
        autoFixable: true,
      });
    }
  }

  // Check step.index matches step.current (if both set)
  if (stepCurrent && typeof stepIndex === 'number') {
    const expectedIndex = STEP_INDEX_MAP[stepCurrent];
    if (expectedIndex !== undefined && stepIndex !== expectedIndex) {
      issues.push({
        code: 'STEP_INDEX_MISMATCH',
        severity: 'warning',
        message: `step.index is ${stepIndex} but step.current is "${stepCurrent}" (expected index ${expectedIndex})`,
        fix: 'Run "specflow check --fix" to correct index',
        autoFixable: true,
      });
    }
  }

  // === NEW: File structure checks ===

  // Check for state file in wrong location (.specify/)
  const wrongStatePath = join(getSpecifyDir(root), 'orchestration-state.json');
  if (pathExists(wrongStatePath)) {
    issues.push({
      code: 'STATE_WRONG_LOCATION',
      severity: 'warning',
      message: 'State file found in .specify/ (should only be in .specflow/)',
      fix: 'Run "specflow check --fix" to remove duplicate, or manually delete .specify/orchestration-state.json',
      autoFixable: true,
    });
  }

  // Check BACKLOG.md exists
  const backlogPath = join(root, 'BACKLOG.md');
  if (!pathExists(backlogPath)) {
    issues.push({
      code: 'NO_BACKLOG',
      severity: 'info',
      message: 'No BACKLOG.md found',
      fix: 'Run "specflow check --fix" to create BACKLOG.md template',
      autoFixable: true,
    });
  }

  // Check HISTORY.md exists
  const historyDir = getHistoryDir(root);
  const historyPath = join(historyDir, 'HISTORY.md');
  if (!pathExists(historyPath)) {
    issues.push({
      code: 'NO_HISTORY',
      severity: 'info',
      message: 'No .specify/history/HISTORY.md found',
      fix: 'Run "specflow check --fix" to create HISTORY.md template',
      autoFixable: true,
    });
  }

  // Check specs/ folder for ABC naming (should be ABBC)
  const specsDir = getSpecsDir(root);
  if (pathExists(specsDir)) {
    try {
      const specFolders = await readdir(specsDir, { withFileTypes: true });
      const abcFolders = specFolders
        .filter(d => d.isDirectory())
        .filter(d => /^\d{3}-/.test(d.name) && !ABBC_PATTERN.test(d.name))
        .map(d => d.name);

      if (abcFolders.length > 0) {
        issues.push({
          code: 'ABC_NAMING_FOUND',
          severity: 'warning',
          message: `Found ${abcFolders.length} phase folder(s) with old ABC naming: ${abcFolders.slice(0, 3).join(', ')}${abcFolders.length > 3 ? '...' : ''}`,
          fix: 'Rename folders from ABC (001-name) to ABBC (0010-name) format',
          autoFixable: false, // Requires careful migration
        });
      }
    } catch {
      // Can't read specs dir
    }
  }

  // Check for completed phases still in specs/ (should be archived)
  if (pathExists(specsDir) && state.actions?.history) {
    try {
      const specFolders = await readdir(specsDir, { withFileTypes: true });
      const specFolderNames = specFolders.filter(d => d.isDirectory()).map(d => d.name);

      const completedPhases = state.actions.history
        .filter(h => h.type === 'phase_completed' && h.phase_number)
        .map(h => h.phase_number);

      const unarchived: string[] = [];
      for (const folder of specFolderNames) {
        // Extract phase number from folder name (e.g., "0010-name" -> "0010")
        const match = folder.match(/^(\d{3,4})-/);
        if (match) {
          const phaseNum = match[1].padStart(4, '0'); // Normalize to 4 digits
          if (completedPhases.includes(phaseNum) || completedPhases.includes(match[1])) {
            unarchived.push(folder);
          }
        }
      }

      if (unarchived.length > 0) {
        issues.push({
          code: 'COMPLETED_PHASE_NOT_ARCHIVED',
          severity: 'warning',
          message: `Found ${unarchived.length} completed phase(s) still in specs/: ${unarchived.slice(0, 3).join(', ')}${unarchived.length > 3 ? '...' : ''}`,
          fix: 'Move completed phases to .specify/archive/ with "specflow phase archive <number>"',
          autoFixable: false, // Requires careful migration
        });
      }
    } catch {
      // Can't check
    }
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

  // Check templates directory
  const templatesDir = getTemplatesDir(root);
  const systemTemplatesDir = getSystemTemplatesDir();
  if (!pathExists(templatesDir)) {
    // Templates dir doesn't exist at all
    if (pathExists(systemTemplatesDir)) {
      issues.push({
        code: 'NO_TEMPLATES',
        severity: 'warning',
        message: 'No templates directory found',
        fix: 'Run "specflow check --fix" to copy templates from system install',
        autoFixable: true,
      });
    } else {
      issues.push({
        code: 'NO_TEMPLATES',
        severity: 'warning',
        message: 'No templates directory found (system templates also missing)',
        fix: 'Reinstall SpecFlow with: ./install.sh',
        autoFixable: false,
      });
    }
  } else {
    // Templates dir exists, check if it has required templates
    const requiredTemplates = ['spec-template.md', 'plan-template.md', 'tasks-template.md'];
    const missingTemplates = requiredTemplates.filter(t => !pathExists(join(templatesDir, t)));
    if (missingTemplates.length > 0 && pathExists(systemTemplatesDir)) {
      issues.push({
        code: 'MISSING_TEMPLATES',
        severity: 'warning',
        message: `Missing templates: ${missingTemplates.join(', ')}`,
        fix: 'Run "specflow check --fix" to copy missing templates',
        autoFixable: true,
      });
    }
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
            autoFixable: false, // Don't auto-switch branches - could lose uncommitted work
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

        // Check if tasks.md exists but no tasks were parsed (format issue)
        if (context.activeFeature.artifacts.tasks) {
          try {
            const featureDir = await resolveFeatureDir(undefined, root);
            if (featureDir) {
              const tasksData = await readTasks(featureDir);
              if (tasksData.tasks.length === 0) {
                issues.push({
                  code: 'TASKS_FORMAT_ERROR',
                  severity: 'warning',
                  message: "tasks.md exists but no tasks found (likely format issue)",
                  fix: "Expected format: '- [ ] T001 Description'. Task ID must be inline with checkbox. " +
                    "Run '/flow.design --tasks' to regenerate with correct format.",
                  autoFixable: false,
                });
              }
            }
          } catch {
            // Task reading failed - not a format issue, just missing file
          }
        }
      }
    } catch {
      // Context resolution failed
    }
  }

  // Check step status consistency (blocked/failed)
  const currentStepStatus = state.orchestration?.step?.status;
  if (currentStepStatus === 'blocked' || currentStepStatus === 'failed') {
    issues.push({
      code: 'STEP_BLOCKED',
      severity: 'warning',
      message: `Current step is ${currentStepStatus}`,
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
