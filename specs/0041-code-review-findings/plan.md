# Implementation Plan: Code Review Findings

**Phase**: 0041 - Code Review Findings
**Created**: 2026-01-11
**Status**: Draft

## Technical Context

### Codebase Overview
- **Primary language**: POSIX-compliant Bash
- **Largest scripts**: specflow-state.sh (1607 lines), specflow-roadmap.sh (1419 lines)
- **Libraries**: common.sh, json.sh, detection.sh in `scripts/bash/lib/`
- **Test framework**: Custom bash test runner in `tests/`

### Constitution Compliance Check
All changes must comply with these principles:
- **II. POSIX-Compliant Bash**: Scripts validated with shellcheck
- **III. CLI Over Direct Edits**: State changes via CLI
- **IV. Simplicity Over Cleverness**: Readable code over clever optimizations
- **V. Helpful Error Messages**: All errors include actionable guidance
- **VII. Three-Line Output Rule**: User-critical info in first 3 lines

### Files to Modify (by finding count)

| File | Findings | Categories |
|------|----------|------------|
| specflow-state.sh | 5 | BP003, RF001-RF004 |
| specflow-roadmap.sh | 6 | BP005, HD001-HD004, MF001, MF003, OC004, OE001 |
| check-prerequisites.sh | 3 | BP001, BP002, OC001 |
| specflow-context.sh | 1 | BP004 |
| specflow-feature.sh | 1 | BP006 |
| specflow-scaffold.sh | 1 | RF005 |
| specflow-import.sh | 1 | RF007 |
| specflow-gate.sh | 2 | MF002, OE003, OE004 |
| README.md | 4 | OD001, OD002, OD007, OD008 |
| CLAUDE.md | 2 | OC003, OD004 |
| ROADMAP.md | 1 | OD003 |
| specflow.specify.md | 2 | OC002, OD005 |
| lib/common.sh | 1 | RF006 |

---

## Implementation Phases

### Phase A: High Priority - Safety & Documentation (Severity 4)
**Rationale**: Security fixes and documentation accuracy are blocking issues.

#### A1. Remove Unsafe Eval Pattern (BP001)
- **File**: scripts/bash/check-prerequisites.sh:82
- **Issue**: `eval "export $var"` is unsafe
- **Fix**: Replace with direct assignment or declare

#### A2. Delete Legacy Scripts (OC001)
- **Files**:
  - scripts/bash/check-prerequisites.sh
  - .specify/scripts/bash/check-prerequisites.sh
- **Action**: Delete both files (replaced by specflow-context.sh)

#### A3. Fix Documentation References (OC002, OD005)
- **File**: commands/specflow.specify.md:57-60
- **Issue**: References deleted create-new-feature.sh
- **Fix**: Update to `specflow feature create`

#### A4. Replace Placeholders (OD001, OD002)
- **File**: README.md:3,29,63,326
- **Issue**: YOUR_USERNAME placeholder
- **Fix**: Replace with `anthropics` or actual repo owner

---

### Phase B: Medium Priority - Hardening & Best Practices (Severity 3)

#### B1. Upgrade Strict Mode (BP002)
- **Files**: All scripts without `set -euo pipefail`
- **Fix**: Ensure all scripts have strict mode at top

#### B2. Input Sanitization (HD001)
- **Files**: specflow-state.sh, specflow-roadmap.sh
- **Issue**: Unvalidated user input in jq/grep patterns
- **Fix**: Add sanitize_for_pattern() helper in lib/common.sh

#### B3. Add Trap Cleanup (HD002)
- **Files**: Scripts using temp files
- **Fix**: Add `trap 'rm -f "$temp_file"' EXIT` patterns

#### B4. Validate Placeholder Goals (MF001)
- **File**: specflow-roadmap.sh:626
- **Issue**: Non-interactive insert accepts placeholder goals
- **Fix**: Add validation check before write

#### B5. Remove Debug Leftover (BP003)
- **File**: specflow-state.sh:624
- **Issue**: jq debug code in production
- **Fix**: Remove debug statements, simplify logic

---

### Phase C: Refactoring - Code Quality

#### C1. Extract Large Functions (RF001)
- **File**: specflow-state.sh
- **Target functions**:
  - `cmd_migrate()` (395 lines) → split into `migrate_schema_*()` helpers
  - `cmd_infer()` (188 lines) → split into `infer_*()` helpers
- **Goal**: No function over 150 lines

#### C2. Simplify Registry Operations (RF002, RF003)
- **File**: specflow-state.sh:604-645
- **Issue**: Deep nesting (4 levels), duplicate patterns
- **Fix**: Extract `registry_*()` helpers, single jq approach

#### C3. Create Shared Validation (RF006)
- **File**: lib/common.sh
- **Add**: `validate_phase_number()` function
- **Remove**: Duplicate regex patterns from other scripts

#### C4. Data-Driven Scaffold (RF005)
- **File**: specflow-scaffold.sh:770-957
- **Issue**: Hardcoded path logic
- **Fix**: Move to JSON config or associative array

---

### Phase D: Feature Additions

#### D1. Multi-Runner Gate Support (MF002)
- **File**: specflow-gate.sh:363
- **Current**: Only npm test
- **Add**: pytest, go test, bats detection
```bash
detect_test_runner() {
  if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]]; then
    echo "pytest"
  elif [[ -f "go.mod" ]]; then
    echo "go test ./..."
  elif [[ -d "tests" ]] && ls tests/*.bats 2>/dev/null; then
    echo "bats tests/"
  elif [[ -f "package.json" ]]; then
    echo "npm test"
  fi
}
```

#### D2. Backlog Priority Support (MF003)
- **File**: specflow-roadmap.sh:1156
- **Add**: Priority column parsing in backlog items
- **Format**: `| Item | Description | Priority | Notes |`

---

### Phase E: Documentation Cleanup

#### E1. Fix ROADMAP Status Icons (OD003)
- **File**: ROADMAP.md:33-40
- **Issue**: All phases show ✅ regardless of actual status
- **Fix**: Match icons to legend

#### E2. Update Architecture Diagram (OD004)
- **File**: CLAUDE.md:29-45
- **Add**: lib/json.sh, lib/detection.sh

#### E3. Remove Legacy References (OC003)
- **File**: CLAUDE.md:83
- **Issue**: References deleted init-*.md files
- **Fix**: Remove or update to current structure

#### E4. Add Customizing Templates Section (OD007)
- **File**: README.md
- **Add**: Section explaining how to customize templates

#### E5. Fix Memory Subcommands (OD008)
- **File**: README.md:328-337
- **Fix**: Update to actual CLI syntax

---

### Phase F: Code Hygiene

#### F1. Quote Parameter Expansions (BP004)
- **File**: specflow-context.sh:307
- **Fix**: `"${param%suffix}"` instead of `${param%suffix}`

#### F2. Add Magic Number Comments (BP005)
- **File**: specflow-roadmap.sh:743
- **Fix**: Add comment explaining the value

#### F3. Input Validation (BP006)
- **File**: specflow-feature.sh:71-80
- **Fix**: Ensure callers check return values

#### F4. External Command Error Handling (RF007)
- **File**: specflow-import.sh
- **Fix**: Add error handling on cp, mv, etc.

#### F5. Grep Pattern Safety (HD004)
- **File**: specflow-roadmap.sh
- **Fix**: Use `grep -F` for literal strings

#### F6. Dependency Checks (HD003)
- **File**: specflow-roadmap.sh
- **Add**: `require_command()` checks at script start

#### F7. Status Text Storage (OE003)
- **Files**: specflow-roadmap.sh, specflow-gate.sh
- **Fix**: Store status as text, convert to emoji only for display

#### F8. Validation Config (OE004)
- **File**: specflow-gate.sh:104-123
- **Fix**: Use config file for check_sections() parameters

#### F9. Inline/Delete Unused Helpers (OC004)
- **File**: specflow-roadmap.sh
- **Delete**: escape_for_sed(), today_date() if unused

---

## Implementation Order

1. **Phase A** - Safety and documentation (blocking issues)
2. **Phase B** - Hardening and best practices
3. **Phase F1-F3** - Quick code hygiene fixes
4. **Phase C1** - Extract large functions (foundational for other refactors)
5. **Phase C2-C4** - Remaining refactoring
6. **Phase D** - Feature additions
7. **Phase E** - Documentation cleanup
8. **Phase F4-F9** - Remaining code hygiene

---

## Verification Steps

After each phase:
1. `shellcheck scripts/bash/*.sh` - No new errors
2. `./tests/test-runner.sh` - All tests pass
3. `specflow doctor` - No warnings

Final verification:
- All 33 non-deferred findings addressed
- No YOUR_USERNAME placeholders
- No references to deleted scripts
- Multi-runner gate works

---

## Deferred Items (Not in Scope)

| ID | Finding | Rationale |
|----|---------|-----------|
| OE001 | Migrate roadmap to JSON state | Architectural change, v3.0 scope |
| OE002 | Split specflow-state.sh | Architectural change, v3.0 scope |
| OD006 | Split specflow.memory.md | Low impact, current format works |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Run test suite after each change |
| Introducing new bugs in refactored code | Keep functions small, test individually |
| Documentation getting out of sync | Update docs as part of each fix |
| Missing edge cases in multi-runner | Test on sample Python/Go/Bash projects |

---

## Dependencies

| External | Version |
|----------|---------|
| bash | 3.2+ (macOS default) |
| jq | 1.6+ |
| shellcheck | 0.8+ |
| git | 2.0+ |
