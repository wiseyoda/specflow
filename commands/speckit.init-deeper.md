# Deepen Interview

> **Note**: This command is deprecated. Use `/speckit.init deeper` instead.
> This file is kept for backwards compatibility.

Slow down the initialization interview for more thorough exploration using the 5 Whys technique.

## Actions

1. Read `.specify/discovery/state.md` for current state
2. Read `.specify/discovery/decisions.md` for recent decisions
3. Update interview mode to "deep"
4. Apply 5 Whys to recent decisions

## Deep Mode Changes

| Aspect | Normal Mode | Deep Mode |
|--------|-------------|-----------|
| Questions per round | 4 | 2 |
| Follow-up depth | Surface | 5 Whys technique |
| Decision validation | Basic | Cross-check with prior |
| Alternatives explored | 2-3 | 4-5 with trade-offs |

## The 5 Whys Technique

For each major decision, probe deeper:
1. **Why this approach?** - Surface reasoning
2. **Why not alternatives?** - Understand trade-offs
3. **Why is this important?** - Connect to project goals
4. **Why now vs later?** - Timing implications
5. **Why you vs someone else?** - Team/resource fit

## Deep Mode Process

For each question:
1. Ask the main question
2. For significant answers, ask "Why?" follow-ups
3. Explore implications for related decisions
4. Check for contradictions with prior decisions
5. Document full reasoning chain in decision

### Enhanced Decision Format
```markdown
#### D-N: [Title]
- **Phase**: [Phase]
- **Status**: Decided
- **Confidence**: High (validated through 5 Whys)
- **Context**: [Why this came up]
- **Decision**: [What was decided]
- **Why This?**: [First-level reasoning]
- **Why Not Alternatives?**:
  - [Alt 1]: Rejected because [reason]
  - [Alt 2]: Rejected because [reason]
- **Why Important?**: [Connection to project goals]
- **Why Now?**: [Timing rationale]
- **Consequences**: Enables [...], Constrains [...], Requires [...]
- **Dependencies**: [D-X, D-Y]
- **Memory Doc Impact**: [Affected documents]
```

## Output

```markdown
## Interview Mode: DEEP

**Estimated remaining time**: [X] rounds (up from [Y])

### Benefits of Deep Mode
- Higher confidence decisions
- Better understood trade-offs
- Fewer contradictions later
- Richer memory documents

### Recent Decisions to Deepen
| Decision | Current Confidence | Suggested Follow-up |
|----------|-------------------|---------------------|
| D-5: [Title] | Medium | Apply 5 Whys |
| D-8: [Title] | Low | Explore alternatives |

### Continuing in Deep Mode...
Let's apply the 5 Whys to your most recent decision:

**D-[N]: [Title]**
You decided [summary]. Let me understand this better:

1. **Why this approach?**
   [Ask for reasoning]
```

## User Input

```text
$ARGUMENTS
```
