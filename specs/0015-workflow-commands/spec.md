# Feature Specification: Workflow Commands

**Feature Branch**: `0015-workflow-commands`
**Created**: 2026-01-10
**Status**: Draft
**Input**: Roadmap phase 0015 - Streamline end-of-phase and continuous backlog workflows

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Complete Phase with Single Command (Priority: P1)

As a developer finishing a phase, I want to run one command that handles all git operations, state cleanup, and ROADMAP updates so I don't have to remember multiple manual steps.

**Why this priority**: This is the most common workflow - every phase ends with this sequence. Manual steps are error-prone and tedious.

**Independent Test**: Run `/specflow.merge` after completing a phase's implementation. Verify: branch is pushed, PR created (or merged if auto-merge enabled), state archived, ROADMAP updated, and backlog summary shown.

**Acceptance Scenarios**:

1. **Given** a completed phase on feature branch, **When** I run `/specflow.merge`, **Then** the branch is pushed, PR is created and merged, feature branch is deleted, and status is shown.
2. **Given** a completed phase, **When** I run `/specflow.merge --pr-only`, **Then** the branch is pushed, PR is created but NOT merged, and I'm given the PR URL to review.
3. **Given** state shows `orchestration.step.current=verify` with all tasks complete, **When** I run `/specflow.merge`, **Then** state is archived and ROADMAP shows phase as complete.
4. **Given** the phase has incomplete tasks, **When** I run `/specflow.merge`, **Then** I receive a warning with list of incomplete tasks and option to continue or abort.
5. **Given** merge completes successfully, **When** I view output, **Then** I see a summary of backlog items for the next phase.

---

### User Story 2 - Triage Backlog into Phases (Priority: P2)

As a developer with accumulated backlog items, I want to run one command that intelligently assigns items to appropriate phases so I can keep the roadmap organized without manual sorting.

**Why this priority**: Backlog accumulates during development. Manual triage is time-consuming and often deferred indefinitely.

**Independent Test**: Run `/specflow.backlog` with existing backlog items. Verify: items are analyzed, matched to phases by theme, and ROADMAP updated with assignments. Unassignable items create new phases.

**Acceptance Scenarios**:

1. **Given** ROADMAP has a Backlog section with items, **When** I run `/specflow.backlog`, **Then** I see each item analyzed with suggested phase assignment.
2. **Given** a backlog item matches an existing phase's scope, **When** triage runs, **Then** the item is added to that phase's scope section.
3. **Given** a backlog item doesn't fit any phase, **When** triage runs, **Then** a new phase is proposed with auto-generated name, goal, and scope.
4. **Given** items are assigned, **When** triage completes, **Then** Backlog section is cleared of assigned items and a summary is shown.

---

### User Story 3 - Quick Add to Backlog (Priority: P3)

As a developer with a quick idea during development, I want to add it to backlog with a simple CLI command so I don't lose the thought but also don't interrupt my flow.

**Why this priority**: Ideas often come during development. Having a quick capture prevents context switching to edit ROADMAP manually.

**Independent Test**: Run `specflow roadmap backlog add "New feature idea"`. Verify: item appears in ROADMAP Backlog section with timestamp.

**Acceptance Scenarios**:

1. **Given** ROADMAP has a Backlog section, **When** I run `specflow roadmap backlog add "My idea"`, **Then** "My idea" is appended to the Backlog section.
2. **Given** ROADMAP has no Backlog section, **When** I run `specflow roadmap backlog add "My idea"`, **Then** a Backlog section is created with the item.
3. **Given** the item contains special characters, **When** I add it, **Then** it is properly escaped and preserved in ROADMAP.

---

### Edge Cases

- What happens when the feature branch has unpushed commits?
  - `/specflow.merge` should detect and push them before PR creation
- What happens when there's a merge conflict with main?
  - Show error with instructions to resolve manually, do not auto-resolve
- What happens when backlog is empty?
  - `/specflow.backlog` shows "No items to triage" and exits cleanly
- What happens when network is unavailable?
  - Git push fails gracefully with retry suggestion

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `/specflow.merge` MUST push current branch to remote before any merge operations
- **FR-002**: `/specflow.merge` MUST verify all tasks are complete before proceeding (with override option)
- **FR-003**: `/specflow.merge` MUST update `orchestration-state.json` via `specflow state archive` command
- **FR-004**: `/specflow.merge` MUST update ROADMAP.md phase status to "Complete"
- **FR-005**: `/specflow.merge` MUST display backlog summary at completion
- **FR-006**: `/specflow.backlog` MUST analyze each backlog item against existing phase scopes
- **FR-007**: `/specflow.backlog` MUST propose new phases for unassignable items
- **FR-008**: `/specflow.backlog` MUST update ROADMAP.md with assignments
- **FR-009**: `specflow roadmap backlog add` MUST append item to ROADMAP Backlog section
- **FR-010**: `specflow roadmap backlog add` MUST create Backlog section if missing
- **FR-011**: All commands MUST follow constitution principles (helpful errors, POSIX-compliant)

### Key Entities

- **Backlog Item**: A free-text description of work to be done, stored in ROADMAP.md Backlog section
- **Phase Assignment**: The mapping of a backlog item to a specific phase number

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developer can complete a phase with single `/specflow.merge` command (no manual git/state steps needed)
- **SC-002**: Backlog triage assigns at least 80% of items to existing phases (when phases cover the domain)
- **SC-003**: New phase proposals include complete Goal, Scope, and User Stories sections
- **SC-004**: `specflow roadmap backlog add` executes in under 2 seconds

## Clarifications

### C1. Merge Behavior (Resolved 2026-01-10)
**Question**: Should `/specflow.merge` automatically merge the PR to main?
**Answer**: Configurable via flag. Auto-merge is the default behavior (push, create PR, merge immediately). Use `--pr-only` flag to create PR without merging, for cases requiring review.

### C2. Branch Cleanup (Resolved 2026-01-10)
**Question**: Should `/specflow.merge` delete the feature branch after successful merge?
**Answer**: Yes, delete the feature branch after successful merge. This keeps the repository tidy.

## Technical Constraints

Per constitution and tech-stack:
- All scripts MUST be POSIX-compliant bash, validated with shellcheck
- All scripts MUST support `--help` and `--json` flags
- State changes MUST go through `specflow state` CLI, not direct file edits
- All errors MUST provide context and actionable guidance
