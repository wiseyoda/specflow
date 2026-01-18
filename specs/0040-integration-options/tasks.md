# Tasks: Integration Options

**Phase**: 0040
**Generated**: 2026-01-11
**Total Tasks**: 14

## Legend

- `[ ]` Pending
- `[x]` Complete
- `[P1]` Priority 1 (Critical)
- `[P2]` Priority 2 (Important)
- `[US1]` User Story 1 reference

---

## Setup Tasks

- [x] T001 [P1] Create specs/0040-integration-options directory structure

## US1: Detect Existing Documentation

### Enhance specflow-detect.sh

- [x] T002 [P1] [US1] Add --docs alias flag for --check docs (scripts/bash/specflow-detect.sh)
- [x] T003 [P1] [US1] Add ADR directory detection patterns: adr/, adrs/, ADR/, docs/adr/, docs/decisions/, architecture/decisions/ (scripts/bash/specflow-detect.sh:218-260)
- [x] T004 [P1] [US1] Add ADR file pattern detection: NNN-*.md, ADR-NNN-*.md (scripts/bash/specflow-detect.sh)
- [x] T005 [P2] [US1] Add ARCHITECTURE.md, CONTRIBUTING.md, DESIGN.md detection (scripts/bash/specflow-detect.sh:296-317)
- [x] T006 [P2] [US1] Add suggested import commands to detection output when ADRs found

### Detection Tests

- [x] T007 [P1] [US1] Add test_detect_docs_adr_directories test (tests/test-detect.sh)
- [x] T008 [P1] [US1] Add test_detect_docs_adr_files test (tests/test-detect.sh)

## US2: Import ADRs

### Create specflow-import.sh

- [x] T009 [P1] [US2] Create scripts/bash/specflow-import.sh with command structure and help
- [x] T010 [P1] [US2] Implement ADR source path validation and file detection
- [x] T011 [P1] [US2] Implement ADR file copy to .specify/memory/adrs/
- [x] T012 [P1] [US2] Implement adr-index.md generation with title/status extraction
- [x] T013 [P2] [US2] Add --dry-run flag support

### Import Routing

- [x] T014 [P1] [US2] Add import command routing to bin/specflow

### Import Tests

- [x] T015 [P1] [US2] Create tests/test-import.sh with import test suite

## US3: Reference Integration

(Handled by US2 - adr-index.md created during import provides reference)

## US4: Integration Guide

- [x] T016 [P2] [US4] Create docs/integration-guide.md with detection and import workflows
- [x] T017 [P2] [US4] Add Integration section to README.md

## Polish Tasks

- [x] T018 [P1] Run full test suite and verify all tests pass
- [x] T019 [P2] Final verification: test detection and import on real project structure

---

## Dependency Graph

```
T001 (Setup)
  ↓
T002, T003, T004, T005, T006 (Detection enhancements - parallel)
  ↓
T007, T008 (Detection tests)
  ↓
T009 (Create import script)
  ↓
T010, T011, T012, T013 (Import implementation - sequential)
  ↓
T014 (CLI routing)
  ↓
T015 (Import tests)
  ↓
T016, T017 (Documentation - parallel)
  ↓
T018, T019 (Final verification)
```

## Notes

- T001 is already done (directory exists from SPECIFY step)
- Detection enhancements (T002-T006) can be done in parallel
- Import implementation (T010-T012) should be sequential
- Documentation (T016-T017) can be done in parallel
