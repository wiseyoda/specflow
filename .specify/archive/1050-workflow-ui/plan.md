# Implementation Plan: Workflow UI Integration

**Branch**: `1050-workflow-ui` | **Date**: 2026-01-18 | **Spec**: [spec.md](spec.md)

---

## Summary

Add UI components to start and monitor workflow execution from the dashboard. Integrate with existing Phase 1048 workflow API. Create skill picker, confirmation dialog, status badges, and status card. Use polling for real-time updates.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode)
**Primary Dependencies**: Next.js 16, React 19, shadcn/ui, Tailwind CSS
**Storage**: N/A (uses existing workflow API persistence)
**Testing**: Vitest for unit tests
**Target Platform**: Web (desktop browsers)
**Project Type**: Monorepo (packages/dashboard)
**Performance Goals**: Status updates within 3 seconds
**Constraints**: No WebSocket/SSE (polling only per PDR)
**Scale/Scope**: Single project at a time (multi-project queue in Phase 1060)

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ Pass | UI surfaces existing API, easy to use |
| IIa. TypeScript for CLI Packages | N/A | Dashboard, not CLI |
| III. CLI Over Direct Edits | ✅ Pass | Uses API routes, not file edits |
| IV. Simplicity Over Cleverness | ✅ Pass | Standard React patterns, shadcn/ui |
| V. Helpful Error Messages | ✅ Pass | Toast notifications for all errors |
| VI. Graceful Degradation | ✅ Pass | Works without active workflow |
| VII. Three-Line Output Rule | N/A | UI, not CLI output |

---

## Project Structure

### Documentation (this feature)

```text
specs/1050-workflow-ui/
├── discovery.md         # Codebase examination
├── spec.md              # Feature specification
├── requirements.md      # Requirements checklist
├── ui-design.md         # Visual mockups
├── plan.md              # This file
├── tasks.md             # Task list
└── checklists/
    ├── implementation.md
    └── verification.md
```

### Source Code

```text
packages/dashboard/
├── src/
│   ├── components/
│   │   └── projects/
│   │       ├── project-card.tsx           # Modify: add badge
│   │       ├── actions-menu.tsx           # Modify: add skill picker
│   │       ├── project-detail-header.tsx  # Modify: add workflow button
│   │       ├── status-view.tsx            # Modify: add status card
│   │       ├── workflow-status-badge.tsx  # NEW
│   │       ├── workflow-skill-picker.tsx  # NEW
│   │       ├── start-workflow-dialog.tsx  # NEW
│   │       └── workflow-status-card.tsx   # NEW
│   ├── hooks/
│   │   └── use-workflow-execution.ts      # NEW
│   └── lib/
│       └── workflow-skills.ts             # NEW: skill definitions
└── tests/
    └── hooks/
        └── use-workflow-execution.test.ts # NEW
```

---

## Implementation Approach

### Phase 1: Foundation (Hook + Skills)

Create the data layer before UI components.

1. **Skill definitions** (`lib/workflow-skills.ts`)
   - Define 6 skills with name, description, command
   - Export as typed constant array

2. **Workflow execution hook** (`hooks/use-workflow-execution.ts`)
   - Fetch current workflow status for project
   - Polling logic (3s interval when active)
   - Start, cancel, refresh methods
   - Auto-stop polling on terminal states

### Phase 2: Components

Build UI components using foundation.

3. **Status badge** (`workflow-status-badge.tsx`)
   - 4 states: running, waiting, completed, failed
   - Icons + colors per state
   - Fade animation for completed state

4. **Skill picker** (`workflow-skill-picker.tsx`)
   - DropdownMenuSub from shadcn/ui
   - List all 6 skills with descriptions
   - Hover to see full description

5. **Start dialog** (`start-workflow-dialog.tsx`)
   - Confirmation before starting
   - Shows skill name and project
   - Start button with loading state

6. **Status card** (`workflow-status-card.tsx`)
   - Full status display for detail view
   - Skill, status, elapsed time
   - Cancel button

### Phase 3: Integration

Wire components into existing UI.

7. **Project card integration**
   - Add WorkflowStatusBadge next to project name
   - Add WorkflowSkillPicker to ActionsMenu

8. **Actions menu integration**
   - Add "Start Workflow" as top-level item with sub-menu
   - Position at top of menu (primary action)

9. **Project detail integration**
   - Add dedicated Start Workflow button in header
   - Add WorkflowStatusCard to StatusView

---

## API Integration

### Existing Endpoints (Phase 1048)

| Endpoint | Method | Usage |
|----------|--------|-------|
| `/api/workflow/start` | POST | Start workflow with projectId + skill |
| `/api/workflow/status?id=<id>` | GET | Poll execution status |
| `/api/workflow/list?projectId=<id>` | GET | Get active workflow for project |
| `/api/workflow/cancel?id=<id>` | POST | Cancel running workflow |

### Hook API

```typescript
interface UseWorkflowExecution {
  execution: WorkflowExecution | null
  isLoading: boolean
  isRunning: boolean
  isWaiting: boolean
  error: Error | null

  start(skill: string): Promise<void>
  cancel(): Promise<void>
  refresh(): Promise<void>
}

function useWorkflowExecution(projectId: string): UseWorkflowExecution
```

---

## State Management

### Polling Logic

```
On mount:
  1. Fetch /api/workflow/list?projectId=X
  2. If active execution exists, start polling
  3. Poll every 3 seconds

On status change:
  - If terminal state (completed, failed, cancelled): stop polling
  - If running/waiting: continue polling

On unmount:
  - Clear polling interval
```

### Completed State Fade

```
When status changes to "completed":
  1. Show green badge immediately
  2. Start 30s timer
  3. After 30s, fade badge (CSS opacity transition)
  4. After fade complete, hide badge
```

---

## Dependencies

### Phase 1048 (Required)
- WorkflowService with start/status/cancel
- API routes at /api/workflow/*
- WorkflowExecution type definitions

### shadcn/ui Components
- DropdownMenu / DropdownMenuSub (skill picker)
- Dialog (confirmation)
- Badge (status indicator)
- Button (actions)
- Card (status card)
- Spinner/Loader (loading states)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Polling too frequent | Fixed 3s interval, stop on terminal state |
| Race condition on start | Disable button during start, re-fetch after |
| Stale status on navigation | Refresh on focus/mount |
| Multiple workflows started | Check for existing before start, show error toast |
