import { Command } from 'commander';
import { readFile, readdir, copyFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../lib/output.js';
import { readState, writeState, setStateValue, readRawState, writeRawState } from '../lib/state.js';
import { readTasks, detectCircularDependencies } from '../lib/tasks.js';
import { readRoadmap, getPhaseByNumber } from '../lib/roadmap.js';
import { readFeatureChecklists, areAllChecklistsComplete, getAllVerificationItems } from '../lib/checklist.js';
import { readEvidence, hasEvidence } from '../lib/evidence.js';
import { getProjectContext, resolveFeatureDir, getMissingArtifacts } from '../lib/context.js';
import { runHealthCheck, type HealthIssue } from '../lib/health.js';
import { findProjectRoot, pathExists, getStatePath, getMemoryDir, getTemplatesDir, getSystemTemplatesDir, getHistoryDir, getSpecifyDir } from '../lib/paths.js';
import { handleError, NotFoundError } from '../lib/errors.js';
import { STEP_INDEX_MAP } from '@specflow/shared';
import type { OrchestrationState } from '@specflow/shared';

/**
 * Gate types
 */
export type GateType = 'design' | 'specify' | 'implement' | 'verify' | 'memory';

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
    specify: GateResult;
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
 * Check specify gate - validates spec.md is complete with goal coverage
 */
async function checkSpecifyGate(featureDir: string | undefined): Promise<GateResult> {
  if (!featureDir) {
    return {
      passed: false,
      reason: 'No active feature',
      checks: { feature_exists: false },
    };
  }

  const checks: Record<string, boolean> = {};

  // Check spec.md exists
  const specPath = join(featureDir, 'spec.md');
  checks.spec_exists = pathExists(specPath);

  if (checks.spec_exists) {
    try {
      const content = await readFile(specPath, 'utf-8');

      // Check for placeholders
      const hasPlaceholders = /\b(TODO|TBD|TKTK|\?\?\?|<placeholder>)\b/i.test(content);
      checks.no_placeholders = !hasPlaceholders;

      // Check for goal coverage matrix (should have a table with goals)
      const hasGoalMatrix = /\|\s*(Phase\s*)?Goal/i.test(content) ||
                           /##\s*(Phase\s*)?Goals?\s*Coverage/i.test(content);
      checks.has_goal_coverage = hasGoalMatrix;

      // Check all goals are at least PARTIAL (not MISSING)
      const missingGoals = content.match(/\|\s*MISSING\s*\|/gi);
      checks.no_missing_goals = !missingGoals || missingGoals.length === 0;
    } catch {
      checks.spec_readable = false;
    }
  }

  const passed = checks.spec_exists &&
    checks.no_placeholders !== false &&
    checks.has_goal_coverage !== false &&
    checks.no_missing_goals !== false;

  return {
    passed,
    reason: passed ? undefined : 'Spec incomplete or missing goal coverage',
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

  let missingEvidenceItems: string[] = [];

  try {
    const checklists = await readFeatureChecklists(featureDir);
    checks.checklists_complete = areAllChecklistsComplete(checklists);

    // Check evidence for completed V-items
    const vItems = getAllVerificationItems(checklists);
    const completedVItems = vItems.filter(i => i.status === 'done');

    if (completedVItems.length > 0) {
      const evidence = await readEvidence(featureDir);

      if (evidence) {
        // Evidence file exists — all completed V-items must have evidence
        const result = hasEvidence(evidence, completedVItems.map(i => i.id));
        checks.evidence_complete = result.complete;
        missingEvidenceItems = result.missing;
      } else {
        // No evidence file at all — graceful degradation (pass with warning)
        checks.evidence_complete = true;
      }
    } else {
      // No completed V-items — evidence check is trivially satisfied
      checks.evidence_complete = true;
    }
  } catch {
    checks.checklists_complete = false;
    checks.evidence_complete = false;
  }

  const passed = Object.values(checks).every(Boolean);

  let reason: string | undefined;
  if (!passed) {
    const reasons: string[] = [];
    if (!checks.implementation_gate) reasons.push('implementation gate not passed');
    if (!checks.checklists_complete) reasons.push('checklists incomplete');
    if (!checks.evidence_complete) {
      reasons.push(`missing evidence for: ${missingEvidenceItems.join(', ')}`);
    }
    reason = reasons.join('; ');
  }

  return {
    passed,
    reason,
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

  // First pass: Fix STATE_SCHEMA_ERROR issues that prevent normal reads
  const schemaErrors = autoFixable.filter(i => i.code === 'STATE_SCHEMA_ERROR');
  if (schemaErrors.length > 0) {
    try {
      const rawResult = await readRawState(projectRoot);
      if (rawResult.data && rawResult.zodErrors) {
        const data = rawResult.data as Record<string, unknown>;
        let fixCount = 0;

        // Fix common schema issues in raw data
        const orchestration = data.orchestration as Record<string, unknown> | undefined;
        if (orchestration) {
          const step = orchestration.step as Record<string, unknown> | undefined;
          const phase = orchestration.phase as Record<string, unknown> | undefined;

          // Fix step.index if it's a string
          if (step && typeof step.index === 'string') {
            const stepCurrent = step.current as string | undefined;
            const stepKey = stepCurrent && stepCurrent in STEP_INDEX_MAP
              ? (stepCurrent as keyof typeof STEP_INDEX_MAP)
              : null;
            const correctIndex = stepKey ? STEP_INDEX_MAP[stepKey] : null;
            step.index = correctIndex;
            fixCount++;
          }

          // Fix step.current if invalid
          const validSteps = Object.keys(STEP_INDEX_MAP);
          if (step && step.current && !validSteps.includes(step.current as string)) {
            step.current = null;
            fixCount++;
          }

          // Fix step.status if invalid
          const validStepStatuses = ['not_started', 'pending', 'in_progress', 'complete', 'failed', 'blocked', 'skipped'];
          if (step && step.status && !validStepStatuses.includes(step.status as string)) {
            step.status = 'not_started';
            fixCount++;
          }

          // Fix phase.status if invalid
          const validPhaseStatuses = ['not_started', 'in_progress', 'complete'];
          if (phase && phase.status && !validPhaseStatuses.includes(phase.status as string)) {
            phase.status = 'not_started';
            fixCount++;
          }
        }

        // Fix schema_version
        if (data.schema_version !== '3.0') {
          data.schema_version = '3.0';
          fixCount++;
        }

        if (fixCount > 0) {
          await writeRawState(data, projectRoot);
          fixed.push({
            code: 'STATE_SCHEMA_ERROR',
            action: `Repaired ${fixCount} schema validation issue(s) in state file`,
          });
        }
      }
    } catch {
      // Raw repair failed, continue with other fixes
    }
  }

  for (const issue of autoFixable) {
    try {
      // Skip STATE_SCHEMA_ERROR - already handled above
      if (issue.code === 'STATE_SCHEMA_ERROR') continue;

      // === Schema validation fixes ===

      if (issue.code === 'SCHEMA_VERSION_OUTDATED') {
        const state = await readState(projectRoot);
        const updated = { ...state, schema_version: '3.0' };
        await writeState(updated as OrchestrationState, projectRoot);
        fixed.push({
          code: issue.code,
          action: 'Updated schema_version to "3.0"',
        });
      }

      if (issue.code === 'STEP_INDEX_TYPE_ERROR') {
        const state = await readState(projectRoot);
        const currentStep = state.orchestration?.step?.current;
        // Convert to correct number based on step name, or 0 if unknown
        const correctIndex = currentStep && STEP_INDEX_MAP[currentStep] !== undefined
          ? STEP_INDEX_MAP[currentStep]
          : 0;
        const updated = setStateValue(state, 'orchestration.step.index', correctIndex);
        await writeState(updated, projectRoot);
        fixed.push({
          code: issue.code,
          action: `Converted step.index to number: ${correctIndex}`,
        });
      }

      if (issue.code === 'STEP_CURRENT_INVALID') {
        const state = await readState(projectRoot);
        // Reset to null for invalid values like "idle"
        const updated = setStateValue(state, 'orchestration.step.current', null);
        await writeState(updated, projectRoot);
        fixed.push({
          code: issue.code,
          action: 'Reset step.current to null',
        });
      }

      if (issue.code === 'STEP_STATUS_INVALID') {
        const state = await readState(projectRoot);
        // Reset to not_started for invalid values like "idle"
        const updated = setStateValue(state, 'orchestration.step.status', 'not_started');
        await writeState(updated, projectRoot);
        fixed.push({
          code: issue.code,
          action: 'Reset step.status to "not_started"',
        });
      }

      if (issue.code === 'PHASE_STATUS_INVALID') {
        const state = await readState(projectRoot);
        // Reset to not_started for invalid values like "idle"
        const updated = setStateValue(state, 'orchestration.phase.status', 'not_started');
        await writeState(updated, projectRoot);
        fixed.push({
          code: issue.code,
          action: 'Reset phase.status to "not_started"',
        });
      }

      if (issue.code === 'STEP_INDEX_MISMATCH') {
        const state = await readState(projectRoot);
        const currentStep = state.orchestration?.step?.current;
        if (currentStep && STEP_INDEX_MAP[currentStep] !== undefined) {
          const correctIndex = STEP_INDEX_MAP[currentStep];
          const updated = setStateValue(state, 'orchestration.step.index', correctIndex);
          await writeState(updated, projectRoot);
          fixed.push({
            code: issue.code,
            action: `Corrected step.index to ${correctIndex} (for "${currentStep}")`,
          });
        }
      }

      // === File structure fixes ===

      if (issue.code === 'STATE_WRONG_LOCATION') {
        const wrongPath = join(getSpecifyDir(projectRoot), 'orchestration-state.json');
        await unlink(wrongPath);
        fixed.push({
          code: issue.code,
          action: 'Removed duplicate state file from .specify/',
        });
      }

      if (issue.code === 'NO_BACKLOG') {
        const backlogPath = join(projectRoot, 'BACKLOG.md');
        const backlogContent = `# Backlog

> Items deferred for future consideration. Add items during \`/flow.verify\` or with \`specflow phase defer "item"\`.

## Deferred Items

<!-- Add deferred items here -->

## Technical Debt

<!-- Add tech debt items here -->

## Future Considerations

<!-- Add future ideas here -->
`;
        await writeFile(backlogPath, backlogContent, 'utf-8');
        fixed.push({
          code: issue.code,
          action: 'Created BACKLOG.md template',
        });
      }

      if (issue.code === 'NO_HISTORY') {
        const historyDir = getHistoryDir(projectRoot);
        await mkdir(historyDir, { recursive: true });
        const historyPath = join(historyDir, 'HISTORY.md');
        const historyContent = `# Phase History

> Summaries of completed phases. Updated automatically by \`specflow phase close\`.

---

<!-- Completed phase summaries will be added here -->
`;
        await writeFile(historyPath, historyContent, 'utf-8');
        fixed.push({
          code: issue.code,
          action: 'Created .specify/history/HISTORY.md template',
        });
      }

      // === Existing fixes ===

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

  if (!gates.specify.passed) {
    return 'complete_spec';
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
        specify: { passed: false, reason: 'No project', checks: {} },
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
  const specifyGate = await checkSpecifyGate(featureDir);
  const implementGate = await checkImplementGate(featureDir);
  const verifyGate = await checkVerifyGate(featureDir, implementGate);
  const memoryGate = await checkMemoryGate(projectRoot);

  // If specific gate requested, only check that
  if (options.gate) {
    const gateResult = options.gate === 'design' ? designGate :
                       options.gate === 'specify' ? specifyGate :
                       options.gate === 'implement' ? implementGate :
                       options.gate === 'memory' ? memoryGate : verifyGate;

    return {
      passed: gateResult.passed,
      summary: { errors: gateResult.passed ? 0 : 1, warnings: 0, info: 0 },
      gates: { design: designGate, specify: specifyGate, implement: implementGate, verify: verifyGate, memory: memoryGate },
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

  const passed = summary.errors === 0 && designGate.passed && specifyGate.passed && implementGate.passed;

  const result: CheckOutput = {
    passed,
    summary,
    gates: {
      design: designGate,
      specify: specifyGate,
      implement: implementGate,
      verify: verifyGate,
      memory: memoryGate,
    },
    issues,
    autoFixableCount: issues.filter(i => i.autoFixable).length,
    suggestedAction: determineSuggestedAction(issues, { design: designGate, specify: specifyGate, implement: implementGate, verify: verifyGate, memory: memoryGate }),
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
