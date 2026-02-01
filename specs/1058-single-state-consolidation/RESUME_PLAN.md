# Resume Plan - Single State Consolidation (Phase 1058)

Last updated: 2026-02-01
Branch: 1058-single-state-consolidation
Last commit: 8c517ce ("chore: checkpoint local changes")
Remote: origin/1058-single-state-consolidation (pushed)
Working tree: dirty (Phase 0/1 fixes implemented, Phase 2 started, not yet committed)

## Why this file exists
This is a compact, actionable plan so work can resume quickly after context compaction or interruption.

## Context / Problem Summary
Observed UI issues in the dashboard after restart:
- Current phase displays as **Design** even when the actual step is **Merge**.
- Top header shows **Running** with a green indicator and a timer, even when no session is active.
- Session viewer shows an "active" session when there isn't one.
- Selecting a completed session flips UI to "Ready" (correct), which reveals mismatch between session JSONL and workflow index state.

Root causes (confirmed by code trace):
1) Orchestration phase mapping drops `merge` (falls back to design).
2) Workflow "active" status is derived from `.specflow/workflows/index.json` and includes `detached/stale`, so stale entries show as running.
3) Session JSONL end detection emits `session:end` but does **not** update workflow index.
4) Reconciliation updates workflow metadata but does **not** rebuild `index.json`, so stale running entries persist.

## Completed Fixes (Phase 0 + Phase 1)
These are already implemented locally to stop UI bugs and make runtime state coherent.

### Phase 0 (stability)
- Phase mapping includes `merge` + `complete` (no default to `design`).
- All step syncs use `specflow state set` (no direct writes from status API).
- Dismiss no longer throws when no workflow id/session id is present.
- Active execution only when status is `running` or `waiting_for_input`.
- Session end is treated as completed when JSONL ends.
- Reconciliation rebuilds workflow index to avoid stale running entries.

### Phase 1 (runtime aggregator)
- Added `runtime-state.ts` to compute workflow sessions from metadata + JSONL + health.
- Moved CLI discovery to `workflow-discovery.ts`.
- Watcher now emits workflow state from `buildWorkflowData()` (no direct index.json read).

Acceptance criteria met:
- If CLI state says `merge`, UI displays Merge step in sidebar and progress bar.
- "Running" indicator only appears when a workflow is actually active.
- Session viewer does not show phantom active sessions.

## Remaining Refactor Plan (Phases 2+)
This refactor simplifies state management and makes it debuggable.

### Phase 2: Orchestration Single Source of Truth
- Use CLI state as the canonical orchestration state.
- Replace remaining direct JSON edits with `specflow state set`.
- Make orchestration transitions go through a single helper in `orchestration-service`.

Phase 2 started:
- Added dashboard defaults to CLI `createInitialState()` so new projects include `orchestration.dashboard`.
- Orchestration service now reads/writes ONLY CLI dashboard state (legacy orchestration files removed).
- Process reconciler no longer reads orchestration-*.json files.
- Runner + orchestration API routes updated to await CLI-backed orchestration writes.

### Phase 3: Simplify decision logic + auto-heal
- Replace complex guards with a short state-based decision matrix.
- Auto-heal after workflow completion with deterministic rules.

### Phase 4: Tests
- Add unit tests for runtime-state, session end detection, and phase mapping.

## Files to Touch (most relevant)
- `packages/dashboard/src/lib/services/orchestration-service.ts`
- `packages/dashboard/src/lib/watcher.ts`
- `packages/dashboard/src/lib/services/process-reconciler.ts`
- `packages/dashboard/src/lib/services/workflow-service.ts`
- `packages/dashboard/src/lib/services/process-health.ts`
- `packages/dashboard/src/lib/services/orchestration-runner.ts`

## Notes / Gotchas
- `orchestrationService.getActive()` reads `orchestration.dashboard.active` (CLI state), which is currently out of sync with legacy orchestration files.
- `convertDashboardStateToExecution()` currently defaults unknown steps to `design`.
- `index.json` is treated as “truth” for currentExecution in watcher; this is what produces stale running sessions after restarts.
- Process reconciliation updates metadata but does not update `index.json`.

## When resuming
1) Commit and push Phase 0/1 fixes.
2) Validate UI behavior in dashboard.
3) Start Phase 2 (single source-of-truth refactor).
