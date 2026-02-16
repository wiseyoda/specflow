---
description: Non-destructive cross-artifact consistency analysis. Identifies issues before implementation.
---

## User Input

```text
$ARGUMENTS
```

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Tool Usage

**Use dedicated tools instead of bash for file operations:**

| Instead of (bash) | Use |
|---|---|
| `ls`, `find` | Glob tool |
| `grep`, `rg` | Grep tool |
| `cat`, `head`, `tail` | Read tool |
| `echo >`, heredoc writes | Write tool |

Reserve Bash for: `specflow` CLI, `git`, `pnpm`/`npm`, and other system commands.

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Design gate passed | `specflow check --gate design` | Run `/flow.design` |
| spec.md exists | `specflow status --json` → `context.hasSpec` | Run `/flow.design` |
| plan.md exists | `specflow status --json` → `context.hasPlan` | Run `/flow.design` |
| tasks.md exists | `specflow status --json` → `context.hasTasks` | Run `/flow.design` |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |

## Goal

Analyze spec.md, plan.md, and tasks.md for inconsistencies, gaps, and quality issues. This command runs AFTER `/flow.design` has produced all artifacts. If it finds any issues, it will report on those issues in a detailed way, fix all issues (no matter how small), and then run `/flow.analyze` again.

## Execution

### 0. Create Todo List

**Create todo list immediately (use TodoWrite):**

1. [ANALYZE] INITIALIZE - Get project status and verify gate
2. [ANALYZE] LOAD - Load all artifacts in parallel
3. [ANALYZE] DETECT - Run 9 detection passes
4. [ANALYZE] FIX - Auto-fix loop (max 5 iterations)
5. [ANALYZE] REPORT - Generate analysis report

Set [ANALYZE] INITIALIZE to in_progress.

### 1. Initialize

**Optimization**: If this command was invoked by `/flow.orchestrate` and you already
have `specflow status --json` output in context (within the last few tool calls),
reuse it instead of calling again.

```bash
specflow context --json --memory-keys constitution
```

This returns both status and memory doc contents in one call (see `status` and `memory` fields).
If `specflow context` is unavailable, fall back to `specflow status --json`.

Parse response:

- `context.featureDir` → FEATURE_DIR (abort if null) - e.g., `/path/to/project/specs/0060-github-integration`
- `phase.number` → PHASE_NUMBER (e.g., "0060")
- `context.hasSpec/hasPlan/hasTasks` → all must be true

**Path clarification**:
- `FEATURE_DIR` = `specs/NNNN-name/` - Active phase artifacts (spec.md, plan.md, tasks.md)
- `.specify/phases/NNNN-*.md` = Phase definition document (goals, scope, verification gate)

Use TodoWrite: mark [ANALYZE] INITIALIZE complete after gate check, mark [ANALYZE] LOAD in_progress.

**Gate verification (standalone only):**
If invoked by `/flow.orchestrate`, the orchestrator already verified `check --gate design` —
skip this call. If running standalone:

```bash
specflow check --gate design
```

Abort if gate fails - instruct user to run `/flow.design` first.

If `step.current` != "analyze", update state:

```bash
specflow state set orchestration.step.current=analyze orchestration.step.index=1 orchestration.step.status=in_progress
```

### 2. Load Artifacts (Parallel)

**Pre-load shared context before launching agents**: Read `.specify/memory/constitution.md`
FIRST in the parent, then pass its content to Agent 5 in the prompt rather than having
Agent 5 re-read it independently. This eliminates redundant reads of shared memory documents.

**Use parallel sub-agents** to load all artifacts simultaneously:

```
Launch 5 parallel workers (Agent Teams preferred; Task agents fallback) (subagent_type: Explore):

Team-mode role hints:
- `specflow-quality-auditor` for artifact extraction workers
- `specflow-memory-checker` for constitution/ui-memory coverage
- Parent orchestrator uses `specflow-coordinator` to build unified analysis context

Agent 1: Read `.specify/phases/{PHASE_NUMBER}-*.md` → extract goals, scope, deliverables
Agent 2: Read `{FEATURE_DIR}/spec.md` → extract requirements, user stories
Agent 3: Read `{FEATURE_DIR}/plan.md` → extract architecture, constraints
Agent 4: Read `{FEATURE_DIR}/tasks.md` → extract task IDs, descriptions, dependencies
Agent 5: Read `.specify/memory/constitution.md` + `{FEATURE_DIR}/ui-design.md` (if exists)
```

**Expected speedup**: ~80% faster artifact loading (5 parallel reads vs. sequential)

Wait for all agents to complete, then aggregate results into unified context object.

Use TodoWrite: mark [ANALYZE] LOAD complete, mark [ANALYZE] DETECT in_progress.

### 3. Detection Passes (Parallel)

**Use parallel sub-agents** to run all 9 detection passes simultaneously:

```
Launch 9 parallel workers (Agent Teams preferred; Task agents fallback) (subagent_type: Explore):

Team-mode role hints:
- Use `specflow-quality-auditor` for all pass workers (A-I)
- Parent orchestrator uses `specflow-coordinator` for severity ranking and deduplication

Pass A Agent: Phase Goals - Check goals in phase doc have spec requirements and tasks
Pass B Agent: Duplication - Find near-duplicate requirements in spec.md
Pass C Agent: Ambiguity - Find vague terms (fast, scalable) and placeholders (TODO, ???)
Pass D Agent: Underspecification - Find missing outcomes, undefined components
Pass E Agent: Constitution - Check MUST principles, mandated sections
Pass F Agent: Coverage Gaps - Find requirements without tasks, tasks without requirements
Pass G Agent: Inconsistency - Find terminology drift, conflicting tech choices
Pass H Agent: UI Coverage - Check ui-design.md components have implementing tasks
Pass I Agent: Integration Wiring — Check new modules have [W] tasks and caller mappings
```

**Expected speedup**: ~85% faster (8 parallel passes vs. sequential)

Each agent returns findings in format: `{pass: "A", findings: [{id, severity, location, summary, fix}]}`

**Aggregate results** after all agents complete (limit 50 findings total):

| Pass                      | Detects                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. Phase Goals**        | Goals in phase document without corresponding spec requirements or tasks (always CRITICAL)      |
| **B. Duplication**        | Near-duplicate requirements (mark lower-quality for consolidation)                              |
| **C. Ambiguity**          | Vague terms without metrics (fast, scalable, robust); unresolved placeholders (TODO, ???, TKTK) |
| **D. Underspecification** | Missing outcomes, undefined components, user stories without acceptance criteria                |
| **E. Constitution**       | MUST principle violations (always CRITICAL), missing mandated sections                          |
| **F. Coverage Gaps**      | Requirements with zero tasks; tasks with no mapped requirement                                  |
| **G. Inconsistency**      | Terminology drift, conflicting tech choices, ordering contradictions                            |
| **H. UI Coverage**        | Components in ui-design.md without implementing tasks; interactions not mapped to tasks         |
| **I. Integration Wiring** | New modules/services in tasks.md without [W] wiring tasks; modules without callers in plan.md Integration Architecture; WR-### requirements without corresponding tasks |

Use TodoWrite: mark [ANALYZE] DETECT complete, mark [ANALYZE] FIX in_progress.

### 4. Severity

- **CRITICAL**: Phase goal not covered, Constitution MUST violation, zero-coverage blocking requirement
- **HIGH**: Duplicate/conflicting requirements, untestable acceptance criteria, new module without any wiring task
- **MEDIUM**: Terminology drift, missing non-functional coverage
- **LOW**: Style/wording improvements

### 5. Output Report

Use the standardized goal coverage format from `.specify/templates/goal-coverage-template.md`:

```markdown
## Analysis Report

| ID  | Category    | Severity | Location       | Summary                  | Fix                         |
| --- | ----------- | -------- | -------------- | ------------------------ | --------------------------- |
| A1  | Phase Goals | CRITICAL | phase doc:L15  | Goal not in spec.md      | Add requirement to spec.md  |

## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Goal from phase doc | REQ-001 | T001-T005 | COVERED |
| 2 | Goal from phase doc | NONE | NONE | MISSING |

Coverage: 1/2 goals (50%)

## Requirements Coverage

| Requirement | Has Task? | Task IDs |
|-------------|-----------|----------|
| REQ-001 | Yes | T001-T005 |
| REQ-002 | No | - |

## Metrics

- Phase Goals: N | Covered: M | Coverage: X%
- Requirements: N | Tasks: M | Coverage: X%
- Critical: N | High: N | Medium: N | Low: N

**Unmapped Tasks:** (if any)
**Constitution Issues:** (if any)
```

Use TodoWrite: mark [ANALYZE] FIX complete after auto-fix loop finishes, mark [ANALYZE] REPORT in_progress.

### 6. State Transition

If **zero issues** found:

```bash
# Only set status=complete - orchestrate owns step transitions
specflow state set orchestration.step.status=complete
```

Use TodoWrite: mark [ANALYZE] REPORT complete.

Output: "Analysis clean. Ready for implementation."

If **issues found** (ANY severity, including LOW):

**Auto-fix loop with iteration limit:**

```
MAX_ITERATIONS = 5
iteration = 1

WHILE issues_exist AND iteration <= MAX_ITERATIONS:
  1. Group issues by file (spec.md, plan.md, tasks.md)
  2. Apply fixes per file:
     - Duplication: Keep higher-quality version
     - Ambiguity: Add measurable criteria
     - Coverage gap: Add requirement or task
     - Constitution violation: Modify to comply
  3. Re-run analysis: `/flow.analyze`
  4. iteration++

IF iteration > MAX_ITERATIONS AND issues still exist:
  - Present remaining issues to user
  - Ask: "Continue with N unresolved issues, or abort for manual fix?"
  - If user aborts: Set step.status=blocked, exit
```

**Persist iteration counter (survives compaction):**
```bash
specflow state set orchestration.analyze.iteration=$iteration
```

On resume after compaction, retrieve:
```bash
iteration=$(specflow state get orchestration.analyze.iteration 2>/dev/null || echo 1)
```

**Parallel fix agents (one per file):**

See `.specify/templates/parallel-execution-guide.md` for coordination protocol.

```
Group issues by file, then launch parallel workers (Agent Teams preferred; Task agents fallback) (timeout: 180s each):

Team-mode role hints:
- Use `specflow-fixer` for per-file fix workers
- Parent orchestrator uses `specflow-coordinator` to approve merged edits before re-run

Agent 1: Fix spec.md issues (duplications, ambiguity)
  - Scope: spec.md ONLY
  - Write: spec.md (UNIQUE - no other agent writes here)
  - Apply all spec.md fixes in one edit session
  → Return: updated spec.md

Agent 2: Fix plan.md issues (coverage gaps, inconsistencies)
  - Scope: plan.md ONLY
  - Write: plan.md (UNIQUE)
  → Return: updated plan.md

Agent 3: Fix tasks.md issues (missing tasks, wrong IDs)
  - Scope: tasks.md ONLY
  - Write: tasks.md (UNIQUE)
  → Return: updated tasks.md

**Synchronization**: Wait for ALL 3 agents before re-running analysis
**On failure**: 1 agent fails → continue with others; >1 fail → halt
```

**Auto-fix strategies:**

| Issue Type | Fix Strategy |
|------------|--------------|
| Duplication | Keep higher-quality version |
| Ambiguity | Add measurable criteria |
| Coverage gap | Add requirement or task |
| Constitution violation | Modify to comply OR flag for user |
| Integration wiring gap | Add [W] task to tasks.md referencing Integration Architecture from plan.md |

- Stay in analyze step until clean (do not advance)
- Output after each iteration: "Iteration N/5: Found M issues. Fixing..."
- **Do NOT dismiss issues as "minor"** - every inconsistency causes implementation bugs
- Only stop workflow if user explicitly aborts or critical issue requires manual intervention

## Constraints

- **Read-only outside of artifacts**: Do NOT modify any files except project artifacts
- **Constitution is non-negotiable**: Violations are always CRITICAL
- **Deterministic**: Re-running produces consistent IDs and counts
- **All severities block**: LOW/MEDIUM issues are not "minor" - they represent ambiguity that causes implementation bugs

## Parallel Agent Coordination

See `.specify/templates/parallel-execution-guide.md` for the complete standardized protocol.

When launching parallel agents (artifact loading, detection passes):

**1. Pre-launch**:
- Verify all required files exist before launching agents
- Each agent gets read-only access to its assigned files

**2. Execution**:
- Launch all agents simultaneously using Agent Teams (preferred) or Task tool (fallback)
- Set timeout: 180 seconds per agent (standardized)
- Agents work independently with no shared state

**3. Synchronization barrier**:
- Wait for ALL agents to complete before proceeding
- **CRITICAL PASS PROTECTION**: If Pass A (Goals) or Pass E (Constitution) times out → HALT immediately
  - Reason: Cannot determine phase scope or constitution compliance with partial results
  - Report: "Critical analysis pass failed - cannot proceed safely"
- Other passes: If timeout after 180s, continue with completed results
- Log which agents timed out for debugging

**4. Result aggregation**:
- Collect results from all completed agents
- Deduplicate: Same file:line → keep highest severity
- Severity ordering: CRITICAL > HIGH > MEDIUM > LOW
- Limit to 50 findings total (keep all CRITICAL/HIGH, truncate MEDIUM/LOW)

**5. Error handling**:
- 1 agent fails: Log warning, continue with other results
- >50% agents fail: Halt and report "Parallel execution failed"
- Timeout: Include partial results, note incomplete analysis

## Completion

**When analysis completes with zero issues:**

```bash
# Clear iteration counter, record completion time, signal completion (single call)
specflow state set orchestration.analyze.iteration=null orchestration.analyze.completedAt=$(date +%s) orchestration.step.status=complete
```

**When blocked (user aborts or max iterations with issues):**

```bash
specflow state set orchestration.step.status=blocked
```

Orchestrate will detect the status and present recovery options.
