# Tasks: Pre-Workflow Commands Consolidation

**Phase**: 0070-preworkflow-consolidation
**Created**: 2026-01-17
**Status**: Complete

---

## Task Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | ✅ |
| US1: Deprecation Stubs | 4 | ✅ |
| US2: Init Expansion | 5 | ✅ |
| US3: Memory Reduction | 2 | ✅ |
| US4: Roadmap Expansion | 3 | ✅ |
| Documentation | 4 | ✅ |
| **Total** | **19** | ✅ |

---

## Setup Tasks

- [x] T001 [P1] [Setup] Create backup of current command files before modification
  - File: N/A (shell operation)
  - Copy `commands/specflow.start.md`, `specflow.constitution.md`, `specflow.phase.md` to temp backup
  - **Done**: Backed up to `/tmp/specflow-backup-0070/`

---

## User Story 1: Deprecation Stubs (P1)

- [x] T002 [P1] [US1] Delete `/specflow.memory-init` command file
  - File: `commands/specflow.memory-init.md`
  - Action: Delete file (already deprecated with redirect to memory generate)
  - **Done**: File deleted

- [x] T003 [P1] [US1] Replace `/specflow.start` with deprecation stub
  - File: `commands/specflow.start.md`
  - Action: Replace ~400 lines with ~30 line deprecation stub pointing to `/specflow.orchestrate`
  - **Done**: Now 30 lines with deprecation notice

- [x] T004 [P1] [US1] Replace `/specflow.constitution` with deprecation stub
  - File: `commands/specflow.constitution.md`
  - Action: Replace ~270 lines with ~30 line deprecation stub pointing to `/specflow.init`
  - **Done**: Now 32 lines with deprecation notice

- [x] T005 [P1] [US1] Replace `/specflow.phase` with deprecation stub
  - File: `commands/specflow.phase.md`
  - Action: Replace ~340 lines with ~30 line deprecation stub pointing to `/specflow.roadmap add-pdr`
  - Note: Save the phase logic to reference when expanding roadmap
  - **Done**: Now 32 lines with deprecation notice, original backed up

---

## User Story 2: Init Expansion (P1)

- [x] T006 [P1] [US2] Add constitution generation step to `/specflow.init`
  - File: `commands/specflow.init.md`
  - Add section: Check constitution completion, generate if incomplete
  - Detection: Look for `[PROJECT_NAME]`, `[PRINCIPLE_` placeholders
  - Uses logic from: `commands/specflow.constitution.md` (before deprecation)
  - **Done**: Step 2 added with smart placeholder detection

- [x] T007 [P1] [US2] Add memory document generation step to `/specflow.init`
  - File: `commands/specflow.init.md`
  - Add section: Generate memory docs after constitution
  - Detection: Look for placeholder patterns in tech-stack.md etc.
  - Uses existing export functionality
  - **Done**: Step 3 added with placeholder detection

- [x] T008 [P1] [US2] Add roadmap creation step to `/specflow.init`
  - File: `commands/specflow.init.md`
  - Add section: Create ROADMAP.md if not exists
  - Uses logic from: `commands/specflow.roadmap.md`
  - **Done**: Step 4 added with completion detection

- [x] T009 [P1] [US2] Add smart completion detection and pre-flight checks to init
  - File: `commands/specflow.init.md`
  - Add detection logic for each step (placeholders vs complete)
  - Add pre-flight check: abort if orchestration phase is in progress
  - Report which steps were skipped vs executed
  - **Done**: Pre-flight checks section added, smart detection in each step

- [x] T010 [P1] [US2] Add `--force` flag to regenerate all artifacts
  - File: `commands/specflow.init.md`
  - Update argument routing table
  - When set, regenerate even if artifacts appear complete
  - **Done**: `--force` flag documented in argument routing table

---

## User Story 3: Memory Reduction (P2)

- [x] T011 [P2] [US3] Remove `generate` subcommand section from `/specflow.memory`
  - File: `commands/specflow.memory.md`
  - Remove lines 731-781 (Generate Subcommand section)
  - Update argument documentation to remove generate references
  - **Done**: Generate section removed (~50 lines)

- [x] T012 [P2] [US3] Add helpful message for `generate` subcommand attempts
  - File: `commands/specflow.memory.md`
  - Add routing: if `generate` → show message about `/specflow.init`
  - **Done**: Argument routing and Generate Deprecation section added

---

## User Story 4: Roadmap Expansion (P2)

- [x] T013 [P2] [US4] Add `add-pdr` subcommand routing to `/specflow.roadmap`
  - File: `commands/specflow.roadmap.md`
  - Update argument routing table at top of file
  - Add `add-pdr` as first positional argument option
  - **Done**: Argument routing section added

- [x] T014 [P2] [US4] Add `add-pdr` implementation section to `/specflow.roadmap`
  - File: `commands/specflow.roadmap.md`
  - Move logic from `specflow.phase.md` (PDR listing, selection, conversion)
  - Preserve PDR validation and marking as processed
  - **Done**: Full "Add PDR Subcommand" section (~250 lines) added

- [x] T015 [P2] [US4] Update roadmap handoffs to include add-pdr option
  - File: `commands/specflow.roadmap.md`
  - Update handoffs section in frontmatter if applicable
  - **Done**: Handoffs updated, deprecated `specflow.start` removed

---

## Documentation Tasks (P3)

- [x] T016 [P3] [Docs] Update CLAUDE.md command documentation
  - File: `CLAUDE.md`
  - Update Commands section to reflect 3 pre-workflow commands
  - Remove references to deprecated commands
  - Add note about deprecation stubs
  - **Done**: v2.2 Key Changes section added

- [x] T017 [P3] [Docs] Update docs/commands-analysis.md
  - File: `docs/commands-analysis.md`
  - Update Pre-Workflow Commands section
  - Mark deprecated commands appropriately
  - Update line counts and complexity scores
  - **Done**: Complete update with new command counts, descriptions, and numbering

- [x] T018 [P3] [Docs] Search and update references to deprecated commands
  - Files: Multiple (search results)
  - Search for: `/specflow.start`, `/specflow.constitution`, `/specflow.phase`, `/specflow.memory-init`
  - Update handoffs in other command files
  - **Done**: Updated 6 handoffs (specify, backlog, merge, review, verify, plan)

- [x] T019 [P3] [Docs] Update workflow sequence diagram in commands-analysis.md
  - File: `docs/commands-analysis.md`
  - Update ASCII diagram to show: init → memory → roadmap (only 3 commands)
  - **Done**: Diagram updated with 3-command flow

---

## Dependency Graph

```
T001 (backup) ✅
  ├── T002 (delete memory-init) ✅
  ├── T003 (stub start) ✅
  ├── T004 (stub constitution) ✅
  └── T005 (stub phase) ✅
        │
        ├── T006 (init + constitution) ✅
        ├── T007 (init + memory gen) ✅
        ├── T008 (init + roadmap) ✅
        ├── T009 (init detection) ✅
        └── T010 (init --force) ✅
              │
              ├── T011 (memory remove generate) ✅
              ├── T012 (memory generate message) ✅
              ├── T013 (roadmap add-pdr routing) ✅
              ├── T014 (roadmap add-pdr logic) ✅
              └── T015 (roadmap handoffs) ✅
                    │
                    ├── T016 (update CLAUDE.md) ✅
                    ├── T017 (update commands-analysis.md) ✅
                    ├── T018 (search/update refs) ✅
                    └── T019 (update diagram) ✅
```

---

## Verification Checklist

After all tasks complete:

- [x] Run `/specflow.start` → shows deprecation notice
- [x] Run `/specflow.constitution` → shows deprecation notice
- [x] Run `/specflow.phase` → shows deprecation notice
- [x] Check CLAUDE.md → correctly documents v2.2 changes
- [x] Check commands-analysis.md → correctly documents changes

**Pending User Verification**:
- [ ] Run `/specflow.init` on fresh project → all artifacts created
- [ ] Run `/specflow.init` on project with constitution → constitution preserved
- [ ] Run `/specflow.init` while phase in progress → warns and aborts
- [ ] Run `/specflow.memory generate` → shows helpful message
- [ ] Run `/specflow.roadmap add-pdr` → lists PDRs
- [ ] Verify existing project with constitution/memory/roadmap works unchanged (SC-004)
