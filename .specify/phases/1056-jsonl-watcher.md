---
phase: 1056
name: jsonl-watcher
status: not_started
created: 2026-01-22
updated: 2026-01-22
---

### 1056 - JSONL File Watcher & Polling Consolidation

**Goal**: Replace fragmented polling with unified push-based updates, providing near-instant UI updates and eliminating redundant polling loops across the dashboard.

**Context**: The dashboard has accumulated multiple polling loops:
- Session content: 3-second polling
- Workflow status: 3-second polling
- Orchestration runner: 3-second polling loop
- Various hooks polling the same data independently

This causes:
- Up to 3 seconds delay before UI updates
- Race conditions between multiple pollers
- Redundant API calls and file reads
- Each bug fix tends to add another polling mechanism

**Solution**: Unified event-driven architecture with JSONL file watching as the single source of truth.

---

## Phase 0: Discovery (REQUIRED FIRST)

Before implementation, map all current polling sources:

### 0.1 Inventory Current Polling
- [ ] Document all polling locations in dashboard codebase
- [ ] Identify polling intervals and what data each polls
- [ ] Map dependencies between pollers
- [ ] Identify which polls can be consolidated vs need to remain separate

### 0.2 Data Flow Analysis
- [ ] Map what data changes trigger what UI updates
- [ ] Identify the authoritative source for each piece of data
- [ ] Document current race conditions and their symptoms
- [ ] List all SSE endpoints that already exist

### 0.3 Consolidation Plan
- [ ] Design unified event taxonomy (what events, what data)
- [ ] Determine which components subscribe to which events
- [ ] Plan migration path (parallel run, then cutover)
- [ ] Define rollback strategy

**Discovery Deliverable**: `polling-consolidation-analysis.md` documenting findings

---

## Phase 1: Server-Side File Watcher

Implement file watching on the Next.js server:
- Watch active session JSONL files using `fs.watch` or `chokidar`
- Detect changes and parse new content
- Track which sessions are being watched (cleanup on disconnect)
- Handle file rotation/truncation gracefully

---

## Phase 2: Unified SSE Event Bus

### 2.1 SSE Endpoint
New API route for streaming ALL dashboard updates:
- `GET /api/events/stream?projectId=xxx`
- Single connection per project (not per session)
- Events cover: session, workflow, orchestration, task progress

### 2.2 Event Types
```typescript
type DashboardEvent =
  | { type: 'session:message'; data: SessionMessage }
  | { type: 'session:question'; data: Question }
  | { type: 'session:end'; data: { sessionId: string } }
  | { type: 'workflow:status'; data: WorkflowExecution }
  | { type: 'orchestration:progress'; data: OrchestrationProgress }
  | { type: 'orchestration:decision'; data: DecisionLogEntry }
  | { type: 'tasks:updated'; data: TaskProgress }
  | { type: 'heartbeat'; data: null };
```

### 2.3 Heartbeat & Reconnection
- Heartbeat every 30s to detect stale connections
- Client auto-reconnects with exponential backoff
- Server cleans up watchers on disconnect

---

## Phase 3: Orchestration Runner Integration

**Critical**: Migrate orchestration-runner from polling to event-driven:

### 3.1 Current Architecture (Polling)
```
orchestration-runner:
  while (running):
    load orchestration state
    load workflow status
    make decision
    execute decision
    sleep(3 seconds)
```

### 3.2 Target Architecture (Event-Driven)
```
orchestration-runner:
  subscribe to workflow events
  subscribe to specflow status events
  on event:
    make decision
    execute decision
  (no polling loop - purely reactive)
```

### 3.3 Migration Steps
- [ ] Add event emission when workflow status changes
- [ ] Add event emission when specflow status changes
- [ ] Create event handler in orchestration-runner
- [ ] Run parallel (events + polling) during transition
- [ ] Remove polling loop once events proven stable

---

## Phase 4: Client Hook Migration

### 4.1 Unified Event Hook
Create `useProjectEvents(projectId)`:
- Single SSE connection per project
- Dispatches events to appropriate state stores
- Handles reconnection transparently

### 4.2 Deprecate Polling Hooks
Migrate away from:
- `useWorkflowExecution` polling → SSE events
- `useSessionMessages` polling → SSE events
- `useOrchestration` polling → SSE events

### 4.3 Fallback Strategy
- Detect SSE connection failure
- Automatically fall back to consolidated polling (single poller, not multiple)
- Warn in console when in fallback mode

---

## Phase 5: Question Detection Enhancement

Improve question detection for instant display:
- Parse `AskUserQuestion` tool calls from JSONL in real-time
- Emit `session:question` SSE event immediately when detected
- Update `DecisionToast` visibility without waiting for workflow status poll

---

**Technical Notes:**

Architecture:
```
┌─────────────────┐     fs.watch      ┌─────────────────┐
│  JSONL file     │ ───────────────▶  │  Server (Next)  │
│  changes        │                   │  Event Bus      │
└─────────────────┘                   └────────┬────────┘
                                               │ SSE push
┌─────────────────┐                           │
│  specflow CLI   │ ──── status ─────────────▶│
│  state changes  │                           │
└─────────────────┘                           ▼
                                      ┌─────────────────┐
                                      │  Dashboard UI   │
                                      │  (single SSE)   │
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Orchestration  │
                                      │  Runner         │
                                      │  (event-driven) │
                                      └─────────────────┘
```

Considerations:
- File watcher limits on macOS (256 default, can be increased)
- Cleanup watchers for inactive sessions (5 min timeout)
- Rate limiting to prevent overwhelming clients (debounce 100ms)
- Graceful degradation to polling if SSE fails
- Single SSE connection per browser tab (avoid 6-connection limit)

---

**UI Components:**
- No new visual components - improves responsiveness of existing UI

**API Routes:**
- GET `/api/events/stream` - Unified SSE endpoint for all dashboard events

**Hooks:**
- `useProjectEvents.ts` - Single SSE hook per project
- Deprecate: `useWorkflowExecution`, `useSessionMessages` polling modes

**Services:**
- `event-bus.ts` - Server-side event aggregation and SSE management
- `session-watcher.ts` - JSONL file watcher
- `specflow-watcher.ts` - CLI state file watcher

---

**Dependencies:**
- Phase 1055 (Smart Batching) - Stable orchestration foundation

**Verification Gate: USER**
- [ ] Session messages appear within 500ms of Claude output
- [ ] Questions appear instantly (no 3s delay)
- [ ] Orchestration progress updates without polling
- [ ] Single SSE connection per project (verified in Network tab)
- [ ] Connection recovers gracefully after network interruption
- [ ] No memory leaks from file watchers
- [ ] Fallback to polling works when SSE unavailable
- [ ] orchestration-runner uses events, not polling loop

**Estimated Complexity**: Medium-High (due to migration scope)

**Risk Notes:**
- File watcher resource limits on systems with many concurrent sessions
- SSE connection limits in browsers (6 per domain in HTTP/1.1)
- Edge cases with rapid file changes (debouncing needed)
- Migration period where both polling and events coexist
