# Orchestration Simplification Plan

## Problem Statement

The dashboard orchestration-runner (1,412 lines) reimplements /flow.orchestrate logic poorly:

1. `isPhaseComplete()` checks artifacts instead of trusting `step.status`
2. Question flow is broken (watcher detects questions but data never reaches UI - needs verification)
3. No recovery path when things go wrong
4. 2,343 lines of redundant code between runner and service
5. Race conditions in workflow spawning and state file access
6. Batch handling logic scattered and incomplete
7. No detection of sessions started/resumed from external Claude CLI
8. Dashboard and CLI should work identically - terminal is just manual orchestration

## The Fix

Trust the state file. Sub-commands set `step.status=complete` when done. The runner just:
1. Reads state (with atomic file access)
2. Validates state consistency
3. Spawns workflows (with spawn intent pattern to prevent races)
4. Transitions when `step.status=complete`
5. Uses Claude Helper for exactly 3 recovery scenarios
6. Tracks ALL session activity (dashboard workflows, omnibox commands, external CLI)

## Key Alignment Decisions

| Topic | Decision |
|-------|----------|
| Auto-merge | Fully automatic when `autoMerge=true` (no confirmation prompt) |
| Question flow | Needs testing to verify watcher detection works |
| Claude Helper failures | Silent fallback (don't clutter UI with failure details) |
| Race fixes | Must-have for this phase |
| Stale threshold | 10 minutes fixed |
| Batch pause/resume | Existing pause→play button, also omnibox resume |
| Code size | Focus on simplicity, not line count |
| External CLI | Watch `~/.claude/projects/{hash}/` for JSONL creation AND modification |
| Decision log | Wire up correctly in UI, make improvements if needed |
| Testing | Both unit tests AND integration tests |
| Features | Keep cost tracking, heal attempts - improve implementation, don't neuter |

---

## State Files Overview

There are TWO state files that must stay consistent:

| File | Schema | Purpose |
|------|--------|---------|
| `.specflow/orchestration-state.json` | `OrchestrationStateSchema` | Project-level: phase, step, progress |
| `.specflow/workflows/orchestration-{id}.json` | `OrchestrationExecutionSchema` | Per-run: batches, costs, decision log |

**Invariants that must hold:**
- `step.index === STEP_INDEX_MAP[step.current]`
- `OrchestrationState.phase.number === OrchestrationExecution.currentPhase` (when linked)
- `batches.current < batches.total` (unless all complete)
- `recoveryContext` must exist when `status === 'needs_attention'`

---

## Core Decision Loop

```typescript
async function runOrchestrationLoop(orchestrationId: string, projectId: string) {
  // Persist runner state to survive dashboard restarts
  await persistRunnerState(orchestrationId, { startedAt: Date.now(), pid: process.pid });

  while (true) {
    // ═══════════════════════════════════════════════════════════════════
    // 1. READ STATE (with atomic access)
    // ═══════════════════════════════════════════════════════════════════
    let state: OrchestrationState;
    try {
      state = await readOrchestrationState(projectPath); // Uses file locking
    } catch (error) {
      // CORRUPT/MISSING STATE: Use Claude Helper to rebuild
      await createStateBackup(projectPath); // .bak before any recovery
      state = await recoverStateWithClaudeHelper(projectPath, error);
      if (!state) {
        await setOrchestrationStatus('failed', 'Could not recover state');
        break;
      }
    }

    const { step, phase } = state.orchestration;
    const execution = await readOrchestrationExecution(orchestrationId);

    // ═══════════════════════════════════════════════════════════════════
    // 2. PRE-DECISION GATES (checked before decision matrix)
    // ═══════════════════════════════════════════════════════════════════

    // Budget gate
    if (execution.totalCostUsd >= execution.config.budget.maxTotal) {
      await setOrchestrationStatus('failed', `Budget exceeded: $${execution.totalCostUsd.toFixed(2)}`);
      break;
    }

    // Duration gate (4 hour max)
    const duration = Date.now() - new Date(execution.startedAt).getTime();
    if (duration > MAX_ORCHESTRATION_DURATION_MS) {
      await setOrchestrationStatus('needs_attention', 'Orchestration running too long');
      break;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. VALIDATE STATE CONSISTENCY
    // ═══════════════════════════════════════════════════════════════════
    const validation = validateState(state, execution);
    if (!validation.valid) {
      const fixed = await fixStateWithClaudeHelper(projectPath, state, validation.issues);
      if (!fixed) {
        await setOrchestrationStatus('needs_attention', validation.issues.join(', '));
        await sleep(POLL_INTERVAL);
        continue;
      }
      state = fixed;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. CHECK TERMINAL CONDITIONS
    // ═══════════════════════════════════════════════════════════════════
    if (execution.status === 'completed') break;
    if (execution.status === 'cancelled') break;
    if (execution.status === 'paused') {
      await sleep(POLL_INTERVAL);
      continue;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. MAKE DECISION (complete matrix, no ambiguity)
    // ═══════════════════════════════════════════════════════════════════
    const decision = makeDecision(step, phase, execution);

    // ═══════════════════════════════════════════════════════════════════
    // 6. EXECUTE DECISION
    // ═══════════════════════════════════════════════════════════════════
    await executeDecision(decision, orchestrationId, projectId);

    // ═══════════════════════════════════════════════════════════════════
    // 7. WAIT FOR EVENT OR TIMEOUT
    // ═══════════════════════════════════════════════════════════════════
    await waitForEventOrTimeout(orchestrationId, POLL_INTERVAL);
  }

  // Cleanup runner state
  await clearRunnerState(orchestrationId);
}
```

---

## Decision Matrix

This is the COMPLETE decision logic. Every possible state combination has an explicit action.

```typescript
const STEP_INDEX_MAP = { design: 0, analyze: 1, implement: 2, verify: 3, merge: 4 };
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (increased from 5)

function makeDecision(step: Step, phase: Phase, execution: OrchestrationExecution): Decision {
  const { current, status } = step;
  const workflow = getActiveWorkflow(execution);
  const config = execution.config;

  // ═══════════════════════════════════════════════════════════════════
  // IMPLEMENT PHASE: BATCH HANDLING (checked first)
  // ═══════════════════════════════════════════════════════════════════
  if (current === 'implement') {
    const batchDecision = handleImplementBatching(step, execution, workflow);
    if (batchDecision) return batchDecision;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW IS RUNNING
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'running') {
    const lastActivity = getLastFileChangeTime(projectPath);
    const staleDuration = Date.now() - lastActivity;

    if (staleDuration > STALE_THRESHOLD_MS) {
      return {
        action: 'recover_stale',
        reason: `No activity for ${Math.round(staleDuration / 60000)} minutes`,
        workflowId: workflow.id
      };
    }

    return { action: 'wait', reason: 'Workflow running' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW NEEDS INPUT
  // ═══════════════════════════════════════════════════════════════════
  if (workflow?.status === 'waiting_for_input') {
    return { action: 'wait', reason: 'Waiting for user input' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW ID EXISTS BUT LOOKUP FAILS
  // ═══════════════════════════════════════════════════════════════════
  if (execution.executions[current] && !workflow) {
    // Workflow ID in state but can't find workflow - wait with backoff
    return {
      action: 'wait_with_backoff',
      reason: `Workflow ${execution.executions[current]} lookup failed, waiting...`,
      backoffMs: calculateExponentialBackoff(execution.lookupFailures || 0)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP IS COMPLETE - DETERMINE NEXT ACTION
  // ═══════════════════════════════════════════════════════════════════
  if (status === 'complete') {
    const nextStep = getNextStep(current);

    // All steps done (after merge completes)
    if (nextStep === null) {
      return { action: 'complete', reason: 'All steps finished' };
    }

    // Verify complete → check USER_GATE before merge
    if (current === 'verify' && nextStep === 'merge') {
      // USER_GATE requires explicit confirmation
      if (phase.hasUserGate && phase.userGateStatus !== 'confirmed') {
        return { action: 'wait_user_gate', reason: 'USER_GATE requires confirmation' };
      }
      // autoMerge disabled → wait for user to trigger
      if (!config.autoMerge) {
        return { action: 'wait_merge', reason: 'Auto-merge disabled, waiting for user' };
      }
      // autoMerge enabled → transition to merge step
      return {
        action: 'transition',
        nextStep: 'merge',
        nextIndex: STEP_INDEX_MAP.merge,
        reason: 'Verify complete, auto-merge enabled'
      };
    }

    // Normal step transition
    return {
      action: 'transition',
      nextStep,
      nextIndex: STEP_INDEX_MAP[nextStep],
      reason: `${current} complete, advancing to ${nextStep}`
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP FAILED OR BLOCKED
  // ═══════════════════════════════════════════════════════════════════
  if (status === 'failed' || status === 'blocked') {
    return {
      action: 'recover_failed',
      reason: `Step ${current} is ${status}`,
      error: step.error
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP IN PROGRESS BUT NO WORKFLOW
  // ═══════════════════════════════════════════════════════════════════
  if (status === 'in_progress' && !workflow) {
    return { action: 'spawn', skill: getSkillForStep(current) };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP NOT STARTED - SPAWN WORKFLOW
  // ═══════════════════════════════════════════════════════════════════
  if (status === 'not_started' || status === null || status === undefined) {
    // Initialize batches when entering implement
    if (current === 'implement' && execution.batches.total === 0) {
      return { action: 'initialize_batches', reason: 'Entering implement, need to populate batches' };
    }
    return { action: 'spawn', skill: getSkillForStep(current) };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UNKNOWN STATUS - BUG, USE CLAUDE HELPER
  // ═══════════════════════════════════════════════════════════════════
  console.error(`Unknown step.status: ${status}`);
  return {
    action: 'recover_unknown',
    reason: `Unknown status: ${status}`
  };
}
```

---

## Implement Phase: Batch Handling

Batching has its own state machine within the implement phase:

```typescript
function handleImplementBatching(
  step: Step,
  execution: OrchestrationExecution,
  workflow: Workflow | null
): Decision | null {
  const { batches, config } = execution;

  // No batches yet - need to initialize
  if (batches.total === 0) {
    return { action: 'initialize_batches', reason: 'No batches populated' };
  }

  const currentBatch = batches.items[batches.current];
  const allBatchesComplete = batches.items.every(
    b => b.status === 'completed' || b.status === 'healed'
  );

  // All batches done → step is complete
  if (allBatchesComplete) {
    // Trust sub-command to set step.status=complete
    // But if it didn't, force it
    if (step.status !== 'complete') {
      return { action: 'force_step_complete', reason: 'All batches complete but step.status not updated' };
    }
    return null; // Let normal decision matrix handle transition
  }

  // Current batch running with active workflow → wait
  if (currentBatch?.status === 'running' && workflow?.status === 'running') {
    return null; // Let normal staleness check handle this
  }

  // Current batch completed → advance to next batch
  if (currentBatch?.status === 'completed' || currentBatch?.status === 'healed') {
    // Check pauseBetweenBatches config
    if (config.pauseBetweenBatches) {
      return { action: 'pause', reason: 'Batch complete, pauseBetweenBatches enabled' };
    }

    const nextBatchIndex = batches.current + 1;
    if (nextBatchIndex < batches.total) {
      return {
        action: 'advance_batch',
        batchIndex: nextBatchIndex,
        reason: `Batch ${batches.current} complete, advancing to batch ${nextBatchIndex}`
      };
    }
  }

  // Current batch pending + no workflow → spawn batch
  if (currentBatch?.status === 'pending' && !workflow) {
    return {
      action: 'spawn_batch',
      batch: currentBatch,
      skill: 'flow.implement',
      context: `Execute tasks ${currentBatch.taskIds.join(', ')} in section "${currentBatch.section}"`
    };
  }

  // Current batch failed → try healing
  if (currentBatch?.status === 'failed') {
    if (config.autoHealEnabled && currentBatch.healAttempts < config.maxHealAttempts) {
      return { action: 'heal_batch', batchIndex: batches.current, reason: 'Batch failed, attempting heal' };
    }
    return {
      action: 'recover_failed',
      reason: `Batch ${batches.current} failed after ${currentBatch.healAttempts} heal attempts`,
      error: currentBatch.error
    };
  }

  return null; // No batch-specific decision, use normal matrix
}
```

---

## Execute Decision

Each decision action has a specific handler:

```typescript
async function executeDecision(decision: Decision, orchestrationId: string, projectId: string) {
  // Log every decision for debugging
  await logDecision(orchestrationId, decision);

  switch (decision.action) {
    case 'wait':
      // Do nothing, loop will sleep
      break;

    case 'wait_with_backoff':
      await incrementLookupFailures(orchestrationId);
      await sleep(decision.backoffMs);
      break;

    case 'transition':
      await transitionToStep(decision.nextStep, decision.nextIndex);
      await spawnWorkflowWithIntent(getSkillForStep(decision.nextStep)); // Atomic spawn
      break;

    case 'spawn':
      await spawnWorkflowWithIntent(decision.skill); // Uses spawn intent pattern
      break;

    case 'spawn_batch':
      await linkBatchToWorkflow(decision.batch.index);
      await spawnWorkflowWithIntent(decision.skill, decision.context);
      break;

    case 'advance_batch':
      await advanceBatchIndex(decision.batchIndex);
      // Next iteration will spawn the batch
      break;

    case 'initialize_batches':
      const batches = parseBatchesFromProject(projectPath, config.batchSizeFallback);
      await setBatches(orchestrationId, batches);
      break;

    case 'force_step_complete':
      await setStepStatus('complete');
      break;

    case 'heal_batch':
      await incrementBatchHealAttempts(decision.batchIndex);
      await spawnHealerWorkflow(decision.batchIndex);
      break;

    case 'pause':
      await setOrchestrationStatus('paused');
      break;

    case 'wait_merge':
      await setOrchestrationStatus('waiting_merge');
      break;

    case 'wait_user_gate':
      await setOrchestrationStatus('waiting_user_gate');
      break;

    case 'complete':
      await setOrchestrationStatus('completed');
      break;

    case 'recover_stale':
      await handleStaleWorkflow(decision.workflowId);
      break;

    case 'recover_failed':
      await handleFailedStep(decision.error);
      break;

    case 'recover_unknown':
      await handleUnknownState(decision.reason);
      break;
  }
}
```

---

## Atomic Workflow Spawning

Prevent race conditions with spawn intent pattern:

```typescript
async function spawnWorkflowWithIntent(skill: string, context?: string): Promise<void> {
  const intentKey = `spawn_intent_${orchestrationId}`;

  // 1. Check if spawn already in progress
  const existingIntent = await getSpawnIntent(intentKey);
  if (existingIntent && Date.now() - existingIntent.timestamp < 30000) {
    console.log('Spawn already in progress, skipping');
    return;
  }

  // 2. Check if workflow already active
  if (workflowService.hasActiveWorkflow(projectId, orchestrationId)) {
    console.log('Workflow already active, skipping spawn');
    return;
  }

  // 3. Write spawn intent BEFORE spawning
  await setSpawnIntent(intentKey, { skill, timestamp: Date.now() });

  try {
    // 4. Actually spawn
    await workflowService.start({ projectId, skill, orchestrationId, context });
  } finally {
    // 5. Clear intent regardless of success/failure
    await clearSpawnIntent(intentKey);
  }
}
```

---

## Claude Helper: Specific Use Cases

Claude Helper is used for THREE specific scenarios only. Each has a defined contract and fallback.

### 1. Recover Corrupt/Missing State File

**When**: `readOrchestrationState()` throws an error

**Fallback Chain**:
1. Try Claude Helper → if success + confidence > 0.7 → use recovered state
2. If Claude Helper fails → try heuristic recovery (read ROADMAP.md, git branch)
3. If heuristic fails → return null → escalate to `needs_attention`

**Always**: Create `.bak` backup BEFORE any recovery attempt

```typescript
async function recoverStateWithClaudeHelper(projectPath: string, error: Error): Promise<OrchestrationState | null> {
  // Always backup first
  await createStateBackup(projectPath);

  const availableFiles = await scanProjectFiles(projectPath);

  try {
    const result = await claudeHelper.ask({
      task: 'recover_state',
      context: { projectPath, error: error.message, availableFiles },
      model: 'sonnet',
      tools: ['Read', 'Grep', 'Glob'],
      maxTurns: 5,
      maxBudgetUsd: 1.0,
      responseSchema: RecoverStateResponseSchema,
    });

    if (result.recoverable && result.confidence > 0.7) {
      await writeOrchestrationState(result.state);
      logDecision('state_recovered', { confidence: result.confidence, reasoning: result.reasoning });
      return result.state;
    }

    logDecision('state_low_confidence', { confidence: result.confidence, reasoning: result.reasoning });
  } catch (e) {
    console.error('Claude Helper failed for state recovery:', e);
  }

  // FALLBACK: Heuristic recovery
  const heuristicState = await tryHeuristicStateRecovery(projectPath);
  if (heuristicState) {
    logDecision('state_heuristic_recovered', { method: 'roadmap_git_branch' });
    return heuristicState;
  }

  return null; // Caller will escalate to needs_attention
}
```

### 2. Recover Stale Workflow

**When**: Workflow `status === 'running'` but no file changes for > 10 minutes

**Fallback**: If Claude Helper fails → conservative action: `needs_attention`

```typescript
async function handleStaleWorkflow(workflowId: string) {
  const workflow = await getWorkflow(workflowId);
  const lastMessages = await getLastSessionMessages(workflow.sessionId, 10);
  const staleDuration = Date.now() - new Date(workflow.lastActivityAt).getTime();

  try {
    const result = await claudeHelper.ask({
      task: 'diagnose_stale_workflow',
      context: {
        workflowId,
        sessionId: workflow.sessionId,
        lastActivity: workflow.lastActivityAt,
        staleDuration,
        lastMessages,
        currentStep: orchestration.step.current,
        currentTask: orchestration.implement?.currentTask
      },
      model: 'haiku', // Quick decision
      tools: ['Read'],
      maxTurns: 3,
      maxBudgetUsd: 0.5,
      responseSchema: DiagnoseStaleResponseSchema,
    });

    switch (result.action) {
      case 'continue':
        logDecision('stale_false_alarm', { reasoning: result.reasoning });
        break;

      case 'restart_task':
        await killWorkflow(workflowId);
        await spawnWorkflowWithIntent('flow.implement');
        logDecision('stale_restart', { reasoning: result.reasoning });
        break;

      case 'skip_task':
        await killWorkflow(workflowId);
        await markTaskBlocked(orchestration.implement.currentTask, result.blockReason);
        await spawnWorkflowWithIntent('flow.implement');
        logDecision('stale_skip', { task: orchestration.implement.currentTask, reason: result.blockReason });
        break;

      case 'abort':
        await killWorkflow(workflowId);
        await setOrchestrationStatus('needs_attention', result.reasoning);
        logDecision('stale_abort', { reasoning: result.reasoning });
        break;
    }
  } catch (e) {
    console.error('Claude Helper failed for stale diagnosis:', e);
    // FALLBACK: Conservative - notify user
    await setOrchestrationStatus('needs_attention',
      `Workflow appears stale for ${Math.round(staleDuration / 60000)} minutes - diagnosis failed`);
  }
}
```

### 3. Recover Failed Step

**When**: `step.status === 'failed'` or `step.status === 'blocked'`

**Pre-check**: If max heal attempts reached, skip Claude Helper and go straight to `needs_attention`

**Fallback**: If Claude Helper fails → simple retry if within limits → else `needs_attention`

```typescript
async function handleFailedStep(error: string) {
  const step = orchestration.step;

  // Pre-check: Max attempts already reached?
  if (execution.healAttempts >= execution.config.maxHealAttempts) {
    await setOrchestrationStatus('needs_attention', `Max heal attempts (${execution.config.maxHealAttempts}) reached`);
    return;
  }

  const workflow = getLastWorkflowForStep(step.current);

  try {
    const result = await claudeHelper.ask({
      task: 'diagnose_failed_step',
      context: {
        step: step.current,
        status: step.status,
        error,
        lastWorkflowOutput: workflow?.output,
        failedTasks: execution.implement?.failedTasks || [],
        passedTasks: execution.implement?.passedTasks || [],
        healAttempts: execution.healAttempts || 0,
        maxHealAttempts: execution.config.maxHealAttempts
      },
      model: 'sonnet',
      tools: ['Read', 'Grep', 'Glob'],
      maxTurns: 5,
      maxBudgetUsd: 1.0,
      responseSchema: DiagnoseFailedResponseSchema,
    });

    switch (result.action) {
      case 'retry':
        await incrementHealAttempts();
        await setStepStatus('in_progress');
        await spawnWorkflowWithIntent(getSkillForStep(step.current));
        logDecision('failed_retry', { attempt: execution.healAttempts + 1, reasoning: result.reasoning });
        break;

      case 'skip_tasks':
        for (const taskId of result.tasksToSkip || []) {
          await markTaskBlocked(taskId, result.reasoning);
        }
        await setStepStatus('in_progress');
        await spawnWorkflowWithIntent('flow.implement');
        logDecision('failed_skip_tasks', { tasks: result.tasksToSkip, reasoning: result.reasoning });
        break;

      case 'run_prerequisite':
        await transitionToStep(result.prerequisiteStep, STEP_INDEX_MAP[result.prerequisiteStep]);
        await spawnWorkflowWithIntent(getSkillForStep(result.prerequisiteStep));
        logDecision('failed_prerequisite', { step: result.prerequisiteStep, reasoning: result.reasoning });
        break;

      case 'abort':
        await setOrchestrationStatus('needs_attention', result.reasoning);
        logDecision('failed_abort', { reasoning: result.reasoning });
        break;
    }
  } catch (e) {
    console.error('Claude Helper failed for failure diagnosis:', e);
    // FALLBACK: Simple retry if within limits
    if (execution.healAttempts < execution.config.maxHealAttempts) {
      await incrementHealAttempts();
      await setStepStatus('in_progress');
      await spawnWorkflowWithIntent(getSkillForStep(step.current));
      logDecision('failed_fallback_retry', { reason: 'Claude Helper unavailable, attempting simple retry' });
    } else {
      await setOrchestrationStatus('needs_attention', error);
    }
  }
}
```

---

## Question Flow (Fixed)

### The Problem

The watcher CORRECTLY detects questions from JSONL. The SSE event is broadcast. But:
1. `use-sse.ts` receives `session:question` and DROPS IT (does nothing)
2. `page.tsx` has hardcoded `decisionQuestions = []`

### The Fix (Data Plumbing)

**use-sse.ts** - Add state and handler:
```typescript
// Add to hook state
const [sessionQuestions, setSessionQuestions] = useState<Map<string, SessionQuestion[]>>(new Map());

// In event handler switch:
case 'session:question':
  setSessionQuestions((prev) => {
    const next = new Map(prev);
    next.set(data.sessionId, data.data.questions);
    return next;
  });
  break;

// Return in hook result
return { ..., sessionQuestions };
```

**unified-data-context.tsx** - Export questions:
```typescript
// Add to context value
<UnifiedDataContext.Provider value={{ ..., sessionQuestions }}>
```

**page.tsx** - Replace hardcoded array:
```typescript
// Before (BROKEN):
const decisionQuestions = useMemo(() => {
  return [] as Array<...>  // HARDCODED EMPTY
}, []);

// After (FIXED):
const { sessionQuestions } = useUnifiedData();
const decisionQuestions = useMemo(() => {
  if (!consoleSessionId) return [];
  return sessionQuestions.get(consoleSessionId) ?? [];
}, [consoleSessionId, sessionQuestions]);

// Clear questions after answer
async function handleDecisionAnswer(answers: Record<string, string>) {
  await submitAnswers(workflowId, answers);
  setSessionQuestions((prev) => {
    const next = new Map(prev);
    next.delete(consoleSessionId);
    return next;
  });
}
```

---

## State Validation

Validate BOTH state files and their consistency:

```typescript
const STEP_INDEX_MAP = { design: 0, analyze: 1, implement: 2, verify: 3, merge: 4 };
const VALID_STEPS = ['design', 'analyze', 'implement', 'verify', 'merge'];
const VALID_STATUSES = ['not_started', 'pending', 'in_progress', 'complete', 'failed', 'blocked', 'skipped'];

function validateState(state: OrchestrationState, execution: OrchestrationExecution): ValidationResult {
  const issues: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // ORCHESTRATION STATE VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  // Check phase exists
  if (!state.orchestration?.phase?.number) {
    issues.push('No active phase');
  }

  // Check step is valid
  const stepCurrent = state.orchestration?.step?.current;
  if (stepCurrent && !VALID_STEPS.includes(stepCurrent)) {
    issues.push(`Invalid step: ${stepCurrent}`);
  }

  // Check status is valid
  const stepStatus = state.orchestration?.step?.status;
  if (stepStatus && !VALID_STATUSES.includes(stepStatus)) {
    issues.push(`Invalid status: ${stepStatus}`);
  }

  // Check step.index matches step.current
  const expectedIndex = STEP_INDEX_MAP[stepCurrent];
  const actualIndex = state.orchestration?.step?.index;
  if (expectedIndex !== undefined && actualIndex !== expectedIndex) {
    issues.push(`Step index mismatch: ${stepCurrent} should be ${expectedIndex}, got ${actualIndex}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXECUTION STATE VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  // Check batch indices
  execution.batches.items.forEach((batch, index) => {
    if (batch.index !== index) {
      issues.push(`Batch index mismatch: position ${index} has index ${batch.index}`);
    }
  });

  // Check batches.current is valid
  if (execution.batches.current >= execution.batches.total && execution.batches.total > 0) {
    issues.push(`Batch current (${execution.batches.current}) >= total (${execution.batches.total})`);
  }

  // Check recovery context when needed
  if (execution.status === 'needs_attention' && !execution.recoveryContext) {
    issues.push('needs_attention status requires recoveryContext');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CROSS-FILE CONSISTENCY
  // ═══════════════════════════════════════════════════════════════════

  // Phase alignment (when execution is linked)
  if (state.orchestration?.phase?.number && execution.currentPhase) {
    const statePhase = state.orchestration.phase.number;
    const execPhase = execution.currentPhase;
    // Note: execution.currentPhase is the step name, not phase number
    // This check ensures we're on the same step
    if (stepCurrent && stepCurrent !== execPhase && execPhase !== 'complete') {
      issues.push(`Step mismatch: state has ${stepCurrent}, execution has ${execPhase}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
```

---

## Race Condition Mitigations

### 1. Atomic State File Writes

```typescript
async function writeOrchestrationState(state: OrchestrationState): Promise<void> {
  const statePath = join(projectPath, '.specflow/orchestration-state.json');
  const tempPath = `${statePath}.tmp.${Date.now()}`;

  // Write to temp file
  await writeFile(tempPath, JSON.stringify(state, null, 2));

  // Atomic rename
  await rename(tempPath, statePath);
}
```

### 2. Spawn Intent Pattern

See `spawnWorkflowWithIntent()` above.

### 3. Persistent Runner State

```typescript
interface RunnerState {
  orchestrationId: string;
  pid: number;
  startedAt: number;
}

async function persistRunnerState(orchestrationId: string, state: RunnerState): Promise<void> {
  const runnerPath = join(projectPath, `.specflow/runner-${orchestrationId}.json`);
  await writeFile(runnerPath, JSON.stringify(state));
}

// On dashboard startup, check for orphaned runners
async function reconcileRunners(): Promise<void> {
  const runnerFiles = await glob('.specflow/runner-*.json', { cwd: projectPath });
  for (const file of runnerFiles) {
    const state = JSON.parse(await readFile(file, 'utf-8'));
    if (!isPidAlive(state.pid)) {
      // Runner died, clean up
      await unlink(file);
      // Optionally restart orchestration
    }
  }
}
```

### 4. Fix Event Sleep Callback Bug

```typescript
// Current (broken): Overwrites previous callback
const eventSignals = new Map<string, () => void>();

// Fixed: Use array of callbacks
const eventSignals = new Map<string, Set<() => void>>();

function eventDrivenSleep(ms: number, orchestrationId: string): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);

    const cleanup = () => {
      clearTimeout(timeout);
      resolve();
    };

    // Add to set instead of replacing
    if (!eventSignals.has(orchestrationId)) {
      eventSignals.set(orchestrationId, new Set());
    }
    eventSignals.get(orchestrationId)!.add(cleanup);
  });
}

function wakeUp(orchestrationId: string): void {
  const callbacks = eventSignals.get(orchestrationId);
  if (callbacks) {
    callbacks.forEach(cb => cb());
    callbacks.clear();
  }
}
```

---

## Unified Session Tracking

The dashboard and CLI should work identically. Terminal is just the manual version of dashboard automation.

### What to Watch

Watch `~/.claude/projects/{project-hash}/` for:
1. **New JSONL files created** - User started a new session from CLI
2. **Existing JSONL files modified** - User resumed/continued a session

### Detection Requirements

```typescript
// Session activity sources to track:
type SessionActivitySource =
  | 'dashboard_workflow'     // Started via dashboard workflow API
  | 'dashboard_omnibox'      // User typed in omnibox on session viewer
  | 'external_cli_new'       // User started new session from terminal
  | 'external_cli_resume';   // User resumed session from terminal

// All sources should update orchestration's view of session state
```

### Integration with Orchestration

When orchestration is running:
1. If user interacts with session via omnibox → orchestration sees activity, updates lastActivity
2. If user resumes session from CLI terminal → orchestration detects JSONL changes, knows session is active
3. Pause button → Play button when paused → resume via click OR omnibox command

### Implementation Approach

```typescript
// In watcher.ts or new session-watcher.ts
function watchProjectSessions(projectPath: string) {
  const claudeProjectsDir = join(homedir(), '.claude/projects');
  const projectHash = getProjectHash(projectPath);
  const sessionDir = join(claudeProjectsDir, projectHash);

  // Watch for new files (new sessions) and modifications (activity)
  const watcher = chokidar.watch(sessionDir, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 }
  });

  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      // New session started externally
      broadcast({ type: 'session:created', sessionId: extractSessionId(filePath) });
    }
  });

  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      // Session activity detected
      broadcast({ type: 'session:activity', sessionId: extractSessionId(filePath) });
    }
  });
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `orchestration-runner.ts` | Rewrite with complete decision matrix, atomic spawning, batch handling |
| `orchestration-service.ts` | Thin to persistence only, remove duplicate logic |
| `watcher.ts` | Add project session watching for external CLI detection |
| `use-sse.ts` | Add `sessionQuestions` state, handle `session:question` event |
| `unified-data-context.tsx` | Export `sessionQuestions` from context |
| `page.tsx` | Replace hardcoded `[]` with context data, clear on answer |
| `claude-helper.ts` | Add fallback chains (silent), backup before recovery |
| `session-viewer-drawer.tsx` | Verify omnibox commands update orchestration state |

---

## Verifiable Goals Checklist

Each item below is concrete and can be verified by an agent reading code, running tests, or checking behavior.

---

### G1. Decision Matrix (in `makeDecision()`)

**Pre-decision gates:**
- [ ] G1.1: Budget check exists before matrix - if `totalCostUsd >= budget.maxTotal` → return `{ action: 'fail' }`
- [ ] G1.2: Duration check exists - if orchestration running > 4 hours → return `{ action: 'needs_attention' }`

**Implement phase checked first:**
- [ ] G1.3: If `step.current === 'implement'`, calls `handleImplementBatching()` before other checks

**Workflow status checks:**
- [ ] G1.4: `workflow.status === 'running'` + activity within 10min → returns `{ action: 'wait' }`
- [ ] G1.5: `workflow.status === 'running'` + no activity for >10min → returns `{ action: 'recover_stale' }`
- [ ] G1.6: `workflow.status === 'waiting_for_input'` → returns `{ action: 'wait' }`
- [ ] G1.7: Workflow ID in state but `getWorkflow()` returns null → returns `{ action: 'wait_with_backoff' }`

**Step complete transitions:**
- [ ] G1.8: `step.status === 'complete'` + `current === 'verify'` + `phase.hasUserGate && userGateStatus !== 'confirmed'` → returns `{ action: 'wait_user_gate' }`
- [ ] G1.9: `step.status === 'complete'` + `current === 'verify'` + `!config.autoMerge` → returns `{ action: 'wait_merge' }`
- [ ] G1.10: `step.status === 'complete'` + `current === 'verify'` + `config.autoMerge` → returns `{ action: 'transition', nextStep: 'merge' }`
- [ ] G1.11: `step.status === 'complete'` + `current === 'merge'` → returns `{ action: 'complete' }`
- [ ] G1.12: `step.status === 'complete'` + other steps → returns `{ action: 'transition', nextStep: getNextStep(current) }`

**Error states:**
- [ ] G1.13: `step.status === 'failed'` → returns `{ action: 'recover_failed' }`
- [ ] G1.14: `step.status === 'blocked'` → returns `{ action: 'recover_failed' }`

**Spawn conditions:**
- [ ] G1.15: `step.status === 'in_progress'` + no active workflow → returns `{ action: 'spawn' }`
- [ ] G1.16: `step.status === 'not_started'` → returns `{ action: 'spawn' }` (with batch init if implement)
- [ ] G1.17: `step.status === null/undefined` → returns `{ action: 'spawn' }`

**No catch-all:**
- [ ] G1.18: There is NO generic `else` or `default` case that handles "unknown" without logging an error

---

### G2. Batch State Machine (in `handleImplementBatching()`)

- [ ] G2.1: `batches.total === 0` → returns `{ action: 'initialize_batches' }`
- [ ] G2.2: All batches `status === 'completed' || 'healed'` + `step.status !== 'complete'` → returns `{ action: 'force_step_complete' }`
- [ ] G2.3: All batches complete + `step.status === 'complete'` → returns `null` (let main matrix handle)
- [ ] G2.4: `currentBatch.status === 'pending'` + no workflow → returns `{ action: 'spawn_batch' }`
- [ ] G2.5: `currentBatch.status === 'running'` + workflow running → returns `null` (let staleness check handle)
- [ ] G2.6: `currentBatch.status === 'completed'` + `config.pauseBetweenBatches` → returns `{ action: 'pause' }`
- [ ] G2.7: `currentBatch.status === 'completed'` + `!pauseBetweenBatches` + more batches → returns `{ action: 'advance_batch' }`
- [ ] G2.8: `currentBatch.status === 'healed'` + more batches → returns `{ action: 'advance_batch' }`
- [ ] G2.9: `currentBatch.status === 'failed'` + `healAttempts < maxHealAttempts` → returns `{ action: 'heal_batch' }`
- [ ] G2.10: `currentBatch.status === 'failed'` + `healAttempts >= maxHealAttempts` → returns `{ action: 'recover_failed' }`

---

### G3. Claude Helper (exactly 3 cases, silent fallbacks)

**Case 1: Corrupt/Missing State**
- [ ] G3.1: `recoverStateWithClaudeHelper()` function exists
- [ ] G3.2: Creates `.bak` backup BEFORE attempting recovery
- [ ] G3.3: Calls Claude Helper with `task: 'recover_state'`
- [ ] G3.4: If Claude Helper succeeds + confidence > 0.7 → uses recovered state
- [ ] G3.5: If Claude Helper fails → tries `tryHeuristicStateRecovery()` (silent, no UI notification)
- [ ] G3.6: If heuristic fails → returns null (caller sets `needs_attention`)

**Case 2: Stale Workflow**
- [ ] G3.7: `handleStaleWorkflow()` function exists
- [ ] G3.8: Calls Claude Helper with `task: 'diagnose_stale_workflow'`
- [ ] G3.9: Handles response actions: `continue`, `restart_task`, `skip_task`, `abort`
- [ ] G3.10: If Claude Helper fails → sets `needs_attention` (silent, no error toast)

**Case 3: Failed Step**
- [ ] G3.11: `handleFailedStep()` function exists
- [ ] G3.12: Pre-checks `healAttempts >= maxHealAttempts` → skips Claude Helper, goes to `needs_attention`
- [ ] G3.13: Calls Claude Helper with `task: 'diagnose_failed_step'`
- [ ] G3.14: Handles response actions: `retry`, `skip_tasks`, `run_prerequisite`, `abort`
- [ ] G3.15: If Claude Helper fails + heal attempts remaining → simple retry (silent)
- [ ] G3.16: If Claude Helper fails + no attempts remaining → `needs_attention` (silent)

**No other Claude Helper calls:**
- [ ] G3.17: Grep codebase - Claude Helper is NOT called for any other scenarios

---

### G4. Question Flow (data plumbing)

**Pre-verification:**
- [ ] G4.1: Manual test confirms watcher.ts detects questions and emits `session:question` SSE event

**use-sse.ts:**
- [ ] G4.2: `sessionQuestions` state exists (type: `Map<string, SessionQuestion[]>`)
- [ ] G4.3: `session:question` case in switch populates `sessionQuestions` map
- [ ] G4.4: `sessionQuestions` is returned from hook

**unified-data-context.tsx:**
- [ ] G4.5: `sessionQuestions` is included in context value

**page.tsx:**
- [ ] G4.6: `decisionQuestions` is NOT hardcoded to `[]`
- [ ] G4.7: `decisionQuestions` reads from `sessionQuestions.get(consoleSessionId)`
- [ ] G4.8: After user answers, questions are cleared from map

---

### G5. Race Condition Mitigations

**Atomic state writes:**
- [ ] G5.1: `writeOrchestrationState()` writes to `.tmp` file first
- [ ] G5.2: `writeOrchestrationState()` uses `rename()` for atomic swap

**Spawn intent pattern:**
- [ ] G5.3: `spawnWorkflowWithIntent()` function exists
- [ ] G5.4: Checks for existing spawn intent before spawning
- [ ] G5.5: Checks `hasActiveWorkflow()` before spawning
- [ ] G5.6: Writes spawn intent to file/state BEFORE calling `workflowService.start()`
- [ ] G5.7: Clears spawn intent in `finally` block (regardless of success/failure)

**Persistent runner state:**
- [ ] G5.8: `persistRunnerState()` writes `runner-{orchestrationId}.json` with PID and startedAt
- [ ] G5.9: `clearRunnerState()` removes file when loop exits
- [ ] G5.10: Dashboard startup calls `reconcileRunners()` to detect orphans

**Event sleep fix:**
- [ ] G5.11: `eventSignals` uses `Map<string, Set<() => void>>` (not single callback)
- [ ] G5.12: `eventDrivenSleep()` adds callback to Set
- [ ] G5.13: `wakeUp()` iterates Set and calls all callbacks

---

### G6. Unified Session Tracking

**File watching:**
- [ ] G6.1: Watches `~/.claude/projects/{hash}/` directory
- [ ] G6.2: Detects new `.jsonl` files (new sessions from CLI)
- [ ] G6.3: Detects modified `.jsonl` files (session activity from CLI)
- [ ] G6.4: Emits `session:created` SSE event for new files
- [ ] G6.5: Emits `session:activity` SSE event for modifications

**Orchestration integration:**
- [ ] G6.6: External session activity updates `lastActivity` in orchestration
- [ ] G6.7: Omnibox commands in session viewer update orchestration state

**Pause/Resume UI:**
- [ ] G6.8: Pause button exists and sets `status: 'paused'`
- [ ] G6.9: When paused, pause button becomes Play button
- [ ] G6.10: Play button click resumes orchestration
- [ ] G6.11: Omnibox command while paused resumes orchestration

---

### G7. State Validation

- [ ] G7.1: `validateState()` checks `step.index === STEP_INDEX_MAP[step.current]`
- [ ] G7.2: `validateState()` checks `step.current` is in `['design', 'analyze', 'implement', 'verify', 'merge']`
- [ ] G7.3: `validateState()` checks `step.status` is in valid statuses
- [ ] G7.4: `validateState()` checks `batches.items[i].index === i`
- [ ] G7.5: `validateState()` checks `batches.current < batches.total` (unless all complete)
- [ ] G7.6: `validateState()` checks `recoveryContext` exists when `status === 'needs_attention'`
- [ ] G7.7: `validateState()` checks cross-file consistency (state step vs execution phase)

---

### G8. Decision Log UI

- [ ] G8.1: `logDecision()` writes to `orchestration.decisionLog` array
- [ ] G8.2: Phase Completion card reads from `decisionLog`
- [ ] G8.3: New decision matrix decisions appear in UI
- [ ] G8.4: Log entries include timestamp, action, and reason

---

### G9. Features Preserved

**Cost tracking:**
- [ ] G9.1: `addCost()` is called after workflow completes
- [ ] G9.2: `totalCostUsd` accumulates across workflows
- [ ] G9.3: Budget exceeded triggers `fail` action (from G1.1)

**Heal attempts:**
- [ ] G9.4: `healAttempts` counter exists in execution state
- [ ] G9.5: `incrementHealAttempts()` is called before retry
- [ ] G9.6: Max heal attempts check prevents infinite loops (from G3.12)
- [ ] G9.7: Batch-level `healAttempts` tracked separately from step-level

---

### G10. Code Cleanup

- [ ] G10.1: `isPhaseComplete()` artifact checks are REMOVED
- [ ] G10.2: Duplicate `getNextPhase()` functions consolidated
- [ ] G10.3: Duplicate `isStepComplete()` functions consolidated
- [ ] G10.4: `orchestration-service.ts` contains only persistence logic (no decision logic)

---

### G11. Tests Exist

**Unit tests:**
- [ ] G11.1: Test for `makeDecision()` covers all G1.* conditions
- [ ] G11.2: Test for `handleImplementBatching()` covers all G2.* conditions
- [ ] G11.3: Test for `validateState()` covers all G7.* conditions
- [ ] G11.4: Test for `spawnWorkflowWithIntent()` prevents duplicate spawns

**Integration tests:**
- [ ] G11.5: Happy path test: design → analyze → implement → verify → merge (autoMerge=true)
- [ ] G11.6: Manual merge test: verify → wait_merge (autoMerge=false)
- [ ] G11.7: USER_GATE test: verify → wait_user_gate → confirm → merge
- [ ] G11.8: Question flow test: workflow asks → toast appears → answer → resumes
- [ ] G11.9: Batch test: implement with multiple batches sequentially
- [ ] G11.10: Pause/resume test: pause button → play button → resume
- [ ] G11.11: External CLI test: start session from terminal → dashboard detects
- [ ] G11.12: Race condition test: rapid spawn triggers → only one workflow

---

## Verification Commands

Agents can verify goals using:

```bash
# G1-G2: Check decision matrix completeness
grep -n "action:" orchestration-runner.ts | wc -l  # Should cover all cases

# G3.17: Verify Claude Helper only called for 3 cases
grep -r "claudeHelper" packages/dashboard/src/ --include="*.ts"

# G4.6: Verify no hardcoded empty array
grep -n "decisionQuestions = \[\]" packages/dashboard/src/

# G5.1-G5.2: Verify atomic writes
grep -n "\.tmp" orchestration-service.ts
grep -n "rename" orchestration-service.ts

# G10.1: Verify artifact checks removed
grep -n "hasPlan\|hasTasks\|hasSpec" orchestration-runner.ts  # Should return nothing
```

---

## Testing Infrastructure

The current runner is hard to test because logic is intertwined with I/O. The simplification enables proper testing.

### Pure Function Extraction

Extract decision logic into pure functions with no side effects:

```typescript
// PURE FUNCTIONS (unit testable, no I/O)
function makeDecision(
  step: Step,
  phase: Phase,
  execution: OrchestrationExecution,
  workflow: Workflow | null,
  config: { staleDurationMs: number }
): Decision

function handleImplementBatching(
  step: Step,
  execution: OrchestrationExecution,
  workflow: Workflow | null
): Decision | null

function validateState(
  state: OrchestrationState,
  execution: OrchestrationExecution
): ValidationResult
```

### Dependency Injection

The orchestration loop takes dependencies as parameters for easy mocking:

```typescript
interface OrchestrationDeps {
  readState: () => Promise<OrchestrationState>;
  readExecution: () => Promise<OrchestrationExecution>;
  writeState: (state: OrchestrationState) => Promise<void>;
  getWorkflow: (id: string) => Promise<Workflow | null>;
  spawnWorkflow: (skill: string, context?: string) => Promise<string>;
  killWorkflow: (id: string) => Promise<void>;
  claudeHelper: {
    recoverState: (error: Error) => Promise<OrchestrationState | null>;
    diagnoseStale: (context: StaleContext) => Promise<StaleResponse>;
    diagnoseFailed: (context: FailedContext) => Promise<FailedResponse>;
  };
  clock: { now: () => number };  // For testing time-based logic
}

async function runOrchestrationLoop(
  orchestrationId: string,
  projectPath: string,
  deps: OrchestrationDeps
) {
  // Uses deps.* instead of direct imports
}
```

### Test Project: ~/dev/test-app/

Use existing test project with git tags for state reset:

```bash
# Setup tags for different test scenarios
cd ~/dev/test-app

# Tag: Clean slate - no orchestration state
git tag test/clean-slate

# Tag: Design phase complete
git tag test/design-complete

# Tag: Implement with 3 batches, batch 1 complete
git tag test/implement-batch-1-done

# Tag: Verify complete, USER_GATE pending
git tag test/verify-user-gate

# Tag: Corrupt state file
git tag test/corrupt-state

# Reset to a tag for testing
git checkout test/design-complete
git checkout -b test-run-$(date +%s)
```

### Unit Tests (Pure Functions)

```typescript
// packages/dashboard/tests/orchestration/decision-matrix.test.ts

describe('makeDecision', () => {
  // G1.4: workflow running + recent activity → wait
  it('waits when workflow is running with recent activity', () => {
    const step = { current: 'implement', status: 'in_progress', index: 2 };
    const workflow = { status: 'running', lastActivityAt: Date.now() - 1000 };
    const execution = createMockExecution();

    const decision = makeDecision(step, mockPhase, execution, workflow, { staleDurationMs: 600000 });

    expect(decision).toEqual({ action: 'wait', reason: 'Workflow running' });
  });

  // G1.5: workflow running + stale → recover_stale
  it('recovers when workflow is stale for 10+ minutes', () => {
    const step = { current: 'implement', status: 'in_progress', index: 2 };
    const workflow = {
      id: 'wf-123',
      status: 'running',
      lastActivityAt: Date.now() - 11 * 60 * 1000
    };

    const decision = makeDecision(step, mockPhase, execution, workflow, { staleDurationMs: 600000 });

    expect(decision.action).toBe('recover_stale');
    expect(decision.workflowId).toBe('wf-123');
  });

  // ... tests for all 18 G1.* items
});

describe('handleImplementBatching', () => {
  // G2.1: no batches → initialize
  it('initializes batches when total is 0', () => {
    const execution = createMockExecution({ batches: { total: 0, current: 0, items: [] } });

    const decision = handleImplementBatching(mockStep, execution, null);

    expect(decision).toEqual({ action: 'initialize_batches', reason: expect.any(String) });
  });

  // ... tests for all 10 G2.* items
});
```

### Integration Tests (Mocked Dependencies)

```typescript
// packages/dashboard/tests/orchestration/integration.test.ts

describe('orchestration loop integration', () => {
  // G11.5: Happy path
  it('completes full orchestration: design → merge', async () => {
    const stateSequence = [
      fixtures.state.designNotStarted,
      fixtures.state.designComplete,
      fixtures.state.analyzeComplete,
      fixtures.state.implementComplete,
      fixtures.state.verifyComplete,
      fixtures.state.mergeComplete,
    ];
    let stateIndex = 0;

    const deps = createMockDeps({
      readState: vi.fn(() => Promise.resolve(stateSequence[stateIndex++])),
      spawnWorkflow: vi.fn().mockResolvedValue('wf-123'),
    });

    await runOrchestrationLoop('orch-1', '/test/path', deps);

    expect(deps.spawnWorkflow).toHaveBeenCalledWith('flow.design');
    expect(deps.spawnWorkflow).toHaveBeenCalledWith('flow.analyze');
    expect(deps.spawnWorkflow).toHaveBeenCalledWith('flow.implement');
    expect(deps.spawnWorkflow).toHaveBeenCalledWith('flow.verify');
    expect(deps.spawnWorkflow).toHaveBeenCalledWith('flow.merge');
  });

  // G11.12: Race condition prevention
  it('prevents duplicate workflow spawns on rapid triggers', async () => {
    const deps = createMockDeps({
      readState: vi.fn().mockResolvedValue(fixtures.state.designNotStarted),
      spawnWorkflow: vi.fn().mockImplementation(async () => {
        await sleep(100); // Simulate spawn delay
        return 'wf-123';
      }),
    });

    // Trigger loop twice rapidly
    const loop1 = runSingleIteration('orch-1', '/test', deps);
    const loop2 = runSingleIteration('orch-1', '/test', deps);

    await Promise.all([loop1, loop2]);

    // Should only spawn once due to spawn intent pattern
    expect(deps.spawnWorkflow).toHaveBeenCalledTimes(1);
  });
});
```

### Test Fixtures (in repo)

```
packages/dashboard/tests/fixtures/orchestration/
├── state/
│   ├── design-not-started.json
│   ├── design-complete.json
│   ├── implement-batch-1-of-3.json
│   ├── verify-complete-user-gate.json
│   ├── verify-complete-auto-merge.json
│   └── corrupt.json
├── execution/
│   ├── running-design.json
│   ├── running-implement-batches.json
│   └── needs-attention.json
├── workflows/
│   ├── running.json
│   ├── waiting-for-input.json
│   └── completed.json
└── helpers.ts  # createMockDeps(), createMockExecution(), etc.
```

### Git Tags for ~/dev/test-app/

| Tag | State | Use Case |
|-----|-------|----------|
| `test/clean-slate` | No .specflow/, fresh project | Start orchestration test |
| `test/design-complete` | Design done, analyze not started | Transition tests |
| `test/implement-batch-1` | Batch 1 complete, batch 2 pending | Batch handling tests |
| `test/implement-batch-failed` | Batch 2 failed, heal attempts = 1 | Heal/recovery tests |
| `test/verify-user-gate` | Verify complete, USER_GATE pending | Gate tests |
| `test/verify-auto-merge` | Verify complete, autoMerge=true | Auto-merge tests |
| `test/corrupt-state` | Invalid JSON in state file | Recovery tests |
| `test/stale-workflow` | Running workflow, old timestamps | Staleness tests |
| `test/paused` | Orchestration status=paused | Pause/resume tests |
| `test/verify-manual-merge` | Verify complete, autoMerge=false | Manual merge flow |
| `test/waiting-for-input` | Workflow waiting, question in JSONL | Question flow tests |

### External CLI / JSONL Testing

Git tags only cover project state (`.specflow/`). Session data lives in `~/.claude/projects/{hash}/` and needs separate setup.

**JSONL Test Fixtures** (in repo, copied to ~/.claude/ during tests):

```
packages/dashboard/tests/fixtures/jsonl/
├── session-with-question.jsonl     # Contains AskUserQuestion tool call
├── session-running.jsonl           # Active session with recent messages
├── session-completed.jsonl         # Finished session
└── session-external-cli.jsonl      # Simulates session started from terminal
```

**JSONL with question example:**
```jsonl
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_123","name":"AskUserQuestion","input":{"questions":[{"question":"Which approach should we use?","header":"Approach","options":[{"label":"Option A","description":"Fast but limited"},{"label":"Option B","description":"Comprehensive"}],"multiSelect":false}]}}]}}
```

**Setup script for external CLI testing:**
```bash
#!/bin/bash
# packages/dashboard/tests/setup-jsonl-fixtures.sh

TEST_APP_PATH="$HOME/dev/test-app"
PROJECT_HASH=$(echo -n "$TEST_APP_PATH" | shasum -a 256 | cut -c1-16)
CLAUDE_SESSION_DIR="$HOME/.claude/projects/$PROJECT_HASH"

mkdir -p "$CLAUDE_SESSION_DIR"

# Copy fixtures
cp packages/dashboard/tests/fixtures/jsonl/*.jsonl "$CLAUDE_SESSION_DIR/"

echo "JSONL fixtures installed to $CLAUDE_SESSION_DIR"
```

### E2E Test Harness

Script to run E2E tests against ~/dev/test-app/:

```typescript
// packages/dashboard/tests/e2e/orchestration-harness.ts

import { spawn } from 'child_process';

interface E2ETestCase {
  name: string;
  gitTag: string;
  jsonlFixtures?: string[];  // Copy these to ~/.claude/projects/
  actions: E2EAction[];
  assertions: E2EAssertion[];
}

const testCases: E2ETestCase[] = [
  {
    name: 'G11.5: Happy path design → merge',
    gitTag: 'test/clean-slate',
    actions: [
      { type: 'start_orchestration', config: { autoMerge: true } },
      { type: 'wait_for_status', status: 'completed', timeout: 300000 },
    ],
    assertions: [
      { type: 'step_reached', step: 'merge' },
      { type: 'status_is', status: 'completed' },
    ],
  },
  {
    name: 'G11.6: Manual merge (autoMerge=false)',
    gitTag: 'test/verify-manual-merge',
    actions: [
      { type: 'start_orchestration', config: { autoMerge: false } },
      { type: 'wait_for_status', status: 'waiting_merge', timeout: 60000 },
    ],
    assertions: [
      { type: 'status_is', status: 'waiting_merge' },
      { type: 'step_is', step: 'verify' },
    ],
  },
  {
    name: 'G11.8: Question flow',
    gitTag: 'test/waiting-for-input',
    jsonlFixtures: ['session-with-question.jsonl'],
    actions: [
      { type: 'wait_for_sse_event', event: 'session:question', timeout: 5000 },
    ],
    assertions: [
      { type: 'question_displayed_in_ui' },
    ],
  },
  {
    name: 'G11.10: Pause/resume',
    gitTag: 'test/paused',
    actions: [
      { type: 'click_play_button' },
      { type: 'wait_for_status', status: 'running', timeout: 5000 },
    ],
    assertions: [
      { type: 'status_is', status: 'running' },
    ],
  },
  {
    name: 'G11.11: External CLI detection',
    gitTag: 'test/design-complete',
    jsonlFixtures: ['session-external-cli.jsonl'],
    actions: [
      { type: 'simulate_jsonl_modification', file: 'session-external-cli.jsonl' },
      { type: 'wait_for_sse_event', event: 'session:activity', timeout: 2000 },
    ],
    assertions: [
      { type: 'session_activity_detected' },
    ],
  },
];

async function runE2ETests() {
  for (const testCase of testCases) {
    console.log(`Running: ${testCase.name}`);

    // 1. Reset test-app to git tag
    await exec(`cd ~/dev/test-app && git checkout ${testCase.gitTag} -f`);

    // 2. Setup JSONL fixtures if needed
    if (testCase.jsonlFixtures) {
      await setupJsonlFixtures(testCase.jsonlFixtures);
    }

    // 3. Start dashboard in test mode
    const dashboard = spawn('pnpm', ['dev:dashboard'], {
      env: { ...process.env, TEST_MODE: 'true' }
    });

    // 4. Execute actions
    for (const action of testCase.actions) {
      await executeAction(action);
    }

    // 5. Run assertions
    for (const assertion of testCase.assertions) {
      await runAssertion(assertion);
    }

    // 6. Cleanup
    dashboard.kill();
  }
}
```

### Test Coverage Matrix

| Test Type | What It Tests | Runs Against | Speed |
|-----------|---------------|--------------|-------|
| **Unit** | Pure functions (makeDecision, validateState) | In-memory fixtures | <1s |
| **Integration** | Orchestration loop with mocked deps | Mocked OrchestrationDeps | <5s |
| **E2E** | Full system with real files | ~/dev/test-app + git tags | 30s-5min |

**Coverage by Goal:**

| Goal | Unit | Integration | E2E |
|------|------|-------------|-----|
| G1.* Decision Matrix | ✓ | ✓ | - |
| G2.* Batch Handling | ✓ | ✓ | - |
| G3.* Claude Helper | - | ✓ (mocked) | - |
| G4.* Question Flow | - | - | ✓ |
| G5.* Race Conditions | ✓ | ✓ | - |
| G6.* Session Tracking | - | - | ✓ |
| G7.* State Validation | ✓ | - | - |
| G11.5-12 Integration | - | ✓ | ✓ |

---

## Verifiable Testing Goals

**Pure function extraction:**
- [ ] G12.1: `makeDecision()` is a pure function (no direct I/O calls)
- [ ] G12.2: `handleImplementBatching()` is a pure function
- [ ] G12.3: `validateState()` is a pure function
- [ ] G12.4: `runOrchestrationLoop()` accepts `OrchestrationDeps` parameter

**Test fixtures in repo:**
- [ ] G12.5: State fixtures exist in `packages/dashboard/tests/fixtures/orchestration/state/`
- [ ] G12.6: Execution fixtures exist in `packages/dashboard/tests/fixtures/orchestration/execution/`
- [ ] G12.7: Workflow fixtures exist in `packages/dashboard/tests/fixtures/orchestration/workflows/`
- [ ] G12.8: JSONL fixtures exist in `packages/dashboard/tests/fixtures/jsonl/`
- [ ] G12.9: `helpers.ts` exports `createMockDeps()`, `createMockExecution()`, `createMockState()`

**Unit tests:**
- [ ] G12.10: Unit tests exist for all 18 G1.* decision matrix conditions
- [ ] G12.11: Unit tests exist for all 10 G2.* batch handling conditions
- [ ] G12.12: Unit tests exist for all 7 G7.* state validation checks
- [ ] G12.13: Unit test for spawn intent pattern (G5.3-G5.7)

**Integration tests (mocked deps):**
- [ ] G12.14: Integration tests use `OrchestrationDeps` mocks (no real file I/O)
- [ ] G12.15: Happy path test: design → merge with autoMerge=true
- [ ] G12.16: Manual merge test: verify → wait_merge with autoMerge=false
- [ ] G12.17: Race condition test: rapid triggers spawn only once

**Git tags in ~/dev/test-app/:**
- [ ] G12.18: Tag `test/clean-slate` exists (no .specflow/)
- [ ] G12.19: Tag `test/design-complete` exists
- [ ] G12.20: Tag `test/implement-batch-1` exists
- [ ] G12.21: Tag `test/implement-batch-failed` exists
- [ ] G12.22: Tag `test/verify-user-gate` exists
- [ ] G12.23: Tag `test/verify-auto-merge` exists
- [ ] G12.24: Tag `test/verify-manual-merge` exists
- [ ] G12.25: Tag `test/corrupt-state` exists
- [ ] G12.26: Tag `test/stale-workflow` exists
- [ ] G12.27: Tag `test/paused` exists
- [ ] G12.28: Tag `test/waiting-for-input` exists

**E2E test harness:**
- [ ] G12.29: `setup-jsonl-fixtures.sh` script exists and works
- [ ] G12.30: E2E harness can reset to git tag
- [ ] G12.31: E2E harness can setup JSONL fixtures in ~/.claude/projects/
- [ ] G12.32: E2E harness can start/stop dashboard
- [ ] G12.33: E2E harness can wait for SSE events

**All tests pass:**
- [ ] G12.34: `pnpm test:dashboard` passes all unit + integration tests
- [ ] G12.35: E2E test harness passes all scenarios
