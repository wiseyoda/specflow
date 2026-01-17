---
description: Orchestrate the complete SpecKit workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `.specify/orchestration-state.json` directly** - Use `speckit state set` commands
2. **NEVER edit `tasks.md` to mark tasks complete** - Use `speckit tasks mark` commands
3. **NEVER skip steps** - Execute steps in order: discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify (discover can be skipped with `--no-discovery`)
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
- `skip-to [step]` - Skip to step (discover, specify, clarify, plan, tasks, analyze, checklist, implement, verify)
- `--no-discovery` - Skip the DISCOVER phase (codebase examination and clarifying questions)

## Goal

Execute the complete SpecKit development workflow with:
1. **State persistence** - Survives conversation compaction
2. **Self-healing** - Detects and recovers from inconsistencies
3. **Minimal user interaction** - Only asks when truly necessary
4. **Auto-fix loop** - Fixes ALL issues found during analyze until clean

## Workflow Steps

| Step | Command   | Purpose                              | User Interaction            |
|------|-----------|--------------------------------------|-----------------------------|
| 1    | discover  | Examine codebase and clarify scope   | Progressive questions       |
| 2    | specify   | Create feature specification         | Critical clarifications only |
| 3    | clarify   | Resolve specification ambiguities    | Questions with recommendations |
| 4    | plan      | Create technical implementation plan | None (research-based)       |
| 5    | tasks     | Generate actionable task list        | None                        |
| 6    | analyze   | Check cross-artifact consistency     | Auto-fix loop until clean   |
| 7    | checklist | Create verification checklist        | Scope questions             |
| 8    | implement | Execute all tasks                    | Progress updates only       |
| 9    | verify    | Verify completion and update ROADMAP | None (or USER GATE prompt)  |

## State Management

State file: `.specify/orchestration-state.json`

Use SpecKit CLI for all state operations:
```bash
speckit state validate           # Check if state exists/valid
speckit state get --json         # Read current state
speckit state init --if-missing  # Initialize new state (idempotent)
speckit state set "key=value"    # Update state value
speckit state archive            # Archive completed phase
speckit doctor --fix             # Auto-repair issues
```

State transitions: `pending → in_progress → completed | blocked | failed`

---

## Execution Flow

### 0. Initialize Orchestration Context

**0a. Get Comprehensive Status (ONE CALL)**
```bash
speckit status --json            # Returns everything needed to resume
```

This single call returns:
```json
{
  "health": { "ok": true, "issues": [] },
  "phase": { "number": "0170", "name": "...", "branch": "...", "status": "in_progress" },
  "step": { "current": "implement", "index": 6, "status": "in_progress" },
  "tasks": { "completed": 0, "total": 122, "percentage": 0 },
  "git": { "branch": "...", "matches_state": true, "uncommitted": 3 },
  "artifacts": { "spec": true, "plan": true, "tasks": true, "checklists": true },
  "roadmap": { "phase_status": "in_progress", "matches_state": true },
  "ready": true,
  "next_action": "continue_implement"
}
```

**0b. Handle Status Response**

Check `health.ok`:
- If `false`: Show issues from `health.issues[]`, exit with instructions

Check `ready`:
- If `false`: Handle `next_action` before proceeding

**0c. Handle Arguments**
| Argument | Action |
|----------|--------|
| `continue`/empty | Resume from `step.current` in status |
| `reset` | Clear steps, restart from discover |
| `status` | Display status and exit |
| `skip-to [step]` | Update `orchestration.step.current` and `orchestration.step.index` |
| `--no-discovery` | Skip DISCOVER step, start from specify |

**0d. Auto-Recovery Based on next_action**
| next_action | Recovery |
|-------------|----------|
| `fix_health` | Run `speckit doctor --fix` |
| `fix_branch` | Checkout `phase.branch` (only if branch exists) |
| `archive_phase` | Run `speckit state archive` (ROADMAP shows complete) |
| `sync_roadmap` | Run `speckit reconcile --trust-files` |
| `verify_user_gate` | Phase merged, awaiting user verification - prompt for `/speckit.merge --next-phase` |
| `start_next_phase` | Run `/speckit.merge --next-phase` to archive and start next |
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
- Step > 0: `discovery` should be true (unless --no-discovery)
- Step > 1: `spec` should be true
- Step > 3: `plan` should be true
- Step > 4: `tasks` should be true
- Step > 6: `checklists` should be true

If mismatch: Run `speckit doctor --fix`, reset affected step.

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
| `diagnose` | Run `speckit doctor` to identify issues |
| `abort` | Keep failed state and exit (for manual intervention) |

Recovery commands:
```bash
# For retry:
speckit state set "orchestration.step.status=in_progress"

# For skip:
speckit state set "orchestration.step.status=skipped"
speckit state set "orchestration.step.current={next_step}"
speckit state set "orchestration.step.index={next_index}"

# For diagnose:
speckit doctor
```

**0g. Check Open Issues for Phase**
```bash
speckit issue list --open --phase {phase_number} --json
```

If issues exist:
- Display count and high-priority issues
- These should be addressed during IMPLEMENT step
- Critical issues may block verification

---

### 1. Determine Current Phase

**Initialize state (idempotent - safe to always run):**
```bash
speckit state init --if-missing  # Creates state only if missing, no-op otherwise
```

**If starting a new phase (state exists but no phase in progress):**
```bash
# Get next pending phase from ROADMAP
speckit roadmap next --json      # Returns {"next": "0090", "name": "mvp-poc"}

# Verify phase file exists (modular format)
speckit phase show NNNN          # Get full phase details from .specify/phases/

# Create branch and update state
speckit git branch create "NNNN-phase-name"
speckit state set "orchestration.phase.number=NNNN"
speckit state set "orchestration.phase.name=phase-name"
speckit state set "orchestration.phase.branch=NNNN-phase-name"
speckit state set "orchestration.phase.status=in_progress"
speckit state set "orchestration.step.current=discover"
speckit state set "orchestration.step.index=0"
speckit state set "orchestration.step.status=in_progress"
speckit roadmap update "NNNN" in_progress
```

**Note**: Phase details (Goal, Scope, Deliverables, Verification Gate) are in `.specify/phases/NNNN-phase-name.md`, not inline in ROADMAP.md.

---

### 2. DISCOVER

**Skip condition**: If `--no-discovery` flag is set → skip to SPECIFY.

Check: If `orchestration.step.index > 0` and discovery.md exists → skip to SPECIFY.

**Purpose**: Examine the codebase and clarify scope BEFORE writing specifications. This prevents specs that diverge from existing implementation reality.

**Phase 2a: Codebase Examination**

1. **Load phase context**:
   ```bash
   speckit phase show {phase_number}    # Get phase details from .specify/phases/
   ```

2. **Examine related codebase implementations**:
   - Search for files, functions, and patterns related to this change
   - Look for existing implementations that touch the same area
   - Identify dependencies and integration points
   - Note any patterns or conventions already established

3. **Read relevant requirements sources**:
   - ROADMAP.md phase entry
   - Phase detail file (`.specify/phases/NNNN-*.md`)
   - Related issues (`speckit issue list --phase {phase_number}`)
   - Previous phase handoff files (`.specify/phases/*-handoff.md`)
   - Project memory documents (`constitution.md`, `tech-stack.md`)

4. **Document initial findings**:
   - Create `specs/{phase}/discovery.md` with findings
   - Include: existing code locations, patterns found, integration points, constraints discovered

**Phase 2b: Progressive Clarification Questions**

After examining the codebase, ask clarifying questions to understand user intent:

**Question Guidelines**:
1. **Always provide context** for each question:
   - What you found in the codebase
   - Why this question matters for the implementation
   - Pros/cons of each option
   - Your recommended approach (mark with "Recommended")

2. **Ask progressively** - don't batch all questions upfront:
   - Ask 1-2 questions at a time
   - Wait for answers
   - Research codebase or web based on answers
   - Ask follow-up questions informed by new understanding
   - Maximum 5 rounds of questions total

3. **Do research between questions**:
   - If answer reveals new area, examine that code
   - If answer mentions technology/pattern, do web search if needed
   - Update discovery.md with new findings

4. **Question format** using AskUserQuestion tool:
   ```
   Header: "[Topic]"
   Question: "[Specific question]"
   Options:
     - Label: "[Option A] (Recommended)"
       Description: "Pros: X. Cons: Y. Aligns with existing pattern in [file]."
     - Label: "[Option B]"
       Description: "Pros: X. Cons: Y. Would require changes to [file]."
   ```

**Phase 2c: Verify Understanding**

Before proceeding to SPECIFY:
1. Summarize your understanding of:
   - What the user wants to achieve
   - How it relates to existing code
   - Key constraints and requirements
   - Technical approach (if discussed)

2. Ask user to confirm: "Does this accurately capture your intent?"
   - If yes → proceed to SPECIFY
   - If no → ask what was misunderstood, update discovery.md

**VERIFY BEFORE ADVANCING:**
```bash
# Verify discovery.md was created
ls specs/*/discovery.md || { echo "ERROR: discovery.md not created"; exit 1; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=specify"
speckit state set "orchestration.step.index=1"
```

---

### 3. SPECIFY

**Load discovery context**: If `specs/{phase}/discovery.md` exists, load it for context about existing implementations and user intent.

Check: If `orchestration.step.index > 1` and spec.md exists → skip to CLARIFY.

**Get phase details from modular file:**
```bash
speckit phase show {phase_number}    # Returns full phase details from .specify/phases/
```

Execute `/speckit.specify` logic:
1. Extract Goal, Scope, Deliverables from phase file (via `speckit phase show`)
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

# Run specification gate check
speckit gate specify || { echo "WARN: Gate check found issues"; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=clarify"
speckit state set "orchestration.step.index=2"
```

---

### 4. CLARIFY

**Load discovery context**: Reference `specs/{phase}/discovery.md` for codebase findings and confirmed user intent from DISCOVER phase.

Check: If `orchestration.step.index > 2` and spec.md valid → skip to PLAN.

Execute `/speckit.clarify` logic:
1. Load spec.md AND discovery.md (if exists)
2. Perform ambiguity scan informed by discovery findings
3. Generate max 5 prioritized questions (skip questions already answered in DISCOVER)

For each question, use `AskUserQuestion`:
- Include recommended option with reasoning
- Show options table with implications
- Reference relevant discovery findings when applicable
- Default behavior if no response

**VERIFY BEFORE ADVANCING:**
- Confirm clarifications were added to spec.md OR no clarifications were needed

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=plan"
speckit state set "orchestration.step.index=3"
```

---

### 5. PLAN

Check: If `orchestration.step.index > 3` and plan.md exists → skip to TASKS.

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

# Run plan gate check
speckit gate plan || { echo "WARN: Gate check found issues"; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=tasks"
speckit state set "orchestration.step.index=4"
```

---

### 6. TASKS

Check: If `orchestration.step.index > 4` and tasks.md exists → skip to ANALYZE.

Execute `/speckit.tasks` logic:
1. Load plan.md, spec.md, data-model.md, contracts/
2. Generate tasks organized by user story
3. Format: `- [ ] T### [P?] [US?] Description with file path`
4. Generate dependency graph

**VERIFY BEFORE ADVANCING:**
```bash
# Verify tasks.md was created
ls specs/*/tasks.md || { echo "ERROR: tasks.md not created"; exit 1; }

# Run tasks gate check
speckit gate tasks || { echo "WARN: Gate check found issues"; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=analyze"
speckit state set "orchestration.step.index=5"
```

---

### 7. ANALYZE (Auto-Fix Loop)

**MANDATORY STEP - DO NOT SKIP**

Check: If `orchestration.step.index > 5` → re-run quick analysis, skip if clean.

**IMPORTANT**: This step performs analysis INLINE (do NOT run `speckit analyze` as a CLI command - it doesn't exist). Follow the analysis logic below:

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
speckit state set "orchestration.step.current=checklist"
speckit state set "orchestration.step.index=6"
```

---

### 8. CHECKLIST

**MANDATORY STEP - DO NOT SKIP**

Check: If `orchestration.step.index > 6` and checklists/ has files → skip to IMPLEMENT.

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
speckit state set "orchestration.step.index=7"
```

---

### 9. IMPLEMENT

Check: If `orchestration.step.index > 7`:
```bash
speckit tasks status --json
```
If completed == total → skip to VERIFY.

**Initialize lessons tracking (if not exists):**
```bash
speckit lessons init          # Create lessons-learned.md for this phase
```

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
4. **Record significant errors to lessons:**
   ```bash
   speckit lessons add error "Brief description of error"
   ```

**Issue Discovery During Implementation:**

When discovering bugs, improvements, or technical debt that's not blocking current work:
```bash
# Create issue for later
speckit issue create "Description of issue" \
  --category bug|improvement|debt \
  --priority high|medium|low \
  --phase {current_phase_or_future}

# Example: Found UX issue not in scope
speckit issue create "Button alignment inconsistent on mobile" \
  --category improvement \
  --priority medium \
  --phase 0050
```

**Address Phase Issues:**

Check for open issues assigned to current phase:
```bash
speckit issue list --open --phase {phase_number}
```

For each high-priority issue:
1. Attempt to resolve as part of current implementation
2. If resolved: `speckit issue close ISSUE-XXX --resolution "Fixed in task T###"`
3. If cannot resolve: Leave open with notes, mention in verify step

**VERIFY BEFORE ADVANCING:**
```bash
# Verify all tasks are complete
speckit tasks status --json | grep -q '"incomplete": 0' || { echo "ERROR: Not all tasks complete"; exit 1; }

# Run implement gate check (verifies tests pass if configured)
speckit gate implement || { echo "WARN: Gate check found issues"; }
```

Update state (only after verification passes):
```bash
speckit state set "orchestration.step.current=verify"
speckit state set "orchestration.step.index=8"
```

---

### 10. VERIFY

**Capture lessons learned before verification:**
```bash
# Review and add any significant decisions or gotchas
speckit lessons add decision "Chose X over Y because..."  # Architecture choices
speckit lessons add gotcha "Technology" "Issue" "Workaround"  # Platform quirks
speckit lessons list                                        # Review captured lessons
```

Execute `/speckit.verify` logic:
1. Task completion verification
2. Memory document compliance check
3. Checklist verification
4. Deferred items identification
5. Lessons learned review (prompt to add if lessons-learned.md is sparse)
6. **Issue resolution check**

**Check Unresolved Phase Issues:**
```bash
speckit issue list --open --phase {phase_number} --json
```

If open issues remain:
- **Critical/High priority**: Must resolve before completing phase
- **Medium/Low priority**: Can defer to future phase - update issue:
  ```bash
  speckit issue update ISSUE-XXX --phase {next_phase}
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
Run `/speckit.merge --next-phase` when ready to complete this phase and start the next.
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

### 11. Phase Transition

For non-USER GATE phases that pass verification, delegate to `/speckit.merge`:

```text
Phase verification complete!

Run `/speckit.merge` to complete this phase.
Or run `/speckit.merge --next-phase` to complete and start the next phase.
```

**Note**: `/speckit.merge` handles all phase completion tasks:
- Push branch and create PR
- Merge PR to main
- Archive state and phase details
- Update ROADMAP
- (with --next-phase) Create branch and initialize next phase

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
| Phase: 0010 - project-architecture-setup                 |
| Branch: 0010-project-architecture-setup                  |
| Status: In Progress                                      |
| Details: .specify/phases/0010-project-architecture-setup.md |
+----------------------------------------------------------+
| Step        | Status     | Artifacts                     |
+-------------+------------+-------------------------------+
| 1. discover | Complete   | discovery.md                  |
| 2. specify  | Complete   | spec.md, requirements.md      |
| 3. clarify  | Complete   | spec.md (5 clarifications)    |
| 4. plan     | Complete   | plan.md, research.md          |
| 5. tasks    | Complete   | tasks.md (47 tasks)           |
| 6. analyze  | Complete   | Clean (3 iterations)          |
| 7. checklist| Current    | verification.md               |
| 8. implement| Pending    | -                             |
| 9. verify   | Pending    | -                             |
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
