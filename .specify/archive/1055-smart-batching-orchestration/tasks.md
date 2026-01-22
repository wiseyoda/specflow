# Tasks: Smart Batching & Orchestration

## Progress Dashboard

> Last updated: 2026-01-21 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Foundation | PENDING | 0/10 |
| Core Services | PENDING | 0/12 |
| API Routes | PENDING | 0/12 |
| UI Components | PENDING | 0/15 |
| Integration | PENDING | 0/8 |
| Polish | PENDING | 0/4 |

**Overall**: 0/61 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1055-smart-batching-orchestration/`
**Prerequisites**: plan.md, spec.md, ui-design.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US#]**: Which user story this task belongs to

---

## Phase 1: Foundation (Schemas + Claude Helper)

**Purpose**: Establish foundational utilities needed by all other components

### Zod Schemas

- [x] T001 [P] Create OrchestrationConfigSchema in packages/shared/src/schemas/orchestration-config.ts
- [x] T002 [P] Create OrchestrationExecutionSchema in packages/shared/src/schemas/orchestration-execution.ts
- [x] T003 [P] Create BatchItemSchema in packages/shared/src/schemas/batch-item.ts
- [x] T004 [P] Create ClaudeHelperOptionsSchema and ClaudeHelperResultSchema in packages/shared/src/schemas/claude-helper.ts
- [x] T005 Export all orchestration schemas from packages/shared/src/schemas/index.ts

### Claude Helper Utility

- [x] T006 [US1] Create claude-helper.ts base structure in packages/dashboard/src/lib/services/claude-helper.ts
- [x] T007 [US1] Implement session management (new, resume, fork) in claude-helper.ts
- [x] T008 [US1] Implement model selection with fallback in claude-helper.ts
- [x] T009 [US1] Implement tool restrictions and budget enforcement in claude-helper.ts
- [x] T010 [US1] Add error handling (timeout, validation, budget exceeded) in claude-helper.ts

**Checkpoint**: Foundation ready - Claude Helper can make typed API calls to Claude CLI

---

## Phase 2: Core Services (State Machine + Batch Detection)

**Purpose**: Implement orchestration logic independent of UI

### Batch Parser

- [x] T011 [P] [US1] Create batch-parser.ts in packages/dashboard/src/lib/services/batch-parser.ts
- [x] T012 [US1] Implement parseBatchesFromTasksMd() to detect ## sections
- [x] T013 [US1] Implement fallback to fixed-size batches when no sections
- [x] T014 [US1] Return BatchPlan with task IDs, section names, counts

### Orchestration Service

- [x] T015 [US1] Create orchestration-service.ts in packages/dashboard/src/lib/services/orchestration-service.ts
- [x] T016 [US1] Implement state machine transitions (design→analyze→implement→verify→merge)
- [x] T017 [US1] Implement dual confirmation pattern (state + process completion)
- [x] T018 [US1] Implement state persistence to {project}/.specflow/workflows/orchestration-{id}.json
- [x] T019 [US1] Implement decision logging with timestamps
- [x] T020 [US1] Integrate with specflow status --json for state checking

### Auto-Healing Service

- [x] T021 [US3] Create auto-healing-service.ts in packages/dashboard/src/lib/services/auto-healing-service.ts
- [x] T022 [US3] Implement captureFailureContext() to gather error details, stderr, failed tasks

**Checkpoint**: Core services can orchestrate batches and handle failures

---

## Phase 3: API Routes

**Purpose**: Expose orchestration functionality via REST API

### Start Orchestration

- [x] T023 [US1] Create POST /api/workflow/orchestrate route in packages/dashboard/src/app/api/workflow/orchestrate/route.ts
- [x] T024 [US1] Validate project exists and no existing orchestration
- [x] T025 [US1] Parse batch plan and create orchestration record
- [x] T026 [US1] Start first step via orchestration service

### Status and List

- [x] T027 [P] [US4] Create GET /api/workflow/orchestrate/status route in packages/dashboard/src/app/api/workflow/orchestrate/status/route.ts
- [x] T028 [P] [US4] Create GET /api/workflow/orchestrate/list route in packages/dashboard/src/app/api/workflow/orchestrate/list/route.ts

### Control Routes

- [x] T029 [P] [US5] Create POST /api/workflow/orchestrate/cancel route in packages/dashboard/src/app/api/workflow/orchestrate/cancel/route.ts
- [x] T030 [P] [US6] Create POST /api/workflow/orchestrate/resume route in packages/dashboard/src/app/api/workflow/orchestrate/resume/route.ts
- [x] T031 [US1] Create POST /api/workflow/orchestrate/merge route in packages/dashboard/src/app/api/workflow/orchestrate/merge/route.ts

### Auto-Healing Integration

- [x] T032 [US3] Implement buildHealerPrompt() with error context, remaining tasks
- [x] T033 [US3] Implement spawnHealer() via Claude Helper with fork session
- [x] T034 [US3] Handle healer success/failure outcomes and update batch status

**Checkpoint**: API routes fully functional, can control orchestration via REST

---

## Phase 4: UI Components

**Purpose**: Build configuration modal and progress display

### Configuration Modal

- [x] T035 [US2] Create StartOrchestrationModal component in packages/dashboard/src/components/orchestration/start-orchestration-modal.tsx
- [x] T036 [US2] Create OrchestrationConfigForm with core options in packages/dashboard/src/components/orchestration/orchestration-config-form.tsx
- [x] T037 [US2] Add advanced options section (collapsible) to OrchestrationConfigForm
- [x] T038 [US2] Add budget limits section to OrchestrationConfigForm
- [x] T039 [US2] Display detected batch count in modal header
- [x] T040 [US2] Add validation and Start Orchestration button

### Progress Components

- [x] T041 [P] [US4] Create PhaseProgressBar component in packages/dashboard/src/components/orchestration/phase-progress-bar.tsx
- [x] T042 [P] [US4] Create BatchProgress component in packages/dashboard/src/components/orchestration/batch-progress.tsx
- [x] T043 [P] [US4] Create DecisionLogPanel component (collapsible) in packages/dashboard/src/components/orchestration/decision-log-panel.tsx
- [x] T044 [US4] Create OrchestrationProgress parent component in packages/dashboard/src/components/orchestration/orchestration-progress.tsx

### Control and State Components

- [x] T045 [P] [US4] Create OrchestrationControls (Pause/Cancel) in packages/dashboard/src/components/orchestration/orchestration-controls.tsx
- [x] T046 [P] [US4] Create MergeReadyPanel in packages/dashboard/src/components/orchestration/merge-ready-panel.tsx
- [x] T047 [P] [US5] Create OrchestrationBadge for project cards in packages/dashboard/src/components/orchestration/orchestration-badge.tsx

### Orchestration Hook

- [x] T048 [US4] Create useOrchestration hook in packages/dashboard/src/hooks/use-orchestration.ts
- [x] T049 [US4] Implement polling for orchestration status in useOrchestration

**Checkpoint**: All UI components built and styled per ui-design.md

---

## Phase 5: Integration

**Purpose**: Wire everything together in the dashboard

### Project Detail Integration

- [x] T050 [US5] Add CompletePhaseButton as primary action in project detail workflow area
- [x] T051 [US5] Implement transform from buttons to OrchestrationProgress when active
- [x] T052 [US5] Wire StartOrchestrationModal open from CompletePhaseButton click

### Project Card Integration

- [x] T053 [US5] Add "Complete Phase" as first highlighted item in project card actions menu
- [x] T054 [US5] Reorganize "Run Workflow" as secondary flyout with Orchestrate, Merge, Review, Memory
- [x] T055 [US5] Add OrchestrationBadge to project cards when orchestration active

### Reconciliation

- [x] T056 [US6] Add orchestration detection to reconciliation on dashboard startup
- [x] T057 [US6] Implement resume or mark-as-failed logic for in-progress orchestrations

**Checkpoint**: Full integration complete, end-to-end flow works

---

## Phase 6: Polish & Testing

**Purpose**: Quality improvements and test coverage

- [x] T058 [P] Create claude-helper.test.ts with mocked Claude CLI in packages/dashboard/__tests__/orchestration/
- [x] T059 [P] Create orchestration-service.test.ts with state machine transitions in packages/dashboard/__tests__/orchestration/
- [x] T060 [P] Create batch-parser.test.ts with various tasks.md formats in packages/dashboard/__tests__/orchestration/
- [x] T061 Verify USER GATE checklist items from spec.md verification gate

**Checkpoint**: All tests passing, ready for USER GATE verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies - schemas and Claude Helper first
- **Phase 2 (Core Services)**: Depends on Phase 1 (uses schemas, Claude Helper)
- **Phase 3 (API Routes)**: Depends on Phase 2 (uses orchestration service)
- **Phase 4 (UI Components)**: Depends on Phase 1 (uses schemas); can parallel with Phase 3
- **Phase 5 (Integration)**: Depends on Phase 3 + Phase 4
- **Phase 6 (Polish)**: Depends on all above

### Within Each Phase

- Tasks marked [P] can run in parallel
- Otherwise, execute in listed order

### Recommended Execution

1. T001-T005 (schemas) in parallel
2. T006-T010 (Claude Helper) sequentially
3. T011-T014 (batch parser) → T015-T020 (orchestration service) → T021-T022 (auto-healing)
4. T023-T034 (API routes) sequentially
5. T035-T049 (UI) - modal first (T035-T040), then progress (T041-T049)
6. T050-T057 (integration) sequentially
7. T058-T061 (polish) in parallel

---

## Notes

- [P] tasks = different files, no dependencies
- All paths relative to repository root
- Commit after each logical group of tasks
- Test each phase before moving to next
- Run `specflow mark T###` to mark tasks complete
