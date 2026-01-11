# Tasks: Roadmap Flexibility

**Phase**: 0010-roadmap-flexibility
**Created**: 2026-01-10
**Total Tasks**: 24

## Task Summary

| Category | Count | Status |
|----------|-------|--------|
| Setup | 2 | Pending |
| Parser Updates | 4 | Pending |
| Insert Command | 5 | Pending |
| Defer Command | 4 | Pending |
| Restore Command | 3 | Pending |
| Migration Script | 4 | Pending |
| Template Updates | 2 | Pending |

---

## Phase 1: Setup

- [x] T001 [P1] Create test ROADMAP.md fixture with 2.0 format in `tests/fixtures/roadmap-v2.0.md`
- [x] T002 [P1] Create test ROADMAP.md fixture with 2.1 format in `tests/fixtures/roadmap-v2.1.md`

## Phase 2: Parser Updates [US3]

- [x] T003 [P1] [US3] Update `parse_phase_table()` regex to support 3-4 digit phase numbers in `scripts/bash/speckit-roadmap.sh`
- [x] T004 [P1] [US3] Add `detect_phase_format()` function to identify 2.0 vs 2.1 format in `scripts/bash/speckit-roadmap.sh`
- [x] T005 [P1] [US3] Add `validate_phase_number()` function for format validation in `scripts/bash/speckit-roadmap.sh`
- [x] T006 [P1] [US3] Add `get_phase_decade()` and `get_next_in_decade()` helper functions in `scripts/bash/speckit-roadmap.sh`

## Phase 3: Insert Command [US1]

- [x] T007 [P1] [US1] Add `cmd_insert()` function skeleton with argument parsing in `scripts/bash/speckit-roadmap.sh`
- [x] T008 [P1] [US1] Implement phase number calculation logic (find next available in decade) in `scripts/bash/speckit-roadmap.sh`
- [x] T009 [P1] [US1] Implement interactive prompts for Goal, Scope, Verification Gate in `scripts/bash/speckit-roadmap.sh`
- [x] T010 [P1] [US1] Implement table row insertion at correct position in `scripts/bash/speckit-roadmap.sh`
- [x] T011 [P1] [US1] Implement phase section insertion after target phase in `scripts/bash/speckit-roadmap.sh`

## Phase 4: Defer Command [US2]

- [x] T012 [P2] [US2] Add `cmd_defer()` function skeleton with argument parsing in `scripts/bash/speckit-roadmap.sh`
- [x] T013 [P2] [US2] Implement Backlog section creation if not exists in `scripts/bash/speckit-roadmap.sh`
- [x] T014 [P2] [US2] Implement phase removal from active table and section in `scripts/bash/speckit-roadmap.sh`
- [x] T015 [P2] [US2] Implement phase addition to Backlog section in `scripts/bash/speckit-roadmap.sh`

## Phase 5: Restore Command [US2]

- [x] T016 [P2] [US2] Add `cmd_restore()` function skeleton with argument parsing and --force flag support in `scripts/bash/speckit-roadmap.sh`
- [x] T017 [P2] [US2] Implement smart restore logic (try original number, fallback to next available) in `scripts/bash/speckit-roadmap.sh`
- [x] T018 [P2] [US2] Implement phase move from Backlog to active roadmap in `scripts/bash/speckit-roadmap.sh`

## Phase 6: Migration Script [US3]

- [x] T019 [P3] [US3] Create `scripts/bash/speckit-migrate.sh` with standard structure (help, common.sh, json.sh)
- [x] T020 [P3] [US3] Implement `cmd_roadmap()` for 2.0→2.1 migration with backup in `scripts/bash/speckit-migrate.sh`
- [x] T021 [P3] [US3] Implement state file update for phase number changes in `scripts/bash/speckit-migrate.sh`
- [x] T022 [P3] [US3] Add `migrate` subcommand routing in `bin/speckit`

## Phase 7: Template & Help Updates

- [x] T023 [P3] Update `templates/roadmap-template.md` with 4-digit ABBC numbering examples
- [x] T024 [P3] Update `show_help()` in `scripts/bash/speckit-roadmap.sh` with new commands (insert, defer, restore)

---

## Dependency Graph

```text
T001, T002 (Setup)
    ↓
T003, T004, T005, T006 (Parser)
    ↓
T007 → T008 → T009 → T010 → T011 (Insert)
    ↓
T012 → T013 → T014 → T015 (Defer)
    ↓
T016 → T017 → T018 (Restore)
    ↓
T019 → T020 → T021 → T022 (Migration)
    ↓
T023, T024 (Templates/Help)
```

## Parallel Execution Opportunities

- T001 and T002 can run in parallel (setup)
- T003, T004, T005, T006 can be implemented sequentially in one session
- T023 and T024 can run in parallel (polish)

---

## Verification Checklist

After all tasks complete:
- [ ] `speckit roadmap insert --after 0020 "Test"` creates phase 0021
- [ ] `speckit roadmap insert --after 0090 "Edge"` creates phase 0100 (next decade)
- [ ] `speckit roadmap defer 0040` moves phase to Backlog
- [ ] `speckit roadmap defer 0010` fails without --force (in-progress protection)
- [ ] `speckit roadmap restore 0040` restores from Backlog
- [ ] `speckit migrate roadmap` converts 001→0010 format
- [ ] All scripts pass `shellcheck`
- [ ] All scripts have `--help` output
- [ ] All scripts support `--json` output where applicable
