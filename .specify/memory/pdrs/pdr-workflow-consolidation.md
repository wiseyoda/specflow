# PDR: Workflow Commands Consolidation

<!--
  IMPORTANT: This document captures PRODUCT requirements, not TECHNICAL requirements.
  Focus on WHAT the feature should do and WHY it matters.
  Do NOT include: architecture, code structure, implementation details, or technology choices.
-->

**PDR ID**: `pdr-workflow-consolidation`
**Created**: 2026-01-17
**Author**: Agent (with user input)
**Status**: Approved
**Priority**: P1

---

## Problem Statement

**The Problem**: SpecFlow has 11 main workflow commands that are fragmented and confusing. The orchestrate command runs 8 separate sub-commands, many of which produce single artifacts and could be combined. Users see a long list of commands without understanding how they relate, and the separation between "document creation" and "execution" phases is unclear.

**Who is affected**: All SpecFlow users running the development workflow.

**Current workaround**: Users rely on `/specflow.orchestrate` to run everything, but when debugging or re-running steps, they face 11 separate commands with unclear relationships.

**Why now**: After consolidating pre-workflow commands (7 → 3), the workflow commands are the next logical target. A clean, intuitive command structure is essential before building dashboard integration.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- Understand the workflow as clear phases: design → check → implement → verify → merge
- Run a single `design` command that produces all planning artifacts
- See clarifying questions inline during orchestration (no separate clarify step)
- Manage backlog items through roadmap utilities (not a separate command)

**The experience should feel**: Linear, predictable, and phase-oriented

---

## User Stories

### Story 1: Single Design Command
**As a** developer starting a new feature,
**I want to** run one command that creates all my design artifacts,
**So that** I don't have to remember which commands produce which files.

**Value**: Reduces cognitive load, eliminates command sequencing confusion.

---

### Story 2: Inline Clarification
**As a** developer writing specifications,
**I want** Claude to ask clarifying questions as it works,
**So that** I don't have to run a separate "clarify" step and can answer questions in context.

**Value**: More natural conversation flow, fewer workflow interruptions.

---

### Story 3: Clear Pre/Post Verification
**As a** developer implementing features,
**I want to** know that my design is aligned BEFORE I start coding,
**So that** I don't discover spec/plan mismatches mid-implementation.

**Value**: Catches design issues early, reduces rework.

---

### Story 4: Backlog as Roadmap Utility
**As a** developer with deferred items,
**I want to** manage backlog through roadmap commands,
**So that** backlog management is clearly part of roadmap planning, not a separate workflow.

**Value**: Logical command grouping, backlog integrated into planning.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Command reduction | 11 → 6 commands | Count of workflow commands |
| Design artifacts | Single command produces spec, plan, tasks, checklists | End-to-end test |
| Clarify removal | No separate clarify command | Command inventory |
| Backlog integration | Available via `/specflow.roadmap backlog` | Command help output |
| Workflow clarity | 5 clear phases in orchestrate | Documentation review |

---

## Constraints

- **Must**: Preserve all existing functionality (reorganize, don't remove capabilities)
- **Must**: Maintain backwards compatibility for users with existing scripts
- **Should**: Provide deprecation notices for absorbed commands
- **Should**: Update all documentation to reflect new structure
- **Must Not**: Break existing projects mid-workflow

---

## Non-Goals

- **Not solving**: Pre-workflow commands (handled by `pdr-preworkflow-consolidation`)
- **Not solving**: Dashboard integration (separate PDR)
- **Out of scope**: Adding new functionality beyond consolidation
- **Out of scope**: CLI implementation changes (bash scripts)

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Pre-workflow consolidation | Sequencing | Should complete first for clean command namespace | In Progress |
| Existing command implementations | Informational | Need to understand current logic to merge | Known - Available |
| Documentation updates | Follow-up | Docs must be updated after consolidation | Planned |

---

## Open Questions

- [x] Should `design` create artifacts sequentially or in parallel where possible? → **Answer**: Sequentially. Each artifact builds on the previous.
- [x] What happens if user wants to regenerate just one artifact (e.g., just tasks.md)? → **Answer**: Natural language with intent (e.g., `/specflow.design rework tasks to change the order`) or flags like `--plan` to focus on specific artifacts.
- [x] Should `analyze` be renamed to `review` for clarity? → **Answer**: No. `/specflow.review` already exists as code review command. Would need to rename that to `/specflow.codereview` first.
- [x] How does inline clarify interact with `--no-discovery` flag? → **Answer**: Simplify all commands and audit flags. Remove unused flags as part of this consolidation.

---

## Acceptance Criteria

1. [ ] `/specflow.design` creates: spec.md, plan.md, tasks.md, and checklists in sequence
2. [ ] `/specflow.orchestrate` asks clarifying questions inline (no separate clarify step)
3. [ ] `/specflow.clarify` shows deprecation notice, explains it's now inline in orchestrate
4. [ ] `/specflow.specify` shows deprecation notice, suggests using `/specflow.design`
5. [ ] `/specflow.plan` shows deprecation notice, suggests using `/specflow.design`
6. [ ] `/specflow.tasks` shows deprecation notice, suggests using `/specflow.design`
7. [ ] `/specflow.checklist` shows deprecation notice, suggests using `/specflow.design`
8. [ ] `/specflow.backlog` shows deprecation notice, suggests using `/specflow.roadmap backlog`
9. [ ] `/specflow.roadmap` gains `backlog` subcommand (absorbs backlog functionality)
10. [ ] `/specflow.analyze` remains as pre-implement alignment check
11. [ ] `/specflow.implement` remains as task execution
12. [ ] `/specflow.verify` remains as post-implement completion check
13. [ ] `/specflow.merge` remains as git operations
14. [ ] All documentation updated to reflect new command structure
15. [ ] Existing projects continue to work without changes

---

## Related PDRs

- `pdr-preworkflow-consolidation` - Pre-workflow command consolidation (should complete first)
- `pdr-orchestration-engine` - Dashboard workflow execution (depends on clean command structure)

---

## Command Mapping

### Before (11 workflow commands)

| Command | Role | Produces |
|---------|------|----------|
| `/specflow.orchestrate` | Master controller | Runs all steps |
| `/specflow.specify` | Create spec | spec.md |
| `/specflow.clarify` | Ask questions | Updates spec.md |
| `/specflow.plan` | Create plan | plan.md, research.md, data-model.md, contracts/ |
| `/specflow.tasks` | Create tasks | tasks.md |
| `/specflow.analyze` | Check alignment | Analysis report |
| `/specflow.checklist` | Create checklists | checklists/*.md |
| `/specflow.implement` | Execute tasks | Code changes |
| `/specflow.verify` | Check completion | Verification report |
| `/specflow.merge` | Git operations | PR, merge, archive |
| `/specflow.backlog` | Manage backlog | Roadmap updates |

### After (6 workflow commands)

| Command | Role | Produces |
|---------|------|----------|
| `/specflow.orchestrate` | Master controller (with inline clarify) | Runs all phases |
| `/specflow.design` | Create all design artifacts | spec.md, plan.md, tasks.md, checklists/ |
| `/specflow.analyze` | Pre-implement alignment check | Analysis report |
| `/specflow.implement` | Execute tasks | Code changes |
| `/specflow.verify` | Post-implement completion check | Verification report |
| `/specflow.merge` | Git operations | PR, merge, archive |

### Deprecated (5 commands)

| Command | Replacement | Action |
|---------|-------------|--------|
| `/specflow.specify` | `/specflow.design` | Stub with deprecation notice |
| `/specflow.clarify` | Inline in orchestrate | Stub with deprecation notice |
| `/specflow.plan` | `/specflow.design` | Stub with deprecation notice |
| `/specflow.tasks` | `/specflow.design` | Stub with deprecation notice |
| `/specflow.checklist` | `/specflow.design` | Stub with deprecation notice |

### Moved (1 command)

| Command | New Location | Action |
|---------|--------------|--------|
| `/specflow.backlog` | `/specflow.roadmap backlog` | Stub with deprecation notice |

### Removed (1 command)

| Command | Reason | Action |
|---------|--------|--------|
| `/specflow.taskstoissues` | Rarely used, GitHub-specific utility | Delete completely |

---

## Workflow Phases

After consolidation, the orchestrate workflow becomes 5 clear phases:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: DESIGN                                                 │
├─────────────────────────────────────────────────────────────────┤
│  /specflow.design                                                 │
│  Creates: spec.md → plan.md → tasks.md → checklists/            │
│  Inline: Asks clarifying questions as needed                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: ANALYZE (Pre-Implement Gate)                          │
├─────────────────────────────────────────────────────────────────┤
│  /specflow.analyze                                                │
│  Checks: spec ↔ plan ↔ tasks alignment                          │
│  Output: Analysis report, blocks if issues found                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: IMPLEMENT                                              │
├─────────────────────────────────────────────────────────────────┤
│  /specflow.implement                                              │
│  Executes: All tasks from tasks.md in dependency order          │
│  Output: Code changes, task completion marks                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: VERIFY (Post-Implement Gate)                          │
├─────────────────────────────────────────────────────────────────┤
│  /specflow.verify                                                 │
│  Checks: Task completion, checklist verification, compliance    │
│  Output: Verification report, USER GATE assessment              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: MERGE                                                  │
├─────────────────────────────────────────────────────────────────┤
│  /specflow.merge                                                  │
│  Actions: Push, PR, merge, archive, handoff extraction          │
│  Output: Merged to main, phase archived                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Command Flow

The new `/specflow.design` command produces all artifacts in sequence:

```
/specflow.design
    │
    ├─1. Load Context
    │   └── memory docs, handoffs, codebase patterns
    │
    ├─2. Create spec.md
    │   ├── Generate from description/discovery
    │   ├── [INLINE] Ask clarifying questions if ambiguous
    │   └── Update spec.md with answers
    │
    ├─3. Create plan.md
    │   ├── Technical implementation approach
    │   └── Optional: research.md, data-model.md, contracts/
    │
    ├─4. Create tasks.md
    │   ├── Actionable task list
    │   └── Dependency ordering
    │
    └─5. Create checklists/
        ├── requirements.md (from spec)
        └── verification.md (testable items)

→ All design artifacts ready for analyze
```

---

## Notes

### Regeneration Strategy

If users need to regenerate a single artifact:
- **Option A**: Flags on design command (`/specflow.design --only=tasks`)
- **Option B**: Keep individual commands but mark as "advanced" in docs
- **Decision**: TBD in implementation

### Inline Clarify Behavior

When orchestrate encounters ambiguity:
1. Pause workflow
2. Ask up to 5 targeted questions via `AskUserQuestion`
3. Update relevant artifact with answers
4. Resume workflow

This replaces the explicit `/specflow.clarify` step with organic questioning.

### Backlog in Roadmap

The `/specflow.roadmap backlog` subcommand will:
- Scan completed phases for deferred items
- Parse backlog items from ROADMAP.md
- Interactively or automatically triage into phases
- Create new phases if needed

This aligns backlog management with roadmap planning where it belongs.

