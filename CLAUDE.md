# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecKit v2.0 is a spec-driven development framework for Claude Code. This repository contains the development source - changes are deployed to users via `./install.sh` which copies files to `~/.claude/`.

## Commands

```bash
# Development
./bin/speckit help                  # CLI usage
./bin/speckit context               # Check project context
./bin/speckit state --help          # State operations
./bin/speckit scaffold --status     # Check project structure

# Installation
./install.sh                        # Install or upgrade
./install.sh --check                # Verify installation
./install.sh --upgrade              # Upgrade existing

# Testing changes locally
./install.sh --upgrade && speckit help
```

## Architecture

The CLI uses a dispatcher pattern:

```
bin/speckit                 → Main entry, routes to scripts
scripts/bash/
├── lib/
│   ├── common.sh           → Colors, logging, paths, validation
│   ├── json.sh             → jq wrappers for JSON manipulation
│   └── detection.sh        → Project type detection
├── speckit-state.sh        → State CRUD with v2.0 schema, UUID, registry
├── speckit-context.sh      → Project context
├── speckit-feature.sh      → Feature management
├── speckit-scaffold.sh     → Project structure creation
├── speckit-phase.sh        → Phase detail management (show, archive, migrate)
├── speckit-issue.sh        → Local issue tracking (list, create, close)
├── speckit-roadmap.sh      → ROADMAP operations including renumber
└── speckit-*.sh            → Other commands

commands/speckit.*.md       → Claude Code slash commands
commands/utilities/         → Non-core commands (taskstoissues)
templates/                  → Document templates
```

**State file**: `.specify/orchestration-state.json` in target projects.
- v2.0: New schema with `schema_version`, `project.id` (UUID), `health`, `actions`
- v1.x: Legacy schema (auto-migrated via `speckit state migrate`)

**Central registry**: `~/.speckit/registry.json` - Tracks all projects for web UI discovery.

## CLI Syntax Notes

Commands with non-standard syntax (differs from common CLI patterns):

```bash
# State set uses key=value (NOT key value)
speckit state set orchestration.phase.status=complete    # Correct
speckit state set orchestration.phase.status complete    # Wrong

# State get uses dot notation
speckit state get orchestration.phase.status
speckit state get orchestration --json
```

## Code Style

- POSIX-compliant bash, validated with shellcheck
- 2-space indentation
- Functions: `snake_case`, Constants: `UPPER_SNAKE_CASE`
- Exit codes: 0=success, 1=error, 2=warning
- All library files guard against double-sourcing
- Scripts support `--help` and `--json` flags

## Development Workflow

1. Make changes in this repository
2. Test with `./bin/speckit <command>`
3. Commit with conventional commits
4. Run `./install.sh --upgrade` to deploy locally

## Key Files

- `ROADMAP.md` - Development phases and backlog (lightweight index)
- `.specify/phases/` - Individual phase detail files
- `.specify/issues/` - Local issue tracking files
- `.specify/history/HISTORY.md` - Archived completed phases
- `.specify/memory/constitution.md` - Project principles
- `.specify/memory/tech-stack.md` - Approved technologies
- `scripts/bash/lib/common.sh` - Source this first; provides `log_*`, `get_*`, `validate_*`
- `scripts/bash/speckit-phase.sh` - Phase detail management
- `scripts/bash/speckit-issue.sh` - Local issue tracking
- `scripts/bash/speckit-gate.sh` - Validation gate enforcement
- `scripts/bash/speckit-lessons.sh` - Lessons learned management
- `commands/speckit.orchestrate.md` - Main workflow command
- `commands/speckit.init.md` - Unified interview (replaces 12 init-*.md files)
- `commands/speckit.merge.md` - Phase completion with auto-archiving
- `commands/speckit.review.md` - Systematic code review workflow

## v2.0 Key Changes

- **State schema**: New v2.0 with project UUID, health tracking, action history
- **Central registry**: Projects registered in `~/.speckit/registry.json`
- **Memory docs**: Only `constitution.md` required; others recommended
- **Init consolidation**: 12 `init-*.md` files deleted (merged into `init.md`)
- **CLI gaps fixed**: `speckit context`, `speckit feature`, registry commands
- **Workflow integration**: `speckit gate` (validation gates) and `speckit lessons` (lessons learned) integrated into orchestrate workflow
- **Memory commands**: `/speckit.memory` (verify/reconcile)
- **Phase completion**: `/speckit.merge` and `/speckit.backlog` for end-of-phase workflows
- **Modular ROADMAP**: `speckit phase` (detail management), `speckit issue` (local tracking), `speckit roadmap renumber`
- **Auto-archiving**: `/speckit.merge` archives phase details to HISTORY.md automatically

## v2.1 Key Changes

- **DISCOVER step**: New first step in orchestrate workflow that examines codebase and asks progressive clarifying questions BEFORE writing specs. Findings saved to `discovery.md`. Skip with `--no-discovery` flag.
- **Doctor suggestions**: Doctor now displays actionable fix commands (e.g., `speckit templates sync`, `speckit doctor --fix`) at end of output
- **Template sync**: New `speckit templates sync` command updates outdated templates AND copies new templates missing from project
- **Template errors**: Missing templates now flagged as errors (not warnings) since they cause workflow failures
- **Orchestrate workflow**: Was 9 steps (now consolidated to 4 in v2.3)

## v2.2 Key Changes

- **Pre-workflow consolidation**: Reduced 7 pre-workflow commands to 3 active + 3 deprecated stubs
  - **Active**: `/speckit.init` (expanded), `/speckit.memory`, `/speckit.roadmap` (expanded with `add-pdr`)
  - **Deprecated**: `/speckit.start` → use `/speckit.orchestrate`, `/speckit.constitution` → use `/speckit.init`, `/speckit.phase` → use `/speckit.roadmap add-pdr`
  - **Deleted**: `/speckit.memory-init` (merged into `/speckit.init`)
- **Unified init**: `/speckit.init` now runs complete 4-step flow: discovery → constitution → memory docs → roadmap
- **Smart idempotency**: Init detects templates vs completed content using placeholder detection
- **PDR-to-phase**: `/speckit.roadmap add-pdr` converts approved PDRs to ROADMAP phases

## v2.3 Key Changes (Workflow Consolidation)

- **4-step orchestrate workflow**: Reduced from 9 steps to 4: design → analyze → implement → verify
  - Step indices: 0=design, 1=analyze, 2=implement, 3=verify
  - Auto-migrates old 9-step state to new 4-step indices
- **New `/speckit.design` command**: Produces ALL design artifacts in one command:
  - discovery.md, spec.md, requirements.md, plan.md, tasks.md
  - checklists/implementation.md, checklists/verification.md
  - Cascade flags: `--spec`, `--plan`, `--tasks`, `--checklist` for partial regeneration
  - Resumable if interrupted (discovery always re-runs on resume)
- **Deprecated 6 commands** (with migration stubs):
  - `/speckit.specify` → use `/speckit.design`
  - `/speckit.clarify` → use `/speckit.design` (inline clarification)
  - `/speckit.plan` → use `/speckit.design --plan`
  - `/speckit.tasks` → use `/speckit.design --tasks`
  - `/speckit.checklist` → use `/speckit.design --checklist`
  - `/speckit.backlog` → use `/speckit.roadmap backlog`
- **Roadmap backlog subcommand**: `/speckit.roadmap backlog` replaces standalone `/speckit.backlog`
- **Command count**: Reduced from 11 to 6 active workflow commands
