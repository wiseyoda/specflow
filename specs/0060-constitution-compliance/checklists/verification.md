# Verification Checklist: Constitution Compliance

**Phase**: 0060
**Created**: 2026-01-11
**Type**: Post-completion verification

---

## Critical Fixes (Must Pass)

### LIB008 - Phase Command
- [ ] `specflow phase` command runs without "slash command" error
- [ ] `specflow phase --help` shows proper help output
- [ ] `specflow phase show 0060` displays phase details

### TPL012 - Duplicate Templates
- [ ] `.specify/templates/` directory does not exist
- [ ] `templates/` is the only template source
- [ ] `specflow templates list` works correctly

---

## Three-Line Output Rule Compliance

### Sample Commands to Test
For each command, verify that **critical status appears in first 3 lines**:

- [ ] `specflow detect` - Detection results first, not decorative header
- [ ] `specflow gate specify` - Gate result (PASS/FAIL) in first line
- [ ] `specflow lessons list` - Entry count or "no entries" first
- [ ] `specflow context` - Feature context path first
- [ ] `specflow templates check` - Template status first
- [ ] `specflow roadmap validate` - Validation result first
- [ ] `specflow memory list` - Document count first
- [ ] `specflow pdr validate` - Validation result first
- [ ] `specflow scaffold --status` - Status first
- [ ] `specflow state reconcile` - Reconciliation result first

### Pattern Verification
- [ ] No `print_header()` calls before status output
- [ ] All commands use `print_summary()` or equivalent pattern
- [ ] JSON output (`--json`) unaffected by three-line changes

---

## Hardcoded Path Remediation

- [ ] `grep -r "HOME/.specflow" scripts/bash/` only returns common.sh results
- [ ] `grep -r "HOME/.claude/specflow" scripts/bash/` only returns common.sh results
- [ ] All scripts use `get_specflow_system_dir()` or `get_specflow_registry()`

---

## POSIX Compliance

- [ ] `sed -i` usages work on macOS (BSD sed)
- [ ] `sed -i` usages work on Linux (GNU sed)
- [ ] No shellcheck errors on modified scripts
- [ ] No bash-specific features without POSIX fallbacks

---

## Library Fixes

### json.sh
- [ ] Double-source guard present (`[[ -n "${_JSON_SH_LOADED:-}" ]]`)
- [ ] No unquoted jq interpolation warnings
- [ ] `json_set` function works correctly
- [ ] `json_array_append` function works correctly

### specflow-issue.sh
- [ ] Arithmetic operations don't exit on set -e
- [ ] `specflow issue list` works without errors

---

## Slash Command Compliance

### CLI Command References
- [ ] `commands/specflow.specify.md` - No setup-plan.sh references
- [ ] `commands/specflow.plan.md` - No deprecated script references
- [ ] `commands/specflow.verify.md` - Uses `specflow tasks mark` for completions
- [ ] `commands/specflow.backlog.md` - Uses CLI commands, not direct edits
- [ ] `commands/specflow.phase.md` - Uses specflow pdr commands
- [ ] `commands/specflow.init.md` - Uses specflow state set

### No Direct Edits
- [ ] Slash commands don't use Edit tool on state files
- [ ] Slash commands don't use Edit tool on tasks.md checkboxes
- [ ] Slash commands reference valid CLI commands

---

## Template Standardization

### 4-Digit ABBC Format
- [ ] `templates/backlog-template.md` - Uses 4-digit phase numbers
- [ ] `templates/deferred-template.md` - Uses 4-digit phase numbers
- [ ] `templates/plan-template.md` - Uses 4-digit phase numbers
- [ ] `templates/spec-template.md` - Uses 4-digit phase numbers
- [ ] `templates/tasks-template.md` - Uses 4-digit phase numbers

### Content Quality
- [ ] `templates/openapi-template.yaml` - No project-specific references
- [ ] All templates have consistent format

---

## Documentation

### README.md
- [ ] `--check` description accurate (verify installation, not run tests)
- [ ] All doc links (`docs/*.md`) exist or are removed
- [ ] Installation instructions work as documented

---

## Constitution Compliance Score

Target: **95%+ overall compliance**

| Principle | Target | Verification |
|-----------|--------|--------------|
| I. Developer Experience First | 95%+ | UX testing |
| II. POSIX-Compliant Bash | 100% | shellcheck passes |
| III. CLI Over Direct Edits | 100% | Slash command audit |
| IV. Simplicity Over Cleverness | 100% | Code review |
| V. Helpful Error Messages | 95%+ | Error testing |
| VI. Graceful Degradation | 100% | Missing file tests |
| VII. Three-Line Output Rule | 100% | Output sampling |

---

## Final Verification

- [ ] All 58 tasks marked complete in tasks.md
- [ ] `./tests/test-runner.sh` passes all tests
- [ ] No regressions in existing functionality
- [ ] `specflow doctor` shows no issues
- [ ] Git working directory clean (all changes committed)
