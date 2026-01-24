# Feature Specification: JSONL File Watcher & Polling Elimination

**Feature Branch**: `1056-jsonl-watcher-push-updates`
**Created**: 2026-01-22
**Status**: Draft

## ID Format Reference

| ID Format | Type | Example | Used For |
|-----------|------|---------|----------|
| `FR-###` | Functional Requirement | FR-001 | Must-have functionality |
| `NFR-###` | Non-Functional Requirement | NFR-001 | Performance, security, etc. |
| `SC-###` | Success Criteria | SC-001 | Measurable outcomes |
| `US-###` | User Story | US-001 | User journeys |

**Traceability chain**: Phase Goal -> FR-### -> T### -> V-###

---

## User Scenarios & Testing

### User Story 1 - Real-time Session Messages (Priority: P1)

When a Claude Code session is running, the user sees session messages in the dashboard within 500ms of them being written to the JSONL file, without any polling.

**Why this priority**: Core user experience - the dashboard exists to monitor sessions in real-time.

**Independent Test**: Start a session, type a message, observe it appearing in the dashboard within 500ms.

**Acceptance Scenarios**:

1. **Given** a running Claude Code session, **When** Claude writes a message to the JSONL file, **Then** the message appears in the dashboard within 500ms
2. **Given** a running session, **When** a question (AskUserQuestion tool) is written, **Then** the question notification appears within 200ms
3. **Given** a running session, **When** the session ends (end marker written), **Then** the session status updates immediately

---

### User Story 2 - Event-Driven Orchestration (Priority: P1)

The orchestration runner reacts to file changes instantly instead of polling every 3 seconds with a subprocess call.

**Why this priority**: Performance bottleneck - eliminates ~20 subprocess calls/minute.

**Independent Test**: Run orchestration, observe zero `specflow status --json` subprocess calls and decisions happening within 500ms of file changes.

**Acceptance Scenarios**:

1. **Given** orchestration is running, **When** tasks.md is updated, **Then** orchestration detects the change within 500ms without subprocess
2. **Given** orchestration is in implement phase, **When** all tasks are marked complete in tasks.md, **Then** orchestration advances to verify phase
3. **Given** orchestration is running, **When** spec.md/plan.md are created, **Then** orchestration detects artifacts exist

---

### User Story 3 - Clean Polling Removal (Priority: P2)

All deprecated polling hooks are deleted and replaced with SSE-based alternatives.

**Why this priority**: Technical debt cleanup - polling code is redundant with SSE infrastructure.

**Independent Test**: Grep for setInterval in hooks, find zero polling loops.

**Acceptance Scenarios**:

1. **Given** the codebase, **When** searching for deprecated polling hooks, **Then** use-workflow-execution.ts, use-workflow-list.ts, use-session-history.ts, use-session-messages.ts, session-polling-manager.ts do not exist
2. **Given** any component that used polling hooks, **When** rendered, **Then** it uses useUnifiedData or useSSE instead

---

### Edge Cases

- What happens when a JSONL file is malformed? -> Skip malformed lines, log warning
- What happens when chokidar fails to initialize? -> Graceful degradation, log error, dashboard shows stale data
- What happens when too many files are watched (macOS limit)? -> Use glob patterns, monitor watcher count
- What happens when SSE connection drops? -> Auto-reconnect (existing behavior), show stale data during disconnection

## Requirements

### Functional Requirements

- **FR-001**: System MUST delete deprecated polling hooks: use-workflow-execution.ts, use-workflow-list.ts, use-session-history.ts, use-session-messages.ts, session-polling-manager.ts
- **FR-002**: System MUST add session JSONL file watching to chokidar watcher for paths `~/.claude/projects/{hash}/*.jsonl`
- **FR-003**: System MUST define new SSE event types: session:message, session:question, session:end
- **FR-004**: System MUST define new SSE event types: orchestration:decision, orchestration:batch
- **FR-005**: System MUST emit session:message events when JSONL file content changes
- **FR-006**: System MUST parse JSONL files to extract questions (AskUserQuestion tool calls) and emit session:question events
- **FR-007**: System MUST detect session end markers in JSONL and emit session:end events
- **FR-008**: System MUST update useSessionContent hook to consume SSE events instead of polling
- **FR-009**: System MUST update useSSE hook to handle new session and orchestration event types
- **FR-010**: Orchestration runner MUST NOT call `specflow status --json` subprocess
- **FR-011**: Orchestration runner MUST derive task counts by parsing tasks.md directly
- **FR-012**: Orchestration runner MUST derive artifact existence by checking file system directly
- **FR-013**: Orchestration runner MUST use event-driven loop (file change triggers decision) instead of sleep-poll loop
- **FR-014**: System MUST watch tasks.md files per-phase for orchestration task tracking
- **FR-015**: System MUST use 200ms debounce for project files, 100ms for session files

### Non-Functional Requirements

- **NFR-001**: Session message latency MUST be <500ms from file write to UI update
- **NFR-002**: Question detection latency MUST be <200ms from file write to notification
- **NFR-003**: Orchestration decision latency MUST be <500ms from file change to decision
- **NFR-004**: System MUST use zero subprocess calls for status during orchestration
- **NFR-005**: System MUST have zero polling loops (setInterval for data fetching)
- **NFR-006**: File watcher MUST use glob patterns to stay within macOS 256 watcher limit
- **NFR-007**: System MUST handle malformed JSONL lines gracefully (skip, don't crash)

### Key Entities

- **SessionFile**: JSONL file at `~/.claude/projects/{hash}/{sessionId}.jsonl` containing session messages
- **SessionMessage**: Individual line in JSONL file representing a message, tool call, or event
- **SSEEvent**: Server-sent event with type discriminator (session:message, session:question, etc.)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Session message latency 0-5s -> <500ms (10x improvement)
- **SC-002**: Question detection latency 0-5s -> <200ms (25x improvement)
- **SC-003**: Orchestration decision latency 3-5s -> <500ms (6-10x improvement)
- **SC-004**: Subprocess calls per minute ~20 -> 0 (complete elimination)
- **SC-005**: Polling loops in codebase 9+ -> 0 (complete elimination)
- **SC-006**: Connection recovery works on network interruption (existing behavior preserved)

---

## Memory Promotion Markers

`[PROMOTE]` File watching with 200ms debounce is proven stable for project files; use 100ms for higher-frequency session files.

`[PROMOTE]` Use glob patterns for file watching to avoid macOS 256 watcher limit.
