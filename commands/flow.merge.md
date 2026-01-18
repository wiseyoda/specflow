---
description: Complete a phase by closing it, pushing, and merging to main.
handoffs:
  - label: Start Next Phase
    agent: specflow.orchestrate
    prompt: Start the next phase
    send: true
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

## Goal

Complete the current phase:
1. Close the phase (update ROADMAP, archive, reset state)
2. Commit the phase closure changes
3. Push and merge to main
4. Switch to main with clean state

## Execution

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

**Check for uncommitted changes:**

```bash
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo "ERROR: Uncommitted changes detected"
  echo "Commit changes first: git add . && git commit -m 'message'"
  exit 1
fi
```

### 2. Close Phase via CLI

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

### 3. Commit Phase Closure

```bash
git add ROADMAP.md .specify/
git commit -m "chore: complete phase $PHASE_NUMBER"
```

### 4. Push Branch

```bash
git push -u origin "$CURRENT_BRANCH"
```

### 5. Create Pull Request

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

### 6. Handle --pr-only

```bash
if [[ "$ARGUMENTS" == *"--pr-only"* ]]; then
  echo "✓ PR created (--pr-only mode)"
  echo "Review at: $PR_URL"
  echo ""
  echo "After review, run /flow.merge to complete"
  exit 0
fi
```

### 7. Merge PR

```bash
gh pr merge --squash --delete-branch
```

### 8. Switch to Main

```bash
git checkout main
git pull origin main
git branch -d "$CURRENT_BRANCH" 2>/dev/null || true
```

Working directory is now clean on main.

### 9. Done

```text
✓ Closed phase $PHASE_NUMBER
✓ Committed changes
✓ Pushed and merged PR
✓ Switched to main (clean)

Run /flow.orchestrate to start the next phase
```

## Error Handling

| Error | Response |
|-------|----------|
| Not on feature branch | "Switch to a feature branch first" |
| Uncommitted changes | "Commit changes first" |
| Phase close fails | Show CLI error message |
| Merge fails | "Check for merge conflicts or required reviews" |
| gh not installed | Provide manual PR URL |

## Context

$ARGUMENTS
