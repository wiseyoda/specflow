# Specification: Orchestration Simplification

**Phase**: 1057
**Created**: 2026-01-23
**Status**: In Progress

---

## Overview

Refactor dashboard orchestration to trust state file, fix question flow, add Claude Helper for specific recovery scenarios, eliminate race conditions, and unify session tracking across dashboard and CLI.

### Problem Statement

The orchestration-runner (1,412 lines) reimplements /flow.orchestrate logic poorly:

1. `isPhaseComplete()` checks artifacts instead of trusting `step.status`
2. Question flow is broken (watcher detects questions but data never reaches UI)
3. No recovery path when things go wrong
4. 2,343 lines of redundant code between runner and service
5. Race conditions in workflow spawning and state file access
6. Batch handling logic scattered and incomplete
7. No detection of sessions started/resumed from external Claude CLI

### Solution

Trust the state file. Sub-commands set `step.status=complete` when done. The runner:
1. Reads state (with atomic file access)
2. Validates state consistency
3. Spawns workflows (with spawn intent pattern to prevent races)
4. Transitions when `step.status=complete`
5. Uses Claude Helper for exactly 3 recovery scenarios
6. Tracks ALL session activity (dashboard workflows, omnibox commands, external CLI)

---

## Functional Requirements

### FR-001: Trust Step Status

The orchestration runner MUST advance based on `step.status`, not artifact existence.

**Acceptance Criteria:**
- When sub-command sets `step.status=complete`, orchestration transitions to next step
- No checks for `hasPlan`, `hasTasks`, `hasSpec` in decision logic
- `grep "hasPlan\|hasTasks\|hasSpec" orchestration-runner.ts` returns no results

### FR-002: Complete Decision Matrix

Every state combination MUST have an explicit action in `makeDecision()`.

**Acceptance Criteria:**
- Pre-decision gates: budget check, duration gate (4 hour max)
- Workflow running: wait (recent) or recover_stale (>10 min)
- Workflow waiting for input: wait
- Workflow lookup failure: wait_with_backoff
- Step complete + verify + USER_GATE: wait_user_gate
- Step complete + verify + autoMerge=false: wait_merge
- Step complete + verify + autoMerge=true: transition to merge
- Step complete + merge: complete
- Step complete + other: transition to next
- Step failed/blocked: recover_failed
- Step in_progress + no workflow: spawn
- Step not_started: spawn (init batches if implement)
- No generic else/default that handles "unknown"

### FR-003: Batch State Machine

Implement phase MUST handle batches through complete state machine.

**Acceptance Criteria:**
- No batches: initialize_batches
- Pending batch + no workflow: spawn_batch
- Running batch + workflow running: let staleness check handle
- Completed batch + pauseBetweenBatches: pause
- Completed batch + continue: advance_batch
- Healed batch + more batches: advance_batch
- Failed batch + heal attempts remaining: heal_batch
- Failed batch + no attempts: recover_failed
- All batches complete + step not complete: force_step_complete

### FR-004: Question Flow

Questions from workflows MUST display in UI.

**Acceptance Criteria:**
- use-sse.ts has `sessionQuestions` state
- `session:question` event populates the map
- unified-data-context.tsx exports `sessionQuestions`
- page.tsx reads from context (NOT hardcoded `[]`)
- Questions clear after user answers

### FR-005: Claude Helper (Exactly 3 Cases)

Claude Helper MUST only be called for these 3 scenarios:

**Case 1: Corrupt/Missing State**
- Creates .bak backup BEFORE recovery
- Calls Claude Helper with `task: 'recover_state'`
- Fallback to heuristic recovery (silent)
- Fallback to null → needs_attention

**Case 2: Stale Workflow**
- Calls Claude Helper with `task: 'diagnose_stale_workflow'`
- Handles: continue, restart_task, skip_task, abort
- Fallback to needs_attention (silent)

**Case 3: Failed Step**
- Pre-checks max heal attempts before calling Claude Helper
- Calls Claude Helper with `task: 'diagnose_failed_step'`
- Handles: retry, skip_tasks, run_prerequisite, abort
- Fallback to simple retry or needs_attention (silent)

**Verification:**
- `grep -r "claudeHelper" packages/dashboard/src/lib/services/` shows exactly 3 call sites

### FR-006: Race Condition Mitigations

Race conditions MUST be prevented via:

**Atomic State Writes:**
- Write to `.tmp` file first
- Use `rename()` for atomic swap

**Spawn Intent Pattern:**
- Check for existing spawn intent before spawning
- Check hasActiveWorkflow before spawning
- Write spawn intent BEFORE calling workflowService.start()
- Clear intent in finally block

**Persistent Runner State:**
- Write runner-{orchestrationId}.json with PID and startedAt
- Reconcile orphaned runners on dashboard startup

**Event Sleep Fix:**
- Use `Map<string, Set<() => void>>` for eventSignals
- Multiple callbacks supported

### FR-007: Unified Session Tracking

Dashboard MUST detect sessions from all sources:

**File Watching:**
- Watch `~/.claude/projects/{hash}/` for new JSONL files (new CLI sessions)
- Watch for JSONL modifications (CLI session activity)
- Emit session:created and session:activity SSE events

**Orchestration Integration:**
- External session activity updates lastActivity
- Omnibox commands update orchestration state

**Pause/Resume:**
- Pause button sets status: 'paused'
- When paused, pause button becomes Play button
- Play click or omnibox command resumes

---

## Non-Functional Requirements

### NFR-001: Code Simplicity

Reduce complexity through:
- Pure functions for decision logic (makeDecision, handleImplementBatching, validateState)
- Dependency injection for testability
- orchestration-service.ts contains only persistence logic (no decision logic)
- Consolidate duplicate getNextPhase(), isStepComplete() functions

### NFR-002: State Validation

Validate state consistency:
- step.index === STEP_INDEX_MAP[step.current]
- step.current is valid (design, analyze, implement, verify, merge)
- step.status is valid
- batches.items[i].index === i
- batches.current < batches.total (unless all complete)
- recoveryContext exists when status === 'needs_attention'
- Cross-file consistency: state step vs execution phase

### NFR-003: Testability

Support comprehensive testing:
- Pure functions can be unit tested in isolation
- OrchestrationDeps interface enables mocking
- Clock abstraction for time-based logic
- Test fixtures for various states

---

## Success Criteria

### SC-001: Step Advancement

Orchestration advances through steps based solely on `step.status` values.

### SC-002: Question Display

When workflow calls AskUserQuestion, question appears in UI within 2 seconds.

### SC-003: No Duplicate Spawns

Rapid triggers (e.g., multiple button clicks) spawn only one workflow.

### SC-004: External CLI Detection

Session started from external Claude CLI terminal is detected by dashboard within 5 seconds.

### SC-005: Test Coverage

Unit tests cover all decision matrix conditions (G1.1-G1.18, G2.1-G2.10).

---

## Out of Scope

- Changing the workflow spawning mechanism itself
- Modifying how Claude Helper calls the API
- UI redesign (only fixing data plumbing)
- New features beyond fixing existing broken functionality

---

## References

- **Detailed Plan**: [plan.md](plan.md) - Contains 146 verifiable goals (G1-G12)
- **Phase Document**: `.specify/phases/1057-orchestration-simplification.md`
- **State Ownership Pattern**: commands/flow.orchestrate.md
