---
description: Orchestrate the complete SpecFlow workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `.specify/orchestration-state.json` directly** - Use `specflow state set`
2. **NEVER edit `tasks.md` to mark tasks complete** - Use `specflow mark T###`
3. **NEVER skip steps** - Execute in order: design → analyze → implement → verify
4. **ALWAYS verify step completion** before advancing to next step
5. **ALWAYS use the SpecFlow CLI** for all state and task operations
6. **NEVER STOP between steps** - This is a CONTINUOUS workflow. After completing each step, immediately continue to the next step. Only stop at USER GATEs or when all steps are complete.

If you find yourself about to use the Edit tool on state files or tasks.md, STOP and use the CLI instead.

**CONTINUOUS EXECUTION**: Orchestration runs design → analyze → implement → verify in ONE session. Do not stop to ask "should I continue?" or report intermediate completion. Keep going until you reach a USER GATE or finish verify.

## User Input

```text
$ARGUMENTS
```

| Argument | Action |
|----------|--------|
| (empty) or `continue` | Resume from current state |
| `reset` | Clear state and restart current phase |
| `status` | Show status only, don't execute |
| `skip-to [step]` | Skip to step (design, analyze, implement, verify) |

## Goal

Execute the complete SpecFlow development workflow with:
1. **State persistence** - Survives conversation compaction
2. **Self-healing** - Detects and recovers from inconsistencies
3. **Minimal user interaction** - Only asks when truly necessary
4. **Auto-fix loop** - Fixes ALL issues found during analyze until clean

## Workflow Overview

| Step | Index | Command | Purpose | User Interaction |
|------|-------|---------|---------|------------------|
| design | 0 | `/flow.design` | Create all design artifacts | Progressive questions |
| analyze | 1 | Inline | Cross-artifact consistency | Auto-fix loop |
| implement | 2 | `/flow.implement` | Execute all tasks | Progress updates |
| verify | 3 | `/flow.verify` | Verify completion | USER GATE if applicable |

---

## Execution Flow

### 0. Initialize

**Get comprehensive status in ONE call:**

```bash
specflow status --json
```

Response structure:
```json
{
  "phase": { "number": "0080", "name": "cli-migration", "branch": "0080-cli-migration", "status": "in_progress", "hasUserGate": false },
  "step": { "current": "implement", "index": 2, "status": "in_progress" },
  "progress": { "tasksCompleted": 12, "tasksTotal": 47, "percentage": 25 },
  "health": { "status": "ok", "issues": [] },
  "nextAction": "continue_implement",
  "blockers": [],
  "context": { "featureDir": "specs/0080-cli-migration", "hasSpec": true, "hasPlan": true, "hasTasks": true, "hasChecklists": true }
}
```

**Handle health issues first:**
- If `health.status` = "error": Run `specflow check --fix`, then re-check status

**Route based on `nextAction`:**

| nextAction | Action |
|------------|--------|
| `fix_health` | Run `specflow check --fix`, re-check status |
| `start_phase` | Go to Section 1 (Determine Phase) |
| `run_design` | Go to Section 2 (DESIGN) |
| `run_analyze` | Go to Section 3 (ANALYZE) |
| `continue_implement` | Go to Section 4 (IMPLEMENT) |
| `run_verify` | Go to Section 5 (VERIFY) |
| `ready_to_merge` | Go to Section 6 (Phase Transition) |
| `awaiting_user_gate` | Display USER GATE prompt, wait for approval |
| `archive_phase` | Run `specflow phase close`, then start next phase |

**Handle arguments:**

| Argument | Action |
|----------|--------|
| `status` | Display status and exit |
| `reset` | `specflow state set orchestration.step.current=design orchestration.step.index=0 orchestration.step.status=in_progress`, resume |
| `skip-to X` | `specflow state set orchestration.step.current=X orchestration.step.index=N orchestration.step.status=in_progress`, resume |

**Step index mapping:** design=0, analyze=1, implement=2, verify=3

**Failed step recovery:**

If `step.status` = "failed", present options to user:

| Option | Action |
|--------|--------|
| Retry | `specflow state set orchestration.step.status=in_progress`, retry step |
| Skip | Advance to next step (use with caution) |
| Diagnose | Run `specflow check`, show issues |
| Abort | Exit for manual intervention |

---

### 1. Determine Current Phase

**If no active phase** (phase.number is null):

```bash
# Start next phase from ROADMAP
specflow phase open
```

This command:
- Reads ROADMAP.md to find next pending phase
- Creates feature branch
- Initializes state with phase info
- Sets step to design (index 0)

**If phase exists but step is null:**

```bash
specflow state set orchestration.step.current=design orchestration.step.index=0 orchestration.step.status=in_progress
```

**Verify phase file exists:**

Read `.specify/phases/NNNN-phase-name.md` to get:
- Goal
- Scope
- Deliverables
- Verification Gate

---

### 2. DESIGN (Step 0)

**Check:** If `step.index > 0` and all artifacts exist (`context.hasSpec/hasPlan/hasTasks/hasChecklists` all true) → skip to ANALYZE.

**Execute `/flow.design`** which produces ALL design artifacts:
- discovery.md - codebase examination, clarified intent
- spec.md - feature specification
- plan.md - technical implementation plan
- tasks.md - actionable task list
- checklists/implementation.md
- checklists/verification.md

See `/flow.design` for full details.

**Verify before advancing:**

```bash
specflow check --gate design
```

If gate passes:

1. **Update todo list** with ANALYZE tasks (e.g., "Run cross-artifact analysis", "Fix consistency issues")
2. **Update state**:
   ```bash
   specflow state set orchestration.step.current=analyze orchestration.step.index=1 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to Section 3 (ANALYZE)** - DO NOT STOP

---

### 3. ANALYZE (Step 1)

**MANDATORY STEP - DO NOT SKIP**

**Check:** If `step.index > 1` → run quick analysis, skip if clean.

Perform cross-artifact analysis on spec.md, plan.md, and tasks.md with **AUTO-FIX LOOP**:

```
MAX_ITERATIONS = 5
iteration = 0

WHILE issues_exist AND iteration < MAX_ITERATIONS:
  1. Run `/flow.analyze` to collect issues
  2. For EACH issue: Apply fix automatically
  3. Re-run analysis
  4. iteration++

IF max iterations reached with issues remaining:
  - Present remaining issues to user
  - Mark as "blocked" if user declines to fix
```

**Auto-fix strategies:**

| Issue Type | Fix Strategy |
|------------|--------------|
| Duplication | Keep higher-quality version |
| Ambiguity | Add measurable criteria |
| Coverage gap | Add task or requirement |
| Constitution violation | Modify to comply OR flag for user |

**Verify before advancing:**
- Analysis must complete with no critical issues

1. **Update todo list** with IMPLEMENT tasks (e.g., "Execute tasks from tasks.md", "Run tests after each task")
2. **Update state**:
   ```bash
   specflow state set orchestration.step.current=implement orchestration.step.index=2 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to Section 4 (IMPLEMENT)** - DO NOT STOP

---

### 4. IMPLEMENT (Step 2)

**Check:** If `step.index > 2`, verify tasks complete:

```bash
specflow status --json
```

If `progress.tasksCompleted == progress.tasksTotal` → skip to VERIFY.

**Execute `/flow.implement`** which handles:
- TDD workflow (test first, then implement)
- Task execution in dependency order
- Progress tracking

**Task loop (core of implementation):**

```bash
# Get next task
specflow next --json

# Response includes:
# - action: "implement_task" or "none"
# - task: { id, description, section, files }
# - hints: { filesMentioned, testFiles }
# - queue: { totalRemaining }

# After completing each task:
specflow mark T###
```

**Progress tracking:**
- Use `specflow next --json` to get current task
- Use `specflow mark T###` to mark complete
- Commit periodically: `git commit -m "feat: implement T001-T010"`

**Error recovery:**
1. Log error, attempt 1 retry with different approach
2. If still fails: `specflow mark T### --blocked "reason"`, continue with non-dependent tasks
3. If critical path blocked: Halt, report, set step status to blocked

**Discovered issues during implementation:**

When you find bugs, improvements, or tech debt not blocking current work:

```bash
specflow phase defer "Description of issue"
```

This adds to BACKLOG.md for future phases.

**Verify before advancing:**

```bash
specflow check --gate implement
```

If gate passes:

1. **Update todo list** with VERIFY tasks (e.g., "Run verification checklists", "Check memory compliance")
2. **Update state**:
   ```bash
   specflow state set orchestration.step.current=verify orchestration.step.index=3 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to Section 5 (VERIFY)** - DO NOT STOP

---

### 5. VERIFY (Step 3)

**Capture lessons learned:**

Before verification, record significant decisions or gotchas in `specs/NNNN-phase/lessons-learned.md`:

```markdown
## Lessons Learned

### Decisions
- Chose X over Y because...

### Gotchas
- Platform quirk: Issue → Workaround

### Patterns
- Useful pattern discovered...
```

**Execute `/flow.verify`** which handles:
- Task completion verification
- Memory document compliance
- Checklist verification
- Deferred items documentation

**Check for deferred items:**

If items were deferred during implementation, verify they're in BACKLOG.md:

```bash
specflow phase defer --list
```

**USER GATE handling:**

If phase has USER GATE (check `phase.hasUserGate` from status):

```
## User Verification Required

Phase: {phase.number} - {phase.name}

**What to Test**: [Verification criteria from phase file]
**How to Test**: [Instructions for accessing POC/test page]

Please verify the implementation meets your expectations.
When ready, run `/flow.merge` to complete this phase.
```

Set status and wait:
```bash
specflow state set orchestration.phase.status=awaiting_user_gate
```

Do NOT auto-advance. Wait for user to run `/flow.merge`.

**Non-USER GATE phases:**

Verify all checks pass, then proceed to Phase Transition.

---

### 6. Phase Transition

**For phases that pass verification:**

```
Phase verification complete!

Run `/flow.merge` to complete this phase.
Or run `/flow.merge --next-phase` to complete and start the next phase.
```

**`/flow.merge` handles:**
- Push branch and create PR
- Merge PR to main
- Update ROADMAP.md status
- Archive state
- (with --next-phase) Start next phase

---

## Operating Principles

1. **Self-Healing**: Run `specflow check --fix` when inconsistencies detected
2. **Minimal Interaction**: Use recommended options when no response. Batch questions. Auto-fix before asking.
3. **Memory Compliance**: Pre-check against constitution.md. Auto-correct violations when possible.
4. **Context Efficiency**: Use `specflow status --json` for all context. Save state after each action.
5. **Todo List Continuity**: When transitioning between steps, ALWAYS update the TodoWrite list with tasks for the next step BEFORE marking current step complete. Never let the todo list become empty mid-workflow.

## Status Display

```
╔══════════════════════════════════════════════════════════════╗
║ SpecFlow Orchestration                                        ║
╠══════════════════════════════════════════════════════════════╣
║ Phase: 0080 - cli-typescript-migration                        ║
║ Branch: 0080-cli-typescript-migration                         ║
║ Status: In Progress                                           ║
╠══════════════════════════════════════════════════════════════╣
║ Step         │ Status     │ Progress                          ║
╠──────────────┼────────────┼───────────────────────────────────╣
║ 0. design    │ ✓ Complete │ All artifacts created             ║
║ 1. analyze   │ ✓ Complete │ Clean (2 iterations)              ║
║ 2. implement │ ▶ Current  │ 12/47 tasks (25%)                 ║
║ 3. verify    │ ○ Pending  │ -                                 ║
╚══════════════════════════════════════════════════════════════╝
```

## Error Handling

| Error | Recovery |
|-------|----------|
| State corrupted | Run `specflow check --fix`, rebuild from artifacts |
| Branch mismatch | Checkout `phase.branch` from status |
| Branch deleted (post-merge) | Check ROADMAP, run `specflow phase close` |
| Missing artifact | Re-run producing step (design/analyze) |
| ROADMAP missing | Halt, instruct user to run `/flow.roadmap` |
| Constitution violation | Halt, ask user for decision |
| All tasks blocked | Halt, report blockers, ask user |

## CLI Quick Reference

```bash
# Status and context
specflow status --json          # Everything needed to resume

# Task operations
specflow next --json            # Get next task with context
specflow mark T007              # Mark task complete
specflow mark T007 --blocked "reason"  # Mark blocked

# Validation
specflow check --fix            # Self-heal issues
specflow check --gate design    # Verify design artifacts
specflow check --gate implement # Verify all tasks complete
specflow check --gate verify    # Verify checklists complete

# Phase lifecycle
specflow phase open             # Start next phase from ROADMAP
specflow phase close            # Complete current phase
specflow phase defer "item"     # Add to backlog

# State operations
specflow state set key=value    # Update state
specflow state get key          # Read state value
```

## Context

$ARGUMENTS
