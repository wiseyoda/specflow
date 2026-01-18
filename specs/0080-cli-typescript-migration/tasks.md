# Tasks: CLI TypeScript Migration

## Progress Dashboard

> Last updated: 2025-01-18 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| 1. Setup | COMPLETE | 6/6 |
| 2. Foundational | PENDING | 0/10 |
| 3. US1 - Status | PENDING | 0/5 |
| 4. US2 - Next | PENDING | 0/5 |
| 5. US3 - Mark | PENDING | 0/5 |
| 6. US4 - Check | PENDING | 0/6 |
| 7. US5 - State | COMPLETE | 5/5 |
| 8. Integration | PENDING | 0/4 |
| 9. Polish | PENDING | 0/7 |

**Overall**: 11/53 (21%) | **Current**: Phase 2 (Foundational)

---

**Input**: Design documents from `/specs/0080-cli-typescript-migration/`
**Prerequisites**: plan.md (required), spec.md (required), cli-design.md (required)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and basic structure

- [x] T001 Create packages/cli directory structure
- [x] T002 Configure package.json with commander, chalk, zod dependencies
- [x] T003 [P] Configure tsconfig.json for ESM output
- [x] T004 [P] Configure tsup.config.ts for CLI build
- [x] T005 [P] Configure vitest.config.ts for testing
- [x] T006 Create src/index.ts CLI entry point with Commander.js

---

## Phase 2: Foundational (Core Libraries)

**Purpose**: Parsing libraries that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create src/lib/tasks.ts - parse tasks.md into Task[] with dependencies
- [ ] T008 [P] Create src/lib/roadmap.ts - parse ROADMAP.md into Phase[]
- [ ] T009 [P] Create src/lib/checklist.ts - parse checklist markdown files
- [ ] T010 Create src/lib/context.ts - resolve current feature directory and artifacts
- [ ] T011 [P] Create src/lib/health.ts - health check logic (issues detection)
- [ ] T012 Add tests/lib/tasks.test.ts with fixture files
- [ ] T012a [P] Add tests/lib/roadmap.test.ts with fixture files
- [ ] T012b [P] Add tests/lib/checklist.test.ts with fixture files
- [ ] T012c [P] Add tests/lib/context.test.ts with fixture files
- [ ] T012d [P] Add tests/lib/health.test.ts with fixture files

**Checkpoint**: Foundation ready - all parsers working with tests

---

## Phase 3: User Story 1 - Status Command (Priority: P1)

**Goal**: Complete project state in single call
**Independent Test**: `specflow status --json` returns phase, step, progress, health, next_action

- [ ] T013 [US1] Create src/commands/status.ts command skeleton
- [ ] T014 [US1] Implement status aggregation: phase from state, progress from tasks
- [ ] T015 [US1] Implement health check integration and next_action logic
- [ ] T016 [US1] Add --json flag for structured output per cli-design.md schema
- [ ] T017 [US1] Add tests/commands/status.test.ts with fixtures

**Checkpoint**: `specflow status --json` returns complete state

---

## Phase 4: User Story 2 - Next Command (Priority: P1)

**Goal**: Next actionable item with full context
**Independent Test**: `specflow next --json` returns task/item with dependencies and hints

- [ ] T018 [US2] Create src/commands/next.ts command skeleton
- [ ] T019 [US2] Implement task queue logic with dependency checking
- [ ] T020 [US2] Implement hints extraction (files mentioned, spec sections)
- [ ] T021 [US2] Add --type flag for task vs verify mode
- [ ] T022 [US2] Add tests/commands/next.test.ts

**Checkpoint**: `specflow next --json` returns next unblocked task

---

## Phase 5: User Story 3 - Mark Command (Priority: P1)

**Goal**: Mark item complete and return updated state
**Independent Test**: `specflow mark T001` updates file and returns progress

- [ ] T023 [US3] Create src/commands/mark.ts command skeleton
- [ ] T024 [US3] Implement task file update (checkbox toggle)
- [ ] T025 [US3] Implement multi-mark (T001 T002) and range (T001..T005)
- [ ] T026 [US3] Return updated progress + next task after mark
- [ ] T027 [US3] Add tests/commands/mark.test.ts

**Checkpoint**: `specflow mark T001` modifies tasks.md and returns state

---

## Phase 6: User Story 4 - Check Command (Priority: P2)

**Goal**: Deep validation with auto-fix support
**Independent Test**: `specflow check --json` returns validation results with fixes

- [ ] T028 [US4] Create src/commands/check.ts command skeleton
- [ ] T029 [US4] Implement gate checks (design, implement, verify gates)
- [ ] T030 [US4] Implement issue detection with severity and fix suggestions
- [ ] T031 [US4] Add --fix flag for auto-fixable issues
- [ ] T032 [US4] Add --gate flag for specific gate validation
- [ ] T033 [US4] Add tests/commands/check.test.ts

**Checkpoint**: `specflow check --json` validates project with actionable output

---

## Phase 7: User Story 5 - State Command (Priority: P3) ✅ COMPLETE

**Goal**: Low-level state access escape hatch
**Independent Test**: `specflow state get orchestration.step.current` returns value

- [x] T034 [US5] Create src/commands/state/index.ts with subcommands
- [x] T035 [US5] Implement get.ts for dot-path access
- [x] T036 [US5] Implement set.ts for key=value updates
- [x] T037 [US5] Implement show.ts for human-readable summary
- [x] T038 [US5] Implement init.ts for state file creation

**Checkpoint**: State command fully functional ✅

---

## Phase 8: Integration

**Purpose**: Connect TypeScript CLI with existing system

- [ ] T039 Update bin/specflow hybrid dispatcher to route status/next/mark/check to TypeScript
- [ ] T040 [P] Update packages/cli/package.json bin entry for direct invocation
- [ ] T041 Test hybrid routing: TypeScript commands + bash fallback working
- [ ] T042 Update slash commands (flow.orchestrate.md) to use new CLI syntax

**Checkpoint**: Both TypeScript and bash commands accessible via bin/specflow

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality and documentation

- [ ] T043 [P] Add tests/parity/state.test.ts - verify TypeScript matches bash output
- [ ] T044 [P] Run typecheck and fix any TypeScript errors
- [ ] T045 Update CLAUDE.md with new CLI architecture notes
- [ ] T046 Run full test suite, verify >80% coverage
- [ ] T047 [P] Validate JSON output schemas match cli-design.md specifications
- [ ] T048 [P] Verify Three-Line Output Rule compliance for human-readable output (NFR-005)
- [ ] T049 [P] Verify error messages include context and next steps (NFR-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Complete
- **Foundational (Phase 2)**: BLOCKS all user stories - must complete first
- **User Stories (Phases 3-7)**: All depend on Foundational
  - US5 (state) is already complete
  - US1-4 can proceed after Foundational in priority order
- **Integration (Phase 8)**: Depends on US1-US4 completion
- **Polish (Phase 9)**: Depends on Integration

### User Story Dependencies

- **US1 (status)**: Needs tasks.ts, roadmap.ts, context.ts, health.ts
- **US2 (next)**: Needs tasks.ts, checklist.ts, context.ts
- **US3 (mark)**: Needs tasks.ts, checklist.ts
- **US4 (check)**: Needs all lib modules
- **US5 (state)**: ✅ Complete - no additional dependencies

### Parallel Opportunities

- T007, T008, T009, T010, T011 - lib modules can be written in parallel
- After Foundational: US1, US2, US3 can proceed in parallel if desired
- T043, T044 - polish tasks can run in parallel

---

## Implementation Strategy

### Recommended Order

1. Complete Phase 2 (Foundational) - unblocks everything
2. Implement US1 (status) - most used command
3. Implement US2 (next) - core workflow
4. Implement US3 (mark) - completes task cycle
5. Implement US4 (check) - validation
6. Integration - hybrid dispatcher
7. Polish - tests, docs

### MVP Definition

After completing through Phase 5 (US3 mark):
- Claude can get status, find next task, mark complete
- Core workflow functional, can be tested end-to-end
