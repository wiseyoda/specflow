# Implementation Checklist: Workflow-Session Unification

**Purpose**: Verify implementation quality during development
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## Core Session ID Fix

- [ ] I-001 `findNewSession()` function is completely removed from workflow-service.ts
- [ ] I-002 No polling of `sessions-index.json` anywhere in codebase
- [ ] I-003 Session ID is obtained exclusively from CLI JSON output `result.session_id`
- [ ] I-004 `WorkflowExecutionSchema` includes required `sessionId` field

## Storage Architecture

- [ ] I-005 Workflow metadata stored at `{project}/.specflow/workflows/{sessionId}/metadata.json`
- [ ] I-006 Index file exists at `.specflow/workflows/index.json`
- [ ] I-007 Index file contains all required fields: sessionId, skill, status, startedAt, costUsd
- [ ] I-008 No duplication of Claude JSONL files - linking only
- [ ] I-009 `.specflow/workflows/` added to `.gitignore` automatically
- [ ] I-010 Old global workflows in `~/.specflow/workflows/` are cleaned up

## API Implementation

- [ ] I-011 `/api/workflow/start` creates pending workflow correctly
- [ ] I-012 `/api/workflow/start` migrates to session-keyed storage after session ID received
- [ ] I-013 `/api/workflow/status` reads from project-local path
- [ ] I-014 `/api/workflow/list` reads from project-local index.json
- [ ] I-015 `/api/session/history` returns sessions sorted by startedAt descending

## UI Components

- [ ] I-016 `SessionPendingState` component shows loading state correctly
- [ ] I-017 `SessionViewerDrawer` accepts explicit sessionId prop
- [ ] I-018 `SessionViewerDrawer` shows pending state when sessionId is null
- [ ] I-019 `SessionHistoryList` displays sessions in table format
- [ ] I-020 Active sessions have green indicator in history list
- [ ] I-021 Clicking session row opens Session Viewer with that session

## Resume Capability

- [ ] I-022 `useWorkflowExecution` supports starting with `resumeSessionId`
- [ ] I-023 `/api/workflow/start` accepts `resumeSessionId` parameter
- [ ] I-024 Follow-up input on historical sessions creates new workflow with resume flag

## Error Handling

- [ ] I-025 Missing session files handled gracefully (show error, don't crash)
- [ ] I-026 CLI failures before session ID captured marked as failed workflow
- [ ] I-027 Orphaned pending workflows cleaned up appropriately

## Notes

- Check items off as completed: `[x]`
- Implementation items verify code is written correctly
- Run `specflow check --gate implement` to verify completion
