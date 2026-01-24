# Implementation Plan: JSONL File Watcher & Polling Elimination

**Branch**: `1056-jsonl-watcher-push-updates` | **Date**: 2026-01-22 | **Spec**: [spec.md](spec.md)

## Summary

Replace all polling mechanisms in the SpecFlow dashboard with file-watching via chokidar. The orchestration runner will become fully event-driven, eliminating subprocess calls to `specflow status --json`. Session JSONL files will be watched to provide sub-500ms real-time updates.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, ESM)
**Primary Dependencies**: chokidar v3.x (existing), EventSource (SSE)
**Storage**: File system watching (no database)
**Testing**: Vitest (existing)
**Target Platform**: Node.js 20.x, macOS/Linux
**Project Type**: Monorepo (packages/dashboard, packages/shared)
**Performance Goals**: <500ms latency for all real-time updates
**Constraints**: macOS 256 file watcher limit, 200ms debounce
**Scale/Scope**: Single user dashboard, ~10 concurrent projects max

## Constitution Check

- **Principle VIII** (Repo Knowledge vs Operational State): Session JSONL files are operational state - watched, not archived
- **Principle VI** (Graceful Degradation): SSE auto-reconnects on failure
- **Principle IIa** (TypeScript): All changes use TypeScript with strict mode

## Project Structure

### Documentation (this feature)

```text
specs/1056-jsonl-watcher/
├── discovery.md         # Codebase examination findings
├── spec.md              # Feature specification
├── requirements.md      # Requirements checklist
├── plan.md              # This file
├── tasks.md             # Task breakdown
└── checklists/          # Implementation & verification checklists
```

### Source Code (repository root)

```text
packages/dashboard/
├── src/
│   ├── app/api/events/route.ts    # SSE endpoint - emit new events
│   ├── hooks/
│   │   ├── use-sse.ts             # Handle new event types
│   │   ├── use-session-content.ts # Convert to SSE-based
│   │   ├── use-workflow-execution.ts  # DELETE
│   │   ├── use-workflow-list.ts       # DELETE
│   │   ├── use-session-history.ts     # DELETE
│   │   └── use-session-messages.ts    # DELETE
│   ├── lib/
│   │   ├── watcher.ts             # Add session JSONL watching
│   │   ├── session-polling-manager.ts  # DELETE
│   │   └── services/
│   │       └── orchestration-runner.ts # Event-driven conversion
│   └── contexts/
│       └── unified-data-context.tsx   # Session content from SSE

packages/shared/
└── src/schemas/
    └── events.ts              # New SSE event type definitions
```

**Structure Decision**: Web app (backend + frontend in packages/dashboard)

## Implementation Phases

### Phase 0.5: Delete Polling Hooks

Delete deprecated hooks first to establish clean baseline:
- `use-workflow-execution.ts` - replaced by useProjectData
- `use-workflow-list.ts` - replaced by useUnifiedData
- `use-session-history.ts` - replaced by useProjectData.sessions
- `use-session-messages.ts` - replaced by useSessionContent (SSE)
- `session-polling-manager.ts` - replaced by file watching

Fix any import errors after deletion.

### Phase 1: Event Types & Schemas

Add new SSE event types to `packages/shared/src/schemas/events.ts`:

```typescript
// Session events
| { type: 'session:message'; projectId: string; sessionId: string; data: SessionMessage[] }
| { type: 'session:question'; projectId: string; sessionId: string; data: Question }
| { type: 'session:end'; projectId: string; sessionId: string }

// Orchestration events
| { type: 'orchestration:decision'; projectId: string; data: DecisionLogEntry }
| { type: 'orchestration:batch'; projectId: string; data: BatchProgress }
```

### Phase 2: Session File Watching

Extend watcher.ts to watch session JSONL files:

1. Calculate session directory: `~/.claude/projects/{projectHash}/`
2. Add glob pattern: `${sessionDir}/*.jsonl`
3. On change: parse new lines, emit session:* events
4. 100ms debounce for session files (faster than 200ms for project files)

### Phase 3: Orchestration Runner Conversion

Replace polling loop with event-driven:

1. Subscribe to file change events
2. Derive task counts from tasks.md parsing (no subprocess)
3. Derive artifact existence from file system checks
4. Replace `while(running) { sleep }` with event handlers
5. Delete `getSpecflowStatus()` subprocess function

### Phase 4: Client Hook Updates

1. Update useSSE to handle session:* and orchestration:* events
2. Update useSessionContent to read from SSE context
3. Update unified-data-context to store session content

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `use-workflow-execution.ts` | DELETE | Deprecated polling |
| `use-workflow-list.ts` | DELETE | Deprecated polling |
| `use-session-history.ts` | DELETE | Deprecated polling |
| `use-session-messages.ts` | DELETE | Deprecated polling |
| `session-polling-manager.ts` | DELETE | Polling manager |
| `packages/shared/src/schemas/events.ts` | MODIFY | New event types |
| `src/lib/watcher.ts` | MODIFY | Session JSONL watching |
| `src/app/api/events/route.ts` | MODIFY | Emit new events |
| `src/hooks/use-sse.ts` | MODIFY | Handle new events |
| `src/hooks/use-session-content.ts` | MODIFY | SSE-based |
| `src/lib/services/orchestration-runner.ts` | MODIFY | Event-driven |
| `src/contexts/unified-data-context.tsx` | MODIFY | Session from SSE |

## Key Technical Decisions

### Session Directory Calculation

Use existing `calculateProjectHash()` from `src/lib/project-hash.ts`:

```typescript
import { getProjectSessionDir } from '@/lib/project-hash';

// Claude stores session files in ~/.claude/projects/{dirName}/
// where dirName is the project path with slashes replaced by dashes
// e.g., /Users/dev/myproject -> -Users-dev-myproject

const sessionDir = getProjectSessionDir(projectPath);
// Returns: ~/.claude/projects/-Users-dev-myproject/
```

### Task Count Derivation

```typescript
import { readFile } from 'fs/promises';

async function getTaskCounts(tasksPath: string): Promise<{ completed: number; total: number }> {
  const content = await readFile(tasksPath, 'utf-8');
  const lines = content.split('\n');

  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const match = line.match(/^- \[([ xX])\] T\d{3}/);
    if (match) {
      total++;
      if (match[1].toLowerCase() === 'x') completed++;
    }
  }

  return { completed, total };
}
```

### Debounce Configuration

```typescript
const DEBOUNCE_MS = {
  project: 200,  // Existing, proven stable
  session: 100,  // Faster for real-time feel
};
```
