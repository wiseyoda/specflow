# Verification Checklist: Session Viewer

**Purpose**: Post-implementation verification before phase close
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## Functional Verification

- [x] V-001 Session button appears in project detail header when workflow exists
- [x] V-002 Clicking Session button opens slide-out panel
- [x] V-003 Panel displays messages from active session
- [x] V-004 Messages update automatically (within 3 seconds) during active session
- [x] V-005 Polling stops when session completes
- [x] V-006 User messages display with distinct styling
- [x] V-007 Assistant messages display with timestamp
- [x] V-008 Tool calls are NOT displayed (filtered out)

## Auto-scroll Verification

- [x] V-009 Panel auto-scrolls to bottom when new messages arrive
- [x] V-010 Auto-scroll pauses when user scrolls up
- [x] V-011 Auto-scroll resumes when user scrolls to bottom

## File Discovery Verification

- [x] V-012 Hash calculation finds correct ~/.claude/projects/{hash}/ directory
- [x] V-013 Session file found by sessionId within project hash directory
- [x] V-014 Malformed JSONL lines are skipped gracefully

## Edge Cases

- [x] V-015 Empty state shown when no active session
- [x] V-016 Error state shown when session file not found
- [x] V-017 Panel closes correctly (click outside, Escape, X button)
- [x] V-018 Multiple open/close cycles work without memory leaks

## Progress Indicators

- [x] V-019 Elapsed time displays and updates
- [x] V-020 Files modified count displays (if available in session data)

## UI Design Verification

- [x] V-UI1 UI implementation matches ui-design.md mockups
- [x] V-UI2 All components from Component Inventory are implemented
- [x] V-UI3 All interactions from Interactions table work as specified
- [x] V-UI4 Design constraints from ui-design.md are respected
- [x] V-UI5 Accessibility considerations addressed (aria-label, keyboard navigation)

## USER GATE

**Verification Gate from Phase File:**

- [x] V-UG1 Open session viewer from project detail
- [x] V-UG2 See formatted messages from active session (when session ID is known)
- [x] V-UG3 Content streams in real-time during workflow
- [x] V-UG4 See files modified and time elapsed

**Known Limitation**: Session detection on NEW workflow start has race conditions.
Deferred to Phase 1053 (Workflow-Session Unification) for proper fix.

## Notes

- All V-UG items must pass for phase to close
- Test with real Claude session data
- Test with long-running session (many messages)
