# Verification Checklist: Roadmap Flexibility

**Phase**: 0010-roadmap-flexibility
**Purpose**: Post-completion verification for /speckit.verify
**Created**: 2026-01-10

---

## Command Functionality

### Insert Command (US1)

- [x] **V-001**: `speckit roadmap insert --after 0020 "Test Phase"` creates phase 0021
- [x] **V-002**: Insert after existing 0021 creates 0022 (auto-increment)
- [x] **V-003**: Insert with full decade (0020-0029 used) shows helpful error
- [x] **V-004**: Insert after last phase creates next decade (e.g., 0090 → 0100)
- [x] **V-005**: Interactive prompts collect Goal, Scope, Verification Gate
- [x] **V-006**: `--non-interactive` flag creates phase with placeholders
- [x] **V-007**: Phase table row inserted at correct position
- [x] **V-008**: Phase section (### NNNN - Name) inserted after target phase

### Defer Command (US2)

- [x] **V-009**: `speckit roadmap defer 0040` moves phase to Backlog
- [x] **V-010**: Backlog section created if not exists
- [x] **V-011**: Deferred phase preserves all content (Goal, Scope, Deliverables)
- [x] **V-012**: Deferring in-progress phase fails without `--force`
- [x] **V-013**: `--force` flag allows deferring in-progress phase with warning
- [x] **V-014**: Phase removed from Phase Overview table
- [x] **V-015**: Phase section moved to Backlog (not deleted)

### Restore Command (US2)

- [x] **V-016**: `speckit roadmap restore 0040` restores from Backlog
- [x] **V-017**: Smart restore uses original number if available
- [x] **V-018**: If original taken, finds next in same decade
- [x] **V-019**: If decade full, prompts for `--after` target
- [x] **V-020**: `--after 0030` positions restored phase correctly
- [x] **V-021**: `--as 0045` allows explicit number assignment
- [x] **V-022**: Restored phase removed from Backlog section

### Migration Command (US3)

- [x] **V-023**: `speckit migrate roadmap` converts 001→0010, 002→0020
- [x] **V-024**: Already-migrated roadmap shows "already current" message
- [x] **V-025**: Mixed format roadmap shows detailed error
- [x] **V-026**: Backup created before migration (roadmap.bak)
- [x] **V-027**: `--dry-run` shows changes without applying
- [x] **V-028**: State file phase numbers updated if migration run
- [x] **V-029**: Phase section headers updated (### 001 → ### 0010)

---

## Code Quality

### Constitution Compliance

- [x] **V-030**: All scripts pass `shellcheck` with no errors
- [x] **V-031**: Scripts use POSIX-compliant bash (no bash-specific features)
- [x] **V-032**: All errors include actionable guidance (Principle V)
- [x] **V-033**: Scripts support `--help` flag
- [x] **V-034**: Scripts support `--json` flag for programmatic output

### Platform Compatibility

- [x] **V-035**: Commands work on macOS (bash 3.2)
- [x] **V-036**: Commands work on Linux (bash 4+)
- [x] **V-037**: No GNU-specific sed/grep options used

### Error Handling

- [x] **V-038**: Missing ROADMAP.md shows helpful error
- [x] **V-039**: Invalid phase number format shows error with example
- [x] **V-040**: Non-existent phase shows error listing available phases
- [x] **V-041**: Atomic writes prevent partial updates on error

---

## Integration

### CLI Integration

- [x] **V-042**: `speckit roadmap --help` shows all new commands
- [x] **V-043**: `speckit migrate --help` shows roadmap subcommand
- [x] **V-044**: Tab completion works for new commands (if applicable)

### State File Integration

- [x] **V-045**: Migration updates `.specify/orchestration-state.json` phase numbers
- [x] **V-046**: Insert/defer/restore don't corrupt state file

### Template Updates

- [x] **V-047**: `templates/roadmap-template.md` uses 4-digit numbering
- [x] **V-048**: Template includes Backlog section example

---

## Verification Summary

| Category | Items | Critical |
|----------|-------|----------|
| Insert Command | 8 | V-001, V-007, V-008 |
| Defer Command | 7 | V-009, V-012, V-015 |
| Restore Command | 7 | V-016, V-017 |
| Migration Command | 7 | V-023, V-026 |
| Code Quality | 8 | V-030, V-031 |
| Integration | 6 | V-045 |
| **Total** | **43** | 10 critical |

**Pass Criteria**: All critical items must pass. Non-critical items should pass (warnings acceptable for edge cases).
