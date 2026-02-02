# Tasks: Phase 1058 - Single State Consolidation

## Phase Goals Coverage

Phase: 1058 - Single State Consolidation
Source: `.specify/phases/1058-single-state-consolidation.md`

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Single source of truth | FR-001 | T001-T009 | COVERED |
| 2 | Trust sub-commands | FR-003 | T014-T016 | COVERED |
| 3 | Simple decision logic | FR-002 | T010-T013 | COVERED |
| 4 | No hacks | FR-004 | T017-T022 | COVERED |
| 5 | Manual override | FR-005 | T023-T025 | COVERED |

Coverage: 5/5 goals (100%)

---

## Progress Dashboard

> Last updated: 2026-01-24 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| CLI State Schema | PENDING | 0/3 |
| Migrate to CLI State | PENDING | 0/6 |
| Simplify Decision Logic | PENDING | 0/4 |
| Auto-Heal Logic | PENDING | 0/3 |
| Remove Hacks | PENDING | 0/6 |
| UI Step Override | PENDING | 0/4 |

**Overall**: 0/26 (0%) | **Current**: T001

---

## Phase 1: CLI State Schema Extension

**Purpose**: Add `orchestration.dashboard` section to CLI state file schema

- [x] T001 Add `DashboardStateSchema` to `packages/shared/src/schemas/events.ts` with active, batches, cost, decisionLog, lastWorkflow fields
- [x] T002 Update `OrchestrationStateSchema` to include optional `dashboard` field in orchestration section
- [x] T003 Test `specflow state set/get` works with new nested dashboard fields (e.g., `orchestration.dashboard.active.id`)

**Checkpoint**: Can read/write dashboard state via CLI

---

## Phase 2: Migrate Dashboard to CLI State

**Purpose**: Remove OrchestrationExecution, use CLI state as single source

- [x] T004 Create `readDashboardState(projectPath)` and `writeDashboardState(projectPath, data)` helpers in `packages/dashboard/src/lib/services/orchestration-service.ts`
- [x] T005 Update `orchestration-service.ts` `start()` to write to CLI state via `specflow state set` instead of creating OrchestrationExecution
- [x] T006 Update `orchestration-service.ts` `get()` to read from CLI state file instead of execution store
- [x] T007 Update `orchestration-runner.ts` main loop to read CLI state for decision input
- [x] T008 Remove all references to `OrchestrationExecution` type throughout dashboard codebase
- [x] T009 Delete `packages/shared/src/schemas/orchestration-execution.ts` and remove exports

**Checkpoint**: No OrchestrationExecution in codebase

---

## Phase 3: Simplify Decision Logic

**Purpose**: Rewrite decisions to be < 100 lines, trust state file

- [x] T010 [P] Replace `makeDecision()` with new `getNextAction()` function (< 100 lines) in `packages/dashboard/src/lib/services/orchestration-decisions.ts`
- [x] T011 [P] Remove `createDecisionInput()` adapter function - no longer needed with single state
- [x] T012 [P] Remove legacy `makeDecision()` and `makeDecisionWithAdapter()` functions
- [x] T013 Update `orchestration-runner.ts` to call new `getNextAction()` with CLI state

**Checkpoint**: Decision logic < 100 lines

---

## Phase 4: Auto-Heal Logic

**Purpose**: Simple rules to fix state after workflow completes

- [x] T014 Add `autoHealAfterWorkflow(state, skill, status)` function in `packages/dashboard/src/lib/services/orchestration-runner.ts`
- [x] T015 Call `autoHealAfterWorkflow()` when workflow session ends (detect via file watcher)
- [x] T016 Add debug logging for heal actions (what was wrong, what was fixed)

**Checkpoint**: State auto-corrects after workflow completes

---

## Phase 5: Remove Hacks

**Purpose**: Delete all hack code that's no longer needed

- [x] T017 Remove state reconciliation hack at `orchestration-runner.ts:889-893` (stepStatus = stateFileStep === currentPhase ? rawStatus : 'not_started')
- [x] T018 Remove workflow lookup fallback at `orchestration-runner.ts:1134-1142` (if existingWorkflowId but no workflow, wait)
- [x] T019 Remove Claude analyzer fallback at `orchestration-runner.ts:1450-1454` (analyzeStateWithClaude on unclear state)
- [x] T020 Remove batch completion guard at `orchestration-runner.ts:1570-1584`
- [x] T021 Remove empty array guard at `orchestration-runner.ts:1030-1037` (batches.items.length > 0 && completedCount)
- [x] T022 Remove or simplify `isPhaseComplete()` in `orchestration-service.ts:278-325` to only check `step.status` (no artifact checks)

**Checkpoint**: Grep confirms all hacks removed

---

## Phase 6: UI Step Override

**Purpose**: Allow user to manually go back to previous step

- [x] T023 Add `goBackToStep(step: string)` function to `packages/dashboard/src/lib/services/orchestration-service.ts` that calls `specflow state set orchestration.step.current={step} orchestration.step.status=not_started`
- [x] T024 Create `StepOverride` component in `packages/dashboard/src/components/orchestration/` that shows buttons to go back to previous steps
- [x] T025 Add `StepOverride` component to project detail page orchestration section
- [x] T026 Add integration test: Run `/flow.implement` externally from terminal, verify dashboard picks up from correct state (doesn't jump to analyze)

**Checkpoint**: Can click "Go back to Analyze" and orchestration resumes from there; external CLI runs don't break orchestration

---

## Dependencies

```
T001-T003 (Schema) → T004-T009 (Migration) → T010-T013 (Decisions)
                                           ↓
                     T014-T016 (Auto-Heal) → T017-T022 (Remove Hacks)
                                           ↓
                                    T023-T025 (UI Override)
```

---

## Notes

- [P] = Parallelizable within the phase
- All state writes should go through `specflow state set` for consistency
- Test each phase checkpoint before proceeding
- Reference: `specs/1058-single-state-consolidation/plan.md` for implementation details
