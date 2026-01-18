# Slash Commands Reference

Complete reference for SpecFlow slash commands used in Claude Code.

## Overview

Slash commands are invoked in Claude Code with `/specflow.<command>`. They orchestrate AI-assisted development workflows.

**Syntax:** `/specflow.<command> [arguments]`

---

## Core Workflow Commands

### /specflow.start

**Smart entry point** - Auto-detects project state and routes to the appropriate workflow.

```
/specflow.start
/specflow.start --skip-detections
/specflow.start --verbose
```

This is the recommended way to begin any SpecFlow session. It analyzes your project and suggests the next logical step.

### /specflow.init

**Project initialization interview** - Guided discovery process that captures requirements, decisions, and project context.

```
/specflow.init                    # Start or resume interview
/specflow.init status             # Show interview progress
/specflow.init pause              # Pause for later
/specflow.init deeper             # Go deeper on current topic
/specflow.init faster             # Accelerate interview
/specflow.init skip               # Skip current phase
/specflow.init focus <topic>      # Focus on specific topic
/specflow.init compare            # Compare options
/specflow.init research <topic>   # Research a topic
/specflow.init revisit <phase>    # Revisit a phase
/specflow.init validate           # Validate interview state
/specflow.init export             # Export to memory documents
```

### /specflow.orchestrate

**Full workflow automation** - Runs the complete development cycle with state persistence and self-healing.

```
/specflow.orchestrate             # Start from beginning or resume
/specflow.orchestrate --resume    # Resume from last step
/specflow.orchestrate --phase <N> # Start at specific phase
/specflow.orchestrate --skip-gates  # Skip validation gates
/specflow.orchestrate --no-discovery  # Skip codebase examination and questions
```

The orchestrator manages 9 steps:
1. **Discovery** - Examine codebase and ask clarifying questions
2. **Specification** - Create feature spec from discovery findings
3. **Clarification** - Resolve remaining ambiguities
4. **Planning** - Create implementation plan
5. **Tasks** - Generate task breakdown
6. **Analysis** - Cross-artifact consistency check
7. **Checklist** - Create verification checklist
8. **Implementation** - Execute tasks
9. **Verification** - Verify completion

---

## Specification Commands

### /specflow.specify

**Create feature specification** from requirements or natural language description.

```
/specflow.specify
/specflow.specify "Add user authentication with OAuth"
```

Creates `spec.md` in the current feature directory.

### /specflow.clarify

**Resolve ambiguities** by asking up to 5 targeted clarification questions. Encodes answers back into the spec.

```
/specflow.clarify
```

Run this after `/specflow.specify` to improve spec quality.

### /specflow.plan

**Create implementation plan** using the plan template to generate design artifacts.

```
/specflow.plan
```

Creates `plan.md` with architecture decisions, component design, and implementation approach.

### /specflow.tasks

**Generate task breakdown** - Creates actionable, dependency-ordered tasks from the plan.

```
/specflow.tasks
```

Creates `tasks.md` with implementation tasks, acceptance criteria, and dependencies.

### /specflow.analyze

**Cross-artifact consistency analysis** - Non-destructive analysis of spec.md, plan.md, and tasks.md.

```
/specflow.analyze
```

Identifies inconsistencies, gaps, and potential issues across artifacts.

### /specflow.checklist

**Generate verification checklist** based on feature requirements.

```
/specflow.checklist
```

Creates a checklist for verifying the implementation meets all requirements.

---

## Implementation Commands

### /specflow.implement

**Execute implementation tasks** from tasks.md.

```
/specflow.implement               # Start implementation
/specflow.implement continue      # Resume from last incomplete task
/specflow.implement phase <N>     # Start at specific phase
/specflow.implement --tdd         # Enforce test-driven development
```

### /specflow.verify

**Verify implementation** against specifications. Updates ROADMAP.md with completion status.

```
/specflow.verify
```

Checks:
- All tasks completed
- Checklists satisfied
- Spec requirements met
- Tests passing

### /specflow.merge

**Complete a phase** - Push, create PR, merge to main, cleanup branches, archive state.

```
/specflow.merge                   # Full merge workflow
/specflow.merge --pr-only         # Create PR but don't merge
/specflow.merge --dry-run         # Preview what would happen
/specflow.merge --force           # Skip task completion check
/specflow.merge --next-phase      # Auto-start next phase after merge
```

---

## Project Management Commands

### /specflow.roadmap

**Create or update ROADMAP.md** with development phases and verification gates.

```
/specflow.roadmap
```

### /specflow.backlog

**Triage backlog items** - Scan completed phases for orphaned tasks, assign to future phases.

```
/specflow.backlog                 # Interactive triage
/specflow.backlog --auto          # Auto-assign high-confidence matches
/specflow.backlog --dry-run       # Preview assignments
```

### /specflow.phase

**Create ROADMAP phases from PDRs** - Converts Product Design Requirements into implementation-ready phases.

```
/specflow.phase
/specflow.phase <pdr-file>
```

### /specflow.constitution

**Create or update project constitution** from interactive or provided principle inputs.

```
/specflow.constitution
```

---

## Memory Document Commands

### /specflow.memory

**Verify and reconcile memory documents** - Clean up, optimize, and detect drift.

```
/specflow.memory                  # Full analysis and reconciliation
/specflow.memory --dry-run        # Analyze only, no changes
/specflow.memory --verbose        # Detailed analysis output
/specflow.memory --fix            # Auto-fix without confirmation
/specflow.memory --no-reconcile   # Skip drift detection (faster)
/specflow.memory --promote        # Scan completed specs for decisions to promote
/specflow.memory --deep           # Full codebase scan
```

### /specflow.memory-init

**Generate memory docs from codebase** - Analyzes existing code to create memory documents.

```
/specflow.memory-init all              # Generate all documents
/specflow.memory-init recommended      # Generate recommended set
/specflow.memory-init coding-standards # Generate specific document
/specflow.memory-init tech-stack       # Generate tech stack doc
/specflow.memory-init glossary         # Generate glossary
/specflow.memory-init --force          # Overwrite existing
/specflow.memory-init --dry-run        # Preview without writing
```

---

## Quality & Review Commands

### /specflow.review

**Systematic code review** - Generate categorized findings that can be triaged into implementation phases.

```
/specflow.review
/specflow.review <path>
```

---

## Utility Commands

### /specflow.taskstoissues

**Convert tasks to GitHub issues** - Export tasks.md items as GitHub issues.

```
/specflow.taskstoissues
```

Located in `commands/utilities/`.

---

## Command Flow

```
/specflow.start              # Entry point
    │
    ▼
/specflow.init               # Requirements interview
    │
    ▼
/specflow.roadmap            # Create development phases
    │
    ▼
/specflow.orchestrate        # Automated workflow (9 steps)
    │
    ├── DISCOVER            # Examine codebase, ask questions
    ├── /specflow.specify    # Feature specification
    ├── /specflow.clarify    # Resolve ambiguities
    ├── /specflow.plan       # Implementation plan
    ├── /specflow.tasks      # Task breakdown
    ├── /specflow.analyze    # Consistency check
    ├── /specflow.checklist  # Verification checklist
    ├── /specflow.implement  # Execute tasks
    └── /specflow.verify     # Verify completion
    │
    ▼
/specflow.merge              # Complete phase
    │
    ▼
/specflow.backlog            # Triage remaining items
    │
    └── (next phase)
```

---

## Quick Reference

**Recommended Entry Point**: `/specflow.start` - Routes you to the right command automatically.

| Command | Purpose |
|---------|---------|
| `/specflow.start` | **Primary entry point** - Auto-detect state, route to next step |
| `/specflow.init` | Requirements interview |
| `/specflow.orchestrate` | Full automated workflow |
| `/specflow.specify` | Create feature spec |
| `/specflow.plan` | Create implementation plan |
| `/specflow.tasks` | Generate task breakdown |
| `/specflow.implement` | Execute tasks |
| `/specflow.verify` | Verify completion |
| `/specflow.merge` | Complete phase, merge PR |
| `/specflow.memory` | Manage memory documents (incl. generate) |
| `/specflow.review` | Code review |

**Note**: For issue management, use the CLI directly: `specflow issue list`, `specflow issue create`, etc.
