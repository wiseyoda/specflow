# State Hardening Plan

> Ensure SpecKit CLI and Claude commands properly update orchestration state for dashboard visibility.

## Executive Summary

The dashboard expects real-time state updates that reflect workflow progress. Currently:
1. **Tasks** jump from "todo" → "done" with no "in_progress" state
2. **Steps** only update at transitions, not during execution
3. **Post-merge** state is stale (branch deleted before completion recorded)
4. **Standalone commands** don't update state (rely on orchestrate.md)

This plan addresses all gaps with minimal token overhead.

---

## Part 1: Task In-Progress Tracking (Batch Mode)

### Current Behavior
- `speckit tasks mark T###` marks task complete (checkbox `[X]`)
- No intermediate state - dashboard only sees "todo" or "done"
- Tasks worked in batches, marked in batches

### Target Behavior
- Track current working batch/section in state
- Dashboard shows which tasks are actively being worked on
- Batch completion updates counts

### Changes Required

#### 1.1 Add `speckit tasks start` command
**File**: `scripts/bash/speckit-tasks.sh`

```bash
# New command: speckit tasks start <id>... [--section <name>]
# Marks task(s) as "in progress" in state (not in tasks.md)

# Store in state:
# orchestration.implement.current_tasks: ["T001", "T002"]
# orchestration.implement.current_section: "Setup"
```

**State schema addition** (`.specify/orchestration-state.json`):
```json
{
  "orchestration": {
    "implement": {
      "current_tasks": [],
      "current_section": null,
      "started_at": null
    }
  }
}
```

#### 1.2 Update `speckit tasks mark` to clear in_progress
**File**: `scripts/bash/speckit-tasks.sh`

When marking a task complete:
1. Mark checkbox in tasks.md (existing)
2. Update counts in state (existing)
3. Remove from `current_tasks` array if present (new)

#### 1.3 Add `speckit tasks working` command
**File**: `scripts/bash/speckit-tasks.sh`

```bash
# Show currently in-progress tasks
speckit tasks working --json
# Returns: { "tasks": ["T001", "T002"], "section": "Setup", "started_at": "..." }
```

#### 1.4 Update implement.md to use batch tracking
**File**: `commands/speckit.implement.md`

Add to step 6 (Execute implementation):
```bash
# Before starting a task section
speckit tasks start T001 T002 T003 --section "Setup"

# After completing section
speckit tasks mark T001 T002 T003
```

### Dashboard Integration
- API already watches state file
- Add `implement.current_tasks` to OrchestrationState type
- Kanban view: show tasks in `current_tasks` as "in_progress" status
- Status view: show "Working on: T001, T002 (Setup)"

---

## Part 2: Step State Updates (Self-Managing Commands)

### Current Behavior
- Only `orchestrate.md` updates step state
- Individual commands (specify, clarify, plan, etc.) generate artifacts only
- If running standalone, state doesn't reflect activity

### Target Behavior
- Each command manages its own step state
- State shows `in_progress` during execution, `complete` after
- Works both standalone and via orchestrate.md

### Changes Required

#### 2.1 Add state update blocks to each command

**Files to modify**:
- `commands/speckit.specify.md`
- `commands/speckit.clarify.md`
- `commands/speckit.plan.md`
- `commands/speckit.tasks.md`
- `commands/speckit.checklist.md`
- `commands/speckit.implement.md`
- `commands/speckit.verify.md`

**Pattern to add at START of each command**:
```bash
# === STATE: Mark step in_progress ===
speckit state set "orchestration.step.current={step_name}"
speckit state set "orchestration.step.status=in_progress"
```

**Pattern to add at END of each command (before handoff)**:
```bash
# === STATE: Mark step complete ===
speckit state set "orchestration.step.status=complete"
```

#### 2.2 Specific command mappings

| Command | step.current | step.index |
|---------|--------------|------------|
| speckit.specify | specify | 1 |
| speckit.clarify | clarify | 2 |
| speckit.plan | plan | 3 |
| speckit.tasks | tasks | 4 |
| speckit.analyze | analyze | 5 |
| speckit.checklist | checklist | 6 |
| speckit.implement | implement | 7 |
| speckit.verify | verify | 8 |

#### 2.3 Update orchestrate.md to not duplicate

**File**: `commands/speckit.orchestrate.md`

Since commands now self-manage state:
- Remove state updates BEFORE calling each step (commands handle it)
- Keep state updates AFTER steps only for index advancement
- Add guards to prevent double-updates

```bash
# After specify completes, advance index only
speckit state set "orchestration.step.index=2"
# (specify.md already set status=complete)
```

### Token Cost Analysis
- 2 additional `speckit state set` calls per step: ~50 tokens each
- 9 steps × 2 calls × 50 tokens = ~900 tokens per full workflow
- Acceptable overhead for real-time visibility

---

## Part 3: Post-Merge State Updates

### Current Behavior
- `speckit.merge` archives state and deletes branch
- After branch deletion, state file may not persist properly
- Dashboard shows stale data when on main branch

### Target Behavior
- Record phase completion in `actions.history` BEFORE branch operations
- Set `phase.status=complete` while still on feature branch
- State persists after merge because it's committed before branch delete

### Changes Required

#### 3.1 Reorder merge.md operations
**File**: `commands/speckit.merge.md`

Current order:
1. Push branch
2. Create/merge PR
3. Delete branch
4. Archive state (on main)
5. Update ROADMAP

New order:
1. **Record completion in state (while on feature branch)**
2. Push branch (includes state update)
3. Create/merge PR
4. Checkout main
5. Archive state
6. Update ROADMAP

#### 3.2 Add pre-merge state update
**File**: `commands/speckit.merge.md`

Add before step 2 (Git Push):
```bash
# === STATE: Record phase completion before merge ===
# Get current values for history entry
PHASE_NUMBER=$(speckit state get orchestration.phase.number)
PHASE_NAME=$(speckit state get orchestration.phase.name)
BRANCH=$(speckit state get orchestration.phase.branch)
TASKS_COMPLETED=$(speckit state get orchestration.steps.implement.tasks_completed)
TASKS_TOTAL=$(speckit state get orchestration.steps.implement.tasks_total)

# Create history entry JSON
HISTORY_ENTRY=$(cat <<EOF
{
  "type": "phase_completed",
  "phase_number": "$PHASE_NUMBER",
  "phase_name": "$PHASE_NAME",
  "branch": "$BRANCH",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tasks_completed": $TASKS_COMPLETED,
  "tasks_total": $TASKS_TOTAL
}
EOF
)

# Append to history (via CLI or direct jq)
speckit state set "actions.history[+]=$HISTORY_ENTRY"

# Mark phase complete
speckit state set "orchestration.phase.status=complete"
speckit state set "orchestration.step.current=complete"
speckit state set "orchestration.step.status=complete"

# Commit state update
git add .specify/orchestration-state.json
git commit -m "chore: record phase $PHASE_NUMBER completion"
```

#### 3.3 Ensure state file is in git
**Files**: `.gitignore`, `speckit.init.md`

Verify `.specify/orchestration-state.json` is NOT in .gitignore
(It should be tracked so state persists across branches)

#### 3.4 Update `speckit state archive` to be idempotent
**File**: `scripts/bash/speckit-state.sh`

Make archive command safe to run multiple times:
```bash
# Check if already archived (phase.status == complete)
if [[ "$(speckit state get orchestration.phase.status)" == "complete" ]]; then
  log_info "Phase already archived"
  return 0
fi
```

---

## Part 4: Verify Step Updates

### Current Behavior
- `speckit.verify` updates ROADMAP but may not update state correctly
- USER GATE phases set `awaiting_user_gate` but dashboard might not show it

### Target Behavior
- Clear state updates for verification completion
- USER GATE state is visible in dashboard
- Smooth transition to merge

### Changes Required

#### 4.1 Add explicit state updates to verify.md
**File**: `commands/speckit.verify.md`

At START:
```bash
speckit state set "orchestration.step.current=verify"
speckit state set "orchestration.step.status=in_progress"
```

For USER GATE phases:
```bash
speckit state set "orchestration.phase.status=awaiting_user_gate"
speckit state set "orchestration.step.status=awaiting_user"
```

For non-USER GATE phases:
```bash
speckit state set "orchestration.phase.status=verified"
speckit state set "orchestration.step.status=complete"
```

#### 4.2 Add verification status to dashboard
**File**: `dashboard/lib/types.ts`

Add to phase status enum: `"verified"`, `"awaiting_user_gate"`

---

## Part 5: CLI Helpers

### New CLI commands to support state hardening

#### 5.1 `speckit state touch`
**File**: `scripts/bash/speckit-state.sh`

```bash
# Update last_updated timestamp
speckit state touch
```
Already exists in json.sh as `state_touch` - ensure exposed via CLI.

#### 5.2 `speckit tasks start`
**File**: `scripts/bash/speckit-tasks.sh`

New command for batch tracking (detailed in Part 1).

#### 5.3 `speckit tasks working`
**File**: `scripts/bash/speckit-tasks.sh`

Query current in-progress tasks (detailed in Part 1).

---

## Part 6: Dashboard Updates

### Changes to support new state fields

#### 6.1 Update TypeScript types
**File**: `dashboard/lib/types.ts`

```typescript
interface OrchestrationState {
  // ... existing fields ...
  orchestration?: {
    // ... existing fields ...
    implement?: {
      current_tasks?: string[];
      current_section?: string | null;
      started_at?: string | null;
    };
  };
}
```

#### 6.2 Update task status derivation
**File**: `dashboard/lib/tasks-parser.ts`

When parsing tasks, check if task ID is in `state.orchestration.implement.current_tasks`:
- If yes: status = "in_progress"
- If checkbox checked: status = "done"
- Else: status = "todo"

#### 6.3 Add working tasks indicator
**Files**: `dashboard/components/status-view.tsx`, `dashboard/components/kanban-view.tsx`

- Show "Working on: T001, T002 (Setup)" in status view
- Show tasks with `in_progress` status in middle column of Kanban

---

## Implementation Order

### Phase 1: Foundation (Low Risk)
1. Add `speckit tasks start` and `speckit tasks working` commands
2. Update state schema with `implement.current_tasks`
3. Add `failed` status support to schema and CLI
4. Update dashboard types and task parser

### Phase 2: Command Self-Management (Medium Risk)
5. Add state updates to each command (specify → verify)
6. Add error handling with `failed` status to commands
7. Update orchestrate.md to handle failed state recovery
8. Test standalone command execution

### Phase 3: Merge Flow (Higher Risk)
9. Reorder merge.md operations
10. Add pre-merge state recording
11. Make `speckit state archive` idempotent
12. Test full merge workflow

### Phase 4: Self-Healing
13. Add staleness detection to commands
14. Add `--auto-heal` to `speckit status`
15. Add dashboard stale state indicator

### Phase 5: Polish
16. Add working tasks indicator to dashboard
17. Add failed state indicator to dashboard
18. Update documentation
19. Test edge cases (interruptions, failures, retries)

---

## Testing Checklist

### Task Tracking
- [ ] `speckit tasks start T001 T002` updates state.implement.current_tasks
- [ ] `speckit tasks mark T001` removes T001 from current_tasks
- [ ] `speckit tasks working` shows current batch
- [ ] Dashboard shows tasks as "in_progress"

### Step Updates
- [ ] Running `/speckit.specify` alone updates step state
- [ ] Running `/speckit.orchestrate` doesn't double-update
- [ ] State reflects current step during execution
- [ ] State shows complete after step finishes

### Post-Merge
- [ ] Phase completion recorded before PR merge
- [ ] State persists after branch deletion
- [ ] Dashboard shows completed phase on main branch
- [ ] `actions.history` contains completed phases

### Error Handling
- [ ] Command failure sets `step.status=failed`
- [ ] Dashboard shows red indicator for failed steps
- [ ] Orchestrate detects failed state and offers retry
- [ ] Recovery from failed state works correctly

### Self-Healing
- [ ] Commands detect stale state and auto-infer
- [ ] `speckit status --auto-heal` fixes inconsistencies
- [ ] Dashboard shows "state may be outdated" when stale

### Edge Cases
- [ ] Interrupted workflow resumes correctly
- [ ] Multiple phases in history display correctly
- [ ] ROADMAP and state stay in sync
- [ ] Doctor detects and fixes state drift

---

## Part 7: Self-Healing State Inference

### Current Behavior
- `speckit state infer` exists but must be run manually
- Stale state requires explicit `speckit doctor --fix`

### Target Behavior
- Commands auto-detect stale state and self-correct
- Dashboard triggers inference when state seems inconsistent with artifacts

### Changes Required

#### 7.1 Add staleness detection to commands
**Pattern for each command**:
```bash
# At start of command, check if state matches reality
CURRENT_STEP=$(speckit state get orchestration.step.current)
EXPECTED_ARTIFACTS_EXIST=true  # Check based on step

# If state says we're past this step but artifacts are missing, infer
if [[ "$CURRENT_STEP" != "{this_step}" ]]; then
  # Check if we should even be running this step
  speckit state infer --apply 2>/dev/null || true
fi
```

#### 7.2 Add `--auto-heal` flag to `speckit status`
**File**: `scripts/bash/speckit-status.sh`

```bash
speckit status --auto-heal
# If inconsistencies detected, auto-run infer
```

#### 7.3 Dashboard staleness detection
**File**: `dashboard/lib/state-validator.ts` (new)

```typescript
function isStateStale(state: OrchestrationState, artifacts: ArtifactStatus): boolean {
  // State says step > 1 but no spec.md
  if (state.orchestration?.step?.index > 1 && !artifacts.spec) return true;
  // State says step > 4 but no tasks.md
  if (state.orchestration?.step?.index > 4 && !artifacts.tasks) return true;
  // etc.
  return false;
}
```

When stale detected, dashboard could show "State may be outdated" indicator.

---

## Part 8: Failed Status for Error States

### Current Behavior
- Commands error out but leave state as `in_progress`
- No clear signal in dashboard that something failed
- Hard to diagnose "stuck" workflows

### Target Behavior
- Commands set `step.status=failed` on unrecoverable errors
- Dashboard shows red indicator for failed steps
- Clear path to retry/recover

### Changes Required

#### 8.1 Add error handling pattern to commands
**Pattern for each command**:
```bash
# Wrap main logic in error handler
set -e  # Exit on error

# Trap errors
trap 'speckit state set "orchestration.step.status=failed"; exit 1' ERR

# ... command logic ...

# On success
speckit state set "orchestration.step.status=complete"
```

**Alternative (for Claude commands)**:
At end of command, add error recovery section:
```markdown
## Error Handling

If any step above fails:
1. Set step status to failed:
   ```bash
   speckit state set "orchestration.step.status=failed"
   ```
2. Report the error clearly to the user
3. Suggest recovery steps (retry, skip, manual fix)
```

#### 8.2 Update state schema for failed status
**Valid step.status values**:
- `pending` - Not started
- `in_progress` - Currently running
- `complete` - Finished successfully
- `failed` - Error occurred (NEW)
- `blocked` - Waiting on dependency
- `skipped` - Intentionally skipped

#### 8.3 Dashboard failed state display
**Files**: `dashboard/components/status-view.tsx`, `dashboard/components/project-card.tsx`

```typescript
// Add red indicator for failed status
if (step.status === 'failed') {
  return <Badge variant="destructive">Failed</Badge>;
}
```

#### 8.4 Add retry capability
**File**: `commands/speckit.orchestrate.md`

When resuming and step.status is `failed`:
```bash
# Detect failed state
if [[ "$(speckit state get orchestration.step.status)" == "failed" ]]; then
  echo "Previous step failed. Options:"
  echo "1. Retry the step"
  echo "2. Skip to next step"
  echo "3. Reset and start over"
  # Use AskUserQuestion to get choice
fi
```

---

## Token Cost Summary

| Change | Additional Tokens | Frequency |
|--------|-------------------|-----------|
| Task batch tracking | ~100/batch | 5-10 batches/phase |
| Step state updates | ~100/step | 9 steps/phase |
| Pre-merge recording | ~150 | 1/phase |
| **Total per phase** | ~1,500-2,000 | - |

This is <1% overhead on a typical phase with 50+ tasks.

---

## Files to Modify

### Scripts
- `scripts/bash/speckit-tasks.sh` - Add start, working commands
- `scripts/bash/speckit-state.sh` - Add touch exposure, archive idempotency
- `scripts/bash/speckit-status.sh` - Add `--auto-heal` flag

### Commands
- `commands/speckit.specify.md` - Add state updates + error handling
- `commands/speckit.clarify.md` - Add state updates + error handling
- `commands/speckit.plan.md` - Add state updates + error handling
- `commands/speckit.tasks.md` - Add state updates + error handling
- `commands/speckit.checklist.md` - Add state updates + error handling
- `commands/speckit.implement.md` - Add batch tracking + error handling
- `commands/speckit.verify.md` - Add state updates + error handling
- `commands/speckit.merge.md` - Reorder, add pre-merge recording
- `commands/speckit.orchestrate.md` - Remove duplicates, add failed state recovery

### Dashboard
- `dashboard/lib/types.ts` - Add implement.current_tasks, failed status
- `dashboard/lib/tasks-parser.ts` - Check current_tasks for in_progress
- `dashboard/lib/state-validator.ts` - NEW: Staleness detection
- `dashboard/components/status-view.tsx` - Show working tasks, failed indicator
- `dashboard/components/kanban-view.tsx` - Show in_progress column
- `dashboard/components/project-card.tsx` - Failed state indicator
