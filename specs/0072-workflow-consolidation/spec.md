# Feature Specification: Workflow Commands Consolidation

**Feature Branch**: `0072-workflow-consolidation`
**Created**: 2026-01-17
**Status**: Draft
**Input**: Phase 0072 PDR - Reduce 11 workflow commands to 6

---

## User Scenarios & Testing

### User Story 1 - Run Complete Design Flow (Priority: P1)

As a developer starting a new phase, I run `/specflow.design` and it produces all design artifacts (discovery, spec, plan, tasks, checklists) in one command, asking me clarifying questions inline as needed.

**Why this priority**: This is the core value proposition - one command instead of five. Reduces cognitive load and eliminates manual step transitions.

**Independent Test**: Run `/specflow.design` on a new phase and verify all artifacts are created: discovery.md, spec.md, plan.md, tasks.md, and checklists/*.md.

**Acceptance Scenarios**:

1. **Given** a phase with no design artifacts, **When** I run `/specflow.design`, **Then** I get prompted with codebase context and clarifying questions, and all artifacts are created in sequence.
2. **Given** a design command in progress, **When** clarification questions arise, **Then** they are asked inline with context and recommendations.
3. **Given** the design command completes, **When** I check the specs folder, **Then** I find discovery.md, spec.md, plan.md, tasks.md, and checklists/ with both implementation.md and verification.md.

---

### User Story 2 - Regenerate Specific Artifacts (Priority: P2)

As a developer who needs to update part of my design, I run `/specflow.design --plan` to regenerate the plan and all downstream artifacts (tasks, checklists), keeping my spec unchanged.

**Why this priority**: Enables iterative refinement without restarting from scratch. Critical for when requirements evolve mid-phase.

**Independent Test**: Modify spec.md manually, run `/specflow.design --plan`, verify plan.md, tasks.md, and checklists are regenerated while spec.md remains unchanged.

**Acceptance Scenarios**:

1. **Given** existing design artifacts, **When** I run `/specflow.design --spec`, **Then** spec, plan, tasks, and checklists are regenerated while discovery.md is preserved.
2. **Given** existing design artifacts, **When** I run `/specflow.design --plan`, **Then** plan, tasks, and checklists are regenerated while discovery.md and spec.md are preserved.
3. **Given** existing design artifacts, **When** I run `/specflow.design --tasks`, **Then** tasks and checklists are regenerated while discovery.md, spec.md, and plan.md are preserved.
4. **Given** existing design artifacts, **When** I run `/specflow.design --checklist`, **Then** only checklists are regenerated.

---

### User Story 3 - Use New Orchestrate Workflow (Priority: P2)

As a developer running `/specflow.orchestrate`, I see the simplified 4-step workflow (design → analyze → implement → verify) instead of the previous 9-step workflow.

**Why this priority**: The orchestrate command is the master controller. Users need to see the consolidated workflow reflected there.

**Independent Test**: Run `/specflow.orchestrate status` and verify the status display shows 4 steps instead of 9.

**Acceptance Scenarios**:

1. **Given** a fresh phase state, **When** I run `/specflow.orchestrate`, **Then** I see the new 4-step workflow (design, analyze, implement, verify).
2. **Given** orchestrate running, **When** design step completes, **Then** state shows step index 1 (analyze) not step index 6.
3. **Given** existing state from old workflow, **When** I run `/specflow.orchestrate`, **Then** state is migrated to new step indices automatically.

---

### User Story 4 - Access Backlog via Roadmap (Priority: P3)

As a developer managing deferred items, I run `/specflow.roadmap backlog` instead of the old `/specflow.backlog` command.

**Why this priority**: Backlog is a roadmap operation, and consolidating it makes the command namespace cleaner.

**Independent Test**: Run `/specflow.roadmap backlog` and verify it provides the same functionality as the deprecated `/specflow.backlog`.

**Acceptance Scenarios**:

1. **Given** deferred items exist, **When** I run `/specflow.roadmap backlog`, **Then** I see backlog items grouped by source phase.
2. **Given** backlog items, **When** I run `/specflow.roadmap backlog --auto`, **Then** items are auto-assigned to appropriate phases.

---

### User Story 5 - See Deprecation Guidance (Priority: P3)

As an existing user running old commands, I see clear deprecation messages guiding me to the new commands.

**Why this priority**: Ensures smooth migration for existing users without breaking their muscle memory.

**Independent Test**: Run `/specflow.specify` and verify the deprecation message with migration guidance appears.

**Acceptance Scenarios**:

1. **Given** a deprecated command, **When** I run `/specflow.specify`, **Then** I see "DEPRECATED - Use /specflow.design instead" with migration table.
2. **Given** a deprecated command, **When** I run `/specflow.backlog`, **Then** I see "DEPRECATED - Use /specflow.roadmap backlog instead".

---

### Edge Cases

- What happens when design is interrupted mid-flow? State should be resumable.
- How does design handle existing artifacts? Uses cascade rules based on flags.
- What if orchestrate state has old step indices (0-8)? Auto-migrate to new indices (0-3).
- What if user runs deprecated command? Show deprecation stub with guidance.

## Requirements

### Functional Requirements

**Design Command**:
- **FR-001**: `/specflow.design` MUST produce all design artifacts in sequence: discovery → spec → plan → tasks → checklists
- **FR-002**: `/specflow.design` MUST ask clarification questions inline with context and recommendations
- **FR-003**: `/specflow.design` MUST generate both implementation AND verification checklists by default
- **FR-004**: `/specflow.design --spec` MUST regenerate spec, plan, tasks, checklists (cascade from spec)
- **FR-005**: `/specflow.design --plan` MUST regenerate plan, tasks, checklists (cascade from plan)
- **FR-006**: `/specflow.design --tasks` MUST regenerate tasks, checklists (cascade from tasks)
- **FR-007**: `/specflow.design --checklist` MUST regenerate only checklists
- **FR-008**: `/specflow.design` MUST be resumable if interrupted mid-flow
- **FR-008a**: When resuming, discovery step MUST always re-run (codebase examination and clarifying questions)

**Orchestrate Updates**:
- **FR-009**: `/specflow.orchestrate` MUST use new 4-step workflow: design, analyze, implement, verify
- **FR-010**: Orchestrate step indices MUST be: 0=design, 1=analyze, 2=implement, 3=verify
- **FR-011**: Orchestrate MUST auto-migrate state from old 9-step workflow to new 4-step workflow
- **FR-012**: Orchestrate status display MUST show 4 steps instead of 9

**Roadmap Backlog**:
- **FR-013**: `/specflow.roadmap` MUST add `backlog` subcommand with same functionality as old `/specflow.backlog`
- **FR-014**: `/specflow.roadmap backlog` MUST support `--auto` and `--dry-run` flags

**Deprecation**:
- **FR-015**: Deprecated commands MUST show clear migration guidance
- **FR-016**: Deprecation stubs MUST follow existing pattern (~30 lines each)
- **FR-017**: Commands to deprecate: specify, clarify, plan, tasks, checklist, backlog

**Documentation**:
- **FR-018**: CLAUDE.md MUST be updated with new workflow description
- **FR-019**: `docs/commands-analysis.md` MUST reflect the consolidation

### Key Entities

- **Design Artifacts**: discovery.md, spec.md, plan.md, tasks.md, checklists/
- **Orchestration State**: `.specify/orchestration-state.json` with step tracking
- **Command Files**: Markdown files in `commands/` directory

## Success Criteria

### Measurable Outcomes

- **SC-001**: Command count reduced from 11 to 6 active workflow commands
- **SC-002**: `/specflow.design` produces all 5 artifact types in one invocation
- **SC-003**: Both implementation and verification checklists generated by default
- **SC-004**: Deprecated commands show clear migration guidance
- **SC-005**: Existing projects continue to work (no breaking changes without migration)
- **SC-006**: Orchestrate step indices match new workflow (0-3 not 0-8)
