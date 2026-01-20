# Discovery: Workflow-Session Unification

**Phase**: `1053-workflow-session-unification`
**Created**: 2026-01-19
**Status**: Complete

## Phase Context

**Source**: ROADMAP phase, PDR: workflow-dashboard-orchestration.md
**Goal**: Unify workflows and Claude sessions as the same concept, fixing session detection on workflow start.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/dashboard/src/lib/services/workflow-service.ts` | Core workflow execution service | Primary target - stores workflows at `~/.specflow/workflows/{execution_id}.json` |
| `packages/dashboard/src/lib/session-parser.ts` | Parses Claude JSONL session files | Extracts messages from `~/.claude/projects/{hash}/{session_id}.jsonl` |
| `packages/dashboard/src/hooks/use-workflow-execution.ts` | React hook for workflow state | Polls workflow status, triggers notifications |
| `packages/dashboard/src/hooks/use-session-messages.ts` | React hook for session messages | Uses `findActiveSession()` to discover sessions via polling |
| `packages/dashboard/src/components/projects/session-viewer-drawer.tsx` | Session viewer UI | Displays session messages, needs sessionId to work |
| `packages/dashboard/src/app/api/session/active/route.ts` | API to find active session | Polls `sessions-index.json` with timestamp heuristics |
| `packages/dashboard/src/lib/project-hash.ts` | Calculates Claude project hash | Used for session file path resolution |

### Existing Patterns & Conventions

- **UUID for Execution IDs**: Workflow executions use `randomUUID()` for unique IDs (`workflow-service.ts:491`)
- **File-based Persistence**: Workflow state saved to JSON files, not database
- **Polling Pattern**: 3-second intervals for status updates (`use-workflow-execution.ts:21`)
- **Session Detection**: Current approach uses `findNewSession()` which polls `sessions-index.json` after initial delay (`workflow-service.ts:432-470`)

### Integration Points

- **CLI Invocation**: Workflows spawn Claude CLI with `--output-format json` which returns `session_id` in response
- **Session Files**: Claude stores sessions at `~/.claude/projects/{hash}/{session_id}.jsonl`
- **Session Index**: Claude writes `sessions-index.json` immediately when CLI starts

### Key Discovery: Session ID is Already Available

**Current Behavior** (workflow-service.ts:806-812):
```typescript
const result = JSON.parse(stdout) as ClaudeCliResult;
exec.sessionId = result.session_id;  // Session ID is in JSON output!
```

The session ID is immediately available in the CLI's JSON output. We don't need to poll `sessions-index.json` at all - the JSON output already contains it. The current implementation:
1. Starts polling `sessions-index.json` (unreliable, race conditions)
2. ALSO parses session_id from stdout (reliable, immediate)

The fix is to **rely solely on the JSON output** and remove the polling approach.

### Constraints Discovered

- **Session ID Timing**: Session ID available AFTER first CLI response (not at spawn time)
- **Workflow Directory**: Current location `~/.specflow/workflows/` is global, not project-scoped
- **No Migration Needed**: User confirmed we can delete old workflows and start fresh
- **Constitution VIII**: Operational state (`.specflow/`) vs repo knowledge (`.specify/`) separation

---

## Requirements Sources

### From ROADMAP/Phase File

1. **Architectural Unification**: Workflow = Session = Claude conversation (same concept)
2. **Single Source of Truth**: Store workflow metadata in project: `.specflow/workflows/{session_id}/`
3. **Immediate Session Detection**: Capture session ID when CLI returns (not via polling)
4. **Workflow/Session History**: List all workflow/sessions for a project
5. **Session Viewer Integration**: Update to use unified model

### From Previous Phase (1052)

Phase 1052 implemented Session Viewer UI that provides the viewing infrastructure. This phase extends it with proper session linking.

### From Memory Documents

- **Constitution VIII**: `.specflow/` for operational state, `.specify/` for repo knowledge
- **Constitution III**: CLI over direct edits - but workflow state is dashboard internal
- **Tech Stack**: Next.js, TypeScript, file-based persistence

---

## Scope Clarification

### Questions Asked

#### Question 1: Migration Strategy

**Context**: Existing workflows stored at `~/.specflow/workflows/{execution_id}.json`

**Question**: Should we migrate existing workflow data?

**Options Presented**:
- A (Recommended): Migrate existing workflows to session-ID-keyed directories
- B: Start fresh, old workflows become orphaned

**User Answer**: Delete old workflows and start fresh

**Research Done**: Confirmed this simplifies implementation - no migration logic needed

---

#### Question 2: Session Detection Method

**Context**: Phase file mentions several options including `firstPrompt` matching

**Question**: How should we identify our sessions?

**Options Presented**:
- A (Recommended): Execution ID prefix in first prompt
- B: Skill signature match
- C: Timestamp + project (current approach)

**User Answer**: User asked to research vibe-kanban for alternative solutions

**Research Done**:
- Searched vibe-kanban GitHub repo - no specific session detection code found
- Found [Claude Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/sessions) showing session ID is returned in initial `system` message with `subtype === 'init'`
- Found [GitHub issue #1335](https://github.com/anthropics/claude-code/issues/1335) confirming JSON output contains `session_id` immediately
- **Key Finding**: Our current code ALREADY parses `session_id` from CLI output - we just need to remove the unreliable polling fallback

**Conclusion**: No workaround needed. The CLI's `--output-format json` response includes `session_id` directly. Remove the `findNewSession()` polling and rely solely on parsing the JSON output.

---

### Confirmed Understanding

**What the user wants to achieve**:
- Unify workflow and session concepts so they're treated as the same thing
- Fix race conditions in session detection
- Enable viewing any session's history from the dashboard
- Store workflow metadata per-project in `.specflow/workflows/{session_id}/`

**How it relates to existing code**:
- Refactor `workflow-service.ts` to remove `findNewSession()` polling
- Session ID comes directly from CLI JSON output (already being parsed)
- Move storage from global `~/.specflow/workflows/` to project-local `.specflow/workflows/`
- Update Session Viewer to properly link to clicked session

**Key constraints and requirements**:
- Delete old workflows, no migration
- Session ID available only after first CLI response completes
- Maintain Constitution VIII separation (`.specflow/` for operational state)

**Technical approach**:
- Use `session_id` from CLI JSON output (no polling)
- Store workflow metadata at `{project}/.specflow/workflows/{session_id}/metadata.json`
- Link to Claude's JSONL at `~/.claude/projects/{hash}/{session_id}.jsonl` (don't copy)
- Build index file for quick lookup: `.specflow/workflows/index.json`

**User confirmed**: Yes - 2026-01-19

---

## Recommendations for SPECIFY

### Should Include in Spec

- Session ID comes from CLI JSON output immediately (not polling)
- Workflow storage moves to `{project}/.specflow/workflows/{session_id}/`
- Workflow index at `.specflow/workflows/index.json` for quick listing
- Session Viewer correctly links to clicked session
- Session history list in project detail
- Resume capability for any past session

### Should Exclude from Spec (Non-Goals)

- Full session replay/playback
- Session comparison
- Export/archive sessions
- Session search
- Migration of existing workflow data

### Potential Risks

- Session ID not available until first CLI response completes (~5-30s)
- UI needs graceful handling of "session pending" state
- Edge cases: CLI crashes before returning, network issues

### Questions to Address in CLARIFY

- None - scope is clear from phase file and user clarification
