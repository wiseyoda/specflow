# Discovery: Workflow Foundation

**Phase**: `1048-workflow-foundation`
**Created**: 2026-01-18
**Status**: Complete

## Phase Context

**Source**: PDR: workflow-dashboard-orchestration.md + ROADMAP phase 1048
**Goal**: Productionize the POC workflow executor and integrate with the dashboard project system

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/dashboard/src/lib/workflow-executor.ts` | POC workflow executor with CLI invocation, state persistence, question handling | Direct reference - refactor to production service |
| `packages/dashboard/src/app/debug/workflow/page.tsx` | Debug UI for workflow testing with question/answer flow | UI patterns to preserve for future phases |
| `packages/dashboard/src/app/api/debug/workflow/*` | Debug API routes (start, status, answer) | Pattern to follow for production routes |
| `packages/cli/src/lib/registry.ts` | Project registry operations (read/write/register) | Integration point for projectId |
| `packages/shared/src/schemas/registry.ts` | Registry schema with ProjectSchema | Type definitions to use |

### Existing Patterns & Conventions

- **CLI Invocation Pattern**:
  ```bash
  claude -p --output-format json \
    --dangerously-skip-permissions \
    --disallowedTools "AskUserQuestion" \
    --json-schema "$(cat schema.json)" \
    < prompt.txt > output.json
  ```

- **Resume Pattern**: `claude -p --resume "{sessionId}" ...`

- **State Persistence**: JSON files at `~/.specflow/workflow-debug/{id}.json`

- **Service Pattern**: Functions grouped in executor object with `start()`, `resume()`, `get()`, `list()`

- **API Route Pattern**: Next.js route handlers in `app/api/{resource}/{action}/route.ts`

### Integration Points

- **Project Registry**: Link workflow executions to registered project UUIDs from `~/.specflow/registry.json`
- **Orchestration State**: Reference `projectId` from `.specify/orchestration-state.json`
- **Dashboard API**: New routes at `/api/workflow/*` following existing patterns

### Constraints Discovered

- **File-Based Persistence**: POC proves this works well; no database needed
- **Polling Over SSE**: 3-second polling is sufficient for MVP UX
- **Session ID Required**: Resume requires session ID from previous run's JSON output
- **CLI Mode Instructions**: Must include instructions about disabled AskUserQuestion tool

---

## Requirements Sources

### From ROADMAP/Phase File

1. Refactor `/lib/workflow-executor.ts` to `/lib/services/workflow-service.ts`
2. Add `projectId` to `WorkflowExecution` interface (link to registered projects)
3. Create production API routes:
   - POST `/api/workflow/start` - Start workflow (projectId, skill)
   - GET `/api/workflow/status?id=<id>` - Get execution status
   - GET `/api/workflow/list?projectId=<id>` - List executions for project
   - POST `/api/workflow/answer` - Submit answers and resume
   - POST `/api/workflow/cancel?id=<id>` - Cancel running workflow
4. State directory: `~/.specflow/workflows/` (not workflow-debug)
5. Error handling improvements (timeout, retry logic)

### From PDR (workflow-dashboard-orchestration.md)

- Keep exact CLI invocation pattern from POC
- Keep file-based persistence (proven in POC)
- Keep polling approach (proven reliable)
- projectId links to dashboard's registered projects
- No streaming/SSE needed for MVP

### From Memory Documents

- **Constitution**:
  - Principle IIa: TypeScript for CLI packages
  - Principle III: CLI over direct edits (use CLI for state changes)
  - Principle VII: Three-line output rule for CLI output

- **Tech Stack**:
  - Next.js 16.x with App Router
  - TypeScript 5.x strict mode
  - Zod for validation

---

## Scope Clarification

### Questions Asked

No clarifying questions needed - scope is comprehensively defined in PDR and phase file.

### Confirmed Understanding

**What needs to be achieved**:
Refactor the working POC workflow executor into a production-ready service that:
1. Links executions to registered dashboard projects via projectId
2. Stores state in production location (`~/.specflow/workflows/`)
3. Exposes clean API routes for dashboard integration
4. Adds robust error handling (timeout, process cleanup)

**How it relates to existing code**:
- Direct refactor of `workflow-executor.ts` → `workflow-service.ts`
- New API routes mirror debug routes structure
- Integrates with existing registry for project lookup

**Key constraints and requirements**:
- Keep CLI invocation pattern exactly as POC
- File-based JSON persistence (no database)
- Polling-based status checks (no SSE)
- Must handle: timeout, cancel, process cleanup

**Technical approach**:
- TypeScript service with Zod validation
- Next.js API route handlers
- UUID-based execution tracking
- Project ID from registry for linking

**User confirmed**: N/A - requirements from PDR are authoritative

---

## Recommendations for SPECIFY

### Should Include in Spec

- WorkflowExecution interface with projectId
- All 5 API routes with request/response contracts
- Timeout configuration (default 10 minutes)
- Cancel functionality with process cleanup
- List filtering by projectId

### Should Exclude from Spec (Non-Goals)

- UI components (Phase 1050)
- Notifications (Phase 1051)
- Session viewer (Phase 1052)
- Smart batching (Phase 1055)
- SSE/WebSocket streaming

### Potential Risks

- Process cleanup on cancel may leave orphaned Claude processes
- Long-running workflows may exceed timeout unexpectedly
- Session ID extraction depends on Claude CLI output format

### Questions to Address in CLARIFY

None - all requirements are well-defined in PDR
