---
phase: 1046
name: command-json-output
status: not_started
created: 2026-01-17
pdr: pdr-orchestration-engine.md
---

### 1046 - Command JSON Output

**Goal**: Standardize JSON output across all SpecFlow CLI commands to enable programmatic control from the dashboard.

**Scope**:
- Define comprehensive JSON output schema for command results
- Add `--json` flag to all existing CLI commands
- Standardize output structure: status, changes, artifacts, errors, next_step
- Ensure backward compatibility (text output remains default)
- Document JSON schema in memory docs

**User Stories**:
1. As a dashboard, I call `specflow doctor --json` and parse structured results
2. As a dashboard, I get consistent error format across all commands
3. As a developer, I can pipe command output to jq for scripting
4. As a dashboard, I know what files changed and what to do next

**Deliverables**:
- JSON output schema definition in `.specify/memory/`
- `--json` flag added to: doctor, init, scaffold, state, phase, roadmap, tasks
- Consistent output structure:
  ```json
  {
    "status": "success|error|warning",
    "command": "doctor",
    "changes_made": [...],
    "artifacts_created": [...],
    "errors": [...],
    "warnings": [...],
    "next_step": "suggested next command",
    "summary": "human-readable summary"
  }
  ```
- Tests for JSON output parsing

**Verification Gate**: Technical
- All commands support `--json` flag
- JSON output is valid and parseable
- Schema is documented
- Existing text output unchanged

**Estimated Complexity**: Medium
