# Verification Checklist: Phase 1058

## USER GATE Verification

Before completing this phase, verify ALL criteria:

### V-001: Single State File
- [ ] `OrchestrationExecution` type is removed from codebase
- [ ] All orchestration state lives in `.specflow/orchestration-state.json`
- [ ] Dashboard reads/writes via CLI or direct file access (no separate store)

**How to verify**:
```bash
grep -r "OrchestrationExecution" packages/ --include="*.ts" | grep -v ".test." | wc -l
# Should return 0
```

### V-002: Decision Logic is Simple
- [ ] `orchestration-decisions.ts` is < 100 lines
- [ ] No adapter functions
- [ ] No legacy makeDecision functions

**How to verify**:
```bash
wc -l packages/dashboard/src/lib/services/orchestration-decisions.ts
# Should be < 100
```

### V-003: No Hacks Remain
- [ ] State reconciliation hack removed
- [ ] Workflow lookup fallback removed
- [ ] Claude analyzer fallback removed
- [ ] Batch completion guards removed
- [ ] Empty array guards removed
- [ ] isPhaseComplete() doesn't check artifacts

**How to verify**:
```bash
# These should all return 0 results:
grep -r "stateFileStep === orchestration.currentPhase" packages/
grep -r "Workflow.*lookup failed, waiting" packages/
grep -r "analyzeStateWithClaude" packages/
grep -r "BLOCKED: Cannot transition" packages/
grep -r "batches.items.length > 0 && completedCount" packages/
grep -r "hasPlan === true && hasTasks === true" packages/
```

### V-004: Manual Override Works
- [ ] "Go back to Analyze" button visible in orchestration UI
- [ ] Clicking button updates state file
- [ ] Orchestration resumes from that step

**How to verify**:
1. Start orchestration, let it reach implement phase
2. Click "Go back to Analyze"
3. Check state file shows step.current=analyze, step.status=not_started
4. Orchestration spawns flow.analyze

### V-005: External Runs Don't Break
- [ ] Run `/flow.implement` manually from terminal
- [ ] Return to dashboard
- [ ] Dashboard picks up from correct state (doesn't jump to analyze)

**How to verify**:
1. Dashboard running orchestration, at implement phase
2. Open terminal, run `/flow.implement` manually
3. Wait for it to complete tasks
4. Check dashboard - should continue from verify, not analyze

## Functional Verification

### V-010: Full Orchestration Flow
- [ ] Start orchestration from dashboard
- [ ] design → analyze → implement → verify flows correctly
- [ ] Each step completion triggers next step

### V-011: Batch Handling
- [ ] Multiple batches in implement phase work
- [ ] Pause between batches works (if configured)
- [ ] Batch failure triggers heal attempt

### V-012: Error Recovery
- [ ] Failed workflow triggers auto-heal
- [ ] Auto-heal sets correct status
- [ ] Manual retry via UI works

### V-013: Cost Tracking
- [ ] Costs recorded in state file
- [ ] Budget limit respected
- [ ] Per-batch costs tracked

## Performance Verification

### V-020: State Operations
- [ ] State reads are fast (< 100ms)
- [ ] State writes are atomic
- [ ] No race conditions in concurrent access

### V-021: Code Simplification
- [ ] Total lines in orchestration-decisions.ts decreased significantly
- [ ] No duplicate getNextPhase functions
- [ ] No duplicate state tracking

## Sign-off

| Verifier | Date | Result |
|----------|------|--------|
| User | | [ ] Pass / [ ] Fail |
| Claude | | Verification complete |

### Notes

(Add any observations or issues discovered during verification)
