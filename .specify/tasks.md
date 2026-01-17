# Tasks: Real-Time File Watching

## Progress Dashboard

> Last updated: 2026-01-17 | Run `speckit tasks sync` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | COMPLETE | 2/2 |
| Foundational | COMPLETE | 4/4 |
| User Story 1 | COMPLETE | 5/5 |
| User Story 2 | COMPLETE | 4/4 |
| User Story 3 | COMPLETE | 2/2 |
| Polish | COMPLETE | 2/2 |

**Overall**: 19/19 (100%) | **Current**: Verification

---

**Input**: `.specify/plan.md`, `.specify/spec.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add dependencies and create base file structure

- [x] T001 Add chokidar dependency to `packages/dashboard/package.json`
- [x] T002 [P] Create SSE event schema in `packages/shared/src/schemas/events.ts`

---

## Phase 2: Foundational (Server-Side Watcher)

**Purpose**: Core watcher infrastructure that all user stories depend on

**CRITICAL**: User story implementation cannot begin until watcher and SSE endpoint are working

- [x] T003 Create file watcher singleton in `packages/dashboard/src/lib/watcher.ts`
  - Watch registry.json
  - Watch all project state files
  - 200ms debounce
  - Zod validation before emit
- [x] T004 Create SSE endpoint in `packages/dashboard/src/app/api/events/route.ts`
  - Streaming response
  - Heartbeat every 30s
  - Connection tracking
- [x] T005 [P] Add event types to shared package (`registry`, `state`, `connected`, `heartbeat`)
- [x] T006 Test SSE endpoint with curl: `curl -N http://localhost:4200/api/events`

**Checkpoint**: SSE endpoint working, emitting events on file changes

---

## Phase 3: User Story 1 - Instant State Updates (Priority: P1)

**Goal**: State changes in terminal reflected in dashboard within 2 seconds

**Independent Test**: Run `speckit state set orchestration.phase.status=complete`, see UI update

- [x] T007 [US1] Create `useSSE` hook in `packages/dashboard/src/hooks/use-sse.ts`
  - EventSource connection management
  - Auto-reconnect handling
  - State updates on events
- [x] T008 [US1] Update `project-list.tsx` to use `useSSE` instead of `usePolling`
- [x] T009 [US1] Update watcher to track state files for all registered projects
- [x] T010 [US1] Handle dynamic project list (add/remove watched paths when registry changes)
- [x] T011 [US1] Manual test: run `speckit state set` and verify UI updates within 2s

**Checkpoint**: Dashboard updates instantly when state files change

---

## Phase 4: User Story 2 - Connection Status Visibility (Priority: P2)

**Goal**: Users see connection status and get notified of changes

**Independent Test**: Stop dashboard server, see status change to disconnected with toast

- [x] T012 [P] [US2] Add sonner (toast library) dependency
- [x] T013 [US2] Create `ConnectionStatus` component in `packages/dashboard/src/components/connection-status.tsx`
  - Green dot = connected
  - Yellow dot = connecting/reconnecting
  - Red dot = disconnected
- [x] T014 [US2] Add toast notifications on connect/disconnect using sonner
- [x] T015 [US2] Integrate status indicator into dashboard header

**Checkpoint**: Status dot visible in header, toasts on status changes

---

## Phase 5: User Story 3 - New Project Auto-Discovery (Priority: P3)

**Goal**: New projects appear in dashboard automatically

**Independent Test**: Run `speckit init` in new project, see it appear in dashboard

- [x] T016 [US3] Ensure registry watcher emits full project list on change
- [x] T017 [US3] Manual test: register new project and verify it appears without refresh

**Checkpoint**: Projects list updates automatically when registry changes

---

## Phase 6: Polish

**Purpose**: Cleanup and edge case handling

- [x] T018 Remove or deprecate `usePolling` hook (keep for fallback or delete)
- [x] T019 Handle edge cases: malformed files, deleted projects, watcher errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational (can parallel with US1)
- **User Story 3 (Phase 5)**: Depends on Foundational (can parallel with US1, US2)
- **Polish (Phase 6)**: Depends on all user stories

### Parallel Opportunities

- T002 can run in parallel with T001 (different files)
- T005 can run in parallel with T003, T004 (different packages)
- US2 status component (T012-T015) can be built in parallel with US1 hook work
- US3 is mostly verification, minimal code changes

---

## Notes

- SSE uses Next.js streaming response (no custom server needed)
- EventSource has built-in reconnection (2-3 second default)
- Watcher is singleton per Next.js process
- On reconnection, client refetches full state (doesn't rely on missed events)
