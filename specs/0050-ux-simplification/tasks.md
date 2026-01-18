# Task List: UX Simplification

**Phase**: 0050
**Created**: 2026-01-11
**Total Tasks**: 45

---

## Setup Phase

- [x] T001 [P1] [Setup] Verify current state - confirm `.specify/scripts/bash/` already deleted
- [x] T002 [P1] [Setup] Create backup of commands/ directory before modifications

---

## User Story: US-002 - Direct CLI for Simple Operations (FR-002)

- [x] T003 [P1] [US-002] [FR-002] Delete `commands/specflow.issue.md` slash command
- [x] T004 [P1] [US-002] [FR-002] Update `docs/slash-commands.md` - remove /specflow.issue reference
- [x] T005 [P1] [US-002] [FR-002] Update `docs/cli-reference.md` - verify `specflow issue` CLI documented
- [x] T006 [P1] [US-002] [FR-002] Update `docs/COMMAND-AUDIT.md` - mark /specflow.issue as DELETED

---

## User Story: US-003 - Unified Memory Management (FR-003)

- [x] T007 [P1] [US-003] [FR-003] Read `commands/specflow.memory-init.md` to understand current functionality
- [x] T008 [P1] [US-003] [FR-003] Update `commands/specflow.memory.md` - add `generate` subcommand section
- [x] T009 [P1] [US-003] [FR-003] Replace `commands/specflow.memory-init.md` with deprecation error message
- [x] T010 [P1] [US-003] [FR-003] Test `/specflow.memory generate` works correctly

---

## User Story: US-001 - Single Entry Point (FR-004)

- [x] T011 [P1] [US-001] [FR-004] Update `commands/specflow.init.md` - add "Continue Later" handoff to /specflow.start
- [x] T012 [P1] [US-001] [FR-004] Update `commands/specflow.orchestrate.md` - add "Continue Later" handoff
- [x] T013 [P1] [US-001] [FR-004] Update `commands/specflow.verify.md` - add "Continue Later" handoff
- [x] T014 [P1] [US-001] [FR-004] Update `commands/specflow.merge.md` - add "Continue Later" handoff
- [x] T015 [P1] [US-001] [FR-004] Update `commands/specflow.backlog.md` - add "Continue Later" handoff
- [x] T016 [P1] [US-001] [FR-004] Update `commands/specflow.review.md` - add "Continue Later" handoff
- [x] T017 [P1] [US-001] [FR-004] Update `commands/specflow.roadmap.md` - add "Continue Later" handoff
- [x] T018 [P1] [US-001] [FR-004] Update `commands/specflow.constitution.md` - add "Continue Later" handoff
- [x] T019 [P1] [US-001] [FR-004] Update `commands/specflow.phase.md` - add "Continue Later" handoff
- [x] T020 [P1] [US-001] [FR-004] Update `commands/specflow.specify.md` - add "Continue Later" handoff
- [x] T021 [P1] [US-001] [FR-004] Update `commands/specflow.plan.md` - add "Continue Later" handoff
- [x] T022 [P1] [US-001] [FR-004] Update `README.md` - add prominent /specflow.start recommendation
- [x] T023 [P1] [US-001] [FR-004] Update `bin/specflow` - add /specflow.start note in help text

---

## User Story: US-006 - UI Design Documentation (FR-008)

- [x] T024 [P1] [US-006] [FR-008] Create `templates/ui-design-template.md` with Before/After/Rationale structure
- [x] T025 [P1] [US-006] [FR-008] Update `commands/specflow.specify.md` - add UI keyword detection logic
- [x] T026 [P1] [US-006] [FR-008] Update `commands/specflow.specify.md` - add ui/design.md auto-creation
- [x] T027 [P1] [US-006] [FR-008] Update `commands/specflow.plan.md` - add UI design verification check
- [x] T028 [P2] [US-006] [FR-008] Update `docs/templates.md` - document ui-design-template

---

## User Story: US-007 - Minimal CLAUDE.md (FR-005)

- [x] T029 [P1] [US-007] [FR-005] Create `.specify/USAGE.md` template with full CLI reference
- [x] T030 [P1] [US-007] [FR-005] Design minimal CLAUDE.md SpecFlow section (≤15 lines)
- [x] T031 [P1] [US-007] [FR-005] Update `scripts/bash/specflow-claude-md.sh` - implement minimal merge
- [x] T032 [P1] [US-007] [FR-005] Test `specflow claude-md merge` produces minimal output

---

## User Story: US-005 - Filesystem-Derived State (FR-007)

- [x] T033 [P1] [US-005] [FR-007] Update `scripts/bash/specflow-status.sh` - add artifact detection functions
- [x] T034 [P1] [US-005] [FR-007] Update `scripts/bash/specflow-status.sh` - derive step completion from files
- [x] T035 [P1] [US-005] [FR-007] Test `specflow status --json` reports derived state correctly
- [x] T036 [P2] [US-005] [FR-007] Verify state recovery works with outdated state file

---

## User Story: US-004 - Clean Codebase (FR-001)

- [x] T037 [P1] [US-004] [FR-001] Verify no duplicate scripts exist in repository
- [x] T038 [P1] [US-004] [FR-001] Run shellcheck on any modified bash scripts

---

## Documentation Polish (FR-006)

- [x] T039 [P2] [Docs] [FR-006] Update `docs/integration-guide.md` - update workflow examples
- [x] T040 [P2] [Docs] [FR-006] Verify `docs/project-structure.md` accuracy
- [x] T041 [P2] [Docs] [FR-006] Verify `docs/configuration.md` accuracy
- [x] T042 [P2] [Docs] [FR-006] Update `docs/troubleshooting.md` - update diagnostics
- [x] T043 [P2] [Docs] [FR-006] Verify `docs/templates.md` accuracy

---

## Verification Phase

- [x] T044 [P1] [Verify] Run comprehensive test of all modified commands
- [x] T045 [P1] [Verify] Verify all gate checks pass for phase completion

---

## Task Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P1 | 38 | Must complete |
| P2 | 7 | Should complete |

| User Story | Tasks |
|------------|-------|
| Setup | 2 |
| US-001 (Entry Point) | 13 |
| US-002 (CLI Direct) | 4 |
| US-003 (Memory) | 4 |
| US-004 (Clean) | 2 |
| US-005 (State) | 4 |
| US-006 (UI Design) | 5 |
| US-007 (CLAUDE.md) | 4 |
| Docs Polish | 5 |
| Verification | 2 |

---

## Dependencies

```
T001 → T002 → [T003-T006 parallel]
T007 → T008 → T009 → T010
T024 → T025 → T026 → T027 → T028
T029 → T030 → T031 → T032
T033 → T034 → T035 → T036
[T011-T023 parallel]
[T039-T043 parallel]
T044 depends on all above
T045 depends on T044
```
