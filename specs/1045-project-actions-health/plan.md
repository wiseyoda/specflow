# Implementation Plan: Phase 1045 - Project Actions & Health

> Version: 1.0.0
> Created: 2026-01-17
> Status: Draft

## Technical Context

### Existing Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| CLI Executor | `src/lib/cli-executor.ts` | Spawns speckit commands, handles timeout, streams output |
| Allowed Commands | `src/lib/allowed-commands.ts` | Security allowlist for commands |
| SSE Events | `src/app/api/events/route.ts` | Real-time updates via Server-Sent Events |
| File Watcher | `src/lib/watcher.ts` | Detects state/task file changes with chokidar |
| Dialog Components | `src/components/ui/dialog.tsx` | Radix UI dialog primitives |
| Dropdown Menu | `src/components/ui/dropdown-menu.tsx` | Radix UI dropdown menu |
| Project Card | `src/components/projects/project-card.tsx` | Main project list item |
| Project Detail Header | `src/components/projects/project-detail-header.tsx` | Detail page header |

### Command Execution Flow

1. UI calls `POST /api/commands/execute` with command, args, projectPath
2. CLI Executor spawns `speckit <command> <args>` in project directory
3. stdout/stderr streamed via SSE to `/api/commands/stream?id=<executionId>`
4. On exit, file watcher detects state changes
5. SSE broadcasts `state` event to all connected clients
6. React components re-render with new state

### Key Types (from @speckit/shared)

```typescript
interface CommandExecution {
  id: string;
  command: string;
  args: string[];
  projectPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string[];
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
}

type CommandOutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number; signal?: string | null }
  | { type: 'error'; message: string };
```

## Constitution Compliance Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ | Primary goal - manage projects from UI |
| II. POSIX-Compliant Bash | N/A | Frontend only |
| III. CLI Over Direct Edits | ✅ | All actions use CLI commands |
| IV. Simplicity Over Cleverness | ✅ | Reuse existing infrastructure |
| V. Helpful Error Messages | ✅ | Full command output shown |
| VI. Graceful Degradation | ✅ | Actions based on project status |

## Implementation Phases

### Phase 1: Foundation (New Files)

1. **Action Definitions** (`src/lib/action-definitions.ts`)
   - Define all available actions with metadata
   - Include command, arguments, confirmation requirements

2. **Confirmation Dialog** (`src/components/ui/confirmation-dialog.tsx`)
   - Reusable confirmation component
   - Title, description, confirm/cancel buttons
   - Keyboard accessible (Escape closes)

3. **Command Output Modal** (`src/components/projects/command-output-modal.tsx`)
   - Display streaming command output
   - Monospace font, scrollable
   - Success/error indicators
   - Copy output button

### Phase 2: Project Card Actions

4. **Action Button** (`src/components/projects/action-button.tsx`)
   - Context-aware button based on project status
   - Loading state during execution
   - Opens confirmation or output modal

5. **Integrate into Project Card**
   - Add ActionButton before ChevronRight
   - Handle click events
   - Manage execution state

### Phase 3: Detail Page Actions

6. **Actions Menu** (`src/components/projects/actions-menu.tsx`)
   - Dropdown menu with all actions
   - Grouped: Setup, Maintenance, Advanced
   - Disabled items based on project state

7. **Integrate into Project Detail Header**
   - Add ActionsMenu to header right side
   - Wire up action handlers

### Phase 4: Polish

8. **Add `init` to Allowed Commands**
   - Update `allowed-commands.ts`

9. **Type Definitions**
   - Add action types to shared schemas

10. **Edge Cases**
    - Handle running state (disable buttons)
    - Handle unavailable projects
    - SSE reconnection

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Project Card                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Project Info]                   [ActionButton] [>]     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
             ┌────────────────────────────────┐
             │     ConfirmationDialog         │
             │ ┌────────────────────────────┐ │
             │ │ Title                      │ │
             │ │ Description                │ │
             │ │ • What will happen         │ │
             │ │ [Cancel] [Confirm]         │ │
             │ └────────────────────────────┘ │
             └────────────────────────────────┘
                              │
                              ▼
             ┌────────────────────────────────┐
             │     CommandOutputModal         │
             │ ┌────────────────────────────┐ │
             │ │ Running: speckit init      │ │
             │ ├────────────────────────────┤ │
             │ │ $ speckit init             │ │
             │ │ Creating .specify/...      │ │
             │ │ Done!                      │ │
             │ ├────────────────────────────┤ │
             │ │ ✓ Completed [Copy]         │ │
             │ └────────────────────────────┘ │
             └────────────────────────────────┘
```

## Detailed Component Specs

### ActionDefinitions

```typescript
interface ActionDefinition {
  id: string;                    // Unique identifier
  label: string;                 // Display label
  description: string;           // Tooltip/help text
  command: string;               // CLI command (e.g., "init")
  args: string[];                // Default arguments
  requiresConfirmation: boolean; // Show confirmation dialog?
  confirmationTitle?: string;    // Confirmation dialog title
  confirmationDescription?: string; // What will happen
  confirmationItems?: string[];  // Bullet points of changes
  applicableStatuses: ProjectStatus[]; // When to show
  variant: 'default' | 'destructive' | 'outline'; // Button style
  group: 'setup' | 'maintenance' | 'advanced'; // Menu grouping
}
```

### ConfirmationDialog Props

```typescript
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items?: string[];              // Bullet list of what will happen
  confirmLabel?: string;         // Default: "Confirm"
  cancelLabel?: string;          // Default: "Cancel"
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;           // Disable buttons while loading
}
```

### CommandOutputModal Props

```typescript
interface CommandOutputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string;               // Display: "speckit init"
  executionId?: string;          // For streaming
  onComplete?: (success: boolean) => void;
}
```

### ActionButton Props

```typescript
interface ActionButtonProps {
  projectId: string;
  projectPath: string;
  projectStatus: ProjectStatus;
  isAvailable: boolean;          // Project path accessible?
  onExecutionStart?: () => void;
  onExecutionComplete?: (success: boolean) => void;
}
```

### ActionsMenu Props

```typescript
interface ActionsMenuProps {
  projectId: string;
  projectPath: string;
  projectStatus: ProjectStatus;
  schemaVersion?: string;        // For migrate option
  isAvailable: boolean;
  onExecutionStart?: () => void;
  onExecutionComplete?: (success: boolean) => void;
}
```

## State Management

### Execution State

Use React state within components:
- `isExecuting: boolean` - Command running
- `executionId: string | null` - Current execution ID
- `showConfirmation: boolean` - Confirmation dialog open
- `showOutput: boolean` - Output modal open

### Global Running State

Track which projects have running commands to disable buttons:
- Simple approach: Local state per component
- If needed later: Context provider for cross-component state

## API Integration

### Execute Action

```typescript
async function executeAction(
  action: ActionDefinition,
  projectPath: string
): Promise<{ executionId: string; streamUrl: string }> {
  const response = await fetch('/api/commands/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: action.command,
      args: action.args,
      projectPath,
    }),
  });
  return response.json();
}
```

### Stream Output

```typescript
function streamOutput(
  executionId: string,
  onEvent: (event: CommandOutputEvent) => void
): EventSource {
  const source = new EventSource(`/api/commands/stream?id=${executionId}`);

  source.onmessage = (e) => {
    const event = JSON.parse(e.data);
    onEvent(event);
  };

  return source;
}
```

## File Changes Summary

### New Files

| File | Purpose | Lines Est. |
|------|---------|------------|
| `src/lib/action-definitions.ts` | Action metadata | ~100 |
| `src/components/ui/confirmation-dialog.tsx` | Reusable confirmation | ~80 |
| `src/components/projects/command-output-modal.tsx` | Streaming output | ~150 |
| `src/components/projects/action-button.tsx` | Context-aware button | ~120 |
| `src/components/projects/actions-menu.tsx` | Dropdown menu | ~100 |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/allowed-commands.ts` | Add `init` to allowlist |
| `src/components/projects/project-card.tsx` | Add ActionButton |
| `src/components/projects/project-detail-header.tsx` | Add ActionsMenu |
| `packages/shared/src/schemas/commands.ts` | Add action types |

## Testing Strategy

### Manual Testing

1. **Initialize Action**
   - Create new folder, add to dev_folders
   - Verify "Initialize" button appears
   - Click, confirm, verify output streams
   - Verify project status updates to ready

2. **Doctor Action**
   - With warning project, verify "Doctor" button
   - Run, verify output shows issues
   - Run with --fix, verify confirmation

3. **Edge Cases**
   - Disconnect network during streaming
   - Cancel modal during execution
   - Click button rapidly (should be disabled)

### Future: Automated Tests

- Unit tests for action-definitions
- Component tests for confirmation dialog
- Integration tests for command execution

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Init command not in path | Low | High | Check speckit available before execute |
| SSE stream drops | Medium | Medium | EventSource auto-reconnects, show indicator |
| Race condition: multiple clicks | Medium | Low | Disable button while executing |
| Large output overwhelms UI | Low | Medium | Virtual scrolling if needed later |

## Dependencies

- Existing CLI commands work correctly
- SSE infrastructure stable
- File watcher detects changes promptly

## Success Criteria

1. User can initialize project from dashboard
2. User can run doctor from dashboard
3. Output streams in real-time
4. Status updates without refresh
5. Confirmation shown for destructive actions
6. Buttons disabled during execution
