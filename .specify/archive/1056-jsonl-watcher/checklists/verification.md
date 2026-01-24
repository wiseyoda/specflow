# Verification Checklist: JSONL File Watcher

**Phase**: 1056-jsonl-watcher
**Created**: 2026-01-22

## Acceptance Criteria Quality

- [x] V-001: SC-001 measurable - Session message latency <500ms verified
- [x] V-002: SC-002 measurable - Question detection latency <200ms verified
- [x] V-003: SC-003 measurable - Orchestration decision latency <500ms verified
- [x] V-004: SC-004 measurable - Subprocess calls = 0 verified
- [x] V-005: SC-005 measurable - Polling loops = 0 verified
- [x] V-006: SC-006 verified - Connection recovery on network interruption

## Non-Functional Requirements

- [x] V-007: Session message latency consistently under 500ms (NFR-001)
- [x] V-008: Question detection latency consistently under 200ms (NFR-002)
- [x] V-009: Orchestration decisions occur within 500ms of file change (NFR-003)
- [x] V-010: Zero subprocess calls for status during orchestration (NFR-004)
- [x] V-011: Zero setInterval polling loops for data fetching (NFR-005)
- [x] V-012: File watcher uses glob patterns, within macOS 256 limit (NFR-006)
- [x] V-013: Malformed JSONL lines skipped gracefully (NFR-007)

## Phase Goal Verification

- [x] V-014: Goal 1 - All polling replaced with file-watching
- [x] V-015: Goal 2 - Zero polling loops remain in codebase
- [x] V-016: Goal 3 - Session messages appear within 500ms
- [x] V-017: Goal 4 - Questions appear instantly (<200ms)
- [x] V-018: Goal 5 - Orchestration updates without polling
- [x] V-019: Goal 6 - No specflow status --json subprocess calls

## Functional Verification

- [x] V-020: FR-001 - Deprecated polling hooks deleted (5 files)
- [x] V-021: FR-002 - Session JSONL file watching active
- [x] V-022: FR-003/004 - New SSE event types working
- [x] V-023: FR-005-007 - Session events emitting correctly
- [x] V-024: FR-008 - useSessionContent uses SSE
- [x] V-025: FR-009 - useSSE handles new event types
- [x] V-026: FR-010-013 - Orchestration runner event-driven

## Build & Test Verification

- [x] V-027: pnpm build:dashboard passes
- [x] V-028: pnpm test:dashboard passes
- [x] V-029: No TypeScript errors
- [x] V-030: ESLint passes

## USER GATE Verification

These items require user confirmation before merge:

- [ ] V-031: USER GATE - Session messages appear within 500ms
- [ ] V-032: USER GATE - Questions appear instantly
- [ ] V-033: USER GATE - Orchestration updates without polling
- [ ] V-034: USER GATE - No specflow status --json subprocess calls
- [ ] V-035: USER GATE - No setInterval polling loops remain
- [ ] V-036: USER GATE - Connection recovers on network interruption
