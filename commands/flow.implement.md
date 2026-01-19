---
description: Execute all tasks defined in tasks.md using test-driven development.
handoffs:
  - label: Verify Completion
    agent: flow.verify
    prompt: Verify the implementation is complete and update ROADMAP.md
    send: true
---

## Critical Rules

1. **NEVER edit tasks.md directly** to mark tasks complete - use `specflow mark T###`
2. **NEVER edit orchestration-state.json directly** - use `specflow state set`
3. **TDD by default**: Write tests first, then implement (use `--no-tdd` to skip)

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

## Execution

### 1. Initialize

**Create todo list immediately (use TodoWrite):**

1. [IMPL] INITIALIZE - Verify design gate and load context
2. [IMPL] EXECUTE - Implement all tasks from tasks.md
3. [IMPL] COMPLETE - Verify implementation gate

Set [IMPL] INITIALIZE to in_progress.

```bash
specflow status --json
```

Parse response:
- `context.featureDir` → FEATURE_DIR (abort if null)
- `context.hasTasks` → must be true
- `progress.tasksTotal` → verify tasks exist

```bash
specflow check --gate design
```

Abort if gate fails - instruct user to run `/flow.design` first.

If `step.current` != "implement", update state:
```bash
specflow state set orchestration.step.current=implement orchestration.step.index=2 orchestration.step.status=in_progress
```

### 2. Load Context

From FEATURE_DIR read:
- **plan.md** - tech stack, architecture, file structure
- **tasks.md** - already parsed by `specflow next`

Use TodoWrite: mark [IMPL] INITIALIZE complete, mark [IMPL] EXECUTE in_progress.

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

2. **Mark complete and get next:**
   ```bash
   specflow mark T###
   ```
   Response includes updated progress and next task.

3. **Continue loop** until `action: none`

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

If gate passes:
```bash
specflow state set orchestration.step.current=verify orchestration.step.index=3 orchestration.step.status=in_progress
```

Use TodoWrite: mark [IMPL] COMPLETE complete. Output: "All tasks complete. Ready for verification."

## Parallel Tasks

Tasks marked with `[P]` can run concurrently:
- Execute parallel tasks together
- If one fails, continue with others
- Report all failures at end of parallel batch

## Constraints

- Execute phases in order: Setup → Core → Integration → Polish
- Respect task dependencies (from `specflow next` response)
- Commit periodically: `git commit -m "feat: implement T001-T010"`
