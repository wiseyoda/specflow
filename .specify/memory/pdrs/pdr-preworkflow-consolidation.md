# PDR: Pre-Workflow Commands Consolidation

<!--
  IMPORTANT: This document captures PRODUCT requirements, not TECHNICAL requirements.
  Focus on WHAT the feature should do and WHY it matters.
  Do NOT include: architecture, code structure, implementation details, or technology choices.
-->

**PDR ID**: `pdr-preworkflow-consolidation`
**Created**: 2026-01-17
**Author**: Agent (with user input)
**Status**: Approved
**Priority**: P1

---

## Problem Statement

**The Problem**: SpecKit has 7 pre-workflow commands that are confusing, overlapping, and rarely used after initial project setup. Users struggle to understand which command to run and when. Several commands duplicate functionality, and the separation between one-time setup vs. ongoing maintenance is unclear.

**Who is affected**: All SpecKit users, especially new users trying to understand the command structure.

**Current workaround**: Users learn through trial and error which commands to run. Many commands are effectively unused (e.g., `/speckit.start` duplicates orchestrate, `/speckit.constitution` is just a subset of memory).

**Why now**: Before building more dashboard integration and workflow decomposition, we need a clean, understandable command structure. Technical debt in the command layer will compound as we build UI on top of it.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- Set up a new project with a single command (`/speckit.init`)
- Understand clearly which commands are one-time setup vs. ongoing utilities
- Run health checks on memory documents with a focused utility command
- Manage roadmap operations (including PDR conversion) in one place

**The experience should feel**: Simple, obvious, and low-friction

---

## User Stories

### Story 1: One-Command Project Setup
**As a** developer starting a new SpecKit project,
**I want to** run one command that handles all initial setup,
**So that** I don't have to remember a sequence of 4-5 commands or wonder what order to run them.

**Value**: Reduces friction for new projects, eliminates confusion about command ordering.

---

### Story 2: Clear Maintenance Commands
**As a** developer maintaining an existing SpecKit project,
**I want to** know exactly which commands are for ongoing maintenance vs. initial setup,
**So that** I only run what's needed and don't accidentally re-run setup commands.

**Value**: Prevents accidental overwrites and clarifies command purpose.

---

### Story 3: Memory Health Checks
**As a** developer whose project has evolved,
**I want to** verify my memory documents are still accurate and fix drift,
**So that** Claude's context about my project stays current.

**Value**: Keeps AI context fresh without manual document auditing.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Command reduction | 7 → 3 commands | Count of pre-workflow commands |
| New project setup | Single command covers all setup | End-to-end test: new project → ready for orchestrate |
| Clear categorization | Commands clearly labeled as setup vs. utility | Documentation review |
| No functionality loss | All existing capabilities preserved | Feature parity checklist |

---

## Constraints

- **Must**: Preserve all existing functionality (just reorganize, don't remove capabilities)
- **Must**: Maintain backwards compatibility for users with existing scripts/workflows
- **Should**: Provide deprecation notices for removed commands
- **Should**: Update all documentation to reflect new structure
- **Must Not**: Break existing projects mid-workflow

---

## Non-Goals

- **Not solving**: Main workflow commands (orchestrate, merge, etc.) - those are separate
- **Not solving**: Dashboard integration - that's handled by other PDRs
- **Out of scope**: Adding new functionality beyond consolidation
- **Out of scope**: CLI implementation changes (bash scripts) - just the Claude commands

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Existing command implementations | Informational | Need to understand current logic to merge | Known - Available |
| Documentation updates | Follow-up | Docs must be updated after consolidation | Planned |

---

## Open Questions

- [x] Should `/speckit.phase` be absorbed into roadmap or kept separate? → **Answer**: Absorb into `/speckit.roadmap` as a subcommand. Phase is really about PDR→roadmap conversion, which is a roadmap operation.
- [x] What happens to `promote` and `clean` from memory command? → **Answer**: Keep `promote` (useful for surfacing decisions from completed specs). Remove `clean` (rarely used, can be done manually).
- [x] How to handle backwards compatibility for deleted commands? → **Answer**: Keep stub commands that show deprecation notice and redirect to new command.

---

## Acceptance Criteria

1. [ ] `/speckit.init` runs complete setup: interview → constitution → memory docs → roadmap
2. [ ] `/speckit.start` shows deprecation notice, suggests using `/speckit.orchestrate`
3. [ ] `/speckit.constitution` shows deprecation notice, suggests using `/speckit.init`
4. [ ] `/speckit.memory-init` deleted (already deprecated)
5. [ ] `/speckit.memory` reduced to: verify, reconcile, promote (no generate)
6. [ ] `/speckit.phase` shows deprecation notice, suggests using `/speckit.roadmap add-pdr`
7. [ ] `/speckit.roadmap` gains `add-pdr` subcommand (absorbs phase functionality)
8. [ ] All documentation updated to reflect new command structure
9. [ ] Existing projects continue to work without changes

---

## Related PDRs

- `pdr-orchestration-engine` - Dashboard workflow execution (depends on clean command structure)

---

## Command Mapping

### Before (7 commands)

| Command | Role | Frequency |
|---------|------|-----------|
| `/speckit.start` | Smart router | One-time |
| `/speckit.init` | Discovery interview | One-time |
| `/speckit.constitution` | Create constitution | One-time |
| `/speckit.memory` | Memory docs lifecycle | Mixed |
| `/speckit.memory-init` | Generate memory docs | One-time |
| `/speckit.roadmap` | Create/update roadmap | One-time |
| `/speckit.phase` | PDR → roadmap | Ad hoc |

### After (3 commands)

| Command | Role | Frequency |
|---------|------|-----------|
| `/speckit.init` | Complete project setup (interview → constitution → memory → roadmap) | One-time |
| `/speckit.memory` | Health checks: verify, reconcile, promote | Ad hoc utility |
| `/speckit.roadmap` | Roadmap ops: update, add-pdr, renumber | Ad hoc utility |

### Deprecated (4 commands)

| Command | Replacement | Action |
|---------|-------------|--------|
| `/speckit.start` | `/speckit.orchestrate` | Stub with deprecation notice |
| `/speckit.constitution` | `/speckit.init` | Stub with deprecation notice |
| `/speckit.memory-init` | `/speckit.memory generate` | Delete (already deprecated) |
| `/speckit.phase` | `/speckit.roadmap add-pdr` | Stub with deprecation notice |

---

## Notes

### Workflow Separation

After consolidation, commands fall into clear categories:

**One-Time Setup**:
- `/speckit.init` - Run once per project, never again

**Main Workflow (every phase)**:
- `/speckit.orchestrate` - Development workflow
- `/speckit.merge` - Phase completion

**Utilities (as needed)**:
- `/speckit.memory verify` - Check memory doc health
- `/speckit.memory reconcile` - Fix drift
- `/speckit.memory promote` - Surface decisions from completed specs
- `/speckit.roadmap update` - Modify roadmap
- `/speckit.roadmap add-pdr` - Convert PDRs to phases

### Init Flow

The consolidated `/speckit.init` command will run this sequence:

```
1. Discovery Interview (12 phases)
   └── Creates .specify/discovery/ artifacts

2. Constitution Generation
   └── Creates .specify/memory/constitution.md

3. Memory Document Generation
   └── Creates tech-stack.md, patterns.md, etc.

4. Initial Roadmap Creation
   └── Creates ROADMAP.md with first phases

→ Project ready for /speckit.orchestrate
```

Each step builds on the previous, and the user only runs one command.
