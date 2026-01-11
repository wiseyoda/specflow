# SpecKit Improvement Analysis

> Comprehensive analysis comparing your implementation to GitHub's vanilla spec-kit and industry best practices for agentic coding environments.

**Date**: 2026-01-10
**Sources**: GitHub spec-kit, Red Hat SDD guide, GitHub Blog, JetBrains Junie, The New Stack, industry research

---

## Executive Summary

Your SpecKit v2.0 implementation is **well-architected** and aligns with industry best practices. The main improvement opportunities are:

1. **Task Progress Dashboard** - Add visual punch list (your stated need)
2. **Lessons Learned Loop** - Missing feedback mechanism from vanilla spec-kit
3. **POSIX Compliance** - Fix bash 4.0+ dependencies for portability
4. **Simplification** - Remove some over-engineering in state management
5. **Validation Gates** - Strengthen spec-to-implementation traceability

---

## Part 1: Progress Dashboard (Punch List)

### The Problem

You correctly identified that removing checkboxes from tasks.md makes agent tracking difficult. Currently:
- Checkboxes exist but are buried in task phases
- No visual summary at the top
- Users must scroll through entire file to understand status
- State file has counts but isn't human-readable

### Recommended Solution: Task Summary Section

Add a **progress dashboard** at the top of `tasks.md` that agents update via CLI:

```markdown
# Tasks: [FEATURE NAME]

## Progress Dashboard

> Last updated: 2026-01-10T14:32:00Z by speckit tasks sync

| Phase | Status | Progress |
|-------|--------|----------|
| Setup | DONE | 3/3 |
| Foundational | IN PROGRESS | 4/6 |
| User Story 1 | PENDING | 0/8 |
| User Story 2 | PENDING | 0/5 |
| Polish | PENDING | 0/4 |

**Overall**: 7/26 (27%)

### Quick Status
- [x] T001 Create project structure
- [x] T002 Initialize dependencies
- [x] T003 Configure linting
- [x] T004 Setup database schema
- [ ] **T005 Implement auth framework** ← CURRENT
- [ ] T006 Setup API routing
- ... (26 more tasks)

---

## Phase 1: Setup (DONE)
...
```

### Implementation

1. **Update `templates/tasks-template.md`** - Add Progress Dashboard section at top
2. **Update `speckit-tasks.sh`** - Add `sync` command to regenerate dashboard
3. **Update `speckit.implement`** - Call `speckit tasks sync` after each task completion
4. **Keep inline checkboxes** - They remain the source of truth; dashboard is derived

```bash
# New CLI command
speckit tasks sync           # Regenerate progress dashboard from checkboxes
speckit tasks sync --json    # Output dashboard data as JSON
```

### Benefits

- **Human-readable** at-a-glance status
- **Agent-trackable** via simple section parsing
- **Single source of truth** (checkboxes in phases)
- **Derived view** (dashboard regenerated, not manually maintained)

---

## Part 2: Best Practices Comparison

### What You're Doing Well (Keep)

| Practice | Your Implementation | Industry Standard |
|----------|---------------------|-------------------|
| Spec as living artifact | ✅ clarify.md updates spec | ✅ Required |
| Intent before implementation | ✅ spec.md → plan.md separation | ✅ Required |
| Task decomposition | ✅ Granular T001-Txxx tasks | ✅ Required |
| TDD support | ✅ `--tdd` flag | ✅ Recommended |
| State persistence | ✅ JSON state file | ✅ Required |
| Resumable workflows | ✅ Phase/step tracking | ✅ Required |
| File-as-truth recovery | ✅ `speckit state infer` | ✅ Best practice |
| Constitution/governance | ✅ constitution.md | ✅ Recommended |

### What's Missing (Add)

| Practice | Current State | Recommendation |
|----------|---------------|----------------|
| **Lessons Learned** | Not implemented | Add `.specify/memory/lessons-learned.md` |
| **Spec drift detection** | Manual only | Add `speckit analyze --drift` |
| **CI gate enforcement** | Not implemented | Add pre-commit hooks |
| **Checkpoint validation** | Documented, not enforced | Add `speckit checkpoint <phase>` |

---

## Part 3: Lessons Learned Loop

### The Gap

From Red Hat's best practices:
> "Whenever you encounter an error that needs to be fixed, check the lessons learned file to see if you already know how to fix it."

This feedback loop is **missing** from your implementation.

### Recommended Addition

1. **Create `templates/lessons-learned-template.md`**:

```markdown
# Lessons Learned

> Accumulated knowledge from implementation. Check before making decisions.

## Error Patterns

### [YYYY-MM-DD] Error: [Brief description]
**Context**: [What we were doing]
**Root Cause**: [Why it happened]
**Fix**: [How we fixed it]
**Prevention**: [How to avoid in future]

## Architecture Decisions

### [YYYY-MM-DD] Decision: [Brief description]
**Context**: [Why we needed to decide]
**Options**: [What we considered]
**Chosen**: [What we picked and why]
**Outcome**: [How it worked out]

## Gotchas

- [ ] [Technology] - [Gotcha description and workaround]
```

2. **Update `speckit.implement`** to check lessons-learned.md before each task
3. **Update `speckit.verify`** to prompt for lessons learned when closing a phase
4. **Add CLI support**:

```bash
speckit lessons add --type error "Brief description"
speckit lessons check "keyword"  # Search lessons for relevant info
```

---

## Part 4: Refactoring Opportunities

### 4.1 POSIX Compliance Issues

Found in test output:
- `context.sh`: Uses `declare -A` (bash 4.0+ associative arrays)
- `claude-md.sh`: Uses `head -n -1` (not POSIX, fails on macOS)

**Fix**: Replace with POSIX-compliant alternatives:
```bash
# Instead of declare -A
# Use separate variables or temp files

# Instead of head -n -1
# Use: sed '$d' file  # Delete last line
```

### 4.2 State Schema Simplification

Current state schema has nested complexity that isn't fully utilized:

```json
{
  "orchestration": {
    "steps": {
      "specify": { "status": "...", "attempts": 0, "errors": [], "output_files": [] },
      "clarify": { "status": "...", "attempts": 0, "errors": [], "output_files": [] },
      // ... 8 more steps with same structure
    }
  }
}
```

Most of `attempts`, `errors`, `output_files` are **never populated** in actual usage.

**Recommendation**: Simplify to:
```json
{
  "orchestration": {
    "current_step": "implement",
    "completed_steps": ["specify", "clarify", "plan", "tasks", "analyze", "checklist"],
    "tasks_completed": 12,
    "tasks_total": 26
  }
}
```

### 4.3 Redundant File Detection

Both `speckit detect` and `speckit state infer` scan for the same files. Consolidate:

```bash
# Current: Two commands doing similar work
speckit detect          # Scans files, reports existence
speckit state infer     # Scans files, updates state

# Proposed: Single command with flags
speckit detect                  # Scan and report
speckit detect --update-state   # Scan and update state (replaces infer)
```

### 4.4 Script Duplication

`check-prerequisites.sh` (legacy) and `speckit-context.sh` (v2.0) overlap significantly. The legacy file is kept for backward compatibility but adds confusion.

**Recommendation**:
- Deprecate `check-prerequisites.sh` entirely
- Update any references to use `speckit context`
- Remove in v2.1

---

## Part 5: Hardening Opportunities

### 5.1 Input Validation

Current: Trusts input from files without sanitization.

```bash
# In speckit-tasks.sh line 279
task_id=$(echo "$task_id" | tr '[:lower:]' '[:upper:]')
```

**Add**: Stricter validation before file operations:
```bash
# Sanitize before any sed/file operation
validate_task_id() {
  local id="$1"
  if [[ ! "$id" =~ ^[A-Z][0-9]{3,}$ ]]; then
    log_error "Invalid task ID format"
    exit 1
  fi
}
```

### 5.2 Atomic File Operations

Current: Uses temp files but doesn't always handle failures:

```bash
sed -E "..." "$file" > "$temp_file"
mv "$temp_file" "$file"
```

**Better**:
```bash
sed -E "..." "$file" > "$temp_file" || { rm -f "$temp_file"; exit 1; }
mv "$temp_file" "$file" || { rm -f "$temp_file"; exit 1; }
```

### 5.3 Lock Files for Concurrent Access

If multiple agents or terminals access the same project:

```bash
# Add to state operations
acquire_lock() {
  local lock_file="${STATE_FILE}.lock"
  if ! mkdir "$lock_file" 2>/dev/null; then
    log_error "State file is locked by another process"
    exit 1
  fi
  trap "rmdir '$lock_file' 2>/dev/null" EXIT
}
```

---

## Part 6: Simplification Opportunities

### 6.1 Command Consolidation

Some commands could be subcommands:

| Current | Proposed |
|---------|----------|
| `speckit detect` | `speckit project detect` |
| `speckit reconcile` | `speckit project sync` |
| `speckit scaffold` | `speckit project init` |
| `speckit context` | `speckit project status` |

This groups related operations and reduces top-level command count.

### 6.2 Template Simplification

Current templates have verbose instructional comments that could be moved to documentation:

```markdown
<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  ... 15 lines of instructions ...
  ============================================================================
-->
```

**Move to**: `docs/template-guide.md` with link in template header.

### 6.3 Remove Unused Features

The state schema supports features never used in commands:
- `health.detected_issues[]` - Populated but never read
- `ui.*` - Prepared for web UI that doesn't exist yet
- `orchestration.steps[*].output_files` - Always empty

**Action**: Remove or mark as `_reserved` until implemented.

---

## Part 7: Validation Gate Enforcement

### The Gap

From industry research:
> "Lack of validation—if specs aren't linked to CI tests, governance collapses."

Your implementation has validation checkpoints but doesn't **enforce** them.

### Recommended: Gate Commands

```bash
# Add enforcement commands
speckit gate specify    # Verify spec.md meets requirements before plan
speckit gate plan       # Verify plan.md complete before tasks
speckit gate implement  # Verify all tasks complete before verify
```

Each gate checks:
1. Required file exists
2. Required sections present
3. No placeholder text (e.g., `[PLACEHOLDER]`, `TODO`, `TBD`)
4. Cross-references valid (spec mentions → plan addresses)

### Integration with orchestrate

Update `speckit.orchestrate` to run gates between steps:

```text
Step 1: Specify
  → speckit gate specify (PASS)
Step 2: Clarify
  ...
Step 3: Plan
  → speckit gate plan (PASS)
Step 4: Tasks
  → speckit gate tasks (PASS)
...
```

---

## Part 8: Priority Action Items

### P0: Do Immediately - COMPLETED

1. **Add Progress Dashboard to tasks.md** ✅ DONE
   - Updated `templates/tasks-template.md` with Progress Dashboard section (v1.1)
   - Added `speckit tasks sync` command to regenerate dashboard from checkboxes
   - Auto-sync on `speckit tasks mark` - dashboard stays current

### P1: Do Soon - COMPLETED

2. **Fix POSIX compliance** ✅ Already Fixed
   - `declare -A` was not present in context.sh
   - `head -n -1` was already replaced with `sed '$d'` in claude-md.sh

3. **Add lessons-learned.md** ✅ DONE
   - Created `templates/lessons-learned-template.md`
   - Added `speckit lessons` command (init, add, check, list)

### P2: Do When Time Allows - COMPLETED

4. **Simplify state schema** - Deferred (works as-is)
5. **Add gate enforcement** ✅ DONE
   - Added `speckit gate` command (specify, plan, tasks, implement, all, status)
   - Checks: file exists, required sections, no placeholders, task completion
6. **Harden input validation** ✅ DONE
   - Added sanitization and stricter regex validation in speckit-tasks.sh
7. **Add atomic file operations** ✅ DONE
   - Added `atomic_write`, `atomic_transform`, `safe_file_update` to common.sh

### P3: Future

8. **Remove check-prerequisites.sh** (deprecated)
9. **Command grouping** (project subcommand)
10. **Lock files** (concurrent access protection)

---

## Appendix: Research Sources

- [GitHub Blog: Spec-Driven Development](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Red Hat: How SDD Improves AI Coding Quality](https://developers.redhat.com/articles/2025/10/22/how-spec-driven-development-improves-ai-coding-quality)
- [JetBrains Junie: Spec-Driven Approach](https://blog.jetbrains.com/junie/2025/10/how-to-use-a-spec-driven-approach-for-coding-with-ai/)
- [The New Stack: SDD Key to Scalable AI Agents](https://thenewstack.io/spec-driven-development-the-key-to-scalable-ai-agents/)
- [The New Stack: 5 Trends in Agentic Development 2026](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/)
- [GitHub spec-kit Repository](https://github.com/github/spec-kit)
