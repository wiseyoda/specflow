---
description: Scan completed phases for orphaned tasks, then triage backlog items into appropriate phases or create new phases.
handoffs:
  - label: Continue Development
    agent: speckit.orchestrate
    prompt: Continue with the next phase
  - label: View Roadmap
    agent: speckit.roadmap
    prompt: Show roadmap status
  - label: Continue Later
    agent: speckit.start
    prompt: Resume work on this project
---

## User Input

```text
$ARGUMENTS
```

Arguments:
- Empty: Run interactive triage on all backlog items
- `--auto`: Auto-assign high-confidence matches without confirmation
- `--dry-run`: Show proposed assignments without making changes

## Goal

Ensure no work is lost by scanning completed phases and triaging backlog items:

1. **Scan for orphaned tasks** - Find incomplete tasks in completed phases and add to backlog
2. Parse all backlog items from ROADMAP.md
3. Analyze each phase's Goal and Scope sections
4. Match items to phases by keyword and semantic relevance
5. Propose assignments with confidence scores
6. Create new phases for unassignable items
7. Update ROADMAP.md with assignments

## Execution Steps

### 0. Scan Completed Phases for Orphaned Tasks

**IMPORTANT**: Before triaging existing backlog items, scan previously completed phases for any incomplete tasks that were left behind.

**0a. Find completed phases:**

```bash
# Get all completed phases from ROADMAP
speckit roadmap status --json | jq -r '.phases[] | select(.status == "complete") | .number'
```

**0b. For each completed phase, check for incomplete tasks:**

```bash
for phase_dir in specs/*/; do
  phase_name=$(basename "$phase_dir")
  tasks_file="$phase_dir/tasks.md"

  if [[ -f "$tasks_file" ]]; then
    # Get incomplete tasks
    incomplete=$(grep -E '^\s*-\s*\[ \]\s*T[0-9]+' "$tasks_file" || true)

    if [[ -n "$incomplete" ]]; then
      echo "Found orphaned incomplete tasks in $phase_name:"
      echo "$incomplete"
    fi
  fi
done
```

**0c. For each orphaned task, add to backlog:**

For any incomplete task found in a completed phase:

```bash
# Extract task description and add to backlog
speckit roadmap backlog add "[Orphaned from PHASE] T###: Task description"
```

Then update the task in the original tasks.md to mark as deferred:
```text
- [x] T### Task description *(deferred to backlog - orphaned)*
```

**0d. Report orphaned tasks found:**

```text
============================================
Orphaned Task Scan Complete
============================================

Found 2 orphaned tasks in completed phases:
  • 0010: T015 - Implement edge case handling → Added to backlog
  • 0015: T032 - Add integration tests → Added to backlog

Proceeding to triage all backlog items...
```

---

### 1. Parse Backlog Items

**1a. Get backlog items:**

```bash
BACKLOG_JSON=$(speckit roadmap backlog list --json)
ITEM_COUNT=$(echo "$BACKLOG_JSON" | jq '.count')

if [[ "$ITEM_COUNT" -eq 0 ]]; then
  echo "No items in backlog to triage"
  exit 0
fi

echo "Found $ITEM_COUNT backlog item(s) to triage"
echo ""
```

**1b. Parse each item:**

```bash
# Items array from JSON
ITEMS=$(echo "$BACKLOG_JSON" | jq -c '.items[]')
```

### 2. Extract Phase Scopes

**2a. Read ROADMAP.md and extract each phase's Goal and Scope:**

For each phase in the ROADMAP table:

```text
Phase 0020 - Onboarding Polish
  Goal: Make the first-run experience smooth
  Scope:
    - Multi-language templates
    - Add --safe flag to scaffold
    - Optimize CLI output

Phase 0030 - Test Suite Completion
  Goal: All CLI scripts have passing tests
  Scope:
    - Fix POSIX compatibility
    - Add Linux CI tests
    - macOS head syntax
```

**2b. Build phase context for matching:**

```text
phases = [
  {
    "number": "0020",
    "name": "Onboarding Polish",
    "goal": "Make the first-run experience smooth",
    "scope_keywords": ["templates", "scaffold", "CLI", "output", "first-run"]
  },
  {
    "number": "0030",
    "name": "Test Suite Completion",
    "goal": "All CLI scripts have passing tests",
    "scope_keywords": ["tests", "POSIX", "Linux", "CI", "macOS"]
  }
]
```

### 3. Match Items to Phases

**3a. For each backlog item, calculate match score:**

Scoring algorithm:
- **Keyword match** (0.3 per keyword): Item contains phase scope keyword
- **Goal alignment** (0.2): Item description aligns with phase goal
- **Domain match** (0.2): Item category matches phase category

Example:
```text
Item: "Add dark mode support"
  Phase 0020 (Onboarding):
    - Keyword matches: "UI" (0.3)
    - Goal alignment: user experience (0.2)
    - Score: 0.5 → Medium confidence

  Phase 0030 (Tests):
    - No keyword matches
    - No goal alignment
    - Score: 0.0 → No match
```

**3b. Assign confidence levels:**

| Score | Confidence | Action |
|-------|------------|--------|
| 0.7+ | High | Auto-assign (with --auto) |
| 0.4-0.7 | Medium | Show suggestion, ask user |
| 0.1-0.4 | Low | Show suggestion, likely new phase |
| <0.1 | None | Propose new phase |

### 4. Present Assignments

**4a. Display triage summary:**

```text
============================================
Backlog Triage Results
============================================

Item: "Add dark mode support"
  Best match: 0020 - Onboarding Polish (confidence: 0.65)
  Matched keywords: UI, user experience

  Options:
  A. Assign to 0020 - Onboarding Polish (Recommended)
  B. Assign to different phase
  C. Create new phase
  D. Skip (keep in backlog)

Item: "Implement webhook integration"
  No good match found (best: 0.15)

  Options:
  A. Create new phase "Integration Features" (Recommended)
  B. Assign to existing phase
  C. Skip (keep in backlog)
```

**4b. For each item, get user decision:**

Use `AskUserQuestion` to get user choice:
- If A (recommended), proceed with assignment
- If B, show phase list and let user choose
- If C, collect new phase details
- If D, skip item

### 5. Update ROADMAP

**5a. For assigned items, add to phase Scope section:**

Find the phase section in ROADMAP.md and append to Scope:

```markdown
**Scope**:
- Existing scope item 1
- Existing scope item 2
- Add dark mode support  ← NEW (from backlog)
```

**5b. For new phases, use speckit roadmap insert:**

```bash
speckit roadmap insert --after "$LAST_PHASE" "$NEW_PHASE_NAME" --non-interactive
```

Then update the new phase's scope with the items.

**5c. Clear assigned items from backlog:**

After all assignments, remove assigned items from backlog table.

### 6. Summary Output

**6a. Display results:**

```text
============================================
Triage Complete
============================================

Assigned to existing phases:
  • "Add dark mode support" → 0020 Onboarding Polish
  • "Improve error messages" → 0020 Onboarding Polish

New phases created:
  • 0051 - Integration Features
    - Implement webhook integration
    - Add API rate limiting

Remaining in backlog:
  • "Parallel phase execution" (user skipped)

Run /speckit.orchestrate to continue development
```

### 7. Handle --auto Mode

In `--auto` mode:
- Auto-assign all high-confidence (0.7+) matches
- Prompt only for medium/low confidence
- Skip items with no good match (keep in backlog)

### 8. Handle --dry-run Mode

In `--dry-run` mode:
- Show all proposed assignments
- Show what ROADMAP changes would be made
- Don't actually modify any files

```text
DRY RUN - Proposed Changes:

Would assign:
  "Add dark mode support" → 0020 Onboarding Polish

Would create new phase:
  0051 - Integration Features (after 0050)
    Items: "Implement webhook integration"

Would remain in backlog:
  "Parallel phase execution"

No changes made.
```

## Error Handling

| Error | Response |
|-------|----------|
| Empty backlog | "No items to triage" and exit |
| ROADMAP parse error | Show line number, suggest manual fix |
| Phase insert fails | Show error, keep item in backlog |
| No phases defined | "Create phases first with /speckit.roadmap" |

## Output Format

Interactive mode shows each item with options.

Summary format:

```text
============================================
Triage Complete
============================================

Assigned: 3 items to existing phases
Created: 1 new phase
Remaining: 1 item in backlog

Run /speckit.orchestrate to continue
```

## Context

$ARGUMENTS
