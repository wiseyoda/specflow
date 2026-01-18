# Discovery: CLI TypeScript Migration

**Phase**: `0080-cli-typescript-migration`
**Created**: 2025-01-18
**Status**: Complete

## Phase Context

**Source**: ROADMAP phase 0080
**Goal**: Migrate 24 bash scripts (~18k lines) to 5 smart TypeScript commands, reducing CLI calls from 50-100 per phase to 10-15.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `scripts/bash/specflow-state.sh` (~500 lines) | State file CRUD operations | Primary migration target - highest usage (68 refs) |
| `scripts/bash/lib/json.sh` (373 lines) | jq wrappers for JSON manipulation | Library code to replace with TypeScript |
| `scripts/bash/specflow-tasks.sh` (~500 lines) | Task parsing and marking | High usage (29 refs), complex regex parsing |
| `scripts/bash/specflow-roadmap.sh` (~500 lines) | ROADMAP.md parsing | High usage (49 refs), markdown table parsing |
| `scripts/bash/specflow-doctor.sh` (~600 lines) | Health checks and validation | Most complex command (9 refs) |
| `packages/cli/` | Started TypeScript CLI package | Scaffolding complete, `state` command working |
| `packages/shared/` | Shared Zod schemas | Already exists, ESM builds fixed |

### Existing Patterns & Conventions

- **Commander.js**: Standard CLI framework (already in use by other Node projects)
- **Zod schemas**: Type validation pattern from `packages/shared`
- **tsup build**: ESM output with `.js` extensions for Node compatibility
- **Vitest**: Test framework matching dashboard package
- **Dot-notation paths**: State access via `orchestration.step.current` pattern

### Integration Points

- **bin/specflow**: Bash dispatcher - needs hybrid routing logic
- **packages/shared**: Shared types consumed by CLI and dashboard
- **Slash commands**: 9 active commands reference `specflow` CLI
- **State file**: `.specify/orchestration-state.json` read/write

### Constraints Discovered

- **POSIX compatibility**: Bash scripts used `[[` syntax - TypeScript removes this concern
- **ESM modules**: Node requires `.js` extensions in imports (fixed in shared)
- **State schema v2.0**: Must maintain backward compatibility during migration
- **Slash command syntax**: CLI calls embedded in markdown, must match exactly

---

## Requirements Sources

### From ROADMAP/Phase File

- Reduce CLI complexity from 24 commands to ~5 smart commands
- Improve type safety with TypeScript + Zod
- Add test coverage (currently 0%)
- Reduce total lines from ~18k to ~4-6k

### From Usage Analysis

| Usage Level | Commands | Reference Count |
|-------------|----------|-----------------|
| Core | state | 68 refs |
| Core | roadmap | 49 refs |
| Core | tasks | 29 refs |
| High | checklist | 15 refs |
| High | pdr | 13 refs |
| High | phase | 11 refs |
| Medium | doctor | 9 refs |
| Medium | issue | 7 refs |
| Low | Various | <5 refs each |

### From Memory Documents

- **Constitution**: Developer Experience First, CLI Over Direct Edits, Simplicity Over Cleverness, Helpful Error Messages, Graceful Degradation, Three-Line Output Rule, TypeScript for CLI Packages (v1.2.0)
- **Tech Stack**: TypeScript, pnpm, Vitest, Prettier, ESM modules

---

## Scope Clarification

### Questions Asked

#### Question 1: Command Consolidation Strategy

**Context**: Found 24 bash scripts but many have overlapping functionality. For example, `status` and `doctor` both check project health.

**Question**: Should we consolidate to fewer smart commands or keep 1:1 mapping?

**Options Presented**:
- A (Recommended): Consolidate to 5 smart commands with rich outputs
- B: Migrate 1:1 to TypeScript equivalents

**User Answer**: Option A - Smart commands architecture

**Research Done**: Designed `status`, `next`, `mark`, `check`, `state` commands documented in `cli-design.md`

---

#### Question 2: State Schema Changes

**Context**: Current state file has redundant fields like `progress.percentage` that can be computed from tasks.md.

**Question**: Should we simplify the schema during migration?

**Options Presented**:
- A (Recommended): Remove redundant fields, compute on demand
- B: Keep schema identical for backward compatibility

**User Answer**: Option A - Simplify to ~12 fields from 25+

---

#### Question 3: Hybrid Transition Period

**Context**: Can't migrate all commands at once. Need gradual cutover.

**Question**: How should the transition work?

**Options Presented**:
- A (Recommended): Bash dispatcher routes to TypeScript or bash based on readiness
- B: Feature flag to switch between all-bash or all-TypeScript

**User Answer**: Option A - Hybrid dispatcher

---

### Confirmed Understanding

**What the user wants to achieve**:
Transform the CLI from many granular bash scripts to few smart TypeScript commands that return everything Claude needs in single calls.

**How it relates to existing code**:
- Replaces `scripts/bash/specflow-*.sh` files
- Integrates with existing `packages/shared/` schemas
- Updates `bin/specflow` dispatcher to route to TypeScript

**Key constraints and requirements**:
- Must maintain slash command compatibility
- State file format must be readable by both during transition
- Build/test tooling consistent with dashboard package

**Technical approach (if discussed)**:
5 smart commands: `status`, `next`, `mark`, `check`, `state`

**User confirmed**: Yes - 2025-01-18

---

## Recommendations for SPECIFY

### Should Include in Spec

- All 5 smart commands with JSON output schemas
- Hybrid dispatcher implementation
- State schema simplification
- Behavior parity tests

### Should Exclude from Spec (Non-Goals)

- Migrating bash wrappers (git, scaffold, dashboard)
- npm global install support
- GUI/TUI interface
- Backward compatibility with v1.x state files

### Potential Risks

- Slash command syntax changes could break existing workflows
- Complex regex parsing in task/roadmap parsers
- Edge cases in markdown table parsing

### Questions to Address in CLARIFY

- All major questions resolved in discovery phase
