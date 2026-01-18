# Discovery: Phase 1045 - Project Actions & Health

> Generated from codebase examination on 2026-01-17

## Executive Summary

This phase adds actionable buttons to the dashboard for managing project lifecycle operations (init, doctor, scaffold, migrate). The existing infrastructure is well-suited for this feature - SSE streaming, command execution, and dialog components are all in place.

## Codebase Analysis

### 1. Dashboard UI Structure

**Key Components Found:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `project-card.tsx` | `src/components/projects/` | Main list item with status, phase, task progress |
| `project-list.tsx` | `src/components/projects/` | Container with SSE updates |
| `project-detail-header.tsx` | `src/components/projects/` | Header (minimal - just title/path) |
| `status-view.tsx` | `src/components/projects/` | 4-card grid: Phase, Health, Tasks, Info |

**Project Status Types (from project-card.tsx):**
```typescript
type ProjectStatus =
  | "not_initialized"  // No .specify/ or orchestration-state.json
  | "initializing"     // Setup in progress
  | "needs_setup"      // Has state but no orchestration object
  | "ready"            // Has state with orchestration
  | "error"            // Health status is error
```

### 2. SSE Infrastructure (Already Built in Phase 1020)

**Event Streaming Endpoint:** `/api/events`
- Location: `/packages/dashboard/src/app/api/events/route.ts`

**Event Types:**
- `connected` - Initial connection
- `heartbeat` - Keep-alive (every 30s)
- `registry` - Registry file changed
- `state` - Project state changed
- `tasks` - Tasks file changed

**File Watcher:** `/packages/dashboard/src/lib/watcher.ts`
- Uses `chokidar` for file system monitoring
- Debounces changes (200ms)
- Adds `_fileMtime` for activity tracking

### 3. Command Execution Infrastructure (Already Built)

**Execute Endpoint:** `POST /api/commands/execute`
- Location: `/packages/dashboard/src/app/api/commands/execute/route.ts`
- Returns: `{ executionId, streamUrl }`

**Stream Endpoint:** `GET /api/commands/stream?id={executionId}`
- Location: `/packages/dashboard/src/app/api/commands/stream/route.ts`
- Streams stdout/stderr/exit as SSE

**CLI Executor:** `/packages/dashboard/src/lib/cli-executor.ts`
- Singleton managing command execution
- 60-second timeout
- Sanitizes arguments against shell injection

### 4. UI Components Available

**Dialog System:** Radix UI (`@radix-ui/react-dialog`)
- Location: `/packages/dashboard/src/components/ui/dialog.tsx`
- Full modal infrastructure available

**Dropdown Menu:** Radix UI
- Location: `/packages/dashboard/src/components/ui/dropdown-menu.tsx`

**Button Variants:** CVA-based
- Variants: default, destructive, outline, secondary, ghost, link
- Sizes: default, sm, lg, icon

### 5. Allowed Commands (Security)

**Location:** `/packages/dashboard/src/lib/allowed-commands.ts`

Commands on allowlist:
- `help`, `issue`, `tasks`, `phase`, `state`, `status`
- `roadmap`, `gate`, `doctor`, `context`, `feature`
- `scaffold`, `lessons`, `templates`, `reconcile`

**Note:** `init` is NOT currently on the allowlist - needs to be added.

### 6. Types and Schemas

**Location:** `/packages/shared/src/schemas/`

**Orchestration State Schema (from events.ts):**
```typescript
interface OrchestrationState {
  schema_version: string
  project: { id, name, path }
  orchestration?: {
    phase?: { number, name, status }
    step?: { current, status }
  }
  health?: {
    status?: 'ready' | 'healthy' | 'warning' | 'error' | 'initializing'
    issues?: unknown[]
  }
}
```

## Integration Points

### Where to Add Action Buttons

**Option A: Card Level** (project-card.tsx)
- Quick inline actions on project list
- Space constrained

**Option B: Detail Page** (project-detail-header.tsx)
- Better for complex flows
- Room for multiple actions

**Option C: Both**
- Card: Single quick action
- Detail: Full actions menu

**Recommendation:** Option C - Card gets primary action, detail page gets full menu.

### Real-time Update Flow

1. User clicks action button
2. Dialog opens (confirmation if needed)
3. POST to `/api/commands/execute`
4. Get executionId, stream output via SSE
5. Show output in modal
6. On completion, file watcher detects changes
7. SSE broadcasts state update
8. Components re-render with new state

## Existing Patterns to Follow

### Command Execution Pattern
```typescript
// From cli-executor.ts
const result = await fetch('/api/commands/execute', {
  method: 'POST',
  body: JSON.stringify({
    command: 'doctor',
    args: ['--fix'],
    projectPath: '/path/to/project'
  })
});
const { executionId, streamUrl } = await result.json();
// Then connect to streamUrl for output
```

### Dialog Pattern
```typescript
// Existing dialog structure
<Dialog>
  <DialogTrigger asChild>
    <Button>Action</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Key Findings

### What Exists
1. ✅ SSE infrastructure for real-time updates
2. ✅ Command execution with streaming output
3. ✅ Dialog/modal components
4. ✅ Project status detection
5. ✅ Security allowlist for commands

### What Needs to Be Built
1. ❌ Action button components
2. ❌ Command output modal
3. ❌ Confirmation dialog for destructive ops
4. ❌ Context-aware button logic (show different buttons per status)
5. ❌ Health endpoint with detailed analysis

### Commands to Add to Allowlist
- `init` - Project initialization

### Commands Already Available
- `doctor` - Diagnose and fix issues
- `scaffold` - Set up project structure
- `state migrate` - v1 → v2 migration (uses `state` which is allowed)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Command hangs | 60s timeout already in cli-executor |
| Partial state after error | Run doctor after failed operations |
| User confusion | Clear confirmations with descriptions |
| Shell injection | Sanitization already in cli-executor |

## User Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Button Location | **Both** | Card gets primary action, Detail page gets full menu |
| Output Modal | **Stay Open** | User explicitly closes - safer for first-time users |
