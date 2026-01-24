# Phase 1058: Single State Consolidation

## Overview

**Goal**: Consolidate the orchestration system to use a single state file (`.specflow/orchestration-state.json`) as the source of truth, eliminating the parallel `OrchestrationExecution` state in the dashboard.

**Why**: Phase 1057 work revealed that the orchestration system has become a mess of hacks working around edge cases. There are multiple sources of truth (CLI state file vs dashboard OrchestrationExecution), reconciliation hacks, guards that block decisions after they're already wrong, and a Claude analyzer as fallback when nothing makes sense.

## Phase Goals

1. **Single source of truth** - `.specflow/orchestration-state.json` is THE state (no OrchestrationExecution)
2. **Trust sub-commands** - Sub-commands update step.status; dashboard watches and auto-heals if needed
3. **Simple decision logic** - Decision logic < 100 lines, based only on state file
4. **Remove all hacks** - No reconciliation, no guards, no Claude analyzer fallback
5. **Manual override** - User can manually go back to previous step via UI

## USER GATE Criteria

Before completing this phase, verify:

1. **Single state file**: `OrchestrationExecution` type is removed, all state lives in `.specflow/orchestration-state.json`
2. **Decision logic is simple**: `orchestration-decisions.ts` is < 100 lines (currently ~700)
3. **No hacks**: Search codebase for removed hacks (state reconciliation, batch guards, Claude analyzer)
4. **Manual override works**: Can click "Go back to Analyze" in UI and orchestration resumes from there

## Key Changes

### 1. Extend CLI State Schema

Add `orchestration.dashboard` section:
```json
{
  "orchestration": {
    "dashboard": {
      "active": { "id": "uuid", "startedAt": "timestamp", "config": {} },
      "batches": { "total": 3, "current": 0, "items": [...] },
      "cost": { "total": 0, "perBatch": [] },
      "decisionLog": [...],
      "lastWorkflow": { "id": "...", "skill": "...", "status": "..." }
    }
  }
}
```

### 2. Simplify Decision Logic

```typescript
function getNextAction(state): Decision {
  // Trust the state file. Period.
  const { step, dashboard } = state.orchestration;

  if (!dashboard?.active) return { action: 'idle' };
  if (dashboard.lastWorkflow?.status === 'running') return { action: 'wait' };

  switch (step.current) {
    case 'design': return step.status === 'complete' ? transition('analyze') : spawn('flow.design');
    case 'analyze': return step.status === 'complete' ? transition('implement') : spawn('flow.analyze');
    case 'implement': return handleBatches(state);
    case 'verify': return step.status === 'complete' ? mergeOrWait(state) : spawn('flow.verify');
  }
}
```

### 3. Auto-Heal After Workflow

Simple rules when workflow ends:
- If ran flow.design and session completed → expect step.status=complete
- If not, fix it
- Only use Claude for truly ambiguous cases

### 4. Remove Hacks

| Hack | What to remove |
|------|----------------|
| State reconciliation | Line 889-893 in orchestration-runner.ts |
| Workflow lookup fallback | Line 1134-1142 in orchestration-runner.ts |
| Claude analyzer | Line 1450-1454 in orchestration-runner.ts |
| Batch guards | Line 1570-1584 in orchestration-runner.ts |
| Circular phase completion | Line 291-295 in orchestration-service.ts |

## Dependencies

- Phase 1057 complete (provides the foundation work)
- No external dependencies

## Reference

See `specs/1057-orchestration-simplification/SIMPLIFICATION_PLAN.md` for detailed implementation plan (moved to archive but still referenced).
