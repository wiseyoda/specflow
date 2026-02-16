---
description: Orchestrate the complete SpecFlow workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `.specflow/orchestration-state.json` directly** - Use `specflow state set`
2. **NEVER edit `tasks.md` to mark tasks complete** - Use `specflow mark T###`
3. **NEVER skip steps** - Execute in order: design → analyze → implement → verify
4. **ALWAYS verify step completion** before advancing to next step
5. **ALWAYS use the SpecFlow CLI** for all state and task operations
6. **NEVER STOP between steps** - This is a CONTINUOUS workflow. After completing each step, immediately continue to the next step. Only stop at USER GATEs or when all steps are complete.
7. **Use `specflow` directly, NOT `npx specflow`** - The CLI is installed at `~/.claude/specflow-system/bin/specflow`, not an npm package.

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

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections within downstream commands (`/flow.design`, `/flow.analyze`, `/flow.implement`, `/flow.verify`, `/flow.merge`) when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, downstream commands must fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

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
| analyze | 1 | `/flow.analyze` | Cross-artifact consistency | Auto-fix loop |
| implement | 2 | `/flow.implement` | Execute all tasks | Progress updates |
| verify | 3 | `/flow.verify` | Verify completion | USER GATE if applicable |

---

## Execution Flow

### 0. Initialize

**Create the master todo list immediately (use TodoWrite):**

1. [ORCH] INITIALIZE - Get project status
2. [ORCH] PHASE - Determine/open current phase and load phase goals
3. [ORCH] DESIGN - Create all design artifacts (mapped to phase goals)
4. [ORCH] ANALYZE - Cross-artifact consistency check (verify goal coverage)
5. [ORCH] IMPLEMENT - Execute all tasks (track goal completion)
6. [ORCH] VERIFY - Verify completion against phase goals

Set item 1 to in_progress, then proceed.

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

**Validate domain state on resume (cross-domain consistency):**

Use `step.index` from the `specflow status --json` output above (do NOT call `state get` for this value):

```bash
# STEP_INDEX = step.index from specflow status --json output above

# If resuming at analyze or later, verify design initialized its domain
if [[ "$STEP_INDEX" -ge 1 ]]; then
  GOALS=$(specflow state get orchestration.phase.goals 2>/dev/null)
  if [[ -z "$GOALS" || "$GOALS" == "null" || "$GOALS" == "[]" ]]; then
    echo "ERROR: Design step did not initialize phase.goals"
    echo "Re-run /flow.design or manually set: specflow state set orchestration.phase.goals='[...]'"
    exit 1
  fi
fi

# If resuming at verify, check implement domain was initialized
if [[ "$STEP_INDEX" -ge 3 ]]; then
  IMPL_START=$(specflow state get orchestration.implement.started_at 2>/dev/null)
  if [[ -z "$IMPL_START" || "$IMPL_START" == "null" ]]; then
    echo "WARNING: Implement tracking not initialized - progress may be incomplete"
  fi
fi
```

**Route based on `nextAction`:**

| nextAction | Action |
|------------|--------|
| `fix_health` | Run `specflow check --fix`, re-check status |
| `start_phase` | Go to Section 1 (Determine Phase) |
| `run_design` | Go to Section 2 (DESIGN) |
| `run_analyze` | Go to Section 3 (ANALYZE) |
| `continue_implement` | Go to Section 4 (IMPLEMENT) |
| `run_verify` | Go to Section 5 (VERIFY) |
| `ready_to_merge` | Go to Section 6 (Phase Transition) - ready for `/flow.merge` |
| `awaiting_user_gate` | Display USER GATE prompt, wait for approval |
| `archive_phase` | Phase already complete - run `specflow phase close` or start next phase |

**Handle arguments:**

| Argument | Action |
|----------|--------|
| `status` | Display status and exit |
| `reset` | `specflow state set orchestration.step.current=design orchestration.step.index=0 orchestration.step.status=in_progress`, resume |
| `skip-to X` | `specflow state set orchestration.step.current=X orchestration.step.index=N orchestration.step.status=in_progress`, resume |

**Step index mapping** (source of truth: `packages/shared/src/schemas/events.ts`):
```
STEP_INDEX_MAP = { design: 0, analyze: 1, implement: 2, verify: 3 }
```
Valid steps: `design`, `analyze`, `implement`, `verify`

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

**Validate phase exists in ROADMAP (if phase.number is set):**

Use `phase.number` and `phase.branch` from the `specflow status --json` output above (do NOT call `state get` for these values):

```bash
# PHASE_NUMBER = phase.number from specflow status --json output above
# EXPECTED_BRANCH = phase.branch from specflow status --json output above

if [[ -n "$PHASE_NUMBER" && "$PHASE_NUMBER" != "null" ]]; then
  # Verify phase exists in ROADMAP
  if ! grep -q "^| $PHASE_NUMBER " ROADMAP.md; then
    echo "ERROR: Phase $PHASE_NUMBER not found in ROADMAP.md"
    echo "Phase may have been archived or ROADMAP is out of sync"
    exit 1
  fi

  # Verify current branch matches phase branch
  CURRENT_BRANCH=$(git branch --show-current)
  if [[ -n "$EXPECTED_BRANCH" && "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "ERROR: Branch mismatch"
    echo "Expected: $EXPECTED_BRANCH (from state)"
    echo "Current: $CURRENT_BRANCH"
    echo "Run: git checkout $EXPECTED_BRANCH"
    exit 1
  fi
fi
```

**If no active phase** (phase.number is null):

Automatically start the next phase from ROADMAP (do NOT ask for confirmation):

```bash
if ! specflow phase open; then
  echo "ERROR: Failed to start next phase from ROADMAP.md"
  exit 1
fi

# Refresh status after opening phase
specflow status --json
```

Then continue orchestration from the updated status.

**If phase exists but step is null:**

```bash
specflow state set orchestration.step.current=design orchestration.step.index=0 orchestration.step.status=in_progress
```

**Load phase document (SOURCE OF TRUTH):**

Read `.specify/phases/NNNN-phase-name.md` and extract:

| Field | Purpose | Track Throughout |
|-------|---------|------------------|
| **Goals** | What this phase must accomplish | ✓ Map to spec requirements |
| **Scope** | What's in and out of scope | ✓ Validate during analyze |
| **Deliverables** | Expected outputs | ✓ Verify in verify step |
| **Verification Gate** | How success is measured | ✓ Check before merge |
| **USER GATE** | If present, requires user confirmation | ✓ Block merge until confirmed |

**Persist goals to state** (survives conversation compaction):

```bash
# phase.number, hasUserGate, and userGateCriteria are already set by `specflow phase open`
# Only goals need to be persisted here (extracted from phase doc, not available in ROADMAP)
specflow state set orchestration.phase.goals='["Goal 1", "Goal 2", ...]'
```

**Check for integration architecture (if design complete):**
```bash
FEATURE_DIR=$(specflow state get orchestration.phase.featureDir 2>/dev/null)
if grep -q "## Integration Architecture" "${FEATURE_DIR}/plan.md" 2>/dev/null; then
  specflow state set orchestration.phase.hasIntegrationArchitecture=true
fi
```

**Goals flow through each step** (retrieved from state if context lost):
- DESIGN: Goals → spec requirements → tasks
- ANALYZE: Verify all goals have coverage in tasks
- IMPLEMENT: Track which goals are being addressed
- VERIFY: Confirm all goals were achieved

To retrieve goals after compaction: `specflow state get orchestration.phase.goals`

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

**Goal coverage checkpoint:**

Before advancing, verify phase goals from `.specify/phases/NNNN-*.md` are covered:
- Each goal should have corresponding requirement(s) in spec.md
- Each requirement should have implementing task(s) in tasks.md
- If goals are missing coverage, `/flow.design` should have caught this - re-run if needed

If gate passes:

1. Use TodoWrite: mark [ORCH] DESIGN complete, mark [ORCH] ANALYZE in_progress
2. Update state:
   ```bash
   specflow state set orchestration.step.current=analyze orchestration.step.index=1 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to ANALYZE** - DO NOT STOP

---

### 3. ANALYZE (Step 1)

**MANDATORY STEP - DO NOT SKIP**

**Execute `/flow.analyze`** which handles:
- 8-pass detection (goals, duplication, ambiguity, coverage, constitution)
- Auto-fix loop (max 5 iterations) with parallel file fixing agents
- State tracking for iteration count (survives compaction)

**Check:** If `step.index > 1` → `/flow.analyze` runs quick analysis, skips if clean.

**Critical check**: Pass A (phase goals) and Pass E (constitution) are mandatory - if either times out, `/flow.analyze` will HALT.

**Verify before advancing:**

```bash
STATUS=$(specflow state get orchestration.step.status 2>/dev/null)
```

If `status == "complete"`:
1. Use TodoWrite: mark [ORCH] ANALYZE complete, mark [ORCH] IMPLEMENT in_progress
2. Update state:
   ```bash
   specflow state set orchestration.step.current=implement orchestration.step.index=2 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to IMPLEMENT** - DO NOT STOP

If `status == "blocked"`:
- Present issues to user: "Analysis found unresolvable issues"
- Options: Retry analysis, Fix manually, Abort orchestration
3. **IMMEDIATELY continue to IMPLEMENT** - DO NOT STOP

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

**Wiring warning check:**
```bash
ORPHANS=$(specflow state get orchestration.implement.orphanedExports 2>/dev/null)
if [[ -n "$ORPHANS" && "$ORPHANS" != "null" && "$ORPHANS" != "[]" ]]; then
  specflow state set orchestration.implement.hasWiringWarnings=true
fi
```

If gate passes:

1. Use TodoWrite: mark [ORCH] IMPLEMENT complete, mark [ORCH] VERIFY in_progress
2. Update state:
   ```bash
   specflow state set orchestration.step.current=verify orchestration.step.index=3 orchestration.step.status=in_progress
   ```
3. **IMMEDIATELY continue to VERIFY** - DO NOT STOP

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
- **Phase goals verification** - confirms all goals from phase doc were achieved
- Memory document compliance
- Checklist verification
- Deferred items documentation

**Check for deferred items:**

If items were deferred during implementation, verify they're in BACKLOG.md:

```bash
specflow phase defer --list
```

**USER GATE handling:**

See `.specify/templates/user-gate-guide.md` for the complete USER GATE handling protocol.

If phase has USER GATE (check `phase.hasUserGate` from status):

First, check if already handled:
```bash
GATE_STATUS=$(specflow state get orchestration.phase.userGateStatus)
```

If `userGateStatus` is `confirmed` or `skipped`, proceed to Phase Transition.

**If gate is pending, generate a non-developer verification guide first:**

Build from:
- `README.md` / docs quickstart
- `package.json` scripts (`dev`, `start`, `preview`)
- `Makefile` / `justfile` targets (if present)
- `.env.example` / `.env.sample` setup
- USER GATE criteria from phase doc

Guide requirements:
1. Copy/paste setup commands
2. Exact start command
3. URL and login path (if needed)
4. Numbered manual test steps mapped to gate criteria
5. Expected result for each step
6. Basic troubleshooting notes

**If gate is pending**, use standardized `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "Phase {number} has a USER GATE requiring your verification.\n\nGate Criteria:\n{criteria from phase doc}\n\nHave you verified the implementation meets these criteria?",
    "header": "User Gate",
    "options": [
      {"label": "Yes, verified (Recommended)", "description": "I have tested and confirmed the gate criteria are met"},
      {"label": "Show details", "description": "Show copy/paste setup + click-by-click verification steps"},
      {"label": "Skip gate", "description": "Proceed without user verification (not recommended)"}
    ],
    "multiSelect": false
  }]
}
```

**Handle response:**

| Response | Action |
|----------|--------|
| **Yes, verified** | `specflow state set orchestration.phase.userGateStatus=confirmed` → Proceed to Phase Transition |
| **Show details** | Display generated guide: setup, start command, URL/login, numbered checks with expected outcomes, troubleshooting; then re-ask |
| **Skip gate** | `specflow state set orchestration.phase.userGateStatus=skipped` → Proceed (log reason) |

Do NOT auto-advance without user response. Wait for explicit confirmation.

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
- Provide a post-merge, non-developer test path for what was just shipped
- (with --next-phase) Start next phase

---

## Operating Principles

1. **Self-Healing**: Run `specflow check --fix` when inconsistencies detected
2. **Minimal Interaction**: Use recommended options when no response. Batch questions. Auto-fix before asking.
3. **Memory Compliance**: Pre-check against constitution.md. Auto-correct violations when possible.
4. **Context Efficiency**: Use `specflow status --json` for all context. Save state after each action.
5. **Master Todo List**: The 6-item [ORCH] todo list keeps workflow moving. Use TodoWrite to mark items complete/in_progress as you transition. Sub-workflows (design, implement, verify) create their own todo lists when called.
6. **State Ownership**: Orchestrate owns step transitions. See below.

## State Ownership Pattern

**Orchestrate is the OWNER of step transitions.** Sub-commands follow these rules:

| State Field | Owner | Sub-command Behavior |
|-------------|-------|---------------------|
| `step.current` | Orchestrate | Only set if null/empty (standalone mode) |
| `step.index` | Orchestrate | Only set if null/empty (standalone mode) |
| `step.status` | Sub-command | Set to: `in_progress`, `complete`, `failed` |
| `phase.*` | Orchestrate | Read-only for sub-commands |

**Valid step values**: `design`, `analyze`, `implement`, `verify`
**Valid status values**: `in_progress`, `complete`, `failed`, `blocked`

**How it works:**
1. Orchestrate sets `step.current=design`, `step.index=0`, `step.status=in_progress`
2. `/flow.design` runs, sets `step.status=complete` when done
3. Orchestrate detects `status=complete`, advances to `step.current=analyze`, `step.index=1`
4. Repeat for each step

**Standalone mode**: When sub-commands run directly (not via orchestrate), they check if `step.current` is empty and initialize it. This allows both orchestrated and standalone execution.

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

See `.specify/templates/error-recovery-guide.md` for the complete error recovery protocol.

| Error | Severity | Recovery |
|-------|----------|----------|
| State corrupted | RECOVERABLE | Run `specflow check --fix`, rebuild from artifacts |
| Branch mismatch | RECOVERABLE | Checkout `phase.branch` from status |
| Branch deleted (post-merge) | RECOVERABLE | Check ROADMAP, run `specflow phase close` |
| Missing artifact | RECOVERABLE | Re-run producing step (design/analyze) |
| ROADMAP missing | CRITICAL | Halt, instruct user to run `/flow.roadmap` |
| Constitution violation | CRITICAL | Halt, ask user for decision |
| All tasks blocked | CRITICAL | Halt, report blockers, ask user |

### Error Recovery Invocation

When a sub-command fails, apply the standard recovery pattern:

```
1. DETECT: Check exit status or state after sub-command
   - If `step.status=failed` → Error occurred
   - If `specflow check --gate X` fails → Gate error

2. LOG: Record the error context
   specflow state set orchestration.lastError="Description"

3. DECIDE: Based on severity from error table above
   - CRITICAL: Halt immediately, report to user
   - RECOVERABLE: Attempt recovery action from table
   - WARNING: Log and continue

4. RECOVER: Execute recovery action
   - State corrupted → `specflow check --fix`
   - Missing artifact → Re-run producing step
   - Branch mismatch → `git checkout $(specflow state get orchestration.phase.branch)`

5. RESUME: After recovery
   - Re-run the failed sub-command (max 2 retries)
   - If still failing after retries, escalate to CRITICAL
```

**On CRITICAL error**: Set `specflow state set orchestration.step.status=failed`
**On RECOVERABLE error**: Attempt recovery, keep status as `in_progress`

### User Communication on Error

Use `AskUserQuestion` for CRITICAL errors:

```json
{
  "questions": [{
    "question": "CRITICAL: {error description}\\n\\nWhat happened: {details}\\nHow to fix: {recovery steps}",
    "header": "Error",
    "options": [
      {"label": "Retry (Recommended)", "description": "Attempt recovery and retry"},
      {"label": "Skip step", "description": "Skip this step and continue (may cause issues)"},
      {"label": "Abort", "description": "Stop orchestration and fix manually"}
    ],
    "multiSelect": false
  }]
}
```

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
