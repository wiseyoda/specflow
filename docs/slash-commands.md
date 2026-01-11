# Slash Commands Reference

Complete reference for SpecKit slash commands used in Claude Code.

## Overview

Slash commands are invoked in Claude Code with `/speckit.<command>`. They orchestrate AI-assisted development workflows.

**Syntax:** `/speckit.<command> [arguments]`

---

## Core Workflow Commands

### /speckit.start

**Smart entry point** - Auto-detects project state and routes to the appropriate workflow.

```
/speckit.start
/speckit.start --skip-detections
/speckit.start --verbose
```

This is the recommended way to begin any SpecKit session. It analyzes your project and suggests the next logical step.

### /speckit.init

**Project initialization interview** - Guided discovery process that captures requirements, decisions, and project context.

```
/speckit.init                    # Start or resume interview
/speckit.init status             # Show interview progress
/speckit.init pause              # Pause for later
/speckit.init deeper             # Go deeper on current topic
/speckit.init faster             # Accelerate interview
/speckit.init skip               # Skip current phase
/speckit.init focus <topic>      # Focus on specific topic
/speckit.init compare            # Compare options
/speckit.init research <topic>   # Research a topic
/speckit.init revisit <phase>    # Revisit a phase
/speckit.init validate           # Validate interview state
/speckit.init export             # Export to memory documents
```

### /speckit.orchestrate

**Full workflow automation** - Runs the complete development cycle with state persistence and self-healing.

```
/speckit.orchestrate             # Start from beginning or resume
/speckit.orchestrate --resume    # Resume from last step
/speckit.orchestrate --phase <N> # Start at specific phase
/speckit.orchestrate --skip-gates  # Skip validation gates
```

The orchestrator manages:
1. Specification creation
2. Clarification questions
3. Implementation planning
4. Task generation
5. Cross-artifact analysis
6. Checklist creation
7. Implementation
8. Verification

---

## Specification Commands

### /speckit.specify

**Create feature specification** from requirements or natural language description.

```
/speckit.specify
/speckit.specify "Add user authentication with OAuth"
```

Creates `spec.md` in the current feature directory.

### /speckit.clarify

**Resolve ambiguities** by asking up to 5 targeted clarification questions. Encodes answers back into the spec.

```
/speckit.clarify
```

Run this after `/speckit.specify` to improve spec quality.

### /speckit.plan

**Create implementation plan** using the plan template to generate design artifacts.

```
/speckit.plan
```

Creates `plan.md` with architecture decisions, component design, and implementation approach.

### /speckit.tasks

**Generate task breakdown** - Creates actionable, dependency-ordered tasks from the plan.

```
/speckit.tasks
```

Creates `tasks.md` with implementation tasks, acceptance criteria, and dependencies.

### /speckit.analyze

**Cross-artifact consistency analysis** - Non-destructive analysis of spec.md, plan.md, and tasks.md.

```
/speckit.analyze
```

Identifies inconsistencies, gaps, and potential issues across artifacts.

### /speckit.checklist

**Generate verification checklist** based on feature requirements.

```
/speckit.checklist
```

Creates a checklist for verifying the implementation meets all requirements.

---

## Implementation Commands

### /speckit.implement

**Execute implementation tasks** from tasks.md.

```
/speckit.implement               # Start implementation
/speckit.implement continue      # Resume from last incomplete task
/speckit.implement phase <N>     # Start at specific phase
/speckit.implement --tdd         # Enforce test-driven development
```

### /speckit.verify

**Verify implementation** against specifications. Updates ROADMAP.md with completion status.

```
/speckit.verify
```

Checks:
- All tasks completed
- Checklists satisfied
- Spec requirements met
- Tests passing

### /speckit.merge

**Complete a phase** - Push, create PR, merge to main, cleanup branches, archive state.

```
/speckit.merge                   # Full merge workflow
/speckit.merge --pr-only         # Create PR but don't merge
/speckit.merge --dry-run         # Preview what would happen
/speckit.merge --force           # Skip task completion check
/speckit.merge --next-phase      # Auto-start next phase after merge
```

---

## Project Management Commands

### /speckit.roadmap

**Create or update ROADMAP.md** with development phases and verification gates.

```
/speckit.roadmap
```

### /speckit.backlog

**Triage backlog items** - Scan completed phases for orphaned tasks, assign to future phases.

```
/speckit.backlog                 # Interactive triage
/speckit.backlog --auto          # Auto-assign high-confidence matches
/speckit.backlog --dry-run       # Preview assignments
```

### /speckit.phase

**Create ROADMAP phases from PDRs** - Converts Product Design Requirements into implementation-ready phases.

```
/speckit.phase
/speckit.phase <pdr-file>
```

### /speckit.constitution

**Create or update project constitution** from interactive or provided principle inputs.

```
/speckit.constitution
```

---

## Memory Document Commands

### /speckit.memory

**Verify and reconcile memory documents** - Clean up, optimize, and detect drift.

```
/speckit.memory                  # Full analysis and reconciliation
/speckit.memory --dry-run        # Analyze only, no changes
/speckit.memory --verbose        # Detailed analysis output
/speckit.memory --fix            # Auto-fix without confirmation
/speckit.memory --no-reconcile   # Skip drift detection (faster)
/speckit.memory --promote        # Scan completed specs for decisions to promote
/speckit.memory --deep           # Full codebase scan
```

### /speckit.memory-init

**Generate memory docs from codebase** - Analyzes existing code to create memory documents.

```
/speckit.memory-init all              # Generate all documents
/speckit.memory-init recommended      # Generate recommended set
/speckit.memory-init coding-standards # Generate specific document
/speckit.memory-init tech-stack       # Generate tech stack doc
/speckit.memory-init glossary         # Generate glossary
/speckit.memory-init --force          # Overwrite existing
/speckit.memory-init --dry-run        # Preview without writing
```

---

## Quality & Review Commands

### /speckit.review

**Systematic code review** - Generate categorized findings that can be triaged into implementation phases.

```
/speckit.review
/speckit.review <path>
```

---

## Utility Commands

### /speckit.taskstoissues

**Convert tasks to GitHub issues** - Export tasks.md items as GitHub issues.

```
/speckit.taskstoissues
```

Located in `commands/utilities/`.

---

## Command Flow

```
/speckit.start              # Entry point
    │
    ▼
/speckit.init               # Requirements interview
    │
    ▼
/speckit.roadmap            # Create development phases
    │
    ▼
/speckit.orchestrate        # Automated workflow
    │
    ├── /speckit.specify    # Feature specification
    ├── /speckit.clarify    # Resolve ambiguities
    ├── /speckit.plan       # Implementation plan
    ├── /speckit.tasks      # Task breakdown
    ├── /speckit.analyze    # Consistency check
    ├── /speckit.checklist  # Verification checklist
    ├── /speckit.implement  # Execute tasks
    └── /speckit.verify     # Verify completion
    │
    ▼
/speckit.merge              # Complete phase
    │
    ▼
/speckit.backlog            # Triage remaining items
    │
    └── (next phase)
```

---

## Quick Reference

**Recommended Entry Point**: `/speckit.start` - Routes you to the right command automatically.

| Command | Purpose |
|---------|---------|
| `/speckit.start` | **Primary entry point** - Auto-detect state, route to next step |
| `/speckit.init` | Requirements interview |
| `/speckit.orchestrate` | Full automated workflow |
| `/speckit.specify` | Create feature spec |
| `/speckit.plan` | Create implementation plan |
| `/speckit.tasks` | Generate task breakdown |
| `/speckit.implement` | Execute tasks |
| `/speckit.verify` | Verify completion |
| `/speckit.merge` | Complete phase, merge PR |
| `/speckit.memory` | Manage memory documents (incl. generate) |
| `/speckit.review` | Code review |

**Note**: For issue management, use the CLI directly: `speckit issue list`, `speckit issue create`, etc.
