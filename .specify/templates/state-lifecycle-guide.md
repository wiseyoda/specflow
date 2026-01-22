# State Lifecycle Guide

This guide documents when each state field is set, read, and reset across the SpecFlow workflow.

## State File Location

```
.specflow/orchestration-state.json
```

## State Schema Source of Truth

```
packages/shared/src/schemas/events.ts → OrchestrationStateSchema
```

## State Field Lifecycle

### orchestration.phase.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `phase.number` | `phase/open`, `/flow.design` | All commands | `phase/close` | Active during phase |
| `phase.name` | `phase/open`, `/flow.design` | All commands | `phase/close` | Active during phase |
| `phase.branch` | `phase/open` | `/flow.merge` | `phase/close` | Active during phase |
| `phase.status` | `phase/open`, `phase/close` | `status`, routing | `phase/close` | `in_progress` → `complete` |
| `phase.goals` | `/flow.design` | `/flow.orchestrate`, `/flow.verify` | `phase/close` | Persists for compaction survival |
| `phase.hasUserGate` | `/flow.design` | `/flow.verify`, `/flow.merge`, `/flow.orchestrate` | `phase/close` | Set from phase doc |
| `phase.userGateStatus` | `/flow.verify`, `/flow.orchestrate` | `/flow.verify`, `/flow.merge` | `phase/close` | `pending` → `confirmed`/`skipped` |

### orchestration.step.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `step.current` | `phase/open`, `/flow.orchestrate` | All commands | `phase/close` | `design` → `analyze` → `implement` → `verify` |
| `step.index` | `phase/open`, `/flow.orchestrate` | `status` | `phase/close` | 0 → 1 → 2 → 3 |
| `step.status` | Sub-commands (`/flow.design`, etc.) | `/flow.orchestrate`, `status` | `/flow.orchestrate` on step change | `in_progress` → `complete`/`failed` |

**State Ownership Pattern**:
- `/flow.orchestrate` owns `step.current` and `step.index`
- Sub-commands (`/flow.design`, `/flow.implement`, `/flow.verify`) only set `step.status`
- When sub-commands run standalone, they initialize `step.current` only if empty

### orchestration.progress.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `progress.tasks_completed` | `phase/open`, task marking | `status` display | `phase/close` | Incrementing counter |
| `progress.tasks_total` | `phase/open` | `status` display | `phase/close` | Set from tasks.md |
| `progress.percentage` | `phase/open` | `status` display | `phase/close` | Calculated |

**Note**: These are snapshot values set at phase open. Actual task progress should be queried from tasks.md via `specflow status --json`.

### orchestration.implement.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `implement.current_tasks` | `/flow.implement` | `/flow.implement` | Step change | Batch tracking |
| `implement.current_section` | `/flow.implement` | `/flow.implement` | Step change | Section tracking |
| `implement.started_at` | `/flow.implement` | `/flow.implement` | Step change | Timestamp |

### orchestration.next_phase.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `next_phase.number` | `phase/close` | `phase/open` (if auto) | `phase/open` | Queued next phase |
| `next_phase.name` | `phase/close` | `phase/open` (if auto) | `phase/open` | From ROADMAP |
| `next_phase.description` | `phase/close` | Display | `phase/open` | From ROADMAP |

### memory.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `memory.archive_reviews.{NNNN}` | `/flow.memory --archive` | `/flow.memory --archive` | Never (permanent record) | Per-phase review tracking |

### health.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `health.status` | `check` command | `status`, routing | `check --fix` | `ok`, `warning`, `error` |
| `health.last_check` | `check` command | Display | Each check | Timestamp |
| `health.issues` | `check` command | Display, `--fix` | Each check | Array of issues |

### actions.*

| Field | Set By | Read By | Reset By | Lifecycle |
|-------|--------|---------|----------|-----------|
| `actions.history` | `phase/close` | Display | Never | Permanent audit log |
| `actions.available` | Not currently used | - | - | Future feature |
| `actions.pending` | Not currently used | - | - | Future feature |

## Workflow State Transitions

### Phase Lifecycle

```
1. specflow phase open
   → phase.number, phase.name, phase.branch, phase.status='in_progress'
   → step.current='design', step.index=0, step.status='not_started'
   → progress.* reset to 0

2. /flow.design
   → phase.goals (persisted for compaction)
   → phase.hasUserGate (from phase doc)
   → step.status='in_progress' then 'complete'

3. /flow.orchestrate advances step
   → step.current='analyze', step.index=1
   → step.status='in_progress'

4. /flow.verify
   → phase.userGateStatus (if gate exists)
   → step.status='complete'

5. specflow phase close
   → phase.* reset
   → step.* reset
   → next_phase.* populated (if more phases)
   → actions.history appended
```

### Step Transitions

```
step.current values: design → analyze → implement → verify
step.index values:   0      → 1       → 2         → 3

Transitions owned by: /flow.orchestrate only
Status updates by: Individual sub-commands

Valid step.status: pending, in_progress, complete, failed, blocked, skipped
```

## State Access Patterns

### Reading State

```bash
# Get single value
specflow state get orchestration.phase.number

# Get JSON output for parsing
specflow status --json
```

### Writing State

```bash
# Set single value
specflow state set orchestration.step.status=complete

# Set multiple values
specflow state set "orchestration.phase.goals=[\"Goal 1\", \"Goal 2\"]"
```

**Rules**:
- Always use CLI commands, never edit `.specflow/orchestration-state.json` directly
- Sub-commands only set `step.status`, not `step.current` or `step.index`
- Initialize fields only if empty (check first with `state get`)

## State Validation

Run `specflow check` to validate state consistency:
- Phase exists in ROADMAP
- Step index matches step.current
- Required fields are present
- No orphaned references

Run `specflow check --fix` to auto-repair common issues.
