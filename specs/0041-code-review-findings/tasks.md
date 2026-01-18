# Tasks: Code Review Findings

**Phase**: 0041 - Code Review Findings
**Created**: 2026-01-11
**Total Tasks**: 42

---

## Setup

- [x] T001 [P1] Create feature branch and verify state initialized

---

## Phase A: High Priority - Safety & Documentation (US1, US2)

### US1 - Reliable Script Execution

- [x] T002 [P1] [US1] Delete legacy scripts/bash/check-prerequisites.sh (OC001)
- [x] T003 [P1] [US1] Delete legacy .specify/scripts/bash/check-prerequisites.sh (OC001)

### US2 - Accurate Documentation

- [x] T004 [P1] [US2] Update commands/specflow.specify.md:57-60 to reference `specflow feature create` (OC002, OD005)
- [x] T005 [P1] [US2] Replace YOUR_USERNAME in README.md:3 badge URL (OD001)
- [x] T006 [P1] [US2] Replace YOUR_USERNAME in README.md:29,63,326 install commands (OD002)

---

## Phase B: Hardening & Best Practices (US1)

### US1 - Reliable Script Execution

- [x] T007 [P2] [US1] Add `set -euo pipefail` to any scripts missing strict mode (BP002)
- [x] T008 [P2] [US1] Add sanitize_for_pattern() helper to lib/common.sh (HD001)
- [x] T009 [P2] [US1] Add input sanitization in specflow-state.sh jq calls (HD001)
- [x] T010 [P2] [US1] Add input sanitization in specflow-roadmap.sh grep/jq calls (HD001)
- [x] T011 [P2] [US1] Add trap cleanup for temp files in specflow-state.sh (HD002)
- [x] T012 [P2] [US1] Add trap cleanup for temp files in specflow-roadmap.sh (HD002)
- [x] T013 [P2] [US1] Validate placeholder goals before write in specflow-roadmap.sh:626 (MF001)
- [x] T014 [P2] [US1] Remove jq debug leftover in specflow-state.sh:624 (BP003)

---

## Phase C: Refactoring (US3)

### US3 - Clean Codebase

- [x] T015 [P3] [US3] Extract cmd_migrate() into smaller functions (<150 lines each) (RF001)
- [x] T016 [P3] [US3] Extract cmd_infer() into smaller functions (<150 lines each) (RF001)
- [x] T017 [P3] [US3] Simplify registry clean in specflow-state.sh:604-645 (RF002)
- [x] T018 [P3] [US3] Extract duplicate registry patterns to registry_*() helpers (RF003)
- [x] T019 [P3] [US3] Add validate_phase_number() to lib/common.sh (RF006)
- [x] T020 [P3] [US3] Replace duplicate phase validation with shared function (RF006)
- [x] T021 [P3] [US3] Add error handling on external commands in specflow-import.sh (RF007)
- [x] T021a [P3] [US3] Refactor state inference to use clearer conditional structure (RF004)
- [x] T021b [P3] [US3] Make scaffold path logic data-driven with config array (RF005)

---

## Phase D: Feature Additions (US4)

### US4 - Extended CLI Features

- [x] T022 [P4] [US4] Add detect_test_runner() function to specflow-gate.sh (MF002)
- [x] T023 [P4] [US4] Add pytest support to gate runner detection (MF002)
- [x] T024 [P4] [US4] Add go test support to gate runner detection (MF002)
- [x] T025 [P4] [US4] Add bats support to gate runner detection (MF002)
- [x] T026 [P4] [US4] Add backlog priority column parsing to specflow-roadmap.sh (MF003)

---

## Phase E: Documentation Cleanup (US2)

### US2 - Accurate Documentation

- [x] T027 [P2] [US2] Fix ROADMAP.md:33-40 status icons to match legend (OD003)
- [x] T028 [P2] [US2] Update CLAUDE.md:29-45 architecture diagram with lib/json.sh, lib/detection.sh (OD004)
- [x] T029 [P2] [US2] Remove legacy init-*.md references from CLAUDE.md:83 (OC003)
- [x] T030 [P2] [US2] Add "Customizing Templates" section to README.md (OD007)
- [x] T031 [P2] [US2] Fix README.md:328-337 memory subcommands to match CLI syntax (OD008)

---

## Phase F: Code Hygiene (US1, US3)

### US1 - Reliable Script Execution

- [x] T032 [P3] [US1] Quote parameter expansion in specflow-context.sh:307 (BP004)
- [x] T033 [P3] [US1] Add comment for magic number in specflow-roadmap.sh:743 (BP005)
- [x] T034 [P3] [US1] Add input validation error check in specflow-feature.sh:71-80 (BP006)
- [x] T035 [P3] [US1] Use grep -F for literal patterns in specflow-roadmap.sh (HD004)
- [x] T036 [P3] [US1] Add require_command() checks in specflow-roadmap.sh (HD003)

### US3 - Clean Codebase

- [x] T037 [P3] [US3] Store status as text, convert to emoji for display in specflow-roadmap.sh (OE003)
- [x] T038 [P3] [US3] Use validation config for check_sections() in specflow-gate.sh (OE004)
- [x] T039 [P3] [US3] Inline or delete unused helpers in specflow-roadmap.sh (OC004)

---

## Polish

- [x] T040 [P1] Run shellcheck and test suite, fix any failures

---

## Task Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P1 | 7 | Setup, safety fixes, critical docs |
| P2 | 13 | Hardening, documentation cleanup |
| P3 | 18 | Refactoring, code hygiene |
| P4 | 5 | Feature additions |
| **Total** | **42** | |

---

## Dependency Graph

```
T001 (Setup)
  └── T002, T003 (Delete legacy scripts)
        └── T004-T006 (Doc fixes)
              └── T007-T014 (Hardening)
                    └── T015-T021 (Refactoring)
                          └── T022-T026 (Features)
                                └── T027-T031 (Doc cleanup)
                                      └── T032-T039 (Code hygiene)
                                            └── T040 (Validation)
```

Note: Tasks within each phase can be parallelized. Tasks across phases should be sequential.

---

## Files Modified by Task

| File | Tasks |
|------|-------|
| scripts/bash/check-prerequisites.sh | T002 (delete) |
| .specify/scripts/bash/check-prerequisites.sh | T003 (delete) |
| commands/specflow.specify.md | T004 |
| README.md | T005, T006, T030, T031 |
| lib/common.sh | T008, T019 |
| scripts/bash/specflow-state.sh | T009, T011, T014, T015, T016, T017, T018 |
| scripts/bash/specflow-roadmap.sh | T010, T012, T013, T26, T33, T35, T36, T37, T39 |
| scripts/bash/specflow-gate.sh | T022-T025, T038 |
| ROADMAP.md | T027 |
| CLAUDE.md | T028, T029 |
| scripts/bash/specflow-context.sh | T032 |
| scripts/bash/specflow-feature.sh | T034 |
| scripts/bash/specflow-import.sh | T021 |
