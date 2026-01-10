---
description: Orchestrate the complete SpecKit workflow from end to end with state persistence, self-healing, and minimal user interaction.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The user may specify:

- `continue` - Resume from current state
- `reset` - Clear state and start fresh for current phase
- `status` - Show current orchestration status without executing
- `skip-to [step]` - Skip to a specific step (specify, clarify, plan, tasks, analyze, checklist, implement, verify)
- `next-phase` - Force advance to next ROADMAP phase (use after USER GATE approval)

## Goal

Execute the complete SpecKit development workflow autonomously with:

1. **State persistence** - Survives conversation compaction/memory loss
2. **Self-healing** - Detects and recovers from inconsistencies
3. **Minimal user interaction** - Only asks questions when truly necessary
4. **Smart recommendations** - Provides clear options with pros/cons
5. **Memory document compliance** - Ensures all work adheres to project standards
6. **Auto-fix loop** - Fixes ALL issues found during analyze until clean

## Workflow Steps (In Order)

| Step | Command   | Purpose                                       | User Interaction                           |
| ---- | --------- | --------------------------------------------- | ------------------------------------------ |
| 1    | specify   | Create feature specification                  | Minimal - only for critical clarifications |
| 2    | clarify   | Resolve specification ambiguities             | Questions with recommendations             |
| 3    | plan      | Create technical implementation plan          | None (research-based)                      |
| 4    | tasks     | Generate actionable task list                 | None                                       |
| 5    | analyze   | Check cross-artifact consistency              | Auto-fix loop until clean                  |
| 6    | checklist | Create post-completion verification checklist | Scope questions with recommendations       |
| 7    | implement | Execute all tasks                             | Progress updates only                      |
| 8    | verify    | Verify completion and update ROADMAP          | None (or USER GATE prompt)                 |

## State Management

### State File Location

`.specify/orchestration-state.json`

### State Schema

```json
{
  "version": "1.1",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  },
  "project": {
    "name": null,
    "description": null
  },
  "current": {
    "phase_number": "001",
    "phase_name": "project-architecture-setup",
    "branch": "001-project-architecture-setup",
    "step": "specify",
    "step_index": 0,
    "status": "in_progress"
  },
  "steps": {
    "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
    "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
    "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
    "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
    "analyze": { "status": "pending", "completed_at": null, "fix_iterations": 0, "artifacts": [] },
    "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
    "implement": {
      "status": "pending",
      "completed_at": null,
      "tasks_completed": 0,
      "tasks_total": 0,
      "artifacts": []
    },
    "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
  },
  "pending_questions": [],
  "history": [],
  "last_updated": "2026-01-10T12:00:00Z"
}
```

### Configuration Paths

The `config` object contains paths that can be overridden by the user. Defaults follow best practices:

| Path | Default | Purpose |
|------|---------|---------|
| `roadmap_path` | `ROADMAP.md` | Project phases and status (repo root) |
| `memory_path` | `.specify/memory/` | Memory documents (constitution, tech-stack, etc.) |
| `specs_path` | `specs/` | Feature specification directories |
| `scripts_path` | `.specify/scripts/` | Helper scripts (bash, setup) |
| `templates_path` | `.specify/templates/` | Document templates |

**To override**: Edit the `config` section in `.specify/orchestration-state.json` before running orchestrate, or update it when the state file is first created.

**User-scope templates**: If a template is not found in `config.templates_path`, fall back to `~/.claude/speckit-system/templates/`.

**User-scope scripts**: If a script is not found in `config.scripts_path`, fall back to `~/.claude/speckit-system/scripts/`.

### State Transitions

```text
pending → in_progress → completed
                     → blocked (requires user input)
                     → failed (requires intervention)
```

## Execution Steps

### 0. Initialize Orchestration Context

**0a. Load or Create State File**

Use the SpecKit CLI for state operations:

```bash
# Check if state exists and is valid
speckit state validate

# If state file missing, will be initialized in Section 1
# If exists, load current state
speckit state get --json
```

- If state file exists and valid: Use `speckit state get` to read sections
- If state file missing: Use `speckit state init` (see Section 1)
- If state file invalid: Use `speckit doctor --fix` to repair

**0b. Check for ROADMAP.md**

Use the SpecKit CLI to validate ROADMAP.md:

```bash
# Validate ROADMAP.md exists and has valid structure
speckit roadmap validate

# Get path to ROADMAP.md (respects config)
speckit roadmap path
```

If ROADMAP.md **does NOT exist** (validate returns error):

1. Display message: "No ROADMAP.md found. This document is required to define project phases."
2. Ask user using `AskUserQuestion`:
   ```markdown
   ## ROADMAP.md Not Found

   The orchestration workflow requires a ROADMAP.md file to define project phases and their order.

   | Option          | Action                                               |
   | --------------- | ---------------------------------------------------- |
   | A (Recommended) | Create ROADMAP.md now (will ask about project scope) |
   | B               | I'll create it manually                              |
   ```
3. If user selects Option A:
   - Execute `/speckit.roadmap` command logic
   - After ROADMAP.md is created, continue with orchestration
4. If user selects Option B:
   - Halt orchestration with message: "Please create ROADMAP.md and run `/speckit.orchestrate` again."

If ROADMAP.md **exists but is empty or invalid** (validate returns warning):

1. Display warning: "ROADMAP.md exists but contains no valid phases."
2. Offer to regenerate or let user fix manually (same options as above)

**0c. Handle User Arguments**

| Argument            | Action                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| `continue` or empty | Resume from `current.step`                                               |
| `reset`             | Clear steps, keep phase info, restart from specify                       |
| `status`            | Display status table and exit                                            |
| `skip-to [step]`    | Validate step exists, update `current.step`, mark prior steps as skipped |
| `next-phase`        | Merge branch, checkout next phase branch, reset steps                    |

**0d. Verify State Matches Reality**

CRITICAL: After loading state, verify it matches actual filesystem state using SpecKit CLI:

```bash
# Run comprehensive diagnostics
speckit doctor

# Check git branch matches state
speckit git branch current

# Check state file validity
speckit state validate

# Check task completion status
speckit tasks status

# Check ROADMAP phase status
speckit roadmap status --json
```

**CRITICAL Phase Completion Check**:

FIRST, compare state file phase with ROADMAP status:

```bash
# Get current phase from state
STATE_PHASE=$(speckit state get current.phase_number)

# Get ROADMAP status for that phase
speckit roadmap status --json | grep "$STATE_PHASE"
```

If ROADMAP shows the state file's phase as "✅ Complete" but state still shows that phase:
1. **This phase is already done** - The state file is stale
2. Log: "Phase {phase_number} is already complete in ROADMAP.md. Resetting state for next phase."
3. Archive current state and reset:
   ```bash
   # Archive to history and reset
   speckit state archive
   ```
4. Continue to Section 1 to determine and start the NEXT phase

Additional verification checks:
1. Check current git branch matches `current.branch` (use `speckit git branch current`)
2. Check feature directory exists at `{config.specs_path}{phase_number}-{phase_name}/`
3. For each step marked "completed", verify artifacts exist:
   - specify: spec.md exists
   - clarify: spec.md updated (check for Clarifications section)
   - plan: plan.md exists
   - tasks: tasks.md exists
   - analyze: No critical issues remain
   - checklist: checklists/ directory has files (use `speckit checklist status`)
   - implement: All tasks marked [X] in tasks.md (use `speckit tasks status`)
   - verify: ROADMAP.md updated (use `speckit roadmap status`)

4. If mismatch detected:
   - Run `speckit doctor --fix` to attempt auto-repair
   - Log the inconsistency
   - Reset affected step to last consistent state
   - Report: "State inconsistency detected. Resuming from [step]."

### 1. Determine Current Phase

**1a. If No State File Exists (Fresh Start)**

Use SpecKit CLI to get next phase from ROADMAP:

```bash
# Get next pending phase (returns JSON with phase_number, phase_name, etc.)
speckit roadmap next --json

# Or view all phases with status
speckit roadmap status
```

From the `next` command output:
1. Extract: phase_number, phase_name, verification_gate
2. Determine if USER GATE phase (contains "**USER GATE**")

**1b. Calculate Branch Name**

```text
BRANCH = "{phase_number}-{kebab-case(phase_name)}"
Example: "001-project-architecture-setup"
```

**1c. Git Branch Operations**

Use SpecKit CLI for git operations:

```bash
# Sync with remotes first
speckit git sync

# Check if branch exists
speckit git branch list | grep "{BRANCH}"

# If not exists, create from main
speckit git branch create "{BRANCH}"

# If exists, checkout
speckit git branch checkout "{BRANCH}"
```

**1d. Initialize State File**

Use SpecKit CLI to initialize state:

```bash
# Initialize new state file with defaults
speckit state init

# Set phase-specific values
speckit state set "current.phase_number={phase_number}"
speckit state set "current.phase_name={phase_name}"
speckit state set "current.branch={branch}"
speckit state set "current.step=specify"
speckit state set "current.status=in_progress"
```

**1e. Update ROADMAP.md**

Use SpecKit CLI to update phase status:

```bash
# Mark phase as in progress
speckit roadmap update "{phase_number}" in_progress
```

Change phase status from "⬜ Not Started" to "🔄 In Progress"

### 2. Execute Workflow Step: SPECIFY

**2a. Check if Already Complete**

If `steps.specify.status === "completed"`:

- Verify `specs/{phase}/spec.md` exists
- If exists: Skip to step 3 (CLARIFY)
- If missing: Reset step to "pending"

**2b. Extract Feature Description from ROADMAP**

Read the phase section from ROADMAP.md:

- **Goal**: The objective statement
- **Scope**: Bullet points of what's included
- **Deliverables**: Expected outputs

Construct feature description:

```text
{Goal}

Scope:
{Scope bullet points}

Deliverables:
{Deliverables list}
```

**2c. Run Specify Logic**

Execute the logic from `/speckit.specify`:

1. Generate branch name (already have it from phase)
2. Skip branch creation (already done)
3. Create spec.md using template
4. Create requirements.md checklist
5. Validate specification quality

**2d. Handle NEEDS CLARIFICATION Markers**

If spec contains [NEEDS CLARIFICATION] markers (max 3):

- Use `AskUserQuestion` tool with:
  - Clear question text
  - Multiple choice options (2-4)
  - **Recommended option first** with "(Recommended)" label
  - Description explaining pros/cons of each choice
- Wait for user response
- Update spec with answers
- Re-validate

**2e. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.specify.status=completed"
speckit state set "steps.specify.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.specify.artifacts=["spec.md", "checklists/requirements.md"]'
speckit state set "current.step=clarify"
```

### 3. Execute Workflow Step: CLARIFY

**3a. Check if Already Complete**

If `steps.clarify.status === "completed"`:

- Verify spec.md has Clarifications section OR was marked as no clarifications needed
- If valid: Skip to step 4 (PLAN)
- If invalid: Reset step to "pending"

**3b. Run Clarify Logic**

Execute the logic from `/speckit.clarify`:

1. Load spec.md
2. Perform ambiguity scan across taxonomy categories
3. Generate prioritized question queue (max 5)

**3c. Smart Question Handling**

For each question, use `AskUserQuestion` tool:

```markdown
**Question [N]**: {Question text}

**Context**: {Relevant spec excerpt}

**Recommended**: Option [X] - {Brief reasoning why this is best choice based on:}

- Best practices for this project type
- Risk reduction (security, performance, maintainability)
- Alignment with constitution.md principles

| Option          | Description     | Implications      |
| --------------- | --------------- | ----------------- |
| A (Recommended) | {First option}  | {What this means} |
| B               | {Second option} | {What this means} |
| C               | {Third option}  | {What this means} |
```

**3d. Integration**

After each answer:

- Update spec.md with clarification
- Save immediately (atomic writes)
- Continue to next question or complete

**3e. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.clarify.status=completed"
speckit state set "steps.clarify.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.clarify.artifacts=["spec.md (updated)"]'
speckit state set "current.step=plan"
```

### 4. Execute Workflow Step: PLAN

**4a. Check if Already Complete**

If `steps.plan.status === "completed"`:

- Verify plan.md exists
- Verify research.md exists (if unknowns were present)
- If valid: Skip to step 5 (TASKS)
- If invalid: Reset step to "pending"

**4b. Load Memory Documents**

Load available documents from `{config.memory_path}` for compliance checking:

- `constitution.md` - Architectural principles (REQUIRED)
- `tech-stack.md` - Approved technologies (if exists)
- `coding-standards.md` - Code patterns (if exists)
- `testing-strategy.md` - Test requirements (if exists)

> **Note**: Only `constitution.md` is required. Other memory documents enhance compliance checking when present.

**4c. Run Plan Logic**

Execute the logic from `/speckit.plan`:

1. Run setup-plan.sh to initialize plan.md template
2. Fill Technical Context from spec + memory docs
3. Constitution Check - verify no violations
4. Phase 0: Generate research.md (resolve unknowns)
5. Phase 1: Generate data-model.md, contracts/, quickstart.md
6. Update agent context

**4d. Ensure Memory Compliance**

Cross-check plan against available memory documents:

- Architecture MUST follow constitution.md principles (required)
- Tech stack choices should exist in tech-stack.md (if present)
- File structure should follow coding-standards.md (if present)
- Test approach should follow testing-strategy.md (if present)

If violations found:

- Constitution violations: Block until resolved
- Other document violations: Warn and recommend fix, but don't block

**4e. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.plan.status=completed"
speckit state set "steps.plan.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.plan.artifacts=["plan.md", "research.md", "data-model.md", "quickstart.md"]'
speckit state set "current.step=tasks"
```

### 5. Execute Workflow Step: TASKS

**5a. Check if Already Complete**

If `steps.tasks.status === "completed"`:

- Verify tasks.md exists
- Verify task count > 0
- If valid: Skip to step 6 (ANALYZE)
- If invalid: Reset step to "pending"

**5b. Run Tasks Logic**

Execute the logic from `/speckit.tasks`:

1. Load plan.md, spec.md, data-model.md, contracts/
2. Generate tasks organized by user story
3. Include proper format: `- [ ] T### [P?] [US?] Description with file path`
4. Generate dependency graph
5. Create parallel execution examples

**5c. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.tasks.status=completed"
speckit state set "steps.tasks.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.tasks.artifacts=["tasks.md"]'
speckit state set "current.step=analyze"
```

### 6. Execute Workflow Step: ANALYZE (Auto-Fix Loop)

**6a. Check if Already Complete**

If `steps.analyze.status === "completed"`:

- Re-run quick analysis to verify no regressions
- If clean: Skip to step 7 (CHECKLIST)
- If issues found: Reset step to "in_progress"

**6b. Run Analyze Logic**

Execute the logic from `/speckit.analyze`:

1. Load spec.md, plan.md, tasks.md
2. Build semantic models
3. Run detection passes (duplication, ambiguity, gaps, constitution)
4. Assign severity to findings

**6c. AUTO-FIX LOOP (Critical)**

```text
MAX_ITERATIONS = 5
iteration = 0

WHILE issues_exist AND iteration < MAX_ITERATIONS:
  1. Collect all issues from analysis report
  2. Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
  3. For EACH issue:
     - Determine fix type:
       a. Spec fix: Update spec.md
       b. Plan fix: Update plan.md
       c. Task fix: Update tasks.md
       d. Cross-file fix: Update multiple files
     - Apply fix automatically
     - Log fix in state.history
  4. Re-run analysis
  5. iteration++

IF iteration >= MAX_ITERATIONS AND issues_exist:
  - List remaining issues
  - Ask user: "Unable to auto-fix {N} issues after {MAX_ITERATIONS} attempts. Review and fix manually?"
  - Mark step as "blocked" if user declines
```

**6d. Issue Types and Auto-Fix Strategies**

| Issue Type             | Auto-Fix Strategy                             |
| ---------------------- | --------------------------------------------- |
| Duplication            | Keep higher-quality version, remove duplicate |
| Ambiguity              | Add measurable criteria based on context      |
| Underspecification     | Add missing details from plan/context         |
| Terminology drift      | Normalize to glossary.md term                 |
| Coverage gap           | Add task or requirement                       |
| Constitution violation | Modify to comply OR flag for user             |

**6e. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.analyze.status=completed"
speckit state set "steps.analyze.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set "steps.analyze.fix_iterations={iteration_count}"
speckit state set 'steps.analyze.artifacts=["analysis-clean"]'
speckit state set "current.step=checklist"
```

### 7. Execute Workflow Step: CHECKLIST

**7a. Check if Already Complete**

If `steps.checklist.status === "completed"`:

- Verify checklists/ directory has files beyond requirements.md
- If valid: Skip to step 8 (IMPLEMENT)
- If invalid: Reset step to "pending"

**7b. Determine Checklist Type**

For post-completion verification (to support /speckit.verify), create checklists that:

- Validate implementation matches specification
- Check memory document compliance
- Verify all acceptance criteria can be tested
- Cover edge cases and error handling

**7c. Smart Checklist Scope Questions**

Use `AskUserQuestion` for scope clarification:

```markdown
**Checklist Scope**

Based on this feature, I recommend creating the following checklists:

| Option          | Checklist Type                | Purpose                                                   |
| --------------- | ----------------------------- | --------------------------------------------------------- |
| A (Recommended) | Post-completion verification  | Validates implementation completeness for /speckit.verify |
| B               | Implementation + Verification | Both implementation guidance AND post-completion checks   |
| C               | Custom focus                  | Specify particular areas (security, performance, etc.)    |
```

Default to Option A if no response within context.

**7d. Run Checklist Logic**

Execute the logic from `/speckit.checklist`:

1. Clarify focus (use recommendation if no response)
2. Load feature context
3. Generate checklist items testing REQUIREMENTS quality, not implementation
4. Create `checklists/verification.md` (or appropriate name)

**7e. Update State**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.checklist.status=completed"
speckit state set "steps.checklist.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.checklist.artifacts=["checklists/verification.md"]'
speckit state set "current.step=implement"
```

### 8. Execute Workflow Step: IMPLEMENT

**8a. Check if Already Complete**

If `steps.implement.status === "completed"`:

Use SpecKit CLI to check task progress:

```bash
# Get task completion status
speckit tasks status

# Or get JSON format
speckit tasks status --json
```

- If completed == total: Skip to step 9 (VERIFY)
- If incomplete: Update state with progress, resume

**8b. Load Implementation Context**

1. Read tasks.md for task list
2. Read plan.md for tech stack and architecture
3. Load all memory documents for compliance
4. Check existing checklists

**8c. Run Implement Logic**

Execute the logic from `/speckit.implement`:

1. Verify/create ignore files
2. Parse task phases and dependencies
3. Execute tasks in order:
   - Phase 1: Setup
   - Phase 2: Foundational
   - Phase 3+: User Stories
   - Final: Polish
4. Mark each task [X] as completed
5. Validate at phase boundaries

**8d. Progress Tracking**

After each task completion, use SpecKit CLI:

```bash
# Mark task as complete (also updates state file automatically)
speckit tasks mark T###

# Check overall progress
speckit tasks status

# Get detailed status by phase
speckit tasks phase-status
```

- The `speckit tasks mark` command automatically updates:
  - tasks.md (marks [X])
  - State file (updates tasks_completed/tasks_total)
- Commit progress periodically (every 5-10 tasks or phase boundary):
  ```bash
  speckit git commit "feat: implement tasks T001-T010"
  ```

**8e. Error Recovery**

If task fails:

1. Log error with context
2. Attempt self-fix (1 retry with different approach)
3. If still fails:
   - Mark task as blocked
   - Continue with non-dependent tasks
   - Report blocked tasks at end
4. If critical path blocked:
   - Halt implementation
   - Report status
   - Mark step as "blocked"

**8f. Update State**

Use SpecKit CLI to update state:

```bash
# Get final task counts
COUNTS=$(speckit tasks status --json)

speckit state set "steps.implement.status=completed"
speckit state set "steps.implement.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Note: tasks_completed and tasks_total are auto-updated by speckit tasks mark
speckit state set "current.step=verify"
```

### 9. Execute Workflow Step: VERIFY

**9a. Run Verify Logic**

Execute the logic from `/speckit.verify`:

1. Task completion verification
2. Memory document compliance check
3. Checklist verification and completion
4. Deferred items identification
5. User verification gate check

**9b. Handle USER GATE Phases**

Check if current phase has USER GATE in ROADMAP.md:

If USER GATE phase:

```markdown
## User Verification Required

**Phase**: {phase_number} - {phase_name}
**Gate Type**: USER VERIFICATION REQUIRED

### What to Test:

{Verification criteria from ROADMAP.md}

### How to Test:

{Instructions for accessing test page/POC}

### Verification Artifacts:

{List of test pages/POC files with paths}

---

**Please verify the implementation meets your expectations.**

When ready, run `/speckit.orchestrate next-phase` to:

1. Mark this phase as complete
2. Merge to main branch
3. Start the next phase
```

Mark state as "awaiting_user_gate" - do NOT auto-advance.

If NOT USER GATE phase:

- Verify all checks pass
- Auto-advance to completion

**9c. Update ROADMAP.md**

Use SpecKit CLI to update ROADMAP.md:

If all verifications pass:

```bash
# Mark phase as complete
speckit roadmap update "{phase_number}" complete

# Update CLAUDE.md with completion info
speckit claude-md update "{phase_number}: {phase_name}" "Phase completed with all {task_count} tasks"
```

If USER GATE:

```bash
# Mark as awaiting verification
speckit roadmap update "{phase_number}" awaiting
```

- Wait for explicit `next-phase` command

**9d. Update State and Trigger Phase Transition**

Use SpecKit CLI to update state:

```bash
speckit state set "steps.verify.status=completed"
speckit state set "steps.verify.completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
speckit state set 'steps.verify.artifacts=["ROADMAP.md (updated)"]'
```

**For non-USER GATE phases** - Automatically proceed to Phase Transition (Section 10):
- Set `current.status=completed`
- Immediately proceed to Section 10 (commit, merge, archive state, start next phase)

**For USER GATE phases** - Stop and wait for user:
```bash
speckit state set "current.status=awaiting_user_gate"
```
- Display USER GATE prompt (Section 9b)
- Do NOT proceed to Section 10 automatically
- Wait for user to run `/speckit.orchestrate next-phase`

### 10. Phase Transition (After Verify Completes)

**10a. Commit and Push Current Work**

Use SpecKit CLI for git operations:

```bash
speckit git commit "feat({phase_name}): Complete phase {phase_number}

- All {task_count} tasks completed
- All checklists verified
- Memory document compliance confirmed"

speckit git push
```

**10b. Merge to Main**

Use SpecKit CLI for merge operations:

```bash
speckit git merge main
speckit git push
```

**10c. Archive State and Prepare for Next Phase**

**CRITICAL**: Archive current state BEFORE determining next phase:

```bash
# Archive completed phase to history and reset current state
speckit state archive

# This command:
# 1. Moves current phase data to history array
# 2. Clears current.* fields
# 3. Clears all steps back to "pending"
# 4. Updates last_updated timestamp
```

The archived state looks like:

```json
{
  "history": [
    {
      "phase_number": "001",
      "phase_name": "project-architecture-setup",
      "completed_at": "{timestamp}",
      "steps": { ... }
    }
  ]
}
```

**10d. Determine and Start Next Phase**

Use SpecKit CLI to find next phase:

```bash
# Get next pending phase
speckit roadmap next --json

# If no more phases, this returns empty/error
```

1. If no more phases:
   - Report "All phases complete! 🎉"
   - State file remains archived with no current phase

2. If next phase exists:
   - Create new branch: `speckit git branch create {new_branch}`
   - Initialize state for new phase (Section 1d)
   - Begin workflow from step 1 (specify)

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for all scripted operations. Ensure the CLI is installed:

```bash
# Verify CLI is available
speckit --help

# Run diagnostics to check installation
speckit doctor
```

Key CLI commands used:
- `speckit state` - State file operations (get, set, init, reset, validate)
- `speckit git` - Git operations (branch, commit, merge, push, sync)
- `speckit roadmap` - ROADMAP.md operations (status, update, next, validate)
- `speckit claude-md` - CLAUDE.md operations (update, sync)
- `speckit tasks` - Task tracking (status, mark, incomplete)
- `speckit checklist` - Checklist verification (status, incomplete)
- `speckit doctor` - Diagnostics and auto-fix (--fix flag)

## Operating Principles

### Self-Healing

1. **State Verification**: Always verify state matches filesystem before executing
   - Use `speckit doctor` to run comprehensive diagnostics
   - Use `speckit state validate` to check state file integrity
2. **Automatic Recovery**: If inconsistency found, reset to last valid state
   - Use `speckit doctor --fix` for automated repairs
3. **Idempotent Operations**: Re-running a completed step should detect completion and skip
4. **Graceful Degradation**: If one step fails, attempt to continue where possible

### Minimal User Interaction

1. **Smart Defaults**: Use recommended options when no response received
2. **Batch Questions**: Ask multiple related questions together when possible
3. **Clear Recommendations**: Always highlight the recommended choice with reasoning
4. **Auto-Fix First**: Attempt automatic fixes before asking user

### Memory Document Compliance

1. **Pre-Check**: Before each step, load relevant memory documents
2. **Validation**: After each step, verify output complies with memory docs
3. **Auto-Correct**: Fix violations automatically when possible
4. **Report**: Log all compliance checks and corrections

### Context Efficiency

1. **Progressive Loading**: Only load documents needed for current step
2. **State Persistence**: Save state after each significant action
3. **Minimal Output**: Focus on progress indicators, not verbose logs
4. **Resumable**: Can resume from any point after conversation compaction

### Question Format (AskUserQuestion Tool)

Always structure questions with:

1. **Clear header** describing what's being asked
2. **Context** explaining why this matters
3. **Recommended option** with reasoning (always first)
4. **Options table** with descriptions and implications
5. **Default behavior** if no response received

Example:

```markdown
## Authentication Approach

The spec mentions user accounts but doesn't specify the authentication method.

**Recommended**: Option A - Session-based auth is simpler for MVP and can be extended later.

| Option          | Approach              | Implications                                    |
| --------------- | --------------------- | ----------------------------------------------- |
| A (Recommended) | Session-based cookies | Simpler implementation, works well for web-only |
| B               | JWT tokens            | More complex, better for API-first/mobile       |
| C               | OAuth2 only           | Delegate to providers, no password management   |

**Default**: If no response, I'll proceed with Option A.
```

## Status Display Format

When `status` argument provided or for progress updates:

```text
╔══════════════════════════════════════════════════════════════╗
║                 SpecKit Orchestration Status                  ║
╠══════════════════════════════════════════════════════════════╣
║ Phase: 001 - Project Architecture Setup                       ║
║ Branch: 001-project-architecture-setup                        ║
║ Status: 🔄 In Progress                                        ║
╠══════════════════════════════════════════════════════════════╣
║ Step        │ Status      │ Artifacts                         ║
╠─────────────┼─────────────┼───────────────────────────────────╣
║ 1. specify  │ ✅ Complete │ spec.md, requirements.md          ║
║ 2. clarify  │ ✅ Complete │ spec.md (5 clarifications)        ║
║ 3. plan     │ ✅ Complete │ plan.md, research.md, data-model  ║
║ 4. tasks    │ ✅ Complete │ tasks.md (47 tasks)               ║
║ 5. analyze  │ ✅ Complete │ Clean (3 fix iterations)          ║
║ 6. checklist│ 🔄 Current  │ verification.md                   ║
║ 7. implement│ ⬜ Pending  │ -                                 ║
║ 8. verify   │ ⬜ Pending  │ -                                 ║
╠══════════════════════════════════════════════════════════════╣
║ Next: Creating post-completion verification checklist         ║
╚══════════════════════════════════════════════════════════════╝
```

## Error Handling

### Recoverable Errors

| Error                | Recovery Action                   |
| -------------------- | --------------------------------- |
| State file corrupted | Rebuild from filesystem artifacts |
| Branch mismatch      | Checkout correct branch           |
| Missing artifact     | Re-run producing step             |
| Partial completion   | Resume from last checkpoint       |

### Non-Recoverable Errors

| Error                               | Action                          |
| ----------------------------------- | ------------------------------- |
| ROADMAP.md missing                  | Halt, instruct user to create   |
| Git repository broken               | Halt, instruct user to fix      |
| Constitution violation unresolvable | Halt, ask user for decision     |
| Multiple critical failures          | Halt, provide diagnostic report |

## Context

$ARGUMENTS
