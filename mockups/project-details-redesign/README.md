# Project Details Page - UI Redesign Mockup

Interactive HTML mockup for the proposed project details page redesign.

## How to View

Open `index.html` in any modern browser. No build step or dependencies required.

```bash
open index.html
# or
python -m http.server 8000  # then visit http://localhost:8000
```

## Demo Controls

Use the controls in the top-right corner to simulate different states:

- **Workflow State**: Idle, Running, Waiting, Completed, Failed
- **Health Status**: Healthy, Warning, Error

## What to Review

### 1. Overview Tab (Default)

The simplified dashboard with state-driven quick actions.

**Key changes:**
- Only 2 main cards (Phase + Health) instead of 6
- Single "Quick Action" area that changes based on workflow state
- No redundant "Start Workflow" buttons
- Task progress integrated into Health card

**Test these states:**
- **Idle**: Shows "Start Workflow" dropdown
- **Running**: Shows "View Live Session" button
- **Waiting**: Shows pulsing "Answer Questions" button (modal auto-opens)
- **Completed**: Shows "Start Next Workflow" dropdown
- **Failed**: Shows alert bar + "View Error Details" button

### 2. Workflow Tab

The command center for all workflow activity.

**Key changes:**
- Session Viewer is INLINE (not a drawer)
- Session History is below the viewer
- Click a historical session to view its messages
- Follow-up input appears for historical sessions

**Test:**
- Switch to Workflow tab when Running state is active
- Click on a historical session to "load" it
- Try the follow-up message input

### 3. Tasks Tab

Simplified 2-column Kanban.

**Key changes:**
- **REMOVED** the "In Progress" column (never used)
- Just "To Do" and "Done"
- Collapsible "Done" section
- Click a task to see detail panel

**Test:**
- Click the collapse button on the "Done" column
- Click a "To Do" task to see the detail panel

### 4. History Tab

Interactive phase timeline.

**Key changes:**
- Click any phase to expand/collapse details
- Shows summary, key decisions, artifacts, sessions
- Per-phase cost tracking
- Links to archived artifacts

**Test:**
- Click on completed phases (0041, 0040, 0039) to expand
- Note the different information shown for current vs completed phases

### 5. Question Modal

Appears when workflow is in "Waiting" state.

**Key changes:**
- Modal overlay instead of side drawer (unmissable)
- Multi-question navigation (Previous/Next)
- "Other" option reveals custom input field
- Optional follow-up message

**Test:**
- Set workflow state to "Waiting" (modal auto-opens)
- Navigate between questions
- Select "Other" to see custom input
- Check the "Add follow-up message" checkbox

### 6. Header Simplification

**Key changes:**
- Removed "Start Workflow" button (in Overview Quick Action)
- Removed "Session" button (Workflow tab IS the viewer)
- Removed "Question" badge (in Quick Action + modal)
- Just: Status indicator + Actions menu (for maintenance only)

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single Quick Action | One obvious action per state reduces confusion |
| Inline Session Viewer | Avoids drawer that can be missed; makes workflow tab the "command center" |
| 2-column Kanban | "In Progress" column was never used; simpler is better |
| Expandable Phase History | Progressive disclosure - summary first, details on demand |
| Question Modal | Center-screen overlay is impossible to miss |
| Removed header buttons | Actions live in contextual locations, not scattered |

## Questions for Reviewers

1. Is the Quick Action area clear enough for each workflow state?
2. Does the inline Session Viewer work better than a drawer?
3. Is the History tab expansion pattern intuitive?
4. Are there any states or flows we're missing?
5. Should task detail show in a panel, drawer, or modal?
