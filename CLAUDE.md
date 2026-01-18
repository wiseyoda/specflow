# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecFlow v3.0 is a spec-driven development framework for Claude Code. This repository contains the development source - changes are deployed to users via `./install.sh` which copies files to `~/.claude/`.

## Commands

```bash
# Smart Commands (TypeScript CLI)
specflow status              # Complete project status
specflow next                # Next actionable task with context
specflow mark T007           # Mark task complete
specflow check --fix         # Validation with auto-fix
specflow state get <key>     # State operations
specflow phase close         # Close current phase (update ROADMAP, archive)

# All commands support --json for machine-readable output
specflow status --json
specflow next --json
```

## Architecture

The CLI uses a TypeScript architecture with a bash dispatcher:

```
bin/specflow                 → Bash dispatcher, routes to TypeScript CLI
packages/cli/                → TypeScript CLI implementation
├── src/
│   ├── index.ts            → Main entry, Commander.js setup
│   ├── commands/           → Command implementations
│   │   ├── status.ts       → Project status command
│   │   ├── next.ts         → Next task command
│   │   ├── mark.ts         → Mark task command
│   │   ├── check.ts        → Validation command
│   │   ├── state/          → State subcommands
│   │   └── phase/          → Phase lifecycle (open/close/status)
│   └── lib/                → Shared libraries
│       ├── tasks.ts        → Parse tasks.md
│       ├── roadmap.ts      → Parse ROADMAP.md
│       ├── checklist.ts    → Parse checklists
│       ├── context.ts      → Project context resolution
│       ├── health.ts       → Health check logic
│       ├── state.ts        → State file operations
│       └── paths.ts        → Path resolution
├── tests/                  → Vitest tests
└── dist/                   → Compiled output

commands/flow.*.md          → Claude Code slash commands (/flow.*)
```

**State file**: `.specify/orchestration-state.json` in target projects.

## CLI Syntax Notes

```bash
# State operations
specflow state get orchestration.phase.number
specflow state set orchestration.step.current=verify

# Mark tasks or checklist items
specflow mark T007              # Single task
specflow mark T007 T008 T009    # Multiple tasks
specflow mark T007..T010        # Range
specflow mark V-001             # Single verification item
specflow mark V-001 V-002       # Multiple checklist items
specflow mark I-001             # Implementation checklist item

# Validation gates
specflow check --gate design    # Verify design artifacts exist
specflow check --gate implement # Verify all tasks complete
specflow check --gate verify    # Verify checklists complete
specflow check --gate memory    # Verify memory docs healthy
specflow check --fix            # Auto-fix issues

# Phase lifecycle
specflow phase                  # Show current phase
specflow phase open 0081        # Start a specific phase
specflow phase open --hotfix    # Create and start a hotfix phase (auto-number)
specflow phase open --hotfix "Code Review"  # Hotfix with custom name
specflow phase close            # Close current phase
specflow phase close --dry-run  # Preview close operations
specflow phase defer "item"     # Add item to BACKLOG.md
specflow phase defer "item1" "item2"  # Add multiple items
specflow phase add 0010 "core-engine"  # Add phase to ROADMAP
specflow phase add 0020 "api-poc" --user-gate --gate "API works"  # With USER GATE
```

## Code Style

- TypeScript with strict mode
- ESM modules
- 2-space indentation
- Vitest for testing
- Commander.js for CLI
- Zod for validation (via @specflow/shared)

## Development Workflow

1. Make changes in `packages/cli/src/`
2. Build: `pnpm --filter @specflow/cli build`
3. Test: `pnpm --filter @specflow/cli test`
4. Run: `specflow <command>`

## Key Files

- `ROADMAP.md` - Development phases and backlog
- `.specify/phases/` - Individual phase detail files
- `.specify/memory/constitution.md` - Project principles
- `packages/cli/` - TypeScript CLI source
- `commands/flow.orchestrate.md` - Main workflow command (`/flow.orchestrate`)
- `commands/flow.design.md` - Design artifacts command (`/flow.design`)

## Important Notes

- **JSON output**: All commands support `--json` for machine-readable output
- **Monorepo**: `packages/cli`, `packages/shared`, `packages/dashboard`
- **Deprecated commands**: Old bash commands (context, doctor, tasks, etc.) show migration guidance
