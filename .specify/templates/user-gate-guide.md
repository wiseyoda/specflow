# USER GATE Handling Guide

This guide defines the standardized pattern for handling USER GATE verification across all SpecFlow commands.

## What is a USER GATE?

A USER GATE is a phase requirement that requires explicit user verification before the phase can be merged. It's defined in the phase document (`.specify/phases/NNNN-*.md`) and indicates that automated verification is insufficient - a human must confirm the implementation meets specific criteria.

## State Fields

USER GATE state is stored in `.specflow/orchestration-state.json`:

| Field | Type | Values | Set By |
|-------|------|--------|--------|
| `orchestration.phase.hasUserGate` | boolean | `true`, `false` | `/flow.design` (from phase doc) |
| `orchestration.phase.userGateStatus` | enum | `pending`, `confirmed`, `skipped` | `/flow.verify`, `/flow.orchestrate`, `/flow.merge` |

## Initialization (in /flow.design)

When loading the phase document, extract USER GATE presence:

```bash
# Check if phase doc contains USER GATE marker
if grep -q "USER GATE" ".specify/phases/$PHASE_NUMBER-*.md"; then
  specflow state set orchestration.phase.hasUserGate=true
else
  specflow state set orchestration.phase.hasUserGate=false
fi
```

## Check Sequence (used by /flow.verify, /flow.orchestrate, /flow.merge)

All commands use this **exact same sequence**:

### Step 1: Check if USER GATE exists

```bash
# Method 1: From status output (preferred)
HAS_GATE=$(specflow status --json | jq -r '.phase.hasUserGate')

# Method 2: From state directly
HAS_GATE=$(specflow state get orchestration.phase.hasUserGate)
```

If `HAS_GATE` is `false` or empty, skip USER GATE handling entirely.

### Step 2: Check if already handled

```bash
GATE_STATUS=$(specflow state get orchestration.phase.userGateStatus)
```

| Status | Meaning | Action |
|--------|---------|--------|
| `confirmed` | User verified implementation | Proceed - no prompt needed |
| `skipped` | User chose to skip gate | Proceed - no prompt needed |
| `pending` or empty | Not yet handled | Prompt user (Step 3) |

### Step 3: Prompt user (if needed)

Use this **exact** `AskUserQuestion` format for consistency:

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

### Step 4: Handle response

| Response | State Update | Next Action |
|----------|--------------|-------------|
| **Yes, verified** | `specflow state set orchestration.phase.userGateStatus=confirmed` | Proceed |
| **Show details** | (no state change) | Display gate criteria + test steps, then re-prompt |
| **Skip gate** | `specflow state set orchestration.phase.userGateStatus=skipped` | Proceed (log reason) |
| **Other** | (no state change) | Block until user responds |

## Command-Specific Behavior

### /flow.design

- **Responsibility**: Set `hasUserGate` based on phase document
- **Does NOT prompt**: Only initializes state

### /flow.orchestrate

- **When**: During VERIFY step (Section 5)
- **Behavior**: Full prompt sequence if gate pending
- **On pending**: Block until user confirms or skips

### /flow.verify

- **When**: Step 6 (User Gate Check)
- **Behavior**: Full prompt sequence if gate pending
- **On pending**: Block verification completion

### /flow.merge

- **When**: Step 2 (Verify Gate Check)
- **Behavior**: Check if already confirmed (from verify), prompt if not
- **On pending**: Block merge until user confirms or skips

## Example: Complete Flow

```
1. /flow.design runs:
   - Reads .specify/phases/0080-cli-migration.md
   - Finds "USER GATE: Test CLI commands work"
   - Sets orchestration.phase.hasUserGate=true
   - Does NOT set userGateStatus (defaults to pending)

2. /flow.verify runs:
   - Gets hasUserGate=true from status
   - Gets userGateStatus=pending (or empty)
   - Prompts user with AskUserQuestion
   - User selects "Yes, verified"
   - Sets orchestration.phase.userGateStatus=confirmed

3. /flow.merge runs:
   - Gets hasUserGate=true from status
   - Gets userGateStatus=confirmed
   - Skips prompt (already handled)
   - Proceeds to merge
```

## Anti-Patterns

**DON'T do these:**

1. **Prompting when already confirmed**: Always check `userGateStatus` first
2. **Different question formats**: Use the exact JSON format above
3. **Forgetting to set state**: Always update state after user response
4. **Auto-confirming**: Never set `confirmed` without user response
5. **Blocking silently**: If gate pending, always prompt (don't just fail)

## Integration Points

Commands should reference this guide:

```markdown
See `.specify/templates/user-gate-guide.md` for the standardized USER GATE handling protocol.
```
