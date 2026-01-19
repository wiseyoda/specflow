# Feature Specification: Session Viewer

**Feature Branch**: `1052-session-viewer`
**Created**: 2026-01-19
**Status**: Draft
**Input**: Phase 1052 - Session Viewer from ROADMAP.md

---

## User Scenarios & Testing

### User Story 1 - View Active Session Messages (Priority: P1)

A user running a workflow from the dashboard wants to see what Claude is doing in real-time. They click a "Session" button in the project header, and a slide-out panel shows the latest messages from the active session.

**Why this priority**: Core functionality - users need visibility into agent activity to understand progress and identify issues early.

**Independent Test**: Start a workflow, click Session button, verify messages appear and update as session progresses.

**Acceptance Scenarios**:

1. **Given** a workflow is running with a session ID, **When** user clicks "Session" button in header, **Then** a slide-out panel opens showing the last ~100 messages
2. **Given** the session viewer is open during an active workflow, **When** new messages are written to the JSONL file, **Then** the viewer updates automatically within 3 seconds
3. **Given** messages are displayed, **When** user scrolls up manually, **Then** auto-scroll pauses until user scrolls back to bottom

---

### User Story 2 - Locate Session Files via Hash (Priority: P2)

The system must locate Claude session files using the same project path hashing algorithm that Claude Code uses, ensuring reliable file discovery for any registered project.

**Why this priority**: Without correct file lookup, the session viewer cannot display any content.

**Independent Test**: Given a registered project path, verify the calculated hash matches the directory name in ~/.claude/projects/.

**Acceptance Scenarios**:

1. **Given** a project registered at `/Users/dev/myproject`, **When** session content is requested, **Then** the system calculates the correct hash and finds files in `~/.claude/projects/{hash}/`
2. **Given** a project has multiple sessions in its directory, **When** session content is requested with a specific sessionId, **Then** the correct .jsonl file is loaded

---

### User Story 3 - Message Display Formatting (Priority: P3)

Messages in the session viewer should be clearly formatted with visual distinction between user and assistant messages, timestamps, and appropriate styling for readability.

**Why this priority**: Usability enhancement - clear formatting helps users quickly scan and understand session content.

**Independent Test**: Open session viewer with a session containing both user and assistant messages, verify each type is visually distinct.

**Acceptance Scenarios**:

1. **Given** the session viewer is open, **When** displaying user messages, **Then** they appear with a distinct style (e.g., different background color, "User:" label)
2. **Given** the session viewer is open, **When** displaying assistant messages, **Then** they appear with a distinct style differentiating them from user messages
3. **Given** a message has a timestamp, **When** displayed, **Then** a human-readable time indicator is shown

---

### User Story 4 - Progress Indicators (Priority: P4)

The session viewer shows basic progress metrics including files modified count and time elapsed since session start.

**Why this priority**: Nice-to-have context that helps users gauge progress without reading every message.

**Independent Test**: With a session that has modified files, verify progress indicators show correct counts.

**Acceptance Scenarios**:

1. **Given** session viewer is open, **When** the session has been running, **Then** elapsed time since session start is displayed
2. **Given** session viewer is open, **When** parsing JSONL, **Then** file modification count is extracted from tool call metadata (tool calls are parsed for metrics but not displayed as messages)

---

### Edge Cases

- What happens when no active session exists? Display "No active session" message with explanation
- What happens when session file cannot be found? Display error message with troubleshooting hint
- What happens when JSONL contains malformed lines? Skip malformed lines, continue displaying valid messages
- What happens when session completes while viewer is open? Stop polling, show "Session completed" indicator

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a "Session" button in project detail header when a workflow execution exists
- **FR-002**: System MUST open a right-side slide-out panel (500px width) when Session button is clicked
- **FR-003**: System MUST parse Claude session JSONL files to extract messages
- **FR-004**: System MUST calculate project path hash using Claude Code's algorithm
- **FR-005**: System MUST display only user and assistant messages in the message list (tool calls are parsed for metrics but not displayed)
- **FR-006**: System MUST poll for new messages every 3 seconds during active sessions
- **FR-007**: System MUST implement auto-scroll that pauses when user scrolls up
- **FR-008**: System MUST show last ~100 messages in tail mode
- **FR-009**: System MUST display time elapsed since session start
- **FR-010**: System MUST display count of files modified (if detectable from messages)
- **FR-011**: System MUST stop polling when session reaches terminal state (completed/failed/cancelled)

### Key Entities

- **Session**: A Claude CLI execution identified by sessionId, with messages stored in JSONL format
- **Message**: A single line from JSONL with role (user/assistant), content, and optional timestamp
- **ProjectHash**: SHA-256 hash of UTF-8 encoded project path, truncated to 16 characters, used by Claude Code for directory naming

## Success Criteria

### Measurable Outcomes

- **SC-001**: Session viewer opens within 500ms of button click
- **SC-002**: Messages update within 3-second polling interval during active sessions
- **SC-003**: Panel correctly displays messages from 100% of valid JSONL files
- **SC-004**: Auto-scroll behavior works correctly when scrolled to bottom or scrolled up
- **SC-005**: Hash calculation matches Claude Code's algorithm for all tested project paths
