---
description: Execute all tasks defined in tasks.md using test-driven development.
handoffs:
  - label: Verify Completion
    agent: flow.verify
    prompt: Verify the implementation is complete and update ROADMAP.md
---

## Critical Rules

1. **NEVER edit tasks.md directly** to mark tasks complete - use `specflow mark T###`
2. **NEVER edit `.specflow/orchestration-state.json` directly** - use `specflow state set`
3. **TDD by default**: Write tests first, then implement (use `--no-tdd` to skip)
4. **Use `specflow` directly, NOT `npx specflow`** - It's a local CLI, not an npm package

## Tool Usage

**Use dedicated tools instead of bash for file operations:**

| Instead of (bash) | Use |
|---|---|
| `ls`, `find` | Glob tool |
| `grep`, `rg` | Grep tool |
| `cat`, `head`, `tail` | Read tool |
| `echo >`, heredoc writes | Write tool |

Reserve Bash for: `specflow` CLI, `git`, `pnpm`/`npm`, and other system commands.

## User Input

```text
$ARGUMENTS
```

## Arguments

| Argument | Description |
|----------|-------------|
| (empty) | Execute all tasks with TDD workflow |
| `--no-tdd` | Skip test-first approach (not recommended) |
| `continue` | Resume from last incomplete task |

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Design gate passed | `specflow check --gate design` | Run `/flow.design` |
| tasks.md exists | `specflow status --json` → `context.hasTasks` | Run `/flow.design` |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |
| Git branch | `git branch --show-current` | Should be on phase branch |

## Execution

### 1. Initialize

**Create todo list immediately (use TodoWrite):**

1. [IMPL] INITIALIZE - Verify design gate and load context
2. [IMPL] EXECUTE - Implement all tasks from tasks.md
3. [IMPL] COMPLETE - Verify implementation gate

Set [IMPL] INITIALIZE to in_progress.

**Optimization**: If this command was invoked by `/flow.orchestrate` and you already
have `specflow status --json` output in context (within the last few tool calls),
reuse it instead of calling again.

```bash
specflow context --json --memory-keys constitution,tech-stack,coding-standards,testing-strategy
```

This returns both status and memory doc contents in one call (see `status` and `memory` fields).
If `specflow context` is unavailable, fall back to `specflow status --json`.

Parse response:
- `context.featureDir` → FEATURE_DIR (abort if null)
- `context.hasTasks` → must be true
- `progress.tasksTotal` → verify tasks exist

**Gate verification (standalone only):**
If invoked by `/flow.orchestrate`, the orchestrator already verified `check --gate design` —
skip this call. If running standalone:

```bash
specflow check --gate design
```

Abort if gate fails - instruct user to run `/flow.design` first.

**Update state (respecting orchestrate ownership):**

Use `step.current` from `specflow status --json` output above (do NOT call `state get` for this value):

```bash
# CURRENT_STEP = step.current from specflow status --json output above
# Only set step.current if not already set (standalone mode)
# Orchestrate owns step transitions - sub-commands only update status
if [[ -z "$CURRENT_STEP" || "$CURRENT_STEP" == "null" ]]; then
  specflow state set orchestration.step.current=implement orchestration.step.index=2 orchestration.step.status=in_progress orchestration.implement.started_at=$(date -Iseconds) orchestration.implement.current_section=""
else
  specflow state set orchestration.step.status=in_progress orchestration.implement.started_at=$(date -Iseconds) orchestration.implement.current_section=""
fi
```

### 2. Load Context

From FEATURE_DIR read:
- **spec.md** - requirements and context
- **ui-design.md** (if exists) - component mockups, interactions, design constraints
- **plan.md** - tech stack, architecture, file structure
- **tasks.md** - already parsed by `specflow next`

Use TodoWrite: mark [IMPL] INITIALIZE complete, mark [IMPL] EXECUTE in_progress.

**Populate todo list from section headers (use TodoWrite):**

Create a todo item for each section header in tasks.md (not individual tasks):
- Example sections: "## 1. Project Setup", "## 2. Core Implementation", "## 3. API Endpoints"
- Todo content: "1. Project Setup (T001-T005)" with task range
- Mark the first section as `in_progress`, others as `pending`

This gives users visibility into progress without overwhelming them with 100+ items.

### 3. Project Setup

Verify ignore files exist based on stack from plan.md:
- Git repo → `.gitignore`
- Docker → `.dockerignore`
- Node.js → patterns: `node_modules/`, `dist/`, `.env*`
- Python → patterns: `__pycache__/`, `.venv/`, `*.pyc`

Create with standard patterns if missing. Don't over-engineer.

### 4. Execute Tasks

**Main loop:**
```bash
specflow next --json
```

Parse response:
- `action` → "implement_task" or "none"
- `task.id`, `task.description`, `task.section`
- `hints.filesMentioned` → files to create/modify
- `dependencies.met` → check before executing
- `queue.totalRemaining` → progress indicator

**If `action` = "none":**
- `reason: all_tasks_complete` → exit loop, proceed to completion
- `reason: all_tasks_blocked` → halt, report blocked tasks

**For each task:**

1. **TDD Workflow** (default):
   ```
   RED:     Write/verify tests for this task's functionality
            Run tests → confirm they fail (expected)

   GREEN:   Implement minimum code to pass tests
            Run tests → confirm they pass

   REFACTOR: Clean up while keeping tests green
   ```

2. **Mark complete:**
   ```bash
   specflow mark T###
   ```
   Response includes updated progress and next task.

   **Batch marking**: When completing multiple [P] tasks in parallel:
   ```bash
   specflow mark T001 T002 T003  # One call instead of three
   ```

   Use TodoWrite: when moving to a new section, mark the previous section `completed` and the new section `in_progress`.

**IMPORTANT**: Do NOT call `specflow check --gate verify` or `specflow check --gate implement`
during the task loop. Gate checks always fail on incomplete tasks. Only run them in Section 7
(Completion). Also avoid calling `specflow status --json` between tasks — `specflow next --json`
and `specflow mark T###` responses already include progress.

3. **Continue loop** until `action: none`

### 4.1 Parallel TDD for [P] Tasks

**File conflict detection (REQUIRED before parallelizing):**

```
Before launching parallel agents for [P] tasks:

1. Extract file paths from each task description:
   T001: "Create src/auth/login.ts" → files: [src/auth/login.ts]
   T002: "Create src/auth/logout.ts" → files: [src/auth/logout.ts]
   T003: "Update src/auth/index.ts" → files: [src/auth/index.ts]

2. Check for overlapping files:
   - Build map: file → [task IDs that touch it]
   - If any file has >1 task: CONFLICT DETECTED

3. Handle conflicts:
   - index.ts touched by T001 AND T003? → Run T001, T003 sequentially
   - Shared test setup file? → Run sequentially
   - No overlaps? → Safe to parallelize

4. Common conflict patterns to check:
   - index.ts / index.js (barrel exports)
   - package.json (dependency additions)
   - Shared config files (tsconfig, vite.config)
   - Test setup/fixtures files
   - Database migration files (order matters)
```

**Use parallel sub-agents** for tasks with NO file conflicts:

```
When multiple [P] tasks are queued AND pass conflict check:

Launch parallel workers (Agent Teams preferred; Task agents fallback) for RED phase:

Team-mode role hints:
- `specflow-implementation-worker` for each task-specific RED worker
- Parent orchestrator uses `specflow-coordinator` for dependency-safe batching

Agent T001: Create tests for T001 (RED phase) → return test file paths
Agent T002: Create tests for T002 (RED phase) → return test file paths
Agent T003: Create tests for T003 (RED phase) → return test file paths
```

**Expected speedup**: 50-70% faster test setup for parallel task batches (only when no conflicts)

While current task is in GREEN phase, next [P] task's tests are already written and waiting.

### 4.2 Background Spec Validation

**Optionally spawn background validation agent** during implementation:

```
Background Agent (run_in_background: true):
  - Monitor completed tasks against spec.md requirements
  - Flag deviations from acceptance criteria
  - Report at section checkpoint

Team-mode role hint:
- Use `specflow-quality-auditor` for background validation
```

**Expected benefit**: Early defect detection, continuous compliance checking

### 4.3 Section Wiring Checkpoint

After completing each section's tasks, quick wiring check:

For each file CREATED in this section:
1. Identify its primary export(s)
2. grep: Is this export imported by any file outside tests/?
3. If NOT imported:
   - Is there a [W] wiring task in an upcoming section? → Log "wiring pending" and continue
   - No wiring task exists? → WARNING: "[file] has no caller and no upcoming wiring task"
     - `specflow phase defer "Wire [module] — discovered during implementation"`
   - Do NOT block — continue implementation

### 5. TDD Details

**Test detection:**
- Match task to test file: `T003: Implement UserService` → `tests/services/user.test.ts`
- If no test exists, create one before implementing

**Test commands** (detect from project):
- Node.js: `npm test` / `pnpm test`
- Python: `pytest`
- Go: `go test ./...`
- Rust: `cargo test`

**TDD output format:**
```
Task T003: Implement UserService
├─ RED:    Created tests/services/user.test.ts (5 tests, 5 failing)
├─ GREEN:  Created src/services/user.ts (5 tests, 5 passing)
└─ REFACTOR: No changes needed
Progress: 12/47 (25%)
```

### 6. Error Handling

1. **First failure**: Retry with different approach
2. **Still fails**: Mark task blocked, continue with non-dependent tasks
3. **Critical path blocked**: Halt and report

```bash
# If task is blocked
specflow mark T### --blocked "reason"
```

### 7. Completion

When `specflow next` returns `action: none` with `reason: all_tasks_complete`:

Use TodoWrite: mark [IMPL] EXECUTE complete, mark [IMPL] COMPLETE in_progress.

```bash
specflow check --gate implement
```

**Orphaned export scan (before marking complete)**:

For each file created/modified this phase (from `git diff --name-only main`):
1. Extract exported symbols
2. Search codebase for imports of each symbol (exclude test files)
3. Report orphaned exports as warnings

Persist for verify step:
```bash
specflow state set orchestration.implement.orphanedExports='["file:Symbol", ...]'
```

Do NOT block completion — these are warnings for the verify step.

If gate passes:
```bash
# Only set status=complete - orchestrate owns step transitions
specflow state set orchestration.step.status=complete
```

Use TodoWrite: mark [IMPL] COMPLETE complete. Output: "All tasks complete. Ready for verification."

**State ownership note**: Do NOT set `step.current=verify` here. `/flow.orchestrate` owns step transitions. Setting `status=complete` signals orchestrate to advance to the next step.

## Parallel Tasks

Tasks marked with `[P]` can run concurrently using sub-agents:

**Use parallel workers (Agent Teams preferred; Task agents fallback)** for [P] tasks:

```
For a batch of [P] tasks (T001, T002, T003):

Agent T001: Full TDD cycle for T001 (RED → GREEN → REFACTOR)
Agent T002: Full TDD cycle for T002 (RED → GREEN → REFACTOR)
Agent T003: Full TDD cycle for T003 (RED → GREEN → REFACTOR)

Team-mode role hints:
- Use `specflow-implementation-worker` for each task worker
- Parent orchestrator uses `specflow-coordinator` for completion synchronization
```

**Coordination:**
- Each agent works on different files (no merge conflicts)
- If one fails, others continue
- Report all failures at end of parallel batch
- Mark all successful tasks complete together: `specflow mark T001 T002 T003`

**Expected speedup**: N parallel tasks = ~Nx faster for independent work

## Constraints

- Execute phases in order: Setup → Core → Integration → Polish
- Respect task dependencies (from `specflow next` response)
- Commit periodically: `git commit -m "feat: implement T001-T010"`

## Parallel Agent Coordination

When launching parallel agents for [P] tasks or background validation:

**1. Pre-launch validation (CRITICAL)**:
- Extract file paths from each [P] task description
- Build file→task mapping to detect overlaps
- **If files overlap between tasks**: Cannot parallelize - run sequentially instead
- Common overlap patterns: index.ts, package.json, shared utilities

**2. Execution**:
- Launch agents only for tasks with ZERO file overlap
- Set timeout: 300 seconds per task agent (implementation takes longer)
- Background validation agent runs with `run_in_background: true`

**3. Synchronization**:
- Wait for parallel batch to complete before starting next batch
- Background validation reports at section checkpoints, not continuously

**4. Result aggregation**:
- Collect completion status from each agent
- Merge any discovered issues into deferred items
- Update progress dashboard after batch completes

**5. Error handling**:
- 1 task fails: Mark blocked, continue with others in batch
- File conflict detected mid-execution: Halt conflicting agent, retry sequentially
- Background validation finds critical issue: Pause implementation, report to user
