# Feature Specification: Real-Time File Watching

**Feature Branch**: `1020-real-time-file-watching`
**Created**: 2026-01-17
**Status**: Draft
**Input**: Phase 1020 from ROADMAP.md

---

## User Scenarios & Testing

### User Story 1 - Instant State Updates (Priority: P1)

As a developer, when I run `speckit state set` in my terminal, I want to see the dashboard update immediately without manual refresh.

**Why this priority**: This is the core value proposition - eliminating the current 5-second polling delay and providing a responsive, real-time experience.

**Independent Test**: Run `speckit state set orchestration.phase.status=complete` in terminal and observe dashboard updates within 2 seconds.

**Acceptance Scenarios**:

1. **Given** dashboard is open and connected, **When** user runs `speckit state set orchestration.phase.status=complete` in terminal, **Then** the dashboard reflects the change within 2 seconds
2. **Given** dashboard is open and connected, **When** state file changes from any source (CLI, text editor), **Then** the dashboard updates automatically

---

### User Story 2 - Connection Status Visibility (Priority: P2)

As a developer, I want to see the connection status so I know if the dashboard is receiving live updates or needs a refresh.

**Why this priority**: Without status visibility, users won't know why updates might be delayed, leading to confusion.

**Independent Test**: Disconnect network/stop server and observe status indicator changes from green to red/yellow, with toast notification.

**Acceptance Scenarios**:

1. **Given** dashboard loads successfully, **When** SSE connection is established, **Then** status indicator shows green/connected
2. **Given** dashboard is connected, **When** connection is lost (server stops, network issues), **Then** status indicator shows red/yellow and toast appears
3. **Given** connection was lost, **When** connection is restored, **Then** status indicator returns to green and toast confirms reconnection

---

### User Story 3 - New Project Auto-Discovery (Priority: P3)

As a developer, when I register a new project via `speckit init`, I want it to appear in the dashboard without refreshing.

**Why this priority**: Complements core functionality but less frequent than state changes.

**Independent Test**: Run `speckit init` in a new project directory and observe it appearing in dashboard project list.

**Acceptance Scenarios**:

1. **Given** dashboard is open, **When** user registers a new project, **Then** project appears in list within 2 seconds
2. **Given** dashboard shows a project, **When** project is unregistered, **Then** project is removed from list within 2 seconds

---

### Edge Cases

- What happens when registry.json is malformed or temporarily invalid during write? → Debounce and validate before emitting event
- What happens when a watched project directory is deleted? → Mark as unavailable, don't crash watcher
- What happens when many state files change simultaneously? → Debounce to prevent event flooding
- What happens when client reconnects after long disconnect? → Refetch full state, don't rely on missed events

## Requirements

### Functional Requirements

- **FR-001**: System MUST watch `~/.speckit/registry.json` for changes
- **FR-002**: System MUST watch `<project>/.specify/orchestration-state.json` for all registered projects
- **FR-003**: System MUST push updates to connected clients via Server-Sent Events (SSE)
- **FR-004**: System MUST debounce file change events (100-300ms) to prevent duplicate updates
- **FR-005**: System MUST validate file contents before emitting events (ignore malformed/partial writes)
- **FR-006**: Client MUST display persistent connection status indicator (green dot = connected)
- **FR-007**: Client MUST show toast notifications on connection status changes
- **FR-008**: Client MUST auto-reconnect using EventSource's built-in reconnection
- **FR-009**: Client MUST refetch full data on reconnection (not rely on missed events)
- **FR-010**: System MUST dynamically update watched paths when projects are added/removed from registry

### Key Entities

- **SSE Event**: `{ type: 'registry' | 'state', project_id?: string, data: object }`
- **Connection Status**: `'connected' | 'connecting' | 'disconnected'`

## Success Criteria

### Measurable Outcomes

- **SC-001**: State changes reflected in UI within 2 seconds of file modification
- **SC-002**: Connection status indicator visible and accurate at all times
- **SC-003**: No duplicate events or UI flickering during rapid file changes
- **SC-004**: Graceful handling of malformed files (no crashes, clear error states)
- **SC-005**: Successful reconnection after network interruption without manual refresh
