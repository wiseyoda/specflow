---
phase: 1048
name: workflow-decomposition-execution
status: not_started
created: 2026-01-17
pdr: pdr-orchestration-engine.md
---

### 1048 - Workflow Decomposition: Execution Phase

**Goal**: Refactor implement, verify, and merge commands to work in bounded context windows with comprehensive JSON output.

**Scope**:
- Refactor `implement` to work with task groups (not all tasks at once)
- Enhance tasks.md format to define logical task groups
- Create `implement --group N` to run specific task group
- Ensure `verify` works standalone with JSON output
- Ensure `merge` works standalone with JSON output
- Each implement batch stays under 200k context

**User Stories**:
1. As a dashboard, I run `implement --group 1 --json` for first batch of tasks
2. As a dashboard, I see which tasks completed in the JSON response
3. As a dashboard, I retry failed task groups with error context
4. As a developer, task groups are logical (related files together)

**Deliverables**:
- Enhanced tasks.md format with explicit task groups:
  ```markdown
  ## Group 1: Core Components
  - [ ] T001: Create base component
  - [ ] T002: Add styling

  ## Group 2: Integration
  - [ ] T003: Wire up API
  ```
- `specflow implement --group N` command
- `specflow implement --list-groups` to show available groups
- Updated plan.md template to suggest task grouping
- Standalone `verify --json` command
- Standalone `merge --json` command
- JSON output includes: tasks_completed, tasks_failed, files_modified, errors

**Verification Gate**: Technical
- Implement works with `--group` flag
- Task groups stay under 200k context each
- Verify and merge work standalone
- Full orchestrate workflow still works

**Estimated Complexity**: High
