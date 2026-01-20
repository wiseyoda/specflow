# Implementation Plan: Workflow-Session Unification

**Branch**: `1053-workflow-session-unification` | **Date**: 2026-01-19 | **Spec**: [spec.md](spec.md)

## Summary

Unify workflows and Claude sessions by:
1. Removing unreliable `sessions-index.json` polling
2. Using session ID directly from CLI JSON output
3. Moving workflow storage to project-local `.specflow/workflows/{session_id}/`
4. Adding session history UI in project detail

## Technical Context

**Language/Version**: TypeScript 5.7+
**Primary Dependencies**: Next.js 16.x, React 19.x, Commander.js, Zod 3.x
**Storage**: File-based JSON (workflow metadata), Claude JSONL (session content)
**Testing**: Vitest
**Target Platform**: macOS/Linux (dashboard runs locally)
**Project Type**: Monorepo (packages/dashboard, packages/cli, packages/shared)
**Performance Goals**: Session ID available <2s after CLI response
**Constraints**: No database, file-based persistence only
**Scale/Scope**: Up to 50 sessions per project in history

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ Pass | Fixes unreliable session detection |
| IIa. TypeScript for CLI | ✅ Pass | All changes in TypeScript |
| III. CLI Over Direct Edits | ⚠️ N/A | Dashboard internal state, not SpecFlow state |
| IV. Simplicity Over Cleverness | ✅ Pass | Removing polling complexity |
| VII. Three-Line Output Rule | ✅ N/A | No CLI output changes |
| VIII. Repo vs Operational State | ✅ Pass | `.specflow/` for operational workflow state |

## Project Structure

### Documentation (this feature)

```text
specs/1053-workflow-session-unification/
├── discovery.md         # Codebase examination
├── spec.md              # Feature specification
├── requirements.md      # Requirements checklist
├── ui-design.md         # Visual mockups
├── plan.md              # This file
├── tasks.md             # Task breakdown
└── checklists/          # Implementation & verification
```

### Source Code Changes

```text
packages/dashboard/src/
├── lib/
│   ├── services/
│   │   └── workflow-service.ts      # MODIFY: Remove polling, use JSON session_id
│   └── session-parser.ts            # EXISTING: No changes needed
├── hooks/
│   ├── use-workflow-execution.ts    # MODIFY: Handle session pending state
│   ├── use-session-messages.ts      # MODIFY: Accept explicit sessionId
│   └── use-session-history.ts       # NEW: Fetch session list
├── components/projects/
│   ├── session-viewer-drawer.tsx    # MODIFY: Add session pending state
│   ├── session-history-list.tsx     # NEW: Sessions table
│   └── session-pending-state.tsx    # NEW: Placeholder while awaiting session
└── app/api/
    ├── workflow/
    │   ├── start/route.ts           # MODIFY: Project-local storage
    │   ├── status/route.ts          # MODIFY: Read from project path
    │   └── list/route.ts            # MODIFY: Read from project path
    └── session/
        └── history/route.ts         # NEW: List sessions for project
```

## Implementation Approach

### Phase 1: Core Session ID Fix

1. **Remove polling**: Delete `findNewSession()` function from workflow-service.ts
2. **Use JSON output**: Session ID already parsed from `result.session_id` - just don't start parallel polling
3. **Handle pending state**: UI shows "Waiting for session..." until sessionId populated

### Phase 2: Storage Migration

1. **Move storage**: From `~/.specflow/workflows/{uuid}.json` to `{project}/.specflow/workflows/{sessionId}/metadata.json`
2. **Create index**: `.specflow/workflows/index.json` for quick listing
3. **Update APIs**: workflow/start, workflow/status, workflow/list to use project-local paths
4. **Cleanup**: Delete old global workflows on first run

### Phase 3: Session History UI

1. **New API**: `/api/session/history` returns sessions from index.json
2. **New hook**: `useSessionHistory()` fetches and caches session list
3. **New component**: `SessionHistoryList` renders sessions table
4. **Integration**: Add to project detail page

### Phase 4: Session Viewer Updates

1. **Explicit session**: Drawer receives sessionId prop (no auto-discovery)
2. **Pending state**: New `SessionPendingState` component
3. **Active indicator**: Highlight running session in list

## Data Model Changes

### WorkflowExecution (workflow-service.ts)

```typescript
// Before: stored at ~/.specflow/workflows/{id}.json
// After: stored at {project}/.specflow/workflows/{sessionId}/metadata.json

export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),           // Execution ID (internal)
  sessionId: z.string(),           // Claude session ID (required after first response)
  projectId: z.string(),           // Registry key
  projectPath: z.string(),         // Absolute path to project
  skill: z.string(),
  status: z.enum(['running', 'waiting_for_input', 'completed', 'failed', 'cancelled']),
  // ... rest unchanged
});
```

### WorkflowIndex (new)

```typescript
// Stored at {project}/.specflow/workflows/index.json
export const WorkflowIndexSchema = z.object({
  sessions: z.array(z.object({
    sessionId: z.string(),
    executionId: z.string().uuid(),
    skill: z.string(),
    status: z.enum(['running', 'waiting_for_input', 'completed', 'failed', 'cancelled']),
    startedAt: z.string(),
    updatedAt: z.string(),
    costUsd: z.number(),
  })),
});
```

## API Changes

### GET /api/session/history

**New endpoint** - List all sessions for a project

Request: `?projectPath=/Users/dev/myapp`

Response:
```json
{
  "sessions": [
    {
      "sessionId": "abc123",
      "skill": "/flow.orchestrate",
      "status": "running",
      "startedAt": "2026-01-19T10:00:00Z",
      "costUsd": 0.42
    }
  ]
}
```

### Modified: /api/workflow/start

Changes:
- Store workflow in `{projectPath}/.specflow/workflows/{sessionId}/metadata.json` (after session ID available)
- Temporarily store in `{projectPath}/.specflow/workflows/pending-{executionId}.json` until session ID received
- Update index.json on status changes

### Modified: /api/workflow/list

Changes:
- Read from project-local `.specflow/workflows/index.json` instead of global directory
- Return sessions sorted by startedAt descending

## Testing Strategy

1. **Unit tests**: Workflow service functions (session ID parsing, storage)
2. **Integration tests**: API endpoints return correct data
3. **Manual verification**:
   - Start workflow, verify session ID appears in <2s after first response
   - View session history, click session, verify correct content loads
   - Resume past session with follow-up message

## Complexity Tracking

No constitution violations requiring justification.
