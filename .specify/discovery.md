# Discovery: Phase 1020 - Real-Time File Watching

**Date**: 2026-01-17
**Phase**: 1020 - Real-Time File Watching

---

## Current Architecture

### Polling-Based Data Fetching
The dashboard currently uses a polling approach via the `usePolling` hook:
- **Location**: `packages/dashboard/src/hooks/use-polling.ts`
- **Interval**: 5 seconds (hardcoded default)
- **Mechanism**: `setInterval` + `fetch()` to `/api/projects`

```typescript
// Current implementation
export function usePolling<T>(url: string, intervalMs: number = 5000): PollingResult<T>
```

### API Route
- **Location**: `packages/dashboard/src/app/api/projects/route.ts`
- **Reads**: `~/.speckit/registry.json`
- **Validation**: Zod schema from `@speckit/shared`
- **Features**: dev_folders filtering, path existence checks

### Tech Stack (from tech-stack.md)
- **File watching**: chokidar 3.x (already approved)
- **Real-time**: WebSocket (already approved)
- **Framework**: Next.js 16 with App Router

---

## Technical Considerations

### WebSocket Implementation in Next.js
Next.js App Router doesn't natively support WebSocket connections in API routes. Options:

1. **Custom Server** - Wrap Next.js with custom server (express/ws)
   - Pros: Full control, standard WebSocket
   - Cons: Can't use `next start`, deployment complexity

2. **Server-Sent Events (SSE)** - Use streaming response
   - Pros: Works with App Router, simpler
   - Cons: One-way (server → client), reconnection handling needed

3. **Separate WebSocket Process** - Run watcher as separate process
   - Pros: Clean separation, can run independently
   - Cons: Two processes to manage, port coordination

### Files to Watch
1. `~/.speckit/registry.json` - Project list changes
2. `<project>/.specify/orchestration-state.json` - State changes per project

### Debouncing Strategy
- File saves can trigger multiple events (write, change, etc.)
- Recommend 100-300ms debounce to batch rapid changes
- Use lodash debounce or custom implementation

---

## Decisions Made

### Transport: Server-Sent Events (SSE)
- Works natively with Next.js App Router (streaming response)
- EventSource API has built-in reconnection
- One-way server→client is sufficient for our needs
- No custom server required

### Watch Scope: Registry + All Project States
- Watch `~/.speckit/registry.json` for project list changes
- Watch `<project>/.specify/orchestration-state.json` for ALL registered projects
- More comprehensive file watching but ensures all state changes are reflected

### Status UI: Both Dot and Toast
- Persistent status dot in header (green=connected, red/yellow=disconnected)
- Toast notifications when connection status changes
- Provides both at-a-glance and explicit feedback

---

## Final Architecture

```
[chokidar watcher] → [SSE endpoint] → [EventSource client] → [React state]
                                                           ↓
                                                    [UI updates]
```

1. **Server-side watcher** (chokidar) watches:
   - `~/.speckit/registry.json`
   - All registered projects' `orchestration-state.json` files

2. **SSE endpoint** (`/api/events`) streams changes to connected clients

3. **Client hook** (`useSSE`) subscribes to events and updates React state

4. **UI components** react to state changes + show connection status
