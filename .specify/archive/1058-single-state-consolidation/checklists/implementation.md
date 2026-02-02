# Implementation Checklist: Phase 1058

## Pre-Implementation

- [ ] I-001 Review existing orchestration-decisions.ts code (~700 lines)
- [ ] I-002 Review existing orchestration-service.ts OrchestrationExecution usage
- [ ] I-003 Identify all files importing OrchestrationExecution type

## Schema Extension (Phase 1)

- [ ] I-010 DashboardState schema validates correctly
- [ ] I-011 Nested field access works: `specflow state get orchestration.dashboard.active.id`
- [ ] I-012 Array field access works: `specflow state set orchestration.dashboard.batches.items=[...]`

## Migration (Phase 2)

- [ ] I-020 start() creates dashboard state in CLI state file
- [ ] I-021 get() reads from CLI state file
- [ ] I-022 No OrchestrationExecution imports remain
- [ ] I-023 orchestration-execution.ts deleted

## Decision Logic (Phase 3)

- [ ] I-030 getNextAction() function exists and is < 100 lines
- [ ] I-031 makeDecision() and makeDecisionWithAdapter() removed
- [ ] I-032 createDecisionInput() adapter removed
- [ ] I-033 Runner uses getNextAction() with CLI state

## Auto-Heal (Phase 4)

- [ ] I-040 autoHealAfterWorkflow() function exists
- [ ] I-041 Heal triggers when workflow ends
- [ ] I-042 Logs show healing actions when they occur

## Hack Removal (Phase 5)

- [ ] I-050 State reconciliation hack removed (grep: "stateFileStep === orchestration.currentPhase")
- [ ] I-051 Workflow lookup fallback removed (grep: "Workflow.*lookup failed, waiting")
- [ ] I-052 Claude analyzer fallback removed (grep: "analyzeStateWithClaude")
- [ ] I-053 Batch completion guard removed (grep: "BLOCKED: Cannot transition")
- [ ] I-054 Empty array guard removed (grep: "batches.items.length > 0 && completedCount")
- [ ] I-055 isPhaseComplete() simplified (no hasPlan, hasTasks, hasSpec checks)

## UI Override (Phase 6)

- [ ] I-060 goBackToStep() function exists
- [ ] I-061 StepOverride component renders buttons
- [ ] I-062 Clicking button updates state and orchestration resumes

## Final Verification

- [ ] I-070 `wc -l orchestration-decisions.ts` shows < 100 lines
- [ ] I-071 `grep -r "OrchestrationExecution" packages/` returns no results
- [ ] I-072 `grep -r "analyzeStateWithClaude" packages/` returns no results
- [ ] I-073 Manual test: Run orchestration end-to-end
- [ ] I-074 Manual test: Run /flow.implement externally, resume in dashboard
- [ ] I-075 Manual test: Click "Go back to Analyze" in UI
