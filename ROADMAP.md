# SpecKit Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds sequentially through phases. Each phase produces a deployable increment.

**Project**: SpecKit - Spec-Driven Development Framework for Claude Code
**Created**: 2026-01-10
**Status**: Active Development (v2.0 complete, polishing)

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 001 | Onboarding Polish | ⬜ Not Started | New user can set up without confusion |
| 002 | Test Suite Completion | ⬜ Not Started | All tests pass on macOS and Linux |
| 003 | Integration Options | ⬜ Not Started | Existing docs imported successfully |
| 004 | Story-Based Orchestration | ⬜ Not Started | **USER GATE**: Stories execute independently |
| 005 | Web UI Dashboard | ⬜ Not Started | **USER GATE**: Dashboard shows project status |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Polish Phases (001-003)

### 001 - Onboarding Polish

**Goal**: Make the first-run experience smooth and project-agnostic.

**Scope**:
- Fix memory document templates (currently TypeScript-focused, should be generic)
- Add project type detection to customize templates (bash, node, python, etc.)
- Add `--safe` flag to scaffold for non-destructive mode
- Improve slash command vs CLI confusion (better error messages done, need docs)
- Create onboarding guide in README

**Issues Discovered (2026-01-10)**:
- Constitution template assumes TypeScript projects
- Tech-stack template assumes Node.js/TypeScript
- `speckit analyze` tried as CLI command (slash command confusion)
- Memory init is separate step (could be clearer in scaffold output)

**Deliverables**:
- `templates/constitution-template.md` - Generic, with tech-specific variants
- `templates/tech-stack-template.md` - Generic, auto-detect framework
- `scripts/bash/speckit-scaffold.sh` - Add --safe mode and content detection
- `README.md` - Onboarding quickstart section

**Verification Gate**:
- New user can run `speckit scaffold` without issues
- Templates match actual project technology
- No confusion between slash commands and CLI commands

**Estimated Complexity**: Low (mostly documentation and template updates)

---

### 002 - Test Suite Completion

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

**Estimated Complexity**: Medium (debugging POSIX issues, CI setup)

---

### 003 - Integration Options

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

## Future Phases (004-005)

### 004 - Story-Based Orchestration

**Goal**: Execute user stories independently with MVP checkpoints.

**Scope**:
- Update orchestrate.md to support story-based flow
- Add `speckit tasks next-story` command
- Parallel story execution where dependencies allow
- MVP checkpoints between stories

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

### 005 - Web UI Dashboard

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

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 004 | Stories execute independently, MVPs are validated |
| **Gate 2** | 005 | Dashboard shows projects, real-time updates work |

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Document deferred items in `specs/[phase]/checklists/deferred.md`
3. Update next phase's section with "Deferred from Previous Phases"
4. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

---

## Notes

- v2.0 core functionality is complete (see PROJECT-FINALIZATION.md)
- All P0 and P1 items are resolved
- Remaining work is P2 (polish) and P3 (future vision)
- Web UI requires central registry (already implemented in v2.0)
