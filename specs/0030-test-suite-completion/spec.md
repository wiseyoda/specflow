# Feature Specification: Test Suite Completion

**Feature Branch**: `0030-test-suite-completion`
**Created**: 2026-01-11
**Status**: Clarified

## Clarifications

No clarifications needed - requirements are clear from:
1. Test failures identified by running `./tests/test-runner.sh`
2. POSIX compatibility issues documented in ROADMAP.md
3. Standard CI workflow patterns for bash projects

**Input**: Phase 0030 from ROADMAP.md - Test Suite Completion

## Goal

All CLI scripts have passing tests on macOS and Linux.

## User Scenarios & Testing

### User Story 1 - Run All Tests Successfully (Priority: P1)

A developer runs `./tests/test-runner.sh` and all tests pass without errors.

**Why this priority**: Core value - tests must pass before any other improvements matter.

**Independent Test**: Can be tested by running `./tests/test-runner.sh` and verifying exit code 0 and "All tests passed!" message.

**Acceptance Scenarios**:

1. **Given** a clean checkout on macOS, **When** I run `./tests/test-runner.sh`, **Then** all tests pass with exit code 0
2. **Given** a clean checkout on Linux, **When** I run `./tests/test-runner.sh`, **Then** all tests pass with exit code 0

---

### User Story 2 - Run Individual Test Suites (Priority: P1)

A developer runs a specific test suite to validate changes to a single script.

**Why this priority**: Critical for development workflow - developers need to test specific components.

**Independent Test**: Can be tested by running `./tests/test-runner.sh <suite-name>` and verifying it passes.

**Acceptance Scenarios**:

1. **Given** a change to speckit-state.sh, **When** I run `./tests/test-runner.sh state`, **Then** state tests pass
2. **Given** a change to speckit-checklist.sh, **When** I run `./tests/test-runner.sh checklist`, **Then** checklist tests pass

---

### User Story 3 - CI/CD Pipeline Integration (Priority: P2)

A GitHub Actions workflow runs tests automatically on push and PR.

**Why this priority**: Important for quality assurance but not blocking local development.

**Independent Test**: Can be tested by creating a PR and verifying GitHub Actions runs tests.

**Acceptance Scenarios**:

1. **Given** a push to any branch, **When** GitHub Actions runs, **Then** tests execute on ubuntu-latest
2. **Given** a test failure, **When** CI runs, **Then** the PR is marked as failing with clear error output

---

### User Story 4 - Cross-Platform Compatibility (Priority: P2)

Scripts use POSIX-compliant bash with no platform-specific syntax.

**Why this priority**: Ensures scripts work on both macOS and Linux without modification.

**Independent Test**: Can be tested by running shellcheck on all scripts and verifying no errors.

**Acceptance Scenarios**:

1. **Given** any script in scripts/bash/, **When** shellcheck runs, **Then** no errors are reported
2. **Given** scripts use `head`/`tail` commands, **When** run on macOS vs Linux, **Then** behavior is identical

---

### Edge Cases

- What happens when tests run without jq installed? (Should fail with helpful message)
- How does system handle tests run from non-project directory? (Should detect and error)
- What happens when a test suite doesn't define run_tests function? (Should warn)

## Known Issues (from testing)

### Test Failures Identified

1. **checklist show displays file status** - Test expects "2 / 3" but output shows "2/3" (spacing)
2. **roadmap update to complete** - Uses 3-digit format "002" but code expects 4-digit "0002"
3. **scaffold --status shows state** - Test expects ".specify" in output, but format changed
4. **doctor runs all checks** - Test expects "Summary" keyword, not present in output

### POSIX Compatibility Issues (from ROADMAP)

1. **context.sh**: Uses `declare -A` (bash 4.0+ only, not in default macOS bash)
2. **feature.sh/tasks.sh**: `get_repo_root` path resolution in test isolation
3. **claude-md.sh**: macOS `head -n -1` syntax not supported

## Requirements

### Functional Requirements

- **FR-001**: All test files MUST pass when run via `./tests/test-runner.sh`
- **FR-002**: Each test suite MUST be runnable independently via `./tests/test-runner.sh <name>`
- **FR-003**: Tests MUST run successfully on macOS (darwin) platform
- **FR-004**: Tests MUST run successfully on Linux (ubuntu) platform
- **FR-005**: All scripts MUST pass shellcheck validation
- **FR-006**: Scripts MUST avoid bash 4.0+ specific features (declare -A) or provide fallbacks
- **FR-007**: Scripts MUST handle macOS vs Linux command syntax differences (head -n -1)
- **FR-008**: CI workflow MUST run tests on push and pull request
- **FR-009**: CI workflow MUST test on at least ubuntu-latest
- **FR-010**: Test runner MUST display clear pass/fail summary

### Non-Functional Requirements

- **NFR-001**: Test suite MUST complete in under 120 seconds
- **NFR-002**: Each individual test suite MUST complete in under 30 seconds
- **NFR-003**: Test output MUST follow Three-Line Output Rule (critical info first)

## Success Criteria

### Measurable Outcomes

- **SC-001**: `./tests/test-runner.sh` exits with code 0 on macOS
- **SC-002**: `./tests/test-runner.sh` exits with code 0 on Linux (via CI)
- **SC-003**: All 17 test suites pass (checklist, claude-md, context, detect, detection, doctor, feature, git, memory, migrate, reconcile, roadmap, scaffold, state, tasks, templates)
- **SC-004**: CI workflow runs successfully on ubuntu-latest
- **SC-005**: shellcheck passes on all scripts in scripts/bash/

## Scope

### In Scope

- Fix 4 identified failing tests
- Fix POSIX compatibility issues
- Create GitHub Actions CI workflow
- Run shellcheck on all scripts

### Out of Scope

- Additional test coverage beyond fixing existing failures
- Performance optimization of tests
- Windows compatibility
