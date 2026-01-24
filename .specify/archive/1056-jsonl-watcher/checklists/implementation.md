# Implementation Checklist: JSONL File Watcher

**Phase**: 1056-jsonl-watcher
**Created**: 2026-01-22

## Requirement Completeness

- [x] I-001: All deprecated polling files identified for deletion (5 files)
- [x] I-002: Session JSONL file path pattern defined (~/.claude/projects/{hash}/*.jsonl)
- [x] I-003: New SSE event types fully specified (session:message, session:question, session:end)
- [ ] I-004: Orchestration event types specified (orchestration:decision, orchestration:batch)
- [x] I-005: Debounce values defined (200ms project, 100ms session)

## Requirement Clarity

- [x] I-006: Session message parsing format documented (JSONL line structure)
- [x] I-007: Question detection criteria clear (AskUserQuestion tool call in message)
- [x] I-008: Session end detection criteria clear (end marker in JSONL)
- [x] I-009: Task count parsing format documented (- [ ] T### pattern)
- [x] I-010: Artifact existence paths documented (spec.md, plan.md, tasks.md in specs/{phase}/)

## Scenario Coverage

- [x] I-011: Normal session message flow covered
- [x] I-012: Question detection and notification flow covered
- [x] I-013: Session end detection flow covered
- [x] I-014: Orchestration decision flow covered (file change -> decision)
- [x] I-015: Error handling for malformed JSONL covered

## Edge Case Coverage

- [x] I-016: Malformed JSONL line handling (skip, log warning)
- [x] I-017: Missing session directory handling (create on first access)
- [x] I-018: File watcher limit handling (glob patterns)
- [x] I-019: SSE connection drop handling (auto-reconnect existing)
- [x] I-020: Empty tasks.md handling (return 0/0 counts)
