# Implementation Plan: Phase 1058 - Single State Consolidation

## Overview

This plan consolidates orchestration state into a single, debuggable source of truth and removes the cascading hacks that caused state drift. It also includes a stabilization track (Phase 0/1) that has already been implemented to stop the most visible UI inconsistencies.

## Status (2026-02-01)

- Phase 0: Immediate stabilization — DONE.
- Phase 1: Canonical runtime aggregator — DONE.
- Phase 2: CLI state schema extension + dashboard migration — DONE.
  - Dashboard defaults now seeded in CLI state init.
  - Orchestration service reads/writes only CLI dashboard state.
  - Runner + API routes updated to await CLI-backed orchestration writes.
- Phase 3: CLI-state runner simplification — DONE (kept OrchestrationExecution for UI compatibility).
- Phase 4: Decision logic simplification — DONE (getNextAction matrix + runner wiring).
- Phase 5: Auto-heal simplification — DONE (CLI step status healing).
- Phase 6: Hack removal — DONE (Claude fallback + workflow lookup fallback + batch guards removed).
- Phase 7: UI step override — DONE.
- Current behavior: merge step shows correctly, Running indicator is accurate, status API is read-only, phantom sessions eliminated, decision flow is deterministic.

---

## Implementation Phases

### Phase 0: Immediate Stabilization (DONE)

**Goal**: Stop the most visible state mismatches and polling loops without changing core orchestration flow.

**Key fixes**:
- S001: Map CLI `step.current=merge|complete` to UI phase (no fallback to `design`).
- S002: Use `specflow state set` for step sync; remove direct state writes from status API.
- S003: Restrict “active session” UI to `running` / `waiting_for_input` only.
- S004: Update workflow index on session end; rebuild index during process reconciliation.
- S005: Guard cancel actions when no workflow id/session id (dismiss should not cancel).
- S006: Fix failed-but-complete display by treating graceful session ends as `completed`.

**Acceptance criteria**:
- Merge step displays in sidebar/progress when CLI state is merge.
- Running indicator only appears when an actual workflow is active.
- No phantom active sessions after restart.
- Dismissing a failed banner does not throw.

---

### Phase 1: Canonical Runtime Aggregator (DONE)

**Goal**: Derive workflow state from a single runtime view instead of `.specflow/workflows/index.json`.

**Tasks**:
- S101: Add `runtime-state.ts` to build workflow data from metadata + JSONL + health.
- S102: Move CLI session discovery to `workflow-discovery.ts`.
- S103: Update watcher to use `buildWorkflowData()` for workflow events.

**Acceptance criteria**:
- Session list and current execution are consistent across reloads.
- Stale/detached sessions don’t trigger “running” UI.

---

### Phase 2: Extend CLI State Schema (DONE)

**Goal**: Add `orchestration.dashboard` section to state file.

**Files to modify**:
- `packages/shared/src/schemas/events.ts`
- `packages/cli/src/lib/state.ts`

**Tasks**:
- T001: Add DashboardState schema to shared schema.
- T002: Include dashboard in OrchestrationStateSchema.
- T003: Validate `specflow state set` works with nested dashboard fields.

---

### Phase 3: Migrate Dashboard to CLI State (PARTIAL)

**Goal**: Read/write CLI state directly.

**Tasks**:
- T004: Add helpers to read/write dashboard state via CLI.
- T005: Update orchestration-service start() to CLI state.
- T006: Update orchestration-service get() to CLI state.
- T007: Update runner to use CLI state for decisions.
- T008: Remove OrchestrationExecution references (deferred; UI compatibility layer kept).
- T009: Remove orchestration-execution schema (deferred).

---

### Phase 4: Simplify Decision Logic (DONE)

**Goal**: Replace decision logic with < 100 line state-based matrix.

**Tasks**:
- T010: Replace makeDecision() with getNextAction().
- T011: Remove createDecisionInput().
- T012: Remove legacy decision functions.
- T013: Update runner to call getNextAction().

---

### Phase 5: Auto-Heal Logic (DONE)

**Goal**: Simple rules to correct step status after workflow completion.

**Tasks**:
- T014: Add autoHealAfterWorkflow() in orchestration-runner.
- T015: Call auto-heal on session end.
- T016: Log heal actions clearly.

---

### Phase 6: Remove Hacks (DONE)

**Goal**: Delete all reconciler/guard hacks that mask state drift.

**Tasks**:
- T017: Remove state reconciliation hack (runner).
- T018: Remove workflow lookup fallback (runner).
- T019: Remove Claude analyzer fallback (runner).
- T020: Remove batch completion guard (runner).
- T021: Remove empty array guard (runner).
- T022: Simplify isPhaseComplete() to state-only check (service).

---

### Phase 7: UI Step Override (DONE)

**Goal**: Manual override to move orchestration to a prior step.

**Tasks**:
- T023: Add goBackToStep() using `specflow state set`.
- T024: Add StepOverride UI component.
- T025: Wire into project detail page.
- T026: Add integration check for external `/flow.*` runs.

---

## Task Summary

| Phase | Tasks | Description | Status |
|-------|-------|-------------|--------|
| 0 | S001-S006 | Immediate stabilization | DONE |
| 1 | S101-S103 | Canonical runtime aggregator | DONE |
| 2 | T001-T003 | Extend CLI state schema | DONE |
| 3 | T004-T009 | Migrate to CLI state | PARTIAL |
| 4 | T010-T013 | Simplify decision logic | DONE |
| 5 | T014-T016 | Auto-heal logic | DONE |
| 6 | T017-T022 | Remove hacks | DONE |
| 7 | T023-T026 | UI step override | DONE |

## Execution Order

1. Phase 2 (schema) enables dashboard migration.
2. Phase 3 (migration) unlocks simplified decision logic.
3. Phases 4–6 in order (each builds on prior).
4. Phase 7 last (UX-only change) — complete.

## Verification

- Phase 0/1: merge step shows correctly; Running indicator only when active; dismiss doesn’t error; no polling loop.
- Phase 2+: No OrchestrationExecution type; decision logic < 100 lines; all hacks removed.
