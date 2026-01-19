# Discovery: Phase 1050 - Workflow UI Integration

> Codebase examination and clarified user intent for workflow UI integration.

**Phase**: 1050 - Workflow UI
**Date**: 2026-01-18
**PDR**: [workflow-dashboard-orchestration.md](../../.specify/memory/pdrs/workflow-dashboard-orchestration.md)

---

## Goal

Surface workflow execution in the main dashboard UI, allowing users to start and monitor `/flow.*` skills directly from project cards and detail views.

---

## Codebase Examination

### Existing Workflow Foundation (Phase 1048)

**Workflow Service** (`packages/dashboard/src/lib/services/workflow-service.ts`):
- Production workflow execution with state persistence (`~/.specflow/workflows/`)
- Claude CLI integration with JSON schema validation
- Multi-turn question/answer support via session resumption
- Process tracking for cancellation

**API Endpoints** (all at `/api/workflow/`):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/start` | POST | Start workflow (projectId, skill) |
| `/status?id=<id>` | GET | Poll execution status |
| `/list?projectId=<id>` | GET | List executions for project |
| `/answer` | POST | Submit answers, resume session |
| `/cancel?id=<id>` | POST | Terminate workflow |

**Data Structures** (Zod schemas):
```typescript
WorkflowExecution {
  id: string
  projectId: string
  skill: string
  status: 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'
  output?: WorkflowOutput
  answers: Record<string, string>
  logs: string[]
  stdout: string
  stderr: string
  error?: string
  costUsd: number
  startedAt: string
  updatedAt: string
  sessionId?: string
}

WorkflowQuestion {
  question: string
  header?: string
  options?: Array<{label, description}>
  multiSelect?: boolean
}
```

### Current UI Patterns

**Project Card** (`packages/dashboard/src/components/projects/project-card.tsx`):
- Displays phase, step status, task progress, last updated
- Two action buttons: `StatusButton` (secondary) and `ActionButton` (primary)
- Status badges for project states

**Action System** (`packages/dashboard/src/lib/action-definitions.ts`):
- 7 defined actions grouped by: setup, maintenance, advanced
- Each action has: id, label, description, command, confirmation settings
- `applicableStatuses` controls visibility
- `showOnCard` / `isSecondaryCardAction` for card placement

**Actions Menu** (`packages/dashboard/src/components/projects/actions-menu.tsx`):
- Dropdown of available actions grouped by category
- Confirmation dialog support
- Command execution via `/api/commands/execute`

**Project Detail Header** (`packages/dashboard/src/components/projects/project-detail-header.tsx`):
- Shows project name, path, breadcrumb
- Integrates `ActionsMenu` component

**Debug Page Reference** (`packages/dashboard/src/app/debug/workflow/page.tsx`):
- Working POC for question/answer UI
- Shows status polling, question rendering, answer submission

---

## Decisions Made

### 1. Skill Picker Design
**Decision**: Dropdown component with skill descriptions on hover
**Rationale**:
- 6 skills is manageable in a dropdown
- Descriptions help users understand each skill's purpose
- Consistent with existing action menu patterns

### 2. Start Workflow Entry Points
**Decision**: Both project card actions dropdown AND project detail header
**Rationale**:
- Card dropdown for quick access from list view
- Detail header for when viewing specific project
- Per PDR: "Both locations (per user preference)"

### 3. Status Badge States
**Decision**: Four states with distinct visual treatments
| State | Visual | Color |
|-------|--------|-------|
| Running | Spinner icon | Blue |
| Waiting for input | "?" badge | Yellow |
| Completed | Check icon (fades after 30s) | Green |
| Failed | X icon | Red |

**Rationale**: Clear, at-a-glance status without reading text

### 4. Polling vs Real-time
**Decision**: Use 3-second polling (same as POC)
**Rationale**:
- Proven reliable in POC
- Simpler than SSE/WebSocket
- Per PDR: "Polling (vs SSE) is sufficient for MVP"

### 5. Status Display Location
**Decision**: Badge on project card + sidebar section in project detail
**Rationale**:
- Card badge for list view visibility
- Detail sidebar for full context when focused on project

---

## Scope Boundaries

### In Scope
- Skill picker dropdown component
- Start workflow dialog with confirmation
- Status badge component for project cards
- Status section in project detail sidebar
- Integration with existing action system
- Polling-based status updates

### Out of Scope (Later Phases)
- Question drawer UI (Phase 1051)
- Browser notifications (Phase 1051)
- Session viewer panel (Phase 1052)
- Cost display on cards (Phase 1060)
- Orchestration state machine (Phase 1055)

---

## Technical Context

### shadcn/ui Components Available
- `DropdownMenu` - For skill picker
- `Dialog` - For start confirmation
- `Badge` - For status indicator
- `Button` - Action buttons
- `Card` - Status sidebar card
- `Select` - Alternative to dropdown

### Integration Points
1. **ProjectCard**: Add workflow status badge, integrate skill picker in actions
2. **ActionsMenu**: Add "Start Workflow" action with skill sub-menu
3. **ProjectDetailHeader**: Add workflow start button
4. **StatusView**: Add workflow status card section

### React Hook for Workflow State
```typescript
// Proposed: useWorkflowExecution hook
interface UseWorkflowExecution {
  execution: WorkflowExecution | null
  isRunning: boolean
  isWaiting: boolean
  start(skill: string): Promise<void>
  cancel(): Promise<void>
  refresh(): Promise<void>
}
```

---

## Files to Create/Modify

### New Components
| File | Purpose |
|------|---------|
| `WorkflowSkillPicker.tsx` | Dropdown to select skill |
| `StartWorkflowDialog.tsx` | Confirmation before starting |
| `WorkflowStatusBadge.tsx` | Status indicator for cards |
| `WorkflowStatusCard.tsx` | Status section for detail view |

### Modified Files
| File | Changes |
|------|---------|
| `project-card.tsx` | Add WorkflowStatusBadge, integrate skill picker |
| `actions-menu.tsx` | Add "Start Workflow" with sub-menu |
| `project-detail-header.tsx` | Add workflow start integration |
| `status-view.tsx` | Add WorkflowStatusCard section |

### New Hook
| File | Purpose |
|------|---------|
| `use-workflow-execution.ts` | Manage workflow state with polling |

---

## Questions Resolved

| Question | Answer | Source |
|----------|--------|--------|
| Where to place start buttons? | Both card dropdown and detail header | PDR |
| Which skills to show? | All 6 /flow.* skills | Phase file |
| How to handle updates? | 3-second polling | PDR |
| Status badge states? | 4 states per phase file | Phase file |
| Fade behavior? | Completed fades after 30s | Phase file |
