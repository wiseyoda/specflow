# Requirements Checklist: Constitution Compliance

**Phase**: 0060
**Created**: 2026-01-11

---

## User Story Requirements

### US1: CLI Output Clarity
- [ ] REQ-US1.1: All 26 CLI functions refactored for three-line output
- [ ] REQ-US1.2: print_summary() helper created in common.sh
- [ ] REQ-US1.3: No decorative headers before status in CLI output

### US2: Consistent Command Behavior
- [ ] REQ-US2.1: All slash commands reference valid CLI commands
- [ ] REQ-US2.2: No direct Edit operations on state/task files
- [ ] REQ-US2.3: Deprecated script references removed

### US3: Working CLI Commands
- [ ] REQ-US3.1: specflow phase command works without errors
- [ ] REQ-US3.2: LIB008 bug fixed
- [ ] REQ-US3.3: All CLI commands have accurate help text

### US4: Single Template Source
- [ ] REQ-US4.1: .specify/templates/ removed if exists
- [ ] REQ-US4.2: templates/ is single source of truth
- [ ] REQ-US4.3: All templates use 4-digit ABBC format

---

## Functional Requirements

### Critical Fixes (P1)
- [ ] REQ-FR1.1: bin/specflow 'phase' removed from slash-command warning
- [ ] REQ-FR1.2: Duplicate template directory removed

### Hardcoded Paths
- [ ] REQ-FR2.1: SPECFLOW_SYSTEM_DIR centralized in common.sh
- [ ] REQ-FR2.2: SPECFLOW_REGISTRY centralized in common.sh
- [ ] REQ-FR2.3: specflow-doctor.sh uses centralized paths
- [ ] REQ-FR2.4: specflow-detect.sh uses centralized paths
- [ ] REQ-FR2.5: specflow-state.sh uses centralized paths
- [ ] REQ-FR2.6: specflow-templates.sh uses centralized paths
- [ ] REQ-FR2.7: specflow-scaffold.sh uses centralized paths

### Three-Line Output Rule
- [ ] REQ-FR3.1: print_summary() helper function created
- [ ] REQ-FR3.2: specflow-detect.sh three-line compliant
- [ ] REQ-FR3.3: specflow-gate.sh three-line compliant
- [ ] REQ-FR3.4: specflow-lessons.sh three-line compliant
- [ ] REQ-FR3.5: specflow-import.sh three-line compliant
- [ ] REQ-FR3.6: specflow-context.sh three-line compliant
- [ ] REQ-FR3.7: specflow-git.sh three-line compliant
- [ ] REQ-FR3.8: specflow-manifest.sh three-line compliant
- [ ] REQ-FR3.9: specflow-reconcile.sh three-line compliant
- [ ] REQ-FR3.10: specflow-templates.sh three-line compliant
- [ ] REQ-FR3.11: specflow-phase.sh three-line compliant
- [ ] REQ-FR3.12: specflow-roadmap.sh three-line compliant
- [ ] REQ-FR3.13: specflow-memory.sh three-line compliant
- [ ] REQ-FR3.14: specflow-migrate.sh three-line compliant
- [ ] REQ-FR3.15: specflow-pdr.sh three-line compliant
- [ ] REQ-FR3.16: specflow-scaffold.sh three-line compliant
- [ ] REQ-FR3.17: specflow-state.sh three-line compliant

### POSIX Compliance
- [ ] REQ-FR4.1: Platform detection for sed -i implemented
- [ ] REQ-FR4.2: extglob added where needed

### Library Fixes
- [ ] REQ-FR5.1: json.sh double-source guard added
- [ ] REQ-FR5.2: json.sh jq interpolation fixed (line 84)
- [ ] REQ-FR5.3: json.sh json_array_append fixed (line 217)
- [ ] REQ-FR5.4: specflow-issue.sh arithmetic fixed

### Slash Command Updates
- [ ] REQ-FR6.1: specflow.specify.md uses CLI commands
- [ ] REQ-FR6.2: specflow.plan.md uses CLI commands
- [ ] REQ-FR6.3: Deprecated script references removed
- [ ] REQ-FR6.4: specflow.verify.md uses specflow tasks mark
- [ ] REQ-FR6.5: specflow.backlog.md uses proper CLIs
- [ ] REQ-FR6.6: specflow.phase.md uses specflow pdr commands
- [ ] REQ-FR6.7: specflow.init.md uses specflow state set

### Template Standardization
- [ ] REQ-FR7.1: backlog-template.md 4-digit format
- [ ] REQ-FR7.2: deferred-template.md 4-digit format
- [ ] REQ-FR7.3: plan-template.md 4-digit format
- [ ] REQ-FR7.4: spec-template.md 4-digit format
- [ ] REQ-FR7.5: tasks-template.md 4-digit format
- [ ] REQ-FR7.6: openapi-template.yaml cleaned

### Documentation
- [ ] REQ-FR8.1: README.md --check description fixed
- [ ] REQ-FR8.2: README.md doc links verified

---

## Non-Functional Requirements

- [ ] REQ-NFR1: No breaking changes to CLI interfaces
- [ ] REQ-NFR2: All existing tests pass
- [ ] REQ-NFR3: All changes follow constitution
- [ ] REQ-NFR4: All modified scripts pass shellcheck

---

## Verification Gate Requirements

- [ ] VG1: specflow phase command works without errors
- [ ] VG2: All CLI commands show status in first 3 lines
- [ ] VG3: Single template directory (templates/ only)
- [ ] VG4: All slash commands reference valid CLI commands
- [ ] VG5: 95%+ constitution compliance score
- [ ] VG6: No hardcoded paths outside common.sh
- [ ] VG7: README.md documentation accurate
