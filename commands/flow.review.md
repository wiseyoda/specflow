---
description: Perform systematic code reviews and generate findings that can be triaged into implementation phases.
handoffs:
  - label: Start Implementation
    agent: specflow.orchestrate
    prompt: Continue with the review phase
  - label: View Roadmap
    agent: specflow.roadmap
    prompt: Show roadmap status
  - label: Continue Later
    agent: specflow.orchestrate
    prompt: Resume development workflow
---

## User Input

```text
$ARGUMENTS
```

Arguments:
- Empty: Run full interactive review with category-by-category approval
- `--dry-run`: Generate findings without creating phase (preview mode)
- `--categories <list>`: Review only specified categories (comma-separated: BP,RF,HD,MF,OC,OE,OD,SC,UI)
- `--fix`: Auto-approve findings with effort ≤4, defer effort=5 items, then auto-run `/flow.orchestrate`

You **MUST** consider the user input before proceeding (if not empty).

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| ROADMAP.md exists | `cat ROADMAP.md` | Run `/flow.roadmap` |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |
| Codebase to review | `ls -la` | Need code to review |
| Git repo | `git status` | Initialize git repo |

## Goal

Perform a systematic code review across 7 categories, generate findings with effort/impact/severity ratings, allow interactive user approval, create an implementation phase for approved items, and defer rejected items to the backlog.

This is a **refinement** workflow focused on:
- Implementing coding best practices
- Identifying refactoring opportunities
- Recommending hardening improvements
- Finding missing/incomplete features
- Cleaning up orphaned code
- Simplifying over-engineered solutions
- Updating outdated documentation

**Constraints**:
- Does NOT propose brand new features
- Does NOT break existing functionality without confirmation
- Focus on technical debt reduction and code quality

---

## Review Categories

| Code | Category | Focus |
|------|----------|-------|
| BP | Best Practices | Coding standards violations, anti-patterns, inconsistencies |
| RF | Refactoring | Code duplication, complex functions (>100 lines), poor structure |
| HD | Hardening | Error handling gaps, input validation, security patterns |
| MF | Missing Features | TODOs, FIXMEs, stub functions, incomplete implementations |
| OC | Orphaned Code | Unused exports, dead code, unreferenced files |
| OE | Over-Engineering | Excessive abstraction, unused flexibility, premature optimization |
| OD | Outdated Docs | Stale comments, README mismatches, incorrect examples |
| SC | Spec Compliance | Implementation doesn't match spec.md requirements (if phase artifacts exist) |
| UI | UI Compliance | UI doesn't match ui-design.md mockups (if ui-design.md exists) |

## Rating Scales (1-5)

| Rating | Effort | Impact | Severity |
|--------|--------|--------|----------|
| 1 | Trivial (<30 min) | Minimal | Suggestion |
| 2 | Small (30 min - 2 hr) | Minor | Low |
| 3 | Moderate (2-8 hr) | Moderate | Medium |
| 4 | Significant (1-3 days) | Significant | High |
| 5 | Major (>3 days) | Critical | Blocking |

---

## Execution Flow

### Step 0: Create Todo List

**Create todo list immediately (use TodoWrite):**

1. [REVIEW] INITIALIZE - Get project status and create review ID
2. [REVIEW] CONTEXT - Load memory and phase documents
3. [REVIEW] SCAN - Run 9 category scans in parallel
4. [REVIEW] APPROVE - Get user approval for each category
5. [REVIEW] DOCUMENT - Write review document
6. [REVIEW] PHASE - Create phase and defer items
7. [REVIEW] COMPLETE - Summary and next steps

Set [REVIEW] INITIALIZE to in_progress.

### Step 1: Initialize Review Context

**Get project status:**
```bash
specflow status --json
```

**Extract key values** (if reviewing a specific phase):
```bash
PHASE_NUMBER=$(... | jq -r '.phase.number')     # e.g., "0060"
FEATURE_DIR=$(... | jq -r '.context.featureDir') # e.g., /path/to/project/specs/0060-github-integration
```

Verify:
- Project has ROADMAP.md
- Memory documents available (constitution.md at minimum)

**Create reviews directory** if needed and generate review ID:
- Format: `review-YYYYMMDD-HHMMSS` (e.g., `review-20260111-143025`)

Use TodoWrite: mark [REVIEW] INITIALIZE complete, mark [REVIEW] CONTEXT in_progress.

---

### Step 2: Load Context Documents

Read memory documents to understand project standards:

**Required:**
- `.specify/memory/constitution.md` - Core principles (violations are CRITICAL)

**Recommended (if available):**
- `.specify/memory/coding-standards.md` - Style guidelines
- `.specify/memory/tech-stack.md` - Approved technologies
- `.specify/memory/testing-strategy.md` - Testing requirements

**If reviewing a specific phase** (phase artifacts exist):

Load phase artifacts to verify implementation matches intent:
- `.specify/phases/${PHASE_NUMBER}-*.md` - **Phase goals (source of truth)**
- `${FEATURE_DIR}/spec.md` - Requirements and acceptance criteria
- `${FEATURE_DIR}/ui-design.md` (if exists) - UI component specifications

Where `FEATURE_DIR` = `specs/NNNN-name/` from `context.featureDir` in status output.

Use these documents as the baseline for evaluating findings.

Use TodoWrite: mark [REVIEW] CONTEXT complete, mark [REVIEW] SCAN in_progress.

---

### Step 3: Systematic Codebase Scan (Parallel)

**Use parallel sub-agents** to scan all 9 categories simultaneously:

```
Launch 9 parallel workers (Agent Teams preferred; Task agents fallback) (subagent_type: Explore):

Team-mode role hints:
- Use `specflow-review-scanner` for all category scan workers
- Parent orchestrator uses `specflow-coordinator` for finding ID assignment and deduplication

Agent BP: Best Practices - anti-patterns, inconsistent naming, error codes
Agent RF: Refactoring - functions >100 lines, deep nesting, duplication
Agent HD: Hardening - unvalidated inputs, missing error handling, security
Agent MF: Missing Features - TODOs, FIXMEs, stubs, incomplete implementations
Agent OC: Orphaned Code - unused functions, unreferenced files, dead code
Agent OE: Over-Engineering - unused abstractions, premature optimization
Agent OD: Outdated Docs - README mismatches, stale comments
Agent SC: Spec Compliance - implementation vs spec.md requirements
Agent UI: UI Compliance - implementation vs ui-design.md mockups
```

**Expected speedup**: 9x faster (all categories scanned in parallel)

Each agent returns: `{category: "BP", findings: [{id, file, lines, problem, fix, effort, impact, severity}]}`

**Category-specific scan focus:**

| Category | What to Look For |
|----------|------------------|
| BP | Compare against coding-standards.md; check for anti-patterns, inconsistent naming, missing error codes |
| RF | Functions >100 lines, deep nesting (>3 levels), duplicate code blocks, complex conditionals |
| HD | Missing `set -euo pipefail`, unvalidated inputs, missing error handling, security gaps |
| MF | TODO/FIXME comments, stub implementations, placeholder values, incomplete error messages |
| OC | Unused functions, unreferenced files, dead code paths, commented-out code blocks |
| OE | Unused abstractions, over-parameterized functions, premature optimization, excessive indirection |
| OD | README doesn't match implementation, stale comments, incorrect usage examples |

**Phase-specific checks (if phase artifacts loaded):**

| Check | What to Look For |
|-------|------------------|
| **Spec Compliance** | Implementation doesn't match spec.md requirements; missing acceptance criteria; functional requirements not implemented |
| **UI Design Compliance** | UI doesn't match ui-design.md mockups; missing components from inventory; interactions not working as specified |
| **Phase Goal Drift** | Implementation diverged from original phase goals; scope creep; goals not achieved |

**Aggregate findings** from all 9 agents, assign IDs (BP001, RF001, etc.), cross-reference related items.

**For each finding, capture:**

| Field | Required | Description |
|-------|----------|-------------|
| File path(s) | Yes | Exact file paths affected |
| Line number(s) | Yes | Specific line numbers or ranges (e.g., `45-52`) |
| Problem | Yes | What the issue is (1 sentence) |
| Context | Yes | Why this matters - the impact or risk (1-2 sentences) |
| Code snippet | Recommended | Brief example of the problematic pattern (2-5 lines) |
| Recommendation | Yes | Specific fix approach with concrete details |
| Fix example | Recommended | Before/after code or pattern to follow |
| Verification | Yes | How to confirm the fix is correct (test command, manual check) |
| Related files | If applicable | Other files with same pattern that need similar treatment |
| Effort/Impact/Severity | Yes | Ratings 1-5 per scale above |

**Finding quality checklist:**
- [ ] Would a developer unfamiliar with this code understand the problem?
- [ ] Is the recommendation specific enough to implement without further research?
- [ ] Are related occurrences grouped or cross-referenced?

**Finding ID format:** `{CATEGORY_CODE}{NNN}` (e.g., BP001, RF003, HD012)

Use TodoWrite: mark [REVIEW] SCAN complete, mark [REVIEW] APPROVE in_progress.

---

### Step 4: Category Approval

**If `--fix` flag is set:** Use AUTO-APPROVE mode.
**Otherwise:** Use INTERACTIVE mode.

#### AUTO-APPROVE Mode (--fix)

**CRITICAL: Check for Severity 5 (Blocking) findings first:**

```bash
# Scan all findings for severity: 5
BLOCKING=$(echo "$FINDINGS" | grep -c '"severity": 5' || echo 0)
```

**If ANY findings have Severity=5:**
- Display all Severity=5 findings with full context
- Output: "Cannot auto-approve - {N} BLOCKING findings detected"
- Switch to INTERACTIVE mode for user approval
- User must explicitly handle each blocking finding (approve or defer)

**If no Severity=5 findings, auto-triage by effort:**
- **Effort ≤4**: Approve (anything under "major" effort)
- **Effort 5**: Defer to backlog (major tasks)

Display summary and skip to Step 5.

#### INTERACTIVE Mode

For each category with findings, present to user using `AskUserQuestion`:

**Display category summary with context:**

```
Category: Best Practices (BP) - 5 findings

┌─────────────────────────────────────────────────────────────────────────────┐
│ BP001 | phase/add.ts:45-52 | E:2 I:3 S:3                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Problem: Using generic Error instead of typed SpecflowError                 │
│ Context: Generic errors lose error codes and make debugging harder.         │
│          Other commands use SpecflowError consistently.                     │
│ Fix: Replace `throw new Error(msg)` with `throw new ValidationError(msg)`   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ BP002 | lib/common.sh:112 | E:1 I:2 S:2                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Problem: Missing function documentation                                      │
│ Context: Functions without docs are harder to maintain and often misused.   │
│ Fix: Add brief comment block describing purpose and parameters              │
└─────────────────────────────────────────────────────────────────────────────┘
...

Summary: 5 findings | Total Effort: 8 | Avg Severity: 2.4
```

Ask for approval:
- **Include ALL** - Add all findings from this category to phase
- **Include SOME** - Select specific findings to include (show IDs)
- **Include NONE** - Defer entire category to backlog

Track decisions: `approved = ["BP001", "BP003", ...]`, `deferred = ["BP002", ...]`

Use TodoWrite: mark [REVIEW] APPROVE complete, mark [REVIEW] DOCUMENT in_progress.

---

### Step 5: Write Review Document (Parallel)

Create review file at `.specify/reviews/review-YYYYMMDD-HHMMSS.md`:

**Use parallel sub-agents** to assemble document sections simultaneously:

```
Launch 4 parallel workers (Agent Teams preferred; Task agents fallback):

Team-mode role hints:
- Use `specflow-doc-assembler` for document section workers
- Parent orchestrator uses `specflow-coordinator` for final section ordering

Agent 1 (Summary): Build header, executive summary, summary table
Agent 2 (Approved): Format all approved findings in detailed format
Agent 3 (Deferred): Format all deferred findings with rationale
Agent 4 (Guidance): Build implementation guidance, patterns, verification commands
```

**Expected speedup**: 4x faster document assembly

**Document sections:**

1. **Header**: Date, author (Claude), scope, category count
2. **Executive Summary**: High-level findings overview, key risks, recommended priorities
3. **Summary Table**: Count of findings/approved/deferred per category
4. **Approved Findings** (detailed format below)
5. **Deferred Findings** (with rationale for deferral)
6. **Implementation Guidance** (agent-ready reference)
7. **Cross-references**: Phase number, backlog items, related memory docs

**Assemble** sections from all 4 agents in order: Summary → Approved → Deferred → Guidance

**Approved Finding Format** (use for each finding):

```markdown
### {ID}: {Brief Title}

**Location**: `{file_path}:{line_numbers}`
**Ratings**: Effort={E} | Impact={I} | Severity={S}

**Problem**: {What is wrong}

**Context**: {Why this matters - the risk or impact if not fixed}

**Current Code**:
```{language}
{2-5 lines showing the problematic pattern}
```

**Recommendation**: {Specific fix approach}

**Example Fix**:
```{language}
{Corrected code or pattern to follow}
```

**Verification**:
- {How to confirm the fix works}
- {Test command or manual check}

**Related Files**: {Other files needing similar treatment, if any}
```

**Deferred Finding Format** (abbreviated):

```markdown
### {ID}: {Brief Title}

**Location**: `{file_path}:{line_numbers}`
**Ratings**: Effort={E} | Impact={I} | Severity={S}
**Problem**: {What is wrong}
**Deferral Reason**: {Why this was deferred - user decision, needs research, etc.}
```

**Implementation Guidance Section** (agent-ready quick reference):

```markdown
## Implementation Guidance

This section provides consolidated guidance for the implementing agent.

### Files by Priority

Group findings by file, ordered by severity:

| File | Findings | Total Effort | Priority |
|------|----------|--------------|----------|
| `{file_path}` | {ID1}, {ID2} | {sum} | {High/Medium/Low} |

### Patterns to Apply

Common patterns that appear across multiple findings:

#### Pattern: {Pattern Name}
**Applies to**: {ID1}, {ID2}, {ID3}
**Files**: `{file1}`, `{file2}`

**Before**:
```{language}
{problematic pattern}
```

**After**:
```{language}
{corrected pattern}
```

### Standards Reference

Relevant project standards (from memory docs):
- {Link to or excerpt from constitution.md if relevant}
- {Link to or excerpt from coding-standards.md if relevant}

### Verification Commands

```bash
# Type checking
pnpm --filter @specflow/cli build

# Run tests
pnpm --filter @specflow/cli test

# Specific test for {category}
pnpm --filter @specflow/cli test {test-file}
```

### Implementation Order

Recommended order based on dependencies and risk:

1. **{ID}** - {reason this should be first, e.g., "foundational change"}
2. **{ID}** - {reason}
3. ...
```

Use TodoWrite: mark [REVIEW] DOCUMENT complete, mark [REVIEW] PHASE in_progress.

---

### Step 6: Create Phase (if approved findings exist)

Skip if `--dry-run` or no approved findings.

**Create hotfix phase:**
```bash
specflow phase open --hotfix "Code Review YYYYMMDD"
```

This auto-calculates the next available hotfix number (e.g., 0080 → 0081) and:
- Adds phase row to ROADMAP.md
- Creates phase detail file in `.specify/phases/`
- Sets orchestration state to new phase

---

### Step 7: Defer Items to Backlog

For each deferred finding:
```bash
specflow phase defer "[ID] [Category]: [Brief finding]"
```

Or batch multiple items:
```bash
specflow phase defer "BP002: Missing function docs" "RF005: Complex validation logic"
```

Use TodoWrite: mark [REVIEW] PHASE complete, mark [REVIEW] COMPLETE in_progress.

---

### Step 8: Summary Output

Display completion summary:
```
Code Review Complete

Review ID: review-20260111-143025
Document: .specify/reviews/review-20260111-143025.md

Summary:
  Categories reviewed: 7
  Total findings: 42
  Approved: 31
  Deferred: 11

Phase Created: 0081 - Code Review 20260111
Backlog Updated: 11 items added

Next Steps:
  1. Run /flow.orchestrate to build spec/plan/tasks
  2. Review generated tasks before implementation
```

Use TodoWrite: mark [REVIEW] COMPLETE complete.

---

### Step 9: Auto-Orchestrate (--fix mode only)

When `--fix` flag is set, automatically chain to orchestrate:

```
Auto-Fix Mode: Chaining to Orchestrate

Phase 0081 created with 35 approved findings.
Starting implementation workflow...
```

Invoke `/flow.orchestrate` for the newly created phase.

---

## Dry Run Mode

When `--dry-run` is specified:
- Execute all scan and analysis steps
- Display findings and approval prompts
- Write review document
- **DO NOT** create phase in ROADMAP
- **DO NOT** add items to backlog
- Show what would have been created

---

## Error Handling

| Error | Response |
|-------|----------|
| No ROADMAP.md | "Run `/flow.roadmap` to create a roadmap first" |
| No constitution.md | "Run `/flow.init` to initialize project first" |
| No findings found | "Codebase looks clean! No review phase needed." |
| User cancels mid-review | Save partial findings to review doc, mark as "incomplete" |

---

## Operating Principles

This command **MUST NOT**:
- Propose brand new features (only improve existing code)
- Suggest breaking changes without explicit user confirmation
- Auto-approve any findings in interactive mode
- Modify any code during the review (read-only analysis)

**Finding Quality**:
- Each finding must be actionable (specific recommendation with example)
- Each finding must reference exact file paths and line numbers
- Each finding must explain WHY it's a problem (context/risk)
- Each finding should include verification steps
- Group related findings and cross-reference common patterns
- Prioritize constitution violations (always CRITICAL)
- The review document must be self-contained for implementation (no re-discovery needed)

---

## Parallel Agent Coordination

When launching parallel agents (category scans, document assembly):

**1. Pre-launch**:
- Load memory documents and phase artifacts BEFORE launching scan agents
- Verify spec.md exists for SC category, ui-design.md for UI category
- Skip SC/UI agents if corresponding artifacts don't exist

**2. Execution**:
- Launch all 9 category scan agents simultaneously
- Set timeout: 180 seconds per scan agent (codebase scans take longer)
- Launch 4 document assembly agents after scans complete

**3. Synchronization**:
- Wait for ALL scan agents before starting document assembly
- Wait for ALL assembly agents before writing final document

**4. Result aggregation**:
- Collect findings from all 9 scan agents
- Deduplicate: Same file:line reported by multiple categories → keep highest severity
- Cross-reference: Link related findings (e.g., RF001 relates to OC003)
- Assemble document sections in order: Summary → Approved → Deferred → Guidance

**5. Error handling**:
- 1 scan agent fails: Continue, note category as "scan incomplete"
- SC/UI agent fails when artifacts exist: Log error, exclude from findings
- >50% scan agents fail: Abort review, report "Parallel scan failed"

---

## Context

$ARGUMENTS
