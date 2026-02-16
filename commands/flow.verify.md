---
description: Verify feature completion, compliance with memory documents, and readiness for merge.
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

- Empty: Run full verification (tasks, memory, user gate)
- `--dry-run`: Preview verification without updating state
- `--skip-memory`: Skip memory document compliance check

You **MUST** consider the user input before proceeding (if not empty).

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Tool Usage

**Use dedicated tools instead of bash for file operations:**

| Instead of (bash) | Use |
|---|---|
| `ls`, `find` | Glob tool |
| `grep`, `rg` | Grep tool |
| `cat`, `head`, `tail` | Read tool |
| `echo >`, heredoc writes | Write tool |

Reserve Bash for: `specflow` CLI, `git`, `pnpm`/`npm`, and other system commands.

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Implement gate passed | `specflow check --gate implement` | Run `/flow.implement` |
| All tasks complete | `specflow status --json` → `progress.percentage == 100` | Complete remaining tasks |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |
| Git branch | `git branch --show-current` | Should be on phase branch |

**Path clarification**:
- Artifacts (spec.md, plan.md, tasks.md): `specs/NNNN-name/` from `context.featureDir`
- Phase definition (goals, scope): `.specify/phases/NNNN-*.md`

## Goal

Verify a completed feature phase is ready for merge:

1. All tasks complete (or explicitly deferred)
2. Implementation complies with memory documents
3. User gate satisfied (if applicable)
4. User receives a concrete, non-developer test guide with startup steps

**Note**: This command verifies readiness but does NOT close the phase. Use `/flow.merge` to close, push, and merge.

---

## Step 0: Create Todo List

**Create todo list immediately (use TodoWrite):**

1. [VERIFY] CONTEXT - Get project status and load phase artifacts
2. [VERIFY] IMPL_GATE - Verify all tasks complete
3. [VERIFY] WIRING - Check integration wiring (orphaned exports)
4. [VERIFY] PHASE_GOALS - Verify against original phase goals
5. [VERIFY] MEMORY - Check against memory docs
6. [VERIFY] REPORT - Mark verified and report

Set [VERIFY] CONTEXT to in_progress.

## Step 1: Get Project Context

**Get project context first, then initialize step:**

**Optimization**: If this command was invoked by `/flow.orchestrate` and you already
have `specflow status --json` output in context (within the last few tool calls),
reuse it instead of calling again.

```bash
specflow context --json
```

This returns both status and all memory doc contents in one call (see `status` and `memory` fields).
If `specflow context` is unavailable, fall back to `specflow status --json`.

Use `step.current` from the status output above to initialize step (do NOT call `state get` for this value):

```bash
# CURRENT_STEP = step.current from specflow status --json output above
# Only set step.current if missing or different (standalone mode)
if [[ -z "$CURRENT_STEP" || "$CURRENT_STEP" == "null" || "$CURRENT_STEP" != "verify" ]]; then
  specflow state set orchestration.step.current=verify orchestration.step.index=3 orchestration.step.status=in_progress
else
  specflow state set orchestration.step.status=in_progress
fi
```

Parse the JSON to understand:

- Current phase number and name
- Active feature directory
- Task completion status
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

Use TodoWrite: mark [VERIFY] IMPL_GATE complete, mark [VERIFY] WIRING in_progress.

---

## Step 2.5: Integration Wiring Check

Verify every new module created in this phase is reachable from an entry point.

**Load orphan warnings from implement step:**
```bash
ORPHANS=$(specflow state get orchestration.implement.orphanedExports 2>/dev/null)
```

**Use parallel sub-agents** to scan for orphaned exports:

For each file created/modified in this phase (from `git diff --name-only main`):
- Extract all exported symbols
- grep codebase for import statements (exclude test files)
- Classify: WIRED (has callers), WIRED-TRANSITIVE (via barrel), ORPHANED (no callers)

**If orphaned exports map to phase goals or FR-###**: BLOCKING — must wire or defer
**If orphaned exports are utilities/helpers**: WARNING — log but do not block

Resolution options:
1. Wire the export now (add import to appropriate caller)
2. Defer: `specflow phase defer "Wire [module] into [caller]"`
3. Remove: If export isn't needed, remove it

Use TodoWrite: mark [VERIFY] WIRING complete, mark [VERIFY] PHASE_GOALS in_progress.

---

## Step 3: Phase Goals Verification (Parallel)

Verify the implementation against the **original phase goals** from `.specify/phases/{PHASE_NUMBER}-*.md`.

**Use parallel sub-agents** to verify goals, scope, and UI design simultaneously:

```
Launch 3 parallel workers (Agent Teams preferred; Task agents fallback):

Team-mode role hints:
- Use `specflow-goal-coverage` for goals matrix and scope checks
- Use `specflow-quality-auditor` for ui-design verification worker
- Parent orchestrator uses `specflow-coordinator` for aggregated verdict

Agent 1 (Goals Coverage): Build goals matrix - map each phase goal → spec requirement → task(s)
Agent 2 (Scope Creep): Compare planned vs implemented - find unplanned additions, missing goals
Agent 3 (UI Design): Verify ui-design.md coverage - components, interactions, constraints (if exists)
```

**Expected speedup**: 30-40% faster (3 parallel checks vs. sequential)

### 3a. Goals Coverage (Agent 1)

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

### 3b. Scope Creep Check (Agent 2)

Compare what was PLANNED vs what was IMPLEMENTED:

- **Unplanned additions**: Tasks completed that weren't in original phase goals (acceptable if minor)
- **Missing goals**: Phase goals with no corresponding implementation (requires resolution)
- **Scope changes**: Document any significant deviations from original phase

### 3c. UI Design Verification (Agent 3, if ui-design.md exists)

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

## Step 4: Memory Document Compliance (Parallel)

Check implementation against memory documents in `.specify/memory/`. See `.specify/templates/memory-loading-guide.md` for the complete loading protocol.

**Pre-load memory docs before launching agents**: Read all 5 memory documents
(`constitution.md`, `tech-stack.md`, `coding-standards.md`, `testing-strategy.md`,
`security-checklist.md`) FIRST in the parent, then include their contents in each
agent's prompt. This eliminates ~20 redundant file reads across 5 agents.

**Use parallel sub-agents** to check all 5 memory documents simultaneously:

```
Launch 5 parallel workers (Agent Teams preferred; Task agents fallback):

Team-mode role hints:
- Use `specflow-memory-checker` for constitution/tech-stack workers
- Use `specflow-quality-auditor` for testing/security workers
- Parent orchestrator uses `specflow-coordinator` for compliance summary

Agent 1: Constitution Compliance - Check MUST requirements, core principles (CRITICAL)
Agent 2: Tech Stack Compliance - Verify approved technologies, versions
Agent 3: Coding Standards - Check naming, organization, TypeScript conventions
Agent 4: Testing Strategy - Run tests, verify coverage and patterns
Agent 5: Security Checklist - Validate input handling, error handling, auth
```

**Expected speedup**: 60-70% faster (5 parallel checks vs. sequential)

### 4a. Constitution Compliance (Agent 1)

**CRITICAL** - Constitution violations block verification.

| Check                 | How to Verify                                          |
| --------------------- | ------------------------------------------------------ |
| MUST requirements     | Search code for each MUST item, confirm implementation |
| Core principles       | Review changes don't violate stated principles         |
| Documented deviations | Any deviation from constitution should be in plan.md   |

### 4b. Tech Stack Compliance (Agent 2)

| Check                   | How to Verify                                      |
| ----------------------- | -------------------------------------------------- |
| Approved technologies   | Any new dependencies match approved list           |
| Version constraints     | Check package.json/lockfile for version compliance |
| Undeclared dependencies | Search for imports not in approved stack           |

### 4c. Coding Standards (Agent 3)

| Check                  | How to Verify                                      |
| ---------------------- | -------------------------------------------------- |
| Naming conventions     | Spot-check new files/functions for naming patterns |
| Code organization      | Verify files are in correct directories            |
| TypeScript conventions | Check for any type violations (run `tsc --noEmit`) |

### 4d. Testing Strategy (Agent 4)

| Check         | How to Verify                            |
| ------------- | ---------------------------------------- |
| Test coverage | Run tests, verify critical paths covered |
| Test patterns | Check tests follow project patterns      |
| Missing tests | Any new functionality without tests      |

### 4e. Security Checklist (Agent 5)

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

## Step 5: User Gate Check

See `.specify/templates/user-gate-guide.md` for the complete USER GATE handling protocol.

**Check if USER GATE exists** using `phase.hasUserGate` from `specflow status --json` output (already obtained in Step 1 — do NOT call `state get` for this value).

If `hasUserGate` is `false` or empty, skip to Step 6.

**If USER GATE exists, check if already handled:**
```bash
GATE_STATUS=$(specflow state get orchestration.phase.userGateStatus)
```

If `userGateStatus` is `confirmed` or `skipped`, proceed to Step 6.

**Before prompting user, build a non-developer verification guide (required):**

Build a concrete "How to Verify This Change" guide from repo artifacts. Do not assume the user knows how to run the app.

1. Discover app start/run commands (in this order):
   - `README.md` / `docs/**` quickstart sections
   - `package.json` scripts (`dev`, `start`, `preview`)
   - `Makefile` / `justfile` (`dev`, `run`, `start`)
   - `docker-compose.yml` or `compose.yaml`
2. Discover required environment variables:
   - Read `.env.example`, `.env.sample`, `.env.local.example` when present
   - List required keys and safe setup commands (example: `cp .env.example .env`)
   - If a secret cannot be sourced locally, say exactly where the user gets it
3. Determine app entry point:
   - Expected URL, port, and login/account prerequisites (if any)
4. Convert USER GATE criteria into numbered manual test steps:
   - Each step must include expected result
5. Add a short troubleshooting section:
   - Command not found
   - Port already in use
   - Missing environment variable

**Output quality rules (required):**
- Use plain language for non-developers
- Include copy/paste commands
- Do not use placeholders like `<start command>` when detection is possible
- If detection fails, explicitly say what was checked and provide the best fallback command options

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
| **Yes, verified** | `specflow state set orchestration.phase.userGateStatus=confirmed` → Proceed |
| **Show details** | Display generated guide: 1) setup commands, 2) start command, 3) URL/login path, 4) numbered test steps with expected results, 5) troubleshooting; then re-ask |
| **Skip gate** | `specflow state set orchestration.phase.userGateStatus=skipped` → Proceed (log reason) |

**If no USER GATE**: Proceed directly to mark verified.

---

## Step 6: Mark Verification Complete

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

## Step 7: Verification Report

Display summary:

```markdown
# Verification Complete

**Phase**: {number} - {name}
**Status**: VERIFIED (Ready for Merge)

## Summary

| Check             | Status              |
| ----------------- | ------------------- |
| Tasks             | {completed}/{total} |
| Phase Goals       | {covered}/{total}   |
| Memory Compliance | PASS                |
| User Gate         | PASS / N/A          |

## How to Verify & Test

Provide a **non-developer verification guide** with this exact structure:

### 1) Setup (copy/paste)
- Dependency install command(s)
- Environment setup command(s)
- Any login/account prerequisites

### 2) Start the app
- Exact command to run
- How to know it started successfully (expected output)

### 3) Open the app
- URL to open
- First screen/page expected

### 4) Verify the change (step-by-step)
1. Step mapped to gate/acceptance criteria #1
   Expected: ...
2. Step mapped to gate/acceptance criteria #2
   Expected: ...

### 5) Quick pass/fail checklist
- [ ] Gate criterion 1 confirmed
- [ ] Gate criterion 2 confirmed
- [ ] No regressions observed in affected flow

### 6) If something fails
- What command/log to capture
- What to send back to the agent

**Rules:**
- Use concrete commands and concrete URLs
- Keep language non-technical
- Include estimated time to complete the manual check (for example: "10-15 minutes")

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

When launching parallel agents (goal checks, memory compliance):

**1. Pre-launch**:
- Verify all memory documents exist before launching compliance agents
- Skip agents for missing optional files (e.g., ui-design.md)

**2. Execution**:
- Launch memory compliance agents (5 total) simultaneously
- Launch goal verification agents (3 total) simultaneously
- Set timeout: 180 seconds per agent (standardized)

**3. Synchronization**:
- Wait for each parallel batch before proceeding
- Goal batch → Memory batch (sequential batches)

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
