# PDR: Workflow Dashboard Orchestration

> **Product Design Record** for phases 1048-1070 + 1057-1058
>
> This document provides the holistic architecture and design decisions for the
> workflow dashboard integration feature set. Individual phase files contain
> implementation details; this document provides the "why" and overall vision.

**Created**: 2026-01-18
**Updated**: 2026-01-24 (Phase 1058 architectural simplification)
**Status**: Approved
**Phases**: 1048, 1050, 1051, 1052, 1055, 1057, 1058, 1060, 1070
**POC Reference**: `/debug/workflow` (commit 5dc79dd)

---

## Executive Summary

Transform the SpecFlow dashboard from a passive status viewer into an autonomous
workflow orchestration system. Users should be able to start `/flow.*` skills
from the dashboard and have them run to completion with minimal intervention.

**Northstar**: A user clicks "Start Orchestrate" and walks away. The system
handles batching, questions (via notifications), failures (via auto-healing),
and transitions between phases. The user returns to find their feature implemented.

---

## Phase 1058 Architecture Update: Single State Consolidation

> **CRITICAL**: This section documents architectural decisions from Phase 1058 that
> supersede earlier designs. All future orchestration work MUST follow these patterns.

### Problem Statement

After initial implementation (phases 1048-1055), the orchestration system accumulated
technical debt from edge case handling:

- **Multiple sources of truth**: CLI state file vs dashboard's `OrchestrationExecution`
- **Reconciliation hacks**: Code to sync parallel state sources
- **Guard code**: Checks that fixed state after it was already wrong
- **Claude analyzer fallback**: AI to interpret "unclear" state
- **Complex decision logic**: 700+ lines of conditional handling

This pattern is toxic. Each hack requires another hack to handle its edge cases.

### Architectural Principles (Binding)

#### 1. CLI State File is THE Single Source of Truth

```
.specflow/orchestration-state.json
├── orchestration.step.current      → Current step (design/analyze/implement/verify)
├── orchestration.step.status       → Step status (not_started/in_progress/complete/failed)
├── orchestration.step.index        → Step index (0-3)
├── orchestration.phase.*           → Phase metadata
└── orchestration.dashboard.*       → Dashboard-specific data (batches, cost, etc.)
```

**Dashboard reads this file. Dashboard does NOT maintain separate state.**

If you find yourself creating a parallel state object, STOP. Use CLI state.

#### 2. Sub-Commands Own Their State

| Command | State Responsibility |
|---------|---------------------|
| `/flow.design` | Sets `step.status=complete` when design artifacts created |
| `/flow.analyze` | Sets `step.status=complete` when analysis done |
| `/flow.implement` | Sets `step.status=complete` when tasks done |
| `/flow.verify` | Sets `step.status=complete` when verification passes |

**Dashboard trusts these settings.** It does NOT verify by checking artifacts exist.

#### 3. Simple Decision Logic (<100 lines)

```typescript
function getNextAction(state): Decision {
  const { step, dashboard } = state.orchestration;

  // Trust the state file. Period.
  if (!dashboard?.active) return { action: 'idle' };
  if (dashboard.lastWorkflow?.status === 'running') return { action: 'wait' };

  switch (step.current) {
    case 'design':    return step.status === 'complete' ? transition('analyze') : spawn('flow.design');
    case 'analyze':   return step.status === 'complete' ? transition('implement') : spawn('flow.analyze');
    case 'implement': return handleBatches(state);
    case 'verify':    return step.status === 'complete' ? mergeOrWait(state) : spawn('flow.verify');
  }
}
```

If decision logic exceeds 100 lines, the STATE MODEL is too complex. Simplify state, not add more conditionals.

#### 4. Auto-Heal Pattern (Not Reconciliation)

When a workflow completes, apply simple healing rules:

```typescript
function autoHealAfterWorkflow(skill: string, status: string): void {
  if (status !== 'completed') return;  // Only heal on success

  const expectedStep = skillToStep(skill);  // flow.design → design
  if (state.step.current === expectedStep && state.step.status !== 'complete') {
    state.step.status = 'complete';  // Simple, targeted fix
    log(`Auto-healed: ${expectedStep} marked complete after ${skill} succeeded`);
  }
}
```

**This is NOT reconciliation.** Reconciliation syncs parallel sources. Auto-heal fixes
known edge cases in a SINGLE source.

#### 5. UI Step Override (User Escape Hatch)

Users can manually go back to a previous step:

- Click "Go back to Design" → `step.current=design`, `step.status=not_started`
- Orchestration resumes from that step

This provides escape from any stuck state without code changes.

### Anti-Patterns (FORBIDDEN)

| Anti-Pattern | Why It's Bad | What To Do Instead |
|--------------|--------------|-------------------|
| Separate `OrchestrationExecution` type | Parallel state source | Use CLI state's `orchestration.dashboard` |
| State reconciliation code | Masks root cause, adds complexity | Fix why state diverges |
| "Guard" code that checks then fixes | State shouldn't need guarding | Fix upstream code that creates bad state |
| Claude/AI to interpret unclear state | If state is unclear, schema is wrong | Simplify state schema |
| Decision logic > 100 lines | Complexity breeds bugs | Simplify state model |
| Comments like `// HACK:` or `// WORKAROUND:` | Documents but doesn't fix problem | Find and fix root cause |

### File Locations

| File | Purpose | Notes |
|------|---------|-------|
| `packages/dashboard/src/lib/services/orchestration-service.ts` | State operations | Uses CLI state, NOT separate execution files |
| `packages/dashboard/src/lib/services/orchestration-runner.ts` | Main loop | Calls `getNextAction()`, trusts state |
| `packages/dashboard/src/lib/services/orchestration-decisions.ts` | Decision logic | <100 lines, pure functions |
| `packages/dashboard/src/lib/services/orchestration-types.ts` | Type definitions | `OrchestrationExecution` is LOCAL, not shared |
| `.specflow/orchestration-state.json` | THE state file | Single source of truth |

### Migration Notes

Phase 1058 removed:
- `packages/shared/src/schemas/orchestration-execution.ts` (parallel state type)
- Legacy `makeDecision()` function (700+ lines → replaced by `getNextAction()` ~80 lines)
- All reconciliation/guard code from runner

If you need `OrchestrationExecution` type, import from `orchestration-types.ts` (dashboard-local),
NOT from `@specflow/shared`.

---

## Key Principles

### 1. Build on POC, Don't Reinvent

The POC proves the core approach works:

- `--disallowedTools "AskUserQuestion"` captures questions in structured output
- `--json-schema` enforces output format
- `--resume {sessionId}` continues sessions
- State persistence to filesystem survives hot reload
- Polling (vs SSE) is sufficient for MVP

### 2. Minimal User Interaction

The northstar is autonomous execution:

- Dashboard manages orchestration via state machine
- Tasks batched programmatically (no user picking)
- Auto-healing on failures (spawn fixer Claude)
- User only intervenes for: questions, approval gates, true blockers

### 3. Dashboard as Orchestrator (Hybrid)

- **Primary**: State machine based on `specflow status --json`
- **Fallback**: Spawn Claude to make decisions when stuck
- **Never**: Keep Claude running indefinitely waiting for guidance

**DO NOT:**

- Modify existing /flow.\* skills (they work)
- Replace the working executor pattern
- Over-engineer with SSE/WebSockets (add later)
- Build new CLI commands when skills work
- Add UI for choosing which tasks to run (programmatic only)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Dashboard (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ├── Project List (with status badges, costs)                   │
│  ├── Project Detail (with session viewer panel)                 │
│  ├── Question Drawer (slide from right)                         │
│  └── Operations Page (queue view)                               │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                  │
│  ├── Workflow Service (executor, state machine)                 │
│  ├── Session Parser (JSONL → messages)                          │
│  ├── Notification Service (Browser API)                         │
│  └── Cost Aggregator                                            │
├─────────────────────────────────────────────────────────────────┤
│  API Layer                                                      │
│  ├── /api/workflow/* (start, status, answer, cancel)            │
│  ├── /api/session/* (stream, list)                              │
│  └── /api/stats/* (costs, history)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Claude CLI                                 │
├─────────────────────────────────────────────────────────────────┤
│  Invocation:                                                    │
│  claude -p --output-format json                                 │
│    --dangerously-skip-permissions                               │
│    --disallowedTools "AskUserQuestion"                          │
│    --json-schema "<schema>"                                     │
│    < prompt.txt > output.json                                   │
│                                                                 │
│  Resume:                                                        │
│  claude -p --resume "<session_id>" ... < answer.txt             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      State & Storage                            │
├─────────────────────────────────────────────────────────────────┤
│  ~/.specflow/workflows/{id}.json    ← Workflow execution state  │
│  ~/.claude/projects/{hash}/*.jsonl  ← Session transcripts       │
│  {project}/.specify/                ← Project artifacts         │
└─────────────────────────────────────────────────────────────────┘
```

### Orchestration Flow

```
User clicks "Start Orchestrate"
           │
           ▼
┌──────────────────────┐
│  Check Project State │ ◄──────────────────────────────────┐
│  specflow status     │                                    │
└──────────┬───────────┘                                    │
           │                                                │
           ▼                                                │
    ┌──────────────┐      ┌──────────────────────┐          │
    │ Need Design? │──Yes─►│ Run /flow.design    │──────────┤
    └──────┬───────┘      └──────────────────────┘          │
           │No                                              │
           ▼                                                │
    ┌──────────────┐      ┌──────────────────────┐          │
    │ Tasks Left?  │──Yes─►│ Run /flow.implement │──────────┤
    └──────┬───────┘      │ (batch N of M)       │          │
           │No            └──────────┬───────────┘          │
           │                         │                      │
           │              ┌──────────▼───────────┐          │
           │              │ Batch Failed?        │          │
           │              └──────────┬───────────┘          │
           │                   Yes   │   No                 │
           │              ┌──────────▼───────────┐          │
           │              │ Auto-Heal (spawn     │──────────┤
           │              │ fixer Claude)        │          │
           │              └──────────────────────┘          │
           ▼                                                │
    ┌──────────────┐      ┌──────────────────────┐          │
    │ Need Verify? │──Yes─►│ Run /flow.verify    │──────────┤
    └──────┬───────┘      └──────────────────────┘          │
           │No                                              │
           ▼                                                │
    ┌──────────────┐      ┌──────────────────────┐          │
    │ Ready Merge? │──Yes─►│ Run /flow.merge     │──────────┘
    └──────┬───────┘      │ (requires approval)  │
           │No            └──────────────────────┘
           ▼
    ┌──────────────┐
    │   Complete   │
    └──────────────┘
```

### Question Handling Flow

```
Claude needs input
       │
       ▼
┌──────────────────────┐
│ Output: status=      │
│ "needs_input" +      │
│ questions array      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│ Workflow Service     │────►│ Browser Notification │
│ marks "waiting"      │     │ "Project X needs     │
└──────────┬───────────┘     │ your input"          │
           │                 └──────────────────────┘
           ▼
┌──────────────────────┐
│ Question badge on    │
│ project card/detail  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ User opens drawer,   │
│ answers questions    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ POST /api/workflow/  │
│ answer               │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Resume with          │
│ --resume <sessionId> │
└──────────────────────┘
```

---

## Phase Overview

| Phase | Name                           | Goal                                       | USER GATE                                     |
| ----- | ------------------------------ | ------------------------------------------ | --------------------------------------------- |
| 1048  | Workflow Foundation            | Productionize POC, project integration     | Start workflow for any registered project     |
| 1050  | Workflow UI                    | Dashboard integration, skill picker        | Start from card OR detail, see status         |
| 1051  | Questions & Notifications      | Notification API, question drawer          | Notification appears, answer works            |
| 1052  | Session Viewer                 | JSONL parser, slide-out panel, follow-up   | View session output, send follow-up           |
| 1055  | Smart Batching & Orchestration | Auto-batching, state machine, auto-healing | Run implement with batches, auto-heal failure |
| 1060  | Stats & Operations             | Costs, runtime, queue view, basic chart    | See costs on list, active agents, cost chart  |
| 1070  | Cost Analytics                 | Advanced charts, projections, export       | Multi-project analytics, CSV/JSON export      |

**Phase Details**: See `.specify/phases/10XX-*.md` for implementation specifics.

---

## Phase 1048 - Workflow Foundation

**Goal**: Productionize the POC executor and integrate with project system.

**What Changes from Original 1048:**

- REMOVED: New CLI commands (`specflow workflow implement --group`)
- REMOVED: Task group format changes to tasks.md
- ADDED: Production-grade executor refactor
- ADDED: Project ID linking (not just path)

**Scope:**

1. Move `/lib/workflow-executor.ts` to `/lib/services/workflow-service.ts`
2. Add project ID to WorkflowExecution (link to registered projects)
3. Create production API routes at `/api/workflow/*`:
   - POST `/api/workflow/start` - Start workflow (projectId, skill)
   - GET `/api/workflow/status?id=<id>` - Get execution status
   - GET `/api/workflow/list?projectId=<id>` - List executions for project
   - POST `/api/workflow/answer` - Submit answers and resume
   - POST `/api/workflow/cancel?id=<id>` - Cancel running workflow
4. State directory: `~/.specflow/workflows/` (not workflow-debug)
5. Add workflow execution history to project state
6. Error handling improvements (timeout, retry logic)

**Technical Details:**

- Keep file-based persistence (proven in POC)
- Keep polling approach (proven reliable)
- Keep exact CLI invocation pattern from POC
- projectId links to dashboard's registered projects

**Deliverables:**

- `packages/dashboard/src/lib/services/workflow-service.ts`
- `packages/dashboard/src/app/api/workflow/start/route.ts`
- `packages/dashboard/src/app/api/workflow/status/route.ts`
- `packages/dashboard/src/app/api/workflow/list/route.ts`
- `packages/dashboard/src/app/api/workflow/answer/route.ts`
- `packages/dashboard/src/app/api/workflow/cancel/route.ts`
- Tests for workflow service

**Verification Gate: USER**

- [ ] Start workflow for a registered project via API
- [ ] See execution linked to correct project
- [ ] Cancel running workflow
- [ ] List all executions for a project

---

## Phase 1050 - Workflow UI Integration

**Goal**: Surface workflow execution in the main dashboard UI.

**What Changes from Original 1050:**

- REMOVED: Stream-json mode (polling works fine)
- REMOVED: SSE streaming (add later if needed)
- REMOVED: Complex multi-project queue management
- SIMPLIFIED: Focus on UI integration only

**Scope:**

1. "Start Workflow" in project card actions dropdown
2. "Start Workflow" button in project detail header
3. Skill picker dropdown:
   - /flow.design
   - /flow.analyze
   - /flow.implement
   - /flow.verify
   - /flow.orchestrate
   - /flow.merge
4. Workflow status indicator on project cards:
   - Running (spinner)
   - Waiting for input (yellow badge)
   - Completed (green check, fades after 30s)
   - Failed (red x)
5. Current workflow info in project detail sidebar

**Deliverables:**

- Skill picker component (`WorkflowSkillPicker.tsx`)
- Start workflow modal/dialog (`StartWorkflowDialog.tsx`)
- Status badge component (`WorkflowStatusBadge.tsx`)
- Integration with ProjectCard actions
- Integration with ProjectDetail header
- Workflow status in project detail sidebar

**Verification Gate: USER**

- [ ] Start workflow from project card actions menu
- [ ] Start workflow from project detail header
- [ ] See skill picker with all /flow.\* options
- [ ] See status badge update as workflow progresses

---

## Phase 1051 - Questions & Notifications

**Goal**: Excellent question answering UX with browser notifications.

**What Changes from Original 1051:**

- KEPT: Toast, badges, drawer panel
- ADDED: Browser Notification API
- ADDED: Free-form follow-up text input
- SIMPLIFIED: Reuse POC question UI patterns

**Scope:**

1. Browser Notification API integration:
   - Request permission on first workflow start
   - Show notification when questions pending
   - Click notification focuses dashboard tab
   - Notification shows project name + "has questions"
2. Question badge on project cards (yellow dot with count)
3. Question badge in project detail header
4. Question drawer panel (slide from right):
   - Reuse UI patterns from POC debug page
   - Single-select, multi-select, free-form text
   - Submit button with loading state
5. Free-form follow-up input:
   - Text area at bottom of drawer
   - "Send message" button
   - Continues session with custom text (not structured answer)

**Deliverables:**

- `packages/dashboard/src/lib/notifications.ts` (Browser API wrapper)
- Question drawer component (`QuestionDrawer.tsx`)
- Question badge component (`QuestionBadge.tsx`)
- Follow-up text input component
- Integration with project card and detail

**Verification Gate: USER**

- [ ] Browser asks for notification permission
- [ ] Desktop notification appears when questions pending
- [ ] Question badge visible on project card
- [ ] Click badge opens drawer, answer question, workflow continues
- [ ] Send free-form follow-up text, session continues

---

## Phase 1052 - Session Viewer

**Goal**: View agent progress and send follow-up commands.

**What Changes from Original 1052:**

- REMOVED: Step-by-step progress visualization (too complex for MVP)
- REMOVED: Post-workflow summary view (can add later)
- ADDED: JSONL session parsing
- ADDED: Slide-out panel (per user preference)
- FOCUSED: Real-time session output viewing

**Scope:**

1. Parse Claude session JSONL files:
   - Location: `~/.claude/projects/{hash}/{session}.jsonl`
   - Extract: messages, tool calls, results
   - Real-time tailing for active sessions
2. Session viewer slide-out panel:
   - Opens from project detail
   - Shows current/recent session
   - Streaming updates for active sessions
   - Formatted message display (user/assistant/tool)
3. Active session detection:
   - Link workflow sessionId to JSONL file
   - Highlight currently executing session
4. Basic progress indicators:
   - Files modified count
   - Tasks completed (if visible in output)
   - Time elapsed

**Technical Notes:**

- Hash for project path: Same as Claude Code uses
- JSONL parsing: Stream line-by-line for large files
- Auto-scroll with "pause on scroll up" behavior

**Deliverables:**

- `packages/dashboard/src/lib/session-parser.ts`
- Session viewer panel (`SessionViewerPanel.tsx`)
- Message formatter component
- API route to stream session content
- Integration with project detail

**Verification Gate: USER**

- [ ] Open session viewer from project detail
- [ ] See formatted messages from active session
- [ ] Content streams in real-time during workflow
- [ ] See files modified and time elapsed

---

## Phase 1055 - Smart Batching & Orchestration

**Goal**: Autonomous implement execution with smart batching and auto-healing.

**Why This Phase:**

- Large task lists (50+) exceed context window
- Users want minimal interaction (no picking tasks)
- Failures should self-heal when possible
- Dashboard needs to orchestrate the full flow

**Scope:**

### 1. Programmatic Batch Detection

Parse existing task sections from tasks.md:

- Use markdown headers (`## Section Name`) as batch boundaries
- Fall back to fixed-size batches (~15 tasks) if no sections
- No UI for selecting batches - fully automatic

### 2. Dashboard Orchestration State Machine

```
[Start] → Check Status → Design needed? → /flow.design
                      → Tasks incomplete? → /flow.implement (batch N)
                      → All tasks done? → /flow.verify
                      → Verified? → /flow.merge (if approved)
                      → [Complete]
```

- Between each step: `specflow status --json` to determine next action
- State persisted in workflow execution record
- Fallback: Spawn Claude to analyze when state unclear

### 3. Sequential Batch Execution

- Run each task section as a separate /flow.implement invocation
- Wait for completion before starting next batch
- Track: current batch index, batch status, tasks completed per batch

### 4. Auto-Healing on Failure

When a batch fails:

1. Capture error details (stderr, session output, failed tasks)
2. Spawn a new Claude CLI instance with healing prompt:

   ```
   The following implement batch failed:
   - Batch: "## Core Components"
   - Error: [error details]
   - Tasks attempted: T005-T012
   - Tasks completed: T005-T008
   - Tasks failed: T009 (file not found)

   Analyze the failure and fix the issue, then continue with remaining tasks.
   ```

3. If healer succeeds → continue to next batch
4. If healer fails → stop, notify user with full context

### 5. Orchestration Progress Display

- Current phase indicator (Design → Implement → Verify → Merge)
- Current batch: "Implementing batch 2 of 4: Core Components"
- Tasks completed: "12/35 tasks complete"
- Healing status: "Auto-healing batch 2..."

**Deliverables:**

- Batch parser in workflow-service.ts (uses existing tasks.ts)
- Orchestration state machine logic
- Auto-healing prompt builder and executor
- Orchestration progress component
- State machine fallback (spawn Claude for decisions)

**Verification Gate: USER**

- [ ] Start orchestrate, see batches auto-detected
- [ ] Batches execute sequentially without user input
- [ ] Introduce a failure, see auto-heal attempt
- [ ] Progress shows batch status clearly
- [ ] State machine transitions correctly (design→implement→verify)

---

## Phase 1060 - Stats & Operations

**Goal**: Operational visibility with stats, queue view, and basic cost visualization.

**What Changes from Original 1060:**

- KEPT: Queue view, activity indicators
- REMOVED: CPU/memory resource monitor (out of scope)
- ADDED: Cost display on project list
- ADDED: Runtime tracking
- ADDED: Basic cost over time chart (per user request)
- SIMPLIFIED: Focus on essential metrics

**Scope:**

### 1. Stats on Project List Cards

- Last workflow status (icon)
- Last run time (e.g., "2h ago")
- Total cost (cumulative across all sessions)
- Active indicator (green dot if running)

### 2. Project Detail Stats Section

- Session history list
- Per-session cost breakdown
- Total tokens used
- Total runtime
- **Basic line chart**: Cost over time (last 30 days or last N sessions)

### 3. Operations Page (`/operations`)

- All active workflows across projects
- Pending questions across projects
- Recent completions/failures
- Quick access to answer questions
- Aggregate cost across all projects

### 4. Basic Cost Chart Component

- Simple line chart (use lightweight library like recharts or @visx)
- X-axis: time or session number
- Y-axis: cumulative cost
- Hover to see session details

**Deliverables:**

- Stats display on project cards
- Stats section in project detail
- Basic cost chart component (`CostChart.tsx`)
- Operations page (`/app/operations/page.tsx`)
- Cost aggregation utilities
- Session history list component

**Verification Gate: USER**

- [ ] See cost and status on project list cards
- [ ] See session history in project detail
- [ ] See basic cost chart in project detail
- [ ] Operations page shows all active workflows
- [ ] Quick access to pending questions across projects

---

## Removed/Deferred Items

**From Original 1048:**

- New CLI commands (`specflow workflow implement --group`) - Dashboard handles this
- Task group format changes to tasks.md - Use existing ## headers
- JSON streaming events - Polling sufficient

**From Original 1050:**

- Stream-json mode - Polling works
- SSE streaming - Can add later if needed
- SQLite storage - Files work fine

**From Original 1060:**

- CPU/memory resource monitor - Complex, low value

**Deferred to 1070+ (Cost Analytics):**

- Cost projections and burn rate
- Advanced trend analysis
- CSV/JSON export
- Multi-project cost comparison charts

---

## Implementation Order & Dependencies

```
1048 (Foundation) ─────────────────────────────────────┐
  │                                                    │
  ▼                                                    │
1050 (UI Integration) ─────────────────────────────────┤
  │                                                    │
  ├─────────────────┬─────────────────┐                │
  ▼                 ▼                 │                │
1051 (Questions)  1055 (Orchestration)│                │
  │                 │                 │                │
  ▼                 │                 │                │
1052 (Session)      │                 │                │
  │                 │                 │                │
  └────────┬────────┴─────────────────┘                │
           ▼                                           │
         1060 (Stats & Operations) ◄───────────────────┘
```

**Phase Dependencies:**

- **1048**: No dependencies, foundational
- **1050**: Requires 1048 (API routes)
- **1051**: Requires 1050 (workflow status UI)
- **1052**: Requires 1051 (question context for follow-up)
- **1055**: Requires 1050 (workflow execution), can parallel with 1051
- **1060**: Requires all above (aggregates data from workflows)

**Parallelization Opportunity:**

- 1051 (Questions) and 1055 (Orchestration) can run in parallel after 1050
- Both feed into 1060

Each phase has USER GATE verification.

---

## POC Code to Preserve

Keep as reference/starting point:

- `/packages/dashboard/src/lib/workflow-executor.ts` - Core patterns
- `/packages/dashboard/src/app/debug/workflow/page.tsx` - UI patterns
- `/packages/dashboard/src/app/api/debug/workflow/*` - API patterns

Do NOT delete until production equivalents are complete and tested.

---

## Test Environment

- `~/dev/test-app` - Clean Python project for testing
- Reset: `cd ~/dev/test-app && git reset --hard clean-python-hello`

---

## Related Phase Files

Each phase has a dedicated implementation file with specific deliverables:

| Phase | File | Focus |
|-------|------|-------|
| 1048 | `.specify/phases/1048-workflow-foundation.md` | API routes, service refactor |
| 1050 | `.specify/phases/1050-workflow-ui.md` | UI components, skill picker |
| 1051 | `.specify/phases/1051-questions-notifications.md` | Notifications, question drawer |
| 1052 | `.specify/phases/1052-session-viewer.md` | JSONL parser, slide-out panel |
| 1055 | `.specify/phases/1055-smart-batching.md` | State machine, auto-healing |
| 1060 | `.specify/phases/1060-stats-operations.md` | Stats, operations page |
| 1070 | `.specify/phases/1070-cost-analytics.md` | Advanced analytics, export |

---

## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State persistence | File-based JSON | Proven in POC, survives hot reload |
| Real-time updates | Polling (3s) | Simpler than SSE, sufficient for UX |
| Batch boundaries | tasks.md ## headers | Already structured, no format changes |
| Notifications | Browser API | Standard, works backgrounded, no deps |
| Session viewer | Slide-out panel | Keeps project context visible |
| Orchestration | Hybrid state machine | Simple rules + Claude fallback |
| Auto-healing | Single retry | Prevents loops, usually succeeds |
| Follow-up input | Free-form text | Maximum flexibility |
| Start workflow | Both card + detail | User preference, quick access |
| **Phase 1058 Updates** | | |
| State source | CLI state file only | Multiple sources led to sync bugs |
| OrchestrationExecution | Dashboard-local type | Removed from shared, now internal |
| Decision logic | <100 lines | Complex logic = wrong state model |
| Claude fallback | REMOVED | If state is unclear, fix state schema |
| Reconciliation code | REMOVED | Fix root cause, don't mask it |
| Step status ownership | Sub-commands | flow.* sets complete, dashboard trusts |
| UI escape hatch | Step override | User can manually go back to any step |
