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
├── lib/common.sh           → Colors, logging, paths, validation
├── lib/json.sh             → jq wrappers for JSON manipulation
├── speckit-state.sh        → State CRUD with v2.0 schema, UUID, registry
├── speckit-context.sh      → Project context (replaces check-prerequisites.sh)
├── speckit-feature.sh      → Feature management (replaces create-new-feature.sh)
├── speckit-scaffold.sh     → Project structure creation
└── speckit-*.sh            → Other commands

commands/speckit.*.md       → Claude Code slash commands
commands/archive/           → Deprecated init-*.md files (v1.x)
commands/utilities/         → Non-core commands (taskstoissues)
templates/                  → Document templates
```

**State file**: `.specify/orchestration-state.json` in target projects.
- v2.0: New schema with `schema_version`, `project.id` (UUID), `health`, `actions`
- v1.x: Legacy schema (auto-migrated via `speckit state migrate`)

**Central registry**: `~/.speckit/registry.json` - Tracks all projects for web UI discovery.

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
3. Update checkboxes in `REFACTORING-PLAN.md`
4. Commit with conventional commits
5. Run `./install.sh --upgrade` to deploy locally

## Key Files

- `REFACTORING-PLAN.md` - v2.0 refactoring tracking
- `HANDOFF.md` - Context for continuing development
- `scripts/bash/lib/common.sh` - Source this first; provides `log_*`, `get_*`, `validate_*`
- `commands/speckit.orchestrate.md` - Main workflow command
- `commands/speckit.init.md` - Unified interview (replaces 12 init-*.md files)

## v2.0 Key Changes

- **State schema**: New v2.0 with project UUID, health tracking, action history
- **Central registry**: Projects registered in `~/.speckit/registry.json`
- **Memory docs**: Only `constitution.md` required; others recommended
- **Init consolidation**: 12 `init-*.md` files merged into one `init.md`
- **CLI gaps fixed**: `speckit context`, `speckit feature`, registry commands
