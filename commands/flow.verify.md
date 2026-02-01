---
description: Verify feature completion, compliance with memory documents, checklist status, and readiness for merge.
handoffs:
  - label: Start Next Feature
    agent: specflow.specify
    prompt: Create a specification for the next feature. I want to build...
  - label: Continue Orchestration
    agent: specflow.orchestrate
    prompt: Continue to the next phase
  - label: Continue Later
    agent: specflow.orchestrate
    prompt: Resume development workflow
---

## User Input

```text
$ARGUMENTS
```

Arguments:

- Empty: Run full verification (tasks, checklists, memory, user gate)
- `--dry-run`: Preview verification without updating state
- `--skip-memory`: Skip memory document compliance check

You **MUST** consider the user input before proceeding (if not empty).

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Implement gate passed | `specflow check --gate implement` | Run `/flow.implement` |
| All tasks complete | `specflow status --json` → `progress.percentage == 100` | Complete remaining tasks |
| Checklists exist | `specs/NNNN-name/checklists/` | Run `/flow.design --checklist` |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |
| Git branch | `git branch --show-current` | Should be on phase branch |

**Path clarification**:
- Artifacts (spec.md, plan.md, tasks.md, checklists/): `specs/NNNN-name/` from `context.featureDir`
- Phase definition (goals, scope): `.specify/phases/NNNN-*.md`

## Goal

Verify a completed feature phase is ready for merge:

1. All tasks complete (or explicitly deferred)
2. All checklists pass
3. Implementation complies with memory documents
4. User gate satisfied (if applicable)

**Note**: This command verifies readiness but does NOT close the phase. Use `/flow.merge` to close, push, and merge.

---

## Step 0: Create Todo List

**Create todo list immediately (use TodoWrite):**

1. [VERIFY] CONTEXT - Get project status and load phase artifacts
2. [VERIFY] IMPL_GATE - Verify all tasks complete
3. [VERIFY] VERIFY_GATE - Complete all checklists
4. [VERIFY] PHASE_GOALS - Verify against original phase goals
5. [VERIFY] MEMORY - Check against memory docs
6. [VERIFY] REPORT - Mark verified and report

Set [VERIFY] CONTEXT to in_progress.

## Step 1: Get Project Context

**Ensure step is initialized (standalone mode):**

```bash
CURRENT_STEP=$(specflow state get orchestration.step.current 2>/dev/null)

# Only set step.current if missing or different (standalone mode)
if [[ -z "$CURRENT_STEP" || "$CURRENT_STEP" == "null" || "$CURRENT_STEP" != "verify" ]]; then
  specflow state set orchestration.step.current=verify orchestration.step.index=3
fi

specflow state set orchestration.step.status=in_progress
```

```bash
specflow status --json
```

Parse the JSON to understand:

- Current phase number and name
- Active feature directory
- Task completion status
- Checklist status
- Whether phase has USER GATE marker

If no active phase, stop: "No active phase. Use `specflow phase open` first."

**Extract key values from status output:**

```bash
# From specflow status --json:
FEATURE_DIR=$(... | jq -r '.context.featureDir')   # e.g., /path/to/project/specs/0060-github-integration
PHASE_NUMBER=$(... | jq -r '.phase.number')        # e.g., "0060"
```

**Load phase artifacts:**

- `.specify/phases/${PHASE_NUMBER}-*.md` - Original phase goals and scope (definition document)
- `${FEATURE_DIR}/spec.md` - Requirements and acceptance criteria
- `${FEATURE_DIR}/ui-design.md` (if exists) - UI component specifications

These documents define what the phase INTENDED to accomplish and will be verified against in Step 3.

**Check for spec.md drift (re-run analyze if modified):**

```bash
ANALYZE_TIME=$(specflow state get orchestration.analyze.completedAt 2>/dev/null)
SPEC_PATH="${FEATURE_DIR}/spec.md"

if [[ -n "$ANALYZE_TIME" && "$ANALYZE_TIME" != "null" ]]; then
  SPEC_MTIME=$(stat -f '%m' "$SPEC_PATH" 2>/dev/null || stat -c '%Y' "$SPEC_PATH" 2>/dev/null)

  if [[ "$SPEC_MTIME" -gt "$ANALYZE_TIME" ]]; then
    echo "⚠ spec.md was modified after analyze completed"
    echo "Re-running /flow.analyze to verify consistency..."

    # Re-run analyze inline
    /flow.analyze

    # Check result
    ANALYZE_STATUS=$(specflow state get orchestration.step.status 2>/dev/null)
    if [[ "$ANALYZE_STATUS" == "blocked" ]]; then
      echo "Analysis found issues. Resolve before verifying."
      exit 1
    fi
  fi
fi
```

Use TodoWrite: mark [VERIFY] CONTEXT complete, mark [VERIFY] IMPL_GATE in_progress.

---

## Step 2: Check Implementation Gate

```bash
specflow check --gate implement --json
```

This verifies all tasks are complete.

**If gate fails** (incomplete tasks exist):

Run `specflow next --json` to see what's remaining.

For each incomplete task, offer choices:

1. **Complete it now** - If feasible, finish the task
2. **Defer to backlog** - `specflow phase defer "T###: Description - reason"`
3. **Block verification** - Cannot proceed until resolved

After resolving, re-run `specflow check --gate implement` until it passes.

Use TodoWrite: mark [VERIFY] IMPL_GATE complete, mark [VERIFY] VERIFY_GATE in_progress.

---

## Step 3: Check Verification Gate (Parallel)

```bash
specflow check --gate verify --json
```

This verifies all checklists are complete.

**If gate fails** (incomplete checklist items):

**Use parallel sub-agents** to verify multiple checklist items simultaneously:

**File locking pattern (prevents concurrent write conflicts):**

```
1. BEFORE launching agents: Load all checklist files into memory
   - Read verification.md, implementation.md content upfront
   - Agents receive READ-ONLY access to content

2. DURING verification: Agents verify items but DON'T write directly
   - Each agent returns: { itemId, passed: boolean, notes }
   - No file writes during parallel execution

3. AFTER all agents complete: Batch write updates
   - Collect all passed items from agents
   - Build file→updates map
   - Write each file ONCE with all updates:
     specflow mark V-001 V-002 V-003  # Batch mark
```

```
Parse incomplete items from gate check, then launch parallel Task agents:

Agent V-001: Verify checklist item V-001 - run verification, return result
Agent V-002: Verify checklist item V-002 - run verification, return result
Agent I-001: Verify checklist item I-001 - run verification, return result
... (batch 3-5 items per parallel round)
```

**Expected speedup**: 80-90% faster (N items verified in parallel vs. sequential)

For each incomplete item, agents MUST **actively verify** it:

1. **Read the verification criteria** from the checklist
2. **Execute the verification** - Run commands, check code, verify behavior
3. **Mark complete if it passes**:
   ```bash
   specflow mark V-001   # Verification checklist item
   specflow mark I-001   # Implementation checklist item
   ```
4. **Document failures** - If item cannot pass, note why and ask user

**Checklist ID Prefixes:**

- `V-###` - Verification checklist items
- `I-###` - Implementation checklist items
- `C-###` - Custom/other checklist items
- `D-###` - Deferred items

After resolving, re-run `specflow check --gate verify` until it passes.

Use TodoWrite: mark [VERIFY] VERIFY_GATE complete, mark [VERIFY] PHASE_GOALS in_progress.

---

## Step 4: Phase Goals Verification (Parallel)

Verify the implementation against the **original phase goals** from `.specify/phases/{PHASE_NUMBER}-*.md`.

**Use parallel sub-agents** to verify goals, scope, and UI design simultaneously:

```
Launch 3 parallel Task agents:

Agent 1 (Goals Coverage): Build goals matrix - map each phase goal → spec requirement → task(s)
Agent 2 (Scope Creep): Compare planned vs implemented - find unplanned additions, missing goals
Agent 3 (UI Design): Verify ui-design.md coverage - components, interactions, constraints (if exists)
```

**Expected speedup**: 30-40% faster (3 parallel checks vs. sequential)

### 4a. Goals Coverage (Agent 1)

For each goal/objective listed in the phase document:

| Check | How to Verify |
|-------|---------------|
| Goal stated | Find corresponding requirement in spec.md |
| Requirement implemented | Find task(s) that address the requirement |
| Task completed | Verify task is marked complete |

**Produce goals matrix** using format from `.specify/templates/goal-coverage-template.md`:

```markdown
## Phase Goals Coverage (Verification)

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Smart batching for orchestration | REQ-001 | T001-T005 (all complete) | ACHIEVED |
| 2 | Auto-healing on failures | REQ-002 | T010-T015 (all complete) | ACHIEVED |
| 3 | Minimal user interaction | REQ-003 | T020 (incomplete) | INCOMPLETE |
| 4 | Progress persistence | REQ-004 | Deferred | DEFERRED |

Achievement: 2/4 goals (50%)
```

**Verification status values**: `ACHIEVED` (all tasks complete), `INCOMPLETE` (tasks remain), `DEFERRED` (explicitly skipped)

### 4b. Scope Creep Check (Agent 2)

Compare what was PLANNED vs what was IMPLEMENTED:

- **Unplanned additions**: Tasks completed that weren't in original phase goals (acceptable if minor)
- **Missing goals**: Phase goals with no corresponding implementation (requires resolution)
- **Scope changes**: Document any significant deviations from original phase

### 4c. UI Design Verification (Agent 3, if ui-design.md exists)

| Check | How to Verify |
|-------|---------------|
| Component coverage | All components in ui-design.md are implemented |
| Interaction coverage | All interactions in ui-design.md work as specified |
| Design constraints | Implementation respects stated constraints |
| Accessibility | Accessibility considerations addressed |

**Aggregate results** from all 3 agents before proceeding.

**If goals are missing implementation:**

1. **Complete now** - If feasible, implement the missing goal
2. **Defer to backlog** - `specflow phase defer "Goal: description - reason"`
3. **Document deviation** - Note in plan.md why goal was descoped

Use TodoWrite: mark [VERIFY] PHASE_GOALS complete, mark [VERIFY] MEMORY in_progress.

---

## Step 5: Memory Document Compliance (Parallel)

Check implementation against memory documents in `.specify/memory/`. See `.specify/templates/memory-loading-guide.md` for the complete loading protocol.

**Use parallel sub-agents** to check all 5 memory documents simultaneously:

```
Launch 5 parallel Task agents:

Agent 1: Constitution Compliance - Check MUST requirements, core principles (CRITICAL)
Agent 2: Tech Stack Compliance - Verify approved technologies, versions
Agent 3: Coding Standards - Check naming, organization, TypeScript conventions
Agent 4: Testing Strategy - Run tests, verify coverage and patterns
Agent 5: Security Checklist - Validate input handling, error handling, auth
```

**Expected speedup**: 60-70% faster (5 parallel checks vs. sequential)

### 5a. Constitution Compliance (Agent 1)

**CRITICAL** - Constitution violations block verification.

| Check                 | How to Verify                                          |
| --------------------- | ------------------------------------------------------ |
| MUST requirements     | Search code for each MUST item, confirm implementation |
| Core principles       | Review changes don't violate stated principles         |
| Documented deviations | Any deviation from constitution should be in plan.md   |

### 5b. Tech Stack Compliance (Agent 2)

| Check                   | How to Verify                                      |
| ----------------------- | -------------------------------------------------- |
| Approved technologies   | Any new dependencies match approved list           |
| Version constraints     | Check package.json/lockfile for version compliance |
| Undeclared dependencies | Search for imports not in approved stack           |

### 5c. Coding Standards (Agent 3)

| Check                  | How to Verify                                      |
| ---------------------- | -------------------------------------------------- |
| Naming conventions     | Spot-check new files/functions for naming patterns |
| Code organization      | Verify files are in correct directories            |
| TypeScript conventions | Check for any type violations (run `tsc --noEmit`) |

### 5d. Testing Strategy (Agent 4)

| Check         | How to Verify                            |
| ------------- | ---------------------------------------- |
| Test coverage | Run tests, verify critical paths covered |
| Test patterns | Check tests follow project patterns      |
| Missing tests | Any new functionality without tests      |

### 5e. Security Checklist (Agent 5)

| Check            | How to Verify                       |
| ---------------- | ----------------------------------- |
| Input validation | User inputs validated at boundaries |
| Error handling   | No sensitive info in error messages |
| Authentication   | Auth checks on sensitive operations |

**Aggregate results** from all 5 agents and produce compliance summary:

```text
| Memory Document | Status | Issues |
|-----------------|--------|--------|
| constitution.md | PASS | - |
| tech-stack.md | PASS | - |
| coding-standards.md | WARN | 2 minor naming deviations |
| testing-strategy.md | PASS | - |
| security-checklist.md | N/A | No security changes |
```

If any FAIL status, address issues before proceeding.

Use TodoWrite: mark [VERIFY] MEMORY complete, mark [VERIFY] REPORT in_progress.

---

## Step 6: User Gate Check

See `.specify/templates/user-gate-guide.md` for the complete USER GATE handling protocol.

**Check if USER GATE exists** (from status output or state):
```bash
HAS_GATE=$(specflow state get orchestration.phase.hasUserGate)
```

If `HAS_GATE` is `false` or empty, skip to Step 7.

**If USER GATE exists, check if already handled:**
```bash
GATE_STATUS=$(specflow state get orchestration.phase.userGateStatus)
```

If `userGateStatus` is `confirmed` or `skipped`, proceed to Step 7.

**If gate is pending**, use standardized `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "Phase {number} has a USER GATE requiring your verification.\n\nGate Criteria:\n{criteria from phase doc}\n\nHave you verified the implementation meets these criteria?",
    "header": "User Gate",
    "options": [
      {"label": "Yes, verified (Recommended)", "description": "I have tested and confirmed the gate criteria are met"},
      {"label": "Show details", "description": "Display verification instructions and test steps"},
      {"label": "Skip gate", "description": "Proceed without user verification (not recommended)"}
    ],
    "multiSelect": false
  }]
}
```

**Handle response:**

| Response | Action |
|----------|--------|
| **Yes, verified** | `specflow state set orchestration.phase.userGateStatus=confirmed` → Proceed |
| **Show details** | Display: 1) Gate criteria, 2) Test instructions, 3) Expected behavior → Re-ask |
| **Skip gate** | `specflow state set orchestration.phase.userGateStatus=skipped` → Proceed (log reason) |

**If no USER GATE**: Proceed directly to mark verified.

---

## Step 7: Mark Verification Complete

**IMPORTANT**: Do NOT close the phase here. Only `/flow.merge` should close phases.

Update the orchestration state to indicate verification passed:

```bash
# Only set status=complete - orchestrate owns step transitions
# "verified" is a status, not a step
specflow state set orchestration.step.status=complete
```

**State ownership note**: Do NOT set `step.current=verified`. The valid steps are: design, analyze, implement, verify. Setting `status=complete` signals orchestrate that verify is done and the phase is ready to merge.

Use TodoWrite: mark [VERIFY] REPORT complete.

---

## Step 8: Verification Report

Display summary:

```markdown
# Verification Complete

**Phase**: {number} - {name}
**Status**: VERIFIED (Ready for Merge)

## Summary

| Check             | Status              |
| ----------------- | ------------------- |
| Tasks             | {completed}/{total} |
| Checklists        | PASS                |
| Phase Goals       | {covered}/{total}   |
| Memory Compliance | PASS                |
| User Gate         | PASS / N/A          |

## How to Verify & Test

Detailed instructions on how to verify this feature as a user. Include:
- How to start the dev server
- Any required environment variables
- Step-by-step testing instructions
- Expected behavior

## Deferred Items

{count} items will be added to BACKLOG.md on merge.

## Next Step

Run `/flow.merge` to close the phase, push changes, and merge to main.
```

---

## Handle Failures

If verification cannot complete:

1. Do NOT close the phase
2. List all failing items with remediation steps
3. Ask: "Would you like me to attempt fixes?"

If user approves:

- Complete incomplete tasks
- Mark checklist items after verification
- Re-run verification after fixes

---

## Operating Principles

### Verification Standards

- **Be thorough**: Check everything, assume nothing
- **Be specific**: Cite exact files, line numbers, task IDs
- **Be actionable**: Every issue should have clear remediation
- **Be honest**: Don't mark things complete that aren't

### ROADMAP Integrity

- Only mark verified if ALL verification checks pass
- USER GATE phases require explicit user confirmation
- **Do NOT close phase** - only `/flow.merge` closes phases

### Context Efficiency

- Use CLI commands for status checks (faster than reading files)
- Load only necessary sections of large files
- Aggregate similar issues rather than listing each individually

---

## Parallel Agent Coordination

See `.specify/templates/parallel-execution-guide.md` for the complete standardized protocol.

When launching parallel agents (checklist verification, goal checks, memory compliance):

**1. Pre-launch**:
- Verify all checklist files exist before launching verification agents
- Verify all memory documents exist before launching compliance agents
- Skip agents for missing optional files (e.g., ui-design.md)

**2. Execution**:
- Launch checklist agents in batches of 3-5 items
- Launch memory compliance agents (5 total) simultaneously
- Launch goal verification agents (3 total) simultaneously
- Set timeout: 180 seconds per agent (standardized)

**3. Synchronization**:
- Wait for each parallel batch before proceeding
- Checklist batch → Goal batch → Memory batch (sequential batches)

**4. Result aggregation**:
- Build compliance summary table from all agent results
- Merge pass/fail status per category
- Collect all failing items with remediation steps

**5. Error handling**:
- 1 verification fails: Log failure, continue with others
- Critical compliance failure (constitution): Halt verification
- Agent timeout: Mark that check as INCOMPLETE, continue

## Context

$ARGUMENTS
