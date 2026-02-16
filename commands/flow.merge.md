---
description: Complete a phase by closing it, pushing, and merging to main.
handoffs:
  - label: Start Next Phase
    agent: specflow.orchestrate
    prompt: Start the next phase
  - label: View Roadmap
    agent: specflow.roadmap
    prompt: Show the roadmap
---

## User Input

```text
$ARGUMENTS
```

Arguments:
- Empty: Close phase, push, create PR, merge, cleanup (default)
- `--pr-only`: Create PR but don't merge (for review workflow)

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Tool Usage

**Use dedicated tools instead of bash for file operations:**

| Instead of (bash) | Use |
|---|---|
| `ls`, `find` | Glob tool |
| `grep`, `rg` | Grep tool |
| `cat`, `head`, `tail` | Read tool |
| `echo >`, heredoc writes | Write tool |

Reserve Bash for: `specflow` CLI, `git`, `pnpm`/`npm`, `gh`, and other system commands.

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Verification passed | `specflow status --json` → `step.status == complete` | Run `/flow.verify` |
| On feature branch | `git branch --show-current` (not main) | Switch to phase branch |
| GitHub CLI installed | `gh --version` | Install with `brew install gh` |
| Git remote configured | `git remote -v` | Set up git remote |
| No merge conflicts | `git merge-base main HEAD` | Rebase on main first |

## Goal

Complete the current phase:
1. Close the phase (update ROADMAP, archive, reset state)
2. Commit the phase closure changes
3. Push and merge to main
4. Switch to main with clean state
5. Provide a concrete post-merge testing path for non-developers

## Execution

### 0. Create Todo List

**Create todo list immediately (use TodoWrite):**

1. [MERGE] PREFLIGHT - Verify branch and uncommitted changes
2. [MERGE] VERIFY_GATE - Confirm verification passed
3. [MERGE] CLOSE - Close phase via CLI
4. [MERGE] COMMIT - Commit phase closure
5. [MERGE] PUSH - Push and create PR
6. [MERGE] MERGE - Merge PR to main
7. [MERGE] MEMORY - Integrate archive into memory
8. [MERGE] DONE - Report completion

Set [MERGE] PREFLIGHT to in_progress.

### 1. Pre-flight Checks

**Verify on feature branch:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  echo "ERROR: Cannot merge from main branch"
  echo "Switch to a feature branch first"
  exit 1
fi
```

**Check for git remote (critical for push/PR/merge):**

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
```

If `REMOTE_URL` is empty, use `AskUserQuestion` to offer local-only fallback:

```json
{
  "questions": [{
    "question": "No git remote is configured. The merge workflow normally pushes to a remote and creates a PR.\n\nWould you like to proceed with a local-only merge instead? This will:\n- Close the phase and update ROADMAP.md\n- Commit all changes locally\n- Skip push, PR, and remote merge\n\nYou can push manually later or configure a remote.",
    "header": "No Remote",
    "options": [
      {"label": "Local merge (Recommended)", "description": "Close phase locally - commit changes but skip push/PR/merge"},
      {"label": "Cancel", "description": "Stop and configure git remote first"}
    ],
    "multiSelect": false
  }]
}
```

**Handle response:**
- **Local merge**: Set `LOCAL_ONLY_MODE=true` and continue. Skip steps 5-9 (push/PR/merge), but still do steps 1-4 and 10-11.
- **Cancel**: Return with `status: "cancelled"` and message about configuring remote.

**If remote is configured**, proceed normally with `LOCAL_ONLY_MODE=false`.

**Check for merge conflicts with main (skip if LOCAL_ONLY_MODE):**

If `LOCAL_ONLY_MODE=false`:

```bash
# Fetch latest main to ensure we have current state
git fetch origin main

# Check if we can merge cleanly (dry-run)
if ! git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main | grep -q "^<<<<<<<"; then
  echo "No merge conflicts detected"
else
  echo "ERROR: Merge conflicts detected with main"
  echo "Run: git rebase origin/main"
  echo "Resolve conflicts, then retry /flow.merge"
  exit 1
fi
```

**Alternative conflict check** (simpler but requires clean working directory):
```bash
# Attempt merge without committing
git merge --no-commit --no-ff origin/main
MERGE_STATUS=$?
git merge --abort 2>/dev/null || true

if [[ $MERGE_STATUS -ne 0 ]]; then
  echo "ERROR: Merge conflicts detected"
  exit 1
fi
```

**Check for uncommitted changes:**

```bash
git status --short
git diff --stat
```

If there are uncommitted changes (staged or unstaged), **include them in the phase commit by default**. Users running `/flow.merge` want to complete their phase - uncommitted changes are almost always related work.

**Only ask if changes look unusual:**

Detect unusual changes by checking if ANY of these apply:
- Changes to sensitive files: `.env*`, `*credentials*`, `*secret*`
- Changes to `package.json`/`pnpm-lock.yaml` when phase tasks didn't involve dependency changes
- Large deletions (>500 lines removed) not documented in phase tasks
- Changes to files completely outside the project scope

**For unusual changes only**, use `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "Uncommitted changes include files outside typical phase work. Include in commit?",
    "header": "Changes",
    "options": [
      {"label": "Yes, commit all", "description": "Include everything in the phase commit"},
      {"label": "Review first", "description": "Show me the changes before proceeding"},
      {"label": "Abort", "description": "Stop and let me handle manually"}
    ],
    "multiSelect": false
  }]
}
```

**For normal changes**: Proceed without asking - include all changes in the phase commit.

Use TodoWrite: mark [MERGE] PREFLIGHT complete, mark [MERGE] VERIFY_GATE in_progress.

### 2. Verify Gate Check (REQUIRED, Parallel)

**First, get phase context** (needed for parallel agents):

```bash
# Get status output to extract phase info for parallel agents
STATUS=$(specflow status --json)
PHASE_NUMBER=$(echo "$STATUS" | jq -r '.phase.number')
PHASE_NAME=$(echo "$STATUS" | jq -r '.phase.name')
FEATURE_DIR=$(echo "$STATUS" | jq -r '.context.featureDir')
```

**Use parallel sub-agents** to gather all verification data simultaneously:

```
Launch 3 parallel workers (Agent Teams preferred; Task agents fallback):

Team-mode role hints:
- Use `specflow-quality-auditor` for status/gate verification workers
- Use `specflow-memory-checker` for memory gate verification
- Parent orchestrator uses `specflow-coordinator` for merge-blocking decisions

Agent 1 (Status): Verify orchestration status
  - Check step.current == "verify" (from status already obtained)
  - Check step.status == "complete"
  → Return: verified status confirmation

Agent 2 (Phase Doc): Load phase document
  - Read `.specify/phases/${PHASE_NUMBER}-*.md` (PHASE_NUMBER from above)
  - Extract USER GATE marker and criteria
  - Extract all phase goals for verification
  → Return: has_user_gate, gate_criteria, phase_goals

Agent 3 (Gates): Verify implementation and memory gates
  - Run `specflow check --json` (single call — all gates run internally)
  - Parse gates.implement for implementation status, map incomplete tasks to phase goals
  - Parse gates.memory for memory compliance, check constitution.md
  → Return: implement_passed, memory_passed, incomplete_goals, memory_issues
```

**Expected speedup**: 2x faster (3 parallel checks vs. sequential)

**Aggregate results and validate:**

- If not verified → **BLOCK merge**, instruct user to run `/flow.verify` first
- If implement gate not passed → **BLOCK merge**, report incomplete goals
- If memory gate not passed → **BLOCK merge**, report memory issues (constitution violations cannot reach main)

**If USER GATE exists:**

See `.specify/templates/user-gate-guide.md` for the complete USER GATE handling protocol.

First, check if already handled (likely confirmed in `/flow.verify`):
```bash
GATE_STATUS=$(specflow state get orchestration.phase.userGateStatus)
```

If `userGateStatus` is `confirmed` or `skipped`, proceed to Step 3.

**If gate is pending, generate a non-developer verification guide before asking user:**

Reuse guide content from `/flow.verify` output when available. If unavailable, build it from:
- `README.md` / docs quickstart instructions
- `package.json` scripts (`dev`, `start`, `preview`)
- `Makefile` / `justfile` targets
- `.env.example` / `.env.sample` environment setup
- USER GATE criteria from phase doc

Guide must include:
1. Copy/paste setup commands
2. Exact app start command
3. URL and login path (if required)
4. Numbered manual test steps mapped to gate criteria
5. Expected result for each step
6. Quick troubleshooting notes

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
| **Show details** | Display generated guide: setup, start command, URL/login, numbered checks with expected outcomes, troubleshooting; then re-ask |
| **Skip gate** | `specflow state set orchestration.phase.userGateStatus=skipped` → Proceed (log reason) |
| **Other (not ready)** | BLOCK merge, instruct to verify and return |

**Verify phase goals were completed:**

Read `.specify/phases/${PHASE_NUMBER}-*.md` (using PHASE_NUMBER from step 2) and check that all goals have corresponding completed tasks. Use the implementation gate result from Agent 3 above (do NOT re-run `specflow check --gate implement`).

If any tasks are incomplete that map to phase goals, **BLOCK merge** and report which goals are incomplete.

Use TodoWrite: mark [MERGE] VERIFY_GATE complete, mark [MERGE] CLOSE in_progress.

### 3. Close Phase via CLI

Use the `specflow phase close` command to handle all phase closure operations:

```bash
specflow phase close --json
```

This command:
- Updates ROADMAP.md status to "Complete"
- Archives phase details to `.specify/history/HISTORY.md`
- Handles deferred items (adds to BACKLOG.md if needed)
- Resets orchestration state for next phase

**Parse output for phase info:**

```bash
PHASE_INFO=$(specflow phase close --json)
PHASE_NUMBER=$(echo "$PHASE_INFO" | jq -r '.phase.number')
PHASE_NAME=$(echo "$PHASE_INFO" | jq -r '.phase.name')
```

Use TodoWrite: mark [MERGE] CLOSE complete, mark [MERGE] COMMIT in_progress.

### 4. Commit Phase Closure

Stage ALL phase-related changes, not just closure files:

```bash
# Stage all changes from the phase
# - ROADMAP.md (status update)
# - .specify/ (state, archive, history)
# - specs/ (feature specs if not archived)
# - BACKLOG.md (deferred items)
# - Any implementation files changed during phase

git add -A  # Stage all changes (tracked and untracked)
git commit -m "chore: complete phase $PHASE_NUMBER - $PHASE_NAME

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Why stage all**: The phase includes both closure artifacts AND any uncommitted implementation work. Users running `/flow.merge` expect all phase work to be committed together. Step 1 already handles unusual changes.

Use TodoWrite: mark [MERGE] COMMIT complete, mark [MERGE] PUSH in_progress.

### 5. Push Branch (Skip if LOCAL_ONLY_MODE)

**If LOCAL_ONLY_MODE=true**: Skip to step 10 (Memory Integration). Mark [MERGE] PUSH, [MERGE] MERGE as skipped.

**If LOCAL_ONLY_MODE=false**:

```bash
git push -u origin "$CURRENT_BRANCH"
```

### 6. Create Pull Request (Skip if LOCAL_ONLY_MODE)

**Check for existing PR:**

```bash
EXISTING_PR=$(gh pr view --json url -q '.url' 2>/dev/null)
if [[ -n "$EXISTING_PR" ]]; then
  PR_URL="$EXISTING_PR"
fi
```

**Create PR if needed:**

```bash
if [[ -z "$PR_URL" ]]; then
  PR_URL=$(gh pr create \
    --title "Phase $PHASE_NUMBER: $PHASE_NAME" \
    --body "Completes phase $PHASE_NUMBER." \
    --base main)
fi
```

### 7. Handle --pr-only (Skip if LOCAL_ONLY_MODE)

When printing the `--pr-only` message, substitute concrete values. Do not print placeholder tokens (`{...}`).

```bash
if [[ "$ARGUMENTS" == *"--pr-only"* ]]; then
  echo "✓ PR created (--pr-only mode)"
  echo "Review at: $PR_URL"
  echo ""
  echo "Test this branch before merging:"
  echo "1) Setup: [actual copy/paste setup commands]"
  echo "2) Start app: [actual start command]"
  echo "3) Open: [actual URL]"
  echo "4) Run manual checks: [actual numbered checks with expected outcomes]"
  echo ""
  echo "After review, run /flow.merge to complete"
  exit 0
fi
```

Use TodoWrite: mark [MERGE] PUSH complete, mark [MERGE] MERGE in_progress.

### 8. Merge PR (Skip if LOCAL_ONLY_MODE)

```bash
gh pr merge --squash --delete-branch
```

### 9. Switch to Main (Skip if LOCAL_ONLY_MODE)

**If LOCAL_ONLY_MODE=true**: Stay on feature branch. Phase is closed and committed locally.

**If LOCAL_ONLY_MODE=false**:

```bash
git checkout main
git pull origin main
git branch -d "$CURRENT_BRANCH" 2>/dev/null || true
```

Working directory is now clean on main.

Use TodoWrite: mark [MERGE] MERGE complete, mark [MERGE] MEMORY in_progress.

### 10. Archive Memory Integration

**Ownership**: `/flow.merge` owns deletion of the CURRENT phase archive only. For other phases, use `/flow.memory --archive --delete`.

Now that we're on main with a clean state, run memory archive review for the just-closed phase:

**Check if archive exists:**
```bash
ARCHIVE_DIR=$(ls -d .specify/archive/${PHASE_NUMBER}-* 2>/dev/null | head -1)
if [[ -n "$ARCHIVE_DIR" ]]; then
  echo "Processing archive for phase $PHASE_NUMBER..."
fi
```

**Run memory archive review:**
If archive exists, execute `/flow.memory --archive $PHASE_NUMBER` inline. This will:
- Scan the archived phase for promotable content
- Present findings for user approval
- Promote approved content to memory docs

**After review completes**, use `AskUserQuestion` to determine archive disposition:

```json
{
  "questions": [{
    "question": "Archive review complete. What should we do with the archive?",
    "header": "Archive",
    "options": [
      {"label": "Delete archive (Recommended)", "description": "Archive is in git history if needed later"},
      {"label": "Keep archive", "description": "Preserve for manual review"}
    ],
    "multiSelect": false
  }]
}
```

**Handle response:**
- **Delete archive**:
  ```bash
  rm -rf .specify/archive/${PHASE_NUMBER}-*/
  echo "Deleted archive for phase $PHASE_NUMBER (current phase only)"
  ```
- **Keep archive**: Leave in place, log that archive was preserved
  - User can run `/flow.memory --archive $PHASE_NUMBER --delete` later

After memory integration completes, commit any changes:
```bash
if ! git diff --quiet .specify/memory/ || ! git diff --quiet .specify/; then
  git add .specify/memory/ .specify/
  git commit -m "docs: integrate phase $PHASE_NUMBER learnings into memory"
  git push origin main
fi
```

Use TodoWrite: mark [MERGE] MEMORY complete, mark [MERGE] DONE in_progress.

### 11. Done

**Before printing final DONE message, generate a post-merge test path (required):**

Build a "Test What Was Just Merged" guide for non-developers using:
- The verification guide from `/flow.verify` (preferred)
- Otherwise: `README.md`, docs, scripts, env example files, phase goals, and acceptance criteria

The guide MUST include:
1. Repo sync command(s) for user's mode (local-only vs merged-to-main)
2. Setup command(s) and env setup command(s)
3. Exact app start command
4. URL and first expected screen/state
5. 3-7 manual smoke-test steps with expected outcomes
6. What to do if a step fails (what log/output to share)

**Output rule:** Replace all placeholders with concrete commands/URLs from the project. If something cannot be auto-detected, say what was checked and give the best fallback command options.

**If LOCAL_ONLY_MODE=true**:
```text
✓ Closed phase $PHASE_NUMBER (local only)
✓ Committed changes locally
⊘ Skipped push/PR/merge (no remote configured)
✓ Integrated archive into memory

Phase is complete locally. To push later:
1. Configure remote: git remote add origin <url>
2. Push: git push -u origin $CURRENT_BRANCH

Test What Was Just Implemented:
1. Confirm branch: git branch --show-current
2. Setup: [actual copy/paste setup commands]
3. Start app: [actual start command]
4. Open: [actual URL]
5. Run smoke test steps:
   - [actual step 1 + expected result]
   - [actual step 2 + expected result]
   - [actual step 3 + expected result]
```

**If LOCAL_ONLY_MODE=false**:
```text
✓ Closed phase $PHASE_NUMBER
✓ Committed changes
✓ Pushed and merged PR
✓ Switched to main (clean)
✓ Integrated archive into memory

Test What Was Just Merged:
1. Sync main:
   - git checkout main
   - git pull origin main
2. Setup: [actual copy/paste setup commands]
3. Start app: [actual start command]
4. Open: [actual URL]
5. Run smoke test steps:
   - [actual step 1 + expected result]
   - [actual step 2 + expected result]
   - [actual step 3 + expected result]

Run /flow.orchestrate to start the next phase
```

Use TodoWrite: mark [MERGE] DONE complete.

## Error Handling

| Error | Response |
|-------|----------|
| Not on feature branch | "Switch to a feature branch first" |
| No git remote | **Ask user** - offer local-only merge or cancel |
| Uncommitted changes | **Ask user** - show changes, offer: commit with phase, stash, review, or abort |
| Phase close fails | Show CLI error message |
| Merge fails | "Check for merge conflicts or required reviews" |
| gh not installed | Provide manual PR URL |
| Memory integration fails | Log error but don't fail merge; user can run `/flow.memory --archive` manually |

## Context

$ARGUMENTS
