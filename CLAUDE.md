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
- **Memory commands**: `/speckit.memory` (verify/reconcile) and `/speckit.memory-init` (generate from codebase)
- **Phase completion**: `/speckit.merge` and `/speckit.backlog` for end-of-phase workflows
- **Modular ROADMAP**: `speckit phase` (detail management), `speckit issue` (local tracking), `speckit roadmap renumber`
- **Auto-archiving**: `/speckit.merge` archives phase details to HISTORY.md automatically
