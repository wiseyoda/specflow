# CLI Reference

Complete reference for the `specflow` command-line interface.

## Overview

```bash
specflow <command> [subcommand] [options]
```

All commands support `--help` for detailed usage and `--json` for machine-readable output.

---

## Core Commands

### state - State File Operations

Manage the `.specify/orchestration-state.json` file.

```bash
specflow state get                    # Show full state
specflow state get orchestration      # Get specific section
specflow state set "key=value"        # Set value
specflow state init                   # Initialize state file (generates UUID)
specflow state reset                  # Reset to defaults
specflow state validate               # Validate state structure
specflow state migrate                # Migrate v1.x to v2.0 schema
```

**Registry subcommands:**
```bash
specflow state registry list          # List all registered projects
specflow state registry sync          # Sync registry with current project
specflow state registry clean         # Remove stale entries
```

### scaffold - Project Setup

Create the `.specify/` directory structure.

```bash
specflow scaffold                     # Create structure (auto-detects project type)
specflow scaffold --safe              # Preview what would be created
specflow scaffold --status            # Show what exists vs needed
specflow scaffold --force             # Recreate (overwrites existing)
specflow scaffold --type python       # Force specific project type
specflow scaffold --skip-templates    # Don't copy templates
specflow scaffold --skip-scripts      # Don't copy scripts
```

**Detected project types:** typescript, javascript, python, rust, go, bash, generic

### context - Project Context

Get information about the current feature/phase context.

```bash
specflow context                      # Show context (JSON)
specflow context --check              # Verify prerequisites
specflow context --summary            # Human-readable summary
specflow context --require-spec       # Require spec.md exists
specflow context --require-plan       # Require plan.md exists
specflow context --require-tasks      # Require tasks.md exists
```

### doctor - Diagnostics

Run health checks and auto-fix issues.

```bash
specflow doctor                       # Run all checks
specflow doctor --fix                 # Auto-fix issues found
specflow doctor --check <area>        # Check specific area only
```

**Valid check areas:** `system`, `project`, `state`, `manifest`, `paths`, `git`, `templates`, `version`, `roadmap`, `reality`, `all`

**Suggested fixes:** Doctor displays actionable fix commands for detected issues (e.g., `specflow templates sync`, `specflow doctor --fix`).

### status - Comprehensive Status

Get full project status (used by orchestrate).

```bash
specflow status                       # Full status report
specflow status --json                # JSON output
specflow status --quick               # Skip deep validation
```

---

## Feature & Phase Management

### feature - Feature Operations

```bash
specflow feature create <phase> <name>  # Create feature directory and branch
specflow feature list                   # List all features
specflow feature current                # Show current feature
```

**Example:**
```bash
specflow feature create 0010 user-auth  # Creates specs/0010-user-auth/
```

### roadmap - ROADMAP.md Operations

```bash
specflow roadmap status               # Show all phases with status
specflow roadmap next                 # Get next pending phase
specflow roadmap current              # Get current in-progress phase
specflow roadmap update <phase> <status>  # Update phase status
specflow roadmap validate             # Check ROADMAP.md structure
specflow roadmap renumber             # Smart renumber all phases (fills gaps)
```

**Valid statuses:** `pending`, `in_progress`, `complete`, `blocked`, `deferred`

### phase - Phase Detail Management

Manage individual phase detail files in `.specify/phases/`.

```bash
specflow phase list                   # List all phases with location
specflow phase list --active          # Show only active phases
specflow phase show <num>             # Show phase details
specflow phase create <num> <name>    # Create phase detail file
specflow phase archive <num>          # Archive to HISTORY.md
specflow phase migrate                # Migrate inline ROADMAP to files
specflow phase path [num]             # Show phase file path
```

### issue - Local Issue Tracking

Manage issues in `.specify/issues/`.

```bash
specflow issue list                   # List all issues
specflow issue list --open            # List open issues only
specflow issue show <id>              # Show issue details
specflow issue create "<title>"       # Create new issue
specflow issue close <id>             # Close an issue
specflow issue update <id>            # Update issue fields
specflow issue migrate                # Migrate issues from ROADMAP.md
specflow issue path [id]              # Show issue file path
```

---

## Task & Checklist Management

### tasks - Task Operations

```bash
specflow tasks status                 # Task completion summary
specflow tasks status <file>          # Status for specific tasks.md
specflow tasks incomplete             # List incomplete tasks
specflow tasks mark <task_id>         # Mark task complete
specflow tasks phase-status           # Status grouped by phase
specflow tasks list                   # List all tasks
specflow tasks find                   # Find all tasks.md files
```

### checklist - Checklist Operations

```bash
specflow checklist status             # All checklists completion status
specflow checklist status <dir>       # Status for specific directory
specflow checklist list               # List all checklists
specflow checklist incomplete         # List incomplete items
specflow checklist show <file>        # Show specific checklist
```

---

## Git Operations

### git - Git Shortcuts

```bash
specflow git branch create <name>     # Create and checkout branch
specflow git branch checkout <name>   # Checkout existing branch
specflow git branch current           # Show current branch
specflow git branch list              # List all branches
specflow git commit "<message>"       # Stage all and commit
specflow git merge <branch>           # Merge branch to current
specflow git push                     # Push current branch
specflow git sync                     # Fetch all, show status
```

---

## Memory & Documentation

### memory - Memory Document Operations

```bash
specflow memory init constitution     # Initialize constitution.md
specflow memory init tech-stack       # Initialize tech-stack.md
specflow memory init recommended      # Initialize recommended docs
specflow memory init all              # Initialize all memory docs
specflow memory list                  # List documents with status
specflow memory check                 # Check document health
```

### lessons - Lessons Learned

```bash
specflow lessons init                 # Initialize lessons-learned.md
specflow lessons add error "<desc>"   # Add error entry
specflow lessons add decision "<desc>"  # Add decision entry
specflow lessons add gotcha "<desc>"  # Add gotcha entry
specflow lessons check <keyword>      # Search lessons
specflow lessons list                 # List all entries
```

### claude-md - CLAUDE.md Operations

```bash
specflow claude-md update "<phase>" "<desc>"  # Add to Recent Changes
specflow claude-md sync               # Sync from ROADMAP completions
specflow claude-md show               # Show current content
```

---

## Validation & Quality

### gate - Validation Gates

Enforce quality gates between workflow stages.

```bash
specflow gate specify                 # Validate spec.md before planning
specflow gate plan                    # Validate plan.md before tasks
specflow gate tasks                   # Validate tasks.md before implement
specflow gate implement               # Validate before verification
specflow gate all                     # Run all applicable gates
specflow gate status                  # Show gate status
```

---

## Templates

### templates - Template Management

```bash
specflow templates list               # List available templates
specflow templates check              # Check for upstream updates
specflow templates copy <file>        # Copy template to project
specflow templates update <file>      # Update specific template
specflow templates update-all         # Update all templates
specflow templates sync               # Update outdated + copy missing templates
specflow templates diff <file>        # Show differences from upstream
```

**Note:** `specflow doctor` suggests `specflow templates sync` when templates need attention. Missing templates are flagged as errors since they can cause workflow failures.

---

## Detection & Reconciliation

### detect - Content Detection

```bash
specflow detect                       # Detect all existing content
specflow detect --check system        # Check system installation
specflow detect --check specflow       # Check SpecFlow structure
specflow detect --check docs          # Check documentation
specflow detect --check state         # Check state file
specflow detect --check files         # Check file structure
```

### reconcile - State Reconciliation

Sync state file with actual file system.

```bash
specflow reconcile                    # Reconcile state with files
specflow reconcile --dry-run          # Preview changes only
specflow reconcile --trust-files      # Trust file system over state
specflow reconcile --trust-state      # Trust state over file system
```

---

## Import & Migration

### import - Import Existing Docs

```bash
specflow import adrs <path>           # Import Architecture Decision Records
specflow import adrs <path> --dry-run # Preview import
specflow import adrs <path> --force   # Overwrite existing imports
```

### migrate - Migration Utilities

```bash
specflow migrate roadmap              # Migrate ROADMAP.md 2.0 to 2.1
                                     # (converts 3-digit to 4-digit phases)
```

---

## Advanced Commands

### manifest - Version Manifest

```bash
specflow manifest init                # Create manifest.json
specflow manifest get [key]           # Get version info
specflow manifest set <key> <val>     # Set version value
specflow manifest validate            # Validate compatibility
specflow manifest upgrade             # Apply available upgrades
specflow manifest status              # Show version status
```

### pdr - Product Design Requirements

```bash
specflow pdr list                     # List all PDRs with status
specflow pdr status                   # Show PDR summary (counts)
specflow pdr show <file>              # Show PDR details
specflow pdr validate <file>          # Validate PDR structure
specflow pdr path                     # Show PDR directory path
specflow pdr init                     # Create PDR directory
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
specflow scaffold --safe              # Preview structure
specflow scaffold                     # Create structure
specflow doctor                       # Verify everything works

# Feature development
specflow feature create 0010 user-auth
specflow roadmap update 0010 in_progress
specflow tasks incomplete             # Check remaining work

# End of phase
specflow gate all                     # Validate before merge
specflow phase archive 0010           # Archive completed phase
```
