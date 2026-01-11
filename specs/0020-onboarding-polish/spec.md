# Feature Specification: Onboarding Polish

**Feature Branch**: `0020-onboarding-polish`
**Created**: 2026-01-10
**Status**: Draft
**Input**: Phase 0020 from ROADMAP.md - Make the first-run experience smooth and project-agnostic

## Overview

Make the first-run experience smooth and project-agnostic by adding multi-language template support, a --safe scaffold mode, onboarding documentation, and optimized CLI output.

## User Scenarios & Testing

### User Story 1 - Project Type Detection (Priority: P1)

As a developer setting up SpecKit in a Python/Rust/Go project, I want the scaffold command to detect my project type and customize templates accordingly, so I don't have to manually edit TypeScript-specific templates.

**Why this priority**: Without project detection, every non-TypeScript user must manually edit templates, creating a poor first impression.

**Independent Test**: Run `speckit scaffold` in a Python project with requirements.txt or pyproject.toml and verify constitution.md and tech-stack.md contain Python-appropriate content.

**Acceptance Scenarios**:

1. **Given** a project with `pyproject.toml` or `requirements.txt`, **When** `speckit scaffold` runs, **Then** templates reference Python, pytest, ruff
2. **Given** a project with `Cargo.toml`, **When** `speckit scaffold` runs, **Then** templates reference Rust, cargo test, rustfmt
3. **Given** a project with `go.mod`, **When** `speckit scaffold` runs, **Then** templates reference Go, go test, gofmt
4. **Given** a project with `package.json` (no tsconfig), **When** `speckit scaffold` runs, **Then** templates reference JavaScript, Jest/Vitest
5. **Given** a project with `*.sh` files but no language markers, **When** `speckit scaffold` runs, **Then** templates reference Bash, shellcheck, POSIX
6. **Given** an empty project with no language markers, **When** `speckit scaffold` runs, **Then** templates use generic placeholders with comments

---

### User Story 2 - Safe Scaffold Mode (Priority: P2)

As a developer with an existing project, I want a --safe mode that shows what would be created without modifying anything, so I can review changes before applying them.

**Why this priority**: Users with existing projects need confidence that scaffold won't overwrite their work.

**Independent Test**: Run `speckit scaffold --safe` in a project with existing `.specify/` directory and verify no files are modified.

**Acceptance Scenarios**:

1. **Given** an existing project, **When** `speckit scaffold --safe` runs, **Then** output shows what would be created/modified without writing anything
2. **Given** an empty project, **When** `speckit scaffold --safe` runs, **Then** output shows full structure that would be created
3. **Given** `--safe` flag, **When** command completes, **Then** exit code is 0 and no filesystem changes occur

---

### User Story 3 - Onboarding Documentation (Priority: P2)

As a new SpecKit user, I want clear quickstart documentation in the README, so I can understand how to get started in under 5 minutes.

**Why this priority**: Documentation is the first thing users read; confusion here stops adoption.

**Independent Test**: A new user can read README.md and successfully run their first SpecKit command within 5 minutes.

**Acceptance Scenarios**:

1. **Given** a new user reading README.md, **When** they follow the Quickstart section, **Then** they successfully scaffold a project
2. **Given** README documentation, **When** a user searches for "getting started", **Then** they find clear step-by-step instructions
3. **Given** Quickstart documentation, **When** user completes it, **Then** they understand the difference between CLI and slash commands

---

### User Story 4 - CLI Output Optimization (Priority: P3)

As a developer using SpecKit, I want the first 3 lines of CLI output to show user-critical information, so I can quickly understand command results.

**Why this priority**: Improves daily UX but doesn't block initial adoption.

**Independent Test**: Run any speckit command and verify the first 3 lines contain the most important information.

**Acceptance Scenarios**:

1. **Given** any CLI command, **When** it completes, **Then** the first line shows success/failure status
2. **Given** `speckit scaffold`, **When** it completes, **Then** first 3 lines show: status, what was created, next steps
3. **Given** `speckit doctor`, **When** it completes, **Then** first line shows overall health status, details follow

---

### Edge Cases

- What happens when multiple language markers exist (e.g., package.json AND Cargo.toml)?
  - Detect primary language based on root-level markers, allow override with `--type` flag
  - Priority order: tsconfig.json > package.json > Cargo.toml > go.mod > pyproject.toml > *.sh
- What happens when scaffold --safe detects conflicts with existing files?
  - Show clear diff-style output indicating which files would be modified
- How does system handle projects using monorepo structure?
  - Detect based on current directory markers, not parent directories

## Clarifications

**C-001: Template Customization Approach**
- Decision: Use conditional sections within existing templates rather than separate template files per language
- Rationale: Simpler to maintain, follows POSIX compliance principle (no templating engine needed)
- Implementation: Templates contain language-specific blocks wrapped in markers; detection script selects appropriate block

**C-002: Detection Priority Order**
- When multiple markers exist, use this priority (most specific first):
  1. tsconfig.json → TypeScript
  2. package.json (without tsconfig) → JavaScript/Node
  3. Cargo.toml → Rust
  4. go.mod → Go
  5. pyproject.toml / requirements.txt → Python
  6. *.sh in root → Bash
  7. (none) → Generic

**C-003: CLI Output Structure**
- Line 1: Status (OK/ERROR/WARN) + main action taken
- Line 2: Key result or next step
- Line 3: Additional context or hint
- All detail output follows after a separator line

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect project type from root-level files (package.json, Cargo.toml, go.mod, pyproject.toml, *.sh)
- **FR-002**: System MUST customize constitution.md and tech-stack.md templates based on detected project type
- **FR-003**: System MUST provide `--safe` flag for scaffold command that previews changes without writing
- **FR-004**: System MUST include quickstart documentation in README.md
- **FR-005**: CLI output MUST prioritize user-critical information in first 3 lines
- **FR-006**: System MUST support fallback to generic templates when project type cannot be determined
- **FR-007**: System MUST allow explicit project type override with `--type` flag

### Key Entities

- **ProjectType**: Detected technology stack (bash, node, typescript, python, rust, go, generic)
- **Template**: Customizable document with project-type-specific content
- **SafePreview**: Non-destructive output showing planned changes

## Success Criteria

### Measurable Outcomes

- **SC-001**: New user can complete scaffold in a Python/Rust/Go project without manual template edits
- **SC-002**: `--safe` mode shows accurate preview of all changes that would be made
- **SC-003**: README quickstart section enables new user to run first command in under 5 minutes
- **SC-004**: First 3 lines of CLI output contain status and key information for all major commands
