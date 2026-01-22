# Flow Commands Harmony Fix Plan

## Overview

This plan addresses 21 cross-command integration issues identified during comprehensive audit of all flow.* commands. The goal is **end-to-end workflow harmony** - ensuring all commands work together seamlessly with consistent state management, artifact handling, and error recovery.

---

## Phase 1: Critical Blocking Fixes (Must Fix First)

**Estimated effort: 2-3 hours**

### 1.1 Fix Orchestrate Routing Table
**File**: `commands/flow.orchestrate.md`
**Lines**: 92-102

**Changes**:
- Add missing `verified` route: `| verified | Go to Section 6 (Phase Transition) |`
- Add missing `archive_phase` route: `| archive_phase | Run specflow phase close or /flow.merge |`
- Remove invalid `verified` on line 102 (duplicate of ready_to_merge)

**Verification**: Run `specflow status --json` after verify completes, confirm routing works

---

### 1.2 Add MAX_ITERATIONS to flow.analyze
**File**: `commands/flow.analyze.md`
**Lines**: 136-141

**Changes**:
```markdown
### 6. State Transition

**Auto-fix loop (max 5 iterations):**

If **issues found** (ANY severity):
- iteration++
- If iteration >= 5: Present remaining issues to user, ask to proceed or abort
- Otherwise: Apply fixes (see flow.orchestrate parallel fix strategy), re-run analysis
```

**Verification**: Intentionally create issues, confirm loop terminates after 5 iterations

---

### 1.3 Create Missing Memory Document
**File**: `.specify/memory/security-checklist.md`

**Content**:
```markdown
# Security Checklist

## Input Validation
- [ ] All user inputs validated at system boundaries
- [ ] No sensitive data in error messages
- [ ] Path traversal prevention for file operations

## Authentication & Authorization
- [ ] Auth checks on sensitive operations
- [ ] API endpoints require appropriate permissions

## Data Protection
- [ ] Credentials stored in environment variables, not code
- [ ] No secrets committed to repository
- [ ] Sensitive config uses Keychain/secure storage
```

**Verification**: `ls .specify/memory/` shows file exists

---

### 1.4 Store Phase Goals in State
**Files**:
- `commands/flow.design.md` (Section 1a, after line 111)
- `commands/flow.orchestrate.md` (Section 1, after line 164)

**Changes to flow.design.md**:
```markdown
**1a. Load phase document and persist goals:**

After extracting goals, store in state for cross-command access:

```bash
specflow state set "orchestration.phase.goals=$(cat <<'EOF'
["Goal 1 description", "Goal 2 description", "Goal 3 description"]
EOF
)"
```

This ensures goals survive conversation compaction and are available to analyze/implement/verify.
```

**Changes to flow.orchestrate.md**:
```markdown
After loading phase document, persist to state:

```bash
specflow state set orchestration.phase.number=$PHASE_NUMBER
specflow state set orchestration.phase.goals="[JSON array of goals]"
```
```

**Verification**: `specflow state get orchestration.phase.goals` returns goals array

---

### 1.5 Add Parallel Agent Coordination Pattern
**Files**: ALL flow.*.md commands with parallel patterns

**Create new section in each file** (standardized pattern):

```markdown
## Parallel Agent Coordination

When launching parallel agents:

1. **Pre-launch validation**:
   - Verify no file path overlaps between agents
   - Each agent gets exclusive file set

2. **Execution**:
   - Launch all agents simultaneously
   - Set timeout: 120 seconds per agent
   - If any agent times out, continue with completed results

3. **Aggregation**:
   - Wait for all agents OR timeout
   - Merge results by category
   - Deduplicate findings with same file:line
   - Report any agent failures

4. **Error handling**:
   - If 1 agent fails: Log warning, continue with others
   - If >50% agents fail: Halt and report
   - If timeout: Report partial results, ask user to retry
```

**Apply to**: flow.design (1b), flow.analyze (2, 3), flow.implement (4.1), flow.verify (3, 4, 5), flow.review (3, 5)

---

### 1.6 Add File Conflict Detection for Parallel Tasks
**File**: `commands/flow.implement.md`
**Location**: Section 4.1, before "Launch parallel Task agents"

**Add**:
```markdown
**Pre-parallel validation (REQUIRED):**

Before parallelizing [P] tasks:

1. Extract file paths from each task description
2. Build file→task mapping
3. Check for overlaps:
   ```
   If file X mentioned in T001 AND T002:
     → Cannot parallelize T001, T002
     → Run sequentially instead
   ```
4. Only parallelize tasks with ZERO file overlap

Common overlap patterns to check:
- index.ts / index.js (exports)
- package.json (dependencies)
- Shared utility files
- Test setup files
```

---

## Phase 2: State & Handoff Consistency (High Priority)

**Estimated effort: 3-4 hours**

### 2.1 Standardize USER GATE Flow
**Files**: flow.verify.md, flow.merge.md, flow.orchestrate.md

**Create unified USER GATE handling**:

```markdown
## USER GATE Protocol (All Commands)

**State values**:
- `orchestration.phase.userGateStatus`: `pending` | `confirmed` | `skipped`

**Flow**:
1. flow.verify Step 6: Check for USER GATE marker in phase doc
2. If USER GATE exists:
   - Set: `specflow state set orchestration.phase.userGateStatus=pending`
   - Present verification criteria to user
   - If user confirms: `specflow state set orchestration.phase.userGateStatus=confirmed`
   - If user skips: `specflow state set orchestration.phase.userGateStatus=skipped`
3. flow.merge Step 2: Check `userGateStatus`
   - If `pending`: BLOCK merge, show criteria
   - If `confirmed` or `skipped`: Proceed
4. flow.orchestrate: Route based on `userGateStatus`, not step.current

**Single AskUserQuestion format** (use in all commands):
```json
{
  "questions": [{
    "question": "USER GATE: Have you verified the phase criteria are met?",
    "header": "Verification",
    "options": [
      {"label": "Yes, verified", "description": "I have tested and confirmed"},
      {"label": "Show criteria", "description": "Display what needs verification"},
      {"label": "Skip gate", "description": "Proceed without verification (document reason)"}
    ]
  }]
}
```
```

---

### 2.2 Fix State Race Conditions
**Files**: flow.design.md, flow.analyze.md

**Changes**:
- Remove state updates from flow.design.md (lines 85, 199-201)
- Remove state updates from flow.analyze.md (lines 37, 131-132)
- Add to each: "State transitions are managed by flow.orchestrate"

**flow.orchestrate.md** becomes single source of truth for state:
```markdown
**State Ownership**: Only flow.orchestrate updates orchestration.step.* values.
Sub-commands (design, analyze, implement, verify) return completion status.
Orchestrate advances state after confirming sub-command success.
```

---

### 2.3 Standardize Coverage Definition
**Create new file**: `.specify/templates/goal-coverage-template.md`

```markdown
# Phase Goal Coverage Matrix

| Phase Goal | Spec Requirement(s) | Task ID(s) | Status |
|------------|---------------------|------------|--------|
| Goal 1     | REQ-001, REQ-002    | T001-T005  | Covered |
| Goal 2     | REQ-003             | T010-T012  | Covered |
| Goal 3     | REQ-004             | NONE       | Missing |

## Status Values
- **Covered**: Goal has requirements AND tasks
- **Missing**: Goal lacks requirements OR tasks
- **Deferred**: Explicitly deferred with reason
- **Partial**: Some requirements/tasks missing

## Coverage Calculation
- Total Goals: N
- Covered: M
- Coverage: M/N × 100%
```

**Update commands** to use this format:
- flow.design Section 2d, 4e: Generate this file
- flow.analyze Pass A: Validate this file
- flow.verify Step 4: Reference this file
- Location: `specs/NNNN-phase/goal-coverage.md`

---

### 2.4 Fix Uncommitted Changes in Merge
**File**: `commands/flow.merge.md`
**Location**: Section 1 (Pre-flight), before specflow phase close

**Add**:
```markdown
**Stage ALL changes before phase close:**

```bash
# Stage everything including project code
git add -A

# Show what will be committed
git status --short

# Commit project changes FIRST (before phase close)
git commit -m "feat: Phase $PHASE_NUMBER implementation"
```

Then proceed with `specflow phase close` which commits metadata.
```

---

### 2.5 Standardize TodoWrite Patterns
**Create section in each command**:

```markdown
## Todo List Conventions

**Prefix**: [COMMAND_NAME] (e.g., [DESIGN], [IMPL], [VERIFY])

**When called by orchestrate**:
- Orchestrate has master [ORCH] list
- Sub-command creates detailed list with its prefix
- On completion, sub-command marks all its items complete
- Orchestrate marks [ORCH] item complete

**Standard items per command**:
- flow.design: SETUP, DISCOVER, SPECIFY, PLAN, TASKS, CHECKLISTS (6)
- flow.analyze: LOAD, DETECT, REPORT (3)
- flow.implement: INIT, EXECUTE, COMPLETE (3)
- flow.verify: CONTEXT, GATES, GOALS, MEMORY, REPORT (5)
- flow.merge: PREFLIGHT, GATE, CLOSE, PUSH, MERGE, DONE (6)
```

---

## Phase 3: Artifact & Format Consistency (Medium Priority)

**Estimated effort: 2-3 hours**

### 3.1 Standardize ui-design.md Handling
**Files**: flow.design.md, flow.analyze.md, flow.verify.md

**Add decision matrix**:

```markdown
## ui-design.md Decision Matrix

| Phase Type | ui-design.md Required? | Pass H Behavior |
|------------|------------------------|-----------------|
| Frontend/Dashboard | YES | Verify all components |
| CLI tool | NO | Skip Pass H |
| API/Backend | NO | Skip Pass H |
| Mixed (has UI) | YES | Verify UI components only |

**Detection**: Check phase goals for UI keywords:
- "dashboard", "page", "component", "view", "screen" → UI phase
- "CLI", "API", "migration", "refactor" → Non-UI phase

**If UI phase and ui-design.md missing**: CRITICAL error in flow.analyze
```

---

### 3.2 Standardize Memory Document Loading
**Create shared section** for all commands:

```markdown
## Memory Document Loading

**Required** (always load):
- `.specify/memory/constitution.md` - Core principles

**Recommended** (load if exists):
- `.specify/memory/tech-stack.md` - Approved technologies
- `.specify/memory/coding-standards.md` - Style guidelines
- `.specify/memory/testing-strategy.md` - Test requirements
- `.specify/memory/security-checklist.md` - Security patterns

**Loading pattern**:
```bash
for doc in constitution tech-stack coding-standards testing-strategy security-checklist; do
  if [[ -f ".specify/memory/${doc}.md" ]]; then
    # Load document
  fi
done
```
```

Apply to: flow.design (1c), flow.analyze (2), flow.verify (5)

---

### 3.3 Add Prerequisites Section to All Commands
**Add after "## Goal" in each command**:

```markdown
## Prerequisites

| Requirement | How to Check | If Missing |
|-------------|--------------|------------|
| Active phase | `specflow status --json` → phase.number | Run `specflow phase open` |
| Design artifacts | context.hasSpec/hasPlan/hasTasks | Run `/flow.design` |
| Tasks complete | progress.tasksCompleted == tasksTotal | Run `/flow.implement` |

**Pre-flight check**:
```bash
specflow check --gate [previous_gate]
```

If gate fails, abort with instructions.
```

---

### 3.4 Standardize Checklist Prefixes
**File**: `commands/flow.design.md` (Section 5), `commands/flow.verify.md` (Section 3)

**Add**:
```markdown
## Checklist Item ID Format

| Prefix | Type | Example | Used In |
|--------|------|---------|---------|
| V-### | Verification item | V-001 | verification.md |
| I-### | Implementation guidance | I-001 | implementation.md |
| C-### | Custom/domain item | C-001 | Any checklist |

**Format**: Always use dash separator (V-001, not V001)

**Marking**: `specflow mark V-001` or `specflow mark V-001 V-002 V-003`
```

---

### 3.5 Define Requirement ID Format
**File**: `.specify/templates/spec-template.md`

**Add**:
```markdown
## Requirements Format

Each requirement MUST have:
- **ID**: REQ-NNN format (e.g., REQ-001)
- **Title**: Brief description
- **Description**: Detailed explanation
- **Acceptance Criteria**: Measurable success criteria
- **Priority**: High/Medium/Low

Example:
```markdown
### REQ-001: User Authentication

**Description**: Users must be able to log in with email/password.

**Acceptance Criteria**:
- [ ] Login form accepts email and password
- [ ] Invalid credentials show error message
- [ ] Successful login redirects to dashboard

**Priority**: High
```
```

---

## Phase 4: Error Recovery & Documentation (Lower Priority)

**Estimated effort: 1-2 hours**

### 4.1 Standardize Error Recovery
**Add to all commands**:

```markdown
## Error Classification

| Class | State Change | User Action | Example |
|-------|--------------|-------------|---------|
| BLOCKING | step.status=failed | Must fix | Missing required file |
| RECOVERABLE | No change | Can skip | Optional check failed |
| WARNING | No change | Informational | Style issue |

**On BLOCKING error**:
```bash
specflow state set orchestration.step.status=failed
specflow state set orchestration.step.error="Error description"
```

**Recovery options** (present to user):
1. Retry - Re-run current step
2. Skip - Advance to next (if allowed)
3. Diagnose - Run `specflow check --fix`
4. Abort - Exit for manual intervention
```

---

### 4.2 Add Command Invocation Note
**Add to header of ALL flow.*.md commands**:

```markdown
**Note**: Use `specflow` directly (installed at `~/.claude/specflow-system/bin/specflow`), not `npx specflow`.
```

---

### 4.3 Remove/Document Context Section
**All commands**: Either remove `## Context\n\n$ARGUMENTS` or add explanation:

```markdown
## Context

This section receives runtime arguments when the command is invoked.
- Empty: Use defaults
- Arguments parsed per "## Arguments" section above
```

---

## Implementation Checklist

### Phase 1 (Critical)
- [ ] 1.1 Fix orchestrate routing table
- [ ] 1.2 Add MAX_ITERATIONS to analyze
- [ ] 1.3 Create security-checklist.md
- [ ] 1.4 Store phase goals in state
- [ ] 1.5 Add parallel agent coordination pattern
- [ ] 1.6 Add file conflict detection

### Phase 2 (High Priority)
- [ ] 2.1 Standardize USER GATE flow
- [ ] 2.2 Fix state race conditions
- [ ] 2.3 Standardize coverage definition
- [ ] 2.4 Fix uncommitted changes in merge
- [ ] 2.5 Standardize TodoWrite patterns

### Phase 3 (Medium Priority)
- [ ] 3.1 Standardize ui-design.md handling
- [ ] 3.2 Standardize memory document loading
- [ ] 3.3 Add prerequisites section
- [ ] 3.4 Standardize checklist prefixes
- [ ] 3.5 Define requirement ID format

### Phase 4 (Lower Priority)
- [ ] 4.1 Standardize error recovery
- [ ] 4.2 Add command invocation note
- [ ] 4.3 Document context section

---

## Files to Modify

| File | Changes |
|------|---------|
| commands/flow.orchestrate.md | 1.1, 1.4, 1.5, 2.1, 2.2, 2.5, 3.3, 4.1, 4.2 |
| commands/flow.analyze.md | 1.2, 1.5, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2 |
| commands/flow.design.md | 1.4, 1.5, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2 |
| commands/flow.implement.md | 1.5, 1.6, 2.5, 3.3, 4.1, 4.2 |
| commands/flow.verify.md | 1.5, 2.1, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2 |
| commands/flow.merge.md | 1.5, 2.1, 2.4, 2.5, 3.3, 4.1, 4.2 |
| commands/flow.review.md | 1.5, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2 |
| .specify/memory/security-checklist.md | 1.3 (CREATE) |
| .specify/templates/goal-coverage-template.md | 2.3 (CREATE) |
| .specify/templates/spec-template.md | 3.5 (UPDATE) |

---

## Verification

After all fixes applied:

1. **Smoke test**: Run `/flow.orchestrate` on a new phase end-to-end
2. **State test**: Verify all state keys are set/read consistently
3. **Error test**: Intentionally fail at each step, verify recovery works
4. **Parallel test**: Run with [P] tasks, verify no file conflicts
5. **USER GATE test**: Test phase with USER GATE marker
