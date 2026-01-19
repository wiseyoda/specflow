# UI/UX Design: Session Viewer

**Phase**: 1052
**Created**: 2026-01-19
**Status**: Draft

---

## Current State (Before)

The project detail page has:
- Header with project name, back button, and workflow controls
- WorkflowStatusBadge showing current execution status
- QuestionBadge and QuestionDrawer for answering questions
- No visibility into actual Claude session activity

Users cannot see what Claude is doing during workflow execution.

---

## Proposed Design (After)

Add a "Session" button to the project header that opens a slide-out panel showing real-time session messages.

### Visual Mockup - Header with Session Button

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back   My Project                                                │
│           /Users/dev/my-project                                     │
│                                                                     │
│  [Status Badge: Running]  [? Questions: 2]  [📜 Session]  [⋮ Menu] │
└─────────────────────────────────────────────────────────────────────┘
```

### Visual Mockup - Session Viewer Panel (Open)

```
┌────────────────────────────────────────────┬─────────────────────────┐
│  Project Detail (Main Content)             │  Session Viewer         │
│                                            │  ─────────────────────  │
│  ┌──────────────────────────────────────┐  │  Session: abc123...     │
│  │                                      │  │  Elapsed: 3m 42s        │
│  │                                      │  │  Files Modified: 5      │
│  │  (Status/Kanban/Timeline tabs)       │  │  ─────────────────────  │
│  │                                      │  │                         │
│  │                                      │  │  ┌─────────────────────┐│
│  │                                      │  │  │ User                ││
│  │                                      │  │  │ Run the build and   ││
│  │                                      │  │  │ fix any errors      ││
│  │                                      │  │  └─────────────────────┘│
│  │                                      │  │  ┌─────────────────────┐│
│  │                                      │  │  │ Claude       2:34pm ││
│  │                                      │  │  │ I'll start by       ││
│  │                                      │  │  │ running the build   ││
│  │                                      │  │  │ command...          ││
│  │                                      │  │  └─────────────────────┘│
│  │                                      │  │  ┌─────────────────────┐│
│  │                                      │  │  │ Claude       2:35pm ││
│  │                                      │  │  │ Found 3 type errors.││
│  │                                      │  │  │ Let me fix them...  ││
│  │                                      │  │  └─────────────────────┘│
│  │                                      │  │                    ↓    │
│  └──────────────────────────────────────┘  │  [Auto-scroll: ON]      │
│                                            │                         │
└────────────────────────────────────────────┴─────────────────────────┘
```

### Visual Mockup - Message Styling

```
User Messages:
┌─────────────────────────────────────────────────────────────────────┐
│  [User icon]  User                                                  │
│  ───────────────────────────────────────────────────────────────    │
│  Run the build and fix any type errors                              │
└─────────────────────────────────────────────────────────────────────┘
Background: bg-blue-950/50 (subtle blue)
Border: border-l-2 border-blue-500

Claude Messages:
┌─────────────────────────────────────────────────────────────────────┐
│  [Bot icon]  Claude                                    2:34 PM      │
│  ───────────────────────────────────────────────────────────────    │
│  I'll start by running the build command to identify the errors.    │
│  Looking at the project structure, I can see this uses TypeScript   │
│  with tsconfig.json at the root...                                  │
└─────────────────────────────────────────────────────────────────────┘
Background: bg-neutral-900 (dark gray)
Border: none

No Session State:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                         [Folder icon]                               │
│                                                                     │
│                      No Active Session                              │
│                                                                     │
│         Start a workflow to see session activity here               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Rationale

- **Why slide-out panel?** Keeps project context visible while viewing session. Follows established QuestionDrawer pattern.
- **Why header button?** Always accessible, doesn't require tab navigation. Consistent with other header controls.
- **Why right-side panel?** Established pattern in codebase (QuestionDrawer). Screen-read flow: main content first, then session detail.
- **Why 500px width?** Matches QuestionDrawer. Enough space for readable messages without overwhelming main content.
- **User flow:** Click button → Panel slides in → Messages stream → Scroll to review → Click outside to close
- **Accessibility considerations:**
  - Button has aria-label for screen readers
  - Panel is focusable, can be closed with Escape
  - Auto-scroll can be paused for users who need time to read
  - Color contrast meets WCAG AA standards

---

## Component Inventory

| Component | Type | Purpose | Notes |
|-----------|------|---------|-------|
| SessionButton | Button (icon) | Opens session viewer | In project header, uses Terminal icon |
| SessionViewerDrawer | Sheet (panel) | Container for session content | 500px width, right-side slide |
| SessionHeader | Header | Shows session info and metrics | Session ID, elapsed time, files modified |
| SessionMessageList | ScrollArea | Scrollable list of messages | Auto-scroll with pause detection |
| SessionMessage | Card | Individual message display | Styled by role (user/assistant) |
| SessionEmptyState | Empty state | Shows when no session | Icon + helpful text |
| SessionErrorState | Error state | Shows when file lookup fails | Error message + troubleshooting |

---

## Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Open session viewer | Click Session button | Panel slides in from right (300ms animation) |
| Close session viewer | Click outside, press Escape, or click X | Panel slides out |
| Auto-scroll | New messages arrive while scrolled to bottom | Scroll to show newest message |
| Pause auto-scroll | User scrolls up | Auto-scroll stops, indicator shows "Auto-scroll: OFF" |
| Resume auto-scroll | User scrolls to bottom | Auto-scroll resumes, indicator shows "Auto-scroll: ON" |
| Poll for updates | Automatic every 3s | Fetch new messages if session is active |
| Stop polling | Session completes/fails | Polling stops, status indicator updates |

---

## Design Constraints

- Panel width fixed at 500px (matches QuestionDrawer)
- Messages limited to ~100 for performance (tail mode)
- Polling interval is 3 seconds (matches workflow status polling)
- Tool calls are not displayed (user preference)
- Dark theme only (consistent with dashboard)

---

## Open Questions

- None - all design questions resolved during discovery
