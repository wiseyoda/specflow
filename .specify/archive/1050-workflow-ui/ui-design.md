# UI/UX Design: Workflow UI Integration

**Phase**: 1050
**Created**: 2026-01-18
**Status**: Draft

---

## Current State (Before)

### Project Card
```
┌─────────────────────────────────────────────────────────────────┐
│ Project Name                                          [Actions ▼]│
│ /path/to/project                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase: 0042 - feature-name                                       │
│ Step: implement ████████░░░░ 65%                                 │
│ Last updated: 2 hours ago                                        │
├─────────────────────────────────────────────────────────────────┤
│ [Status]                                     [Primary Action]    │
└─────────────────────────────────────────────────────────────────┘
```

Actions dropdown contains: Check, Check & Fix, Sync State, etc.
No workflow-related actions or status indicators.

### Project Detail Header
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Projects                                              │
│                                                                 │
│ Project Name                                         [Actions ▼]│
│ /path/to/project                                                │
└─────────────────────────────────────────────────────────────────┘
```

Same actions menu as card, no dedicated workflow button.

---

## Proposed Design (After)

### Project Card with Workflow Status Badge
```
┌─────────────────────────────────────────────────────────────────┐
│ Project Name                                 [🔄 Running][Actions ▼]│
│ /path/to/project                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase: 0042 - feature-name                                       │
│ Step: implement ████████░░░░ 65%                                 │
│ Last updated: 2 hours ago                                        │
├─────────────────────────────────────────────────────────────────┤
│ [Status]                                     [Primary Action]    │
└─────────────────────────────────────────────────────────────────┘

Status Badge States:
[🔄 Running]  - Blue background, spinner icon, "Running" text
[❓ Waiting]  - Yellow background, ? icon, "Needs Input" text
[✓ Complete]  - Green background, check icon (fades after 30s)
[✗ Failed]    - Red background, X icon
```

### Actions Menu with Workflow Sub-menu
```
┌─────────────────────────────┐
│ Start Workflow            ▶ │ ─────┐
├─────────────────────────────┤      │
│ Setup                       │      ▼
│   Initialize               │   ┌────────────────────────────┐
│   Sync State               │   │ /flow.design               │
├─────────────────────────────┤   │ Create all design artifacts│
│ Maintenance                 │   ├────────────────────────────┤
│   Check                    │   │ /flow.analyze              │
│   Check & Fix              │   │ Cross-artifact analysis    │
└─────────────────────────────┘   ├────────────────────────────┤
                                  │ /flow.implement            │
                                  │ Execute tasks with TDD     │
                                  ├────────────────────────────┤
                                  │ /flow.verify               │
                                  │ Verify completion          │
                                  ├────────────────────────────┤
                                  │ /flow.orchestrate          │
                                  │ Full workflow automation   │
                                  ├────────────────────────────┤
                                  │ /flow.merge                │
                                  │ Complete and merge phase   │
                                  └────────────────────────────┘
```

### Confirmation Dialog
```
┌─────────────────────────────────────────────────────────────────┐
│                     Start Workflow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You're about to start:                                         │
│                                                                 │
│  Skill: /flow.design                                            │
│  Project: my-project                                            │
│                                                                 │
│  This will:                                                     │
│  • Begin an AI-assisted workflow session                        │
│  • May ask questions that require your input                    │
│  • Create or modify project artifacts                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Start Workflow]         │
└─────────────────────────────────────────────────────────────────┘
```

### Project Detail Header with Workflow Button
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Projects                                              │
│                                                                 │
│ Project Name              [🔄 Running] [Start Workflow ▼][Actions ▼]│
│ /path/to/project                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Status Card (in Status View)
```
┌─────────────────────────────────────────────────────────────────┐
│ Workflow Status                                        [🔄 Active]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Skill:    /flow.design                                         │
│  Status:   Running                                              │
│  Elapsed:  3m 42s                                               │
│                                                                 │
│  ─────────────────────────────────────────                      │
│                                                                 │
│                                    [Cancel Workflow]            │
└─────────────────────────────────────────────────────────────────┘

When no workflow active:
┌─────────────────────────────────────────────────────────────────┐
│ Workflow Status                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  No active workflow                                             │
│                                                                 │
│                                    [Start Workflow]             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rationale

- **Why status badge on card?** Users need at-a-glance visibility of which projects have active workflows without clicking into each one. The badge is small but distinctive.

- **Why sub-menu for skills?** 6 skills is too many for a flat list in the main dropdown. Sub-menu keeps the main menu clean while providing descriptions on hover.

- **Why confirmation dialog?** Workflows can be long-running and consume resources. Users should consciously confirm before starting.

- **Why dedicated Start Workflow button in detail header?** It's the primary action users want when viewing project details. Having it visible (not buried in dropdown) increases discoverability.

- **User flow:**
  1. User sees project card → notices workflow badge OR clicks Actions
  2. Selects "Start Workflow" → sees skill picker with descriptions
  3. Selects skill → sees confirmation dialog
  4. Confirms → workflow starts, badge appears

- **Accessibility considerations:**
  - Status badges use both color AND icon (not color alone)
  - Badge has aria-label describing full status
  - Dialog is keyboard-navigable with focus trap
  - Skill descriptions visible on keyboard focus, not just hover

---

## Component Inventory

| Component | Type | Purpose | Notes |
|-----------|------|---------|-------|
| WorkflowStatusBadge | Badge | Shows workflow state on cards | 4 states with icons |
| WorkflowSkillPicker | DropdownMenu | Select which skill to run | 6 skills with descriptions |
| StartWorkflowDialog | Dialog | Confirm before starting | Shows skill + project |
| WorkflowStatusCard | Card | Full status in detail view | Shows skill, status, time |
| useWorkflowExecution | Hook | Manage workflow state | Polling, start, cancel |

---

## Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Open skill picker | Click "Start Workflow" in actions | Sub-menu appears with 6 skills |
| Select skill | Click skill in sub-menu | Confirmation dialog opens |
| Confirm start | Click "Start Workflow" in dialog | Dialog closes, API called, badge appears |
| Cancel dialog | Click "Cancel" or press Escape | Dialog closes, no action |
| Cancel workflow | Click "Cancel Workflow" in status card | Confirmation toast, workflow cancelled |
| View status | Navigate to project detail | Status card shows current workflow |

---

## Design Constraints

- Must work within existing project card layout (no height changes)
- Must integrate with existing ActionsMenu component
- Polling must not cause visible UI jitter
- Badge fade animation must be smooth (CSS transition)
- Sub-menu must not overflow viewport on small screens

---

## Open Questions

- [x] Should badge show skill name? → No, just status icon (space constraint)
- [x] Where exactly does badge go on card? → Next to project name, before Actions
- [x] Should "Start Workflow" be its own button or in dropdown? → Dropdown on card, button on detail
