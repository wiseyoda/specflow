# Tasks: Workflow Commands

**Phase**: 0015-workflow-commands
**Generated**: 2026-01-10
**Source**: spec.md, plan.md

## Task Format

`- [ ] TNNN [P#] [US#] Description | file:path`

- **TNNN**: Task ID (T001, T002, etc.)
- **P#**: Priority (P1 = critical, P2 = important, P3 = nice-to-have)
- **US#**: User Story reference (US1, US2, US3)
- **file:path**: Primary file affected

---

## Phase 0: Setup

- [x] T001 [P1] [-] Verify all dependencies available (git, jq, gh) | scripts/bash/specflow-roadmap.sh

---

## Phase 1: CLI Foundation (specflow roadmap backlog)

### US3 - Quick Add to Backlog

- [x] T002 [P1] [US3] Add cmd_backlog function skeleton to specflow-roadmap.sh | scripts/bash/specflow-roadmap.sh
- [x] T003 [P1] [US3] Implement `backlog add` action - parse arguments | scripts/bash/specflow-roadmap.sh
- [x] T004 [P1] [US3] Implement `backlog add` - create Backlog section if missing | scripts/bash/specflow-roadmap.sh
- [x] T005 [P1] [US3] Implement `backlog add` - append item with timestamp | scripts/bash/specflow-roadmap.sh
- [x] T006 [P2] [US3] Implement `backlog list` action - display backlog items | scripts/bash/specflow-roadmap.sh
- [x] T007 [P2] [US3] Implement `backlog clear` action - remove all items | scripts/bash/specflow-roadmap.sh
- [x] T008 [P2] [US3] Add --json output support for backlog commands | scripts/bash/specflow-roadmap.sh
- [x] T009 [P1] [US3] Add help text for backlog subcommand | scripts/bash/specflow-roadmap.sh
- [x] T010 [P2] [US3] Handle special characters in backlog item text | scripts/bash/specflow-roadmap.sh
- [x] T011 [P2] [US3] Register backlog command in main dispatcher | scripts/bash/specflow-roadmap.sh

---

## Phase 2: Merge Command (/specflow.merge)

### US1 - Complete Phase with Single Command

- [x] T012 [P1] [US1] Create specflow.merge.md command file with frontmatter | commands/specflow.merge.md
- [x] T013 [P1] [US1] Document pre-flight checks (branch, uncommitted changes, tasks) | commands/specflow.merge.md
- [x] T014 [P1] [US1] Document git push workflow | commands/specflow.merge.md
- [x] T015 [P1] [US1] Document PR creation logic (gh vs manual) | commands/specflow.merge.md
- [x] T016 [P1] [US1] Document PR merge workflow (default auto-merge) | commands/specflow.merge.md
- [x] T017 [P1] [US1] Document --pr-only flag behavior | commands/specflow.merge.md
- [x] T018 [P1] [US1] Document branch cleanup (checkout main, pull, delete local and remote) | commands/specflow.merge.md
- [x] T019 [P1] [US1] Document state archive step (specflow state archive) | commands/specflow.merge.md
- [x] T020 [P1] [US1] Document ROADMAP update step | commands/specflow.merge.md
- [x] T021 [P2] [US1] Document backlog summary display | commands/specflow.merge.md
- [x] T022 [P2] [US1] Document --force flag for incomplete tasks | commands/specflow.merge.md
- [x] T023 [P2] [US1] Document --dry-run flag | commands/specflow.merge.md
- [x] T024 [P1] [US1] Document error handling (network, conflicts, missing gh) | commands/specflow.merge.md
- [x] T025 [P2] [US1] Add handoffs section for next steps | commands/specflow.merge.md

---

## Phase 3: Backlog Triage (/specflow.backlog)

### US2 - Triage Backlog into Phases

- [x] T026 [P2] [US2] Create specflow.backlog.md command file with frontmatter | commands/specflow.backlog.md
- [x] T027 [P2] [US2] Document backlog parsing from ROADMAP.md | commands/specflow.backlog.md
- [x] T028 [P2] [US2] Document phase scope extraction for matching | commands/specflow.backlog.md
- [x] T029 [P2] [US2] Document item-to-phase matching algorithm | commands/specflow.backlog.md
- [x] T030 [P2] [US2] Document confidence scoring and thresholds | commands/specflow.backlog.md
- [x] T031 [P2] [US2] Document user interaction for low-confidence matches | commands/specflow.backlog.md
- [x] T032 [P2] [US2] Document new phase creation for unassignable items | commands/specflow.backlog.md
- [x] T033 [P2] [US2] Document ROADMAP update with assignments | commands/specflow.backlog.md
- [x] T034 [P2] [US2] Document summary output format | commands/specflow.backlog.md
- [x] T035 [P2] [US2] Add handoffs section | commands/specflow.backlog.md

---

## Phase 4: Polish

- [x] T036 [P3] [-] Update specflow help command output with new commands | bin/specflow
- [x] T037 [P3] [-] Update install.sh to include new command files | install.sh
- [x] T038 [P2] [-] Test backlog add with empty ROADMAP (no Backlog section) | tests/
- [x] T039 [P2] [-] Test merge command dry-run mode | tests/
- [x] T040 [P2] [-] Run shellcheck on modified scripts | scripts/bash/specflow-roadmap.sh

---

## Dependency Graph

```
T001 → T002 → T003 → T004 → T005 → T011
                  ↓
              T006, T007, T008, T009, T010

T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T025
                                                             ↓
                                                    T021, T022, T023, T024

T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035

T035 → T036, T037, T038, T039, T040
```

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P1 | 18 | Critical path - merge command and CLI foundation |
| P2 | 18 | Important - backlog triage, polish, edge cases |
| P3 | 4 | Nice-to-have - help updates, extra tests |
| **Total** | **40** | |

| User Story | Count |
|------------|-------|
| US1 (Merge) | 14 |
| US2 (Backlog Triage) | 10 |
| US3 (Quick Add) | 10 |
| Setup/Polish | 6 |
