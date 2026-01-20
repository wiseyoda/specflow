# Tasks: Workflow-Session Unification

## Progress Dashboard

> Last updated: 2026-01-19 | Run `specflow status` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Foundational | PENDING | 0/5 |
| User Story 1 | PENDING | 0/8 |
| User Story 2 | PENDING | 0/6 |
| User Story 3 | PENDING | 0/3 |
| Polish | PENDING | 0/3 |

**Overall**: 0/25 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1053-workflow-session-unification/`
**Prerequisites**: plan.md, spec.md, ui-design.md

---

## Phase 1: Foundational (Core Session ID Fix)

**Purpose**: Fix the session detection race condition by removing polling and using CLI JSON output directly

- [x] T001 Remove `findNewSession()` function and related polling code from `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T002 Update `runClaude()` method to not start parallel session detection - rely solely on `result.session_id` from JSON output in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T003 Add `sessionId` field as required (after first response) in `WorkflowExecutionSchema` in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T004 Create `WorkflowIndexSchema` type in `packages/dashboard/src/lib/services/workflow-service.ts` for session listing
- [x] T005 Update `saveExecution()` to write to project-local `.specflow/workflows/{sessionId}/metadata.json` and update index.json in `packages/dashboard/src/lib/services/workflow-service.ts`

**Checkpoint**: Session ID detection now works reliably via JSON output, no more race conditions

---

## Phase 2: User Story 1 - Start Workflow and See Session Immediately (Priority: P1)

**Goal**: Users can start workflows and immediately see session activity without race conditions

**Independent Test**: Start a workflow, verify Session Viewer shows correct session within 2s of first response

### Implementation for User Story 1

- [x] T006 [US1] Create pending workflow storage at `{project}/.specflow/workflows/pending-{executionId}.json` during initial start in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T007 [US1] Migrate pending workflow to session-keyed storage after session ID received in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T008 [US1] Add cleanup for old global workflows in `~/.specflow/workflows/` on first run (skip active workflows per FR-017) in `packages/dashboard/src/lib/services/workflow-service.ts`
- [x] T009 [US1] Update `/api/workflow/start/route.ts` to use project-local storage path
- [x] T010 [US1] Update `/api/workflow/status/route.ts` to read from project-local path
- [x] T011 [US1] Update `/api/workflow/list/route.ts` to read from project-local index.json
- [x] T012 [US1] Create `SessionPendingState` component showing "Waiting for session..." in `packages/dashboard/src/components/projects/session-pending-state.tsx`
- [x] T013 [US1] Update `SessionViewerDrawer` to use explicit sessionId prop and show pending state when null in `packages/dashboard/src/components/projects/session-viewer-drawer.tsx`

**Checkpoint**: Workflow sessions detected reliably, Session Viewer shows correct content or pending state

---

## Phase 3: User Story 2 - View Session History (Priority: P2)

**Goal**: Users can view a list of past sessions and click any to view messages

**Independent Test**: View project detail, see sessions list, click session to view messages

### Implementation for User Story 2

- [x] T014 [P] [US2] Create `/api/session/history/route.ts` endpoint that reads from `.specflow/workflows/index.json`
- [x] T015 [P] [US2] Create `useSessionHistory` hook in `packages/dashboard/src/hooks/use-session-history.ts`
- [x] T016 [US2] Create `SessionHistoryList` component with table of sessions in `packages/dashboard/src/components/projects/session-history-list.tsx`
- [x] T017 [US2] Add click handler to open SessionViewerDrawer with selected session
- [x] T018 [US2] Add active session indicator (green dot) for running sessions in `SessionHistoryList`
- [x] T019 [US2] Integrate `SessionHistoryList` into project detail page in `packages/dashboard/src/app/projects/[id]/page.tsx`

**Checkpoint**: Session history visible in project detail, clicking any session opens Session Viewer

---

## Phase 4: User Story 3 - Resume Any Past Session (Priority: P3)

**Goal**: Users can send follow-up messages to resume any past session

**Independent Test**: Open past session, type follow-up, verify workflow resumes with that session

### Implementation for User Story 3

- [x] T020 [US3] Update `useWorkflowExecution` to support starting workflow with resume sessionId in `packages/dashboard/src/hooks/use-workflow-execution.ts`
- [x] T021 [US3] Add follow-up input handling for historical sessions in `SessionViewerDrawer` in `packages/dashboard/src/components/projects/session-viewer-drawer.tsx`
- [x] T022 [US3] Update `/api/workflow/start/route.ts` to accept optional `resumeSessionId` parameter

**Checkpoint**: Users can resume any past session with a follow-up message

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and improvements

- [x] T023 [P] Add `.specflow/workflows/` to `.gitignore` automatically when creating workflow directory
- [x] T024 [P] Update error handling for missing session files (graceful degradation)
- [x] T025 Manual verification of all USER GATE criteria from phase file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies - start immediately
- **User Story 1 (Phase 2)**: Depends on Foundational completion
- **User Story 2 (Phase 3)**: Depends on User Story 1 (needs storage structure)
- **User Story 3 (Phase 4)**: Depends on User Story 2 (needs history UI)
- **Polish (Phase 5)**: After all user stories complete

### Within Each Phase

- T001-T005 should be done sequentially (all modify same file)
- T006-T008 sequentially (workflow service changes)
- T009-T011 can be done in parallel (different API routes)
- T012-T013 can be done in parallel (different components)
- T014-T015 can be done in parallel (API and hook)
- T016-T019 sequentially (build on each other)

### Parallel Opportunities

Tasks marked [P] can run in parallel with other [P] tasks in the same phase.

---

## Notes

- All changes are in `packages/dashboard/src/`
- No database changes - file-based storage only
- Session JSONL files remain in Claude's location - we link, not copy
- Delete old global workflows - no migration needed per user direction
