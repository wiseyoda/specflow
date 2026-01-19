import { Command } from 'commander';
import { readFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../lib/output.js';
import { readState, writeState, setStateValue } from '../lib/state.js';
import { readTasks, detectCircularDependencies } from '../lib/tasks.js';
import { readRoadmap, getPhaseByNumber } from '../lib/roadmap.js';
import { readFeatureChecklists, areAllChecklistsComplete } from '../lib/checklist.js';
import { getProjectContext, resolveFeatureDir, getMissingArtifacts } from '../lib/context.js';
import { runHealthCheck, type HealthIssue } from '../lib/health.js';
import { findProjectRoot, pathExists, getStatePath, getMemoryDir, getTemplatesDir, getSystemTemplatesDir } from '../lib/paths.js';
import { handleError, NotFoundError } from '../lib/errors.js';
import type { OrchestrationState } from '@specflow/shared';

/**
 * Gate types
 */
export type GateType = 'design' | 'implement' | 'verify' | 'memory';

/**
 * Check result for a single gate
 */
export interface GateResult {
  passed: boolean;
  reason?: string;
  checks: Record<string, boolean>;
}

/**
 * Issue found during check
 */
export interface CheckIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fix?: string;
  autoFixable: boolean;
}

/**
 * Fix result
 */
export interface FixResult {
  code: string;
  action: string;
}

/**
 * Complete check output
 */
export interface CheckOutput {
  passed: boolean;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  gates: {
    design: GateResult;
    implement: GateResult;
    verify: GateResult;
    memory: GateResult;
  };
  issues: CheckIssue[];
  autoFixableCount: number;
  suggestedAction?: string;
  fixed?: FixResult[];
}

/**
 * Check design gate
 */
async function checkDesignGate(featureDir: string | undefined): Promise<GateResult> {
  if (!featureDir) {
    return {
      passed: false,
      reason: 'No active feature',
      checks: { feature_exists: false },
    };
  }

  const context = await getProjectContext();
  const artifacts = context.activeFeature?.artifacts;

  if (!artifacts) {
    return {
      passed: false,
      reason: 'Cannot read feature artifacts',
      checks: { artifacts_readable: false },
    };
  }

  const checks = {
    spec_exists: artifacts.spec,
    plan_exists: artifacts.plan,
    tasks_exist: artifacts.tasks,
    checklists_exist: artifacts.checklists.implementation && artifacts.checklists.verification,
  };

  const passed = Object.values(checks).every(Boolean);

  return {
    passed,
    reason: passed ? undefined : 'Missing design artifacts',
    checks,
  };
}

/**
 * Check implement gate
 *
 * Note: ui-design.md is NOT validated here. The design phase decides whether
 * ui-design.md is needed using Claude's judgment. Keyword-based detection
 * caused too many false positives (e.g., "page", "list", "table" in non-UI contexts).
 */
async function checkImplementGate(featureDir: string | undefined): Promise<GateResult> {
  if (!featureDir) {
    return {
      passed: false,
      reason: 'No active feature',
      checks: { feature_exists: false },
    };
  }

  try {
    const tasks = await readTasks(featureDir);

    const allComplete = tasks.progress.completed === tasks.progress.total;
    const noBlocked = tasks.progress.blocked === 0;

    const checks: Record<string, boolean> = {
      tasks_complete: allComplete,
      no_blocked_tasks: noBlocked,
    };

    const passed = Object.values(checks).every(Boolean);

    let reason: string | undefined;
    if (!passed) {
      if (!allComplete) {
        reason = `${tasks.progress.total - tasks.progress.completed} tasks incomplete`;
      }
    }

    return {
      passed,
      reason,
      checks,
    };
  } catch {
    return {
      passed: false,
      reason: 'Cannot read tasks',
      checks: { tasks_readable: false },
    };
  }
}

/**
 * Check verify gate
 */
async function checkVerifyGate(
  featureDir: string | undefined,
  implementGate: GateResult,
): Promise<GateResult> {
  if (!featureDir) {
    return {
      passed: false,
      reason: 'No active feature',
      checks: { feature_exists: false },
    };
  }

  const checks: Record<string, boolean> = {
    implementation_gate: implementGate.passed,
  };

  try {
    const checklists = await readFeatureChecklists(featureDir);
    checks.checklists_complete = areAllChecklistsComplete(checklists);
  } catch {
    checks.checklists_complete = false;
  }

  const passed = Object.values(checks).every(Boolean);

  return {
    passed,
    reason: passed ? undefined : 'Verification requirements not met',
    checks,
  };
}

/**
 * Check memory gate - validates memory documents are healthy
 */
async function checkMemoryGate(projectRoot: string): Promise<GateResult> {
  const memoryDir = getMemoryDir(projectRoot);

  if (!pathExists(memoryDir)) {
    return {
      passed: false,
      reason: 'No memory directory',
      checks: { memory_dir_exists: false },
    };
  }

  const checks: Record<string, boolean> = {
    memory_dir_exists: true,
  };

  // Check constitution.md exists (required)
  const constitutionPath = join(memoryDir, 'constitution.md');
  checks.constitution_exists = pathExists(constitutionPath);

  // Check for placeholder content in constitution
  if (checks.constitution_exists) {
    try {
      const content = await readFile(constitutionPath, 'utf-8');
      const hasPlaceholders = /\b(TODO|TBD|TKTK|\?\?\?|<placeholder>)\b/i.test(content);
      checks.no_placeholders = !hasPlaceholders;

      // Check for agent directive header
      const hasAgentDirective = /^>\s*\*\*Agents?\*\*:/m.test(content);
      checks.has_agent_directive = hasAgentDirective;
    } catch {
      checks.constitution_readable = false;
    }
  }

  // Check recommended memory docs (warn if missing but don't fail)
  const recommendedDocs = ['tech-stack.md', 'coding-standards.md'];
  let recommendedCount = 0;
  for (const doc of recommendedDocs) {
    if (pathExists(join(memoryDir, doc))) {
      recommendedCount++;
    }
  }
  checks.has_recommended_docs = recommendedCount > 0;

  // Gate passes if constitution exists and has no placeholders
  const passed = checks.constitution_exists &&
    checks.no_placeholders !== false &&
    checks.has_agent_directive !== false;

  return {
    passed,
    reason: passed ? undefined : 'Memory documents need attention',
    checks,
  };
}

/**
 * Collect all issues
 */
async function collectIssues(
  projectRoot: string,
  featureDir: string | undefined,
  state: OrchestrationState | undefined,
): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];

  // Get health issues
  const healthResult = await runHealthCheck(projectRoot);
  for (const issue of healthResult.issues) {
    issues.push({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      fix: issue.fix,
      autoFixable: issue.autoFixable,
    });
  }

  // Check for state/step drift
  if (state && featureDir) {
    const stepCurrent = state.orchestration?.step?.current;
    const stepIndex = parseInt(String(state.orchestration?.step?.index ?? 0), 10);

    try {
      const context = await getProjectContext(projectRoot);
      const artifacts = context.activeFeature?.artifacts;

      // If in implement but missing design artifacts
      if (stepIndex >= 2 && artifacts) {
        const missing = getMissingArtifacts(artifacts);
        if (missing.length > 0) {
          issues.push({
            severity: 'warning',
            code: 'STEP_ARTIFACT_MISMATCH',
            message: `In implement step but missing: ${missing.join(', ')}`,
            fix: 'Run /flow.design to create missing artifacts, or reset step',
            autoFixable: false,
          });
        }
      }

      // If all tasks complete but step is still implement
      const tasks = await readTasks(featureDir);
      if (tasks.progress.completed === tasks.progress.total && stepCurrent === 'implement') {
        issues.push({
          severity: 'info',
          code: 'TASKS_COMPLETE_STEP_IMPLEMENT',
          message: 'All tasks complete but step is still implement',
          fix: 'Run: specflow state set orchestration.step.current=verify',
          autoFixable: true,
        });
      }
    } catch {
      // Ignore context/task errors
    }

    // Check for circular dependencies
    try {
      const tasks = await readTasks(featureDir);
      const cycles = detectCircularDependencies(tasks);
      if (cycles.length > 0) {
        issues.push({
          severity: 'error',
          code: 'CIRCULAR_DEPENDENCIES',
          message: `Circular dependencies found: ${cycles[0]}`,
          autoFixable: false,
        });
      }
    } catch {
      // Ignore
    }
  }

  return issues;
}

/**
 * Apply auto-fixes
 */
async function applyFixes(
  projectRoot: string,
  issues: CheckIssue[],
): Promise<FixResult[]> {
  const fixed: FixResult[] = [];
  const autoFixable = issues.filter(i => i.autoFixable);

  for (const issue of autoFixable) {
    try {
      if (issue.code === 'TASKS_COMPLETE_STEP_IMPLEMENT') {
        const state = await readState(projectRoot);
        const updated = setStateValue(state, 'orchestration.step.current', 'verify');
        await writeState(updated, projectRoot);
        fixed.push({
          code: issue.code,
          action: 'Updated step to verify',
        });
      }

      if (issue.code === 'NO_TEMPLATES' || issue.code === 'MISSING_TEMPLATES') {
        const systemTemplates = getSystemTemplatesDir();
        const projectTemplates = getTemplatesDir(projectRoot);

        // Ensure target directory exists
        await mkdir(projectTemplates, { recursive: true });

        // Copy all templates from system to project
        const files = await readdir(systemTemplates);
        let copied = 0;
        for (const file of files) {
          const src = join(systemTemplates, file);
          const dest = join(projectTemplates, file);
          // Only copy if destination doesn't exist or is missing templates issue
          if (issue.code === 'NO_TEMPLATES' || !pathExists(dest)) {
            await copyFile(src, dest);
            copied++;
          }
        }
        fixed.push({
          code: issue.code,
          action: `Copied ${copied} templates to .specify/templates/`,
        });
      }
    } catch {
      // Fix failed, continue
    }
  }

  return fixed;
}

/**
 * Determine suggested action from issues
 */
function determineSuggestedAction(
  issues: CheckIssue[],
  gates: CheckOutput['gates'],
): string | undefined {
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasAutoFixable = issues.some(i => i.autoFixable);

  if (hasErrors) {
    return 'fix_errors';
  }

  if (hasAutoFixable) {
    return 'run_check_fix';
  }

  if (!gates.design.passed) {
    return 'run_design';
  }

  if (!gates.implement.passed) {
    return 'complete_tasks';
  }

  if (!gates.verify.passed) {
    return 'complete_verification';
  }

  return 'ready_to_merge';
}

/**
 * Run complete check
 */
async function runCheck(options: {
  fix?: boolean;
  gate?: GateType;
}): Promise<CheckOutput> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    return {
      passed: false,
      summary: { errors: 1, warnings: 0, info: 0 },
      gates: {
        design: { passed: false, reason: 'No project', checks: {} },
        implement: { passed: false, reason: 'No project', checks: {} },
        verify: { passed: false, reason: 'No project', checks: {} },
        memory: { passed: false, reason: 'No project', checks: {} },
      },
      issues: [{
        severity: 'error',
        code: 'NO_PROJECT',
        message: 'Not in a SpecFlow project directory',
        autoFixable: false,
      }],
      autoFixableCount: 0,
    };
  }

  // Read state
  let state: OrchestrationState | undefined;
  try {
    state = await readState(projectRoot);
  } catch {
    // No state
  }

  const featureDir = await resolveFeatureDir(undefined, projectRoot);

  // Run gate checks
  const designGate = await checkDesignGate(featureDir);
  const implementGate = await checkImplementGate(featureDir);
  const verifyGate = await checkVerifyGate(featureDir, implementGate);
  const memoryGate = await checkMemoryGate(projectRoot);

  // If specific gate requested, only check that
  if (options.gate) {
    const gateResult = options.gate === 'design' ? designGate :
                       options.gate === 'implement' ? implementGate :
                       options.gate === 'memory' ? memoryGate : verifyGate;

    return {
      passed: gateResult.passed,
      summary: { errors: gateResult.passed ? 0 : 1, warnings: 0, info: 0 },
      gates: { design: designGate, implement: implementGate, verify: verifyGate, memory: memoryGate },
      issues: gateResult.passed ? [] : [{
        severity: 'error',
        code: `${options.gate.toUpperCase()}_GATE_FAILED`,
        message: gateResult.reason || `${options.gate} gate not passed`,
        autoFixable: false,
      }],
      autoFixableCount: 0,
    };
  }

  // Collect all issues
  let issues = await collectIssues(projectRoot, featureDir, state);

  // Apply fixes if requested
  let fixed: FixResult[] | undefined;
  if (options.fix) {
    fixed = await applyFixes(projectRoot, issues);

    // Re-collect issues after fixes
    if (fixed.length > 0) {
      issues = await collectIssues(projectRoot, featureDir, state);
    }
  }

  const summary = {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  };

  const passed = summary.errors === 0 && designGate.passed && implementGate.passed;

  const result: CheckOutput = {
    passed,
    summary,
    gates: {
      design: designGate,
      implement: implementGate,
      verify: verifyGate,
      memory: memoryGate,
    },
    issues,
    autoFixableCount: issues.filter(i => i.autoFixable).length,
    suggestedAction: determineSuggestedAction(issues, { design: designGate, implement: implementGate, verify: verifyGate, memory: memoryGate }),
  };

  if (fixed && fixed.length > 0) {
    result.fixed = fixed;
  }

  return result;
}

/**
 * Format human-readable check output
 */
function formatHumanReadable(result: CheckOutput): string {
  const lines: string[] = [];

  // Overall status
  lines.push(result.passed ? '✓ All checks passed' : '✗ Checks failed');

  // Summary
  if (result.summary.errors > 0 || result.summary.warnings > 0) {
    lines.push(`  Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings} | Info: ${result.summary.info}`);
  }

  // Gates
  const gateStatus = (g: GateResult) => g.passed ? '✓' : '✗';
  lines.push(`Gates: Design ${gateStatus(result.gates.design)} | Implement ${gateStatus(result.gates.implement)} | Verify ${gateStatus(result.gates.verify)} | Memory ${gateStatus(result.gates.memory)}`);

  // Issues
  if (result.issues.length > 0) {
    lines.push('');
    for (const issue of result.issues.slice(0, 5)) {
      const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      lines.push(`${icon} ${issue.message}`);
    }
    if (result.issues.length > 5) {
      lines.push(`  ... and ${result.issues.length - 5} more`);
    }
  }

  // Fixes applied
  if (result.fixed && result.fixed.length > 0) {
    lines.push('');
    lines.push('Fixed:');
    for (const fix of result.fixed) {
      lines.push(`  ✓ ${fix.action}`);
    }
  }

  // Suggested action
  if (result.suggestedAction) {
    lines.push('');
    lines.push(`Next: ${result.suggestedAction}`);
  }

  return lines.join('\n');
}

/**
 * Check command
 */
export const checkCommand = new Command('check')
  .description('Deep validation with auto-fix support')
  .option('--json', 'Output as JSON')
  .option('--fix', 'Auto-fix fixable issues')
  .option('--gate <gate>', 'Check specific gate: design, implement, verify, memory')
  .action(async (options) => {
    try {
      const result = await runCheck({
        fix: options.fix,
        // Safe assertion: Commander validates --gate against allowed values in .option()
        gate: options.gate as GateType | undefined,
      });

      if (options.json) {
        output(result);
      } else {
        output(result, formatHumanReadable(result));
      }

      // Exit with error code if checks failed
      if (!result.passed) {
        process.exit(1);
      }
    } catch (err) {
      handleError(err);
    }
  });
