# Focus Interview on Topic

> **Note**: This command is deprecated. Use `/speckit.init focus` instead.
> This file is kept for backwards compatibility.

Prioritize questions on a specific topic across relevant phases.

## Arguments
$ARGUMENTS - Topic to focus on (e.g., "security", "performance", "API design", "testing")

## Actions

1. Read `.specify/discovery/context.md` for project context
2. Read `.specify/discovery/state.md` for current progress
3. Identify phases and questions relevant to "$ARGUMENTS"
4. Reorder question priority to front-load focused topic
5. Mark topic as "focus area" in state

## Topic to Phase Mapping

| Focus Topic | Primary Phases | Key Questions |
|-------------|----------------|---------------|
| security | 4 (NFR), 6 (Errors) | Auth, authorization, data protection, input validation |
| performance | 4 (NFR), 8 (Ops) | Latency, throughput, resource constraints, monitoring |
| scalability | 4 (NFR), 5 (Arch) | Growth, dimensions, ceiling, cost scaling |
| API design | 3 (Functional), 5 (Arch) | Contracts, formats, versioning, documentation |
| testing | 9 (Testing) | Strategy, coverage, automation, acceptance |
| UX | 7 (UX), 2 (Users) | Interaction, onboarding, accessibility |
| data | 3 (Functional), 5 (Arch) | Storage, access, consistency, migration |
| operations | 8 (Ops), 6 (Errors) | Monitoring, logging, recovery, runbooks |
| architecture | 5 (Arch) | Components, communication, deployment |
| AI/ML | 3 (Functional), 4 (NFR) | Data, evaluation, bias, drift, safety |

## Output

```markdown
## Interview Focus: $ARGUMENTS

### Relevant Phases
| Phase | Relevance | Questions Added |
|-------|-----------|-----------------|
| [Phase N] | Primary | +8 focused questions |
| [Phase M] | Secondary | +4 focused questions |

### Focus Questions for $ARGUMENTS

**Phase [N]: [Name]**
1. [Topic-specific question]
2. [Topic-specific question]
3. [Topic-specific question]
4. [Topic-specific question]

**Phase [M]: [Name]**
1. [Topic-specific question]
2. [Topic-specific question]

### Memory Documents Affected
This focus will provide extra input for:
- `[relevant-doc].md` - [How]
- `[relevant-doc].md` - [How]

### Current Phase Adjustment
[If currently in a phase that covers this topic, pivot now]
[If not yet reached relevant phase, note when focus kicks in]

### Continuing with Focus...
[Resume interview with topic-focused questions]
```

## Example Focus Areas

### `/speckit.init-focus security`
Adds questions about:
- Trust boundaries and threat model
- Authentication mechanisms
- Authorization granularity
- Data classification
- Encryption requirements
- Audit logging needs
- Compliance requirements
- Input validation strategy

### `/speckit.init-focus performance`
Adds questions about:
- Latency budgets per operation
- Throughput requirements
- Resource constraints (memory, CPU, cost)
- Caching strategy
- Database query patterns
- CDN/edge requirements
- Load testing approach

### `/speckit.init-focus AI`
Adds questions about:
- Training data sources
- Model selection criteria
- Evaluation metrics
- Bias detection and mitigation
- Model drift monitoring
- Content safety requirements
- Fallback strategies
- Cost management

## User Input

```text
$ARGUMENTS
```
