# CLI Reference

Complete reference for the `speckit` command-line interface.

## Overview

```bash
speckit <command> [subcommand] [options]
```

All commands support `--help` for detailed usage and `--json` for machine-readable output.

---

## Core Commands

### state - State File Operations

Manage the `.specify/orchestration-state.json` file.

```bash
speckit state get                    # Show full state
speckit state get orchestration      # Get specific section
speckit state set "key=value"        # Set value
speckit state init                   # Initialize state file (generates UUID)
speckit state reset                  # Reset to defaults
speckit state validate               # Validate state structure
speckit state migrate                # Migrate v1.x to v2.0 schema
```

**Registry subcommands:**
```bash
speckit state registry list          # List all registered projects
speckit state registry sync          # Sync registry with current project
speckit state registry clean         # Remove stale entries
```

### scaffold - Project Setup

Create the `.specify/` directory structure.

```bash
speckit scaffold                     # Create structure (auto-detects project type)
speckit scaffold --safe              # Preview what would be created
speckit scaffold --status            # Show what exists vs needed
speckit scaffold --force             # Recreate (overwrites existing)
speckit scaffold --type python       # Force specific project type
speckit scaffold --skip-templates    # Don't copy templates
speckit scaffold --skip-scripts      # Don't copy scripts
```

**Detected project types:** typescript, javascript, python, rust, go, bash, generic

### context - Project Context

Get information about the current feature/phase context.

```bash
speckit context                      # Show context (JSON)
speckit context --check              # Verify prerequisites
speckit context --summary            # Human-readable summary
speckit context --require-spec       # Require spec.md exists
speckit context --require-plan       # Require plan.md exists
speckit context --require-tasks      # Require tasks.md exists
```

### doctor - Diagnostics

Run health checks and auto-fix issues.

```bash
speckit doctor                       # Run all checks
speckit doctor --fix                 # Auto-fix issues found
speckit doctor --check <area>        # Check specific area only
```

**Valid check areas:** `system`, `project`, `state`, `manifest`, `paths`, `git`, `templates`, `version`, `roadmap`, `reality`, `all`

**Suggested fixes:** Doctor displays actionable fix commands for detected issues (e.g., `speckit templates sync`, `speckit doctor --fix`).

### status - Comprehensive Status

Get full project status (used by orchestrate).

```bash
speckit status                       # Full status report
speckit status --json                # JSON output
speckit status --quick               # Skip deep validation
```

---

## Feature & Phase Management

### feature - Feature Operations

```bash
speckit feature create <phase> <name>  # Create feature directory and branch
speckit feature list                   # List all features
speckit feature current                # Show current feature
```

**Example:**
```bash
speckit feature create 0010 user-auth  # Creates specs/0010-user-auth/
```

### roadmap - ROADMAP.md Operations

```bash
speckit roadmap status               # Show all phases with status
speckit roadmap next                 # Get next pending phase
speckit roadmap current              # Get current in-progress phase
speckit roadmap update <phase> <status>  # Update phase status
speckit roadmap validate             # Check ROADMAP.md structure
speckit roadmap renumber             # Smart renumber all phases (fills gaps)
```

**Valid statuses:** `pending`, `in_progress`, `complete`, `blocked`, `deferred`

### phase - Phase Detail Management

Manage individual phase detail files in `.specify/phases/`.

```bash
speckit phase list                   # List all phases with location
speckit phase list --active          # Show only active phases
speckit phase show <num>             # Show phase details
speckit phase create <num> <name>    # Create phase detail file
speckit phase archive <num>          # Archive to HISTORY.md
speckit phase migrate                # Migrate inline ROADMAP to files
speckit phase path [num]             # Show phase file path
```

### issue - Local Issue Tracking

Manage issues in `.specify/issues/`.

```bash
speckit issue list                   # List all issues
speckit issue list --open            # List open issues only
speckit issue show <id>              # Show issue details
speckit issue create "<title>"       # Create new issue
speckit issue close <id>             # Close an issue
speckit issue update <id>            # Update issue fields
speckit issue migrate                # Migrate issues from ROADMAP.md
speckit issue path [id]              # Show issue file path
```

---

## Task & Checklist Management

### tasks - Task Operations

```bash
speckit tasks status                 # Task completion summary
speckit tasks status <file>          # Status for specific tasks.md
speckit tasks incomplete             # List incomplete tasks
speckit tasks mark <task_id>         # Mark task complete
speckit tasks phase-status           # Status grouped by phase
speckit tasks list                   # List all tasks
speckit tasks find                   # Find all tasks.md files
```

### checklist - Checklist Operations

```bash
speckit checklist status             # All checklists completion status
speckit checklist status <dir>       # Status for specific directory
speckit checklist list               # List all checklists
speckit checklist incomplete         # List incomplete items
speckit checklist show <file>        # Show specific checklist
```

---

## Git Operations

### git - Git Shortcuts

```bash
speckit git branch create <name>     # Create and checkout branch
speckit git branch checkout <name>   # Checkout existing branch
speckit git branch current           # Show current branch
speckit git branch list              # List all branches
speckit git commit "<message>"       # Stage all and commit
speckit git merge <branch>           # Merge branch to current
speckit git push                     # Push current branch
speckit git sync                     # Fetch all, show status
```

---

## Memory & Documentation

### memory - Memory Document Operations

```bash
speckit memory init constitution     # Initialize constitution.md
speckit memory init tech-stack       # Initialize tech-stack.md
speckit memory init recommended      # Initialize recommended docs
speckit memory init all              # Initialize all memory docs
speckit memory list                  # List documents with status
speckit memory check                 # Check document health
```

### lessons - Lessons Learned

```bash
speckit lessons init                 # Initialize lessons-learned.md
speckit lessons add error "<desc>"   # Add error entry
speckit lessons add decision "<desc>"  # Add decision entry
speckit lessons add gotcha "<desc>"  # Add gotcha entry
speckit lessons check <keyword>      # Search lessons
speckit lessons list                 # List all entries
```

### claude-md - CLAUDE.md Operations

```bash
speckit claude-md update "<phase>" "<desc>"  # Add to Recent Changes
speckit claude-md sync               # Sync from ROADMAP completions
speckit claude-md show               # Show current content
```

---

## Validation & Quality

### gate - Validation Gates

Enforce quality gates between workflow stages.

```bash
speckit gate specify                 # Validate spec.md before planning
speckit gate plan                    # Validate plan.md before tasks
speckit gate tasks                   # Validate tasks.md before implement
speckit gate implement               # Validate before verification
speckit gate all                     # Run all applicable gates
speckit gate status                  # Show gate status
```

---

## Templates

### templates - Template Management

```bash
speckit templates list               # List available templates
speckit templates check              # Check for upstream updates
speckit templates copy <file>        # Copy template to project
speckit templates update <file>      # Update specific template
speckit templates update-all         # Update all templates
speckit templates sync               # Update outdated + copy missing templates
speckit templates diff <file>        # Show differences from upstream
```

**Note:** `speckit doctor` suggests `speckit templates sync` when templates need attention. Missing templates are flagged as errors since they can cause workflow failures.

---

## Detection & Reconciliation

### detect - Content Detection

```bash
speckit detect                       # Detect all existing content
speckit detect --check system        # Check system installation
speckit detect --check speckit       # Check SpecKit structure
speckit detect --check docs          # Check documentation
speckit detect --check state         # Check state file
speckit detect --check files         # Check file structure
```

### reconcile - State Reconciliation

Sync state file with actual file system.

```bash
speckit reconcile                    # Reconcile state with files
speckit reconcile --dry-run          # Preview changes only
speckit reconcile --trust-files      # Trust file system over state
speckit reconcile --trust-state      # Trust state over file system
```

---

## Import & Migration

### import - Import Existing Docs

```bash
speckit import adrs <path>           # Import Architecture Decision Records
speckit import adrs <path> --dry-run # Preview import
speckit import adrs <path> --force   # Overwrite existing imports
```

### migrate - Migration Utilities

```bash
speckit migrate roadmap              # Migrate ROADMAP.md 2.0 to 2.1
                                     # (converts 3-digit to 4-digit phases)
```

---

## Advanced Commands

### manifest - Version Manifest

```bash
speckit manifest init                # Create manifest.json
speckit manifest get [key]           # Get version info
speckit manifest set <key> <val>     # Set version value
speckit manifest validate            # Validate compatibility
speckit manifest upgrade             # Apply available upgrades
speckit manifest status              # Show version status
```

### pdr - Product Design Requirements

```bash
speckit pdr list                     # List all PDRs with status
speckit pdr status                   # Show PDR summary (counts)
speckit pdr show <file>              # Show PDR details
speckit pdr validate <file>          # Validate PDR structure
speckit pdr path                     # Show PDR directory path
speckit pdr init                     # Create PDR directory
```

---

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help for any command |
| `--json` | Output in JSON format (where supported) |
| `-v, --verbose` | Verbose output |

---

## Examples

```bash
# Initial setup
speckit scaffold --safe              # Preview structure
speckit scaffold                     # Create structure
speckit doctor                       # Verify everything works

# Feature development
speckit feature create 0010 user-auth
speckit roadmap update 0010 in_progress
speckit tasks incomplete             # Check remaining work

# End of phase
speckit gate all                     # Validate before merge
speckit phase archive 0010           # Archive completed phase
```
