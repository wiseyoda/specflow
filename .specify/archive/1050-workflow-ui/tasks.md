# Tasks: Workflow UI Integration

## Progress Dashboard

> Last updated: 2026-01-18 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Foundational | PENDING | 0/3 |
| US1 - Card Start | PENDING | 0/5 |
| US2 - Detail Start | PENDING | 0/3 |
| US3 - Card Status | PENDING | 0/2 |
| US4 - Detail Status | PENDING | 0/2 |
| Polish | PENDING | 0/2 |

**Overall**: 0/17 (0%) | **Current**: None

---

**Input**: [spec.md](spec.md), [plan.md](plan.md), [ui-design.md](ui-design.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Data layer and shared definitions that all UI components depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 [P] Create skill definitions in `packages/dashboard/src/lib/workflow-skills.ts`
- [x] T002 [P] Create workflow execution hook in `packages/dashboard/src/hooks/use-workflow-execution.ts` (handle all terminal states: completed, failed, cancelled)
- [x] T003 Add test for workflow execution hook in `packages/dashboard/tests/hooks/use-workflow-execution.test.ts`

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 2: User Story 1 - Start from Card (Priority: P1) 🎯 MVP

**Goal**: Start workflow from project card actions dropdown with skill picker

**Independent Test**: Click Actions on any project card → Start Workflow → select skill → confirm → workflow starts

### Implementation

- [x] T004 [P] [US1] Create WorkflowSkillPicker component using DropdownMenuSub pattern in `packages/dashboard/src/components/projects/workflow-skill-picker.tsx`
- [x] T005 [P] [US1] Create StartWorkflowDialog component in `packages/dashboard/src/components/projects/start-workflow-dialog.tsx`
- [x] T006 [US1] Create WorkflowStatusBadge component in `packages/dashboard/src/components/projects/workflow-status-badge.tsx`
- [x] T007 [US1] Integrate skill picker into ActionsMenu in `packages/dashboard/src/components/projects/actions-menu.tsx`
- [x] T008 [US1] Add status badge to ProjectCard in `packages/dashboard/src/components/projects/project-card.tsx`

**Checkpoint**: Can start workflow from project card and see status badge

---

## Phase 3: User Story 2 - Start from Detail (Priority: P1)

**Goal**: Start workflow from project detail header with dedicated button

**Independent Test**: Navigate to project detail → click Start Workflow button → select skill → confirm → workflow starts

### Implementation

- [x] T009 [P] [US2] Add Start Workflow button to project detail header in `packages/dashboard/src/components/projects/project-detail-header.tsx`
- [x] T010 [US2] Add workflow status badge to project detail header (reuse WorkflowStatusBadge)
- [x] T011 [US2] Handle workflow start from header button (integrate with StartWorkflowDialog)

**Checkpoint**: Can start workflow from project detail header

---

## Phase 4: User Story 3 - Monitor on Card (Priority: P2)

**Goal**: See workflow status at a glance on project cards in list view

**Independent Test**: Start workflow → view project list → see status badge update through states

### Implementation

- [x] T012 [US3] Implement completed badge fade animation (30s timer + CSS transition) in `packages/dashboard/src/components/projects/workflow-status-badge.tsx`
- [x] T013 [US3] Add polling integration to project card for real-time status updates

**Checkpoint**: Status badge updates in real-time on project cards

---

## Phase 5: User Story 4 - View Status in Detail (Priority: P2)

**Goal**: See comprehensive workflow status in project detail sidebar

**Independent Test**: Start workflow → navigate to project detail → see status card with skill, status, elapsed time

### Implementation

- [x] T014 [US4] Create WorkflowStatusCard component in `packages/dashboard/src/components/projects/workflow-status-card.tsx`
- [x] T015 [US4] Integrate WorkflowStatusCard into StatusView in `packages/dashboard/src/components/projects/status-view.tsx`

**Checkpoint**: Can view full workflow status in project detail

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final touches and error handling

- [x] T016 [P] Add error handling and toast notifications for API failures
- [x] T017 [P] Add validation to prevent starting workflow when one already running (check for running/waiting states only, allow restart after cancelled)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies - start immediately
- **US1 Card Start (Phase 2)**: Depends on Phase 1
- **US2 Detail Start (Phase 3)**: Depends on Phase 1 (can parallel with US1)
- **US3 Card Status (Phase 4)**: Depends on US1 (needs status badge)
- **US4 Detail Status (Phase 5)**: Depends on Phase 1 (can parallel with US1/US2)
- **Polish (Phase 6)**: After all user stories

### Parallel Opportunities

```
Phase 1 (Foundational):
  T001 skill definitions  ───┬─── can run in parallel
  T002 workflow hook      ───┘
  T003 hook test          ─────── depends on T002

Phase 2+3 (US1 + US2) after Phase 1:
  T004 skill picker       ───┬─── can run in parallel
  T005 start dialog       ───┤
  T009 header button      ───┘

Phase 4+5 (US3 + US4) after Phase 2:
  T012 fade animation     ───┬─── can run in parallel
  T014 status card        ───┘
```

---

## Implementation Order (Sequential)

1. T001, T002 (parallel) → T003
2. T004, T005 (parallel) → T006 → T007 → T008
3. T009 → T010 → T011
4. T012, T013 (can parallel with T014, T015)
5. T014 → T015
6. T016, T017 (parallel)

---

## Notes

- All components use shadcn/ui and Tailwind CSS
- Hook uses 3-second polling interval per PDR
- Reuse WorkflowStatusBadge in both card and detail views
- StartWorkflowDialog is shared by card and detail entry points
