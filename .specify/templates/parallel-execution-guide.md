# Parallel Execution Coordination Guide

This guide defines the standardized pattern for launching parallel agents across all SpecFlow commands.

## When to Use Parallel Agents

Use parallel execution when:
- Multiple independent operations can run simultaneously
- Operations don't share write targets (no file conflicts)
- Combined latency would exceed 30+ seconds sequentially
- Operations can be cleanly scoped without overlap

## Standardized Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Timeout** | 180 seconds | Allows for codebase scans + thinking |
| **Max Agents** | 5 concurrent | Balance parallelism vs. resource usage |
| **Failure Threshold** | >50% fail = halt | Continue with partial results if minority fails |

## Execution Protocol

### 1. Pre-Launch Validation

Before launching any parallel agents:

```markdown
**Pre-launch checks**:
1. Verify all target files/directories exist
2. Define clear, non-overlapping scope for each agent
3. Identify any shared resources (files both agents might read/write)
4. If write conflicts possible, use sequential execution instead
```

### 2. Agent Launch Pattern

```markdown
**Launch N parallel Task agents**:

Agent 1 ([Purpose]):
  - Scope: [Specific files/directories]
  - Read: [Input files]
  - Write: [Output file - UNIQUE per agent]
  - Timeout: 180s
  → Return: [Expected output]

Agent 2 ([Purpose]):
  - Scope: [Specific files/directories]
  - Read: [Input files]
  - Write: [Output file - UNIQUE per agent]
  - Timeout: 180s
  → Return: [Expected output]
```

### 3. Synchronization Barrier

**CRITICAL**: Wait for ALL agents before proceeding:

```markdown
**Synchronization**:
- Wait for all agents to complete OR timeout
- Collect results in order: Agent 1, Agent 2, ..., Agent N
- Track which agents completed vs. timed out
```

### 4. Result Aggregation

```markdown
**Aggregate results**:
- Merge outputs from all agents
- Resolve conflicts: prefer more specific/recent findings
- Document source agent for traceability
- Note any missing results from timed-out agents
```

### 5. Error Handling

| Scenario | Action |
|----------|--------|
| 1 agent times out | Log warning, continue with available results |
| 1 agent fails | Log error, continue with available results |
| >50% agents fail | HALT execution, report failures |
| All agents timeout | ABORT with "Parallel execution failed" |
| Write conflict detected | HALT, resolve manually |

## Command-Specific Timeouts

Some operations need longer timeouts:

| Command | Default | Extended | Use Extended When |
|---------|---------|----------|-------------------|
| `/flow.design` | 180s | 300s | Large codebase context |
| `/flow.analyze` | 180s | 180s | Standard detection |
| `/flow.review` | 180s | 300s | Full codebase scan |
| `/flow.implement` | 180s | 300s | Complex task batches |

## Example: Checklist Generation

```markdown
**Launch 2 parallel Task agents** (timeout: 180s each):

Agent 1 (Implementation Checklist):
  - Scope: spec.md, plan.md
  - Read: .specify/templates/implementation-checklist-template.md
  - Write: checklists/implementation.md (UNIQUE)
  → Return: Implementation checklist content

Agent 2 (Verification Checklist):
  - Scope: spec.md, tasks.md
  - Read: .specify/templates/verification-checklist-template.md
  - Write: checklists/verification.md (UNIQUE)
  → Return: Verification checklist content

**Synchronization**: Wait for both agents
**Aggregation**: Write both files from results
**On failure**: If 1 fails, continue with the other; if both fail, halt
```

## Example: Codebase Analysis

```markdown
**Launch 4 parallel Task agents** (timeout: 180s each):

Agent 1 (Spec Analysis):
  - Scope: spec.md only
  - Detect: Ambiguity, duplicates, missing coverage
  → Return: List of spec issues

Agent 2 (Plan Analysis):
  - Scope: plan.md only
  - Detect: Constitution violations, tech conflicts
  → Return: List of plan issues

Agent 3 (Tasks Analysis):
  - Scope: tasks.md only
  - Detect: Format errors, missing dependencies
  → Return: List of task issues

Agent 4 (Coverage Analysis):
  - Scope: spec.md + tasks.md (read-only)
  - Detect: Goal coverage gaps
  → Return: Coverage matrix

**Synchronization**: Wait for all 4 agents
**Aggregation**: Merge all issue lists, deduplicate by file:line
**Deduplication**: Same file:line → keep highest severity
```

## Anti-Patterns

**DON'T do these:**

1. **Overlapping writes**: Two agents writing to same file
2. **Missing sync barrier**: Proceeding before all agents complete
3. **No timeout handling**: Waiting forever for stuck agent
4. **Ignoring failures**: Not checking agent return status
5. **Unbounded parallelism**: Launching 10+ agents simultaneously

## Integration

All flow commands should reference this guide:

```markdown
See `.specify/templates/parallel-execution-guide.md` for the standardized
parallel agent coordination protocol.
```
