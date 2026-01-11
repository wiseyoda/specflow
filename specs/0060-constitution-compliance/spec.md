# Feature Specification: Constitution & Standards Compliance Remediation

**Phase**: 0060 - Constitution Compliance
**Created**: 2026-01-11
**Status**: Draft
**Branch**: `0060-constitution-compliance`

---

## Overview

Remediate 92 compliance violations identified in a comprehensive audit, achieving 95%+ constitution compliance. The most significant gaps are in the Three-Line Output Rule (30% compliance) and CLI Over Direct Edits principle (70% compliance).

---

## User Stories

### US1: CLI Output Clarity
**As a** developer using SpecKit CLI,
**I want to** see the most important information in the first 3 lines of output,
**So that** I can quickly understand command results without scrolling.

**Acceptance Criteria**:
- [ ] All 26 identified CLI functions show status in first 3 lines
- [ ] `print_summary()` helper is available and documented
- [ ] No decorative headers appear before status output

### US2: Consistent Command Behavior
**As a** developer following slash command instructions,
**I want to** know that all state changes go through CLI commands,
**So that** I maintain data integrity and audit trails.

**Acceptance Criteria**:
- [ ] All slash commands reference valid CLI commands
- [ ] No direct Edit operations on state/task files in slash commands
- [ ] Deprecated script references removed from slash commands

### US3: Working CLI Commands
**As a** developer using SpecKit,
**I want to** run `speckit phase` without errors,
**So that** I can manage phase details as documented.

**Acceptance Criteria**:
- [ ] `speckit phase` command works without "slash command" warning
- [ ] LIB008 bug fixed (remove 'phase' from warning list)
- [ ] All CLI commands documented correctly in help output

### US4: Single Template Source
**As a** contributor modifying templates,
**I want to** have one canonical location for templates,
**So that** I don't accidentally edit the wrong file.

**Acceptance Criteria**:
- [ ] `.specify/templates/` directory removed (if exists)
- [ ] `templates/` is the single source of truth
- [ ] All templates use 4-digit ABBC phase numbering

---

## Functional Requirements

### FR1: Critical Bug Fixes (P1)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Fix bin/speckit:334 - remove 'phase' from slash-command warning | Critical |
| FR1.2 | Delete `.specify/templates/` if it exists (templates/ is canonical) | Critical |

### FR2: Hardcoded Path Remediation
| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Centralize SPECKIT_SYSTEM_DIR, SPECKIT_REGISTRY in common.sh | High |
| FR2.2 | Update speckit-doctor.sh to use get_speckit_system_dir() | High |
| FR2.3 | Update speckit-detect.sh to use get_speckit_system_dir() | High |
| FR2.4 | Update speckit-state.sh to use centralized registry path | High |
| FR2.5 | Update speckit-templates.sh to use get_speckit_system_dir() | High |
| FR2.6 | Update speckit-scaffold.sh to use get_speckit_system_dir() | High |

### FR3: Three-Line Output Rule Compliance
| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | Create `print_summary()` helper function in common.sh | High |
| FR3.2 | Refactor speckit-detect.sh main() for three-line output | High |
| FR3.3 | Refactor speckit-gate.sh main() for three-line output | High |
| FR3.4 | Refactor speckit-lessons.sh search/list for three-line output | High |
| FR3.5 | Refactor speckit-import.sh import() for three-line output | High |
| FR3.6 | Refactor speckit-context.sh context() for three-line output | High |
| FR3.7 | Refactor speckit-git.sh branches() for three-line output | High |
| FR3.8 | Refactor speckit-manifest.sh status() for three-line output | High |
| FR3.9 | Refactor speckit-reconcile.sh functions for three-line output | High |
| FR3.10 | Refactor speckit-templates.sh functions for three-line output | High |
| FR3.11 | Refactor speckit-phase.sh cmd_migrate for three-line output | High |
| FR3.12 | Refactor speckit-roadmap.sh validate/renumber for three-line output | High |
| FR3.13 | Refactor speckit-memory.sh functions for three-line output | High |
| FR3.14 | Refactor speckit-migrate.sh cmd_roadmap for three-line output | High |
| FR3.15 | Refactor speckit-pdr.sh cmd_validate for three-line output | High |
| FR3.16 | Refactor speckit-scaffold.sh cmd_scaffold for three-line output | High |
| FR3.17 | Refactor speckit-state.sh reconcile/migrate/infer for three-line output | High |

### FR4: POSIX Compliance Fixes
| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | Add platform detection for sed -i in speckit-lessons.sh | Medium |
| FR4.2 | Add shopt -s extglob to speckit-feature.sh where needed | Medium |

### FR5: Library File Fixes
| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Add double-source guard to json.sh | Medium |
| FR5.2 | Fix unquoted variable in jq interpolation (json.sh:84) | Medium |
| FR5.3 | Fix json_array_append unquoted interpolation (json.sh:217) | Medium |
| FR5.4 | Fix speckit-issue.sh arithmetic to avoid set -e exit | Low |

### FR6: Slash Command Updates
| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | Remove references to setup-plan.sh from speckit.specify.md | Medium |
| FR6.2 | Remove references to setup-plan.sh from speckit.plan.md | Medium |
| FR6.3 | Remove references to update-agent-context.sh | Medium |
| FR6.4 | Update speckit.verify.md to use speckit tasks mark | Medium |
| FR6.5 | Update speckit.backlog.md to use proper CLI commands | Medium |
| FR6.6 | Update speckit.phase.md to use speckit pdr commands | Medium |
| FR6.7 | Update speckit.init.md to use speckit state set | Medium |

### FR7: Template Standardization
| ID | Requirement | Priority |
|----|-------------|----------|
| FR7.1 | Update backlog-template.md to 4-digit ABBC format | Medium |
| FR7.2 | Update deferred-template.md to 4-digit ABBC format | Medium |
| FR7.3 | Update plan-template.md to 4-digit ABBC format | Medium |
| FR7.4 | Update spec-template.md to 4-digit ABBC format | Medium |
| FR7.5 | Update tasks-template.md to 4-digit ABBC format | Medium |
| FR7.6 | Fix openapi-template.yaml project-specific references | Low |

### FR8: Documentation Fixes
| ID | Requirement | Priority |
|----|-------------|----------|
| FR8.1 | Fix README.md --check description (doesn't run tests) | Medium |
| FR8.2 | Verify all README.md doc links exist | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR1 | Backward compatibility | No breaking changes to existing CLI commands |
| NFR2 | Test suite passes | All existing tests continue to pass |
| NFR3 | Meta-compliance | All changes follow constitution principles |
| NFR4 | Shell validation | All modified scripts pass shellcheck |

---

## Technical Constraints

1. **POSIX Compliance**: All bash scripts must be POSIX-compliant with shellcheck validation
2. **Backward Compatibility**: No breaking changes to CLI command interfaces
3. **Single Source**: templates/ is the canonical template location
4. **Exit Codes**: 0=success, 1=error, 2=warning

---

## Out of Scope

- Adding new features beyond fixing compliance issues
- Performance optimization
- Major refactoring beyond fixing violations
- Adding new test coverage beyond identified gaps
- Web UI changes

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Constitution v1.1.0 | Reference standard | Available |
| coding-standards.md | Reference standard | Available |
| Glossary | Reference standard | Available |
| common.sh | Code dependency | Must be updated first |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing behavior | High | Run full test suite after each change |
| Scope creep during refactoring | Medium | Strict adherence to documented issues only |
| Missing issues not in PDR | Low | Document any new issues for future phases |

---

## Verification Gate

Phase completion requires:
1. `speckit phase` command works without errors (LIB008 fixed)
2. All CLI commands show status in first 3 lines (three-line rule)
3. Single template directory exists (templates/ only)
4. All slash commands reference valid CLI commands
5. Constitution compliance audit shows 95%+ overall score
6. No hardcoded paths outside common.sh
7. README.md documentation accurate

---

## Appendix: Issue Tracking

Full issue details in source PDR: `_pdr-compliance-remediation.md`

### Issue Count by Category
| Category | Issues |
|----------|--------|
| CLI Scripts | 35 |
| Library Files | 8 |
| Slash Commands | 18 |
| Templates | 18 |
| Tests | 8 |
| Root/Config | 5 |
| **Total** | **92** |
