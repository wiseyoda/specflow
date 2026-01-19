# UI Design - Phase 1051: Questions & Notifications

## Components Overview

### QuestionBadge

**Location**: Project cards and detail header

**Visual Design**:
- Yellow background (`bg-yellow-100` / `bg-yellow-900/30`)
- "?" icon with question count
- Sizes: `sm` (cards) and `md` (header)
- Clickable with hover state

**Behavior**:
- On card: Click navigates to project detail
- On header: Click opens question drawer

### QuestionDrawer

**Location**: Slide-in panel from right side

**Visual Design**:
- Width: 500px (max-w-md)
- Header with "Questions" title and yellow icon
- Scrollable question area
- Footer with submit button

**Question Rendering**:
- Header label as blue badge
- Multi-select indicator as purple badge
- Question text (prominent)
- Options as radio/checkbox with label and description
- Text input for free-form questions

**States**:
- Default: Questions displayed
- Submitting: Button shows loading spinner
- Empty: "No questions pending" message

### FollowUpInput

**Location**: Bottom of question drawer

**Visual Design**:
- Text area with placeholder
- Below question list, separated by border
- Optional (not required to submit)

## User Flow

1. Workflow starts
2. Browser notification permission requested (first time only)
3. Workflow reaches question point
4. Browser notification appears (if not focused)
5. Yellow badge appears on project card
6. Drawer auto-opens on project detail page
7. User answers questions
8. Optionally adds follow-up text
9. Submits, drawer closes, toast confirms
10. Workflow continues

## Color Palette

| Element | Light | Dark |
|---------|-------|------|
| Badge BG | yellow-100 | yellow-900/30 |
| Badge Text | yellow-700 | yellow-400 |
| Header Label | blue-100 / blue-700 | blue-900/50 / blue-400 |
| Multi-select Tag | purple-100 / purple-700 | purple-900/50 / purple-400 |
| Option BG | white | neutral-800 |
| Option Border | neutral-200 | neutral-700 |
