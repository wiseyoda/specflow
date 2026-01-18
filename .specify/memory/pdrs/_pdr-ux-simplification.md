# PDR: SpecFlow UX Simplification

<!--
  This PDR captures the product requirements for simplifying the SpecFlow user experience
  based on comprehensive workflow analysis conducted 2026-01-11.
-->

**PDR ID**: `pdr-ux-simplification`
**Created**: 2026-01-11
**Author**: Agent (with user review)
**Status**: Implemented
**Phase**: 0050 - UX Simplification
**Priority**: P1

---

## Problem Statement

**The Problem**: SpecFlow has accumulated complexity through organic growth. Users face confusion about which commands to use, encounter orphaned/duplicate code, and navigate overlapping functionality. The cognitive load of learning the system is higher than necessary.

**Who is affected**:
- New users trying to onboard
- Existing users who forget which command does what
- Maintainers navigating duplicate code paths

**Current workaround**: Users memorize command combinations, ask for help, or avoid features they don't understand.

**Why now**: The system is feature-complete for core workflows. Before adding more features (Web UI, etc.), we should solidify the foundation and reduce complexity.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- Start any SpecFlow workflow with a single entry point (`/specflow.start`)
- Use CLI commands directly without needing slash command wrappers for simple operations
- Navigate a cleaner codebase without orphaned or duplicate scripts
- Understand memory management through a single unified command

**The experience should feel**: streamlined, predictable, discoverable

---

## User Stories

### Story 1: Single Entry Point
**As a** SpecFlow user,
**I want to** always start with `/specflow.start` and have it route me correctly,
**So that** I don't need to remember which command to use for my current situation.

**Value**: Eliminates the "which command do I run?" mental overhead.

---

### Story 2: Direct CLI for Simple Operations
**As a** developer working in my terminal,
**I want to** run `specflow issue create "bug description"` directly,
**So that** I don't need a slash command wrapper for straightforward CLI operations.

**Value**: Reduces indirection, faster execution, matches developer muscle memory.

---

### Story 3: Unified Memory Management
**As a** user managing my project's memory documents,
**I want to** use one command (`/specflow.memory`) with clear subcommands,
**So that** I don't confuse `/specflow.memory` vs `/specflow.memory-init`.

**Value**: Single mental model for all memory operations.

---

### Story 4: Clean Codebase
**As a** contributor or maintainer,
**I want to** see only active, used code in the repository,
**So that** I can understand the system without wading through orphaned scripts.

**Value**: Easier maintenance, faster onboarding for contributors.

---

### Story 5: Filesystem-Derived State
**As a** user resuming work after context loss,
**I want to** have SpecFlow figure out where I am from my files,
**So that** state corruption doesn't block my progress.

**Value**: Self-healing behavior, reduced "stuck" situations.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Entry point usage | 90%+ of sessions start with `/specflow.start` | Documentation recommends it, handoffs point to it |
| Command discoverability | User finds correct command within 1 attempt | Reduced "which command?" questions |
| Codebase cleanliness | 0 orphaned scripts | All scripts in `scripts/bash/` are used |
| Memory command clarity | Single `/specflow.memory` covers all needs | No confusion between memory commands |

---

## Constraints

- **Must**: Preserve all existing functionality (no feature removal)
- **Must**: Maintain backward compatibility (existing workflows continue to work)
- **Must**: Keep edge case handling that's already implemented
- **Should**: Complete without breaking in-progress phases
- **Must Not**: Remove the PDR system (new, intentionally kept)
- **Must Not**: Break existing state files or require migration

---

## Non-Goals

- **Not solving**: Adding new features (this is pure simplification)
- **Not solving**: Performance optimization
- **Out of scope**: Web UI changes (that's a separate phase)
- **Out of scope**: Major architectural rewrites

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Current phase completion (0042) | Informational | Should complete before major refactoring | In Progress |

---

## Open Questions

- [x] Should we remove the PDR system? → **Answer**: No, keep it (user decision)
- [ ] Should deprecated commands show warnings or be removed entirely?
- [ ] How long should backward compatibility be maintained for consolidated commands?

---

## Acceptance Criteria

### Immediate Actions (Must complete)

1. [ ] Orphaned scripts deleted from `.specify/scripts/bash/`:
   - `setup-plan.sh`
   - `update-agent-context.sh`
   - `create-new-feature.sh`
   - Duplicate `common.sh`

2. [ ] `/specflow.issue` slash command removed
   - CLI usage documented in CLAUDE.md instead
   - `specflow issue` CLI remains fully functional

3. [ ] Documentation comprehensively updated:

   **Primary Documentation**:
   - [ ] `README.md` - Recommend `/specflow.start` as THE entry point
   - [ ] `CLAUDE.md` - Update CLI reference, remove /specflow.issue mention

   **docs/ folder** (8 files):
   - [ ] `docs/cli-reference.md` - Update with current commands
   - [ ] `docs/slash-commands.md` - Recommend /specflow.start, update command list
   - [ ] `docs/integration-guide.md` - Update workflow examples
   - [ ] `docs/project-structure.md` - Verify accuracy
   - [ ] `docs/configuration.md` - Verify accuracy
   - [ ] `docs/troubleshooting.md` - Update with current diagnostics
   - [ ] `docs/templates.md` - Verify accuracy
   - [ ] `docs/COMMAND-AUDIT.md` - Update or archive if stale

   **CLI Help Text**:
   - [ ] `bin/specflow` - Update help output to recommend `/specflow.start`

   **Slash Command Handoffs** (10 commands with entry point references):
   - [ ] `commands/specflow.start.md` - Already correct (is the entry point)
   - [ ] `commands/specflow.init.md` - Add handoff to /specflow.start for "continue later"
   - [ ] `commands/specflow.orchestrate.md` - Handoffs should mention /specflow.start
   - [ ] `commands/specflow.verify.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.merge.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.backlog.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.review.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.roadmap.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.constitution.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.phase.md` - Handoffs point to /specflow.start
   - [ ] `commands/specflow.issue.md` - DELETE (replaced by CLI docs)

### Short-term Actions (Should complete)

4. [ ] Memory commands consolidated:
   - `/specflow.memory` handles verify/reconcile (current)
   - `/specflow.memory generate` handles codebase analysis (was `memory-init`)
   - `/specflow.memory-init` deprecated with pointer to new command

5. [ ] State tracking simplified:
   - Orchestration derives step completion from filesystem artifacts
   - State file tracks: current phase, blockers, user gates only
   - `specflow status --json` reports derived state

6. [ ] Entry point consolidation:
   - `/specflow.start` documented as THE way to begin
   - Handoffs from other commands point to `/specflow.start`
   - `/specflow.init` and `/specflow.orchestrate` still work but are "advanced"

### Consider Later (Nice to have)

7. [ ] Gate check consolidation (inline into orchestrate where possible)
8. [ ] Phase creation path simplification
9. [ ] Template versioning system review

---

## Related PDRs

- `pdr-ui-design-artifacts.md` - UI/UX Design Documentation (combined into Phase 0050)

---

## Notes

### Analysis Summary (2026-01-11)

**Slash Commands**: 21 total
- Essential workflow: 15 commands
- Potential consolidation: 2 commands (memory-init → memory)
- Remove wrapper: 1 command (/specflow.issue)

**CLI Commands**: 23 total
- All actively used in workflow or support functions
- No removals recommended

**Orphaned Code Found**:
- `.specify/scripts/bash/setup-plan.sh` - legacy
- `.specify/scripts/bash/update-agent-context.sh` - legacy
- `.specify/scripts/bash/create-new-feature.sh` - duplicates feature.sh
- `.specify/scripts/bash/common.sh` - duplicates lib/common.sh

### Workflow Analysis

The main workflow is sound:
```
/specflow.start → /specflow.init (or orchestrate) → specify → clarify →
plan → tasks → analyze → checklist → implement → verify → /specflow.merge
```

The complexity issues are at the edges:
- Multiple entry points causing confusion
- Slash commands that just wrap CLI commands
- Duplicate naming between memory commands
- Orphaned scripts from development history

### Risk Assessment

- **Low Risk**: Deleting orphaned scripts (not used)
- **Low Risk**: Removing /specflow.issue (CLI works directly)
- **Medium Risk**: Memory command consolidation (users may have muscle memory)
- **Low Risk**: Documentation updates (always safe)
- **Medium Risk**: State simplification (must preserve recovery capabilities)

All changes preserve functionality - this is consolidation, not removal.
