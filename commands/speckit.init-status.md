# SpecKit Init Status

> **Note**: This command is deprecated. Use `/speckit.init status` instead.
> This file is kept for backwards compatibility.

Show current progress in the project initialization interview.

## Actions

1. Read `.specify/discovery/state.md` for phase progress
2. Read `.specify/discovery/decisions.md` for decision count
3. Read `.specify/discovery/context.md` for project info
4. Calculate memory document coverage

## Output Format

```markdown
## SpecKit Initialization Status

### Project: [Name from context.md]
**Type**: [Project type] | **Stage**: [Stage] | **Criticality**: [Level]

---

### Phase Progress

| Phase | Status | Decisions | Progress |
|-------|--------|-----------|----------|
| 0: Discovery | [status] | [N] | [bar] |
| 1: Problem & Vision | [status] | [N] | [bar] |
| ... | ... | ... | ... |
| 11: Memory Bootstrap | [status] | [N] | [bar] |

**Overall**: [X]/12 phases complete | [Y] decisions captured

---

### Memory Document Coverage

| Document | Decisions | Status |
|----------|-----------|--------|
| constitution.md | [N] | [Ready/Partial/Empty] |
| tech-stack.md | [N] | [Ready/Partial/Empty] |
| coding-standards.md | [N] | [Ready/Partial/Empty] |
| api-standards.md | [N] | [Ready/Partial/Empty] |
| security-checklist.md | [N] | [Ready/Partial/Empty] |
| testing-strategy.md | [N] | [Ready/Partial/Empty] |
| glossary.md | [N] | [Ready/Partial/Empty] |
| adrs/ | [N] | [Ready/Partial/Empty] |

---

### Open Questions
[List from state.md]

### Contradictions
[List from state.md, if any]

---

### Next Steps
- Current phase: [Phase N: Name]
- Next question: Q[X]
- Suggested action: [Continue / Resolve contradictions / Export]
```

## User Input

```text
$ARGUMENTS
```
