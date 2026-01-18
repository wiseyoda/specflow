# Specification: Project Detail Views

> Rich project views with multiple visualization modes

**Phase**: 1030
**Status**: Draft
**Created**: 2026-01-17

---

## Overview

### Goal
Provide rich project detail views with multiple visualization modes, enabling developers to quickly understand project status, track tasks, and view phase progression.

### User Stories

1. **US1**: As a developer, I click a project and see its current status at a glance
2. **US2**: As a developer, I can switch between Status, Kanban, and Timeline views
3. **US3**: As a developer, I see tasks organized by status in Kanban view
4. **US4**: As a developer, I see phase history on a timeline

### Success Criteria
- Project detail page loads within 500ms
- View mode persists across browser sessions
- Real-time updates via existing SSE infrastructure
- All three views functional: Status, Kanban, Timeline

---

## Requirements

### R1: Project Detail Route
- **R1.1**: Create dynamic route at `/projects/[id]`
- **R1.2**: Accept project UUID as route parameter
- **R1.3**: Display 404 page for invalid project IDs
- **R1.4**: Include breadcrumb navigation back to project list

### R2: Status Card View (Default)
- **R2.1**: Display current phase name and number
- **R2.2**: Show phase status (in_progress, complete, blocked)
- **R2.3**: Display health indicator (healthy, warning, error)
- **R2.4**: Show task progress (completed/total with percentage)
- **R2.5**: Display current orchestration step
- **R2.6**: Show project metadata (path, registered date)
- **R2.7**: Real-time updates via SSE when state changes

### R3: Kanban Board View
- **R3.1**: Display tasks in three columns: Todo, In Progress, Done
- **R3.2**: Parse tasks from project's `.specify/tasks.md` file
- **R3.3**: Task cards show: ID, description, phase (if present)
- **R3.4**: Support filtering by phase/user story
- **R3.5**: Read-only display (no drag-drop in this phase)
- **R3.6**: Handle projects without tasks.md gracefully

### R4: Timeline View
- **R4.1**: Display phases chronologically
- **R4.2**: Show completed phases from `actions.history[]`
- **R4.3**: Highlight current active phase
- **R4.4**: Display phase dates and duration
- **R4.5**: Show phase status indicators

### R5: View Mode Management
- **R5.1**: Tab navigation for switching views
- **R5.2**: Persist selected view per project in localStorage
- **R5.3**: Default to Status view on first visit
- **R5.4**: Smooth transition between views

### R6: Navigation Integration
- **R6.1**: Update `ProjectCard` to link to detail page
- **R6.2**: Add back navigation from detail page
- **R6.3**: Update sidebar to show active project (when on detail page)

---

## Non-Requirements (Out of Scope)

- Drag-and-drop task reordering (future phase)
- Task editing from dashboard
- Direct ROADMAP.md editing
- Mobile-responsive design
- Project settings/configuration
- Multi-project comparison views

---

## Technical Approach

### Data Sources
| View | Primary Data Source | Update Mechanism |
|------|---------------------|------------------|
| Status | `OrchestrationState` from SSE | Real-time via existing SSE |
| Kanban | `.specify/tasks.md` file | Real-time via extended SSE watcher |
| Timeline | `actions.history[]` + state | Real-time via existing SSE |

**Clarification (C1)**: Tasks will be fetched via SSE by extending the file watcher to monitor `tasks.md` files. This provides real-time updates when tasks are marked complete.

### API Endpoints
- `GET /api/projects/[id]` - Fetch detailed project state
- `GET /api/projects/[id]/tasks` - Parse and return tasks from tasks.md

### Component Structure
```
/projects/[id]/page.tsx
├── ProjectDetailHeader (breadcrumb, project name)
├── ViewTabs (Status | Kanban | Timeline)
└── ViewContent
    ├── StatusView
    │   ├── PhaseCard
    │   ├── HealthCard
    │   ├── ProgressCard
    │   └── MetadataCard
    ├── KanbanView
    │   ├── KanbanColumn (Todo)
    │   ├── KanbanColumn (In Progress)
    │   └── KanbanColumn (Done)
    └── TimelineView
        └── PhaseTimeline
```

### State Management
- View preference: localStorage (`specflow-view-preference-{projectId}`)
- Project data: From `useConnection()` context (SSE)
- Tasks data: Fetched via API, cached locally

---

## UI Specifications

### View Tabs
- Use shadcn/ui `Tabs` component
- Horizontal tabs below project header
- Active tab highlighted
- Icons: LayoutGrid (Status), Columns (Kanban), Timeline icon

### Status View Cards
- 2x2 grid layout on desktop
- Cards for: Phase, Health, Progress, Metadata
- Consistent card styling from existing shadcn/ui

### Kanban Columns
- Three equal-width columns
- Column headers: "Todo", "In Progress", "Done"
- Task counts in column headers
- Scrollable columns for many tasks

### Timeline
- Vertical timeline with phases
- Completed phases: muted/grayed
- Current phase: highlighted
- Future phases: dotted/placeholder style

---

## Edge Cases

### E1: Project Without State File
- Show empty state with message
- Suggest running `specflow init` in project

### E2: Project Without Tasks
- Kanban view shows empty columns
- Message: "No tasks found. Run /specflow.tasks to generate."

### E3: Invalid Project ID
- Return 404 page
- Suggest navigating back to project list

### E4: SSE Disconnection
- Show connection status indicator
- Cache last known state
- Retry connection automatically

---

## Dependencies

### External
- shadcn/ui Tabs component (may need to add)
- Date formatting library (use native Intl or date-fns if needed)

### Internal
- Existing SSE infrastructure from Phase 1020
- `useConnection()` hook
- `OrchestrationState` type from shared package

---

## Verification Criteria

- [ ] Clicking project card navigates to `/projects/[id]`
- [ ] Status view displays current phase and health
- [ ] Kanban view shows tasks in correct columns
- [ ] Timeline view shows phase progression
- [ ] View preference persists in localStorage
- [ ] Back navigation returns to project list
- [ ] Real-time updates work for Status view
