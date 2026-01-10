# Skip Interview Phase

> **Note**: This command is deprecated. Use `/speckit.init skip` instead.
> This file is kept for backwards compatibility.

Skip the current phase of the initialization interview.

## Arguments
$ARGUMENTS - Optional reason for skipping

## Actions

1. Read `.specify/discovery/state.md` for current phase
2. Mark current phase as "skipped" with reason (if provided)
3. Record skip decision in `.specify/discovery/decisions.md`
4. Advance to next phase
5. Update state.md

## Output

```markdown
## Phase Skipped

**Phase**: [N]: [Phase Name]
**Reason**: [User reason or "No reason provided"]

### Impact on Memory Documents
The following documents will have less coverage:
- [List affected memory docs]

### Continuing to Phase [N+1]: [Next Phase Name]
[Brief description of what this phase covers]
```

## Validation

Before skipping, check if phase is critical based on project context:
- If criticality = "mission-critical" and phase is security-related: WARN strongly
- If phase has dependencies on later phases: WARN about implications

## User Input

```text
$ARGUMENTS
```
