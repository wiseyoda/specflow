# Feature Specification: Pre-Workflow Commands Consolidation

**Feature Branch**: `0070-preworkflow-consolidation`
**Created**: 2026-01-17
**Status**: Draft
**Input**: PDR: pdr-preworkflow-consolidation.md

## Overview

Consolidate 7 pre-workflow commands into 3, with clear separation between one-time setup and ongoing utilities. The goal is to reduce user confusion about which commands to run and when.

**Before (7 commands)**: start, init, constitution, memory, memory-init, roadmap, phase

**After (3 commands)**: init, memory, roadmap

---

## User Scenarios & Testing

### User Story 1 - One-Command Project Setup (Priority: P1)

As a developer starting a new SpecKit project, I want to run one command that handles all initial setup, so that I don't have to remember a sequence of 4-5 commands or wonder what order to run them.

**Why this priority**: This is the core value proposition of the consolidation - new users can get started with a single command instead of learning the current 4-step process.

**Independent Test**: Run `/speckit.init` on a fresh project and verify all artifacts are created (constitution, memory docs, roadmap).

**Acceptance Scenarios**:

1. **Given** a new project directory with no `.specify/` folder, **When** user runs `/speckit.init`, **Then** the command runs the complete setup flow: interview → constitution → memory docs → roadmap
2. **Given** a project with existing `.specify/` structure but incomplete constitution (template placeholders), **When** user runs `/speckit.init`, **Then** it detects the incomplete state and regenerates the constitution
3. **Given** a project with fully completed constitution and memory docs, **When** user runs `/speckit.init`, **Then** it skips already-completed steps and reports what was skipped

---

### User Story 2 - Deprecated Command Guidance (Priority: P1)

As an existing user who remembers the old commands, I want clear deprecation notices that guide me to the new commands, so that I'm not confused when old commands stop working.

**Why this priority**: Breaking change mitigation is critical for user experience - users shouldn't be left confused.

**Independent Test**: Run each deprecated command and verify it shows helpful deprecation notice.

**Acceptance Scenarios**:

1. **Given** a user runs `/speckit.start`, **When** the command executes, **Then** it displays a deprecation notice pointing to `/speckit.orchestrate`
2. **Given** a user runs `/speckit.constitution`, **When** the command executes, **Then** it displays a deprecation notice pointing to `/speckit.init`
3. **Given** a user runs `/speckit.phase`, **When** the command executes, **Then** it displays a deprecation notice pointing to `/speckit.roadmap add-pdr`

---

### User Story 3 - PDR to Roadmap Conversion (Priority: P2)

As a developer with PDRs, I want to run `/speckit.roadmap add-pdr` to add phases from my PDRs, so that roadmap management is consolidated in one command.

**Why this priority**: This moves existing functionality to a more logical location - it's consolidation, not new functionality.

**Independent Test**: Create a PDR file, run `/speckit.roadmap add-pdr`, verify phase is added to ROADMAP.md.

**Acceptance Scenarios**:

1. **Given** approved PDRs exist in `.specify/memory/pdrs/`, **When** user runs `/speckit.roadmap add-pdr`, **Then** it lists available PDRs and lets user select which to convert
2. **Given** a specific PDR filename, **When** user runs `/speckit.roadmap add-pdr pdr-feature.md`, **Then** it converts that PDR to a ROADMAP phase
3. **Given** the roadmap already has phases, **When** user adds a new PDR, **Then** it assigns the next available phase number

---

### User Story 4 - Memory Health Checks (Priority: P2)

As a developer whose project has evolved, I want to verify my memory documents are still accurate and fix drift, so that Claude's context about my project stays current.

**Why this priority**: Memory health is important for ongoing project maintenance, but not blocking for the consolidation.

**Independent Test**: Run `/speckit.memory verify` and `/speckit.memory reconcile` to check document health.

**Acceptance Scenarios**:

1. **Given** memory documents exist, **When** user runs `/speckit.memory` (default), **Then** it runs verification and reports document health
2. **Given** memory documents have drift from codebase, **When** user runs `/speckit.memory --reconcile`, **Then** it detects and reports drift
3. **Given** completed specs with promotable decisions, **When** user runs `/speckit.memory --promote`, **Then** it surfaces decisions that should become memory

---

### Edge Cases

- What happens if user runs `/speckit.init` while a phase is in progress? → Warn and abort (don't disrupt active work)
- What happens if constitution template has custom placeholders? → Smart detection should look for common patterns
- What happens if `/speckit.memory generate` is called (removed subcommand)? → Show helpful message suggesting `/speckit.init`
- What happens if user has outdated command in a script? → Deprecation stubs catch this and provide guidance

---

## Requirements

### Functional Requirements

#### FR-100: Init Command Expansion

- **FR-101**: `/speckit.init` MUST run the complete setup flow: interview → constitution → memory docs → roadmap
- **FR-102**: `/speckit.init` MUST be idempotent - detect completed steps and skip them with notice
- **FR-103**: `/speckit.init` MUST detect template placeholders vs completed content (smart detection)
- **FR-104**: `/speckit.init` MUST preserve existing completed artifacts unless explicitly asked to regenerate
- **FR-105**: `/speckit.init` MUST provide `--force` flag to regenerate all artifacts even if they exist

#### FR-200: Deprecation Stubs

- **FR-201**: `/speckit.start` MUST display deprecation notice pointing to `/speckit.orchestrate`
- **FR-202**: `/speckit.constitution` MUST display deprecation notice pointing to `/speckit.init`
- **FR-203**: `/speckit.phase` MUST display deprecation notice pointing to `/speckit.roadmap add-pdr`
- **FR-204**: `/speckit.memory-init` file MUST be deleted (already shows deprecation)
- **FR-205**: All deprecation stubs MUST be minimal (<50 lines) and focused only on the redirect message

#### FR-300: Memory Command Reduction

- **FR-301**: `/speckit.memory` MUST support `verify` functionality (document quality checks)
- **FR-302**: `/speckit.memory` MUST support `reconcile` functionality (drift detection)
- **FR-303**: `/speckit.memory` MUST support `promote` functionality (surface decisions from specs)
- **FR-304**: `/speckit.memory` MUST NOT include `generate` subcommand (removed)
- **FR-305**: If user attempts `generate` subcommand, show helpful message about `/speckit.init`

#### FR-400: Roadmap Command Expansion

- **FR-401**: `/speckit.roadmap` MUST support `add-pdr` as first positional argument (subcommand pattern)
- **FR-402**: `add-pdr` MUST list available PDRs when no PDR file specified
- **FR-403**: `add-pdr` MUST accept PDR filename as second positional argument
- **FR-404**: `add-pdr` MUST mark PDRs as processed after conversion
- **FR-405**: Existing roadmap functionality (empty = create/update, project description) MUST continue working
- **FR-406**: Argument routing MUST be documented in table format at top of command file

#### FR-500: Documentation Updates

- **FR-501**: CLAUDE.md MUST be updated to reflect new command structure
- **FR-502**: docs/commands-analysis.md MUST be updated with new command inventory
- **FR-503**: Command handoffs referencing deprecated commands MUST be updated
- **FR-504**: Workflow diagrams MUST reflect new 3-command pre-workflow structure

### Key Entities

- **Command File**: Markdown file in `commands/speckit.*.md` defining a slash command's behavior
- **Deprecation Stub**: Minimal command file that only shows a redirect message
- **Memory Document**: Markdown file in `.specify/memory/` containing project context
- **PDR**: Product Design Requirement document in `.specify/memory/pdrs/`

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Pre-workflow command count reduced from 7 to 3 active commands (+ 3 deprecation stubs)
- **SC-002**: New project can be set up from zero to ready-for-orchestrate with single `/speckit.init` command
- **SC-003**: All deprecated commands show helpful redirect messages with correct target commands
- **SC-004**: Existing projects with completed constitution/memory/roadmap continue to work without changes
- **SC-005**: No functionality is lost in the consolidation - all capabilities preserved under new structure

---

## Non-Goals

- **NG-001**: Not changing main workflow commands (orchestrate, specify, plan, etc.)
- **NG-002**: Not adding new functionality beyond consolidation
- **NG-003**: Not modifying CLI bash scripts (only Claude commands)
- **NG-004**: Not changing orchestration state format or schema
- **NG-005**: Not modifying dashboard integration (separate PDR)
