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

### 8. Generate Report

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

### 9. Apply Fixes (unless `--dry-run`)

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

### 10. Commit Changes

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
