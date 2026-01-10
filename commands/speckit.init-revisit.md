# Revisit Interview Phase

> **Note**: This command is deprecated. Use `/speckit.init revisit` instead.
> This file is kept for backwards compatibility.

Go back to a previous phase to update or add decisions.

## Arguments
$ARGUMENTS - Phase number to revisit (0-11)

## Actions

1. Parse phase number from arguments
2. Read `.specify/discovery/state.md` for current state
3. Read `.specify/discovery/decisions.md` for existing decisions in target phase
4. Set current phase to target phase
5. Show existing decisions from that phase
6. Resume questioning from that phase

## Output

```markdown
## Revisiting Phase [N]: [Phase Name]

### Existing Decisions from This Phase
[List decisions D-X through D-Y with summaries]

### Options
1. **Add new decisions** - Continue with additional questions
2. **Modify existing decision** - Update D-[X] with new information
3. **Mark decision as superseded** - Replace D-[X] with new decision

What would you like to do?
```

## Validation

- If phase number > current progress: ERROR "Cannot revisit phase not yet reached"
- If phase 11 (Memory Bootstrap): WARN "Revisiting will regenerate memory docs"

## User Input

```text
$ARGUMENTS
```
