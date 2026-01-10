# Compare Options for Interview Decision

> **Note**: This command is deprecated. Use `/speckit.init compare` instead.
> This file is kept for backwards compatibility.

Compare two or more approaches to inform an interview decision.

## Arguments
$ARGUMENTS - Options to compare (e.g., "REST vs GraphQL", "PostgreSQL vs MongoDB vs SQLite")

## Actions

1. Read `.specify/discovery/context.md` for project context
2. Read `.specify/discovery/decisions.md` for relevant prior decisions
3. Parse options from "$ARGUMENTS" (split by "vs" or spaces)
4. Research each option using Task tool with Explore agent
5. Present comparison with memory document impact

## Comparison Framework

For each option, evaluate:

| Criterion | Weight (based on project) |
|-----------|---------------------------|
| Fits project type | High |
| Team familiarity | Medium-High |
| Maintenance burden | Medium |
| Performance | Based on NFRs |
| Scalability | Based on NFRs |
| Security | Based on criticality |
| Cost | Based on constraints |
| Community/Support | Medium |
| Learning curve | Based on timeline |

## Output Format

```markdown
## Comparison: $ARGUMENTS

### Project Context
- Type: [from context.md]
- Criticality: [from context.md]
- Key constraints: [from context.md]
- Relevant decisions: [D-X, D-Y that affect this choice]

### Options Analysis

#### [Option A]
| Criterion | Rating | Notes |
|-----------|--------|-------|
| Fits project | [1-3 stars] | [why] |
| Team familiarity | [1-3 stars] | [notes] |
| ... | ... | ... |

**Best for**: [scenarios]
**Watch out for**: [risks]
**Memory Doc Impact**: [Which documents this affects]

#### [Option B]
[Same format]

### Head-to-Head

| Criterion | Option A | Option B |
|-----------|----------|----------|
| [criterion] | [rating] | [rating] |
| ... | ... | ... |

### Recommendation

For this project, **[Option X]** is recommended because:
1. [Reason tied to project context]
2. [Reason tied to prior decisions]
3. [Reason tied to constraints]

**Trade-off accepted**: [What you give up]

### Memory Document Impact
This decision will affect:
- `tech-stack.md`: [How]
- `[other docs]`: [How]

### Follow-up Questions
To finalize this decision, consider asking:
- [Question 1]
- [Question 2]

### Decision Template
\`\`\`markdown
#### D-N: [Topic] - [Chosen Option]
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: [Comparison summary]
- **Decision**: [Chosen option]
- **Alternatives**: [Options not chosen with brief why]
- **Consequences**: Enables [...], Constrains [...]
- **Memory Doc Impact**: tech-stack.md, [others]
\`\`\`
```

After comparison, use AskUserQuestion to confirm the choice or gather more input.

## User Input

```text
$ARGUMENTS
```
