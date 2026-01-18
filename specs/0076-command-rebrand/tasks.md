# Tasks: SpecFlow Rebrand

## Setup Phase

- [ ] T001 [P1] Create backup of current state before renaming

## Phase 1: Bash Scripts (US1)

### Rename Script Files
- [ ] T010 [P1] [US1] Rename scripts/bash/speckit-checklist.sh → specflow-checklist.sh
- [ ] T011 [P1] [US1] Rename scripts/bash/speckit-claude-md.sh → specflow-claude-md.sh
- [ ] T012 [P1] [US1] Rename scripts/bash/speckit-context.sh → specflow-context.sh
- [ ] T013 [P1] [US1] Rename scripts/bash/speckit-dashboard.sh → specflow-dashboard.sh
- [ ] T014 [P1] [US1] Rename scripts/bash/speckit-detect.sh → specflow-detect.sh
- [ ] T015 [P1] [US1] Rename scripts/bash/speckit-doctor.sh → specflow-doctor.sh
- [ ] T016 [P1] [US1] Rename scripts/bash/speckit-feature.sh → specflow-feature.sh
- [ ] T017 [P1] [US1] Rename scripts/bash/speckit-gate.sh → specflow-gate.sh
- [ ] T018 [P1] [US1] Rename scripts/bash/speckit-git.sh → specflow-git.sh
- [ ] T019 [P1] [US1] Rename scripts/bash/speckit-import.sh → specflow-import.sh
- [ ] T020 [P1] [US1] Rename scripts/bash/speckit-issue.sh → specflow-issue.sh
- [ ] T021 [P1] [US1] Rename scripts/bash/speckit-lessons.sh → specflow-lessons.sh
- [ ] T022 [P1] [US1] Rename scripts/bash/speckit-manifest.sh → specflow-manifest.sh
- [ ] T023 [P1] [US1] Rename scripts/bash/speckit-memory.sh → specflow-memory.sh
- [ ] T024 [P1] [US1] Rename scripts/bash/speckit-migrate.sh → specflow-migrate.sh
- [ ] T025 [P1] [US1] Rename scripts/bash/speckit-pdr.sh → specflow-pdr.sh
- [ ] T026 [P1] [US1] Rename scripts/bash/speckit-phase.sh → specflow-phase.sh
- [ ] T027 [P1] [US1] Rename scripts/bash/speckit-reconcile.sh → specflow-reconcile.sh
- [ ] T028 [P1] [US1] Rename scripts/bash/speckit-roadmap.sh → specflow-roadmap.sh
- [ ] T029 [P1] [US1] Rename scripts/bash/speckit-scaffold.sh → specflow-scaffold.sh
- [ ] T030 [P1] [US1] Rename scripts/bash/speckit-state.sh → specflow-state.sh
- [ ] T031 [P1] [US1] Rename scripts/bash/speckit-status.sh → specflow-status.sh
- [ ] T032 [P1] [US1] Rename scripts/bash/speckit-tasks.sh → specflow-tasks.sh
- [ ] T033 [P1] [US1] Rename scripts/bash/speckit-templates.sh → specflow-templates.sh

### Update Library Files
- [ ] T040 [P1] [US1] Update scripts/bash/lib/common.sh - rename functions and constants
- [ ] T041 [P1] [US1] Update scripts/bash/lib/json.sh - rename any speckit references
- [ ] T042 [P1] [US1] Update scripts/bash/lib/detection.sh - rename any speckit references

### Update Script Contents
- [ ] T050 [P1] [US1] Update all specflow-*.sh scripts - replace speckit with specflow in content (includes SPECKIT_* → SPECFLOW_* env vars)

## Phase 2: Binary (US1)

- [ ] T060 [P1] [US1] Rename bin/speckit → bin/specflow
- [ ] T061 [P1] [US1] Update bin/specflow - replace speckit with specflow in content

## Phase 3: Slash Commands (US2)

### Create New Command Files
- [ ] T070 [P1] [US2] Create commands/flow.init.md from speckit.init.md with updated content
- [ ] T071 [P1] [US2] Create commands/flow.orchestrate.md from speckit.orchestrate.md with updated content
- [ ] T072 [P1] [US2] Create commands/flow.design.md from speckit.design.md with updated content
- [ ] T073 [P1] [US2] Create commands/flow.analyze.md from speckit.analyze.md with updated content
- [ ] T074 [P1] [US2] Create commands/flow.implement.md from speckit.implement.md with updated content
- [ ] T075 [P1] [US2] Create commands/flow.verify.md from speckit.verify.md with updated content
- [ ] T076 [P1] [US2] Create commands/flow.merge.md from speckit.merge.md with updated content
- [ ] T077 [P1] [US2] Create commands/flow.memory.md from speckit.memory.md with updated content
- [ ] T078 [P1] [US2] Create commands/flow.roadmap.md from speckit.roadmap.md with updated content
- [ ] T079 [P1] [US2] Create commands/flow.review.md from speckit.review.md with updated content

### Update Utility Commands
- [ ] T080 [P1] [US2] Create commands/utilities/flow.taskstoissues.md from speckit.taskstoissues.md

### Delete Deprecated Commands
- [ ] T090 [P2] [US2] Delete commands/speckit.start.md
- [ ] T091 [P2] [US2] Delete commands/speckit.constitution.md
- [ ] T092 [P2] [US2] Delete commands/speckit.phase.md
- [ ] T093 [P2] [US2] Delete commands/speckit.specify.md
- [ ] T094 [P2] [US2] Delete commands/speckit.clarify.md
- [ ] T095 [P2] [US2] Delete commands/speckit.plan.md
- [ ] T096 [P2] [US2] Delete commands/speckit.tasks.md
- [ ] T097 [P2] [US2] Delete commands/speckit.checklist.md
- [ ] T098 [P2] [US2] Delete commands/speckit.backlog.md

### Delete Old Active Commands
- [ ] T100 [P2] [US2] Delete commands/speckit.init.md
- [ ] T101 [P2] [US2] Delete commands/speckit.orchestrate.md
- [ ] T102 [P2] [US2] Delete commands/speckit.design.md
- [ ] T103 [P2] [US2] Delete commands/speckit.analyze.md
- [ ] T104 [P2] [US2] Delete commands/speckit.implement.md
- [ ] T105 [P2] [US2] Delete commands/speckit.verify.md
- [ ] T106 [P2] [US2] Delete commands/speckit.merge.md
- [ ] T107 [P2] [US2] Delete commands/speckit.memory.md
- [ ] T108 [P2] [US2] Delete commands/speckit.roadmap.md
- [ ] T109 [P2] [US2] Delete commands/speckit.review.md
- [ ] T110 [P2] [US2] Delete commands/utilities/speckit.taskstoissues.md

## Phase 4: Install Script (US1)

- [ ] T120 [P1] [US1] Update install.sh - all speckit references to specflow

## Phase 5: Documentation (US3)

### Core Documentation
- [ ] T130 [P2] [US3] Update README.md - branding, URLs, examples
- [ ] T131 [P2] [US3] Update CLAUDE.md - command references, binary name

### Docs Directory
- [ ] T140 [P2] [US3] Update docs/cli-reference.md
- [ ] T141 [P2] [US3] Update docs/commands-analysis.md
- [ ] T142 [P2] [US3] Update docs/slash-commands.md
- [ ] T143 [P2] [US3] Update docs/configuration.md
- [ ] T144 [P2] [US3] Update docs/integration-guide.md
- [ ] T145 [P2] [US3] Update docs/project-structure.md
- [ ] T146 [P2] [US3] Update docs/templates.md
- [ ] T147 [P2] [US3] Update docs/troubleshooting.md
- [ ] T148 [P2] [US3] Update docs/COMMAND-AUDIT.md

### Memory Documents
- [ ] T150 [P2] [US3] Update .specify/memory/constitution.md
- [ ] T151 [P2] [US3] Update .specify/memory/coding-standards.md
- [ ] T152 [P2] [US3] Update .specify/memory/glossary.md
- [ ] T153 [P2] [US3] Update .specify/memory/tech-stack.md
- [ ] T154 [P2] [US3] Update .specify/memory/testing-strategy.md

### Templates
- [ ] T160 [P2] [US3] Update templates containing speckit references

## Phase 6: Verification (US3)

- [ ] T170 [P1] [US3] Verify grep for "speckit" in *.sh files returns 0 (excluding archive)
- [ ] T171 [P1] [US3] Verify grep for "speckit" in *.md files returns 0 (excluding archive/history)
- [ ] T172 [P1] [US1] Verify specflow help displays correctly
- [ ] T173 [P1] [US1] Verify specflow doctor passes
- [ ] T174 [P1] [US2] Verify all /flow.* commands are accessible

## Phase 7: Repository Rename (US4)

- [ ] T180 [P3] [US4] Document repository rename instructions (manual GitHub step)

## Dependencies

```
T001 → T010-T033 (backup before script renames)
T010-T033 → T040-T042 (scripts renamed before lib updates)
T040-T042 → T050 (libs updated before script content)
T050 → T060-T061 (scripts done before binary)
T060-T061 → T070-T110 (binary done before commands)
T070-T079 → T090-T110 (new commands created before old deleted)
T060-T061 → T120 (binary done before install.sh)
T070-T110 → T130-T154 (commands done before docs)
All → T170-T174 (verification last)
T170-T174 → T180 (verify before repo rename)
```
