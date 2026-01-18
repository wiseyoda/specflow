---
phase: 1047
name: workflow-decomposition-design
status: not_started
created: 2026-01-17
pdr: pdr-orchestration-engine.md
---

### 1047 - Workflow Decomposition: Design Phase

**Goal**: Break the orchestrate workflow into smaller, composable commands for the design steps (discover through checklist).

**Scope**:
- Create standalone `discover` command (~1 context window)
- Create `design` command combining specify, clarify, plan, tasks (~1 context window)
- Create `check` command combining analyze, checklist (~1 context window)
- Each command reads previous artifacts and produces new ones
- All commands support `--json` output
- Commands work both standalone and as part of workflow

**User Stories**:
1. As a dashboard, I run `discover --json` and get findings + questions
2. As a dashboard, I run `design --json` after discover completes
3. As a developer, I can run just `check` to validate existing artifacts
4. As a dashboard, I can track which design step is complete

**Deliverables**:
- `specflow discover` command with JSON output
  - Examines codebase, outputs discovery.md
  - Returns questions for user if any
- `specflow design` command with JSON output
  - Creates spec.md, requirements.md, plan.md, tasks.md
  - Accepts answers to discovery questions as input
- `specflow check` command with JSON output
  - Runs analyze and checklist
  - Validates cross-artifact consistency
- Updated orchestrate to use these commands internally
- Skill files updated to match new command structure

**Verification Gate**: Technical
- `discover`, `design`, `check` commands work standalone
- JSON output includes all artifacts created
- Orchestrate workflow still works end-to-end
- Context stays under 200k per command

**Estimated Complexity**: High
