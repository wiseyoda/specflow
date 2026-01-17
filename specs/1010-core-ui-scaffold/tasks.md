# Tasks: Core UI Scaffold

## Progress Dashboard

> Last updated: 2026-01-17T14:10:02Z | Run `speckit tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 8/8 |
| Foundational | DONE | 6/6 |
| User Story 1 - View All Projects (Priority: P1) 🎯 MVP | DONE | 9/9 |
| User Story 4 - Dashboard CLI Command (Priority: P1) | DONE | 5/5 |
| User Story 2 - Toggle Dark Mode (Priority: P2) | DONE | 5/5 |
| User Story 3 - Command Palette Shell (Priority: P3) | IN PROGRESS | 3/4 |
| Polish & Edge Cases | DONE | 6/6 |

**Overall**: 42/43 (97%) | **Current**: T034 [US3] Create `packages/dashboard/ho

### Quick Status

- [x] T001 Create root `pnpm-workspace.yaml` with packages/* configuration
- [x] T002 Create root `package.json` with workspace scripts (dev, build, start)
- [x] T003 [P] Create `packages/shared/` directory structure
- [x] T004 [P] Create `packages/dashboard/` directory structure
- [x] T005 Initialize `packages/shared/package.json` with Zod dependency
- [x] T006 Initialize `packages/shared/tsconfig.json` with strict mode
- [x] T007 Initialize Next.js in `packages/dashboard/` with TypeScript and Tailwind
- [x] T008 [P] Configure `packages/dashboard/tsconfig.json` to reference shared package
- [x] T009 Create `packages/shared/src/schemas/registry.ts` with ProjectSchema and RegistrySchema
- [x] T010 [P] Create `packages/shared/src/schemas/index.ts` to export all schemas
---

**Input**: Design documents from `/specs/1010-core-ui-scaffold/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

---

## Phase 1: Setup

**Purpose**: Monorepo initialization and project structure

- [x] T001 Create root `pnpm-workspace.yaml` with packages/* configuration
- [x] T002 Create root `package.json` with workspace scripts (dev, build, start)
- [x] T003 [P] Create `packages/shared/` directory structure
- [x] T004 [P] Create `packages/dashboard/` directory structure
- [x] T005 Initialize `packages/shared/package.json` with Zod dependency
- [x] T006 Initialize `packages/shared/tsconfig.json` with strict mode
- [x] T007 Initialize Next.js in `packages/dashboard/` with TypeScript and Tailwind
- [x] T008 [P] Configure `packages/dashboard/tsconfig.json` to reference shared package

---

## Phase 2: Foundational

**Purpose**: Shared schemas and dashboard shell that all features depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create `packages/shared/src/schemas/registry.ts` with ProjectSchema and RegistrySchema
- [x] T010 [P] Create `packages/shared/src/schemas/index.ts` to export all schemas
- [x] T011 Create `packages/shared/src/index.ts` package entry point
- [x] T012 Initialize shadcn/ui in dashboard with `npx shadcn@latest init`
- [x] T013 [P] Add shadcn/ui components: button, card, dropdown-menu, dialog, command
- [x] T014 Create `packages/dashboard/lib/utils.ts` with cn() helper function

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View All Projects (Priority: P1) 🎯 MVP

**Goal**: Display all registered projects from registry.json with inline expansion

**Independent Test**: Run `pnpm dev`, open browser, verify projects appear

### Implementation for User Story 1

- [x] T015 [US1] Create `packages/dashboard/app/api/projects/route.ts` - API route that reads and validates registry.json
- [x] T016 [US1] Create `packages/dashboard/hooks/use-polling.ts` - polling hook for auto-refresh
- [x] T017 [US1] Create `packages/dashboard/components/projects/empty-state.tsx` - empty state component
- [x] T018 [US1] Create `packages/dashboard/components/projects/project-card.tsx` - expandable project card
- [x] T019 [US1] Create `packages/dashboard/components/projects/project-list.tsx` - list component with polling
- [x] T020 [US1] Create `packages/dashboard/components/layout/sidebar.tsx` - left sidebar navigation shell
- [x] T021 [US1] Create `packages/dashboard/components/layout/header.tsx` - top header (placeholder for theme toggle)
- [x] T022 [US1] Create `packages/dashboard/components/layout/main-layout.tsx` - main layout wrapper
- [x] T023 [US1] Update `packages/dashboard/app/page.tsx` to render ProjectList in MainLayout

**Checkpoint**: Project list displays and expands - MVP functional

---

## Phase 4: User Story 4 - Dashboard CLI Command (Priority: P1)

**Goal**: `speckit dashboard` command starts the web server

**Independent Test**: Run `speckit dashboard --dev` and verify server starts

### Implementation for User Story 4

- [x] T024 [US4] Create `scripts/bash/speckit-dashboard.sh` with dependency checks, --dev flag, port handling
- [x] T025 [US4] Add dashboard command routing to `bin/speckit` dispatcher
- [x] T026 [US4] Update `bin/speckit` help text to include dashboard command
- [x] T027 [US4] Test `speckit dashboard --help` works correctly
- [x] T028 [US4] Test `speckit dashboard --dev` starts development server

**Checkpoint**: CLI integration complete - can launch dashboard from speckit command

---

## Phase 5: User Story 2 - Toggle Dark Mode (Priority: P2)

**Goal**: Dark/light mode with system preference detection and persistence

**Independent Test**: Click theme toggle, verify colors change and persist on reload

### Implementation for User Story 2

- [x] T029 [US2] Install `next-themes` dependency in dashboard package
- [x] T030 [US2] Create `packages/dashboard/components/theme-provider.tsx` wrapper component
- [x] T031 [US2] Create `packages/dashboard/components/mode-toggle.tsx` dropdown toggle
- [x] T032 [US2] Update `packages/dashboard/app/layout.tsx` to wrap with ThemeProvider
- [x] T033 [US2] Update `packages/dashboard/components/layout/header.tsx` to include ModeToggle

**Checkpoint**: Theme toggle works with system detection and localStorage persistence

---

## Phase 6: User Story 3 - Command Palette Shell (Priority: P3)

**Goal**: Cmd+K opens command palette modal (placeholder content)

**Independent Test**: Press Cmd+K, verify modal opens and closes on Escape

### Implementation for User Story 3

- [ ] T034 [US3] Create `packages/dashboard/hooks/use-keyboard.ts` for keyboard shortcut detection
- [x] T035 [US3] Create `packages/dashboard/components/command-palette.tsx` modal with cmdk
- [x] T036 [US3] Add CommandPalette to `packages/dashboard/app/layout.tsx` (global)
- [x] T037 [US3] Add keyboard hint to header showing "⌘K" shortcut

**Checkpoint**: Command palette opens/closes - shell complete for future functionality

---

## Phase 7: Polish & Edge Cases

**Purpose**: Error handling, loading states, and final cleanup

- [x] T038 [P] Add loading skeleton to project list while polling
- [x] T039 [P] Handle malformed registry.json with error state suggesting `speckit doctor`
- [x] T040 [P] Handle missing project paths with "unavailable" badge
- [x] T041 [P] Add port fallback logic to CLI (try 3001-3010 if 3000 busy)
- [x] T042 Update root README.md with dashboard usage instructions
- [x] T043 Run `pnpm build` and verify no TypeScript errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - P1 priority
- **User Story 4 (Phase 4)**: Depends on Phase 3 (needs dashboard to exist) - P1 priority
- **User Story 2 (Phase 5)**: Depends on Foundational - P2 priority, can run parallel to US1
- **User Story 3 (Phase 6)**: Depends on Foundational - P3 priority, can run parallel to US1/US2
- **Polish (Phase 7)**: Depends on all user stories complete

### Within Each Phase

- Tasks marked [P] can run in parallel
- Tasks without [P] must run sequentially
- API route (T015) must exist before UI components that use it
- Layout components should be created before page that uses them

### Parallel Opportunities

```bash
# Phase 1 parallel tasks:
T003, T004 can run together (different directories)
T006, T008 can run together (different tsconfig files)

# Phase 2 parallel tasks:
T010, T013 can run together (different files)

# After Foundational, these can run in parallel (different concerns):
User Story 1 (Projects) - UI focus
User Story 2 (Theme) - Theming focus
User Story 3 (Palette) - Keyboard focus
```

---

## Notes

- All TypeScript files use strict mode
- shadcn/ui components go in `packages/dashboard/components/ui/`
- Custom components go in `packages/dashboard/components/`
- Zod schemas are the single source of truth for data structures
- Polling interval is 5000ms (5 seconds) as specified in discovery.md
