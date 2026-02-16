# Tasks: Edge Cases Collection

## Progress Dashboard

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | ✅ COMPLETE | 3/3 |
| Core | 🔄 IN PROGRESS | 1/4 |

**Overall**: 4/7 (57%)

---

## Phase 1: Setup

- [x] T001 Basic task with no tags
- [x] T002 [P] Parallel task
- [x] T003 [P] [US1] Multiple tags task

---

## Phase 2: Core

### Subsection with tasks

- [x] T004 [US1] Task in subsection
- [ ] T005 Task with dependency (After T004)
- [ ] T006 Task with multiple deps (Requires T004, T005)
- [ ] T007 [P1] [US2] [FR-001] Many tags task

### Sub-tasks demonstration

- [ ] T008 Main task
- [ ] T008a Sub-task A
- [ ] T008b [P] Sub-task B parallel
- [ ] T008c Sub-task C

---

## Deferred Items

- [~] T009 Deferred task for later
- [~] T010 [US3] Another deferred item

---

## Verification

- [ ] T018 [V] Run test suite — all tests pass
- [ ] T019 [V] [W] Verify wiring to entry points
- [x] T020 [V] Run linter — no errors

---

## Edge Cases in Descriptions

- [ ] T011 Task with `code blocks` and **bold** and *italic*
- [ ] T012 Task mentioning file paths: `src/lib/parser.ts:42`
- [ ] T013 Task with URL: see https://example.com/docs
- [ ] T014 Task with special chars: <angle> & "quotes" 'apostrophe'
- [ ] T015 Task ending with punctuation!
- [ ] T016 Task with (parentheses) in middle
- [ ] T017 Really long task description that spans multiple concepts and includes implementation details about creating a parser function in src/lib/parser.ts that handles various markdown formats

---

## Notes

Tasks can have varied formats. The parser must handle all of these gracefully.
