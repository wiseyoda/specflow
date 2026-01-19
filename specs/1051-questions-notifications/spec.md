# Phase 1051 - Specification: Questions & Notifications

## Overview

Deliver an excellent question-answering UX with browser notifications for the SpecFlow workflow dashboard. When workflows need user input, users should be notified immediately and have a smooth experience answering questions.

## Requirements

### R1: Browser Notification Integration

**R1.1** - Request notification permission when user starts their first workflow
- Call `Notification.requestPermission()` before workflow begins
- Store permission result to avoid repeated prompts
- Gracefully handle denied permissions (no error, just no notifications)

**R1.2** - Show notification when questions are pending
- Trigger when workflow status changes to `waiting_for_input`
- Title: "{Project Name} Needs Your Input"
- Body: "Answer questions to continue workflow"
- Only show if window is not focused

**R1.3** - Notification click focuses dashboard
- Click handler calls `window.focus()`
- If on different page, navigate to project

### R2: Question Badge on Project Cards

**R2.1** - Yellow badge appears when questions pending
- Badge shows "?" icon with question count (e.g., "? 2")
- Positioned near project name or status badge
- Only visible when `status === 'waiting_for_input'`

**R2.2** - Badge is clickable
- On project card: Click navigates to project detail view
- On detail header (R3.1): Click opens question drawer

### R3: Question Badge in Project Detail Header

**R3.1** - Badge next to project name
- Same visual design as card badge
- Clickable to open question drawer

### R4: Question Drawer Panel

**R4.1** - Slide-in from right side
- Uses existing Sheet component
- Width: `sm:max-w-md` (slightly wider than output drawer)
- Header: "Questions" title with status indicator

**R4.2** - Question rendering
- Each question displays:
  - Header label (if present) as colored badge
  - Question text (prominent)
  - Options as radio buttons (single-select) or checkboxes (multi-select)
  - Text input if no options provided

**R4.3** - Answer state management
- Answers stored as `Record<string, string>`
- Key: `header` or `q${index}` fallback
- Multi-select: comma-separated values

**R4.4** - Submit button
- Disabled until all questions answered
- Loading state during submission
- Error handling with toast notification

**R4.5** - Drawer auto-opens when questions arrive
- If user is viewing project detail
- Always auto-opens (no configuration in this phase)

### R5: Free-form Follow-up Input

**R5.1** - Text area at bottom of drawer
- Placeholder: "Send a follow-up message (optional)"
- Distinct from structured answers
- Not required to submit

**R5.2** - Submit with follow-up
- Stored as `answers['_followup']`
- Included in answer submission
- Continues session with additional context

## Non-Requirements (Out of Scope)

- Sound/vibration alerts
- Notification settings UI
- Question history
- Answer editing after submission
- Rich text in questions
- Image/file upload answers

## Acceptance Criteria

1. Starting a workflow prompts for notification permission (once per browser)
2. Browser notification appears when workflow needs input (if permission granted)
3. Yellow question badge visible on project card in list view
4. Question badge visible in project detail header
5. Clicking badge opens question drawer
6. All question types render correctly (single-select, multi-select, free-text)
7. Submit button disabled until all questions answered
8. Successful submission continues workflow
9. Free-form follow-up text can be included with answers
10. Drawer closes after successful submission
