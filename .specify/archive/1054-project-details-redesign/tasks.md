# Tasks: Comprehensive Dashboard UI Redesign

## Progress Dashboard

> Last updated: 2026-01-19 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | PENDING | 0/3 |
| Design System (US1) | PENDING | 0/6 |
| Layout & Navigation (US2, US3) | PENDING | 0/8 |
| Core Views (US4, US5, US9) | PENDING | 0/10 |
| Input & Notifications (US6, US7, US8) | PENDING | 0/7 |
| History & Context (US10, US11) | PENDING | 0/6 |
| Project List & Polish (US12, US13) | PENDING | 0/8 |
| Integration | PENDING | 0/4 |

**Overall**: 0/52 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1054-project-details-redesign/`
**Prerequisites**: plan.md (required), spec.md (required), ui-design.md (required)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend Tailwind configuration and prepare project structure

- [x] T001 Extend Tailwind config with mockup color palette (surface, accent, success, warning, danger) in packages/dashboard/tailwind.config.js
- [x] T002 Add animation keyframes (glow-pulse, slide-up, beam, float) to Tailwind config in packages/dashboard/tailwind.config.js
- [x] T003 [P] Add custom CSS classes (glass, bg-grid, omni-glow, cursor-blink) to packages/dashboard/app/globals.css

---

## Phase 2: Design System Foundation (US1) - Priority P1

**Goal**: Establish reusable design primitives that all other components depend on

**Independent Test**: Render all primitives on a test page and verify styling matches mockup

- [x] T004 [US1] Create StatusPill component with 4 states (idle, running, waiting, failed) in packages/dashboard/components/design-system/status-pill.tsx
- [x] T005 [P] [US1] Create GlassCard component with backdrop-blur and border styling in packages/dashboard/components/design-system/glass-card.tsx
- [x] T006 [P] [US1] Create GridBackground component with CSS grid pattern in packages/dashboard/components/design-system/grid-background.tsx
- [x] T007 [P] [US1] Create FloatingOrbs component with animated background orbs in packages/dashboard/components/design-system/floating-orbs.tsx
- [x] T008 [US1] Create barrel export for design system in packages/dashboard/components/design-system/index.ts
- [x] T009 [US1] Verify all design system primitives render correctly with mockup colors and animations

**Checkpoint**: Design system foundation ready - layout and views can now use primitives

---

## Phase 3: Layout & Navigation (US2, US3) - Priority P1

**Goal**: Build the new layout shell with icon sidebar and redesigned header

**Independent Test**: Navigate between views using sidebar and keyboard shortcuts, verify status pill updates

### Navigation (US2)

- [x] T010 [US2] Create SidebarNavItem component with active state, tooltip, and indicator in packages/dashboard/components/layout/sidebar-nav-item.tsx
- [x] T011 [US2] Create IconSidebar component with 4 nav items and bottom actions in packages/dashboard/components/layout/icon-sidebar.tsx
- [x] T012 [US2] Add live/warning indicators to Session nav item based on workflow status in packages/dashboard/components/layout/icon-sidebar.tsx

### Header (US3)

- [x] T013 [US3] Create RedesignedHeader component with breadcrumb, branch pill, and context toggle in packages/dashboard/components/layout/redesigned-header.tsx
- [x] T014 [US3] Integrate StatusPill in header center with workflow state binding in packages/dashboard/components/layout/redesigned-header.tsx
- [x] T015 [US3] Add timer display to StatusPill when workflow is running or waiting in packages/dashboard/components/design-system/status-pill.tsx

### Layout Shell

- [x] T016 Create AppLayout component composing sidebar, header, and content area in packages/dashboard/components/layout/app-layout.tsx
- [x] T017 Update project details page to use new AppLayout in packages/dashboard/app/projects/[id]/page.tsx

**Checkpoint**: Navigation and header functional - views can now be built within layout

---

## Phase 4: Core Views (US4, US5, US9) - Priority P2

**Goal**: Implement Dashboard welcome, Session console, and Tasks kanban views

### Dashboard Welcome (US4)

- [x] T018 [US4] Create DashboardWelcome component with greeting and phase progress in packages/dashboard/components/views/dashboard-welcome.tsx
- [x] T019 [US4] Add primary action card (Resume Implementation) with context in packages/dashboard/components/views/dashboard-welcome.tsx
- [x] T020 [US4] Add secondary action buttons (Orchestrate, Design, Verify) in packages/dashboard/components/views/dashboard-welcome.tsx
- [x] T021 [US4] Add stats row (Done, Pending, Progress) in packages/dashboard/components/views/dashboard-welcome.tsx

### Session Console (US5)

- [x] T022 [US5] Create SessionMessage component with timestamp, agent attribution, and badges in packages/dashboard/components/session/session-message.tsx
- [x] T023 [P] [US5] Create ToolCallBlock component with syntax highlighting in packages/dashboard/components/session/tool-call-block.tsx
- [x] T024 [P] [US5] Create TypingIndicator component for processing state in packages/dashboard/components/session/typing-indicator.tsx
- [x] T025 [US5] Create SessionConsole view composing messages, tools, and typing indicator in packages/dashboard/components/views/session-console.tsx
- [x] T026 [US5] Add empty state with Start Workflow CTA when idle in packages/dashboard/components/views/session-console.tsx

### Tasks Kanban (US9)

- [x] T027 [US9] Refactor TasksKanban to 2-column layout (To Do, Done) in packages/dashboard/components/views/tasks-kanban.tsx

**Checkpoint**: Core views functional - can navigate Dashboard, Session, Tasks

---

## Phase 5: Input & Notifications (US6, US7, US8) - Priority P2

**Goal**: Implement OmniBox input and toast notifications

### OmniBox (US6)

- [x] T028 [US6] Create OmniBox component with state badge and gradient glow in packages/dashboard/components/input/omni-box.tsx
- [x] T029 [US6] Add state-aware placeholder text to OmniBox in packages/dashboard/components/input/omni-box.tsx
- [x] T030 [US6] Wire OmniBox to workflow answer submission in packages/dashboard/components/input/omni-box.tsx
- [x] T031 [US6] Integrate OmniBox at bottom of session view in packages/dashboard/components/views/session-console.tsx

### Decision Toast (US7)

- [x] T032 [US7] Create DecisionToast component with beam animation and options in packages/dashboard/components/input/decision-toast.tsx
- [x] T033 [US7] Wire DecisionToast to question state and answer submission in packages/dashboard/components/input/decision-toast.tsx

### Failed Toast (US8)

- [x] T034 [US8] Create FailedToast component with error display and retry button in packages/dashboard/components/input/failed-toast.tsx

**Checkpoint**: Input and notifications functional - full workflow interaction possible

---

## Phase 6: History & Context (US10, US11) - Priority P3

**Goal**: Implement History timeline view and Context drawer

### History Timeline (US10)

- [x] T035 [US10] Create PhaseTimelineItem component with status badge in packages/dashboard/components/views/phase-timeline-item.tsx
- [x] T036 [US10] Create HistoryTimeline view with master-detail layout in packages/dashboard/components/views/history-timeline.tsx
- [x] T037 [US10] Add detail panel showing summary, sessions, and artifacts in packages/dashboard/components/views/history-timeline.tsx

### Context Drawer (US11)

- [x] T038 [US11] Create ContextDrawer component with tabs (Context, Activity) in packages/dashboard/components/layout/context-drawer.tsx
- [x] T039 [US11] Add Context tab content (current task, touched files, phase progress) in packages/dashboard/components/layout/context-drawer.tsx
- [x] T040 [US11] Add Activity tab content (recent activity feed) in packages/dashboard/components/layout/context-drawer.tsx

**Checkpoint**: All 4 views and context drawer complete

---

## Phase 7: Project List & Visual Polish (US12, US13) - Priority P3

**Goal**: Apply design system to project list and ensure visual polish throughout

### Project List (US12)

- [x] T041 [US12] Refactor ProjectCard to use GlassCard and StatusPill in packages/dashboard/components/projects/project-card.tsx
- [x] T042 [US12] Update project list page to use AppLayout with sidebar in packages/dashboard/app/page.tsx
- [x] T043 [US12] Apply consistent styling to project list header in packages/dashboard/app/page.tsx

### Visual Polish (US13)

- [x] T044 [P] [US13] Add GridBackground to AppLayout in packages/dashboard/components/layout/app-layout.tsx
- [x] T045 [P] [US13] Add FloatingOrbs to AppLayout in packages/dashboard/components/layout/app-layout.tsx
- [x] T046 [US13] Add view transition animations (opacity, transform) in packages/dashboard/components/layout/app-layout.tsx
- [x] T047 [US13] Verify glass morphism effects render correctly on all cards
- [x] T048 [US13] Custom scrollbar styling for all scrollable areas in packages/dashboard/app/globals.css

**Checkpoint**: Visual polish complete - full mockup fidelity achieved

---

## Phase 8: Integration & Keyboard Shortcuts

**Purpose**: Wire up keyboard shortcuts and verify complete integration

- [x] T049 Add keyboard event handler for ⌘K (focus omni-box) in packages/dashboard/components/layout/app-layout.tsx
- [x] T050 Add keyboard event handlers for ⌘1 (Dashboard), ⌘2 (Session), ⌘3 (Tasks), ⌘4 (History) view navigation in packages/dashboard/components/layout/app-layout.tsx
- [x] T051 Verify all workflow states (idle, running, waiting, failed) display correctly across all components
- [x] T052 End-to-end integration test: start workflow, answer question, complete workflow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Design System)**: Depends on Phase 1 - creates primitives all other phases use
- **Phase 3 (Layout)**: Depends on Phase 2 - uses StatusPill, GlassCard
- **Phase 4 (Core Views)**: Depends on Phase 3 - renders within AppLayout
- **Phase 5 (Input/Notifications)**: Depends on Phase 4 - integrates with Session view
- **Phase 6 (History/Context)**: Depends on Phase 3 - uses layout components
- **Phase 7 (Project List)**: Depends on Phases 2, 3 - uses design system and layout
- **Phase 8 (Integration)**: Depends on all previous phases

### Parallel Opportunities

```bash
# Phase 1: All can run in parallel
T001, T002, T003

# Phase 2: GlassCard, GridBackground, FloatingOrbs can run in parallel
T005, T006, T007

# Phase 3: SidebarNavItem before IconSidebar, Header can run parallel to Sidebar
T010 → T011 → T012 (sequential)
T013, T014, T015 (can parallel with sidebar tasks)

# Phase 4: Tool blocks and typing indicator can run in parallel
T023, T024

# Phase 7: Grid and orbs can run in parallel
T044, T045
```

---

## Notes

- [P] tasks = different files, no dependencies
- [US#] label maps task to specific user story
- Verify mockup at each checkpoint before proceeding
- Commit after each task or logical group
- Keep existing hooks (use-workflow-execution, etc.) unchanged
