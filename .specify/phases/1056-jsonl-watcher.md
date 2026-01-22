---
phase: 1056
name: jsonl-watcher
status: not_started
created: 2026-01-22
updated: 2026-01-22
---

### 1056 - JSONL File Watcher (Push-Based Updates)

**Goal**: Replace polling with push-based updates for session content, providing near-instant UI updates when JSONL files change.

**Context**: Currently, the dashboard polls session files every 3 seconds. When Claude outputs messages or asks questions, there's up to 3 seconds of delay before the UI updates. This is especially problematic for questions where users need to respond promptly. File watching with Server-Sent Events (SSE) would provide instant updates.

---

**Scope:**

### 1. Server-Side File Watcher

Implement file watching on the Next.js server:
- Watch active session JSONL files using `fs.watch` or `chokidar`
- Detect changes and parse new content
- Track which sessions are being watched (cleanup on disconnect)
- Handle file rotation/truncation gracefully

### 2. SSE Endpoint

New API route for streaming session updates:
- `GET /api/session/stream?sessionId=xxx&projectPath=yyy`
- Returns Server-Sent Events stream
- Events: `message`, `question`, `tool_call`, `session_end`, `error`
- Heartbeat every 30s to detect stale connections
- Automatic cleanup when client disconnects

### 3. Client Hook Updates

Update `useSessionMessages` (or create new `useSessionStream`):
- Prefer SSE when available, fallback to polling
- Reconnect on connection loss with exponential backoff
- Merge streamed updates with existing state
- Handle out-of-order events gracefully

### 4. Question Detection Enhancement

Improve question detection for instant display:
- Parse `AskUserQuestion` tool calls from JSONL in real-time
- Emit `question` SSE event immediately when detected
- Update `DecisionToast` visibility without waiting for workflow status poll

---

**Technical Notes:**

Architecture:
```
┌─────────────────┐     fs.watch      ┌─────────────────┐
│  JSONL file     │ ───────────────▶  │  Server (Next)  │
│  changes        │                   │  detects change │
└─────────────────┘                   └────────┬────────┘
                                               │ SSE push
                                               ▼
                                      ┌─────────────────┐
                                      │  Client UI      │
                                      │  updates        │
                                      └─────────────────┘
```

SSE Event Format:
```typescript
interface SessionSSEEvent {
  type: 'message' | 'question' | 'tool_call' | 'session_end' | 'heartbeat';
  data: SessionMessage | Question | ToolCallInfo | null;
  timestamp: string;
}
```

Considerations:
- File watcher limits on macOS (256 default, can be increased)
- Cleanup watchers for inactive sessions (5 min timeout)
- Rate limiting to prevent overwhelming clients (debounce 100ms)
- Graceful degradation to polling if SSE fails

---

**UI Components:**
- No new visual components - improves responsiveness of existing UI

**API Routes:**
- GET `/api/session/stream` - SSE endpoint for session updates

**Hooks:**
- `useSessionStream.ts` - New hook for SSE-based session updates
- Update `useSessionMessages.ts` - Integrate SSE or keep as fallback

**Services:**
- `session-watcher.ts` - Server-side file watcher manager
- `sse-manager.ts` - SSE connection management

---

**Dependencies:**
- Phase 1055 (Smart Batching) - Stable orchestration foundation

**Verification Gate: USER**
- [ ] Session messages appear within 500ms of Claude output
- [ ] Questions appear instantly (no 3s delay)
- [ ] Connection recovers gracefully after network interruption
- [ ] No memory leaks from file watchers
- [ ] Fallback to polling works when SSE unavailable

**Estimated Complexity**: Medium

**Risk Notes:**
- File watcher resource limits on systems with many concurrent sessions
- SSE connection limits in browsers (6 per domain in HTTP/1.1)
- Edge cases with rapid file changes (debouncing needed)
