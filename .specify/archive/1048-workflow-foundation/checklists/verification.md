# Verification Checklist: Workflow Foundation

**Purpose**: Post-implementation verification for phase completion
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

## User Story Verification

### US1 - Start Workflow

- [x] V-001 POST /api/workflow/start creates execution with status "running"
- [x] V-002 Response includes execution id, projectId, skill, startedAt
- [x] V-003 Invalid projectId returns 404 with "Project not found"
- [x] V-004 State file created at `~/.specflow/workflows/{id}.json`

### US2 - Poll Status

- [x] V-005 GET /api/workflow/status returns full WorkflowExecution object
- [x] V-006 Status correctly reflects "running", "waiting_for_input", "completed", "failed"
- [x] V-007 Invalid id returns 404
- [x] V-008 Questions array populated when workflow needs input

### US3 - Answer & Resume

- [x] V-009 POST /api/workflow/answer merges new answers with existing
- [x] V-010 Workflow resumes with status "running"
- [x] V-011 Session ID preserved for resume CLI flag
- [x] V-012 Submitting answers when not waiting returns 400

### US4 - List Executions

- [x] V-013 GET /api/workflow/list returns all executions for projectId
- [x] V-014 Results sorted by updatedAt descending
- [x] V-015 No projectId returns all executions (operations view)
- [x] V-016 Empty project returns empty array

### US5 - Cancel Workflow

- [x] V-017 POST /api/workflow/cancel kills Claude process
- [x] V-018 Status set to "cancelled"
- [x] V-019 Cannot cancel already completed/failed workflow (400)
- [x] V-020 Process PID cleared after cancel

## Non-Functional Requirements

### Error Handling

- [x] V-021 Process crash sets status to "failed" with stderr captured
- [x] V-022 Timeout (default 10 min) triggers process kill and failure status
- [x] V-023 All API errors include helpful message and context

### Performance

- [x] V-024 Status polling responds in <100ms
- [x] V-025 List endpoint handles 100+ executions efficiently
- [x] V-026 State file writes are atomic (prevent corruption)

### Cost Tracking

- [x] V-027 costUsd accumulated from Claude output after each run
- [x] V-028 Cost preserved across resume cycles

## Integration

- [x] V-029 projectId validated against `~/.specflow/registry.json`
- [x] V-030 Skills loaded from `~/.claude/commands/{skill}.md`
- [x] V-031 Claude CLI invocation matches POC pattern exactly

## Notes

- Test with `~/dev/test-app` or create a test project
- Verify timeout by starting long-running workflow and waiting
- Verify cancel by starting workflow and immediately cancelling
