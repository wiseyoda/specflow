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
- `--categories <list>`: Review only specified categories (comma-separated: BP,RF,HD,MF,OC,OE,OD)
- `--fix`: Auto-approve findings with effort ≤4, defer effort=5 items, then auto-run `/flow.orchestrate`

You **MUST** consider the user input before proceeding (if not empty).

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

### Step 1: Initialize Review Context

**Get project status:**
```bash
specflow status --json
```

Verify:
- Project has ROADMAP.md
- Memory documents available (constitution.md at minimum)

**Create reviews directory** if needed and generate review ID:
- Format: `review-YYYYMMDD-HHMMSS` (e.g., `review-20260111-143025`)

---

### Step 2: Load Context Documents

Read memory documents to understand project standards:

**Required:**
- `.specify/memory/constitution.md` - Core principles (violations are CRITICAL)

**Recommended (if available):**
- `.specify/memory/coding-standards.md` - Style guidelines
- `.specify/memory/tech-stack.md` - Approved technologies
- `.specify/memory/testing-strategy.md` - Testing requirements

Use these documents as the baseline for evaluating findings.

---

### Step 3: Systematic Codebase Scan

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

**Finding ID format:** `{CATEGORY_CODE}{NNN}` (e.g., BP001, RF003, HD012)

---

### Step 4: Category Approval

**If `--fix` flag is set:** Use AUTO-APPROVE mode.
**Otherwise:** Use INTERACTIVE mode.

#### AUTO-APPROVE Mode (--fix)

Auto-triage by effort:
- **Effort ≤4**: Approve (anything under "major" effort)
- **Effort 5**: Defer to backlog (major tasks)

Display summary and skip to Step 5.

#### INTERACTIVE Mode

For each category with findings, present to user using `AskUserQuestion`:

Display category summary table:
```
Category: Best Practices (BP) - 5 findings

| ID    | File(s)              | E | I | S | Finding                     |
|-------|----------------------|---|---|---|-----------------------------|
| BP001 | scripts/bash/*.sh    | 2 | 3 | 3 | Inconsistent error handling |
| BP002 | lib/common.sh        | 1 | 2 | 2 | Missing function docs       |
...

E=Effort, I=Impact, S=Severity (1-5 scale)
```

Ask for approval:
- **Include ALL** - Add all findings from this category to phase
- **Include SOME** - Select specific findings to include
- **Include NONE** - Defer entire category to backlog

Track decisions: `approved = ["BP001", "BP003", ...]`, `deferred = ["BP002", ...]`

---

### Step 5: Write Review Document

Create review file at `.specify/reviews/review-YYYYMMDD-HHMMSS.md`:

1. **Header**: Date, author (Claude), scope (Full codebase), category count
2. **Summary table**: Count of findings/approved/deferred per category
3. **Approved Findings table**: Full details of approved items
4. **Deferred Findings table**: Full details of deferred items
5. **Cross-references**: Phase number (if created), backlog references

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
- Each finding must be actionable (clear recommendation)
- Each finding must reference specific files/locations
- Group related findings to avoid noise
- Prioritize constitution violations (always CRITICAL)

---

## Context

$ARGUMENTS
