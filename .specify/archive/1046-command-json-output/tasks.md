# Tasks: Command JSON Output

## Progress Dashboard

> Last updated: 2026-01-18 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| US1: Dashboard CLI Integration | PENDING | 0/6 |
| US2: Scripting Support | PENDING | 0/3 |
| US3: Consistent Errors | PENDING | 0/2 |
| US4: Schema Documentation | PENDING | 0/2 |

**Overall**: 0/13 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1046-command-json-output/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Dashboard CLI Integration (Priority: P1)

**Goal**: Dashboard can call state commands with --json and parse structured results

**Independent Test**: Run `specflow state set key=value --json` and verify valid JSON output

### Implementation

- [x] T001 [P] [US1] Add --json flag and StateSetOutput interface to packages/cli/src/commands/state/set.ts
- [x] T002 [P] [US1] Add --json flag and StateInitOutput interface to packages/cli/src/commands/state/init.ts
- [x] T003 [P] [US1] Add --json flag and StateSyncOutput interface to packages/cli/src/commands/state/sync.ts
- [x] T004 [P] [US1] Add unit test for state set JSON output in packages/cli/tests/commands/state/set.test.ts
- [x] T005 [P] [US1] Add unit test for state init JSON output in packages/cli/tests/commands/state/init.test.ts
- [x] T006 [P] [US1] Add unit test for state sync JSON output in packages/cli/tests/commands/state/sync.test.ts

**Checkpoint**: All 3 state commands support --json flag with typed output

---

## Phase 2: User Story 2 - Scripting Support (Priority: P2)

**Goal**: Developers can pipe CLI output to jq for scripting

**Independent Test**: Run `specflow state set foo=bar --json | jq '.status'` successfully

### Verification

- [x] T007 [US2] Verify all JSON output is valid (parseable by jq) for state set
- [x] T008 [US2] Verify all JSON output is valid (parseable by jq) for state init
- [x] T009 [US2] Verify all JSON output is valid (parseable by jq) for state sync

**Checkpoint**: jq can parse all command outputs

---

## Phase 3: User Story 3 - Consistent Error Handling (Priority: P2)

**Goal**: Error JSON follows consistent structure across all commands

**Independent Test**: Run `specflow state set invalid --json` and verify error structure

### Implementation

- [x] T010 [US3] Ensure state set error cases return JSON with error.message and error.hint
- [x] T011 [US3] Ensure state init error cases return JSON with error.message and error.hint

**Checkpoint**: Error cases return structured JSON (not text)

---

## Phase 4: User Story 4 - Schema Documentation (Priority: P3)

**Goal**: Developers can reference documented JSON schema

**Independent Test**: Check .specify/memory/cli-json-schema.md exists and covers all commands

### Documentation

- [x] T012 [US4] Create .specify/memory/cli-json-schema.md with all command output interfaces
- [x] T013 [US4] Add examples for each command in schema documentation

**Checkpoint**: Schema documentation complete and comprehensive

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 1)**: No dependencies - can start immediately
- **US2 (Phase 2)**: Depends on US1 completion (needs JSON output to test)
- **US3 (Phase 3)**: Depends on US1 completion (error handling in same files)
- **US4 (Phase 4)**: Depends on US1 completion (needs interfaces to document)

### Parallel Opportunities

All T001-T006 tasks in US1 can run in parallel (different files):
- T001, T002, T003: Implementation (different command files)
- T004, T005, T006: Tests (different test files)

### Task ID Summary

| ID | Description | File |
|----|-------------|------|
| T001 | state set --json | packages/cli/src/commands/state/set.ts |
| T002 | state init --json | packages/cli/src/commands/state/init.ts |
| T003 | state sync --json | packages/cli/src/commands/state/sync.ts |
| T004 | Test: state set | packages/cli/tests/commands/state/set.test.ts |
| T005 | Test: state init | packages/cli/tests/commands/state/init.test.ts |
| T006 | Test: state sync | packages/cli/tests/commands/state/sync.test.ts |
| T007-T009 | jq verification | Manual verification |
| T010-T011 | Error handling | Same as T001-T002 |
| T012-T013 | Schema docs | .specify/memory/cli-json-schema.md |

---

## Notes

- [P] tasks = different files, no dependencies
- T001-T003 are the core implementation tasks
- T004-T006 are test tasks that can run in parallel with implementation
- T007-T011 are verification/refinement tasks
- T012-T013 create documentation after implementation is stable
