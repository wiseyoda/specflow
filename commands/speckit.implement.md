---
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
handoffs:
  - label: Verify Completion
    agent: speckit.verify
    prompt: Verify the implementation is complete and update ROADMAP.md
    send: true
---

## CRITICAL RULES

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

1. **NEVER edit `tasks.md` directly to mark tasks complete** - Use `speckit tasks mark T###`
2. **NEVER edit `.specify/orchestration-state.json` directly** - Use `speckit state set`
3. **ALWAYS use `speckit tasks mark`** after completing each task
4. **ALWAYS use `speckit tasks status`** to check progress

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Arguments

| Argument | Description |
|----------|-------------|
| (empty) | Execute all tasks in standard order |
| `--tdd` | Enforce test-driven development: write tests first, run after each task |
| `continue` | Resume from last incomplete task |
| `phase <N>` | Start at a specific phase |

## TDD Mode (`--tdd`)

When `--tdd` flag is provided, enforce strict test-driven development:

### TDD Workflow

1. **Test First**: For each implementation task, write or verify tests exist BEFORE writing implementation code
2. **Red Phase**: Run tests to confirm they fail (expected - no implementation yet)
3. **Green Phase**: Implement the minimum code to make tests pass
4. **Refactor Phase**: Clean up code while keeping tests green
5. **Validate**: Run full test suite after each task completion

### TDD Execution Rules

```text
For each task in tasks.md:
  1. IF task has corresponding test task:
     a. Execute test task FIRST (write/verify tests)
     b. Run tests - confirm they fail appropriately
     c. Execute implementation task
     d. Run tests - confirm they pass
     e. Mark both tasks complete
  2. ELSE (no corresponding test task):
     a. Generate tests for the functionality being implemented
     b. Run tests - confirm they fail
     c. Execute implementation task
     d. Run tests - confirm they pass
     e. Mark task complete

  3. AFTER each task completion:
     - Run: npm test / pytest / go test / cargo test (detect from project)
     - IF tests fail: STOP and report failure
     - IF tests pass: Continue to next task
```

### Test Detection

Match implementation tasks to test tasks:
- `T003: Implement UserService` → Look for `T0XX: Test UserService`
- `T005: Add validation logic` → Look for `T0XX: Add validation tests`
- If no matching test task exists, create tests inline before implementing

### TDD Output Format

```text
╔════════════════════════════════════════════════════════════════╗
║ TDD Mode: Task T003 - Implement UserService                     ║
╠════════════════════════════════════════════════════════════════╣
║ 🔴 RED:    Writing tests for UserService...                     ║
║           Created: tests/services/user.test.ts                  ║
║           Running tests: 5 tests, 5 failures (expected)         ║
╠════════════════════════════════════════════════════════════════╣
║ 🟢 GREEN: Implementing UserService...                           ║
║           Created: src/services/user.ts                         ║
║           Running tests: 5 tests, 5 passing                     ║
╠════════════════════════════════════════════════════════════════╣
║ 🔄 REFACTOR: Cleaning up implementation...                      ║
║           No changes needed                                     ║
║           Running tests: 5 tests, 5 passing ✓                   ║
╚════════════════════════════════════════════════════════════════╝
```

## Outline

1. Run `speckit context --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Update State**: Mark step as in-progress:
   ```bash
   speckit state set "orchestration.step.current=implement" "orchestration.step.status=in_progress"
   ```

3. **Check checklists status** (if FEATURE_DIR/checklists/ exists):

   Use the SpecKit CLI for checklist verification:

   ```bash
   # Get overall checklist status
   speckit checklist status

   # List all checklists with detailed status
   speckit checklist list

   # Get JSON output for parsing
   speckit checklist status --json
   ```

   The CLI produces a status summary showing:
   - Each checklist file with completed/total counts
   - Completion percentage and pass/fail status

   - **If any checklist is incomplete**:
     ```bash
     # See which items are incomplete
     speckit checklist incomplete
     ```
     - Display the status table with incomplete item counts
     - **STOP** and ask: "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)"
     - Wait for user response before continuing
     - If user says "no" or "wait" or "stop", halt execution
     - If user says "yes" or "proceed" or "continue", proceed to step 3

   - **If all checklists are complete**:
     - Display the table showing all checklists passed
     - Automatically proceed to step 3

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md for entities and relationships
   - **IF EXISTS**: Read contracts/ for API specifications and test requirements
   - **IF EXISTS**: Read research.md for technical decisions and constraints
   - **IF EXISTS**: Read quickstart.md for integration scenarios

4. **Project Setup Verification**:
   - **REQUIRED**: Create/verify ignore files based on actual project setup:

   **Detection & Creation Logic**:
   - Check if the following command succeeds to determine if the repository is a git repo (create/verify .gitignore if so):

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Check if Dockerfile\* exists or Docker in plan.md → create/verify .dockerignore
   - Check if .eslintrc\* exists → create/verify .eslintignore
   - Check if eslint.config.\* exists → ensure the config's `ignores` entries cover required patterns
   - Check if .prettierrc\* exists → create/verify .prettierignore
   - Check if .npmrc or package.json exists → create/verify .npmignore (if publishing)
   - Check if terraform files (\*.tf) exist → create/verify .terraformignore
   - Check if .helmignore needed (helm charts present) → create/verify .helmignore

   **If ignore file already exists**: Verify it contains essential patterns, append missing critical patterns only
   **If ignore file missing**: Create with full pattern set for detected technology

   **Common Patterns by Technology** (from plan.md tech stack):
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **C#/.NET**: `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
   - **Go**: `*.exe`, `*.test`, `vendor/`, `*.out`
   - **Ruby**: `.bundle/`, `log/`, `tmp/`, `*.gem`, `vendor/bundle/`
   - **PHP**: `vendor/`, `*.log`, `*.cache`, `*.env`
   - **Rust**: `target/`, `debug/`, `release/`, `*.rs.bk`, `*.rlib`, `*.prof*`, `.idea/`, `*.log`, `.env*`
   - **Kotlin**: `build/`, `out/`, `.gradle/`, `.idea/`, `*.class`, `*.jar`, `*.iml`, `*.log`, `.env*`
   - **C++**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.so`, `*.a`, `*.exe`, `*.dll`, `.idea/`, `*.log`, `.env*`
   - **C**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.a`, `*.so`, `*.exe`, `Makefile`, `config.log`, `.idea/`, `*.log`, `.env*`
   - **Swift**: `.build/`, `DerivedData/`, `*.swiftpm/`, `Packages/`
   - **R**: `.Rproj.user/`, `.Rhistory`, `.RData`, `.Ruserdata`, `*.Rproj`, `packrat/`, `renv/`
   - **Universal**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

   **Tool-Specific Patterns**:
   - **Docker**: `node_modules/`, `.git/`, `Dockerfile*`, `.dockerignore`, `*.log*`, `.env*`, `coverage/`
   - **ESLint**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.min.js`
   - **Prettier**: `node_modules/`, `dist/`, `build/`, `coverage/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - **Terraform**: `.terraform/`, `*.tfstate*`, `*.tfvars`, `.terraform.lock.hcl`
   - **Kubernetes/k8s**: `*.secret.yaml`, `secrets/`, `.kube/`, `kubeconfig*`, `*.key`, `*.crt`

5. Parse tasks.md structure and extract:
   - **Task phases**: Setup, Tests, Core, Integration, Polish
   - **Task dependencies**: Sequential vs parallel execution rules
   - **Task details**: ID, description, file paths, parallel markers [P]
   - **Execution flow**: Order and dependency requirements

6. Execute implementation following the task plan:
   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Track in-progress tasks**: Before starting work on a batch/section of tasks, mark them as in-progress:
     ```bash
     # Mark tasks as in-progress (for dashboard visibility)
     speckit tasks start T001 T002 T003 --section "Phase 1: Setup"

     # Check what's currently being worked on
     speckit tasks working
     ```
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] can run together
   - **TDD Mode** (if `--tdd` flag provided): Follow the TDD Workflow section above
     - Write/verify tests BEFORE each implementation task
     - Run tests after each task (fail fast if tests fail)
     - Use Red-Green-Refactor cycle
   - **Standard Mode** (no `--tdd` flag): Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding

7. Implementation execution rules:
   - **Setup first**: Initialize project structure, dependencies, configuration
   - **Tests before code**: If you need to write tests for contracts, entities, and integration scenarios
   - **Core development**: Implement models, services, CLI commands, endpoints
   - **Integration work**: Database connections, middleware, logging, external services
   - **Polish and validation**: Unit tests, performance optimization, documentation

8. Progress tracking and error handling:
   - Report progress after each completed task
   - Halt execution if any non-parallel task fails
   - For parallel tasks [P], continue with successful tasks, report failed ones
   - Provide clear error messages with context for debugging
   - Suggest next steps if implementation cannot proceed
   - **IMPORTANT** Use the SpecKit CLI to mark completed tasks:

     ```bash
     # Mark individual task as complete (also updates state file + dashboard)
     speckit tasks mark T001
     speckit tasks mark T002

     # Check overall progress
     speckit tasks status

     # See remaining incomplete tasks
     speckit tasks incomplete

     # Manually regenerate the Progress Dashboard (auto-runs on mark)
     speckit tasks sync
     ```

     The `speckit tasks mark` command automatically:
     - Updates tasks.md (marks `[X]`)
     - Updates the orchestration state file with task counts
     - Regenerates the Progress Dashboard at top of tasks.md

9. **Update State**: Mark step as complete (or failed on error):
   ```bash
   # On success (all tasks completed):
   speckit state set "orchestration.step.status=complete"
   speckit state set "orchestration.phase.status=ready_to_merge"

   # On error (implementation failed, tests failing, blocked):
   speckit state set "orchestration.step.status=failed"
   ```

   **Error Handling**: If implementation fails (tests consistently failing, blocking errors), mark step as `failed`. The dashboard will show this state, and `/speckit.orchestrate` can attempt recovery.

10. Completion validation:

   Use the SpecKit CLI to verify completion:

   ```bash
   # Verify all tasks are complete
   speckit tasks status

   # Check if any tasks remain incomplete
   speckit tasks incomplete
   ```

   - Verify all required tasks are completed (100% completion)
   - Check that implemented features match the original specification
   - Validate that tests pass and coverage meets requirements
   - Confirm the implementation follows the technical plan
   - Report final status with summary of completed work

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for implementation tracking:

```bash
# Verify CLI is available
speckit --help
```

Key CLI commands used:
- `speckit checklist` - Pre-implementation checklist verification (status, list, incomplete)
- `speckit tasks` - Task tracking during implementation (status, mark, incomplete, phase-status)
- `speckit state` - State file updates (automatic via tasks mark)

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/speckit.design --tasks` first to regenerate the task list.
