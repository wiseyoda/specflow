# Tasks: JSONL File Watcher & Polling Elimination

## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Replace all polling with file-watching | FR-002, FR-013, FR-014, FR-015 | T008-T015, T021-T026 | COVERED |
| 2 | Zero polling loops when complete | FR-001, NFR-005 | T001-T007 | COVERED |
| 3 | Session messages appear within 500ms | FR-002, FR-005, FR-008, NFR-001 | T008-T012, T018-T020 | COVERED |
| 4 | Questions appear instantly (<200ms) | FR-006, NFR-002 | T010, T011 | COVERED |
| 5 | Orchestration updates without polling | FR-010, FR-011, FR-012, FR-013, NFR-003 | T021-T026 | COVERED |
| 6 | No specflow status --json subprocess calls | FR-010, FR-011, FR-012, NFR-004 | T022-T024 | COVERED |

Coverage: 6/6 goals (100%)

---

## Progress Dashboard

> Last updated: 2026-01-22 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | PENDING | 0/0 |
| Phase 0.5: Delete Polling | PENDING | 0/7 |
| US1: Session Watching | PENDING | 0/12 |
| US2: Event-Driven Orchestration | PENDING | 0/6 |
| US3: Clean Polling Removal | PENDING | 0/4 |
| Polish | PENDING | 0/2 |

**Overall**: 0/31 (0%) | **Current**: None

---

## Phase 0.5: Delete Polling Hooks (Clean Slate)

**Purpose**: Remove deprecated polling code before building new infrastructure

- [x] T001 [P] [US3] Delete packages/dashboard/src/hooks/use-workflow-execution.ts
- [x] T002 [P] [US3] Delete packages/dashboard/src/hooks/use-workflow-list.ts
- [x] T003 [P] [US3] Delete packages/dashboard/src/hooks/use-session-history.ts
- [x] T004 [P] [US3] Delete packages/dashboard/src/hooks/use-session-messages.ts
- [x] T005 [P] [US3] Delete packages/dashboard/src/lib/session-polling-manager.ts
- [x] T006 [US3] Fix import errors from deleted files in packages/dashboard/src/
- [x] T007 [US3] Verify build passes with pnpm build:dashboard

**Checkpoint**: All polling code deleted, build passes

---

## Phase 1: Session File Watching (Priority: P1)

**Goal**: Watch session JSONL files and emit SSE events

**Independent Test**: Start session, type message, see it in dashboard within 500ms

### Event Schema Updates

- [x] T008 [P] [US1] Add SessionMessageSchema to packages/shared/src/schemas/events.ts
- [x] T009 [P] [US1] Add session:message, session:question, session:end event types to SSEEventSchema
- [x] T010 [US1] Add QuestionSchema for AskUserQuestion detection in packages/shared/src/schemas/events.ts

### Watcher Extension

- [x] T011 [US1] Add getSessionDirectory() function to packages/dashboard/src/lib/watcher.ts
- [x] T012 [US1] Add watchSessionFiles() to watch ~/.claude/projects/{hash}/*.jsonl in watcher.ts
- [x] T013 [US1] Implement handleSessionFileChange() to parse JSONL and detect new messages in watcher.ts
- [x] T014 [US1] Add parseSessionLines() to extract messages from JSONL content in watcher.ts
- [x] T015 [US1] Add extractQuestions() to detect AskUserQuestion tool calls in watcher.ts

### SSE Endpoint Updates

- [x] T016 [US1] Add session event handlers to packages/dashboard/src/app/api/events/route.ts
- [x] T017 [US1] Broadcast session:message events when session content changes in route.ts

### Client Hook Updates

- [x] T018 [US1] Add session:message case handler to packages/dashboard/src/hooks/use-sse.ts
- [x] T019 [US1] Update useSessionContent to read from SSE context in packages/dashboard/src/hooks/use-session-content.ts
- [x] T020 [US1] Add sessionContent Map to unified-data-context.tsx

**Checkpoint**: Session messages appear in dashboard within 500ms of file write

---

## Phase 2: Event-Driven Orchestration (Priority: P1)

**Goal**: Orchestration runner reacts to file changes, no subprocess

**Independent Test**: Run orchestration, observe zero subprocess calls, decisions within 500ms

### Subprocess Elimination

- [x] T021 [US2] Add getTaskCounts() function to parse tasks.md directly in packages/dashboard/src/lib/services/orchestration-runner.ts
- [x] T022 [US2] Add checkArtifactExistence() to check spec.md/plan.md/tasks.md via fs in orchestration-runner.ts
- [x] T023 [US2] Delete getSpecflowStatus() subprocess function from orchestration-runner.ts
- [x] T024 [US2] Replace specflow status --json calls with getTaskCounts() + checkArtifactExistence()

### Event-Driven Loop

- [x] T025 [US2] Add subscribeToFileEvents() to listen for watcher events in orchestration-runner.ts
- [x] T026 [US2] Replace while(running) { sleep } loop with event-triggered decision cycle in orchestration-runner.ts

**Checkpoint**: Orchestration runs with zero subprocess calls, 500ms decision latency

---

## Phase 3: Clean Polling Removal (Priority: P2)

**Goal**: Verify zero polling loops remain

**Independent Test**: grep for setInterval in src/hooks, find zero data-polling loops

- [x] T027 [US3] Audit all useEffect with setInterval patterns in packages/dashboard/src/hooks/
- [x] T028 [US3] Remove any remaining polling patterns (except UI animation timers)
- [x] T029 [US3] Update components that imported deleted hooks to use SSE alternatives
- [x] T030 [US3] Add eslint rule to prevent setInterval in hooks (optional)

**Checkpoint**: Zero setInterval patterns for data fetching

---

## Phase 4: Polish & Verification

**Purpose**: Final cleanup and verification

- [x] T031 Run pnpm test:dashboard to verify all tests pass
- [x] T032 Manual verification: start session, verify <500ms message latency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0.5 (Delete Polling)**: No dependencies - start immediately
- **Phase 1 (Session Watching)**: Depends on T008-T010 (schemas) before T011-T020
- **Phase 2 (Orchestration)**: Can run parallel to Phase 1 after Phase 0.5
- **Phase 3 (Clean Removal)**: Depends on Phase 1 & 2 completion
- **Phase 4 (Polish)**: Depends on all above

### Task Dependencies

- T006 depends on T001-T005 (fix imports after deletion)
- T007 depends on T006 (verify build after fixes)
- T011-T015 depend on T008-T010 (schemas first)
- T016-T017 depend on T011-T015 (watcher before SSE)
- T018-T020 depend on T016-T017 (SSE before hooks)
- T024 depends on T021-T023 (helpers before replacement)
- T026 depends on T024-T025 (event subscription before loop)

### Parallel Opportunities

- T001-T005: All file deletions can run in parallel
- T008-T010: All schema additions can run in parallel
- T021-T022: Both helper functions can be written in parallel
- Phase 1 & Phase 2 can run in parallel after Phase 0.5

---

## Notes

- [P] tasks = different files, no dependencies
- [US#] = User Story mapping for traceability
- Commit after each phase completion
- 100ms debounce for session files, 200ms for project files
