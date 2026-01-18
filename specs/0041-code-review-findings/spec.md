---
version: '1.0'
description: 'Feature specification for code review findings implementation'
---

# Feature Specification: Code Review Findings

**Feature Branch**: `0041-code-review-findings`
**Created**: 2026-01-11
**Status**: Draft
**Input**: Review document `.specify/reviews/review-20260111.md` with 36 approved findings

## Overview

Address 36 code quality findings from systematic code review (2026-01-11). Findings are organized into 7 categories: Best Practices (6), Refactoring (7), Hardening (4), Missing Features (3), Orphaned Code (4), Over-Engineering (4), and Outdated Docs (8).

## Clarifications

### C1: Legacy File Cleanup (OC001)
**Question**: check-prerequisites.sh files to delete - verify existence first?
**Answer**: Verify first. Both instances confirmed to exist:
- `./scripts/bash/check-prerequisites.sh`
- `./.specify/scripts/bash/check-prerequisites.sh`

### C2: Deferred Items
The following findings are explicitly deferred to future phases:
- **OE001**: Migrate roadmap phase data to JSON state (architectural change, v3.0 scope)
- **OE002**: Split specflow-state.sh into state.sh + registry.sh (architectural change, v3.0 scope)
- **OD006**: Split specflow.memory.md (low impact, current format works)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reliable Script Execution (Priority: P1)

As a developer using SpecFlow CLI, I need scripts to handle errors gracefully without unsafe patterns like eval() so the CLI doesn't fail unexpectedly or create security risks.

**Why this priority**: Security and reliability are foundational. Unsafe patterns like BP001 (eval) and missing error handling can cause data corruption or security vulnerabilities.

**Independent Test**: Run all CLI commands with malformed inputs; none should cause unexpected behavior or security issues.

**Acceptance Scenarios**:

1. **Given** check-prerequisites.sh exists, **When** I review the code, **Then** no eval() patterns exist
2. **Given** all scripts, **When** running with `set -euo pipefail`, **Then** errors are caught and handled cleanly
3. **Given** user input containing special characters, **When** passed to jq/grep, **Then** input is sanitized

---

### User Story 2 - Accurate Documentation (Priority: P2)

As a new SpecFlow user, I need documentation that reflects actual commands and paths so I can successfully install and use the tool without confusion.

**Why this priority**: Documentation mismatches cause user frustration and support burden. Placeholders and stale references make the tool appear unmaintained.

**Independent Test**: Follow README.md instructions on a fresh system; all commands work as documented.

**Acceptance Scenarios**:

1. **Given** README.md, **When** I read install commands, **Then** no YOUR_USERNAME placeholders exist
2. **Given** specflow.specify.md, **When** I look for feature creation, **Then** it references `specflow feature create` not `create-new-feature.sh`
3. **Given** CLAUDE.md, **When** I read architecture diagram, **Then** it includes lib/json.sh and lib/detection.sh
4. **Given** ROADMAP.md status table, **When** I view phases, **Then** emoji icons match the legend

---

### User Story 3 - Clean Codebase (Priority: P3)

As a maintainer, I need orphaned code removed and functions appropriately sized so the codebase is navigable and maintainable.

**Why this priority**: Technical debt compounds. Large functions and orphaned code make future changes risky and slow.

**Independent Test**: Run shellcheck on modified scripts; verify function lengths are under 150 lines.

**Acceptance Scenarios**:

1. **Given** check-prerequisites.sh legacy scripts, **When** I check file existence, **Then** they are deleted
2. **Given** specflow-state.sh cmd_migrate() function, **When** I measure it, **Then** it's split into smaller functions under 150 lines
3. **Given** duplicate validation patterns, **When** I search codebase, **Then** they use shared lib functions

---

### User Story 4 - Extended CLI Features (Priority: P4)

As a developer using different test frameworks, I need the gate command to support pytest, go test, and bats in addition to npm test.

**Why this priority**: Multi-runner support broadens SpecFlow's applicability to non-Node.js projects.

**Independent Test**: Run `specflow gate` on Python, Go, and Bash projects; correct runner is detected.

**Acceptance Scenarios**:

1. **Given** a Python project with pytest, **When** I run `specflow gate`, **Then** pytest is used as test runner
2. **Given** a Go project, **When** I run `specflow gate`, **Then** `go test` is used
3. **Given** a Bash project with bats tests, **When** I run `specflow gate`, **Then** bats is used

---

### Edge Cases

- What happens when scripts encounter mid-execution failures with temp files? (HD002: trap cleanup)
- How does system handle malicious phase names in roadmap insert? (HD001: input sanitization)
- What if user passes empty string to validation functions? (BP006: error handling)

## Requirements _(mandatory)_

### Functional Requirements

**Best Practices (BP)**:
- **FR-BP001**: Scripts MUST NOT use eval() for variable assignment
- **FR-BP002**: All scripts MUST use `set -euo pipefail` strict mode
- **FR-BP003**: Scripts MUST NOT contain debug/development leftover code
- **FR-BP004**: All parameter expansions MUST be properly quoted
- **FR-BP005**: Magic numbers MUST have documenting comments
- **FR-BP006**: Functions MUST validate inputs and return errors appropriately

**Refactoring (RF)**:
- **FR-RF001**: No function SHOULD exceed 150 lines; cmd_migrate() and cmd_infer() MUST be split
- **FR-RF002**: Registry manipulation MUST use single jq approach, max 2 levels of nesting
- **FR-RF003**: Duplicate registry patterns MUST be extracted to shared helpers
- **FR-RF004**: State inference logic SHOULD use state machine pattern
- **FR-RF005**: Scaffold path logic SHOULD be data-driven configuration
- **FR-RF006**: Phase validation regex MUST exist in single shared location
- **FR-RF007**: External command calls MUST have error handling

**Hardening (HD)**:
- **FR-HD001**: User input MUST be sanitized before use in jq/grep expressions
- **FR-HD002**: Scripts MUST clean up temp files on error via trap
- **FR-HD003**: Scripts MUST validate external dependency availability
- **FR-HD004**: grep patterns MUST use -F flag or proper escaping

**Missing Features (MF)**:
- **FR-MF001**: Roadmap insert MUST validate goals are not placeholders before writing
- **FR-MF002**: Gate command MUST support pytest, go test, and bats runners
- **FR-MF003**: Backlog SHOULD support priority tracking/sorting

**Orphaned Code (OC)**:
- **FR-OC001**: Legacy check-prerequisites.sh files MUST be deleted
- **FR-OC002**: All references to create-new-feature.sh MUST be updated
- **FR-OC003**: Legacy init-*.md references MUST be removed from docs
- **FR-OC004**: Unused helper functions MUST be inlined or deleted

**Over-Engineering (OE)**:
- **FR-OE001**: Roadmap phase data SHOULD migrate to JSON state (deferred to future)
- **FR-OE002**: specflow-state.sh SHOULD be split into state.sh + registry.sh (deferred to future)
- **FR-OE003**: Status SHOULD store as text, convert to emoji for display only
- **FR-OE004**: check_sections() SHOULD use validation config file

**Outdated Docs (OD)**:
- **FR-OD001**: README.md badges MUST use actual repo owner
- **FR-OD002**: Install commands MUST NOT contain YOUR_USERNAME placeholders
- **FR-OD003**: ROADMAP.md status icons MUST match legend
- **FR-OD004**: CLAUDE.md architecture diagram MUST include all lib files
- **FR-OD005**: specflow.specify.md MUST reference current CLI commands
- **FR-OD006**: specflow.memory.md density is acceptable (defer split)
- **FR-OD007**: README SHOULD add "Customizing Templates" section
- **FR-OD008**: README memory subcommands MUST match actual CLI syntax

### Key Entities

- **Finding**: ID, category, file, line, severity, effort, description, recommendation
- **Script**: Path, functions, line count, dependencies
- **Documentation**: Path, references (internal/external), placeholders

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 36 findings addressed (implemented or explicitly re-deferred with rationale)
- **SC-002**: `shellcheck scripts/bash/*.sh` passes with no errors on modified files
- **SC-003**: All existing tests continue to pass (`./tests/test-runner.sh`)
- **SC-004**: No YOUR_USERNAME placeholders in any documentation
- **SC-005**: No references to deleted scripts (check-prerequisites.sh, create-new-feature.sh)
- **SC-006**: `specflow gate` detects and uses correct test runner for Python/Go/Bash projects

## Implementation Notes

### Priority Order (per review document)

**High Priority (Severity 4, Quick Wins)**:
1. BP001 - Remove unsafe eval (check-prerequisites.sh)
2. OC002, OD005 - Fix create-new-feature.sh references
3. OD002 - Replace GitHub username placeholders

**Medium Priority (Severity 3)**:
4. HD001 - Add input validation before jq/grep
5. BP002 - Upgrade to set -euo pipefail
6. RF001 - Break up large functions in specflow-state.sh
7. MF001 - Validate placeholder goals before write

**Lower Priority (Code Hygiene)**:
8. RF003, RF006 - Extract helpers, shared validation
9. Documentation updates (OD001-OD008 remaining)
10. OE003, OE004 - Simplify emoji handling

### Deferred Items (Future Phases)

- OE001: Full roadmap JSON migration (architectural change, high effort)
- OE002: Split specflow-state.sh (architectural change, high effort)
- OD006: Split specflow.memory.md (low impact, works as-is)
