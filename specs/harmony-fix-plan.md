# End-to-End Harmony Fix Plan

> Consolidated from verified agent analysis. Each fix validated against codebase.

## Architecture Decisions (from user)

- **State**: Distributed ownership - commands run independently, orchestrate chains
- **Chaining**: Orchestrate controls all - no auto-chain between sub-commands
- **ANALYZE**: Route to `/flow.analyze` (not inline)
- **Archive**: merge deletes current phase, memory handles any/all phases

---

## Phase 1: State Domain Initialization

**Problem**: Commands define state domains but don't initialize them.

### 1.1 flow.design.md - Add domain initialization

**Location**: Section 1.a, after line 144

```markdown
**Persist phase state (survives compaction):**

```bash
specflow state set orchestration.phase.goals='["Goal 1", "Goal 2", ...]'
specflow state set orchestration.phase.hasUserGate=true
specflow state set orchestration.phase.userGateCriteria="Acceptance criteria from phase doc"
```
```

### 1.2 flow.implement.md - Add domain initialization

**Location**: Section 1, after line 77

```markdown
**Initialize implementation tracking:**

```bash
specflow state set orchestration.implement.started_at=$(date -Iseconds)
specflow state set orchestration.implement.current_section=""
```
```

### 1.3 flow.memory.md - Add parent object check

**Location**: Section 8.2, before first archive write

```markdown
**Initialize archive tracking (if not exists):**

```bash
if [[ -z "$(specflow state get memory.archive_reviews)" ]]; then
  specflow state set memory.archive_reviews='{}'
fi
```
```

### 1.4 flow.orchestrate.md - Add cross-domain validation

**Location**: Section 0, after line 103 (after health check)

```markdown
**Validate domain state on resume:**

```bash
# If resuming at analyze or later, verify design initialized its domain
if [[ "$STEP_INDEX" -ge 1 ]]; then
  GOALS=$(specflow state get orchestration.phase.goals)
  if [[ -z "$GOALS" || "$GOALS" == "null" ]]; then
    echo "ERROR: Design step did not initialize phase.goals"
    echo "Re-run /flow.design or set manually"
    exit 1
  fi
fi
```
```

---

## Phase 2: ANALYZE Routing

**Problem**: ANALYZE is inline in orchestrate; should route like other steps.

### 2.1 flow.orchestrate.md - Replace inline ANALYZE

**Location**: Lines 220-297 - Replace entire section with:

```markdown
### 3. ANALYZE (Step 1)

**MANDATORY STEP - DO NOT SKIP**

Execute `/flow.analyze` which handles:
- 8-pass detection (goals, duplication, ambiguity, coverage, constitution)
- Auto-fix loop (max 5 iterations)
- Parallel file fixing agents

**Verify before advancing:**
```bash
STATUS=$(specflow state get orchestration.step.status)
```

If `status == "complete"`:
1. TodoWrite: mark [ORCH] ANALYZE complete, [ORCH] IMPLEMENT in_progress
2. `specflow state set orchestration.step.current=implement orchestration.step.index=2`
3. Continue to IMPLEMENT

If `status == "blocked"`:
- Present issues to user
- Halt orchestration
```

### 2.2 flow.analyze.md - Add auto-fix parallel agents

**Location**: After line 196, expand auto-fix section:

```markdown
**Parallel Fix Agents:**

Agent 1: Fix spec.md issues
  - Scope: spec.md ONLY
  - Apply all spec fixes in one edit session

Agent 2: Fix plan.md issues
  - Scope: plan.md ONLY

Agent 3: Fix tasks.md issues
  - Scope: tasks.md ONLY

Wait for ALL 3 before re-running analysis.

**Persist iteration counter:**
```bash
specflow state set orchestration.analyze.iteration=$iteration
```
```

### 2.3 flow.orchestrate.md - Update step table

**Location**: Line 47

Change:
```
| analyze | 1 | Inline | Cross-artifact consistency |
```

To:
```
| analyze | 1 | `/flow.analyze` | Cross-artifact consistency |
```

---

## Phase 3: Remove Auto-Chain

**Problem**: 4 files have `send: true` violating orchestrate-controlled flow.

### 3.1 flow.verify.md - Remove send: true

**Location**: Line 10

Remove `send: true` from "Continue Orchestration" handoff.

### 3.2 flow.merge.md - Remove send: true

**Location**: Line 7

Remove `send: true` from "Start Next Phase" handoff.

### 3.3 flow.roadmap.md - Remove send: true

**Location**: Line 7

Remove `send: true` from "Start First Phase" handoff.

### 3.4 flow.init.md - Remove send: true

**Location**: Line 7

Remove `send: true` from "Start Orchestration" handoff.

---

## Phase 4: Archive Lifecycle

**Problem**: flow.memory auto-deletes archives; should require explicit flag.

### 4.1 flow.memory.md - Add --delete flag

**Location**: Line 21, add to arguments:

```markdown
| `--archive <phase\|all>` | Review archived phases for memory promotion |
| `--archive --delete` | Review AND delete archives after promotion |
```

### 4.2 flow.memory.md - Fix auto-delete behavior

**Location**: Lines 347-360, change:

From:
```
If no candidates found, proceed automatically:
- Delete the archive directory
```

To:
```
If no candidates found:
- If --delete flag: Delete archive
- Otherwise: Preserve archive, mark as reviewed
```

### 4.3 flow.merge.md - Clarify current phase deletion

**Location**: Lines 327-372, add safety check:

```markdown
**Delete ONLY current phase archive:**
```bash
if specflow state get memory.archive_reviews.$PHASE_NUMBER; then
  rm -rf .specify/archive/${PHASE_NUMBER}-*/
fi
```

Do NOT delete other phase archives.
```

---

## Phase 5: Parallel Execution Safety

### 5.1 flow.analyze.md - Critical pass protection

**Location**: After line 103, add:

```markdown
**CRITICAL PASS PROTECTION:**

If Pass A (Goals) or Pass E (Constitution) times out:
- HALT immediately
- Report: "Critical analysis pass failed - cannot proceed"
- Do NOT continue with partial results
```

### 5.2 flow.verify.md - File locking pattern

**Location**: Section 3 (lines 122-165), add:

```markdown
**Checklist Write Pattern:**
1. Load ALL checklist files upfront (read once)
2. Agents mark items in memory only
3. Collect all marks after agents complete
4. Write each file once (batch updates)
```

### 5.3 All commands - Unified failure recovery

**Location**: Error handling sections in analyze, verify, implement:

```markdown
**Agent Failure Recovery:**

Maintain: `failedAgents = []`, `incompleteWork = []`

For each agent:
- timeout → add to failedAgents, capture partial results
- error → add to failedAgents, log error
- success → collect results

Decision:
- Critical agent fails → HALT
- >50% fail → HALT
- <50% fail → Continue, report incomplete work at end
```

---

## Phase 6: Missing Gates

### 6.1 check.ts - Add specify gate (NEW)

**Location**: packages/cli/src/commands/check.ts

Add `specify` to GateType and implement `checkSpecifyGate()`:
- Verify spec.md exists with no placeholders
- Verify goal coverage matrix exists
- All goals at minimum PARTIAL status

### 6.2 flow.merge.md - Add memory gate check

**Location**: Step 2 (lines 141-219), add Agent 4:

```markdown
Agent 4 (Memory Gate):
  - Run `specflow check --gate memory`
  → Return: passed, gate_status
```

### 6.3 flow.review.md - Severity 5 blocking

**Location**: Step 4 (lines 215-264), add before effort-based triage:

```markdown
**Severity 5 Check:**

Scan all findings for `severity: 5` (Blocking)
If ANY found:
- Cannot auto-approve
- Switch to INTERACTIVE mode
- User must explicitly handle each blocking finding
```

### 6.4 flow.orchestrate.md - Phase/branch validation

**Location**: Step 0 or 1, add:

```markdown
**Validate phase exists:**
```bash
if ! grep -q "^| $PHASE_NUMBER " ROADMAP.md; then
  echo "ERROR: Phase $PHASE_NUMBER not in ROADMAP.md"
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
EXPECTED_BRANCH=$(specflow state get orchestration.phase.branch)
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "ERROR: Branch mismatch - expected $EXPECTED_BRANCH"
  exit 1
fi
```
```

### 6.5 flow.verify.md - Analyze drift detection

**Location**: Step 1, add:

```markdown
**Check for spec.md drift:**

```bash
ANALYZE_TIME=$(specflow state get orchestration.analyze.completedAt)
SPEC_MTIME=$(stat -f '%m' {FEATURE_DIR}/spec.md)

if [[ "$SPEC_MTIME" -gt "$ANALYZE_TIME" ]]; then
  echo "spec.md modified after analyze - re-running analysis"
  /flow.analyze
fi
```
```

---

## Implementation Order

| Priority | Phase | Items | Effort |
|----------|-------|-------|--------|
| P0 | 3 | Remove auto-chain (4 files) | 10 min |
| P0 | 1.1-1.3 | State initialization (design, implement, memory) | 30 min |
| P1 | 2 | ANALYZE routing | 45 min |
| P1 | 4 | Archive lifecycle | 30 min |
| P1 | 5.1 | Critical pass protection | 15 min |
| P2 | 6.1 | Add specify gate to CLI | 1 hr |
| P2 | 5.2-5.3 | Parallel safety patterns | 45 min |
| P2 | 6.2-6.5 | Remaining gates | 1 hr |

**Total**: ~5 hours of focused work

---

## Verification Checklist

After implementing, run:

1. `specflow check --fix` - Verify no regressions
2. `/flow.orchestrate` on test phase - Full workflow
3. Context compaction test - Kill mid-design, resume
4. Parallel execution test - Run implement with [P] tasks
5. Archive lifecycle test - merge current phase, memory --archive others
