# Pause Interview

> **Note**: This command is deprecated. Use `/speckit.init pause` instead.
> This file is kept for backwards compatibility.

Save state and pause the initialization interview for later.

## Actions

1. Read current state from `.specify/discovery/state.md`
2. Update state with pause timestamp
3. Summarize progress and next steps

## Output

```markdown
## Interview Paused

**Paused at**: [timestamp]
**Current Phase**: [N]: [Phase Name]
**Last Question**: Q[X]

### Progress Summary
- **Phases Complete**: [X]/12
- **Decisions Captured**: [Y]
- **Memory Docs Ready**: [Z]

### State Saved
All progress saved to `.specify/discovery/`:
- `state.md` - Interview progress
- `context.md` - Project context
- `decisions.md` - All decisions ([Y] total)

### To Resume
Run `/speckit.init` in this project directory. The interview will continue from Phase [N], Question [X].

### Quick Actions Available
- `/speckit.init-status` - Review current state
- `/speckit.init-validate` - Check for issues
- `/speckit.init-export summary` - Generate progress summary
```

## User Input

```text
$ARGUMENTS
```
