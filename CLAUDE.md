# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecKit is a spec-driven development framework for Claude Code. This repository contains the development source - changes are deployed to users via `./install.sh` which copies files to `~/.claude/`.

## Commands

```bash
# Development
./bin/speckit help                  # CLI usage
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
├── speckit-state.sh        → State CRUD (get, set, init, validate)
├── speckit-scaffold.sh     → Project structure creation
└── speckit-*.sh            → Other commands (some TODO)

commands/speckit.*.md       → Claude Code slash commands
templates/                  → Document templates
```

**State file**: `.specify/orchestration-state.json` in target projects. Two schema versions exist:
- v1.0: Config in `.project` (older projects)
- v2.0: Config in `.config` (new projects)

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
3. Update checkboxes in `IMPROVEMENT-PLAN.md`
4. Commit with conventional commits
5. Run `./install.sh --upgrade` to deploy locally

## Key Files

- `IMPROVEMENT-PLAN.md` - Task tracking with 7 phases, current focus
- `HANDOFF.md` - Context for continuing development
- `lib/common.sh` - Source this first; provides `log_*`, `get_*`, `validate_*` functions
- `commands/speckit.orchestrate.md` - Main workflow command

## Current Focus

See `IMPROVEMENT-PLAN.md` for active phase. Phase 1 (core infrastructure) is complete. Phases 2-7 implement remaining CLI commands and refactor Claude commands to use them.
