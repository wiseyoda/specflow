# Feature Specification: Workflow-Session Unification

**Feature Branch**: `1053-workflow-session-unification`
**Created**: 2026-01-19
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Start Workflow and See Session Immediately (Priority: P1)

User starts a workflow from the dashboard and can immediately see the session activity without race conditions or delays.

**Why this priority**: This is the core problem being solved - fixing unreliable session detection that causes the Session Viewer to show wrong/no session data.

**Independent Test**: Start a workflow, verify session ID appears in workflow state within 2 seconds of first CLI response completing, Session Viewer shows correct session content.

**Acceptance Scenarios**:

1. **Given** a registered project with no active workflow, **When** user starts a workflow from the dashboard, **Then** the workflow state includes `sessionId` once the first CLI response completes
2. **Given** a running workflow, **When** the Session Viewer drawer is opened, **Then** it displays messages from the correct session (not a stale/different session)
3. **Given** a workflow that just started, **When** session ID is not yet available, **Then** UI shows "Session pending..." state gracefully

---

### User Story 2 - View Session History (Priority: P2)

User can view a list of all past workflow sessions for a project and click any session to view its messages.

**Why this priority**: Extends the core fix to provide history browsing, making past sessions accessible.

**Independent Test**: View project detail, see list of past sessions, click one to view its messages in the Session Viewer.

**Acceptance Scenarios**:

1. **Given** a project with multiple completed workflows, **When** user views project detail, **Then** they see a "Sessions" section listing past sessions with timestamps and skills
2. **Given** a session history list, **When** user clicks a session, **Then** the Session Viewer drawer opens showing that session's messages
3. **Given** a session history list, **When** user clicks the currently active session, **Then** it opens with live updates enabled

---

### User Story 3 - Resume Any Past Session (Priority: P3)

User can select any past session and send a follow-up message to continue that conversation.

**Why this priority**: Nice-to-have capability that enables flexibility in resuming work from any point.

**Independent Test**: Open past session in Session Viewer, type follow-up message, workflow resumes with that session context.

**Acceptance Scenarios**:

1. **Given** a completed workflow session, **When** user opens Session Viewer and types a follow-up message, **Then** a new workflow starts using `--resume {sessionId}` with the follow-up as the prompt
2. **Given** an active workflow session, **When** user types a follow-up, **Then** it queues as an answer/continuation (existing behavior)

---

### Edge Cases

- **CLI crashes before returning**: Workflow marked as failed, no sessionId available, user can retry
- **Multiple workflows started rapidly**: Each workflow gets unique session - no race conditions because session ID comes from JSON output, not timestamp matching
- **Orphaned session files**: Sessions without matching workflow metadata are ignored (not displayed in history)
- **Session Viewer opened before session ID available**: Show "Waiting for session..." placeholder until sessionId populated

## Requirements

### Functional Requirements

#### Session ID Detection
- **FR-001**: System MUST obtain session ID from CLI JSON output `session_id` field, not from polling `sessions-index.json`
- **FR-002**: System MUST NOT use timestamp-based session matching (`findNewSession()` function to be removed)
- **FR-003**: Workflow state MUST include `sessionId` field populated once first CLI response is received

#### Storage Architecture
- **FR-004**: Workflow metadata MUST be stored at `{project}/.specflow/workflows/{session_id}/metadata.json`
- **FR-005**: System MUST maintain an index at `.specflow/workflows/index.json` for quick listing
- **FR-006**: System MUST NOT copy session JSONL files - link to Claude's storage at `~/.claude/projects/{hash}/{session_id}.jsonl`
- **FR-007**: `.specflow/workflows/` directory MUST be added to `.gitignore` automatically

#### Session Listing
- **FR-008**: API MUST provide endpoint to list all sessions for a project: `GET /api/session/history?projectPath=<path>`
- **FR-009**: Session list MUST include: sessionId, skill name, status, startedAt timestamp, updatedAt timestamp, cost
- **FR-010**: Sessions MUST be sorted by started timestamp (most recent first)

#### Session Viewer Integration
- **FR-011**: Session Viewer drawer MUST accept explicit sessionId prop (not auto-discover)
- **FR-012**: Clicking a session in history MUST open Session Viewer with that specific session
- **FR-013**: Active session indicator MUST clearly show which session is "current" vs historical

#### Resume Capability
- **FR-014**: Follow-up input on any session MUST use `--resume {sessionId}` CLI flag
- **FR-015**: Resuming a session MUST create a new workflow execution linked to the same session

#### Migration
- **FR-016**: System MUST delete existing workflow files in `~/.specflow/workflows/` on upgrade (no migration)
- **FR-017**: Existing active workflows MUST gracefully complete before cleanup

### Key Entities

- **WorkflowExecution**: Extended to require sessionId (from CLI output), stored per-project
- **WorkflowIndex**: Quick lookup of all sessions for a project `[{sessionId, skill, status, startedAt, costUsd}]`
- **SessionReference**: Link from workflow to Claude's JSONL file location

## Success Criteria

### Measurable Outcomes

- **SC-001**: Session ID available within 2 seconds of first CLI response completing (vs current 5-10s polling delay)
- **SC-002**: Session Viewer shows correct session 100% of the time (vs current race condition failures)
- **SC-003**: Zero race conditions when starting multiple workflows sequentially on same project
- **SC-004**: User can view and resume any of the last 50 sessions for a project

## Non-Goals (Out of Scope)

- Full session replay/playback (stepping through messages)
- Session comparison (diffing two sessions)
- Export/archive sessions to external format
- Session search/filtering
- Migration of existing `~/.specflow/workflows/` data
- Session deletion/cleanup UI
