# Slash Commands Reference

Complete reference for SpecFlow slash commands used in Claude Code.

## Overview

Slash commands are invoked in Claude Code with `/flow.<command>`. They orchestrate AI-assisted development workflows.

**Syntax:** `/flow.<command> [arguments]`

---

## Core Workflow Commands

### /flow.orchestrate

**Full workflow automation** - Runs the complete development cycle with state persistence and self-healing.

```
/flow.orchestrate             # Start from beginning or resume
/flow.orchestrate continue    # Resume from last step
/flow.orchestrate reset       # Clear state and restart current phase
/flow.orchestrate status      # Show status only, don't execute
/flow.orchestrate skip-to implement  # Skip to specific step
```

The orchestrator manages 4 steps:
1. **design** - Create all design artifacts via `/flow.design`
2. **analyze** - Cross-artifact consistency analysis
3. **implement** - Execute tasks via `/flow.implement`
4. **verify** - Verify completion via `/flow.verify`

### /flow.init

**Project initialization** - Guided discovery process that captures requirements, decisions, and project context.

```
/flow.init                    # Run full initialization or resume
/flow.init status             # Show interview progress
/flow.init --force            # Regenerate all artifacts
/flow.init faster             # Fast mode: 4 questions/round
/flow.init deeper             # Deep mode: 5 Whys technique
/flow.init compare A vs B     # Compare options side-by-side
/flow.init research TOPIC     # Research a topic before deciding
```

Produces:
- Discovery interview artifacts
- Constitution (governance document)
- Memory documents (tech-stack, coding-standards, etc.)
- Initial ROADMAP.md

---

## Design Commands

### /flow.design

**Create all design artifacts** in one command with inline clarifications.

```
/flow.design                  # Full flow: discover → spec → plan → tasks → checklists
/flow.design --spec           # Cascade from spec: spec → plan → tasks → checklists
/flow.design --plan           # Cascade from plan: plan → tasks → checklists
/flow.design --tasks          # Cascade from tasks: tasks → checklists
/flow.design --checklist      # Regenerate only checklists
```

Creates these artifacts in the current phase directory:
| Artifact | Purpose |
|----------|---------|
| `discovery.md` | Codebase examination and clarified user intent |
| `spec.md` | Feature specification with requirements |
| `requirements.md` | Requirements quality checklist |
| `plan.md` | Technical implementation plan |
| `tasks.md` | Actionable task list |
| `checklists/implementation.md` | Implementation guidance |
| `checklists/verification.md` | Verification checklist |

### /flow.analyze

**Cross-artifact consistency analysis** - Non-destructive analysis of spec.md, plan.md, and tasks.md.

```
/flow.analyze                 # Run full analysis
```

Identifies inconsistencies, gaps, and potential issues across artifacts. Part of the orchestration auto-fix loop.

---

## Implementation Commands

### /flow.implement

**Execute implementation tasks** from tasks.md using TDD.

```
/flow.implement               # Execute all tasks with TDD workflow
/flow.implement --no-tdd      # Skip test-first approach (not recommended)
/flow.implement continue      # Resume from last incomplete task
```

Uses `specflow mark T###` to track task completion.

### /flow.verify

**Verify implementation** against specifications. Updates ROADMAP.md with completion status.

```
/flow.verify                  # Run full verification
/flow.verify --dry-run        # Preview without closing phase
/flow.verify --skip-memory    # Skip memory document compliance check
```

Verifies:
- All tasks completed
- All checklists pass
- Implementation complies with memory documents
- User gate satisfied (if applicable)

Then closes the phase via `specflow phase close`.

### /flow.merge

**Complete a phase** - Push, create PR, merge to main, cleanup branches.

```
/flow.merge                   # Full merge workflow (default)
/flow.merge --pr-only         # Create PR but don't merge
```

Workflow:
1. Close the phase (update ROADMAP, archive, reset state)
2. Commit the phase closure changes
3. Push and merge to main
4. Switch to main with clean state

---

## Project Management Commands

### /flow.roadmap

**Create or update ROADMAP.md** with development phases and verification gates.

```
/flow.roadmap                 # Generate or update ROADMAP.md
/flow.roadmap add-pdr         # Convert PDRs to phases
/flow.roadmap add-pdr --all   # Convert all approved PDRs
/flow.roadmap backlog         # Interactive backlog triage
/flow.roadmap backlog --auto  # Auto-assign high-confidence matches
```

### /flow.review

**Systematic code review** - Generate categorized findings that can be triaged into implementation phases.

```
/flow.review                  # Full interactive review
/flow.review --dry-run        # Preview findings without creating phase
/flow.review --categories BP,RF,HD  # Review specific categories
/flow.review --fix            # Auto-approve effort ≤4, defer effort=5
```

Categories:
- **BP** - Best Practices
- **RF** - Refactoring
- **HD** - Hardening
- **MF** - Missing Features
- **OC** - Orphaned Code
- **OE** - Over-Engineering
- **OD** - Outdated Documentation

---

## Memory Document Commands

### /flow.memory

**Verify and optimize memory documents** - Clean up, reconcile against codebase, detect drift.

```
/flow.memory                  # Full verification with reconciliation
/flow.memory --dry-run        # Analyze only, no changes
/flow.memory --fix            # Auto-fix without confirmation
/flow.memory --no-reconcile   # Skip ROADMAP/codebase checks (faster)
/flow.memory --promote        # Scan completed specs for decisions to promote
/flow.memory --deep           # Full codebase pattern scan (slower)
```

---

## Command Flow

```
/flow.init                   # Entry point for new projects
    │
    ▼
/flow.roadmap                # Create development phases
    │
    ▼
/flow.orchestrate            # Automated workflow (4 steps)
    │
    ├── /flow.design         # Create all design artifacts
    ├── ANALYZE              # Cross-artifact consistency
    ├── /flow.implement      # Execute tasks with TDD
    └── /flow.verify         # Verify completion
    │
    ▼
/flow.merge                  # Complete phase, merge PR
    │
    ▼
(next phase) ──────────────► /flow.orchestrate
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/flow.init` | Initialize project with discovery interview |
| `/flow.orchestrate` | **Main workflow** - design → analyze → implement → verify |
| `/flow.design` | Create all design artifacts |
| `/flow.analyze` | Cross-artifact consistency check |
| `/flow.implement` | Execute tasks with TDD |
| `/flow.verify` | Verify completion, close phase |
| `/flow.merge` | Push, PR, merge to main |
| `/flow.roadmap` | Create/update ROADMAP, backlog triage |
| `/flow.memory` | Verify/optimize memory documents |
| `/flow.review` | Systematic code review |

---

## CLI Commands

For state and task management, use the CLI directly:

```bash
specflow status              # Project status
specflow next                # Next task
specflow mark T007           # Mark task complete
specflow check --fix         # Validation with auto-fix
specflow phase open 0020     # Open a phase
specflow phase close         # Close current phase
specflow phase defer "item"  # Defer to backlog
```

See [CLI Reference](cli-reference.md) for the complete CLI documentation.
