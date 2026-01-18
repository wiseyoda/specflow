# Technical Implementation Plan: Phase 1040 - CLI Actions from UI

**Created**: 2026-01-17
**Status**: Draft
**Constitution Compliance**: Verified against Principles I, III, V

---

## Technical Context

### Existing Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Dashboard App | `packages/dashboard/` | Next.js 16 + React 19 |
| SSE Events API | `src/app/api/events/route.ts` | Real-time file watching |
| Command Palette | `src/components/command-palette.tsx` | "Coming Soon" placeholder |
| UI Components | `src/components/ui/` | shadcn/ui components |
| Shared Types | `packages/shared/` | Zod schemas |

### New Components Needed

| Component | Purpose |
|-----------|---------|
| CLI Executor API | Execute `specflow` commands via child process |
| Command Streaming | SSE endpoint for command output |
| Command Palette (full) | Searchable command list with argument prompts |
| Output Drawer | Expandable panel for command output |
| Toast Provider | Notifications for success/error |
| Command Discovery | Parse `specflow help` for available commands |

---

## Architecture

### Data Flow

```
User selects command in palette
    ↓
Command palette prompts for arguments (if needed)
    ↓
POST /api/commands/execute { command, args, projectPath }
    ↓
API spawns child process: specflow <command> <args> --path <projectPath>
    ↓
SSE streams stdout/stderr to client via /api/commands/stream?id=<executionId>
    ↓
Drawer displays streaming output
    ↓
On completion: Toast shows success/error
    ↓
File watcher detects changes → existing SSE updates UI state
```

### API Design

#### POST `/api/commands/execute`

Start command execution, return execution ID for streaming.

```typescript
// Request
{
  command: string;       // e.g., "issue create"
  args: string[];        // e.g., ["My issue title"]
  projectPath: string;   // Absolute path to project
}

// Response
{
  executionId: string;   // UUID for tracking
  streamUrl: string;     // SSE endpoint for output
}
```

#### GET `/api/commands/stream?id=<executionId>`

SSE endpoint for streaming command output.

```typescript
// SSE Events
{ type: "stdout", data: "line of output" }
{ type: "stderr", data: "error line" }
{ type: "exit", code: 0, signal: null }
{ type: "error", message: "spawn failed" }
```

#### GET `/api/commands/list`

Return available commands (cached, refreshed periodically).

```typescript
// Response
{
  commands: [
    { name: "issue", subcommands: ["list", "create", "show", "close"] },
    { name: "tasks", subcommands: ["status", "mark", "incomplete"] },
    { name: "phase", subcommands: ["show", "list", "archive"] },
    { name: "state", subcommands: ["get", "set", "validate"] },
    { name: "status", subcommands: [] }
  ],
  lastRefreshed: "2026-01-17T12:00:00Z"
}
```

---

## Component Design

### 1. CLI Executor Service

**File**: `src/lib/cli-executor.ts`

```typescript
interface CommandExecution {
  id: string;
  command: string;
  args: string[];
  projectPath: string;
  status: 'running' | 'completed' | 'failed';
  exitCode?: number;
  output: string[];
  startedAt: Date;
  completedAt?: Date;
}

class CLIExecutor {
  private executions: Map<string, CommandExecution>;

  execute(command: string, args: string[], projectPath: string): string;
  getExecution(id: string): CommandExecution | undefined;
  stream(id: string): AsyncIterable<OutputEvent>;
  cancel(id: string): boolean;
}
```

**Security**:
- Validate command is in allowed list (from `specflow help`)
- Sanitize args using Zod schema (no shell metacharacters)
- Never use string interpolation for command construction

### 2. Command Discovery

**File**: `src/lib/command-discovery.ts`

Parse `specflow help` output to extract available commands.

```typescript
interface SpecflowCommand {
  name: string;
  description: string;
  subcommands: SpecflowSubcommand[];
}

interface SpecflowSubcommand {
  name: string;
  description: string;
  requiresArgs: boolean;
  argPrompt?: string; // e.g., "Enter issue title"
}

async function discoverCommands(): Promise<SpecflowCommand[]>;
```

**Caching**: Store in memory, refresh on dashboard startup and every 5 minutes.

### 3. Command Palette (Enhanced)

**File**: `src/components/command-palette.tsx` (overwrite existing)

Features:
- Search/filter commands by name
- Show command descriptions
- Inline argument prompt (input field appears after selection)
- Recent commands section
- Project context indicator

Uses shadcn/ui `CommandDialog`, `CommandInput`, `CommandList`, `CommandItem`.

### 4. Output Drawer

**File**: `src/components/output-drawer.tsx`

Features:
- Expandable/collapsible panel
- Auto-scroll to bottom during streaming
- ANSI color support (optional, nice-to-have)
- Copy output button
- Clear/close button

Uses shadcn/ui `Sheet` component (side drawer).

### 5. Toast Notifications

**File**: `src/components/toast-provider.tsx`

Already exists via shadcn/ui. Use `sonner` or `react-hot-toast` pattern.

Features:
- Success: Green with checkmark, auto-dismiss 3s
- Error: Red with X, persist until dismissed, "View Details" action
- Info: Blue, auto-dismiss 5s

---

## Constitution Compliance

| Principle | How Addressed |
|-----------|---------------|
| I. Developer Experience First | Intuitive command palette, clear error messages |
| III. CLI Over Direct Edits | All actions go through `specflow` CLI |
| V. Helpful Error Messages | Errors include command, exit code, stderr excerpt |
| VII. Three-Line Output Rule | N/A (applies to CLI output, not UI) |

---

## Implementation Phases

### Phase A: Core Infrastructure (Foundation)

1. CLI Executor service with spawn/streaming
2. Execute API route (`/api/commands/execute`)
3. Stream API route (`/api/commands/stream`)
4. Basic security validation

### Phase B: Command Discovery

1. Parse `specflow help` output
2. Command list API route (`/api/commands/list`)
3. Cache management

### Phase C: UI Components

1. Output drawer component
2. Toast integration
3. Command palette enhancement
4. Argument prompt flow

### Phase D: Integration

1. Connect palette to executor
2. Wire up streaming to drawer
3. Error handling flow
4. Command history (session-scoped)

---

## Testing Strategy

| Test Type | What to Test |
|-----------|--------------|
| Unit | CLI executor spawning, argument sanitization |
| Integration | API routes end-to-end |
| E2E | Command palette → drawer output flow |
| Manual | User gate verification items |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Command injection | Allowlist + parameterized args |
| Hanging commands | 60s timeout with cancel option |
| Large output | Truncate after 100KB, offer "View Full" |
| Concurrent commands | Allow 1 at a time per project initially |

---

## Dependencies

No new dependencies required. Using existing:
- `child_process` (Node.js built-in)
- shadcn/ui components (already installed)
- Zod (already in shared package)

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/lib/cli-executor.ts` | Command execution service |
| `src/lib/command-discovery.ts` | Parse specflow help |
| `src/app/api/commands/execute/route.ts` | Execute command API |
| `src/app/api/commands/stream/route.ts` | SSE streaming API |
| `src/app/api/commands/list/route.ts` | Available commands API |
| `src/components/output-drawer.tsx` | Command output panel |
| `packages/shared/src/schemas/commands.ts` | Command-related types |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/command-palette.tsx` | Full implementation |
| `src/app/layout.tsx` | Add toast provider if needed |
| `src/contexts/connection-context.tsx` | Add command state if needed |
