---
description: Verify and optimize memory documents. Reconciles against ROADMAP.md and codebase to detect drift. Promotes learnings from completed specs.
---

## User Input

```text
$ARGUMENTS
```

## Arguments

| Argument | Description |
|----------|-------------|
| (empty) | Run full verification with reconciliation |
| `--dry-run` | Analyze only, no changes |
| `--fix` | Auto-fix issues without confirmation |
| `--no-reconcile` | Skip ROADMAP/codebase checks (faster) |
| `--promote` | Scan completed specs for decisions to promote |
| `--deep` | Full codebase pattern scan (slower) |
| `--archive <phase\|all>` | Review archived phase(s) for memory promotion |
| `--archive <phase\|all> --delete` | Review AND delete archives after promotion |

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

**Must be on clean main branch:**
```bash
# Verify: on main, no uncommitted changes, synced with origin
git rev-parse --abbrev-ref HEAD  # must be "main"
git diff --quiet && git diff --cached --quiet  # must be clean
git fetch origin main && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]
```

Abort with specific error if any check fails.

## Execution

### 1. Initialize

```bash
specflow status --json
specflow check --gate memory
```

Parse status for:
- `context.hasMemory` → must be true (abort if false)
- `context.hasRoadmap` → needed for reconciliation

If memory gate fails, report specific issues from the check output.

### 2. Inventory Memory Documents

Scan `.specify/memory/`:

| Document | Status | Purpose |
|----------|--------|---------|
| `constitution.md` | REQUIRED | Project principles |
| `tech-stack.md` | Recommended | Approved technologies |
| `coding-standards.md` | Recommended | Code conventions |
| `api-standards.md` | Recommended | API patterns |
| `security-checklist.md` | Recommended | Security requirements |
| `testing-strategy.md` | Recommended | Test patterns |
| `glossary.md` | Optional | Domain terms |

Report missing REQUIRED documents as errors, missing Recommended as warnings.

### 3. Detect Errant Files

Find `.md` files outside expected locations:

**Expected locations** (do not flag):
- `.specify/memory/`, `.specify/templates/`, `.specify/archive/`
- `specs/*/`, `commands/`, `docs/`, `templates/`

**Root allowlist** (only these allowed at root):
- `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `LICENSE.md`, `CHANGELOG.md`

**Any other root `.md` is errant** → Archive to `.specify/archive/`

### 4. Analyze Document Quality

For each memory document, check:

**A. Structure**
| Check | Severity |
|-------|----------|
| Has `> **Agents**: ...` directive | HIGH |
| Has `**Last Updated**: YYYY-MM-DD` | MEDIUM |
| Consistent heading levels | LOW |

**B. Content**
| Check | Severity |
|-------|----------|
| No placeholders (TODO, TBD, ???) | HIGH |
| No duplicate content from other docs | HIGH |
| No vague terms without criteria | MEDIUM |

**C. Constitution Compliance**
Cross-check each document against `constitution.md` principles. Flag conflicts as CRITICAL.

**D. Consistency**
| Check |
|-------|
| Terms match `glossary.md` |
| Versions match `tech-stack.md` |
| No contradictions between documents |

### 5. ROADMAP Reconciliation (unless `--no-reconcile`)

```bash
specflow phase status --json
```

Compare ROADMAP phase references against memory:
- Technologies in phases exist in `tech-stack.md`?
- Patterns align with `coding-standards.md`?
- Security gates match `security-checklist.md`?

**Drift types:**
| Type | Example | Severity |
|------|---------|----------|
| Technology mismatch | ROADMAP: Prisma, memory: Drizzle | CRITICAL |
| Pattern drift | ROADMAP: REST, memory: GraphQL preferred | HIGH |
| Tool mismatch | ROADMAP: Jest, memory: Vitest | MEDIUM |

For each drift, determine: Is ROADMAP outdated, or memory outdated?

### 6. Codebase Reconciliation (unless `--no-reconcile`)

Compare actual dependencies against `tech-stack.md`:

```bash
# Node.js
cat package.json | jq '.dependencies, .devDependencies'

# Python
cat pyproject.toml  # or requirements.txt

# Go
cat go.mod
```

**Drift types:**
| Type | Action |
|------|--------|
| Undocumented deps | Add to tech-stack.md |
| Phantom deps | Remove from tech-stack.md |
| Version mismatch | Update to match |
| Banned package in use | Flag for removal |

If `--deep`: Also scan code patterns against `coding-standards.md` and `api-standards.md`.

### 7. Promote from Completed Specs (if `--promote`)

```bash
specflow phase status --json  # get completed phases
```

Scan completed `spec.md` and `plan.md` for promotable decisions:

| Pattern | Promote To |
|---------|------------|
| "Chose X over Y because..." | `tech-stack.md` |
| "Implemented Result type for..." | `coding-standards.md` |
| "All endpoints return {data, error}" | `api-standards.md` |
| "Added rate limiting to..." | `security-checklist.md` |

**Detection signals:** grep for "decided", "chose", "adopted", "switched to", "instead of"

### 8. Archive Review Mode (if `--archive`)

When `--archive <phase|all>` is specified, perform intelligent review of archived phase documents for memory promotion. This mode replaces the standard verification workflow.

**8.1 Load Archive Inventory**

```bash
# List archived phases
ls -1 .specify/archive/ | grep -E '^[0-9]{4}-'

# For specific phase
ls .specify/archive/NNNN-*/
```

If `--archive all`: Process all archived phases not yet reviewed.
If `--archive NNNN`: Process only the specified phase.

**8.2 Check Review Status**

Query state for previously reviewed archives:

```bash
specflow state get memory.archive_reviews --json
```

Returns `{ "NNNN": { "reviewed_at": "...", "promotions": [...] } }` or empty.

Skip phases already reviewed unless content has changed (check file mtimes).

**8.3 Scan Each Archive for Promotable Content**

For each archived phase, read and analyze:

| Document | Scan For |
|----------|----------|
| `spec.md` | Key Decisions, Technical Approach, Lessons Learned sections |
| `plan.md` | Architecture decisions, rejected alternatives |
| `tasks.md` | Patterns in completed tasks (less useful for promotion) |
| `checklists/*.md` | Security/testing items that should be standard |

**Explicit Markers** (highest priority):
- `[PROMOTE]` - Author marked for promotion
- `[MEMORY]` - Author marked for memory
- `<!-- promote: tech-stack -->` - Targeted promotion

**Implicit Signals** (require judgment):
| Signal | Example | Likely Target |
|--------|---------|---------------|
| "Decided to use X" | "Decided to use Zod for validation" | tech-stack.md |
| "Chose X over Y because" | "Chose pnpm over npm for speed" | tech-stack.md |
| "Pattern: ..." | "Pattern: All errors return {code, message}" | coding-standards.md |
| "Convention: ..." | "Convention: Use kebab-case for URLs" | api-standards.md |
| "Security: ..." | "Security: Rate limit all public endpoints" | security-checklist.md |
| "Testing: ..." | "Testing: Mock external APIs in unit tests" | testing-strategy.md |
| "Term: X means Y" | "Term: 'Phase' means a unit of work" | glossary.md |

**8.4 Assess Codebase Relevance**

For each candidate, verify it's still relevant:

```bash
# Check if technology is still in use
grep -r "zod" package.json src/

# Check if pattern is still followed
grep -r "return.*{.*error" src/

# Check if term is used in codebase
grep -ri "phase" src/ --include="*.ts"
```

Discard candidates that reference:
- Removed dependencies
- Deprecated patterns
- Superseded decisions (check for later phases that changed approach)

**8.5 Check for Duplicates**

Before promoting, verify content isn't already in memory:

```bash
# Search existing memory docs
grep -l "Zod" .specify/memory/*.md
grep -l "rate limit" .specify/memory/*.md
```

If found: Skip or note as "already documented"

**8.6 Present Findings Interactively**

For each promotion candidate, present the analysis then use `AskUserQuestion` tool:

```markdown
## Promotion Candidate [P001]

**Source**: `.specify/archive/0042-cli-migration/spec.md` (line 145)
**Target**: `tech-stack.md`
**Confidence**: HIGH (explicit [PROMOTE] marker)

**Content**:
> Decided to use Commander.js for CLI parsing. It has better TypeScript
> support than yargs and simpler API than oclif.

**Codebase Check**: ✓ Commander.js found in package.json
**Memory Check**: ✗ Not yet documented in tech-stack.md
```

Then ask user using `AskUserQuestion` tool:

```json
{
  "questions": [{
    "question": "How should this candidate be handled?",
    "header": "P001 Action",
    "options": [
      {"label": "Promote", "description": "Add to target memory document"},
      {"label": "Skip", "description": "Already documented or not needed"},
      {"label": "Skip (Superseded)", "description": "Decision was changed in later phase"}
    ],
    "multiSelect": false
  }]
}
```

If no candidates found, **proceed automatically without asking**:
- Mark phase as reviewed in state
- Delete the archive directory
- Report: "No promotable content found in phase NNNN. Archive cleaned up."

No user confirmation needed - archive contents remain in git history if ever needed.

Group candidates by target document and present in batches of 5.

**8.7 Apply Promotions**

For approved promotions:

1. Read target memory document
2. Find appropriate section (or create new subsection)
3. Add content with attribution:

```markdown
### CLI Framework

**Choice**: Commander.js
**Rationale**: Better TypeScript support than yargs, simpler API than oclif.
**Adopted**: Phase 0042 (CLI Migration)
```

4. Update `**Last Updated**` date

**8.8 Track Review Status**

After processing each phase, update state.

**Initialize parent object if needed:**
```bash
# Check if archive_reviews exists, initialize if not
REVIEWS=$(specflow state get memory.archive_reviews 2>/dev/null)
if [[ -z "$REVIEWS" || "$REVIEWS" == "null" ]]; then
  specflow state set memory.archive_reviews='{}'
fi
```

**Then record the review:**
```bash
specflow state set memory.archive_reviews.NNNN='{"reviewed_at":"2026-01-18","promotions":["P001","P003"],"skipped":["P002"]}'
```

This prevents re-reviewing the same archives.

**8.9 Generate Archive Review Report**

```markdown
## Archive Review Report

**Phases Reviewed**: 3 (0042, 0076, 1010)
**Candidates Found**: 12
**Promoted**: 8
**Skipped**: 3 (already documented)
**Deferred**: 1 (needs manual review)

| ID | Source Phase | Target | Content Summary | Status |
|----|--------------|--------|-----------------|--------|
| P001 | 0042 | tech-stack.md | Commander.js adoption | Promoted |
| P002 | 0042 | coding-standards.md | Error handling pattern | Skipped (exists) |
```

**8.10 Archive Disposition**

Archive deletion is controlled by the `--delete` flag:

**If `--delete` flag is set:**
```bash
# Safety checks before deletion
if specflow state get memory.archive_reviews.NNNN | grep -q reviewed_at; then
  rm -rf .specify/archive/NNNN-*/
  echo "Deleted archive for phase NNNN"
fi
```

**If `--delete` flag is NOT set (default):**
- Archive is preserved in `.specify/archive/`
- Mark as reviewed in state but do not delete
- `/flow.merge` handles current phase archive deletion separately

**Safety checks before any deletion**:
- Confirm review status was successfully written to state
- Verify any promotions were successfully applied to memory docs
- Log deletion for audit trail in report

**Ownership clarification**:
- `/flow.memory --archive` reviews ANY phase, deletes only with `--delete`
- `/flow.merge` owns deletion of CURRENT phase archive after merge

### 9. Generate Report (standard mode)

Output findings table:

```markdown
## Memory Analysis Report

| ID | File | Category | Severity | Issue | Fix |
|----|------|----------|----------|-------|-----|
| M001 | tech-stack.md | Duplication | HIGH | Duplicates constitution | Remove, cross-reference |
| R001 | ROADMAP.md | Drift | CRITICAL | References Prisma, code uses Drizzle | Update ROADMAP |

**Metrics:**
- Documents: N | Issues: M | Critical: X | High: Y
- ROADMAP drift: N issues | Codebase drift: M issues
- Promotion candidates: P
```

### 10. Apply Fixes (unless `--dry-run`)

For each issue by severity (CRITICAL first):

| Issue Type | Auto-Fix |
|------------|----------|
| Missing agent directive | Add standard header |
| Missing last updated | Add today's date |
| Errant files | Move to `.specify/archive/` |
| Undocumented deps | Add to tech-stack.md |
| Phantom deps | Remove from tech-stack.md |

Prompt for confirmation unless `--fix` flag set.

**Cannot auto-fix** (flag for manual):
- Placeholder content
- Vague terms
- Technology conflicts
- Pattern violations in code

### 11. Commit Changes

If changes were made:
```bash
git add .specify/memory/ .specify/archive/ CLAUDE.md
git commit -m "docs: optimize memory documents

- Fixed N issues across M documents
- Archived X errant files
- Resolved Y drift issues

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Constraints

- **NEVER modify `specs/`** - those are feature artifacts
- **NEVER delete memory docs** without user confirmation
- **ALWAYS archive** before deleting errant files
- **ALWAYS verify git state** before and after operations
- **ALWAYS prompt** for CRITICAL drift resolution

## Deprecation Notice

If user runs `/flow.memory generate`:
```
DEPRECATED: Use /flow.init instead.
Memory document generation is now part of unified project initialization.
```
