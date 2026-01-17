# Requirements Checklist: Phase 1040 - CLI Actions from UI

> Generated from spec.md on 2026-01-17

## Functional Requirements

- [ ] **FR-001**: System executes `speckit` CLI commands via API routes using child process spawn
- [ ] **FR-002**: System streams command stdout/stderr to the UI in real-time
- [ ] **FR-003**: System displays command results in an expandable drawer component
- [ ] **FR-004**: System shows toast notifications for command success/failure
- [ ] **FR-005**: System sanitizes all user inputs before passing to shell commands
- [ ] **FR-006**: System passes the correct project path to CLI commands
- [ ] **FR-007**: Command palette lists all available `speckit` commands (from `speckit help`)
- [ ] **FR-008**: System handles command timeouts (default 60 seconds)
- [ ] **FR-009**: System preserves command history for the session
- [ ] **FR-010**: System prompts for required arguments inline after command selection
- [ ] **FR-011**: System caches command list on startup and refreshes periodically

## Non-Functional Requirements

- [ ] **NFR-001**: Command output streaming latency < 100ms
- [ ] **NFR-002**: Command palette opens in < 200ms
- [ ] **NFR-003**: API routes don't block event loop during execution

## User Stories

- [ ] **US-1**: Run SpecKit Command from Palette (P1)
- [ ] **US-2**: Create Issue from UI (P1)
- [ ] **US-3**: View Command Output (P2)
- [ ] **US-4**: Error Feedback (P2)

## Verification Gate (USER)

- [ ] Create issue from UI appears in `.specify/issues/`
- [ ] Run any `speckit` command from command palette
- [ ] Command output streams to drawer in real-time
- [ ] Errors display in toast with helpful messages

## Edge Cases

- [ ] CLI not installed shows installation instructions
- [ ] Interactive commands show "not supported" warning
- [ ] Invalid project path shows clear error
- [ ] Concurrent commands handled (queue or in-progress indicator)
- [ ] SSE disconnect during command shows partial output + reconnect
