---
phase: 1050
name: workflow-runner
status: not_started
created: 2026-01-17
pdr: pdr-orchestration-engine.md
---

### 1050 - Workflow Runner

**Goal**: Server-side process management for running decomposed SpecFlow commands via Claude CLI with stream-json.

**Scope**:
- Workflow runner service that spawns Claude CLI processes
- Uses `claude -p --output-format stream-json --input-format stream-json`
- Process management: start, monitor, handle completion
- Browser-independent execution (process continues if browser closes)
- State persistence for workflow progress
- Result queuing for later retrieval
- Multi-project support (parallel workflows)

**User Stories**:
1. As a dashboard, I start a workflow and it runs on the server
2. As a user, I close my browser and the current step continues
3. As a user, I return and see what completed while I was away
4. As a dashboard, I run workflows on 2 projects simultaneously
5. As a dashboard, I get streaming updates while process runs

**Deliverables**:
- Workflow runner service in `packages/dashboard/src/lib/workflow-runner.ts`
- Process spawning with Claude CLI stream-json mode
- Workflow state persistence (SQLite or file-based)
- API routes:
  - POST `/api/workflow/start` - Start workflow for project
  - GET `/api/workflow/status/:projectId` - Get current status
  - GET `/api/workflow/stream/:projectId` - SSE stream for updates
  - POST `/api/workflow/cancel/:projectId` - Cancel running workflow
- Process lifecycle management (cleanup on completion/error)
- Queue completed results for browser reconnection

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Start workflow from API, see process running
- Close browser, reopen, see step completed
- Run workflows on 2 projects simultaneously
- Cancel running workflow

**Estimated Complexity**: High
