# Tasks: Test Suite Completion

**Phase**: 0030
**Generated**: 2026-01-11
**Total Tasks**: 15

## Legend

- `[ ]` Pending
- `[x]` Complete
- `[P1]` Priority 1 (Critical)
- `[P2]` Priority 2 (Important)
- `[US1]` User Story 1 reference

---

## Setup Tasks

- [x] T001 [P1] Create specs/0030-test-suite-completion directory structure

## US1: Run All Tests Successfully

### Fix Test Failures

- [x] T002 [P1] [US1] Fix test-checklist.sh: Update assert pattern from `2 / 3` to `2/3` in test_checklist_show (tests/test-checklist.sh:126)
- [x] T003 [P1] [US1] Fix test-roadmap.sh: Update create_test_roadmap() to use 4-digit phases (0010, 0020, 0030, 0040) (tests/test-roadmap.sh:17-35)
- [x] T004 [P1] [US1] Fix test-scaffold.sh: Update test_scaffold_status assertion to match current output format (tests/test-scaffold.sh:52-61)
- [x] T005 [P1] [US1] Fix test-doctor.sh: Update test_doctor_all_checks to check for success indicators instead of "Summary" (tests/test-doctor.sh:142-155)

### Verify All Tests Pass

- [x] T006 [P1] [US1] Run ./tests/test-runner.sh and verify all tests pass

## US2: Run Individual Test Suites

- [x] T007 [P1] [US2] Verify each test suite runs independently (checklist, claude-md, context, detect, doctor, feature, git, memory, migrate, reconcile, roadmap, scaffold, state, tasks, templates)

## US3: CI/CD Pipeline Integration

- [x] T008 [P2] [US3] Create .github/workflows/test.yml with ubuntu-latest runner
- [x] T009 [P2] [US3] Add shellcheck step to CI workflow
- [ ] T010 [P2] [US3] Test CI workflow by pushing to branch

## US4: Cross-Platform Compatibility

### POSIX Audit

- [x] T011 [P2] [US4] Run shellcheck on all scripts in scripts/bash/ and fix errors
- [x] T012 [P2] [US4] Check for declare -A usage and replace with POSIX alternatives
- [x] T013 [P2] [US4] Check for head -n -1 usage and replace with portable alternatives

## Polish Tasks

- [ ] T014 [P2] Add CI status badge to README.md (if CI passes)
- [ ] T015 [P1] Final verification: run full test suite and confirm all pass

---

## Dependency Graph

```
T001 (Setup)
  ↓
T002, T003, T004, T005 (Fix Tests - parallel)
  ↓
T006 (Verify All Pass)
  ↓
T007 (Individual Suites)
  ↓
T011, T012, T013 (POSIX Audit - parallel)
  ↓
T008 (Create CI)
  ↓
T009 (Add shellcheck to CI)
  ↓
T010 (Test CI)
  ↓
T014 (Badge)
  ↓
T015 (Final Verification)
```

## Notes

- T001 is already done (directory exists from SPECIFY step)
- Test fixes (T002-T005) can be done in parallel
- POSIX audit (T011-T013) can be done in parallel
- CI tasks (T008-T010) must be sequential
