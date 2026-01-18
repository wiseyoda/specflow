# Feature Specification: CLI TypeScript Migration

**Feature Branch**: `0080-cli-typescript-migration`
**Created**: 2025-01-18
**Status**: In Progress
**Input**: Migrate 24 bash scripts (~18k lines) to 5 smart TypeScript commands

## Summary

Migrate SpecFlow CLI from 24 disparate bash scripts to 5 smart TypeScript commands that return rich, contextual data. This reduces CLI calls per phase from 50-100 to 10-15 while improving maintainability, type safety, and testability.

---

## User Scenarios & Testing

### User Story 1 - Get Complete Status (Priority: P1)

Claude needs to understand the current project state to decide what to do next. Currently this requires 6-8 separate CLI calls.

**Why this priority**: This is the most frequent operation - every orchestrate session starts with orientation.

**Independent Test**: Run `specflow status --json` and verify it returns phase, step, progress, health, and next action in a single call.

**Acceptance Scenarios**:

1. **Given** a project with active phase 0080, **When** `specflow status --json` is run, **Then** returns complete state including phase details, step status, task progress, health status, and suggested next action
2. **Given** a project with no active phase, **When** `specflow status --json` is run, **Then** returns `next_action: "start_phase"` with available phases
3. **Given** a project with health issues, **When** `specflow status --json` is run, **Then** returns `health.status: "warning"` or `"error"` with issues array

---

### User Story 2 - Get Next Actionable Item (Priority: P1)

Claude needs to know exactly what to work on next, with full context to do it.

**Why this priority**: Core workflow driver - this replaces 3-4 calls with one rich response.

**Independent Test**: Run `specflow next --json` and verify it returns the next task/item with all context needed to execute it.

**Acceptance Scenarios**:

1. **Given** a project in implement step with tasks remaining, **When** `specflow next --json` is run, **Then** returns next unblocked task with dependencies, file hints, and queue info
2. **Given** a project in verify step, **When** `specflow next --type verify --json` is run, **Then** returns next verification checklist item
3. **Given** all tasks complete, **When** `specflow next --json` is run, **Then** returns `action: "none"` with suggestion to proceed to verify

---

### User Story 3 - Mark Item Complete (Priority: P1)

After completing a task, Claude needs to mark it done and immediately know what's next without a follow-up call.

**Why this priority**: Eliminates the "mark + status" pattern that currently requires 2 calls.

**Independent Test**: Run `specflow mark T001` and verify it marks the task and returns updated progress plus next item.

**Acceptance Scenarios**:

1. **Given** task T006 is incomplete, **When** `specflow mark T006` is run, **Then** marks T006 complete and returns new progress + next task
2. **Given** last task in section, **When** `specflow mark TXXX` is run, **Then** indicates section complete and shows next section
3. **Given** last task overall, **When** marking it complete, **Then** returns `step_complete: true` with `next_action: "run_verify"`

---

### User Story 4 - Deep Validation (Priority: P2)

Before proceeding to next workflow step, validate all gates are passed with actionable fixes.

**Why this priority**: Required for gate checks but less frequent than status/next/mark cycle.

**Independent Test**: Run `specflow check --json` and verify it returns comprehensive validation with auto-fixable issues identified.

**Acceptance Scenarios**:

1. **Given** a project with state drift, **When** `specflow check` is run, **Then** identifies drift with auto-fixable flag and suggested command
2. **Given** `specflow check --fix`, **When** auto-fixable issues exist, **Then** fixes them and returns remaining manual issues
3. **Given** all gates pass, **When** `specflow check --gate verify` is run, **Then** returns `passed: true`

---

### User Story 5 - Low-Level State Access (Priority: P3)

For edge cases not covered by smart commands, provide escape hatch to raw state.

**Why this priority**: Escape hatch - rarely needed but essential for edge cases.

**Independent Test**: Run `specflow state get orchestration.step.current` and verify it returns the value.

**Acceptance Scenarios**:

1. **Given** a state file exists, **When** `specflow state get orchestration.step`, **Then** returns the step object
2. **Given** `specflow state set orchestration.step.status=blocked`, **Then** updates the value in state file
3. **Given** `specflow state init`, **Then** creates new state file with valid schema

---

### Edge Cases

- **EC-001**: Circular dependencies in tasks.md - System MUST detect and report circular dependencies, blocking affected tasks with clear error message
- **EC-002**: Corrupted state file - System MUST validate JSON on read; if invalid, report error with suggestion to run `specflow state init --force`
- **EC-003**: Missing/malformed ROADMAP.md - System MUST gracefully degrade, returning partial status with warning indicating missing roadmap
- **EC-004**: Concurrent writes - System MUST use atomic write (write to temp, rename) to prevent corruption; no locking required for single-user CLI

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide `specflow status` command returning complete project state in single call
- **FR-002**: System MUST provide `specflow next` command returning next actionable item with full context
- **FR-003**: System MUST provide `specflow mark` command that marks items and returns updated state
- **FR-004**: System MUST provide `specflow check` command for deep validation with auto-fix support
- **FR-005**: System MUST provide `specflow state` command for low-level state access
- **FR-006**: All commands MUST support `--json` flag for structured output
- **FR-007**: Commands MUST parse tasks.md, ROADMAP.md, and checklists to aggregate data
- **FR-008**: System MUST compute progress from tasks.md rather than storing in state
- **FR-009**: System MUST validate state against v2.0 schema using Zod
- **FR-010**: System MUST provide hybrid dispatcher (bash router to TypeScript)

### Non-Functional Requirements

- **NFR-001**: CLI cold build time MUST be under 5 seconds
- **NFR-002**: Any command MUST complete in under 500ms for typical project
- **NFR-003**: Test coverage MUST exceed 80%
- **NFR-004**: Code MUST pass TypeScript strict mode checks
- **NFR-005**: Human-readable output MUST follow Three-Line Output Rule per constitution (status/result in line 1, key data in line 2, next step in line 3)
- **NFR-006**: All errors MUST provide context and suggest next steps per constitution Principle V

### Key Entities

- **OrchestrationState**: Project state including phase, step, health (from shared schema)
- **Task**: Parsed task from tasks.md with id, description, status, dependencies
- **Phase**: Parsed phase from ROADMAP.md with number, name, status
- **CheckResult**: Validation result with severity, code, message, fix suggestion

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: CLI calls per orchestrate phase reduced from 50-100 to 10-15
- **SC-002**: Lines of code reduced from ~18,000 (bash) to ~4,000 (TypeScript)
- **SC-003**: Test coverage exceeds 80% for all command code paths
- **SC-004**: All 5 smart commands return structured JSON matching documented schemas
- **SC-005**: Hybrid dispatcher routes correctly between TypeScript and remaining bash commands

---

## References

- `cli-design.md` - Detailed command specifications and output schemas
- `command-mapping.md` - Bash to TypeScript command mapping
- `target-architecture.md` - Package structure and build configuration
- `plan.md` - Implementation phases and status tracking
