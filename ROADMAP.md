# SpecKit Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds through phases sequentially. Each phase produces a deployable increment.

**Project**: SpecKit - Spec-Driven Development Framework for Claude Code
**Created**: 2026-01-10
**Schema Version**: 2.1 (ABBC numbering)
**Status**: Active Development

---

## Phase Numbering (v2.1)

Phases use **ABBC** format:
- **A** = Milestone (0-9) - Major version or project stage
- **BB** = Phase (01-99) - Sequential work within milestone
- **C** = Hotfix (0-9) - Insert slot (0 = main phase, 1-9 = hotfixes/inserts)

**Examples**:
- `0010` = Milestone 0, Phase 01, no hotfix
- `0021` = Hotfix 1 inserted after Phase 02
- `1010` = Milestone 1, Phase 01, no hotfix

This allows inserting urgent work without renumbering existing phases.

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | Roadmap Flexibility | ✅ Complete | Insert/defer commands work |
| 0015 | Workflow Commands | ✅ In Progress | Merge and backlog commands work |
| 0020 | Onboarding Polish | ✅ Not Started | New user can set up without confusion |
| 0030 | Test Suite Completion | ⬜ Not Started | All tests pass on macOS and Linux |
| 0040 | Integration Options | ⬜ Not Started | Existing docs imported successfully |
| 0050 | Story-Based Orchestration | ⬜ Not Started | **USER GATE**: Stories execute independently |
| 1010 | Web UI Dashboard | ⬜ Not Started | **USER GATE**: Dashboard shows project status |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Milestone 0: Foundation & Polish

### 0010 - Roadmap Flexibility

**Goal**: Enable mid-roadmap changes without painful renumbering.

**Scope**:
- Implement ABBC numbering scheme (v2.1 schema)
- Add `speckit roadmap insert` command
- Add `speckit roadmap defer` command
- Add Backlog section support to ROADMAP.md
- Migration from v2.0 → v2.1 (convert 001 → 2010, etc.)
- Update roadmap template with sparse numbering

**User Stories**:
1. As a developer, I can insert a hotfix phase after user testing discovers issues
2. As a developer, I can defer low-priority phases to backlog
3. As a developer, I can migrate existing 2.0 roadmaps to 2.1 format

**Deliverables**:
- `scripts/bash/speckit-roadmap.sh` - Add insert/defer commands
- `scripts/bash/speckit-migrate.sh` - Add 2.0→2.1 roadmap migration
- `templates/roadmap-template.md` - Update with ABBC numbering
- Updated schema documentation

**Verification Gate**:
- `speckit roadmap insert --after 0020 "Urgent Fix"` creates phase 0021
- `speckit roadmap defer 0040` moves phase to Backlog
- Migration converts 001→0010, 002→0020 correctly

**Estimated Complexity**: Medium

---

### 0015 - Workflow Commands

**Goal**: Streamline end-of-phase and continuous backlog workflows.

**Scope**:
- `/speckit.merge` command: push, merge to main, cleanup branches, update state/roadmap, show backlog
- `/speckit.backlog` command: triage items into phases, analyze unassignable, create phases for remaining
- `speckit roadmap backlog add "<item>"` CLI to quickly add items
- End-of-phase backlog summary display

**User Stories**:
1. As a developer, I can complete a phase with one command that handles all git/state cleanup
2. As a developer, I can add ideas to backlog anytime and have them auto-triaged into phases
3. As a reviewer, I can see what's in the backlog after each phase completion

**Deliverables**:
- `commands/speckit.merge.md` - Slash command for phase completion
- `commands/speckit.backlog.md` - Slash command for backlog triage
- `scripts/bash/speckit-roadmap.sh` - Add `backlog add` subcommand

**Verification Gate**:
- `/speckit.merge` completes phase with single command
- `/speckit.backlog` assigns items to appropriate phases
- Backlog summary shown at end of phase

**Estimated Complexity**: Medium

---

### 0020 - Onboarding Polish

**Goal**: Make the first-run experience smooth and project-agnostic.

**Scope**:
- ~~Fix memory document templates (TypeScript-focused)~~ ✅ Done
- Multi-language templates: auto-detect project type (bash, node, python, rust, go) and customize
- Add `--safe` flag to scaffold for non-destructive mode
- ~~Improve slash command vs CLI confusion~~ ✅ Done
- Create onboarding guide in README
- Optimize CLI output for 3-line preview (user-critical info first, system details below)

**Issues Discovered (2026-01-10)**:
- ~~Constitution template assumes TypeScript projects~~ ✅ Fixed
- ~~Tech-stack template assumes Node.js/TypeScript~~ ✅ Fixed
- ~~`speckit analyze` tried as CLI command~~ ✅ Fixed
- Memory init is separate step (could be clearer in scaffold output)

**Deliverables**:
- `scripts/bash/speckit-scaffold.sh` - Add --safe mode and content detection
- `README.md` - Onboarding quickstart section
- Project type detection logic

**Verification Gate**:
- New user can run `speckit scaffold` without issues
- Templates match actual project technology
- No confusion between slash commands and CLI commands

**Estimated Complexity**: Low

---

### 0030 - Test Suite Completion

**Goal**: All CLI scripts have passing tests on macOS and Linux.

**Known Issues (from PROJECT-FINALIZATION.md)**:
- context.sh: Uses `declare -A` (bash 4.0+ only)
- feature.sh/tasks.sh: `get_repo_root` path resolution in test isolation
- claude-md.sh: macOS `head -n -1` syntax

**Scope**:
- Fix POSIX compatibility issues in scripts
- Fix test isolation issues
- Add missing test coverage
- Set up CI for cross-platform testing

**Deliverables**:
- All `tests/test-*.sh` files passing
- CI workflow in `.github/workflows/test.yml`
- POSIX-compliant scripts

**Verification Gate**:
- `./tests/test-runner.sh` passes all tests
- Tests pass on both macOS and Linux

**Estimated Complexity**: Medium

---

### 0040 - Integration Options

**Goal**: Support projects with existing documentation.

**Scope**:
- Import existing ADRs to `.specify/memory/adrs/`
- Reference existing architecture documents
- Link to existing API documentation
- Detect and offer integration for README, CONTRIBUTING, etc.

**Deliverables**:
- `speckit detect --docs` enhancement
- `speckit import adrs <path>` command
- Integration guide in docs

**Verification Gate**:
- Existing project docs are detected and integrated
- No loss of existing documentation

**Estimated Complexity**: Medium

---

### 0050 - Story-Based Orchestration

**Goal**: Execute user stories independently with MVP checkpoints.

**Scope**:
- Update orchestrate.md to support story-based flow
- Add `speckit tasks next-story` command
- Parallel story execution where dependencies allow
- MVP checkpoints between stories
- Story reordering within phases

**Deliverables**:
- Updated `commands/speckit.orchestrate.md`
- Updated `scripts/bash/speckit-tasks.sh`
- Story dependency tracking

**Verification Gate**: **USER VERIFICATION REQUIRED**
- User can execute stories independently
- Skipping stories doesn't break workflow
- MVP is validated at each story boundary

**Estimated Complexity**: High

---

---

## Milestone 1: Extended Features

### 1010 - Web UI Dashboard

**Goal**: Visual dashboard for multi-project monitoring.

**Scope**:
- React/Next.js dashboard UI
- REST API for project management
- WebSocket for real-time updates
- File watcher for state changes

**Deliverables**:
- `packages/dashboard/` - Dashboard UI
- `packages/api/` - REST + WebSocket server
- Integration with central registry

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Dashboard shows all registered projects
- Real-time status updates work
- Action buttons trigger workflows

**Estimated Complexity**: Very High (new codebase)

---

## Backlog

> All deferred scope and new ideas live here. Reviewed at end of each phase.
> Run `/speckit.backlog` to triage items into future phases.

| Item | Description | Priority | Notes |
|------|-------------|----------|-------|
| Test item | Added 2026-01-10 | - | |
| Parallel phase execution | Run independent phases concurrently | Low | Requires dependency graph |
| Team collaboration | Multi-user roadmap editing, conflict resolution | Low | Future vision |

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 0050 | Stories execute independently, MVPs are validated |
| **Gate 2** | 1010 | Dashboard shows projects, real-time updates work |

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Document deferred items in Backlog section above
3. Create a hotfix phase (e.g., 2021) for critical items
4. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNNN - [Phase Name]"
```

### Inserting Urgent Work
```bash
speckit roadmap insert --after 0020 "Urgent Bug Fixes"
# Creates phase 0021
```

### Deferring Work
```bash
speckit roadmap defer 0040 --reason "Deprioritized after user testing"
# Moves to Backlog section
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

---

## Migration Notes

### v2.0 → v2.1 Migration
Existing roadmaps with 001/002/003 numbering should be migrated:
```bash
speckit migrate roadmap
```

Conversion: `0AB` → `00A0` (milestone 0 by default)
- 001 → 0010
- 002 → 0020
- 003 → 0030

Branch names remain unchanged (branches use short names, not phase numbers).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-10 | Initial roadmap (v2.0, 001-005 numbering) |
| 2026-01-10 | Migrated to v2.1 ABBC numbering, added Phase 0010 (Roadmap Flexibility) |
| 2026-01-10 | Backlog triage: created 0015 (Workflow Commands), promoted items to 0020 |
