# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecFlow v2.0 is a spec-driven development framework for Claude Code. This repository contains the development source - changes are deployed to users via `./install.sh` which copies files to `~/.claude/`.

## Commands

```bash
# Development
./bin/specflow help                  # CLI usage
./bin/specflow context               # Check project context
./bin/specflow state --help          # State operations
./bin/specflow scaffold --status     # Check project structure

# Installation
./install.sh                        # Install or upgrade
./install.sh --check                # Verify installation
./install.sh --upgrade              # Upgrade existing

# Testing changes locally
./install.sh --upgrade && specflow help
```

## Architecture

The CLI uses a dispatcher pattern:

```
bin/specflow                 → Main entry, routes to scripts
scripts/bash/
├── lib/
│   ├── common.sh           → Colors, logging, paths, validation
│   ├── json.sh             → jq wrappers for JSON manipulation
│   └── detection.sh        → Project type detection
├── specflow-state.sh        → State CRUD with v2.0 schema, UUID, registry
├── specflow-context.sh      → Project context
├── specflow-feature.sh      → Feature management
├── specflow-scaffold.sh     → Project structure creation
├── specflow-phase.sh        → Phase detail management (show, archive, migrate)
├── specflow-issue.sh        → Local issue tracking (list, create, close)
├── specflow-roadmap.sh      → ROADMAP operations including renumber
└── specflow-*.sh            → Other commands

commands/flow.*.md           → Claude Code slash commands (/flow.*)
commands/utilities/         → Non-core commands (taskstoissues)
templates/                  → Document templates
```

**State file**: `.specify/orchestration-state.json` in target projects.
- v2.0: New schema with `schema_version`, `project.id` (UUID), `health`, `actions`
- v1.x: Legacy schema (auto-migrated via `specflow state migrate`)

**Central registry**: `~/.specflow/registry.json` - Tracks all projects for web UI discovery.

## CLI Syntax Notes

Commands with non-standard syntax (differs from common CLI patterns):

```bash
# State set uses key=value (NOT key value)
specflow state set orchestration.phase.status=complete    # Correct
specflow state set orchestration.phase.status complete    # Wrong

# State get uses dot notation
specflow state get orchestration.phase.status
specflow state get orchestration --json
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
2. Test with `./bin/specflow <command>`
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
- `scripts/bash/specflow-phase.sh` - Phase detail management
- `scripts/bash/specflow-issue.sh` - Local issue tracking
- `scripts/bash/specflow-gate.sh` - Validation gate enforcement
- `scripts/bash/specflow-lessons.sh` - Lessons learned management
- `commands/flow.orchestrate.md` - Main workflow command (`/flow.orchestrate`)
- `commands/flow.init.md` - Unified interview (`/flow.init`)
- `commands/flow.merge.md` - Phase completion with auto-archiving (`/flow.merge`)
- `commands/flow.review.md` - Systematic code review workflow (`/flow.review`)

## v2.0 Key Changes

- **State schema**: New v2.0 with project UUID, health tracking, action history
- **Central registry**: Projects registered in `~/.specflow/registry.json`
- **Memory docs**: Only `constitution.md` required; others recommended
- **Init consolidation**: 12 `init-*.md` files deleted (merged into `init.md`)
- **CLI gaps fixed**: `specflow context`, `specflow feature`, registry commands
- **Workflow integration**: `specflow gate` (validation gates) and `specflow lessons` (lessons learned) integrated into orchestrate workflow
- **Memory commands**: `/flow.memory` (verify/reconcile)
- **Phase completion**: `/flow.merge` and `/flow.backlog` for end-of-phase workflows
- **Modular ROADMAP**: `specflow phase` (detail management), `specflow issue` (local tracking), `specflow roadmap renumber`
- **Auto-archiving**: `/flow.merge` archives phase details to HISTORY.md automatically

## v2.1 Key Changes

- **DISCOVER step**: New first step in orchestrate workflow that examines codebase and asks progressive clarifying questions BEFORE writing specs. Findings saved to `discovery.md`. Skip with `--no-discovery` flag.
- **Doctor suggestions**: Doctor now displays actionable fix commands (e.g., `specflow templates sync`, `specflow doctor --fix`) at end of output
- **Template sync**: New `specflow templates sync` command updates outdated templates AND copies new templates missing from project
- **Template errors**: Missing templates now flagged as errors (not warnings) since they cause workflow failures
- **Orchestrate workflow**: Was 9 steps (now consolidated to 4 in v2.3)

## v2.2 Key Changes

- **Pre-workflow consolidation**: Reduced 7 pre-workflow commands to 3 active + 3 deprecated stubs
  - **Active**: `/flow.init` (expanded), `/flow.memory`, `/flow.roadmap` (expanded with `add-pdr`)
  - **Deprecated**: `/flow.start` → use `/flow.orchestrate`, `/flow.constitution` → use `/flow.init`, `/flow.phase` → use `/flow.roadmap add-pdr`
  - **Deleted**: `/flow.memory-init` (merged into `/flow.init`)
- **Unified init**: `/flow.init` now runs complete 4-step flow: discovery → constitution → memory docs → roadmap
- **Smart idempotency**: Init detects templates vs completed content using placeholder detection
- **PDR-to-phase**: `/flow.roadmap add-pdr` converts approved PDRs to ROADMAP phases

## v2.3 Key Changes (Workflow Consolidation)

- **4-step orchestrate workflow**: Reduced from 9 steps to 4: design → analyze → implement → verify
  - Step indices: 0=design, 1=analyze, 2=implement, 3=verify
  - Auto-migrates old 9-step state to new 4-step indices
- **New `/flow.design` command**: Produces ALL design artifacts in one command:
  - discovery.md, spec.md, requirements.md, plan.md, tasks.md
  - checklists/implementation.md, checklists/verification.md
  - Cascade flags: `--spec`, `--plan`, `--tasks`, `--checklist` for partial regeneration
  - Resumable if interrupted (discovery always re-runs on resume)
- **Deprecated 6 commands** (with migration stubs):
  - `/flow.specify` → use `/flow.design`
  - `/flow.clarify` → use `/flow.design` (inline clarification)
  - `/flow.plan` → use `/flow.design --plan`
  - `/flow.tasks` → use `/flow.design --tasks`
  - `/flow.checklist` → use `/flow.design --checklist`
  - `/flow.backlog` → use `/flow.roadmap backlog`
- **Roadmap backlog subcommand**: `/flow.roadmap backlog` replaces standalone `/flow.backlog`
- **Command count**: Reduced from 11 to 6 active workflow commands
