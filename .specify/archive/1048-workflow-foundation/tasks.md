# Tasks: Workflow Foundation

## Progress Dashboard

> Last updated: 2026-01-18 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | PENDING | 0/2 |
| Foundational | PENDING | 0/4 |
| US1 - Start Workflow | PENDING | 0/3 |
| US2 - Poll Status | PENDING | 0/2 |
| US3 - Answer & Resume | PENDING | 0/3 |
| US4 - List Executions | PENDING | 0/2 |
| US5 - Cancel Workflow | PENDING | 0/2 |
| Polish | PENDING | 0/2 |

**Overall**: 0/20 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1048-workflow-foundation/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup

**Purpose**: Create directory structure for new service

- [x] T001 [P] Create `packages/dashboard/src/lib/services/` directory
- [x] T002 [P] Create `packages/dashboard/src/app/api/workflow/` directory structure with start/, status/, list/, answer/, cancel/ subdirectories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service infrastructure that all API routes depend on

- [x] T003 Create WorkflowExecution, WorkflowOutput, WorkflowQuestion interfaces with Zod schemas in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T004 Implement state persistence functions (getStateDir with directory creation, saveExecution, loadExecution, listExecutions) in `packages/dashboard/src/lib/services/workflow-service.ts` (FR-001, FR-003)
- [x] T005 Implement skill loading and prompt building functions (loadSkillContent, buildInitialPrompt, buildResumePrompt) in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T006 Implement runClaude internal method with timeout handling and process management in `packages/dashboard/src/lib/services/workflow-service.ts` (FR-005, FR-006, FR-008)

**Checkpoint**: Core service ready - API routes can now be implemented

---

## Phase 3: User Story 1 - Start Workflow (Priority: P1)

**Goal**: Enable starting workflows for registered projects via API

**Independent Test**: POST to /api/workflow/start with valid projectId, verify execution created

- [x] T007 Implement workflowService.start(projectId, skill, timeoutMs?) method in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T008 Add project registry validation (verify projectId exists) in start method
- [x] T009 Create POST /api/workflow/start route handler in `packages/dashboard/src/app/api/workflow/start/route.ts`

**Checkpoint**: Can start workflows via API

---

## Phase 4: User Story 2 - Poll Status (Priority: P2)

**Goal**: Enable polling workflow execution status

**Independent Test**: Start workflow, poll GET /api/workflow/status, verify status returned

- [x] T010 Implement workflowService.get(id) method in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T011 Create GET /api/workflow/status route handler in `packages/dashboard/src/app/api/workflow/status/route.ts`

**Checkpoint**: Can poll status via API

---

## Phase 5: User Story 3 - Answer & Resume (Priority: P3)

**Goal**: Enable submitting answers and resuming paused workflows

**Independent Test**: Start workflow that asks questions, submit answers, verify resume

- [x] T012 Implement workflowService.resume(id, answers) method in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T013 Add answer merging logic to preserve previous answers across resume cycles
- [x] T014 Create POST /api/workflow/answer route handler in `packages/dashboard/src/app/api/workflow/answer/route.ts`

**Checkpoint**: Can answer questions and resume workflows

---

## Phase 6: User Story 4 - List Executions (Priority: P4)

**Goal**: Enable listing all executions for a project

**Independent Test**: Run multiple workflows, call list endpoint, verify all returned

- [x] T015 Implement workflowService.list(projectId?) method with optional filtering in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T016 Create GET /api/workflow/list route handler in `packages/dashboard/src/app/api/workflow/list/route.ts`

**Checkpoint**: Can list executions via API

---

## Phase 7: User Story 5 - Cancel Workflow (Priority: P5)

**Goal**: Enable cancelling running workflows with process cleanup

**Independent Test**: Start workflow, call cancel, verify process killed and status updated

- [x] T017 Implement workflowService.cancel(id) method with process kill (SIGTERM) in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T018 Create POST /api/workflow/cancel route handler in `packages/dashboard/src/app/api/workflow/cancel/route.ts`

**Checkpoint**: Can cancel workflows via API

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T019 Add comprehensive error handling and logging throughout workflow-service.ts
- [x] T020 Verify all API routes return proper error responses (400, 404) with helpful messages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phases 3-7 (User Stories)**: All depend on Phase 2 completion
- **Phase 8 (Polish)**: Depends on all user stories

### Within Phases

- T003-T006 must complete before any API routes
- T007-T008 (service methods) before T009 (route handler)
- Same pattern for all user story phases

### Parallel Opportunities

- T001 and T002 can run in parallel
- T003-T006 are sequential (building on each other)
- User story phases can run in parallel after foundational complete
