---
description: Clean up, optimize, and verify memory documents in .specify/memory/. Reconciles against ROADMAP.md and codebase to detect drift. Promotes learnings from completed specs.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). User may specify:
- `--dry-run`: Analyze only, do not make changes
- `--verbose`: Show detailed analysis for each document
- `--fix`: Auto-fix issues without confirmation (default prompts before fixes)
- `--reconcile`: Include ROADMAP and codebase drift detection (default: on)
- `--no-reconcile`: Skip ROADMAP and codebase checks (faster, memory-only)
- `--promote`: Scan completed specs for decisions to promote to memory
- `--deep`: Full codebase scan (slower, more thorough dependency analysis)

## Goal

Maintain the health and quality of project memory documents (`.specify/memory/`) by:

1. Verifying documents are well-formed and follow conventions
2. Identifying inconsistencies, gaps, conflicts, and over-explaining
3. Checking for constitution compliance
4. Finding errant markdown files outside expected locations
5. Cleaning up and optimizing memory for agent consumption
6. **Reconciling memory against ROADMAP.md** (detect planning drift)
7. **Reconciling memory against actual codebase** (detect implementation drift)
8. **Promoting learnings from completed specs** (capture implementation decisions)

This command ensures memory documents remain evergreen, concise, accurate, and valuable for all agents.

## Prerequisites Check

**CRITICAL**: This command MUST only run on a clean `origin/main` branch.

### 1. Verify Git State

Run these checks and **ABORT** if any fail:

```bash
# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Must be on 'main' branch. Current: $CURRENT_BRANCH"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Uncommitted changes detected. Commit or stash before running."
  exit 1
fi

# Check for untracked files (excluding expected ones)
UNTRACKED=$(git status --porcelain | grep "^??" | grep -v "node_modules" | grep -v ".env")
if [ -n "$UNTRACKED" ]; then
  echo "WARNING: Untracked files detected. Review before proceeding."
fi

# Sync with origin
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "ERROR: Local main is not in sync with origin/main. Pull or push first."
  exit 1
fi
```

If checks fail, display the specific error and instruct the user to resolve before retrying.

## Execution Steps

### 2. Inventory Memory Documents

Scan `.specify/memory/` for all markdown files:

```text
.specify/memory/
├── constitution.md       (REQUIRED - project governance)
├── tech-stack.md         (REQUIRED - approved technologies)
├── coding-standards.md   (REQUIRED - code conventions)
├── api-standards.md      (REQUIRED - API patterns)
├── security-checklist.md (REQUIRED - security requirements)
├── testing-strategy.md   (REQUIRED - test patterns)
├── design-system.md      (OPTIONAL - visual standards)
├── glossary.md           (OPTIONAL - domain terms)
├── performance-budgets.md (OPTIONAL - performance targets)
├── ux-patterns.md        (OPTIONAL - UX conventions)
└── adrs/                 (OPTIONAL - architecture decisions)
    └── *.md
```

Report any missing REQUIRED documents.

### 3. Detect Errant Markdown Files

Find all `.md` files outside expected locations:

**Expected locations (do not flag):**
- `.specify/memory/` - Memory documents
- `.specify/templates/` - Templates
- `.specify/archive/` - Archived documents
- `specs/*/` - Feature specifications
- `.claude/commands/` - Skill files
- Root level expected files:
  - `README.md`
  - `CLAUDE.md`
  - `ROADMAP.md`
  - `CONTRIBUTING.md`
  - `LICENSE.md`
  - `CHANGELOG.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`

**Errant file detection:**
```bash
find . -name "*.md" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./.specify/memory/*" \
  -not -path "./.specify/templates/*" \
  -not -path "./.specify/archive/*" \
  -not -path "./specs/*" \
  -not -path "./.claude/commands/*" \
  -not -name "README.md" \
  -not -name "CLAUDE.md" \
  -not -name "ROADMAP.md" \
  -not -name "CONTRIBUTING.md" \
  -not -name "LICENSE.md" \
  -not -name "CHANGELOG.md" \
  -not -name "CODE_OF_CONDUCT.md" \
  -not -name "SECURITY.md"
```

For each errant file found, determine disposition:
- **Archive**: Move to `.specify/archive/` (default for temporary/tracking files)
- **Incorporate**: Merge content into relevant memory document
- **Delete**: Remove if obsolete or duplicate

### 4. Analyze Memory Document Quality

For each memory document, perform these checks:

#### A. Structure & Formatting

| Check | Criteria | Severity |
|-------|----------|----------|
| Agent Directive | Has `> **Agents**: ...` header block | HIGH |
| Last Updated | Has `**Last Updated**: YYYY-MM-DD` | MEDIUM |
| Sections | Uses `##` and `###` consistently | LOW |
| Tables | Tables have headers and alignment | LOW |
| Links | Internal links are valid (relative paths) | MEDIUM |
| Code Blocks | Code blocks have language identifiers | LOW |

#### B. Content Quality

| Check | Criteria | Severity |
|-------|----------|----------|
| Verbosity | No unnecessary code examples (prefer tables) | MEDIUM |
| Duplication | No content duplicated from other memory docs | HIGH |
| Cross-References | Duplicated concepts link to authoritative source | MEDIUM |
| Placeholders | No TODO, TBD, TKTK, ???, `<placeholder>` | HIGH |
| Vague Terms | No unmeasurable adjectives without criteria | MEDIUM |

#### C. Constitution Compliance

Cross-check each memory document against `constitution.md`:

| Document | Must Align With |
|----------|-----------------|
| `tech-stack.md` | Principle II (TypeScript), VIII (Simplicity) |
| `coding-standards.md` | Principle II (TypeScript), VIII (Simplicity) |
| `api-standards.md` | Principle I (API-First), VI (Security) |
| `security-checklist.md` | Principle VI (Security), X (Child-Safe) |
| `testing-strategy.md` | Principle IV (Test-First), VII (Accessibility) |
| `design-system.md` | Principle VII (Accessibility), V (PWA) |
| `performance-budgets.md` | Principle VIII (Simplicity), V (PWA) |

Flag any conflicts where a memory document contradicts constitution principles.

#### D. Consistency Checks

| Check | Description |
|-------|-------------|
| Terminology | Terms match `glossary.md` definitions |
| Versions | Tech versions match `tech-stack.md` |
| Principles | No contradictions between documents |
| Date Formats | All dates use YYYY-MM-DD |
| Agent Directives | Consistent format across all docs |

#### E. Gap Analysis

| Document | Expected Content |
|----------|-----------------|
| `constitution.md` | All 11 principles with rationales |
| `tech-stack.md` | All approved packages with versions |
| `coding-standards.md` | TypeScript, React, file naming conventions |
| `api-standards.md` | Request/response formats, error handling |
| `security-checklist.md` | OWASP top 10, child-safety measures |
| `testing-strategy.md` | Unit, integration, E2E, accessibility testing |

---

### 5. ROADMAP Reconciliation (unless `--no-reconcile`)

**Purpose**: Detect drift between ROADMAP.md planning and memory document standards.

#### 5a. Load ROADMAP.md

```bash
# Check ROADMAP exists
if [ -f "ROADMAP.md" ]; then
  # Parse phases and extract technology/pattern references
  speckit roadmap status --json
fi
```

#### 5b. Cross-Reference ROADMAP Against Memory

| Check | Description | Severity |
|-------|-------------|----------|
| Tech References | Technologies mentioned in ROADMAP phases exist in `tech-stack.md` | HIGH |
| Pattern References | Patterns mentioned align with `coding-standards.md` | MEDIUM |
| API References | API patterns match `api-standards.md` | MEDIUM |
| Security Gates | Security requirements in gates match `security-checklist.md` | HIGH |
| Testing Gates | Test requirements align with `testing-strategy.md` | MEDIUM |

**Detection Examples:**

```markdown
## ROADMAP ↔ Memory Drift Report

| Phase | ROADMAP Says | Memory Says | Drift Type | Severity |
|-------|--------------|-------------|------------|----------|
| 003 | "Use Prisma ORM" | tech-stack.md: Drizzle | Technology Mismatch | CRITICAL |
| 007 | "REST endpoints" | api-standards.md: GraphQL preferred | Pattern Drift | HIGH |
| 012 | "Jest tests" | testing-strategy.md: Vitest | Tool Mismatch | MEDIUM |
```

#### 5c. Determine Resolution Direction

For each drift:
1. **ROADMAP is outdated** → Flag for ROADMAP update
2. **Memory is outdated** → Flag for memory update
3. **Intentional deviation** → Require ADR in `.specify/memory/adrs/`

Ask user: "For each drift, which is the source of truth?"

---

### 6. Codebase Reconciliation (unless `--no-reconcile`)

**Purpose**: Detect drift between memory documents and actual implementation.

#### 6a. Scan Actual Dependencies

```bash
# Node.js projects
if [ -f "package.json" ]; then
  cat package.json | jq '.dependencies, .devDependencies'
fi

# Python projects
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  # Extract dependencies
fi

# Go projects
if [ -f "go.mod" ]; then
  cat go.mod
fi
```

#### 6b. Compare Against tech-stack.md

| Check | Method | Severity |
|-------|--------|----------|
| Undocumented Dependencies | Deps in package.json not in tech-stack.md | HIGH |
| Phantom Dependencies | Deps in tech-stack.md not in package.json | MEDIUM |
| Version Mismatches | Version in code differs from tech-stack.md | LOW |
| Deprecated Packages | Using packages marked deprecated in tech-stack.md | HIGH |

#### 6c. Scan Code Patterns (if `--deep`)

```bash
# Detect actual patterns in use
grep -r "import.*from" src/ --include="*.ts" --include="*.tsx" | head -100

# Detect API patterns
grep -r "@(Get|Post|Put|Delete|Patch)" src/ --include="*.ts" | head -50

# Detect test patterns
grep -r "(describe|it|test)\(" --include="*.test.ts" --include="*.spec.ts" | head -50
```

Compare patterns found against:
- `coding-standards.md` - Import patterns, file structure
- `api-standards.md` - API decorators, response patterns
- `testing-strategy.md` - Test patterns, coverage expectations

#### 6d. Produce Codebase Drift Report

```markdown
## Codebase ↔ Memory Drift Report

### Dependency Drift

| Package | In Code | In tech-stack.md | Status |
|---------|---------|------------------|--------|
| drizzle-orm | 0.29.0 | Not listed | ⚠️ UNDOCUMENTED |
| prisma | Not found | 5.0.0 | ⚠️ PHANTOM |
| react | 18.2.0 | ^18.0.0 | ✅ OK |
| lodash | 4.17.21 | Banned | ❌ VIOLATION |

### Pattern Drift

| Pattern | Expected (memory) | Found (code) | Files Affected |
|---------|-------------------|--------------|----------------|
| Imports | Absolute paths | Relative paths in 12 files | src/utils/*.ts |
| Error handling | Result type | try/catch in 8 files | src/api/*.ts |
| Tests | Vitest + describe | Jest syntax in 3 files | tests/*.test.ts |

### Drift Summary

- **Undocumented deps**: 3
- **Phantom deps**: 1
- **Pattern violations**: 23
- **Recommended action**: Update memory OR fix code
```

---

### 7. Spec Artifact Promotion (if `--promote` or completed phases exist)

**Purpose**: Surface implementation decisions from completed specs that should become memory.

#### 7a. Identify Completed Phases

```bash
# Find completed phases from ROADMAP
speckit roadmap status --json | jq '.phases[] | select(.status == "complete")'

# Or scan specs/ for completed features
find specs/ -name "spec.md" -exec grep -l "Status.*Complete" {} \;
```

#### 7b. Scan Completed Specs for Promotable Decisions

For each completed spec, scan `spec.md`, `plan.md`, and any ADRs for:

| Pattern | Example | Promote To |
|---------|---------|------------|
| Technology decisions | "Chose Drizzle over Prisma for..." | `tech-stack.md` |
| New patterns | "Implemented Result type for errors" | `coding-standards.md` |
| API conventions | "All endpoints return {data, error}" | `api-standards.md` |
| Security measures | "Added rate limiting to auth" | `security-checklist.md` |
| Test patterns | "Using factories for test data" | `testing-strategy.md` |
| New terms | "Flow = sequence of choice cards" | `glossary.md` |
| Performance decisions | "Lazy load images > 100KB" | `performance-budgets.md` |

**Detection Signals:**

```bash
# Decision keywords in completed specs
grep -i "decided\|chose\|selected\|adopted\|switched to\|instead of\|better than" specs/*/plan.md

# Pattern introductions
grep -i "new pattern\|introduced\|convention\|standard\|always use\|never use" specs/*/spec.md

# ADR references
find specs/*/adrs/ -name "*.md" 2>/dev/null
```

#### 7c. Produce Promotion Candidates Report

```markdown
## Memory Promotion Candidates

Decisions found in completed specs that may warrant memory updates:

### From Phase 003 - Flow Engine Core

| Decision | Source | Suggested Target | Confidence |
|----------|--------|------------------|------------|
| "Using Zod for runtime validation" | plan.md:L45 | tech-stack.md | HIGH |
| "Result<T,E> pattern for all services" | plan.md:L89 | coding-standards.md | HIGH |
| "Flow = directed graph of steps" | spec.md:L23 | glossary.md | MEDIUM |

### From Phase 005 - API Layer

| Decision | Source | Suggested Target | Confidence |
|----------|--------|------------------|------------|
| "All mutations return updated entity" | plan.md:L67 | api-standards.md | HIGH |
| "Rate limit: 100 req/min for auth" | spec.md:L112 | security-checklist.md | HIGH |

### Promotion Actions

For each candidate, choose:
1. **Promote**: Add to memory document
2. **Skip**: Phase-specific, not universal
3. **ADR**: Too significant, needs formal ADR first
```

#### 7d. Apply Promotions (if approved)

For each approved promotion:
1. Add content to appropriate memory document
2. Add cross-reference back to original spec
3. Update `Last Updated` date
4. Log in `.specify/memory/adrs/` if significant

---

### 8. Generate Analysis Report

Output a comprehensive analysis table:

```markdown
## Memory Document Analysis Report

**Generated**: [Date]
**Branch**: main (clean)
**Total Documents**: [count]
**Issues Found**: [count]
**Reconciliation**: [Enabled/Disabled]

---

### Issue Summary

| ID | File | Category | Severity | Description | Remediation |
|----|------|----------|----------|-------------|-------------|
| M001 | tech-stack.md | Duplication | HIGH | AI config duplicated from constitution | Remove, add cross-reference |
| M002 | glossary.md | Inconsistency | MEDIUM | "Choice" undefined vs Choice Card | Add disambiguation note |
| R001 | ROADMAP.md | Drift | CRITICAL | Phase 003 references Prisma, code uses Drizzle | Update ROADMAP or memory |
| C001 | tech-stack.md | Codebase Drift | HIGH | lodash in code but banned in memory | Remove from code or update policy |
| P001 | - | Promotion | MEDIUM | Result pattern in phase 003 not in coding-standards | Promote to memory |
| ... | ... | ... | ... | ... | ... |

---

### Errant Files Detected

| File | Location | Disposition | Reason |
|------|----------|-------------|--------|
| MEMORY_FIXES_TRACKING.md | / (root) | Archive | Temporary tracking file |
| ... | ... | ... | ... |

---

### Reconciliation Summary

#### ROADMAP ↔ Memory

| Status | Count |
|--------|-------|
| ✅ Aligned | 12 phases |
| ⚠️ Drift detected | 2 phases |
| ❌ Conflict | 1 phase |

#### Codebase ↔ Memory

| Status | Count |
|--------|-------|
| ✅ Documented | 45 dependencies |
| ⚠️ Undocumented | 3 dependencies |
| ⚠️ Phantom | 1 dependency |
| ❌ Violations | 2 dependencies |

#### Promotion Candidates

| Source | Candidates | High Confidence |
|--------|------------|-----------------|
| Phase 003 | 4 | 2 |
| Phase 005 | 3 | 2 |

---

### Coverage Summary

| Document | Status | Issues | Last Updated |
|----------|--------|--------|--------------|
| constitution.md | ✅ PASS | 0 | 2026-01-10 |
| tech-stack.md | ⚠️ WARN | 2 | 2026-01-10 |
| ... | ... | ... | ... |

---

### Metrics

- **Total Issues**: [count]
- **Critical**: [count]
- **High**: [count]
- **Medium**: [count]
- **Low**: [count]
- **Errant Files**: [count]
- **Constitution Violations**: [count]
- **ROADMAP Drift Issues**: [count]
- **Codebase Drift Issues**: [count]
- **Promotion Candidates**: [count]
```

### 9. Apply Fixes

If `--dry-run` was NOT specified, proceed with fixes:

#### 9a. Handle Errant Files

For each errant file:

1. **Archive** (default): Move to `.specify/archive/` with timestamp prefix if needed
   ```bash
   mv ./ERRANT_FILE.md ./.specify/archive/ERRANT_FILE.md
   ```

2. **Incorporate**: If content belongs in memory, merge into appropriate document

3. **Delete**: If content is obsolete or duplicate
   ```bash
   rm ./ERRANT_FILE.md
   ```

Prompt user for disposition unless `--fix` flag is set.

#### 9b. Fix Document Issues

For each issue by severity (CRITICAL first, then HIGH, MEDIUM, LOW):

| Issue Type | Auto-Fix Action |
|------------|-----------------|
| Missing agent directive | Add standard `> **Agents**: ...` header |
| Missing last updated | Add `**Last Updated**: [today]` |
| Broken internal links | Fix relative path |
| Duplicate content | Remove duplicate, add cross-reference |
| Placeholder text | Flag for manual resolution (cannot auto-fix) |
| Vague terms | Flag for manual resolution |
| Version mismatch | Update to match tech-stack.md |
| Date format | Convert to YYYY-MM-DD |

For each fix:
1. Show the proposed change
2. Apply if `--fix` flag set, otherwise prompt for confirmation
3. Track all changes made

#### 9c. Handle Reconciliation Drift

For ROADMAP drift:
1. Ask user which is authoritative (ROADMAP or memory)
2. Update the non-authoritative source
3. If neither is correct, flag for manual resolution

For codebase drift:
1. **Undocumented deps**: Add to tech-stack.md with "Added [date]" note
2. **Phantom deps**: Remove from tech-stack.md or mark as "Planned"
3. **Violations**: Flag for manual resolution (code change or policy change)

#### 9d. Apply Promotions

For approved promotion candidates:
1. Insert content into target memory document
2. Add source reference: `<!-- Promoted from specs/NNN-phase/plan.md:L45 -->`
3. Update `Last Updated` date

#### 9e. Regenerate CLAUDE.md

After memory document changes, regenerate project CLAUDE.md:

1. Read `.specify/templates/` for CLAUDE.md generation rules (if exists)
2. Aggregate key information from memory documents
3. Update `CLAUDE.md` at project root

### 10. Commit Changes

If changes were made:

```bash
git add .specify/memory/ .specify/archive/ CLAUDE.md
git commit -m "docs: optimize memory documents and reconcile drift

- Fixed [N] issues across [M] memory documents
- Archived [X] errant markdown files
- Resolved [Y] ROADMAP drift issues
- Resolved [Z] codebase drift issues
- Promoted [P] decisions from completed specs
- Regenerated CLAUDE.md from updated memory

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### 11. Final Report

Output summary of actions taken:

```markdown
## Memory Cleanup Complete

**Actions Taken**:
- ✅ Analyzed [N] memory documents
- ✅ Fixed [M] issues
- ✅ Archived [X] errant files
- ✅ Reconciled ROADMAP.md ([Y] drift issues resolved)
- ✅ Reconciled codebase ([Z] drift issues resolved)
- ✅ Promoted [P] decisions from completed specs
- ✅ Regenerated CLAUDE.md
- ✅ Committed changes to main

**Remaining Manual Actions**:
- [ ] Review archived files for permanent deletion
- [ ] Address [N] issues requiring manual resolution
- [ ] Review [M] low-confidence promotion candidates

**Health Score**: [0-100] (based on issues remaining)

**Next Run**: Recommend running monthly, after major spec changes, or after completing phases.
```

---

## Operating Principles

### Memory Document Standards

Memory documents exist to provide agents with consistent, authoritative context. They must be:

- **Evergreen**: No time-sensitive content that becomes stale
- **Concise**: Prefer tables over prose, references over duplication
- **Authoritative**: Single source of truth for each concept
- **Cross-Referenced**: Link to authoritative source, don't duplicate
- **Agent-Optimized**: Start with agent directive, structure for scanning
- **Reality-Grounded**: Reflect actual implementation, not aspirational goals

### Reconciliation Philosophy

Memory documents are only valuable if they reflect reality:

| Principle | Implication |
|-----------|-------------|
| **Code is truth** | If code differs from memory, one must change |
| **Decisions evolve** | Implementation learnings should flow back to memory |
| **ROADMAP is a plan** | Plans change; memory must track what actually happened |
| **Drift is debt** | Unreconciled drift compounds confusion |

### Drift Resolution Hierarchy

When drift is detected, resolve using this priority:

1. **Code + Memory agree, ROADMAP differs** → Update ROADMAP
2. **Code + ROADMAP agree, Memory differs** → Update Memory
3. **Memory + ROADMAP agree, Code differs** → Investigate (bug or undocumented decision?)
4. **All three differ** → Escalate to user, require ADR

### Verbosity Guidelines

| Content Type | Guideline |
|--------------|-----------|
| Code examples | 1-5 lines max, or reference file path |
| Configuration | Table format preferred over JSON blocks |
| Rationales | 1-2 sentences, not paragraphs |
| Lists | Bullet points, not numbered unless order matters |
| Tables | Use for structured data (versions, mappings, checklists) |

### File Disposition Rules

| File Type | Location | Action |
|-----------|----------|--------|
| Temporary tracking | Root or random | Archive to `.specify/archive/` |
| Meeting notes | Anywhere | Archive or delete |
| Draft specs | Outside `specs/` | Move to correct `specs/` folder or archive |
| Old documentation | Anywhere | Archive or incorporate |
| Duplicate content | Anywhere | Delete, keep authoritative version |

### Safety Constraints

- **NEVER** modify files in `specs/` (those are feature artifacts)
- **NEVER** delete memory documents without user confirmation
- **ALWAYS** create backup (archive) before destructive operations
- **ALWAYS** verify git state before and after operations
- **ALWAYS** ask before resolving CRITICAL drift issues

## Context

$ARGUMENTS
