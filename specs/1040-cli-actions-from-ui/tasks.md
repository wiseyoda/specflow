# Tasks: Phase 1040 - CLI Actions from UI

> Generated from plan.md on 2026-01-17

## Progress Dashboard

> Last updated: 2026-01-17T18:37:46Z | Run `speckit tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 3/3 |
| Core Infrastructure | DONE | 8/8 |
| Command Discovery | DONE | 4/4 |
| UI Components | DONE | 9/9 |
| Integration | DONE | 7/7 |
| Polish | DONE | 4/4 |

**Overall**: 35/35 (100%) | **Current**: None

### Quick Status

- [x] **T001** [US1] Create shared command types schema in `packages/shared/src/schemas/commands.ts`
- [x] **T002** [US1] Export new types from `packages/shared/src/index.ts`
- [x] **T003** [US1] Update dashboard package.json if needed for dependencies
- [x] **T004** [US1] Create `packages/dashboard/src/lib/cli-executor.ts` with CommandExecution interface
- [x] **T005** [US1] Implement `execute()` method using child_process.spawn
- [x] **T006** [US1] Implement output streaming via AsyncIterable pattern
- [x] **T007** [US1] Add command timeout handling (60s default)
- [x] **T008** [US1] Add input validation with Zod (sanitize args)
- [x] **T009** [US1] Create `src/app/api/commands/execute/route.ts` POST handler
- [x] **T010** [US1] Create `src/app/api/commands/stream/route.ts` SSE handler
---

## Phase 1: Setup

- [x] **T001** [US1] Create shared command types schema in `packages/shared/src/schemas/commands.ts`
- [x] **T002** [US1] Export new types from `packages/shared/src/index.ts`
- [x] **T003** [US1] Update dashboard package.json if needed for dependencies

---

## Phase 2: Core Infrastructure

### CLI Executor Service

- [x] **T004** [US1] Create `packages/dashboard/src/lib/cli-executor.ts` with CommandExecution interface
- [x] **T005** [US1] Implement `execute()` method using child_process.spawn
- [x] **T006** [US1] Implement output streaming via AsyncIterable pattern
- [x] **T007** [US1] Add command timeout handling (60s default)
- [x] **T008** [US1] Add input validation with Zod (sanitize args)

### API Routes

- [x] **T009** [US1] Create `src/app/api/commands/execute/route.ts` POST handler
- [x] **T010** [US1] Create `src/app/api/commands/stream/route.ts` SSE handler
- [x] **T011** [US1] Add security validation (allowlist check, arg sanitization)

---

## Phase 3: Command Discovery

- [x] **T012** [US1] Create `packages/dashboard/src/lib/command-discovery.ts`
- [x] **T013** [US1] Implement `speckit help` parsing to extract commands
- [x] **T014** [US1] Create `src/app/api/commands/list/route.ts` GET handler
- [x] **T015** [US1] Add caching with 5-minute refresh interval

---

## Phase 4: UI Components

### Output Drawer

- [x] **T016** [US3] Create `src/components/output-drawer.tsx` using shadcn/ui Sheet
- [x] **T017** [US3] Implement auto-scroll during streaming
- [x] **T018** [US3] Add copy output button
- [x] **T019** [US3] Add clear/close actions

### Toast Integration

- [x] **T020** [US4] Verify toast provider is configured in app layout
- [x] **T021** [US4] Create toast helper functions for command results

### Command Palette Enhancement

- [x] **T022** [US1] Rewrite `src/components/command-palette.tsx` with full implementation
- [x] **T023** [US1] Add command search/filter functionality
- [x] **T024** [US1] Implement inline argument prompt (input field after command selection)

---

## Phase 5: Integration

- [x] **T025** [US1] Connect command palette to CLI executor service
- [x] **T026** [US1] Wire SSE stream to output drawer
- [x] **T027** [US4] Implement error handling flow (toast + drawer details)
- [x] **T028** [US1] Create command history state in connection context (session-scoped array)
- [x] **T029** [US1] Add "Recent Commands" section to command palette
- [x] **T030** [US2] Test issue creation flow end-to-end
- [x] **T031** [US1] Verify output streaming latency < 100ms

---

## Phase 6: Polish

- [x] **T032** Add loading states during command execution
- [x] **T033** Add keyboard navigation in command palette (arrow keys, enter)
- [x] **T034** Update dashboard README with command palette documentation
- [x] **T035** Manual testing of all verification gate items

---

## Dependencies

```
T001 → T002 → T003 (parallel)
T004 → T005 → T006 → T007 → T008
T009, T010 depend on T004-T008
T011 depends on T012-T015
T012 → T013 → T014 → T015
T016 → T017 → T018 → T019
T020 → T021
T022 → T023 → T024
T025 depends on T022, T009
T026 depends on T016, T010
T027 depends on T021
T028 → T029
T030 depends on T025-T029
T031 depends on T026
T032-T035 depend on T030
```

---

## Requirement Mapping

| Task | Requirements |
|------|--------------|
| T001-T003 | FR-007 |
| T004-T011 | FR-001, FR-002, FR-005, FR-006, FR-008 |
| T012-T015 | FR-007, FR-011 |
| T016-T019 | FR-003 |
| T020-T021 | FR-004 |
| T022-T024 | FR-007, FR-010 |
| T025-T027 | Integration |
| T028-T029 | FR-009 (command history) |
| T030-T031 | NFR-001, SC-001 |
| T032-T035 | NFR-002, polish |
