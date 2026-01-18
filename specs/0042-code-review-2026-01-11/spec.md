# Feature Specification: Code Review 2026-01-11

**Feature Branch**: `0042-code-review-2026-01-11`
**Created**: 2026-01-11
**Status**: Draft
**Input**: Address 18 approved findings from systematic code review

## User Scenarios & Testing

### User Story 1 - POSIX-Compliant Scripts (Priority: P1)

As a developer using SpecFlow on older bash versions or different shells, I can run all CLI scripts without encountering bash 4.0+ compatibility errors.

**Why this priority**: POSIX compliance is a core constitution principle. Non-compliant code affects all users on non-bash-4 systems.

**Independent Test**: Run `specflow doctor` and `specflow reconcile` on a POSIX shell (dash) or bash 3.x - should work without errors.

**Acceptance Scenarios**:

1. **Given** bash 3.x environment, **When** running `specflow doctor`, **Then** script executes without "declare -a" or "declare -A" errors
2. **Given** bash 3.x environment, **When** running `specflow reconcile`, **Then** script executes without associative array errors
3. **Given** any SpecFlow script, **When** analyzed by shellcheck, **Then** no POSIX compatibility warnings

---

### User Story 2 - Consistent Phase Numbering (Priority: P1)

As a developer, I see consistent 4-digit phase numbers (ABBC format) everywhere in the system, avoiding confusion between old 3-digit and new 4-digit formats.

**Why this priority**: Inconsistent numbering causes user confusion and potential errors in commands.

**Independent Test**: Run `specflow help`, `specflow feature list` - all phase examples and outputs show 4-digit format.

**Acceptance Scenarios**:

1. **Given** `bin/specflow help`, **When** displaying phase examples, **Then** all examples use 4-digit format (e.g., 0010, not 001)
2. **Given** `specflow feature list`, **When** listing features, **Then** phase numbers are displayed in 4-digit format

---

### User Story 3 - Complete CLI Dispatcher (Priority: P2)

As a developer, I can access `gate` and `lessons` commands through the main `specflow` CLI dispatcher, matching the documented command set.

**Why this priority**: Missing dispatcher commands break the expected CLI interface.

**Independent Test**: Run `specflow gate --help` and `specflow lessons --help` - both should work.

**Acceptance Scenarios**:

1. **Given** main CLI dispatcher, **When** running `specflow gate`, **Then** command routes to gate script
2. **Given** main CLI dispatcher, **When** running `specflow lessons`, **Then** command routes to lessons script

---

### User Story 4 - Accurate Documentation (Priority: P2)

As a user, I find README.md and CLAUDE.md documentation that accurately describes the current implementation.

**Why this priority**: Outdated docs cause confusion and wasted time.

**Independent Test**: Compare documented commands with actual CLI output - they should match.

**Acceptance Scenarios**:

1. **Given** README.md, **When** reading CLI Reference, **Then** all listed commands exist and work
2. **Given** CLAUDE.md, **When** reading Key Files, **Then** gate and lessons commands are documented
3. **Given** README.md, **When** looking for review command, **Then** `/specflow.review` is listed

---

### User Story 5 - Robust Error Handling (Priority: P3)

As a developer, I experience consistent error messages and proper cleanup even when commands fail.

**Why this priority**: Improves debugging and system reliability.

**Independent Test**: Trigger errors in gate, import commands - should see consistent error format and no temp file leakage.

**Acceptance Scenarios**:

1. **Given** test runner detection, **When** test command fails, **Then** error is handled gracefully with clear message
2. **Given** any script with temp files, **When** script exits (normal or error), **Then** temp files are cleaned up via trap
3. **Given** ADR import, **When** file format is invalid, **Then** user sees validation error before import attempt

---

### Edge Cases

- What happens when `declare -a` scripts run on bash 3.x? - Should use POSIX alternatives
- What happens if gate command runs without test runner? - Should give helpful message
- What happens if context command can't find memory docs? - Should show availability status

## Requirements

### Functional Requirements

#### Best Practices (BP001-BP005)
- **FR-BP001**: `specflow-doctor.sh` MUST NOT use `declare -a` (bash 4.0+ feature)
- **FR-BP002**: `specflow-reconcile.sh` MUST NOT use `declare -a` or `declare -A`
- **FR-BP003**: All scripts MUST use `log_error`/`log_warn` from common.sh consistently
- **FR-BP004**: `specflow-feature.sh` MUST display 4-digit phase numbers
- **FR-BP005**: `bin/specflow` help MUST show 4-digit phase examples

#### Refactoring (RF003-RF004)
- **FR-RF003**: `specflow-doctor.sh` SHOULD have cleaner check abstraction
- **FR-RF004**: `lib/common.sh` SHOULD have unused functions removed

#### Hardening (HD001-HD003)
- **FR-HD001**: `specflow-gate.sh` MUST handle test runner errors gracefully
- **FR-HD002**: All scripts with temp files MUST have EXIT trap cleanup
- **FR-HD003**: `specflow-import.sh` MUST validate ADR format before import

#### Missing Features (MF001-MF003)
- **FR-MF001**: `bin/specflow` MUST dispatch `gate` and `lessons` subcommands
- **FR-MF002**: `specflow-gate.sh` SHOULD detect cargo test, go test runners
- **FR-MF003**: `specflow-context.sh` SHOULD show memory document status

#### Orphaned Code (OC001-OC002)
- **FR-OC001**: `specflow-context.sh` MUST remove unused `include_tasks` variable
- **FR-OC002**: `.specify/` scripts structure MUST be documented or clarified

#### Outdated Docs (OD001-OD003)
- **FR-OD001**: README.md CLI Reference MUST match actual implementation
- **FR-OD002**: CLAUDE.md Key Files MUST include gate and lessons commands
- **FR-OD003**: README.md MUST list `/specflow.review` command

## Clarifications

**Clarification Status**: No clarifications needed.

The review findings document (`.specify/reviews/review-20260111.md`) provides complete specification:
- Each finding has a unique ID (e.g., BP001, HD002)
- Each finding specifies exact file(s) affected
- Each finding includes effort, impact, and severity ratings
- Each finding has a clear recommendation for resolution

This is a well-scoped code improvement phase based on systematic review output.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 18 findings marked as addressed in review document
- **SC-002**: `shellcheck` passes on all modified scripts
- **SC-003**: Existing test suite passes without regressions
- **SC-004**: `specflow doctor` runs successfully on POSIX-compliant shell
- **SC-005**: Documentation accurately reflects current CLI commands
