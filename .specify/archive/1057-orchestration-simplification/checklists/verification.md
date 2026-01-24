# Verification Checklist: Orchestration Simplification

**Purpose**: Verify implementation quality and completeness after coding is done
**Created**: 2026-01-23
**Feature**: [plan.md](../plan.md)
**Phase**: 1057

**Note**: This checklist is verified during `/flow.verify` before phase completion.

## Checklist ID Format

All items use `V-###` prefix (e.g., V-001, V-002).
Mark complete with: `specflow mark V-001`

---

## Phase Goal Verification

Verify all phase goals from `.specify/phases/1057-orchestration-simplification.md` are achieved:

- [ ] V-001 Goal 1: Trust step.status - orchestration advances based on step.status, not artifact existence
- [ ] V-002 Goal 2: Complete decision matrix - every state combination has explicit action
- [ ] V-003 Goal 3: Fix question flow - question toast appears when workflow needs input
- [ ] V-004 Goal 4: Claude Helper for 3 cases only - with explicit fallback chains
- [ ] V-005 Goal 5: Eliminate race conditions - atomic writes, spawn intent pattern working
- [ ] V-006 Goal 6: Code simplified - duplicate logic consolidated

## Decision Matrix Verification (G1)

Verify all decision matrix conditions work correctly:

- [ ] V-010 [G1.1] Budget exceeded → fail action triggers
- [ ] V-011 [G1.2] Duration > 4 hours → needs_attention triggers
- [ ] V-012 [G1.4] Running workflow + recent activity → wait action
- [ ] V-013 [G1.5] Stale workflow (>10 min) → recover_stale triggers
- [ ] V-014 [G1.8] Verify complete + USER_GATE pending → wait_user_gate
- [ ] V-015 [G1.9] Verify complete + autoMerge=false → wait_merge
- [ ] V-016 [G1.10] Verify complete + autoMerge=true → transitions to merge
- [ ] V-017 [G1.13-14] Failed/blocked step → recover_failed triggers

## Batch State Machine Verification (G2)

Verify batch handling works correctly:

- [ ] V-020 [G2.1] No batches → initialize_batches triggers
- [ ] V-021 [G2.4] Pending batch + no workflow → spawn_batch triggers
- [ ] V-022 [G2.6] Batch complete + pauseBetweenBatches → pause triggers
- [ ] V-023 [G2.7] Batch complete + continue → advance_batch triggers
- [ ] V-024 [G2.9-10] Failed batch → heal or recover_failed based on attempts

## Claude Helper Verification (G3)

Verify Claude Helper works for exactly 3 cases:

- [ ] V-030 [G3.2] State recovery creates .bak backup BEFORE recovery
- [ ] V-031 [G3.5] State recovery fallback to heuristic is silent
- [ ] V-032 [G3.10] Stale workflow fallback to needs_attention is silent
- [ ] V-033 [G3.15-16] Failed step fallback to retry or needs_attention is silent
- [ ] V-034 [G3.17] Grep shows Claude Helper ONLY called for these 3 cases

## Question Flow Verification (G4)

Verify question data flows to UI:

- [ ] V-040 [G4.1] Watcher detects questions and emits session:question event
- [ ] V-041 [G4.3] use-sse.ts populates sessionQuestions on event
- [ ] V-042 [G4.6] decisionQuestions is NOT hardcoded to []
- [ ] V-043 [G4.8] Questions cleared from map after user answers

## Race Mitigation Verification (G5)

Verify race conditions are prevented:

- [ ] V-050 [G5.1-2] State writes use atomic temp file + rename pattern
- [ ] V-051 [G5.3-7] Spawn intent pattern prevents duplicate spawns
- [ ] V-052 [G5.8-10] Runner state persists across dashboard restart
- [ ] V-053 [G5.11-13] Event sleep uses Set of callbacks (not single)

## Session Tracking Verification (G6)

Verify unified session tracking works:

- [ ] V-060 [G6.1-5] External CLI sessions detected via JSONL watching
- [ ] V-061 [G6.6-7] Omnibox commands update orchestration state
- [ ] V-062 [G6.8-11] Pause/play button works, omnibox can resume

## State Validation Verification (G7)

Verify state validation catches errors:

- [ ] V-070 [G7.1] Invalid step.index is detected
- [ ] V-071 [G7.5] Invalid batches.current is detected
- [ ] V-072 [G7.6] Missing recoveryContext when needs_attention is detected
- [ ] V-073 [G7.7] Cross-file inconsistency is detected

## Code Quality

Verify implementation meets coding standards:

- [ ] V-080 All tests pass (`pnpm test:dashboard`)
- [ ] V-081 No linting errors (`pnpm lint`)
- [ ] V-082 Type checking passes (`pnpm typecheck`)
- [ ] V-083 No TODO/FIXME comments remain in new code

## Code Cleanup Verification (G10)

Verify obsolete code is removed:

- [ ] V-090 [G10.1] No hasPlan/hasTasks/hasSpec checks in decision logic: `grep -n "hasPlan\|hasTasks\|hasSpec" orchestration-runner.ts` returns nothing
- [ ] V-091 [G10.2-3] Duplicate functions consolidated
- [ ] V-092 [G10.4] orchestration-service.ts contains only persistence logic

## Test Coverage Verification (G11)

Verify tests exist and pass:

- [ ] V-100 [G11.1] Unit tests for makeDecision() cover all conditions
- [ ] V-101 [G11.2] Unit tests for handleImplementBatching() cover all conditions
- [ ] V-102 [G11.3] Unit tests for validateState() cover all conditions
- [ ] V-103 [G11.5] Happy path integration test passes
- [ ] V-104 [G11.12] Race condition test prevents duplicate spawns

---

## USER GATE Verification

**USER GATE**: User must manually verify these items:

- [ ] V-GATE-01 Start orchestration on a test phase
- [ ] V-GATE-02 Orchestration advances based on step.status (not artifacts)
- [ ] V-GATE-03 Batch handling: implement with multiple batches → each spawned sequentially
- [ ] V-GATE-04 When workflow needs input, question toast appears
- [ ] V-GATE-05 Answer question, workflow resumes
- [ ] V-GATE-06 If step fails, Claude Helper diagnoses and recovers (silent fallback if Claude fails)
- [ ] V-GATE-07 With autoMerge=false: verify complete → wait_merge → user triggers
- [ ] V-GATE-08 With autoMerge=true: verify complete → merge runs automatically (no prompt)
- [ ] V-GATE-09 Rapid triggers don't spawn duplicate workflows
- [ ] V-GATE-10 Pause button → Play button when paused
- [ ] V-GATE-11 Omnibox command resumes paused orchestration
- [ ] V-GATE-12 Start session from external CLI terminal → dashboard detects it
- [ ] V-GATE-13 Decision log appears correctly in Phase Completion card
- [ ] V-GATE-14 Orchestration completes successfully

---

## Quick Verification Commands

```bash
# V-090: No artifact checks in decision logic
grep -n "hasPlan\|hasTasks\|hasSpec" packages/dashboard/src/lib/services/orchestration-runner.ts

# V-034: Claude Helper only called for 3 cases
grep -r "claudeHelper\|claude-helper" packages/dashboard/src/lib/services/ --include="*.ts" -l

# V-042: No hardcoded empty questions array
grep -n "decisionQuestions = \[\]" packages/dashboard/src/

# V-050: Atomic writes exist
grep -n "\.tmp\|rename" packages/dashboard/src/lib/services/orchestration-service.ts
```

---

## Notes

- All V-### items must be checked before `/flow.merge`
- Items that fail should be fixed or deferred with `specflow phase defer "reason"`
- Use `specflow mark V-### --blocked "reason"` for items that cannot be verified
- USER GATE items require manual testing by the user
