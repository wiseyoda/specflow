# Requirements Checklist: Workflow Commands

**Phase**: 0015-workflow-commands
**Created**: 2026-01-10
**Source**: spec.md

## Functional Requirements

- [ ] **FR-001**: `/specflow.merge` pushes current branch to remote before merge operations
- [ ] **FR-002**: `/specflow.merge` verifies all tasks complete before proceeding (with override)
- [ ] **FR-003**: `/specflow.merge` updates state via `specflow state archive`
- [ ] **FR-004**: `/specflow.merge` updates ROADMAP.md phase status to "Complete"
- [ ] **FR-005**: `/specflow.merge` displays backlog summary at completion
- [ ] **FR-006**: `/specflow.backlog` analyzes backlog items against phase scopes
- [ ] **FR-007**: `/specflow.backlog` proposes new phases for unassignable items
- [ ] **FR-008**: `/specflow.backlog` updates ROADMAP.md with assignments
- [ ] **FR-009**: `specflow roadmap backlog add` appends item to Backlog section
- [ ] **FR-010**: `specflow roadmap backlog add` creates Backlog section if missing
- [ ] **FR-011**: All commands follow constitution principles

## Success Criteria

- [ ] **SC-001**: Single `/specflow.merge` completes phase (no manual steps)
- [ ] **SC-002**: Backlog triage assigns 80%+ items to existing phases
- [ ] **SC-003**: New phase proposals include Goal, Scope, User Stories
- [ ] **SC-004**: `specflow roadmap backlog add` executes in under 2 seconds

## User Story Acceptance

### US1 - Complete Phase with Single Command
- [ ] Branch pushed to remote
- [ ] PR created (or merged if auto-merge)
- [ ] State archived
- [ ] ROADMAP updated
- [ ] Backlog summary shown
- [ ] Incomplete tasks warning works
- [ ] Override option for incomplete tasks

### US2 - Triage Backlog into Phases
- [ ] Each item analyzed with suggested assignment
- [ ] Matching items added to phase scope
- [ ] Non-matching items create new phases
- [ ] Backlog section cleared of assigned items
- [ ] Summary shown at completion

### US3 - Quick Add to Backlog
- [ ] Item appended to existing Backlog section
- [ ] Backlog section created if missing
- [ ] Special characters properly escaped
