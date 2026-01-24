# Polling Consolidation Analysis

> **Phase 1056 Discovery Document**
> Generated: 2026-01-22
> Purpose: Map all polling sources before migrating to event-driven architecture

---

## Executive Summary

The SpecFlow dashboard has accumulated **9+ polling mechanisms** across client hooks, server services, and the orchestration runner. This document maps each source, its purpose, and the consolidation strategy.

**Key Finding**: The orchestration runner's `specflow status --json` subprocess call (~1-2s per call, every 3s) is the largest bottleneck and should be prioritized.

---

## Polling Inventory

### Critical Polling (High Impact)

| Source | Interval | File | Line | Impact |
|--------|----------|------|------|--------|
| Orchestration runner | 3s | `orchestration-runner.ts` | 614-695 | Spawns subprocess every poll |
| Orchestration status hook | 3s | `use-orchestration.ts` | 379 | Active during orchestration |
| Session polling manager | 5s | `session-polling-manager.ts` | 201 | **Unnecessary** - can file-watch |

### Deprecated Polling (Should Be Removed)

| Source | Interval | File | Replacement |
|--------|----------|------|-------------|
| `useWorkflowExecution` | 3s | `use-workflow-execution.ts:299` | `useProjectData()` + `useWorkflowActions()` |
| `useWorkflowList` | 3s | `use-workflow-list.ts:132` | `useUnifiedData()` |
| `useSessionHistory` | 5s | `use-session-history.ts:113` | `useProjectData()` |
| `useSessionMessages` | 3s | `use-session-messages.ts:195` | `useSessionContent()` |

### UI/Utility Polling (Low Priority)

| Source | Interval | File | Notes |
|--------|----------|------|-------|
| Status pill timer | 1s | `status-pill.tsx:75` | UI display only |
| Status message cycling | ~25s | `use-status-message.ts:82` | Motivational messages |
| Process spawner | 2s | `process-spawner.ts:182` | Checks workflow completion |
| SSE heartbeat | 30s | `watcher.ts:725` | Keep-alive (not data polling) |

---

## Data Flow Analysis

### What Data Changes Trigger What UI Updates

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA CHANGE SOURCES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Project Files (File-Watchable)          External Files         │
│  ├─ .specflow/orchestration-state.json   ├─ ~/.claude/...jsonl │
│  ├─ specs/{phase}/tasks.md               │   (CAN be watched!) │
│  ├─ specs/{phase}/spec.md                │                     │
│  ├─ specs/{phase}/plan.md                └───────────┬─────────┤
│  ├─ ROADMAP.md                                       │         │
│  └─ .specflow/workflows/index.json                   │         │
│                                                      │         │
└──────────────────────┬───────────────────────────────┘         │
                       │                                          │
                       ▼                                          ▼
              ┌─────────────────┐                      ┌──────────────────┐
              │  chokidar       │                      │  NEW: chokidar   │
              │  watcher.ts     │                      │  session watcher │
              └────────┬────────┘                      └────────┬─────────┘
                       │                                        │
                       ▼                                        ▼
              ┌─────────────────────────────────────────────────────────┐
              │              SSE Event Bus (/api/events)                │
              │  Events: state, tasks, workflow, phases, session:*      │
              └────────────────────────┬────────────────────────────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
              ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
              │ Dashboard   │  │ Orchestr.   │  │ Session         │
              │ UI          │  │ Runner      │  │ Viewer          │
              └─────────────┘  └─────────────┘  └─────────────────┘
```

### Authoritative Data Sources

| Data | Authoritative Source | Current Access | Target Access |
|------|---------------------|----------------|---------------|
| Task progress | `tasks.md` | Subprocess (`specflow status`) | File watch |
| Phase artifacts | `spec.md`, `plan.md` | Subprocess | File watch |
| Workflow status | `workflows/index.json` | File watch ✓ | File watch ✓ |
| Orchestration state | `orchestration-state.json` | File watch ✓ | File watch ✓ |
| Session messages | `~/.claude/.../session.jsonl` | 5s polling | File watch |
| Session questions | JSONL tool_use blocks | 5s polling | File watch |

---

## Race Conditions Identified

### 1. Orchestration Runner vs UI Polling
**Symptom**: UI shows stale state while orchestration advances
**Cause**: Both poll at 3s intervals, not synchronized
**Solution**: Single event source triggers both

### 2. Multiple Workflow Status Pollers
**Symptom**: Inconsistent workflow badges across components
**Cause**: `useWorkflowExecution`, `useWorkflowList`, `useOrchestration` all poll independently
**Solution**: Remove deprecated hooks, single SSE stream

### 3. Session End Detection Delay
**Symptom**: Session shows "running" up to 5s after completion
**Cause**: Polling interval masks immediate status
**Solution**: File-watch session JSONL for instant end detection

---

## Existing SSE Infrastructure

### Current SSE Endpoint: `/api/events`

```typescript
// Existing event types (watcher.ts)
type SSEEvent =
  | { type: 'connected'; timestamp: string }
  | { type: 'heartbeat'; timestamp: string }
  | { type: 'registry'; data: Registry }
  | { type: 'state'; projectId: string; data: OrchestrationState }
  | { type: 'tasks'; projectId: string; data: TasksData }
  | { type: 'workflow'; projectId: string; data: WorkflowData }
  | { type: 'phases'; projectId: string; data: PhasesData }
```

### New Event Types Needed

```typescript
// Session events (add to watcher.ts)
| { type: 'session:message'; projectId: string; sessionId: string; data: SessionMessage }
| { type: 'session:question'; projectId: string; sessionId: string; data: Question }
| { type: 'session:end'; projectId: string; sessionId: string }

// Orchestration events (add for runner)
| { type: 'orchestration:decision'; projectId: string; data: DecisionLogEntry }
| { type: 'orchestration:batch'; projectId: string; data: BatchProgress }
```

---

## Consolidation Plan

### Phase 0: Remove Deprecated Hooks
1. Audit component usage of deprecated hooks
2. Migrate to SSE-based equivalents
3. Delete deprecated hook files
4. **Eliminates**: 3 redundant polling loops (9s of polling per cycle)

### Phase 1: Add Session File Watching
1. Calculate session directory: `~/.claude/projects/{projectHash}/`
2. Add to chokidar watch list: `${sessionDir}/*.jsonl`
3. Parse new JSONL lines on file change
4. Emit `session:message` and `session:question` SSE events
5. **Eliminates**: sessionPollingManager (5s polling)

### Phase 2: Orchestration Runner Event-Driven
1. Subscribe runner to SSE events (not polling)
2. Trigger decision cycle on relevant events only
3. Remove `specflow status --json` subprocess calls
4. **Eliminates**: 3s polling + 1-2s subprocess per cycle

### Phase 3: Cleanup & Fallback
1. Add 30s fallback polling (emergency only)
2. Log event vs poll discrepancies
3. Remove fallback after stability period

---

## API Endpoints Being Polled

| Endpoint | Current Interval | Hooks Using It | After Consolidation |
|----------|------------------|----------------|---------------------|
| `/api/session/content` | 5s | sessionPollingManager | **Eliminated** (file watch) |
| `/api/session/active` | 3s | useSessionMessages | **Eliminated** (deprecated) |
| `/api/session/history` | 5s | useSessionHistory | **Eliminated** (deprecated) |
| `/api/workflow/list` | 3s | useWorkflowList, useWorkflowExecution | **Eliminated** (deprecated) |
| `/api/workflow/status` | 3s | useWorkflowExecution | **Eliminated** (deprecated) |
| `/api/workflow/orchestrate/status` | 3s | useOrchestration | SSE events |

---

## File Watcher Resource Limits

### macOS Limits
- Default: 256 file watchers
- With many projects: Could hit limit
- **Mitigation**: Use glob patterns instead of individual file watches

```typescript
// BAD: One watcher per file
projects.forEach(p => watcher.add(`${p.path}/tasks.md`));

// GOOD: Glob pattern from common root
watcher.add([
  `${homeDir}/.specflow/**/*.json`,
  `${homeDir}/.claude/projects/**/*.jsonl`,
  ...projects.map(p => `${p.path}/specs/**/tasks.md`),
]);
```

### Cleanup Strategy
- Remove watchers when project unregistered
- 5-minute timeout for inactive session watchers
- Track active subscriptions to avoid orphan watchers

---

## Migration Safety: Parallel Run Strategy

```
Week 1: Events + Polling (Both Active)
├─ Events trigger immediate updates
├─ Polling runs at 30s (reduced from 3s)
├─ Log any discrepancies between event and poll data
└─ Alert if discrepancy rate > 1%

Week 2: Events Primary, Polling Fallback
├─ Polling only runs if no event in 60s
├─ Considered "fallback mode"
└─ Log fallback activations

Week 3+: Events Only
├─ Remove polling code
├─ Keep heartbeat for connection health
└─ Monitor for missed events
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Session message latency | 0-5s | <500ms |
| Question appearance delay | 0-3s | <200ms |
| Orchestration decision latency | 3s | <500ms |
| Subprocess calls per minute | ~20 | 0 |
| Concurrent pollers per project | 4-6 | 0 |
| SSE connections per project | 1 | 1 (unchanged) |

---

## Files to Modify

### Remove/Deprecate
- `src/hooks/use-workflow-execution.ts` - Remove
- `src/hooks/use-workflow-list.ts` - Remove
- `src/hooks/use-session-history.ts` - Remove
- `src/hooks/use-session-messages.ts` - Remove
- `src/lib/session-polling-manager.ts` - Remove after session watching

### Modify
- `src/lib/watcher.ts` - Add session file watching
- `src/lib/services/orchestration-runner.ts` - Event-driven loop
- `src/app/api/events/route.ts` - New event types
- `packages/shared/src/schemas/events.ts` - New event type definitions

### New
- None needed (extend existing infrastructure)

---

## Appendix: Polling Code Locations

```
orchestration-runner.ts:614-695    # Main 3s loop
orchestration-runner.ts:273-284    # specflow status subprocess
use-orchestration.ts:379           # 3s orchestration status
use-workflow-execution.ts:299      # 3s workflow (deprecated)
use-workflow-list.ts:132           # 3s workflow list (deprecated)
use-session-history.ts:113         # 5s session history (deprecated)
use-session-messages.ts:195        # 3s session messages (deprecated)
session-polling-manager.ts:201     # 5s session content
process-spawner.ts:182             # 2s process completion
watcher.ts:725                     # 30s heartbeat (keep)
status-pill.tsx:75                 # 1s UI timer (keep)
use-status-message.ts:82           # 25s messages (keep)
```
