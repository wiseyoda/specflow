# Tasks: Workflow Consolidation

## Progress Dashboard

> Last updated: 2026-01-18T03:56:34Z | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 2/2 |
| User Story 1 - Design Command (Priority: P1) | DONE | 8/8 |
| User Story 2 - Partial Regeneration (Priority: P2) | DONE | 4/4 |
| User Story 3 - Orchestrate Update (Priority: P2) | DONE | 6/6 |
| User Story 4 - Roadmap Backlog (Priority: P3) | DONE | 3/3 |
| User Story 5 - Deprecation Stubs (Priority: P3) | DONE | 6/6 |
| Polish & Documentation | DONE | 3/3 |

**Overall**: 32/32 (100%) | **Status**: COMPLETE

### Quick Status

- [x] T001 Create specs/0072-workflow-consolidation/checklists/ directory
- [x] T002 [P] Read all existing command files to understand current structure
- [x] T003 [US1] Create commands/specflow.design.md with header and argument parsing
- [x] T004 [US1] Implement DISCOVER phase in specflow.design.md (codebase examination, progressive questions)
- [x] T005 [US1] Implement SPECIFY phase in specflow.design.md (spec.md AND requirements.md creation)
- [x] T006 [US1] Implement inline clarification behavior (questions with context and recommendations)
- [x] T007 [US1] Implement PLAN phase in specflow.design.md (plan.md, research.md, data-model.md)
- [x] T008 [US1] Implement TASKS phase in specflow.design.md (tasks.md generation)
- [x] T009 [US1] Implement CHECKLISTS phase in specflow.design.md (both implementation.md and verification.md)
- [x] T010 [US1] Add state tracking for resumable flow (design.substep in state) - discovery always re-runs per FR-008a
---

**Input**: Design documents from `/specs/0072-workflow-consolidation/`
**Prerequisites**: plan.md, spec.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)

---

## Phase 1: Setup

**Purpose**: Prepare for implementation

- [x] T001 Create specs/0072-workflow-consolidation/checklists/ directory
- [x] T002 [P] Read all existing command files to understand current structure

---

## Phase 2: User Story 1 - Design Command (Priority: P1)

**Goal**: Create `/specflow.design` that produces all design artifacts in one command

**Independent Test**: Run `/specflow.design` on a new phase and verify all artifacts are created

### Implementation

- [x] T003 [US1] Create commands/specflow.design.md with header and argument parsing
- [x] T004 [US1] Implement DISCOVER phase in specflow.design.md (codebase examination, progressive questions)
- [x] T005 [US1] Implement SPECIFY phase in specflow.design.md (spec.md AND requirements.md creation)
- [x] T006 [US1] Implement inline clarification behavior (questions with context and recommendations)
- [x] T007 [US1] Implement PLAN phase in specflow.design.md (plan.md, research.md, data-model.md)
- [x] T008 [US1] Implement TASKS phase in specflow.design.md (tasks.md generation)
- [x] T009 [US1] Implement CHECKLISTS phase in specflow.design.md (both implementation.md and verification.md)
- [x] T010 [US1] Add state tracking for resumable flow (design.substep in state) - discovery always re-runs per FR-008a

**Checkpoint**: `/specflow.design` produces all 5 artifact types

---

## Phase 3: User Story 2 - Partial Regeneration (Priority: P2)

**Goal**: Support cascade flags (--spec, --plan, --tasks, --checklist)

**Independent Test**: Run `/specflow.design --plan` and verify plan + tasks + checklists regenerated

### Implementation

- [x] T011 [US2] Add flag parsing to specflow.design.md for --spec, --plan, --tasks, --checklist
- [x] T012 [US2] Implement cascade logic: --spec → spec + plan + tasks + checklists
- [x] T013 [US2] Implement cascade logic: --plan → plan + tasks + checklists
- [x] T014 [US2] Implement cascade logic: --tasks → tasks + checklists, --checklist → checklists only

**Checkpoint**: All partial regeneration flags work with cascade

---

## Phase 4: User Story 3 - Orchestrate Update (Priority: P2)

**Goal**: Update orchestrate to use 4-step workflow

**Independent Test**: Run `/specflow.orchestrate status` and see 4 steps

### Implementation

- [x] T015 [US3] Update commands/specflow.orchestrate.md workflow steps table (9 → 4 steps)
- [x] T016 [US3] Update step index mapping (0=design, 1=analyze, 2=implement, 3=verify)
- [x] T017 [US3] Add state migration logic for old indices (0-8) to new indices (0-3)
- [x] T018 [US3] Update status display to show 4 steps
- [x] T019 [US3] Update all step advancement logic (next step index calculations)
- [x] T020 [US3] Update skip-to argument to accept new step names only

**Checkpoint**: Orchestrate shows 4-step workflow and migrates old state

---

## Phase 5: User Story 4 - Roadmap Backlog (Priority: P3)

**Goal**: Add `backlog` subcommand to `/specflow.roadmap`

**Independent Test**: Run `/specflow.roadmap backlog` and see backlog items

### Implementation

- [x] T021 [US4] Add backlog subcommand section to commands/specflow.roadmap.md
- [x] T022 [US4] Move backlog logic from specflow.backlog.md to roadmap backlog subcommand
- [x] T023 [US4] Ensure --auto and --dry-run flags work for roadmap backlog

**Checkpoint**: `/specflow.roadmap backlog` has same functionality as old `/specflow.backlog`

---

## Phase 6: User Story 5 - Deprecation Stubs (Priority: P3)

**Goal**: Create deprecation stubs for 6 commands

**Independent Test**: Run any deprecated command and see migration guidance

### Implementation

- [x] T024 [P] [US5] Convert commands/specflow.specify.md to deprecation stub (→ design)
- [x] T025 [P] [US5] Convert commands/specflow.clarify.md to deprecation stub (→ design)
- [x] T026 [P] [US5] Convert commands/specflow.plan.md to deprecation stub (→ design --plan)
- [x] T027 [P] [US5] Convert commands/specflow.tasks.md to deprecation stub (→ design --tasks)
- [x] T028 [P] [US5] Convert commands/specflow.checklist.md to deprecation stub (→ design --checklist)
- [x] T029 [P] [US5] Convert commands/specflow.backlog.md to deprecation stub (→ roadmap backlog)

**Checkpoint**: All 6 deprecated commands show helpful migration messages

---

## Phase 7: Polish & Documentation

**Purpose**: Update documentation and verify consistency

- [x] T030 Update CLAUDE.md with new 4-step workflow description
- [x] T031 [P] Update docs/commands-analysis.md with new command counts (11 → 6)
- [x] T032 Verify all cross-references in commands/ are updated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **User Story 1 (Phase 2)**: Depends on Setup - creates the core design command
- **User Story 2 (Phase 3)**: Depends on US1 - adds flags to design command
- **User Story 3 (Phase 4)**: Depends on US1 - references design step
- **User Story 4 (Phase 5)**: No dependencies on other stories
- **User Story 5 (Phase 6)**: No dependencies - can run in parallel with US3/US4
- **Polish (Phase 7)**: Depends on all user stories

### Parallel Opportunities

- T002 can run with T001
- T024-T029 (deprecation stubs) can all run in parallel
- T030-T031 can run in parallel

---

## Notes

- All tasks modify Markdown command files (no bash scripts)
- Design command is the largest piece (~500-700 lines expected)
- Deprecation stubs are small (~30 lines each)
- Focus on constitution compliance: Three-Line Output Rule for design command output
