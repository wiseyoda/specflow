# Feature Specification: Command JSON Output

**Feature Branch**: `1046-command-json-output`
**Created**: 2026-01-18
**Status**: Draft

---

## User Scenarios & Testing

### User Story 1 - Dashboard Calls CLI Commands (Priority: P1)

As a dashboard, I call CLI commands with `--json` and parse structured results to display project state and execute workflows.

**Why this priority**: Dashboard integration is the primary driver for this phase. Without JSON output, the dashboard cannot reliably parse CLI results.

**Independent Test**: Can be fully tested by running `specflow state set key=value --json` and verifying output is valid JSON with expected fields.

**Acceptance Scenarios**:

1. **Given** a dashboard calling `specflow state set orchestration.step.current=implement --json`, **When** the command succeeds, **Then** the dashboard receives JSON with `status: "success"`, the `key`, `value`, and `previousValue` fields
2. **Given** a dashboard calling `specflow state init --json`, **When** the command succeeds, **Then** the dashboard receives JSON with project info, state file path, and registry status
3. **Given** a dashboard calling `specflow state sync --json`, **When** changes are made, **Then** the dashboard receives JSON listing all changes with affected paths

---

### User Story 2 - Scripting with jq (Priority: P2)

As a developer, I pipe CLI output to jq for scripting and automation.

**Why this priority**: Enables power users to build custom workflows on top of SpecFlow CLI.

**Independent Test**: Can be fully tested by running `specflow state set foo=bar --json | jq '.status'` and verifying output is parseable.

**Acceptance Scenarios**:

1. **Given** a developer running `specflow state sync --json | jq '.changes'`, **When** sync has changes, **Then** jq successfully parses and extracts the changes array
2. **Given** a developer running `specflow state init --json | jq '.project.name'`, **When** project is initialized, **Then** jq extracts the project name

---

### User Story 3 - Consistent Error Handling (Priority: P2)

As a dashboard, I receive consistent error format across all commands for unified error handling.

**Why this priority**: Consistent error format enables dashboard to display errors uniformly.

**Independent Test**: Can be fully tested by triggering an error (e.g., `specflow state set invalid --json`) and verifying error JSON structure.

**Acceptance Scenarios**:

1. **Given** a dashboard calling `specflow state set invalid-format --json`, **When** the command fails, **Then** the output includes `status: "error"`, `error.message`, and `error.hint`
2. **Given** a dashboard calling `specflow state sync --json` on missing state, **When** state file doesn't exist, **Then** error JSON follows same structure as other commands

---

### User Story 4 - JSON Schema Documentation (Priority: P3)

As a developer, I reference documented JSON schema to understand command output structure.

**Why this priority**: Documentation enables third-party tooling and reduces trial-and-error.

**Independent Test**: Can be verified by checking schema document exists and covers all commands.

**Acceptance Scenarios**:

1. **Given** a developer reading `.specify/memory/cli-json-schema.md`, **When** they look up any command, **Then** they find the output interface with field descriptions
2. **Given** a developer building a dashboard, **When** they reference the schema, **Then** they can implement type-safe parsing for all commands

---

### Edge Cases

- What happens when `--json` and `--quiet` are both specified? → JSON takes precedence (output JSON, ignore quiet)
- What happens when `state set` value is invalid JSON? → Return error JSON with validation message
- What happens during `state sync --dry-run --json`? → Return JSON showing planned changes without applying

## Requirements

### Functional Requirements

- **FR-001**: `state set` command MUST support `--json` flag outputting structured result
- **FR-002**: `state init` command MUST support `--json` flag outputting project initialization details
- **FR-003**: `state sync` command MUST support `--json` flag outputting sync changes and warnings
- **FR-004**: JSON output MUST follow existing pattern with typed interfaces (e.g., `StateSetOutput`)
- **FR-005**: JSON output MUST include `status` field with values "success", "error", or "warning"
- **FR-006**: Error JSON MUST include `error.message` and `error.hint` for actionable guidance
- **FR-007**: All commands MUST maintain backward compatibility (text output remains default)
- **FR-008**: JSON schema MUST be documented in `.specify/memory/cli-json-schema.md`
- **FR-009**: Schema documentation MUST cover ALL CLI commands (existing + new)

### Output Interfaces

**StateSetOutput**:
```typescript
interface StateSetOutput {
  status: "success" | "error";
  command: "state set";
  key: string;
  value: unknown;
  previousValue?: unknown;
  error?: { message: string; hint: string };
}
```

**StateInitOutput**:
```typescript
interface StateInitOutput {
  status: "success" | "error";
  command: "state init";
  project: {
    id: string;
    name: string;
    path: string;
  };
  statePath: string;
  registered: boolean;
  overwritten: boolean;
  error?: { message: string; hint: string };
}
```

**StateSyncOutput**:
```typescript
interface StateSyncOutput {
  status: "success" | "warning" | "error";
  command: "state sync";
  dryRun: boolean;
  changes: Array<{
    type: "registered" | "history_added" | "phase_synced";
    description: string;
    details?: unknown;
  }>;
  warnings: string[];
  error?: { message: string; hint: string };
}
```

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 3 state commands support `--json` flag and output valid JSON
- **SC-002**: JSON output for each command matches its defined interface
- **SC-003**: Error cases return structured error JSON (not text)
- **SC-004**: Schema documentation covers all 14 existing + 3 new commands
- **SC-005**: Existing text output behavior unchanged when `--json` not specified
- **SC-006**: Tests verify JSON parsing for all new outputs
