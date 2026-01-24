# Implementation Plan: Phase 1058 - Single State Consolidation

## Overview

This plan consolidates the orchestration system to use a single state file, eliminating parallel state and enabling dramatic simplification.

## Implementation Phases

### Phase 1: Extend CLI State Schema

**Goal**: Add `orchestration.dashboard` section to state file

**Files to modify**:
- `packages/shared/src/schemas/events.ts` - Add DashboardState schema
- `packages/cli/src/lib/state.ts` - Ensure new fields work with state set

**New schema**:
```typescript
const DashboardStateSchema = z.object({
  active: z.object({
    id: z.string().uuid(),
    startedAt: z.string().datetime(),
    config: OrchestrationConfigSchema,
  }).nullable(),

  batches: z.object({
    total: z.number(),
    current: z.number(),
    items: z.array(z.object({
      section: z.string(),
      taskIds: z.array(z.string()),
      status: z.enum(['pending', 'running', 'completed', 'failed', 'healed']),
      workflowId: z.string().optional(),
      healAttempts: z.number().default(0),
    })),
  }).default({ total: 0, current: 0, items: [] }),

  cost: z.object({
    total: z.number().default(0),
    perBatch: z.array(z.number()).default([]),
  }).default({ total: 0, perBatch: [] }),

  decisionLog: z.array(z.object({
    timestamp: z.string().datetime(),
    action: z.string(),
    reason: z.string(),
  })).default([]),

  lastWorkflow: z.object({
    id: z.string(),
    skill: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  }).nullable(),
});

// Add to OrchestrationStateSchema:
orchestration: z.object({
  // ... existing fields ...
  dashboard: DashboardStateSchema.optional(),
})
```

**Tasks**:
- T001: Add DashboardState schema to shared/schemas/events.ts
- T002: Update OrchestrationStateSchema to include dashboard field
- T003: Test state set/get with new nested fields

---

### Phase 2: Migrate Dashboard to CLI State

**Goal**: Remove OrchestrationExecution, read/write CLI state directly

**Files to modify**:
- `packages/dashboard/src/lib/services/orchestration-service.ts` - Use CLI state
- `packages/dashboard/src/lib/services/orchestration-runner.ts` - Read CLI state
- Remove: `packages/shared/src/schemas/orchestration-execution.ts`

**Migration approach**:
1. Create helper to read/write dashboard section of CLI state
2. Replace OrchestrationExecution reads with CLI state reads
3. Replace OrchestrationExecution writes with `specflow state set`
4. Remove OrchestrationExecution type

**Tasks**:
- T004: Create readDashboardState() and writeDashboardState() helpers
- T005: Update orchestration-service.ts start() to use CLI state
- T006: Update orchestration-service.ts get() to read CLI state
- T007: Update orchestration-runner.ts to use CLI state for decisions
- T008: Remove OrchestrationExecution type and related code
- T009: Remove orchestration-execution.ts schema file

---

### Phase 3: Simplify Decision Logic

**Goal**: Rewrite decisions to be < 100 lines

**File**: `packages/dashboard/src/lib/services/orchestration-decisions.ts`

**New implementation**:
```typescript
export function getNextAction(state: OrchestrationState): Decision {
  const { step } = state.orchestration;
  const dashboard = state.orchestration.dashboard;

  // No active orchestration
  if (!dashboard?.active) {
    return { action: 'idle', reason: 'No active orchestration' };
  }

  // Workflow running - wait
  if (dashboard.lastWorkflow?.status === 'running') {
    return { action: 'wait', reason: 'Workflow running' };
  }

  // Decision based on step
  switch (step.current) {
    case 'design':
      return handleStep('design', 'analyze', step, dashboard);
    case 'analyze':
      return handleStep('analyze', 'implement', step, dashboard);
    case 'implement':
      return handleImplement(step, dashboard);
    case 'verify':
      return handleVerify(step, dashboard);
    default:
      return { action: 'error', reason: `Unknown step: ${step.current}` };
  }
}

function handleStep(current: string, next: string, step, dashboard): Decision {
  if (step.status === 'complete') {
    return { action: 'transition', nextStep: next };
  }
  if (step.status === 'failed') {
    return { action: 'heal', step: current };
  }
  if (!dashboard.lastWorkflow) {
    return { action: 'spawn', skill: `flow.${current}` };
  }
  return { action: 'wait', reason: `${current} in progress` };
}

function handleImplement(step, dashboard): Decision {
  const { batches } = dashboard;

  // All batches done
  if (allBatchesComplete(batches)) {
    return { action: 'transition', nextStep: 'verify' };
  }

  const current = batches.items[batches.current];
  if (current.status === 'completed') {
    return { action: 'advance_batch' };
  }
  if (current.status === 'failed') {
    return { action: 'heal_batch', batchIndex: batches.current };
  }
  if (current.status === 'pending' && !dashboard.lastWorkflow) {
    return { action: 'spawn_batch', batch: current };
  }

  return { action: 'wait', reason: 'Batch in progress' };
}

function handleVerify(step, dashboard): Decision {
  if (step.status === 'complete') {
    const { config } = dashboard.active;
    if (config.autoMerge) {
      return { action: 'transition', nextStep: 'merge' };
    }
    return { action: 'wait_merge' };
  }
  if (step.status === 'failed') {
    return { action: 'heal', step: 'verify' };
  }
  if (!dashboard.lastWorkflow) {
    return { action: 'spawn', skill: 'flow.verify' };
  }
  return { action: 'wait', reason: 'Verify in progress' };
}
```

**Tasks**:
- T010: Replace makeDecision() with getNextAction() (< 100 lines)
- T011: Remove createDecisionInput() adapter
- T012: Remove legacy makeDecision() function
- T013: Update runner to use new decision function

---

### Phase 4: Add Auto-Heal Logic

**Goal**: Simple rules to fix state after workflow completes

**File**: `packages/dashboard/src/lib/services/orchestration-runner.ts`

**Implementation**:
```typescript
async function autoHealAfterWorkflow(
  state: OrchestrationState,
  completedSkill: string,
  workflowStatus: 'completed' | 'failed'
): Promise<boolean> {
  const { step } = state.orchestration;
  const expectedStep = getExpectedStepForSkill(completedSkill);

  // Workflow completed successfully
  if (workflowStatus === 'completed') {
    // Check if step matches and status is complete
    if (step.current === expectedStep && step.status !== 'complete') {
      console.log(`[auto-heal] Setting ${expectedStep}.status = complete`);
      await execAsync(`specflow state set orchestration.step.status=complete`);
      return true;
    }
  }

  // Workflow failed - mark step as failed if not already
  if (workflowStatus === 'failed' && step.status !== 'failed') {
    console.log(`[auto-heal] Setting ${expectedStep}.status = failed`);
    await execAsync(`specflow state set orchestration.step.status=failed`);
    return true;
  }

  return false; // No healing needed
}

function getExpectedStepForSkill(skill: string): string {
  const map = {
    'flow.design': 'design',
    'flow.analyze': 'analyze',
    'flow.implement': 'implement',
    'flow.verify': 'verify',
    'flow.merge': 'merge',
  };
  return map[skill] || 'unknown';
}
```

**Tasks**:
- T014: Add autoHealAfterWorkflow() function
- T015: Call auto-heal when workflow ends
- T016: Add logging for heal actions

---

### Phase 5: Remove Hacks

**Goal**: Delete all identified hack code

**Hacks to remove**:

| Task | File | Lines | Description |
|------|------|-------|-------------|
| T017 | orchestration-runner.ts | 889-893 | State reconciliation |
| T018 | orchestration-runner.ts | 1134-1142 | Workflow lookup fallback |
| T019 | orchestration-runner.ts | 1450-1454 | Claude analyzer fallback |
| T020 | orchestration-runner.ts | 1570-1584 | Batch completion guard |
| T021 | orchestration-runner.ts | 1030-1037 | Empty array guard |
| T022 | orchestration-service.ts | 291-295 | Circular phase completion (isPhaseComplete) |

**Tasks**:
- T017: Remove state reconciliation hack
- T018: Remove workflow lookup fallback
- T019: Remove Claude analyzer fallback
- T020: Remove batch completion guard
- T021: Remove empty array guard
- T022: Remove isPhaseComplete() or simplify to state-only check

---

### Phase 6: Add UI Step Override

**Goal**: Button to manually go back to previous step

**Files to modify**:
- `packages/dashboard/src/components/orchestration/orchestration-progress.tsx` (or similar)
- `packages/dashboard/src/lib/services/orchestration-service.ts`

**Implementation**:
```tsx
// Component
function StepOverride({ currentStep }: { currentStep: string }) {
  const steps = ['design', 'analyze', 'implement', 'verify'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex gap-2">
      {steps.slice(0, currentIndex).map(step => (
        <Button
          key={step}
          variant="outline"
          size="sm"
          onClick={() => goBackToStep(step)}
        >
          Go back to {step}
        </Button>
      ))}
    </div>
  );
}

// Service
async function goBackToStep(step: string) {
  await execAsync(`specflow state set \
    orchestration.step.current=${step} \
    orchestration.step.status=not_started
  `);
  // Runner will detect change and spawn appropriate workflow
}
```

**Tasks**:
- T023: Add goBackToStep() to orchestration-service
- T024: Add StepOverride UI component
- T025: Wire up to project detail page
- T026: Integration test for external CLI runs

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | T001-T003 | Extend CLI state schema |
| 2 | T004-T009 | Migrate to CLI state |
| 3 | T010-T013 | Simplify decision logic |
| 4 | T014-T016 | Add auto-heal |
| 5 | T017-T022 | Remove hacks |
| 6 | T023-T026 | UI step override + integration test |

**Total**: 26 tasks

## Execution Order

1. Phase 1 first (schema changes enable everything)
2. Phase 2 next (migration)
3. Phases 3-5 can be done in order (each builds on previous)
4. Phase 6 last (UX enhancement)

## Verification

After implementation:
- [ ] No `OrchestrationExecution` type in codebase
- [ ] `orchestration-decisions.ts` < 100 lines
- [ ] All 6 hacks removed (grep confirms)
- [ ] Can manually override step via UI
- [ ] External CLI runs don't break orchestration
