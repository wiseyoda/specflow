# Resume Plan - Single State Consolidation (Phase 1058)

Last updated: 2026-02-01
Branch: 1058-single-state-consolidation
Last commit: a3f0309 (phase3-6: simplify orchestration runner decisions)
Remote: origin/1058-single-state-consolidation (pushed)
Working tree: clean

## Why this file exists
Compact, actionable context so work can resume quickly after interruption.

## Current State (after Phase 6 refactor)
### ✅ Stabilization & runtime aggregation complete
- Phase 0/1 fixes are in place (merge step mapping, running indicator accuracy, index rebuild, session end handling).
- Runtime aggregator uses JSONL/metadata health (no stale `index.json` reliance).

### ✅ CLI state is the single source of truth
- Orchestration dashboard state lives under `orchestration.dashboard` in CLI state.
- Dashboard service reads/writes only CLI state (no legacy orchestration files).
- Runner + API routes use CLI state-backed updates.

### ✅ Decision logic simplified
- `orchestration-decisions.ts` rewritten to a small, state-based decision matrix.
- Removed legacy decision adapters, staleness backoff, Claude analyzer fallback.
- Removed workflow lookup fallback and batch completion guards.
- Runner now uses `readOrchestrationStep()` + `readDashboardState()` for inputs.

### ✅ Auto-heal simplified
- `autoHealAfterWorkflow` now reads CLI step state and only updates when step matches the workflow skill.
- State healing is deterministic (no Claude fallback).

### ✅ Tests updated
- Decision tests rewritten for the simplified matrix.
- Runner tests updated to mock `readDashboardState` + `readOrchestrationStep`.
- Removed obsolete Claude fallback test block and old OrchestrationDeps fixtures.

## Remaining Work
1) **Phase 7 UI Step Override**
   - Add `goBackToStep()` (CLI state set).
   - Create StepOverride UI.
   - Wire into project detail page.
   - Add integration check for external `/flow.*` runs.

2) **Deferred cleanup (optional)**
   - Remove `OrchestrationExecution` compatibility layer and schema once UI is migrated.

## Key Files (recently touched)
- `packages/dashboard/src/lib/services/orchestration-decisions.ts`
- `packages/dashboard/src/lib/services/orchestration-runner.ts`
- `packages/dashboard/src/lib/services/orchestration-service.ts`
- `packages/dashboard/tests/orchestration/orchestration-decisions.test.ts`
- `packages/dashboard/tests/orchestration/orchestration-runner.test.ts`
- `packages/dashboard/tests/fixtures/orchestration/helpers.ts`

## How to Resume
1) Run quick sanity checks (lint/tests) if desired.
2) Implement Phase 7 UI step override.
3) Decide whether to remove `OrchestrationExecution` compatibility layer.
4) Update plan/status docs and commit/push.
