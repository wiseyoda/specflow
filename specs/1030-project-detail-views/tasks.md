# Tasks: Project Detail Views

## Progress Dashboard

> Last updated: 2026-01-17 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 3/3 |
| Foundation | DONE | 4/4 |
| Status View | DONE | 5/5 |
| Task Infrastructure | DONE | 6/6 |
| Kanban View | DONE | 4/4 |
| Timeline View | DONE | 3/3 |
| Polish | DONE | 4/4 |

**Overall**: 29/29 (100%) | **Current**: Complete

---

**Input**: `.specify/plan.md`, `.specify/spec.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add shadcn/ui components and create base structure

- [x] T001 Add Tabs component from shadcn/ui: `npx shadcn@latest add tabs`
- [x] T002 [P] Create task schema in `packages/shared/src/schemas/tasks.ts`
- [x] T003 [P] Export task types from `packages/shared/src/schemas/index.ts`

---

## Phase 2: Foundation (Route + Navigation)

**Purpose**: Create project detail route and navigation

- [x] T004 [US1] Create dynamic route at `packages/dashboard/src/app/projects/[id]/page.tsx`
- [x] T005 [US1] Create `ProjectDetailHeader` component in `packages/dashboard/src/components/projects/project-detail-header.tsx`
- [x] T006 [US1] Create `ViewTabs` component in `packages/dashboard/src/components/projects/view-tabs.tsx`
- [x] T007 [US1] Update `ProjectCard` to add Link navigation to detail page

**Checkpoint**: Click project card → see detail page with tabs

---

## Phase 3: Status View (US1)

**Purpose**: Display project status at a glance

- [x] T008 [US1] Create `StatusView` component in `packages/dashboard/src/components/projects/status-view.tsx`
- [x] T009 [US1] Create `PhaseCard` sub-component showing current phase info
- [x] T010 [US1] Create `HealthCard` sub-component showing health status
- [x] T011 [US1] Create `ProgressCard` sub-component showing task progress
- [x] T012 [US1] Create `MetadataCard` sub-component showing project metadata

**Checkpoint**: Status view shows phase, health, progress cards with real-time updates

---

## Phase 4: Task Infrastructure (US3)

**Purpose**: Enable task data flow from filesystem to UI

- [x] T013 [US3] Create task parser utility in `packages/dashboard/src/lib/task-parser.ts`
- [x] T014 [US3] Add TasksEvent schema to `packages/shared/src/schemas/events.ts`
- [x] T015 [US3] Extend watcher in `packages/dashboard/src/lib/watcher.ts` to monitor tasks.md files
- [x] T016 [US3] Update SSE endpoint to emit tasks events
- [x] T017 [US3] Update `useSSE` hook to handle tasks events and store in tasks Map
- [x] T018 [US3] Update `ConnectionContext` to expose tasks data

**Checkpoint**: Tasks.md changes trigger SSE events, data available in context

---

## Phase 5: Kanban View (US2, US3)

**Purpose**: Display tasks organized by status

- [x] T019 [US2] [US3] Create `KanbanView` component in `packages/dashboard/src/components/projects/kanban-view.tsx`
- [x] T020 [US3] Create `KanbanColumn` component in `packages/dashboard/src/components/projects/kanban-column.tsx`
- [x] T021 [US3] Create `TaskCard` component in `packages/dashboard/src/components/projects/task-card.tsx`
- [x] T022 [US3] Wire KanbanView to tasks data from context

**Checkpoint**: Tasks display in Todo/In Progress/Done columns

---

## Phase 6: Timeline View (US2, US4)

**Purpose**: Show phase progression over time

- [x] T023 [US4] Create `TimelineView` component in `packages/dashboard/src/components/projects/timeline-view.tsx`
- [x] T024 [US4] Create `PhaseTimelineItem` component in `packages/dashboard/src/components/projects/phase-timeline-item.tsx`
- [x] T025 [US4] Wire TimelineView to phase history from state

**Checkpoint**: Timeline shows completed and current phases

---

## Phase 7: Polish

**Purpose**: View persistence and edge case handling

- [x] T026 [US2] Create `useViewPreference` hook in `packages/dashboard/src/hooks/use-view-preference.ts`
- [x] T027 [US2] Add localStorage persistence for view mode per project
- [x] T028 Add empty states for missing data (no tasks, no state file)
- [x] T029 Add loading skeletons for detail page components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundation (Phase 2)**: Depends on Setup
- **Status View (Phase 3)**: Depends on Foundation
- **Task Infrastructure (Phase 4)**: Depends on Setup (can parallel with Phase 3)
- **Kanban View (Phase 5)**: Depends on Task Infrastructure
- **Timeline View (Phase 6)**: Depends on Foundation (can parallel with Phase 5)
- **Polish (Phase 7)**: Depends on all views

### Parallel Opportunities

- T002 and T003 can run in parallel with T001 (different packages)
- Phase 3 (Status View) and Phase 4 (Task Infrastructure) can run in parallel
- Phase 5 (Kanban) and Phase 6 (Timeline) can run in parallel after their deps

---

## Notes

- All view components use existing SSE infrastructure from Phase 1020
- Task parser must handle varied task.md formats gracefully
- View preference stored as `specflow-view-{projectId}` in localStorage
- Real-time updates via existing ConnectionContext
