# Orchestration Simplification Plan

## Problem Statement

The dashboard's orchestration system has become a mess of hacks working around edge cases instead of having a clean design. There are multiple sources of truth (CLI state file vs dashboard OrchestrationExecution), reconciliation hacks, guards that block decisions after they're already wrong, and a Claude analyzer as a fallback when nothing makes sense.

## Goals

1. **Single source of truth**: `.specflow/orchestration-state.json` is THE state
2. **Dead simple flow**: design → analyze → implement (batches) → verify → merge
3. **Trust sub-commands**: They update step.status; dashboard auto-heals if needed
4. **Clean decision logic**: No hacks, no guards, no reconciliation between parallel states

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Dashboard                                    │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Orchestration  │───>│  Claude CLI      │───>│  specflow CLI │  │
│  │  Runner         │    │  Session         │    │  state set    │  │
│  └────────┬────────┘    └──────────────────┘    └───────┬───────┘  │
│           │                                              │          │
│           │ watches                                      │ writes   │
│           ▼                                              ▼          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              .specflow/orchestration-state.json              │   │
│  │  (SINGLE SOURCE OF TRUTH)                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Flow**:
1. Dashboard reads state file
2. Dashboard decides what to spawn based on state
3. Dashboard spawns Claude CLI session with skill (/flow.design, etc.)
4. Claude CLI runs skill, skill calls `specflow state set` to update state
5. Dashboard watches state file for changes
6. When session ends AND step.status=complete, move to next step
7. If state doesn't match expectations, auto-heal (simple rules, Claude fallback)

---

## Phase 1: Consolidate State (Remove OrchestrationExecution)

### Current Problem
- `OrchestrationExecution` in dashboard maintains: currentPhase, batches, status, config, executions, decisionLog, totalCostUsd
- CLI state file maintains: step.current, step.status, step.index, phase info
- These drift apart, causing confusion

### Solution
Extend the CLI state schema to include dashboard-specific fields:

```typescript
// Add to orchestration section of state file
orchestration: {
  // ... existing fields (step, phase, progress, etc.)

  // NEW: Dashboard orchestration tracking
  dashboard: {
    // Active orchestration (null if none)
    active: {
      id: string;              // UUID for this orchestration run
      startedAt: string;       // ISO timestamp
      config: OrchestrationConfig;  // User's config choices
    } | null;

    // Batch tracking for implement phase
    batches: {
      total: number;
      current: number;
      items: Array<{
        section: string;
        taskIds: string[];
        status: 'pending' | 'running' | 'completed' | 'failed' | 'healed';
        workflowId?: string;
        healAttempts: number;
      }>;
    };

    // Cost tracking
    cost: {
      total: number;
      perBatch: number[];
    };

    // Decision log (last 20)
    decisionLog: Array<{
      timestamp: string;
      action: string;
      reason: string;
    }>;

    // Last workflow tracking
    lastWorkflow: {
      id: string;
      skill: string;
      status: 'running' | 'completed' | 'failed' | 'cancelled';
    } | null;
  }
}
```

### Tasks
1. [ ] Update `OrchestrationStateSchema` in `packages/shared/src/schemas/events.ts`
2. [ ] Add `specflow state set orchestration.dashboard.*` support
3. [ ] Remove `OrchestrationExecution` type and storage
4. [ ] Update `orchestration-service.ts` to read/write via specflow CLI (or direct file with schema validation)
5. [ ] Remove `orchestration-execution.ts` schema

---

## Phase 2: Simplify Decision Logic

### Current Problem
- `orchestration-decisions.ts` has complex logic
- `orchestration-runner.ts` has legacy `makeDecision()` plus adapter pattern
- Guards that block transitions after wrong decisions
- Claude analyzer fallback when state is unclear

### Solution
Simple decision matrix based on state file:

```typescript
function getNextAction(state: OrchestrationState): Decision {
  const { step, dashboard } = state.orchestration;
  const workflow = dashboard?.lastWorkflow;

  // 1. If no active orchestration, nothing to do
  if (!dashboard?.active) {
    return { action: 'idle', reason: 'No active orchestration' };
  }

  // 2. If workflow is running, wait
  if (workflow?.status === 'running') {
    return { action: 'wait', reason: 'Workflow running' };
  }

  // 3. Based on current step and status
  switch (step.current) {
    case 'design':
      if (step.status === 'complete') return transition('analyze');
      if (step.status === 'failed') return heal('design');
      if (!workflow) return spawn('flow.design');
      return { action: 'wait', reason: 'Design in progress' };

    case 'analyze':
      if (step.status === 'complete') return transition('implement');
      if (step.status === 'failed') return heal('analyze');
      if (!workflow) return spawn('flow.analyze');
      return { action: 'wait', reason: 'Analyze in progress' };

    case 'implement':
      return handleImplementBatches(state);

    case 'verify':
      if (step.status === 'complete') return mergeOrWait(state);
      if (step.status === 'failed') return heal('verify');
      if (!workflow) return spawn('flow.verify');
      return { action: 'wait', reason: 'Verify in progress' };

    default:
      return { action: 'wait', reason: 'Unknown step' };
  }
}

function handleImplementBatches(state): Decision {
  const { batches } = state.orchestration.dashboard;

  // All batches done?
  if (allBatchesComplete(batches)) {
    return transition('verify');
  }

  const currentBatch = batches.items[batches.current];

  // Current batch failed?
  if (currentBatch.status === 'failed') {
    if (canHeal(currentBatch)) return healBatch(batches.current);
    return { action: 'needs_attention', reason: 'Batch failed' };
  }

  // Current batch pending?
  if (currentBatch.status === 'pending') {
    return spawnBatch(currentBatch);
  }

  // Current batch complete? Move to next
  if (currentBatch.status === 'completed') {
    return advanceBatch();
  }

  return { action: 'wait', reason: 'Batch in progress' };
}
```

### Tasks
1. [ ] Rewrite `orchestration-decisions.ts` with simplified logic above
2. [ ] Remove legacy `makeDecision()` from runner
3. [ ] Remove `createDecisionInput()` adapter
4. [ ] Remove guards that block after-the-fact
5. [ ] Remove Claude analyzer fallback (replaced by simple heal logic)

---

## Phase 3: Fix State Transitions

### Current Problem
- Dashboard tries to reconcile its currentPhase with CLI's step.current
- Hack at line 889-893: "if mismatch, treat as not_started"
- `isPhaseComplete()` checks artifacts instead of trusting state

### Solution
Trust the state file. Period.

```typescript
// REMOVE THIS:
const stepStatus = (stateFileStep === orchestration.currentPhase && rawStatus && ...)
  ? rawStatus
  : 'not_started';  // HACK

// REPLACE WITH:
const stepStatus = state.orchestration.step.status;
const stepCurrent = state.orchestration.step.current;
// That's it. Trust the state.
```

### Auto-Heal Rules (Simple)

After a workflow ends, check state matches expectations:

| Skill | Expected State | Auto-Heal If |
|-------|---------------|--------------|
| flow.design | step.current=design, step.status=complete | status != complete → set to complete |
| flow.analyze | step.current=analyze, step.status=complete | status != complete → set to complete |
| flow.implement | (batch-specific) | batch status not updated → mark complete |
| flow.verify | step.current=verify, step.status=complete | status != complete → set to complete |

If heal rule doesn't apply (ambiguous case), spawn Claude helper to analyze and fix.

### Tasks
1. [ ] Remove `isPhaseComplete()` function (or make it only check state)
2. [ ] Remove state reconciliation hack (line 889-893)
3. [ ] Add `autoHealAfterWorkflow()` function with simple rules
4. [ ] Add Claude helper fallback for ambiguous cases only

---

## Phase 4: Clean Up Batch Handling

### Current Problem
- Batch completion uses `every()` on empty array (returns true = bug)
- Guards prevent implement→verify transition when batches incomplete
- Batches initialized late (during implement transition)

### Solution
Initialize batches when orchestration starts, track in state file:

```typescript
async function startOrchestration(projectPath: string, config: OrchestrationConfig) {
  // 1. Parse batches from tasks.md NOW
  const batchPlan = parseBatchesFromProject(projectPath, config.batchSizeFallback);

  // 2. Initialize state with batches
  await execAsync(`specflow state set \
    orchestration.dashboard.active.id=${uuid()} \
    orchestration.dashboard.active.startedAt=${new Date().toISOString()} \
    orchestration.dashboard.batches.total=${batchPlan.batches.length} \
    orchestration.dashboard.batches.current=0 \
    orchestration.dashboard.batches.items='${JSON.stringify(batchPlan.batches)}'
  `);

  // 3. Start from current step (trust state file)
  // Decision logic will spawn appropriate workflow
}
```

### Tasks
1. [ ] Move batch initialization to orchestration start
2. [ ] Update batch status via `specflow state set` not direct writes
3. [ ] Remove empty array guards (not needed if initialized properly)
4. [ ] Remove batch-specific guards in executeDecision

---

## Phase 5: Remove Hacks

List of specific hacks to remove once above is implemented:

| Location | Hack | Remove When |
|----------|------|-------------|
| runner:889-893 | State reconciliation | Phase 3 complete |
| runner:1134-1142 | Workflow lookup fallback | Phase 1 complete (tracked in state) |
| runner:1450-1454 | Claude analyzer fallback | Phase 2 complete |
| runner:1570-1584 | Batch completion guard | Phase 4 complete |
| runner:1030-1037 | Empty array guard | Phase 4 complete |
| service:291-295 | Circular phase completion | Phase 3 complete |

---

## Phase 6: UI Enhancements

### Manual Step Override
Add ability for user to manually go back to a previous step:

```tsx
// In OrchestrationProgress or similar
<Button onClick={() => setStep('analyze')}>
  Go back to Analyze
</Button>
```

Implementation:
```typescript
async function setStepManually(step: string) {
  await execAsync(`specflow state set \
    orchestration.step.current=${step} \
    orchestration.step.status=not_started
  `);
  // Orchestration runner will detect change and spawn appropriate workflow
}
```

### Tasks
1. [ ] Add step override buttons to UI
2. [ ] Show current state clearly (what step we're on, what status)
3. [ ] Add warning when external changes detected

---

## Implementation Order

1. **Phase 1**: Consolidate state (biggest change, enables everything else)
2. **Phase 4**: Clean up batch handling (depends on Phase 1)
3. **Phase 3**: Fix state transitions (depends on Phase 1)
4. **Phase 2**: Simplify decision logic (depends on Phase 1, 3, 4)
5. **Phase 5**: Remove hacks (depends on all above)
6. **Phase 6**: UI enhancements (can be parallel)

---

## Success Criteria

- [ ] Single state file (no OrchestrationExecution)
- [ ] Decision logic < 100 lines (currently ~700)
- [ ] No reconciliation hacks
- [ ] No guards that block after wrong decisions
- [ ] No Claude analyzer fallback (simple heal rules only)
- [ ] User can manually override step if needed
- [ ] External runs (manual /flow.implement) don't break orchestration

---

## Scope Clarifications

**In Scope (if needed for state management)**:
- Updates to /flow.* commands for state-setting logic
- Updates to specflow CLI core commands for state management
- Schema extensions for dashboard tracking

**Out of Scope**:
- Major UI redesign (just adding step override)
- Changes to /flow.* command core logic (design artifacts, TDD workflow, etc.)
