# UI/UX Design: Workflow-Session Unification

**Phase**: 1053
**Created**: 2026-01-19
**Status**: Draft

---

## Current State (Before)

The Session Viewer drawer exists but has issues:
1. Session detection relies on polling `sessions-index.json` with race conditions
2. No session history list - only shows "current" session
3. No way to view past sessions or select which session to display
4. Session ID sometimes missing or pointing to wrong session

**Current Project Detail Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Project: my-app                      [Start Workflow ▼] [⚙️]    │
├─────────────────────────────────────────────────────────────────┤
│ Status │ Progress │ Questions │ Session                         │
│        │          │           │  (drawer button)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Project detail content...                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proposed Design (After)

Add a Sessions section in project detail that lists past workflow sessions. Clicking any session opens the Session Viewer drawer showing that specific session.

### Visual Mockup - Project Detail with Sessions Section

```
┌─────────────────────────────────────────────────────────────────┐
│ Project: my-app                      [Start Workflow ▼] [⚙️]    │
├─────────────────────────────────────────────────────────────────┤
│ Status │ Progress │ Questions │ Sessions                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ## Sessions                                                    │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ 🟢 abc123 │ /flow.orchestrate │ running    │ 2m ago │ $0.42 │◄─ Active
│  ├─────────────────────────────────────────────────────────────┤
│  │ ○  def456 │ /flow.design      │ completed  │ 1h ago │ $0.18 │
│  ├─────────────────────────────────────────────────────────────┤
│  │ ○  ghi789 │ /flow.implement   │ completed  │ 2h ago │ $1.24 │
│  ├─────────────────────────────────────────────────────────────┤
│  │ ○  jkl012 │ /flow.design      │ failed     │ 3h ago │ $0.08 │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Mockup - Session Viewer Drawer (Updated)

```
┌─────────────────────────────────────────────────────┐
│ 🖥️ Session Viewer                               ✕   │
│ Session: abc123                                     │
│ Skill: /flow.orchestrate                            │
├─────────────────────────────────────────────────────┤
│ ⏱️ 2m 34s  │  📄 5 files  │  🟢 Live                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [User] Run /flow.orchestrate                       │
│                                                     │
│  [Assistant] Starting orchestration for phase       │
│  1053-workflow-session-unification...               │
│                                                     │
│  [User] Continue                                    │
│                                                     │
│  [Assistant] Creating design artifacts...           │
│                                                     │
│  ... (messages scroll)                              │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 15 messages                    Auto-scroll: ON      │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ Send follow-up message...                       │ │
│ └─────────────────────────────────────────────────┘ │
│                                          [Send →]   │
└─────────────────────────────────────────────────────┘
```

### Visual Mockup - Session Pending State

When workflow just started and session ID not yet available:

```
┌─────────────────────────────────────────────────────┐
│ 🖥️ Session Viewer                               ✕   │
│ Session: pending...                                 │
│ Skill: /flow.orchestrate                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│           ⏳                                        │
│     Waiting for session...                          │
│                                                     │
│     Session ID will appear once Claude              │
│     responds to the first prompt.                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Rationale

- **Why a sessions list?** Users need to see all past sessions, not just the current one. This enables debugging, review, and resumption of any session.
- **Why explicit session selection?** Eliminates race conditions from auto-detection. User clicks exactly what they want to see.
- **Active indicator (🟢):** Clearly distinguishes running sessions from completed ones.
- **Cost column:** Users want to see session costs at a glance (per PDR).
- **Session pending state:** Graceful handling of the brief period between workflow start and first CLI response.

---

## Component Inventory

| Component | Type | Purpose | Notes |
|-----------|------|---------|-------|
| SessionHistoryList | Table | List all sessions for a project | New component |
| SessionHistoryRow | Row | Single session with click handler | Opens drawer |
| SessionStatusIndicator | Badge | Show running/completed/failed | Reuse WorkflowStatusBadge |
| SessionViewerDrawer | Drawer | Display session messages | Existing, updated props |
| SessionPendingState | Placeholder | Show while awaiting session ID | New component |

---

## Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| View session | Click row in SessionHistoryList | Opens SessionViewerDrawer with that session |
| View active session | Click active row (🟢) | Opens drawer with live updates enabled |
| Send follow-up | Type + click Send in drawer | Creates new workflow with `--resume sessionId` |
| Close drawer | Click X or outside | Drawer closes, returns to project detail |
| Auto-scroll toggle | Click toggle button | Enables/disables auto-scroll on new messages |

---

## Design Constraints

- **Mobile-first not required:** Dashboard is desktop-only per tech-stack.md
- **Consistent with existing UI:** Use shadcn/ui components (Sheet, Table, Badge)
- **Dark mode:** System-aware theme switching (existing)
- **Session limit:** Show last 50 sessions max to avoid performance issues

---

## Open Questions

None - design aligns with phase file and PDR requirements.
