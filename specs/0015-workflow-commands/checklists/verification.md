# Verification Checklist: Workflow Commands

**Phase**: 0015-workflow-commands
**Created**: 2026-01-10
**Purpose**: Post-implementation verification for /speckit.verify

## Requirements Verification

### FR-001: Push Before Merge
- [x] `/speckit.merge` pushes current branch to remote
- [x] Unpushed commits are detected and pushed
- [x] Push failure is handled with retry instructions

### FR-002: Task Completion Check
- [x] Incomplete tasks trigger warning with list
- [x] User can abort or continue with `--force`
- [x] Complete tasks allow merge to proceed

### FR-003: State Archive
- [x] `speckit state archive` is called after merge
- [x] Phase is moved to history in state file
- [x] Orchestration is reset for next phase

### FR-004: ROADMAP Update
- [x] Phase status changes to "✅ Complete"
- [x] Update is verified with `speckit roadmap status`

### FR-005: Backlog Summary
- [x] Backlog items are displayed after merge
- [x] Empty backlog shows "No items in backlog"

### FR-006-008: Backlog Triage
- [x] `/speckit.backlog` parses backlog items
- [x] Items are matched to phases by keyword
- [x] Unassignable items create new phases
- [x] ROADMAP is updated with assignments

### FR-009-010: CLI Backlog Add
- [x] `speckit roadmap backlog add "item"` works
- [x] Backlog section is created if missing
- [x] Items are appended with timestamp

### FR-011: Constitution Compliance
- [x] All scripts pass shellcheck
- [x] `--help` flag works for new commands
- [x] `--json` output works where applicable
- [x] Error messages include context and next steps

## User Story Verification

### US1 - Complete Phase with Single Command
- [x] Single `/speckit.merge` completes full workflow
- [x] `--pr-only` creates PR without merging
- [x] `--dry-run` shows what would happen
- [x] Feature branch is deleted after merge
- [x] Main branch is checked out

### US2 - Triage Backlog into Phases
- [x] `/speckit.backlog` shows item analysis
- [x] High-confidence matches are auto-assigned
- [x] Low-confidence matches prompt user
- [x] New phases are created for unassignable items

### US3 - Quick Add to Backlog
- [x] `speckit roadmap backlog add` executes in <2 seconds
- [x] `speckit roadmap backlog list` shows items
- [x] `speckit roadmap backlog clear` removes items
- [x] Special characters are properly escaped

## Edge Cases

- [x] Merge handles network failure gracefully
- [x] Merge conflict shows resolution instructions
- [x] Empty backlog triage exits cleanly
- [x] Missing gh CLI shows manual instructions

## Success Criteria Verification

- [x] SC-001: Phase completes with single command
- [x] SC-002: 80%+ items assigned when phases cover domain
- [x] SC-003: New phases include Goal, Scope, User Stories
- [x] SC-004: Backlog add executes in <2 seconds

## Files Created/Modified

- [x] `commands/speckit.merge.md` exists and is valid
- [x] `commands/speckit.backlog.md` exists and is valid
- [x] `scripts/bash/speckit-roadmap.sh` updated with backlog command
- [x] All files pass linting/validation
