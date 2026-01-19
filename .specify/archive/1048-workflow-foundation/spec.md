# Feature Specification: Workflow Foundation

**Feature Branch**: `1048-workflow-foundation`
**Created**: 2026-01-18
**Status**: Draft
**PDR Reference**: `.specify/memory/pdrs/workflow-dashboard-orchestration.md`

---

## User Scenarios & Testing

### User Story 1 - Start Workflow for Project (Priority: P1)

A dashboard user wants to start a SpecFlow skill (e.g., `/flow.design`) for a registered project via API.

**Why this priority**: Core functionality - without this, nothing else works. This is the fundamental capability that enables autonomous workflow execution.

**Independent Test**: Call `POST /api/workflow/start` with a valid projectId and skill, verify execution state is created and Claude process spawns.

**Acceptance Scenarios**:

1. **Given** a registered project exists in the registry, **When** user calls `POST /api/workflow/start` with `{ projectId, skill: "flow.design" }`, **Then** a new WorkflowExecution is created with status "running" and the execution ID is returned.

2. **Given** an invalid projectId is provided, **When** user calls start endpoint, **Then** a 404 error is returned with message "Project not found".

3. **Given** a workflow is started, **When** the Claude process completes successfully, **Then** the execution status is updated to "completed" with structured output.

---

### User Story 2 - Poll Workflow Status (Priority: P2)

A dashboard user wants to check the current status of a running workflow to display progress.

**Why this priority**: Essential for UX - users need feedback on workflow progress. Enables the polling pattern that drives the dashboard.

**Independent Test**: Start a workflow, call `GET /api/workflow/status?id=<id>`, verify status object returned with current state.

**Acceptance Scenarios**:

1. **Given** a workflow execution exists, **When** user calls `GET /api/workflow/status?id=<id>`, **Then** the full WorkflowExecution object is returned including status, output, and cost.

2. **Given** an invalid execution ID, **When** user calls status endpoint, **Then** a 404 error is returned.

3. **Given** a workflow is waiting for input, **When** user polls status, **Then** response includes `status: "waiting_for_input"` and `output.questions` array.

---

### User Story 3 - Answer Questions and Resume (Priority: P3)

When a workflow needs user input, the user provides answers and the workflow continues.

**Why this priority**: Critical for interactive workflows - many skills ask clarifying questions. Without this, workflows would stall.

**Independent Test**: Start a workflow that asks questions, submit answers via `POST /api/workflow/answer`, verify workflow resumes with new session.

**Acceptance Scenarios**:

1. **Given** a workflow is in "waiting_for_input" status, **When** user calls `POST /api/workflow/answer` with `{ id, answers: { key: value } }`, **Then** the workflow resumes with status "running".

2. **Given** answers are submitted, **When** workflow continues, **Then** the new answers are merged with existing answers in the execution record.

3. **Given** a workflow is not waiting for input, **When** user tries to submit answers, **Then** a 400 error is returned with "Workflow not waiting for input".

---

### User Story 4 - List Project Executions (Priority: P4)

A dashboard user wants to see all workflow executions for a specific project.

**Why this priority**: Important for history/context but not blocking for core workflow. Enables project detail views.

**Independent Test**: Run multiple workflows for a project, call `GET /api/workflow/list?projectId=<id>`, verify all executions returned.

**Acceptance Scenarios**:

1. **Given** multiple executions exist for a project, **When** user calls `GET /api/workflow/list?projectId=<id>`, **Then** all executions for that project are returned sorted by most recent first.

2. **Given** a project has no executions, **When** user calls list endpoint, **Then** an empty array is returned.

3. **Given** no projectId filter provided, **When** user calls list endpoint, **Then** all executions across all projects are returned (for operations view).

---

### User Story 5 - Cancel Running Workflow (Priority: P5)

A user wants to stop a running workflow that is taking too long or no longer needed.

**Why this priority**: Important safety valve but less frequently used. Prevents stuck workflows from blocking resources.

**Independent Test**: Start a long-running workflow, call `POST /api/workflow/cancel?id=<id>`, verify process is killed and status updated.

**Acceptance Scenarios**:

1. **Given** a workflow is running, **When** user calls `POST /api/workflow/cancel?id=<id>`, **Then** the Claude process is terminated and status is set to "cancelled".

2. **Given** a workflow is already completed or failed, **When** user tries to cancel, **Then** a 400 error is returned with "Cannot cancel workflow in {status} state".

3. **Given** a workflow is cancelled, **When** the execution is later queried, **Then** it shows `status: "cancelled"` with the cancellation timestamp.

---

### Edge Cases

- What happens when Claude process exits unexpectedly? → Mark execution as "failed" with stderr captured
- What happens when timeout is exceeded? → Kill process, mark as "failed" with timeout error
- What happens when disk is full? → Graceful error on state save, preserve in-memory state
- What happens when project is unregistered during execution? → Execution continues, list will exclude it

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST create `~/.specflow/workflows/` directory on first use
- **FR-002**: System MUST generate UUID for each workflow execution
- **FR-003**: System MUST persist WorkflowExecution state to `{id}.json` files
- **FR-004**: System MUST link executions to project via `projectId` field
- **FR-005**: System MUST spawn Claude CLI with exact invocation pattern from POC
- **FR-006**: System MUST capture session ID from Claude output for resume capability
- **FR-007**: System MUST accumulate API costs across resumed sessions
- **FR-008**: System MUST support configurable timeout (default 10 minutes)
- **FR-009**: System MUST clean up child processes on cancel
- **FR-010**: System MUST validate projectId against registry before starting

### Key Entities

- **WorkflowExecution**: Represents a single workflow run with id, projectId, sessionId, skill, status, output, answers, logs, cost, timestamps
- **WorkflowOutput**: Structured output from Claude including status, questions, artifacts
- **WorkflowQuestion**: Question requiring user input with header, options, multiSelect

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Workflow can be started via API and status polled until completion
- **SC-002**: Questions are captured in structured output when workflow needs input
- **SC-003**: Answers can be submitted and workflow resumes correctly
- **SC-004**: All executions for a project can be listed by projectId
- **SC-005**: Running workflow can be cancelled with process cleanup
- **SC-006**: Cost is accumulated correctly across multiple resume cycles
- **SC-007**: Timeout triggers after configured duration with appropriate error state
