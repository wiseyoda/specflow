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
| 0015 | Workflow Commands | ✅ Complete | Merge and backlog commands work |
| 0020 | Onboarding Polish | ✅ Complete | New user can set up without confusion |
| 0030 | Test Suite Completion | ✅ Complete | All tests pass on macOS and Linux |
| 0040 | Integration Options | ✅ Complete | Existing docs imported successfully |
| 0041 | Code Review Findings | ✅ Complete | All review findings addressed |
| 0042 | Code Review 2026-01-11 | 🔄 Not Started | 18 findings addressed |
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

### 0041 - Code Review Findings

**Goal**: Address code quality findings from systematic review (2026-01-11).

**Scope**:
- 36 approved findings across 7 categories
- Best Practices (6): Error handling, strict mode, code hygiene
- Refactoring (7): Extract large functions, reduce complexity
- Hardening (4): Input validation, cleanup traps, dependency checks
- Missing Features (3): Multi-runner gate support, backlog priorities
- Orphaned Code (4): Remove legacy scripts, fix stale references
- Over-Engineering (4): Simplify roadmap/state file complexity
- Outdated Docs (8): Fix placeholders, update references

**Review Document**: `.specify/reviews/review-20260111.md`

**User Stories**:
1. As a developer, I can trust the codebase follows best practices consistently
2. As a maintainer, I can navigate simplified, well-factored code
3. As a user, I find documentation that matches actual implementation

**Deliverables**:
- Fixed scripts in `scripts/bash/` (BP, RF, HD findings)
- Deleted legacy `check-prerequisites.sh`
- Updated documentation (README.md, CLAUDE.md, speckit.specify.md)
- Refactored `speckit-state.sh` and `speckit-roadmap.sh`
- Extended `speckit-gate.sh` with multi-runner support

**Verification Gate**:
- All 36 findings addressed or explicitly re-deferred with rationale
- No regressions in existing tests
- shellcheck passes on all modified scripts

**Estimated Complexity**: High (36 findings, multiple refactors)

---

### 0042 - Code Review 2026-01-11

**Goal**: Address code quality findings from systematic review.

**Scope**:
- 18 approved findings across 6 categories
- Best Practices (5): POSIX compliance, 4-digit phase consistency
- Refactoring (2): Doctor check abstraction, common.sh cleanup
- Hardening (3): Test runner error handling, temp file traps, ADR validation
- Missing Features (3): Gate/lessons dispatcher, memory doc context
- Orphaned Code (2): Remove no-op variable, clarify scripts structure
- Outdated Docs (3): README/CLAUDE.md updates

**Review Document**: `.specify/reviews/review-20260111.md`

**User Stories**:
1. As a developer, I can use POSIX-compliant scripts across bash versions
2. As a user, I see consistent 4-digit phase numbers everywhere
3. As a contributor, I find documentation that matches implementation

**Deliverables**:
- POSIX compatibility fixes (remove `declare -a`, `declare -A`)
- 4-digit phase number consistency in feature.sh, bin/speckit
- Gate and lessons commands in dispatcher
- Updated README.md and CLAUDE.md
- Temp file trap handlers where missing

**Verification Gate**:
- All 18 findings addressed
- No regressions in existing tests
- shellcheck passes on modified scripts

**Estimated Complexity**: Medium (18 findings)

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
| Story-Based Orchestration | Execute user stories independently with MVP checkpoints | Medium | Deferred from Phase 0050 - current workflow works well |
| Parallel phase execution | Run independent phases concurrently | Low | Requires dependency graph |
| Team collaboration | Multi-user roadmap editing, conflict resolution | Low | Future vision |
| [RF001] Refactor speckit-roadmap.sh | Large file (1425 lines) - extract subcommands | Low | Deferred from review 2026-01-11 |
| [RF002] Extract scaffold templates | Move inline templates to separate files | Low | Deferred from review 2026-01-11 |
| [OE001] Scaffold type templates | Simplify project-type-specific templates | Low | Deferred from review 2026-01-11 |
| [OE002] Manifest versioning | Consider simplifying manifest complexity | Low | Deferred from review 2026-01-11 |

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 1010 | Dashboard shows projects, real-time updates work |

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
| 2026-01-11 | Added Phase 0041 (Code Review Findings) - 36 findings from /speckit.review |
| 2026-01-11 | Added Phase 0042 (Code Review 2026-01-11) - 18 findings from /speckit.review |
| 2026-01-11 | Added modular ROADMAP: speckit phase, speckit issue, speckit roadmap renumber, /speckit.merge auto-archive |
