# CLI Reference

Complete reference for the `specflow` command-line interface (v3.0).

## Overview

```bash
specflow <command> [options]
```

All commands support `--help` for detailed usage and `--json` for machine-readable output.

---

## Smart Commands (TypeScript)

These are the primary commands for SpecFlow v3.0. They provide rich, contextual output designed for efficient Claude Code integration.

### status - Complete Project Status

Get comprehensive project status in a single call.

```bash
specflow status                       # Human-readable status
specflow status --json                # JSON output for Claude
specflow status --quick               # Skip deep validation
```

**Output includes:**
- Current phase, step, and progress
- Health status and issues
- Next recommended action
- Blockers and context

### next - Next Actionable Task

Get the next task to work on with full context.

```bash
specflow next                         # Human-readable output
specflow next --json                  # JSON output
specflow next --section "Phase 2"     # Filter by section
```

**Output includes:**
- Task ID, description, and location
- Dependencies (met/unmet)
- File hints from task description
- Section context and remaining tasks

### mark - Mark Tasks Complete

Mark one or more tasks or checklist items as complete/incomplete.

```bash
specflow mark T007                    # Mark single task complete
specflow mark T007 T008 T009          # Mark multiple tasks
specflow mark T007..T010              # Mark range
specflow mark T007 --incomplete       # Mark as incomplete
specflow mark V-001                   # Mark verification checklist item
specflow mark I-001 I-002             # Mark implementation items
specflow mark --json                  # JSON output
```

**Output includes:**
- Updated task status
- New progress percentage
- Next recommended task

### check - Deep Validation

Run comprehensive validation with auto-fix support.

```bash
specflow check                        # Human-readable output
specflow check --json                 # JSON output
specflow check --fix                  # Auto-fix fixable issues
specflow check --gate design          # Check specific gate only
specflow check --gate implement       # Check implementation gate
specflow check --gate verify          # Check verification gate
specflow check --gate memory          # Check memory document health
```

**Output includes:**
- Gate status (design, implement, verify, memory)
- Issues with severity and fix suggestions
- Auto-fixable issue count
- Suggested next action

### state - State Operations

Manage the `.specflow/orchestration-state.json` file.

```bash
specflow state                        # Show full state (alias for 'show')
specflow state show                   # Show full state
specflow state get                    # Show full state
specflow state get orchestration.phase.number  # Get specific value
specflow state set "key=value"        # Set value
specflow state init                   # Initialize state file
specflow state sync                   # Sync with central registry
```

### phase - Phase Lifecycle

Manage the phase lifecycle: open, close, defer items, add phases.

```bash
specflow phase                        # Show current phase (alias for 'status')
specflow phase status                 # Current phase info
specflow phase open 0020              # Start an existing phase
specflow phase open --hotfix          # Create and start a hotfix phase
specflow phase open --hotfix "name"   # Create hotfix with custom name
specflow phase close                  # Close current phase
specflow phase close --dry-run        # Preview what would happen
specflow phase defer "item"           # Add item to BACKLOG.md
specflow phase defer "a" "b" -p P1    # Add multiple items with priority
specflow phase add 0010 "core-engine" # Add new phase to ROADMAP
specflow phase add 0020 "api" --user-gate --gate "API works"  # With gate
```

**Phase open:**
- Creates/switches to feature branch
- Initializes state for the phase
- Hotfix mode auto-calculates phase number

**Phase close:**
- Updates ROADMAP.md status to complete
- Archives state to `.specify/history/`
- Supports dry-run preview

**Phase defer:**
- Adds items to project BACKLOG.md
- Supports priority levels (P1, P2, P3)
- Optional reason for deferring

**Phase add:**
- Adds a new phase to ROADMAP.md
- Supports USER GATE specification
- Auto-creates phase detail file

---

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help for any command |
| `--json` | Output in JSON format |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable color output |

---

## Examples

```bash
# Get project orientation (start of session)
specflow status --json

# Find next task to work on
specflow next --json

# Complete a task
specflow mark T007

# Complete multiple tasks
specflow mark T007 T008 T009

# Mark checklist items
specflow mark V-001 V-002

# Validate before committing
specflow check --fix

# Check specific gate
specflow check --gate implement

# Start a new phase
specflow phase open 0020

# Close current phase
specflow phase close

# Defer items to backlog
specflow phase defer "Handle edge case X"
```

---

## Deprecated Commands

The following bash commands are deprecated in v3.0. They will display an error with migration guidance:

| Old Command | Replacement |
|-------------|-------------|
| `specflow context` | `specflow status` |
| `specflow doctor` | `specflow check --fix` |
| `specflow detect` | `specflow status` |
| `specflow tasks incomplete` | `specflow next` |
| `specflow tasks mark` | `specflow mark` |
| `specflow gate` | `specflow check --gate` |
| `specflow reconcile` | `specflow check --fix` |
| `specflow scaffold` | Use `/flow.init` slash command |
| `specflow memory` | Use `/flow.memory` slash command |
| `specflow templates` | Use `/flow.init` slash command |
| `specflow dashboard` | (Removed in v3.0) |
| `specflow git` | Use git directly |
| `specflow roadmap` | Use `/flow.roadmap` slash command |
| `specflow manifest` | (Removed in v3.0) |

Running a deprecated command shows:
```
ERROR: Command 'doctor' is deprecated in SpecFlow v3.0

The TypeScript CLI replaces bash scripts with 6 smart commands:
  specflow status   - Complete project status (replaces: context, doctor, detect)
  specflow next     - Next task with context (replaces: tasks incomplete)
  specflow mark     - Mark tasks done (replaces: tasks mark)
  specflow check    - Validation & auto-fix (replaces: gate, reconcile)
  specflow state    - State operations (same as before)
  specflow phase    - Phase lifecycle (open/close/status/defer/add)
```
