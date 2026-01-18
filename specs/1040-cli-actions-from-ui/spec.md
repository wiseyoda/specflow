# Feature Specification: CLI Actions from UI

**Feature Branch**: `1040-cli-actions-from-ui`
**Created**: 2026-01-17
**Status**: Draft
**Input**: Phase 1040 requirements (revised after discovery)

---

## User Scenarios & Testing

### User Story 1 - Run SpecFlow Command from Palette (Priority: P1)

As a developer, I want to run any `specflow` command from the dashboard command palette so I can manage my project without switching to the terminal.

**Why this priority**: Core functionality that enables all other features. Command palette is the primary interface for CLI actions.

**Independent Test**: Open dashboard, press Cmd+K, type "issue list", see command output in drawer.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** I press Cmd+K, **Then** the command palette opens with a search input
2. **Given** the command palette is open, **When** I type "specflow", **Then** I see a list of available specflow commands
3. **Given** I select a command, **When** I press Enter, **Then** the command executes and output appears in a drawer
4. **Given** a command is running, **When** it produces output, **Then** output streams to the drawer in real-time

---

### User Story 2 - Create Issue from UI (Priority: P1)

As a developer, I want to create a backlog issue from the dashboard so I can capture ideas without context switching.

**Why this priority**: Issue creation is the primary user-initiated action (agents handle task marking).

**Independent Test**: Use command palette to run `specflow issue create "Test issue"`, verify `.specify/issues/ISSUE-XXX.md` is created.

**Acceptance Scenarios**:

1. **Given** the command palette is open, **When** I type "issue create", **Then** I see the issue create command option
2. **Given** I select issue create, **When** I enter a title, **Then** a new issue file is created in `.specify/issues/`
3. **Given** an issue is created, **When** creation completes, **Then** I see a success toast with the issue ID

---

### User Story 3 - View Command Output (Priority: P2)

As a developer, I want to see full command output in an expandable drawer so I can review results without losing context.

**Why this priority**: Foundation for agent log streaming in Phase 1050.

**Independent Test**: Run a command, see output stream to drawer, expand/collapse drawer.

**Acceptance Scenarios**:

1. **Given** a command executes, **When** output is produced, **Then** a drawer opens showing the output
2. **Given** the drawer is open, **When** I click the collapse button, **Then** the drawer minimizes to a status bar
3. **Given** multiple commands run, **When** I view history, **Then** I see previous command outputs

---

### User Story 4 - Error Feedback (Priority: P2)

As a developer, I want to see helpful error messages when commands fail so I can understand what went wrong.

**Why this priority**: Essential for usability - errors without context are frustrating.

**Independent Test**: Run invalid command, see error toast with actionable message.

**Acceptance Scenarios**:

1. **Given** a command fails, **When** the error is returned, **Then** a toast displays the error message
2. **Given** an error occurs, **When** I click "View Details", **Then** the drawer opens with full error output
3. **Given** a network error occurs, **When** the API is unreachable, **Then** I see "Dashboard server unavailable" message

---

### Edge Cases

- What happens when the specflow CLI is not installed? (Show installation instructions)
- What happens when a command requires interactive input? (Not supported - show warning)
- What happens when the project path is invalid? (Clear error with path shown)
- What happens when multiple commands run simultaneously? (Queue or show "command in progress")
- What happens when the SSE connection drops during command execution? (Reconnect, show partial output)

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST execute `specflow` CLI commands via API routes using child process spawn
- **FR-002**: System MUST stream command stdout/stderr to the UI in real-time
- **FR-003**: System MUST display command results in an expandable drawer component
- **FR-004**: System MUST show toast notifications for command success/failure
- **FR-005**: System MUST sanitize all user inputs before passing to shell commands (prevent injection)
- **FR-006**: System MUST pass the correct project path (`--path` or cwd) to CLI commands
- **FR-007**: Command palette MUST list all available `specflow` commands (discovered dynamically from `specflow help` output)
- **FR-010**: System MUST prompt for required arguments inline after command selection
- **FR-011**: System MUST cache command list on startup and refresh periodically
- **FR-008**: System MUST handle command timeouts (default 60 seconds, configurable)
- **FR-009**: System MUST preserve command history for the session

### Non-Functional Requirements

- **NFR-001**: Command output streaming latency MUST be < 100ms
- **NFR-002**: Command palette MUST open in < 200ms
- **NFR-003**: API routes MUST not block the event loop during command execution

### Key Entities

- **Command**: A specflow CLI command with name, arguments, and project context
- **CommandExecution**: An instance of a command run, with output buffer, status, timestamps
- **CommandHistory**: Session-scoped list of past executions for review

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: User can execute `specflow issue create "test"` from command palette and issue file appears in < 3 seconds
- **SC-002**: Command output streams to drawer with < 100ms latency (visible character-by-character)
- **SC-003**: Error messages include actionable context (command that failed, exit code, stderr snippet)
- **SC-004**: Command palette shows all specflow commands (at least: issue, tasks, phase, state, status)

### Verification Gate (USER GATE)

- [ ] Create issue from UI appears in `.specify/issues/`
- [ ] Run any `specflow` command from command palette
- [ ] Command output streams to drawer in real-time
- [ ] Errors display in toast with helpful messages

---

## Non-Goals (Out of Scope)

- Task checkbox toggle from UI (agents mark tasks during implementation)
- Keyboard shortcut `t` for task toggle (deferred)
- Full `/specflow.orchestrate` from UI (complex, deferred to 1050)
- Persistent command history across sessions (nice-to-have for future)
- Command autocomplete/suggestions (nice-to-have for future)

---

## Technical Notes

Based on discovery findings:

1. **Shell-out pattern**: API routes spawn `specflow` child processes - reuses tested CLI logic
2. **Output streaming**: Use Node.js child_process with streaming to Server-Sent Events
3. **Security**: Validate inputs with Zod, use parameterized arguments (no string interpolation)
4. **Project context**: Pass project path from registry or current selection
5. **SSE integration**: Command events can piggyback on existing SSE infrastructure or use separate endpoint
