---
description: Non-destructive cross-artifact consistency analysis. Identifies issues before implementation.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Analyze spec.md, plan.md, and tasks.md for inconsistencies, gaps, and quality issues. This command runs AFTER `/flow.design` has produced all artifacts. It is **read-only** - findings are output for the next agent to fix.

## Execution

### 1. Initialize

```bash
specflow status --json
```

Parse response:
- `context.featureDir` → FEATURE_DIR (abort if null)
- `context.hasSpec/hasPlan/hasTasks` → all must be true

```bash
specflow check --gate design
```

Abort if gate fails - instruct user to run `/flow.design` first.

If `step.current` != "analyze", update state:
```bash
specflow state set orchestration.step.current=analyze orchestration.step.index=1
```

### 2. Load Artifacts

From FEATURE_DIR:
- `spec.md` - requirements, user stories, edge cases
- `plan.md` - architecture, phases, constraints
- `tasks.md` - task IDs, descriptions, dependencies, file paths

From project root:
- `.specify/memory/constitution.md` - principles for compliance check

### 3. Detection Passes

Analyze for these issue categories (limit 50 findings total):

| Pass | Detects |
|------|---------|
| **A. Duplication** | Near-duplicate requirements (mark lower-quality for consolidation) |
| **B. Ambiguity** | Vague terms without metrics (fast, scalable, robust); unresolved placeholders (TODO, ???, TKTK) |
| **C. Underspecification** | Missing outcomes, undefined components, user stories without acceptance criteria |
| **D. Constitution** | MUST principle violations (always CRITICAL), missing mandated sections |
| **E. Coverage Gaps** | Requirements with zero tasks; tasks with no mapped requirement |
| **F. Inconsistency** | Terminology drift, conflicting tech choices, ordering contradictions |

### 4. Severity

- **CRITICAL**: Constitution MUST violation, zero-coverage blocking requirement
- **HIGH**: Duplicate/conflicting requirements, untestable acceptance criteria
- **MEDIUM**: Terminology drift, missing non-functional coverage
- **LOW**: Style/wording improvements

### 5. Output Report

```markdown
## Analysis Report

| ID | Category | Severity | Location | Summary | Fix |
|----|----------|----------|----------|---------|-----|
| A1 | Duplication | HIGH | spec.md:L42-48 | Two similar requirements | Merge, keep clearer version |

**Coverage Summary:**
| Requirement | Has Task? | Task IDs |
|-------------|-----------|----------|

**Metrics:**
- Requirements: N | Tasks: M | Coverage: X%
- Critical: N | High: N | Medium: N | Low: N

**Unmapped Tasks:** (if any)
**Constitution Issues:** (if any)
```

### 6. State Transition

If **zero issues** found:
```bash
specflow state set orchestration.step.current=implement orchestration.step.index=2
```
Output: "Analysis clean. Ready for implementation."

If **issues found**:
- Stay in analyze step (do not advance)
- Output: "Found N issues (X critical). Fix all before proceeding."

## Constraints

- **Read-only**: Do NOT modify any files
- **Constitution is non-negotiable**: Violations are always CRITICAL
- **Deterministic**: Re-running produces consistent IDs and counts
