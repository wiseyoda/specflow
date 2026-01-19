# Tasks: Session Viewer

## Progress Dashboard

> Last updated: 2026-01-19 | Run `specflow tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Foundational | PENDING | 0/4 |
| User Story 1 | PENDING | 0/5 |
| User Story 2 | PENDING | 0/3 |
| User Story 3 | PENDING | 0/3 |
| User Story 4 | PENDING | 0/2 |

**Overall**: 0/17 (0%) | **Current**: None

---

**Input**: Design documents from `/specs/1052-session-viewer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Foundational (Utilities & Infrastructure)

**Purpose**: Core utilities that all user stories depend on

- [x] T001 [P] Create project path hash calculator in `packages/dashboard/src/lib/project-hash.ts`
- [x] T002 [P] Create JSONL session parser in `packages/dashboard/src/lib/session-parser.ts`
- [x] T003 Create session content API route in `packages/dashboard/src/app/api/session/content/route.ts` (depends on T001, T002)
- [x] T004 Create session messages polling hook in `packages/dashboard/src/hooks/use-session-messages.ts` (depends on T003)

**Checkpoint**: Utilities and API ready - component implementation can begin

---

## Phase 2: User Story 1 - View Active Session Messages (Priority: P1)

**Goal**: Users can open session viewer and see real-time messages from active workflow

**Independent Test**: Start workflow, click Session button, verify messages appear and update

### Implementation

- [x] T005 [US1] Create SessionViewerDrawer component in `packages/dashboard/src/components/projects/session-viewer-drawer.tsx`
- [x] T006 [US1] Create SessionMessage component for message display in `packages/dashboard/src/components/projects/session-message.tsx`
- [x] T007 [US1] Add Session button to ProjectDetailHeader in `packages/dashboard/src/components/projects/project-detail-header.tsx`
- [x] T008 [US1] Integrate SessionViewerDrawer into project detail page in `packages/dashboard/src/app/projects/[id]/page.tsx`
- [x] T009 [US1] Implement auto-scroll with pause-on-scroll-up in SessionViewerDrawer

**Checkpoint**: Core session viewer functionality complete

---

## Phase 3: User Story 2 - Locate Session Files via Hash (Priority: P2)

**Goal**: System reliably locates Claude session files using path hash algorithm

**Independent Test**: Verify hash calculation matches Claude Code's directory naming

### Implementation

- [x] T010 [US2] Verify hash algorithm matches Claude Code implementation in `packages/dashboard/src/lib/project-hash.ts`
- [x] T011 [US2] Add session file discovery logic to API route with error handling
- [x] T012 [US2] Add SessionErrorState component for file-not-found scenarios

**Checkpoint**: File discovery is reliable and error cases are handled

---

## Phase 4: User Story 3 - Message Display Formatting (Priority: P3)

**Goal**: Messages have clear visual distinction between user and assistant

**Independent Test**: Verify user/assistant messages have distinct styling

### Implementation

- [x] T013 [US3] Style user messages with distinct background and label in SessionMessage component
- [x] T014 [US3] Style assistant messages with timestamp display in SessionMessage component
- [x] T015 [US3] Add SessionEmptyState component for no-session case

**Checkpoint**: All message types and states are properly styled

---

## Phase 5: User Story 4 - Progress Indicators (Priority: P4)

**Goal**: Show elapsed time and files modified metrics

**Independent Test**: Verify progress indicators show correct values

### Implementation

- [x] T016 [US4] Add elapsed time calculation and display to SessionViewerDrawer header
- [x] T017 [US4] Add files modified count parsing from tool call metadata and display (parsed but not displayed as messages)

**Checkpoint**: Progress indicators complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies - start immediately
- **User Story 1 (Phase 2)**: Depends on Foundational (T001-T004)
- **User Story 2 (Phase 3)**: Depends on Foundational
- **User Story 3 (Phase 4)**: Depends on User Story 1 (T005, T006)
- **User Story 4 (Phase 5)**: Depends on User Story 1 (T005)

### Parallel Opportunities

- T001, T002 can run in parallel (no dependencies)
- After Foundational, User Stories 1-4 can progress in parallel where noted
- T005-T006 can run in parallel
- T013-T015 can run in parallel

### Critical Path

T001/T002 → T003 → T004 → T005 → T008 (integration)

---

## Notes

- All new files go in existing dashboard package structure
- Follow existing patterns from QuestionDrawer and OutputDrawer
- Test file discovery with real Claude session data in `~/.claude/projects/`
