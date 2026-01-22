# Discovery: Smart Batching & Orchestration

**Phase**: `1055-smart-batching-orchestration`
**Created**: 2026-01-21
**Status**: Complete

## Phase Context

**Source**: ROADMAP Phase 1055, PDR `workflow-dashboard-orchestration.md`
**Goal**: Enable autonomous workflow execution with smart batching, configurable behavior, and auto-healing for large task lists that exceed context windows.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/dashboard/src/lib/services/workflow-service.ts` | Core workflow execution service | Foundation for orchestration - handles skill execution, state persistence |
| `packages/dashboard/src/lib/services/process-health.ts` | Process lifecycle and health monitoring | Provides staleness detection, PID tracking for batch monitoring |
| `packages/dashboard/src/app/api/workflow/start/route.ts` | API route for starting workflows | Entry point pattern to extend for orchestration |
| `packages/dashboard/src/components/projects/action-button.tsx` | Project card action buttons | Where "Complete Phase" button will be added |
| `packages/dashboard/src/hooks/use-workflow-actions.ts` | Workflow action mutations hook | Pattern for orchestration control actions |
| `packages/cli/src/lib/tasks.ts` | Tasks.md parser | Used for batch detection from `##` sections |
| `packages/shared/src/schemas/` | Zod validation schemas | Pattern for OrchestrationExecution schema |

### Existing Patterns & Conventions

- **Detached Process Spawning**: Workflows spawn Claude CLI as detached processes with PIDs tracked in `{project}/.specflow/workflows/{sessionId}/process.pid`. Orchestration will use the same pattern for batch executions.

- **Dual-Storage State**: Pre-sessionId state in `pending-{id}.json`, moves to `{sessionId}/metadata.json` after CLI starts. Orchestration will add `orchestration-{id}.json` for aggregate state.

- **Polling-Based Status**: 3-second polling interval via hooks/API, proven reliable. No SSE needed.

- **Structured Output**: `--disallowedTools "AskUserQuestion"` forces Claude to use structured_output for questions. Same pattern for Claude Helper decisions.

- **Skill Prompt Injection**: User context appended to skill prompts via buildInitialPrompt(). Same mechanism for batch constraints.

- **WorkflowExecution Schema**: Full execution state tracked with status, answers, logs, cost. Extend with OrchestrationExecution for multi-batch tracking.

### Integration Points

- **Project Registry**: All workflows validate against `~/.specflow/registry.json`. Orchestrations will be project-scoped.

- **Workflow Service**: `workflowService.start()` spawns skills. Orchestration state machine calls this for each step/batch.

- **Process Reconciliation**: `ensureReconciliation()` on startup checks process health. Extend for orchestration resume.

- **Project Detail UI**: Workflow actions area will transform to show orchestration progress when active.

- **Specflow CLI**: `specflow status --json` provides phase/task/health context. State machine depends on this output.

### Constraints Discovered

- **Single Orchestration Per Project**: Cannot run concurrent orchestrations on same project - would conflict on tasks.md state.

- **Dual Confirmation Timing**: Must wait for BOTH orchestration state update AND process completion before making decisions to prevent race conditions.

- **Budget Limits**: Claude Helper calls need cost caps to prevent runaway spending on decisions/healing.

- **Tool Restrictions**: Claude Helper for decisions should be read-only (no Edit/Write) to prevent unintended modifications.

---

## Requirements Sources

### From ROADMAP/Phase File

Phase 1055 defined in ROADMAP.md:
- Smart Batching & Orchestration
- **USER GATE**: Auto-batch tasks, state machine, auto-healing

### From Phase File (.specify/phases/1055-smart-batching.md)

Comprehensive 10-section specification including:
1. Orchestration Configuration Modal - upfront user preferences
2. Programmatic Batch Detection - `##` sections as batch boundaries
3. Dashboard Orchestration State Machine - design → analyze → implement → verify flow
4. Sequential Batch Execution - one batch at a time with tracking
5. Auto-Healing on Failure - spawn healer Claude for failed batches
6. Orchestration Progress Display - phase bar, batch progress, status indicators
7. Orchestration State Structure - JSON schema for tracking
8. UI Integration Points - "Complete Phase" as primary action
9. API Design - new orchestration routes
10. Claude Helper Utility - typed interactions for decisions/healing

### From PDR (workflow-dashboard-orchestration.md)

Key principles:
- Build on POC, don't reinvent
- Minimal user interaction (configure upfront, then autonomous)
- Dashboard as orchestrator (hybrid: state machine + Claude fallback)
- Do NOT modify existing /flow.* skills

### From Memory Documents

- **Constitution**:
  - Principle III (CLI Over Direct Edits) - Use `specflow` commands for state
  - Principle VII (Three-Line Output Rule) - Progress UI should prioritize critical info
  - Principle VIII (Repo Knowledge vs Operational State) - Orchestration state goes in `.specflow/`

- **Tech Stack**:
  - TypeScript/ESM for all new code
  - Zod for validation schemas
  - Next.js API routes pattern
  - shadcn/ui components

---

## Scope Clarification

### Questions Asked

The phase file (1055-smart-batching.md) was updated 2026-01-21 with extremely detailed specifications resolving all major design questions:

#### Question 1: Batch Failure Detection

**Context**: Need reliable detection of incomplete batches

**Decision (from phase file)**: Use A + C approach
- Parse task completion from tasks.md (source of truth)
- AND require Claude to output structured completion status
- Check orchestration state `step.current` for skill-signaled completion

#### Question 2: Healing Prompt Scope

**Decision (from phase file)**: Current batch only
- Healer continues remaining tasks in current batch
- Once batch complete (or healer fails), proceed normally

#### Question 3: Cross-batch State

**Decision (from phase file)**: Out of scope
- If batch 2 breaks batch 1's work, healer tries once, then stops for user

#### Question 4: Concurrent Orchestrations

**Decision (from phase file)**: No - one per project
- Single active orchestration per project
- Error shown if attempting second

#### Question 5: Resume After Dashboard Restart

**Decision (from phase file)**: Yes, auto-resume
- State persisted to `{project}/.specflow/workflows/orchestration-{id}.json`
- Reconciler detects and resumes in-progress orchestrations

#### Question 6: Decision Timing

**Decision (from phase file)**: Wait for dual confirmation
- Don't make decisions on state change alone
- Wait for BOTH: state update AND process completion

---

### Confirmed Understanding

**What the user wants to achieve**:
Autonomous phase completion from the dashboard. User clicks "Complete Phase", configures preferences once, and the system handles everything: design, analyze, implement (in batches), verify, and optionally merge - with auto-healing on failures and minimal interruption.

**How it relates to existing code**:
- Builds on workflow-service.ts execution patterns
- Extends WorkflowExecution schema with OrchestrationExecution
- Adds new API routes at `/api/workflow/orchestrate/*`
- Transforms project detail UI when orchestration active
- Uses existing tasks.ts parser for batch detection

**Key constraints and requirements**:
- Single orchestration per project
- Dual confirmation before state transitions
- Budget limits for Claude Helper calls
- Read-only tools for decision calls
- Preserve existing /flow.* skills unchanged

**Technical approach (from phase file)**:
- Configuration modal upfront (Core Options + Advanced Options + Budget)
- State machine with fallback to Claude Helper for unclear states
- Batch execution via skill input injection (no skill modifications)
- Auto-healing spawns continuation Claude with error context
- Progress UI replaces action buttons during orchestration

**User confirmed**: Phase file serves as confirmed requirements

---

## Recommendations for SPECIFY

### Should Include in Spec

- Configuration modal with all options from phase file Section 0
- Claude Helper utility (Section 10) - foundational for decisions/healing
- State machine logic (Section 2)
- Batch detection from tasks.md sections (Section 1)
- Sequential batch execution (Section 3)
- Auto-healing mechanism (Section 4)
- Progress UI components (Section 5)
- New API routes (Section 9)
- OrchestrationExecution schema (Section 7)
- UI changes for "Complete Phase" button (Section 8)

### Should Exclude from Spec (Non-Goals)

- Branch strategy selection (future)
- Test/dry-run mode (future)
- Notification level customization (future)
- Time-based constraints (future)
- Modifying existing /flow.* skills
- SSE/WebSocket for real-time (polling sufficient)
- Individual task selection UI (programmatic only)

### Potential Risks

- **Race conditions**: State updates before process completion - mitigated by dual confirmation pattern
- **Infinite loops in healing**: Mitigated by single heal attempt per batch
- **Budget runaway**: Mitigated by configurable limits per batch/total/healing
- **Context window limits**: Mitigated by batching based on tasks.md sections

### Questions to Address in CLARIFY

None - phase file is comprehensive and includes resolved design decisions.
