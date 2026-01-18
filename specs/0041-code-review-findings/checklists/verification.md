# Verification Checklist: Code Review Findings

**Phase**: 0041 - Code Review Findings
**Purpose**: Post-completion verification for /specflow.verify
**Created**: 2026-01-11

---

## Critical Checks (Must Pass)

### SC-001: All Findings Addressed
- [ ] Review 36 findings in `.specify/reviews/review-20260111.md`
- [ ] Verify 33 findings implemented (36 - 3 deferred)
- [ ] Confirm 3 deferred items have documented rationale:
  - [ ] OE001: Migrate roadmap to JSON (deferred: architectural, v3.0)
  - [ ] OE002: Split specflow-state.sh (deferred: architectural, v3.0)
  - [ ] OD006: Split specflow.memory.md (deferred: low impact)

### SC-002: Shellcheck Compliance
- [ ] Run: `shellcheck scripts/bash/*.sh`
- [ ] No errors on modified files
- [ ] No new warnings introduced

### SC-003: Test Suite Passes
- [ ] Run: `./tests/test-runner.sh`
- [ ] All existing tests pass
- [ ] No test regressions

### SC-004: No Placeholder URLs
- [ ] Run: `grep -r "YOUR_USERNAME" README.md`
- [ ] Returns no matches
- [ ] All GitHub URLs use actual repo owner

### SC-005: No Deleted Script References
- [ ] Run: `grep -r "check-prerequisites.sh" . --include="*.md" --include="*.sh"`
- [ ] Returns no matches (except review doc)
- [ ] Run: `grep -r "create-new-feature.sh" . --include="*.md"`
- [ ] Returns no matches

### SC-006: Multi-Runner Gate
- [ ] `specflow gate` detects pytest (Python project)
- [ ] `specflow gate` detects go test (Go project)
- [ ] `specflow gate` detects bats (Bash project)
- [ ] `specflow gate` falls back to npm test (Node project)

---

## User Story Verification

### US1: Reliable Script Execution
- [ ] No eval() patterns in codebase
- [ ] All scripts have `set -euo pipefail`
- [ ] Temp files cleaned up on error (trap handlers)
- [ ] User input sanitized before jq/grep

### US2: Accurate Documentation
- [ ] README install commands work
- [ ] specflow.specify.md references current commands
- [ ] CLAUDE.md architecture diagram complete
- [ ] ROADMAP status icons match legend

### US3: Clean Codebase
- [ ] Legacy check-prerequisites.sh deleted (both locations)
- [ ] No function exceeds 150 lines
- [ ] Shared validation function exists in lib/common.sh
- [ ] Unused helpers removed

### US4: Extended CLI Features
- [ ] Gate supports multiple test runners
- [ ] Backlog parsing handles priority column

---

## File-Level Verification

### Scripts Modified
| File | Verification |
|------|-------------|
| lib/common.sh | sanitize_for_pattern() exists |
| lib/common.sh | validate_phase_number() exists |
| specflow-state.sh | No debug leftovers |
| specflow-state.sh | cmd_migrate split into functions |
| specflow-state.sh | cmd_infer split into functions |
| specflow-state.sh | Trap cleanup on temp files |
| specflow-roadmap.sh | Placeholder goal validation |
| specflow-roadmap.sh | grep -F for literals |
| specflow-roadmap.sh | Status stored as text |
| specflow-gate.sh | detect_test_runner() exists |
| specflow-gate.sh | Supports pytest, go test, bats |
| specflow-feature.sh | Input validation checks |
| specflow-context.sh | Quoted parameter expansions |
| specflow-import.sh | Error handling on external cmds |

### Documentation Modified
| File | Verification |
|------|-------------|
| README.md | No YOUR_USERNAME placeholders |
| README.md | Customizing Templates section exists |
| README.md | Memory subcommands match CLI |
| CLAUDE.md | Architecture includes lib/*.sh |
| CLAUDE.md | No init-*.md references |
| ROADMAP.md | Status icons match legend |
| specflow.specify.md | References specflow feature create |

### Files Deleted
| File | Verification |
|------|-------------|
| scripts/bash/check-prerequisites.sh | Does not exist |
| .specify/scripts/bash/check-prerequisites.sh | Does not exist |

---

## Final Sign-Off

- [ ] All 42 tasks marked complete in tasks.md
- [ ] `specflow doctor` shows no warnings
- [ ] Git working tree clean (all changes committed)
- [ ] Branch ready for merge to main

---

## Verification Commands

```bash
# Run all critical checks
shellcheck scripts/bash/*.sh
./tests/test-runner.sh
grep -r "YOUR_USERNAME" README.md
grep -r "check-prerequisites.sh" . --include="*.md" --include="*.sh"
grep -r "create-new-feature.sh" . --include="*.md"
specflow doctor

# Verify file deletions
ls scripts/bash/check-prerequisites.sh 2>&1  # Should fail
ls .specify/scripts/bash/check-prerequisites.sh 2>&1  # Should fail

# Verify new functions
grep -n "sanitize_for_pattern" scripts/bash/lib/common.sh
grep -n "validate_phase_number" scripts/bash/lib/common.sh
grep -n "detect_test_runner" scripts/bash/specflow-gate.sh
```
