# Implementation Plan: Code Review 2026-01-11

**Phase**: 0042
**Created**: 2026-01-11
**Status**: Draft

## Technical Context

### Affected Files

| Category | Files | Findings |
|----------|-------|----------|
| POSIX Compliance | `specflow-doctor.sh`, `specflow-reconcile.sh` | BP001, BP002 |
| 4-Digit Phases | `specflow-feature.sh`, `bin/specflow` | BP004, BP005 |
| Error Consistency | Multiple scripts | BP003 |
| Dispatcher | `bin/specflow` | MF001 |
| Gate Enhancements | `specflow-gate.sh` | HD001, MF002 |
| Context Enhancements | `specflow-context.sh` | MF003, OC001 |
| Import Validation | `specflow-import.sh` | HD003 |
| Common Library | `lib/common.sh` | RF004 |
| Doctor Refactoring | `specflow-doctor.sh` | RF003 |
| Temp File Cleanup | Various | HD002 |
| Documentation | `README.md`, `CLAUDE.md` | OD001-OD003 |
| Scripts Structure | `.specify/scripts/` | OC002 |

### Dependencies

1. **BP001/BP002** (POSIX compliance) - No dependencies, can be done first
2. **BP003** (error consistency) - Depends on having standardized log_error/log_warn
3. **RF003** (doctor abstraction) - Should follow BP001 to avoid double-work
4. **RF004** (common.sh cleanup) - Should be done after all script changes
5. **MF001** (dispatcher) - No dependencies
6. **Documentation updates** - Should be done last to reflect final state

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| POSIX-compliant bash | ✅ This phase fixes compliance issues | BP001, BP002 directly address |
| Helpful error messages | ✅ BP003 standardizes error output | Uses log_error/log_warn |
| CLI best practices | ✅ MF001 adds missing commands | gate, lessons to dispatcher |
| Concise output | ✅ No changes to output patterns | Existing patterns maintained |

## Implementation Strategy

### Phase 1: POSIX Compliance (BP001, BP002)

Replace `declare -a` arrays with POSIX-compatible alternatives.

**specflow-doctor.sh (BP001)**:
- Lines 69-71: `declare -a ISSUES=()` etc.
- Replace with simple variables or positional parameters
- Use string accumulation with delimiter instead of arrays

**specflow-reconcile.sh (BP002)**:
- Lines 57-58: `declare -a DIFFERENCES=()`, `declare -a FIXES=()`
- Same approach as doctor.sh

**Pattern**: Convert `declare -a ARR=()` to `ARR=""` and accumulation via `ARR="$ARR|item"`, then split on delimiter when iterating.

### Phase 2: 4-Digit Phase Consistency (BP004, BP005)

**specflow-feature.sh (BP004)**:
- Line 31-32: Help text shows "001, 002, etc."
- Line 65-68: `normalize_phase()` pads to 3 digits
- Change all references to 4-digit format (0010, 0020)
- Update `normalize_phase()` to pad to 4 digits

**bin/specflow (BP005)**:
- Line 28: Example shows 3-digit phases
- Line 89, 182-186: Help text uses 3-digit examples
- Update all examples to 4-digit format

### Phase 3: Missing CLI Commands (MF001)

Add `gate` and `lessons` to dispatcher in `bin/specflow`:
```bash
gate)
  run_script "gate" "$@"
  ;;
lessons)
  run_script "lessons" "$@"
  ;;
```

These scripts already exist (`specflow-gate.sh`, `specflow-lessons.sh`) but aren't routed.

### Phase 4: Gate Enhancements (HD001, MF002)

**specflow-gate.sh**:
- HD001: Add error handling around test runner execution (line 419)
  - Wrap `$test_cmd` with proper error capture
  - Provide helpful message when test fails vs not configured
- MF002: Add `cargo test` and `go test` detection (lines 88-126)
  - Already has go test, add cargo test
  - Verify detection order and patterns

### Phase 5: Context Enhancements (MF003, OC001)

**specflow-context.sh**:
- OC001: Remove unused `include_tasks` variable (line 164)
  - Variable is declared but has no effect (always true)
- MF003: Add memory document status to output
  - Check for constitution.md, tech-stack.md, etc.
  - Add to both text and JSON output

### Phase 6: Import Validation (HD003)

**specflow-import.sh**:
- Add ADR format validation before import
- Check for required sections (Title, Status, Context, Decision)
- Warn on missing sections but don't block import

### Phase 7: Hardening - Temp File Cleanup (HD002)

Search for scripts using temp files without EXIT traps:
```bash
grep -l "mktemp" scripts/bash/*.sh
```

Add trap handlers where missing:
```bash
cleanup() {
  rm -f "$temp_file" 2>/dev/null || true
}
trap cleanup EXIT
```

### Phase 8: Doctor Check Abstraction (RF003)

Create helper function for repetitive check patterns:
```bash
run_check() {
  local name="$1"
  local check_func="$2"
  local fix_func="${3:-}"
  # Common pattern: run check, log result, track issues
}
```

Note: This is lower priority - can be deferred if time-constrained.

### Phase 9: Common Library Audit (RF004)

Audit `lib/common.sh` for unused functions:
1. `output_or_json` - May be unused, check all scripts
2. `safe_file_update` - May be unused
3. Other candidates

Only remove if truly unused (grep across all scripts).

### Phase 10: Documentation Updates (OD001-OD003)

**README.md (OD001)**:
- Verify CLI Reference matches actual implementation
- Add `/specflow.review` to Claude Code Commands table

**CLAUDE.md (OD002)**:
- Add gate and lessons commands to Key Files section

**OD003**: Already covered in OD001.

### Phase 11: Scripts Structure Documentation (OC002)

Add clarifying comment or documentation about `.specify/scripts/` vs `scripts/bash/`:
- `.specify/scripts/` = Project-specific scripts
- `scripts/bash/` = SpecFlow system scripts (this repo only)

## Technical Notes

### POSIX Array Alternative Pattern

Instead of:
```bash
declare -a ISSUES=()
ISSUES+=("item")
for item in "${ISSUES[@]}"; do ... done
```

Use:
```bash
ISSUES=""  # Pipe-delimited string
add_issue() { ISSUES="${ISSUES:+$ISSUES|}$1"; }
# To iterate:
IFS='|' read -ra items <<< "$ISSUES"
for item in "${items[@]}"; do ... done
```

Or use newline-delimited for simpler parsing:
```bash
ISSUES=""
add_issue() { ISSUES="${ISSUES}${ISSUES:+$'\n'}$1"; }
# To iterate:
while IFS= read -r item; do
  [[ -n "$item" ]] && echo "$item"
done <<< "$ISSUES"
```

### Test Runner Error Handling Pattern

```bash
if [[ -n "$test_cmd" ]]; then
  local test_output
  local test_exit=0
  test_output=$($test_cmd 2>&1) || test_exit=$?

  if [[ $test_exit -eq 0 ]]; then
    log_success "Tests passing"
  else
    log_warn "Tests failed (exit code: $test_exit)"
    echo "$test_output" | head -10
    ((warnings++)) || true
  fi
fi
```

## Out of Scope

Per review document, these items are deferred:
- RF001: Refactor specflow-roadmap.sh (1425 lines)
- RF002: Extract scaffold templates to separate files
- OE001: Simplify project-type templates
- OE002: Reconsider manifest versioning

## Implementation Order

1. **BP001, BP002**: POSIX compliance (foundation, no dependencies)
2. **MF001**: Dispatcher additions (simple, enables testing)
3. **BP004, BP005**: 4-digit phases (consistency)
4. **HD001, MF002**: Gate improvements
5. **OC001, MF003**: Context cleanup and enhancement
6. **HD003**: Import validation
7. **HD002**: Temp file traps
8. **BP003**: Error message standardization
9. **RF003**: Doctor abstraction (if time permits)
10. **RF004**: Common.sh audit (if time permits)
11. **OD001-OD003, OC002**: Documentation (last, reflects final state)

## Verification

After implementation:
1. Run `shellcheck` on all modified scripts
2. Run existing test suite: `./tests/test-runner.sh`
3. Run `specflow doctor` to verify no regressions
4. Manual verification of new commands: `specflow gate --help`, `specflow lessons --help`
5. Verify 4-digit phase examples in help text
