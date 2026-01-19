# Phase 1051 - Implementation Plan: Questions & Notifications

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Question Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Workflow Status Change                                      │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │  Notification   │────▶│  Browser        │                │
│  │  Library        │     │  Notification   │                │
│  └─────────────────┘     └─────────────────┘                │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │  QuestionBadge  │────▶│  QuestionDrawer │                │
│  │  (card/header)  │     │  (slide-in)     │                │
│  └─────────────────┘     └─────────────────┘                │
│                                 │                            │
│                                 ▼                            │
│                          ┌─────────────────┐                │
│                          │  FollowUpInput  │                │
│                          │  (optional)     │                │
│                          └─────────────────┘                │
│                                 │                            │
│                                 ▼                            │
│                          ┌─────────────────┐                │
│                          │  submitAnswers  │                │
│                          │  API call       │                │
│                          └─────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase A: Notification Infrastructure

**A1. Create notifications.ts library**
- File: `packages/dashboard/src/lib/notifications.ts`
- Functions:
  - `requestNotificationPermission()` - Async, returns boolean
  - `showQuestionNotification(projectName)` - Shows notification
  - `isNotificationSupported()` - Check browser support
  - `isNotificationEnabled()` - Check if granted
- Handle edge cases: Safari, denied permissions, HTTPS requirement

**A2. Integrate notification permission request**
- File: `packages/dashboard/src/hooks/use-workflow-execution.ts`
- On first `start()` call, request permission
- Store "hasRequestedPermission" in localStorage

**A3. Trigger notifications on status change**
- Track previous status in a ref (e.g., `previousStatusRef`)
- On poll: compare new status to previous; detect transition to `waiting_for_input`
- Call `showQuestionNotification()` only on transition AND if window not focused
- Update ref after comparison

### Phase B: Question Badge Component

**B1. Create QuestionBadge component**
- File: `packages/dashboard/src/components/projects/question-badge.tsx`
- Props: `questionCount`, `onClick`, `size`
- Visual: Yellow background, "?" icon, count
- Sizes: `sm` (for cards), `md` (for header)

**B2. Add badge to ProjectCard**
- File: `packages/dashboard/src/components/projects/project-card.tsx`
- Condition: `execution?.status === 'waiting_for_input'`
- Position: Next to status badge or project name
- Click: Navigate to project detail

**B3. Add badge to ProjectDetailHeader**
- File: `packages/dashboard/src/components/projects/project-detail-header.tsx`
- Same condition, click opens drawer
- Pass drawer state setter as prop

### Phase C: Question Drawer Component

**C1. Create QuestionDrawer component**
- File: `packages/dashboard/src/components/projects/question-drawer.tsx`
- Props: `open`, `onOpenChange`, `execution`, `onSubmit`
- Structure:
  - Header: Title, close button
  - Content: ScrollArea with questions
  - Footer: Submit button

**C2. Implement question rendering**
- Extract patterns from `debug/workflow/page.tsx`
- Render based on question type:
  - `options + !multiSelect` → RadioGroup
  - `options + multiSelect` → Checkbox group
  - `no options` → Textarea
- Header labels as badges

**C3. Implement answer state management**
- Local state: `answers: Record<string, string>`
- Validation: Check all questions have answers
- Submit: Call `onSubmit(answers)`

**C4. Create FollowUpInput component**
- File: `packages/dashboard/src/components/projects/follow-up-input.tsx`
- Props: `value`, `onChange`
- Textarea with placeholder
- Below question list

### Phase D: Integration

**D1. Integrate drawer into StatusView**
- File: `packages/dashboard/src/components/projects/status-view.tsx`
- Add drawer state: `isDrawerOpen`
- Auto-open when `waiting_for_input` detected
- Pass `submitAnswers` from hook

**D2. Wire up badge clicks**
- Card badge: Open project detail (existing navigation)
- Header badge: Open question drawer
- Pass callbacks through component tree

**D3. Handle submission flow**
- On submit: Show loading state
- On success: Close drawer, toast notification
- On error: Show error, keep drawer open

## Component Props Reference

```typescript
// QuestionBadge
interface QuestionBadgeProps {
  questionCount: number
  onClick?: () => void
  size?: 'sm' | 'md'
  className?: string
}

// QuestionDrawer
interface QuestionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  execution: WorkflowExecution | null
  onSubmit: (answers: Record<string, string>) => Promise<void>
}

// FollowUpInput
interface FollowUpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/notifications.ts` | Create | Browser Notification API wrapper |
| `components/projects/question-badge.tsx` | Create | Badge component |
| `components/projects/question-drawer.tsx` | Create | Drawer component |
| `components/projects/follow-up-input.tsx` | Create | Text input component |
| `components/projects/project-card.tsx` | Modify | Add QuestionBadge |
| `components/projects/project-detail-header.tsx` | Modify | Add QuestionBadge |
| `components/projects/status-view.tsx` | Modify | Add QuestionDrawer |
| `hooks/use-workflow-execution.ts` | Modify | Add notification triggers |

## Dependencies

- Existing: Sheet, ScrollArea, RadioGroup, Checkbox (all from shadcn/ui)
- No new npm packages required

## Testing Strategy

1. **Unit tests** for notification library functions
2. **Component tests** for QuestionBadge rendering
3. **Integration tests** for drawer open/close behavior
4. **Manual testing** for browser notification permissions
