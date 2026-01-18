# Verification Checklist: SpecFlow Rebrand

## Pre-Verification Setup

- [ ] All implementation tasks marked complete
- [ ] No uncommitted changes in git

## Binary & CLI Verification (FR-001, FR-002, FR-003)

- [ ] `bin/specflow` exists and is executable
- [ ] `specflow help` displays help with SpecFlow branding
- [ ] `specflow doctor` runs without errors
- [ ] `specflow version` shows version info
- [ ] `specflow state get` works correctly
- [ ] No references to `speckit` in bin/specflow content

## Slash Commands Verification (FR-004, FR-005, FR-006)

### Active Commands Present
- [ ] `commands/flow.init.md` exists
- [ ] `commands/flow.orchestrate.md` exists
- [ ] `commands/flow.design.md` exists
- [ ] `commands/flow.analyze.md` exists
- [ ] `commands/flow.implement.md` exists
- [ ] `commands/flow.verify.md` exists
- [ ] `commands/flow.merge.md` exists
- [ ] `commands/flow.memory.md` exists
- [ ] `commands/flow.roadmap.md` exists
- [ ] `commands/flow.review.md` exists
- [ ] `commands/utilities/flow.taskstoissues.md` exists

### Deprecated Commands Deleted
- [ ] `commands/speckit.start.md` does NOT exist
- [ ] `commands/speckit.constitution.md` does NOT exist
- [ ] `commands/speckit.phase.md` does NOT exist
- [ ] `commands/speckit.specify.md` does NOT exist
- [ ] `commands/speckit.clarify.md` does NOT exist
- [ ] `commands/speckit.plan.md` does NOT exist
- [ ] `commands/speckit.tasks.md` does NOT exist
- [ ] `commands/speckit.checklist.md` does NOT exist
- [ ] `commands/speckit.backlog.md` does NOT exist

### Old Active Commands Deleted
- [ ] `commands/speckit.init.md` does NOT exist
- [ ] `commands/speckit.orchestrate.md` does NOT exist
- [ ] `commands/speckit.design.md` does NOT exist
- [ ] `commands/speckit.analyze.md` does NOT exist
- [ ] `commands/speckit.implement.md` does NOT exist
- [ ] `commands/speckit.verify.md` does NOT exist
- [ ] `commands/speckit.merge.md` does NOT exist
- [ ] `commands/speckit.memory.md` does NOT exist
- [ ] `commands/speckit.roadmap.md` does NOT exist
- [ ] `commands/speckit.review.md` does NOT exist

### Command Content Verification
- [ ] All flow.*.md files reference `/flow.*` commands (not `/speckit.*`)
- [ ] All flow.*.md files reference `specflow` CLI (not `speckit`)

## Scripts Verification (FR-011, FR-012)

### Scripts Renamed
- [ ] All scripts in `scripts/bash/` are named `specflow-*.sh`
- [ ] No `speckit-*.sh` files remain in `scripts/bash/`

### Script Content
- [ ] `grep -r "speckit" scripts/bash/*.sh` returns 0 results
- [ ] `grep -r "SPECKIT_" scripts/bash/*.sh` returns 0 results

### Library Files
- [ ] `scripts/bash/lib/common.sh` uses `SPECFLOW_*` constants
- [ ] `scripts/bash/lib/common.sh` uses `specflow` in function names/paths
- [ ] No `speckit` references in lib/*.sh files

## File System Paths Verification (FR-007, FR-008, FR-009)

- [ ] install.sh references `~/.claude/specflow-system/`
- [ ] install.sh references `~/.specflow/`
- [ ] `.specify/` directory name unchanged (FR-009)

## Environment Variables Verification (FR-010)

- [ ] `grep -r "SPECKIT_" scripts/` returns 0 results
- [ ] All env vars use `SPECFLOW_*` prefix

## Documentation Verification (FR-013, FR-014, FR-015, FR-016)

### Core Docs
- [ ] README.md uses SpecFlow branding
- [ ] README.md examples use `specflow` CLI
- [ ] README.md references `/flow.*` commands
- [ ] CLAUDE.md references `/flow.*` commands
- [ ] CLAUDE.md references `specflow` CLI

### Docs Directory
- [ ] `grep -r "speckit" docs/*.md` returns 0 results (case-insensitive check)

### Memory Documents
- [ ] `grep -r "speckit" .specify/memory/*.md` returns 0 results

## Clean Break Verification (FR-017, FR-018)

- [ ] No `speckit.*.md` files exist in commands/
- [ ] No deprecation stubs pointing to old commands
- [ ] No backwards compatibility shims

## Success Criteria Verification (SC-001 through SC-005)

- [ ] SC-001: `grep -rI "speckit" --include="*.sh" --include="*.md" . --exclude-dir=.specify/history --exclude-dir=.specify/archive --exclude-dir=specs` returns 0 results
- [ ] SC-002: `./bin/specflow help` displays correctly
- [ ] SC-003: All 11 /flow.* commands are loadable
- [ ] SC-004: `./install.sh --check` passes (or manual install test)
- [ ] SC-005: Repository rename documented (manual GitHub step)

## Final Verification

- [ ] All checklist items above completed
- [ ] No regressions introduced
- [ ] Ready for repository rename (Phase 7)
