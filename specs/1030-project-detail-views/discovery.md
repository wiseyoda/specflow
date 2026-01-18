# Discovery: Phase 1030 - Project Detail Views

> Codebase examination and scope clarification findings

**Phase**: 1030 - project-detail-views
**Date**: 2026-01-17

---

## 1. Existing Implementation Analysis

### Current Dashboard Structure

**Routing**:
- Single page at `/` rendering `ProjectList`
- No dynamic routes exist yet
- Next.js App Router with API routes at `/api/`

**Component Architecture**:
```
packages/dashboard/src/
├── app/
│   ├── page.tsx                    # Home page with ProjectList
│   ├── layout.tsx                  # Root layout with providers
│   └── api/
│       ├── projects/route.ts       # Project list API
│       └── events/route.ts         # SSE endpoint
├── components/
│   ├── projects/
│   │   ├── project-list.tsx        # List container
│   │   ├── project-card.tsx        # Expandable card
│   │   └── empty-state.tsx         # Empty state
│   └── layout/
│       ├── main-layout.tsx         # Sidebar + Header wrapper
│       ├── header.tsx              # Top nav with status
│       └── sidebar.tsx             # Navigation sidebar
└── hooks/
    ├── use-projects.ts             # Project list with SSE
    ├── use-sse.ts                  # SSE subscription
    └── use-connection.ts           # Context consumer
```

### State Data Available

**From SSE (real-time via `useConnection()`)**:
- `registry`: All registered projects
- `states`: Map<projectId, OrchestrationState> with real-time updates

**OrchestrationState Schema** (from `.specify/orchestration-state.json`):
```typescript
{
  schema_version: string,
  project: { id, name, path, description, type, criticality, created_at, updated_at },
  config: { roadmap_path, memory_path, specs_path, scripts_path, templates_path },
  orchestration: {
    phase: { number, name, branch, status },
    step: { current, index, status },
    progress: { tasks_completed, tasks_total, percentage }
  },
  health: { status, last_check, issues },
  actions: { available, pending, history }
}
```

### UI Component Library

- **shadcn/ui**: Card, Button, Dialog, Command, DropdownMenu
- **lucide-react**: Icons
- **Tailwind CSS**: Styling with dark mode support
- **sonner**: Toast notifications

---

## 2. Integration Points

### Navigation
- `ProjectCard` currently expands inline (no navigation)
- Need to add `Link` from `next/link` for drill-down
- Route pattern: `/projects/[id]` (using project UUID)

### Data Access
- `useConnection()` provides `states` Map with project orchestration state
- SSE auto-updates when state files change
- May need new API endpoint for detailed project data (tasks, phases, etc.)

### File Watcher
- Watcher already monitors:
  - `~/.specflow/registry.json`
  - All project state files (`.specify/orchestration-state.json`)
- Could extend to watch `tasks.md` files for Kanban view

---

## 3. Key Decisions Needed

### View Modes
Phase spec mentions three views:
1. **Status Card View**: Current phase, health score, quick actions
2. **Kanban Board View**: Tasks in columns (todo/in-progress/done)
3. **Timeline View**: Phases on timeline with progress

### Open Questions

1. **Data Source for Kanban**:
   - Tasks live in `.specify/tasks.md` (markdown with checkboxes)
   - Need parser to extract task status
   - Real-time updates require watching this file

2. **Timeline Phases**:
   - Phase history in `actions.history[]` of orchestration state
   - ROADMAP.md has all phases
   - Need to decide which to display

3. **Navigation Pattern**:
   - Click card → detail page (new route)
   - Or: click card → expand inline (current pattern)
   - Phase spec says "Drill-down from project list to detail"

4. **View Persistence**:
   - localStorage for view mode preference (per spec)
   - Per-project or global preference?

---

## 4. Technical Constraints

### From Constitution/Tech Stack
- Next.js 14+ with App Router
- shadcn/ui components
- Tailwind CSS styling
- TypeScript strict mode
- pnpm workspaces

### From Existing Patterns
- SSE for real-time updates (no polling)
- Context for global state
- API routes for data fetching
- Skeleton loaders for loading states

---

## 5. Recommendations

### Minimal Implementation Path
1. Add `/projects/[id]` dynamic route
2. Create detail page with tabbed navigation
3. Status card as default view (uses existing SSE data)
4. Kanban as second priority (requires task parser)
5. Timeline as stretch goal (lower complexity)

### View Mode Considerations
- Status Card: Low complexity, uses existing data
- Kanban: Medium complexity, needs task file parsing
- Timeline: Medium complexity, needs phase data aggregation

---

## 6. User Decisions (Confirmed)

### Navigation Pattern
- **Decision**: Detail page at `/projects/[id]`
- Clicking project card navigates to dedicated detail page
- More room for multiple views, matches spec requirement

### View Tabs
- **Decision**: All three views in tabbed navigation
  1. **Status** (default/primary) - Current phase, health, quick actions
  2. **Kanban** - Tasks in todo/in-progress/done columns
  3. **Timeline** - Phase progression with history

### Kanban Interaction
- **Decision**: Read-only display (no drag-drop)
- Tasks displayed in columns based on checkbox state in tasks.md
- Source of truth remains tasks.md file
- Drag-drop deferred to future phase

### View Persistence
- Store selected view tab in localStorage
- Persist per-project (each project can have different preferred view)
