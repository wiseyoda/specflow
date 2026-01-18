---
description: Orchestrate the complete SpecFlow workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `.specify/orchestration-state.json` directly** - Use `specflow state set` commands
2. **NEVER edit `tasks.md` to mark tasks complete** - Use `specflow tasks mark` commands
3. **NEVER skip steps** - Execute steps in order: design → analyze → implement → verify
4. **ALWAYS verify step completion** before advancing to next step
5. **ALWAYS use the SpecFlow CLI** for all state and task operations

If you find yourself about to use the Edit tool on state files or tasks.md, STOP and use the CLI instead.

## User Input

```text
$ARGUMENTS
```

Arguments:
- `continue` or empty - Resume from current state
- `reset` - Clear state and restart current phase
- `status` - Show status only
- `skip-to [step]` - Skip to step (design, analyze, implement, verify)

## Goal

Execute the complete SpecFlow development workflow with:
1. **State persistence** - Survives conversation compaction
2. **Self-healing** - Detects and recovers from inconsistencies
3. **Minimal user interaction** - Only asks when truly necessary
4. **Auto-fix loop** - Fixes ALL issues found during analyze until clean

## Workflow Steps

| Step | Command   | Purpose                              | User Interaction            |
|------|-----------|--------------------------------------|-----------------------------|
| 0    | design    | Create all design artifacts          | Progressive questions + inline clarifications |
| 1    | analyze   | Check cross-artifact consistency     | Auto-fix loop until clean   |
| 2    | implement | Execute all tasks                    | Progress updates only       |
| 3    | verify    | Verify completion and update ROADMAP | None (or USER GATE prompt)  |

**Note**: The design step runs `/specflow.design` which produces all design artifacts (discovery, spec, plan, tasks, checklists) in one command. See `/specflow.design` for details.

## State Management

State file: `.specify/orchestration-state.json`

Use SpecFlow CLI for all state operations:
```bash
specflow state validate           # Check if state exists/valid
specflow state get --json         # Read current state
specflow state init --if-missing  # Initialize new state (idempotent)
specflow state set "key=value"    # Update state value
specflow state archive            # Archive completed phase
specflow doctor --fix             # Auto-repair issues
```

State transitions: `pending → in_progress → completed | blocked | failed`

---

## Execution Flow

### 0. Initialize Orchestration Context

**0a. Get Comprehensive Status (ONE CALL)**
```bash
specflow status --json            # Returns everything needed to resume
```

This single call returns:
```json
{
  "health": { "ok": true, "issues": [] },
  "phase": { "number": "0170", "name": "...", "branch": "...", "status": "in_progress" },
  "step": { "current": "implement", "index": 2, "status": "in_progress" },
  "tasks": { "completed": 0, "total": 122, "percentage": 0 },
  "git": { "branch": "...", "matches_state": true, "uncommitted": 3 },
  "artifacts": { "spec": true, "plan": true, "tasks": true, "checklists": true },
  "roadmap": { "phase_status": "in_progress", "matches_state": true },
  "ready": true,
  "next_action": "continue_implement"
}
```

**Step Index Mapping (4-step workflow):**
- 0 = design
- 1 = analyze
- 2 = implement
- 3 = verify

**0b. Handle Status Response**

Check `health.ok`:
- If `false`: Show issues from `health.issues[]`, exit with instructions

Check `ready`:
- If `false`: Handle `next_action` before proceeding

**0c. Handle Arguments**
| Argument | Action |
|----------|--------|
| `continue`/empty | Resume from `step.current` in status |
| `reset` | Clear steps, restart from design |
| `status` | Display status and exit |
| `skip-to [step]` | Update `orchestration.step.current` and `orchestration.step.index` (design=0, analyze=1, implement=2, verify=3) |

**0d. Auto-Recovery Based on next_action**
| next_action | Recovery |
|-------------|----------|
| `fix_health` | Run `specflow doctor --fix` |
| `fix_branch` | Checkout `phase.branch` (only if branch exists) |
| `archive_phase` | Run `specflow state archive` (ROADMAP shows complete) |
| `sync_roadmap` | Run `specflow reconcile --trust-files` |
| `verify_user_gate` | Phase merged, awaiting user verification - prompt for `/specflow.merge --next-phase` |
| `start_next_phase` | Run `/specflow.merge --next-phase` to archive and start next |
| `start_phase` | Continue to Section 1 |
| `continue_*` | Resume from that step |
| `recover_failed` | Handle failed step (see 0f) |

**0e. Post-Merge State Handling**

When `post_merge_state` is `true`, the phase was merged to main:
- Feature branch was deleted (normal after PR merge)
- On main/master branch
- Git log shows merge commit OR ROADMAP shows complete/awaiting

Actions:
1. If ROADMAP shows "⏳ Awaiting User": Display user gate prompt, wait for approval
2. If ROADMAP shows "✅ Complete": Archive state, start next phase
3. Otherwise: Update ROADMAP to reflect completion, then archive

**Artifact Cross-Check** (use `artifacts` from status):
- Step >= 1 (analyze or later): All design artifacts should exist (discovery, spec, plan, tasks, checklists)

If mismatch: Run `specflow doctor --fix`, reset to design step.

**State Migration (Legacy 9-step to 4-step):**

If `step.index` is > 3 (old workflow), auto-migrate:

| Old Index | Old Step | Maps To | New Index |
|-----------|----------|---------|-----------|
| 0-4, 6 | discover/specify/clarify/plan/tasks/checklist | design | 0 |
| 5 | analyze | analyze | 1 |
| 7 | implement | implement | 2 |
| 8 | verify | verify | 3 |

Migration command:
```bash
# Detect old workflow and migrate
if [[ $STEP_INDEX -gt 3 ]]; then
  case $STEP_INDEX in
    5) NEW_INDEX=1; NEW_STEP="analyze" ;;
    7) NEW_INDEX=2; NEW_STEP="implement" ;;
    8) NEW_INDEX=3; NEW_STEP="verify" ;;
    *) NEW_INDEX=0; NEW_STEP="design" ;;
  esac
  specflow state set "orchestration.step.current=$NEW_STEP" "orchestration.step.index=$NEW_INDEX"
fi
```

**0f. Failed Step Recovery**

If `step.status` is `failed`:
```
╔══════════════════════════════════════════════════════════════╗
║                  ⚠️  STEP FAILED: {step.current}               ║
╠══════════════════════════════════════════════════════════════╣
║ The previous attempt at this step failed.                     ║
║ This can happen due to validation errors, missing files,      ║
║ or other issues during execution.                             ║
╚══════════════════════════════════════════════════════════════╝
```

Recovery options (present to user):
| Option | Description |
|--------|-------------|
| `retry` | Reset step to `in_progress` and retry |
| `skip` | Mark step as `skipped` and continue to next (use with caution) |
| `diagnose` | Run `specflow doctor` to identify issues |
| `abort` | Keep failed state and exit (for manual intervention) |

Recovery commands:
```bash
# For retry:
specflow state set "orchestration.step.status=in_progress"

# For skip:
specflow state set "orchestration.step.status=skipped"
specflow state set "orchestration.step.current={next_step}"
specflow state set "orchestration.step.index={next_index}"

# For diagnose:
specflow doctor
```

**0g. Check Open Issues for Phase**
```bash
specflow issue list --open --phase {phase_number} --json
```

If issues exist:
- Display count and high-priority issues
- These should be addressed during IMPLEMENT step
- Critical issues may block verification

---

### 1. Determine Current Phase

**Initialize state (idempotent - safe to always run):**
```bash
specflow state init --if-missing  # Creates state only if missing, no-op otherwise
```

**If starting a new phase (state exists but no phase in progress):**
```bash
# Get next pending phase from ROADMAP
specflow roadmap next --json      # Returns {"next": "0090", "name": "mvp-poc"}

# Verify phase file exists (modular format)
specflow phase show NNNN          # Get full phase details from .specify/phases/

# Create branch and update state
specflow git branch create "NNNN-phase-name"
specflow state set "orchestration.phase.number=NNNN"
specflow state set "orchestration.phase.name=phase-name"
specflow state set "orchestration.phase.branch=NNNN-phase-name"
specflow state set "orchestration.phase.status=in_progress"
specflow state set "orchestration.step.current=design"
specflow state set "orchestration.step.index=0"
specflow state set "orchestration.step.status=in_progress"
specflow roadmap update "NNNN" in_progress
```

**Note**: Phase details (Goal, Scope, Deliverables, Verification Gate) are in `.specify/phases/NNNN-phase-name.md`, not inline in ROADMAP.md.

---

### 2. DESIGN (Step 0)

Check: If `orchestration.step.index > 0` and all design artifacts exist → skip to ANALYZE.

**Execute `/specflow.design`** which produces ALL design artifacts in one command:
- discovery.md (codebase examination, clarified intent)
- spec.md (feature specification)
- requirements.md (requirements checklist)
- plan.md (technical implementation plan)
- tasks.md (actionable task list)
- checklists/implementation.md (implementation guidance)
- checklists/verification.md (verification checklist)

The design command handles:
- Progressive clarification questions during discovery
- Inline clarifications during specification
- Constitution compliance checks during planning
- Task generation and dependency ordering

See `/specflow.design` for full details on the design workflow.

**VERIFY BEFORE ADVANCING:**
```bash
# Verify all design artifacts exist
ls specs/*/discovery.md specs/*/spec.md specs/*/plan.md specs/*/tasks.md specs/*/checklists/*.md
```

Update state (only after verification passes):
```bash
specflow state set "orchestration.step.current=analyze"
specflow state set "orchestration.step.index=1"
```

---

### 3. ANALYZE (Step 1)

**MANDATORY STEP - DO NOT SKIP**

Check: If `orchestration.step.index > 1` → re-run quick analysis, skip if clean.

**IMPORTANT**: This step performs analysis INLINE (do NOT run `specflow analyze` as a CLI command - it doesn't exist). Follow the analysis logic below:

Perform cross-artifact analysis on spec.md, plan.md, and tasks.md, then AUTO-FIX LOOP:

```text
MAX_ITERATIONS = 5
iteration = 0

WHILE issues_exist AND iteration < MAX_ITERATIONS:
  1. Collect issues, sort by severity
  2. For EACH issue: Apply fix automatically
  3. Re-run analysis
  4. iteration++

IF max iterations reached with issues remaining:
  - Ask user to review/fix manually
  - Mark as "blocked" if user declines
```

Auto-fix strategies:
| Issue Type | Fix Strategy |
|------------|--------------|
| Duplication | Keep higher-quality version |
| Ambiguity | Add measurable criteria |
| Coverage gap | Add task or requirement |
| Constitution violation | Modify to comply OR flag for user |

**VERIFY BEFORE ADVANCING:**
- Analysis must complete with no critical issues
- All auto-fixes must be applied

Update state (only after verification passes):
```bash
specflow state set "orchestration.step.current=implement"
specflow state set "orchestration.step.index=2"
```

---

### 4. IMPLEMENT (Step 2)

Check: If `orchestration.step.index > 2`:
```bash
specflow tasks status --json
```
If completed == total → skip to VERIFY.

**Initialize lessons tracking (if not exists):**
```bash
specflow lessons init          # Create lessons-learned.md for this phase
```

Execute `/specflow.implement` logic:
1. Verify/create ignore files
2. Parse task phases and dependencies
3. Execute tasks in order (Setup → Foundational → User Stories → Polish)
4. Mark each task complete **using CLI only**

Progress tracking (**MUST use these CLI commands, not Edit**):
```bash
specflow tasks mark T001          # Mark task complete
specflow tasks mark T002          # Mark next task complete
specflow tasks status             # Check progress
specflow git commit "feat: implement tasks T001-T010"  # Periodic commits
```

**NEVER use Edit tool to modify tasks.md checkboxes. ALWAYS use `specflow tasks mark`.**

Error recovery:
1. Log error, attempt 1 retry with different approach
2. If still fails: Mark blocked, continue with non-dependent tasks
3. If critical path blocked: Halt, report, mark "blocked"
4. **Record significant errors to lessons:**
   ```bash
   specflow lessons add error "Brief description of error"
   ```

**Issue Discovery During Implementation:**

When discovering bugs, improvements, or technical debt that's not blocking current work:
```bash
# Create issue for later
specflow issue create "Description of issue" \
  --category bug|improvement|debt \
  --priority high|medium|low \
  --phase {current_phase_or_future}

# Example: Found UX issue not in scope
specflow issue create "Button alignment inconsistent on mobile" \
  --category improvement \
  --priority medium \
  --phase 0050
```

**Address Phase Issues:**

Check for open issues assigned to current phase:
```bash
specflow issue list --open --phase {phase_number}
```

For each high-priority issue:
1. Attempt to resolve as part of current implementation
2. If resolved: `specflow issue close ISSUE-XXX --resolution "Fixed in task T###"`
3. If cannot resolve: Leave open with notes, mention in verify step

**VERIFY BEFORE ADVANCING:**
```bash
# Verify all tasks are complete
specflow tasks status --json | grep -q '"incomplete": 0' || { echo "ERROR: Not all tasks complete"; exit 1; }

# Run implement gate check (verifies tests pass if configured)
specflow gate implement || { echo "WARN: Gate check found issues"; }
```

Update state (only after verification passes):
```bash
specflow state set "orchestration.step.current=verify"
specflow state set "orchestration.step.index=3"
```

---

### 5. VERIFY (Step 3)

**Capture lessons learned before verification:**
```bash
# Review and add any significant decisions or gotchas
specflow lessons add decision "Chose X over Y because..."  # Architecture choices
specflow lessons add gotcha "Technology" "Issue" "Workaround"  # Platform quirks
specflow lessons list                                        # Review captured lessons
```

Execute `/specflow.verify` logic:
1. Task completion verification
2. Memory document compliance check
3. Checklist verification
4. Deferred items identification
5. Lessons learned review (prompt to add if lessons-learned.md is sparse)
6. **Issue resolution check**

**Check Unresolved Phase Issues:**
```bash
specflow issue list --open --phase {phase_number} --json
```

If open issues remain:
- **Critical/High priority**: Must resolve before completing phase
- **Medium/Low priority**: Can defer to future phase - update issue:
  ```bash
  specflow issue update ISSUE-XXX --phase {next_phase}
  ```
- Document deferred issues in verification summary

**USER GATE Phases**:

If phase has `**USER GATE**` in ROADMAP:
```text
## User Verification Required

Phase: {phase_number} - {phase_name}
Gate Type: USER VERIFICATION REQUIRED

What to Test: {Verification criteria from ROADMAP}
How to Test: {Instructions for accessing test page/POC}

Please verify the implementation meets your expectations.
Run `/specflow.merge --next-phase` when ready to complete this phase and start the next.
```
- Set `orchestration.phase.status=awaiting_user_gate`
- Do NOT auto-advance

**Non-USER GATE Phases**:
- Verify all checks pass
- Auto-advance to Phase Transition

Update ROADMAP:
```bash
specflow roadmap update "{phase_number}" complete  # Or "awaiting" for USER GATE
specflow claude-md update "{phase_number}: {phase_name}" "Phase completed"
```

---

### 11. Phase Transition

For non-USER GATE phases that pass verification, delegate to `/specflow.merge`:

```text
Phase verification complete!

Run `/specflow.merge` to complete this phase.
Or run `/specflow.merge --next-phase` to complete and start the next phase.
```

**Note**: `/specflow.merge` handles all phase completion tasks:
- Push branch and create PR
- Merge PR to main
- Archive state and phase details
- Update ROADMAP
- (with --next-phase) Create branch and initialize next phase

---

## Operating Principles

1. **Self-Healing**: Verify state matches filesystem before executing. Use `specflow doctor --fix` for repairs.
2. **Minimal Interaction**: Use recommended options when no response. Batch related questions. Auto-fix before asking.
3. **Memory Compliance**: Pre-check and validate against memory docs. Auto-correct violations when possible.
4. **Context Efficiency**: Progressive loading. Save state after each action. Resumable from any point.

## Question Format

Always use `AskUserQuestion` with:
- Clear header and context
- Recommended option first with reasoning
- Options table with implications
- Default behavior if no response

## Status Display

```text
+----------------------------------------------------------+
| SpecFlow Orchestration Status                             |
+----------------------------------------------------------+
| Phase: 0010 - project-architecture-setup                 |
| Branch: 0010-project-architecture-setup                  |
| Status: In Progress                                      |
| Details: .specify/phases/0010-project-architecture-setup.md |
+----------------------------------------------------------+
| Step         | Status     | Artifacts                    |
+--------------+------------+------------------------------+
| 0. design    | Complete   | discovery, spec, plan, tasks |
| 1. analyze   | Complete   | Clean (3 iterations)         |
| 2. implement | Current    | 12/47 tasks (25%)            |
| 3. verify    | Pending    | -                            |
+----------------------------------------------------------+
```

## Error Handling

| Error | Recovery |
|-------|----------|
| State corrupted | Rebuild from filesystem artifacts |
| Branch mismatch (branch exists) | Checkout correct branch |
| Branch deleted (post-merge) | Check ROADMAP status, proceed with verification or next phase |
| Missing artifact | Re-run producing step |
| ROADMAP missing | Halt, instruct user to create |
| Constitution violation | Halt, ask user for decision |
| State out of sync after merge | Archive state, update ROADMAP, start next phase |

## Context

$ARGUMENTS
