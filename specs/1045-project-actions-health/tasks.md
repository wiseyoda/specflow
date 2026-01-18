# Tasks: Phase 1045 - Project Actions & Health

> Generated: 2026-01-17
> Total Tasks: 25

## Phase 1: Setup & Foundation

- [x] T001 [P1] Add `init` to allowed commands list in `packages/dashboard/src/lib/allowed-commands.ts`
- [x] T002 [P1] [US1] Create action definitions file `packages/dashboard/src/lib/action-definitions.ts` with ActionDefinition interface and all action metadata
- [x] T003 [P1] [US1] Create confirmation dialog component `packages/dashboard/src/components/ui/confirmation-dialog.tsx` with title, description, items list, and confirm/cancel buttons
- [x] T004 [P1] [US1] Create command output modal `packages/dashboard/src/components/projects/command-output-modal.tsx` with streaming output display, monospace font, and copy button
- [x] T025 [P1] Add ProjectAction type to `packages/shared/src/schemas/commands.ts` for action metadata typing

## Phase 2: Card Integration (US1)

- [x] T005 [P2] [US1] Create action button component `packages/dashboard/src/components/projects/action-button.tsx` that shows context-aware actions based on project status
- [x] T006 [P2] [US1] Integrate ActionButton into project-card.tsx before ChevronRight icon, passing project status and path
- [x] T007 [P2] [US1] Add loading state to ActionButton while command is executing
- [x] T008 [P2] [US1] Wire confirmation dialog to ActionButton for init action with description of what will be created
- [x] T009 [P2] [US1] Connect command execution API (`/api/commands/execute`) to ActionButton confirm handler
- [x] T010 [P2] [US1] Connect SSE stream (`/api/commands/stream`) to CommandOutputModal for real-time output

## Phase 3: Doctor Actions (US2)

- [x] T011 [P2] [US2] Add "Doctor" action definition with no confirmation requirement
- [x] T012 [P2] [US2] Add "Doctor (Auto-Fix)" action definition with confirmation requirement
- [x] T013 [P2] [US2] Show "Doctor" button on cards with status `error` or `warning`
- [x] T014 [P2] [US2] Ensure doctor output streams correctly to output modal

## Phase 4: Output Enhancements (US5)

- [x] T015 [P2] [US5] Add color-coded output (stderr in red/amber, stdout in default)
- [x] T016 [P2] [US5] Add success/failure indicator (green checkmark / red X)
- [x] T017 [P2] [US5] Add execution time display
- [x] T018 [P2] [US5] Implement copy output to clipboard functionality

## Phase 5: Scaffold & Migrate (US3, US4)

- [x] T019 [P2] [US3] Add "Scaffold" action definition with confirmation showing what will be created
- [x] T020 [P3] [US4] Add "Migrate to v2" action definition with confirmation
- [x] T021 [P3] [US4] Show migrate action only when schema_version is 1.x

## Phase 6: Detail Page Actions

- [x] T022 [P3] Create actions menu component `packages/dashboard/src/components/projects/actions-menu.tsx` with grouped dropdown (Setup, Maintenance, Advanced)
- [x] T023 [P3] Integrate ActionsMenu into project-detail-header.tsx on right side
- [x] T024 [P3] [US3] Add scaffold to actions menu (detail page only, not card)

## Dependency Graph

```
T001 (allowed commands)
  │
  ▼
T002 (action definitions)
  │
  ├──► T003 (confirmation dialog)
  │      │
  │      ▼
  │    T004 (output modal)
  │      │
  │      ├──► T015 (color output)
  │      ├──► T016 (success/fail indicator)
  │      ├──► T017 (execution time)
  │      └──► T018 (copy button)
  │
  └──► T005 (action button)
         │
         ├──► T006 (card integration)
         │      │
         │      └──► T007 (loading state)
         │
         ├──► T008 (confirmation wiring)
         │      │
         │      └──► T009 (execute API)
         │             │
         │             └──► T010 (stream SSE)
         │
         ├──► T011 (doctor action)
         │      │
         │      ├──► T012 (doctor-fix action)
         │      ├──► T013 (show on error/warning)
         │      └──► T014 (stream output)
         │
         └──► T019 (scaffold action)

T020 (migrate action)
  │
  └──► T021 (v1 detection)

T022 (actions menu)
  │
  ├──► T023 (header integration)
  └──► T024 (scaffold menu)
```

## Priority Legend

- **P1**: Critical path - blocks other tasks
- **P2**: Core functionality - main feature
- **P3**: Enhancement - can ship without but improves UX
