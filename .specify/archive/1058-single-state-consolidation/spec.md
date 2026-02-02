# Specification: Phase 1058 - Single State Consolidation

## Problem Statement

The dashboard's orchestration system has become a mess of hacks working around edge cases instead of having a clean design. There are:

1. **Multiple sources of truth**: CLI state file (`.specflow/orchestration-state.json`) AND dashboard's `OrchestrationExecution` state
2. **Reconciliation hacks**: Code that tries to merge/reconcile these two states
3. **Guards blocking wrong decisions**: Guards that prevent transitions AFTER the decision logic already decided wrong
4. **Claude analyzer fallback**: When the system doesn't know what to do, it spawns Claude to figure it out

This complexity leads to bugs like:
- Jump from verify to analyze when state doesn't match
- External runs (manual `/flow.implement`) breaking orchestration
- Race conditions between state updates

## Goals

| # | Goal | Success Criteria |
|---|------|------------------|
| G1 | Single source of truth | `OrchestrationExecution` type removed, all state in CLI state file |
| G2 | Trust sub-commands | Sub-commands update `step.status`; dashboard watches and heals |
| G3 | Simple decision logic | `orchestration-decisions.ts` < 100 lines |
| G4 | No hacks | All 6 identified hacks removed |
| G5 | Manual override | UI button to go back to previous step |

## Functional Requirements

### FR-001: Extend CLI State Schema

Add `orchestration.dashboard` section to `.specflow/orchestration-state.json`:

```typescript
interface DashboardState {
  active: {
    id: string;              // UUID for this orchestration run
    startedAt: string;       // ISO timestamp
    config: OrchestrationConfig;
  } | null;

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

  cost: {
    total: number;
    perBatch: number[];
  };

  decisionLog: Array<{
    timestamp: string;
    action: string;
    reason: string;
  }>;

  lastWorkflow: {
    id: string;
    skill: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
  } | null;
}
```

### FR-002: Simple Decision Logic

Decision function must be < 100 lines and follow this pattern:

```typescript
function getNextAction(state: OrchestrationState): Decision {
  const { step, dashboard } = state.orchestration;

  // No active orchestration
  if (!dashboard?.active) {
    return { action: 'idle', reason: 'No active orchestration' };
  }

  // Workflow running
  if (dashboard.lastWorkflow?.status === 'running') {
    return { action: 'wait', reason: 'Workflow running' };
  }

  // Based on current step
  switch (step.current) {
    case 'design':
      if (step.status === 'complete') return transition('analyze');
      if (step.status === 'failed') return heal('design');
      return spawn('flow.design');

    case 'analyze':
      if (step.status === 'complete') return transition('implement');
      if (step.status === 'failed') return heal('analyze');
      return spawn('flow.analyze');

    case 'implement':
      return handleBatches(state);

    case 'verify':
      if (step.status === 'complete') return mergeOrWait(state);
      if (step.status === 'failed') return heal('verify');
      return spawn('flow.verify');

    default:
      return { action: 'wait', reason: 'Unknown step' };
  }
}
```

### FR-003: Auto-Heal After Workflow

When a workflow ends, check if state matches expectations:

| Skill | Expected After Completion | Auto-Heal If |
|-------|---------------------------|--------------|
| flow.design | step.current=design, step.status=complete | status != complete → set complete |
| flow.analyze | step.current=analyze, step.status=complete | status != complete → set complete |
| flow.implement | batch.status=completed | batch not updated → mark complete |
| flow.verify | step.current=verify, step.status=complete | status != complete → set complete |

Only use Claude helper for these specific ambiguous cases:
1. State file is corrupted/unparseable (cannot read step.current or step.status)
2. Workflow ended but step.current doesn't match the expected skill (e.g., ran flow.design but step.current=verify)
3. Multiple conflicting signals (workflow completed + session failed + state says in_progress)

For all other cases, use simple rules or set `needs_attention` for user intervention.

### FR-004: Remove Hacks

Remove these specific code sections:

| Location | Lines | Description |
|----------|-------|-------------|
| orchestration-runner.ts | 889-893 | State reconciliation hack |
| orchestration-runner.ts | 1134-1142 | Workflow lookup fallback |
| orchestration-runner.ts | 1450-1454 | Claude analyzer fallback |
| orchestration-runner.ts | 1570-1584 | Batch completion guard |
| orchestration-runner.ts | 1030-1037 | Empty array guard |
| orchestration-service.ts | 291-295 | Circular phase completion |

### FR-005: Manual Step Override

Add UI button to go back to a previous step:

```typescript
async function setStepManually(step: string) {
  await execAsync(`specflow state set \
    orchestration.step.current=${step} \
    orchestration.step.status=not_started
  `);
  // Orchestration runner detects change and spawns appropriate workflow
}
```

## Non-Functional Requirements

### NFR-001: Code Reduction

- Decision logic: < 100 lines (from ~700)
- Remove `OrchestrationExecution` type entirely
- Remove `isPhaseComplete()` artifact checks

### NFR-002: State Consistency

- Dashboard ONLY reads/writes via `specflow state set` or direct file with schema validation
- No parallel state tracking
- Single file watched for changes

## Implementation Order

1. **Extend CLI state schema** (FR-001) - Biggest change, enables everything else
2. **Remove OrchestrationExecution** - Update dashboard to use CLI state
3. **Simplify decision logic** (FR-002) - Now possible with single state
4. **Add auto-heal** (FR-003) - Simple rules
5. **Remove hacks** (FR-004) - No longer needed
6. **Add UI override** (FR-005) - User escape hatch

## Out of Scope

- Changes to `/flow.*` command core logic (artifact creation, TDD workflow)
- Major UI redesign (just adding step override button)
- Specflow CLI changes beyond schema extension
