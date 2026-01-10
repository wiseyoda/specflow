# Accelerate Interview

> **Note**: This command is deprecated. Use `/speckit.init faster` instead.
> This file is kept for backwards compatibility.

Speed up the initialization interview by asking more questions per round and skipping optional phases.

## Actions

1. Read `.specify/discovery/state.md` for current state
2. Read `.specify/discovery/context.md` for project criticality
3. Determine which phases can be abbreviated based on:
   - Project criticality (prototype can skip more)
   - Project type (skip irrelevant phases)
4. Update interview mode to "fast"

## Fast Mode Changes

| Aspect | Normal Mode | Fast Mode |
|--------|-------------|-----------|
| Questions per round | 4 | 6-8 |
| Optional phases | Include | Skip or abbreviate |
| Follow-up depth | 5 Whys | 2 Whys |
| Decision detail | Full format | Abbreviated |

## Phase Adjustments by Criticality

### Prototype/Internal Projects
Skip entirely:
- Phase 8: Operations (minimal)
- Phase 10: Evolution (defer)

Abbreviate (2 questions each):
- Phase 6: Errors & Recovery
- Phase 7: UX (unless UI-focused)

### Production Projects
Abbreviate only:
- Phase 10: Evolution (2 questions)

Keep full:
- Everything else (production needs thorough coverage)

### Mission-Critical
No acceleration allowed - warn user and suggest `/speckit.init-deeper` instead.

## Output

```markdown
## Interview Mode: FAST

**Estimated remaining time**: [X] rounds (down from [Y])

### Phases Adjusted
| Phase | Original | Fast Mode |
|-------|----------|-----------|
| Phase 6: Errors | 16 questions | 4 questions |
| Phase 8: Operations | 12 questions | Skipped |
| Phase 10: Evolution | 12 questions | Skipped |

### Trade-offs
- Less coverage in: [list areas]
- Memory docs affected: [list docs with reduced input]

### To Restore Normal Mode
Run `/speckit.init-deeper` or just continue - mode resets at next phase.

### Continuing in Fast Mode...
[Resume with adjusted question count]
```

## User Input

```text
$ARGUMENTS
```
