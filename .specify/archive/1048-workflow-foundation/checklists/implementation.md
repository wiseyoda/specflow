# Implementation Checklist: Workflow Foundation

**Purpose**: Guide implementation quality and requirements coverage
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] I-001 WorkflowExecution interface includes all required fields (id, projectId, sessionId, skill, status, output, answers, logs, stdout, stderr, error, costUsd, startedAt, updatedAt, timeoutMs, pid)
- [x] I-002 WorkflowOutput interface matches Claude CLI structured output format
- [x] I-003 WorkflowQuestion interface supports all question types (options, multiSelect, free-form)
- [x] I-004 State directory uses production path `~/.specflow/workflows/`
- [x] I-005 All 5 API routes implemented (start, status, list, answer, cancel)

## Requirement Clarity

- [x] I-006 All Zod schemas provide clear validation error messages
- [x] I-007 API error responses include actionable guidance
- [x] I-008 Status transitions are validated (can't cancel completed, can't answer when not waiting)

## CLI Invocation Pattern

- [x] I-009 Initial execution uses exact CLI flags from POC (`--output-format json`, `--dangerously-skip-permissions`, `--disallowedTools "AskUserQuestion"`, `--json-schema`)
- [x] I-010 Resume execution includes `--resume {sessionId}` flag
- [x] I-011 Prompt files include CLI mode instructions about disabled AskUserQuestion

## State Management

- [x] I-012 Execution state persisted to `{id}.json` files
- [x] I-013 Session ID extracted and stored from Claude output
- [x] I-014 Cost accumulated correctly across resume cycles
- [x] I-015 Answers merged (not replaced) on resume
- [x] I-016 Logs include timestamps for debugging

## Error Handling

- [x] I-017 Process crash/unexpected exit captured in stderr and status set to "failed"
- [x] I-018 Timeout triggers SIGTERM and sets appropriate error message
- [x] I-019 Cancel kills process and sets status to "cancelled"
- [x] I-020 JSON parse errors logged with raw output for debugging
- [x] I-021 Project not found returns 404 before execution starts

## API Validation

- [x] I-022 Start validates projectId exists in registry
- [x] I-023 Status validates id parameter present
- [x] I-024 Answer validates workflow is in waiting_for_input state
- [x] I-025 Cancel validates workflow is in cancellable state (running or waiting)

## Notes

- Reference POC at `packages/dashboard/src/lib/workflow-executor.ts` for working patterns
- Do not delete POC files until production service is fully verified
- All API routes follow Next.js App Router conventions
