---
description: Orchestrate the complete SpecKit workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `.specify/orchestration-state.json` directly** - Use `speckit state set` commands
2. **NEVER edit `tasks.md` to mark tasks complete** - Use `speckit tasks mark` commands
3. **NEVER skip steps** - Execute steps in order: specify → clarify → plan → tasks → analyze → checklist → implement → verify
4. **ALWAYS verify step completion** before advancing to next step
5. **ALWAYS use the SpecKit CLI** for all state and task operations

If you find yourself about to use the Edit tool on state files or tasks.md, STOP and use the CLI instead.

## User Input

```text
$ARGUMENTS
```

Arguments:
- `continue` or empty - Resume from current state
- `reset` - Clear state and restart current phase
- `status` - Show status only
- `skip-to [step]` - Skip to step (specify, clarify, plan, tasks, analyze, checklist, implement, verify)
- `next-phase` - Advance to next ROADMAP phase (after USER GATE approval)

## Goal

Execute the complete SpecKit development workflow with:
1. **State persistence** - Survives conversation compaction
2. **Self-healing** - Detects and recovers from inconsistencies
3. **Minimal user interaction** - Only asks when truly necessary
4. **Auto-fix loop** - Fixes ALL issues found during analyze until clean

## Workflow Steps

| Step | Command   | Purpose                              | User Interaction            |
|------|-----------|--------------------------------------|-----------------------------|
| 1    | specify   | Create feature specification         | Critical clarifications only |
| 2    | clarify   | Resolve specification ambiguities    | Questions with recommendations |
| 3    | plan      | Create technical implementation plan | None (research-based)       |
| 4    | tasks     | Generate actionable task list        | None                        |
| 5    | analyze   | Check cross-artifact consistency     | Auto-fix loop until clean   |
| 6    | checklist | Create verification checklist        | Scope questions             |
| 7    | implement | Execute all tasks                    | Progress updates only       |
| 8    | verify    | Verify completion and update ROADMAP | None (or USER GATE prompt)  |

## State Management

State file: `.specify/orchestration-state.json`

Use SpecKit CLI for all state operations:
```bash
speckit state validate           # Check if state exists/valid
speckit state get --json         # Read current state
speckit state init               # Initialize new state
speckit state set "key=value"    # Update state value
speckit state archive            # Archive completed phase
speckit doctor --fix             # Auto-repair issues
```

State transitions: `pending → in_progress → completed | blocked | failed`

---

## Execution Flow

### 0. Initialize Orchestration Context

**0a. Verify Prerequisites**
```bash
speckit state validate           # State file
speckit roadmap validate         # ROADMAP.md
speckit doctor                   # Overall health
```

If ROADMAP.md missing: Ask user to create via `/speckit.roadmap` or manually.

**0b. Handle Arguments**
| Argument | Action |
|----------|--------|
| `continue`/empty | Resume from `orchestration.step.current` |
| `reset` | Clear steps, restart from specify |
| `status` | Display status and exit |
| `skip-to [step]` | Update `orchestration.step.current` and `orchestration.step.index` |
| `next-phase` | Merge branch, checkout next, reset steps |

**0c. Verify State Matches Reality**
```bash
speckit git branch current       # Git branch matches state?
speckit tasks status             # Task completion accurate?
speckit roadmap status --json    # Phase status matches?
```

**CRITICAL**: If ROADMAP shows current phase as "Complete" but state still references it:
1. Log: "Phase already complete in ROADMAP. Resetting for next phase."
2. Run `speckit state archive`
3. Continue to Section 1

Verification checks for each "completed" step:
- specify: spec.md exists
- clarify: spec.md has Clarifications section
- plan: plan.md exists
- tasks: tasks.md exists
- analyze: No critical issues
- checklist: checklists/ has files
- implement: All tasks marked [X]
- verify: ROADMAP.md updated

If mismatch: Run `speckit doctor --fix`, reset affected step.

---

### 1. Determine Current Phase

**If no state file (fresh start):**
```bash
speckit roadmap next --json      # Get next pending phase
speckit git branch create "NNN-phase-name"
speckit state init
speckit state set "orchestration.phase.number=NNN"
speckit state set "orchestration.phase.name=phase-name"
speckit state set "orchestration.phase.branch=NNN-phase-name"
speckit state set "orchestration.phase.status=in_progress"
speckit state set "orchestration.step.current=specify"
speckit state set "orchestration.step.index=0"
speckit state set "orchestration.step.status=in_progress"
speckit roadmap update "NNN" in_progress
```

---

### 2. SPECIFY

Check: If `orchestration.step.index > 0` and spec.md exists → skip to CLARIFY.

Execute `/speckit.specify` logic:
1. Extract Goal, Scope, Deliverables from ROADMAP phase
2. Create spec.md using template
3. Create requirements.md checklist
4. Validate specification quality

Handle `[NEEDS CLARIFICATION]` markers (max 3):
- Use `AskUserQuestion` with recommended option first
- Update spec with answers

**VERIFY BEFORE ADVANCING:**
```bash
# Verify spec.md was created
ls specs/*/spec.md || { echo "ERROR: spec.md not created"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=clarify"
speckit state set "orchestration.step.index=1"
```

---

### 3. CLARIFY

Check: If `orchestration.step.index > 1` and spec.md valid → skip to PLAN.

Execute `/speckit.clarify` logic:
1. Load spec.md
2. Perform ambiguity scan
3. Generate max 5 prioritized questions

For each question, use `AskUserQuestion`:
- Include recommended option with reasoning
- Show options table with implications
- Default behavior if no response

**VERIFY BEFORE ADVANCING:**
- Confirm clarifications were added to spec.md OR no clarifications were needed

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=plan"
speckit state set "orchestration.step.index=2"
```

---

### 4. PLAN

Check: If `orchestration.step.index > 2` and plan.md exists → skip to TASKS.

Load memory documents for compliance:
- `constitution.md` (REQUIRED)
- `tech-stack.md`, `coding-standards.md`, `testing-strategy.md` (if exist)

Execute `/speckit.plan` logic:
1. Initialize plan.md template
2. Fill Technical Context
3. Constitution Check - verify no violations
4. Generate research.md, data-model.md, contracts/, quickstart.md

Cross-check against memory documents:
- Constitution violations: BLOCK until resolved
- Other violations: Warn but don't block

**VERIFY BEFORE ADVANCING:**
```bash
# Verify plan.md was created
ls specs/*/plan.md || { echo "ERROR: plan.md not created"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=tasks"
speckit state set "orchestration.step.index=3"
```

---

### 5. TASKS

Check: If `orchestration.step.index > 3` and tasks.md exists → skip to ANALYZE.

Execute `/speckit.tasks` logic:
1. Load plan.md, spec.md, data-model.md, contracts/
2. Generate tasks organized by user story
3. Format: `- [ ] T### [P?] [US?] Description with file path`
4. Generate dependency graph

**VERIFY BEFORE ADVANCING:**
```bash
# Verify tasks.md was created
ls specs/*/tasks.md || { echo "ERROR: tasks.md not created"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=analyze"
speckit state set "orchestration.step.index=4"
```

---

### 6. ANALYZE (Auto-Fix Loop)

**MANDATORY STEP - DO NOT SKIP**

Check: If `orchestration.step.index > 4` → re-run quick analysis, skip if clean.

Execute `/speckit.analyze` logic, then AUTO-FIX LOOP:

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
speckit state set "orchestration.step.current=checklist"
speckit state set "orchestration.step.index=5"
```

---

### 7. CHECKLIST

**MANDATORY STEP - DO NOT SKIP**

Check: If `orchestration.step.index > 5` and checklists/ has files → skip to IMPLEMENT.

Use `AskUserQuestion` for scope:
| Option | Type | Purpose |
|--------|------|---------|
| A (Recommended) | Post-completion verification | For /speckit.verify |
| B | Implementation + Verification | Both guidance and checks |
| C | Custom focus | Specific areas (security, performance) |

Execute `/speckit.checklist` logic:
1. Generate checklist testing REQUIREMENTS quality
2. Create `checklists/verification.md`

**VERIFY BEFORE ADVANCING:**
```bash
# Verify checklist was created
ls specs/*/checklists/verification.md || { echo "ERROR: verification.md not created"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=implement"
speckit state set "orchestration.step.index=6"
```

---

### 8. IMPLEMENT

Check: If `orchestration.step.index > 6`:
```bash
speckit tasks status --json
```
If completed == total → skip to VERIFY.

Execute `/speckit.implement` logic:
1. Verify/create ignore files
2. Parse task phases and dependencies
3. Execute tasks in order (Setup → Foundational → User Stories → Polish)
4. Mark each task complete **using CLI only**

Progress tracking (**MUST use these CLI commands, not Edit**):
```bash
speckit tasks mark T001          # Mark task complete
speckit tasks mark T002          # Mark next task complete
speckit tasks status             # Check progress
speckit git commit "feat: implement tasks T001-T010"  # Periodic commits
```

**NEVER use Edit tool to modify tasks.md checkboxes. ALWAYS use `speckit tasks mark`.**

Error recovery:
1. Log error, attempt 1 retry with different approach
2. If still fails: Mark blocked, continue with non-dependent tasks
3. If critical path blocked: Halt, report, mark "blocked"

**VERIFY BEFORE ADVANCING:**
```bash
# Verify all tasks are complete
speckit tasks status --json | grep -q '"incomplete": 0' || { echo "ERROR: Not all tasks complete"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=verify"
speckit state set "orchestration.step.index=7"
```

---

### 9. VERIFY

Execute `/speckit.verify` logic:
1. Task completion verification
2. Memory document compliance check
3. Checklist verification
4. Deferred items identification

**USER GATE Phases**:

If phase has `**USER GATE**` in ROADMAP:
```text
## User Verification Required

Phase: {phase_number} - {phase_name}
Gate Type: USER VERIFICATION REQUIRED

What to Test: {Verification criteria from ROADMAP}
How to Test: {Instructions for accessing test page/POC}

Please verify the implementation meets your expectations.
Run `/speckit.orchestrate next-phase` when ready.
```
- Set `orchestration.phase.status=awaiting_user_gate`
- Do NOT auto-advance

**Non-USER GATE Phases**:
- Verify all checks pass
- Auto-advance to Phase Transition

Update ROADMAP:
```bash
speckit roadmap update "{phase_number}" complete  # Or "awaiting" for USER GATE
speckit claude-md update "{phase_number}: {phase_name}" "Phase completed"
```

---

### 10. Phase Transition

**10a. Commit and Merge**
```bash
speckit git commit "feat({phase_name}): Complete phase {phase_number}"
speckit git push
speckit git merge main
speckit git push
```

**10b. Archive and Reset**
```bash
speckit state archive            # Archive to history, reset current
```

**10c. Start Next Phase**
```bash
speckit roadmap next --json      # Get next pending phase
```

If no more phases: Report "All phases complete!"
If next phase exists: Create branch, initialize state, begin from SPECIFY.

---

## Operating Principles

1. **Self-Healing**: Verify state matches filesystem before executing. Use `speckit doctor --fix` for repairs.
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
| SpecKit Orchestration Status                             |
+----------------------------------------------------------+
| Phase: 001 - Project Architecture Setup                  |
| Branch: 001-project-architecture-setup                   |
| Status: In Progress                                      |
+----------------------------------------------------------+
| Step        | Status     | Artifacts                     |
+-------------+------------+-------------------------------+
| 1. specify  | Complete   | spec.md, requirements.md      |
| 2. clarify  | Complete   | spec.md (5 clarifications)    |
| 3. plan     | Complete   | plan.md, research.md          |
| 4. tasks    | Complete   | tasks.md (47 tasks)           |
| 5. analyze  | Complete   | Clean (3 iterations)          |
| 6. checklist| Current    | verification.md               |
| 7. implement| Pending    | -                             |
| 8. verify   | Pending    | -                             |
+----------------------------------------------------------+
```

## Error Handling

| Error | Recovery |
|-------|----------|
| State corrupted | Rebuild from filesystem artifacts |
| Branch mismatch | Checkout correct branch |
| Missing artifact | Re-run producing step |
| ROADMAP missing | Halt, instruct user to create |
| Constitution violation | Halt, ask user for decision |

## Context

$ARGUMENTS
