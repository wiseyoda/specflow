# Phase 1051 - Discovery: Questions & Notifications

## Codebase Examination

### Existing Infrastructure

**API & State Management (Ready)**
- `GET /api/workflow/status?id=<id>` - Returns full `WorkflowExecution`
- `POST /api/workflow/answer` - Body: `{ id, answers }` - Submits answers
- `use-workflow-execution.ts` - Hook with `submitAnswers(answers)` method
- `WorkflowExecution.status === 'waiting_for_input'` indicates questions pending
- `WorkflowExecution.output.questions[]` contains pending questions

**Question Data Structure (Defined)**
```typescript
interface WorkflowQuestion {
  question: string           // Main question text
  header?: string            // Label (max 12 chars)
  options?: Array<{          // For single/multi-select
    label: string
    description: string
  }>
  multiSelect?: boolean      // Single vs. multi-select
}
```

**UI Patterns (Available)**
- `Sheet.tsx` - Radix UI drawer with right-side slide animation
- `OutputDrawer.tsx` - Template for drawer layout (header/content/footer)
- `WorkflowStatusBadge.tsx` - Shows `waiting_for_input` as yellow "?" badge
- `debug/workflow/page.tsx` - POC question rendering with all patterns

**Phase 1050 Foundation**
- Workflow start from project cards and detail header
- Status badge rendering for all states
- Auto-polling during active workflows
- `WorkflowStatusCard` showing elapsed time and actions

### Key Files to Extend

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `project-card.tsx` | Project list cards | Add QuestionBadge, drawer state |
| `project-detail-header.tsx` | Detail page header | Add QuestionBadge |
| `status-view.tsx` | Workflow status display | Import QuestionDrawer |
| `use-workflow-execution.ts` | Workflow hook | Add notification triggers |

### Key Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `components/projects/question-badge.tsx` | Yellow badge with count | 40 |
| `components/projects/question-drawer.tsx` | Slide-out question panel | 180 |
| `components/projects/follow-up-input.tsx` | Free-form text input | 50 |
| `lib/notifications.ts` | Browser Notification API wrapper | 80 |

## Clarified Intent

**What users need:**
1. Be notified immediately when workflows need input (even if not watching the dashboard)
2. See at a glance which projects have pending questions
3. Answer questions quickly in a focused UI
4. Optionally send free-form text to clarify or provide context

**UX Flow:**
1. User starts workflow on project
2. Workflow runs, reaches question point
3. Dashboard detects `waiting_for_input` status
4. Browser notification appears (if permission granted)
5. Yellow question badge appears on project card
6. User clicks badge or notification
7. Question drawer slides in from right
8. User answers questions (radio/checkbox/text)
9. Optionally adds follow-up text
10. Submits, workflow continues

## Design Decisions

### Notification Permission Timing
**Decision**: Request on first workflow start
**Rationale**: Predictable timing, before user is waiting for results

### Drawer Auto-Open Behavior
**Decision**: Auto-open when questions arrive, also show notification
**Rationale**: Better UX - user doesn't miss questions if watching dashboard

### Answer Key Strategy
**Decision**: Use `header` if present, fallback to `q${index}`
**Rationale**: Matches POC implementation, consistent with API expectations

### Multi-Select Serialization
**Decision**: Comma-separated string (e.g., `"option1,option2"`)
**Rationale**: Matches existing answer API format

### Follow-up Message Key
**Decision**: Use `_followup` as special key in answers
**Rationale**: Clear distinction from structured answers, simple implementation

## Integration Points

1. **ProjectCard**: QuestionBadge next to status badge
2. **ProjectDetailHeader**: QuestionBadge next to project name
3. **StatusView**: QuestionDrawer controlled component
4. **useWorkflowExecution**: Notification trigger on status change

## Technical Constraints

- Browser Notification API requires HTTPS in production
- Notification.permission states: "default", "granted", "denied"
- Cannot re-prompt if user denied (browser limitation)
- Drawer must handle varying question counts gracefully
