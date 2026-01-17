# Discovery: Phase 1040 - CLI Actions from UI

> Discovery completed: 2026-01-17

## Codebase Analysis

### Dashboard Architecture

The web dashboard is a Next.js 16 application with React 19, located in `/packages/dashboard/`. It uses:

- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context API (ConnectionContext)
- **Real-time**: Server-Sent Events (SSE) for file watching
- **Validation**: Zod schemas in `@speckit/shared`

### Current Data Flow

```
CLI writes files → Chokidar watcher detects → SSE broadcasts → React updates
```

The dashboard is currently **read-only** - no mutations from UI to CLI.

### Key Files

| Component | Location |
|-----------|----------|
| API Routes | `/packages/dashboard/src/app/api/` |
| SSE Events | `/packages/dashboard/src/app/api/events/route.ts` |
| File Watcher | `/packages/dashboard/src/lib/watcher.ts` |
| Task Parser | `/packages/dashboard/src/lib/task-parser.ts` |
| Task Card | `/packages/dashboard/src/components/projects/task-card.tsx` |
| Kanban View | `/packages/dashboard/src/components/projects/kanban-view.tsx` |
| Command Palette | `/packages/dashboard/src/components/command-palette.tsx` |

### Existing CLI Commands

Relevant commands for UI integration:

| Command | Purpose | JSON Support |
|---------|---------|--------------|
| `speckit tasks mark <id>...` | Mark task(s) complete | Yes |
| `speckit tasks status` | Get task counts | Yes |
| `speckit issue create <title>` | Create backlog item | Yes |
| `speckit issue list` | List issues | Yes |
| `speckit phase show <id>` | Get phase details | Yes |
| `speckit state set <key=value>` | Update orchestration state | No |

### Task Data Structure

From `@speckit/shared`:
```typescript
interface Task {
  id: string;           // e.g., "T001"
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  phase?: string;
  userStory?: string;
  isParallel?: boolean;
  filePath?: string;
}
```

### Command Palette Status

The command palette component exists (`/components/command-palette.tsx`) but shows "Coming Soon". It already:
- Responds to Cmd/Ctrl+K
- Uses shadcn/ui CommandDialog component
- Is ready for command registration

### Phase Requirements (from .specify/phases/1040)

**User Stories**:
1. Mark task complete from dashboard
2. Add backlog item without terminal
3. See command output in modal/drawer
4. Use keyboard shortcuts (e.g., `t` to toggle task)

**Verification Gate**: USER VERIFICATION REQUIRED
- Click task checkbox, updates in UI and on disk
- Add backlog item, appears in ROADMAP.md
- Keyboard shortcut `t` toggles selected task
- Errors show helpful messages

## Open Questions

### Q1: API Route Pattern
Should API routes shell out to CLI or call library functions directly?

**Options**:
- **Shell out to CLI**: Reuses existing tested commands, but adds process overhead
- **Call library functions**: Faster, but requires extracting/exposing bash logic or rewriting in TypeScript

### Q2: Task Toggle Behavior
Should clicking a task toggle it (complete ↔ incomplete) or only mark complete?

**Options**:
- **Toggle**: More intuitive, allows undoing mistakes
- **Complete only**: Simpler, matches `speckit tasks mark` which only completes

### Q3: Command Output Display
How should CLI output be displayed?

**Options**:
- **Toast notifications**: Non-intrusive, good for success/error
- **Modal dialog**: Shows full output, blocks interaction
- **Drawer/panel**: Shows output without blocking, can accumulate multiple commands

### Q4: Keyboard Shortcut Scope
Should keyboard shortcuts work globally or only in specific views?

**Options**:
- **Global**: `t` toggles anywhere (needs task selection concept)
- **Kanban-only**: `t` works in Kanban view where tasks are visible

### Q5: Backlog Item Creation
Should "Add backlog item" create an issue or add to ROADMAP.md?

**Current behavior**:
- `speckit issue create` creates `.specify/issues/ISSUE-XXX.md`
- Issues have category, priority, phase assignment
- ROADMAP.md has a separate "Issues Backlog" section

## Constraints Discovered

1. **Security**: Must validate/sanitize all inputs before shell commands (OWASP injection prevention)
2. **Path Resolution**: CLI commands need project path context - API must pass `--path` or `cwd`
3. **SSE Architecture**: Changes made via CLI are already broadcasted - UI updates automatically
4. **No TypeScript CLI**: All SpecKit commands are bash scripts - no existing TypeScript entry points

## Integration Points

```
User clicks task → API POST /api/tasks/[id]/complete
  → spawn('speckit', ['tasks', 'mark', id, '--path', projectPath])
  → Watcher detects tasks.md change
  → SSE broadcasts updated TasksData
  → UI re-renders with new status
```

## Recommendations

1. **Shell out to CLI** - Reuses tested logic, maintains single source of truth
2. **Toast + Drawer** - Non-intrusive feedback with expandable details for full output
3. **Full command palette** - Expose all `speckit` commands via Cmd+K
4. **Issue creation focus** - Primary backlog mechanism via `speckit issue create`
5. **Foundation for 1050** - Output streaming patterns reusable for agent logs

---

## Confirmed Scope (2026-01-17)

After user discussion, the scope has been **revised** from the original phase spec:

### In Scope
1. **API shell-out pattern** - Standard way to execute `speckit` commands from API routes
2. **Output streaming infrastructure** - Stream command output to UI (foundation for agent logs in 1050)
3. **Command palette** - Full `speckit` command access via Cmd+K
4. **Toast + Drawer feedback** - Non-intrusive notifications with expandable details
5. **Issue creation flow** - `speckit issue create` as primary backlog mechanism

### Revised Verification Gate
- Create issue from UI appears in `.specify/issues/`
- Run any `speckit` command from command palette
- Command output streams to drawer in real-time
- Errors display in toast with helpful messages

### Deferred (not in scope for 1040)
- Task checkbox toggle from UI (agents mark tasks during implementation)
- `t` keyboard shortcut for task toggle
- `/speckit.orchestrate` (complex, better suited for 1050's agent work)

### Rationale
- Task marking is agent-driven, not user-driven
- Focus on foundation that 1050 (Agent SDK Integration) will build upon
- Command palette enables all commands without hardcoding specific actions
