# Requirements Checklist: JSONL File Watcher

**Phase**: 1056-jsonl-watcher
**Created**: 2026-01-22

## Functional Requirements

- [ ] FR-001: Delete deprecated polling hooks (5 files)
- [ ] FR-002: Add session JSONL file watching to chokidar
- [ ] FR-003: Define session SSE event types (session:message, session:question, session:end)
- [ ] FR-004: Define orchestration SSE event types (orchestration:decision, orchestration:batch)
- [ ] FR-005: Emit session:message events on JSONL changes
- [ ] FR-006: Parse JSONL to extract questions, emit session:question
- [ ] FR-007: Detect session end markers, emit session:end
- [ ] FR-008: Update useSessionContent to use SSE
- [ ] FR-009: Update useSSE to handle new event types
- [ ] FR-010: Remove subprocess calls from orchestration runner
- [ ] FR-011: Derive task counts from tasks.md parsing
- [ ] FR-012: Derive artifact existence from file system
- [ ] FR-013: Event-driven orchestration loop
- [ ] FR-014: Watch tasks.md per-phase
- [ ] FR-015: Debounce 200ms project, 100ms session

## Non-Functional Requirements

- [ ] NFR-001: Session message latency <500ms
- [ ] NFR-002: Question detection latency <200ms
- [ ] NFR-003: Orchestration decision latency <500ms
- [ ] NFR-004: Zero subprocess calls for status
- [ ] NFR-005: Zero polling loops
- [ ] NFR-006: Glob patterns for file watching (macOS limit)
- [ ] NFR-007: Graceful JSONL parse error handling

## Success Criteria

- [ ] SC-001: Session latency 10x improvement
- [ ] SC-002: Question detection 25x improvement
- [ ] SC-003: Orchestration decision 6-10x improvement
- [ ] SC-004: Subprocess calls eliminated
- [ ] SC-005: Polling loops eliminated
- [ ] SC-006: Connection recovery preserved
