# Feature Specification: Workflow UI Integration

**Feature Branch**: `1050-workflow-ui`
**Created**: 2026-01-18
**Status**: Draft
**PDR**: [workflow-dashboard-orchestration.md](../../.specify/memory/pdrs/workflow-dashboard-orchestration.md)

---

## User Scenarios & Testing

### User Story 1 - Start Workflow from Project Card (Priority: P1)

A user viewing the project list wants to quickly start a workflow on a specific project without navigating to the detail page.

**Why this priority**: This is the primary use case - quick workflow initiation from the main view. Users spend most time on the project list and need fast access.

**Independent Test**: Can be fully tested by clicking "Start Workflow" on any project card and seeing the skill picker, then starting a workflow.

**Acceptance Scenarios**:

1. **Given** a registered project on the project list, **When** I click the actions dropdown on the project card, **Then** I see a "Start Workflow" option with a sub-menu of available skills
2. **Given** the skill picker is open, **When** I select "/flow.design", **Then** a confirmation dialog appears asking me to confirm the workflow start
3. **Given** the confirmation dialog is open, **When** I click "Start", **Then** the workflow begins and the project card shows a running status badge

---

### User Story 2 - Start Workflow from Project Detail (Priority: P1)

A user viewing a specific project's detail page wants to start a workflow with full context visible.

**Why this priority**: Equal priority to US1 - users often start workflows from detail view when reviewing project status. Per PDR: "Both locations (per user preference)".

**Independent Test**: Can be tested by navigating to any project detail page and starting a workflow from the header.

**Acceptance Scenarios**:

1. **Given** I am on a project's detail page, **When** I look at the header section, **Then** I see a "Start Workflow" button
2. **Given** I click "Start Workflow" in the header, **When** the skill picker appears, **Then** I can select any of the 6 /flow.* skills
3. **Given** I start a workflow, **When** it begins running, **Then** the status section updates to show the running workflow

---

### User Story 3 - Monitor Workflow Status on Card (Priority: P2)

A user wants to see at a glance which projects have running or waiting workflows without clicking into each one.

**Why this priority**: Visibility into workflow state is essential for multi-project management. Slightly lower than starting because you need to start before you can monitor.

**Independent Test**: Can be tested by starting a workflow and observing the status badge on the project card from the list view.

**Acceptance Scenarios**:

1. **Given** a workflow is running on a project, **When** I view the project list, **Then** I see a blue spinner badge on that project's card
2. **Given** a workflow is waiting for input, **When** I view the project list, **Then** I see a yellow "?" badge on the project card
3. **Given** a workflow completed successfully, **When** I view the project list, **Then** I see a green checkmark that fades after 30 seconds
4. **Given** a workflow failed, **When** I view the project list, **Then** I see a red X badge on the project card

---

### User Story 4 - View Workflow Status in Project Detail (Priority: P2)

A user on the project detail page wants to see comprehensive workflow status including skill name, elapsed time, and current state.

**Why this priority**: Provides context beyond the badge - what skill is running, how long, etc. Natural extension of US3.

**Independent Test**: Can be tested by starting a workflow and navigating to the project detail to see the status card.

**Acceptance Scenarios**:

1. **Given** a workflow is running, **When** I view the project detail page, **Then** I see a Workflow Status card showing: skill name, status, elapsed time
2. **Given** no workflow is running, **When** I view the project detail page, **Then** the Workflow Status card shows "No active workflow" with a "Start Workflow" button
3. **Given** a workflow just completed, **When** I view the project detail page, **Then** I see the completion status and result summary (skill name, duration, final status message)

---

### Edge Cases

- What happens when a user tries to start a workflow on a project that already has one running?
  - Show error toast: "A workflow is already running on this project"
- What happens when the workflow API fails to respond?
  - Show error toast with retry option
- What happens when the user navigates away while a workflow is running?
  - Workflow continues; status updates when user returns
- What happens when project status changes during skill selection?
  - Validation happens on submit; reject if no longer applicable

---

## Requirements

### Functional Requirements

**Skill Picker**:
- **FR-001**: System MUST display a skill picker with all 6 workflow skills: /flow.design, /flow.analyze, /flow.implement, /flow.verify, /flow.orchestrate, /flow.merge
- **FR-002**: System MUST show skill descriptions on hover to help users understand each skill's purpose
- **FR-003**: ~~System MUST disable skills that are not applicable to current project state~~ (DEFERRED to future phase - all skills enabled for now)

**Start Workflow Entry Points**:
- **FR-004**: System MUST provide "Start Workflow" in the project card actions dropdown
- **FR-005**: System MUST provide "Start Workflow" button in the project detail header
- **FR-006**: System MUST show a confirmation dialog before starting any workflow
- **FR-007**: Confirmation dialog MUST show the selected skill and project name

**Status Display**:
- **FR-008**: Project cards MUST display a workflow status badge when a workflow is active
- **FR-009**: Status badge MUST show distinct states: running (spinner), waiting (yellow ?), completed (green check), failed (red X)
- **FR-010**: Completed status badge MUST fade out after 30 seconds
- **FR-011**: Project detail MUST show a Workflow Status card with: skill name, status, elapsed time

**Polling & Updates**:
- **FR-012**: System MUST poll workflow status every 3 seconds while a workflow is active
- **FR-013**: System MUST stop polling when workflow reaches terminal state (completed, failed, cancelled)
- **FR-014**: Status updates MUST reflect immediately in both card badge and detail view

**Error Handling**:
- **FR-015**: System MUST prevent starting a new workflow if one is already running on the project
- **FR-016**: System MUST display toast notifications for errors (API failures, validation errors)

### Key Entities

- **WorkflowExecution**: Represents a running or completed workflow (id, projectId, skill, status, output, costUsd, startedAt, updatedAt)
- **WorkflowSkill**: One of the 6 /flow.* skills with name and description

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can start a workflow from project card in under 3 clicks (open dropdown → select skill → confirm)
- **SC-002**: Users can start a workflow from project detail in under 4 clicks (click start → select skill → confirm)
- **SC-003**: Status badge updates within 3 seconds of workflow state change
- **SC-004**: 100% of workflow states (running, waiting, completed, failed) are visually distinguishable
- **SC-005**: Zero workflows are started accidentally (confirmation dialog prevents this)

---

## Non-Goals

- Question drawer UI (Phase 1051)
- Browser notifications (Phase 1051)
- Session viewer/transcript (Phase 1052)
- Cost display on cards (Phase 1060)
- Auto-batching/orchestration state machine (Phase 1055)
- Disabling skills based on project state (future enhancement)
