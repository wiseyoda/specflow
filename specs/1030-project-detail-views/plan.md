# Implementation Plan: Project Detail Views

> Technical implementation approach for Phase 1030

**Phase**: 1030
**Created**: 2026-01-17
**Input**: `.specify/spec.md`, `.specify/discovery.md`

---

## Technical Context

### Existing Infrastructure
- **SSE System**: File watcher + SSE endpoint from Phase 1020
- **Project List**: `useProjects()` hook with real-time updates
- **State Types**: `OrchestrationState` in `@specflow/shared`
- **UI Library**: shadcn/ui with Tailwind CSS
- **Routing**: Next.js App Router

### Constitution Compliance
- **Principle I (DX First)**: Fast navigation, intuitive views
- **Principle IV (Simplicity)**: Reuse existing SSE infrastructure
- **Principle VI (Graceful Degradation)**: Handle missing data gracefully

---

## Architecture

### Component Hierarchy

```
/app/projects/[id]/page.tsx (Server Component)
└── ProjectDetailClient (Client Component)
    ├── ProjectDetailHeader
    │   └── Breadcrumb, Back button, Project name
    ├── ViewTabs (shadcn/ui Tabs)
    │   ├── Tab: Status
    │   ├── Tab: Kanban
    │   └── Tab: Timeline
    └── ViewContent (conditional render)
        ├── StatusView
        │   ├── PhaseCard
        │   ├── HealthCard
        │   ├── ProgressCard
        │   └── MetadataCard
        ├── KanbanView
        │   ├── KanbanColumn (todo)
        │   ├── KanbanColumn (in_progress)
        │   └── KanbanColumn (done)
        │   └── TaskCard (per task)
        └── TimelineView
            └── PhaseTimelineItem (per phase)
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ File System                                             │
│  ├─ ~/.specflow/registry.json                            │
│  ├─ {project}/.specify/orchestration-state.json         │
│  └─ {project}/.specify/tasks.md (NEW)                   │
└──────────────────┬──────────────────────────────────────┘
                   │ chokidar watch
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Watcher (watcher.ts)                                    │
│  - Watch registry + state files (existing)              │
│  - Watch tasks.md files (NEW)                           │
│  - Parse tasks on change (NEW)                          │
└──────────────────┬──────────────────────────────────────┘
                   │ SSE events
                   ▼
┌─────────────────────────────────────────────────────────┐
│ SSE Endpoint (/api/events)                              │
│  - connected, heartbeat, registry, state (existing)     │
│  - tasks event (NEW)                                    │
└──────────────────┬──────────────────────────────────────┘
                   │ EventSource
                   ▼
┌─────────────────────────────────────────────────────────┐
│ useSSE Hook                                             │
│  - registry, states Map (existing)                      │
│  - tasks Map (NEW)                                      │
└──────────────────┬──────────────────────────────────────┘
                   │ Context
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Project Detail Page                                     │
│  - StatusView: uses states Map                          │
│  - KanbanView: uses tasks Map                           │
│  - TimelineView: uses states Map (history)              │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase A: Foundation (Route + Navigation)
1. Create dynamic route `/app/projects/[id]/page.tsx`
2. Update `ProjectCard` to link to detail page
3. Create `ProjectDetailHeader` with back navigation
4. Add Tabs component from shadcn/ui

### Phase B: Status View
1. Create `StatusView` component
2. Create card sub-components (Phase, Health, Progress, Metadata)
3. Wire up to existing SSE state data
4. Handle loading and error states

### Phase C: Task Infrastructure
1. Add task parsing utility
2. Extend watcher to monitor tasks.md files
3. Add `tasks` event type to SSE schema
4. Update `useSSE` hook to handle tasks events
5. Add tasks to ConnectionContext

### Phase D: Kanban View
1. Create `KanbanView` component
2. Create `KanbanColumn` component
3. Create `TaskCard` component
4. Wire up to tasks data from SSE

### Phase E: Timeline View
1. Create `TimelineView` component
2. Create `PhaseTimelineItem` component
3. Wire up to history data from state

### Phase F: Polish
1. View persistence in localStorage
2. Empty states and error handling
3. Loading skeletons
4. Responsive adjustments

---

## File Changes

### New Files
```
packages/dashboard/src/
├── app/projects/[id]/
│   └── page.tsx                      # Detail route
├── components/projects/
│   ├── project-detail-header.tsx     # Header with breadcrumb
│   ├── view-tabs.tsx                 # Tab navigation
│   ├── status-view.tsx               # Status cards grid
│   ├── kanban-view.tsx               # Kanban board
│   ├── kanban-column.tsx             # Single column
│   ├── task-card.tsx                 # Task card
│   ├── timeline-view.tsx             # Timeline display
│   └── phase-timeline-item.tsx       # Timeline entry
├── lib/
│   └── task-parser.ts                # Parse tasks.md
└── hooks/
    └── use-view-preference.ts        # localStorage hook

packages/shared/src/schemas/
└── tasks.ts                          # Task type schema (NEW)
```

### Modified Files
```
packages/dashboard/src/
├── lib/watcher.ts                    # Add tasks.md watching
├── hooks/use-sse.ts                  # Handle tasks events
├── contexts/connection-context.tsx   # Add tasks to context
├── components/projects/project-card.tsx  # Add Link to detail
└── components/ui/tabs.tsx            # Add from shadcn/ui

packages/shared/src/schemas/
├── events.ts                         # Add TasksEvent schema
└── index.ts                          # Export new types
```

---

## Data Schemas

### Task (parsed from tasks.md)
```typescript
interface Task {
  id: string;          // "T001"
  description: string; // "Create project detail route"
  status: 'todo' | 'in_progress' | 'done';
  phase?: string;      // "Setup", "Foundational", etc.
  userStory?: string;  // "US1", "US2", etc.
  isParallel?: boolean; // Has [P] marker
  filePath?: string;   // Extracted file path if present
}

interface TasksData {
  projectId: string;
  tasks: Task[];
  lastUpdated: string;
}
```

### Tasks SSE Event
```typescript
interface TasksEvent {
  type: 'tasks';
  timestamp: string;
  projectId: string;
  data: TasksData;
}
```

---

## Task Parsing Logic

### Input: tasks.md format
```markdown
## Phase 1: Setup
- [x] T001 Create project detail route
- [ ] T002 [P] Add navigation components

## Phase 2: User Story 1
- [ ] T003 [US1] Implement status cards
```

### Parsing Rules
1. Extract task ID from `T###` pattern
2. Status: `[x]` = done, `[ ]` = todo
3. Phase: Extracted from `## Phase N: Name` headers
4. User Story: `[US#]` marker
5. Parallel: `[P]` marker
6. File path: Backticks or last path-like segment

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tasks.md format varies | Flexible parser with fallbacks |
| Large task files slow UI | Pagination/virtualization if needed |
| SSE overload with many files | Debounce task file changes |
| Missing tasks.md | Show helpful empty state |

---

## Testing Strategy

### Manual Tests
1. Click project → navigates to detail page
2. Tabs switch views correctly
3. State updates in real-time
4. Tasks show in correct columns
5. View preference persists

### Verification Points
- [ ] Route parameter matches project UUID
- [ ] Back button returns to list
- [ ] SSE connection maintained on detail page
- [ ] Task parser handles edge cases
