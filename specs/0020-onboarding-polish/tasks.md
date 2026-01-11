# Tasks: Onboarding Polish

## Progress Dashboard

> Last updated: 2026-01-11T04:55:43Z | Run `speckit tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 2/2 |
| Foundational (Blocking Prerequisites) | DONE | 3/3 |
| User Story 1 - Project Type Detection (Priority: P1) | DONE | 9/9 |
| User Story 2 - Safe Scaffold Mode (Priority: P2) | DONE | 4/4 |
| User Story 3 - Onboarding Documentation (Priority: P2) | DONE | 4/4 |
| User Story 4 - CLI Output Optimization (Priority: P3) | DONE | 4/4 |
| Polish & Verification | DONE | 4/4 |

**Overall**: 30/30 (100%) | **Current**: None

### Quick Status

- [x] T001 Create detection library file scripts/bash/lib/detection.sh with source guard
- [x] T002 [P] Add test file tests/test-detection.sh with basic structure
- [x] T003 [P] Implement detect_project_type() function in scripts/bash/lib/detection.sh
- [x] T004 [P] Implement detection priority order (tsconfig > package.json > Cargo.toml > go.mod > pyproject.toml > *.sh)
- [x] T005 Add select_template_section() helper in scripts/bash/lib/detection.sh
- [x] T006 [US1] Integrate detection.sh into speckit-scaffold.sh (source library)
- [x] T007 [US1] Add --type flag to speckit-scaffold.sh for explicit override
- [x] T008 [P] [US1] Update constitution-template.md with language-specific sections (TypeScript, Python, Rust, Go, Bash, Generic)
- [x] T009 [P] [US1] Update tech-stack-template.md with language-specific sections (TypeScript, Python, Rust, Go, Bash, Generic)
- [x] T010 [US1] Add template section extraction logic to speckit-scaffold.sh (use select_template_section)
---

**Input**: Design documents from `/specs/0020-onboarding-polish/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Prepare environment for implementation

- [x] T001 Create detection library file scripts/bash/lib/detection.sh with source guard
- [x] T002 [P] Add test file tests/test-detection.sh with basic structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core detection infrastructure required before any user story

**CRITICAL**: No user story work until this phase is complete

- [x] T003 [P] Implement detect_project_type() function in scripts/bash/lib/detection.sh
- [x] T004 [P] Implement detection priority order (tsconfig > package.json > Cargo.toml > go.mod > pyproject.toml > *.sh)
- [x] T005 Add select_template_section() helper in scripts/bash/lib/detection.sh

**Checkpoint**: Detection library ready - user story implementation can begin

---

## Phase 3: User Story 1 - Project Type Detection (Priority: P1)

**Goal**: Scaffold detects project type and customizes templates automatically

**Independent Test**: Run `speckit scaffold` in a Python project and verify templates contain Python content

### Implementation for User Story 1

- [x] T006 [US1] Integrate detection.sh into speckit-scaffold.sh (source library)
- [x] T007 [US1] Add --type flag to speckit-scaffold.sh for explicit override
- [x] T008 [P] [US1] Update constitution-template.md with language-specific sections (TypeScript, Python, Rust, Go, Bash, Generic)
- [x] T009 [P] [US1] Update tech-stack-template.md with language-specific sections (TypeScript, Python, Rust, Go, Bash, Generic)
- [x] T010 [US1] Add template section extraction logic to speckit-scaffold.sh (use select_template_section)
- [x] T011 [US1] Write constitution.md and tech-stack.md with detected language sections during scaffold
- [x] T012 [US1] Test detection in TypeScript project (verify tsconfig.json detected)
- [x] T013 [US1] Test detection in Python project (verify pyproject.toml/requirements.txt detected)
- [x] T014 [US1] Test detection in Rust/Go/Bash projects

**Checkpoint**: Project type detection works for all supported languages

---

## Phase 4: User Story 2 - Safe Scaffold Mode (Priority: P2)

**Goal**: Preview scaffold changes without modifying filesystem

**Independent Test**: Run `speckit scaffold --safe` and verify no files created

### Implementation for User Story 2

- [x] T015 [US2] Add --safe flag parsing to speckit-scaffold.sh
- [x] T016 [US2] Implement dry-run mode that collects operations without writing
- [x] T017 [US2] Format --safe output to show: create/modify/skip actions with paths
- [x] T018 [US2] Test --safe mode in empty project and existing project

**Checkpoint**: Safe mode previews all changes without writing

---

## Phase 5: User Story 3 - Onboarding Documentation (Priority: P2)

**Goal**: Clear quickstart in README for new users

**Independent Test**: New user reads README and runs first command in <5 minutes

### Implementation for User Story 3

- [x] T019 [US3] Add Quickstart section to README.md after Overview
- [x] T020 [US3] Include CLI vs slash command clarification in README.md
- [x] T021 [US3] Add common troubleshooting tips to README.md
- [x] T022 [US3] Review README flow for new user experience

**Checkpoint**: README guides new user through setup successfully

---

## Phase 6: User Story 4 - CLI Output Optimization (Priority: P3)

**Goal**: First 3 lines of CLI output contain user-critical information

**Independent Test**: Run speckit scaffold and verify first 3 lines show status, result, next step

### Implementation for User Story 4

- [x] T023 [US4] Add print_summary() function to scripts/bash/lib/common.sh
- [x] T024 [US4] Update speckit-scaffold.sh to use print_summary() for output
- [x] T025 [US4] Update speckit-doctor.sh to show overall health status first
- [x] T026 [US4] Verify first 3 lines pattern in scaffold and doctor commands

**Checkpoint**: CLI output prioritizes user-critical information

---

## Phase 7: Polish & Verification

**Purpose**: Final quality checks

- [x] T027 [P] Run shellcheck on all modified scripts
- [x] T028 [P] Run tests/test-detection.sh and fix any failures
- [x] T029 Verify --help output is updated for scaffold command
- [x] T030 Manual end-to-end test: scaffold in fresh Python project

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Stories (Phase 3-6)**: All depend on Foundational completion
  - US1 (P1) → US2 (P2) → US3 (P2) → US4 (P3)
  - US3 and US4 can run in parallel if desired
- **Polish (Phase 7)**: Depends on all user stories

### Parallel Opportunities

- T001 and T002 can run in parallel (Setup)
- T003 and T004 can run in parallel (Foundational)
- T008 and T009 can run in parallel (templates)
- T012, T013, T014 can run in parallel (testing)
- T027 and T028 can run in parallel (Polish)

---

## Notes

- All scripts must pass shellcheck
- Templates use marker-based sections: `<!-- LANG:xxx -->` ... `<!-- /LANG:xxx -->`
- Test in mock projects before real projects
- Commit after each task or logical group
