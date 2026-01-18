# Discovery: Command JSON Output

**Phase**: `1046-command-json-output`
**Created**: 2026-01-18
**Status**: Complete

## Phase Context

**Source**: ROADMAP phase (from PDR orchestration-engine)
**Goal**: Add --json output support to remaining CLI commands and document the JSON schema for dashboard integration.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/cli/src/lib/output.ts` | Centralized output utility with `setOutputOptions()`, `output()`, and helper functions | Core pattern to follow - handles JSON vs text output globally |
| `packages/cli/src/commands/status.ts:330` | StatusCommand with `--json` flag and `StatusOutput` interface | Reference implementation for JSON output pattern |
| `packages/cli/src/commands/next.ts:315` | NextCommand with discriminated union output types | Pattern for commands with multiple output shapes |
| `packages/cli/src/commands/state/get.ts:17` | State get with `--json` flag | Sibling command already implementing pattern |
| `packages/cli/src/commands/state/set.ts` | State set - **missing** --json support | Target for implementation |
| `packages/cli/src/commands/state/init.ts` | State init - **missing** --json support | Target for implementation |
| `packages/cli/src/commands/state/sync.ts` | State sync - **missing** --json support | Target for implementation |

### Existing Patterns & Conventions

- **Output Interface Pattern**: Each command defines a `{CommandName}Output` interface with typed fields
- **output() Function**: `output(data, humanReadable?)` dispatches JSON when `--json` flag is set
- **Discriminated Unions**: Commands with multiple output types use `action` field as discriminator
- **Human-Readable Formatter**: Separate `formatHumanReadable(result)` function for text output
- **Global Options**: `setOutputOptions()` called in main entry to set `--json` and `--quiet` globally

### Integration Points

- **lib/output.ts**: All commands use this for output - no changes needed here
- **Command Registration**: Commands in `packages/cli/src/index.ts` inherit global `--json` option
- **Dashboard Integration**: Dashboard will call CLI commands with `--json` and parse structured results

### Constraints Discovered

- **Constitution VII (Three-Line Rule)**: JSON mode can bypass this since JSON is for machine parsing
- **Backward Compatibility**: Text output must remain default and unchanged
- **Existing --quiet Flag**: `state set` already has `--quiet`, must coexist with `--json`

---

## Requirements Sources

### From ROADMAP/Phase File

- Define comprehensive JSON output schema for command results
- Add `--json` flag to all existing CLI commands
- Standardize output structure: status, changes, artifacts, errors, next_step
- Ensure backward compatibility (text output remains default)
- Document JSON schema in memory docs

### From Related Issues

N/A - No open issues linked to this phase.

### From Previous Phase Handoffs

N/A - No deferred items from previous phases.

### From Memory Documents

- **Constitution VII**: Three-Line Output Rule - JSON output provides full data, human output still follows this
- **Constitution III**: CLI Over Direct Edits - JSON output enables dashboard to use CLI programmatically
- **Constitution IIa**: TypeScript for CLI Packages - Strict mode, typed interfaces
- **Tech Stack**: Commander.js for CLI, Zod for validation

---

## Scope Clarification

### Questions Asked

#### Question 1: Scope Confirmation

**Context**: Codebase analysis showed most commands already have --json support. Only 3 state commands are missing it.

**Question**: The phase description mentions adding --json to doctor, init, scaffold, roadmap, and tasks commands, but these don't exist in the TypeScript CLI. Should we proceed with just the 3 state commands, or is there additional scope?

**Options Presented**:
- A (Recommended): Just the 3 state commands - these are the actual missing commands
- B: Also document JSON schema - add --json to commands AND create schema documentation

**User Answer**: B - Also document JSON schema

**Research Done**: Confirmed output utility patterns and interface conventions to follow for schema documentation.

---

### Confirmed Understanding

**What the user wants to achieve**:
Complete JSON output coverage for all CLI commands, plus documented JSON schema for dashboard integration.

**How it relates to existing code**:
Following established patterns in `lib/output.ts` and existing commands like `status.ts`, `next.ts`.

**Key constraints and requirements**:
- Add `--json` flag to `state set`, `state init`, `state sync`
- Create JSON schema documentation in `.specify/memory/`
- Maintain backward compatibility with text output
- Follow existing `{CommandName}Output` interface pattern

**Technical approach (if discussed)**:
Use existing output utility pattern. Create typed output interfaces. Document all command schemas in a single memory document.

**User confirmed**: Yes - 2026-01-18

---

## Recommendations for SPECIFY

### Should Include in Spec

- `state set` JSON output with key, value, result fields
- `state init` JSON output with project info and state path
- `state sync` JSON output with changes made, warnings, dry-run support
- JSON schema documentation covering ALL commands (existing + new)

### Should Exclude from Spec (Non-Goals)

- Modifying existing command outputs (they work fine)
- JSON streaming for long-running operations
- Schema validation at runtime (Zod already handles this)

### Potential Risks

- None identified - straightforward implementation following established patterns

### Questions to Address in CLARIFY

- None remaining - scope is clear
