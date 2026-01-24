# Tasks: Phase 1057 - Orchestration Simplification

## Phase Goals Coverage

Phase: 1057 - Orchestration Simplification
Source: `.specify/phases/1057-orchestration-simplification.md`

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Trust step.status - If sub-command set it to complete, step is done | FR-001 | T001-T023 | COVERED |
| 2 | Complete decision matrix - Every state combination has explicit action | FR-002, FR-003 | T005-T033 | COVERED |
| 3 | Fix question flow - Wire SSE data to DecisionToast (3 files) | FR-004 | T051-T058 | COVERED |
| 4 | Claude Helper for 3 cases only - With explicit fallback chains | FR-005 | T034-T050 | COVERED |
| 5 | Eliminate race conditions - Atomic writes, spawn intent pattern | FR-006 | T059-T071 | COVERED |
| 6 | Reduce code - Target simplicity | NFR-001 | T101-T104 | COVERED |

Coverage: 6/6 goals (100%)

---

## Progress Dashboard

> Last updated: 2026-01-23 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | PENDING | 0/4 |
| Decision Logic | PENDING | 0/19 |
| Batch State Machine | PENDING | 0/10 |
| Claude Helper | PENDING | 0/17 |
| Question Flow | PENDING | 0/8 |
| Race Mitigations | PENDING | 0/13 |
| Session Tracking | PENDING | 0/11 |
| State Validation | PENDING | 0/7 |
| Decision Log UI | PENDING | 0/4 |
| Features Preserved | PENDING | 0/7 |
| Code Cleanup | PENDING | 0/4 |
| Tests | PENDING | 0/12 |
| Testing Infrastructure | PENDING | 0/7 |

**Overall**: 0/123 (0%) | **Current**: T001

---

## Phase 1: Setup

**Purpose**: Extract pure functions and set up dependency injection for testability

- [x] T001 [P] Extract `makeDecision()` as pure function in `packages/dashboard/src/lib/services/orchestration-decisions.ts`
- [x] T002 [P] Extract `handleImplementBatching()` as pure function in `packages/dashboard/src/lib/services/orchestration-decisions.ts`
- [x] T003 [P] Extract `validateState()` as pure function in `packages/dashboard/src/lib/services/orchestration-validation.ts`
- [x] T004 Create `OrchestrationDeps` interface for dependency injection in `packages/dashboard/src/lib/services/orchestration-types.ts`

**Checkpoint**: Pure functions ready for unit testing

---

## Phase 2: Decision Logic (G1)

**Purpose**: Implement complete decision matrix - every state combination has explicit action

### Pre-decision Gates

- [x] T005 [G1.1] Add budget exceeded check before matrix - if `totalCostUsd >= budget.maxTotal` → return `fail` action in `makeDecision()`
- [x] T006 [G1.2] Add duration gate (4 hour max) - if orchestration running > 4 hours → return `needs_attention` in `makeDecision()`

### Implement Phase Handling (checked first)

- [x] T007 [G1.3] Add implement phase branch - if `step.current === 'implement'`, call `handleImplementBatching()` before other checks

### Workflow Status Checks

- [x] T008 [G1.4] Handle running workflow with recent activity - `workflow.status === 'running'` + activity within 10min → `wait`
- [x] T009 [G1.5] Handle stale running workflow - `workflow.status === 'running'` + no activity for >10min → `recover_stale`
- [x] T010 [G1.6] Handle waiting for input - `workflow.status === 'waiting_for_input'` → `wait`
- [x] T011 [G1.7] Handle workflow lookup failure - workflow ID in state but `getWorkflow()` returns null → `wait_with_backoff`

### Step Complete Transitions

- [x] T012 [G1.8] Handle verify complete with USER_GATE - `step.status === 'complete'` + `current === 'verify'` + `phase.hasUserGate && userGateStatus !== 'confirmed'` → `wait_user_gate`
- [x] T013 [G1.9] Handle verify complete with autoMerge disabled - `step.status === 'complete'` + `current === 'verify'` + `!config.autoMerge` → `wait_merge`
- [x] T014 [G1.10] Handle verify complete with autoMerge enabled - `step.status === 'complete'` + `current === 'verify'` + `config.autoMerge` → `transition` to merge
- [x] T015 [G1.11] Handle merge complete - `step.status === 'complete'` + `current === 'merge'` → `complete`
- [x] T016 [G1.12] Handle other step completions - `step.status === 'complete'` + other steps → `transition` to next step

### Error States

- [x] T017 [G1.13] Handle failed step - `step.status === 'failed'` → `recover_failed`
- [x] T018 [G1.14] Handle blocked step - `step.status === 'blocked'` → `recover_failed`

### Spawn Conditions

- [x] T019 [G1.15] Handle in_progress with no workflow - `step.status === 'in_progress'` + no active workflow → `spawn`
- [x] T020 [G1.16] Handle not_started - `step.status === 'not_started'` → `spawn` (with batch init if implement)
- [x] T021 [G1.17] Handle null/undefined status - `step.status === null/undefined` → `spawn`

### No Catch-all

- [x] T022 [G1.18] Remove generic else/default case - ensure NO "unknown" handling without logging error

### REMOVE Artifact Checks

- [x] T023 [G10.1] Remove `isPhaseComplete()` artifact checks (`hasPlan`, `hasTasks`, `hasSpec`) from decision logic

**Checkpoint**: Decision matrix complete - all conditions explicitly handled

---

## Phase 3: Batch State Machine (G2)

**Purpose**: Complete batch handling for implement phase

- [x] T024 [G2.1] Handle no batches - `batches.total === 0` → `initialize_batches`
- [x] T025 [G2.2] Handle all batches complete but step not updated - all batches `completed`/`healed` + `step.status !== 'complete'` → `force_step_complete`
- [x] T026 [G2.3] Handle all batches complete with step complete - all batches complete + `step.status === 'complete'` → return `null` (let main matrix handle)
- [x] T027 [G2.4] Handle pending batch with no workflow - `currentBatch.status === 'pending'` + no workflow → `spawn_batch`
- [x] T028 [G2.5] Handle running batch - `currentBatch.status === 'running'` + workflow running → return `null` (let staleness check handle)
- [x] T029 [G2.6] Handle completed batch with pause enabled - `currentBatch.status === 'completed'` + `config.pauseBetweenBatches` → `pause`
- [x] T030 [G2.7] Handle completed batch without pause - `currentBatch.status === 'completed'` + `!pauseBetweenBatches` + more batches → `advance_batch`
- [x] T031 [G2.8] Handle healed batch - `currentBatch.status === 'healed'` + more batches → `advance_batch`
- [x] T032 [G2.9] Handle failed batch with attempts remaining - `currentBatch.status === 'failed'` + `healAttempts < maxHealAttempts` → `heal_batch`
- [x] T033 [G2.10] Handle failed batch with no attempts - `currentBatch.status === 'failed'` + `healAttempts >= maxHealAttempts` → `recover_failed`

**Checkpoint**: Batch state machine complete

---

## Phase 4: Claude Helper (G3)

**Purpose**: Exactly 3 Claude Helper use cases with silent fallbacks

### Case 1: Corrupt/Missing State

- [x] T034 [G3.1] Create `recoverStateWithClaudeHelper()` function in `packages/dashboard/src/lib/services/claude-helper.ts`
- [x] T035 [G3.2] Create `.bak` backup BEFORE attempting recovery
- [x] T036 [G3.3] Call Claude Helper with `task: 'recover_state'`
- [x] T037 [G3.4] If Claude Helper succeeds + confidence > 0.7 → use recovered state
- [x] T038 [G3.5] If Claude Helper fails → try `tryHeuristicStateRecovery()` (silent, no UI notification)
- [x] T039 [G3.6] If heuristic fails → return null (caller sets `needs_attention`)

### Case 2: Stale Workflow

- [x] T040 [G3.7] Create `handleStaleWorkflow()` function in `packages/dashboard/src/lib/services/claude-helper.ts`
- [x] T041 [G3.8] Call Claude Helper with `task: 'diagnose_stale_workflow'`
- [x] T042 [G3.9] Handle response actions: `continue`, `restart_task`, `skip_task`, `abort`
- [x] T043 [G3.10] If Claude Helper fails → set `needs_attention` (silent, no error toast)

### Case 3: Failed Step

- [x] T044 [G3.11] Create `handleFailedStep()` function in `packages/dashboard/src/lib/services/orchestration-recovery.ts`
- [x] T045 [G3.12] Pre-check `healAttempts >= maxHealAttempts` → skip Claude Helper, go to `needs_attention`
- [x] T046 [G3.13] Call Claude Helper with `task: 'diagnose_failed_step'`
- [x] T047 [G3.14] Handle response actions: `retry`, `skip_tasks`, `run_prerequisite`, `abort`
- [x] T048 [G3.15] If Claude Helper fails + heal attempts remaining → simple retry (silent)
- [x] T049 [G3.16] If Claude Helper fails + no attempts remaining → `needs_attention` (silent)

### Verification

- [x] T050 [G3.17] Verify Claude Helper only called for these 3 cases (grep codebase)

**Checkpoint**: Claude Helper restricted to exactly 3 cases

---

## Phase 5: Question Flow (G4)

**Purpose**: Fix data plumbing from watcher to UI

### use-sse.ts

- [x] T051 [G4.2] Add `sessionQuestions` state (type: `Map<string, SessionQuestion[]>`) in `packages/dashboard/src/hooks/use-sse.ts`
- [x] T052 [G4.3] Add `session:question` case in switch to populate `sessionQuestions` map
- [x] T053 [G4.4] Return `sessionQuestions` from hook

### unified-data-context.tsx

- [x] T054 [G4.5] Include `sessionQuestions` in context value in `packages/dashboard/src/contexts/unified-data-context.tsx`

### page.tsx

- [x] T055 [G4.6] Remove hardcoded `decisionQuestions = []` in `packages/dashboard/src/app/projects/[id]/page.tsx`
- [x] T056 [G4.7] Read `decisionQuestions` from `sessionQuestions.get(consoleSessionId)`
- [x] T057 [G4.8] Clear questions from map after user answers

### Pre-verification

- [x] T058 [G4.1] Manual test confirms watcher.ts detects questions and emits `session:question` SSE event

**Checkpoint**: Question flow fixed - questions display in UI

---

## Phase 6: Race Condition Mitigations (G5)

**Purpose**: Prevent race conditions with atomic operations

### Atomic State Writes

- [x] T059 [G5.1] Implement atomic writes - `writeOrchestrationState()` writes to `.tmp` file first in `packages/dashboard/src/lib/services/orchestration-service.ts`
- [x] T060 [G5.2] Use `rename()` for atomic swap after writing temp file

### Spawn Intent Pattern

- [x] T061 [G5.3] Create `spawnWorkflowWithIntent()` function in `packages/dashboard/src/lib/services/orchestration-runner.ts`
- [x] T062 [G5.4] Check for existing spawn intent before spawning
- [x] T063 [G5.5] Check `hasActiveWorkflow()` before spawning
- [x] T064 [G5.6] Write spawn intent to file/state BEFORE calling `workflowService.start()`
- [x] T065 [G5.7] Clear spawn intent in `finally` block (regardless of success/failure)

### Persistent Runner State

- [x] T066 [G5.8] Implement `persistRunnerState()` to write `runner-{orchestrationId}.json` with PID and startedAt
- [x] T067 [G5.9] Implement `clearRunnerState()` to remove file when loop exits
- [x] T068 [G5.10] Call `reconcileRunners()` on dashboard startup to detect orphans

### Event Sleep Fix

- [x] T069 [G5.11] Change `eventSignals` to use `Map<string, Set<() => void>>` (not single callback)
- [x] T070 [G5.12] Update `eventDrivenSleep()` to add callback to Set
- [x] T071 [G5.13] Update `wakeUp()` to iterate Set and call all callbacks

**Checkpoint**: Race conditions eliminated

---

## Phase 7: Unified Session Tracking (G6)

**Purpose**: Detect sessions from CLI as well as dashboard

### File Watching

- [x] T072 [G6.1] Watch `~/.claude/projects/{hash}/` directory in `packages/dashboard/src/lib/watcher.ts`
- [x] T073 [G6.2] Detect new `.jsonl` files (new sessions from CLI)
- [x] T074 [G6.3] Detect modified `.jsonl` files (session activity from CLI)
- [x] T075 [G6.4] Emit `session:created` SSE event for new files
- [x] T076 [G6.5] Emit `session:activity` SSE event for modifications

### Orchestration Integration

- [x] T077 [G6.6] External session activity updates `lastActivity` in orchestration
- [x] T078 [G6.7] Omnibox commands in session viewer update orchestration state

### Pause/Resume UI

- [x] T079 [G6.8] Verify pause button exists and sets `status: 'paused'`
- [x] T080 [G6.9] When paused, pause button becomes Play button
- [x] T081 [G6.10] Play button click resumes orchestration
- [x] T082 [G6.11] Omnibox command while paused resumes orchestration

**Checkpoint**: External CLI sessions detected

---

## Phase 8: State Validation (G7)

**Purpose**: Validate state consistency

- [x] T083 [G7.1] Check `step.index === STEP_INDEX_MAP[step.current]` in `validateState()`
- [x] T084 [G7.2] Check `step.current` is in `['design', 'analyze', 'implement', 'verify', 'merge']`
- [x] T085 [G7.3] Check `step.status` is in valid statuses
- [x] T086 [G7.4] Check `batches.items[i].index === i`
- [x] T087 [G7.5] Check `batches.current < batches.total` (unless all complete)
- [x] T088 [G7.6] Check `recoveryContext` exists when `status === 'needs_attention'`
- [x] T089 [G7.7] Check cross-file consistency (state step vs execution phase)

**Checkpoint**: State validation complete

---

## Phase 9: Decision Log UI (G8)

**Purpose**: Wire decision log to UI

- [x] T090 [G8.1] Implement `logDecision()` to write to `orchestration.decisionLog` array
- [x] T091 [G8.2] Phase Completion card reads from `decisionLog`
- [x] T092 [G8.3] New decision matrix decisions appear in UI
- [x] T093 [G8.4] Log entries include timestamp, action, and reason

**Checkpoint**: Decision log visible in UI

---

## Phase 10: Features Preserved (G9)

**Purpose**: Ensure cost tracking and heal attempts are preserved

### Cost Tracking

- [x] T094 [G9.1] Verify `addCost()` is called after workflow completes
- [x] T095 [G9.2] Verify `totalCostUsd` accumulates across workflows
- [x] T096 [G9.3] Verify budget exceeded triggers `fail` action (covered by T005/G1.1)

### Heal Attempts

- [x] T097 [G9.4] Verify `healAttempts` counter exists in execution state
- [x] T098 [G9.5] Verify `incrementHealAttempts()` is called before retry
- [x] T099 [G9.6] Verify max heal attempts check prevents infinite loops (covered by T045/G3.12)
- [x] T100 [G9.7] Track batch-level `healAttempts` separately from step-level

**Checkpoint**: Features preserved

---

## Phase 11: Code Cleanup (G10)

**Purpose**: Remove duplicate/obsolete code

- [x] T101 [G10.1] Remove `isPhaseComplete()` artifact checks (covered by T023)
- [x] T102 [G10.2] Consolidate duplicate `getNextPhase()` functions
- [x] T103 [G10.3] Consolidate duplicate `isStepComplete()` functions
- [x] T104 [G10.4] Ensure `orchestration-service.ts` contains only persistence logic (no decision logic)

**Checkpoint**: Code simplified

---

## Phase 12: Tests (G11)

**Purpose**: Unit and integration tests

### Unit Tests

- [x] T105 [G11.1] Test for `makeDecision()` covers all G1.* conditions in `packages/dashboard/tests/orchestration/decision-matrix.test.ts`
- [x] T106 [G11.2] Test for `handleImplementBatching()` covers all G2.* conditions
- [x] T107 [G11.3] Test for `validateState()` covers all G7.* conditions
- [x] T108 [G11.4] Test for `spawnWorkflowWithIntent()` prevents duplicate spawns

### Integration Tests

- [x] T109 [G11.5] Happy path test: design → analyze → implement → verify → merge (autoMerge=true)
- [x] T110 [G11.6] Manual merge test: verify → wait_merge (autoMerge=false)
- [x] T111 [G11.7] USER_GATE test: verify → wait_user_gate → confirm → merge
- [x] T112 [G11.8] Question flow test: workflow asks → toast appears → answer → resumes
- [x] T113 [G11.9] Batch test: implement with multiple batches sequentially
- [x] T114 [G11.10] Pause/resume test: pause button → play button → resume
- [x] T115 [G11.11] External CLI test: start session from terminal → dashboard detects
- [x] T116 [G11.12] Race condition test: rapid spawn triggers → only one workflow

**Checkpoint**: Tests pass

---

## Phase 13: Testing Infrastructure (G12)

**Purpose**: Set up test fixtures and harness

### Pure Function DI

- [x] T117 [G12.1] Verify `makeDecision()` is pure function (no direct I/O)
- [x] T118 [G12.2] Verify `handleImplementBatching()` is pure function
- [x] T119 [G12.3] Verify `validateState()` is pure function
- [x] T120 [G12.4] Verify `runOrchestrationLoop()` accepts `OrchestrationDeps` parameter

### Test Fixtures

- [x] T121 [G12.5-9] Create test fixtures in `packages/dashboard/tests/fixtures/orchestration/` including `state/`, `execution/`, `workflows/`, `helpers.ts`
- [x] T122 [G12.8] Create JSONL fixtures in `packages/dashboard/tests/fixtures/jsonl/`

### E2E Harness (Optional - defer if time-constrained)

- [x] T123 [G12.29-35] Create E2E test harness script and setup

**Checkpoint**: Testing infrastructure ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Decision Logic (Phase 2)**: Depends on Setup
- **Batch State Machine (Phase 3)**: Depends on Setup (uses same pure functions)
- **Claude Helper (Phase 4)**: Can proceed in parallel with Phase 2-3
- **Question Flow (Phase 5)**: Can proceed in parallel with Phase 2-4
- **Race Mitigations (Phase 6)**: Depends on Phase 2 (needs decision logic in place)
- **Session Tracking (Phase 7)**: Depends on Phase 5 (question flow patterns)
- **State Validation (Phase 8)**: Depends on Setup
- **Decision Log UI (Phase 9)**: Depends on Phase 2 (needs decision types)
- **Features Preserved (Phase 10)**: Verification only, can run after Phase 2
- **Code Cleanup (Phase 11)**: Depends on Phase 2-6 being complete
- **Tests (Phase 12)**: Depends on all functional phases
- **Testing Infrastructure (Phase 13)**: Can proceed in parallel with Phase 12

### Parallel Opportunities

Phases 2-5 have significant parallelism opportunity:
- Decision Logic (Phase 2) + Batch State Machine (Phase 3) share same file
- Claude Helper (Phase 4) is isolated
- Question Flow (Phase 5) is isolated

---

## Notes

- [P] tasks = different files, no dependencies
- [G#.#] = Maps to verifiable goal in plan.md
- Each phase should be independently completable
- Commit after each phase or logical group
- Reference: plan.md for detailed pseudocode and specifications
