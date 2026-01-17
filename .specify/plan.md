# Implementation Plan: Real-Time File Watching

**Branch**: `1020-real-time-file-watching` | **Date**: 2026-01-17 | **Spec**: `.specify/spec.md`

## Summary

Replace polling-based data fetching with Server-Sent Events (SSE) for real-time updates. Implement file watching using chokidar to detect changes to registry.json and project state files, pushing updates to connected dashboard clients instantly.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 16, chokidar 3.x, React 19
**Storage**: File system (`~/.speckit/registry.json`, project state files)
**Testing**: Manual verification (user stories), integration tests
**Target Platform**: macOS/Linux desktop
**Project Type**: Web (pnpm monorepo)
**Performance Goals**: Updates visible within 2 seconds of file change
**Constraints**: Must work with Next.js App Router (no custom server)
**Scale/Scope**: Single user, ~10-50 registered projects

## Constitution Check

- **POSIX-Compliant Bash** (Principle II): N/A - this is TypeScript/React
- **CLI Over Direct Edits** (Principle III): Dashboard reads files, doesn't write them
- **File watching**: Approved in tech-stack.md (chokidar 3.x)
- **WebSocket/SSE**: Approved in tech-stack.md

No violations.

## Project Structure

### Documentation (this feature)

```text
.specify/
├── discovery.md         # Codebase analysis and decisions
├── spec.md              # Feature specification
├── plan.md              # This file
├── tasks.md             # Implementation tasks (next step)
└── checklist.md         # Verification checklist
```

### Source Code

```text
packages/dashboard/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── projects/route.ts    # Existing - to be updated
│   │       └── events/route.ts      # NEW - SSE endpoint
│   ├── lib/
│   │   └── watcher.ts               # NEW - File watcher service
│   ├── hooks/
│   │   ├── use-polling.ts           # Existing - to be replaced
│   │   └── use-sse.ts               # NEW - SSE subscription hook
│   └── components/
│       ├── connection-status.tsx    # NEW - Status indicator
│       └── projects/
│           └── project-list.tsx     # Update to use SSE
└── package.json                     # Add chokidar dependency

packages/shared/
└── src/schemas/
    └── events.ts                    # NEW - SSE event schemas
```

## Architecture

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   File System   │────▶│   Watcher       │────▶│  SSE Endpoint   │
│  - registry.json│     │  (chokidar)     │     │  /api/events    │
│  - state files  │     │  - debounce     │     │  - streaming    │
└─────────────────┘     │  - validate     │     └────────┬────────┘
                        └─────────────────┘              │
                                                         │ EventSource
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React UI      │◀────│   useSSE Hook   │◀────│   Browser       │
│  - project list │     │  - state mgmt   │     │  EventSource    │
│  - status dot   │     │  - reconnect    │     │  auto-reconnect │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Event Types

```typescript
type SSEEvent =
  | { type: 'registry'; data: Registry }           // Full registry on change
  | { type: 'state'; projectId: string; data: State } // Single project state
  | { type: 'connected' }                          // Initial connection
  | { type: 'heartbeat' }                          // Keep-alive (every 30s)
```

### Watcher Behavior

1. **Singleton instance**: One watcher per Next.js process
2. **Watch registry**: Always watch `~/.speckit/registry.json`
3. **Watch states**: Watch state files for all registered projects
4. **Dynamic updates**: When registry changes, update watched state file paths
5. **Debouncing**: 200ms debounce to batch rapid changes
6. **Validation**: Parse file with Zod before emitting; ignore invalid content

### Client Behavior

1. **Connect on mount**: Open EventSource to `/api/events`
2. **Handle events**: Update React state based on event type
3. **Auto-reconnect**: EventSource handles reconnection automatically
4. **Refetch on reconnect**: Request full data on reconnection
5. **Status tracking**: Track `connected | connecting | disconnected`

## Implementation Phases

### Phase A: Server-Side Watcher (Backend)
1. Add chokidar dependency
2. Create watcher singleton with debouncing
3. Create SSE endpoint `/api/events`
4. Test with curl/EventSource

### Phase B: Client Integration (Frontend)
1. Create `useSSE` hook
2. Update `project-list.tsx` to use SSE
3. Remove/deprecate `usePolling` hook
4. Test real-time updates

### Phase C: Status UI
1. Create connection status component
2. Add toast notifications (sonner)
3. Integrate into dashboard header
4. Test disconnect/reconnect scenarios

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SSE connection drops silently | Heartbeat every 30s, client-side timeout detection |
| Many projects = many file watchers | chokidar handles multiple paths efficiently |
| Next.js cold starts kill watcher | Watcher is recreated on first request |
| Memory leak from stale connections | Clean up on client disconnect |
