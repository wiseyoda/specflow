---
version: '1.0'
description: 'SpecFlow CLI and slash command usage reference'
---

# SpecFlow Usage Reference

This document provides the complete CLI and slash command reference for SpecFlow.

## Quick Start

```bash
# In terminal
specflow --help           # CLI help

# In Claude Code
/specflow.start           # Smart entry point - routes to right command
```

## CLI Commands

### State Management

```bash
specflow state get [key]           # Show state (or specific key)
specflow state set key=value       # Update state value (NOTE: use = not space)
specflow state init                # Initialize new state file
specflow state reset               # Reset state to defaults
specflow state validate            # Check state file health
```

### Project Setup

```bash
specflow scaffold [--force]        # Create .specify/ structure
specflow doctor [--fix]            # Diagnostics and auto-repair (shows suggested fixes)
specflow detect                    # Detect existing content
specflow templates sync            # Update outdated + copy new templates
```

### Git Operations

```bash
specflow git branch create <name>  # Create and checkout branch
specflow git commit "<message>"    # Stage and commit
specflow git push                  # Push current branch
specflow git sync                  # Fetch all, show status
```

### ROADMAP Management

```bash
specflow roadmap status            # Show phase statuses
specflow roadmap update <N> <status>  # Update phase (complete, in_progress, etc.)
specflow roadmap next              # Get next pending phase
specflow roadmap insert --after <N> "<name>"  # Insert new phase
specflow roadmap defer <N>         # Defer phase to backlog
```

### Task Tracking

```bash
specflow tasks status              # Show completion percentage
specflow tasks list [--incomplete] # List tasks
specflow tasks mark T###           # Mark task complete
```

### Issue Tracking

```bash
specflow issue list [--open]       # List issues
specflow issue create "<title>"    # Create new issue
specflow issue close <id>          # Close an issue
specflow issue show <id>           # Show issue details
```

### Phase Management

```bash
specflow phase show <N>            # Show phase details
specflow phase list                # List all phases
specflow phase archive <N>         # Archive to HISTORY.md
```

### Memory Documents

```bash
specflow memory list               # List memory documents
specflow memory check              # Verify document health
```

## Slash Commands

### Primary Entry Point

```
/specflow.start                    # Auto-detect state, route to right command
```

### Workflow Commands

```
/specflow.init                     # Requirements interview
/specflow.orchestrate              # Full automated workflow (9 steps)
/specflow.orchestrate --no-discovery  # Skip codebase examination
/specflow.specify                  # Create feature spec
/specflow.clarify                  # Resolve ambiguities
/specflow.plan                     # Create implementation plan
/specflow.tasks                    # Generate task breakdown
/specflow.analyze                  # Cross-artifact check
/specflow.checklist                # Create verification checklist
/specflow.implement                # Execute tasks
/specflow.verify                   # Verify completion
/specflow.merge                    # Complete phase, merge PR
```

**Orchestrate steps**: discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify

### Memory Commands

```
/specflow.memory                   # Verify and reconcile memory docs
/specflow.memory generate          # Generate docs from codebase analysis
/specflow.constitution             # Create/update constitution
```

### Project Management

```
/specflow.roadmap                  # Create/update ROADMAP.md
/specflow.backlog                  # Triage backlog items
/specflow.phase                    # Create phases from PDRs
/specflow.review                   # Systematic code review
```

## CLI Syntax Notes

Important syntax patterns that differ from common conventions:

```bash
# State set uses key=value (NOT key value)
specflow state set orchestration.phase.status=complete    # Correct
specflow state set orchestration.phase.status complete    # Wrong

# State get uses dot notation
specflow state get orchestration.phase.status
specflow state get orchestration --json
```

## Common Patterns

### Starting a New Phase

```bash
# Option 1: Smart entry (recommended)
/specflow.start

# Option 2: Full automation
/specflow.orchestrate

# Option 3: Manual workflow
/specflow.specify "Add user authentication"
/specflow.clarify
/specflow.plan
/specflow.tasks
# ... etc
```

### Completing a Phase

```bash
# Verify all tasks complete
specflow tasks status

# Complete phase
/specflow.merge

# Or complete and start next phase
/specflow.merge --next-phase
```

### Resuming Work

```bash
# Check current state
specflow status

# Resume via smart entry
/specflow.start
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Command not found" | Check PATH includes `~/.claude/specflow-system/bin` |
| State file corrupt | Run `specflow doctor --fix` |
| Branch mismatch | Run `specflow reconcile` |
| Missing artifacts | Re-run the producing step |
| Missing templates | Run `specflow templates sync` |

### Diagnostics

```bash
specflow doctor                    # Full diagnostic check
specflow doctor --fix              # Auto-repair issues
specflow status --json             # Current state as JSON
```

## More Information

- Full documentation: See `README.md` and `docs/` folder
- CLI help: `specflow --help` or `specflow <command> --help`
- Slash command help: Reference `commands/specflow.*.md` files
