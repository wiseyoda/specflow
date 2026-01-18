# Feature Specification: SpecFlow Rebrand

**Feature Branch**: `0076-command-rebrand`
**Created**: 2026-01-17
**Status**: Draft
**Input**: Complete rebrand from SpecKit to SpecFlow

## User Scenarios & Testing

### User Story 1 - New Installation (Priority: P1)

A new user installs SpecFlow for the first time. They run `specflow` CLI and see `/flow.*` commands. The branding is consistent throughout.

**Why this priority**: First impression matters. New users should see cohesive branding from day one.

**Independent Test**: Fresh install on a clean system, verify all commands work with new naming.

**Acceptance Scenarios**:

1. **Given** a fresh system, **When** user runs `./install.sh`, **Then** `specflow` CLI is available in PATH
2. **Given** SpecFlow installed, **When** user runs `specflow help`, **Then** output shows SpecFlow branding and `/flow.*` commands
3. **Given** SpecFlow installed, **When** user runs `specflow doctor`, **Then** all diagnostics pass with new paths

---

### User Story 2 - Using Slash Commands (Priority: P1)

A user in Claude Code types `/flow.` to see available commands. All 10 active commands appear with consistent naming.

**Why this priority**: Core workflow - users interact with slash commands daily.

**Independent Test**: Open Claude Code, type `/flow.`, verify all commands appear and function.

**Acceptance Scenarios**:

1. **Given** SpecFlow installed, **When** user types `/flow.init`, **Then** the init workflow starts
2. **Given** SpecFlow installed, **When** user types `/flow.orchestrate`, **Then** the orchestration workflow starts
3. **Given** SpecFlow installed, **When** user types an old command like `/speckit.init`, **Then** command not found (clean break)

---

### User Story 3 - Documentation Reader (Priority: P2)

A developer reads the README, docs, or memory files. All references show SpecFlow branding consistently.

**Why this priority**: Documentation accuracy builds trust and reduces confusion.

**Independent Test**: Grep for "speckit" in all active documentation - should return 0 results.

**Acceptance Scenarios**:

1. **Given** the repository, **When** searching for "speckit" in active code/docs, **Then** 0 results found
2. **Given** README.md, **When** reading installation instructions, **Then** all examples use `specflow` CLI
3. **Given** CLAUDE.md, **When** reading command references, **Then** all commands listed as `/flow.*`

---

### User Story 4 - Repository Discovery (Priority: P3)

A developer finds the project on GitHub. The repository is named `specflow` and description reflects the new branding.

**Why this priority**: Discoverability matters but happens after core functionality works.

**Independent Test**: Navigate to GitHub, verify repository URL and description.

**Acceptance Scenarios**:

1. **Given** GitHub, **When** navigating to repository, **Then** URL is `wiseyoda/specflow`
2. **Given** the repository page, **When** reading description, **Then** it reflects SpecFlow branding

---

### Edge Cases

- What happens if user has old `speckit` in PATH? New `specflow` works independently.
- What happens if old `~/.speckit/` directory exists? New `~/.specflow/` is created fresh.
- What happens if old `speckit.*` commands are referenced? Command not found - intentional clean break.

## Requirements

### Functional Requirements

**Binary & CLI**
- **FR-001**: CLI binary MUST be named `specflow`
- **FR-002**: CLI MUST respond to `specflow help`, `specflow doctor`, all existing subcommands
- **FR-003**: All internal script references MUST use `specflow` binary name

**Slash Commands**
- **FR-004**: All 11 active commands MUST be renamed from `/speckit.*` to `/flow.*` (10 main + 1 utility)
- **FR-005**: Command files MUST be named `flow.*.md` (not `specflow.*.md`)
- **FR-006**: All internal command references MUST use `/flow.*` syntax

**File System Paths**
- **FR-007**: Install directory MUST be `~/.claude/specflow-system/`
- **FR-008**: User configuration directory MUST be `~/.specflow/`
- **FR-009**: Project directory MUST remain `.specify/` (no change)

**Environment Variables**
- **FR-010**: All `SPECKIT_*` environment variables MUST be renamed to `SPECFLOW_*`

**Scripts**
- **FR-011**: All bash scripts MUST be renamed from `speckit-*.sh` to `specflow-*.sh`
- **FR-012**: All script internal references MUST use new naming

**Documentation**
- **FR-013**: README.md MUST use SpecFlow branding throughout
- **FR-014**: CLAUDE.md MUST reference `/flow.*` commands
- **FR-015**: All docs/*.md files MUST use SpecFlow branding
- **FR-016**: All memory documents MUST use SpecFlow branding

**Clean Break**
- **FR-017**: All deprecated command files (`speckit.start.md`, etc.) MUST be deleted
- **FR-018**: No deprecation stubs or backwards compatibility shims
- **FR-019**: Repository MUST be renamed to `specflow`

### Key Entities

- **Command**: A slash command file (e.g., `flow.init.md`) that Claude Code loads
- **Script**: A bash script (e.g., `specflow-state.sh`) that implements CLI functionality
- **Binary**: The main CLI entry point (`bin/specflow`)

## Success Criteria

### Measurable Outcomes

- **SC-001**: `grep -r "speckit" --include="*.sh" --include="*.md" .` returns 0 results in active code (excluding history/archive)
- **SC-002**: `specflow help` displays help text with SpecFlow branding
- **SC-003**: All 11 `/flow.*` commands load successfully in Claude Code (10 main + 1 utility)
- **SC-004**: `./install.sh` installs to new paths without errors
- **SC-005**: Repository URL is `github.com/wiseyoda/specflow`

## Non-Goals

- **NG-001**: Migration tools for existing installations (users will reinstall)
- **NG-002**: Backwards compatibility with old command names
- **NG-003**: Renaming `.specify/` project directory
- **NG-004**: Dual binary support (both `speckit` and `specflow`)

## Constraints

- **C-001**: Must complete before any new documentation is published
- **C-002**: GitHub repository rename happens last (most disruptive)
- **C-003**: No deprecation period - clean break only
