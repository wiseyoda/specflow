# Discovery: JSONL File Watcher & Polling Elimination

**Phase**: `1056-jsonl-watcher`
**Created**: 2026-01-22
**Status**: Complete

## Phase Context

**Source**: ROADMAP phase 1056
**Goal**: Replace all polling with file-watching. Zero polling loops when complete.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `src/lib/watcher.ts:550-609` | Existing chokidar file watcher | Core infrastructure to extend |
| `src/app/api/events/route.ts` | SSE endpoint `/api/events` | Broadcast mechanism for new events |
| `src/hooks/use-sse.ts:44-128` | Client-side SSE connection hook | Need to handle new event types |
| `src/lib/services/orchestration-runner.ts:273-284` | Subprocess calls `specflow status --json` | Critical bottleneck to eliminate |
| `src/lib/session-polling-manager.ts` | Singleton session polling | To be replaced with file watching |
| `packages/shared/src/schemas/events.ts:157-165` | Current SSE event type definitions | Need new session/orchestration types |

### Existing Patterns & Conventions

- **Event broadcasting**: Watcher uses listener pattern with debounced file change handlers
- **Debouncing**: 200ms delay for file changes, proven stable in production
- **State management**: SSE context provides real-time state to React components
- **Polling pattern**: Deprecated hooks use setInterval with cleanup on unmount

### Integration Points

- **Chokidar watcher**: Add session JSONL file paths to existing watcher
- **SSE endpoint**: Extend event handlers for new event types
- **useSSE hook**: Add case handlers for session:message, session:question, etc.
- **UnifiedDataContext**: Store session content from SSE events

### Constraints Discovered

- **macOS file watcher limit**: 256 file descriptors - must use glob patterns not individual watchers
- **Session file location**: `~/.claude/projects/{hash}/*.jsonl` - outside project directories
- **Debounce tradeoff**: 200ms for project files, 100ms for session files (higher write frequency)

---

## Requirements Sources

### From ROADMAP/Phase File

1. Replace all polling with file-watching
2. Zero polling loops when complete
3. Session messages appear within 500ms
4. Questions appear instantly (<200ms)
5. Orchestration updates without polling
6. No `specflow status --json` subprocess calls

### From Analysis Document

**Source**: `.specify/phases/polling-consolidation-analysis.md`

| Polling Source | Interval | Impact | Migration |
|----------------|----------|--------|-----------|
| Orchestration runner subprocess | 3s | 1-2s latency per call | Watch files directly |
| Session polling manager | 5s | Delayed session updates | Watch JSONL files |
| useWorkflowExecution | 3s | Deprecated | Delete |
| useWorkflowList | 3s | Deprecated | Delete |
| useSessionHistory | 5s | Deprecated | Delete |
| useSessionMessages | 3s | Deprecated | Delete |

### From Memory Documents

- **Constitution Principle VIII**: Keep session JSONL as operational state
- **Constitution Principle VI**: Graceful degradation - fallback polling if chokidar fails
- **Tech Stack**: chokidar v3.x approved for file watching

---

## Scope Clarification

### Confirmed Understanding

**What the user wants to achieve**:
Replace all polling mechanisms in the dashboard with file-watching via chokidar, achieving sub-500ms latency for all real-time updates.

**How it relates to existing code**:
- Extend existing `watcher.ts` chokidar infrastructure
- Add new SSE event types for sessions and orchestration
- Delete deprecated polling hooks
- Modify orchestration-runner to be event-driven

**Key constraints and requirements**:
- No subprocess calls for `specflow status --json`
- Session JSONL files must be watched in `~/.claude/projects/`
- Must handle macOS file watcher limits via glob patterns
- Graceful degradation if file watching fails

**Technical approach**:
1. Delete deprecated polling hooks first (clean slate)
2. Add session JSONL watching to watcher.ts
3. Create new SSE event types
4. Convert orchestration runner to event-driven
5. Update client hooks to use SSE data

---

## Recommendations for SPECIFY

### Should Include in Spec

- FR: Delete 5 deprecated polling hooks
- FR: Add session JSONL file watching to chokidar
- FR: New SSE event types (session:message, session:question, session:end)
- FR: Event-driven orchestration runner (no subprocess)
- FR: Derive task counts from tasks.md parsing (not subprocess)
- NFR: <500ms session message latency
- NFR: <200ms question detection latency
- NFR: Zero subprocess calls for status

### Should Exclude from Spec (Non-Goals)

- Backward compatibility with old polling APIs
- Migration period with parallel systems
- Fallback polling (single user, just make it work)

### Potential Risks

- **File watcher limits**: Mitigated by glob patterns
- **JSONL parse errors**: Handle malformed lines gracefully
- **Connection interruption**: SSE auto-reconnects (existing behavior)
