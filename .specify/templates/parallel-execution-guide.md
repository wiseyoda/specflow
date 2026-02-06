# Parallel Execution Coordination Guide

This guide defines the standardized pattern for launching parallel work across all SpecFlow commands.

## Agent Teams Preference (Opus 4.6)

When Claude agent teams are available, they are the preferred execution mode for complex parallel work.

**Enablement check:**
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
- Current environment supports teams (CLI/editor support may vary)
- Project role agents exist under `.claude/agents/` (recommended)

**Fallback rule (mandatory):**
- If team mode is unavailable, unstable, or not supported in the current surface, run the same work units using Task agents.
- If Task agents are unavailable, run sequentially.

## When to Use Parallel Workers

Use parallel execution when:
- Multiple independent operations can run simultaneously
- Operations don't share write targets (no file conflicts)
- Combined latency would exceed 30+ seconds sequentially
- Operations can be cleanly scoped without overlap

Prefer **Agent Teams** for:
- 4+ concurrent work units
- Cross-artifact synthesis (scan + aggregate + summarize)
- Multi-step reasoning where a lead/aggregator agent adds value

Prefer **Task agents (fallback mode)** for:
- Lightweight read-only file extraction
- Simple fan-out where aggregation is trivial

## Standardized Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Timeout** | 180 seconds | Allows for codebase scans + thinking |
| **Max Agents** | 5 concurrent | Balance parallelism vs. resource usage |
| **Failure Threshold** | >50% fail = halt | Continue with partial results if minority fails |
| **Mode Order** | Agent Teams → Task agents → Sequential | Deterministic fallback chain |

## Execution Protocol

### 1. Pre-Launch Validation

Before launching any parallel workers:

```markdown
**Pre-launch checks**:
1. Verify all target files/directories exist
2. Define clear, non-overlapping scope for each worker
3. Identify any shared resources (files both agents might read/write)
4. If write conflicts possible, use sequential execution instead
```

### 2. Worker Launch Pattern

```markdown
**Launch N parallel workers** (Agent Teams preferred; Task agents fallback):

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

**CRITICAL**: Wait for ALL workers before proceeding:

```markdown
**Synchronization**:
- Wait for all workers to complete OR timeout
- Collect results in order: Agent 1, Agent 2, ..., Agent N
- Track which workers completed vs. timed out
```

### 4. Result Aggregation

```markdown
**Aggregate results**:
- Merge outputs from all workers
- Resolve conflicts: prefer more specific/recent findings
- Document source worker for traceability
- Note any missing results from timed-out workers
```

### 5. Error Handling

| Scenario | Action |
|----------|--------|
| 1 worker times out | Log warning, continue with available results |
| 1 worker fails | Log error, continue with available results |
| >50% workers fail | HALT execution, report failures |
| All workers timeout | ABORT with "Parallel execution failed" |
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
**Launch 2 parallel workers** (Agent Teams preferred; Task agents fallback) (timeout: 180s each):

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

**Synchronization**: Wait for both workers
**Aggregation**: Write both files from results
**On failure**: If 1 fails, continue with the other; if both fail, halt
```

## Example: Codebase Analysis

```markdown
**Launch 4 parallel workers** (Agent Teams preferred; Task agents fallback) (timeout: 180s each):

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

**Synchronization**: Wait for all 4 workers
**Aggregation**: Merge all issue lists, deduplicate by file:line
**Deduplication**: Same file:line → keep highest severity
```

## Anti-Patterns

**DON'T do these:**

1. **Overlapping writes**: Two workers writing to same file
2. **Missing sync barrier**: Proceeding before all workers complete
3. **No timeout handling**: Waiting forever for stuck worker
4. **Ignoring failures**: Not checking worker return status
5. **Unbounded parallelism**: Launching 10+ agents simultaneously

## Integration

All flow commands should reference this guide:

```markdown
See `.specify/templates/parallel-execution-guide.md` for the standardized
parallel worker coordination protocol (Agent Teams preferred; Task agents fallback).
```
