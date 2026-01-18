# PDR: Constitution & Standards Compliance Remediation

**PDR ID**: `pdr-compliance-remediation`
**Created**: 2026-01-11
**Author**: Agent (Compliance Audit)
**Status**: Implemented
**Priority**: P1
**Phase**: 0060 - Constitution Compliance

---

## Problem Statement

**The Problem**: A comprehensive audit of 93 files revealed 92 compliance violations against SpecFlow's own constitution and coding standards. The most significant gaps are:
- 30% compliance with Principle VII (Three-Line Output Rule) - 26 violations
- 70% compliance with Principle III (CLI Over Direct Edits) - 10 violations in commands
- 2 critical bugs blocking functionality
- 6 hardcoded paths violating portability standards

**Who is affected**:
- **Developers using SpecFlow**: Experience inconsistent CLI output, broken commands
- **Contributors**: Unclear which standards to follow when patterns vary
- **Maintainers**: Technical debt accumulating from inconsistent patterns

**Current workaround**:
- Users must scroll through verbose output to find critical information
- `specflow phase` command is broken (blocked by slash-command warning)
- Duplicate templates in two locations cause confusion about which to edit

**Why now**:
- Constitution was recently formalized (v1.1.0, 2026-01-10) establishing clear standards
- Three-Line Output Rule is new and not yet propagated to existing code
- Technical debt will compound as more features are added

---

## Desired Outcome

**After this remediation ships, users will be able to**:
- See critical status information in the first 3 lines of every CLI command output
- Use all CLI commands without encountering blocking bugs
- Trust that slash commands use CLI tools consistently (not direct file edits)
- Rely on a single source of truth for templates

**The experience should feel**: consistent, predictable, professional

---

## Audit Summary

### Files Analyzed: 93
### Issues Found: 92

| Category | Files | Issues | Critical | High | Medium | Low |
|----------|-------|--------|----------|------|--------|-----|
| CLI Scripts | 23 | 35 | 0 | 3 | 8 | 24 |
| Library Files | 4 | 8 | 1 | 3 | 2 | 2 |
| Slash Commands | 21 | 18 | 0 | 4 | 8 | 6 |
| Templates | 14 | 18 | 1 | 6 | 9 | 2 |
| Tests | 18 | 8 | 0 | 3 | 2 | 3 |
| Root/Config | 5 | 5 | 0 | 3 | 2 | 0 |
| **Total** | **93** | **92** | **2** | **22** | **31** | **37** |

### Compliance by Principle

| Principle | Score | Violations |
|-----------|-------|------------|
| I. Developer Experience First | 95% | 2 minor |
| II. POSIX-Compliant Bash | 85% | 4 |
| III. CLI Over Direct Edits | 70% | 10 |
| IV. Simplicity Over Cleverness | 100% | 0 |
| V. Helpful Error Messages | 95% | 2 minor |
| VI. Graceful Degradation | 100% | 0 |
| VII. Three-Line Output Rule | 30% | 26 |

**Overall Constitution Compliance: 82%**

---

## User Stories

### Story 1: CLI Output Clarity
**As a** developer using SpecFlow CLI,
**I want to** see the most important information in the first 3 lines of output,
**So that** I can quickly understand command results without scrolling.

**Value**: Faster feedback loops, reduced cognitive load

### Story 2: Consistent Command Behavior
**As a** developer following slash command instructions,
**I want to** know that all state changes go through CLI commands,
**So that** I maintain data integrity and audit trails.

**Value**: Predictable behavior, no hidden side effects

### Story 3: Working CLI Commands
**As a** developer using SpecFlow,
**I want to** run `specflow phase` without errors,
**So that** I can manage phase details as documented.

**Value**: Feature completeness, trust in documentation

### Story 4: Single Template Source
**As a** contributor modifying templates,
**I want to** have one canonical location for templates,
**So that** I don't accidentally edit the wrong file.

**Value**: Reduced confusion, no sync drift

---

## Detailed Findings

### Category 1: CLI Scripts (35 issues)

#### Hardcoded Paths (6 issues)

| ID | File | Line | Issue | Remediation |
|----|------|------|-------|-------------|
| CLI002 | specflow-doctor.sh | ~22 | Hardcoded SPECFLOW_SYSTEM_DIR | Use get_specflow_system_dir() |
| CLI003 | specflow-detect.sh | ~25 | Hardcoded SPECFLOW_SYSTEM_DIR | Use get_specflow_system_dir() |
| CS001 | specflow-state.sh | 29 | Hardcoded SPECFLOW_REGISTRY | Move to common.sh |
| CS002 | specflow-templates.sh | 23 | Hardcoded SPECFLOW_SYSTEM_DIR | Move to common.sh |
| CS003 | specflow-scaffold.sh | 25 | Hardcoded SPECFLOW_SYSTEM_DIR | Move to common.sh |

#### POSIX Compliance (2 issues)

| ID | File | Line | Issue | Remediation |
|----|------|------|-------|-------------|
| CLI005 | specflow-lessons.sh | ~302 | Non-portable sed -i | Add platform detection |
| CLI012 | specflow-feature.sh | ~67 | Extended glob without extglob | Add shopt -s extglob |

#### Three-Line Output Rule (26 issues)

| ID | File | Function | Issue |
|----|------|----------|-------|
| CLI001 | specflow-detect.sh | main | Decorative header before status |
| CLI004 | specflow-gate.sh | main | Header before gate results |
| CLI006 | specflow-lessons.sh | search | Header before search results |
| CLI007 | specflow-lessons.sh | list | Header before entries list |
| CLI008 | specflow-import.sh | import | 'ADR Import' header before status |
| CLI009 | specflow-context.sh | context | 'Feature Context' header before path |
| CLI010 | specflow-git.sh | branches | log_step before branch listing |
| CLI011 | specflow-manifest.sh | status | Header before version status |
| TLR001 | specflow-reconcile.sh | main | print_header before status |
| TLR002 | specflow-reconcile.sh | apply_fixes | print_header before results |
| TLR003 | specflow-reconcile.sh | show_summary | print_header before content |
| TLR004 | specflow-templates.sh | cmd_check | print_header before status |
| TLR005 | specflow-templates.sh | cmd_diff | print_header before output |
| TLR006 | specflow-templates.sh | cmd_list | print_header before list |
| TLR007 | specflow-phase.sh | cmd_migrate | log_step before analysis |
| TLR008 | specflow-roadmap.sh | cmd_validate | log_step before results |
| TLR009 | specflow-roadmap.sh | cmd_renumber | log_step before analysis |
| TLR010 | specflow-memory.sh | cmd_init | log_step before creation |
| TLR011 | specflow-memory.sh | cmd_list | log_step before listing |
| TLR012 | specflow-memory.sh | cmd_check | log_step before health |
| TLR013 | specflow-migrate.sh | cmd_roadmap | log_step before migration |
| TLR014 | specflow-pdr.sh | cmd_validate | log_step before validation |
| TLR015 | specflow-scaffold.sh | cmd_scaffold | log_step before creation |
| TLR016 | specflow-state.sh | cmd_reconcile | log_step before results |
| TLR017 | specflow-state.sh | cmd_migrate | log_step before output |
| TLR018 | specflow-state.sh | cmd_infer | log_step before inference |

#### Other Issues (1 issue)

| ID | File | Line | Issue | Remediation |
|----|------|------|-------|-------------|
| CLI013 | specflow-issue.sh | ~364 | Arithmetic can cause set -e exit | Use ((x++)) \|\| true |

---

### Category 2: Library Files (8 issues)

| ID | File | Line | Issue | Effort | Impact | Priority |
|----|------|------|-------|--------|--------|----------|
| **LIB008** | bin/specflow | 334 | **'phase' in slash-command warning blocks valid CLI** | 1 | 4 | **1** |
| LIB001 | json.sh | ~13-18 | Missing double-source guard | 1 | 3 | 2 |
| LIB005 | json.sh | 84 | Unquoted variable in jq interpolation | 2 | 3 | 2 |
| LIB006 | json.sh | 217 | json_array_append unquoted interpolation | 2 | 3 | 2 |
| LIB002 | detection.sh | ~13-14 | Non-standard guard pattern | 1 | 2 | 3 |
| LIB004 | common.sh | 473 | eval in atomic_transform() | 2 | 3 | 3 |
| LIB003 | detection.sh | ~13-14 | Inconsistent guard variable naming | 1 | 1 | 4 |
| LIB007 | bin/specflow | 45 | Useless cat in pipeline | 1 | 1 | 5 |

---

### Category 3: Slash Commands (18 issues)

#### Principle III Violations (CLI Over Direct Edits)

| ID | File | Issue | Required CLI |
|----|------|-------|--------------|
| CMD004 | specflow.verify.md | Uses sed to edit tasks.md | specflow tasks mark |
| CMD005 | specflow.backlog.md | Direct tasks.md edit to defer | specflow tasks defer |
| CMD006 | specflow.backlog.md | Direct ROADMAP.md Scope edit | specflow roadmap scope |
| CMD007 | specflow.phase.md | Direct PDR file edits | specflow pdr update |
| CMD012 | specflow.init.md | Direct discovery/state.md edit | specflow state set |

#### Deprecated Script References

| ID | File | Issue | Replacement |
|----|------|-------|-------------|
| CMD001 | specflow.specify.md | Uses setup-plan.sh | specflow context |
| CMD002 | specflow.plan.md | Uses setup-plan.sh | specflow context --json |
| CMD003 | specflow.plan.md | Uses update-agent-context.sh | specflow claude-md update |

#### Missing CLI Commands Referenced

| ID | File | Issue |
|----|------|-------|
| CMD014 | specflow.merge.md | References specflow handoff create (doesn't exist) |
| CMD025 | specflow.verify.md | References specflow roadmap update (syntax may differ) |
| CMD026 | specflow.verify.md | References specflow claude-md update (may not exist) |

---

### Category 4: Templates (18 issues)

| ID | File | Issue | Priority |
|----|------|-------|----------|
| **TPL012** | .specify/templates/ | **Duplicate directory - maintenance burden** | **1** |
| TPL001 | spec-template.md | Inconsistency between locations | 2 |
| TPL006 | tasks-template.md | Format differs from glossary | 2 |
| TPL008 | openapi-template.yaml | Project-specific 'Story Sprout' name | 2 |
| TPL011 | test-ci.yaml | References unreleased Node.js 24 | 2 |
| TPL017 | backlog-template.md | Priority definitions differ from glossary | 2 |
| TPL002 | constitution-template.md | Inconsistent examples between locations | 3 |
| TPL004 | backlog-template.md | 3-digit phase numbers (should be 4-digit ABBC) | 3 |
| TPL005 | deferred-template.md | 3-digit phase numbers | 3 |
| TPL013 | plan-template.md | 3-digit branch format | 3 |
| TPL014 | plan-template.md | 3-digit project structure | 3 |
| TPL015 | spec-template.md | 3-digit branch format | 3 |
| TPL016 | tasks-template.md | 3-digit input path | 3 |
| TPL018 | plan-template.md | Invalid file path reference | 3 |

---

### Category 5: Tests (8 issues)

#### Missing Test Coverage

| ID | Script | Priority |
|----|--------|----------|
| TST001 | specflow-gate.sh | 2 |
| TST006 | specflow-phase.sh | 2 |
| TST002 | specflow-issue.sh | 3 |
| TST003 | specflow-lessons.sh | 3 |
| TST004 | specflow-manifest.sh | 4 |
| TST005 | specflow-pdr.sh | 4 |

#### Test Quality Issues

| ID | File | Issue |
|----|------|-------|
| TST011 | test-templates.sh | Creates files in user's actual ~/.claude |
| TST013 | test-context.sh | Missing git config setup |

---

### Category 6: Root/Config Files (5 issues)

| ID | File | Issue | Priority |
|----|------|-------|----------|
| DOC003 | README.md | Says --check runs tests (incorrect) | 2 |
| DOC004 | README.md | Links to docs/ files that may not exist | 2 |
| DOC006 | install.sh:143 | Command substitution in local masks errors | 3 |
| DOC007 | install.sh:171 | Command substitution in local | 3 |
| DOC008 | install.sh:236 | Command substitution in local | 3 |

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Constitution compliance score | 95%+ | Re-run compliance audit |
| Three-Line Rule compliance | 100% | All CLI commands show status first |
| Critical bugs fixed | 0 remaining | LIB008, TPL012 resolved |
| Single template source | 1 location | .specify/templates/ removed or documented |

---

## Constraints

- **Must**: Maintain backward compatibility for existing users
- **Must**: All fixes pass existing test suite
- **Must**: Changes follow constitution principles (meta-compliance)
- **Should**: Minimize scope creep - focus on documented issues only
- **Must Not**: Break any existing CLI command behavior

---

## Non-Goals

- **Not solving**: Adding new features beyond fixing compliance
- **Not solving**: Performance optimization
- **Out of scope**: Major refactoring beyond fixing violations
- **Out of scope**: Adding new test coverage beyond identified gaps

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Constitution v1.1.0 | Reference | Defines standards | Known |
| Coding standards doc | Reference | Defines patterns | Known |
| Glossary | Reference | Defines terminology | Known |

---

## Recommended Remediation Phases

### Phase 1: Critical Fixes (P1)
**Effort**: 1-2 hours

1. Fix LIB008: Remove 'phase' from bin/specflow:334 slash-command warning
2. Resolve TPL012: Delete .specify/templates/ (templates/ is canonical)

### Phase 2: High-Impact Quick Wins (P2)
**Effort**: 4-6 hours

1. Fix 6 hardcoded paths (add to common.sh)
2. Fix json.sh escaping issues (3 issues)
3. Update README.md errors (2 issues)
4. Add platform detection to sed -i usage

### Phase 3: Three-Line Rule Compliance
**Effort**: 8-12 hours

1. Create `print_summary()` helper that enforces pattern
2. Refactor 26 CLI functions to use new helper
3. Document pattern in coding-standards.md

### Phase 4: Command Alignment
**Effort**: 6-8 hours

1. Add missing CLI commands (specflow tasks defer, specflow pdr update, etc.)
2. Update slash commands to reference correct CLI commands
3. Remove deprecated script references

### Phase 5: Template & Test Cleanup
**Effort**: 4-6 hours

1. Sync all templates to 4-digit ABBC format
2. Add missing test coverage (6 test files)
3. Fix test isolation issue in test-templates.sh

---

## Acceptance Criteria

1. [ ] `specflow phase` command works without errors
2. [ ] All CLI commands show status in first 3 lines
3. [ ] Single template directory exists (templates/)
4. [ ] All slash commands reference valid CLI commands
5. [ ] Compliance audit shows 95%+ overall score
6. [ ] No hardcoded paths outside common.sh
7. [ ] All json.sh string operations properly escaped
8. [ ] README.md documentation accurate

---

## Related PDRs

- `pdr-ux-simplification`: May overlap with three-line rule improvements
- `pdr-ui-design-artifacts`: Template consolidation may affect

---

## Notes

- Audit performed 2026-01-11 using 6 parallel analysis agents
- Full findings available in conversation history
- Constitution v1.1.0 added Three-Line Output Rule on 2026-01-10
- Many three-line violations predate the rule addition
