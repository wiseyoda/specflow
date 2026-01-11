# PDR: Constitution & Standards Compliance Remediation

**PDR ID**: `pdr-compliance-remediation`
**Created**: 2026-01-11
**Author**: Agent (Compliance Audit)
**Status**: Ready
**Priority**: P1

---

## Problem Statement

**The Problem**: A comprehensive audit of 93 files revealed 92 compliance violations against SpecKit's own constitution and coding standards. The most significant gaps are:
- 30% compliance with Principle VII (Three-Line Output Rule) - 26 violations
- 70% compliance with Principle III (CLI Over Direct Edits) - 10 violations in commands
- 2 critical bugs blocking functionality
- 6 hardcoded paths violating portability standards

**Who is affected**:
- **Developers using SpecKit**: Experience inconsistent CLI output, broken commands
- **Contributors**: Unclear which standards to follow when patterns vary
- **Maintainers**: Technical debt accumulating from inconsistent patterns

**Current workaround**:
- Users must scroll through verbose output to find critical information
- `speckit phase` command is broken (blocked by slash-command warning)
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
**As a** developer using SpecKit CLI,
**I want to** see the most important information in the first 3 lines of output,
**So that** I can quickly understand command results without scrolling.

**Value**: Faster feedback loops, reduced cognitive load

### Story 2: Consistent Command Behavior
**As a** developer following slash command instructions,
**I want to** know that all state changes go through CLI commands,
**So that** I maintain data integrity and audit trails.

**Value**: Predictable behavior, no hidden side effects

### Story 3: Working CLI Commands
**As a** developer using SpecKit,
**I want to** run `speckit phase` without errors,
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
| CLI002 | speckit-doctor.sh | ~22 | Hardcoded SPECKIT_SYSTEM_DIR | Use get_speckit_system_dir() |
| CLI003 | speckit-detect.sh | ~25 | Hardcoded SPECKIT_SYSTEM_DIR | Use get_speckit_system_dir() |
| CS001 | speckit-state.sh | 29 | Hardcoded SPECKIT_REGISTRY | Move to common.sh |
| CS002 | speckit-templates.sh | 23 | Hardcoded SPECKIT_SYSTEM_DIR | Move to common.sh |
| CS003 | speckit-scaffold.sh | 25 | Hardcoded SPECKIT_SYSTEM_DIR | Move to common.sh |

#### POSIX Compliance (2 issues)

| ID | File | Line | Issue | Remediation |
|----|------|------|-------|-------------|
| CLI005 | speckit-lessons.sh | ~302 | Non-portable sed -i | Add platform detection |
| CLI012 | speckit-feature.sh | ~67 | Extended glob without extglob | Add shopt -s extglob |

#### Three-Line Output Rule (26 issues)

| ID | File | Function | Issue |
|----|------|----------|-------|
| CLI001 | speckit-detect.sh | main | Decorative header before status |
| CLI004 | speckit-gate.sh | main | Header before gate results |
| CLI006 | speckit-lessons.sh | search | Header before search results |
| CLI007 | speckit-lessons.sh | list | Header before entries list |
| CLI008 | speckit-import.sh | import | 'ADR Import' header before status |
| CLI009 | speckit-context.sh | context | 'Feature Context' header before path |
| CLI010 | speckit-git.sh | branches | log_step before branch listing |
| CLI011 | speckit-manifest.sh | status | Header before version status |
| TLR001 | speckit-reconcile.sh | main | print_header before status |
| TLR002 | speckit-reconcile.sh | apply_fixes | print_header before results |
| TLR003 | speckit-reconcile.sh | show_summary | print_header before content |
| TLR004 | speckit-templates.sh | cmd_check | print_header before status |
| TLR005 | speckit-templates.sh | cmd_diff | print_header before output |
| TLR006 | speckit-templates.sh | cmd_list | print_header before list |
| TLR007 | speckit-phase.sh | cmd_migrate | log_step before analysis |
| TLR008 | speckit-roadmap.sh | cmd_validate | log_step before results |
| TLR009 | speckit-roadmap.sh | cmd_renumber | log_step before analysis |
| TLR010 | speckit-memory.sh | cmd_init | log_step before creation |
| TLR011 | speckit-memory.sh | cmd_list | log_step before listing |
| TLR012 | speckit-memory.sh | cmd_check | log_step before health |
| TLR013 | speckit-migrate.sh | cmd_roadmap | log_step before migration |
| TLR014 | speckit-pdr.sh | cmd_validate | log_step before validation |
| TLR015 | speckit-scaffold.sh | cmd_scaffold | log_step before creation |
| TLR016 | speckit-state.sh | cmd_reconcile | log_step before results |
| TLR017 | speckit-state.sh | cmd_migrate | log_step before output |
| TLR018 | speckit-state.sh | cmd_infer | log_step before inference |

#### Other Issues (1 issue)

| ID | File | Line | Issue | Remediation |
|----|------|------|-------|-------------|
| CLI013 | speckit-issue.sh | ~364 | Arithmetic can cause set -e exit | Use ((x++)) \|\| true |

---

### Category 2: Library Files (8 issues)

| ID | File | Line | Issue | Effort | Impact | Priority |
|----|------|------|-------|--------|--------|----------|
| **LIB008** | bin/speckit | 334 | **'phase' in slash-command warning blocks valid CLI** | 1 | 4 | **1** |
| LIB001 | json.sh | ~13-18 | Missing double-source guard | 1 | 3 | 2 |
| LIB005 | json.sh | 84 | Unquoted variable in jq interpolation | 2 | 3 | 2 |
| LIB006 | json.sh | 217 | json_array_append unquoted interpolation | 2 | 3 | 2 |
| LIB002 | detection.sh | ~13-14 | Non-standard guard pattern | 1 | 2 | 3 |
| LIB004 | common.sh | 473 | eval in atomic_transform() | 2 | 3 | 3 |
| LIB003 | detection.sh | ~13-14 | Inconsistent guard variable naming | 1 | 1 | 4 |
| LIB007 | bin/speckit | 45 | Useless cat in pipeline | 1 | 1 | 5 |

---

### Category 3: Slash Commands (18 issues)

#### Principle III Violations (CLI Over Direct Edits)

| ID | File | Issue | Required CLI |
|----|------|-------|--------------|
| CMD004 | speckit.verify.md | Uses sed to edit tasks.md | speckit tasks mark |
| CMD005 | speckit.backlog.md | Direct tasks.md edit to defer | speckit tasks defer |
| CMD006 | speckit.backlog.md | Direct ROADMAP.md Scope edit | speckit roadmap scope |
| CMD007 | speckit.phase.md | Direct PDR file edits | speckit pdr update |
| CMD012 | speckit.init.md | Direct discovery/state.md edit | speckit state set |

#### Deprecated Script References

| ID | File | Issue | Replacement |
|----|------|-------|-------------|
| CMD001 | speckit.specify.md | Uses setup-plan.sh | speckit context |
| CMD002 | speckit.plan.md | Uses setup-plan.sh | speckit context --json |
| CMD003 | speckit.plan.md | Uses update-agent-context.sh | speckit claude-md update |

#### Missing CLI Commands Referenced

| ID | File | Issue |
|----|------|-------|
| CMD014 | speckit.merge.md | References speckit handoff create (doesn't exist) |
| CMD025 | speckit.verify.md | References speckit roadmap update (syntax may differ) |
| CMD026 | speckit.verify.md | References speckit claude-md update (may not exist) |

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
| TST001 | speckit-gate.sh | 2 |
| TST006 | speckit-phase.sh | 2 |
| TST002 | speckit-issue.sh | 3 |
| TST003 | speckit-lessons.sh | 3 |
| TST004 | speckit-manifest.sh | 4 |
| TST005 | speckit-pdr.sh | 4 |

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

1. Fix LIB008: Remove 'phase' from bin/speckit:334 slash-command warning
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

1. Add missing CLI commands (speckit tasks defer, speckit pdr update, etc.)
2. Update slash commands to reference correct CLI commands
3. Remove deprecated script references

### Phase 5: Template & Test Cleanup
**Effort**: 4-6 hours

1. Sync all templates to 4-digit ABBC format
2. Add missing test coverage (6 test files)
3. Fix test isolation issue in test-templates.sh

---

## Acceptance Criteria

1. [ ] `speckit phase` command works without errors
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
