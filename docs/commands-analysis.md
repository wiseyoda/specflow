# SpecFlow Commands Analysis

> **Purpose**: Comprehensive analysis of all Claude Code slash commands for cleanup planning.
> **Created**: 2026-01-17
> **Status**: Active reference document

---

## Overview

SpecFlow has **10 active Claude Code commands** (plus 9 deprecated stubs) that guide the spec-driven development workflow. This document catalogs each command with complexity scores, line counts, and improvement notes.

> **v2.3 Update**: Workflow commands consolidated from 9 steps to 4 steps. New `/specflow.design` command replaces specify, clarify, plan, tasks, and checklist. Backlog moved to `/specflow.roadmap backlog` subcommand. See [Main Workflow Commands](#main-workflow-commands-orchestrate-steps) for details.

### Complexity Scale (1-10)

| Score | Description |
|-------|-------------|
| 1-2 | Simple, single purpose, minimal logic |
| 3-4 | Moderate complexity, some branching |
| 5-6 | Complex, multiple steps, significant logic |
| 7-8 | Very complex, many dependencies, extensive error handling |
| 9-10 | Extremely complex, orchestrates other commands |

---

## Command Inventory

### Pre-Workflow Commands (Project Setup)

**Active Commands (3):**

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 1 | `/specflow.init` | 7/10 | ~600 | `commands/specflow.init.md` |
| 2 | `/specflow.memory` | 7/10 | ~750 | `commands/specflow.memory.md` |
| 3 | `/specflow.roadmap` | 6/10 | ~650 | `commands/specflow.roadmap.md` |

**Deprecated Commands (3 stubs, ~30-50 lines each):**

| # | Command | Replacement | File |
|---|---------|-------------|------|
| D1 | `/specflow.start` | `/specflow.orchestrate` | `commands/specflow.start.md` |
| D2 | `/specflow.constitution` | `/specflow.init` | `commands/specflow.constitution.md` |
| D3 | `/specflow.phase` | `/specflow.roadmap add-pdr` | `commands/specflow.phase.md` |

**Deleted (1):**
- `/specflow.memory-init` - Merged into `/specflow.init`

> **Note**: See also [Main Workflow Deprecated Commands](#main-workflow-deprecated-commands) for 6 additional deprecated stubs added in v2.3.

### Main Workflow Commands (Orchestrate Steps)

**Active Commands (5):**

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 4 | `/specflow.orchestrate` | 9/10 | ~600 | `commands/specflow.orchestrate.md` |
| 5 | `/specflow.design` | 8/10 | ~400 | `commands/specflow.design.md` |
| 6 | `/specflow.analyze` | 4/10 | ~185 | `commands/specflow.analyze.md` |
| 7 | `/specflow.implement` | 6/10 | ~300 | `commands/specflow.implement.md` |
| 8 | `/specflow.verify` | 6/10 | ~605 | `commands/specflow.verify.md` |

> **v2.3 Workflow**: 4-step flow: design → analyze → implement → verify

### Main Workflow Deprecated Commands

**Deprecated Commands (6 stubs, ~30-50 lines each):**

| # | Command | Replacement | File |
|---|---------|-------------|------|
| D4 | `/specflow.specify` | `/specflow.design` | `commands/specflow.specify.md` |
| D5 | `/specflow.clarify` | `/specflow.design` | `commands/specflow.clarify.md` |
| D6 | `/specflow.plan` | `/specflow.design --plan` | `commands/specflow.plan.md` |
| D7 | `/specflow.tasks` | `/specflow.design --tasks` | `commands/specflow.tasks.md` |
| D8 | `/specflow.checklist` | `/specflow.design --checklist` | `commands/specflow.checklist.md` |
| D9 | `/specflow.backlog` | `/specflow.roadmap backlog` | `commands/specflow.backlog.md` |

### Post-Workflow Commands

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 9 | `/specflow.merge` | 6/10 | ~575 | `commands/specflow.merge.md` |

> **Note**: `/specflow.backlog` has been deprecated. Use `/specflow.roadmap backlog` instead.

### Supplementary Commands

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 10 | `/specflow.review` | 6/10 | ~460 | `commands/specflow.review.md` |

### Utility Commands (Non-numbered)

| Command | Complexity | Lines | File |
|---------|:----------:|:-----:|------|
| `/specflow.taskstoissues` | 2/10 | ~30 | `commands/utilities/specflow.taskstoissues.md` |

---

## Workflow Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PRE-WORKFLOW (Project Setup) - 3 Active Commands                │
├─────────────────────────────────────────────────────────────────┤
│  init → memory → roadmap                                         │
│    │                  │                                          │
│    └─ Full 4-step:    ├─ Optional: add-pdr (convert PDRs)       │
│       discovery →     └─ Optional: backlog (triage items)       │
│       constitution →                                             │
│       memory → roadmap                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  MAIN WORKFLOW (orchestrate controls these) - 4 Steps            │
├─────────────────────────────────────────────────────────────────┤
│  design → analyze → implement → verify                           │
│    │                                                             │
│    └─ /specflow.design produces: discovery.md, spec.md,          │
│       requirements.md, plan.md, tasks.md, checklists/           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST-WORKFLOW                                                   │
├─────────────────────────────────────────────────────────────────┤
│  merge                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Command Descriptions

### 1. `/specflow.init` (Complexity: 7/10)

**Purpose**: One-command project setup with full initialization flow.

**What it does**:
- **Step 1: Discovery** - Runs progressive discovery interview
- **Step 2: Constitution** - Generates constitution from decisions
- **Step 3: Memory Docs** - Creates tech-stack.md, coding-standards.md, etc.
- **Step 4: Roadmap** - Creates ROADMAP.md with initial phases
- Smart completion detection (skips completed steps)
- Pre-flight check to abort if orchestration in progress
- `--force` flag to regenerate all artifacts

**Dependencies**: None (creates initial state)

**Notes**:
- Expanded in v2.2 to include constitution, memory, and roadmap generation
- Absorbed functionality from deprecated `/specflow.constitution`, `/specflow.memory-init`
- Uses placeholder detection for smart idempotency

---

### 2. `/specflow.memory` (Complexity: 7/10)

**Purpose**: Memory document lifecycle management (verification, reconciliation, promotion).

**What it does**:
- **Verify**: Check document quality, structure, constitution compliance
- **Reconcile**: Detect drift against ROADMAP.md and codebase
- **Promote**: Surface decisions from completed specs to memory
- **Clean**: Find/archive errant markdown files

**Dependencies**:
- `.specify/memory/constitution.md` (required)
- ROADMAP.md (for reconciliation)
- `package.json` / codebase (for drift detection)

**Flags**: `--dry-run`, `--verbose`, `--fix`, `--reconcile`, `--no-reconcile`, `--promote`, `--deep`

**Notes**:
- `generate` subcommand removed in v2.2 (use `/specflow.init` instead)
- Focused on verification and reconciliation only

---

### 3. `/specflow.roadmap` (Complexity: 6/10)

**Purpose**: Creates/updates ROADMAP.md with logical phases and verification gates.

**What it does**:
- Loads discovery/memory context
- Determines project scope and phases
- Applies "prove core first" principle
- Sizes phases for agentic sessions (~200k tokens)
- Defines USER GATES at checkpoints
- Creates phase detail files in `.specify/phases/`
- **add-pdr subcommand**: Converts PDRs to ROADMAP phases

**Subcommands**:
- `(empty)`: Create/update full roadmap
- `add-pdr`: List PDRs and convert to phases
- `add-pdr pdr-name.md`: Convert specific PDR

**Dependencies**:
- Optional: `.specify/discovery/`, `.specify/memory/`
- PDRs: `.specify/memory/pdrs/` (for add-pdr)
- CLI: `specflow roadmap`, `specflow pdr` commands

**Notes**:
- Expanded in v2.2 to include `add-pdr` subcommand
- Absorbed functionality from deprecated `/specflow.phase`

---

### 4. `/specflow.orchestrate` (Complexity: 9/10)

**Purpose**: Master orchestrator for the complete development workflow.

**What it does**:
- 4-step workflow: design → analyze → implement → verify
- State persistence in `.specify/orchestration-state.json`
- Self-healing (resume from any step)
- Error recovery with user prompts
- Step skipping with `--skip-to`
- State migration for old 9-step indices

**Dependencies**:
- `/specflow.design`, `/specflow.analyze`, `/specflow.implement`, `/specflow.verify`
- CLI: `specflow state`, `specflow context`, `specflow roadmap`
- ROADMAP.md

**Notes**:
- Simplified in v2.3 from 9 steps to 4
- Central state machine
- State migration handles legacy indices (0-8 → 0-3)

---

### 5. `/specflow.design` (Complexity: 8/10)

**Purpose**: Unified design command that produces all design artifacts in one invocation.

**What it does**:
- **DISCOVER phase**: Examines codebase and asks progressive questions → `discovery.md`
- **SPECIFY phase**: Creates feature specification → `spec.md`, `requirements.md`
- **PLAN phase**: Creates implementation plan → `plan.md`, optional `research.md`, `data-model.md`
- **TASKS phase**: Generates actionable task list → `tasks.md`
- **CHECKLISTS phase**: Creates implementation and verification checklists → `checklists/`

**Cascade Flags**:
- `(none)`: Full flow (discover → spec → plan → tasks → checklists)
- `--spec`: Cascade from spec (spec → plan → tasks → checklists)
- `--plan`: Cascade from plan (plan → tasks → checklists)
- `--tasks`: Cascade from tasks (tasks → checklists)
- `--checklist`: Regenerate only checklists

**Dependencies**:
- `.specify/templates/` (spec-template.md, plan-template.md, tasks-template.md)
- Memory documents (constitution.md, tech-stack.md)
- CLI: `specflow state`, `specflow context`

**Notes**:
- New in v2.3, replaces 5 separate commands
- ~400 lines
- Inline clarification with recommendations (no separate clarify step)

---

### 6. `/specflow.analyze` (Complexity: 4/10)

**Purpose**: Cross-artifact consistency analysis.

**What it does**:
- Non-destructive read-only analysis
- Checks spec ↔ plan ↔ tasks alignment
- Identifies gaps, conflicts, missing items
- Produces analysis report
- Does NOT modify artifacts

**Dependencies**:
- `spec.md`, `plan.md`, `tasks.md`

**Notes**: Quality gate before implementation.

---

### 7. `/specflow.implement` (Complexity: 6/10)

**Purpose**: Executes all tasks from tasks.md.

**What it does**:
- Reads tasks.md
- Executes each task in dependency order
- Tracks progress via `specflow tasks mark`
- Supports TDD mode
- Handles blocked tasks
- Updates state after each task

**Dependencies**:
- `tasks.md`
- CLI: `specflow tasks`

**Notes**: Main code-writing step.

---

### 8. `/specflow.verify` (Complexity: 6/10)

**Purpose**: Comprehensive completion verification.

**What it does**:
- Task completion check (all must be done or deferred)
- Memory document compliance check
- Checklist verification (actively runs items)
- Deferred items documentation
- USER GATE assessment
- ROADMAP.md status update
- Generates verification report

**Dependencies**:
- `tasks.md`, checklists, memory docs
- CLI: `specflow tasks`, `specflow checklist`, `specflow roadmap`

**Notes**:
- 605 lines - handles many concerns
- Could be split into smaller focused checks

---

### 9. `/specflow.merge` (Complexity: 6/10)

**Purpose**: Complete phase and merge to main.

**What it does**:
- Pre-flight checks (branch, uncommitted changes, task completion)
- Git push
- Create/merge PR via `gh`
- Branch cleanup
- State archival
- Phase archival to HISTORY.md
- Handoff extraction from deferred items
- ROADMAP update
- Optional: start next phase with `--next-phase`

**Flags**: `--pr-only`, `--force`, `--dry-run`, `--next-phase`

**Dependencies**:
- Git, `gh` CLI
- CLI: `specflow state`, `specflow phase`, `specflow roadmap`

**Notes**: End-of-phase workflow automation.

---

### 10. `/specflow.review` (Complexity: 6/10)

**Purpose**: Systematic code review across 7 categories.

**What it does**:
- 7 review categories: BP, RF, HD, MF, OC, OE, OD
- Rates findings by effort/impact/severity (1-5)
- Interactive category-by-category approval
- Creates hotfix phase for approved findings
- Defers rejected items to backlog
- Auto-fix mode with `--fix`

**Categories**:
- BP: Best Practices
- RF: Refactoring
- HD: Hardening
- MF: Missing Features
- OC: Orphaned Code
- OE: Over-Engineering
- OD: Outdated Docs

**Flags**: `--dry-run`, `--categories`, `--fix`

**Dependencies**:
- Memory docs (for baseline)
- ROADMAP.md
- CLI: `specflow context`

**Notes**: Refinement workflow, creates hotfix phases.

---

### Utility: `/specflow.taskstoissues` (Complexity: 2/10)

**Purpose**: Convert tasks.md to GitHub issues.

**What it does**:
- Reads tasks.md via `specflow context`
- Gets git remote URL
- Creates GitHub issues via MCP server
- Only works with GitHub remotes

**Dependencies**:
- `tasks.md`
- GitHub MCP server
- CLI: `specflow context`

**Notes**: Simple utility, GitHub-specific.

---

## Priority Analysis

### Highest Complexity (Consider Refactoring)

| Command | Complexity | Issue |
|---------|:----------:|-------|
| `orchestrate` | 9/10 | ~600 lines, state machine, 4 steps |
| `design` | 8/10 | ~400 lines, 5 phases, cascade logic |
| `init` | 7/10 | 600 lines, 4-step flow, smart detection |
| `memory` | 7/10 | 750 lines, reconciliation logic |
| `verify` | 6/10 | 605 lines, many parallel concerns |
| `merge` | 6/10 | 575 lines, many git operations |

### Lowest Complexity (Low Priority)

| Command | Complexity | Notes |
|---------|:----------:|-------|
| `taskstoissues` | 2/10 | Simple utility |
| `analyze` | 4/10 | Read-only analysis |
| Deprecated stubs | 1/10 | Just show notices (9 total) |

### Consolidation Opportunities

| Opportunity | Status | Notes |
|-------------|--------|-------|
| Pre-workflow commands | ✅ Done (v2.2) | 7 → 3 active + 3 deprecated |
| Phase creation | ✅ Done (v2.2) | `phase` merged into `roadmap add-pdr` |
| Memory generation | ✅ Done (v2.2) | `memory-init` merged into `init` |
| Constitution creation | ✅ Done (v2.2) | `constitution` merged into `init` |
| Workflow consolidation | ✅ Done (v2.3) | 9 steps → 4 steps, `/specflow.design` |
| Backlog consolidation | ✅ Done (v2.3) | `/specflow.backlog` → `/specflow.roadmap backlog` |
| Verification | Keep separate | `verify` remains standalone |

---

## Cleanup Tracking

### Completed (v2.2)

- [x] `memory-init` deleted (merged into `init`)
- [x] `start` deprecated → use `orchestrate`
- [x] `constitution` deprecated → use `init`
- [x] `phase` deprecated → use `roadmap add-pdr`
- [x] `init` expanded with 4-step flow
- [x] `memory` reduced (removed generate)
- [x] `roadmap` expanded with `add-pdr` subcommand

### Completed (v2.3)

- [x] `orchestrate` simplified from 9 steps to 4
- [x] `/specflow.design` created (unified design command)
- [x] `specify` deprecated → use `design`
- [x] `clarify` deprecated → use `design`
- [x] `plan` deprecated → use `design --plan`
- [x] `tasks` deprecated → use `design --tasks`
- [x] `checklist` deprecated → use `design --checklist`
- [x] `backlog` deprecated → use `roadmap backlog`
- [x] `roadmap` expanded with `backlog` subcommand

### Planned

- [ ] Review `verify` for simplification opportunities
- [ ] Review `merge` for excessive complexity
- [ ] Audit all commands for consistent error handling
- [ ] Standardize CLI command usage patterns
- [ ] Update handoffs to use consistent format

---

## Next Steps

1. Pick a command to clean up (recommended: start with simpler ones first)
2. Document specific issues/improvements
3. Implement changes
4. Update this document with cleanup notes
