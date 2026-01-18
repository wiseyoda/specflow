---
description: Perform systematic code reviews and generate findings that can be triaged into implementation phases.
handoffs:
  - label: Start Implementation
    agent: speckit.orchestrate
    prompt: Continue with the review phase
  - label: Triage Backlog
    agent: speckit.backlog
    prompt: Triage deferred review items
  - label: View Roadmap
    agent: speckit.roadmap
    prompt: Show roadmap status
  - label: Continue Later
    agent: speckit.orchestrate
    prompt: Resume development workflow
---

## User Input

```text
$ARGUMENTS
```

Arguments:
- Empty: Run full interactive review with category-by-category approval
- `--dry-run`: Generate findings without creating phase (preview mode)
- `--categories <list>`: Review only specified categories (comma-separated: BP,RF,HD,MF,OC,OE,OD)
- `--fix`: Auto-approve all findings with effort ≤4, defer effort=5 items, then auto-run `/speckit.orchestrate`

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Perform a systematic code review across 7 categories, generate findings with effort/impact/severity ratings, allow interactive user approval, create an implementation phase for approved items, and defer rejected items to the ROADMAP backlog.

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

## Rating Scales (1-5)

| Rating | Effort | Impact | Severity |
|--------|--------|--------|----------|
| 1 | Trivial (<30 min) | Minimal | Suggestion |
| 2 | Small (30 min - 2 hr) | Minor | Low |
| 3 | Moderate (2-8 hr) | Moderate | Medium |
| 4 | Significant (1-3 days) | Significant | High |
| 5 | Major (>3 days) | Critical | Blocking |

## Execution Steps

### Step 0: Initialize Review Context

**0a. Verify prerequisites:**

```bash
speckit context --json
```

Parse output to confirm:
- Project has ROADMAP.md
- Memory documents available (constitution.md at minimum)

**0b. Create reviews directory:**

```bash
mkdir -p .specify/reviews
```

**0c. Generate review ID:**

Use format: `review-YYYYMMDD-HHMMSS` (e.g., `review-20260111-143025`)

This timestamp format allows multiple reviews per day while maintaining chronological sorting.

---

### Step 1: Load Context Documents

Read memory documents to understand project standards:

**Required:**
- `.specify/memory/constitution.md` - Core principles (violations are CRITICAL)

**Recommended (if available):**
- `.specify/memory/coding-standards.md` - Style guidelines
- `.specify/memory/tech-stack.md` - Approved technologies
- `.specify/memory/testing-strategy.md` - Testing requirements

Use these documents as the baseline for evaluating findings.

---

### Step 2: Systematic Codebase Scan

For each category, scan the relevant files in the codebase.

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

**For each finding, capture:**
- File path(s) affected
- Line number(s) if specific
- Brief description of the issue
- Recommended fix
- Effort estimate (1-5)
- Impact estimate (1-5)
- Severity estimate (1-5)

**Generate finding IDs:**
- Format: `{CATEGORY_CODE}{NNN}` (e.g., BP001, RF003, HD012)
- Sequential within each category

---

### Step 3: Build Findings Collection

Organize findings into internal collection:

```text
findings = {
  "BP": [
    { "id": "BP001", "files": ["scripts/bash/*.sh"], "effort": 2, "impact": 3, "severity": 3,
      "finding": "Inconsistent error handling", "recommendation": "Add set -euo pipefail" },
    ...
  ],
  "RF": [...],
  ...
}
```

**Quality filters:**
- Skip trivial style-only issues unless they violate constitution
- Group related findings (e.g., same pattern across multiple files)
- Prioritize findings that reference constitution principles

---

### Step 4: Category Approval

**If `--fix` is set, use AUTO-APPROVE mode (Step 4-AUTO below). Otherwise, use INTERACTIVE mode.**

#### Step 4-AUTO: Auto-Approve Mode (--fix)

When `--fix` flag is set, skip interactive prompts:

**4-AUTO-a. Auto-triage by effort:**

```text
For each finding:
  if effort <= 4:
    approved.append(finding)  # Approve anything under "major" effort
  else:
    deferred.append(finding)  # Defer "major" (>3 days) tasks
```

**4-AUTO-b. Display auto-decisions:**

```text
============================================
Auto-Approve Mode (--fix)
============================================

Approved (effort ≤4): 35 findings
Deferred (effort=5):  7 findings

Approved by category:
  BP: 5, RF: 8, HD: 6, MF: 10, OC: 3, OE: 2, OD: 1

Deferred (major effort):
  RF003: Large-scale refactoring of state machine (effort: 5)
  MF005: Complete CLI command parity (effort: 5)
  ...
```

**4-AUTO-c. Skip to Step 5** (no user interaction needed).

---

#### Step 4-INTERACTIVE: Interactive Category Approval

For each category with findings, present to user using `AskUserQuestion`:

**4a. Display category summary:**

```text
============================================
Category: Best Practices (BP) - 5 findings
============================================

| ID    | File(s)              | E | I | S | Finding                     |
|-------|----------------------|---|---|---|-----------------------------|
| BP001 | scripts/bash/*.sh    | 2 | 3 | 3 | Inconsistent error handling |
| BP002 | lib/common.sh        | 1 | 2 | 2 | Missing function docs       |
| BP003 | speckit-state.sh     | 2 | 3 | 3 | Inconsistent exit codes     |
| BP004 | speckit-feature.sh   | 1 | 2 | 2 | Magic numbers in validation |
| BP005 | speckit-scaffold.sh  | 2 | 2 | 2 | Hardcoded paths             |

E=Effort, I=Impact, S=Severity (1-5 scale)
```

**4b. Ask for approval decision:**

Use `AskUserQuestion` with options:
- **Include ALL** - Add all findings from this category to phase
- **Include SOME** - Select specific findings to include
- **Include NONE** - Defer entire category to backlog

**4c. If "SOME" selected, drill into specifics:**

For each finding in the category, ask individually:
- Include in phase? [Yes]
- Defer to backlog? [No]

**4d. Track decisions:**

```text
approved = ["BP001", "BP003", "RF002", ...]
deferred = ["BP002", "BP004", "BP005", ...]
```

---

### Step 5: Write Review Document

**5a. Create review file:**

Output path: `.specify/reviews/review-YYYYMMDD-HHMMSS.md`

**5b. Populate sections:**

Load `templates/review-template.md` as guide and fill:

1. **Header**: Date, author (Claude), scope (Full codebase), category count
2. **Summary table**: Count of findings/approved/deferred per category
3. **Approved Findings table**: Full details of approved items
4. **Deferred Findings table**: Full details of deferred items
5. **Cross-references**: Phase number (if created), backlog references

---

### Step 6: Create Phase (if approved findings exist)

Skip this step if `--dry-run` flag is set or no findings were approved.

**6a. Determine hotfix phase number:**

Code review phases are created as **hotfixes** (using the C slot in ABBC numbering) to avoid displacing planned work.

Read ROADMAP.md to find the last in-progress or completed phase. Calculate hotfix number:
1. Find the highest phase currently in progress or most recently completed
2. Use its base number + hotfix slot 1 (e.g., 0040 → 0041)
3. If that hotfix exists, increment (0041 → 0042, up to 0049)

**Examples**:
- Current phase is 0015 (in progress) → create 0016
- Last completed is 0040, nothing in progress → create 0041
- 0041 already exists → create 0042

**Rationale**: Review phases are refinement work that should be addressed before moving to new features, so they insert after the current work rather than at the end of the roadmap.

**6b. Create phase entry in ROADMAP:**

Add new phase section after the base phase (e.g., 0041 after 0040):

```markdown
### Phase [NNNN] - Code Review [TIMESTAMP]

**Goal**: Address code quality findings from systematic review

**Status**: Not Started

**Scope**:
- [Count] approved findings across [N] categories
- See `.specify/reviews/review-[TIMESTAMP].md` for details

**Verification Gate**:
- All approved findings addressed
- No regressions in existing tests
- Code review document updated with completion status
```

**6c. Update phase overview table:**

Add row to the phase overview table with status "Not Started".

---

### Step 7: Defer Items to Backlog

For each deferred finding, add to ROADMAP.md backlog section:

```markdown
| [ID] [Category]: [Brief finding] | [Recommendation] | Medium | Deferred from review [TIMESTAMP] |
```

Example:
```markdown
| [BP002] Best Practices: Missing function docs | Add JSDoc comments | Low | Deferred from review 20260111-143025 |
```

---

### Step 8: Summary Output

Display completion summary:

```text
============================================
Code Review Complete
============================================

Review ID: review-20260111-143025
Document: .specify/reviews/review-20260111-143025.md

Summary:
  Categories reviewed: 7
  Total findings: 42
  Approved: 31
  Deferred: 11

Phase Created: 0041 - Code Review 20260111-143025
  Location: ROADMAP.md (Phase 0041 section - hotfix after 0040)

Backlog Updated: 11 items added
  Reference: ROADMAP.md backlog section

Next Steps:
  1. Run /speckit.orchestrate to build spec/plan/tasks
  2. Review generated tasks before implementation
  3. Run /speckit.roadmap backlog to triage deferred items later

============================================
```

---

### Step 9: Auto-Orchestrate (--fix mode only)

When `--fix` flag is set, automatically chain to orchestrate:

**9a. Display handoff message:**

```text
============================================
Auto-Fix Mode: Chaining to Orchestrate
============================================

Phase 0041 created with 35 approved findings.
Starting implementation workflow...

[Invoking /speckit.orchestrate]
```

**9b. Invoke orchestrate:**

Immediately proceed with `/speckit.orchestrate` workflow for the newly created phase. The orchestrate command will:
- Create spec.md from review findings
- Create plan.md with implementation approach
- Generate tasks.md with actionable items
- Begin implementation

**Note**: In `--fix` mode, the orchestrate workflow should also minimize interaction - proceeding through spec/plan/tasks without requiring approval, then implementing all tasks autonomously.

---

## Dry Run Mode

When `--dry-run` is specified:
- Execute all scan and analysis steps
- Display findings and approval prompts
- Write review document to `.specify/reviews/`
- **DO NOT** create phase in ROADMAP
- **DO NOT** add items to backlog
- Show what would have been created

Output indicator:
```text
[DRY RUN] Phase 0041 would be created (hotfix after 0040)
[DRY RUN] 11 items would be added to backlog
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No ROADMAP.md | "Run `/speckit.roadmap` to create a roadmap first" |
| No constitution.md | "Run `/speckit.init` to initialize project first" |
| No findings found | "Codebase looks clean! No review phase needed." |
| User cancels mid-review | Save partial findings to review doc, mark as "incomplete" |
| Phase creation fails | Save review doc, provide manual instructions |
| Backlog update fails | List items to add manually |

---

## Operating Principles

### Constraint Enforcement

This command **MUST NOT**:
- Propose brand new features (only improve existing code)
- Suggest breaking changes without explicit user confirmation
- Auto-approve any findings (always interactive) - **EXCEPTION**: `--fix` mode auto-approves effort ≤4
- Skip categories without user consent - **EXCEPTION**: `--fix` mode processes all categories
- Modify any code during the review (read-only analysis)

### Finding Quality

- Each finding must be actionable (clear recommendation)
- Each finding must reference specific files/locations
- Group related findings to avoid noise
- Prioritize constitution violations (always CRITICAL)
- Balance thoroughness with signal-to-noise ratio

### User Interaction

- Present findings clearly with ratings visible
- Recommend option first in each question
- Allow granular control (all/some/none per category)
- Provide escape hatch (cancel/skip options)
- Show progress through categories

---

## Context

$ARGUMENTS
