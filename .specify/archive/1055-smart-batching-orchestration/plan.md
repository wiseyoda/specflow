# Implementation Plan: Smart Batching & Orchestration

**Branch**: `1055-smart-batching-orchestration` | **Date**: 2026-01-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/1055-smart-batching-orchestration/spec.md`

## Summary

Implement autonomous phase completion with smart batching, configurable behavior, and auto-healing. The system enables users to click "Complete Phase", configure preferences once, and have the dashboard orchestrate the entire design → analyze → implement → verify → merge workflow with minimal intervention.

Key technical components:
- **Claude Helper Utility**: Foundational service for typed Claude interactions (decisions, verification, healing)
- **Orchestration State Machine**: Manages phase transitions with dual confirmation pattern
- **Batch Detection**: Parses tasks.md `##` sections as batch boundaries
- **Configuration Modal**: Upfront user preferences before autonomous execution
- **Progress UI**: Replaces action buttons during active orchestration

## Technical Context

**Language/Version**: TypeScript 5.7+ (ESM, strict mode)
**Primary Dependencies**: Next.js 16.x, React 19.x, Commander.js 12.x, Zod 3.x, shadcn/ui
**Storage**: File-based JSON (`{project}/.specflow/workflows/orchestration-{id}.json`)
**Testing**: Vitest 2.x with memfs for filesystem mocking
**Target Platform**: Node.js 18+, macOS/Linux
**Project Type**: Monorepo (packages/dashboard, packages/cli, packages/shared)
**Performance Goals**: Polling at 3s intervals, budget tracking per batch
**Constraints**: Single orchestration per project, dual confirmation before transitions
**Scale/Scope**: Support 50+ task phases, 4-hour orchestrations

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| III. CLI Over Direct Edits | ✅ Pass | Uses `specflow status --json`, `specflow state set` |
| VII. Three-Line Output Rule | ✅ Pass | Progress UI prioritizes critical info |
| VIII. Repo Knowledge vs Operational State | ✅ Pass | Orchestration state in `.specflow/`, not `.specify/` |
| IIa. TypeScript for CLI Packages | ✅ Pass | All new code in TypeScript |
| V. Helpful Error Messages | ✅ Pass | Error states include context and next steps |

No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/1055-smart-batching-orchestration/
├── discovery.md         # Codebase findings and decisions
├── spec.md              # Feature specification
├── requirements.md      # Requirements quality checklist
├── ui-design.md         # Visual mockups and rationale
├── plan.md              # This file
├── tasks.md             # Task breakdown
└── checklists/
    ├── implementation.md
    └── verification.md
```

### Source Code Changes

```text
packages/dashboard/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── workflow/
│   │           └── orchestrate/        # NEW: Orchestration API routes
│   │               ├── route.ts        # POST /api/workflow/orchestrate
│   │               ├── status/
│   │               │   └── route.ts    # GET /api/workflow/orchestrate/status
│   │               ├── list/
│   │               │   └── route.ts    # GET /api/workflow/orchestrate/list
│   │               ├── cancel/
│   │               │   └── route.ts    # POST /api/workflow/orchestrate/cancel
│   │               ├── resume/
│   │               │   └── route.ts    # POST /api/workflow/orchestrate/resume
│   │               └── merge/
│   │                   └── route.ts    # POST /api/workflow/orchestrate/merge
│   │
│   ├── components/
│   │   └── orchestration/              # NEW: Orchestration UI components
│   │       ├── start-orchestration-modal.tsx
│   │       ├── orchestration-config-form.tsx
│   │       ├── orchestration-progress.tsx
│   │       ├── phase-progress-bar.tsx
│   │       ├── batch-progress.tsx
│   │       ├── decision-log-panel.tsx
│   │       ├── orchestration-controls.tsx
│   │       ├── merge-ready-panel.tsx
│   │       └── orchestration-badge.tsx
│   │
│   ├── lib/
│   │   └── services/
│   │       ├── claude-helper.ts        # NEW: Claude Helper utility
│   │       ├── orchestration-service.ts # NEW: Orchestration state machine
│   │       ├── batch-parser.ts         # NEW: Batch detection from tasks.md
│   │       ├── auto-healing-service.ts # NEW: Auto-healing on failure
│   │       └── workflow-service.ts     # MODIFY: Add orchestration hooks
│   │
│   └── hooks/
│       └── use-orchestration.ts        # NEW: Orchestration state hook
│
└── __tests__/
    └── orchestration/                  # NEW: Orchestration tests
        ├── claude-helper.test.ts
        ├── orchestration-service.test.ts
        ├── batch-parser.test.ts
        └── auto-healing-service.test.ts

packages/shared/
└── src/
    └── schemas/
        ├── orchestration-execution.ts  # NEW: OrchestrationExecution schema
        └── orchestration-config.ts     # NEW: OrchestrationConfig schema
```

**Structure Decision**: Extends existing monorepo structure. New orchestration components in dedicated directory. Services follow established pattern from workflow-service.ts.

## Implementation Phases

### Phase 1: Foundation (Claude Helper + Schemas)

**Goal**: Establish foundational utilities needed by all other components.

1. **Zod Schemas** (`packages/shared/`)
   - `OrchestrationConfigSchema` - modal configuration
   - `OrchestrationExecutionSchema` - full state tracking
   - `BatchItemSchema` - per-batch tracking
   - `ClaudeHelperOptionsSchema` - helper configuration
   - `ClaudeHelperResultSchema` - helper response

2. **Claude Helper Utility** (`claude-helper.ts`)
   - Typed function with Zod schema validation
   - Session management (new, resume, fork)
   - Model selection with fallback
   - Tool restrictions (read-only for decisions)
   - Budget enforcement
   - Error handling (timeout, validation failures)

### Phase 2: Core Services (State Machine + Batch Detection)

**Goal**: Implement orchestration logic independent of UI.

1. **Batch Parser** (`batch-parser.ts`)
   - Parse tasks.md for `##` sections
   - Identify incomplete tasks per section
   - Fall back to fixed-size batches
   - Return batch plan with task IDs

2. **Orchestration Service** (`orchestration-service.ts`)
   - State machine implementation
   - Dual confirmation pattern (state + process)
   - Step transitions (design → analyze → implement → verify)
   - State persistence to JSON
   - Decision logging
   - Integration with `specflow status --json`

3. **Auto-Healing Service** (`auto-healing-service.ts`)
   - Capture failure context (stderr, tasks)
   - Build healer prompt
   - Spawn healer via Claude Helper
   - Handle success/failure outcomes
   - Limit heal attempts per batch

### Phase 3: API Routes

**Goal**: Expose orchestration functionality via REST API.

1. **POST /api/workflow/orchestrate** - Start orchestration
   - Validate project exists
   - Check no existing orchestration
   - Parse batch plan
   - Create orchestration record
   - Start first step

2. **GET /api/workflow/orchestrate/status** - Get status
   - Return current orchestration state
   - Include progress, batches, decision log

3. **GET /api/workflow/orchestrate/list** - List orchestrations
   - Return all orchestrations for project
   - Include history (completed/failed)

4. **POST /api/workflow/orchestrate/cancel** - Cancel
   - Stop current execution
   - Update state to cancelled
   - Preserve state for debugging

5. **POST /api/workflow/orchestrate/resume** - Resume
   - Resume from paused state
   - Continue from next step/batch

6. **POST /api/workflow/orchestrate/merge** - Trigger merge
   - Only when status is "waiting_merge"
   - Start /flow.merge via workflow service

### Phase 4: UI Components

**Goal**: Build configuration modal and progress display.

1. **Configuration Modal** (`start-orchestration-modal.tsx`)
   - Core options section
   - Advanced options (collapsible)
   - Budget limits section
   - Batch count display
   - Start button with validation

2. **Progress Components**
   - `phase-progress-bar.tsx` - Design→Analyze→Implement→Verify→Merge
   - `batch-progress.tsx` - Current batch, task counts, progress bar
   - `decision-log-panel.tsx` - Collapsible log of decisions
   - `orchestration-controls.tsx` - Pause/Cancel buttons

3. **State Components**
   - `merge-ready-panel.tsx` - When paused at merge
   - `orchestration-badge.tsx` - For project cards

### Phase 5: Integration

**Goal**: Wire everything together in the dashboard.

1. **Project Detail Integration**
   - Add "Complete Phase" primary button
   - Transform to progress when active
   - Integrate with existing workflow actions

2. **Project Card Integration**
   - Add "Complete Phase" to menu (first, highlighted)
   - Reorganize "Run Workflow" as secondary
   - Show orchestration badge

3. **Hook Integration** (`use-orchestration.ts`)
   - Poll orchestration status
   - Handle state transitions
   - Trigger notifications

4. **Reconciliation**
   - Detect in-progress orchestrations on startup
   - Resume or mark as failed

## Data Flow

```
User clicks "Complete Phase"
         │
         ▼
┌──────────────────────┐
│ StartOrchestrationModal │
│ - Show config options   │
│ - Display batch count   │
└──────────┬──────────────┘
           │ user clicks Start
           ▼
POST /api/workflow/orchestrate
           │
           ▼
┌──────────────────────┐
│ OrchestrationService │
│ - Create state record │
│ - Detect batches      │
│ - Start first step    │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────┐
│ WorkflowService.start│  ← Existing service
│ - Spawn Claude CLI    │
│ - Return execution ID │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────┐
│ Polling Loop          │
│ - Check specflow status│
│ - Check process health │
│ - Wait for dual confirm│
└──────────┬──────────────┘
           │ step complete
           ▼
┌──────────────────────┐
│ OrchestrationService │
│ - Update state        │
│ - Log decision        │
│ - Start next step     │
└──────────┴──────────────┘
           │
         (repeat)
           │
           ▼
┌──────────────────────┐
│ Complete/Merge Ready │
└──────────────────────┘
```

## Error Handling

| Error | Detection | Recovery |
|-------|-----------|----------|
| Batch failure | Exit code != 0, incomplete tasks | Auto-heal (if enabled) |
| Heal failure | Healer exits with error | Stop, notify user with context |
| Budget exceeded | Cost tracking > limit | Stop current batch, notify |
| Process stale | No session file update > 5min | Mark stale, user intervention |
| State corruption | JSON parse failure | Rebuild from artifacts |
| Concurrent attempt | Existing orchestration check | Reject with error message |
| Dashboard restart | Reconciliation on startup | Resume or mark failed |

## Testing Strategy

1. **Unit Tests** (with memfs)
   - Batch parser: various tasks.md formats
   - State machine: all transitions
   - Claude Helper: schema validation, error handling

2. **Integration Tests**
   - Full orchestration flow (mocked Claude)
   - API routes with test fixtures
   - Reconciliation scenarios

3. **Manual Testing** (per USER GATE)
   - Start orchestration, observe batches
   - Introduce failure, observe healing
   - Dashboard restart, observe resume
   - Budget limits, observe stop

## Dependencies

- **Phase 1048**: Workflow Foundation (workflow-service.ts) - Complete
- **Phase 1050**: Workflow UI (skill picker, status badges) - Complete
- **Phase 1051**: Questions & Notifications (question handling) - Complete
- **Phase 1052**: Session Viewer (JSONL parsing) - Complete

All dependencies are complete. This phase builds on established patterns.

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Race conditions | Dual confirmation pattern (state + process) |
| Infinite heal loops | Max heal attempts per batch (default 1) |
| Cost runaway | Budget limits per batch/total/healing |
| Long orchestrations | State persistence, resume on restart |
| Context window limits | Batch-based execution |
