# UI/UX Design: Smart Batching & Orchestration

**Phase**: 1055
**Created**: 2026-01-21
**Status**: Final

---

## Current State (Before)

### Project Detail Workflow Actions

Currently, the project detail page has a workflow actions area with several buttons:

```
┌─────────────────────────────────────────────────────────────┐
│ Workflow Actions                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │Orchestrate│  │  Merge   │  │  Review  │  │  Memory  │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

All buttons are equally styled, no clear primary action. Users must know which skill to run.

### Project Card Actions Menu

```
┌─────────────────────────┐
│ ▷ Start Workflow      → │──┬─ Design
├─────────────────────────┤  ├─ Analyze
│ 🔧 Maintenance            │  ├─ Implement
│   Status                  │  ├─ Orchestrate
│   Validate                │  ├─ Verify
└─────────────────────────┘  └─ Merge
```

"Start Workflow" shows all skills equally, requiring user to know which to run.

---

## Proposed Design (After)

### Project Detail Workflow Actions

```
┌─────────────────────────────────────────────────────────────┐
│  ◈ Complete Phase                                        →  │
│  Automatically execute all steps to complete phase          │
└─────────────────────────────────────────────────────────────┘

   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │Orchestrate│  │  Merge   │  │  Review  │  │  Memory  │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**"Complete Phase"** is the primary action:
- Larger, more prominent than secondary buttons
- Gradient or accent color background (purple/blue)
- Icon: stacked layers (◈) suggesting multiple phases
- Subtitle explaining what it does
- Arrow (→) indicating it opens modal

Secondary buttons remain for manual skill execution.

### Configuration Modal

```
┌──────────────────────────────────────────────────────────────────┐
│                    Complete Phase                            [×] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1055: Smart Batching & Orchestration                      │
│  Detected 4 batches from tasks.md                                │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  CORE OPTIONS                                                    │
│                                                                  │
│  [○] Auto-merge on completion                                    │
│      Automatically run /flow.merge after verify succeeds         │
│                                                                  │
│  [○] Skip design                                                 │
│      Skip /flow.design if specs already exist                    │
│                                                                  │
│  [○] Skip analyze                                                │
│      Skip /flow.analyze step                                     │
│                                                                  │
│  Additional context:                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │ (optional text injected into all skill prompts)         │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  ▶ ADVANCED OPTIONS                                              │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│                          [ Start Orchestration ]                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Advanced Options (collapsed by default):**

```
│  ▼ ADVANCED OPTIONS                                              │
│                                                                  │
│  [●] Auto-heal enabled                                           │
│      Attempt automatic recovery on batch failure                 │
│                                                                  │
│  Max heal attempts:  [ 1 ▼]                                      │
│      Retry limit per batch (prevents infinite loops)             │
│                                                                  │
│  Batch size fallback:  [ 15 ▼]                                   │
│      Task count per batch if no ## sections found                │
│                                                                  │
│  [○] Pause between batches                                       │
│      Require user confirmation between implement batches         │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  BUDGET LIMITS                                                   │
│                                                                  │
│  Max per batch:    $[ 5.00 ]                                     │
│  Max total:        $[ 50.00 ]                                    │
│  Healing budget:   $[ 2.00 ]                                     │
│  Decision budget:  $[ 0.50 ]                                     │
```

### Progress Display (During Orchestration)

When orchestration is active, workflow actions area transforms:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestration Progress                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Design ──●── Analyze ──●── Implement ──○── Verify ──○── Merge  │
│                              ▲ current                           │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Implementing batch 2 of 4: Core Components                      │
│                                                                  │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12/35 tasks (34%)    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ▼ Decision Log                                          │    │
│  │   10:30:15  Checked status: hasSpec=true, tasks=12/35   │    │
│  │   10:30:12  Starting batch 2: Core Components (T008-T015)│   │
│  │   10:26:43  Batch 1 completed in 4m 32s                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Time elapsed: 8m 15s                                            │
│  Estimated remaining: ~12m                                       │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│                    [ Pause ]     [ Cancel ]                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Status Variations:**

Healing status:
```
│  🔧 Auto-healing batch 2...                                      │
│                                                                  │
│  Fixing: File not found error in T009                            │
│  Heal attempt: 1 of 1                                            │
```

Waiting for input:
```
│  ❓ Waiting for input                                            │
│                                                                  │
│  Claude has questions that need your response.                   │
│                         [ Answer Questions ]                     │
```

Merge ready (paused):
```
│  ⏹️ Merge Ready                                                  │
│                                                                  │
│  All tasks complete. Phase verified and ready to merge.          │
│                                                                  │
│                    [ Run Merge ]     [ View Diff ]               │
```

### Project Card Actions Menu

```
┌─────────────────────────────┐
│ ◈ Complete Phase         →  │  ← PRIMARY (highlighted, gradient bg)
├─────────────────────────────┤
│ ▷ Run Workflow           →  │──┬─ Orchestrate
├─────────────────────────────┤  ├─ Merge
│ 🔧 Maintenance              │  ├─ Review
│   Status                    │  └─ Memory
│   Validate                  │
├─────────────────────────────┤
│ ⚙ Advanced                  │
│   Sync State                │
└─────────────────────────────┘
```

"Complete Phase" is first and highlighted. "Run Workflow" contains direct skill access as secondary option.

### Status Badges on Project Cards

```
┌────────────────────────────────────────┐
│ My Project                      ◈ ● ●  │  ← ◈ = orchestration, ● = workflow
├────────────────────────────────────────┤
│ Phase: 1055 - Smart Batching           │
│                                        │
│ Completing phase (batch 2/4)    [▓▓░░] │  ← Orchestration-specific badge
│                                        │
└────────────────────────────────────────┘
```

Orchestration badge shows:
- "Completing phase (batch N/M)" during implement
- "Phase: Waiting for merge" when paused
- Different color than regular workflow badges

---

## Rationale

- **Why primary "Complete Phase" button?** The northstar goal is autonomous phase completion. Users should immediately see the main action that achieves this. Secondary buttons remain for power users who need direct skill access.

- **Why configuration modal?** Upfront configuration enables truly autonomous execution. Users set preferences once and don't need to intervene during the run. This builds trust and control.

- **Why collapsed advanced options?** Most users won't need to change defaults. Keeping advanced options hidden reduces cognitive load while making them accessible when needed.

- **Why progress replaces buttons?** During active orchestration, the primary actions are Pause/Cancel, not starting new workflows. Replacing buttons with progress provides clear visual state.

- **User flow:**
  1. Click "Complete Phase"
  2. Review detected batches and configure options
  3. Click "Start Orchestration"
  4. Watch progress (optional - can walk away)
  5. Return when notified of completion or questions
  6. Click "Run Merge" if auto-merge disabled

- **Accessibility considerations:**
  - All toggles have descriptive labels
  - Progress bar has text percentage for screen readers
  - Status changes announced to screen readers
  - Keyboard navigation for modal and all controls

---

## Component Inventory

| Component | Type | Purpose | Notes |
|-----------|------|---------|-------|
| CompletePhaseButton | Button | Primary action to start orchestration | Prominent styling, icon |
| StartOrchestrationModal | Modal | Configuration before starting | Contains options sections |
| OrchestrationConfigForm | Form | Core + Advanced options | Toggles, inputs, textarea |
| BudgetLimitsSection | Form section | Cost caps configuration | Currency inputs |
| OrchestrationProgress | Panel | Shows current orchestration state | Replaces action buttons |
| PhaseProgressBar | Progress | Visual step indicator | Design→Analyze→Implement→Verify→Merge |
| BatchProgress | Progress | Current batch progress | Section name, task counts, bar |
| DecisionLogPanel | Collapsible | Shows state machine decisions | Timestamps, messages |
| OrchestrationControls | Button group | Pause/Cancel during run | Context-aware visibility |
| MergeReadyPanel | Panel | Shown when paused at merge | Run Merge, View Diff buttons |
| OrchestrationBadge | Badge | Project card status | Different from workflow badge |
| ProjectCardMenu | Menu | Updated action menu | Complete Phase first |

---

## Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Open config modal | Click "Complete Phase" | Modal opens with detected batches |
| Toggle option | Click toggle | Value updates, no API call yet |
| Start orchestration | Click "Start Orchestration" in modal | Modal closes, progress shows, API called |
| Expand advanced | Click "Advanced Options" header | Section expands with animation |
| Cancel orchestration | Click "Cancel" | Confirmation dialog, then cancels |
| Pause orchestration | Click "Pause" | Pauses after current batch completes |
| Resume orchestration | Click "Resume" (on paused) | Continues from next batch |
| Run merge | Click "Run Merge" (merge ready) | Starts /flow.merge |
| View decision log | Click log header | Expands/collapses log panel |
| Open from card | Click "Complete Phase" in card menu | Same modal as project detail |
| Answer questions | Click "Answer Questions" | Opens question drawer |

---

## Design Constraints

- Must use existing shadcn/ui components (Button, Dialog, Toggle, Input, Progress)
- Must follow existing dark mode theming
- Must not break existing secondary workflow buttons
- Progress polling at 3s interval (no SSE)
- Must handle long orchestrations (hours) gracefully
- Must survive dashboard hot reload

---

## Open Questions

All questions resolved in phase file:
- [x] Button hierarchy decided: Complete Phase primary, others secondary
- [x] Modal structure decided: Core + Advanced (collapsed)
- [x] Progress location decided: Replaces action buttons
- [x] Badge design decided: Different color than workflow badges
