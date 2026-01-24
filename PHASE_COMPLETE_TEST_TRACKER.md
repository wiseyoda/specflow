# Phase Complete Test Tracker

Testing comprehensive phase completion across all projects.

## Test Summary

| #   | Project           | State                                     | Tasks     | Expected Action                | Result | Notes |
| --- | ----------------- | ----------------------------------------- | --------- | ------------------------------ | ------ | ----- |
| 1   | test-app          | Active: 0010-hello-world                  | 3/3 ✓     | Close phase, archive specs     | ⏳     |       |
| 2   | level-agency-sdd  | Ready → ask question ui                   | N/A       | Should not close (Ready state) | ⏳     |       |
| 3   | watson-helper     | Ready                                     | N/A       | Should not close (Ready state) | ⏳     |       |
| 4   | story-sprout      | Active: 0175-story-flow-redesign          | 44/47     | Warn: 3 incomplete tasks       | ⏳     |       |
| 5   | inbox-pilot       | Active: 0151-digest-ea-transformation     | 137/142   | Warn: 5 incomplete tasks       | ⏳     |       |
| 6   | specflow          | Active: 1057-orchestration-simplification | 123/123 ✓ | Close phase, archive specs     | ⏳     |       |
| 7   | ai-assistant      | Ready → Persistent Cache                  | N/A       | Should not close (Ready state) | ⏳     |       |
| 8   | overnight-coder   | Ready → UI Plugins                        | N/A       | Should not close (Ready state) | ⏳     |       |
| 9   | rogue-minesweeper | Ready → rune synergies                    | N/A       | Should not close (Ready state) | ⏳     |       |
| 10  | cli-bridge        | Ready → OpenTelemetry                     | N/A       | Should not close (Ready state) | ⏳     |       |
| 11  | CodingBridge      | Ready → UI Redesign                       | N/A       | Should not close (Ready state) | ⏳     |       |

---

## Detailed Project Info

### 1. test-app

- **Path**: `/Users/ppatterson/dev/test-app`
- **Branch**: `0010-hello-world`
- **Phase**: 0010 - Hello World
- **Tasks**: 3/3 complete
- **Expected**:
  - `specflow phase close` succeeds
  - `specs/0010-hello-world/` → `.specify/archive/0010-hello-world/`
  - ROADMAP.md updated with phase status
  - HISTORY.md appended
- **Actual**:
- **Issues**:

---

### 2. level-agency-sdd

- **Path**: `/Users/ppatterson/dev/level-agency-sdd`
- **State**: Ready (no active phase)
- **Pending Phase**: "ask question ui"
- **Expected**:
  - Phase Complete should indicate no active phase
  - Or offer to start the pending phase
- **Actual**:
- **Issues**:

---

### 3. watson-helper

- **Path**: `/Users/ppatterson/dev/watson-helper`
- **State**: Ready (no active phase)
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

### 4. story-sprout

- **Path**: `/Users/ppatterson/dev/story-sprout`
- **Branch**: `0175-story-flow-redesign`
- **Phase**: 0175 - story flow redesign
- **Tasks**: 44/47 (3 incomplete)
- **Expected**:
  - Warning about incomplete tasks
  - Either block close or offer to defer incomplete tasks to BACKLOG
  - If forced: archive with incomplete task note
- **Actual**:
- **Issues**:

---

### 5. inbox-pilot

- **Path**: `/Users/ppatterson/dev/inbox-pilot`
- **Branch**: `0151-digest-ea-transformation`
- **Phase**: 0151 - digest ea transformation
- **Tasks**: 137/142 (5 incomplete)
- **Expected**:
  - Warning about incomplete tasks
  - Either block close or offer to defer incomplete tasks to BACKLOG
  - If forced: archive with incomplete task note
- **Actual**:
- **Issues**:

---

### 6. specflow

- **Path**: `/Users/ppatterson/dev/specflow`
- **Branch**: `1057-orchestration-simplification`
- **Phase**: 1057 - Orchestration Simplification
- **Tasks**: 123/123 complete
- **Expected**:
  - `specflow phase close` succeeds
  - `specs/1057-orchestration-simplification/` → `.specify/archive/1057-orchestration-simplification/`
  - ROADMAP.md updated
  - HISTORY.md appended
- **Actual**:
- **Issues**:

---

### 7. ai-assistant

- **Path**: `/Users/ppatterson/dev/ai-assistant`
- **State**: Ready (no active phase)
- **Pending Phase**: "Persistent Cache"
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

### 8. overnight-coder

- **Path**: `/Users/ppatterson/dev/overnight-coder`
- **State**: Ready (no active phase)
- **Pending Phase**: "UI Plugins"
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

### 9. rogue-minesweeper

- **Path**: `/Users/ppatterson/dev/rogue-minesweeper`
- **State**: Ready (no active phase)
- **Pending Phase**: "rune synergies"
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

### 10. cli-bridge

- **Path**: `/Users/ppatterson/dev/cli-bridge`
- **State**: Ready (no active phase)
- **Pending Phase**: "OpenTelemetry Operational Excellence"
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

### 11. CodingBridge

- **Path**: `/Users/ppatterson/dev/CodingBridge`
- **State**: Ready (no active phase)
- **Pending Phase**: "UI Redesign Advanced Features"
- **Expected**:
  - Phase Complete should indicate no active phase
- **Actual**:
- **Issues**:

---

## Phase Complete Expected Behavior

When "Phase Complete" is triggered, the system should:

1. **For Active Phases (100% complete)**:
   - Run `specflow check --gate verify` to validate
   - Archive specs from `specs/NNNN-name/` to `.specify/archive/NNNN-name/`
   - Update ROADMAP.md phase status to ✓
   - Append summary to `.specify/history/HISTORY.md`
   - Clear orchestration state
   - Optionally: commit, push, merge to main

2. **For Active Phases (incomplete tasks)**:
   - Warn about incomplete tasks
   - Offer options:
     - Defer incomplete to BACKLOG.md
     - Force close anyway
     - Cancel and continue work

3. **For Ready State (no active phase)**:
   - Indicate no phase to close
   - Optionally show pending phases from dashboard

---

## Files to Check After Each Test

For each active phase close, verify:

- [ ] `specs/NNNN-name/` directory removed
- [ ] `.specify/archive/NNNN-name/` directory created with contents
- [ ] `ROADMAP.md` phase row updated
- [ ] `.specify/history/HISTORY.md` updated
- [ ] `.specflow/orchestration-state.json` cleared/updated
- [ ] Git branch status (if merge attempted)

---

## Test Log

### Test 1: test-app (0010-hello-world)

**Started**: 2026-01-24
**Completed**: In progress
**Actions Taken**:

- Clicked "Complete Phase" with modal defaults

**Observations**:

- ❌ Session viewer did not show "Current Session"
- ❌ No new session in dropdown before or after refresh
- Root cause #1: sessionId is populated async after CLI spawns, but hook queries immediately and caches null
- **FIX #1 APPLIED**: Added polling for sessionId in use-orchestration.ts (polls for up to 15s after start)
- Root cause #2: Orchestration started at 'implement' phase with 0 batches (all tasks complete) → immediately went to 'needs_attention'
- **FIX #2 APPLIED**: Added `skipImplement` flag to config schema. When all tasks complete, orchestration now starts at 'verify' phase.
- Cancelled stuck orchestration `c41e57f6-a441-4b94-8384-9bf3344bdd5b`
- Root cause #3 (CORRECTED): Verify WAS genuinely complete - the state is NOT stale. When verify is complete, orchestration should skip to merge, not re-run verify.
- **FIX #3 APPLIED (CORRECTED)**: Added `skipVerify` flag to config schema. When verify step is complete AND all tasks are complete, orchestration starts at 'merge' phase.
- Cancelled orchestration `72a0cfaf-71bd-4726-ad37-57a2efee3fef`
- Ready for retry - should now spawn `/flow.merge` workflow

---

### Test 2: level-agency-sdd (ask question ui)

**Started**: 2026-01-24
**Completed**: In progress
**Actions Taken**:

- Started orchestration for "ask question ui" phase
- flow.design completed successfully (parallel agents worked, agent chips displayed)
- Orchestration did NOT auto-continue to analyze phase

**Observations**:

- ✅ Agent task chips work correctly - parallel agents visible in session viewer
- ✅ Orchestration IS continuing after design (user confirmed)
- ❌ Analyze phase was SKIPPED - went directly from design → implement
- **Root cause**: `getSmartConfig` in `/api/workflow/orchestrate/route.ts` had bug:
  ```typescript
  const smartSkipAnalyze = config.skipAnalyze || smartSkipDesign;
  ```
  This incorrectly coupled `skipAnalyze` to `skipDesign`. If design artifacts exist OR design is skipped, analyze gets auto-skipped too.

**Fixes Applied**:

- Fixed `getSmartConfig` to NOT auto-skip analyze based on design status
- User must explicitly check "Skip analyze" to skip it
- Also added debug logging and 'stale'/'detached' workflow status handling
- Dashboard rebuilt - ready for retest with new orchestration

---

### Test 3: watson-helper (Ready)

**Started**:
**Completed**:
**Actions Taken**:

**Observations**:

---

### Test 4: story-sprout (0175 - 44/47)

**Started**:
**Completed**:
**Actions Taken**:

**Observations**:

---

### Test 5: inbox-pilot (0151 - 137/142)

**Started**:
**Completed**:
**Actions Taken**:

**Observations**:

---

### Test 6: specflow (1057 - 123/123)

**Started**:
**Completed**:
**Actions Taken**:

**Observations**:

---

### Test 7-11: Ready State Projects

**Started**:
**Completed**:
**Observations**:

---

## Issues Found

| #   | Project  | Issue                                                                             | Severity | Fixed?                                                              |
| --- | -------- | --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1   | test-app | No session shown after Complete Phase - sessionId not available immediately       | High     | ✅ Yes - added polling in use-orchestration.ts                      |
| 2   | test-app | All tasks complete but orchestration tried to start at 'implement' with 0 batches | High     | ✅ Yes - added skipImplement flag to start at 'verify'              |
| 3   | test-app | Verify was complete but orchestration started at 'verify' instead of 'merge'      | Medium   | ✅ Yes - added skipVerify flag; when verify complete, skip to merge |
| 4   | test-app | State file mismatch: step.status='complete' for verify, but orchestration at merge | High     | ✅ Yes - only trust step.status if step.current matches orchestration phase |
| 5   | test-app | Staleness detection using project file times, not workflow activity time | High     | ✅ Yes - use workflow.lastActivityAt instead of lastFileChangeTime |
| 6   | test-app | Session not showing in UI without refresh - page.tsx didn't use activeSessionId from useOrchestration | High     | ✅ Yes - extract orchestrationSessionId and use as fallback in consoleSessionId |
| 7   | test-app | SpecFlow session shown as "CLI Session" instead of proper label | Medium   | ✅ Yes - fixed by session history improvements |
| 8   | test-app | AskUserQuestion UI not rendering - CLI mode uses structured_output, not tool calls | High     | ✅ Yes - added broadcastWorkflowQuestions() and call from workflow-service |
| 9   | test-app | Question SSE event had wrong structure - sessionId was nested inside data | High     | ✅ Yes - moved sessionId to root level per schema, added timestamp |
| 10  | test-app | Session polling timeout too short (15s but workflow takes 30s+) | High     | ✅ Yes - increased polling from 15s to 90s in use-orchestration.ts |
| 11  | test-app | flow.merge errors on no remote instead of asking user | Critical | ✅ Yes - added LOCAL_ONLY_MODE fallback with AskUserQuestion |
| 12  | test-app | Polling ran all iterations instantly instead of waiting 1s each | High     | ✅ Yes - await the polling loop so isLoading stays true |
| 13  | test-app | Questions not shown in session viewer | Medium   | ✅ Yes - parse AskUserQuestion from JSONL, render in session-message.tsx |
| 14  | test-app | Historical sessions hang on "Loading session..." | High     | ✅ Yes - add API fallback in useSessionContent for non-SSE sessions |
| 15  | test-app | Structured output not shown in session viewer | Low      | ✅ Yes - parse StructuredOutput from JSONL, display via WorkflowOutputCard |
| 16  | test-app | Parallel agent tasks not shown in session viewer | Medium   | ✅ Yes - parse Task tool calls, display as AgentTaskChip components |
| 17  | level-agency-sdd | Orchestration skipping analyze phase after design | High     | ✅ Fixed - `smartSkipAnalyze` was incorrectly coupled to `smartSkipDesign` in getSmartConfig |
| 18  | level-agency-sdd | Question modal not showing when navigating to waiting session | High     | ✅ Fixed - Added fallback to extract questions from session messages when SSE questions unavailable |
| 19  | level-agency-sdd | Batches marked complete without verifying actual task completion | Critical | ✅ Fixed - Added verifyBatchTaskCompletion() to check tasks.md before advancing batches |
| 20  | test-app | Question modal not appearing on page refresh | High     | ✅ Fixed - Added loading state to DecisionToast, show toast while questions load |
| 21  | test-app | "Waiting" badge not clickable to show question modal | Medium   | ✅ Fixed - Added onStatusClick handler to OmniBox, badge now clickable when waiting |
| 22  | level-agency-sdd | Batches skipped - spawn_batch called completeBatch BEFORE running workflow | Critical | ✅ Fixed - Removed erroneous completeBatch() call from spawn_batch case. Batches 1,3,5,7 were marked complete without workflows! |
| 23  | level-agency-sdd | workflowStatus didn't reflect selected session's status | High | ✅ Fixed - workflowStatus now uses selectedConsoleSession.status when a session is selected from dropdown |
| 24  | level-agency-sdd | Questions not extracted from StructuredOutput (CLI mode) | High | ✅ Fixed - decisionQuestions now also checks sessionWorkflowOutput.questions for needs_input status |
| 25  | level-agency-sdd | handleDecisionAnswer only checked SSE questions, not fallbacks | High | ✅ Fixed - Now computes fallback questions inline (sessionMessages + sessionWorkflowOutput) |
| 26  | level-agency-sdd | Real-time updates not showing for resumed sessions after answering questions | High | ⏳ Pending - debug logs added, waiting for reproduction |
| 27  | level-agency-sdd | Orchestration jumped back to Analyze when restarting after Verify was complete | Critical | ✅ Fixed - getSmartConfig now uses better heuristics: if all tasks complete, skip analyze; isPastPhase() checks current phase index |

---

## Final Summary

**Total Projects**: 11
**Active Phases**: 4 (test-app, story-sprout, inbox-pilot, specflow)
**Ready State**: 7
**100% Complete**: 2 (test-app, specflow)
**Incomplete Tasks**: 2 (story-sprout: 3, inbox-pilot: 5)

**Pass Rate**: \_/11
**Issues Found**:
**Issues Fixed**:
