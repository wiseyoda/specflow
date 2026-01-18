# SpecKit Commands Analysis

> **Purpose**: Comprehensive analysis of all Claude Code slash commands for cleanup planning.
> **Created**: 2026-01-17
> **Status**: Active reference document

---

## Overview

SpecKit has **16 active Claude Code commands** (plus 3 deprecated stubs) that guide the spec-driven development workflow. This document catalogs each command with complexity scores, line counts, and improvement notes.

> **v2.2 Update**: Pre-workflow commands consolidated from 7 to 3 active + 3 deprecated stubs. See [Pre-Workflow Commands](#pre-workflow-commands-project-setup) for details.

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
| 1 | `/speckit.init` | 7/10 | ~600 | `commands/speckit.init.md` |
| 2 | `/speckit.memory` | 7/10 | ~750 | `commands/speckit.memory.md` |
| 3 | `/speckit.roadmap` | 6/10 | ~650 | `commands/speckit.roadmap.md` |

**Deprecated Commands (3 stubs, ~30 lines each):**

| # | Command | Replacement | File |
|---|---------|-------------|------|
| D1 | `/speckit.start` | `/speckit.orchestrate` | `commands/speckit.start.md` |
| D2 | `/speckit.constitution` | `/speckit.init` | `commands/speckit.constitution.md` |
| D3 | `/speckit.phase` | `/speckit.roadmap add-pdr` | `commands/speckit.phase.md` |

**Deleted (1):**
- `/speckit.memory-init` - Merged into `/speckit.init`

### Main Workflow Commands (Orchestrate Steps)

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 8 | `/speckit.orchestrate` | 10/10 | ~740 | `commands/speckit.orchestrate.md` |
| 9 | `/speckit.specify` | 6/10 | ~380 | `commands/speckit.specify.md` |
| 10 | `/speckit.clarify` | 5/10 | ~200 | `commands/speckit.clarify.md` |
| 11 | `/speckit.plan` | 4/10 | ~120 | `commands/speckit.plan.md` |
| 12 | `/speckit.tasks` | 4/10 | ~155 | `commands/speckit.tasks.md` |
| 13 | `/speckit.analyze` | 4/10 | ~185 | `commands/speckit.analyze.md` |
| 14 | `/speckit.checklist` | 5/10 | ~310 | `commands/speckit.checklist.md` |
| 15 | `/speckit.implement` | 6/10 | ~300 | `commands/speckit.implement.md` |
| 16 | `/speckit.verify` | 6/10 | ~605 | `commands/speckit.verify.md` |

### Post-Workflow Commands

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 17 | `/speckit.merge` | 6/10 | ~575 | `commands/speckit.merge.md` |
| 18 | `/speckit.backlog` | 4/10 | ~340 | `commands/speckit.backlog.md` |

### Supplementary Commands

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 19 | `/speckit.review` | 6/10 | ~460 | `commands/speckit.review.md` |

### Utility Commands

| # | Command | Complexity | Lines | File |
|---|---------|:----------:|:-----:|------|
| 20 | `/speckit.taskstoissues` | 2/10 | ~30 | `commands/utilities/speckit.taskstoissues.md` |

---

## Workflow Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PRE-WORKFLOW (Project Setup) - 3 Active Commands                │
├─────────────────────────────────────────────────────────────────┤
│  init → memory → roadmap                                         │
│    │                  │                                          │
│    └─ Full 4-step:    └─ Optional: add-pdr (convert PDRs)       │
│       discovery → constitution → memory → roadmap                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  MAIN WORKFLOW (orchestrate controls these)                      │
├─────────────────────────────────────────────────────────────────┤
│  discover → specify → clarify → plan → tasks → analyze          │
│     → checklist → implement → verify                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST-WORKFLOW                                                   │
├─────────────────────────────────────────────────────────────────┤
│  merge → [backlog]                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Command Descriptions

### 1. `/speckit.init` (Complexity: 7/10)

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
- Absorbed functionality from deprecated `/speckit.constitution`, `/speckit.memory-init`
- Uses placeholder detection for smart idempotency

---

### 2. `/speckit.memory` (Complexity: 7/10)

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
- `generate` subcommand removed in v2.2 (use `/speckit.init` instead)
- Focused on verification and reconciliation only

---

### 3. `/speckit.roadmap` (Complexity: 6/10)

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
- CLI: `speckit roadmap`, `speckit pdr` commands

**Notes**:
- Expanded in v2.2 to include `add-pdr` subcommand
- Absorbed functionality from deprecated `/speckit.phase`

---

### 4. `/speckit.orchestrate` (Complexity: 10/10)

**Purpose**: Master orchestrator for the complete development workflow.

**What it does**:
- 9-step workflow: discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify
- State persistence in `.specify/orchestration-state.json`
- Self-healing (resume from any step)
- Error recovery with user prompts
- Step skipping with `--skip-to`
- Discovery bypass with `--no-discovery`

**Dependencies**:
- All other workflow commands
- CLI: `speckit state`, `speckit context`, `speckit roadmap`
- ROADMAP.md

**Notes**:
- Most complex command (740 lines)
- Central state machine
- Consider extracting step dispatch logic

---

### 5. `/speckit.specify` (Complexity: 6/10)

**Purpose**: Creates feature specification from description.

**What it does**:
- Loads context via `speckit context`
- Reads handoff files from previous phases
- Researches codebase for existing patterns
- Generates `spec.md` using template
- Updates orchestration state

**Dependencies**:
- `.specify/templates/spec-template.md`
- Optional: handoff files from previous phase
- CLI: `speckit context`, `speckit state`

**Notes**: First artifact-generating step in workflow.

---

### 6. `/speckit.clarify` (Complexity: 5/10)

**Purpose**: Resolves ambiguities in specifications.

**What it does**:
- Analyzes spec.md for underspecified areas
- Asks up to 5 targeted questions via `AskUserQuestion`
- Encodes answers back into spec.md
- Updates state on completion

**Dependencies**:
- `spec.md` from specify step
- CLI: `speckit state`

**Notes**: Interactive refinement, keeps specs tight.

---

### 7. `/speckit.plan` (Complexity: 4/10)

**Purpose**: Creates technical implementation plan.

**What it does**:
- Reads spec.md
- Generates `plan.md` (implementation approach)
- Optional: `research.md`, `data-model.md`, `contracts/`
- Updates state

**Dependencies**:
- `spec.md`
- `.specify/templates/plan-template.md`

**Notes**: Relatively simple, mostly template-driven.

---

### 8. `/speckit.tasks` (Complexity: 4/10)

**Purpose**: Generates actionable task list.

**What it does**:
- Reads spec.md and plan.md
- Creates `tasks.md` with dependency ordering
- Organizes by user story
- Generates verification checklist
- Updates state

**Dependencies**:
- `spec.md`, `plan.md`
- `.specify/templates/tasks-template.md`

**Notes**: Critical for implementation tracking.

---

### 9. `/speckit.analyze` (Complexity: 4/10)

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

### 10. `/speckit.checklist` (Complexity: 5/10)

**Purpose**: Generates "unit tests for requirements".

**What it does**:
- Analyzes spec.md requirements
- Creates `checklists/requirements.md`
- Creates `checklists/verification.md`
- Each checklist item is testable
- Updates state

**Dependencies**:
- `spec.md`
- `.specify/templates/checklist-template.md`

**Notes**: Ensures requirements are verifiable.

---

### 11. `/speckit.implement` (Complexity: 6/10)

**Purpose**: Executes all tasks from tasks.md.

**What it does**:
- Reads tasks.md
- Executes each task in dependency order
- Tracks progress via `speckit tasks mark`
- Supports TDD mode
- Handles blocked tasks
- Updates state after each task

**Dependencies**:
- `tasks.md`
- CLI: `speckit tasks`

**Notes**: Main code-writing step.

---

### 12. `/speckit.verify` (Complexity: 6/10)

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
- CLI: `speckit tasks`, `speckit checklist`, `speckit roadmap`

**Notes**:
- 605 lines - handles many concerns
- Could be split into smaller focused checks

---

### 13. `/speckit.merge` (Complexity: 6/10)

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
- CLI: `speckit state`, `speckit phase`, `speckit roadmap`

**Notes**: End-of-phase workflow automation.

---

### 14. `/speckit.backlog` (Complexity: 4/10)

**Purpose**: Triage backlog items into phases.

**What it does**:
- Scans completed phases for orphaned incomplete tasks
- Parses backlog items from ROADMAP.md
- Matches items to phases by keyword/semantic relevance
- Interactive or auto triage
- Creates new phases if needed
- Updates ROADMAP.md

**Flags**: `--auto`, `--dry-run`

**Dependencies**:
- ROADMAP.md
- CLI: `speckit roadmap backlog`

**Notes**: Ensures no work is lost between phases.

---

### 15. `/speckit.review` (Complexity: 6/10)

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
- CLI: `speckit context`

**Notes**: Refinement workflow, creates hotfix phases.

---

### 16. `/speckit.taskstoissues` (Complexity: 2/10)

**Purpose**: Convert tasks.md to GitHub issues.

**What it does**:
- Reads tasks.md via `speckit context`
- Gets git remote URL
- Creates GitHub issues via MCP server
- Only works with GitHub remotes

**Dependencies**:
- `tasks.md`
- GitHub MCP server
- CLI: `speckit context`

**Notes**: Simple utility, GitHub-specific.

---

## Priority Analysis

### Highest Complexity (Consider Refactoring)

| Command | Complexity | Issue |
|---------|:----------:|-------|
| `orchestrate` | 10/10 | 740 lines, state machine, many steps |
| `init` | 7/10 | 600 lines, 4-step flow, smart detection |
| `memory` | 7/10 | 750 lines, reconciliation logic |
| `verify` | 6/10 | 605 lines, many parallel concerns |
| `merge` | 6/10 | 575 lines, many git operations |

### Lowest Complexity (Low Priority)

| Command | Complexity | Notes |
|---------|:----------:|-------|
| `taskstoissues` | 2/10 | Simple utility |
| `plan` | 4/10 | Template-driven |
| `backlog` | 4/10 | Simple triage logic |
| Deprecated stubs | 1/10 | Just show notices |

### Consolidation Opportunities

| Opportunity | Status | Notes |
|-------------|--------|-------|
| Pre-workflow commands | ✅ Done (v2.2) | 7 → 3 active + 3 deprecated |
| Phase creation | ✅ Done (v2.2) | `phase` merged into `roadmap add-pdr` |
| Memory generation | ✅ Done (v2.2) | `memory-init` merged into `init` |
| Constitution creation | ✅ Done (v2.2) | `constitution` merged into `init` |
| Verification | Keep separate | `verify` + `checklist` serve different purposes |

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

### Planned

- [ ] Review `orchestrate` for simplification opportunities
- [ ] Evaluate `verify` step consolidation
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
