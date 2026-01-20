# Verification Checklist: Workflow-Session Unification

**Purpose**: Verify feature works correctly post-implementation
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## User Story 1: Start Workflow and See Session (P1)

- [ ] V-001 Start workflow from dashboard, session ID appears in workflow state after first CLI response
- [ ] V-002 Session ID available within 2 seconds of first CLI response completing
- [ ] V-003 Session Viewer drawer shows correct session content (not stale/different session)
- [ ] V-004 When session ID not yet available, UI shows "Waiting for session..." gracefully
- [ ] V-005 No race conditions when opening Session Viewer immediately after starting workflow

## User Story 2: View Session History (P2)

- [ ] V-006 Project detail shows "Sessions" section with list of past sessions
- [ ] V-007 Sessions list includes: sessionId, skill name, status, timestamp, cost
- [ ] V-008 Sessions sorted by timestamp (most recent first)
- [ ] V-009 Clicking session row opens Session Viewer with that session's messages
- [ ] V-010 Active session has green indicator distinguishing it from historical sessions
- [ ] V-011 Up to 50 sessions displayed in history

## User Story 3: Resume Any Past Session (P3)

- [ ] V-012 Can type follow-up message when viewing any past session
- [ ] V-013 Sending follow-up creates new workflow using `--resume {sessionId}`
- [ ] V-014 Resumed session continues with correct context

## Edge Cases

- [ ] V-015 CLI crash before session ID: Workflow marked as failed, user can retry
- [ ] V-016 Multiple rapid workflow starts: Each gets unique session, no conflicts
- [ ] V-017 Session files missing from Claude storage: Graceful error message shown

## Phase USER GATE Criteria (from phase file)

- [ ] V-018 Start workflow → Session ID available within 2 seconds
- [ ] V-019 Session Viewer shows correct session immediately
- [ ] V-020 Can view history of past workflow sessions
- [ ] V-021 No race conditions when starting multiple workflows sequentially

## UI Design Verification

- [ ] V-UI1 UI implementation matches ui-design.md mockups
- [ ] V-UI2 SessionHistoryList shows sessions in table format per mockup
- [ ] V-UI3 SessionPendingState shows appropriate placeholder per mockup
- [ ] V-UI4 Active session indicator (green dot) visible in history list
- [ ] V-UI5 Dark mode styling consistent with rest of dashboard

## Notes

- Check items off as completed: `[x]`
- Verification items must be tested with real workflows
- Run `specflow check --gate verify` to verify completion
- Items V-018 through V-021 are the USER GATE - must pass for phase completion
