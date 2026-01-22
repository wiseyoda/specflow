/**
 * Orchestration Runner - State Machine Execution Loop
 *
 * This is the CRITICAL missing piece that drives orchestration forward.
 * It monitors workflow completion and automatically transitions through phases.
 *
 * Flow: design → analyze → implement (batches) → verify → merge
 *
 * Features:
 * - Background polling for workflow completion
 * - State machine decision logic
 * - Sequential batch execution
 * - Auto-healing on failure
 * - Budget enforcement
 * - Decision logging
 * - Claude fallback analyzer (after 3 unclear state checks)
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { z } from 'zod';
import { orchestrationService } from './orchestration-service';
import { workflowService, type WorkflowExecution } from './workflow-service';
import { attemptHeal, getHealingSummary } from './auto-healing-service';
import { quickDecision } from './claude-helper';
import { parseBatchesFromProject } from './batch-parser';
import { isClaudeHelperError, type OrchestrationExecution, type OrchestrationPhase } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

interface RunnerContext {
  projectId: string;
  projectPath: string;
  orchestrationId: string;
  pollingInterval: number;
  maxPollingAttempts: number;
  consecutiveUnclearChecks: number;
}

// =============================================================================
// Claude State Analyzer (Fallback)
// =============================================================================

/**
 * Schema for Claude state analysis decision
 * Used when state is unclear after 3 consecutive checks
 */
const StateAnalyzerDecisionSchema = z.object({
  action: z.enum(['run_design', 'run_analyze', 'run_implement', 'run_verify', 'run_merge', 'wait', 'stop', 'fail']),
  reason: z.string().describe('Explanation for this decision'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How confident are you in this decision?'),
  suggestedSkill: z.string().optional().describe('If action requires running a skill, which one?'),
});

type StateAnalyzerDecision = z.infer<typeof StateAnalyzerDecisionSchema>;

/**
 * Maximum consecutive "unclear" checks before spawning Claude analyzer
 */
const MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE = 3;

/**
 * Spawn Claude to analyze state and make a decision
 * Called when state is unclear after MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE consecutive waits
 */
async function analyzeStateWithClaude(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  workflow: WorkflowExecution | undefined,
  specflowStatus: SpecflowStatus | null
): Promise<DecisionResult> {
  console.log(`[orchestration-runner] State unclear after ${ctx.consecutiveUnclearChecks} checks, spawning Claude analyzer`);

  const prompt = `You are analyzing orchestration state to determine the next action.

## Current Orchestration State
- **Phase**: ${orchestration.currentPhase}
- **Status**: ${orchestration.status}
- **Batch Progress**: ${orchestration.batches.current + 1}/${orchestration.batches.total} batches
- **Current Batch Status**: ${orchestration.batches.items[orchestration.batches.current]?.status ?? 'N/A'}
- **Config**: autoMerge=${orchestration.config.autoMerge}, skipDesign=${orchestration.config.skipDesign}, skipAnalyze=${orchestration.config.skipAnalyze}

## Current Workflow
- **Workflow ID**: ${workflow?.id ?? 'None'}
- **Workflow Status**: ${workflow?.status ?? 'None'}
- **Workflow Skill**: ${workflow?.skill ?? 'None'}

## Specflow Status
\`\`\`json
${JSON.stringify(specflowStatus, null, 2)}
\`\`\`

## Decision History (last 5)
${orchestration.decisionLog.slice(-5).map((d) => `- ${d.decision}: ${d.reason}`).join('\n')}

## Problem
The orchestration has been in "continue/wait" state for ${ctx.consecutiveUnclearChecks} consecutive checks.
This may indicate a stuck state or unclear completion status.

## Your Task
Analyze the state and determine what should happen next:
- **run_design**: Run /flow.design
- **run_analyze**: Run /flow.analyze
- **run_implement**: Run /flow.implement
- **run_verify**: Run /flow.verify
- **run_merge**: Run /flow.merge
- **wait**: Continue waiting (only if you're confident the workflow will complete)
- **stop**: Pause and notify user (ambiguous state needing human review)
- **fail**: Mark as failed (unrecoverable state)

Provide a clear reason for your decision.`;

  try {
    const response = await quickDecision(
      prompt,
      StateAnalyzerDecisionSchema,
      ctx.projectPath,
      {
        maxBudgetUsd: orchestration.config.budget.decisionBudget,
        maxTurns: 3, // Allow a few turns to read files if needed
        tools: ['Read', 'Grep', 'Glob'], // Read-only tools
      }
    );

    if (isClaudeHelperError(response)) {
      console.error(`[orchestration-runner] Claude analyzer failed: ${response.errorMessage}`);
      return {
        action: 'fail',
        reason: `Claude analyzer failed after ${ctx.consecutiveUnclearChecks} unclear checks: ${response.errorMessage}`,
        errorMessage: 'State analysis failed - manual intervention required',
      };
    }

    const decision = response.result;

    // Track cost
    if (response.cost > 0) {
      orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, response.cost);
    }

    // Log Claude decision
    console.log(`[orchestration-runner] Claude analyzer decision: ${decision.action} (${decision.confidence}) - ${decision.reason}`);

    // Map Claude decision to DecisionResult
    return mapClaudeDecision(decision);
  } catch (error) {
    console.error(`[orchestration-runner] Error in Claude analyzer: ${error}`);
    return {
      action: 'fail',
      reason: `Claude analyzer error after ${ctx.consecutiveUnclearChecks} unclear checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errorMessage: 'State analysis error - manual intervention required',
    };
  }
}

/**
 * Map Claude analyzer decision to runner DecisionResult
 */
function mapClaudeDecision(decision: StateAnalyzerDecision): DecisionResult {
  switch (decision.action) {
    case 'run_design':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.design',
      };
    case 'run_analyze':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.analyze',
      };
    case 'run_implement':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: decision.suggestedSkill || 'flow.implement',
      };
    case 'run_verify':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.verify',
      };
    case 'run_merge':
      return {
        action: 'spawn_workflow',
        reason: `[Claude analyzer] ${decision.reason}`,
        skill: 'flow.merge',
      };
    case 'wait':
      return {
        action: 'continue',
        reason: `[Claude analyzer] ${decision.reason}`,
      };
    case 'stop':
      return {
        action: 'wait_merge', // Use wait_merge to pause - user must manually resume
        reason: `[Claude analyzer - PAUSED] ${decision.reason}`,
      };
    case 'fail':
      return {
        action: 'fail',
        reason: `[Claude analyzer] ${decision.reason}`,
        errorMessage: decision.reason,
      };
    default:
      return {
        action: 'continue',
        reason: `[Claude analyzer] Unknown action: ${decision.action}`,
      };
  }
}

interface DecisionResult {
  action: 'continue' | 'spawn_workflow' | 'spawn_batch' | 'heal' | 'wait_merge' | 'needs_attention' | 'complete' | 'fail';
  reason: string;
  skill?: string;
  batchContext?: string;
  errorMessage?: string;
  /** Recovery options when action is 'needs_attention' */
  recoveryOptions?: Array<'retry' | 'skip' | 'abort'>;
  /** Failed workflow ID for recovery context */
  failedWorkflowId?: string;
}

// =============================================================================
// Registry Lookup
// =============================================================================

function getProjectPath(projectId: string): string | null {
  const homeDir = process.env.HOME || '';
  const registryPath = join(homeDir, '.specflow', 'registry.json');

  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content);
    const project = registry.projects?.[projectId];
    return project?.path || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Specflow Status Integration
// =============================================================================

interface SpecflowStatus {
  phase?: {
    number?: number;
    name?: string;
  };
  context?: {
    hasSpec?: boolean;
    hasPlan?: boolean;
    hasTasks?: boolean;
  };
  progress?: {
    tasksTotal?: number;
    tasksComplete?: number;
    percentage?: number;
  };
}

function getSpecflowStatus(projectPath: string): SpecflowStatus | null {
  try {
    const result = execSync('specflow status --json', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// =============================================================================
// State Machine Decision Logic
// =============================================================================

/**
 * Map orchestration phase to skill command
 */
function getSkillForPhase(phase: OrchestrationPhase): string {
  switch (phase) {
    case 'design':
      return 'flow.design';
    case 'analyze':
      return 'flow.analyze';
    case 'implement':
      return 'flow.implement';
    case 'verify':
      return 'flow.verify';
    case 'merge':
      return 'flow.merge';
    default:
      return 'flow.implement';
  }
}

/**
 * Determine if the current phase is complete based on specflow status
 */
function isPhaseComplete(status: SpecflowStatus | null, phase: OrchestrationPhase): boolean {
  if (!status) return false;

  switch (phase) {
    case 'design':
      return status.context?.hasPlan === true && status.context?.hasTasks === true;
    case 'analyze':
      // Analyze doesn't produce artifacts - considered complete after running
      return true;
    case 'implement':
      // All tasks complete
      return (
        status.progress?.tasksComplete === status.progress?.tasksTotal &&
        (status.progress?.tasksTotal ?? 0) > 0
      );
    case 'verify':
      // Verify doesn't change task count - considered complete after running
      return true;
    case 'merge':
      return true;
    case 'complete':
      return true;
    default:
      return false;
  }
}

/**
 * Get the next phase in orchestration flow
 */
function getNextPhase(
  current: OrchestrationPhase,
  config: OrchestrationExecution['config']
): OrchestrationPhase | null {
  const phases: OrchestrationPhase[] = ['design', 'analyze', 'implement', 'verify', 'merge', 'complete'];
  const currentIndex = phases.indexOf(current);

  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }

  let nextIndex = currentIndex + 1;
  let nextPhase = phases[nextIndex];

  // Skip design if configured
  if (nextPhase === 'design' && config.skipDesign) {
    nextIndex++;
    nextPhase = phases[nextIndex];
  }

  // Skip analyze if configured
  if (nextPhase === 'analyze' && config.skipAnalyze) {
    nextIndex++;
    nextPhase = phases[nextIndex];
  }

  return nextPhase || null;
}

/**
 * Make a decision about what to do next
 */
function makeDecision(
  orchestration: OrchestrationExecution,
  workflow: WorkflowExecution | undefined,
  specflowStatus: SpecflowStatus | null
): DecisionResult {
  const { currentPhase, config, batches } = orchestration;

  // Check budget first
  if (orchestration.totalCostUsd >= config.budget.maxTotal) {
    return {
      action: 'fail',
      reason: `Budget exceeded: $${orchestration.totalCostUsd.toFixed(2)} >= $${config.budget.maxTotal}`,
      errorMessage: 'Budget limit exceeded',
    };
  }

  // Check if workflow is still running
  if (workflow && ['running', 'waiting_for_input'].includes(workflow.status)) {
    return {
      action: 'continue',
      reason: `Workflow ${workflow.id} still ${workflow.status}`,
    };
  }

  // Check if workflow failed or was cancelled
  if (workflow && ['failed', 'cancelled'].includes(workflow.status)) {
    // If cancelled by user, don't auto-heal, go to needs_attention
    if (workflow.status === 'cancelled') {
      return {
        action: 'needs_attention',
        reason: `Workflow was cancelled by user`,
        errorMessage: 'Workflow cancelled',
        recoveryOptions: ['retry', 'skip', 'abort'],
        failedWorkflowId: workflow.id,
      };
    }

    // If failed in implement phase, try auto-healing first
    if (currentPhase === 'implement' && config.autoHealEnabled) {
      const currentBatch = batches.items[batches.current];
      if (currentBatch && currentBatch.healAttempts < config.maxHealAttempts) {
        return {
          action: 'heal',
          reason: `Workflow failed, attempting heal (attempt ${currentBatch.healAttempts + 1}/${config.maxHealAttempts})`,
        };
      }
    }

    // Instead of immediately failing, go to needs_attention for user decision
    return {
      action: 'needs_attention',
      reason: `Workflow failed: ${workflow.error}`,
      errorMessage: workflow.error,
      recoveryOptions: ['retry', 'skip', 'abort'],
      failedWorkflowId: workflow.id,
    };
  }

  // Check if current phase is complete
  const phaseComplete = isPhaseComplete(specflowStatus, currentPhase);

  // Handle implement phase batches
  if (currentPhase === 'implement') {
    const allBatchesComplete = batches.items.every(
      (b) => b.status === 'completed' || b.status === 'healed'
    );

    if (allBatchesComplete) {
      // All batches done, move to verify
      const nextPhase = getNextPhase(currentPhase, config);
      if (nextPhase === 'merge' && !config.autoMerge) {
        return {
          action: 'wait_merge',
          reason: 'All batches complete, waiting for user to trigger merge',
        };
      }
      return {
        action: 'spawn_workflow',
        reason: `All batches complete, transitioning to ${nextPhase}`,
        skill: nextPhase ? getSkillForPhase(nextPhase) : undefined,
      };
    }

    // Check if current batch is done
    const currentBatch = batches.items[batches.current];
    if (currentBatch?.status === 'running' && workflow?.status === 'completed') {
      // Mark batch complete and check for more
      return {
        action: 'spawn_batch',
        reason: `Batch ${batches.current + 1} complete, starting next batch`,
      };
    }

    if (currentBatch?.status === 'pending') {
      // Start this batch
      const batchContext = `Execute only the "${currentBatch.section}" section (${currentBatch.taskIds.join(', ')}). Do NOT work on tasks from other sections.`;
      const fullContext = config.additionalContext
        ? `${batchContext}\n\n${config.additionalContext}`
        : batchContext;

      return {
        action: 'spawn_workflow',
        reason: `Starting batch ${batches.current + 1}/${batches.total}: ${currentBatch.section}`,
        skill: `flow.implement ${fullContext}`,
        batchContext: fullContext,
      };
    }
  }

  // For non-implement phases, check if complete and transition
  // CRITICAL: Skip this for implement phase - batch logic above handles transitions
  // CRITICAL: For design phase, require BOTH workflow completion AND artifacts exist
  // This prevents auto-advancing when workflow completes without producing required artifacts
  const workflowComplete = workflow?.status === 'completed';
  const canAdvance = currentPhase === 'analyze'
    ? workflowComplete  // Analyze has no artifacts, workflow completion is enough
    : (phaseComplete && workflowComplete);  // Other phases need artifacts AND workflow done

  if (currentPhase !== 'implement' && canAdvance) {
    const nextPhase = getNextPhase(currentPhase, config);

    if (!nextPhase || nextPhase === 'complete') {
      return {
        action: 'complete',
        reason: 'All phases complete',
      };
    }

    if (nextPhase === 'merge' && !config.autoMerge) {
      return {
        action: 'wait_merge',
        reason: 'Verify complete, waiting for user to trigger merge',
      };
    }

    return {
      action: 'spawn_workflow',
      reason: `Phase ${currentPhase} complete, transitioning to ${nextPhase}`,
      skill: getSkillForPhase(nextPhase),
    };
  }

  // If no workflow exists for current phase, spawn one
  // This handles the case where orchestration was started but no workflow was spawned yet
  if (!workflow) {
    return {
      action: 'spawn_workflow',
      reason: `No workflow found for ${currentPhase} phase, spawning one`,
      skill: getSkillForPhase(currentPhase),
    };
  }

  // Default: continue waiting
  return {
    action: 'continue',
    reason: 'Waiting for current workflow to complete',
  };
}

// =============================================================================
// Orchestration Runner
// =============================================================================

/**
 * Active runners tracked by orchestration ID
 */
const activeRunners = new Map<string, boolean>();

/**
 * Run the orchestration state machine loop
 *
 * This function runs in the background and drives orchestration forward
 * until completion, failure, or cancellation.
 */
export async function runOrchestration(
  projectId: string,
  orchestrationId: string,
  pollingInterval: number = 3000,
  maxPollingAttempts: number = 1000
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) {
    console.error(`[orchestration-runner] Project not found: ${projectId}`);
    return;
  }

  // Prevent duplicate runners
  if (activeRunners.get(orchestrationId)) {
    console.log(`[orchestration-runner] Runner already active for ${orchestrationId}`);
    return;
  }

  activeRunners.set(orchestrationId, true);
  console.log(`[orchestration-runner] Starting runner for ${orchestrationId}`);

  const ctx: RunnerContext = {
    projectId,
    projectPath,
    orchestrationId,
    pollingInterval,
    maxPollingAttempts,
    consecutiveUnclearChecks: 0,
  };

  let attempts = 0;

  try {
    while (attempts < maxPollingAttempts) {
      attempts++;

      // Load current orchestration state
      const orchestration = orchestrationService.get(projectPath, orchestrationId);
      if (!orchestration) {
        console.error(`[orchestration-runner] Orchestration not found: ${orchestrationId}`);
        break;
      }

      // Check for terminal states
      if (['completed', 'failed', 'cancelled'].includes(orchestration.status)) {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} reached terminal state: ${orchestration.status}`);
        break;
      }

      // Check for paused/waiting states
      if (orchestration.status === 'needs_attention') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} needs attention, waiting for user action...`);
        await sleep(ctx.pollingInterval * 2);
        continue;
      }

      if (orchestration.status === 'paused') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} is paused, waiting...`);
        await sleep(ctx.pollingInterval * 2);
        continue;
      }

      if (orchestration.status === 'waiting_merge') {
        console.log(`[orchestration-runner] Orchestration ${orchestrationId} waiting for merge trigger`);
        await sleep(ctx.pollingInterval * 2);
        continue;
      }

      // Get the current workflow (if any)
      // First try the stored workflow ID, then fallback to querying by orchestrationId
      // This provides resilience if the stored ID is stale/wrong
      const currentWorkflowId = getCurrentWorkflowId(orchestration);
      let workflow = currentWorkflowId
        ? workflowService.get(currentWorkflowId, projectId)
        : undefined;

      // Fallback: if stored ID didn't find a workflow, check for any active workflows
      // linked to this orchestration (handles race conditions and cancelled workflows)
      if (!workflow || !['running', 'waiting_for_input'].includes(workflow.status)) {
        const activeWorkflows = workflowService.findActiveByOrchestration(projectId, orchestrationId);
        if (activeWorkflows.length > 0) {
          workflow = activeWorkflows[0];
          console.log(`[orchestration-runner] Found active workflow via orchestration link: ${workflow.id}`);
        }
      }

      // Get specflow status
      const specflowStatus = getSpecflowStatus(projectPath);

      // Make decision
      let decision = makeDecision(orchestration, workflow, specflowStatus);

      // Track consecutive "continue" (unclear/waiting) decisions
      if (decision.action === 'continue') {
        ctx.consecutiveUnclearChecks++;

        // After MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE consecutive waits, spawn Claude analyzer
        if (ctx.consecutiveUnclearChecks >= MAX_UNCLEAR_CHECKS_BEFORE_CLAUDE) {
          decision = await analyzeStateWithClaude(ctx, orchestration, workflow, specflowStatus);
          ctx.consecutiveUnclearChecks = 0; // Reset counter after Claude analysis
        }
      } else {
        // Reset counter on any non-continue decision
        ctx.consecutiveUnclearChecks = 0;
      }

      // Log decision
      logDecision(ctx, orchestration, decision);

      // Execute decision
      await executeDecision(ctx, orchestration, decision, workflow);

      // Wait before next poll
      await sleep(ctx.pollingInterval);
    }

    if (attempts >= maxPollingAttempts) {
      console.error(`[orchestration-runner] Max polling attempts reached for ${orchestrationId}`);
      orchestrationService.fail(projectPath, orchestrationId, 'Max polling attempts exceeded');
    }
  } catch (error) {
    console.error(`[orchestration-runner] Error in runner: ${error}`);
    orchestrationService.fail(
      projectPath,
      orchestrationId,
      error instanceof Error ? error.message : 'Unknown error in orchestration runner'
    );
  } finally {
    activeRunners.delete(orchestrationId);
    console.log(`[orchestration-runner] Runner stopped for ${orchestrationId}`);
  }
}

/**
 * Get the current workflow execution ID from orchestration state
 */
function getCurrentWorkflowId(orchestration: OrchestrationExecution): string | undefined {
  const { currentPhase, batches, executions } = orchestration;

  switch (currentPhase) {
    case 'design':
      return executions.design;
    case 'analyze':
      return executions.analyze;
    case 'implement':
      const currentBatch = batches.items[batches.current];
      return currentBatch?.workflowExecutionId;
    case 'verify':
      return executions.verify;
    case 'merge':
      return executions.merge;
    default:
      return undefined;
  }
}

/**
 * Log a decision to the orchestration state
 */
function logDecision(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  decision: DecisionResult
): void {
  // Add to orchestration decision log
  orchestration.decisionLog.push({
    timestamp: new Date().toISOString(),
    decision: decision.action,
    reason: decision.reason,
    data: {
      currentPhase: orchestration.currentPhase,
      batchIndex: orchestration.batches.current,
      skill: decision.skill,
    },
  });

  // Console log for debugging
  console.log(
    `[orchestration-runner] Decision: ${decision.action} - ${decision.reason}`
  );
}

/**
 * Execute a decision
 */
async function executeDecision(
  ctx: RunnerContext,
  orchestration: OrchestrationExecution,
  decision: DecisionResult,
  currentWorkflow: WorkflowExecution | undefined
): Promise<void> {
  switch (decision.action) {
    case 'continue':
      // Nothing to do, just wait
      break;

    case 'spawn_workflow': {
      if (!decision.skill) {
        console.error('[orchestration-runner] No skill specified for spawn_workflow');
        return;
      }

      // QUEUE CHECK: Don't spawn if there's already an active workflow for this orchestration
      if (workflowService.hasActiveWorkflow(ctx.projectId, ctx.orchestrationId)) {
        console.log(`[orchestration-runner] Workflow already active for orchestration ${ctx.orchestrationId}, skipping spawn`);
        return;
      }

      // Transition to next phase if needed
      const nextPhase = getNextPhaseFromSkill(decision.skill);

      // GUARD: Never transition OUT of implement phase while batches are incomplete
      // This prevents Claude analyzer or other decisions from prematurely jumping to verify/merge
      const allBatchesComplete = orchestration.batches.items.every(
        (b) => b.status === 'completed' || b.status === 'healed'
      );
      if (orchestration.currentPhase === 'implement' && nextPhase !== 'implement' && !allBatchesComplete) {
        console.log(`[orchestration-runner] BLOCKED: Cannot transition from implement to ${nextPhase} - batches incomplete (${orchestration.batches.items.filter(b => b.status === 'completed' || b.status === 'healed').length}/${orchestration.batches.total})`);
        return;
      }

      if (nextPhase && nextPhase !== orchestration.currentPhase) {
        // Before transitioning to implement, ensure batches are populated
        // This handles the case when phase was opened during this orchestration
        if (nextPhase === 'implement' && orchestration.batches.total === 0) {
          const batchPlan = parseBatchesFromProject(ctx.projectPath, orchestration.config.batchSizeFallback);
          if (batchPlan && batchPlan.totalIncomplete > 0) {
            orchestrationService.updateBatches(ctx.projectPath, ctx.orchestrationId, batchPlan);
            console.log(`[orchestration-runner] Populated batches: ${batchPlan.batches.length} batches, ${batchPlan.totalIncomplete} tasks`);
          } else {
            console.error('[orchestration-runner] No tasks found after design phase');
            orchestrationService.fail(ctx.projectPath, ctx.orchestrationId, 'No tasks found after design phase completed');
            return;
          }
        }

        orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      }

      // Spawn the workflow with orchestrationId for proper linking
      const workflow = await workflowService.start(
        ctx.projectId,
        decision.skill,
        undefined, // default timeout
        undefined, // no resume session
        ctx.orchestrationId // link to this orchestration
      );

      // Also store in orchestration for backwards compatibility
      orchestrationService.linkWorkflowExecution(ctx.projectPath, ctx.orchestrationId, workflow.id);

      // Track cost
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      console.log(`[orchestration-runner] Spawned workflow ${workflow.id} for ${decision.skill} (linked to orchestration ${ctx.orchestrationId})`);
      break;
    }

    case 'spawn_batch': {
      // QUEUE CHECK: Don't spawn if there's already an active workflow for this orchestration
      if (workflowService.hasActiveWorkflow(ctx.projectId, ctx.orchestrationId)) {
        console.log(`[orchestration-runner] Workflow already active for orchestration ${ctx.orchestrationId}, skipping batch spawn`);
        return;
      }

      // Complete current batch
      orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);

      // Track cost from previous workflow
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Reload orchestration to get updated batch index
      const updatedOrchestration = orchestrationService.get(ctx.projectPath, ctx.orchestrationId);
      if (!updatedOrchestration) return;

      // Check if more batches
      const nextBatch = updatedOrchestration.batches.items[updatedOrchestration.batches.current];
      if (nextBatch && nextBatch.status === 'pending') {
        // Check for pause between batches
        if (updatedOrchestration.config.pauseBetweenBatches) {
          orchestrationService.pause(ctx.projectPath, ctx.orchestrationId);
          console.log(`[orchestration-runner] Paused between batches (configured)`);
        } else {
          // Build batch context
          const batchContext = `Execute only the "${nextBatch.section}" section (${nextBatch.taskIds.join(', ')}). Do NOT work on tasks from other sections.`;
          const fullContext = updatedOrchestration.config.additionalContext
            ? `${batchContext}\n\n${updatedOrchestration.config.additionalContext}`
            : batchContext;

          // Spawn next batch with orchestrationId
          const workflow = await workflowService.start(
            ctx.projectId,
            `flow.implement ${fullContext}`,
            undefined,
            undefined,
            ctx.orchestrationId
          );
          orchestrationService.linkWorkflowExecution(ctx.projectPath, ctx.orchestrationId, workflow.id);
          console.log(`[orchestration-runner] Spawned batch ${updatedOrchestration.batches.current + 1}/${updatedOrchestration.batches.total} (linked to orchestration ${ctx.orchestrationId})`);
        }
      }
      break;
    }

    case 'heal': {
      const batch = orchestration.batches.items[orchestration.batches.current];
      if (!batch) {
        console.error('[orchestration-runner] No current batch to heal');
        return;
      }

      // Increment heal attempt
      orchestrationService.incrementHealAttempt(ctx.projectPath, ctx.orchestrationId);

      // Attempt healing
      const healResult = await attemptHeal(
        ctx.projectPath,
        batch.workflowExecutionId || '',
        batch.section,
        batch.taskIds,
        currentWorkflow?.sessionId,
        orchestration.config.budget.healingBudget
      );

      // Track healing cost
      orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, healResult.cost);

      console.log(`[orchestration-runner] Heal result: ${getHealingSummary(healResult)}`);

      if (healResult.success && healResult.result?.status === 'fixed') {
        // Healing successful - mark batch as healed and continue
        orchestrationService.healBatch(
          ctx.projectPath,
          ctx.orchestrationId,
          healResult.sessionId || ''
        );
        orchestrationService.completeBatch(ctx.projectPath, ctx.orchestrationId);
      } else {
        // Healing failed
        const canRetry = orchestrationService.canHealBatch(ctx.projectPath, ctx.orchestrationId);
        if (!canRetry) {
          orchestrationService.fail(
            ctx.projectPath,
            ctx.orchestrationId,
            `Batch healing failed after max attempts: ${healResult.errorMessage || 'Unknown error'}`
          );
        }
      }
      break;
    }

    case 'wait_merge': {
      // Track cost from verify workflow
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Transition to merge phase but in waiting status
      orchestrationService.transitionToNextPhase(ctx.projectPath, ctx.orchestrationId);
      console.log(`[orchestration-runner] Waiting for user to trigger merge`);
      break;
    }

    case 'complete': {
      // Track final cost
      if (currentWorkflow?.costUsd) {
        orchestrationService.addCost(ctx.projectPath, ctx.orchestrationId, currentWorkflow.costUsd);
      }

      // Mark complete
      const finalOrchestration = orchestrationService.get(ctx.projectPath, ctx.orchestrationId);
      if (finalOrchestration) {
        finalOrchestration.status = 'completed';
        finalOrchestration.completedAt = new Date().toISOString();
        finalOrchestration.decisionLog.push({
          timestamp: new Date().toISOString(),
          decision: 'complete',
          reason: 'All phases completed successfully',
        });
      }
      console.log(`[orchestration-runner] Orchestration complete!`);
      break;
    }

    case 'needs_attention': {
      // Set orchestration to needs_attention instead of failing
      // This allows the user to decide what to do (retry, skip, abort)
      orchestrationService.setNeedsAttention(
        ctx.projectPath,
        ctx.orchestrationId,
        decision.errorMessage || 'Unknown issue',
        decision.recoveryOptions || ['retry', 'abort'],
        decision.failedWorkflowId
      );
      console.log(`[orchestration-runner] Orchestration needs attention: ${decision.errorMessage}`);
      break;
    }

    case 'fail': {
      orchestrationService.fail(ctx.projectPath, ctx.orchestrationId, decision.errorMessage || 'Unknown error');
      console.error(`[orchestration-runner] Orchestration failed: ${decision.errorMessage}`);
      break;
    }
  }
}

/**
 * Get phase from skill name
 */
function getNextPhaseFromSkill(skill: string): OrchestrationPhase | null {
  const skillName = skill.split(' ')[0].replace('flow.', '');
  const phaseMap: Record<string, OrchestrationPhase> = {
    design: 'design',
    analyze: 'analyze',
    implement: 'implement',
    verify: 'verify',
    merge: 'merge',
  };
  return phaseMap[skillName] || null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Resume/Merge Trigger Helpers
// =============================================================================

/**
 * Resume orchestration from paused state
 * This restarts the runner loop
 */
export async function resumeOrchestration(
  projectId: string,
  orchestrationId: string
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) return;

  // Resume via orchestration service
  orchestrationService.resume(projectPath, orchestrationId);

  // Restart the runner
  runOrchestration(projectId, orchestrationId).catch(console.error);
}

/**
 * Trigger merge workflow
 * Called when user approves merge from waiting_merge state
 */
export async function triggerMerge(
  projectId: string,
  orchestrationId: string
): Promise<void> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) return;

  // Update status via orchestration service
  orchestrationService.triggerMerge(projectPath, orchestrationId);

  // Spawn merge workflow
  const workflow = await workflowService.start(projectId, 'flow.merge');
  orchestrationService.linkWorkflowExecution(projectPath, orchestrationId, workflow.id);

  // Restart the runner to handle merge completion
  runOrchestration(projectId, orchestrationId).catch(console.error);
}

/**
 * Check if a runner is active for an orchestration
 */
export function isRunnerActive(orchestrationId: string): boolean {
  return activeRunners.get(orchestrationId) === true;
}

/**
 * Stop a runner (for cleanup)
 */
export function stopRunner(orchestrationId: string): void {
  activeRunners.delete(orchestrationId);
}
