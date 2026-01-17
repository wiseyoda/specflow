# Verification Checklist: Real-Time File Watching

**Purpose**: Verify Phase 1020 implementation meets all acceptance criteria
**Created**: 2026-01-17
**Feature**: `.specify/spec.md`

---

## User Story 1: Instant State Updates (P1)

- [ ] CHK001 Dashboard connects to SSE endpoint on page load
- [ ] CHK002 Run `speckit state set orchestration.phase.status=complete` - UI updates within 2 seconds
- [ ] CHK003 Edit state file directly in text editor - UI updates within 2 seconds
- [ ] CHK004 No duplicate events or UI flickering during rapid changes
- [ ] CHK005 Malformed state file doesn't crash dashboard (validation works)

## User Story 2: Connection Status (P2)

- [ ] CHK006 Green status dot visible in header when connected
- [ ] CHK007 Stop dashboard server - status changes to red/yellow
- [ ] CHK008 Toast notification appears when connection lost
- [ ] CHK009 Toast notification appears when connection restored
- [ ] CHK010 Status returns to green after auto-reconnect

## User Story 3: Project Auto-Discovery (P3)

- [ ] CHK011 Run `speckit init` in new project - appears in dashboard without refresh
- [ ] CHK012 Unregister a project - disappears from dashboard without refresh

## Technical Verification

- [ ] CHK013 SSE endpoint responds: `curl -N http://localhost:4200/api/events`
- [ ] CHK014 Heartbeat events sent every 30 seconds (check with curl)
- [ ] CHK015 Multiple browser tabs receive events (broadcast working)
- [ ] CHK016 Watcher handles deleted project directories gracefully
- [ ] CHK017 No memory leaks after extended use (check browser dev tools)

## Edge Cases

- [ ] CHK018 Registry.json doesn't exist - dashboard shows empty state
- [ ] CHK019 Rapidly changing files (10+ changes in 1 second) - debounce prevents flooding
- [ ] CHK020 Browser tab inactive for 5+ minutes - reconnects and refetches data

---

## Notes

- Test with dashboard at http://localhost:4200
- Use `speckit dashboard --dev` for hot reload during testing
- Check browser console for errors during all tests
- Items are numbered sequentially for easy reference
