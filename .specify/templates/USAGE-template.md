---
version: '1.0'
description: 'SpecKit CLI and slash command usage reference'
---

# SpecKit Usage Reference

This document provides the complete CLI and slash command reference for SpecKit.

## Quick Start

```bash
# In terminal
speckit --help           # CLI help

# In Claude Code
/speckit.start           # Smart entry point - routes to right command
```

## CLI Commands

### State Management

```bash
speckit state get [key]           # Show state (or specific key)
speckit state set key=value       # Update state value (NOTE: use = not space)
speckit state init                # Initialize new state file
speckit state reset               # Reset state to defaults
speckit state validate            # Check state file health
```

### Project Setup

```bash
speckit scaffold [--force]        # Create .specify/ structure
speckit doctor [--fix]            # Diagnostics and auto-repair (shows suggested fixes)
speckit detect                    # Detect existing content
speckit templates sync            # Update outdated + copy new templates
```

### Git Operations

```bash
speckit git branch create <name>  # Create and checkout branch
speckit git commit "<message>"    # Stage and commit
speckit git push                  # Push current branch
speckit git sync                  # Fetch all, show status
```

### ROADMAP Management

```bash
speckit roadmap status            # Show phase statuses
speckit roadmap update <N> <status>  # Update phase (complete, in_progress, etc.)
speckit roadmap next              # Get next pending phase
speckit roadmap insert --after <N> "<name>"  # Insert new phase
speckit roadmap defer <N>         # Defer phase to backlog
```

### Task Tracking

```bash
speckit tasks status              # Show completion percentage
speckit tasks list [--incomplete] # List tasks
speckit tasks mark T###           # Mark task complete
```

### Issue Tracking

```bash
speckit issue list [--open]       # List issues
speckit issue create "<title>"    # Create new issue
speckit issue close <id>          # Close an issue
speckit issue show <id>           # Show issue details
```

### Phase Management

```bash
speckit phase show <N>            # Show phase details
speckit phase list                # List all phases
speckit phase archive <N>         # Archive to HISTORY.md
```

### Memory Documents

```bash
speckit memory list               # List memory documents
speckit memory check              # Verify document health
```

## Slash Commands

### Primary Entry Point

```
/speckit.start                    # Auto-detect state, route to right command
```

### Workflow Commands

```
/speckit.init                     # Requirements interview
/speckit.orchestrate              # Full automated workflow (9 steps)
/speckit.orchestrate --no-discovery  # Skip codebase examination
/speckit.specify                  # Create feature spec
/speckit.clarify                  # Resolve ambiguities
/speckit.plan                     # Create implementation plan
/speckit.tasks                    # Generate task breakdown
/speckit.analyze                  # Cross-artifact check
/speckit.checklist                # Create verification checklist
/speckit.implement                # Execute tasks
/speckit.verify                   # Verify completion
/speckit.merge                    # Complete phase, merge PR
```

**Orchestrate steps**: discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify

### Memory Commands

```
/speckit.memory                   # Verify and reconcile memory docs
/speckit.memory generate          # Generate docs from codebase analysis
/speckit.constitution             # Create/update constitution
```

### Project Management

```
/speckit.roadmap                  # Create/update ROADMAP.md
/speckit.backlog                  # Triage backlog items
/speckit.phase                    # Create phases from PDRs
/speckit.review                   # Systematic code review
```

## CLI Syntax Notes

Important syntax patterns that differ from common conventions:

```bash
# State set uses key=value (NOT key value)
speckit state set orchestration.phase.status=complete    # Correct
speckit state set orchestration.phase.status complete    # Wrong

# State get uses dot notation
speckit state get orchestration.phase.status
speckit state get orchestration --json
```

## Common Patterns

### Starting a New Phase

```bash
# Option 1: Smart entry (recommended)
/speckit.start

# Option 2: Full automation
/speckit.orchestrate

# Option 3: Manual workflow
/speckit.specify "Add user authentication"
/speckit.clarify
/speckit.plan
/speckit.tasks
# ... etc
```

### Completing a Phase

```bash
# Verify all tasks complete
speckit tasks status

# Complete phase
/speckit.merge

# Or complete and start next phase
/speckit.merge --next-phase
```

### Resuming Work

```bash
# Check current state
speckit status

# Resume via smart entry
/speckit.start
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Command not found" | Check PATH includes `~/.claude/speckit-system/bin` |
| State file corrupt | Run `speckit doctor --fix` |
| Branch mismatch | Run `speckit reconcile` |
| Missing artifacts | Re-run the producing step |
| Missing templates | Run `speckit templates sync` |

### Diagnostics

```bash
speckit doctor                    # Full diagnostic check
speckit doctor --fix              # Auto-repair issues
speckit status --json             # Current state as JSON
```

## More Information

- Full documentation: See `README.md` and `docs/` folder
- CLI help: `speckit --help` or `speckit <command> --help`
- Slash command help: Reference `commands/speckit.*.md` files
